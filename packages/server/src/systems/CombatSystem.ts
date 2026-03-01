import { GameState } from "../schemas/GameState";
import { SpatialGrid } from "../utils/SpatialGrid";
import { Enemy } from "../schemas/Enemy";
import {
  EntityType,
  PLAYER_RADIUS,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  XP_SHARE_RADIUS,
  ENEMY_DEFS,
  getBiomeAtPosition,
  distanceBetween,
  circlesOverlap,
  getPlayerLevel,
  computePlayerStats,
} from "@rotmg-lite/shared";

export interface CombatEvent {
  type: "playerDied" | "enemyKilled";
  playerId?: string;
  biome?: number;
  enemyX?: number;
  enemyY?: number;
  enemyType?: number;
}

export class CombatSystem {
  private events: CombatEvent[] = [];
  private enemyGrid = new SpatialGrid<Enemy>(200);

  update(deltaTime: number, state: GameState): CombatEvent[] {
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

      // Check if out of bounds
      if (
        proj.x < 0 ||
        proj.x > ARENA_WIDTH ||
        proj.y < 0 ||
        proj.y > ARENA_HEIGHT
      ) {
        projectilesToRemove.push(id);
        return;
      }

      if (proj.ownerType === EntityType.Player) {
        // Player projectile → check enemy collisions using spatial grid
        const nearby = this.enemyGrid.query(proj.x, proj.y, 50);
        for (const enemy of nearby) {
          // Skip enemies already hit by this piercing projectile
          if (proj.piercing && proj.hitEnemies.has(enemy.id)) continue;

          const def = ENEMY_DEFS[enemy.enemyType];
          const enemyRadius = def ? def.radius : 14;
          if (circlesOverlap(proj.x, proj.y, proj.collisionRadius, enemy.x, enemy.y, enemyRadius)) {
            enemy.hp -= proj.damage;

            if (proj.piercing) {
              proj.hitEnemies.add(enemy.id);
            } else {
              projectilesToRemove.push(id);
            }

            if (enemy.hp <= 0) {
              // Award XP directly to all nearby alive players
              const xpValue = def ? def.xpValue : 10;
              const enemyX = enemy.x;
              const enemyY = enemy.y;

              state.players.forEach((player) => {
                if (!player.alive || player.zone !== "hostile") return;
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
                  // Heal the HP increase so leveling doesn't leave you at low %
                  player.hp = Math.min(player.hp + (stats.maxHp - oldMaxHp), player.maxHp);
                }
              });

              // Report enemy kill with biome for respawn and loot drop
              const biome = getBiomeAtPosition(enemy.spawnX, enemy.spawnY);
              this.events.push({
                type: "enemyKilled",
                biome,
                enemyX: enemy.x,
                enemyY: enemy.y,
                enemyType: enemy.enemyType,
              });

              state.enemies.delete(enemy.id);
            }

            if (!proj.piercing) break; // non-piercing projectile only hits one enemy
          }
        }
      } else {
        // Enemy projectile → check player collisions
        state.players.forEach((player) => {
          if (!player.alive) return;
          if (player.zone !== "hostile") return;
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
