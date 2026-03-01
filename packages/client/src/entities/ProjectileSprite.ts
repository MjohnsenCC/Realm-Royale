import Phaser from "phaser";
import { EntityType, PROJECTILE_RADIUS } from "@rotmg-lite/shared";

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
    speed: number
  ) {
    this.x = x;
    this.y = y;
    this.serverX = x;
    this.serverY = y;
    this.angle = angle;
    this.speed = speed;

    const color = ownerType === EntityType.Player ? 0xffff44 : 0xff4444;

    this.graphics = scene.add.graphics();
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(0, 0, PROJECTILE_RADIUS);
    this.graphics.setPosition(x, y);
  }

  updateFromServer(x: number, y: number): void {
    // Snap to server position to stay accurate for hit detection
    this.serverX = x;
    this.serverY = y;
    this.x = x;
    this.y = y;
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
