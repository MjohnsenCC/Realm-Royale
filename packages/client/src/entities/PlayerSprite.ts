import Phaser from "phaser";
import { PLAYER_RADIUS, PLAYER_MAX_HP } from "@rotmg-lite/shared";
import { SnapshotBuffer } from "./SnapshotBuffer";

interface DamageText {
  text: Phaser.GameObjects.Text;
  elapsed: number;
  startY: number;
}

const DAMAGE_TEXT_DURATION = 800;
const DAMAGE_TEXT_FLOAT = 30;

export class PlayerSprite {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;

  private serverX: number = 0;
  private serverY: number = 0;
  private _isLocal: boolean;
  private snapshots: SnapshotBuffer;
  private hitFlashTimer: number = 0;
  private lastHp: number = PLAYER_MAX_HP;
  private damageTexts: DamageText[] = [];

  // True predicted/reconciled position (used by prediction, reconciliation, aim)
  public x: number = 0;
  public y: number = 0;
  public zone: string = "nexus";

  // Visual correction offset — absorbs reconciliation snaps, decays to 0
  private corrOffsetX: number = 0;
  private corrOffsetY: number = 0;

  get isLocal(): boolean {
    return this._isLocal;
  }

  // Display position = true position + correction offset (smooth)
  get displayX(): number {
    return Math.round(this.x + this.corrOffsetX);
  }
  get displayY(): number {
    return Math.round(this.y + this.corrOffsetY);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    isLocal: boolean
  ) {
    this.scene = scene;
    this._isLocal = isLocal;
    this.x = x;
    this.y = y;
    this.serverX = x;
    this.serverY = y;
    this.snapshots = new SnapshotBuffer();
    this.snapshots.push(x, y);

    // Player body circle
    this.graphics = scene.add.graphics();
    this.drawBody(isLocal ? 0x4488ff : 0x44cc44);

    // Name text
    this.nameText = scene.add
      .text(x, y - PLAYER_RADIUS - 20, name, {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // HP bar background
    this.hpBarBg = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();
    this.drawHpBar(PLAYER_MAX_HP, PLAYER_MAX_HP);
  }

  private drawBody(color: number): void {
    this.graphics.clear();
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(0, 0, PLAYER_RADIUS);

    // Aim direction indicator (small triangle)
    this.graphics.fillStyle(0xffffff, 0.8);
    this.graphics.fillTriangle(
      PLAYER_RADIUS - 2, -4,
      PLAYER_RADIUS - 2, 4,
      PLAYER_RADIUS + 6, 0
    );
  }

  private drawHpBar(hp: number, maxHp: number): void {
    const barWidth = 36;
    const barHeight = 4;
    const xOffset = -barWidth / 2;
    const yOffset = PLAYER_RADIUS + 8; // Below the player

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333, 0.8);
    this.hpBarBg.fillRect(xOffset, yOffset, barWidth, barHeight);

    this.hpBarFill.clear();
    const ratio = Math.max(0, hp / maxHp);
    const fillColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xcccc44 : 0xcc4444;
    this.hpBarFill.fillStyle(fillColor, 1);
    this.hpBarFill.fillRect(xOffset, yOffset, barWidth * ratio, barHeight);
  }

  showDamage(amount: number, isMagic: boolean): void {
    const dx = this._isLocal ? this.displayX : this.x;
    const dy = this._isLocal ? this.displayY : this.y;
    const startY = -PLAYER_RADIUS - 30;
    const color = isMagic ? "#4488ff" : "#ff4444";
    const text = this.scene.add.text(dx, dy + startY, `-${Math.round(amount)}`, {
      fontFamily: "monospace",
      fontSize: "14px",
      fontStyle: "bold",
      color: color,
    });
    text.setOrigin(0.5, 1);
    text.setDepth(1000);
    this.damageTexts.push({ text, elapsed: 0, startY });
  }

  updateFromServer(
    x: number,
    y: number,
    aimAngle: number,
    hp: number,
    maxHp: number
  ): void {
    this.serverX = x;
    this.serverY = y;
    if (!this._isLocal) {
      this.snapshots.push(x, y);
    }

    // Hit flash detection
    if (hp < this.lastHp) {
      this.hitFlashTimer = 150; // ms
    }
    this.lastHp = hp;

    // Rotate aim indicator
    this.graphics.setRotation(aimAngle);

    // Update HP bar
    this.drawHpBar(hp, maxHp);
  }

  update(delta: number): void {
    if (this._isLocal) {
      // Decay correction offset toward zero.
      // Uses exponential decay: ~90% absorbed within 100ms at 60fps.
      const decay = 1 - Math.exp(-25 * (delta / 1000));
      this.corrOffsetX -= this.corrOffsetX * decay;
      this.corrOffsetY -= this.corrOffsetY * decay;
      if (Math.abs(this.corrOffsetX) < 0.1) this.corrOffsetX = 0;
      if (Math.abs(this.corrOffsetY) < 0.1) this.corrOffsetY = 0;
    } else {
      // Remote player: use snapshot interpolation for smooth movement
      const pos = this.snapshots.getInterpolatedPosition();
      if (pos) {
        this.x = pos.x;
        this.y = pos.y;
      } else {
        // Fallback to lerp if buffer not ready yet (first frames after join)
        this.x += (this.serverX - this.x) * 0.2;
        this.y += (this.serverY - this.y) * 0.2;
      }
    }

    // Use display position (with correction offset) for all visuals
    const dx = this._isLocal ? this.displayX : this.x;
    const dy = this._isLocal ? this.displayY : this.y;

    this.graphics.setPosition(dx, dy);
    this.nameText.setPosition(dx, dy - PLAYER_RADIUS - 20);
    this.hpBarBg.setPosition(dx, dy);
    this.hpBarFill.setPosition(dx, dy);

    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      this.drawBody(0xffffff);
    } else {
      this.drawBody(this._isLocal ? 0x4488ff : 0x44cc44);
    }

    // Animate floating damage texts
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dt = this.damageTexts[i];
      dt.elapsed += delta;
      const progress = Math.min(dt.elapsed / DAMAGE_TEXT_DURATION, 1);
      dt.text.setPosition(dx, dy + dt.startY - DAMAGE_TEXT_FLOAT * progress);
      dt.text.setAlpha(1 - progress);
      if (progress >= 1) {
        dt.text.destroy();
        this.damageTexts.splice(i, 1);
      }
    }
  }

  // For client-side prediction: set position directly (instant, no smoothing)
  setLocalPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  // For reconciliation: absorb the correction into visual offset, then snap true position
  applyCorrectedPosition(x: number, y: number): void {
    this.corrOffsetX += this.x - x;
    this.corrOffsetY += this.y - y;
    this.x = x;
    this.y = y;
  }

  // Snap everything instantly (zone changes, spawn, large desync)
  teleportTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.corrOffsetX = 0;
    this.corrOffsetY = 0;
  }

  // For local player: set aim rotation instantly without waiting for server round trip
  setLocalAimAngle(angle: number): void {
    this.graphics.setRotation(angle);
  }

  setZone(zone: string): void {
    this.zone = zone;
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    this.nameText.setVisible(visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
  }

  getServerPosition(): { x: number; y: number } {
    return { x: this.serverX, y: this.serverY };
  }

  destroy(): void {
    this.graphics.destroy();
    this.nameText.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    for (const dt of this.damageTexts) dt.text.destroy();
    this.damageTexts.length = 0;
  }
}
