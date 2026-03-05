import Phaser from "phaser";
import { EntityType, ProjectileType, PROJECTILE_RADIUS } from "@rotmg-lite/shared";

export class ProjectileSprite {
  private graphics: Phaser.GameObjects.Graphics;
  private serverX: number = 0;
  private serverY: number = 0;
  private angle: number = 0;
  private speed: number = 0;

  public x: number = 0;
  public y: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    ownerType: number,
    angle: number,
    speed: number,
    projType: number = ProjectileType.EnemyBullet
  ) {
    this.x = x;
    this.y = y;
    this.serverX = x;
    this.serverY = y;
    this.angle = angle;
    this.speed = speed;

    this.graphics = scene.add.graphics();

    if (ownerType === EntityType.Enemy) {
      // Enemy bullets: red circle
      this.graphics.fillStyle(0xff4444, 1);
      this.graphics.fillCircle(0, 0, PROJECTILE_RADIUS);
    } else {
      switch (projType) {
        case ProjectileType.SwordSlash:
          // Wide white/gray arc shape for melee
          this.graphics.fillStyle(0xccccff, 0.8);
          this.graphics.fillEllipse(0, 0, 24, 8);
          break;
        case ProjectileType.QuiverShot:
          // Large cyan/blue circle with inner glow
          this.graphics.fillStyle(0x44aaff, 0.5);
          this.graphics.fillCircle(0, 0, 14);
          this.graphics.fillStyle(0x88ccff, 1);
          this.graphics.fillCircle(0, 0, 8);
          break;
        case ProjectileType.BowArrow:
        default:
          // Yellow elongated shape
          this.graphics.fillStyle(0xffff44, 1);
          this.graphics.fillEllipse(0, 0, 10, 4);
          break;
      }
    }

    this.graphics.setRotation(angle);
    this.graphics.setPosition(x, y);
  }

  updateFromServer(x: number, y: number): void {
    this.serverX = x;
    this.serverY = y;
    // Blend toward server position instead of snapping to avoid visible
    // backward jumps when client extrapolation overshoots slightly.
    this.x += (x - this.x) * 0.5;
    this.y += (y - this.y) * 0.5;
  }

  update(delta: number): void {
    // Client-side extrapolation: move projectile forward using known angle + speed
    // This provides smooth 60fps movement between 20Hz server ticks
    const dt = delta / 1000;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.graphics.setPosition(this.x, this.y);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
