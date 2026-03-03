import { GameState } from "../schemas/GameState";
import { Enemy } from "../schemas/Enemy";
import { Player } from "../schemas/Player";
import { ShootingPatternSystem } from "./ShootingPatternSystem";
import {
  EnemyType,
  EnemyAIState,
  ShootingPatternType,
  MovementPatternType,
  ENEMY_DEFS,
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
} from "@rotmg-lite/shared";
import type { EnemyDefinition, DungeonMapData } from "@rotmg-lite/shared";

const AI_UPDATE_RANGE = 1500; // Only update enemies within this range of a player
const ORBIT_RADIUS = 120; // 3 tiles — used by Orbiter movement pattern

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

      // Boss phase transitions for Molten Wyrm (3 phases)
      if (enemy.isBoss && enemy.enemyType === EnemyType.MoltenWyrm && enemy.bossPhase >= 1) {
        const hpRatio = enemy.hp / enemy.maxHp;
        if (hpRatio <= 0.3 && enemy.bossPhase < 3) {
          enemy.bossPhase = 3;
        } else if (hpRatio <= 0.6 && enemy.bossPhase < 2) {
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
      enemy.aiState = EnemyAIState.Returning;
      enemy.targetPlayerId = "";
      return;
    }

    // Drop aggro if target is outside deaggro range (10% beyond aggro range)
    const distToTarget = distanceBetween(enemy.x, enemy.y, target.x, target.y);
    if (distToTarget > def.aggroRange * 1.1) {
      enemy.aiState = EnemyAIState.Returning;
      enemy.targetPlayerId = "";
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
      enemy.aiState = EnemyAIState.Returning;
      enemy.targetPlayerId = "";
      return;
    }

    // Get effective def (boss phase overrides)
    const effectiveDef = this.getBossOverrideDef(enemy, def);

    // Movement dispatch
    this.updateAggroMovement(enemy, effectiveDef, target, dt, mapData);

    // Shooting
    this.updateAggroShooting(enemy, effectiveDef, target, state, shootingSystem);
  }

  // --- Movement pattern dispatch ---

  private updateAggroMovement(
    enemy: Enemy,
    def: EnemyDefinition,
    target: Player,
    dt: number,
    mapData?: DungeonMapData
  ): void {
    // Boss-specific movement overrides
    if (enemy.enemyType === EnemyType.MoltenWyrm && enemy.isBoss) {
      const orbitRadius = 40;
      const orbitSpeed = 0.8;
      enemy.bossOrbitAngle += orbitSpeed * dt;
      if (enemy.bossOrbitAngle > Math.PI * 2) {
        enemy.bossOrbitAngle -= Math.PI * 2;
      }
      enemy.x = enemy.spawnX + Math.cos(enemy.bossOrbitAngle) * orbitRadius;
      enemy.y = enemy.spawnY + Math.sin(enemy.bossOrbitAngle) * orbitRadius;
      this.clampToZone(enemy, def, mapData);
      return;
    }

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
    if (enemy.zone === "hostile" && getRealmMap()) {
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

  /** Override enemy definition for bosses based on their current phase. */
  private getBossOverrideDef(
    enemy: Enemy,
    baseDef: EnemyDefinition
  ): EnemyDefinition {
    if (!enemy.isBoss || enemy.bossPhase === 0) return baseDef;

    if (enemy.enemyType === EnemyType.MoltenWyrm) {
      if (enemy.bossPhase === 1) {
        // Phase 1 (100%-60%): Slow lumbering attacks — alternating aimed spread and slow ring
        const useSpread =
          Math.floor(enemy.spiralAngleOffset * 3) % 2 === 0;
        return {
          ...baseDef,
          shootingPattern: useSpread
            ? ShootingPatternType.Spread3
            : ShootingPatternType.BurstRing8,
          shootCooldown: 1200,
          projectileSpeed: 120,
          projectileRange: 280,
          speed: 55,
        };
      } else if (enemy.bossPhase === 2) {
        // Phase 2 (60%-30%): Eruption — fast spirals with increased speed, chases aggressively
        const useSpiral =
          Math.floor(enemy.spiralAngleOffset * 4) % 3 !== 0;
        return {
          ...baseDef,
          shootingPattern: useSpiral
            ? ShootingPatternType.Spiral5
            : ShootingPatternType.Spread5,
          shootCooldown: 800,
          projectileDamage: 24,
          projectileSpeed: 120,
          projectileRange: 300,
          speed: 80,
        };
      } else {
        // Phase 3 (<30%): Meltdown — rapid rotating cross + multi-speed rings, very aggressive
        const cycle = Math.floor(enemy.spiralAngleOffset * 5) % 3;
        let pattern: number;
        if (cycle === 0) pattern = ShootingPatternType.RotatingCross;
        else if (cycle === 1) pattern = ShootingPatternType.MultiSpeedRing;
        else pattern = ShootingPatternType.CounterSpiralDouble;
        return {
          ...baseDef,
          shootingPattern: pattern,
          shootCooldown: 500,
          projectileDamage: 30,
          projectileSpeed: 120,
          projectileRange: 350,
          speed: 100,
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
