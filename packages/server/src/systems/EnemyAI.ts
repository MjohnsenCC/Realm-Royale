import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { Player } from "../schemas/Player";
import { ShootingPatternSystem } from "./ShootingPatternSystem";
import {
  EnemyAIState,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  ENEMY_DEFS,
  distanceBetween,
  angleBetween,
  clamp,
} from "@rotmg-lite/shared";
import type { EnemyDefinition } from "@rotmg-lite/shared";

const AI_UPDATE_RANGE = 1500; // Only update enemies within this range of a player

export class EnemyAI {
  update(
    deltaTime: number,
    state: GameState,
    shootingSystem: ShootingPatternSystem
  ): void {
    const dt = deltaTime / 1000;

    state.enemies.forEach((enemy) => {
      // Performance: skip AI for enemies far from all players
      if (!this.isNearAnyPlayer(enemy, state, AI_UPDATE_RANGE)) return;

      const def = ENEMY_DEFS[enemy.enemyType];
      if (!def) return;

      switch (enemy.aiState) {
        case EnemyAIState.Idle:
          this.updateIdle(enemy, def, dt, state);
          break;
        case EnemyAIState.Aggro:
          this.updateAggro(enemy, def, dt, deltaTime, state, shootingSystem);
          break;
        case EnemyAIState.Returning:
          this.updateReturning(enemy, def, dt, state);
          break;
      }
    });
  }

  private updateIdle(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    state: GameState
  ): void {
    // Check for aggro
    const target = this.findPlayerInRange(enemy, def.aggroRange, state);
    if (target) {
      enemy.aiState = EnemyAIState.Aggro;
      enemy.targetPlayerId = target.id;
      return;
    }

    // Idle patrol: pause or wander
    if (enemy.idlePauseTimer > 0) {
      enemy.idlePauseTimer -= dt * 1000;
      return;
    }

    const distToIdleTarget = distanceBetween(
      enemy.x,
      enemy.y,
      enemy.idleTargetX,
      enemy.idleTargetY
    );

    if (distToIdleTarget < 10) {
      // Reached idle target — pause and pick new one
      enemy.idlePauseTimer = 1000 + Math.random() * 2000;
      this.pickNewIdleTarget(enemy);
      return;
    }

    // Move toward idle target at 30% speed
    const angle = angleBetween(
      enemy.x,
      enemy.y,
      enemy.idleTargetX,
      enemy.idleTargetY
    );
    enemy.x += Math.cos(angle) * def.speed * 0.3 * dt;
    enemy.y += Math.sin(angle) * def.speed * 0.3 * dt;
    this.clampToArena(enemy, def);
  }

  private updateAggro(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    deltaTimeMs: number,
    state: GameState,
    shootingSystem: ShootingPatternSystem
  ): void {
    const target = state.players.get(enemy.targetPlayerId);

    // Validate target
    if (!target || !target.alive || target.zone !== "hostile") {
      enemy.aiState = EnemyAIState.Returning;
      enemy.targetPlayerId = "";
      return;
    }

    // Check leash range (distance from spawn)
    const distFromSpawn = distanceBetween(
      enemy.x,
      enemy.y,
      enemy.spawnX,
      enemy.spawnY
    );
    if (distFromSpawn > def.leashRange) {
      enemy.aiState = EnemyAIState.Returning;
      enemy.targetPlayerId = "";
      return;
    }

    // Move toward target — maintain some distance for shooting
    const distToTarget = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    if (distToTarget > def.aggroRange * 0.5) {
      const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
      enemy.x += Math.cos(angle) * def.speed * dt;
      enemy.y += Math.sin(angle) * def.speed * dt;
      this.clampToArena(enemy, def);
    }

    // Shoot
    const now = Date.now();
    if (now - enemy.lastShootTime >= def.shootCooldown) {
      enemy.lastShootTime = now;
      shootingSystem.executePattern(enemy, target, def, state);
    }
  }

  private updateReturning(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    state: GameState
  ): void {
    const distToSpawn = distanceBetween(
      enemy.x,
      enemy.y,
      enemy.spawnX,
      enemy.spawnY
    );

    if (distToSpawn < 20) {
      enemy.aiState = EnemyAIState.Idle;
      enemy.x = enemy.spawnX;
      enemy.y = enemy.spawnY;
      this.pickNewIdleTarget(enemy);
      return;
    }

    // Check for re-aggro while returning
    const target = this.findPlayerInRange(enemy, def.aggroRange * 0.7, state);
    if (target) {
      enemy.aiState = EnemyAIState.Aggro;
      enemy.targetPlayerId = target.id;
      return;
    }

    // Move toward spawn at full speed
    const angle = angleBetween(enemy.x, enemy.y, enemy.spawnX, enemy.spawnY);
    enemy.x += Math.cos(angle) * def.speed * dt;
    enemy.y += Math.sin(angle) * def.speed * dt;
    this.clampToArena(enemy, def);
  }

  private findPlayerInRange(
    enemy: Enemy,
    range: number,
    state: GameState
  ): Player | null {
    let nearest: Player | null = null;
    let nearestDist = Infinity;

    state.players.forEach((player) => {
      if (!player.alive || player.zone !== "hostile") return;
      const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
      if (dist < range && dist < nearestDist) {
        nearestDist = dist;
        nearest = player;
      }
    });

    return nearest;
  }

  private pickNewIdleTarget(enemy: Enemy): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 50;
    enemy.idleTargetX = enemy.spawnX + Math.cos(angle) * dist;
    enemy.idleTargetY = enemy.spawnY + Math.sin(angle) * dist;
  }

  private clampToArena(enemy: Enemy, def: EnemyDefinition): void {
    enemy.x = clamp(enemy.x, def.radius, ARENA_WIDTH - def.radius);
    enemy.y = clamp(enemy.y, def.radius, ARENA_HEIGHT - def.radius);
  }

  private isNearAnyPlayer(
    enemy: Enemy,
    state: GameState,
    range: number
  ): boolean {
    let near = false;
    state.players.forEach((player) => {
      if (near) return;
      if (!player.alive || player.zone !== "hostile") return;
      if (distanceBetween(enemy.x, enemy.y, player.x, player.y) < range) {
        near = true;
      }
    });
    return near;
  }
}
