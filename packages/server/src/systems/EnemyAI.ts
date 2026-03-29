import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { Player } from "../schemas/Player";
import { ShootingPatternSystem } from "./ShootingPatternSystem";
import {
  EnemyType,
  EnemyAIState,
  ShootingPatternType,
  MovementPatternType,
  BossMovementType,
  BossAbilityType,
  ENEMY_DEFS,
  BOSS_PHASES,
  distanceBetween,
  angleBetween,
  clamp,
  getZoneDimensions,
  resolveWallCollision,
  resolveHostileCollision,
  getRealmMap,
  isTileWalkable,
  hasLineOfSight,
  isDungeonZone,
  isHostileZone,
} from "@rotmg-lite/shared";
import type { EnemyDefinition, DungeonMapData, BossPhaseConfig } from "@rotmg-lite/shared";

const AI_UPDATE_RANGE = 1500; // Only update enemies within this range of a player
const ORBIT_RADIUS = 120; // 3 tiles — used by Orbiter movement pattern

export class EnemyAI {
  update(
    deltaTime: number,
    state: GameState,
    shootingSystem: ShootingPatternSystem,
    dungeonMaps?: Map<string, DungeonMapData>,
    getModifiedDef?: (baseDef: EnemyDefinition, zone: string) => EnemyDefinition,
    currentTick: number = 0
  ): void {
    const dt = deltaTime / 1000;

    state.enemies.forEach((enemy) => {
      // Performance: skip AI for enemies far from all players
      if (!this.isNearAnyPlayer(enemy, state, AI_UPDATE_RANGE)) return;

      // Lag compensation: shift position history before AI moves the enemy
      enemy.prevX2 = enemy.prevX1;
      enemy.prevY2 = enemy.prevY1;
      enemy.prevX1 = enemy.x;
      enemy.prevY1 = enemy.y;
      if (enemy.posHistoryReady < 2) enemy.posHistoryReady++;

      const prevX = enemy.x;
      const prevY = enemy.y;

      let def = ENEMY_DEFS[enemy.enemyType];
      if (!def) return;

      // Apply dungeon modifier overrides to enemy definition
      if (getModifiedDef && isDungeonZone(enemy.zone)) {
        def = getModifiedDef(def, enemy.zone);
      }

      const mapData = dungeonMaps?.get(enemy.zone);

      // Data-driven boss phase transitions (HP-gated)
      if (enemy.isBoss && enemy.bossPhase >= 1) {
        const phases = BOSS_PHASES[enemy.enemyType];
        if (phases) {
          const hpRatio = enemy.hp / enemy.maxHp;
          // Check phases in reverse order (highest phase first) so we jump to the right one
          for (let i = phases.length - 1; i >= 0; i--) {
            const phaseNum = i + 1;
            if (hpRatio <= phases[i].hpThreshold && enemy.bossPhase < phaseNum) {
              enemy.bossPhase = phaseNum;
              // Reset ability cooldown on phase change so new ability activates soon
              enemy.bossAbilityCooldownTimer = 2000;
              break;
            }
          }
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

      // Track whether this enemy moved this tick (for filter-refresh optimization)
      if (enemy.x !== prevX || enemy.y !== prevY) {
        enemy.lastMovedTick = currentTick;
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
      this.initAggro(enemy, target.id);
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
      // Pause duration based on idle intensity
      const intensity = def.idleIntensity ?? 0;
      if (intensity === 2) {
        enemy.idlePauseTimer = 300 + Math.random() * 500;
      } else if (intensity === 1) {
        enemy.idlePauseTimer = 500 + Math.random() * 1000;
      } else {
        enemy.idlePauseTimer = 1000 + Math.random() * 2000;
      }
      this.pickNewIdleTarget(enemy, def, mapData);
      return;
    }

    // Speed multiplier based on idle intensity
    const intensity = def.idleIntensity ?? 0;
    const speedMult = intensity === 2 ? 0.7 : intensity === 1 ? 0.5 : 0.3;

    const angle = angleBetween(
      enemy.x,
      enemy.y,
      enemy.idleTargetX,
      enemy.idleTargetY
    );
    enemy.x += Math.cos(angle) * def.speed * speedMult * dt;
    enemy.y += Math.sin(angle) * def.speed * speedMult * dt;
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
      enemy.spawnX = enemy.x;
      enemy.spawnY = enemy.y;
      enemy.aiState = EnemyAIState.Idle;
      enemy.targetPlayerId = "";
      this.pickNewIdleTarget(enemy, def, mapData);
      return;
    }

    // Drop aggro if target is outside deaggro range (10% beyond aggro range)
    const distToTarget = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    if (distToTarget > def.aggroRange * 1.1) {
      enemy.spawnX = enemy.x;
      enemy.spawnY = enemy.y;
      enemy.aiState = EnemyAIState.Idle;
      enemy.targetPlayerId = "";
      this.pickNewIdleTarget(enemy, def, mapData);
      return;
    }

    // Periodic target re-evaluation for multiplayer
    enemy.retargetTimer -= _deltaTimeMs;
    if (enemy.retargetTimer <= 0) {
      enemy.retargetTimer = 2000 + Math.random() * 1000;
      const currentDist = distanceBetween(enemy.x, enemy.y, target.x, target.y);
      const nearest = this.findPlayerInRange(enemy, def.aggroRange, state, mapData);
      if (nearest && nearest.id !== enemy.targetPlayerId) {
        const nearestDist = distanceBetween(enemy.x, enemy.y, nearest.x, nearest.y);
        if (nearestDist < currentDist * 0.5) {
          enemy.targetPlayerId = nearest.id;
        }
      }
    }

    // Check leash range
    const distFromSpawn = distanceBetween(
      enemy.x,
      enemy.y,
      enemy.spawnX,
      enemy.spawnY
    );
    if (distFromSpawn > def.leashRange) {
      enemy.spawnX = enemy.x;
      enemy.spawnY = enemy.y;
      enemy.aiState = EnemyAIState.Idle;
      enemy.targetPlayerId = "";
      this.pickNewIdleTarget(enemy, def, mapData);
      return;
    }

    // Get effective def (boss phase overrides)
    const effectiveDef = this.getBossOverrideDef(enemy, def);

    // Boss-specific movement and abilities
    const phaseConfig = this.getBossPhaseConfig(enemy);
    if (phaseConfig) {
      this.updateBossMovement(enemy, effectiveDef, target, dt, phaseConfig, mapData);
      this.updateBossAbilities(enemy, effectiveDef, target, _deltaTimeMs, phaseConfig, state, shootingSystem, mapData);
    } else {
      // Non-boss or no config: use standard movement
      this.updateAggroMovement(enemy, effectiveDef, target, dt, mapData);
    }

    // Shooting (skip if boss shield is active)
    if (!enemy.bossShieldActive) {
      this.updateAggroShooting(enemy, effectiveDef, target, state, shootingSystem);
    }
  }

  // --- Movement pattern dispatch ---

  private updateAggroMovement(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    const pattern = def.movementPattern ?? MovementPatternType.WanderingSprayer;

    switch (pattern) {
      case MovementPatternType.RingPulser:
        this.moveRingPulser(enemy, def, mapData);
        break;
      case MovementPatternType.Orbiter:
        this.moveOrbiter(enemy, def, dt, mapData);
        break;
      case MovementPatternType.ChargerRetreater:
        this.moveChargerRetreater(enemy, def, target, dt, mapData);
        break;
      case MovementPatternType.SpiralSpinner:
        this.moveSpiralSpinner(enemy, def, dt, mapData);
        break;
      case MovementPatternType.Shotgunner:
        this.moveShotgunner(enemy, def, target, dt, mapData);
        break;
      case MovementPatternType.BurstMage:
        this.moveBurstMage(enemy, def, target, dt, mapData);
        break;
      default:
        this.moveWanderingSprayer(enemy, def, target, dt, mapData);
        break;
    }
  }

  private updateAggroShooting(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    state: GameState,
    shootingSystem: ShootingPatternSystem
  ): void {
    // ChargerRetreater only shoots at end of charge (phase transition handles lastShootTime reset)
    if (
      def.movementPattern === MovementPatternType.ChargerRetreater &&
      enemy.movementPhase === 2 &&
      enemy.movementPhaseTimer > 1900
    ) {
      // Just transitioned to retreat — fire the fan
      shootingSystem.executePattern(enemy, target, def, state);
      return;
    }
    if (
      def.movementPattern === MovementPatternType.ChargerRetreater &&
      enemy.movementPhase !== 0
    ) {
      // Don't shoot during charge or retreat phases
      return;
    }

    const now = Date.now();
    if (now - enemy.lastShootTime >= def.shootCooldown) {
      enemy.lastShootTime = now;
      shootingSystem.executePattern(enemy, target, def, state);
    }
  }

  // --- Movement pattern implementations ---

  /** WanderingSprayer: chase target until within 50% aggro range, then stop. Default behavior. */
  private moveWanderingSprayer(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    const distToTarget = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    if (distToTarget > def.aggroRange * 0.5) {
      const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
      enemy.x += Math.cos(angle) * def.speed * dt;
      enemy.y += Math.sin(angle) * def.speed * dt;
    }
    this.clampToZone(enemy, def, mapData);
  }

  /** RingPulser: completely stationary. Shooting pattern handles the ring bursts. */
  private moveRingPulser(
    enemy: Enemy,
    def: EnemyDefinition,
    mapData?: DungeonMapData
  ): void {
    this.clampToZone(enemy, def, mapData);
  }

  /** Orbiter: circles a point at ~3-tile radius, fires from shifting angles. */
  private moveOrbiter(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    const angularSpeed = def.speed / ORBIT_RADIUS; // radians/sec
    enemy.orbitAngle += angularSpeed * dt;
    if (enemy.orbitAngle > Math.PI * 2) enemy.orbitAngle -= Math.PI * 2;
    enemy.x = enemy.orbitCenterX + Math.cos(enemy.orbitAngle) * ORBIT_RADIUS;
    enemy.y = enemy.orbitCenterY + Math.sin(enemy.orbitAngle) * ORBIT_RADIUS;
    this.clampToZone(enemy, def, mapData);
  }

  /** ChargerRetreater: 3-phase state machine — approach, charge, retreat. */
  private moveChargerRetreater(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    enemy.movementPhaseTimer -= dt * 1000;
    const dist = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);

    switch (enemy.movementPhase) {
      case 0: // Approach
        if (dist > 200) {
          enemy.x += Math.cos(angle) * def.speed * 0.5 * dt;
          enemy.y += Math.sin(angle) * def.speed * 0.5 * dt;
        }
        if (dist <= 200 || enemy.movementPhaseTimer <= 0) {
          enemy.movementPhase = 1;
          enemy.movementPhaseTimer = 1500;
        }
        break;
      case 1: // Charge
        enemy.x += Math.cos(angle) * def.speed * 2.0 * dt;
        enemy.y += Math.sin(angle) * def.speed * 2.0 * dt;
        if (enemy.movementPhaseTimer <= 0) {
          enemy.movementPhase = 2;
          enemy.movementPhaseTimer = 2000;
          enemy.lastShootTime = 0; // Force immediate shot on transition
        }
        break;
      case 2: // Retreat
        enemy.x -= Math.cos(angle) * def.speed * 0.8 * dt;
        enemy.y -= Math.sin(angle) * def.speed * 0.8 * dt;
        if (enemy.movementPhaseTimer <= 0) {
          enemy.movementPhase = 0;
          enemy.movementPhaseTimer = 2000;
        }
        break;
    }
    this.clampToZone(enemy, def, mapData);
  }

  /** SpiralSpinner: near-stationary turret, tiny drift around spawn. */
  private moveSpiralSpinner(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    const distFromSpawn = distanceBetween(enemy.x, enemy.y, enemy.spawnX, enemy.spawnY);
    if (distFromSpawn > 40) {
      const angle = angleBetween(enemy.x, enemy.y, enemy.spawnX, enemy.spawnY);
      enemy.x += Math.cos(angle) * def.speed * 0.1 * dt;
      enemy.y += Math.sin(angle) * def.speed * 0.1 * dt;
    }
    this.clampToZone(enemy, def, mapData);
  }

  /** Shotgunner: maintains 200-240px from target, strafes laterally. */
  private moveShotgunner(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    const dist = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
    const idealMin = 200;
    const idealMax = 240;

    let moveAngle: number;
    if (dist < idealMin) {
      // Too close: retreat with perpendicular component
      moveAngle = angle + Math.PI + (enemy.orbitAngle > Math.PI ? 0.4 : -0.4);
    } else if (dist > idealMax) {
      // Too far: approach
      moveAngle = angle;
    } else {
      // In range: strafe perpendicular
      moveAngle = angle + (enemy.orbitAngle > Math.PI ? Math.PI / 2 : -Math.PI / 2);
    }

    enemy.x += Math.cos(moveAngle) * def.speed * dt;
    enemy.y += Math.sin(moveAngle) * def.speed * dt;
    this.clampToZone(enemy, def, mapData);
  }

  /** BurstMage: circles target at medium range, periodically reversing direction. */
  private moveBurstMage(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    const dist = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
    const idealMin = 160;
    const idealMax = 220;

    // Reverse strafe direction periodically
    enemy.teleportCooldown -= dt * 1000;
    if (enemy.teleportCooldown <= 0) {
      enemy.teleportCooldown = 2000 + Math.random() * 2000;
      enemy.orbitAngle = enemy.orbitAngle > Math.PI ? 0 : Math.PI * 2; // flip strafe direction
    }

    let moveAngle: number;
    if (dist < idealMin) {
      // Too close: back away with strafe
      moveAngle = angle + Math.PI + (enemy.orbitAngle > Math.PI ? 0.5 : -0.5);
    } else if (dist > idealMax) {
      // Too far: approach
      moveAngle = angle;
    } else {
      // In range: strafe around target
      moveAngle = angle + (enemy.orbitAngle > Math.PI ? Math.PI / 2 : -Math.PI / 2);
    }

    enemy.x += Math.cos(moveAngle) * def.speed * dt;
    enemy.y += Math.sin(moveAngle) * def.speed * dt;
    this.clampToZone(enemy, def, mapData);
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
      this.pickNewIdleTarget(enemy, def, mapData);
      return;
    }

    const target = this.findPlayerInRange(enemy, def.aggroRange * 0.7, state, mapData);
    if (target) {
      this.initAggro(enemy, target.id);
      return;
    }

    const angle = angleBetween(enemy.x, enemy.y, enemy.spawnX, enemy.spawnY);
    enemy.x += Math.cos(angle) * def.speed * dt;
    enemy.y += Math.sin(angle) * def.speed * dt;
    this.clampToZone(enemy, def, mapData);
  }

  private initAggro(enemy: Enemy, targetId: string): void {
    enemy.aiState = EnemyAIState.Aggro;
    enemy.targetPlayerId = targetId;
    enemy.movementPhase = 0;
    enemy.movementPhaseTimer = 2000;
    enemy.orbitAngle = Math.random() * Math.PI * 2;
    enemy.orbitCenterX = enemy.x - Math.cos(enemy.orbitAngle) * ORBIT_RADIUS;
    enemy.orbitCenterY = enemy.y - Math.sin(enemy.orbitAngle) * ORBIT_RADIUS;
    enemy.teleportCooldown = 3000 + Math.random() * 1000;
    enemy.retargetTimer = 2000 + Math.random() * 1000;
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

  private pickNewIdleTarget(enemy: Enemy, def: EnemyDefinition, mapData?: DungeonMapData): void {
    // Wander distance based on idle intensity
    const intensity = def.idleIntensity ?? 0;
    let minDist: number, rangeDist: number;
    if (intensity === 2) {
      minDist = 80; rangeDist = 80;   // 80-160px from spawn
    } else if (intensity === 1) {
      minDist = 50; rangeDist = 70;   // 50-120px from spawn
    } else {
      minDist = 30; rangeDist = 50;   // 30-80px from spawn (default)
    }

    // Try several random positions, prefer walkable tiles in dungeons
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * rangeDist;
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

    // Apply wall collision in dungeons / nexus
    if (mapData) {
      const resolved = resolveWallCollision(enemy.x, enemy.y, def.radius, mapData);
      enemy.x = resolved.x;
      enemy.y = resolved.y;
    }

    // Apply water collision in hostile zone
    if (isHostileZone(enemy.zone) && getRealmMap()) {
      const resolved = resolveHostileCollision(enemy.x, enemy.y, def.radius);
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

  /** Get the current BossPhaseConfig for a boss, or null for non-bosses. */
  private getBossPhaseConfig(enemy: Enemy): BossPhaseConfig | null {
    if (!enemy.isBoss || enemy.bossPhase === 0) return null;
    const phases = BOSS_PHASES[enemy.enemyType];
    if (!phases) return null;
    const idx = enemy.bossPhase - 1;
    return phases[idx] ?? null;
  }

  /** Override enemy definition for bosses based on their current phase config. */
  private getBossOverrideDef(
    enemy: Enemy,
    baseDef: EnemyDefinition
  ): EnemyDefinition {
    const config = this.getBossPhaseConfig(enemy);
    if (!config) {
      // Sleeping boss safety fallback
      if (enemy.isBoss && enemy.bossPhase === 0) {
        return { ...baseDef, shootCooldown: 999999 };
      }
      return baseDef;
    }

    // Cycle through shooting patterns using spiralAngleOffset
    const patternIdx = Math.floor(enemy.spiralAngleOffset * 3) % config.shootingPatterns.length;

    // Apply enrage multipliers
    const enrageDmgMult = enemy.bossEnraged ? 1.5 : 1;
    const enrageSpdMult = enemy.bossEnraged ? 1.4 : 1;

    return {
      ...baseDef,
      shootingPattern: config.shootingPatterns[patternIdx],
      shootCooldown: config.shootCooldown,
      projectileDamage: Math.round(config.projectileDamage * enrageDmgMult),
      projectileSpeed: config.projectileSpeed,
      projectileRange: config.projectileRange,
      speed: Math.round(config.speed * enrageSpdMult),
    };
  }

  // --- Boss movement dispatch (replaces hardcoded per-boss movement) ---

  private updateBossMovement(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    config: BossPhaseConfig,
    mapData?: DungeonMapData
  ): void {
    switch (config.movementType) {
      case BossMovementType.Orbit:
        this.moveBossOrbit(enemy, def, dt, config.movementParam ?? 40, mapData);
        break;
      case BossMovementType.Stationary:
        // Do nothing — boss stays exactly at its current position.
        // Calling clampToZone here would introduce floating-point drift
        // from wall collision resolution, causing visible micro-shaking.
        break;
      case BossMovementType.Chase:
        this.moveBossChase(enemy, def, target, dt, mapData);
        break;
      case BossMovementType.Teleport:
        this.moveBossTeleport(enemy, def, target, dt, config.movementParam ?? 4000, mapData);
        break;
      case BossMovementType.Charge:
        this.moveBossCharge(enemy, def, target, dt, config.movementParam ?? 1500, mapData);
        break;
      case BossMovementType.Patrol:
        this.moveBossPatrol(enemy, def, dt, config.movementParam ?? 3000, mapData);
        break;
      default:
        this.moveBossChase(enemy, def, target, dt, mapData);
        break;
    }
  }

  private moveBossOrbit(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    radius: number,
    mapData?: DungeonMapData
  ): void {
    const orbitSpeed = 0.8;
    enemy.bossOrbitAngle += orbitSpeed * dt;
    if (enemy.bossOrbitAngle > Math.PI * 2) {
      enemy.bossOrbitAngle -= Math.PI * 2;
    }
    enemy.x = enemy.spawnX + Math.cos(enemy.bossOrbitAngle) * radius;
    enemy.y = enemy.spawnY + Math.sin(enemy.bossOrbitAngle) * radius;
    this.clampToZone(enemy, def, mapData);
  }

  private moveBossChase(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    const dist = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    if (dist > def.radius + 10) {
      const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
      enemy.x += Math.cos(angle) * def.speed * dt;
      enemy.y += Math.sin(angle) * def.speed * dt;
    }
    this.clampToZone(enemy, def, mapData);
  }

  private moveBossTeleport(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    interval: number,
    mapData?: DungeonMapData
  ): void {
    enemy.bossTeleportTimer -= dt * 1000;
    if (enemy.bossTeleportTimer <= 0) {
      enemy.bossTeleportTimer = interval;
      // Teleport to a random walkable position within aggro range of spawn
      for (let attempt = 0; attempt < 15; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 200;
        const nx = enemy.spawnX + Math.cos(angle) * dist;
        const ny = enemy.spawnY + Math.sin(angle) * dist;
        if (!mapData || isTileWalkable(nx, ny, mapData)) {
          enemy.x = nx;
          enemy.y = ny;
          break;
        }
      }
    } else {
      // Slow drift toward target between teleports
      const dist = distanceBetween(enemy.x, enemy.y, target.x, target.y);
      if (dist > 100) {
        const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
        enemy.x += Math.cos(angle) * def.speed * 0.3 * dt;
        enemy.y += Math.sin(angle) * def.speed * 0.3 * dt;
      }
    }
    this.clampToZone(enemy, def, mapData);
  }

  private moveBossCharge(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    chargeDuration: number,
    mapData?: DungeonMapData
  ): void {
    enemy.bossChargeTimer -= dt * 1000;

    switch (enemy.bossChargePhase) {
      case 0: {
        // Approach: slowly move toward target until close or timer expires
        const dist = distanceBetween(enemy.x, enemy.y, target.x, target.y);
        const angle = angleBetween(enemy.x, enemy.y, target.x, target.y);
        enemy.x += Math.cos(angle) * def.speed * 0.4 * dt;
        enemy.y += Math.sin(angle) * def.speed * 0.4 * dt;
        if (dist <= 150 || enemy.bossChargeTimer <= 0) {
          enemy.bossChargePhase = 1;
          enemy.bossChargeTimer = chargeDuration;
          enemy.bossChargeAngle = angleBetween(enemy.x, enemy.y, target.x, target.y);
        }
        break;
      }
      case 1: {
        // Charge: dash in locked direction at 2.5x speed
        enemy.x += Math.cos(enemy.bossChargeAngle) * def.speed * 2.5 * dt;
        enemy.y += Math.sin(enemy.bossChargeAngle) * def.speed * 2.5 * dt;
        if (enemy.bossChargeTimer <= 0) {
          enemy.bossChargePhase = 2;
          enemy.bossChargeTimer = 1000; // pause after charge
        }
        break;
      }
      case 2: {
        // Pause: brief recovery, then restart cycle
        if (enemy.bossChargeTimer <= 0) {
          enemy.bossChargePhase = 0;
          enemy.bossChargeTimer = 2000; // approach time
        }
        break;
      }
    }
    this.clampToZone(enemy, def, mapData);
  }

  private moveBossPatrol(
    enemy: Enemy,
    def: EnemyDefinition,
    dt: number,
    waypointDelay: number,
    mapData?: DungeonMapData
  ): void {
    // Generate 4 waypoints around spawn (corners of boss room area)
    const offsets = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ];
    const wp = offsets[enemy.bossPatrolIndex % offsets.length];
    const targetX = enemy.spawnX + wp.x;
    const targetY = enemy.spawnY + wp.y;

    const dist = distanceBetween(enemy.x, enemy.y, targetX, targetY);
    if (dist > 15) {
      const angle = angleBetween(enemy.x, enemy.y, targetX, targetY);
      enemy.x += Math.cos(angle) * def.speed * dt;
      enemy.y += Math.sin(angle) * def.speed * dt;
    } else {
      // At waypoint — pause then advance
      enemy.bossPatrolTimer -= dt * 1000;
      if (enemy.bossPatrolTimer <= 0) {
        enemy.bossPatrolIndex = (enemy.bossPatrolIndex + 1) % offsets.length;
        enemy.bossPatrolTimer = waypointDelay;
      }
    }
    this.clampToZone(enemy, def, mapData);
  }

  // --- Boss ability system ---

  private updateBossAbilities(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    deltaTimeMs: number,
    config: BossPhaseConfig,
    state: GameState,
    shootingSystem: ShootingPatternSystem,
    mapData?: DungeonMapData
  ): void {
    // Tick down active ability timers
    if (enemy.bossAbilityActiveTimer > 0) {
      enemy.bossAbilityActiveTimer -= deltaTimeMs;
      if (enemy.bossAbilityActiveTimer <= 0) {
        enemy.bossAbilityActiveTimer = 0;
        // End active abilities
        if (enemy.bossShieldActive) {
          enemy.bossShieldActive = false;
          // Fire a big burst when shield drops
          shootingSystem.executePattern(enemy, target, { ...def, shootingPattern: ShootingPatternType.BurstRing16 }, state);
        }
        if (enemy.bossEnraged) {
          enemy.bossEnraged = false;
        }
      }
    }

    if (config.ability === BossAbilityType.None) return;
    if (!config.abilityCooldown) return;

    // Tick down ability cooldown
    enemy.bossAbilityCooldownTimer -= deltaTimeMs;
    if (enemy.bossAbilityCooldownTimer > 0) return;

    // Fire ability
    enemy.bossAbilityCooldownTimer = config.abilityCooldown;

    switch (config.ability) {
      case BossAbilityType.SummonAdds:
        this.abilitySpawnMinions(enemy, config, state);
        break;
      case BossAbilityType.AreaDenial:
        this.abilityAreaDenial(enemy, config, state);
        break;
      case BossAbilityType.ShieldPhase:
        this.abilityShieldPhase(enemy, config);
        break;
      case BossAbilityType.Enrage:
        this.abilityEnrage(enemy, config);
        break;
      case BossAbilityType.PullPlayers:
        this.abilityPullPlayers(enemy, config, state);
        break;
      case BossAbilityType.VineSnare:
        this.abilityVineSnare(enemy, config, target, state);
        break;
    }
  }

  private abilitySpawnMinions(enemy: Enemy, config: BossPhaseConfig, state: GameState): void {
    const count = config.abilityParam ?? 2;
    const minionType = config.abilityMinionType;
    if (minionType === undefined) return;

    // Count existing boss minions
    let existing = 0;
    state.enemies.forEach((e) => {
      if (e.packLeaderId === enemy.id) existing++;
    });
    // Cap total minions at count * 2
    const toSpawn = Math.min(count, count * 2 - existing);
    if (toSpawn <= 0) return;

    // Store spawn request on enemy for DungeonSystem to pick up
    enemy.lastMinionSpawnTime = Date.now();
    // We use a convention: store count in movementPhaseTimer temporarily
    // DungeonSystem will read this — see bossMinionsToSpawn handling
    (enemy as any)._pendingMinionSpawn = { type: minionType, count: toSpawn };
  }

  private abilityAreaDenial(enemy: Enemy, config: BossPhaseConfig, state: GameState): void {
    // Create a ring of projectiles at the boss's current position that expand outward slowly
    // This uses BurstRing8 at reduced speed to simulate a lingering danger zone
    const fakeDef: EnemyDefinition = {
      ...ENEMY_DEFS[enemy.enemyType],
      shootingPattern: ShootingPatternType.BurstRing8,
      projectileSpeed: 30, // very slow expanding pool
      projectileRange: config.abilityParam ?? 60,
      projectileDamage: Math.round((config.projectileDamage ?? 20) * 0.5),
      shootCooldown: 999999,
    };
    // Find any target for aiming (not actually used by BurstRing)
    let target: Player | null = null;
    state.players.forEach((p) => {
      if (!target && p.alive && p.zone === enemy.zone) target = p;
    });
    if (target) {
      const { ShootingPatternSystem: _unused, ...rest } = {} as any;
      // We'll queue the pattern through the normal shooting path
      (enemy as any)._pendingAreaDenial = fakeDef;
    }
  }

  private abilityShieldPhase(enemy: Enemy, config: BossPhaseConfig): void {
    enemy.bossShieldActive = true;
    enemy.bossAbilityActiveTimer = config.abilityParam ?? 2000;
  }

  private abilityEnrage(enemy: Enemy, config: BossPhaseConfig): void {
    enemy.bossEnraged = true;
    enemy.bossAbilityActiveTimer = config.abilityParam ?? 3000;
  }

  private abilityPullPlayers(enemy: Enemy, config: BossPhaseConfig, state: GameState): void {
    const pullRadius = config.abilityParam ?? 200;
    state.players.forEach((player) => {
      if (!player.alive || player.zone !== enemy.zone) return;
      const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
      if (dist > pullRadius || dist < 20) return;
      // Pull player 30% closer to boss
      const angle = angleBetween(player.x, player.y, enemy.x, enemy.y);
      const pullStrength = dist * 0.3;
      player.x += Math.cos(angle) * pullStrength;
      player.y += Math.sin(angle) * pullStrength;
    });
  }

  private abilityVineSnare(enemy: Enemy, config: BossPhaseConfig, target: Player, state: GameState): void {
    // Find closest player and briefly slow them (via speed debuff)
    // We mark the snare duration on the player — CombatSystem can check this
    const snareDuration = config.abilityParam ?? 1500;
    let closest: Player | null = null;
    let closestDist = Infinity;
    state.players.forEach((player) => {
      if (!player.alive || player.zone !== enemy.zone) return;
      const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = player;
      }
    });
    if (closest) {
      // Apply snare as a speed debuff timer on the player
      (closest as any).vineSnareTimer = snareDuration;
    }
  }
}
