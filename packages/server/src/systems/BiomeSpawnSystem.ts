import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { generateId } from "../utils/idGenerator";
import {
  BiomeType,
  EnemyAIState,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  MIN_SPAWN_DISTANCE,
  distanceBetween,
  clamp,
  BIOME_SPAWN_CONFIG,
  ENEMY_DEFS,
  getEnemyTypesForBiome,
  getBiomeAtPosition,
  BIOME_ANCHORS,
} from "@rotmg-lite/shared";

interface RespawnEntry {
  biome: number;
  timer: number; // ms remaining
}

export class BiomeSpawnSystem {
  private respawnQueue: RespawnEntry[] = [];
  private biomeCounts = new Map<number, number>();
  private initialized: boolean = false;

  update(deltaTime: number, state: GameState): void {
    // Check if any hostile player exists
    let hasHostilePlayer = false;
    state.players.forEach((p) => {
      if (p.alive && p.zone === "hostile") hasHostilePlayer = true;
    });
    if (!hasHostilePlayer) return;

    // Initial population on first hostile player
    if (!this.initialized) {
      this.populateAll(state);
      this.initialized = true;
    }

    // Process respawn queue
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      this.respawnQueue[i].timer -= deltaTime;
      if (this.respawnQueue[i].timer <= 0) {
        const entry = this.respawnQueue.splice(i, 1)[0];
        this.spawnEnemyInBiome(entry.biome, state);
      }
    }
  }

  onEnemyKilled(biome: number): void {
    const config = BIOME_SPAWN_CONFIG[biome];
    if (!config) return;
    this.respawnQueue.push({
      biome,
      timer: config.respawnDelay,
    });
    const current = this.biomeCounts.get(biome) ?? 0;
    this.biomeCounts.set(biome, Math.max(0, current - 1));
  }

  private populateAll(state: GameState): void {
    const biomes = [
      BiomeType.Shoreline,
      BiomeType.Meadow,
      BiomeType.Forest,
      BiomeType.Hellscape,
      BiomeType.Godlands,
    ];
    for (const biome of biomes) {
      const config = BIOME_SPAWN_CONFIG[biome];
      this.biomeCounts.set(biome, 0);
      for (let i = 0; i < config.maxEnemies; i++) {
        this.spawnEnemyInBiome(biome, state);
      }
    }
  }

  private spawnEnemyInBiome(biome: number, state: GameState): void {
    const config = BIOME_SPAWN_CONFIG[biome];
    if (!config) return;
    const currentCount = this.biomeCounts.get(biome) ?? 0;
    if (currentCount >= config.maxEnemies) return;

    // Pick a random enemy type from this biome
    const biomeEnemyTypes = getEnemyTypesForBiome(biome);
    if (biomeEnemyTypes.length === 0) return;
    const enemyType =
      biomeEnemyTypes[Math.floor(Math.random() * biomeEnemyTypes.length)];
    const def = ENEMY_DEFS[enemyType];
    if (!def) return;

    const pos = this.findSpawnPositionInBiome(biome, state);

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
    this.biomeCounts.set(biome, currentCount + 1);
  }

  // Approximate distance ranges from nearest anchor where each biome tends to appear
  private static readonly DIST_HINTS: Record<number, { min: number; max: number }> = {
    [BiomeType.Shoreline]: { min: 0, max: 2500 },
    [BiomeType.Meadow]: { min: 1000, max: 4500 },
    [BiomeType.Forest]: { min: 2500, max: 6000 },
    [BiomeType.Hellscape]: { min: 4000, max: 7500 },
    [BiomeType.Godlands]: { min: 5000, max: 9000 },
  };

  private findSpawnPositionInBiome(
    biome: number,
    state: GameState
  ): { x: number; y: number } {
    const hint = BiomeSpawnSystem.DIST_HINTS[biome] ?? { min: 0, max: 8000 };

    // Rejection sampling: pick a random anchor, sample at hinted distance, verify biome
    for (let attempt = 0; attempt < 100; attempt++) {
      const anchor =
        BIOME_ANCHORS[Math.floor(Math.random() * BIOME_ANCHORS.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist = hint.min + Math.random() * (hint.max - hint.min);
      const x = clamp(anchor.x + Math.cos(angle) * dist, 50, ARENA_WIDTH - 50);
      const y = clamp(anchor.y + Math.sin(angle) * dist, 50, ARENA_HEIGHT - 50);

      if (getBiomeAtPosition(x, y) !== biome) continue;

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

    // Fallback: random map position, verify biome (skip player check)
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = 50 + Math.random() * (ARENA_WIDTH - 100);
      const y = 50 + Math.random() * (ARENA_HEIGHT - 100);
      if (getBiomeAtPosition(x, y) === biome) return { x, y };
    }

    // Ultimate fallback: center of map
    return { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
  }

  reset(): void {
    this.respawnQueue = [];
    this.biomeCounts.clear();
    this.initialized = false;
  }
}
