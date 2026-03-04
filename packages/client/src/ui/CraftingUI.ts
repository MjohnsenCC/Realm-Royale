import Phaser from "phaser";
import {
  ClientMessage,
  CraftingOrbType,
  ORB_DEFINITIONS,
  STAT_NAMES,
  getStatValue,
  getItemInstanceName,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  ItemCategory,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";
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
] as const;

// Orb slot grid: 4 columns x 2 rows
const ORB_COLS = 4;

export class CraftingUI {
  private scene: Phaser.Scene;

  // Panel background (container for non-interactive visuals)
  private panelContainer: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.Graphics;

  // Title
  private titleText: Phaser.GameObjects.Text;
  private unlimitedOrbsText: Phaser.GameObjects.Text;

  // Central item slot
  private itemSlotGraphics: Phaser.GameObjects.Graphics;
  private placeholderText: Phaser.GameObjects.Text;
  private itemNameText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;

  // Orb slots (standalone for proper input handling)
  private orbSlotGraphics: Phaser.GameObjects.Graphics;
  private orbZones: Phaser.GameObjects.Zone[] = [];
  private orbNameTexts: Phaser.GameObjects.Text[] = [];
  private orbCountTexts: Phaser.GameObjects.Text[] = [];

  // Message
  private messageText: Phaser.GameObjects.Text;

  // State
  private visible = false;
  private room: any = null;
  private currentItem: ItemInstanceData | null = null;
  private currentLocation: "inventory" | "equipment" = "equipment";
  private currentSlotIndex = -1;
  private orbCounts = new Array(8).fill(0);
  private unlimitedOrbs = false;

  // Forge
  private forgeSelecting = false;
  private forgeSlotButtons: Phaser.GameObjects.Text[] = [];

  // Callbacks
  private onCloseCallback: (() => void) | null = null;

  // Layout
  private S: number;
  private px: number;
  private py: number;
  private panelWidth: number;
  private panelHeight: number;
  private itemSlotCx: number;
  private itemSlotCy: number;
  private itemSlotSize: number;

  // Orb slot layout (stored for redraw)
  private orbSlotW: number;
  private orbSlotH: number;
  private orbGapX: number;
  private orbGapY: number;
  private orbStartX: number;
  private orbStartY: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    const S = this.S;
    const pad = Math.round(10 * S);

    this.panelWidth = Math.round(280 * S);
    this.panelHeight = Math.round(380 * S);

    const screenW = scene.scale.width;
    const screenH = scene.scale.height;
    this.px = Math.round(screenW / 2 - this.panelWidth / 2);
    this.py = Math.round(screenH / 2 - this.panelHeight / 2);

    const titleFontSize = `${Math.round(13 * S)}px`;
    const nameFontSize = `${Math.round(11 * S)}px`;
    const statsFontSize = `${Math.round(9 * S)}px`;
    const smallFontSize = `${Math.round(8 * S)}px`;
    const msgFontSize = `${Math.round(9 * S)}px`;

    // --- Panel container (non-interactive visuals only) ---
    this.panelContainer = scene.add.container(0, 0).setScrollFactor(0).setDepth(250).setVisible(false);

    this.panelBg = scene.add.graphics();
    this.panelContainer.add(this.panelBg);

    this.itemSlotGraphics = scene.add.graphics();
    this.panelContainer.add(this.itemSlotGraphics);

    this.orbSlotGraphics = scene.add.graphics();
    this.panelContainer.add(this.orbSlotGraphics);

    // --- Title ---
    this.titleText = scene.add
      .text(this.px + pad, this.py + pad, "Crafting", {
        fontSize: titleFontSize,
        color: "#aaaaff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(251);

    // INF toggle label (top-right)
    this.unlimitedOrbsText = scene.add
      .text(this.px + this.panelWidth - pad, this.py + pad, "[INF OFF] (U)", {
        fontSize: smallFontSize,
        color: "#555555",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Placeholder text ---
    const placeholderY = this.py + pad + Math.round(22 * S);
    this.placeholderText = scene.add
      .text(this.px + this.panelWidth / 2, placeholderY, "Click an item to craft", {
        fontSize: statsFontSize,
        color: "#666688",
        fontFamily: "monospace",
        fontStyle: "italic",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Central item slot ---
    this.itemSlotSize = Math.round(48 * S);
    this.itemSlotCx = this.px + Math.round(this.panelWidth / 2);
    this.itemSlotCy = placeholderY + Math.round(14 * S) + Math.round(this.itemSlotSize / 2);

    // Item name (below slot)
    const nameY = this.itemSlotCy + this.itemSlotSize / 2 + Math.round(6 * S);
    this.itemNameText = scene.add
      .text(this.px + this.panelWidth / 2, nameY, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(this.panelWidth - pad * 2);

    // Stats (below item name)
    const statsY = nameY + Math.round(18 * S);
    this.statsText = scene.add
      .text(this.px + pad, statsY, "", {
        fontSize: statsFontSize,
        color: "#aaffaa",
        fontFamily: "monospace",
        lineSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(this.panelWidth - pad * 2);

    // --- Orb slots (4 cols x 2 rows) ---
    this.orbSlotW = Math.round(56 * S);
    this.orbSlotH = Math.round(42 * S);
    this.orbGapX = Math.round(5 * S);
    this.orbGapY = Math.round(5 * S);
    this.orbStartX = this.px + pad;
    this.orbStartY = this.py + Math.round(230 * S);

    for (let i = 0; i < ORB_KEYS.length; i++) {
      const col = i % ORB_COLS;
      const row = Math.floor(i / ORB_COLS);
      const sx = this.orbStartX + col * (this.orbSlotW + this.orbGapX);
      const sy = this.orbStartY + row * (this.orbSlotH + this.orbGapY);
      const orbType = ORB_KEYS[i];
      const orbDef = ORB_DEFINITIONS[orbType];
      const colorStr = `#${orbDef.color.toString(16).padStart(6, "0")}`;

      // Interactive zone (standalone, NOT in container)
      const zone = scene.add
        .zone(sx + this.orbSlotW / 2, sy + this.orbSlotH / 2, this.orbSlotW, this.orbSlotH)
        .setScrollFactor(0)
        .setDepth(252)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", () => this.onOrbClick(orbType));

      this.orbZones.push(zone);

      // Orb name text (standalone)
      const nameText = scene.add
        .text(sx + this.orbSlotW / 2, sy + this.orbSlotH - Math.round(6 * S), orbDef.name, {
          fontSize: smallFontSize,
          color: colorStr,
          fontFamily: "monospace",
        })
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(251);
      this.orbNameTexts.push(nameText);

      // Count text (standalone)
      const countText = scene.add
        .text(sx + this.orbSlotW - Math.round(3 * S), sy + Math.round(3 * S), "x0", {
          fontSize: smallFontSize,
          color: "#888888",
          fontFamily: "monospace",
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(251);
      this.orbCountTexts.push(countText);
    }

    // --- Message text ---
    const msgY = this.py + this.panelHeight - Math.round(22 * S);
    this.messageText = scene.add
      .text(this.px + pad, msgY, "", {
        fontSize: msgFontSize,
        color: "#ffaa44",
        fontFamily: "monospace",
        fontStyle: "italic",
      })
      .setScrollFactor(0)
      .setDepth(251)
      .setWordWrapWidth(this.panelWidth - pad * 2);

    // Start hidden
    this.setAllVisible(false);
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
    this.forgeSelecting = false;
    this.clearForgeSlotButtons();
    this.messageText.setText("");
    this.visible = true;
    this.setAllVisible(true);
    this.redraw();
  }

  hide(): void {
    this.visible = false;
    this.forgeSelecting = false;
    this.clearForgeSlotButtons();
    this.currentItem = null;
    this.currentSlotIndex = -1;
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
    if (item.isUT) {
      this.showMessage("Cannot craft UT items.");
      return;
    }
    const category = getItemCategory(item.baseItemId);
    if (category === ItemCategory.Consumable) {
      this.showMessage("Cannot craft consumables.");
      return;
    }
    if (category === ItemCategory.CraftingOrb) {
      this.showMessage("Cannot craft orbs.");
      return;
    }

    this.currentItem = item;
    this.currentLocation = location;
    this.currentSlotIndex = slotIndex;
    this.forgeSelecting = false;
    this.clearForgeSlotButtons();
    this.messageText.setText("");
    this.redraw();
  }

  updateOrbCounts(counts: number[]): void {
    this.orbCounts = [...counts];
    this.redrawOrbCounts();
  }

  updateItem(item: ItemInstanceData): void {
    if (item.baseItemId < 0) {
      this.currentItem = null;
      this.currentSlotIndex = -1;
      this.forgeSelecting = false;
      this.clearForgeSlotButtons();
      this.redraw();
      return;
    }
    this.currentItem = item;
    this.redraw();
  }

  toggleUnlimitedOrbs(): void {
    if (!this.room) return;
    this.unlimitedOrbs = !this.unlimitedOrbs;
    this.room.send(ClientMessage.ToggleUnlimitedOrbs);
    this.unlimitedOrbsText.setText(this.unlimitedOrbs ? "[INF ON] (U)" : "[INF OFF] (U)");
    this.unlimitedOrbsText.setColor(this.unlimitedOrbs ? "#44ff44" : "#555555");
    this.redrawOrbCounts();
    this.showMessage(this.unlimitedOrbs ? "Unlimited orbs enabled." : "Unlimited orbs disabled.");
  }

  // ---- Visibility management ----

  private setAllVisible(v: boolean): void {
    this.panelContainer.setVisible(v);
    this.titleText.setVisible(v);
    this.unlimitedOrbsText.setVisible(v);
    this.placeholderText.setVisible(v);
    this.itemNameText.setVisible(v);
    this.statsText.setVisible(v);
    this.messageText.setVisible(v);

    for (const zone of this.orbZones) {
      zone.setVisible(v);
      if (v) {
        zone.setInteractive({ useHandCursor: true });
      } else {
        zone.disableInteractive();
      }
    }
    for (const t of this.orbNameTexts) t.setVisible(v);
    for (const t of this.orbCountTexts) t.setVisible(v);
  }

  // ---- Drawing ----

  private redraw(): void {
    this.drawPanel();
    this.drawItemSlot();
    this.drawOrbSlots();
  }

  private drawPanel(): void {
    this.panelBg.clear();
    this.panelBg.fillStyle(0x111122, 0.95);
    this.panelBg.fillRoundedRect(this.px, this.py, this.panelWidth, this.panelHeight, 6);
    this.panelBg.lineStyle(2, 0x6666aa, 0.8);
    this.panelBg.strokeRoundedRect(this.px, this.py, this.panelWidth, this.panelHeight, 6);
  }

  private drawItemSlot(): void {
    this.itemSlotGraphics.clear();
    const slotX = this.itemSlotCx - this.itemSlotSize / 2;
    const slotY = this.itemSlotCy - this.itemSlotSize / 2;

    if (!this.currentItem) {
      this.placeholderText.setVisible(true);
      this.itemSlotGraphics.fillStyle(0x222233, 0.6);
      this.itemSlotGraphics.fillRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
      this.itemSlotGraphics.lineStyle(2, 0x333344, 1);
      this.itemSlotGraphics.strokeRect(slotX, slotY, this.itemSlotSize, this.itemSlotSize);
      this.itemNameText.setText("");
      this.statsText.setText("");
      return;
    }

    this.placeholderText.setVisible(false);
    const item = this.currentItem;

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

    // Stats
    const lines: string[] = [];
    if (item.lockedStat1Type >= 0 && item.lockedStat1Tier > 0) {
      const val = getStatValue(item.lockedStat1Type, item.lockedStat1Tier, item.instanceTier);
      lines.push(`[L] +${fmtVal(val)} ${STAT_NAMES[item.lockedStat1Type] ?? "???"} (T${item.lockedStat1Tier})`);
    }
    if (item.lockedStat2Type >= 0 && item.lockedStat2Tier > 0) {
      const val = getStatValue(item.lockedStat2Type, item.lockedStat2Tier, item.instanceTier);
      lines.push(`[L] +${fmtVal(val)} ${STAT_NAMES[item.lockedStat2Type] ?? "???"} (T${item.lockedStat2Tier})`);
    }
    const openCount = Math.floor(item.openStats.length / 2);
    for (let i = 0; i < item.openStats.length; i += 2) {
      const sType = item.openStats[i];
      const sTier = item.openStats[i + 1];
      const val = getStatValue(sType, sTier, item.instanceTier);
      const forge = item.forgeProtectedSlot === Math.floor(i / 2) ? " [P]" : "";
      lines.push(`+${fmtVal(val)} ${STAT_NAMES[sType] ?? "???"} (T${sTier})${forge}`);
    }
    for (let i = 0; i < 5 - openCount; i++) {
      lines.push("--- Empty ---");
    }
    this.statsText.setText(lines.join("\n"));
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
      const available = this.unlimitedOrbs || count > 0;

      // Slot background
      this.orbSlotGraphics.fillStyle(available ? 0x222244 : 0x191924, 0.8);
      this.orbSlotGraphics.fillRect(sx, sy, this.orbSlotW, this.orbSlotH);

      // Slot border (orb color when available, dim otherwise)
      this.orbSlotGraphics.lineStyle(1, available ? orbDef.color : 0x333344, available ? 0.8 : 0.4);
      this.orbSlotGraphics.strokeRect(sx, sy, this.orbSlotW, this.orbSlotH);

      // Orb circle icon in upper portion of slot
      const iconCx = sx + this.orbSlotW / 2;
      const iconCy = sy + this.orbSlotH * 0.35;
      const iconR = Math.round(6 * this.S);
      this.orbSlotGraphics.fillStyle(available ? orbDef.color : 0x333344, available ? 0.9 : 0.4);
      this.orbSlotGraphics.fillCircle(iconCx, iconCy, iconR);
      this.orbSlotGraphics.lineStyle(1, 0xffffff, available ? 0.3 : 0.1);
      this.orbSlotGraphics.strokeCircle(iconCx, iconCy, iconR);
      // Highlight dot
      if (available) {
        this.orbSlotGraphics.fillStyle(0xffffff, 0.25);
        this.orbSlotGraphics.fillCircle(iconCx - iconR * 0.25, iconCy - iconR * 0.3, iconR * 0.3);
      }

      // Update name text alpha
      this.orbNameTexts[i].setAlpha(available ? 1 : 0.35);
    }

    this.redrawOrbCounts();
  }

  private redrawOrbCounts(): void {
    for (let i = 0; i < ORB_KEYS.length; i++) {
      const count = this.orbCounts[ORB_KEYS[i]] ?? 0;
      if (this.unlimitedOrbs) {
        this.orbCountTexts[i].setText("INF");
        this.orbCountTexts[i].setColor("#44ff44");
      } else {
        this.orbCountTexts[i].setText(`x${count}`);
        this.orbCountTexts[i].setColor(count > 0 ? "#ffffff" : "#444444");
      }
    }
  }

  // ---- Orb interaction ----

  private onOrbClick(orbType: number): void {
    if (!this.room || !this.currentItem || this.currentSlotIndex < 0) {
      if (!this.currentItem) this.showMessage("Select an item first.");
      return;
    }
    if (!this.unlimitedOrbs) {
      const count = this.orbCounts[orbType] ?? 0;
      if (count <= 0) {
        this.showMessage("No orbs of this type.");
        return;
      }
    }

    if (orbType === CraftingOrbType.Forge) {
      this.startForgeSelection();
      return;
    }

    this.room.send(ClientMessage.UseCraftingOrb, {
      orbType,
      location: this.currentLocation,
      slotIndex: this.currentSlotIndex,
    });
    this.showMessage("Applying orb...");
  }

  private startForgeSelection(): void {
    if (!this.currentItem) return;
    const openCount = Math.floor(this.currentItem.openStats.length / 2);
    if (openCount === 0) {
      this.showMessage("No stats to protect.");
      return;
    }

    this.forgeSelecting = true;
    this.showMessage("Click a stat to protect:");
    this.clearForgeSlotButtons();

    const S = this.S;
    const pad = Math.round(10 * S);
    const btnFontSize = `${Math.round(9 * S)}px`;

    for (let i = 0; i < openCount; i++) {
      const sType = this.currentItem.openStats[i * 2];
      const sTier = this.currentItem.openStats[i * 2 + 1];
      const name = STAT_NAMES[sType] ?? "???";

      const btnY = this.py + this.panelHeight - Math.round((50 + (openCount - i) * 16) * S);
      const btn = this.scene.add
        .text(this.px + pad + Math.round(10 * S), btnY, `> ${name} T${sTier}`, {
          fontSize: btnFontSize,
          color: "#ffaa00",
          fontFamily: "monospace",
        })
        .setScrollFactor(0)
        .setDepth(253)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerdown", () => {
        if (!this.room) return;
        this.room.send(ClientMessage.UseCraftingOrb, {
          orbType: CraftingOrbType.Forge,
          location: this.currentLocation,
          slotIndex: this.currentSlotIndex,
          forgeSlotIndex: i,
        });
        this.forgeSelecting = false;
        this.clearForgeSlotButtons();
        this.showMessage("Forge protection applied!");
      });
      btn.on("pointerover", () => btn.setColor("#ffcc44"));
      btn.on("pointerout", () => btn.setColor("#ffaa00"));

      this.forgeSlotButtons.push(btn);
    }
  }

  private clearForgeSlotButtons(): void {
    for (const btn of this.forgeSlotButtons) {
      btn.destroy();
    }
    this.forgeSlotButtons = [];
  }

  private showMessage(msg: string): void {
    this.messageText.setText(msg);
  }
}

function fmtVal(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}
