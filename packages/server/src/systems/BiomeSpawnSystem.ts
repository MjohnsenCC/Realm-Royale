import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { generateId } from "../utils/idGenerator";
import {
  DifficultyZone,
  EnemyAIState,
  HOSTILE_TILE_SIZE,
  HOSTILE_TILES,
  MIN_SPAWN_DISTANCE,
  distanceBetween,
  ENEMY_DEFS,
  REALM_SPAWN_CONFIG,
  getEnemyTypesForBiomeAndZone,
  getRealmMap,
} from "@rotmg-lite/shared";

interface RespawnEntry {
  zone: number; // DifficultyZone
  timer: number; // ms remaining
}

// Pre-indexed tile positions per difficulty zone for O(1) random position selection
interface TileIndex {
  positions: Float32Array; // interleaved [x0,y0, x1,y1, ...] in pixel coords
  count: number;
}

export class BiomeSpawnSystem {
  private respawnQueue: RespawnEntry[] = [];
  private zoneCounts = new Map<number, number>();
  private initialized = false;
  private tileIndex = new Map<number, TileIndex>();

  update(deltaTime: number, state: GameState): void {
    // Check if any hostile player exists
    let hasHostilePlayer = false;
    state.players.forEach((p) => {
      if (p.alive && p.zone === "hostile") hasHostilePlayer = true;
    });
    if (!hasHostilePlayer) return;

    // Initial population on first hostile player
    if (!this.initialized) {
      this.buildTileIndex();
      this.populateAll(state);
      this.initialized = true;
    }

    // Process respawn queue
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      this.respawnQueue[i].timer -= deltaTime;
      if (this.respawnQueue[i].timer <= 0) {
        const entry = this.respawnQueue.splice(i, 1)[0];
        this.spawnEnemyInZone(entry.zone, state);
      }
    }
  }

  onEnemyKilled(difficultyZone: number): void {
    const config = REALM_SPAWN_CONFIG[difficultyZone];
    if (!config) return;
    this.respawnQueue.push({
      zone: difficultyZone,
      timer: config.respawnDelay,
    });
    const current = this.zoneCounts.get(difficultyZone) ?? 0;
    this.zoneCounts.set(difficultyZone, Math.max(0, current - 1));
  }

  private buildTileIndex(): void {
    const map = getRealmMap();
    if (!map) return;

    // Collect tiles per difficulty zone
    const buckets = new Map<number, number[]>();
    for (let zone = 0; zone <= 4; zone++) {
      buckets.set(zone, []);
    }

    for (let ty = 0; ty < HOSTILE_TILES; ty++) {
      for (let tx = 0; tx < HOSTILE_TILES; tx++) {
        const idx = ty * map.width + tx;
        const dz = map.difficulty[idx];
        // Skip water tiles
        const biome = map.biomes[idx];
        if (biome === 0 || biome === 1 || biome === 15) continue; // Ocean, ShallowWater, Lake

        const bucket = buckets.get(dz);
        if (bucket) {
          // Store pixel center of tile
          const px = tx * HOSTILE_TILE_SIZE + HOSTILE_TILE_SIZE / 2;
          const py = ty * HOSTILE_TILE_SIZE + HOSTILE_TILE_SIZE / 2;
          bucket.push(px, py);
        }
      }
    }

    for (const [zone, coords] of buckets) {
      const positions = new Float32Array(coords);
      this.tileIndex.set(zone, {
        positions,
        count: coords.length / 2,
      });
    }
  }

  private populateAll(state: GameState): void {
    const zones = [
      DifficultyZone.Shore,
      DifficultyZone.Lowlands,
      DifficultyZone.Midlands,
      DifficultyZone.Highlands,
      DifficultyZone.Godlands,
    ];
    for (const zone of zones) {
      const config = REALM_SPAWN_CONFIG[zone];
      if (!config) continue;
      this.zoneCounts.set(zone, 0);
      for (let i = 0; i < config.maxEnemies; i++) {
        this.spawnEnemyInZone(zone, state);
      }
    }
  }

  private spawnEnemyInZone(zone: number, state: GameState): void {
    const config = REALM_SPAWN_CONFIG[zone];
    if (!config) return;
    const currentCount = this.zoneCounts.get(zone) ?? 0;
    if (currentCount >= config.maxEnemies) return;

    const map = getRealmMap();
    if (!map) return;

    const pos = this.findSpawnPosition(zone, state);
    if (!pos) return;

    // Look up biome at spawn position for biome-affinity enemy selection
    const tx = Math.floor(pos.x / HOSTILE_TILE_SIZE);
    const ty = Math.floor(pos.y / HOSTILE_TILE_SIZE);
    const biome = map.biomes[ty * map.width + tx];

    // Pick an enemy type matching this biome + zone
    const candidates = getEnemyTypesForBiomeAndZone(biome, zone);
    if (candidates.length === 0) return;
    const enemyType = candidates[Math.floor(Math.random() * candidates.length)];
    const def = ENEMY_DEFS[enemyType];
    if (!def) return;

    const enemy = new Enemy();
    enemy.id = generateId("enemy");
    enemy.x = pos.x;
    enemy.y = pos.y;
    enemy.spawnX = pos.x;
    enemy.spawnY = pos.y;
    enemy.hp = def.hp;
    enemy.maxHp = def.hp;
    enemy.enemyType = def.type;
    enemy.aiState = EnemyAIState.Idle;
    enemy.idleTargetX = pos.x + (Math.random() - 0.5) * 60;
    enemy.idleTargetY = pos.y + (Math.random() - 0.5) * 60;

    state.enemies.set(enemy.id, enemy);
    this.zoneCounts.set(zone, currentCount + 1);
  }

  private findSpawnPosition(
    zone: number,
    state: GameState
  ): { x: number; y: number } | null {
    const index = this.tileIndex.get(zone);
    if (!index || index.count === 0) return null;

    // Try random tiles from pre-indexed positions (O(1) per attempt)
    for (let attempt = 0; attempt < 30; attempt++) {
      const tileIdx = Math.floor(Math.random() * index.count);
      const x = index.positions[tileIdx * 2];
      const y = index.positions[tileIdx * 2 + 1];

      // Check not too close to any player
      let tooClose = false;
      state.players.forEach((p) => {
        if (
          p.alive &&
          p.zone === "hostile" &&
          distanceBetween(x, y, p.x, p.y) < MIN_SPAWN_DISTANCE
        ) {
          tooClose = true;
        }
      });

      if (!tooClose) return { x, y };
    }

    // Fallback: pick a random tile without player distance check
    const tileIdx = Math.floor(Math.random() * index.count);
    return {
      x: index.positions[tileIdx * 2],
      y: index.positions[tileIdx * 2 + 1],
    };
  }

  reset(): void {
    this.respawnQueue = [];
    this.zoneCounts.clear();
    this.tileIndex.clear();
    this.initialized = false;
  }
}
