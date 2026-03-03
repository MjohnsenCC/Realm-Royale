import { GameState } from "../schemas/GameState";
import { SpatialGrid } from "../utils/SpatialGrid";
import { Enemy } from "../schemas/Enemy";
import {
  EntityType,
  PLAYER_RADIUS,
  XP_SHARE_RADIUS,
  ENEMY_DEFS,
  TILE_SIZE,
  getDifficultyAt,
  isWaterTile,
  getRealmMap,
  distanceBetween,
  circlesOverlap,
  getPlayerLevel,
  computePlayerStats,
  getZoneDimensions,
  DungeonTile,
  EnemyAIState,
} from "@rotmg-lite/shared";
import type { DungeonMapData } from "@rotmg-lite/shared";

export interface CombatEvent {
  type: "playerDied" | "enemyKilled" | "bossHit";
  playerId?: string;
  biome?: number;
  enemyX?: number;
  enemyY?: number;
  enemyType?: number;
  enemyZone?: string;
  isBoss?: boolean;
}

export class CombatSystem {
  private events: CombatEvent[] = [];
  private enemyGrid = new SpatialGrid<Enemy>(200);

  update(deltaTime: number, state: GameState, dungeonMaps?: Map<string, DungeonMapData>): CombatEvent[] {
    this.events = [];
    const dt = deltaTime / 1000;

    // Rebuild spatial grid for enemies
    this.enemyGrid.clear();
    state.enemies.forEach((enemy) => {
      this.enemyGrid.insert(enemy);
    });

    const projectilesToRemove: string[] = [];

    // Move projectiles and check collisions
    state.projectiles.forEach((proj, id) => {
      // Move projectile
      proj.x += Math.cos(proj.angle) * proj.speed * dt;
      proj.y += Math.sin(proj.angle) * proj.speed * dt;

      // Check if exceeded max range
      const traveled = distanceBetween(proj.startX, proj.startY, proj.x, proj.y);
      if (traveled >= proj.maxRange) {
        projectilesToRemove.push(id);
        return;
      }

      // Check if out of bounds (zone-aware)
      const dims = getZoneDimensions(proj.zone);
      if (
        proj.x < 0 ||
        proj.x > dims.width ||
        proj.y < 0 ||
        proj.y > dims.height
      ) {
        projectilesToRemove.push(id);
        return;
      }

      // Check if projectile hit a wall tile in a dungeon
      const projMapData = dungeonMaps?.get(proj.zone);
      if (projMapData) {
        const tileX = Math.floor(proj.x / TILE_SIZE);
        const tileY = Math.floor(proj.y / TILE_SIZE);
        if (
          tileX >= 0 &&
          tileX < projMapData.width &&
          tileY >= 0 &&
          tileY < projMapData.height &&
          projMapData.tiles[tileY * projMapData.width + tileX] === DungeonTile.Wall
        ) {
          projectilesToRemove.push(id);
          return;
        }
      }

      // Check if projectile hit water in hostile zone
      if (proj.zone === "hostile" && getRealmMap() && isWaterTile(proj.x, proj.y)) {
        projectilesToRemove.push(id);
        return;
      }

      if (proj.ownerType === EntityType.Player) {
        // Player projectile → check enemy collisions using spatial grid
        const nearby = this.enemyGrid.query(proj.x, proj.y, 50);
        for (const enemy of nearby) {
          // Only collide with enemies in the same zone
          if (enemy.zone !== proj.zone) continue;
          // Skip enemies already hit by this piercing projectile
          if (proj.piercing && proj.hitEnemies.has(enemy.id)) continue;

          const def = ENEMY_DEFS[enemy.enemyType];
          const enemyRadius = def ? def.radius : 14;
          if (circlesOverlap(proj.x, proj.y, proj.collisionRadius, enemy.x, enemy.y, enemyRadius)) {
            const effectiveDamage = enemy.damageResist > 0
              ? Math.round(proj.damage * (1 - enemy.damageResist / 100))
              : proj.damage;
            enemy.hp -= effectiveDamage;

            // Wake sleeping boss on first hit
            if (enemy.isBoss && enemy.aiState === EnemyAIState.Sleeping) {
              this.events.push({
                type: "bossHit",
                enemyZone: enemy.zone,
                isBoss: true,
              });
            }

            if (proj.piercing) {
              proj.hitEnemies.add(enemy.id);
            } else {
              projectilesToRemove.push(id);
            }

            if (enemy.hp <= 0) {
              // Award XP directly to all nearby alive players in same zone
              const xpValue = def ? def.xpValue : 10;
              const enemyX = enemy.x;
              const enemyY = enemy.y;

              state.players.forEach((player) => {
                if (!player.alive || player.zone !== enemy.zone) return;
                if (distanceBetween(player.x, player.y, enemyX, enemyY) > XP_SHARE_RADIUS) return;
                player.xp += xpValue;
                const newLevel = getPlayerLevel(player.xp);
                if (newLevel !== player.level) {
                  player.level = newLevel;
                  const eq = [
                    player.equipment[0] ?? -1,
                    player.equipment[1] ?? -1,
                    player.equipment[2] ?? -1,
                    player.equipment[3] ?? -1,
                  ];
                  const stats = computePlayerStats(newLevel, eq);
                  const oldMaxHp = player.maxHp;
                  player.maxHp = stats.maxHp;
                  player.cachedDamage = stats.damage;
                  player.cachedShootCooldown = stats.shootCooldown;
                  player.cachedSpeed = stats.speed;
                  player.cachedHpRegen = stats.hpRegen;
                  player.maxMana = stats.maxMana;
                  player.cachedManaRegen = stats.manaRegen;
                  player.cachedWeaponRange = stats.weaponRange;
                  player.cachedWeaponProjSpeed = stats.weaponProjSpeed;
                  player.cachedWeaponProjSize = stats.weaponProjSize;
                  player.hp = Math.min(player.hp + (stats.maxHp - oldMaxHp), player.maxHp);
                }
              });

              // Report enemy kill with zone and boss info
              const biome = getDifficultyAt(enemy.spawnX, enemy.spawnY);
              this.events.push({
                type: "enemyKilled",
                biome,
                enemyX: enemy.x,
                enemyY: enemy.y,
                enemyType: enemy.enemyType,
                enemyZone: enemy.zone,
                isBoss: enemy.isBoss,
              });

              state.enemies.delete(enemy.id);
            }

            if (!proj.piercing) break;
          }
        }
      } else {
        // Enemy projectile → check player collisions in same zone
        state.players.forEach((player) => {
          if (!player.alive) return;
          if (player.invulnerable) return;
          if (player.zone !== proj.zone) return;
          if (proj.ownerId === player.id) return;

          if (
            circlesOverlap(proj.x, proj.y, proj.collisionRadius, player.x, player.y, PLAYER_RADIUS)
          ) {
            player.hp -= proj.damage;
            projectilesToRemove.push(id);

            if (player.hp <= 0) {
              player.alive = false;
              player.hp = 0;
              this.events.push({
                type: "playerDied",
                playerId: player.id,
              });
            }
          }
        });
      }
    });

    // Remove hit/expired projectiles
    const uniqueRemovals = [...new Set(projectilesToRemove)];
    for (const id of uniqueRemovals) {
      state.projectiles.delete(id);
    }

    return this.events;
  }
}
