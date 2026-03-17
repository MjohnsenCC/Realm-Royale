import Phaser from "phaser";
import {
  BAG_SIZE,
  BagRarity,
  ClientMessage,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  isStackableItem,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { createEmptyItemInstance } from "@rotmg-lite/shared";
import { ItemTooltip } from "./ItemTooltip";
import { getUIScale } from "./UIScale";
import { drawItemIcon } from "./ItemIcons";
import { getItemSpriteKey, getItemOutlinedSize } from "./ItemTextures";
import { UI_PANEL_CORNER } from "./UITextures";
import type { DragManager } from "./DragManager";

const BASE_SLOT_GAP = 4;
const COLS = 4;
const ROWS = 2;
const BASE_PADDING = 8;
const BASE_HEADER = 24;

const BAG_HEADER_COLORS: Record<number, string> = {
  [BagRarity.Green]: "#44aa44",
  [BagRarity.Red]: "#cc3333",
  [BagRarity.Black]: "#cccccc",
  [BagRarity.Orange]: "#ff8800",
};

const BAG_HEADER_NAMES: Record<number, string> = {
  [BagRarity.Green]: "Green Bag",
  [BagRarity.Red]: "Red Bag",
  [BagRarity.Black]: "Black Bag",
  [BagRarity.Orange]: "Orange Bag",
};

const BAG_BORDER_COLORS: Record<number, number> = {
  [BagRarity.Green]: 0x44aa44,
  [BagRarity.Red]: 0xcc3333,
  [BagRarity.Black]: 0xaaaaaa,
  [BagRarity.Orange]: 0xff8800,
};

export class LootBagUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.NineSlice;
  private slotGraphics: Phaser.GameObjects.Graphics;
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private tierTexts: Phaser.GameObjects.Text[] = [];
  private qtyTexts: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];
  private itemImages: Phaser.GameObjects.Image[] = [];
  private slotBgImages: Phaser.GameObjects.Image[] = [];
  private headerText: Phaser.GameObjects.Text;
  private room: any = null;
  private visible: boolean = false;
  private currentBagId: string = "";
  private currentItems: ItemInstanceData[] = Array.from(
    { length: BAG_SIZE },
    () => createEmptyItemInstance()
  );
  private currentBagRarity: number = 0;
  private tooltip: ItemTooltip;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private lastHoveredItem: { item: ItemInstanceData; screenX: number; screenY: number } | null = null;

  // Drag-and-drop
  private dragManager: DragManager | null = null;
  private dragActive = false;
  private dragSourceSlot = -1;

  // Scaled dimensions
  private S: number;
  private slotSize: number;
  private slotGap: number;
  private padding: number;
  private header: number;
  private panelWidth: number;
  private panelHeight: number;

  // Position: above the unified panel, aligned with inventory section
  private anchorX: number;
  private anchorY: number;

  constructor(scene: Phaser.Scene, tooltip: ItemTooltip, invSectionX: number, unifiedPanelY: number, hudSlotSize: number) {
    this.scene = scene;
    this.tooltip = tooltip;

    if (scene.input.keyboard) {
      this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.shiftKey.on("down", () => this.refreshTooltipShift());
      this.shiftKey.on("up", () => this.refreshTooltipShift());
    }

    this.S = getUIScale();
    const S = this.S;
    this.slotSize = hudSlotSize;
    this.slotGap = Math.round(BASE_SLOT_GAP * S);
    this.padding = Math.round(BASE_PADDING * S);
    this.header = Math.round(BASE_HEADER * S);
    this.panelWidth = COLS * this.slotSize + (COLS - 1) * this.slotGap + this.padding * 2;
    this.panelHeight = ROWS * this.slotSize + (ROWS - 1) * this.slotGap + this.padding * 2 + this.header;

    this.anchorX = invSectionX - this.padding;
    this.anchorY = unifiedPanelY - this.panelHeight - Math.round(8 * S);

    const headerFontSize = `${Math.round(8 * S)}px`;
    const slotFontSize = `${Math.round(4 * S)}px`;
    const tierFontSize = `${Math.round(5 * S)}px`;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const C = UI_PANEL_CORNER;
    this.panelBg = scene.add.nineslice(0, 0, "ui-panel-header", undefined, 100, 100, C, C, C, C)
      .setOrigin(0, 0);
    this.container.add(this.panelBg);

    this.headerText = scene.add
      .text(0, 0, "Loot Bag", {
        fontSize: headerFontSize,
        color: "#44aa44",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5);
    this.container.add(this.headerText);

    this.slotGraphics = scene.add.graphics();
    this.container.add(this.slotGraphics);

    for (let i = 0; i < BAG_SIZE; i++) {
      const bgImg = scene.add.image(0, 0, "ui-slot-empty")
        .setDisplaySize(this.slotSize, this.slotSize)
        .setScrollFactor(0)
        .setDepth(101);
      this.container.add(bgImg);
      this.slotBgImages.push(bgImg);

      const zone = scene.add
        .zone(0, 0, this.slotSize, this.slotSize)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) {
          const item = this.currentItems[i];
          if (item && item.baseItemId >= 0 && this.dragManager) {
            this.dragManager.onSlotPointerDown(
              { type: "bag", bagId: this.currentBagId, slotIndex: i },
              item,
              pointer.x,
              pointer.y
            );
          }
        }
      });

      zone.on("pointerover", () => {
        if (this.dragActive) return;
        const item = this.currentItems[i];
        if (item && item.baseItemId >= 0) {
          const ptr = this.scene.input.activePointer;
          const shiftHeld = this.shiftKey?.isDown ?? false;
          this.lastHoveredItem = { item, screenX: ptr.x, screenY: ptr.y };
          this.tooltip.show(item, ptr.x, ptr.y, shiftHeld);
        }
      });
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (this.dragActive) return;
        const item = this.currentItems[i];
        if (item && item.baseItemId >= 0) {
          const shiftHeld = this.shiftKey?.isDown ?? false;
          this.lastHoveredItem = { item, screenX: pointer.x, screenY: pointer.y };
          this.tooltip.show(item, pointer.x, pointer.y, shiftHeld);
        }
      });
      zone.on("pointerout", () => {
        this.lastHoveredItem = null;
        this.tooltip.hide();
      });

      this.slotZones.push(zone);

      const text = scene.add
        .text(0, 0, "", {
          fontSize: slotFontSize,
          color: "#ffffff",
          fontFamily: "'Press Start 2P', monospace",
          align: "center",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(102)
        .setWordWrapWidth(this.slotSize - 4);
      this.itemTexts.push(text);

      const tierText = scene.add
        .text(0, 0, "", {
          fontSize: tierFontSize,
          color: "#ffffff",
          fontFamily: "'Press Start 2P', monospace",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(102);
      this.tierTexts.push(tierText);

      const qtyText = scene.add
        .text(0, 0, "", {
          fontSize: tierFontSize,
          color: "#ffffff",
          fontFamily: "'Press Start 2P', monospace",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(102);
      this.qtyTexts.push(qtyText);

      const img = scene.add.image(0, 0, "item-sword").setVisible(false);
      this.container.add(img);
      this.itemImages.push(img);
    }

    this.setVisible(false);
  }

  setRoom(room: any): void {
    this.room = room;
  }

  show(bagId: string, bagRarity: number, items: ItemInstanceData[]): void {
    this.currentBagId = bagId;
    this.currentBagRarity = bagRarity;
    for (let i = 0; i < BAG_SIZE; i++) {
      this.currentItems[i] = i < items.length ? items[i] : createEmptyItemInstance();
    }
    this.setVisible(true);
    this.redraw();
  }

  hide(): void {
    if (this.dragManager) {
      this.dragManager.cancelDrag();
    }
    this.currentBagId = "";
    this.lastHoveredItem = null;
    this.tooltip.hide();
    this.setVisible(false);
  }

  updateItems(items: ItemInstanceData[]): void {
    if (!this.visible) return;
    let changed = false;
    for (let i = 0; i < BAG_SIZE; i++) {
      const newItem = i < items.length ? items[i] : createEmptyItemInstance();
      if (this.currentItems[i].baseItemId !== newItem.baseItemId) {
        this.currentItems[i] = newItem;
        changed = true;
      }
    }
    if (changed) this.redraw();
  }

  getBagId(): string {
    return this.currentBagId;
  }

  isVisible(): boolean {
    return this.visible;
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.container.setVisible(v);
    for (const zone of this.slotZones) {
      zone.setVisible(v);
      if (v) {
        zone.setInteractive({ useHandCursor: true });
      } else {
        zone.disableInteractive();
      }
    }
    for (const text of this.itemTexts) {
      text.setVisible(v);
    }
    for (const text of this.tierTexts) {
      text.setVisible(v);
    }
    for (const text of this.qtyTexts) {
      text.setVisible(v);
    }
  }

  private redraw(): void {
    const panelX = this.anchorX;
    const panelY = this.anchorY;

    const bagBorderColor = BAG_BORDER_COLORS[this.currentBagRarity] ?? 0x44aa44;
    this.panelBg.setPosition(panelX, panelY);
    this.panelBg.setSize(this.panelWidth, this.panelHeight);
    this.panelBg.setTint(bagBorderColor);

    const headerColor = BAG_HEADER_COLORS[this.currentBagRarity] ?? "#44aa44";
    const headerName = BAG_HEADER_NAMES[this.currentBagRarity] ?? "Loot Bag";
    this.headerText.setText(headerName);
    this.headerText.setColor(headerColor);
    this.headerText.setPosition(panelX + this.panelWidth / 2, panelY + this.header / 2);

    this.slotGraphics.clear();
    for (let i = 0; i < BAG_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = panelX + this.padding + col * (this.slotSize + this.slotGap);
      const sy = panelY + this.header + this.padding + row * (this.slotSize + this.slotGap);

      const item = this.currentItems[i];
      const hasItem = item && item.baseItemId >= 0;

      const bgKey = hasItem ? "ui-slot-filled" : "ui-slot-empty";
      this.slotBgImages[i].setTexture(bgKey);
      this.slotBgImages[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
      this.slotBgImages[i].setDisplaySize(this.slotSize, this.slotSize);

      this.itemTexts[i].setText("");
      if (hasItem) {
        const category = getItemCategory(item.baseItemId);
        const subtype = getItemSubtype(item.baseItemId);
        const spriteKey = getItemSpriteKey(category, subtype, item.instanceTier, item.isUT);
        if (spriteKey) {
          const nativeSize = getItemOutlinedSize();
          this.itemImages[i]
            .setTexture(spriteKey)
            .setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2)
            .setDisplaySize(nativeSize, nativeSize)
            .setAlpha(i === this.dragSourceSlot ? 0.3 : 1)
            .clearTint()
            .setVisible(true);
        } else {
          this.itemImages[i].setVisible(false);
          const color = getItemColor(item);
          const iconSize = this.slotSize * 0.55;
          drawItemIcon(this.slotGraphics, sx + this.slotSize / 2, sy + this.slotSize / 2 - this.slotSize * 0.05, iconSize, category, subtype, color);
        }
        if (isStackableItem(item.baseItemId)) {
          const qty = item.quantity || 1;
          this.tierTexts[i].setText(`x${qty}`);
          this.qtyTexts[i].setText("");
        } else {
          const tierLabel = item.isUT ? "UT" : `T${item.instanceTier}`;
          this.tierTexts[i].setText(tierLabel);
          this.qtyTexts[i].setText("");
        }
      } else {
        this.itemImages[i].setVisible(false);
        this.tierTexts[i].setText("");
        this.qtyTexts[i].setText("");
      }
      // Drag source dim overlay
      if (i === this.dragSourceSlot) {
        this.slotGraphics.fillStyle(0x000000, 0.5);
        this.slotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);
      }

      this.tierTexts[i].setPosition(sx + this.slotSize - 2, sy + this.slotSize - 2);
      this.qtyTexts[i].setPosition(sx + 2, sy + this.slotSize - 2);
      this.itemTexts[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
      this.slotZones[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
    }
  }

  private refreshTooltipShift(): void {
    if (this.lastHoveredItem) {
      const { item, screenX, screenY } = this.lastHoveredItem;
      const shiftHeld = this.shiftKey?.isDown ?? false;
      this.tooltip.show(item, screenX, screenY, shiftHeld);
    }
  }

  getItems(): ItemInstanceData[] {
    return this.currentItems;
  }

  /** Force redraw (used by DragManager for optimistic updates) */
  redrawItems(): void {
    if (this.visible) this.redraw();
  }

  // --- Drag-and-drop support ---

  setDragManager(dm: DragManager): void {
    this.dragManager = dm;
  }

  setDragActive(active: boolean): void {
    this.dragActive = active;
    if (active) {
      this.tooltip.hide();
      this.lastHoveredItem = null;
    }
  }

  setDragSourceSlot(slotIndex: number): void {
    if (this.dragSourceSlot !== slotIndex) {
      this.dragSourceSlot = slotIndex;
      if (this.visible) this.redraw();
    }
  }

  getBagSlotBounds(): { x: number; y: number; w: number; h: number }[] {
    if (!this.visible) return [];
    const panelX = this.anchorX;
    const panelY = this.anchorY;
    const bounds: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < BAG_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      bounds.push({
        x: panelX + this.padding + col * (this.slotSize + this.slotGap),
        y: panelY + this.header + this.padding + row * (this.slotSize + this.slotGap),
        w: this.slotSize,
        h: this.slotSize,
      });
    }
    return bounds;
  }

  relayout(invSectionX: number, unifiedPanelY: number, hudSlotSize: number): void {
    this.S = getUIScale();
    const S = this.S;
    this.slotSize = hudSlotSize;
    this.slotGap = Math.round(BASE_SLOT_GAP * S);
    this.padding = Math.round(BASE_PADDING * S);
    this.header = Math.round(BASE_HEADER * S);
    this.panelWidth = COLS * this.slotSize + (COLS - 1) * this.slotGap + this.padding * 2;
    this.panelHeight = ROWS * this.slotSize + (ROWS - 1) * this.slotGap + this.padding * 2 + this.header;

    this.anchorX = invSectionX - this.padding;
    this.anchorY = unifiedPanelY - this.panelHeight - Math.round(8 * S);

    const slotFontSize = `${Math.round(4 * S)}px`;
    const tierFontSize = `${Math.round(5 * S)}px`;
    const headerFontSize = `${Math.round(8 * S)}px`;

    this.headerText.setFontSize(headerFontSize);

    for (let i = 0; i < BAG_SIZE; i++) {
      this.slotZones[i].setSize(this.slotSize, this.slotSize);
      this.itemTexts[i].setFontSize(slotFontSize);
      this.itemTexts[i].setWordWrapWidth(this.slotSize - 4);
      this.tierTexts[i].setFontSize(tierFontSize);
      this.qtyTexts[i].setFontSize(tierFontSize);
    }

    if (this.visible) this.redraw();
  }

  isOverPanel(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    const panelX = this.anchorX;
    const panelY = this.anchorY;
    return (
      screenX >= panelX &&
      screenX <= panelX + this.panelWidth &&
      screenY >= panelY &&
      screenY <= panelY + this.panelHeight
    );
  }
}
