import Phaser from "phaser";
import { PlayerSprite } from "../entities/PlayerSprite";
import { EnemySprite } from "../entities/EnemySprite";
import { InventoryUI } from "./InventoryUI";
import { LootBagUI } from "./LootBagUI";
import { VaultUI } from "./VaultUI";
import { DragManager } from "./DragManager";
import { getUIScale, getScreenWidth, getScreenHeight } from "./UIScale";
import { drawItemIcon } from "./ItemIcons";
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
  DungeonTile,
  isHostileZone,
  isVaultZone,
  ItemCategory,
  ConsumableSubtype,
  HEALTH_POT_ID,
  MANA_POT_ID,
  PORTAL_GEM_ID,
  createEmptyItemInstance,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";

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

  // Q hint
  private qHintText: Phaser.GameObjects.Text;

  // Consumable slots (below equipment)
  private consumableGraphics: Phaser.GameObjects.Graphics;
  private consumableCountTexts: Phaser.GameObjects.Text[] = [];
  private consumableKeyTexts: Phaser.GameObjects.Text[] = [];
  private consumableSlotPositions: { x: number; y: number }[] = [];
  private consumableZones: Phaser.GameObjects.Zone[] = [];
  private consumableSlotSize: number = 0;
  private currentConsumables: [number, number, number] = [0, 0, 0];
  private dragActive: boolean = false;
  private dragSourceConsumableSlot: number = -1;
  private highlightedConsumableSlot: number = -1;

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
      .text(screenW / 2, hintY, "Q: Nexus  |  SPACE: Ability  |  E: Portal  |  F: HP Pot  |  G: MP Pot  |  P: Stats", {
        fontSize: hintFontSize,
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // --- Consumable slots (below equipment slots, same size as regular slots) ---
    this.consumableGraphics = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.consumableSlotSize = this.slotSize;
    const eqW = 4 * this.slotSize + 3 * this.slotGap;
    const consRowW = 3 * this.slotSize + 2 * this.iconGap;
    const consRowX = this.eqX + Math.round((eqW - consRowW) / 2);
    const consRowY = this.eqY + this.slotSize + this.iconGap;

    const keyLabels = ["F", "G", ""];
    const countFontSm = `${Math.round(10 * S)}px`;
    const keyFontSm = `${Math.round(8 * S)}px`;

    for (let i = 0; i < 3; i++) {
      const ix = consRowX + i * (this.slotSize + this.iconGap);
      this.consumableSlotPositions.push({ x: ix, y: consRowY });

      // Count text (bottom-right)
      const countText = scene.add
        .text(ix + this.slotSize - 2, consRowY + this.slotSize - 2, "", {
          fontSize: countFontSm,
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(103);
      this.consumableCountTexts.push(countText);

      // Key label (top-left)
      const keyText = scene.add
        .text(ix + 2, consRowY + 1, keyLabels[i], {
          fontSize: keyFontSm,
          color: "#aaaaaa",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(103);
      this.consumableKeyTexts.push(keyText);
    }

    // Consumable slot interactive zones (tooltip + drag source)
    const consumableItemIds = [HEALTH_POT_ID, MANA_POT_ID, PORTAL_GEM_ID];
    for (let i = 0; i < 3; i++) {
      const pos = this.consumableSlotPositions[i];
      const zone = scene.add
        .zone(pos.x + this.slotSize / 2, pos.y + this.slotSize / 2, this.slotSize, this.slotSize)
        .setScrollFactor(0)
        .setDepth(104)
        .setInteractive({ useHandCursor: true });

      // Drag source: pointerdown starts drag
      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown() && this.currentConsumables[i] > 0 && this.dragManager) {
          const itemId = consumableItemIds[i];
          const fakeItem: ItemInstanceData = {
            baseItemId: itemId,
            instanceTier: 1,
            isUT: false,
            lockedStat1Type: -1,
            lockedStat1Tier: 0,
            lockedStat1Roll: 0,
            lockedStat2Type: -1,
            lockedStat2Tier: 0,
            lockedStat2Roll: 0,
            openStats: [],
            forgeProtectedSlot: -1,
            forgeProtectedSlot2: -1,
            quantity: 0,
          };
          this.dragManager.onSlotPointerDown(
            { type: "consumable", slotIndex: i },
            fakeItem,
            pointer.x,
            pointer.y
          );
        }
      });

      // Tooltips (show even when empty to indicate slot purpose)
      zone.on("pointerover", () => {
        if (this.dragActive) return;
        const ptr = this.scene.input.activePointer;
        this.inventoryUI.getTooltip().showById(consumableItemIds[i], ptr.x, ptr.y);
      });
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (this.dragActive) return;
        this.inventoryUI.getTooltip().showById(consumableItemIds[i], pointer.x, pointer.y);
      });
      zone.on("pointerout", () => {
        this.inventoryUI.getTooltip().hide();
      });

      this.consumableZones.push(zone);
    }

    this.drawConsumableSlots();

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
    this.lootBagUI = new LootBagUI(scene, this.inventoryUI.getTooltip(), this.invX, this.panelY);

    // --- Vault UI (left panel, full height) ---
    this.vaultUI = new VaultUI(scene, this.inventoryUI.getTooltip());

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
    this.panelW = Math.round(screenW * 0.30);
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
    const eqSectionH = this.slotSize + this.iconGap + this.slotSize;
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
    const hintFontSize = `${Math.round(11 * S)}px`;

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
    this.qHintText.setFontSize(hintFontSize);

    // Update consumable slot positions
    const consRowW = 3 * this.slotSize + 2 * this.iconGap;
    const eqW = 4 * this.slotSize + 3 * this.slotGap;
    const consRowX = this.eqX + Math.round((eqW - consRowW) / 2);
    const consRowY = this.eqY + this.slotSize + this.iconGap;
    this.consumableSlotSize = this.slotSize;

    const countFontSm = `${Math.round(10 * S)}px`;
    const keyFontSm = `${Math.round(8 * S)}px`;
    for (let i = 0; i < 3; i++) {
      const ix = consRowX + i * (this.slotSize + this.iconGap);
      this.consumableSlotPositions[i] = { x: ix, y: consRowY };
      this.consumableCountTexts[i].setFontSize(countFontSm);
      this.consumableKeyTexts[i].setFontSize(keyFontSm);
      this.consumableZones[i].setPosition(ix + this.slotSize / 2, consRowY + this.slotSize / 2);
      this.consumableZones[i].setSize(this.slotSize, this.slotSize);
    }

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

    // Invalidate minimap cache on resize
    this.invalidateMinimapCache();

    // Relayout sub-UIs
    this.inventoryUI.relayout({
      eqX: this.eqX,
      eqY: this.eqY,
      invX: this.invX,
      invY: this.invY,
      slotSize: this.slotSize,
      slotGap: this.slotGap,
    });

    this.lootBagUI.relayout(this.invX, this.panelY);
    this.vaultUI.relayout();

    this.drawConsumableSlots();
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
    healthPots: number = 0,
    manaPots: number = 0,
    portalGems: number = 0
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
    } else if (isVaultZone(zone)) {
      this.zoneText.setText("Vault");
      this.zoneText.setColor("#ddaa55");
      this.qHintText.setVisible(true);
    } else if (isDungeonZone(zone)) {
      const dungeonType = getDungeonTypeFromZone(zone);
      const dungeonVisual = dungeonType !== undefined ? DUNGEON_VISUALS[dungeonType] : undefined;
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

    // Update consumable slot display
    const newConsumables: [number, number, number] = [healthPots, manaPots, portalGems];
    if (
      newConsumables[0] !== this.currentConsumables[0] ||
      newConsumables[1] !== this.currentConsumables[1] ||
      newConsumables[2] !== this.currentConsumables[2]
    ) {
      this.currentConsumables = newConsumables;
      this.drawConsumableSlots();
    }

    // Draw minimap
    this.drawMinimap(localX, localY, players, enemies, zone);
  }

  private invalidateMinimapCache(): void {
    this.minimapBiomeCached = false;
    this.minimapBiomeCachedZone = "";
    this.minimapBiomeGraphics.clear();
  }

  private drawConsumableSlots(): void {
    this.consumableGraphics.clear();
    const size = this.consumableSlotSize;
    const colors = [0xcc3333, 0x4466cc, 0xaa44ff];
    const subtypes = [ConsumableSubtype.HealthPot, ConsumableSubtype.ManaPot, ConsumableSubtype.PortalGem];

    for (let i = 0; i < 3; i++) {
      const pos = this.consumableSlotPositions[i];
      const count = this.currentConsumables[i];
      const isDragSource = this.dragSourceConsumableSlot === i;
      const isHighlighted = this.highlightedConsumableSlot === i;

      // Background
      this.consumableGraphics.fillStyle(count > 0 ? colors[i] : 0x222233, count > 0 ? 0.3 : 0.6);
      this.consumableGraphics.fillRect(pos.x, pos.y, size, size);

      // Drag source overlay (dim)
      if (isDragSource) {
        this.consumableGraphics.fillStyle(0x000000, 0.5);
        this.consumableGraphics.fillRect(pos.x, pos.y, size, size);
      }

      // Drop target highlight (green)
      if (isHighlighted) {
        this.consumableGraphics.fillStyle(0x44ff44, 0.25);
        this.consumableGraphics.fillRect(pos.x, pos.y, size, size);
      }

      // Icon (always show using drawItemIcon)
      const cx = pos.x + size / 2;
      const cy = pos.y + size / 2;
      const iconSize = size * 0.55;
      const iconColor = count > 0 ? colors[i] : (colors[i] & 0x7f7f7f); // dimmer when empty
      drawItemIcon(this.consumableGraphics, cx, cy - size * 0.05, iconSize, ItemCategory.Consumable, subtypes[i], iconColor);

      // Border
      const borderColor = isHighlighted ? 0x44ff44 : (count > 0 ? colors[i] : 0x333344);
      const borderAlpha = isHighlighted ? 0.8 : 0.8;
      this.consumableGraphics.lineStyle(1, borderColor, borderAlpha);
      this.consumableGraphics.strokeRect(pos.x, pos.y, size, size);

      // Count text
      this.consumableCountTexts[i].setText(count > 0 ? `${count}` : "");
    }
  }

  // --- Drag & drop support for consumable slots ---

  setDragActive(active: boolean): void {
    this.dragActive = active;
    if (!active) {
      this.dragSourceConsumableSlot = -1;
      this.highlightedConsumableSlot = -1;
      this.drawConsumableSlots();
    }
  }

  setDragSourceConsumableSlot(slot: number): void {
    this.dragSourceConsumableSlot = slot;
    this.drawConsumableSlots();
  }

  setHighlightedConsumableSlot(slot: number): void {
    if (this.highlightedConsumableSlot !== slot) {
      this.highlightedConsumableSlot = slot;
      this.drawConsumableSlots();
    }
  }

  getConsumableSlotBounds(): { x: number; y: number; w: number; h: number }[] {
    const size = this.consumableSlotSize;
    return this.consumableSlotPositions.map(pos => ({
      x: pos.x,
      y: pos.y,
      w: size,
      h: size,
    }));
  }

  setStatsButtonCallback(cb: () => void): void {
    this.onStatsButtonClick = cb;
  }

  setPortalGemCallback(cb: (worldX: number, worldY: number) => void): void {
    this.portalGemCallback = cb;

    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) return;
      if (this.currentConsumables[2] <= 0) return;

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
    zone: string
  ): void {
    const zoneDims = getZoneDimensions(zone);
    const mapW = zoneDims.width;
    const mapH = zoneDims.height;

    // Compute visible region based on zoom
    const zoom = zone === "nexus" ? 1 : this.minimapZoom;
    const visibleW = mapW / zoom;
    const visibleH = mapH / zoom;
    const viewX = Math.max(0, Math.min(localX - visibleW / 2, mapW - visibleW));
    const viewY = Math.max(0, Math.min(localY - visibleH / 2, mapH - visibleH));

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

    // Background
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x111122, 0.7);
    this.minimapBg.fillRect(mmX, mmY, this.mmWidth, this.mmHeight);
    this.minimapBg.lineStyle(1, 0x444466, 1);
    this.minimapBg.strokeRect(mmX, mmY, this.mmWidth, this.mmHeight);

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
    } else if (zone === "nexus") {
      if (!canUseCache) {
        this.minimapBiomeGraphics.clear();
        this.renderMinimapNexus(mmX, mmY, viewX, viewY, visibleW, visibleH);
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

    // Enemy dots (red)
    this.minimapDots.fillStyle(0xcc3333, 0.8);
    const syncRadiusSq = ENEMY_SYNC_RADIUS * ENEMY_SYNC_RADIUS;
    enemies.forEach((enemy) => {
      const ex = enemy.x - localX;
      const ey = enemy.y - localY;
      if (ex * ex + ey * ey > syncRadiusSq) return;
      const dx = mmX + (enemy.x - viewX) * scaleX;
      const dy = mmY + (enemy.y - viewY) * scaleY;
      if (dx < mmX || dx > mmX + this.mmWidth || dy < mmY || dy > mmY + this.mmHeight) return;
      this.minimapDots.fillRect(dx - 1, dy - 1, 3, 3);
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


    // Reposition zoom buttons inside bottom-right corner of minimap
    const btnPad = Math.round(3 * this.S);
    this.minimapZoomOutBtn.setPosition(
      mmX + this.mmWidth - btnPad,
      mmY + this.mmHeight - btnPad
    );
    this.minimapZoomInBtn.setPosition(
      this.minimapZoomOutBtn.x - this.minimapZoomOutBtn.width - Math.round(2 * this.S),
      mmY + this.mmHeight - btnPad
    );

    // Hide zoom buttons in nexus (full map always shown)
    const inNexus = zone === "nexus";
    this.minimapZoomInBtn.setVisible(!inNexus);
    this.minimapZoomOutBtn.setVisible(!inNexus);
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

  private renderMinimapNexus(
    mmX: number,
    mmY: number,
    viewX: number,
    viewY: number,
    viewW: number,
    viewH: number
  ): void {
    const mapData = generateNexusMap();
    const { tiles, width, height } = mapData;
    const ts = TILE_SIZE;
    const scaleX = this.mmWidth / viewW;
    const scaleY = this.mmHeight / viewH;

    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty * width + tx] !== DungeonTile.Floor) continue;

        const worldX = tx * ts;
        const worldY = ty * ts;

        // Skip tiles outside visible region
        if (worldX + ts < viewX || worldX > viewX + viewW) continue;
        if (worldY + ts < viewY || worldY > viewY + viewH) continue;

        const sx = mmX + (worldX - viewX) * scaleX;
        const sy = mmY + (worldY - viewY) * scaleY;
        const sw = ts * scaleX;
        const sh = ts * scaleY;

        this.minimapBiomeGraphics.fillStyle(0x2a4a2a, 0.9);
        this.minimapBiomeGraphics.fillRect(sx, sy, Math.ceil(sw), Math.ceil(sh));
      }
    }
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
