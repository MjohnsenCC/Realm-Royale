import Phaser from "phaser";
import { ENEMY_DEFS, TILE_SIZE } from "@rotmg-lite/shared";
import { SnapshotBuffer } from "./SnapshotBuffer";
import { getEnemySpriteKey } from "../ui/EntityTextures";

interface DamageText {
  text: Phaser.GameObjects.Text;
  elapsed: number;
  startY: number;
}

const DAMAGE_TEXT_DURATION = 800;
const DAMAGE_TEXT_FLOAT = 30;

export class EnemySprite {
  private scene: Phaser.Scene;
  private bodyImage: Phaser.GameObjects.Image;
  private hpBarBg: Phaser.GameObjects.Image;
  private hpBarFill: Phaser.GameObjects.Image;

  private snapshots: SnapshotBuffer;
  private enemyType: number;
  private radius: number;
  private barWidth: number = 28;
  private barHeight: number = 3;
  private damageTexts: DamageText[] = [];
  private lastHp: number;
  private lastDrawnHp: number = -1;
  private lastDrawnMaxHp: number = -1;
  private pendingPredictedDamage: number = 0;
  private pendingPredictedDamageAge: number = 0;

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

    // Body — use loaded 8×8 sprite (scaled to tile size for uniform pixel scale)
    const textureKey = getEnemySpriteKey(enemyType);
    this.bodyImage = scene.add.image(x, y, textureKey);
    this.bodyImage.setDisplaySize(TILE_SIZE, TILE_SIZE);

    // HP bar — use shared pixel texture (tinted + scaled)
    const yOffset = this.radius + 6;
    this.hpBarBg = scene.add.image(x - this.barWidth / 2, y + yOffset, "pixel")
      .setOrigin(0, 0)
      .setDisplaySize(this.barWidth, this.barHeight)
      .setTint(0x333333)
      .setAlpha(0.8);

    const ratio = Math.max(0, hp / maxHp);
    this.hpBarFill = scene.add.image(x - this.barWidth / 2, y + yOffset, "pixel")
      .setOrigin(0, 0)
      .setDisplaySize(this.barWidth * ratio, this.barHeight)
      .setTint(0xcc3333);
  }

  public getEnemyType(): number {
    return this.enemyType;
  }

  private drawHpBar(hp: number, maxHp: number): void {
    if (hp === this.lastDrawnHp && maxHp === this.lastDrawnMaxHp) return;
    this.lastDrawnHp = hp;
    this.lastDrawnMaxHp = maxHp;

    const ratio = Math.max(0, hp / maxHp);
    this.hpBarFill.setDisplaySize(Math.max(0.1, this.barWidth * ratio), this.barHeight);
  }

  getRadius(): number {
    return this.radius;
  }

  showPredictedDamage(damage: number): void {
    const startY = -this.radius - 10;
    const text = this.scene.add.text(this.x, this.y + startY, `-${Math.round(damage)}`, {
      fontFamily: "monospace",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#ff0000",
    });
    text.setOrigin(0.5, 1);
    text.setDepth(1000);
    this.damageTexts.push({ text, elapsed: 0, startY });
    this.pendingPredictedDamage += damage;
    this.pendingPredictedDamageAge = 0;
  }

  updateFromServer(x: number, y: number, hp: number, maxHp: number): void {
    this.snapshots.push(x, y);

    if (hp < this.lastHp) {
      const serverDamage = this.lastHp - hp;

      if (this.pendingPredictedDamage > 0) {
        const remainder = serverDamage - this.pendingPredictedDamage;
        this.pendingPredictedDamage = Math.max(0, this.pendingPredictedDamage - serverDamage);
        this.pendingPredictedDamageAge = 0;

        if (remainder > 1) {
          const startY = -this.radius - 10;
          const text = this.scene.add.text(this.x, this.y + startY, `-${Math.round(remainder)}`, {
            fontFamily: "monospace",
            fontSize: "14px",
            fontStyle: "bold",
            color: "#ff0000",
          });
          text.setOrigin(0.5, 1);
          text.setDepth(1000);
          this.damageTexts.push({ text, elapsed: 0, startY });
        }
      } else {
        // No prediction pending — show normally
        const startY = -this.radius - 10;
        const text = this.scene.add.text(this.x, this.y + startY, `-${Math.round(serverDamage)}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ff0000",
        });
        text.setOrigin(0.5, 1);
        text.setDepth(1000);
        this.damageTexts.push({ text, elapsed: 0, startY });
      }
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

    this.bodyImage.setPosition(this.x, this.y);
    const yOffset = this.radius + 6;
    this.hpBarBg.setPosition(this.x - this.barWidth / 2, this.y + yOffset);
    this.hpBarFill.setPosition(this.x - this.barWidth / 2, this.y + yOffset);

    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dt = this.damageTexts[i];
      dt.elapsed += delta;
      const progress = Math.min(dt.elapsed / DAMAGE_TEXT_DURATION, 1);
      dt.text.setPosition(
        this.x,
        this.y + dt.startY - DAMAGE_TEXT_FLOAT * progress
      );
      dt.text.setAlpha(1 - progress);
      if (progress >= 1) {
        dt.text.destroy();
        this.damageTexts.splice(i, 1);
      }
    }

    // Decay stale predicted damage that was never confirmed by the server
    if (this.pendingPredictedDamage > 0) {
      this.pendingPredictedDamageAge += delta;
      if (this.pendingPredictedDamageAge > 1000) {
        this.pendingPredictedDamage = 0;
        this.pendingPredictedDamageAge = 0;
      }
    }

  }

  setVisible(visible: boolean): void {
    this.bodyImage.setVisible(visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
  }

  getSnapshotBuffer(): SnapshotBuffer {
    return this.snapshots;
  }

  destroy(): void {
    this.bodyImage.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    for (const dt of this.damageTexts) dt.text.destroy();
    this.damageTexts = [];
  }
}
