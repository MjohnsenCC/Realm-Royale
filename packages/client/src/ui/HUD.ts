import Phaser from "phaser";
import { PlayerSprite } from "../entities/PlayerSprite";
import { EnemySprite } from "../entities/EnemySprite";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  NEXUS_WIDTH,
  NEXUS_HEIGHT,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  MAX_PLAYERS,
  ENEMY_SYNC_RADIUS,
  getBiomeAtPosition,
  BIOME_VISUALS,
  xpForLevel,
} from "@rotmg-lite/shared";

export class HUD {
  private scene: Phaser.Scene;

  // Health bar
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;

  // Level & XP
  private levelText: Phaser.GameObjects.Text;

  // Zone/Biome display
  private zoneText: Phaser.GameObjects.Text;

  // Player count
  private playerCountText: Phaser.GameObjects.Text;

  // Q hint
  private qHintText: Phaser.GameObjects.Text;

  // Minimap
  private minimapBg: Phaser.GameObjects.Graphics;
  private minimapBiomeGraphics: Phaser.GameObjects.Graphics;
  private minimapBiomeCached: boolean = false;
  private minimapDots: Phaser.GameObjects.Graphics;


  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Health bar (top-left)
    this.hpBarBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.hpBarFill = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.hpText = scene.add
      .text(20, 12, "100 / 100", {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(102);

    // Level & XP display (below health bar)
    this.levelText = scene.add
      .text(20, 40, "Lv 1 | XP: 0 (0%)", {
        fontSize: "14px",
        color: "#aaffaa",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(100);

    // Zone/Biome display (top-center)
    this.zoneText = scene.add
      .text(scene.scale.width / 2, 15, "Nexus (Safe Zone)", {
        fontSize: "18px",
        color: "#44aa66",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Player count (top-right)
    this.playerCountText = scene.add
      .text(scene.scale.width - 20, 15, `Players: 0/${MAX_PLAYERS}`, {
        fontSize: "14px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Q hint (below zone text, only shown in hostile)
    this.qHintText = scene.add
      .text(scene.scale.width / 2, 38, "Q: Return to Nexus", {
        fontSize: "11px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // Minimap (bottom-right)
    this.minimapBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapBiomeGraphics = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapDots = scene.add.graphics().setScrollFactor(0).setDepth(101);

    this.drawHealthBar(100, 100);
  }

  private drawHealthBar(hp: number, maxHp: number): void {
    const barWidth = 160;
    const barHeight = 16;
    const x = 16;
    const y = 16;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333, 0.8);
    this.hpBarBg.fillRect(x, y, barWidth, barHeight);
    this.hpBarBg.lineStyle(1, 0x666666, 1);
    this.hpBarBg.strokeRect(x, y, barWidth, barHeight);

    this.hpBarFill.clear();
    const ratio = Math.max(0, hp / maxHp);
    const fillColor =
      ratio > 0.5 ? 0xcc3333 : ratio > 0.25 ? 0xcc6633 : 0xcc2222;
    this.hpBarFill.fillStyle(fillColor, 1);
    this.hpBarFill.fillRect(
      x + 1,
      y + 1,
      (barWidth - 2) * ratio,
      barHeight - 2
    );

    this.hpText.setText(`${Math.ceil(hp)} / ${maxHp}`);
    this.hpText.setPosition(x + barWidth / 2, y + 2);
    this.hpText.setOrigin(0.5, 0);
  }

  update(
    hp: number,
    maxHp: number,
    xp: number,
    level: number,
    playerCount: number,
    localX: number,
    localY: number,
    players: Map<string, PlayerSprite>,
    enemies: Map<string, EnemySprite>,
    zone: string
  ): void {
    this.drawHealthBar(hp, maxHp);

    // Level & XP progress display
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(Math.min(level + 1, 100));
    const xpNeeded = nextLevelXp - currentLevelXp;
    const xpProgress = xpNeeded > 0 ? Math.floor(((xp - currentLevelXp) / xpNeeded) * 100) : 100;
    this.levelText.setText(`Lv ${level} | XP: ${xp} (${xpProgress}%)`);

    if (zone === "nexus") {
      this.zoneText.setText("Nexus (Safe Zone)");
      this.zoneText.setColor("#44aa66");
      this.qHintText.setVisible(false);
    } else {
      // Show current biome name
      const biome = getBiomeAtPosition(localX, localY);
      const visual = BIOME_VISUALS[biome];
      const biomeName = visual ? visual.name : "Unknown";
      this.zoneText.setText(biomeName);
      this.zoneText.setColor("#e94560");
      this.qHintText.setVisible(true);
    }
    this.zoneText.setX(this.scene.scale.width / 2);
    this.qHintText.setX(this.scene.scale.width / 2);
    this.playerCountText.setText(`Players: ${playerCount}/${MAX_PLAYERS}`);
    this.playerCountText.setX(this.scene.scale.width - 20);

    // Draw minimap
    this.drawMinimap(localX, localY, players, enemies, zone);
  }

  private drawMinimap(
    localX: number,
    localY: number,
    players: Map<string, PlayerSprite>,
    enemies: Map<string, EnemySprite>,
    zone: string
  ): void {
    const mapW = zone === "nexus" ? NEXUS_WIDTH : ARENA_WIDTH;
    const mapH = zone === "nexus" ? NEXUS_HEIGHT : ARENA_HEIGHT;
    const scaleX = MINIMAP_WIDTH / mapW;
    const scaleY = MINIMAP_HEIGHT / mapH;
    const mmX = this.scene.scale.width - MINIMAP_WIDTH - 16;
    const mmY = this.scene.scale.height - MINIMAP_HEIGHT - 16;

    // Background
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x111122, 0.7);
    this.minimapBg.fillRect(mmX, mmY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    this.minimapBg.lineStyle(1, 0x444466, 1);
    this.minimapBg.strokeRect(mmX, mmY, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw noise-based biome colors on minimap (hostile zone only, cached)
    if (zone !== "nexus" && !this.minimapBiomeCached) {
      this.renderMinimapBiomes(mmX, mmY);
      this.minimapBiomeCached = true;
    }
    // Hide biome overlay in nexus
    this.minimapBiomeGraphics.setVisible(zone !== "nexus");

    // Dots
    this.minimapDots.clear();

    // Enemy dots (red) — only show enemies within sync radius of local player
    this.minimapDots.fillStyle(0xcc3333, 0.8);
    const syncRadiusSq = ENEMY_SYNC_RADIUS * ENEMY_SYNC_RADIUS;
    enemies.forEach((enemy) => {
      const ex = enemy.x - localX;
      const ey = enemy.y - localY;
      if (ex * ex + ey * ey > syncRadiusSq) return;
      const dx = mmX + enemy.x * scaleX;
      const dy = mmY + enemy.y * scaleY;
      this.minimapDots.fillRect(dx - 1, dy - 1, 3, 3);
    });

    // Player dots (blue/green)
    players.forEach((player) => {
      const isLocal =
        Math.abs(player.x - localX) < 5 && Math.abs(player.y - localY) < 5;
      this.minimapDots.fillStyle(isLocal ? 0xffffff : 0x4488ff, 1);
      const dx = mmX + player.x * scaleX;
      const dy = mmY + player.y * scaleY;
      this.minimapDots.fillCircle(dx, dy, isLocal ? 3 : 2);
    });

    // Camera viewport rectangle
    const cam = this.scene.cameras.main;
    const vpX = mmX + cam.scrollX * scaleX;
    const vpY = mmY + cam.scrollY * scaleY;
    const vpW = cam.width * scaleX;
    const vpH = cam.height * scaleY;
    this.minimapDots.lineStyle(1, 0xffffff, 0.4);
    this.minimapDots.strokeRect(vpX, vpY, vpW, vpH);
  }

  private renderMinimapBiomes(mmX: number, mmY: number): void {
    const step = 3; // Sample every 3 minimap pixels (50x50 = 2500 samples)
    for (let mx = 0; mx < MINIMAP_WIDTH; mx += step) {
      for (let my = 0; my < MINIMAP_HEIGHT; my += step) {
        const worldX = (mx / MINIMAP_WIDTH) * ARENA_WIDTH;
        const worldY = (my / MINIMAP_HEIGHT) * ARENA_HEIGHT;
        const biome = getBiomeAtPosition(worldX, worldY);
        const visual = BIOME_VISUALS[biome];
        if (visual) {
          this.minimapBiomeGraphics.fillStyle(visual.groundFill, 0.8);
          this.minimapBiomeGraphics.fillRect(mmX + mx, mmY + my, step, step);
        }
      }
    }
  }

  // Death screen elements
  private deathOverlay: Phaser.GameObjects.Graphics | null = null;
  private deathText: Phaser.GameObjects.Text | null = null;
  private deathButton: Phaser.GameObjects.Text | null = null;

  showDeathScreen(onRespawn: () => void): void {
    this.hideDeathScreen();
    const { width, height } = this.scene.scale;

    // Semi-transparent dark overlay
    this.deathOverlay = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(200);
    this.deathOverlay.fillStyle(0x000000, 0.5);
    this.deathOverlay.fillRect(0, 0, width, height);

    // "YOU DIED!" text
    this.deathText = this.scene.add
      .text(width / 2, height / 2 - 40, "YOU DIED!", {
        fontSize: "48px",
        color: "#e94560",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    // "Start Over" button
    this.deathButton = this.scene.add
      .text(width / 2, height / 2 + 30, "[ Start Over ]", {
        fontSize: "22px",
        color: "#ffffff",
        fontFamily: "monospace",
        backgroundColor: "#333333",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setInteractive({ useHandCursor: true });

    this.deathButton.on("pointerover", () => {
      this.deathButton?.setColor("#44ffaa");
    });
    this.deathButton.on("pointerout", () => {
      this.deathButton?.setColor("#ffffff");
    });
    this.deathButton.on("pointerdown", () => {
      this.hideDeathScreen();
      onRespawn();
    });
  }

  hideDeathScreen(): void {
    this.deathOverlay?.destroy();
    this.deathText?.destroy();
    this.deathButton?.destroy();
    this.deathOverlay = null;
    this.deathText = null;
    this.deathButton = null;
  }

  showXpGain(x: number, y: number, amount: number): void {
    const text = this.scene.add
      .text(x, y - 20, `+${amount} XP`, {
        fontSize: "14px",
        color: "#44ffaa",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(150);

    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 1200,
      ease: "Power2",
      onComplete: () => text.destroy(),
    });
  }

  showLevelUp(x: number, y: number, level: number): void {
    // "LEVEL UP!" text
    const text = this.scene.add
      .text(x, y - 30, `LEVEL ${level}!`, {
        fontSize: "18px",
        color: "#ffdd44",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(150);

    this.scene.tweens.add({
      targets: text,
      y: y - 70,
      alpha: 0,
      duration: 2000,
      ease: "Power1",
      onComplete: () => text.destroy(),
    });

    // Expanding ring effect
    const ring = this.scene.add.graphics().setDepth(149);
    let radius = 10;
    let alpha = 1;
    const expandTimer = this.scene.time.addEvent({
      delay: 16,
      repeat: 30,
      callback: () => {
        ring.clear();
        radius += 3;
        alpha -= 0.032;
        if (alpha <= 0) {
          ring.destroy();
          expandTimer.destroy();
          return;
        }
        ring.lineStyle(2, 0xffdd44, alpha);
        ring.strokeCircle(x, y, radius);
      },
    });
  }
}
