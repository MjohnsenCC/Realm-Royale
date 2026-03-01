import { GameState, XpOrb } from "../schemas/GameState";
import { generateId } from "../utils/idGenerator";
import { SpatialGrid } from "../utils/SpatialGrid";
import { Enemy } from "../schemas/Enemy";
import {
  EntityType,
  PLAYER_RADIUS,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  XP_COLLECT_RADIUS,
  ENEMY_DEFS,
  getBiomeAtPosition,
  distanceBetween,
  circlesOverlap,
} from "@rotmg-lite/shared";

export interface CombatEvent {
  type: "playerDied" | "enemyKilled";
  playerId?: string;
  biome?: number;
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
          const def = ENEMY_DEFS[enemy.enemyType];
          const enemyRadius = def ? def.radius : 14;
          if (circlesOverlap(proj.x, proj.y, 5, enemy.x, enemy.y, enemyRadius)) {
            enemy.hp -= proj.damage;
            projectilesToRemove.push(id);

            if (enemy.hp <= 0) {
              // Spawn XP orb at enemy position
              const xpValue = def ? def.xpValue : 10;
              const orb = new XpOrb();
              orb.id = generateId("xp");
              orb.x = enemy.x;
              orb.y = enemy.y;
              orb.value = xpValue;
              state.xpOrbs.set(orb.id, orb);

              // Report enemy kill with biome for respawn
              const biome = getBiomeAtPosition(enemy.spawnX, enemy.spawnY);
              this.events.push({
                type: "enemyKilled",
                biome,
              });

              state.enemies.delete(enemy.id);
            }
            break; // projectile only hits one enemy
          }
        }
      } else {
        // Enemy projectile → check player collisions
        state.players.forEach((player) => {
          if (!player.alive) return;
          if (player.zone !== "hostile") return;
          if (proj.ownerId === player.id) return;

          if (
            circlesOverlap(proj.x, proj.y, 5, player.x, player.y, PLAYER_RADIUS)
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

    // XP orb collection
    const orbsToRemove: string[] = [];
    state.xpOrbs.forEach((orb, orbId) => {
      state.players.forEach((player) => {
        if (!player.alive) return;
        if (player.zone !== "hostile") return;
        if (
          distanceBetween(orb.x, orb.y, player.x, player.y) < XP_COLLECT_RADIUS
        ) {
          player.xp += orb.value;
          orbsToRemove.push(orbId);
        }
      });
    });

    const uniqueOrbRemovals = [...new Set(orbsToRemove)];
    for (const id of uniqueOrbRemovals) {
      state.xpOrbs.delete(id);
    }

    return this.events;
  }
}
