import { GameState } from "../schemas/GameState";
import { SpatialGrid } from "../utils/SpatialGrid";
import { Enemy } from "../schemas/Enemy";
import { Player } from "../schemas/Player";
import {
  EntityType,
  PLAYER_RADIUS,
  XP_SHARE_RADIUS,
  HITBOX_PADDING,
  ENEMY_DEFS,
  TILE_SIZE,
  getDifficultyAt,
  isWaterTile,
  getRealmMap,
  distanceBetween,
  getPlayerLevel,
  computePlayerStats,
  getZoneDimensions,
  DungeonTile,
  EnemyAIState,
  isHostileZone,
  DamageType,
} from "@rotmg-lite/shared";
import type { DungeonMapData } from "@rotmg-lite/shared";
import { schemaToItemData } from "../schemas/ItemInstance";

export interface CombatEvent {
  type: "playerDied" | "enemyKilled" | "bossHit";
  playerId?: string;
  biome?: number;
  enemyX?: number;
  enemyY?: number;
  enemyType?: number;
  enemyZone?: string;
  isBoss?: boolean;
  enemyId?: string;
  damageMap?: Map<string, number>;
  enemyMaxHp?: number;
}

// Only insert enemies within this radius of a player into the spatial grid.
// Matches ENEMY_SYNC_RADIUS so every client-visible enemy is in the grid.
const COMBAT_GRID_RADIUS = 1600;
const COMBAT_GRID_RADIUS_SQ = COMBAT_GRID_RADIUS * COMBAT_GRID_RADIUS;

/**
 * Squared distance from point (px,py) to the closest point on the line
 * segment (x1,y1)→(x2,y2).  Used for swept (continuous) collision detection
 * so projectiles cannot tunnel through targets between ticks.
 */
function segmentPointDistSq(
  x1: number, y1: number, x2: number, y2: number,
  px: number, py: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

/** Does a circle swept along a segment overlap a stationary circle? */
function sweptCirclesOverlap(
  segX1: number, segY1: number, segX2: number, segY2: number, r1: number,
  px: number, py: number, r2: number
): boolean {
  const combined = r1 + r2;
  return segmentPointDistSq(segX1, segY1, segX2, segY2, px, py) < combined * combined;
}

export class CombatSystem {
  private events: CombatEvent[] = [];
  private enemyGrid = new SpatialGrid<Enemy>(200);
  private playerGrid = new SpatialGrid<Player>(200);

  update(deltaTime: number, state: GameState, dungeonMaps?: Map<string, DungeonMapData>): CombatEvent[] {
    this.events.length = 0;
    const dt = deltaTime / 1000;

    // Rebuild spatial grids — only insert enemies near any player
    // to avoid O(all enemies) insertion cost with persistent chunks.
    this.playerGrid.clear();
    const alivePlayers: Player[] = [];
    state.players.forEach((player) => {
      if (player.alive) {
        this.playerGrid.insert(player);
        alivePlayers.push(player);
      }
    });

    this.enemyGrid.clear();
    if (alivePlayers.length > 0) {
      state.enemies.forEach((enemy) => {
        for (const p of alivePlayers) {
          if (p.zone !== enemy.zone) continue;
          const dx = p.x - enemy.x;
          const dy = p.y - enemy.y;
          if (dx * dx + dy * dy <= COMBAT_GRID_RADIUS_SQ) {
            this.enemyGrid.insert(enemy);
            break;
          }
        }
      });
    }

    const projectilesToRemove: string[] = [];

    // Move projectiles and check collisions
    state.projectiles.forEach((proj, id) => {
      // Save pre-movement position for swept collision detection.
      // For AoE projectiles (stationary), prevX/Y equal current position so
      // the swept check degrades to a normal point check — no special case needed.
      const prevX = proj.x;
      const prevY = proj.y;

      if (proj.expandingAoe) {
        // Expanding AoE: grow collision radius instead of moving
        proj.collisionRadius += proj.speed * dt;
        if (proj.collisionRadius >= proj.maxRange) {
          projectilesToRemove.push(id);
          return;
        }
        // Skip bounds/wall/water checks — AoE stays at cast location
      } else {
        // Normal projectile movement
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
        if (isHostileZone(proj.zone) && getRealmMap() && isWaterTile(proj.x, proj.y)) {
          projectilesToRemove.push(id);
          return;
        }
      }

      if (proj.ownerType === EntityType.Player) {
        // Player projectile → check enemy collisions using spatial grid
        // Expand query radius by distance traveled this tick so enemies along
        // the full swept path are included in the candidate set.
        const travelDist = proj.expandingAoe ? 0 : proj.speed * dt;
        const queryRadius = proj.expandingAoe ? proj.collisionRadius + 50 : 50 + travelDist;
        const nearby = this.enemyGrid.query(proj.x, proj.y, queryRadius);
        for (const enemy of nearby) {
          // Only collide with enemies in the same zone
          if (enemy.zone !== proj.zone) continue;
          // Skip enemies already hit by this piercing projectile
          if (proj.piercing && proj.hitEnemies.has(enemy.id)) continue;

          const def = ENEMY_DEFS[enemy.enemyType];
          const enemyRadius = def ? def.radius : 14;
          const effectiveRadius = enemyRadius + HITBOX_PADDING;
          if (
            sweptCirclesOverlap(prevX, prevY, proj.x, proj.y, proj.collisionRadius, enemy.x, enemy.y, effectiveRadius) ||
            (enemy.posHistoryReady >= 1 && sweptCirclesOverlap(prevX, prevY, proj.x, proj.y, proj.collisionRadius, enemy.prevX1, enemy.prevY1, effectiveRadius)) ||
            (enemy.posHistoryReady >= 2 && sweptCirclesOverlap(prevX, prevY, proj.x, proj.y, proj.collisionRadius, enemy.prevX2, enemy.prevY2, effectiveRadius))
          ) {
            // Sleeping boss: trigger wake but take no damage
            if (enemy.isBoss && enemy.aiState === EnemyAIState.Sleeping) {
              this.events.push({
                type: "bossHit",
                enemyZone: enemy.zone,
                isBoss: true,
              });
              if (!proj.piercing) break;
              continue;
            }

            // Boss shield phase: immune to damage, still consume projectile
            if (enemy.bossShieldActive) {
              if (!proj.piercing) break;
              continue;
            }

            const effectiveDamage = enemy.damageResist > 0
              ? Math.round(proj.damage * (1 - enemy.damageResist / 100))
              : proj.damage;
            enemy.hp -= effectiveDamage;

            // Track damage per player for loot eligibility
            enemy.damageMap.set(proj.ownerId, (enemy.damageMap.get(proj.ownerId) || 0) + effectiveDamage);

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

              const xpPlayers = this.playerGrid.query(enemyX, enemyY, XP_SHARE_RADIUS);
              for (const player of xpPlayers) {
                if (player.zone !== enemy.zone) continue;
                if (distanceBetween(player.x, player.y, enemyX, enemyY) > XP_SHARE_RADIUS) continue;
                player.xp += xpValue;
                const newLevel = getPlayerLevel(player.xp);
                if (newLevel !== player.level) {
                  player.level = newLevel;
                  const eq = [
                    schemaToItemData(player.equipment[0]!),
                    schemaToItemData(player.equipment[1]!),
                    schemaToItemData(player.equipment[2]!),
                    schemaToItemData(player.equipment[3]!),
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
                  player.cachedPhysDmgReduce = stats.physDmgReduce;
                  player.cachedMagicDmgReduce = stats.magicDmgReduce;
                  player.cachedAbilityDamageBonus = stats.abilityDamageBonus;
                  player.cachedAbilityCooldownReduction = stats.abilityCooldownReduction;
                  player.cachedCritChance = stats.critChance;
                  player.cachedCritMult = stats.critMultiplier;
                  player.hp = Math.min(player.hp + (stats.maxHp - oldMaxHp), player.maxHp);
                }
              }

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
                enemyId: enemy.id,
                damageMap: new Map(enemy.damageMap),
                enemyMaxHp: enemy.maxHp,
              });

              state.enemies.delete(enemy.id);
            }

            if (!proj.piercing) break;
          }
        }
      } else {
        // Enemy projectile → check player collisions using spatial grid
        const enemyTravelDist = proj.speed * dt;
        const nearbyPlayers = this.playerGrid.query(proj.x, proj.y, 50 + enemyTravelDist);
        for (const player of nearbyPlayers) {
          if (player.invulnerable) continue;
          if (player.zone !== proj.zone) continue;
          if (proj.ownerId === player.id) continue;

          if (
            sweptCirclesOverlap(prevX, prevY, proj.x, proj.y, proj.collisionRadius, player.x, player.y, PLAYER_RADIUS)
          ) {
            const reduction = proj.damageType === DamageType.Magic
              ? player.cachedMagicDmgReduce
              : player.cachedPhysDmgReduce;
            const finalDamage = Math.round(proj.damage * (1 - reduction / 100));
            player.hp -= finalDamage;
            player.lastHitDamageType = proj.damageType;
            player.lastHitAmount = finalDamage;
            player.lastHitSeq = (player.lastHitSeq ?? 0) + 1;
            projectilesToRemove.push(id);

            if (player.hp <= 0) {
              player.alive = false;
              player.hp = 0;
              this.events.push({
                type: "playerDied",
                playerId: player.id,
              });
            }
            break;
          }
        }
      }
    });

    // Remove hit/expired projectiles (Map.delete on missing key is a no-op)
    for (const id of projectilesToRemove) {
      state.projectiles.delete(id);
    }

    return this.events;
  }
}
