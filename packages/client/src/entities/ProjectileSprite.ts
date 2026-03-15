import Phaser from "phaser";
import { EntityType, ProjectileType, PIXEL_SCALE } from "@rotmg-lite/shared";

export class ProjectileSprite {
  private bodyImage: Phaser.GameObjects.Image;
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
    projType: number = ProjectileType.EnemyBullet,
    projColor: number = 0,
    projSpriteIndex: number = 0
  ) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;

    let textureKey: string;

    if (ownerType === EntityType.Enemy) {
      textureKey = `proj-enemy-${projSpriteIndex}`;
    } else {
      switch (projType) {
        case ProjectileType.BowArrow:
          textureKey = "proj-archer-attack";
          break;
        case ProjectileType.SwordSlash:
          textureKey = "proj-warrior-attack";
          break;
        case ProjectileType.WandBolt:
          textureKey = "proj-arcanist-attack";
          break;
        case ProjectileType.QuiverShot:
          textureKey = "proj-archer-ability";
          break;
        case ProjectileType.HelmSpin:
          textureKey = "proj-warrior-ability";
          break;
        case ProjectileType.RelicExpand:
          textureKey = "proj-arcanist-ability";
          break;
        default:
          textureKey = "proj-archer-attack";
          break;
      }
    }

    this.bodyImage = scene.add.image(x, y, textureKey);
    const spriteCanvas = 8; // projectile sprites are 8×8
    this.bodyImage.setDisplaySize(spriteCanvas * PIXEL_SCALE, spriteCanvas * PIXEL_SCALE);
    this.bodyImage.setRotation(angle);

    // All projectiles render above trees (trunk depth 5, canopy depth 10)
    this.bodyImage.setDepth(11);
  }

  updateFromServer(x: number, y: number): void {
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
    this.bodyImage.setPosition(this.x, this.y);
  }

  setVisible(visible: boolean): void {
    this.bodyImage.setVisible(visible);
  }

  destroy(): void {
    this.bodyImage.destroy();
  }
}
