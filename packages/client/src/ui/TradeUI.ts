import Phaser from "phaser";
import {
  INVENTORY_SIZE,
  EQUIPMENT_SLOTS,
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
import { UI_PANEL_CORNER, UI_BTN_CORNER } from "./UITextures";
import { addText } from "./TextFactory";
import { NetworkManager } from "../network/NetworkManager";

const COLS = 4;
const ROWS = 2;
const BASE_SLOT_GAP = 4;
const BASE_PADDING = 8;
const BASE_HEADER = 24;

export class TradeUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.NineSlice;
  private slotGraphics: Phaser.GameObjects.Graphics;
  private headerText: Phaser.GameObjects.Text;
  private partnerConfirmText: Phaser.GameObjects.Text;

  // Partner inventory display
  private invSlotBgImages: Phaser.GameObjects.Image[] = [];
  private invItemImages: Phaser.GameObjects.Image[] = [];
  private invTierTexts: Phaser.GameObjects.Text[] = [];
  private invQtyTexts: Phaser.GameObjects.Text[] = [];
  private invSlotZones: Phaser.GameObjects.Zone[] = [];

  // Trade/Exit buttons
  private tradeBtnBg: Phaser.GameObjects.NineSlice;
  private tradeBtnText: Phaser.GameObjects.Text;
  private tradeBtnZone: Phaser.GameObjects.Zone;
  private exitBtnBg: Phaser.GameObjects.NineSlice;
  private exitBtnText: Phaser.GameObjects.Text;
  private exitBtnZone: Phaser.GameObjects.Zone;

  // State
  private visible = false;
  private partnerName = "";
  private partnerInventory: ItemInstanceData[] = Array.from({ length: INVENTORY_SIZE }, () => createEmptyItemInstance());
  private partnerEquipment: ItemInstanceData[] = Array.from({ length: EQUIPMENT_SLOTS }, () => createEmptyItemInstance());
  private partnerSelectedSlots: { index: number; source: string }[] = [];
  private partnerConfirmed = false;
  private ownConfirmed = false;

  // Tooltip
  private tooltip: ItemTooltip;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private lastHoveredItem: { item: ItemInstanceData; screenX: number; screenY: number } | null = null;

  // Dimensions
  private S: number;
  private slotSize: number;
  private slotGap: number;
  private padding: number;
  private header: number;
  private panelWidth: number;
  private panelHeight: number;
  private anchorX: number;
  private anchorY: number;

  constructor(scene: Phaser.Scene, tooltip: ItemTooltip, invSectionX: number, unifiedPanelY: number, hudSlotSize: number) {
    this.scene = scene;
    this.tooltip = tooltip;

    if (scene.input.keyboard) {
      this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    this.S = getUIScale();
    const S = this.S;
    this.slotSize = hudSlotSize;
    this.slotGap = Math.round(BASE_SLOT_GAP * S);
    this.padding = Math.round(BASE_PADDING * S);
    this.header = Math.round(BASE_HEADER * S);

    // Panel sized to fit: header + inv grid (4x2)
    const invGridH = ROWS * this.slotSize + (ROWS - 1) * this.slotGap;
    const btnH = Math.round(16 * S);

    this.panelWidth = COLS * this.slotSize + (COLS - 1) * this.slotGap + this.padding * 2;
    this.panelHeight = this.header + invGridH + this.padding * 2;

    this.anchorX = invSectionX - this.padding;
    this.anchorY = unifiedPanelY - this.panelHeight - Math.round(8 * S);

    const headerFontSize = `${Math.round(8 * S)}px`;
    const slotFontSize = `${Math.round(4 * S)}px`;
    const tierFontSize = `${Math.round(5 * S)}px`;
    const btnFontSize = `${Math.round(7 * S)}px`;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const C = UI_PANEL_CORNER;
    this.panelBg = scene.add.nineslice(0, 0, "ui-panel-header", undefined, 100, 100, C, C, C, C)
      .setOrigin(0, 0);
    this.container.add(this.panelBg);

    // Header
    this.headerText = addText(scene, 0, 0, "Trading", {
      fontSize: headerFontSize,
      color: "#ddaa55",
      fontFamily: "'Press Start 2P', monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.container.add(this.headerText);

    // Partner confirm indicator
    this.partnerConfirmText = addText(scene, 0, 0, "", {
      fontSize: slotFontSize,
      color: "#44ff44",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(1, 0.5);
    this.container.add(this.partnerConfirmText);

    this.slotGraphics = scene.add.graphics();
    this.container.add(this.slotGraphics);

    // Partner inventory slots (8 slots, read-only)
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const bgImg = scene.add.image(0, 0, "ui-slot-empty")
        .setDisplaySize(this.slotSize, this.slotSize);
      this.container.add(bgImg);
      this.invSlotBgImages.push(bgImg);

      // Zones live at scene level (not in the container) so input works reliably,
      // matching the pattern used in InventoryUI.
      const zone = scene.add
        .zone(0, 0, this.slotSize, this.slotSize)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: false });
      zone.on("pointerover", () => {
        const item = this.partnerInventory[i];
        if (item && item.baseItemId >= 0) {
          const ptr = this.scene.input.activePointer;
          const shiftHeld = this.shiftKey?.isDown ?? false;
          this.lastHoveredItem = { item, screenX: ptr.x, screenY: ptr.y };
          this.tooltip.show(item, ptr.x, ptr.y, shiftHeld);
        }
      });
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const item = this.partnerInventory[i];
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
      this.invSlotZones.push(zone);

      // Item image added before text so text renders on top
      const img = scene.add.image(0, 0, "items-spreadsheet").setVisible(false);
      this.container.add(img);
      this.invItemImages.push(img);

      const tierText = addText(scene, 0, 0, "", {
        fontSize: tierFontSize,
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(1, 1);
      this.container.add(tierText);
      this.invTierTexts.push(tierText);

      const qtyText = addText(scene, 0, 0, "", {
        fontSize: tierFontSize,
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0, 1);
      this.container.add(qtyText);
      this.invQtyTexts.push(qtyText);
    }

    // Trade button (positioned to the left of the panel)
    const BC = UI_BTN_CORNER;
    const btnW = Math.round(60 * S);

    this.tradeBtnBg = scene.add.nineslice(0, 0, "ui-btn-default", undefined, btnW, btnH, BC, BC, BC, BC)
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(100);

    this.tradeBtnText = addText(scene, 0, 0, "TRADE", {
      fontSize: btnFontSize,
      color: "#aaaaaa",
      fontFamily: "'Press Start 2P', monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    this.tradeBtnZone = scene.add.zone(0, 0, btnW, btnH)
      .setScrollFactor(0).setDepth(102).setInteractive({ useHandCursor: true });
    this.tradeBtnZone.on("pointerover", () => {
      if (!this.ownConfirmed) this.tradeBtnBg.setTexture("ui-btn-hover");
    });
    this.tradeBtnZone.on("pointerout", () => {
      this.updateTradeBtnVisual();
    });
    this.tradeBtnZone.on("pointerdown", () => {
      if (this.ownConfirmed) {
        this.ownConfirmed = false;
        this.updateTradeBtnVisual();
        NetworkManager.getInstance().sendTradeUnconfirm();
      } else {
        this.ownConfirmed = true;
        this.updateTradeBtnVisual();
        NetworkManager.getInstance().sendTradeConfirm();
      }
    });

    // Exit button
    this.exitBtnBg = scene.add.nineslice(0, 0, "ui-btn-default", undefined, btnW, btnH, BC, BC, BC, BC)
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(100);

    this.exitBtnText = addText(scene, 0, 0, "EXIT", {
      fontSize: btnFontSize,
      color: "#ff4444",
      fontFamily: "'Press Start 2P', monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101);

    this.exitBtnZone = scene.add.zone(0, 0, btnW, btnH)
      .setScrollFactor(0).setDepth(102).setInteractive({ useHandCursor: true });
    this.exitBtnZone.on("pointerover", () => {
      this.exitBtnText.setColor("#ffffff");
      this.exitBtnBg.setTexture("ui-btn-hover");
    });
    this.exitBtnZone.on("pointerout", () => {
      this.exitBtnText.setColor("#ff4444");
      this.exitBtnBg.setTexture("ui-btn-default");
    });
    this.exitBtnZone.on("pointerdown", () => {
      this.exitBtnBg.setTexture("ui-btn-pressed");
      NetworkManager.getInstance().sendTradeExit();
    });

    this.setVisible(false);
  }

  show(partnerName: string, partnerInventory: ItemInstanceData[], partnerEquipment: ItemInstanceData[]): void {
    this.partnerName = partnerName;
    this.partnerInventory = partnerInventory;
    this.partnerEquipment = partnerEquipment;
    this.partnerSelectedSlots = [];
    this.partnerConfirmed = false;
    this.ownConfirmed = false;
    this.updateTradeBtnVisual();
    this.layoutAndDraw();
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.tooltip.hide();
    this.lastHoveredItem = null;
    this.ownConfirmed = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  updatePartner(
    selectedSlots: { index: number; source: string }[],
    confirmed: boolean,
    inventory: ItemInstanceData[],
    equipment: ItemInstanceData[],
  ): void {
    // Detect if partner's selection changed (server resets both confirmations on selection change)
    const selectionChanged = !this.areSlotsEqual(this.partnerSelectedSlots, selectedSlots);

    this.partnerSelectedSlots = selectedSlots;
    this.partnerConfirmed = confirmed;
    this.partnerInventory = inventory;
    this.partnerEquipment = equipment;

    // Server resets both confirmations when either player changes selection.
    // Only reset our own confirmation when the partner's selection actually changed.
    if (this.ownConfirmed && selectionChanged) {
      this.ownConfirmed = false;
      this.updateTradeBtnVisual();
    }

    this.drawSlots();
  }

  setOwnConfirmReset(): void {
    this.ownConfirmed = false;
    this.updateTradeBtnVisual();
  }

  relayout(invSectionX: number, unifiedPanelY: number, hudSlotSize: number): void {
    this.S = getUIScale();
    this.slotSize = hudSlotSize;
    this.slotGap = Math.round(BASE_SLOT_GAP * this.S);
    this.padding = Math.round(BASE_PADDING * this.S);
    this.header = Math.round(BASE_HEADER * this.S);

    const invGridH = ROWS * this.slotSize + (ROWS - 1) * this.slotGap;

    this.panelWidth = COLS * this.slotSize + (COLS - 1) * this.slotGap + this.padding * 2;
    this.panelHeight = this.header + invGridH + this.padding * 2;

    this.anchorX = invSectionX - this.padding;
    this.anchorY = unifiedPanelY - this.panelHeight - Math.round(8 * this.S);

    if (this.visible) {
      this.layoutAndDraw();
    }
  }

  private areSlotsEqual(
    a: { index: number; source: string }[],
    b: { index: number; source: string }[],
  ): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].index !== b[i].index || a[i].source !== b[i].source) return false;
    }
    return true;
  }

  private updateTradeBtnVisual(): void {
    if (this.ownConfirmed) {
      this.tradeBtnBg.setTexture("ui-btn-default").setTint(0x44ff44);
    } else {
      this.tradeBtnBg.setTexture("ui-btn-default").clearTint();
    }
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.container.setVisible(v);
    // Zones are scene-level, not in the container — manage visibility explicitly
    for (const zone of this.invSlotZones) {
      zone.setActive(v).setVisible(v);
    }
    this.tradeBtnBg.setVisible(v);
    this.tradeBtnText.setVisible(v);
    this.tradeBtnZone.setActive(v).setVisible(v);
    this.exitBtnBg.setVisible(v);
    this.exitBtnText.setVisible(v);
    this.exitBtnZone.setActive(v).setVisible(v);
  }

  private layoutAndDraw(): void {
    const S = this.S;
    const px = this.anchorX;
    const py = this.anchorY;

    this.panelBg.setPosition(px, py);
    this.panelBg.setSize(this.panelWidth, this.panelHeight);

    this.headerText.setPosition(px + this.panelWidth / 2, py + this.header / 2);
    this.headerText.setText(`Trading: ${this.partnerName}`);

    this.partnerConfirmText.setPosition(px + this.panelWidth - this.padding, py + this.header / 2);

    // Inventory grid (starts right after header)
    const invY = py + this.header;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = px + this.padding + col * (this.slotSize + this.slotGap);
      const sy = invY + row * (this.slotSize + this.slotGap);
      this.invSlotBgImages[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
      this.invSlotBgImages[i].setDisplaySize(this.slotSize, this.slotSize);
      this.invSlotZones[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
      this.invSlotZones[i].setSize(this.slotSize, this.slotSize);
      this.invTierTexts[i].setPosition(sx + this.slotSize - 2, sy + this.slotSize - 2);
      this.invQtyTexts[i].setPosition(sx + 2, sy + this.slotSize - 2);
    }

    // Buttons: left of the panel
    const btnGap = Math.round(8 * S);
    const btnX = px - Math.round(40 * S);
    const btnY1 = py + this.panelHeight / 2 - Math.round(12 * S);
    const btnY2 = btnY1 + Math.round(24 * S);
    this.tradeBtnBg.setPosition(btnX, btnY1);
    this.tradeBtnText.setPosition(btnX, btnY1);
    this.tradeBtnZone.setPosition(btnX, btnY1);
    this.exitBtnBg.setPosition(btnX, btnY2);
    this.exitBtnText.setPosition(btnX, btnY2);
    this.exitBtnZone.setPosition(btnX, btnY2);

    this.drawSlots();
  }

  private drawSlots(): void {
    this.slotGraphics.clear();
    const nativeSize = getItemOutlinedSize();

    // Partner confirm indicator
    this.partnerConfirmText.setText(this.partnerConfirmed ? "READY" : "");

    // Inventory slots
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const bgImg = this.invSlotBgImages[i];
      const item = this.partnerInventory[i];
      const hasItem = item && item.baseItemId >= 0;

      bgImg.setTexture(hasItem ? "ui-slot-filled" : "ui-slot-empty");

      if (hasItem) {
        const category = getItemCategory(item.baseItemId);
        const subtype = getItemSubtype(item.baseItemId);
        const spriteKey = getItemSpriteKey(category, subtype, item.instanceTier, item.isUT);
        if (spriteKey) {
          this.invItemImages[i]
            .setTexture(spriteKey)
            .setPosition(bgImg.x, bgImg.y)
            .setDisplaySize(nativeSize, nativeSize)
            .setAlpha(1)
            .clearTint()
            .setVisible(true);
        } else {
          this.invItemImages[i].setVisible(false);
          const color = getItemColor(item);
          const iconSize = this.slotSize * 0.55;
          drawItemIcon(this.slotGraphics, bgImg.x, bgImg.y - this.slotSize * 0.05, iconSize, category, subtype, color);
        }
        if (isStackableItem(item.baseItemId)) {
          const qty = item.quantity || 1;
          this.invTierTexts[i].setText(`x${qty}`);
          this.invQtyTexts[i].setText("");
        } else {
          const tierLabel = item.isUT ? "UT" : `T${item.instanceTier}`;
          this.invTierTexts[i].setText(tierLabel);
          this.invQtyTexts[i].setText("");
        }
      } else {
        this.invItemImages[i].setVisible(false);
        this.invTierTexts[i].setText("");
        this.invQtyTexts[i].setText("");
      }

      // Highlight if partner selected this inv slot
      const isSelected = this.partnerSelectedSlots.some(s => s.source === "inventory" && s.index === i);
      if (isSelected) {
        bgImg.setTexture("ui-slot-selected");
      }
    }
  }
}
