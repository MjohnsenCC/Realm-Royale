import Phaser from "phaser";
import {
  ClientMessage,
  CraftingOrbType,
  ORB_DEFINITIONS,
  StatType,
  STAT_NAMES,
  getStatValue,
  getStatRange,
  getLockedStatValue,
  getLockedStatRange,
  getItemInstanceName,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  ItemCategory,
  getCategoryName,
  getSubtypeName,
  getScaledWeaponStats,
  getScaledAbilityStats,
  getScaledWeaponStatsRange,
  getScaledAbilityStatsRange,
  ARMOR_LOCKED_STAT_MULTIPLIER,
  getEquippableClassNames,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale, getScreenWidth, getScreenHeight, PANEL_REF_WIDTH } from "./UIScale";
import { drawItemIcon, getSlotBorderColor } from "./ItemIcons";
import { getItemSpriteKey, getItemOutlinedSize } from "./ItemTextures";

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

function fmtVal(val: number): string {
  return String(Math.round(val));
}

function isPercentStat(sType: number): boolean {
  return (
    sType === StatType.AttackSpeed ||
    sType === StatType.PhysicalDamageReduction ||
    sType === StatType.MagicDamageReduction ||
    sType === StatType.ReducedAbilityCooldown ||
    sType === StatType.IncreasedProjectileSpeed ||
    sType === StatType.CriticalStrikeChance ||
    sType === StatType.CriticalStrikeMultiplier
  );
}

export class CraftingUI {
  private scene: Phaser.Scene;

  // Panel background (container for non-interactive visuals)
  private panelContainer: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.Graphics;

  // Title
  private titleText: Phaser.GameObjects.Text;
  // Central item slot
  private itemSlotGraphics: Phaser.GameObjects.Graphics;
  private itemImage: Phaser.GameObjects.Image | null = null;
  private placeholderText: Phaser.GameObjects.Text;

  // --- New RotMG-style item info (left-aligned, below slot) ---
  private itemNameText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private classText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;
  private lockedStatPool: Phaser.GameObjects.Text[] = [];
  private openStatPool: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }[] = [];
  private noOpenStatsText: Phaser.GameObjects.Text;
  // Graphics for divider lines within item info
  private itemInfoDividerGfx: Phaser.GameObjects.Graphics;

  // Orb slots (standalone for proper input handling)
  private orbSlotGraphics: Phaser.GameObjects.Graphics;
  private orbImages: Phaser.GameObjects.Image[] = [];
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

    const titleFontSize = `${Math.round(9 * S)}px`;
    const nameFontSize = `${Math.round(8 * S)}px`;
    const tierFontSize = `${Math.round(7 * S)}px`;
    const smallFontSize = `${Math.round(6 * S)}px`;
    const statFontSize = `${Math.round(6 * S)}px`;
    const statIconSize = Math.round(16 * S);

    const fontFamily = "'Press Start 2P', monospace";
    const stroke = "#000000";
    const strokeThickness = 2;

    const leftPad = this.px + pad;
    const wrapWidth = this.statsColumnWidth - pad * 2;

    // --- Panel container (non-interactive visuals only) ---
    this.panelContainer = scene.add.container(0, 0).setScrollFactor(0).setDepth(250).setVisible(false);

    this.panelBg = scene.add.graphics();
    this.panelContainer.add(this.panelBg);

    this.itemSlotGraphics = scene.add.graphics();
    this.panelContainer.add(this.itemSlotGraphics);

    this.itemImage = scene.add.image(0, 0, "item-sword").setVisible(false);
    this.panelContainer.add(this.itemImage);

    this.separatorGraphics = scene.add.graphics();
    this.panelContainer.add(this.separatorGraphics);

    this.orbSlotGraphics = scene.add.graphics();
    this.panelContainer.add(this.orbSlotGraphics);

    // Divider graphics for item info section
    this.itemInfoDividerGfx = scene.add.graphics().setScrollFactor(0).setDepth(251);

    // --- Title ---
    this.titleText = scene.add
      .text(this.px + this.statsColumnWidth / 2, this.py + pad, "Crafting", {
        fontSize: titleFontSize,
        color: "#aaaaff",
        fontFamily,
        fontStyle: "bold",
        stroke,
        strokeThickness,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Placeholder text ---
    const placeholderY = this.py + pad + Math.round(22 * S);
    this.placeholderText = scene.add
      .text(this.px + this.statsColumnWidth / 2, placeholderY, "Drag an item here to craft", {
        fontSize: smallFontSize,
        color: "#666688",
        fontFamily,
        fontStyle: "italic",
        stroke,
        strokeThickness,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Central item slot ---
    this.itemSlotSize = Math.round(43 * S);
    this.itemSlotCx = this.px + Math.round(this.statsColumnWidth / 2);
    this.itemSlotCy = placeholderY + Math.round(13 * S) + Math.round(this.itemSlotSize / 2);

    // --- Item info: left-aligned RotMG-style below slot ---
    const infoStartY = this.itemSlotCy + this.itemSlotSize / 2 + Math.round(8 * S);

    // Item name
    this.itemNameText = scene.add
      .text(leftPad, infoStartY, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily,
        fontStyle: "bold",
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(wrapWidth);

    // Tier label
    this.tierText = scene.add
      .text(leftPad, 0, "", {
        fontSize: tierFontSize,
        color: "#cccccc",
        fontFamily,
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // Class names
    this.classText = scene.add
      .text(leftPad, 0, "", {
        fontSize: smallFontSize,
        color: "#aaaaaa",
        fontFamily,
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(wrapWidth);

    // Description
    this.descText = scene.add
      .text(leftPad, 0, "", {
        fontSize: smallFontSize,
        color: "#888899",
        fontFamily,
        fontStyle: "italic",
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(wrapWidth);

    // Locked stat pool (2 entries, left-aligned)
    for (let i = 0; i < 2; i++) {
      const txt = scene.add
        .text(leftPad, 0, "", {
          fontSize: statFontSize,
          color: "#ffffff",
          fontFamily,
          align: "left",
          stroke,
          strokeThickness,
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(251)
        .setWordWrapWidth(wrapWidth)
        .setVisible(false);
      this.lockedStatPool.push(txt);
    }

    // Open stat pool (5 entries, each with tier icon + text)
    const iconX = leftPad + Math.round(16 * S) / 2;
    const statTextX = leftPad + Math.round(16 * S) + Math.round(3 * S);
    for (let i = 0; i < 5; i++) {
      const icon = scene.add
        .image(iconX, 0, "open-stat-icon-t1")
        .setDisplaySize(statIconSize, statIconSize)
        .setScrollFactor(0)
        .setDepth(251)
        .setVisible(false);

      const txt = scene.add
        .text(statTextX, 0, "", {
          fontSize: statFontSize,
          color: "#4488ff",
          fontFamily,
          align: "left",
          stroke,
          strokeThickness,
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(251)
        .setWordWrapWidth(wrapWidth - Math.round(16 * S) - Math.round(3 * S))
        .setVisible(false);

      this.openStatPool.push({ icon, text: txt });
    }

    // "No open stats" text
    this.noOpenStatsText = scene.add
      .text(leftPad, 0, "No open stats", {
        fontSize: statFontSize,
        color: "#4488ff",
        fontFamily,
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setVisible(false);

    // --- Static orb info panel (positioned to the right of the crafting panel) ---
    const orbInfoWidth = Math.round(160 * S);
    const orbInfoPad = Math.round(8 * S);

    this.orbInfoBg = scene.add.graphics().setScrollFactor(0).setDepth(260).setVisible(false);

    this.orbInfoNameText = scene.add
      .text(0, 0, "", {
        fontSize: `${Math.round(8 * S)}px`,
        color: "#ffffff",
        fontFamily,
        fontStyle: "bold",
        align: "center",
        stroke,
        strokeThickness,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(261)
      .setVisible(false)
      .setWordWrapWidth(orbInfoWidth - orbInfoPad * 2);

    this.orbInfoDescText = scene.add
      .text(0, 0, "", {
        fontSize: smallFontSize,
        color: "#888899",
        fontFamily,
        fontStyle: "italic",
        align: "center",
        stroke,
        strokeThickness,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(261)
      .setVisible(false)
      .setWordWrapWidth(orbInfoWidth - orbInfoPad * 2);

    // --- Orb slots (vertical strip on right side of panel) ---
    this.orbSlotW = Math.round(57 * S);
    this.orbSlotH = Math.round(32 * S);
    this.orbGapX = Math.round(8 * S);
    this.orbGapY = Math.round(8 * S);

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

      // Orb sprite image (centered in slot)
      const orbSpriteKey = getItemSpriteKey(ItemCategory.CraftingOrb, orbType);
      if (orbSpriteKey) {
        const orbImg = scene.add
          .image(sx + this.orbSlotW / 2, sy + this.orbSlotH / 2, orbSpriteKey)
          .setDisplaySize(getItemOutlinedSize(), getItemOutlinedSize())
          .setScrollFactor(0)
          .setDepth(251);
        this.panelContainer.add(orbImg);
        this.orbImages.push(orbImg);
      }

      // Count text (bottom-right of slot)
      const countText = scene.add
        .text(sx + this.orbSlotW - Math.round(8 * S), sy + this.orbSlotH - Math.round(8 * S), "x0", {
          fontSize: smallFontSize,
          color: "#888888",
          fontFamily,
          stroke,
          strokeThickness,
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
    this.orbColumnWidth = Math.round(77 * S);
    this.columnGap = Math.round(8 * S);
    this.statsColumnWidth = totalPanelW - this.columnGap - this.orbColumnWidth;
    this.panelWidth = totalPanelW;
    this.panelHeight = screenH - margin * 2;

    // Left side, top to bottom
    this.px = margin;
    this.py = margin;

    // Item slot
    this.itemSlotSize = Math.round(43 * S);
    this.itemSlotCx = this.px + Math.round(this.statsColumnWidth / 2);
    const placeholderY = this.py + pad + Math.round(22 * S);
    this.itemSlotCy = placeholderY + Math.round(13 * S) + Math.round(this.itemSlotSize / 2);

    // Orb slot sizes
    this.orbSlotW = Math.round(57 * S);
    this.orbSlotH = Math.round(32 * S);
    this.orbGapX = Math.round(8 * S);
    this.orbGapY = Math.round(8 * S);

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
    const leftPad = this.px + pad;
    const wrapWidth = this.statsColumnWidth - pad * 2;
    const statIconSize = Math.round(16 * S);

    // Reposition title
    this.titleText.setPosition(this.px + this.statsColumnWidth / 2, this.py + pad);
    this.titleText.setFontSize(`${Math.round(9 * S)}px`);

    // Reposition placeholder
    const placeholderY = this.py + pad + Math.round(22 * S);
    this.placeholderText.setPosition(this.px + this.statsColumnWidth / 2, placeholderY);
    this.placeholderText.setFontSize(`${Math.round(6 * S)}px`);

    // Update item info text positions and sizes
    const nameFontSize = `${Math.round(8 * S)}px`;
    const tierFontSize = `${Math.round(7 * S)}px`;
    const smallFontSize = `${Math.round(6 * S)}px`;
    const statFontSize = `${Math.round(6 * S)}px`;

    this.itemNameText.setX(leftPad).setFontSize(nameFontSize).setWordWrapWidth(wrapWidth);
    this.tierText.setX(leftPad).setFontSize(tierFontSize);
    this.classText.setX(leftPad).setFontSize(smallFontSize).setWordWrapWidth(wrapWidth);
    this.descText.setX(leftPad).setFontSize(smallFontSize).setWordWrapWidth(wrapWidth);
    this.noOpenStatsText.setX(leftPad).setFontSize(statFontSize);

    for (const txt of this.lockedStatPool) {
      txt.setX(leftPad).setFontSize(statFontSize).setWordWrapWidth(wrapWidth);
    }

    const iconX = leftPad + statIconSize / 2;
    const statTextX = leftPad + statIconSize + Math.round(3 * S);
    for (const entry of this.openStatPool) {
      entry.icon.setX(iconX).setDisplaySize(statIconSize, statIconSize);
      entry.text.setX(statTextX).setFontSize(statFontSize).setWordWrapWidth(wrapWidth - statIconSize - Math.round(3 * S));
    }

    // Reposition orb zones and count texts, re-bind textures (they may have
    // been regenerated by generateItemTextures during HUD relayout)
    for (let i = 0; i < ORB_KEYS.length; i++) {
      const col = i % ORB_COLS;
      const row = Math.floor(i / ORB_COLS);
      const sx = this.orbStartX + col * (this.orbSlotW + this.orbGapX);
      const sy = this.orbStartY + row * (this.orbSlotH + this.orbGapY);
      this.orbZones[i].setPosition(sx + this.orbSlotW / 2, sy + this.orbSlotH / 2);
      this.orbZones[i].setSize(this.orbSlotW, this.orbSlotH);
      this.orbCountTexts[i].setPosition(sx + this.orbSlotW - Math.round(8 * S), sy + this.orbSlotH - Math.round(8 * S));
      this.orbCountTexts[i].setFontSize(smallFontSize);
      if (this.orbImages[i]) {
        // Re-bind texture in case it was destroyed and recreated
        const orbSpriteKey = getItemSpriteKey(ItemCategory.CraftingOrb, ORB_KEYS[i]);
        if (orbSpriteKey) this.orbImages[i].setTexture(orbSpriteKey);
        const nativeSize = getItemOutlinedSize();
        this.orbImages[i].setPosition(sx + this.orbSlotW / 2, sy + this.orbSlotH / 2).setDisplaySize(nativeSize, nativeSize);
      }
    }

    // Reposition orb info texts
    const orbInfoWidth = Math.round(160 * S);
    this.orbInfoNameText.setWordWrapWidth(orbInfoWidth - Math.round(17 * S));
    this.orbInfoNameText.setFontSize(`${Math.round(8 * S)}px`);
    this.orbInfoDescText.setWordWrapWidth(orbInfoWidth - Math.round(17 * S));
    this.orbInfoDescText.setFontSize(smallFontSize);

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
    // Skip redraw if counts haven't changed
    let changed = false;
    for (let i = 0; i < counts.length; i++) {
      if (this.orbCounts[i] !== counts[i]) { changed = true; break; }
    }
    if (!changed) return;
    this.orbCounts = [...counts];
    this.redrawOrbCounts();
  }

  updateItem(item: ItemInstanceData): void {
    if (item.baseItemId < 0) {
      if (!this.currentItem) return; // already cleared
      this.currentItem = null;
      this.currentSlotIndex = -1;
      this.redraw();
      return;
    }
    // Skip redraw if the item data hasn't changed (items are re-created from schema each frame)
    if (this.currentItem && this.itemDataEqual(this.currentItem, item)) return;
    this.currentItem = item;
    this.redraw();
  }

  private itemDataEqual(a: ItemInstanceData, b: ItemInstanceData): boolean {
    if (a.baseItemId !== b.baseItemId) return false;
    if (a.instanceTier !== b.instanceTier) return false;
    if (a.lockedStat1Roll !== b.lockedStat1Roll) return false;
    if (a.lockedStat2Roll !== b.lockedStat2Roll) return false;
    if (a.forgeProtectedSlot !== b.forgeProtectedSlot) return false;
    if (a.forgeProtectedSlot2 !== b.forgeProtectedSlot2) return false;
    if (a.openStats.length !== b.openStats.length) return false;
    for (let i = 0; i < a.openStats.length; i++) {
      if (a.openStats[i] !== b.openStats[i]) return false;
    }
    return true;
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
    this.classText.setVisible(v);
    this.descText.setVisible(v);
    this.noOpenStatsText.setVisible(false);
    this.itemInfoDividerGfx.setVisible(v);
    for (const txt of this.lockedStatPool) txt.setVisible(false);
    for (const entry of this.openStatPool) { entry.icon.setVisible(false); entry.text.setVisible(false); }

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
    const sepX = this.px + this.statsColumnWidth + Math.round(8 * S);
    this.separatorGraphics.lineStyle(1, 0x444466, 0.6);
    this.separatorGraphics.lineBetween(sepX, this.py + pad, sepX, this.py + this.panelHeight - pad);
  }

  private drawItemSlot(): void {
    this.itemSlotGraphics.clear();
    this.itemInfoDividerGfx.clear();
    const slotX = this.itemSlotCx - this.itemSlotSize / 2;
    const slotY = this.itemSlotCy - this.itemSlotSize / 2;

    // Hide all item info elements first
    this.itemNameText.setText("");
    this.tierText.setText("");
    this.classText.setText("").setVisible(false);
    this.descText.setText("").setVisible(false);
    this.noOpenStatsText.setVisible(false);
    for (const txt of this.lockedStatPool) txt.setText("").setVisible(false);
    for (const entry of this.openStatPool) { entry.icon.setVisible(false); entry.text.setText("").setVisible(false); }

    if (!this.currentItem) {
      this.placeholderText.setVisible(true);
      this.itemImage?.setVisible(false);
      this.itemSlotGraphics.fillStyle(0x222233, 0.6);
      this.itemSlotGraphics.fillRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
      this.itemSlotGraphics.lineStyle(1, 0x333344, 1);
      this.itemSlotGraphics.strokeRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
      return;
    }

    this.placeholderText.setVisible(false);
    const item = this.currentItem;
    const S = this.S;
    const pad = Math.round(12 * S);
    const leftPad = this.px + pad;
    const statIconSize = Math.round(16 * S);

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
    const spriteKey = getItemSpriteKey(category, subtype);
    if (spriteKey && this.itemImage) {
      const nativeSize = getItemOutlinedSize();
      this.itemImage
        .setTexture(spriteKey)
        .setPosition(this.itemSlotCx, this.itemSlotCy)
        .setDisplaySize(nativeSize, nativeSize)
        .setAlpha(1)
        .clearTint()
        .setVisible(true);
    } else {
      this.itemImage?.setVisible(false);
      const color = getItemColor(item);
      drawItemIcon(this.itemSlotGraphics, this.itemSlotCx, this.itemSlotCy, this.itemSlotSize * 0.6, category, subtype, color);
    }

    // Consistent spacing constants
    const sectionGap = Math.round(8 * S);
    const lineGap = Math.round(3 * S);

    let currentY = this.itemSlotCy + this.itemSlotSize / 2 + Math.round(8 * S);

    // Item name (left-aligned)
    this.itemNameText.setText(getItemInstanceName(item));
    this.itemNameText.setY(currentY);
    currentY += this.itemNameText.height + lineGap;

    // Tier label
    this.tierText.setText(`T${item.instanceTier} ${getCategoryName(category)}`);
    this.tierText.setY(currentY);
    currentY += this.tierText.height + lineGap;

    // Class names
    const classNames = getEquippableClassNames(category, subtype);
    if (classNames.length > 0) {
      this.classText.setText(classNames.join(", "));
      this.classText.setY(currentY);
      this.classText.setVisible(true);
      currentY += this.classText.height + lineGap;
    }

    // Description placeholder
    const subtypeName = getSubtypeName(category, subtype);
    let desc = "";
    if (category === ItemCategory.Weapon) desc = `A powerful ${subtypeName.toLowerCase()}.`;
    else if (category === ItemCategory.Ability) desc = `A mystic ${subtypeName.toLowerCase()}.`;
    else if (category === ItemCategory.Armor) desc = `A sturdy ${subtypeName.toLowerCase()}.`;
    else if (category === ItemCategory.Ring) desc = "A ring imbued with magical energy.";
    if (desc) {
      this.descText.setText(desc);
      this.descText.setY(currentY);
      this.descText.setVisible(true);
      currentY += this.descText.height;
    }

    // === Build locked stats (value determined by item tier + roll, no stat tiers) ===
    const lockedLines: string[] = [];

    if (category === ItemCategory.Weapon) {
      const ws = getScaledWeaponStats(subtype, item.instanceTier, item.lockedStat1Roll, item.lockedStat2Roll);
      const wRange = getScaledWeaponStatsRange(subtype, item.instanceTier);
      lockedLines.push(`Damage: ${ws.damage}(${wRange.damageMin}-${wRange.damageMax})`);
      const frMin = (1000 / wRange.shootCooldownMax).toFixed(1);
      const frMax = (1000 / wRange.shootCooldownMin).toFixed(1);
      lockedLines.push(`Fire Rate: ${(1000 / ws.shootCooldown).toFixed(1)}(${frMin}-${frMax})/s`);
    } else if (category === ItemCategory.Ability) {
      const as = getScaledAbilityStats(subtype, item.instanceTier, item.lockedStat1Roll, item.lockedStat2Roll);
      const aRange = getScaledAbilityStatsRange(subtype, item.instanceTier);
      lockedLines.push(`Damage: ${as.damage}(${aRange.damageMin}-${aRange.damageMax})`);
      lockedLines.push(`Mana Cost: ${as.manaCost}(${aRange.manaCostMin}-${aRange.manaCostMax})`);
    } else {
      // Armor and Ring: locked stat values determined by item tier
      const armorMult = category === ItemCategory.Armor
        ? (ARMOR_LOCKED_STAT_MULTIPLIER[subtype] ?? 1.0)
        : 1.0;
      if (item.lockedStat1Type >= 0) {
        const rawVal = getLockedStatValue(item.lockedStat1Type, item.instanceTier, item.lockedStat1Roll);
        const val = armorMult !== 1.0 ? Math.round(rawVal * armorMult) : rawVal;
        const name = STAT_NAMES[item.lockedStat1Type] ?? "???";
        const [rawMin, rawMax] = getLockedStatRange(item.lockedStat1Type, item.instanceTier);
        const min = armorMult !== 1.0 ? Math.round(rawMin * armorMult) : rawMin;
        const max = armorMult !== 1.0 ? Math.round(rawMax * armorMult) : rawMax;
        lockedLines.push(`+${fmtVal(val)}(${fmtVal(min)}-${fmtVal(max)}) ${name}`);
      }
      if (item.lockedStat2Type >= 0) {
        const rawVal = getLockedStatValue(item.lockedStat2Type, item.instanceTier, item.lockedStat2Roll);
        const val = armorMult !== 1.0 ? Math.round(rawVal * armorMult) : rawVal;
        const name = STAT_NAMES[item.lockedStat2Type] ?? "???";
        const [rawMin, rawMax] = getLockedStatRange(item.lockedStat2Type, item.instanceTier);
        const min = armorMult !== 1.0 ? Math.round(rawMin * armorMult) : rawMin;
        const max = armorMult !== 1.0 ? Math.round(rawMax * armorMult) : rawMax;
        lockedLines.push(`+${fmtVal(val)}(${fmtVal(min)}-${fmtVal(max)}) ${name}`);
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
      const suffix = isPercentStat(sType) ? "%" : "";
      const [min, max] = getStatRange(sType, sTier);
      const tierSuffix = `  T${sTier}`;
      openEntries.push({
        text: `+${fmtVal(val)}(${fmtVal(min)}-${fmtVal(max)})${suffix} ${STAT_NAMES[sType] ?? "???"}${tierSuffix}`,
        tier: sTier,
        forgeProtected,
      });
    }

    // === Layout locked stats ===
    const dividerYs: number[] = [];

    if (lockedLines.length > 0) {
      currentY += sectionGap;
      dividerYs.push(currentY);
      currentY += sectionGap;

      for (let i = 0; i < lockedLines.length; i++) {
        const txt = this.lockedStatPool[i];
        txt.setText(lockedLines[i]);
        txt.setColor("#ffffff");
        txt.setY(currentY);
        txt.setVisible(true);
        currentY += txt.height + lineGap;
      }
    }

    // === Layout open stats ===
    if (openEntries.length > 0) {
      currentY += sectionGap;
      dividerYs.push(currentY);
      currentY += sectionGap;

      for (let i = 0; i < openEntries.length && i < this.openStatPool.length; i++) {
        const entry = this.openStatPool[i];
        const tierKey = `open-stat-icon-t${Math.min(Math.max(openEntries[i].tier, 1), 6)}`;
        entry.icon.setTexture(tierKey);
        entry.icon.setDisplaySize(statIconSize, statIconSize);
        entry.text.setText(openEntries[i].text);
        entry.text.setColor(openEntries[i].forgeProtected ? "#ffaa00" : "#4488ff");
        entry.text.setVisible(true);

        const rowH = Math.max(entry.text.height, statIconSize);
        entry.text.setY(currentY + (rowH - entry.text.height) / 2);
        entry.icon.setY(currentY + rowH / 2);
        entry.icon.setVisible(true);

        currentY += rowH + lineGap;
      }
    } else {
      currentY += sectionGap;
      dividerYs.push(currentY);
      currentY += sectionGap;

      this.noOpenStatsText.setY(currentY);
      this.noOpenStatsText.setVisible(true);
    }

    // Draw divider lines
    this.itemInfoDividerGfx.clear();
    this.itemInfoDividerGfx.lineStyle(1, 0x555566, 0.6);
    for (const y of dividerYs) {
      this.itemInfoDividerGfx.beginPath();
      this.itemInfoDividerGfx.moveTo(leftPad, y);
      this.itemInfoDividerGfx.lineTo(leftPad + this.statsColumnWidth - pad * 2, y);
      this.itemInfoDividerGfx.strokePath();
    }
  }

  private drawOrbSlots(): void {
    this.orbSlotGraphics.clear();

    for (let i = 0; i < ORB_KEYS.length; i++) {
      const col = i % ORB_COLS;
      const row = Math.floor(i / ORB_COLS);
      const sx = this.orbStartX + col * (this.orbSlotW + this.orbGapX);
      const sy = this.orbStartY + row * (this.orbSlotH + this.orbGapY);
      const orbType = ORB_KEYS[i];
      const count = this.orbCounts[orbType] ?? 0;
      const available = count > 0;

      // Slot background
      this.orbSlotGraphics.fillStyle(0x222233, 0.6);
      this.orbSlotGraphics.fillRoundedRect(sx, sy, this.orbSlotW, this.orbSlotH, 4);

      // Slot border (always the same neutral color)
      this.orbSlotGraphics.lineStyle(1, 0x333344, 1);
      this.orbSlotGraphics.strokeRoundedRect(sx, sy, this.orbSlotW, this.orbSlotH, 4);

      // Orb sprite icon (dimmed if count is 0)
      if (this.orbImages[i]) {
        // Re-bind texture in case it was destroyed and recreated by generateItemTextures
        const orbSpriteKey = getItemSpriteKey(ItemCategory.CraftingOrb, orbType);
        if (orbSpriteKey) this.orbImages[i].setTexture(orbSpriteKey);
        const nativeSize = getItemOutlinedSize();
        this.orbImages[i]
          .setPosition(sx + this.orbSlotW / 2, sy + this.orbSlotH / 2)
          .setDisplaySize(nativeSize, nativeSize)
          .setAlpha(available ? 1 : 0.35);
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
    const gap = Math.round(8 * S);

    // Set text content
    const colorStr = `#${orbDef.color.toString(16).padStart(6, "0")}`;
    this.orbInfoNameText.setColor(colorStr);
    this.orbInfoNameText.setText(orbDef.name);
    this.orbInfoDescText.setText(orbDef.description);

    // Calculate height
    const nameH = this.orbInfoNameText.height;
    const descH = this.orbInfoDescText.height;
    const infoHeight = infoPad + nameH + Math.round(8 * S) + descH + infoPad;

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

    this.orbInfoDescText.setPosition(cx, infoY + infoPad + nameH + Math.round(8 * S));
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
