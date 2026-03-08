import Phaser from "phaser";
import {
  ClientMessage,
  CraftingOrbType,
  ORB_DEFINITIONS,
  StatType,
  STAT_NAMES,
  getStatValue,
  getStatRange,
  getItemInstanceName,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  ItemCategory,
  getCategoryName,
  getScaledWeaponStats,
  getScaledAbilityStats,
  getScaledWeaponStatsRange,
  getScaledAbilityStatsRange,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale, getScreenWidth, getScreenHeight, PANEL_REF_WIDTH } from "./UIScale";
import { drawItemIcon, getSlotBorderColor } from "./ItemIcons";

const ORB_KEYS = [
  CraftingOrbType.Blank,
  CraftingOrbType.Ember,
  CraftingOrbType.Shard,
  CraftingOrbType.Chaos,
  CraftingOrbType.Flux,
  CraftingOrbType.Void,
  CraftingOrbType.Prism,
  CraftingOrbType.Forge,
  CraftingOrbType.Calibrate,
  CraftingOrbType.Divine,
] as const;

// Orb slot grid: 1 column (vertical strip on right side)
const ORB_COLS = 1;

export class CraftingUI {
  private scene: Phaser.Scene;

  // Panel background (container for non-interactive visuals)
  private panelContainer: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.Graphics;

  // Title
  private titleText: Phaser.GameObjects.Text;
  // Central item slot
  private itemSlotGraphics: Phaser.GameObjects.Graphics;
  private placeholderText: Phaser.GameObjects.Text;
  private itemNameText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private dividerAboveLockedText: Phaser.GameObjects.Text;
  private lockedStatsText: Phaser.GameObjects.Text;
  private dividerBelowLockedText: Phaser.GameObjects.Text;
  private openStatsText: Phaser.GameObjects.Text;
  private hiddenStatsText: Phaser.GameObjects.Text;
  private shiftHintText: Phaser.GameObjects.Text;

  // Pool for individual stat lines with tier labels
  private statPool: { tier: Phaser.GameObjects.Text; stat: Phaser.GameObjects.Text }[] = [];

  // Orb slots (standalone for proper input handling)
  private orbSlotGraphics: Phaser.GameObjects.Graphics;
  private orbZones: Phaser.GameObjects.Zone[] = [];
  private orbCountTexts: Phaser.GameObjects.Text[] = [];

  // Separator between item info and orbs
  private separatorGraphics: Phaser.GameObjects.Graphics;

  // Static orb info panel (shown to the side when hovering an orb)
  private orbInfoBg: Phaser.GameObjects.Graphics;
  private orbInfoNameText: Phaser.GameObjects.Text;
  private orbInfoDescText: Phaser.GameObjects.Text;

  // State
  private visible = false;
  private room: any = null;
  private currentItem: ItemInstanceData | null = null;
  private currentLocation: "inventory" | "equipment" = "equipment";
  private currentSlotIndex = -1;
  private orbCounts = new Array(10).fill(0);

  // Callbacks
  private onCloseCallback: (() => void) | null = null;

  // Layout
  private S: number;
  private px!: number;
  private py!: number;
  private panelWidth!: number;
  private panelHeight!: number;
  private statsColumnWidth!: number;
  private itemSlotCx!: number;
  private itemSlotCy!: number;
  private itemSlotSize!: number;

  // Orb slot layout (stored for redraw)
  private orbSlotW!: number;
  private orbSlotH!: number;
  private orbGapX!: number;
  private orbGapY!: number;
  private orbStartX!: number;
  private orbStartY!: number;
  private columnGap!: number;
  private orbColumnWidth!: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    const S = this.S;
    const pad = Math.round(12 * S);

    this.computeLayout();

    const titleFontSize = `${Math.round(13 * S)}px`;
    const nameFontSize = `${Math.round(12 * S)}px`;
    const tierFontSize = `${Math.round(10 * S)}px`;
    const statsFontSize = `${Math.round(10 * S)}px`;
    const tieredStatFontSize = `${Math.round(9 * S)}px`;
    const dividerFontSize = `${Math.round(9 * S)}px`;
    const smallFontSize = `${Math.round(8 * S)}px`;

    // --- Panel container (non-interactive visuals only) ---
    this.panelContainer = scene.add.container(0, 0).setScrollFactor(0).setDepth(250).setVisible(false);

    this.panelBg = scene.add.graphics();
    this.panelContainer.add(this.panelBg);

    this.itemSlotGraphics = scene.add.graphics();
    this.panelContainer.add(this.itemSlotGraphics);

    this.separatorGraphics = scene.add.graphics();
    this.panelContainer.add(this.separatorGraphics);

    this.orbSlotGraphics = scene.add.graphics();
    this.panelContainer.add(this.orbSlotGraphics);

    // --- Title ---
    this.titleText = scene.add
      .text(this.px + this.statsColumnWidth / 2, this.py + pad, "Crafting", {
        fontSize: titleFontSize,
        color: "#aaaaff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Placeholder text ---
    const placeholderY = this.py + pad + Math.round(22 * S);
    this.placeholderText = scene.add
      .text(this.px + this.statsColumnWidth / 2, placeholderY, "Drag an item here to craft", {
        fontSize: `${Math.round(9 * S)}px`,
        color: "#666688",
        fontFamily: "monospace",
        fontStyle: "italic",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Central item slot ---
    this.itemSlotSize = Math.round(44 * S);
    this.itemSlotCx = this.px + Math.round(this.statsColumnWidth / 2);
    this.itemSlotCy = placeholderY + Math.round(14 * S) + Math.round(this.itemSlotSize / 2);

    const cx = this.px + this.statsColumnWidth / 2;
    const wrapWidth = this.statsColumnWidth - pad * 2;

    // Item name (below slot)
    const nameY = this.itemSlotCy + this.itemSlotSize / 2 + Math.round(6 * S);
    this.itemNameText = scene.add
      .text(cx, nameY, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(wrapWidth);

    // Tier label (below name)
    const tierY = nameY + Math.round(16 * S);
    this.tierText = scene.add
      .text(cx, tierY, "", {
        fontSize: tierFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // Divider above locked stats
    this.dividerAboveLockedText = scene.add
      .text(cx, 0, "", {
        fontSize: dividerFontSize,
        color: "#555566",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // Locked stats
    this.lockedStatsText = scene.add
      .text(cx, 0, "", {
        fontSize: tieredStatFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        lineSpacing: Math.round(4 * S),
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(wrapWidth);

    // Divider below locked stats
    this.dividerBelowLockedText = scene.add
      .text(cx, 0, "", {
        fontSize: dividerFontSize,
        color: "#555566",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // Open stats
    this.openStatsText = scene.add
      .text(cx, 0, "", {
        fontSize: tieredStatFontSize,
        color: "#4488ff",
        fontFamily: "monospace",
        lineSpacing: Math.round(4 * S),
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(wrapWidth);

    // Hidden stats (shift-only, for weapons/abilities)
    this.hiddenStatsText = scene.add
      .text(cx, 0, "", {
        fontSize: tieredStatFontSize,
        color: "#aaffaa",
        fontFamily: "monospace",
        lineSpacing: Math.round(4 * S),
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(wrapWidth);

    // Shift hint
    this.shiftHintText = scene.add
      .text(cx, 0, "[SHIFT] for more info", {
        fontSize: `${Math.round(9 * S)}px`,
        color: "#888888",
        fontFamily: "monospace",
        fontStyle: "italic",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // Pool of tier label + stat line pairs for detailed stat display
    const tierLabelFontSize = `${Math.round(8 * S)}px`;
    for (let i = 0; i < 8; i++) {
      const tierLabel = scene.add
        .text(cx, 0, "", {
          fontSize: tierLabelFontSize,
          color: "#888888",
          fontFamily: "monospace",
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(251)
        .setVisible(false);

      const statLabel = scene.add
        .text(cx, 0, "", {
          fontSize: tieredStatFontSize,
          color: "#ffffff",
          fontFamily: "monospace",
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(251)
        .setWordWrapWidth(wrapWidth)
        .setVisible(false);

      this.statPool.push({ tier: tierLabel, stat: statLabel });
    }

    // --- Static orb info panel (positioned to the right of the crafting panel) ---
    const orbInfoWidth = Math.round(160 * S);
    const orbInfoPad = Math.round(8 * S);

    this.orbInfoBg = scene.add.graphics().setScrollFactor(0).setDepth(260).setVisible(false);

    this.orbInfoNameText = scene.add
      .text(0, 0, "", {
        fontSize: `${Math.round(11 * S)}px`,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(261)
      .setVisible(false)
      .setWordWrapWidth(orbInfoWidth - orbInfoPad * 2);

    this.orbInfoDescText = scene.add
      .text(0, 0, "", {
        fontSize: `${Math.round(9 * S)}px`,
        color: "#888899",
        fontFamily: "monospace",
        fontStyle: "italic",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(261)
      .setVisible(false)
      .setWordWrapWidth(orbInfoWidth - orbInfoPad * 2);

    // --- Orb slots (vertical strip on right side of panel) ---
    this.orbSlotW = Math.round(56 * S);
    this.orbSlotH = Math.round(32 * S);
    this.orbGapX = Math.round(4 * S);
    this.orbGapY = Math.round(4 * S);

    // Position in the right column, vertically centered
    const orbRows = Math.ceil(ORB_KEYS.length / ORB_COLS);
    const totalGridH = orbRows * this.orbSlotH + (orbRows - 1) * this.orbGapY;
    const totalGridW = ORB_COLS * this.orbSlotW;
    const rightColumnX = this.px + this.statsColumnWidth + this.columnGap;
    this.orbStartX = rightColumnX + Math.round((this.orbColumnWidth - totalGridW) / 2);
    this.orbStartY = this.py + Math.round((this.panelHeight - totalGridH) / 2);

    for (let i = 0; i < ORB_KEYS.length; i++) {
      const col = i % ORB_COLS;
      const row = Math.floor(i / ORB_COLS);
      const sx = this.orbStartX + col * (this.orbSlotW + this.orbGapX);
      const sy = this.orbStartY + row * (this.orbSlotH + this.orbGapY);
      const orbType = ORB_KEYS[i];

      // Interactive zone (standalone, NOT in container)
      const zone = scene.add
        .zone(sx + this.orbSlotW / 2, sy + this.orbSlotH / 2, this.orbSlotW, this.orbSlotH)
        .setScrollFactor(0)
        .setDepth(252)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", () => this.onOrbClick(orbType));
      zone.on("pointerover", () => this.showOrbInfo(orbType, i));
      zone.on("pointerout", () => this.hideOrbInfo());

      this.orbZones.push(zone);

      // Count text (bottom-right of slot)
      const countText = scene.add
        .text(sx + this.orbSlotW - Math.round(2 * S), sy + this.orbSlotH - Math.round(2 * S), "x0", {
          fontSize: smallFontSize,
          color: "#888888",
          fontFamily: "monospace",
        })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(251);
      this.orbCountTexts.push(countText);
    }

    // Start hidden
    this.setAllVisible(false);
  }

  private computeLayout(): void {
    const S = this.S;
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();
    const pad = Math.round(12 * S);
    const margin = Math.round(12 * S);

    // Left panel: 30% width
    const totalPanelW = Math.min(Math.round(PANEL_REF_WIDTH * S), Math.round(screenW * 0.40));
    this.orbColumnWidth = Math.round(76 * S);
    this.columnGap = Math.round(8 * S);
    this.statsColumnWidth = totalPanelW - this.columnGap - this.orbColumnWidth;
    this.panelWidth = totalPanelW;
    this.panelHeight = screenH - margin * 2;

    // Left side, top to bottom
    this.px = margin;
    this.py = margin;

    // Item slot
    this.itemSlotSize = Math.round(44 * S);
    this.itemSlotCx = this.px + Math.round(this.statsColumnWidth / 2);
    const placeholderY = this.py + pad + Math.round(22 * S);
    this.itemSlotCy = placeholderY + Math.round(14 * S) + Math.round(this.itemSlotSize / 2);

    // Orb slot sizes
    this.orbSlotW = Math.round(56 * S);
    this.orbSlotH = Math.round(32 * S);
    this.orbGapX = Math.round(4 * S);
    this.orbGapY = Math.round(4 * S);

    const orbRows = Math.ceil(ORB_KEYS.length / ORB_COLS);
    const totalGridH = orbRows * this.orbSlotH + (orbRows - 1) * this.orbGapY;
    const totalGridW = ORB_COLS * this.orbSlotW;
    const rightColumnX = this.px + this.statsColumnWidth + this.columnGap;
    this.orbStartX = rightColumnX + Math.round((this.orbColumnWidth - totalGridW) / 2);
    this.orbStartY = this.py + Math.round((this.panelHeight - totalGridH) / 2);
  }

  relayout(): void {
    this.S = getUIScale();
    this.computeLayout();

    const S = this.S;
    const pad = Math.round(12 * S);

    // Reposition title
    this.titleText.setPosition(this.px + this.statsColumnWidth / 2, this.py + pad);
    this.titleText.setFontSize(`${Math.round(13 * S)}px`);

    // Reposition placeholder
    const placeholderY = this.py + pad + Math.round(22 * S);
    this.placeholderText.setPosition(this.px + this.statsColumnWidth / 2, placeholderY);
    this.placeholderText.setFontSize(`${Math.round(9 * S)}px`);

    // Update text positions
    const cx = this.px + this.statsColumnWidth / 2;
    const wrapWidth = this.statsColumnWidth - pad * 2;
    const nameY = this.itemSlotCy + this.itemSlotSize / 2 + Math.round(6 * S);
    this.itemNameText.setPosition(cx, nameY);
    this.itemNameText.setFontSize(`${Math.round(12 * S)}px`);
    this.itemNameText.setWordWrapWidth(wrapWidth);

    const tierY = nameY + Math.round(16 * S);
    this.tierText.setPosition(cx, tierY);
    this.tierText.setFontSize(`${Math.round(10 * S)}px`);

    this.dividerAboveLockedText.setX(cx);
    this.lockedStatsText.setX(cx);
    this.lockedStatsText.setWordWrapWidth(wrapWidth);
    this.dividerBelowLockedText.setX(cx);
    this.openStatsText.setX(cx);
    this.openStatsText.setWordWrapWidth(wrapWidth);
    this.hiddenStatsText.setX(cx);
    this.hiddenStatsText.setWordWrapWidth(wrapWidth);
    this.shiftHintText.setX(cx);

    const tieredStatFontSize = `${Math.round(9 * S)}px`;
    const dividerFontSize = `${Math.round(9 * S)}px`;
    this.dividerAboveLockedText.setFontSize(dividerFontSize);
    this.lockedStatsText.setFontSize(tieredStatFontSize);
    this.dividerBelowLockedText.setFontSize(dividerFontSize);
    this.openStatsText.setFontSize(tieredStatFontSize);
    this.hiddenStatsText.setFontSize(tieredStatFontSize);

    for (const entry of this.statPool) {
      entry.tier.setX(cx);
      entry.tier.setFontSize(`${Math.round(8 * S)}px`);
      entry.stat.setX(cx);
      entry.stat.setFontSize(tieredStatFontSize);
      entry.stat.setWordWrapWidth(wrapWidth);
    }

    // Reposition orb zones and count texts
    const smallFontSize = `${Math.round(8 * S)}px`;
    for (let i = 0; i < ORB_KEYS.length; i++) {
      const col = i % ORB_COLS;
      const row = Math.floor(i / ORB_COLS);
      const sx = this.orbStartX + col * (this.orbSlotW + this.orbGapX);
      const sy = this.orbStartY + row * (this.orbSlotH + this.orbGapY);
      this.orbZones[i].setPosition(sx + this.orbSlotW / 2, sy + this.orbSlotH / 2);
      this.orbZones[i].setSize(this.orbSlotW, this.orbSlotH);
      this.orbCountTexts[i].setPosition(sx + this.orbSlotW - Math.round(2 * S), sy + this.orbSlotH - Math.round(2 * S));
      this.orbCountTexts[i].setFontSize(smallFontSize);
    }

    // Reposition orb info texts
    const orbInfoWidth = Math.round(160 * S);
    this.orbInfoNameText.setWordWrapWidth(orbInfoWidth - Math.round(16 * S));
    this.orbInfoNameText.setFontSize(`${Math.round(11 * S)}px`);
    this.orbInfoDescText.setWordWrapWidth(orbInfoWidth - Math.round(16 * S));
    this.orbInfoDescText.setFontSize(`${Math.round(9 * S)}px`);

    if (this.visible) this.redraw();
  }

  setRoom(room: any): void {
    this.room = room;
  }

  setOnClose(callback: (() => void) | null): void {
    this.onCloseCallback = callback;
  }

  show(orbCounts: number[]): void {
    this.currentItem = null;
    this.currentLocation = "equipment";
    this.currentSlotIndex = -1;
    this.orbCounts = [...orbCounts];
    this.visible = true;
    this.setAllVisible(true);
    this.redraw();
  }

  hide(): void {
    this.visible = false;
    this.currentItem = null;
    this.currentSlotIndex = -1;
    this.hideOrbInfo();
    this.setAllVisible(false);
    if (this.onCloseCallback) this.onCloseCallback();
  }

  isVisible(): boolean {
    return this.visible;
  }

  getCurrentLocation(): "inventory" | "equipment" {
    return this.currentLocation;
  }

  getCurrentSlotIndex(): number {
    return this.currentSlotIndex;
  }

  selectItem(item: ItemInstanceData, location: "inventory" | "equipment", slotIndex: number): void {
    if (item.baseItemId < 0) return;
    if (item.isUT) return;
    const category = getItemCategory(item.baseItemId);
    if (category === ItemCategory.Consumable) return;
    if (category === ItemCategory.CraftingOrb) return;

    this.currentItem = item;
    this.currentLocation = location;
    this.currentSlotIndex = slotIndex;
    this.redraw();
  }

  getItemSlotBounds(): { x: number; y: number; w: number; h: number } | null {
    if (!this.visible) return null;
    return {
      x: this.itemSlotCx - this.itemSlotSize / 2,
      y: this.itemSlotCy - this.itemSlotSize / 2,
      w: this.itemSlotSize,
      h: this.itemSlotSize,
    };
  }

  setHighlighted(on: boolean): void {
    if (!this.visible) return;
    const slotX = this.itemSlotCx - this.itemSlotSize / 2;
    const slotY = this.itemSlotCy - this.itemSlotSize / 2;
    this.itemSlotGraphics.clear();
    this.itemSlotGraphics.fillStyle(0x222233, 0.6);
    this.itemSlotGraphics.fillRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
    this.itemSlotGraphics.lineStyle(2, on ? 0x44ff44 : 0x333344, 1);
    this.itemSlotGraphics.strokeRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
  }

  updateOrbCounts(counts: number[]): void {
    this.orbCounts = [...counts];
    this.redrawOrbCounts();
  }

  updateItem(item: ItemInstanceData): void {
    if (item.baseItemId < 0) {
      this.currentItem = null;
      this.currentSlotIndex = -1;
      this.redraw();
      return;
    }
    this.currentItem = item;
    this.redraw();
  }

  giveTestOrbs(): void {
    if (!this.room) return;
    this.room.send(ClientMessage.ToggleUnlimitedOrbs);
  }

  // ---- Visibility management ----

  private setAllVisible(v: boolean): void {
    this.panelContainer.setVisible(v);
    this.titleText.setVisible(v);
    this.placeholderText.setVisible(v);
    this.itemNameText.setVisible(v);
    this.tierText.setVisible(v);
    this.dividerAboveLockedText.setVisible(v);
    this.lockedStatsText.setVisible(v);
    this.dividerBelowLockedText.setVisible(v);
    this.openStatsText.setVisible(v);
    this.hiddenStatsText.setVisible(v);
    this.shiftHintText.setVisible(v);
    for (const entry of this.statPool) { entry.tier.setVisible(v); entry.stat.setVisible(v); }

    for (const zone of this.orbZones) {
      zone.setVisible(v);
      if (v) {
        zone.setInteractive({ useHandCursor: true });
      } else {
        zone.disableInteractive();
      }
    }
    for (const t of this.orbCountTexts) t.setVisible(v);

    if (!v) this.hideOrbInfo();
  }

  // ---- Drawing ----

  private redraw(): void {
    this.drawPanel();
    this.drawItemSlot();
    this.drawSeparator();
    this.drawOrbSlots();
  }

  private drawPanel(): void {
    this.panelBg.clear();
    this.panelBg.fillStyle(0x111122, 0.95);
    this.panelBg.fillRoundedRect(this.px, this.py, this.panelWidth, this.panelHeight, 8);
    this.panelBg.lineStyle(2, 0x6666aa, 0.8);
    this.panelBg.strokeRoundedRect(this.px, this.py, this.panelWidth, this.panelHeight, 8);
  }

  private drawSeparator(): void {
    this.separatorGraphics.clear();
    const S = this.S;
    const pad = Math.round(12 * S);
    // Vertical separator between stats column and orb column
    const sepX = this.px + this.statsColumnWidth + Math.round(4 * S);
    this.separatorGraphics.lineStyle(1, 0x444466, 0.6);
    this.separatorGraphics.lineBetween(sepX, this.py + pad, sepX, this.py + this.panelHeight - pad);
  }

  private drawItemSlot(): void {
    this.itemSlotGraphics.clear();
    const slotX = this.itemSlotCx - this.itemSlotSize / 2;
    const slotY = this.itemSlotCy - this.itemSlotSize / 2;

    if (!this.currentItem) {
      this.placeholderText.setVisible(true);
      this.itemSlotGraphics.fillStyle(0x222233, 0.6);
      this.itemSlotGraphics.fillRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
      this.itemSlotGraphics.lineStyle(1, 0x333344, 1);
      this.itemSlotGraphics.strokeRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
      this.itemNameText.setText("");
      this.tierText.setText("");
      this.dividerAboveLockedText.setText("");
      this.lockedStatsText.setText("");
      this.dividerBelowLockedText.setText("");
      this.openStatsText.setText("");
      this.hiddenStatsText.setText("");
      this.hiddenStatsText.setVisible(false);
      this.shiftHintText.setVisible(false);
      for (const entry of this.statPool) { entry.tier.setVisible(false); entry.stat.setVisible(false); }
      return;
    }

    this.placeholderText.setVisible(false);
    const item = this.currentItem;
    const S = this.S;
    // Slot background with tier border
    const tier = item.isUT ? 13 : item.instanceTier;
    const borderColor = getSlotBorderColor(tier);
    this.itemSlotGraphics.fillStyle(0x444444, 0.4);
    this.itemSlotGraphics.fillRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
    this.itemSlotGraphics.lineStyle(2, borderColor, 1);
    this.itemSlotGraphics.strokeRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);

    // Item icon
    const category = getItemCategory(item.baseItemId);
    const subtype = getItemSubtype(item.baseItemId);
    const color = getItemColor(item);
    drawItemIcon(this.itemSlotGraphics, this.itemSlotCx, this.itemSlotCy, this.itemSlotSize * 0.6, category, subtype, color);

    // Item name
    this.itemNameText.setText(getItemInstanceName(item));

    // Tier label
    this.tierText.setText(`T${item.instanceTier} ${getCategoryName(category)}`);

    // === Build locked stats per category ===
    const lockedEntries: { text: string; tier: number | null }[] = [];

    if (category === ItemCategory.Weapon) {
      const ws = getScaledWeaponStats(subtype, item.instanceTier, item.lockedStat1Tier, item.lockedStat2Tier, item.lockedStat1Roll, item.lockedStat2Roll);
      const wRange = getScaledWeaponStatsRange(subtype, item.instanceTier, item.lockedStat1Tier, item.lockedStat2Tier);
      lockedEntries.push({ text: `Damage: ${ws.damage}(${wRange.damageMin}-${wRange.damageMax})`, tier: item.lockedStat1Tier > 0 ? item.lockedStat1Tier : null });
      const frMin = (1000 / wRange.shootCooldownMax).toFixed(1);
      const frMax = (1000 / wRange.shootCooldownMin).toFixed(1);
      lockedEntries.push({ text: `Fire Rate: ${(1000 / ws.shootCooldown).toFixed(1)}(${frMin}-${frMax})/s`, tier: item.lockedStat2Tier > 0 ? item.lockedStat2Tier : null });
    } else if (category === ItemCategory.Ability) {
      const as = getScaledAbilityStats(subtype, item.instanceTier, item.lockedStat1Tier, item.lockedStat2Tier, item.lockedStat1Roll, item.lockedStat2Roll);
      const aRange = getScaledAbilityStatsRange(subtype, item.instanceTier, item.lockedStat1Tier, item.lockedStat2Tier);
      lockedEntries.push({ text: `Damage: ${as.damage}(${aRange.damageMin}-${aRange.damageMax})`, tier: item.lockedStat1Tier > 0 ? item.lockedStat1Tier : null });
      lockedEntries.push({ text: `Mana Cost: ${as.manaCost}(${aRange.manaCostMin}-${aRange.manaCostMax})`, tier: item.lockedStat2Tier > 0 ? item.lockedStat2Tier : null });
    } else {
      // Armor and Ring: use rolled locked stat bonuses
      if (item.lockedStat1Type >= 0 && item.lockedStat1Tier > 0) {
        const val = getStatValue(item.lockedStat1Type, item.lockedStat1Tier, item.lockedStat1Roll, true);
        const name = STAT_NAMES[item.lockedStat1Type] ?? "???";
        const [min, max] = getStatRange(item.lockedStat1Type, item.lockedStat1Tier, true);
        lockedEntries.push({ text: `+${fmtVal(val)}(${fmtVal(min)}-${fmtVal(max)}) ${name}`, tier: item.lockedStat1Tier });
      }
      if (item.lockedStat2Type >= 0 && item.lockedStat2Tier > 0) {
        const val = getStatValue(item.lockedStat2Type, item.lockedStat2Tier, item.lockedStat2Roll, true);
        const name = STAT_NAMES[item.lockedStat2Type] ?? "???";
        const [min, max] = getStatRange(item.lockedStat2Type, item.lockedStat2Tier, true);
        lockedEntries.push({ text: `+${fmtVal(val)}(${fmtVal(min)}-${fmtVal(max)}) ${name}`, tier: item.lockedStat2Tier });
      }
    }

    // === Build open stats ===
    const openEntries: { text: string; tier: number; forgeProtected: boolean }[] = [];
    for (let i = 0; i < item.openStats.length; i += 3) {
      const sType = item.openStats[i];
      const sTier = item.openStats[i + 1];
      const sRoll = item.openStats[i + 2];
      const val = getStatValue(sType, sTier, sRoll);
      const slotIdx = Math.floor(i / 3);
      const forgeProtected = item.forgeProtectedSlot === slotIdx || item.forgeProtectedSlot2 === slotIdx;
      const suffix = (sType === StatType.AttackSpeed || sType === StatType.PhysicalDamageReduction || sType === StatType.MagicDamageReduction) ? "%" : "";
      const [min, max] = getStatRange(sType, sTier);
      openEntries.push({ text: `+${fmtVal(val)}(${fmtVal(min)}-${fmtVal(max)})${suffix} ${STAT_NAMES[sType] ?? "???"}`, tier: sTier, forgeProtected });
    }

    // === Layout using pool with tier labels ===
    let currentY = this.tierText.y + this.tierText.height + Math.round(2 * S);
    let poolIdx = 0;

    // Hide multi-line text objects (using pool instead)
    this.lockedStatsText.setText("");
    this.openStatsText.setText("");

    // Divider above locked stats
    if (lockedEntries.length > 0) {
      this.dividerAboveLockedText.setText("────────────");
      this.dividerAboveLockedText.setY(currentY);
      currentY += this.dividerAboveLockedText.height + 2;
    } else {
      this.dividerAboveLockedText.setText("");
    }

    // Locked stats with tier labels
    for (let i = 0; i < lockedEntries.length && poolIdx < this.statPool.length; i++) {
      const entry = this.statPool[poolIdx];
      const tierNum = lockedEntries[i].tier;
      if (tierNum != null) {
        entry.tier.setText(`(Tier: ${tierNum})`);
        entry.tier.setY(currentY);
        entry.tier.setVisible(true);
        currentY += entry.tier.height + 1;
      } else {
        entry.tier.setVisible(false);
      }
      entry.stat.setText(lockedEntries[i].text);
      entry.stat.setColor("#ffffff");
      entry.stat.setY(currentY);
      entry.stat.setVisible(true);
      currentY += entry.stat.height + 2;
      poolIdx++;
    }

    // Divider below locked stats
    if (lockedEntries.length > 0) {
      this.dividerBelowLockedText.setText("────────────");
      this.dividerBelowLockedText.setY(currentY);
      currentY += this.dividerBelowLockedText.height + 2;
    } else {
      this.dividerBelowLockedText.setText("");
    }

    // Open stats with tier labels
    for (let i = 0; i < openEntries.length && poolIdx < this.statPool.length; i++) {
      const entry = this.statPool[poolIdx];
      entry.tier.setText(`(Tier: ${openEntries[i].tier})`);
      entry.tier.setY(currentY);
      entry.tier.setVisible(true);
      currentY += entry.tier.height + 1;
      entry.stat.setText(openEntries[i].text);
      entry.stat.setColor(openEntries[i].forgeProtected ? "#ffaa00" : "#4488ff");
      entry.stat.setY(currentY);
      entry.stat.setVisible(true);
      currentY += entry.stat.height + 2;
      poolIdx++;
    }

    if (openEntries.length === 0) {
      this.openStatsText.setText("No open stats");
      this.openStatsText.setY(currentY);
      currentY += this.openStatsText.height + 2;
    }

    // Hide unused pool entries
    for (let i = poolIdx; i < this.statPool.length; i++) {
      this.statPool[i].tier.setVisible(false);
      this.statPool[i].stat.setVisible(false);
    }

    this.hiddenStatsText.setText("");
    this.hiddenStatsText.setVisible(false);

    this.shiftHintText.setVisible(false);
  }

  private drawOrbSlots(): void {
    this.orbSlotGraphics.clear();

    for (let i = 0; i < ORB_KEYS.length; i++) {
      const col = i % ORB_COLS;
      const row = Math.floor(i / ORB_COLS);
      const sx = this.orbStartX + col * (this.orbSlotW + this.orbGapX);
      const sy = this.orbStartY + row * (this.orbSlotH + this.orbGapY);
      const orbType = ORB_KEYS[i];
      const orbDef = ORB_DEFINITIONS[orbType];
      const count = this.orbCounts[orbType] ?? 0;
      const available = count > 0;

      // Slot background
      this.orbSlotGraphics.fillStyle(0x222233, 0.6);
      this.orbSlotGraphics.fillRoundedRect(sx, sy, this.orbSlotW, this.orbSlotH, 4);

      // Slot border (always the same neutral color)
      this.orbSlotGraphics.lineStyle(1, 0x333344, 1);
      this.orbSlotGraphics.strokeRoundedRect(sx, sy, this.orbSlotW, this.orbSlotH, 4);

      // Orb circle icon centered in slot (always shown with orb color, dimmed if count is 0)
      const iconCx = sx + this.orbSlotW / 2;
      const iconCy = sy + this.orbSlotH / 2;
      const iconR = Math.round(8 * this.S);
      this.orbSlotGraphics.fillStyle(orbDef.color, available ? 0.9 : 0.35);
      this.orbSlotGraphics.fillCircle(iconCx, iconCy, iconR);
      this.orbSlotGraphics.lineStyle(1, 0xffffff, available ? 0.3 : 0.1);
      this.orbSlotGraphics.strokeCircle(iconCx, iconCy, iconR);
      // Highlight dot
      if (available) {
        this.orbSlotGraphics.fillStyle(0xffffff, 0.25);
        this.orbSlotGraphics.fillCircle(iconCx - iconR * 0.25, iconCy - iconR * 0.3, iconR * 0.3);
      }
    }

    this.redrawOrbCounts();
  }

  private redrawOrbCounts(): void {
    for (let i = 0; i < ORB_KEYS.length; i++) {
      const count = this.orbCounts[ORB_KEYS[i]] ?? 0;
      this.orbCountTexts[i].setText(`x${count}`);
      this.orbCountTexts[i].setColor(count > 0 ? "#ffffff" : "#444444");
    }
  }

  // ---- Orb info (static side panel) ----

  private showOrbInfo(orbType: number, orbIndex: number): void {
    const orbDef = ORB_DEFINITIONS[orbType];
    if (!orbDef) return;

    const S = this.S;
    const infoPad = Math.round(8 * S);
    const infoWidth = Math.round(160 * S);
    const gap = Math.round(6 * S);

    // Set text content
    const colorStr = `#${orbDef.color.toString(16).padStart(6, "0")}`;
    this.orbInfoNameText.setColor(colorStr);
    this.orbInfoNameText.setText(orbDef.name);
    this.orbInfoDescText.setText(orbDef.description);

    // Calculate height
    const nameH = this.orbInfoNameText.height;
    const descH = this.orbInfoDescText.height;
    const infoHeight = infoPad + nameH + Math.round(4 * S) + descH + infoPad;

    // Position to the right of the crafting panel; flip left if no room
    const screenW = this.scene.scale.width;
    const screenH = this.scene.scale.height;
    let infoX = this.px + this.panelWidth + gap;
    if (infoX + infoWidth > screenW - 4) {
      infoX = this.px - infoWidth - gap;
    }
    // Vertically align with the hovered orb slot
    const orbRow = Math.floor(orbIndex / ORB_COLS);
    let infoY = this.orbStartY + orbRow * (this.orbSlotH + this.orbGapY);
    // Clamp so the info panel stays on screen
    infoY = Math.min(infoY, screenH - infoHeight - 4);

    // Draw background
    this.orbInfoBg.clear();
    this.orbInfoBg.fillStyle(0x111122, 0.95);
    this.orbInfoBg.fillRoundedRect(infoX, infoY, infoWidth, infoHeight, 6);
    this.orbInfoBg.lineStyle(1, 0x6666aa, 0.6);
    this.orbInfoBg.strokeRoundedRect(infoX, infoY, infoWidth, infoHeight, 6);
    this.orbInfoBg.setVisible(true);

    // Position text
    const cx = infoX + infoWidth / 2;
    this.orbInfoNameText.setPosition(cx, infoY + infoPad);
    this.orbInfoNameText.setVisible(true);

    this.orbInfoDescText.setPosition(cx, infoY + infoPad + nameH + Math.round(4 * S));
    this.orbInfoDescText.setVisible(true);
  }

  private hideOrbInfo(): void {
    this.orbInfoBg.setVisible(false);
    this.orbInfoNameText.setVisible(false);
    this.orbInfoDescText.setVisible(false);
  }

  // ---- Orb interaction ----

  private onOrbClick(orbType: number): void {
    if (!this.room || !this.currentItem || this.currentSlotIndex < 0) return;
    const count = this.orbCounts[orbType] ?? 0;
    if (count <= 0) return;

    this.room.send(ClientMessage.UseCraftingOrb, {
      orbType,
      location: this.currentLocation,
      slotIndex: this.currentSlotIndex,
    });
  }
}

function fmtVal(val: number): string {
  return String(Math.round(val));
}
