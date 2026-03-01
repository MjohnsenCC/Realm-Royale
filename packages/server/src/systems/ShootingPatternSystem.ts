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
}
