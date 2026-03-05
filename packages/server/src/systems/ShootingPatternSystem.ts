import { Enemy } from "../schemas/Enemy";
import { Player } from "../schemas/Player";
import { Projectile } from "../schemas/Projectile";
import { GameState } from "../schemas/GameState";
import { generateId } from "../utils/idGenerator";
import {
  EntityType,
  ShootingPatternType,
  angleBetween,
} from "@rotmg-lite/shared";
import { EnemyDefinition } from "@rotmg-lite/shared";

interface ProjectileSpawn {
  angle: number;
  speedMultiplier: number;
  damageMultiplier: number;
  offsetX: number;
  offsetY: number;
}

export class ShootingPatternSystem {
  executePattern(
    enemy: Enemy,
    target: Player,
    def: EnemyDefinition,
    state: GameState
  ): void {
    const aimAngle = angleBetween(enemy.x, enemy.y, target.x, target.y);
    const spawns = this.getPatternProjectiles(
      def.shootingPattern,
      aimAngle,
      enemy
    );

    for (const spawn of spawns) {
      const proj = new Projectile();
      proj.id = generateId("eproj");
      proj.x = enemy.x + spawn.offsetX;
      proj.y = enemy.y + spawn.offsetY;
      proj.angle = spawn.angle;
      proj.ownerType = EntityType.Enemy;
      proj.ownerId = enemy.id;
      proj.speed = def.projectileSpeed * spawn.speedMultiplier;
      proj.damage = def.projectileDamage * spawn.damageMultiplier;
      proj.startX = proj.x;
      proj.startY = proj.y;
      proj.maxRange = def.projectileRange;
      proj.collisionRadius = def.projectileCollisionRadius ?? 5;
      proj.zone = enemy.zone || "hostile:1";

      state.projectiles.set(proj.id, proj);
    }
  }

  private getPatternProjectiles(
    pattern: number,
    aimAngle: number,
    enemy: Enemy
  ): ProjectileSpawn[] {
    switch (pattern) {
      case ShootingPatternType.SingleAimed:
        return this.singleAimed(aimAngle);
      case ShootingPatternType.Spread3:
        return this.spread(aimAngle, 3, Math.PI / 9);
      case ShootingPatternType.Spread5:
        return this.spread(aimAngle, 5, Math.PI / 9);
      case ShootingPatternType.BurstRing4:
        return this.burstRing(4);
      case ShootingPatternType.BurstRing8:
        return this.burstRing(8);
      case ShootingPatternType.BurstRing12:
        return this.burstRing(12);
      case ShootingPatternType.BurstRing16:
        return this.burstRing(16);
      case ShootingPatternType.Spiral3:
        return this.spiral(enemy, 3);
      case ShootingPatternType.Spiral5:
        return this.spiral(enemy, 5);
      case ShootingPatternType.Spiral8:
        return this.spiral(enemy, 8);
      case ShootingPatternType.DoubleSingle:
        return this.doubleSingle(aimAngle);
      case ShootingPatternType.CounterSpiralDouble:
        return this.counterSpiralDouble(enemy, 5);
      case ShootingPatternType.MultiSpeedRing:
        return this.multiSpeedRing(16);
      case ShootingPatternType.RotatingCross:
        return this.rotatingCross(enemy);
      default:
        return this.singleAimed(aimAngle);
    }
  }

  private singleAimed(aimAngle: number): ProjectileSpawn[] {
    return [
      {
        angle: aimAngle,
        speedMultiplier: 1,
        damageMultiplier: 1,
        offsetX: 0,
        offsetY: 0,
      },
    ];
  }

  private spread(
    aimAngle: number,
    count: number,
    gapAngle: number
  ): ProjectileSpawn[] {
    const spawns: ProjectileSpawn[] = [];
    const startAngle = aimAngle - (gapAngle * (count - 1)) / 2;
    for (let i = 0; i < count; i++) {
      spawns.push({
        angle: startAngle + i * gapAngle,
        speedMultiplier: 1,
        damageMultiplier: 1,
        offsetX: 0,
        offsetY: 0,
      });
    }
    return spawns;
  }

  private burstRing(count: number): ProjectileSpawn[] {
    const spawns: ProjectileSpawn[] = [];
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      spawns.push({
        angle: i * step,
        speedMultiplier: 1,
        damageMultiplier: 0.8,
        offsetX: 0,
        offsetY: 0,
      });
    }
    return spawns;
  }

  private spiral(enemy: Enemy, shotsPerVolley: number): ProjectileSpawn[] {
    const spawns: ProjectileSpawn[] = [];
    const step = (Math.PI * 2) / shotsPerVolley;
    for (let i = 0; i < shotsPerVolley; i++) {
      spawns.push({
        angle: enemy.spiralAngleOffset + i * step,
        speedMultiplier: 1,
        damageMultiplier: 0.9,
        offsetX: 0,
        offsetY: 0,
      });
    }
    // Rotate offset for next volley (creates spiral effect over time)
    enemy.spiralAngleOffset += Math.PI / 6;
    return spawns;
  }

  private doubleSingle(aimAngle: number): ProjectileSpawn[] {
    return [
      {
        angle: aimAngle,
        speedMultiplier: 1.0,
        damageMultiplier: 0.8,
        offsetX: -5,
        offsetY: 0,
      },
      {
        angle: aimAngle,
        speedMultiplier: 1.1,
        damageMultiplier: 0.8,
        offsetX: 5,
        offsetY: 0,
      },
    ];
  }

  /** Two interleaved spirals rotating in opposite directions (DNA helix). */
  private counterSpiralDouble(enemy: Enemy, armsPerSpiral: number): ProjectileSpawn[] {
    const spawns: ProjectileSpawn[] = [];
    const step = (Math.PI * 2) / armsPerSpiral;

    // Spiral A: rotates clockwise
    for (let i = 0; i < armsPerSpiral; i++) {
      spawns.push({
        angle: enemy.spiralAngleOffset + i * step,
        speedMultiplier: 1,
        damageMultiplier: 0.85,
        offsetX: 0,
        offsetY: 0,
      });
    }

    // Spiral B: rotates counter-clockwise (offset by half step)
    for (let i = 0; i < armsPerSpiral; i++) {
      spawns.push({
        angle: -enemy.spiralAngleOffset + i * step + step / 2,
        speedMultiplier: 0.9,
        damageMultiplier: 0.85,
        offsetX: 0,
        offsetY: 0,
      });
    }

    enemy.spiralAngleOffset += Math.PI / 8;
    return spawns;
  }

  /** Ring burst with alternating fast/slow projectiles creating layered waves. */
  private multiSpeedRing(count: number): ProjectileSpawn[] {
    const spawns: ProjectileSpawn[] = [];
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      spawns.push({
        angle: i * step,
        speedMultiplier: i % 2 === 0 ? 1.3 : 0.7,
        damageMultiplier: 0.75,
        offsetX: 0,
        offsetY: 0,
      });
    }
    return spawns;
  }

  /** 4-armed cross with stacked projectiles at different speeds, rotates each volley. */
  private rotatingCross(enemy: Enemy): ProjectileSpawn[] {
    const spawns: ProjectileSpawn[] = [];
    for (let arm = 0; arm < 4; arm++) {
      const baseAngle = enemy.spiralAngleOffset + (Math.PI / 2) * arm;
      for (let p = 0; p < 3; p++) {
        spawns.push({
          angle: baseAngle,
          speedMultiplier: 0.8 + p * 0.3,
          damageMultiplier: 0.7,
          offsetX: 0,
          offsetY: 0,
        });
      }
    }
    enemy.spiralAngleOffset += Math.PI / 12;
    return spawns;
  }
}
