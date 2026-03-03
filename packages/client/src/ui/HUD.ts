import Phaser from "phaser";
import { PlayerSprite } from "../entities/PlayerSprite";
import { EnemySprite } from "../entities/EnemySprite";
import { InventoryUI } from "./InventoryUI";
import { LootBagUI } from "./LootBagUI";
import { getUIScale } from "./UIScale";
import {
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  MAX_PLAYERS,
  ENEMY_SYNC_RADIUS,
  getZoneDimensions,
  isDungeonZone,
  DUNGEON_VISUALS,
  REALM_BIOME_VISUALS,
  DIFFICULTY_ZONE_NAMES,
  ZONE_TO_DUNGEON,
  xpForLevel,
  getRealmMap,
  getDifficultyAt,
  computePlayerStats,
} from "@rotmg-lite/shared";

export class HUD {
  private scene: Phaser.Scene;

  // Scale factor
  private S: number;

  // Scaled dimensions
  private barWidth: number;
  private barHeight: number;
  private barGap: number;
  private mmWidth: number;
  private mmHeight: number;

  // Unified panel dimensions
  private panelX: number;
  private panelY: number;
  private panelW: number;
  private panelH: number;

  // Unified panel background
  private panelBg: Phaser.GameObjects.Graphics;

  // Health bar
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;

  // Mana bar
  private manaBarBg: Phaser.GameObjects.Graphics;
  private manaBarFill: Phaser.GameObjects.Graphics;
  private manaText: Phaser.GameObjects.Text;

  // Level/XP bar
  private lvlBarBg: Phaser.GameObjects.Graphics;
  private lvlBarFill: Phaser.GameObjects.Graphics;
  private lvlText: Phaser.GameObjects.Text;

  // Zone/Biome display
  private zoneText: Phaser.GameObjects.Text;

  // Player count
  private playerCountText: Phaser.GameObjects.Text;

  // Q hint
  private qHintText: Phaser.GameObjects.Text;

  // Placeholder icon buttons
  private iconBtnGraphics: Phaser.GameObjects.Graphics;

  // Minimap
  private minimapBg: Phaser.GameObjects.Graphics;
  private minimapBiomeGraphics: Phaser.GameObjects.Graphics;
  private minimapBiomeCached: boolean = false;
  private minimapDots: Phaser.GameObjects.Graphics;

  // Inventory & Loot Bag UI
  inventoryUI: InventoryUI;
  lootBagUI: LootBagUI;

  // Section origins (stored for bar drawing)
  private barsX: number;
  private barsY: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.S = getUIScale();
    const S = this.S;

    // Scaled bar dimensions
    this.barWidth = Math.round(160 * S);
    this.barHeight = Math.round(16 * S);
    this.barGap = Math.round(3 * S);
    this.mmWidth = Math.round(MINIMAP_WIDTH * S * 1.25);
    this.mmHeight = Math.round(MINIMAP_HEIGHT * S * 1.25);

    // Slot dimensions
    const slotSize = Math.round(36 * S);
    const slotGap = Math.round(4 * S);
    const sectionGap = Math.round(12 * S);
    const innerPad = Math.round(8 * S);
    const iconBtnSize = Math.round(16 * S);
    const iconGap = Math.round(4 * S);

    // Section dimensions
    const barsW = this.barWidth;
    const barsH = 3 * this.barHeight + 2 * this.barGap;

    const eqW = 4 * slotSize + 3 * slotGap;
    const eqSectionH = slotSize + iconGap + iconBtnSize;

    const invW = 4 * slotSize + 3 * slotGap;
    const invH = 2 * slotSize + slotGap;

    const maxH = Math.max(barsH, eqSectionH, invH);

    // Unified panel
    this.panelW = innerPad + barsW + sectionGap + eqW + sectionGap + invW + innerPad;
    this.panelH = innerPad + maxH + innerPad;
    const screenW = scene.scale.width;
    const screenH = scene.scale.height;
    this.panelX = Math.round(screenW / 2 - this.panelW / 2);
    this.panelY = Math.round(screenH - this.panelH - Math.round(12 * S));

    // Section origins
    this.barsX = this.panelX + innerPad;
    this.barsY = this.panelY + innerPad + Math.round((maxH - barsH) / 2);

    const eqX = this.barsX + barsW + sectionGap;
    const eqY = this.panelY + innerPad;

    const invX = eqX + eqW + sectionGap;
    const invY = this.panelY + innerPad;

    const barFontSize = `${Math.round(11 * S)}px`;
    const zoneFontSize = `${Math.round(18 * S)}px`;
    const countFontSize = `${Math.round(14 * S)}px`;
    const hintFontSize = `${Math.round(11 * S)}px`;

    // --- Unified panel background ---
    this.panelBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.panelBg.fillStyle(0x222222, 0.85);
    this.panelBg.fillRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 6);
    this.panelBg.lineStyle(1, 0x555555, 0.8);
    this.panelBg.strokeRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 6);

    // --- Health bar ---
    this.hpBarBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.hpBarFill = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.hpText = scene.add
      .text(0, 0, "", {
        fontSize: barFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(102);

    // --- Mana bar ---
    this.manaBarBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.manaBarFill = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.manaText = scene.add
      .text(0, 0, "", {
        fontSize: barFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(102);

    // --- Level/XP bar ---
    this.lvlBarBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.lvlBarFill = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.lvlText = scene.add
      .text(0, 0, "", {
        fontSize: barFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(102);

    // --- Zone/Biome display (top-center) ---
    this.zoneText = scene.add
      .text(screenW / 2, 15, "Nexus (Safe Zone)", {
        fontSize: zoneFontSize,
        color: "#44aa66",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // --- Player count (below minimap) ---
    const mmPad = Math.round(16 * S);
    const mmBottomY = mmPad + this.mmHeight + Math.round(4 * S);
    this.playerCountText = scene.add
      .text(screenW - mmPad - this.mmWidth / 2, mmBottomY, `Players: 0/${MAX_PLAYERS}`, {
        fontSize: countFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // --- Q hint (below zone text) ---
    const hintY = 15 + Math.round(23 * S);
    this.qHintText = scene.add
      .text(screenW / 2, hintY, "Q: Return to Nexus  |  SPACE: Ability  |  E: Use Portal", {
        fontSize: hintFontSize,
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // --- Placeholder icon buttons (below equipment slots) ---
    this.iconBtnGraphics = scene.add.graphics().setScrollFactor(0).setDepth(101);
    const iconRowW = 3 * iconBtnSize + 2 * iconGap;
    const iconRowX = eqX + Math.round((eqW - iconRowW) / 2);
    const iconRowY = eqY + slotSize + iconGap;
    for (let i = 0; i < 3; i++) {
      const ix = iconRowX + i * (iconBtnSize + iconGap);
      this.iconBtnGraphics.fillStyle(0x333344, 0.7);
      this.iconBtnGraphics.fillRect(ix, iconRowY, iconBtnSize, iconBtnSize);
      this.iconBtnGraphics.lineStyle(1, 0x555566, 0.8);
      this.iconBtnGraphics.strokeRect(ix, iconRowY, iconBtnSize, iconBtnSize);
    }

    // --- Minimap (top-right) ---
    this.minimapBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapBiomeGraphics = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapDots = scene.add.graphics().setScrollFactor(0).setDepth(101);

    // --- Inventory UI ---
    this.inventoryUI = new InventoryUI(scene, {
      eqX,
      eqY,
      invX,
      invY,
    });

    // --- Loot Bag UI (above unified panel, aligned with inventory section) ---
    this.lootBagUI = new LootBagUI(scene, this.inventoryUI.getTooltip(), invX, this.panelY);

    // Draw initial bars
    this.drawHealthBar(100, 100, 0);
    this.drawManaBar(100, 100);
    this.drawLvlBar(0, 1);
  }

  private drawHealthBar(hp: number, maxHp: number, hpRegen: number): void {
    const x = this.barsX;
    const y = this.barsY;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333, 0.8);
    this.hpBarBg.fillRect(x, y, this.barWidth, this.barHeight);
    this.hpBarBg.lineStyle(1, 0x666666, 1);
    this.hpBarBg.strokeRect(x, y, this.barWidth, this.barHeight);

    this.hpBarFill.clear();
    const ratio = Math.max(0, hp / maxHp);
    const fillColor =
      ratio > 0.5 ? 0xcc3333 : ratio > 0.25 ? 0xcc6633 : 0xcc2222;
    this.hpBarFill.fillStyle(fillColor, 1);
    this.hpBarFill.fillRect(
      x + 1,
      y + 1,
      (this.barWidth - 2) * ratio,
      this.barHeight - 2
    );

    const regenStr = hpRegen > 0 ? ` (+${hpRegen})` : "";
    this.hpText.setText(`HP: ${Math.ceil(hp)} / ${maxHp}${regenStr}`);
    this.hpText.setPosition(x + this.barWidth / 2, y + 2);
    this.hpText.setOrigin(0.5, 0);
  }

  private drawManaBar(mana: number, maxMana: number): void {
    const x = this.barsX;
    const y = this.barsY + this.barHeight + this.barGap;

    this.manaBarBg.clear();
    this.manaBarBg.fillStyle(0x333333, 0.8);
    this.manaBarBg.fillRect(x, y, this.barWidth, this.barHeight);
    this.manaBarBg.lineStyle(1, 0x666666, 1);
    this.manaBarBg.strokeRect(x, y, this.barWidth, this.barHeight);

    this.manaBarFill.clear();
    const ratio = maxMana > 0 ? Math.max(0, mana / maxMana) : 0;
    this.manaBarFill.fillStyle(0x4466cc, 1);
    this.manaBarFill.fillRect(
      x + 1,
      y + 1,
      (this.barWidth - 2) * ratio,
      this.barHeight - 2
    );

    this.manaText.setText(`MP: ${Math.ceil(mana)} / ${maxMana}`);
    this.manaText.setPosition(x + this.barWidth / 2, y + 2);
    this.manaText.setOrigin(0.5, 0);
  }

  private drawLvlBar(xp: number, level: number): void {
    const x = this.barsX;
    const y = this.barsY + 2 * (this.barHeight + this.barGap);

    this.lvlBarBg.clear();
    this.lvlBarBg.fillStyle(0x333333, 0.8);
    this.lvlBarBg.fillRect(x, y, this.barWidth, this.barHeight);
    this.lvlBarBg.lineStyle(1, 0x666666, 1);
    this.lvlBarBg.strokeRect(x, y, this.barWidth, this.barHeight);

    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(Math.min(level + 1, 100));
    const xpNeeded = nextLevelXp - currentLevelXp;
    const xpProgress = xp - currentLevelXp;
    const ratio = xpNeeded > 0 ? Math.max(0, Math.min(1, xpProgress / xpNeeded)) : 1;

    this.lvlBarFill.clear();
    this.lvlBarFill.fillStyle(0x33aa55, 1);
    this.lvlBarFill.fillRect(
      x + 1,
      y + 1,
      (this.barWidth - 2) * ratio,
      this.barHeight - 2
    );

    this.lvlText.setText(`LVL ${level} (${xpProgress}/${xpNeeded})`);
    this.lvlText.setPosition(x + this.barWidth / 2, y + 2);
    this.lvlText.setOrigin(0.5, 0);
  }

  update(
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    xp: number,
    level: number,
    playerCount: number,
    localX: number,
    localY: number,
    players: Map<string, PlayerSprite>,
    enemies: Map<string, EnemySprite>,
    zone: string
  ): void {
    // Compute hpRegen from equipment
    const equipment = this.inventoryUI.getEquipment();
    const stats = computePlayerStats(level, equipment);

    this.drawHealthBar(hp, maxHp, Math.round(stats.hpRegen));
    this.drawManaBar(mana, maxMana);
    this.drawLvlBar(xp, level);

    if (zone === "nexus") {
      this.zoneText.setText("Nexus (Safe Zone)");
      this.zoneText.setColor("#44aa66");
      this.qHintText.setVisible(false);
    } else if (isDungeonZone(zone)) {
      const dungeonType = ZONE_TO_DUNGEON[zone];
      const dungeonVisual = DUNGEON_VISUALS[dungeonType];
      const dungeonName = dungeonVisual ? dungeonVisual.name : "Dungeon";
      this.zoneText.setText(dungeonName);
      const color = dungeonType === 0 ? "#ff4400" : "#6600cc";
      this.zoneText.setColor(color);
      this.qHintText.setVisible(true);
    } else {
      const mapData = getRealmMap();
      if (mapData) {
        const diffZone = getDifficultyAt(localX, localY);
        const zoneName = DIFFICULTY_ZONE_NAMES[diffZone] ?? "Unknown";
        this.zoneText.setText(zoneName);
      } else {
        this.zoneText.setText("Hostile");
      }
      this.zoneText.setColor("#e94560");
      this.qHintText.setVisible(true);
    }
    this.zoneText.setX(this.scene.scale.width / 2);
    this.qHintText.setX(this.scene.scale.width / 2);
    this.playerCountText.setText(`Players: ${playerCount}/${MAX_PLAYERS}`);
    const mmPad = Math.round(16 * this.S);
    this.playerCountText.setX(this.scene.scale.width - mmPad - this.mmWidth / 2);

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
    const zoneDims = getZoneDimensions(zone);
    const mapW = zoneDims.width;
    const mapH = zoneDims.height;
    const scaleX = this.mmWidth / mapW;
    const scaleY = this.mmHeight / mapH;

    // Top-right position
    const mmX = this.scene.scale.width - this.mmWidth - Math.round(16 * this.S);
    const mmY = Math.round(16 * this.S);

    // Background
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x111122, 0.7);
    this.minimapBg.fillRect(mmX, mmY, this.mmWidth, this.mmHeight);
    this.minimapBg.lineStyle(1, 0x444466, 1);
    this.minimapBg.strokeRect(mmX, mmY, this.mmWidth, this.mmHeight);

    // Draw noise-based biome colors on minimap (hostile zone only, cached)
    if (zone === "hostile" && !this.minimapBiomeCached) {
      if (this.renderMinimapBiomes(mmX, mmY)) {
        this.minimapBiomeCached = true;
      }
    }
    this.minimapBiomeGraphics.setVisible(zone === "hostile");

    // Dots
    this.minimapDots.clear();

    // Enemy dots (red)
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

    // Player dots
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

  private renderMinimapBiomes(mmX: number, mmY: number): boolean {
    const mapData = getRealmMap();
    if (!mapData) return false;

    const step = 3;
    const tilesPerPxX = mapData.width / this.mmWidth;
    const tilesPerPxY = mapData.height / this.mmHeight;

    for (let mx = 0; mx < this.mmWidth; mx += step) {
      for (let my = 0; my < this.mmHeight; my += step) {
        const tileX0 = Math.floor(mx * tilesPerPxX);
        const tileY0 = Math.floor(my * tilesPerPxY);
        const tileX1 = Math.min(mapData.width - 1, Math.floor((mx + step) * tilesPerPxX));
        const tileY1 = Math.min(mapData.height - 1, Math.floor((my + step) * tilesPerPxY));

        const centerIdx = tileY0 * mapData.width + tileX0;
        const biome = mapData.biomes[centerIdx];

        let hasRoad = false;
        let hasRiver = false;
        for (let ty = tileY0; ty <= tileY1; ty++) {
          for (let tx = tileX0; tx <= tileX1; tx++) {
            const idx = ty * mapData.width + tx;
            if (mapData.roads[idx] > 0) { hasRoad = true; break; }
            if (mapData.rivers[idx] > 0) hasRiver = true;
          }
          if (hasRoad) break;
        }

        let color: number | null = null;
        if (hasRoad) {
          color = 0x8a7a5a;
        } else if (hasRiver && biome !== 0 && biome !== 1 && biome !== 15) {
          color = 0x2a6a9a;
        } else {
          const visual = REALM_BIOME_VISUALS[biome];
          color = visual ? visual.groundFill : null;
        }

        if (color !== null) {
          this.minimapBiomeGraphics.fillStyle(color, 0.8);
          this.minimapBiomeGraphics.fillRect(mmX + mx, mmY + my, step, step);
        }
      }
    }
    return true;
  }

  /** Returns true if coordinates are over the unified HUD panel or loot bag */
  isOverPanel(screenX: number, screenY: number): boolean {
    // Check unified panel
    if (
      screenX >= this.panelX &&
      screenX <= this.panelX + this.panelW &&
      screenY >= this.panelY &&
      screenY <= this.panelY + this.panelH
    ) {
      return true;
    }
    // Check loot bag
    return this.lootBagUI.isOverPanel(screenX, screenY);
  }

  // Death screen elements
  private deathOverlay: Phaser.GameObjects.Graphics | null = null;
  private deathText: Phaser.GameObjects.Text | null = null;
  private deathButton: Phaser.GameObjects.Text | null = null;

  showDeathScreen(onRespawn: () => void): void {
    this.hideDeathScreen();
    const { width, height } = this.scene.scale;
    const S = this.S;

    this.deathOverlay = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(200);
    this.deathOverlay.fillStyle(0x000000, 0.5);
    this.deathOverlay.fillRect(0, 0, width, height);

    this.deathText = this.scene.add
      .text(width / 2, height / 2 - Math.round(40 * S), "YOU DIED!", {
        fontSize: `${Math.round(48 * S)}px`,
        color: "#e94560",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    this.deathButton = this.scene.add
      .text(width / 2, height / 2 + Math.round(30 * S), "[ Respawn ]", {
        fontSize: `${Math.round(22 * S)}px`,
        color: "#ffffff",
        fontFamily: "monospace",
        backgroundColor: "#333333",
        padding: { x: Math.round(16 * S), y: Math.round(8 * S) },
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
