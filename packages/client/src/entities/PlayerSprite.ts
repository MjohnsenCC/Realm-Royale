import Phaser from "phaser";
import { PLAYER_RADIUS, PLAYER_MAX_HP, CHAT_BUBBLE_DURATION_MS, TILE_SIZE } from "@rotmg-lite/shared";
import { SnapshotBuffer } from "./SnapshotBuffer";
import { getPlayerSpriteKey } from "../ui/EntityTextures";

interface DamageText {
  text: Phaser.GameObjects.Text;
  elapsed: number;
  startY: number;
}

const DAMAGE_TEXT_DURATION = 800;
const DAMAGE_TEXT_FLOAT = 30;

export class PlayerSprite {
  private scene: Phaser.Scene;
  private bodyImage: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private hpBarBg: Phaser.GameObjects.Image;
  private hpBarFill: Phaser.GameObjects.Image;

  private serverX: number = 0;
  private serverY: number = 0;
  private _isLocal: boolean;
  private baseName: string;
  private snapshots: SnapshotBuffer;
  private hitFlashTimer: number = 0;
  private lastHp: number = PLAYER_MAX_HP;
  private lastDrawnHp: number = -1;
  private lastDrawnMaxHp: number = -1;
  private normalTextureKey: string;
  private currentTextureKey: string;
  private damageTexts: DamageText[] = [];
  private chatBubble: { text: Phaser.GameObjects.Text; elapsed: number } | null = null;

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
    isLocal: boolean,
    characterClass: number = 0
  ) {
    this.scene = scene;
    this._isLocal = isLocal;
    this.baseName = name;
    this.x = x;
    this.y = y;
    this.serverX = x;
    this.serverY = y;
    this.snapshots = new SnapshotBuffer();
    this.snapshots.push(x, y);

    // Body — use loaded 8×8 class sprite (scaled to tile size for uniform pixel scale)
    this.normalTextureKey = getPlayerSpriteKey(characterClass);
    this.currentTextureKey = this.normalTextureKey;
    this.bodyImage = scene.add.image(x, y, this.normalTextureKey);
    this.bodyImage.setDisplaySize(TILE_SIZE, TILE_SIZE);


    // Name label (hidden for local player)
    this.nameText = scene.add.text(x, y - PLAYER_RADIUS - 20, name, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: isLocal ? "#88aaff" : "#66cc66",
    });
    this.nameText.setOrigin(0.5, 0.5);
    if (isLocal) this.nameText.setVisible(false);

    // HP bar — use shared pixel texture (tinted + scaled)
    const barWidth = 36;
    const barHeight = 4;
    const yOffset = PLAYER_RADIUS + 8;
    this.hpBarBg = scene.add.image(x - barWidth / 2, y + yOffset, "pixel")
      .setOrigin(0, 0)
      .setDisplaySize(barWidth, barHeight)
      .setTint(0x333333)
      .setAlpha(0.8);

    this.hpBarFill = scene.add.image(x - barWidth / 2, y + yOffset, "pixel")
      .setOrigin(0, 0)
      .setDisplaySize(barWidth, barHeight)
      .setTint(0x44cc44);
  }

  private drawHpBar(hp: number, maxHp: number): void {
    if (hp === this.lastDrawnHp && maxHp === this.lastDrawnMaxHp) return;
    this.lastDrawnHp = hp;
    this.lastDrawnMaxHp = maxHp;

    const barWidth = 36;
    const barHeight = 4;
    const ratio = Math.max(0, hp / maxHp);
    const fillColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xcccc44 : 0xcc4444;
    this.hpBarFill.setDisplaySize(Math.max(0.1, barWidth * ratio), barHeight);
    this.hpBarFill.setTint(fillColor);
  }

  showChatMessage(msg: string): void {
    if (this.chatBubble) {
      this.chatBubble.text.destroy();
      this.chatBubble = null;
    }
    const dx = this._isLocal ? this.displayX : this.x;
    const dy = this._isLocal ? this.displayY : this.y;
    const text = this.scene.add.text(dx, dy - PLAYER_RADIUS - 38, msg, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#ffffff",
      wordWrap: { width: 150 },
      align: "center",
    });
    text.setOrigin(0.5, 1);
    text.setDepth(999);
    this.chatBubble = { text, elapsed: 0 };
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

  setLocalAimAngle(_angle: number): void {
    // No-op: pixel-art sprites should not rotate with aim direction
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

    this.bodyImage.setPosition(dx, dy);
    this.nameText.setPosition(dx, dy - PLAYER_RADIUS - 20);
    const barWidth = 36;
    const yOffset = PLAYER_RADIUS + 8;
    this.hpBarBg.setPosition(dx - barWidth / 2, dy + yOffset);
    this.hpBarFill.setPosition(dx - barWidth / 2, dy + yOffset);

    // Hit flash — tint white briefly
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.currentTextureKey !== "flash") {
        this.bodyImage.setTintFill(0xffffff);
        this.currentTextureKey = "flash";
      }
    } else {
      if (this.currentTextureKey !== this.normalTextureKey) {
        this.bodyImage.clearTint();
        this.currentTextureKey = this.normalTextureKey;
      }
    }

    // Animate chat bubble
    if (this.chatBubble) {
      this.chatBubble.elapsed += delta;
      this.chatBubble.text.setPosition(dx, dy - PLAYER_RADIUS - 38);
      const fadeStart = CHAT_BUBBLE_DURATION_MS - 1000;
      if (this.chatBubble.elapsed > fadeStart) {
        this.chatBubble.text.setAlpha(1 - (this.chatBubble.elapsed - fadeStart) / 1000);
      }
      if (this.chatBubble.elapsed >= CHAT_BUBBLE_DURATION_MS) {
        this.chatBubble.text.destroy();
        this.chatBubble = null;
      }
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

  setZone(zone: string): void {
    this.zone = zone;
  }

  updateLevel(level: number): void {
    if (this._isLocal) return;
    this.nameText.setText(`${this.baseName} Lv.${level}`);
  }

  setVisible(visible: boolean): void {
    this.bodyImage.setVisible(visible);
    this.nameText.setVisible(this._isLocal ? false : visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
  }

  getServerPosition(): { x: number; y: number } {
    return { x: this.serverX, y: this.serverY };
  }

  destroy(): void {
    this.bodyImage.destroy();
    this.nameText.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    if (this.chatBubble) {
      this.chatBubble.text.destroy();
    }
    for (const dt of this.damageTexts) dt.text.destroy();
    this.damageTexts = [];
  }
}
