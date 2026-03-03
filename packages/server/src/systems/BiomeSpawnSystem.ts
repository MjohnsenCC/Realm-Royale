import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { generateId } from "../utils/idGenerator";
import {
  DifficultyZone,
  MovementPatternType,
  EnemyAIState,
  HOSTILE_TILE_SIZE,
  HOSTILE_TILES,
  distanceBetween,
  ENEMY_DEFS,
  getEnemyTypesForBiomeAndZone,
  getRealmMap,
  isPackLeader,
  getPackDef,
} from "@rotmg-lite/shared";
import type { RealmMapData } from "@rotmg-lite/shared";

// --- Chunk constants ---
const CHUNK_SIZE = 100; // 100x100 tile chunks
const CHUNK_COUNT = Math.ceil(HOSTILE_TILES / CHUNK_SIZE); // 21 chunks per axis
const CHUNK_PX = CHUNK_SIZE * HOSTILE_TILE_SIZE; // 4000px per chunk

// Lazy activation: only populate chunks within this range of a player
const ACTIVATION_RANGE = 2500; // px
const DEACTIVATION_RANGE = 4000; // px -- despawn enemies beyond this

// Off-screen spawn minimum distance (must exceed half-diagonal of largest expected viewport)
const MIN_SPAWN_DISTANCE = 1000; // 25 tiles — safe for 1920x1080+ monitors

// --- Chunk data ---
interface ChunkData {
  chunkX: number;
  chunkY: number;
  zone: number; // Dominant DifficultyZone
  biome: number; // Dominant biome for enemy selection
  targetDensity: number; // Target enemy count
  currentCount: number; // Live enemy count
  isNearSetpiece: boolean;
  spawnPositions: Float32Array; // [x0,y0, x1,y1, ...] in pixel coords
  spawnPositionCount: number;
}

interface ChunkRespawnEntry {
  chunkX: number;
  chunkY: number;
  count: number; // Batch size (2-4)
  timer: number; // ms remaining
}

// Target density per 100x100 chunk by difficulty zone
function getTargetDensity(zone: number, isNearSetpiece: boolean): number {
  let base: number;
  switch (zone) {
    case DifficultyZone.Shore:
      base = 17;
      break; // 15-20 range
    case DifficultyZone.Lowlands:
      base = 28;
      break; // 25-35
    case DifficultyZone.Midlands:
      base = 30;
      break; // 25-35
    case DifficultyZone.Highlands:
      base = 45;
      break; // 40-55
    case DifficultyZone.Godlands:
      base = 48;
      break; // 40-55
    default:
      base = 0;
  }
  if (isNearSetpiece) base = Math.floor(base * 1.5);
  return base;
}

// Respawn delay by zone (with +-30% randomness)
function getRespawnDelay(zone: number): number {
  let baseDelay: number;
  switch (zone) {
    case DifficultyZone.Shore:
      baseDelay = 20000;
      break;
    case DifficultyZone.Lowlands:
      baseDelay = 14000;
      break;
    case DifficultyZone.Midlands:
      baseDelay = 14000;
      break;
    case DifficultyZone.Highlands:
      baseDelay = 10000;
      break;
    case DifficultyZone.Godlands:
      baseDelay = 10000;
      break;
    default:
      baseDelay = 15000;
  }
  return baseDelay * (0.7 + Math.random() * 0.6);
}

export class BiomeSpawnSystem {
  private chunks: ChunkData[][] = []; // [cy][cx]
  private activeChunks = new Set<string>();
  private respawnQueue: ChunkRespawnEntry[] = [];
  private initialized = false;
  // Track which chunk each enemy belongs to (enemyId -> "cx,cy")
  private enemyChunkMap = new Map<string, string>();

  update(deltaTime: number, state: GameState): void {
    // Check if any hostile player exists
    let hasHostilePlayer = false;
    state.players.forEach((p) => {
      if (p.alive && p.zone === "hostile") hasHostilePlayer = true;
    });
    if (!hasHostilePlayer) return;

    // Initial chunk index build
    if (!this.initialized) {
      this.buildChunkIndex();
      this.initialized = true;
    }

    // Lazy chunk activation/deactivation
    this.updateChunkActivation(state);

    // Process respawn queue
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      this.respawnQueue[i].timer -= deltaTime;
      if (this.respawnQueue[i].timer <= 0) {
        const entry = this.respawnQueue.splice(i, 1)[0];
        const key = `${entry.chunkX},${entry.chunkY}`;
        if (this.activeChunks.has(key)) {
          this.batchRespawnInChunk(entry, state);
        }
      }
    }
  }

  onEnemyKilled(
    _difficultyZone: number,
    enemyX: number,
    enemyY: number,
    enemyId?: string
  ): void {
    // Find chunk from position
    const cx = Math.floor(enemyX / CHUNK_PX);
    const cy = Math.floor(enemyY / CHUNK_PX);
    if (
      cy < 0 ||
      cy >= CHUNK_COUNT ||
      cx < 0 ||
      cx >= CHUNK_COUNT ||
      !this.chunks[cy]
    )
      return;
    const chunk = this.chunks[cy][cx];
    if (!chunk) return;

    chunk.currentCount = Math.max(0, chunk.currentCount - 1);

    // Remove from tracking map
    if (enemyId) {
      this.enemyChunkMap.delete(enemyId);
    }

    // Queue respawn if below 60% density and not already queued
    if (chunk.currentCount < chunk.targetDensity * 0.6) {
      const key = `${cx},${cy}`;
      const alreadyQueued = this.respawnQueue.some(
        (e) => e.chunkX === cx && e.chunkY === cy
      );
      if (!alreadyQueued && this.activeChunks.has(key)) {
        const deficit = chunk.targetDensity - chunk.currentCount;
        const batch = Math.min(deficit, 2 + Math.floor(Math.random() * 3)); // 2-4
        this.respawnQueue.push({
          chunkX: cx,
          chunkY: cy,
          count: batch,
          timer: getRespawnDelay(chunk.zone),
        });
      }
    }
  }

  reset(): void {
    this.chunks = [];
    this.activeChunks.clear();
    this.respawnQueue = [];
    this.enemyChunkMap.clear();
    this.initialized = false;
  }

  // --- Chunk index building ---

  private buildChunkIndex(): void {
    const map = getRealmMap();
    if (!map) return;

    this.chunks = [];
    for (let cy = 0; cy < CHUNK_COUNT; cy++) {
      this.chunks[cy] = [];
      for (let cx = 0; cx < CHUNK_COUNT; cx++) {
        this.chunks[cy][cx] = this.buildSingleChunk(cx, cy, map);
      }
    }
  }

  private buildSingleChunk(
    cx: number,
    cy: number,
    map: RealmMapData
  ): ChunkData {
    const startTX = cx * CHUNK_SIZE;
    const startTY = cy * CHUNK_SIZE;
    const endTX = Math.min(startTX + CHUNK_SIZE, HOSTILE_TILES);
    const endTY = Math.min(startTY + CHUNK_SIZE, HOSTILE_TILES);

    // Count zones and biomes for dominant selection
    const zoneCounts = new Map<number, number>();
    const biomeCounts = new Map<number, number>();
    const positions: number[] = [];

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const idx = ty * map.width + tx;
        const biome = map.biomes[idx];
        // Skip water tiles
        if (biome === 0 || biome === 1 || biome === 15) continue;

        const dz = map.difficulty[idx];
        zoneCounts.set(dz, (zoneCounts.get(dz) ?? 0) + 1);
        biomeCounts.set(biome, (biomeCounts.get(biome) ?? 0) + 1);

        // Store pixel center of tile
        const px = tx * HOSTILE_TILE_SIZE + HOSTILE_TILE_SIZE / 2;
        const py = ty * HOSTILE_TILE_SIZE + HOSTILE_TILE_SIZE / 2;
        positions.push(px, py);
      }
    }

    // Dominant zone (most common)
    let dominantZone = -1;
    let maxZoneCount = 0;
    for (const [zone, count] of zoneCounts) {
      if (count > maxZoneCount) {
        maxZoneCount = count;
        dominantZone = zone;
      }
    }

    // Dominant biome
    let dominantBiome = 0;
    let maxBiomeCount = 0;
    for (const [biome, count] of biomeCounts) {
      if (count > maxBiomeCount) {
        maxBiomeCount = count;
        dominantBiome = biome;
      }
    }

    const isNearSetpiece = this.isChunkNearSetpiece(cx, cy, map);
    const targetDensity =
      dominantZone >= 0 ? getTargetDensity(dominantZone, isNearSetpiece) : 0;

    return {
      chunkX: cx,
      chunkY: cy,
      zone: dominantZone,
      biome: dominantBiome,
      targetDensity,
      currentCount: 0,
      isNearSetpiece,
      spawnPositions: new Float32Array(positions),
      spawnPositionCount: positions.length / 2,
    };
  }

  private isChunkNearSetpiece(
    cx: number,
    cy: number,
    map: RealmMapData
  ): boolean {
    const chunkMinTX = cx * CHUNK_SIZE;
    const chunkMaxTX = chunkMinTX + CHUNK_SIZE;
    const chunkMinTY = cy * CHUNK_SIZE;
    const chunkMaxTY = chunkMinTY + CHUNK_SIZE;

    for (const sp of map.setpieces) {
      const spMinTX = sp.tileX - sp.radius;
      const spMaxTX = sp.tileX + sp.radius;
      const spMinTY = sp.tileY - sp.radius;
      const spMaxTY = sp.tileY + sp.radius;

      if (
        spMaxTX >= chunkMinTX &&
        spMinTX <= chunkMaxTX &&
        spMaxTY >= chunkMinTY &&
        spMinTY <= chunkMaxTY
      ) {
        return true;
      }
    }
    return false;
  }

  // --- Lazy chunk activation ---

  private updateChunkActivation(state: GameState): void {
    const playerPositions: { x: number; y: number }[] = [];
    state.players.forEach((p) => {
      if (p.alive && p.zone === "hostile") {
        playerPositions.push({ x: p.x, y: p.y });
      }
    });

    if (playerPositions.length === 0) return;

    const map = getRealmMap();
    if (!map) return;

    // Determine which chunks should be active
    const shouldBeActive = new Set<string>();
    for (const pos of playerPositions) {
      const centerCX = Math.floor(pos.x / CHUNK_PX);
      const centerCY = Math.floor(pos.y / CHUNK_PX);
      // Check surrounding chunks within activation range
      const chunkRadius = Math.ceil(ACTIVATION_RANGE / CHUNK_PX) + 1;
      for (
        let dy = -chunkRadius;
        dy <= chunkRadius;
        dy++
      ) {
        for (
          let dx = -chunkRadius;
          dx <= chunkRadius;
          dx++
        ) {
          const cx = centerCX + dx;
          const cy = centerCY + dy;
          if (
            cx < 0 ||
            cx >= CHUNK_COUNT ||
            cy < 0 ||
            cy >= CHUNK_COUNT
          )
            continue;

          // Check actual distance from chunk center to nearest player
          const chunkCenterX = (cx + 0.5) * CHUNK_PX;
          const chunkCenterY = (cy + 0.5) * CHUNK_PX;
          let nearEnough = false;
          for (const p of playerPositions) {
            if (
              distanceBetween(chunkCenterX, chunkCenterY, p.x, p.y) <
              ACTIVATION_RANGE
            ) {
              nearEnough = true;
              break;
            }
          }
          if (nearEnough) {
            shouldBeActive.add(`${cx},${cy}`);
          }
        }
      }
    }

    // Activate new chunks
    for (const key of shouldBeActive) {
      if (!this.activeChunks.has(key)) {
        this.activateChunk(key, state, map);
      }
    }

    // Deactivate distant chunks
    for (const key of this.activeChunks) {
      const [cxs, cys] = key.split(",");
      const cx = parseInt(cxs);
      const cy = parseInt(cys);
      const chunkCenterX = (cx + 0.5) * CHUNK_PX;
      const chunkCenterY = (cy + 0.5) * CHUNK_PX;

      let anyNear = false;
      for (const p of playerPositions) {
        if (
          distanceBetween(chunkCenterX, chunkCenterY, p.x, p.y) <
          DEACTIVATION_RANGE
        ) {
          anyNear = true;
          break;
        }
      }

      if (!anyNear) {
        this.deactivateChunk(key, state);
      }
    }
  }

  private activateChunk(
    key: string,
    state: GameState,
    map: RealmMapData
  ): void {
    this.activeChunks.add(key);
    const [cxs, cys] = key.split(",");
    const cx = parseInt(cxs);
    const cy = parseInt(cys);
    const chunk = this.chunks[cy]?.[cx];
    if (!chunk || chunk.targetDensity === 0 || chunk.spawnPositionCount === 0)
      return;

    // Collect player positions to filter out on-screen spawns
    const playerPositions: { x: number; y: number }[] = [];
    state.players.forEach((p) => {
      if (p.alive && p.zone === "hostile") {
        playerPositions.push({ x: p.x, y: p.y });
      }
    });

    this.populateChunk(chunk, state, map, playerPositions);
  }

  private deactivateChunk(key: string, state: GameState): void {
    this.activeChunks.delete(key);

    // Remove respawn entries for this chunk
    const [cxs, cys] = key.split(",");
    const cx = parseInt(cxs);
    const cy = parseInt(cys);
    this.respawnQueue = this.respawnQueue.filter(
      (e) => e.chunkX !== cx || e.chunkY !== cy
    );

    // Despawn enemies in this chunk
    const toRemove: string[] = [];
    for (const [enemyId, chunkKey] of this.enemyChunkMap) {
      if (chunkKey === key) {
        toRemove.push(enemyId);
      }
    }
    for (const enemyId of toRemove) {
      state.enemies.delete(enemyId);
      this.enemyChunkMap.delete(enemyId);
    }

    // Reset chunk count
    const chunk = this.chunks[cy]?.[cx];
    if (chunk) chunk.currentCount = 0;
  }

  // --- Grid-jitter population ---

  private populateChunk(
    chunk: ChunkData,
    state: GameState,
    map: RealmMapData,
    playerPositions: { x: number; y: number }[]
  ): void {
    const density = chunk.targetDensity;
    if (density === 0 || chunk.spawnPositionCount === 0) return;

    // Grid-jitter: divide chunk into cells based on target density
    const cellsPerSide = Math.ceil(Math.sqrt(density));
    const cellSizeTiles = CHUNK_SIZE / cellsPerSide;

    const positions: { x: number; y: number }[] = [];

    for (let gy = 0; gy < cellsPerSide; gy++) {
      for (let gx = 0; gx < cellsPerSide; gx++) {
        // Center of cell in tile coords
        const baseTX =
          chunk.chunkX * CHUNK_SIZE +
          gx * cellSizeTiles +
          cellSizeTiles / 2;
        const baseTY =
          chunk.chunkY * CHUNK_SIZE +
          gy * cellSizeTiles +
          cellSizeTiles / 2;

        // Add jitter (+-40% of cell size)
        const jitterRange = cellSizeTiles * 0.4;
        const tx = baseTX + (Math.random() - 0.5) * 2 * jitterRange;
        const ty = baseTY + (Math.random() - 0.5) * 2 * jitterRange;

        // Clamp to map bounds
        if (tx < 0 || tx >= HOSTILE_TILES || ty < 0 || ty >= HOSTILE_TILES)
          continue;

        // Check tile is walkable (not water)
        const txi = Math.floor(tx);
        const tyi = Math.floor(ty);
        const biome = map.biomes[tyi * map.width + txi];
        if (biome === 0 || biome === 1 || biome === 15) continue;

        const px = tx * HOSTILE_TILE_SIZE + HOSTILE_TILE_SIZE / 2;
        const py = ty * HOSTILE_TILE_SIZE + HOSTILE_TILE_SIZE / 2;
        positions.push({ x: px, y: py });
      }
    }

    // Remove ~20% randomly to create natural gaps
    const removeCount = Math.floor(positions.length * 0.2);
    for (let i = 0; i < removeCount && positions.length > 1; i++) {
      const idx = Math.floor(Math.random() * positions.length);
      positions.splice(idx, 1);
    }

    // Cluster ~15%: shift toward a random neighbor
    const clusterCount = Math.floor(positions.length * 0.15);
    for (let i = 0; i < clusterCount && positions.length > 1; i++) {
      const idx = Math.floor(Math.random() * positions.length);
      const neighborIdx = Math.floor(Math.random() * positions.length);
      if (idx === neighborIdx) continue;
      const t = 0.3 + Math.random() * 0.3;
      positions[idx].x +=
        (positions[neighborIdx].x - positions[idx].x) * t;
      positions[idx].y +=
        (positions[neighborIdx].y - positions[idx].y) * t;
    }

    // Spawn enemies only at off-screen positions; defer the rest via respawn queue
    let deferred = 0;
    for (const pos of positions) {
      if (chunk.currentCount >= chunk.targetDensity) break;

      // Check if this position is too close to any player (on-screen)
      let tooClose = false;
      for (const p of playerPositions) {
        if (distanceBetween(pos.x, pos.y, p.x, p.y) < MIN_SPAWN_DISTANCE) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) {
        deferred++;
      } else {
        this.spawnEnemyAtPosition(pos.x, pos.y, chunk, state, map);
      }
    }

    // Queue deferred spawns to trickle in over time
    if (deferred > 0) {
      const batchSize = Math.min(deferred, 4);
      const batches = Math.ceil(deferred / batchSize);
      for (let i = 0; i < batches; i++) {
        const count = Math.min(batchSize, deferred - i * batchSize);
        this.respawnQueue.push({
          chunkX: chunk.chunkX,
          chunkY: chunk.chunkY,
          count,
          timer: 2000 + i * 3000, // stagger: 2s, 5s, 8s, ...
        });
      }
    }
  }

  // --- Enemy spawning ---

  private spawnEnemyAtPosition(
    x: number,
    y: number,
    chunk: ChunkData,
    state: GameState,
    map: RealmMapData
  ): void {
    // Look up actual biome at spawn position for biome-affinity selection
    const tx = Math.floor(x / HOSTILE_TILE_SIZE);
    const ty = Math.floor(y / HOSTILE_TILE_SIZE);
    if (tx < 0 || tx >= HOSTILE_TILES || ty < 0 || ty >= HOSTILE_TILES) return;
    const biome = map.biomes[ty * map.width + tx];
    const zone = map.difficulty[ty * map.width + tx];

    // Get candidates with biome transition blending
    const candidates = this.getBlendedCandidates(
      tx,
      ty,
      zone,
      biome,
      chunk,
      map
    );
    if (candidates.length === 0) return;

    const enemyType =
      candidates[Math.floor(Math.random() * candidates.length)];
    const def = ENEMY_DEFS[enemyType];
    if (!def) return;

    // Pack leader: spawn leader + minions as a cluster
    if (isPackLeader(enemyType)) {
      this.spawnPackAtPosition(x, y, enemyType, chunk, state);
      return;
    }

    const enemy = new Enemy();
    enemy.id = generateId("enemy");
    enemy.x = x;
    enemy.y = y;
    enemy.spawnX = x;
    enemy.spawnY = y;
    enemy.hp = def.hp;
    enemy.maxHp = def.hp;
    enemy.enemyType = def.type;
    enemy.aiState = EnemyAIState.Idle;
    enemy.idleTargetX = x + (Math.random() - 0.5) * 60;
    enemy.idleTargetY = y + (Math.random() - 0.5) * 60;

    state.enemies.set(enemy.id, enemy);
    chunk.currentCount++;
    this.enemyChunkMap.set(
      enemy.id,
      `${chunk.chunkX},${chunk.chunkY}`
    );
  }

  private spawnPackAtPosition(
    x: number,
    y: number,
    leaderType: number,
    chunk: ChunkData,
    state: GameState
  ): void {
    const packDef = getPackDef(leaderType);
    if (!packDef) return;
    const leaderDef = ENEMY_DEFS[leaderType];
    if (!leaderDef) return;

    // Spawn leader
    const leader = new Enemy();
    leader.id = generateId("enemy");
    leader.x = x;
    leader.y = y;
    leader.spawnX = x;
    leader.spawnY = y;
    leader.hp = leaderDef.hp;
    leader.maxHp = leaderDef.hp;
    leader.enemyType = leaderType;
    leader.aiState = EnemyAIState.Idle;
    leader.idleTargetX = x + (Math.random() - 0.5) * 60;
    leader.idleTargetY = y + (Math.random() - 0.5) * 60;
    leader.isPackLeader = true;

    state.enemies.set(leader.id, leader);
    chunk.currentCount++;
    this.enemyChunkMap.set(leader.id, `${chunk.chunkX},${chunk.chunkY}`);

    // Spawn minions clustered around leader
    const minionDef = ENEMY_DEFS[packDef.minionType];
    if (!minionDef) return;

    for (let i = 0; i < packDef.minionCount; i++) {
      if (chunk.currentCount >= chunk.targetDensity) break;
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40; // 40-80px from leader
      const mx = x + Math.cos(angle) * dist;
      const my = y + Math.sin(angle) * dist;

      const minion = new Enemy();
      minion.id = generateId("enemy");
      minion.x = mx;
      minion.y = my;
      minion.spawnX = mx;
      minion.spawnY = my;
      minion.hp = minionDef.hp;
      minion.maxHp = minionDef.hp;
      minion.enemyType = packDef.minionType;
      minion.aiState = EnemyAIState.Idle;
      minion.idleTargetX = mx + (Math.random() - 0.5) * 60;
      minion.idleTargetY = my + (Math.random() - 0.5) * 60;
      minion.packLeaderId = leader.id;

      state.enemies.set(minion.id, minion);
      chunk.currentCount++;
      this.enemyChunkMap.set(minion.id, `${chunk.chunkX},${chunk.chunkY}`);
    }
  }

  /** Spawn a single pack minion near its leader (called by GameRoom for respawns). */
  spawnPackMinion(
    leaderX: number,
    leaderY: number,
    leaderId: string,
    minionType: number,
    state: GameState
  ): void {
    const minionDef = ENEMY_DEFS[minionType];
    if (!minionDef) return;

    // Find chunk for leader position
    const cx = Math.floor(leaderX / CHUNK_PX);
    const cy = Math.floor(leaderY / CHUNK_PX);
    if (cy < 0 || cy >= CHUNK_COUNT || cx < 0 || cx >= CHUNK_COUNT) return;
    const chunk = this.chunks[cy]?.[cx];
    if (!chunk) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 40;
    const mx = leaderX + Math.cos(angle) * dist;
    const my = leaderY + Math.sin(angle) * dist;

    const minion = new Enemy();
    minion.id = generateId("enemy");
    minion.x = mx;
    minion.y = my;
    minion.spawnX = mx;
    minion.spawnY = my;
    minion.hp = minionDef.hp;
    minion.maxHp = minionDef.hp;
    minion.enemyType = minionType;
    minion.aiState = EnemyAIState.Idle;
    minion.idleTargetX = mx + (Math.random() - 0.5) * 60;
    minion.idleTargetY = my + (Math.random() - 0.5) * 60;
    minion.packLeaderId = leaderId;

    state.enemies.set(minion.id, minion);
    chunk.currentCount++;
    this.enemyChunkMap.set(minion.id, `${cx},${cy}`);
  }

  private getBlendedCandidates(
    tx: number,
    ty: number,
    zone: number,
    biome: number,
    chunk: ChunkData,
    map: RealmMapData
  ): number[] {
    let candidates = getEnemyTypesForBiomeAndZone(biome, zone);

    // Check nearby tiles for different zones (transition blending, 25-tile radius)
    const blendRadius = 25;
    const checkPoints: [number, number][] = [
      [tx - blendRadius, ty],
      [tx + blendRadius, ty],
      [tx, ty - blendRadius],
      [tx, ty + blendRadius],
    ];

    for (const [cx, cy] of checkPoints) {
      if (cx < 0 || cx >= HOSTILE_TILES || cy < 0 || cy >= HOSTILE_TILES)
        continue;
      const nearbyIdx = cy * map.width + cx;
      const nearbyZone = map.difficulty[nearbyIdx];
      if (nearbyZone !== zone) {
        const nearbyBiome = map.biomes[nearbyIdx];
        if (nearbyBiome === 0 || nearbyBiome === 1 || nearbyBiome === 15)
          continue;
        // 33% chance to blend in neighboring zone enemies
        if (Math.random() < 0.33) {
          const nearbyCandidates = getEnemyTypesForBiomeAndZone(
            nearbyBiome,
            nearbyZone
          );
          candidates = [...candidates, ...nearbyCandidates];
        }
        break;
      }
    }

    // Setpiece POI bias: double weight of enemies with interesting movement patterns
    if (chunk.isNearSetpiece) {
      const interesting = candidates.filter((c) => {
        const def = ENEMY_DEFS[c];
        return (
          def?.movementPattern !== undefined &&
          def.movementPattern !== MovementPatternType.WanderingSprayer
        );
      });
      if (interesting.length > 0) {
        candidates = [...candidates, ...interesting];
      }
    }

    return candidates;
  }

  // --- Batch respawn ---

  private batchRespawnInChunk(
    entry: ChunkRespawnEntry,
    state: GameState
  ): void {
    const chunk = this.chunks[entry.chunkY]?.[entry.chunkX];
    if (!chunk || chunk.spawnPositionCount === 0) return;

    const map = getRealmMap();
    if (!map) return;

    // Cap at 120% of target density
    const maxAllowed = Math.floor(chunk.targetDensity * 1.2);
    const toSpawn = Math.min(entry.count, maxAllowed - chunk.currentCount);
    if (toSpawn <= 0) return;

    // Collect player positions for off-screen check
    const playerPositions: { x: number; y: number }[] = [];
    state.players.forEach((p) => {
      if (p.alive && p.zone === "hostile") {
        playerPositions.push({ x: p.x, y: p.y });
      }
    });

    for (let i = 0; i < toSpawn; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const posIdx = Math.floor(
          Math.random() * chunk.spawnPositionCount
        );
        const px = chunk.spawnPositions[posIdx * 2];
        const py = chunk.spawnPositions[posIdx * 2 + 1];

        // Enforce off-screen spawning
        let tooClose = false;
        for (const p of playerPositions) {
          if (distanceBetween(px, py, p.x, p.y) < MIN_SPAWN_DISTANCE) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          this.spawnEnemyAtPosition(px, py, chunk, state, map);
          break;
        }
      }
    }
  }
}
