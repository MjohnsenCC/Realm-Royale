import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { DungeonPortal } from "../schemas/DungeonPortal";
import { generateId } from "../utils/idGenerator";
import {
  DungeonType,
  EnemyType,
  EnemyAIState,
  PortalType,
  BiomeType,
  DUNGEON_LAYOUTS,
  DUNGEON_BOSS_TYPE,
  DUNGEON_TO_ZONE,
  DUNGEON_BOSS_X,
  DUNGEON_BOSS_Y,
  DUNGEON_PORTAL_LIFETIME,
  INFERNAL_PORTAL_CHANCE,
  VOID_PORTAL_CHANCE,
  ENEMY_DEFS,
} from "@rotmg-lite/shared";

export class DungeonSystem {
  /**
   * Called when an enemy is killed. Rolls for dungeon portal spawn.
   * Returns true if a portal was spawned.
   */
  trySpawnDungeonPortal(
    biome: number,
    x: number,
    y: number,
    state: GameState
  ): boolean {
    let chance = 0;
    let dungeonType = -1;

    if (biome === BiomeType.Hellscape) {
      chance = INFERNAL_PORTAL_CHANCE;
      dungeonType = DungeonType.InfernalPit;
    } else if (biome === BiomeType.Godlands) {
      chance = VOID_PORTAL_CHANCE;
      dungeonType = DungeonType.VoidSanctum;
    }

    if (dungeonType < 0 || Math.random() >= chance) return false;

    const portal = new DungeonPortal();
    portal.id = generateId("dportal");
    portal.x = x;
    portal.y = y;
    portal.portalType =
      dungeonType === DungeonType.InfernalPit
        ? PortalType.InfernalPitEntrance
        : PortalType.VoidSanctumEntrance;
    portal.zone = "hostile";
    portal.createdAt = Date.now();
    portal.dungeonType = dungeonType;

    state.dungeonPortals.set(portal.id, portal);
    return true;
  }

  /**
   * Create a dungeon instance: place enemies + boss in the dungeon zone.
   */
  createDungeonInstance(dungeonType: number, state: GameState): void {
    const zone = DUNGEON_TO_ZONE[dungeonType];
    if (!zone) return;

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

    // Place layout enemies
    const layout = DUNGEON_LAYOUTS[dungeonType];
    if (layout) {
      for (const placement of layout) {
        this.spawnDungeonEnemy(
          placement.enemyType,
          placement.x,
          placement.y,
          zone,
          state
        );
      }
    }

    // Place boss
    const bossType = DUNGEON_BOSS_TYPE[dungeonType];
    if (bossType !== undefined) {
      const boss = this.spawnDungeonEnemy(
        bossType,
        DUNGEON_BOSS_X,
        DUNGEON_BOSS_Y,
        zone,
        state
      );
      boss.isBoss = true;
      boss.bossPhase = 1;
    }
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
    enemy.hp = def ? def.hp : 100;
    enemy.maxHp = def ? def.hp : 100;
    enemy.enemyType = enemyType;
    enemy.aiState = EnemyAIState.Idle;
    enemy.idleTargetX = x + (Math.random() - 0.5) * 60;
    enemy.idleTargetY = y + (Math.random() - 0.5) * 60;
    enemy.zone = zone;

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
   * Spawn Void Minion add for The Architect boss.
   */
  spawnVoidMinion(
    bossX: number,
    bossY: number,
    zone: string,
    state: GameState
  ): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    const x = bossX + Math.cos(angle) * dist;
    const y = bossY + Math.sin(angle) * dist;
    this.spawnDungeonEnemy(EnemyType.VoidMinion, x, y, zone, state);
  }

  /**
   * Update: despawn expired entrance portals, cleanup empty dungeons.
   */
  update(_deltaTime: number, state: GameState): void {
    const now = Date.now();

    // Despawn expired entrance portals (exit portals and nexus test portals persist)
    const portalsToDespawn: string[] = [];
    state.dungeonPortals.forEach((portal, id) => {
      if (portal.portalType !== PortalType.DungeonExit && portal.zone !== "nexus") {
        if (now - portal.createdAt > DUNGEON_PORTAL_LIFETIME) {
          portalsToDespawn.push(id);
        }
      }
    });
    for (const id of portalsToDespawn) {
      state.dungeonPortals.delete(id);
    }

    // Cleanup empty dungeons (no players = remove enemies, projectiles, bags, portals)
    this.cleanupEmptyDungeons(state);
  }

  private cleanupEmptyDungeons(state: GameState): void {
    const occupiedZones = new Set<string>();
    state.players.forEach((player) => {
      if (player.alive) occupiedZones.add(player.zone);
    });

    const dungeonZones = ["dungeon_infernal", "dungeon_void"];
    for (const zone of dungeonZones) {
      if (occupiedZones.has(zone)) continue;

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
    }
  }
}
