import Phaser from "phaser";
import { PlayerSprite } from "../entities/PlayerSprite";
import { EnemySprite } from "../entities/EnemySprite";
import { InventoryUI } from "./InventoryUI";
import { LootBagUI } from "./LootBagUI";
import { VaultUI } from "./VaultUI";
import { DragManager } from "./DragManager";
import { getUIScale, getScreenWidth, getScreenHeight, HUD_REF_WIDTH } from "./UIScale";
import { isFpsVisible, isPingVisible } from "./OptionsUI";
import { NetworkManager } from "../network/NetworkManager";
import {
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  MAX_PLAYERS,
  ENEMY_SYNC_RADIUS,
  TILE_SIZE,
  getZoneDimensions,
  isDungeonZone,
  DUNGEON_VISUALS,
  REALM_BIOME_VISUALS,
  DIFFICULTY_ZONE_NAMES,
  getDungeonTypeFromZone,
  xpForLevel,
  getRealmMap,
  getDifficultyAt,
  computePlayerStats,
  generateNexusMap,
  generateVaultMap,
  DungeonTile,
  isHostileZone,
  isVaultZone,
  REALM_PORTAL_1_X,
  REALM_PORTAL_1_Y,
  REALM_PORTAL_2_X,
  REALM_PORTAL_2_Y,
  VAULT_PORTAL_X,
  VAULT_PORTAL_Y,
  CRAFTING_TABLE_X,
  CRAFTING_TABLE_Y,
  VAULT_CHEST_X,
  VAULT_CHEST_Y,
  VAULT_RETURN_PORTAL_X,
  VAULT_RETURN_PORTAL_Y,
  PortalType,
  isBossEnemy,
} from "@rotmg-lite/shared";
import type { DungeonMapData } from "@rotmg-lite/shared";

export class HUD {
  private scene: Phaser.Scene;

  // Scale factor
  private S: number;

  // Scaled dimensions
  private barWidth!: number;
  private barHeight!: number;
  private barGap!: number;
  private mmWidth!: number;
  private mmHeight!: number;

  // Unified panel dimensions
  private panelX!: number;
  private panelY!: number;
  private panelW!: number;
  private panelH!: number;

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

  // FPS / Ping display
  private fpsText: Phaser.GameObjects.Text | null = null;
  private pingText: Phaser.GameObjects.Text | null = null;

  // Dirty tracking — avoid redrawing unchanged values
  private lastHp: number = -1;
  private lastMaxHp: number = -1;
  private lastHpRegen: number = -1;
  private lastMana: number = -1;
  private lastMaxMana: number = -1;
  private lastXp: number = -1;
  private lastLevel: number = -1;
  private lastZone: string = "";
  private lastPlayerCount: number = -1;
  private lastFps: number = -1;
  private lastPing: number = -1;
  private lastMmX: number = -1;
  private lastMmY: number = -1;
  private cachedHpRegen: number = 0;
  private equipmentVersion: number = -1;


  // Drag state
  private dragActive: boolean = false;

  // Portal gem (count tracked for minimap teleport check)
  private portalGemCount: number = 0;

  // Portal gem targeting
  private portalGemCallback: ((worldX: number, worldY: number) => void) | null = null;
  private portalGemTarget: { worldX: number; worldY: number } | null = null;
  private teleportButton: Phaser.GameObjects.Text | null = null;
  private teleportMarker: Phaser.GameObjects.Graphics | null = null;

  // Minimap view params (for portal gem coord conversion)
  private mmScreenX: number = 0;
  private mmScreenY: number = 0;
  private mmViewX: number = 0;
  private mmViewY: number = 0;
  private mmVisibleW: number = 0;
  private mmVisibleH: number = 0;

  // Minimap
  private minimapBg: Phaser.GameObjects.Graphics;
  private minimapBiomeGraphics: Phaser.GameObjects.Graphics;
  private minimapBiomeCached: boolean = false;
  private minimapBiomeCachedZone: string = "";
  private minimapDots: Phaser.GameObjects.Graphics;
  private minimapZoom: number;
  private minimapZoomInBtn!: Phaser.GameObjects.Text;
  private minimapZoomOutBtn!: Phaser.GameObjects.Text;
  private fullscreenBtn!: Phaser.GameObjects.Text;
  private exploredTiles: Uint8Array | null = null;
  private exploredDungeonZone: string = "";

  // Inventory & Loot Bag & Vault UI
  inventoryUI: InventoryUI;
  lootBagUI: LootBagUI;
  vaultUI: VaultUI;
  dragManager: DragManager;

  // Stats button
  private statsButton: Phaser.GameObjects.Graphics;
  private statsButtonZone: Phaser.GameObjects.Zone;
  private statsButtonText: Phaser.GameObjects.Text;
  private onStatsButtonClick: (() => void) | null = null;

  // Section origins (stored for bar drawing)
  private barsX!: number;
  private barsY!: number;

  // Layout cache (used by computeLayout and relayout)
  private slotSize: number = 0;
  private slotGap: number = 0;
  private innerPad: number = 0;
  private sectionGap: number = 0;
  private iconGap: number = 0;
  private eqX: number = 0;
  private eqY: number = 0;
  private invX: number = 0;
  private invY: number = 0;
  private barsH: number = 0;
  private statsBtnSize: number = 0;
  private statsBtnGap: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.S = getUIScale();
    const S = this.S;

    // Compute panel layout from 30% of screen width
    const screenW = scene.scale.width;
    const screenH = scene.scale.height;
    this.computeLayout(screenW, screenH, S);

    const barFontSize = `${Math.max(8, Math.round(this.barHeight * 0.75))}px`;
    const zoneFontSize = `${Math.round(18 * S)}px`;
    const countFontSize = `${Math.round(14 * S)}px`;

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

    // --- FPS / Ping display (top-left) ---
    const perfFontSize = `${Math.round(10 * S)}px`;
    this.fpsText = scene.add
      .text(Math.round(8 * S), Math.round(8 * S), "", {
        fontSize: perfFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.pingText = scene.add
      .text(Math.round(8 * S), Math.round(8 * S) + Math.round(14 * S), "", {
        fontSize: perfFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // --- Player count (inside minimap, bottom-left) ---
    const mmPad = Math.round(16 * S);
    const btnPadInit = Math.round(3 * S);
    this.playerCountText = scene.add
      .text(screenW - mmPad - this.mmWidth + btnPadInit, mmPad + this.mmHeight - btnPadInit, `Players: 0/${MAX_PLAYERS}`, {
        fontSize: countFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(102);

    // --- Minimap (top-right) ---
    this.minimapBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapBiomeGraphics = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapDots = scene.add.graphics().setScrollFactor(0).setDepth(101);

    // Minimap zoom
    const savedZoom = parseFloat(localStorage.getItem("minimapZoom") ?? "1");
    this.minimapZoom = isFinite(savedZoom) && savedZoom >= 0.5 ? savedZoom : 1;

    const mmPadInit = Math.round(16 * S);
    const mmRight = screenW - mmPadInit;
    const mmTop = mmPadInit;
    const btnFontSize = `${Math.round(14 * S)}px`;

    const btnPad = Math.round(3 * S);

    this.minimapZoomInBtn = scene.add
      .text(0, 0, "[+]", {
        fontSize: btnFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });

    this.minimapZoomOutBtn = scene.add
      .text(0, 0, "[-]", {
        fontSize: btnFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });

    // Position inside bottom-right corner of minimap
    const initMmX = screenW - this.mmWidth - mmPadInit;
    const initMmY = mmPadInit;
    this.minimapZoomOutBtn.setPosition(
      initMmX + this.mmWidth - btnPad,
      initMmY + this.mmHeight - btnPad
    );
    this.minimapZoomInBtn.setPosition(
      this.minimapZoomOutBtn.x - this.minimapZoomOutBtn.width - Math.round(2 * S),
      initMmY + this.mmHeight - btnPad
    );

    this.minimapZoomInBtn.on("pointerover", () =>
      this.minimapZoomInBtn.setColor("#44ffaa")
    );
    this.minimapZoomInBtn.on("pointerout", () =>
      this.minimapZoomInBtn.setColor("#aaaaaa")
    );
    this.minimapZoomInBtn.on("pointerdown", () => {
      this.minimapZoom = Math.min(this.minimapZoom * 2, 16);
      this.invalidateMinimapCache();
      localStorage.setItem("minimapZoom", String(this.minimapZoom));
    });

    this.minimapZoomOutBtn.on("pointerover", () =>
      this.minimapZoomOutBtn.setColor("#44ffaa")
    );
    this.minimapZoomOutBtn.on("pointerout", () =>
      this.minimapZoomOutBtn.setColor("#aaaaaa")
    );
    this.minimapZoomOutBtn.on("pointerdown", () => {
      this.minimapZoom = Math.max(this.minimapZoom / 2, 1);
      this.invalidateMinimapCache();
      localStorage.setItem("minimapZoom", String(this.minimapZoom));
    });

    // Fullscreen toggle button (below minimap)
    this.fullscreenBtn = scene.add
      .text(0, 0, "[ ]", {
        fontSize: btnFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });

    this.fullscreenBtn.setPosition(
      initMmX + this.mmWidth,
      initMmY + this.mmHeight + Math.round(4 * S)
    );

    this.fullscreenBtn.on("pointerover", () =>
      this.fullscreenBtn.setColor("#44ffaa")
    );
    this.fullscreenBtn.on("pointerout", () =>
      this.fullscreenBtn.setColor("#aaaaaa")
    );
    this.fullscreenBtn.on("pointerdown", () => {
      if (this.scene.scale.isFullscreen) {
        this.scene.scale.stopFullscreen();
      } else {
        this.scene.scale.startFullscreen();
      }
    });

    this.scene.scale.on("enterfullscreen", () => {
      this.fullscreenBtn.setText("[■]");
    });
    this.scene.scale.on("leavefullscreen", () => {
      this.fullscreenBtn.setText("[ ]");
    });

    // --- Inventory UI ---
    this.inventoryUI = new InventoryUI(scene, {
      eqX: this.eqX,
      eqY: this.eqY,
      invX: this.invX,
      invY: this.invY,
      slotSize: this.slotSize,
      slotGap: this.slotGap,
    });

    // --- Loot Bag UI (above unified panel, aligned with inventory section) ---
    this.lootBagUI = new LootBagUI(scene, this.inventoryUI.getTooltip(), this.invX, this.panelY, this.slotSize);

    // --- Vault UI (left panel, full height) ---
    this.vaultUI = new VaultUI(scene, this.inventoryUI.getTooltip(), this.slotSize);

    // --- Drag Manager ---
    this.dragManager = new DragManager(scene);
    this.dragManager.setInventoryUI(this.inventoryUI);
    this.dragManager.setLootBagUI(this.lootBagUI);
    this.dragManager.setVaultUI(this.vaultUI);
    this.dragManager.setPanelBoundsGetter(() => ({
      x: this.panelX,
      y: this.panelY,
      w: this.panelW,
      h: this.panelH,
    }));
    this.dragManager.setHUD(this);
    this.inventoryUI.setDragManager(this.dragManager);
    this.lootBagUI.setDragManager(this.dragManager);
    this.vaultUI.setDragManager(this.dragManager);

    // Draw initial bars
    this.drawHealthBar(100, 100, 0);
    this.drawManaBar(100, 100);
    this.drawLvlBar(0, 1);

    // --- Stats button (below bars, small square) ---
    const statsBtnY = this.barsY + this.barsH + this.statsBtnGap;
    const statsBtnH = this.statsBtnSize;
    const statsBtnW = this.statsBtnSize;
    const statsBtnX = this.barsX;

    this.statsButton = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.statsButton.fillStyle(0x333344, 0.7);
    this.statsButton.fillRoundedRect(statsBtnX, statsBtnY, statsBtnW, statsBtnH, 3);
    this.statsButton.lineStyle(1, 0x555566, 0.8);
    this.statsButton.strokeRoundedRect(statsBtnX, statsBtnY, statsBtnW, statsBtnH, 3);

    this.statsButtonText = scene.add
      .text(statsBtnX + statsBtnW / 2, statsBtnY + statsBtnH / 2, "P", {
        fontSize: `${Math.max(8, Math.round(this.statsBtnSize * 0.6))}px`,
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(102);

    this.statsButtonZone = scene.add
      .zone(statsBtnX + statsBtnW / 2, statsBtnY + statsBtnH / 2, statsBtnW, statsBtnH)
      .setScrollFactor(0)
      .setDepth(104)
      .setInteractive({ useHandCursor: true });

    this.statsButtonZone.on("pointerover", () => {
      this.statsButtonText.setColor("#44ffaa");
    });
    this.statsButtonZone.on("pointerout", () => {
      this.statsButtonText.setColor("#aaaaaa");
    });
    this.statsButtonZone.on("pointerdown", () => {
      if (this.onStatsButtonClick) this.onStatsButtonClick();
    });
  }

  private computeLayout(screenW: number, screenH: number, S: number): void {
    // HUD panel occupies ~30% of screen width, centered at bottom
    this.panelW = Math.min(Math.round(HUD_REF_WIDTH * S), Math.round(screenW * 0.40));
    this.innerPad = Math.max(4, Math.round(this.panelW * 0.016));
    this.sectionGap = Math.max(4, Math.round(this.panelW * 0.023));
    this.slotGap = Math.max(2, Math.round(this.panelW * 0.008));
    this.iconGap = Math.max(2, Math.round(this.panelW * 0.008));

    // Bars take ~28% of panel width
    this.barWidth = Math.round(this.panelW * 0.28);
    this.barHeight = Math.max(10, Math.round(this.panelW * 0.032));
    this.barGap = Math.max(2, Math.round(this.panelW * 0.006));

    // Remaining space split between equipment (4 slots) and inventory (4 cols)
    const availableW = this.panelW - 2 * this.innerPad - this.barWidth - 2 * this.sectionGap;
    const halfW = Math.floor(availableW / 2);
    this.slotSize = Math.max(16, Math.floor((halfW - 3 * this.slotGap) / 4));

    const eqW = 4 * this.slotSize + 3 * this.slotGap;
    const eqSectionH = this.slotSize;
    const invH = 2 * this.slotSize + this.slotGap;
    this.barsH = 3 * this.barHeight + 2 * this.barGap;
    // Stats button sits below bars inside the panel
    this.statsBtnSize = Math.max(12, this.barHeight);
    this.statsBtnGap = this.barGap;
    const barsSectionH = this.barsH + this.statsBtnGap + this.statsBtnSize;
    const maxH = Math.max(barsSectionH, eqSectionH, invH);

    this.panelH = this.innerPad + maxH + this.innerPad;
    this.panelX = Math.round(screenW / 2 - this.panelW / 2);
    this.panelY = Math.round(screenH - this.panelH - Math.round(12 * S));

    this.barsX = this.panelX + this.innerPad;
    this.barsY = this.panelY + this.innerPad;

    this.eqX = this.barsX + this.barWidth + this.sectionGap;
    this.eqY = this.panelY + this.innerPad;

    this.invX = this.eqX + eqW + this.sectionGap;
    this.invY = this.panelY + this.innerPad;

    // Minimap scales with S
    this.mmWidth = Math.round(MINIMAP_WIDTH * S * 1.25);
    this.mmHeight = Math.round(MINIMAP_HEIGHT * S * 1.25);
  }

  relayout(): void {
    const screenW = this.scene.scale.width;
    const screenH = this.scene.scale.height;
    this.S = getUIScale();
    const S = this.S;
    this.computeLayout(screenW, screenH, S);

    const barFontSize = `${Math.max(8, Math.round(this.barHeight * 0.75))}px`;
    const zoneFontSize = `${Math.round(18 * S)}px`;
    const countFontSize = `${Math.round(14 * S)}px`;

    // Update panel background
    this.panelBg.clear();
    this.panelBg.fillStyle(0x222222, 0.85);
    this.panelBg.fillRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 6);
    this.panelBg.lineStyle(1, 0x555555, 0.8);
    this.panelBg.strokeRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 6);

    // Update text font sizes
    this.hpText.setFontSize(barFontSize);
    this.manaText.setFontSize(barFontSize);
    this.lvlText.setFontSize(barFontSize);
    this.zoneText.setFontSize(zoneFontSize);
    this.playerCountText.setFontSize(countFontSize);

    // Update stats button
    const statsBtnY = this.barsY + this.barsH + this.statsBtnGap;
    const statsBtnSize = this.statsBtnSize;
    this.statsButton.clear();
    this.statsButton.fillStyle(0x333344, 0.7);
    this.statsButton.fillRoundedRect(this.barsX, statsBtnY, statsBtnSize, statsBtnSize, 3);
    this.statsButton.lineStyle(1, 0x555566, 0.8);
    this.statsButton.strokeRoundedRect(this.barsX, statsBtnY, statsBtnSize, statsBtnSize, 3);
    this.statsButtonText.setPosition(this.barsX + statsBtnSize / 2, statsBtnY + statsBtnSize / 2);
    this.statsButtonText.setFontSize(`${Math.max(8, Math.round(statsBtnSize * 0.6))}px`);
    this.statsButtonZone.setPosition(this.barsX + statsBtnSize / 2, statsBtnY + statsBtnSize / 2);
    this.statsButtonZone.setSize(statsBtnSize, statsBtnSize);

    // Update minimap zoom button font sizes
    const btnFontSize = `${Math.round(14 * S)}px`;
    this.minimapZoomInBtn.setFontSize(btnFontSize);
    this.minimapZoomOutBtn.setFontSize(btnFontSize);
    this.fullscreenBtn.setFontSize(btnFontSize);

    // FPS / Ping repositioning
    const perfFontSize = `${Math.round(10 * S)}px`;
    if (this.fpsText) {
      this.fpsText.setPosition(Math.round(8 * S), Math.round(8 * S));
      this.fpsText.setFontSize(perfFontSize);
    }
    if (this.pingText) {
      this.pingText.setPosition(Math.round(8 * S), Math.round(8 * S) + Math.round(14 * S));
      this.pingText.setFontSize(perfFontSize);
    }

    // Invalidate all caches on resize so everything redraws at new positions
    this.invalidateMinimapCache();
    this.lastMmX = -1;
    this.lastMmY = -1;
    this.lastHp = -1;
    this.lastMana = -1;
    this.lastXp = -1;
    this.lastZone = "";
    this.lastPlayerCount = -1;

    // Relayout sub-UIs
    this.inventoryUI.relayout({
      eqX: this.eqX,
      eqY: this.eqY,
      invX: this.invX,
      invY: this.invY,
      slotSize: this.slotSize,
      slotGap: this.slotGap,
    });

    this.lootBagUI.relayout(this.invX, this.panelY, this.slotSize);
    this.vaultUI.relayout(this.slotSize);

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
    this.hpText.setPosition(x + this.barWidth / 2, y + this.barHeight / 2);
    this.hpText.setOrigin(0.5, 0.5);
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
    this.manaText.setPosition(x + this.barWidth / 2, y + this.barHeight / 2);
    this.manaText.setOrigin(0.5, 0.5);
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
    this.lvlText.setPosition(x + this.barWidth / 2, y + this.barHeight / 2);
    this.lvlText.setOrigin(0.5, 0.5);
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
    zone: string,
    portalGemCount: number = 0,
    dungeonPortals: Array<{ x: number; y: number; portalType: number }> = [],
    dungeonMap: DungeonMapData | null = null
  ): void {
    // Compute hpRegen from equipment (only when equipment changes)
    if (this.equipmentVersion !== this.inventoryUI.equipmentVersion) {
      this.equipmentVersion = this.inventoryUI.equipmentVersion;
      const equipment = this.inventoryUI.getEquipment();
      const stats = computePlayerStats(level, equipment);
      this.cachedHpRegen = Math.round(stats.hpRegen);
    }
    const hpRegen = this.cachedHpRegen;

    // Only redraw bars when values change
    if (hp !== this.lastHp || maxHp !== this.lastMaxHp || hpRegen !== this.lastHpRegen) {
      this.drawHealthBar(hp, maxHp, hpRegen);
      this.lastHp = hp;
      this.lastMaxHp = maxHp;
      this.lastHpRegen = hpRegen;
    }
    if (mana !== this.lastMana || maxMana !== this.lastMaxMana) {
      this.drawManaBar(mana, maxMana);
      this.lastMana = mana;
      this.lastMaxMana = maxMana;
    }
    if (xp !== this.lastXp || level !== this.lastLevel) {
      this.drawLvlBar(xp, level);
      this.lastXp = xp;
      this.lastLevel = level;
    }

    // Only update zone text when zone changes
    if (zone !== this.lastZone) {
      this.lastZone = zone;
      if (zone === "nexus") {
        this.zoneText.setText("Nexus (Safe Zone)");
        this.zoneText.setColor("#44aa66");
      } else if (isVaultZone(zone)) {
        this.zoneText.setText("Vault");
        this.zoneText.setColor("#ddaa55");
      } else if (isDungeonZone(zone)) {
        const dungeonType = getDungeonTypeFromZone(zone);
        const dungeonVisual = dungeonType !== undefined ? DUNGEON_VISUALS[dungeonType] : undefined;
        const dungeonName = dungeonVisual ? dungeonVisual.name : "Dungeon";
        this.zoneText.setText(dungeonName);
        const color = dungeonType === 0 ? "#ff4400" : "#6600cc";
        this.zoneText.setColor(color);
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
      }
      this.zoneText.setX(this.scene.scale.width / 2);
    }
    if (playerCount !== this.lastPlayerCount) {
      this.playerCountText.setText(`Players: ${playerCount}/${MAX_PLAYERS}`);
      this.lastPlayerCount = playerCount;
    }

    // Track portal gem count for minimap teleport check
    this.portalGemCount = portalGemCount;

    // FPS / Ping display
    if (this.fpsText) {
      if (isFpsVisible()) {
        const fps = Math.round(this.scene.game.loop.actualFps);
        if (fps !== this.lastFps) {
          this.fpsText.setText(`FPS: ${fps}`);
          this.lastFps = fps;
        }
        this.fpsText.setVisible(true);
      } else {
        this.fpsText.setVisible(false);
      }
    }
    if (this.pingText) {
      if (isPingVisible()) {
        const rtt = NetworkManager.getInstance().getRtt();
        if (rtt !== this.lastPing) {
          this.pingText.setText(`Ping: ${rtt}ms`);
          this.lastPing = rtt;
        }
        this.pingText.setVisible(true);
      } else {
        this.pingText.setVisible(false);
      }
    }

    // Draw minimap
    this.drawMinimap(localX, localY, players, enemies, zone, dungeonPortals, dungeonMap);
  }

  private invalidateMinimapCache(): void {
    this.minimapBiomeCached = false;
    this.minimapBiomeCachedZone = "";
    this.minimapBiomeGraphics.clear();
  }

  setDragActive(active: boolean): void {
    this.dragActive = active;
  }

  setStatsButtonCallback(cb: () => void): void {
    this.onStatsButtonClick = cb;
  }

  setPortalGemCallback(cb: (worldX: number, worldY: number) => void): void {
    this.portalGemCallback = cb;

    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) return;
      if (this.portalGemCount <= 0) return;

      // Check if click is within minimap bounds
      if (
        pointer.x >= this.mmScreenX &&
        pointer.x <= this.mmScreenX + this.mmWidth &&
        pointer.y >= this.mmScreenY &&
        pointer.y <= this.mmScreenY + this.mmHeight
      ) {
        const worldCoords = this.minimapToWorld(pointer.x, pointer.y);
        if (worldCoords) {
          this.showTeleportConfirmation(worldCoords.worldX, worldCoords.worldY, pointer.x, pointer.y);
        }
      }
    });
  }

  private minimapToWorld(screenX: number, screenY: number): { worldX: number; worldY: number } | null {
    if (this.mmVisibleW <= 0 || this.mmVisibleH <= 0) return null;
    const relX = (screenX - this.mmScreenX) / this.mmWidth;
    const relY = (screenY - this.mmScreenY) / this.mmHeight;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
    return {
      worldX: this.mmViewX + relX * this.mmVisibleW,
      worldY: this.mmViewY + relY * this.mmVisibleH,
    };
  }

  private showTeleportConfirmation(worldX: number, worldY: number, screenX: number, screenY: number): void {
    this.hideTeleportConfirmation();
    this.portalGemTarget = { worldX, worldY };

    // Marker on minimap
    this.teleportMarker = this.scene.add.graphics().setScrollFactor(0).setDepth(104);
    this.teleportMarker.fillStyle(0xaa44ff, 1);
    this.teleportMarker.fillCircle(screenX, screenY, 4);
    this.teleportMarker.lineStyle(1, 0xffffff, 0.8);
    this.teleportMarker.strokeCircle(screenX, screenY, 4);

    // Teleport button below minimap
    const S = this.S;
    this.teleportButton = this.scene.add
      .text(
        this.mmScreenX + this.mmWidth / 2,
        this.mmScreenY + this.mmHeight + Math.round(8 * S),
        "TELEPORT  -1\u25C6",
        {
          fontSize: `${Math.round(11 * S)}px`,
          color: "#aa44ff",
          fontFamily: "monospace",
          backgroundColor: "#222233",
          padding: { x: Math.round(8 * S), y: Math.round(4 * S) },
        }
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(104)
      .setInteractive({ useHandCursor: true });

    this.teleportButton.on("pointerdown", () => {
      if (this.portalGemTarget && this.portalGemCallback) {
        this.portalGemCallback(this.portalGemTarget.worldX, this.portalGemTarget.worldY);
      }
      this.hideTeleportConfirmation();
    });
    this.teleportButton.on("pointerover", () => this.teleportButton?.setColor("#cc66ff"));
    this.teleportButton.on("pointerout", () => this.teleportButton?.setColor("#aa44ff"));
  }

  hideTeleportConfirmation(): void {
    this.teleportButton?.destroy();
    this.teleportButton = null;
    this.teleportMarker?.destroy();
    this.teleportMarker = null;
    this.portalGemTarget = null;
  }

  private drawMinimap(
    localX: number,
    localY: number,
    players: Map<string, PlayerSprite>,
    enemies: Map<string, EnemySprite>,
    zone: string,
    dungeonPortals: Array<{ x: number; y: number; portalType: number }> = [],
    dungeonMap: DungeonMapData | null = null
  ): void {
    const zoneDims = getZoneDimensions(zone);
    const mapW = zoneDims.width;
    const mapH = zoneDims.height;

    // Compute visible region based on zoom
    const zoom = zone === "nexus" || isVaultZone(zone) ? 1 : this.minimapZoom;
    let visibleW = mapW / zoom;
    let visibleH = mapH / zoom;
    let viewX = Math.max(0, Math.min(localX - visibleW / 2, mapW - visibleW));
    let viewY = Math.max(0, Math.min(localY - visibleH / 2, mapH - visibleH));

    // For non-square maps (dungeons), use uniform scaling to prevent stretching
    if (isDungeonZone(zone) && visibleW !== visibleH) {
      const maxVisible = Math.max(visibleW, visibleH);
      // Center the shorter axis within the square minimap
      viewX = (mapW - maxVisible) / 2;
      viewY = (mapH - maxVisible) / 2;
      if (zoom > 1) {
        viewX = localX - maxVisible / 2;
        viewY = localY - maxVisible / 2;
      }
      visibleW = maxVisible;
      visibleH = maxVisible;
    }

    const scaleX = this.mmWidth / visibleW;
    const scaleY = this.mmHeight / visibleH;

    // Top-right position
    const mmX = this.scene.scale.width - this.mmWidth - Math.round(16 * this.S);
    const mmY = Math.round(16 * this.S);

    // Store for portal gem coord conversion
    this.mmScreenX = mmX;
    this.mmScreenY = mmY;
    this.mmViewX = viewX;
    this.mmViewY = viewY;
    this.mmVisibleW = visibleW;
    this.mmVisibleH = visibleH;

    // Background + button positioning — only redraw when position changes (resize)
    const mmMoved = mmX !== this.lastMmX || mmY !== this.lastMmY;
    if (mmMoved) {
      this.lastMmX = mmX;
      this.lastMmY = mmY;
      this.minimapBg.clear();
      this.minimapBg.fillStyle(0x111122, 0.7);
      this.minimapBg.fillRect(mmX, mmY, this.mmWidth, this.mmHeight);
      this.minimapBg.lineStyle(1, 0x444466, 1);
      this.minimapBg.strokeRect(mmX, mmY, this.mmWidth, this.mmHeight);
    }

    // Update dungeon fog of war — reveal tiles near the player
    const FOG_REVEAL_RADIUS = 20;
    if (isDungeonZone(zone) && dungeonMap) {
      if (this.exploredDungeonZone !== zone) {
        this.exploredTiles = new Uint8Array(dungeonMap.width * dungeonMap.height);
        this.exploredDungeonZone = zone;
      }
      const playerTX = Math.floor(localX / TILE_SIZE);
      const playerTY = Math.floor(localY / TILE_SIZE);
      const r = FOG_REVEAL_RADIUS;
      const rSq = r * r;
      let revealed = false;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > rSq) continue;
          const tx = playerTX + dx;
          const ty = playerTY + dy;
          if (tx < 0 || tx >= dungeonMap.width || ty < 0 || ty >= dungeonMap.height) continue;
          const idx = ty * dungeonMap.width + tx;
          if (!this.exploredTiles![idx]) {
            this.exploredTiles![idx] = 1;
            revealed = true;
          }
        }
      }
      if (revealed) this.invalidateMinimapCache();
    }

    // Biome/terrain rendering (cached only at zoom 1 for the same zone)
    const canUseCache =
      zoom === 1 &&
      this.minimapBiomeCached &&
      this.minimapBiomeCachedZone === zone;

    if (isHostileZone(zone)) {
      if (!canUseCache) {
        this.minimapBiomeGraphics.clear();
        if (this.renderMinimapBiomes(mmX, mmY, viewX, viewY, visibleW, visibleH)) {
          if (zoom === 1) {
            this.minimapBiomeCached = true;
            this.minimapBiomeCachedZone = zone;
          }
        }
      }
      this.minimapBiomeGraphics.setVisible(true);
    } else if (zone === "nexus" || isVaultZone(zone)) {
      if (!canUseCache) {
        this.minimapBiomeGraphics.clear();
        const tileMap = zone === "nexus" ? generateNexusMap() : generateVaultMap();
        this.renderMinimapTiles(tileMap, mmX, mmY, viewX, viewY, visibleW, visibleH);
        if (zoom === 1) {
          this.minimapBiomeCached = true;
          this.minimapBiomeCachedZone = zone;
        }
      }
      this.minimapBiomeGraphics.setVisible(true);
    } else if (isDungeonZone(zone) && dungeonMap) {
      if (!canUseCache) {
        this.minimapBiomeGraphics.clear();
        const dungeonType = getDungeonTypeFromZone(zone);
        const visual = dungeonType !== undefined ? DUNGEON_VISUALS[dungeonType] : undefined;
        const fillColor = visual ? visual.groundFill : 0x2a4a2a;
        this.renderMinimapTiles(dungeonMap, mmX, mmY, viewX, viewY, visibleW, visibleH, fillColor, this.exploredTiles ?? undefined);
        if (zoom === 1) {
          this.minimapBiomeCached = true;
          this.minimapBiomeCachedZone = zone;
        }
      }
      this.minimapBiomeGraphics.setVisible(true);
    } else {
      this.minimapBiomeGraphics.setVisible(false);
    }

    // Dots
    this.minimapDots.clear();

    // Enemy dots (red) — hidden under fog of war in dungeons
    const syncRadiusSq = ENEMY_SYNC_RADIUS * ENEMY_SYNC_RADIUS;
    const hasFog = isDungeonZone(zone) && this.exploredTiles && dungeonMap;
    const inDungeon = isDungeonZone(zone);
    enemies.forEach((enemy) => {
      const ex = enemy.x - localX;
      const ey = enemy.y - localY;
      if (ex * ex + ey * ey > syncRadiusSq) return;
      if (hasFog) {
        const etx = Math.floor(enemy.x / TILE_SIZE);
        const ety = Math.floor(enemy.y / TILE_SIZE);
        if (etx >= 0 && etx < dungeonMap!.width && ety >= 0 && ety < dungeonMap!.height) {
          if (!this.exploredTiles![ety * dungeonMap!.width + etx]) return;
        }
      }
      const dx = mmX + (enemy.x - viewX) * scaleX;
      const dy = mmY + (enemy.y - viewY) * scaleY;
      if (dx < mmX || dx > mmX + this.mmWidth || dy < mmY || dy > mmY + this.mmHeight) return;
      if (inDungeon && isBossEnemy(enemy.getEnemyType())) {
        this.drawMinimapStar(this.minimapDots, dx, dy, 5, 0xffcc00);
      } else {
        this.minimapDots.fillStyle(0xcc3333, 0.8);
        this.minimapDots.fillRect(dx - 1, dy - 1, 3, 3);
      }
    });

    // Player dots (only show players in the same zone)
    players.forEach((player) => {
      if (player.zone !== zone) return;
      const isLocal =
        Math.abs(player.x - localX) < 5 && Math.abs(player.y - localY) < 5;
      this.minimapDots.fillStyle(isLocal ? 0xffffff : 0x4488ff, 1);
      const dx = mmX + (player.x - viewX) * scaleX;
      const dy = mmY + (player.y - viewY) * scaleY;
      if (dx < mmX - 3 || dx > mmX + this.mmWidth + 3 || dy < mmY - 3 || dy > mmY + this.mmHeight + 3) return;
      this.minimapDots.fillCircle(dx, dy, isLocal ? 3 : 2);
    });

    // Landmark icons
    this.drawMinimapIcons(mmX, mmY, viewX, viewY, scaleX, scaleY, zone, dungeonPortals);

    // Reposition zoom buttons only when minimap position changes
    if (mmMoved) {
      const btnPad = Math.round(3 * this.S);
      this.minimapZoomOutBtn.setPosition(
        mmX + this.mmWidth - btnPad,
        mmY + this.mmHeight - btnPad
      );
      this.minimapZoomInBtn.setPosition(
        this.minimapZoomOutBtn.x - this.minimapZoomOutBtn.width - Math.round(2 * this.S),
        mmY + this.mmHeight - btnPad
      );
      this.fullscreenBtn.setPosition(
        mmX + this.mmWidth,
        mmY + this.mmHeight + Math.round(4 * this.S)
      );
      this.playerCountText.setPosition(mmX + btnPad, mmY + this.mmHeight - btnPad);
    }

    // Hide zoom buttons in nexus/vault (full map always shown)
    const hideZoom = zone === "nexus" || isVaultZone(zone);
    this.minimapZoomInBtn.setVisible(!hideZoom);
    this.minimapZoomOutBtn.setVisible(!hideZoom);
  }

  private renderMinimapBiomes(
    mmX: number,
    mmY: number,
    viewX: number,
    viewY: number,
    viewW: number,
    viewH: number
  ): boolean {
    const mapData = getRealmMap();
    if (!mapData) return false;

    const step = 3;
    const pxPerMmX = viewW / this.mmWidth; // world pixels per minimap pixel
    const pxPerMmY = viewH / this.mmHeight;
    const tileW = mapData.width;
    const tileH = mapData.height;
    const ts = TILE_SIZE;

    for (let mx = 0; mx < this.mmWidth; mx += step) {
      for (let my = 0; my < this.mmHeight; my += step) {
        const worldX = viewX + mx * pxPerMmX;
        const worldY = viewY + my * pxPerMmY;
        const worldX1 = viewX + (mx + step) * pxPerMmX;
        const worldY1 = viewY + (my + step) * pxPerMmY;

        const tileX0 = Math.floor(worldX / ts);
        const tileY0 = Math.floor(worldY / ts);
        const tileX1 = Math.min(tileW - 1, Math.floor(worldX1 / ts));
        const tileY1 = Math.min(tileH - 1, Math.floor(worldY1 / ts));

        if (tileX0 < 0 || tileY0 < 0 || tileX0 >= tileW || tileY0 >= tileH) continue;

        const centerIdx = tileY0 * tileW + tileX0;
        const biome = mapData.biomes[centerIdx];

        let hasRoad = false;
        let hasRiver = false;
        for (let ty = tileY0; ty <= tileY1; ty++) {
          for (let tx = tileX0; tx <= tileX1; tx++) {
            const idx = ty * tileW + tx;
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

  private renderMinimapTiles(
    mapData: { tiles: Uint8Array; width: number; height: number },
    mmX: number,
    mmY: number,
    viewX: number,
    viewY: number,
    viewW: number,
    viewH: number,
    fillColor: number = 0x2a4a2a,
    explored?: Uint8Array
  ): void {
    const { tiles, width, height } = mapData;
    const ts = TILE_SIZE;
    const scaleX = this.mmWidth / viewW;
    const scaleY = this.mmHeight / viewH;

    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty * width + tx] !== DungeonTile.Floor) continue;
        if (explored && !explored[ty * width + tx]) continue;

        const worldX = tx * ts;
        const worldY = ty * ts;

        // Skip tiles outside visible region
        if (worldX + ts < viewX || worldX > viewX + viewW) continue;
        if (worldY + ts < viewY || worldY > viewY + viewH) continue;

        const sx = mmX + (worldX - viewX) * scaleX;
        const sy = mmY + (worldY - viewY) * scaleY;
        const sw = ts * scaleX;
        const sh = ts * scaleY;

        // Clamp tile rectangle to minimap bounds
        const left = Math.max(sx, mmX);
        const top = Math.max(sy, mmY);
        const right = Math.min(sx + Math.ceil(sw), mmX + this.mmWidth);
        const bottom = Math.min(sy + Math.ceil(sh), mmY + this.mmHeight);
        if (left >= right || top >= bottom) continue;

        this.minimapBiomeGraphics.fillStyle(fillColor, 0.9);
        this.minimapBiomeGraphics.fillRect(left, top, right - left, bottom - top);
      }
    }
  }

  /** Draw landmark icons on the minimap */
  private drawMinimapIcons(
    mmX: number, mmY: number,
    viewX: number, viewY: number,
    scaleX: number, scaleY: number,
    zone: string,
    dungeonPortals: Array<{ x: number; y: number; portalType: number }>
  ): void {
    const g = this.minimapDots;
    const r = 5; // icon radius in screen pixels

    // Helper to convert world coords to minimap screen coords, returns null if out of bounds
    const toScreen = (wx: number, wy: number): { sx: number; sy: number } | null => {
      const sx = mmX + (wx - viewX) * scaleX;
      const sy = mmY + (wy - viewY) * scaleY;
      if (sx < mmX - r || sx > mmX + this.mmWidth + r || sy < mmY - r || sy > mmY + this.mmHeight + r) return null;
      return { sx, sy };
    };

    if (zone === "nexus") {
      // Realm portals (purple)
      for (const [px, py] of [[REALM_PORTAL_1_X, REALM_PORTAL_1_Y], [REALM_PORTAL_2_X, REALM_PORTAL_2_Y]]) {
        const p = toScreen(px, py);
        if (p) this.drawMinimapPortalIcon(g, p.sx, p.sy, 0xaa66ff, r);
      }

      // Vault portal (gold)
      const vp = toScreen(VAULT_PORTAL_X, VAULT_PORTAL_Y);
      if (vp) this.drawMinimapPortalIcon(g, vp.sx, vp.sy, 0xddaa55, r);

      // Crafting table (anvil)
      const ct = toScreen(CRAFTING_TABLE_X, CRAFTING_TABLE_Y);
      if (ct) this.drawMinimapCraftingIcon(g, ct.sx, ct.sy, r);
    } else if (isVaultZone(zone)) {
      // Vault chest
      const vc = toScreen(VAULT_CHEST_X, VAULT_CHEST_Y);
      if (vc) this.drawMinimapChestIcon(g, vc.sx, vc.sy, r);

      // Return portal (blue)
      const rp = toScreen(VAULT_RETURN_PORTAL_X, VAULT_RETURN_PORTAL_Y);
      if (rp) this.drawMinimapPortalIcon(g, rp.sx, rp.sy, 0x4488ff, r);
    }

    // Dungeon portals (hostile zones only, visible when zoomed in)
    if (isHostileZone(zone) && this.minimapZoom >= 2) {
      for (const dp of dungeonPortals) {
        const p = toScreen(dp.x, dp.y);
        if (!p) continue;
        let color = 0xffffff;
        if (dp.portalType === PortalType.InfernalPitEntrance) color = 0xff4400;
        else if (dp.portalType === PortalType.VoidSanctumEntrance) color = 0x6600cc;
        else if (dp.portalType === PortalType.DungeonExit) color = 0x44ff44;
        this.drawMinimapPortalIcon(g, p.sx, p.sy, color, r);
      }
    }
  }

  /** Portal icon: outer ring + filled center dot */
  /** Draw a 5-pointed star on the minimap (used for boss enemies) */
  private drawMinimapStar(
    g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number
  ): void {
    g.fillStyle(color, 1);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (Math.PI / 5) * i;
      const dist = i % 2 === 0 ? r : r * 0.4;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  private drawMinimapPortalIcon(
    g: Phaser.GameObjects.Graphics, sx: number, sy: number, color: number, r: number
  ): void {
    g.lineStyle(1.5, color, 0.9);
    g.strokeCircle(sx, sy, r);
    g.fillStyle(color, 0.8);
    g.fillCircle(sx, sy, r * 0.4);
  }

  /** Crafting table icon: gold rectangle with circle on top (anvil) */
  private drawMinimapCraftingIcon(
    g: Phaser.GameObjects.Graphics, sx: number, sy: number, r: number
  ): void {
    const w = r * 1.6;
    const h = r * 1.2;
    g.fillStyle(0xddaa55, 0.85);
    g.fillRect(sx - w / 2, sy - h / 2 + 1, w, h);
    g.lineStyle(1, 0xaa8844, 0.9);
    g.strokeRect(sx - w / 2, sy - h / 2 + 1, w, h);
    g.fillStyle(0xffcc66, 0.9);
    g.fillCircle(sx, sy - h / 2 - 1, r * 0.35);
  }

  /** Vault chest icon: brown box with gold clasp */
  private drawMinimapChestIcon(
    g: Phaser.GameObjects.Graphics, sx: number, sy: number, r: number
  ): void {
    const w = r * 1.6;
    const h = r * 1.2;
    g.fillStyle(0x553311, 0.85);
    g.fillRect(sx - w / 2, sy - h / 2, w, h);
    g.lineStyle(1, 0x886633, 0.9);
    g.strokeRect(sx - w / 2, sy - h / 2, w, h);
    // Clasp
    g.fillStyle(0xddaa55, 0.9);
    g.fillCircle(sx, sy, r * 0.3);
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
    // Check loot bag or vault
    return this.lootBagUI.isOverPanel(screenX, screenY) || this.vaultUI.isOverPanel(screenX, screenY);
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
    this.scene.time.addEvent({
      delay: 16,
      repeat: 32,
      callback: () => {
        ring.clear();
        radius += 3;
        alpha -= 0.032;
        if (alpha <= 0) {
          ring.destroy();
          return;
        }
        ring.lineStyle(2, 0xffdd44, alpha);
        ring.strokeCircle(x, y, radius);
      },
    });
  }
}
