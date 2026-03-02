import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { Player } from "../schemas/Player";
import { ShootingPatternSystem } from "./ShootingPatternSystem";
import {
  EnemyType,
  EnemyAIState,
  ShootingPatternType,
  ENEMY_DEFS,
  distanceBetween,
  angleBetween,
  clamp,
  getZoneDimensions,
  resolveWallCollision,
  isTileWalkable,
  hasLineOfSight,
  isDungeonZone,
} from "@rotmg-lite/shared";
import type { EnemyDefinition, DungeonMapData } from "@rotmg-lite/shared";

const AI_UPDATE_RANGE = 1500; // Only update enemies within this range of a player

export class EnemyAI {
  update(
    deltaTime: number,
    state: GameState,
    shootingSystem: ShootingPatternSystem,
    dungeonMaps?: Map<string, DungeonMapData>,
    getModifiedDef?: (baseDef: EnemyDefinition, zone: string) => EnemyDefinition
  ): void {
    const dt = deltaTime / 1000;

    state.enemies.forEach((enemy) => {
      // Switches are stationary, no AI
      if (enemy.isSwitch) return;

      // Performance: skip AI for enemies far from all players
      if (!this.isNearAnyPlayer(enemy, state, AI_UPDATE_RANGE)) return;

      let def = ENEMY_DEFS[enemy.enemyType];
      if (!def) return;

      // Apply dungeon modifier overrides to enemy definition
      if (getModifiedDef && isDungeonZone(enemy.zone)) {
        def = getModifiedDef(def, enemy.zone);
      }

      const mapData = dungeonMaps?.get(enemy.zone);

      // Boss phase transitions for The Architect (3 phases)
      if (enemy.isBoss && enemy.enemyType === EnemyType.TheArchitect && enemy.bossPhase >= 1) {
        const hpRatio = enemy.hp / enemy.maxHp;
        if (hpRatio <= 0.33 && enemy.bossPhase < 3) {
          enemy.bossPhase = 3;
        } else if (hpRatio <= 0.66 && enemy.bossPhase < 2) {
          enemy.bossPhase = 2;
        }
      }

      // Boss phase transitions for Molten Wyrm (2 phases, unchanged)
      if (enemy.isBoss && enemy.enemyType === EnemyType.MoltenWyrm && enemy.bossPhase === 1) {
        const hpRatio = enemy.hp / enemy.maxHp;
        if (hpRatio <= 0.5) {
          enemy.bossPhase = 2;
        }
      }

      switch (enemy.aiState) {
        case EnemyAIState.Idle:
          this.updateIdle(enemy, def, dt, state, mapData);
          break;
        case EnemyAIState.Aggro:
          this.updateAggro(enemy, def, dt, deltaTime, state, shootingSystem, mapData);
          break;
        case EnemyAIState.Returning:
          this.updateReturning(enemy, def, dt, state, mapData);
          break;
        case EnemyAIState.Sleeping:
          // Boss is dormant, do nothing -- wake handled by DungeonSystem
          break;
      }

      // Apply HP regeneration
      if (enemy.hpRegenRate > 0 && enemy.hp < enemy.maxHp) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.hpRegenRate * dt);
      }
    });
  }

  private updateIdle(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    state: GameState,
    mapData?: DungeonMapData
  ): void {
    // Check for aggro
    const target = this.findPlayerInRange(enemy, def.aggroRange, state, mapData);
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
      enemy.idlePauseTimer = 1000 + Math.random() * 2000;
      this.pickNewIdleTarget(enemy, mapData);
      return;
    }

    const angle = angleBetween(
      enemy.x,
      enemy.y,
      enemy.idleTargetX,
      enemy.idleTargetY
    );
    enemy.x += Math.cos(angle) * def.speed * 0.3 * dt;
    enemy.y += Math.sin(angle) * def.speed * 0.3 * dt;
    this.clampToZone(enemy, def, mapData);
  }

  private updateAggro(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    _deltaTimeMs: number,
    state: GameState,
    shootingSystem: ShootingPatternSystem,
    mapData?: DungeonMapData
  ): void {
    const target = state.players.get(enemy.targetPlayerId);

    // Validate target — must be alive and in same zone
    if (!target || !target.alive || target.zone !== enemy.zone) {
      enemy.aiState = EnemyAIState.Returning;
      enemy.targetPlayerId = "";
      return;
    }

    // Check leash range
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

    // Get effective def (boss phase overrides)
    const effectiveDef = this.getBossOverrideDef(enemy, def);

    // Move toward target
    const distToTarget = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    if (distToTarget > effectiveDef.aggroRange * 0.5) {
      const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
      enemy.x += Math.cos(angle) * effectiveDef.speed * dt;
      enemy.y += Math.sin(angle) * effectiveDef.speed * dt;
      this.clampToZone(enemy, def, mapData);
    }

    // Shoot
    const now = Date.now();
    if (now - enemy.lastShootTime >= effectiveDef.shootCooldown) {
      enemy.lastShootTime = now;
      shootingSystem.executePattern(enemy, target, effectiveDef, state);
    }
  }

  private updateReturning(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    state: GameState,
    mapData?: DungeonMapData
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
      this.pickNewIdleTarget(enemy, mapData);
      return;
    }

    const target = this.findPlayerInRange(enemy, def.aggroRange * 0.7, state, mapData);
    if (target) {
      enemy.aiState = EnemyAIState.Aggro;
      enemy.targetPlayerId = target.id;
      return;
    }

    const angle = angleBetween(enemy.x, enemy.y, enemy.spawnX, enemy.spawnY);
    enemy.x += Math.cos(angle) * def.speed * dt;
    enemy.y += Math.sin(angle) * def.speed * dt;
    this.clampToZone(enemy, def, mapData);
  }

  private findPlayerInRange(
    enemy: Enemy,
    range: number,
    state: GameState,
    mapData?: DungeonMapData
  ): Player | null {
    let nearest: Player | null = null;
    let nearestDist = Infinity;

    state.players.forEach((player) => {
      if (!player.alive || player.invulnerable || player.zone !== enemy.zone) return;
      const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
      if (dist < range && dist < nearestDist) {
        // In dungeons, check line-of-sight through walls
        if (mapData && !hasLineOfSight(enemy.x, enemy.y, player.x, player.y, mapData)) {
          return; // Wall blocks vision
        }
        nearestDist = dist;
        nearest = player;
      }
    });

    return nearest;
  }

  private pickNewIdleTarget(enemy: Enemy, mapData?: DungeonMapData): void {
    // Try several random positions, prefer walkable tiles in dungeons
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      const targetX = enemy.spawnX + Math.cos(angle) * dist;
      const targetY = enemy.spawnY + Math.sin(angle) * dist;

      if (mapData && !isTileWalkable(targetX, targetY, mapData)) continue;

      enemy.idleTargetX = targetX;
      enemy.idleTargetY = targetY;
      return;
    }

    // Fallback: stay at spawn
    enemy.idleTargetX = enemy.spawnX;
    enemy.idleTargetY = enemy.spawnY;
  }

  private clampToZone(enemy: Enemy, def: EnemyDefinition, mapData?: DungeonMapData): void {
    const dims = getZoneDimensions(enemy.zone);
    enemy.x = clamp(enemy.x, def.radius, dims.width - def.radius);
    enemy.y = clamp(enemy.y, def.radius, dims.height - def.radius);

    // Apply wall collision in dungeons
    if (mapData) {
      const resolved = resolveWallCollision(enemy.x, enemy.y, def.radius, mapData);
      enemy.x = resolved.x;
      enemy.y = resolved.y;
    }
  }

  private isNearAnyPlayer(
    enemy: Enemy,
    state: GameState,
    range: number
  ): boolean {
    let near = false;
    state.players.forEach((player) => {
      if (near) return;
      if (!player.alive || player.invulnerable || player.zone !== enemy.zone) return;
      if (distanceBetween(enemy.x, enemy.y, player.x, player.y) < range) {
        near = true;
      }
    });
    return near;
  }

  /** Override enemy definition for bosses based on their current phase. */
  private getBossOverrideDef(
    enemy: Enemy,
    baseDef: EnemyDefinition
  ): EnemyDefinition {
    if (!enemy.isBoss || enemy.bossPhase === 0) return baseDef;

    if (enemy.enemyType === EnemyType.MoltenWyrm) {
      if (enemy.bossPhase === 1) {
        const useSpiral =
          Math.floor(enemy.spiralAngleOffset * 3) % 2 === 0;
        return {
          ...baseDef,
          shootingPattern: useSpiral
            ? ShootingPatternType.Spiral5
            : ShootingPatternType.BurstRing12,
        };
      } else {
        return {
          ...baseDef,
          shootCooldown: 500,
          shootingPattern: ShootingPatternType.BurstRing16,
          projectileDamage: 28,
          speed: 55,
        };
      }
    }

    if (enemy.enemyType === EnemyType.TheArchitect) {
      if (enemy.bossPhase === 0) {
        // Sleeping -- safety fallback (should not be shooting)
        return { ...baseDef, shootCooldown: 999999 };
      }

      if (enemy.bossPhase === 1) {
        // Phase 1 (100%-66%): Alternating Spiral8 + aimed Spread5
        const useSpiral = Math.floor(enemy.spiralAngleOffset * 3) % 2 === 0;
        return {
          ...baseDef,
          shootingPattern: useSpiral
            ? ShootingPatternType.Spiral8
            : ShootingPatternType.Spread5,
          shootCooldown: 900,
          projectileDamage: 22,
          speed: 30,
        };
      }

      if (enemy.bossPhase === 2) {
        // Phase 2 (66%-33%): Counter-rotating double spiral + aimed spread
        const useSpiral = Math.floor(enemy.spiralAngleOffset * 3) % 3 !== 0;
        return {
          ...baseDef,
          shootingPattern: useSpiral
            ? ShootingPatternType.CounterSpiralDouble
            : ShootingPatternType.Spread5,
          shootCooldown: 650,
          projectileDamage: 28,
          speed: 40,
        };
      }

      // Phase 3 (<33%): Dense multi-speed rings + rotating cross + aimed bursts
      const patternCycle = Math.floor(enemy.spiralAngleOffset * 2) % 3;
      let pattern: number;
      if (patternCycle === 0) pattern = ShootingPatternType.MultiSpeedRing;
      else if (patternCycle === 1) pattern = ShootingPatternType.RotatingCross;
      else pattern = ShootingPatternType.Spread5;

      return {
        ...baseDef,
        shootingPattern: pattern,
        shootCooldown: 450,
        projectileDamage: 35,
        speed: 50,
      };
    }

    return baseDef;
  }
}
