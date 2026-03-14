import Phaser from "phaser";
import { EntityType, ProjectileType, PROJECTILE_RADIUS, lightenColor } from "@rotmg-lite/shared";

export class ProjectileSprite {
  private graphics: Phaser.GameObjects.Graphics;
  private serverX: number = 0;
  private serverY: number = 0;
  private angle: number = 0;
  private speed: number = 0;
  private isExpandingAoe: boolean = false;
  private expandElapsed: number = 0;
  private expandSpeed: number = 0;

  public x: number = 0;
  public y: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    ownerType: number,
    angle: number,
    speed: number,
    projType: number = ProjectileType.EnemyBullet,
    projColor: number = 0
  ) {
    this.x = x;
    this.y = y;
    this.serverX = x;
    this.serverY = y;
    this.angle = angle;
    this.speed = speed;

    this.graphics = scene.add.graphics();

    // Player projectiles render below the player sprite
    if (ownerType !== EntityType.Enemy) {
      this.graphics.setDepth(-0.25);
    }

    if (ownerType === EntityType.Enemy) {
      // Enemy bullets: red circle
      this.graphics.fillStyle(0xff4444, 1);
      this.graphics.fillCircle(0, 0, PROJECTILE_RADIUS);
    } else {
      switch (projType) {
        case ProjectileType.SwordSlash:
          // Wide arc shape for melee
          this.graphics.fillStyle(projColor || 0xccccff, 0.8);
          this.graphics.fillEllipse(0, 0, 24, 8);
          break;
        case ProjectileType.QuiverShot:
          // Large cyan/blue circle with inner glow
          this.graphics.fillStyle(0x44aaff, 0.5);
          this.graphics.fillCircle(0, 0, 14);
          this.graphics.fillStyle(0x88ccff, 1);
          this.graphics.fillCircle(0, 0, 8);
          break;
        case ProjectileType.HelmSpin:
          // Orange/red circular slash for Helm AoE
          this.graphics.fillStyle(0xff6622, 0.6);
          this.graphics.fillCircle(0, 0, 12);
          this.graphics.fillStyle(0xffaa44, 1);
          this.graphics.fillEllipse(0, 0, 20, 8);
          break;
        case ProjectileType.WandBolt: {
          // Elongated bolt with inner glow
          const wOuter = projColor || 0xaa44ff;
          const wInner = projColor ? lightenColor(projColor, 0.4) : 0xcc88ff;
          this.graphics.fillStyle(wOuter, 0.7);
          this.graphics.fillEllipse(0, 0, 14, 5);
          this.graphics.fillStyle(wInner, 1);
          this.graphics.fillEllipse(0, 0, 8, 3);
          break;
        }
        case ProjectileType.RelicExpand:
          // Expanding AoE circle — initial state
          this.isExpandingAoe = true;
          this.expandSpeed = speed;
          this.graphics.fillStyle(0x8844ff, 0.3);
          this.graphics.fillCircle(0, 0, 15);
          this.graphics.lineStyle(2, 0xaa66ff, 0.6);
          this.graphics.strokeCircle(0, 0, 15);
          break;
        case ProjectileType.BowArrow:
        default:
          // Elongated arrow shape
          this.graphics.fillStyle(projColor || 0xffff44, 1);
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
    if (this.isExpandingAoe) {
      // Expanding AoE: grow circle each frame, position stays fixed
      this.expandElapsed += delta / 1000;
      const currentRadius = 15 + this.expandSpeed * this.expandElapsed;
      this.graphics.clear();
      const alpha = Math.max(0.05, 0.3 - (currentRadius / 300) * 0.25);
      this.graphics.fillStyle(0x8844ff, alpha);
      this.graphics.fillCircle(0, 0, currentRadius);
      this.graphics.lineStyle(2, 0xaa66ff, Math.max(0.1, 0.6 - (currentRadius / 300) * 0.5));
      this.graphics.strokeCircle(0, 0, currentRadius);
      this.graphics.setPosition(this.x, this.y);
      return;
    }
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
