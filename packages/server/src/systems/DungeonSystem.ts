import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { DungeonPortal } from "../schemas/DungeonPortal";
import { generateId } from "../utils/idGenerator";
import { ArraySchema } from "@colyseus/schema";
import {
  DungeonType,
  EnemyAIState,
  PortalType,
  DUNGEON_BOSS_TYPE,
  DUNGEON_PORTAL_LIFETIME,
  ENEMY_DEFS,
  DUNGEON_NORMAL_ROOM_VARIANTS,
  TILE_SIZE,
  generateDungeonMap,
  isTileWalkable,
  generateDungeonStats,
  DungeonModifierId,
  getModifierTierValue,
  getDungeonTypeFromZone,
} from "@rotmg-lite/shared";
import type {
  DungeonMapData,
  DungeonRoom,
  DungeonStats,
  EnemyDefinition,
} from "@rotmg-lite/shared";

/** Maps DungeonType → PortalType for entrance portals. */
const DUNGEON_PORTAL_TYPES: Record<number, number> = {
  [DungeonType.InfernalPit]: PortalType.InfernalPitEntrance,
  [DungeonType.VoidSanctum]: PortalType.VoidSanctumEntrance,
  [DungeonType.DeepJungle]: PortalType.DeepJungleEntrance,
};

export class DungeonSystem {
  // Active dungeon seeds and cached maps per zone
  private activeDungeonSeeds = new Map<string, number>();
  private activeDungeonMaps = new Map<string, DungeonMapData>();
  private activeDungeonStats = new Map<string, DungeonStats>();

  private bossWakeTimers = new Map<string, number>(); // zone -> wake timestamp

  /**
   * Get the dungeon map for an active dungeon zone.
   */
  getDungeonMap(zone: string): DungeonMapData | undefined {
    return this.activeDungeonMaps.get(zone);
  }

  /**
   * Get the seed for an active dungeon zone (for sending to clients).
   */
  getDungeonSeed(zone: string): number | undefined {
    return this.activeDungeonSeeds.get(zone);
  }

  /**
   * Get the active dungeon stats for a zone.
   */
  getDungeonStats(zone: string): DungeonStats | undefined {
    return this.activeDungeonStats.get(zone);
  }

  /**
   * Called when an enemy is killed. Rolls for dungeon portal spawn.
   * Returns true if a portal was spawned.
   */
  trySpawnDungeonPortal(
    _biome: number,
    x: number,
    y: number,
    state: GameState,
    enemyType?: number,
    sourceZone?: string
  ): boolean {
    // Only specific enemies with a dungeonDrop property can spawn portals
    if (enemyType === undefined) return false;
    const def = ENEMY_DEFS[enemyType];
    if (!def || def.dungeonDrop === undefined) return false;

    const dropChance = def.dungeonDropChance ?? 0;
    if (Math.random() >= dropChance) return false;

    const dungeonType = def.dungeonDrop;

    const portal = new DungeonPortal();
    portal.id = generateId("dportal");
    portal.x = x;
    portal.y = y;
    portal.portalType = DUNGEON_PORTAL_TYPES[dungeonType] ?? PortalType.InfernalPitEntrance;
    portal.zone = sourceZone ?? "hostile:1";
    portal.createdAt = Date.now();
    portal.dungeonType = dungeonType;

    // Generate random dungeon modifiers
    const stats = generateDungeonStats();
    portal.modifierIds = new ArraySchema<number>(...stats.modifierIds);
    portal.lootRarityBoost = stats.lootRarityBoost;
    portal.lootQuantityBoost = stats.lootQuantityBoost;
    portal.modifierTiers = new ArraySchema<number>(...stats.modifierTiers);

    state.dungeonPortals.set(portal.id, portal);
    return true;
  }

  /**
   * Create a dungeon instance: generate map, place enemies in rooms, place boss.
   * All dungeon types use unified variant-cycling for enemy spawning.
   */
  createDungeonInstance(
    dungeonType: number,
    zone: string,
    state: GameState,
    stats?: DungeonStats
  ): void {

    // Store dungeon stats for this zone
    if (stats) {
      this.activeDungeonStats.set(zone, stats);
    }

    // Clear any existing enemies in this dungeon zone
    const toRemove: string[] = [];
    state.enemies.forEach((enemy, id) => {
      if (enemy.zone === zone) toRemove.push(id);
    });
    for (const id of toRemove) state.enemies.delete(id);

    // Also clear existing projectiles in this zone
    const projToRemove: string[] = [];
    state.projectiles.forEach((proj, id) => {
      if (proj.zone === zone) projToRemove.push(id);
    });
    for (const id of projToRemove) state.projectiles.delete(id);

    // Also clear existing bags in this zone
    const bagsToRemove: string[] = [];
    state.lootBags.forEach((bag, id) => {
      if (bag.zone === zone) bagsToRemove.push(id);
    });
    for (const id of bagsToRemove) state.lootBags.delete(id);

    // Generate random seed and map
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const mapData = generateDungeonMap(seed, dungeonType);
    this.activeDungeonSeeds.set(zone, seed);
    this.activeDungeonMaps.set(zone, mapData);

    // Determine extra enemy count from EnemyCountUp modifier
    let extraEnemiesPerRoom = 0;
    if (stats) {
      for (let i = 0; i < stats.modifierIds.length; i++) {
        if (stats.modifierIds[i] === DungeonModifierId.EnemyCountUp) {
          extraEnemiesPerRoom = getModifierTierValue(
            DungeonModifierId.EnemyCountUp,
            stats.modifierTiers[i]
          );
        }
      }
    }

    // Unified variant-cycling enemy spawning for all dungeon types
    const variants = DUNGEON_NORMAL_ROOM_VARIANTS[dungeonType];
    if (variants) {
      let normalRoomIdx = 0;
      for (const room of mapData.rooms) {
        if (room.type === "spawn" || room.type === "boss") continue;

        const enemies = variants[normalRoomIdx % variants.length];
        normalRoomIdx++;

        for (const eType of enemies) {
          const pos = this.randomPositionInRoom(room, mapData);
          this.spawnDungeonEnemy(eType, pos.x, pos.y, zone, state);
        }

        // Spawn extra enemies from Swarming modifier
        if (extraEnemiesPerRoom > 0 && enemies.length > 0) {
          for (let e = 0; e < extraEnemiesPerRoom; e++) {
            const randomType = enemies[Math.floor(Math.random() * enemies.length)];
            const pos = this.randomPositionInRoom(room, mapData);
            this.spawnDungeonEnemy(randomType, pos.x, pos.y, zone, state);
          }
        }
      }
    }

    // Place boss in boss room (sleeping, wakes on hit)
    const bossType = DUNGEON_BOSS_TYPE[dungeonType];
    if (bossType !== undefined) {
      const boss = this.spawnDungeonEnemy(
        bossType,
        mapData.bossRoom.centerX,
        mapData.bossRoom.centerY,
        zone,
        state
      );
      boss.isBoss = true;
      boss.bossPhase = 0;
      boss.aiState = EnemyAIState.Sleeping;
      boss.bossAbilityCooldownTimer = 0;
      boss.bossAbilityActiveTimer = 0;
      boss.bossPatrolTimer = 3000;
      boss.bossTeleportTimer = 4000;
      boss.bossChargeTimer = 2000;
    }
  }

  /**
   * Get spawn position for a dungeon zone (center of spawn room).
   */
  getSpawnPosition(zone: string): { x: number; y: number } | undefined {
    const mapData = this.activeDungeonMaps.get(zone);
    if (!mapData) return undefined;
    return { x: mapData.spawnRoom.centerX, y: mapData.spawnRoom.centerY };
  }

  /**
   * Get effective enemy def with dungeon modifier buffs applied.
   * Used by EnemyAI at runtime for speed/damage/fire rate/aggro/proj speed.
   */
  getModifiedEnemyDef(
    baseDef: EnemyDefinition,
    zone: string
  ): EnemyDefinition {
    const stats = this.activeDungeonStats.get(zone);
    if (!stats) return baseDef;

    let speed = baseDef.speed;
    let shootCooldown = baseDef.shootCooldown;
    let projectileDamage = baseDef.projectileDamage;
    let projectileSpeed = baseDef.projectileSpeed;
    let aggroRange = baseDef.aggroRange;
    let projectileCollisionRadius = baseDef.projectileCollisionRadius;

    for (let i = 0; i < stats.modifierIds.length; i++) {
      const modId = stats.modifierIds[i];
      const tier = stats.modifierTiers[i];
      const value = getModifierTierValue(modId, tier);

      switch (modId) {
        case DungeonModifierId.EnemyDamageUp:
          projectileDamage = Math.round(
            projectileDamage * (1 + value / 100)
          );
          break;
        case DungeonModifierId.EnemySpeedUp:
          speed = Math.round(speed * (1 + value / 100));
          break;
        case DungeonModifierId.EnemyFireRateUp:
          shootCooldown = Math.max(
            100,
            Math.round(shootCooldown * (1 - value / 100))
          );
          break;
        case DungeonModifierId.EnemyAggroUp:
          aggroRange = Math.round(aggroRange * (1 + value / 100));
          break;
        case DungeonModifierId.EnemyProjSpeedUp:
          projectileSpeed = Math.round(
            projectileSpeed * (1 + value / 100)
          );
          break;
        case DungeonModifierId.EnemyProjSizeUp:
          projectileCollisionRadius = Math.round(
            5 * (1 + value / 100)
          );
          break;
      }
    }

    return {
      ...baseDef,
      speed,
      shootCooldown,
      projectileDamage,
      projectileSpeed,
      aggroRange,
      projectileCollisionRadius,
    };
  }

  private randomPositionInRoom(
    room: DungeonRoom,
    mapData: DungeonMapData
  ): { x: number; y: number } {
    // Try random positions within the room, with margin from walls
    for (let attempt = 0; attempt < 20; attempt++) {
      const margin = TILE_SIZE * 0.5;
      const x =
        (room.x + 1) * TILE_SIZE +
        margin +
        Math.random() * ((room.w - 2) * TILE_SIZE - margin * 2);
      const y =
        (room.y + 1) * TILE_SIZE +
        margin +
        Math.random() * ((room.h - 2) * TILE_SIZE - margin * 2);

      if (isTileWalkable(x, y, mapData)) {
        return { x, y };
      }
    }
    // Fallback: room center
    return { x: room.centerX, y: room.centerY };
  }

  private spawnDungeonEnemy(
    enemyType: number,
    x: number,
    y: number,
    zone: string,
    state: GameState
  ): Enemy {
    const def = ENEMY_DEFS[enemyType];
    const enemy = new Enemy();
    enemy.id = generateId("denemy");
    enemy.x = x;
    enemy.y = y;
    enemy.spawnX = x;
    enemy.spawnY = y;
    enemy.enemyType = enemyType;
    enemy.aiState = EnemyAIState.Idle;
    enemy.idleTargetX = x + (Math.random() - 0.5) * 60;
    enemy.idleTargetY = y + (Math.random() - 0.5) * 60;
    enemy.zone = zone;

    // Base HP from definition
    let hp = def ? def.hp : 100;

    // Apply spawn-time modifiers
    const stats = this.activeDungeonStats.get(zone);
    if (stats) {
      for (let i = 0; i < stats.modifierIds.length; i++) {
        const modId = stats.modifierIds[i];
        const value = getModifierTierValue(modId, stats.modifierTiers[i]);

        switch (modId) {
          case DungeonModifierId.EnemyHpUp:
            hp = Math.round(hp * (1 + value / 100));
            break;
          case DungeonModifierId.EnemyDamageResist:
            enemy.damageResist = value;
            break;
          case DungeonModifierId.EnemyRegenUp:
            enemy.hpRegenRate = value;
            break;
        }
      }
    }

    enemy.hp = hp;
    enemy.maxHp = hp;

    state.enemies.set(enemy.id, enemy);
    return enemy;
  }

  /**
   * Spawn exit portal at the boss death position.
   */
  spawnExitPortal(
    x: number,
    y: number,
    zone: string,
    returnX: number,
    returnY: number,
    returnZone: string,
    state: GameState
  ): void {
    const portal = new DungeonPortal();
    portal.id = generateId("exitportal");
    portal.x = x;
    portal.y = y;
    portal.portalType = PortalType.DungeonExit;
    portal.zone = zone;
    portal.createdAt = Date.now();
    portal.exitReturnX = returnX;
    portal.exitReturnY = returnY;
    portal.exitReturnZone = returnZone;

    state.dungeonPortals.set(portal.id, portal);
  }

  /**
   * Called when a sleeping boss takes its first hit. Starts 2-second wake timer.
   */
  onBossHit(zone: string): void {
    if (this.bossWakeTimers.has(zone)) return;
    this.bossWakeTimers.set(zone, Date.now() + 2000);
  }

  /**
   * Update: despawn expired entrance portals, cleanup empty dungeons, boss wake timer.
   * Returns zones where a boss just awakened (for client notifications).
   */
  update(_deltaTime: number, state: GameState): string[] {
    const bossAwokeZones: string[] = [];
    const now = Date.now();

    // Despawn expired entrance portals (exit portals and nexus test portals persist)
    const portalsToDespawn: string[] = [];
    state.dungeonPortals.forEach((portal, id) => {
      if (
        portal.portalType !== PortalType.DungeonExit &&
        portal.zone !== "nexus"
      ) {
        if (now - portal.createdAt > DUNGEON_PORTAL_LIFETIME) {
          portalsToDespawn.push(id);
        }
      }
    });
    for (const id of portalsToDespawn) {
      state.dungeonPortals.delete(id);
    }

    // Boss wake timer (all dungeon types — all bosses wake on hit)
    for (const [zone] of this.activeDungeonMaps) {
      // Check if there's a sleeping boss in this zone
      let hasSleepingBoss = false;
      state.enemies.forEach((enemy) => {
        if (enemy.zone === zone && enemy.isBoss && enemy.aiState === EnemyAIState.Sleeping) {
          hasSleepingBoss = true;
        }
      });
      if (!hasSleepingBoss) continue;

      const wakeTime = this.bossWakeTimers.get(zone);
      if (wakeTime !== undefined && now >= wakeTime) {
        // Wake the boss
        state.enemies.forEach((enemy) => {
          if (enemy.zone === zone && enemy.isBoss && enemy.aiState === EnemyAIState.Sleeping) {
            enemy.aiState = EnemyAIState.Idle;
            enemy.bossPhase = 1;
          }
        });
        this.bossWakeTimers.delete(zone);
        bossAwokeZones.push(zone);
      }
    }

    // Boss minion spawning (from SummonAdds ability)
    state.enemies.forEach((enemy) => {
      if (!enemy.isBoss) return;
      const pending = (enemy as any)._pendingMinionSpawn as { type: number; count: number } | undefined;
      if (!pending) return;
      delete (enemy as any)._pendingMinionSpawn;

      const mapData = this.activeDungeonMaps.get(enemy.zone);
      for (let i = 0; i < pending.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 60;
        let mx = enemy.x + Math.cos(angle) * dist;
        let my = enemy.y + Math.sin(angle) * dist;
        if (mapData && !isTileWalkable(mx, my, mapData)) {
          mx = enemy.x;
          my = enemy.y;
        }
        const minion = this.spawnDungeonEnemy(pending.type, mx, my, enemy.zone, state);
        minion.packLeaderId = enemy.id;
      }
    });

    // Boss area denial projectile spawning
    state.enemies.forEach((enemy) => {
      if (!enemy.isBoss) return;
      const areaDef = (enemy as any)._pendingAreaDenial as EnemyDefinition | undefined;
      if (!areaDef) return;
      delete (enemy as any)._pendingAreaDenial;
      // Area denial is handled by ShootingPatternSystem via the normal update
      // Store the override so next shot uses it
      (enemy as any)._areaDenialDef = areaDef;
    });

    // Cleanup empty dungeons (no players = remove enemies, projectiles, bags, portals)
    this.cleanupEmptyDungeons(state);

    return bossAwokeZones;
  }

  /**
   * Get all currently active dungeon zone strings.
   */
  getActiveDungeonZones(): string[] {
    return Array.from(this.activeDungeonMaps.keys());
  }

  private cleanupEmptyDungeons(state: GameState): void {
    const occupiedZones = new Set<string>();
    state.players.forEach((player) => {
      if (player.alive) occupiedZones.add(player.zone);
      // Keep dungeon alive if player is temporarily in vault via portal gem
      if (player.portalGemPortalActive && player.portalGemReturnZone) {
        occupiedZones.add(player.portalGemReturnZone);
      }
    });

    for (const zone of this.activeDungeonMaps.keys()) {
      if (occupiedZones.has(zone)) continue;

      // Clear seed, cached map, stats for this zone
      this.activeDungeonSeeds.delete(zone);
      this.activeDungeonMaps.delete(zone);
      this.activeDungeonStats.delete(zone);
      this.bossWakeTimers.delete(zone);

      const enemiesToRemove: string[] = [];
      state.enemies.forEach((enemy, id) => {
        if (enemy.zone === zone) enemiesToRemove.push(id);
      });
      for (const id of enemiesToRemove) state.enemies.delete(id);

      const projToRemove: string[] = [];
      state.projectiles.forEach((proj, id) => {
        if (proj.zone === zone) projToRemove.push(id);
      });
      for (const id of projToRemove) state.projectiles.delete(id);

      const bagsToRemove: string[] = [];
      state.lootBags.forEach((bag, id) => {
        if (bag.zone === zone) bagsToRemove.push(id);
      });
      for (const id of bagsToRemove) state.lootBags.delete(id);

      const portalsToRemove: string[] = [];
      state.dungeonPortals.forEach((portal, id) => {
        if (portal.zone === zone) portalsToRemove.push(id);
      });
      for (const id of portalsToRemove) state.dungeonPortals.delete(id);

      const gravesToRemove: string[] = [];
      state.gravestones.forEach((grave, id) => {
        if (grave.zone === zone) gravesToRemove.push(id);
      });
      for (const id of gravesToRemove) state.gravestones.delete(id);
    }
  }
}
