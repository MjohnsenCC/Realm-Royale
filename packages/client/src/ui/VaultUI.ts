import Phaser from "phaser";
import {
  VAULT_SIZE,
  VAULT_COLS,
  VAULT_ROWS,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  isStackableItem,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { createEmptyItemInstance } from "@rotmg-lite/shared";
import { ItemTooltip } from "./ItemTooltip";
import { getUIScale, getScreenWidth, getScreenHeight, PANEL_REF_WIDTH } from "./UIScale";
import { drawItemIcon, getSlotBorderColor } from "./ItemIcons";
import type { DragManager } from "./DragManager";

const BASE_SLOT_GAP = 4;
const BASE_PADDING = 8;
const BASE_HEADER = 40;

const VAULT_HEADER_COLOR = "#ddaa55";
const VAULT_BORDER_COLOR = 0xddaa55;

export class VaultUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.Graphics;
  private slotGraphics: Phaser.GameObjects.Graphics;
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private tierTexts: Phaser.GameObjects.Text[] = [];
  private qtyTexts: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];
  private headerText: Phaser.GameObjects.Text;
  private room: any = null;
  private visible: boolean = false;
  private currentItems: ItemInstanceData[] = Array.from(
    { length: VAULT_SIZE },
    () => createEmptyItemInstance()
  );
  private tooltip: ItemTooltip;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private lastHoveredItem: { item: ItemInstanceData; screenX: number; screenY: number } | null = null;

  // Drag-and-drop
  private dragManager: DragManager | null = null;
  private dragActive = false;
  private dragSourceSlot = -1;
  private highlightedSlot = -1;

  // Scaled dimensions
  private S: number;
  private slotSize!: number;
  private slotGap!: number;
  private padding!: number;
  private header!: number;
  private panelWidth!: number;
  private panelHeight!: number;
  private gridContainerY!: number; // top of the slot container area
  private gridContainerH!: number; // height of the slot container area
  private cols!: number; // dynamic columns to fill container
  private externalSlotSize: number | null = null; // slot size from HUD

  // Position: left panel
  private anchorX!: number;
  private anchorY!: number;

  constructor(scene: Phaser.Scene, tooltip: ItemTooltip, hudSlotSize?: number) {
    this.scene = scene;
    this.tooltip = tooltip;

    if (scene.input.keyboard) {
      this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.shiftKey.on("down", () => this.refreshTooltipShift());
      this.shiftKey.on("up", () => this.refreshTooltipShift());
    }

    this.S = getUIScale();
    const S = this.S;
    this.externalSlotSize = hudSlotSize ?? null;
    this.computeLayout();

    const headerFontSize = `${Math.round(16 * S)}px`;
    const slotFontSize = `${Math.round(8 * S)}px`;
    const tierFontSize = `${Math.round(7 * S)}px`;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    this.panelBg = scene.add.graphics();
    this.container.add(this.panelBg);

    this.headerText = scene.add
      .text(0, 0, "Vault", {
        fontSize: headerFontSize,
        color: VAULT_HEADER_COLOR,
        fontFamily: "monospace",
        fontStyle: "bold",
      });
    this.container.add(this.headerText);

    this.slotGraphics = scene.add.graphics();
    this.container.add(this.slotGraphics);

    for (let i = 0; i < VAULT_SIZE; i++) {
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
              { type: "vault", slotIndex: i },
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
          fontFamily: "monospace",
          align: "center",
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
          fontFamily: "monospace",
        })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(102);
      this.tierTexts.push(tierText);

      const qtyText = scene.add
        .text(0, 0, "", {
          fontSize: tierFontSize,
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(102);
      this.qtyTexts.push(qtyText);
    }

    this.setVisible(false);
  }

  private computeLayout(): void {
    const S = this.S;
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();
    const margin = Math.round(12 * S);

    // Standard panel width (same as stats/crafting panels)
    this.panelWidth = Math.min(Math.round(PANEL_REF_WIDTH * S), Math.round(screenW * 0.40));
    this.padding = Math.round(BASE_PADDING * S);
    this.header = Math.round(BASE_HEADER * S);
    this.slotGap = Math.round(BASE_SLOT_GAP * S);

    // Use HUD slot size if available, otherwise derive from scale
    if (this.externalSlotSize !== null) {
      this.slotSize = this.externalSlotSize;
    } else {
      this.slotSize = Math.max(16, Math.round(36 * this.S));
    }

    // Fixed grid dimensions
    this.cols = VAULT_COLS;

    // Full height panel (top to bottom with margins, same as other panels)
    this.panelHeight = screenH - margin * 2;

    // Header area, then slot container
    this.gridContainerY = this.header + this.padding;

    // Grid container height fits exactly VAULT_ROWS rows (not full panel)
    const gridHeight = VAULT_ROWS * this.slotSize + (VAULT_ROWS - 1) * this.slotGap;
    this.gridContainerH = gridHeight + this.padding * 2;

    // Left panel position
    this.anchorX = margin;
    this.anchorY = margin;
  }

  relayout(hudSlotSize?: number): void {
    this.S = getUIScale();
    this.externalSlotSize = hudSlotSize ?? null;
    this.computeLayout();

    const S = this.S;
    const headerFontSize = `${Math.round(16 * S)}px`;
    const slotFontSize = `${Math.round(8 * S)}px`;
    const tierFontSize = `${Math.round(7 * S)}px`;

    this.headerText.setFontSize(headerFontSize);

    for (let i = 0; i < VAULT_SIZE; i++) {
      this.itemTexts[i].setFontSize(slotFontSize);
      this.itemTexts[i].setWordWrapWidth(this.slotSize - 4);
      this.tierTexts[i].setFontSize(tierFontSize);
      this.qtyTexts[i].setFontSize(tierFontSize);
      this.slotZones[i].setSize(this.slotSize, this.slotSize);
    }

    if (this.visible) this.redraw();
  }

  setRoom(room: any): void {
    this.room = room;
  }

  show(items: ItemInstanceData[]): void {
    for (let i = 0; i < VAULT_SIZE; i++) {
      this.currentItems[i] = i < items.length ? items[i] : createEmptyItemInstance();
    }
    this.setVisible(true);
    this.redraw();
  }

  hide(): void {
    if (this.dragManager) {
      this.dragManager.cancelDrag();
    }
    this.lastHoveredItem = null;
    this.tooltip.hide();
    this.setVisible(false);
  }

  updateItems(items: ItemInstanceData[]): void {
    if (!this.visible) return;
    for (let i = 0; i < VAULT_SIZE; i++) {
      this.currentItems[i] = i < items.length ? items[i] : createEmptyItemInstance();
    }
    this.redraw();
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

  private getSlotPosition(index: number): { x: number; y: number } {
    const panelX = this.anchorX;
    const panelY = this.anchorY;
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);

    const containerInnerW = this.panelWidth - this.padding * 2;
    const gridTotalW = this.cols * this.slotSize + (this.cols - 1) * this.slotGap;
    const gridOffsetX = Math.round((containerInnerW - gridTotalW) / 2);
    const gridOffsetY = this.padding;

    return {
      x: panelX + this.padding + gridOffsetX + col * (this.slotSize + this.slotGap),
      y: panelY + this.gridContainerY + gridOffsetY + row * (this.slotSize + this.slotGap),
    };
  }

  private redraw(): void {
    const panelX = this.anchorX;
    const panelY = this.anchorY;

    this.panelBg.clear();

    // Outer panel background
    this.panelBg.fillStyle(0x111122, 0.92);
    this.panelBg.fillRoundedRect(panelX, panelY, this.panelWidth, this.panelHeight, 6);
    this.panelBg.lineStyle(2, VAULT_BORDER_COLOR, 1);
    this.panelBg.strokeRoundedRect(panelX, panelY, this.panelWidth, this.panelHeight, 6);

    // Header area with decorative background
    const headerAreaH = this.header;
    this.panelBg.fillStyle(0x1a1a33, 0.8);
    this.panelBg.fillRect(panelX + 2, panelY + 2, this.panelWidth - 4, headerAreaH);
    // Gold separator line
    this.panelBg.lineStyle(2, VAULT_BORDER_COLOR, 0.8);
    this.panelBg.lineBetween(
      panelX + this.padding, panelY + headerAreaH,
      panelX + this.panelWidth - this.padding, panelY + headerAreaH
    );

    // Slot container area (inset rectangle below header)
    const containerX = panelX + this.padding;
    const containerY = panelY + this.gridContainerY;
    const containerW = this.panelWidth - this.padding * 2;
    const containerH = this.gridContainerH;
    this.panelBg.fillStyle(0x0a0a1a, 0.5);
    this.panelBg.fillRect(containerX, containerY, containerW, containerH);
    this.panelBg.lineStyle(1, 0x333355, 0.6);
    this.panelBg.strokeRect(containerX, containerY, containerW, containerH);

    // Header text centered
    this.headerText.setText("Vault");
    this.headerText.setColor(VAULT_HEADER_COLOR);
    this.headerText.setOrigin(0.5, 0.5);
    this.headerText.setPosition(panelX + this.panelWidth / 2, panelY + this.header / 2);

    this.slotGraphics.clear();
    for (let i = 0; i < VAULT_SIZE; i++) {
      const { x: sx, y: sy } = this.getSlotPosition(i);

      const item = this.currentItems[i];
      const hasItem = item && item.baseItemId >= 0;

      if (hasItem) {
        this.slotGraphics.fillStyle(0x444444, 0.4);
      } else {
        this.slotGraphics.fillStyle(0x222233, 0.6);
      }
      this.slotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);

      const tier = hasItem ? (item.isUT ? 13 : item.instanceTier) : 0;
      const slotBorder = hasItem ? getSlotBorderColor(tier) : 0x333344;
      this.slotGraphics.lineStyle(1, slotBorder, 1);
      this.slotGraphics.strokeRect(sx, sy, this.slotSize, this.slotSize);

      this.itemTexts[i].setText("");
      if (hasItem) {
        const category = getItemCategory(item.baseItemId);
        const subtype = getItemSubtype(item.baseItemId);
        const color = getItemColor(item);
        const iconSize = this.slotSize * 0.55;
        drawItemIcon(
          this.slotGraphics,
          sx + this.slotSize / 2,
          sy + this.slotSize / 2 - this.slotSize * 0.05,
          iconSize,
          category,
          subtype,
          color
        );
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
        this.tierTexts[i].setText("");
        this.qtyTexts[i].setText("");
      }
      // Drag source dim overlay
      if (i === this.dragSourceSlot) {
        this.slotGraphics.fillStyle(0x000000, 0.5);
        this.slotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);
      }
      // Drop target highlight overlay
      if (i === this.highlightedSlot) {
        this.slotGraphics.fillStyle(0x44ff44, 0.25);
        this.slotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);
        this.slotGraphics.lineStyle(2, 0x44ff44, 1);
        this.slotGraphics.strokeRect(sx, sy, this.slotSize, this.slotSize);
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

  setHighlightedVaultSlot(slotIndex: number): void {
    if (this.highlightedSlot !== slotIndex) {
      this.highlightedSlot = slotIndex;
      if (this.visible) this.redraw();
    }
  }

  setDragSourceSlot(slotIndex: number): void {
    if (this.dragSourceSlot !== slotIndex) {
      this.dragSourceSlot = slotIndex;
      if (this.visible) this.redraw();
    }
  }

  getVaultSlotBounds(): { x: number; y: number; w: number; h: number }[] {
    if (!this.visible) return [];
    const bounds: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < VAULT_SIZE; i++) {
      const { x, y } = this.getSlotPosition(i);
      bounds.push({ x, y, w: this.slotSize, h: this.slotSize });
    }
    return bounds;
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
