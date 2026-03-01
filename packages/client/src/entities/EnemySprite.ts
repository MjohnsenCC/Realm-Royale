import Phaser from "phaser";
import { ENEMY_DEFS } from "@rotmg-lite/shared";
import { SnapshotBuffer } from "./SnapshotBuffer";

export class EnemySprite {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;

  private snapshots: SnapshotBuffer;
  private enemyType: number;
  private radius: number;
  private hitFlashTimer: number = 0;
  private lastHp: number;

  public x: number = 0;
  public y: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    enemyType: number,
    hp: number,
    maxHp: number,
    existingBuffer?: SnapshotBuffer
  ) {
    this.scene = scene;
    this.enemyType = enemyType;
    const def = ENEMY_DEFS[enemyType];
    this.radius = def ? def.radius : 14;
    this.x = x;
    this.y = y;
    this.lastHp = hp;
    this.snapshots = existingBuffer ?? new SnapshotBuffer();
    this.snapshots.push(x, y);

    this.graphics = scene.add.graphics();
    this.drawBody();

    this.hpBarBg = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();
    this.drawHpBar(hp, maxHp);
  }

  private getColor(): number {
    if (this.hitFlashTimer > 0) return 0xffffff;
    const def = ENEMY_DEFS[this.enemyType];
    return def ? def.color : 0xcc3333;
  }

  private drawBody(): void {
    this.graphics.clear();
    const color = this.getColor();
    const def = ENEMY_DEFS[this.enemyType];
    const shape = def ? def.shape : "circle";
    const r = this.radius;

    this.graphics.fillStyle(color, 1);

    switch (shape) {
      case "circle":
        this.graphics.fillCircle(0, 0, r);
        break;
      case "diamond":
        this.graphics.fillPoints(
          [
            new Phaser.Geom.Point(0, -r),
            new Phaser.Geom.Point(r, 0),
            new Phaser.Geom.Point(0, r),
            new Phaser.Geom.Point(-r, 0),
          ],
          true
        );
        break;
      case "triangle":
        this.graphics.fillPoints(
          [
            new Phaser.Geom.Point(0, -r),
            new Phaser.Geom.Point(r, r * 0.7),
            new Phaser.Geom.Point(-r, r * 0.7),
          ],
          true
        );
        break;
      case "square":
        this.graphics.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        break;
      case "hexagon": {
        const pts: Phaser.Geom.Point[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          pts.push(
            new Phaser.Geom.Point(
              Math.cos(angle) * r,
              Math.sin(angle) * r
            )
          );
        }
        this.graphics.fillPoints(pts, true);
        break;
      }
      case "star": {
        const pts: Phaser.Geom.Point[] = [];
        for (let i = 0; i < 5; i++) {
          const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          pts.push(
            new Phaser.Geom.Point(
              Math.cos(outerAngle) * r,
              Math.sin(outerAngle) * r
            )
          );
          const innerAngle = outerAngle + Math.PI / 5;
          pts.push(
            new Phaser.Geom.Point(
              Math.cos(innerAngle) * r * 0.45,
              Math.sin(innerAngle) * r * 0.45
            )
          );
        }
        this.graphics.fillPoints(pts, true);
        break;
      }
      default:
        this.graphics.fillCircle(0, 0, r);
        break;
    }
  }

  private drawHpBar(hp: number, maxHp: number): void {
    const barWidth = 28;
    const barHeight = 3;
    const xOffset = -barWidth / 2;
    const yOffset = this.radius + 6;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333, 0.8);
    this.hpBarBg.fillRect(xOffset, yOffset, barWidth, barHeight);

    this.hpBarFill.clear();
    const ratio = Math.max(0, hp / maxHp);
    this.hpBarFill.fillStyle(0xcc3333, 1);
    this.hpBarFill.fillRect(xOffset, yOffset, barWidth * ratio, barHeight);
  }

  updateFromServer(x: number, y: number, hp: number, maxHp: number): void {
    this.snapshots.push(x, y);

    if (hp < this.lastHp) {
      this.hitFlashTimer = 120;
    }
    this.lastHp = hp;

    this.drawHpBar(hp, maxHp);
  }

  update(delta: number): void {
    const pos = this.snapshots.getInterpolatedPosition();
    if (pos) {
      this.x = pos.x;
      this.y = pos.y;
    }

    this.graphics.setPosition(this.x, this.y);
    this.hpBarBg.setPosition(this.x, this.y);
    this.hpBarFill.setPosition(this.x, this.y);

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
    }
    this.drawBody();
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
  }

  getSnapshotBuffer(): SnapshotBuffer {
    return this.snapshots;
  }

  destroy(): void {
    this.graphics.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
  }
}
