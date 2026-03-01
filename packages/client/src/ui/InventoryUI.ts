import Phaser from "phaser";
import {
  INVENTORY_SIZE,
  EQUIPMENT_SLOTS,
  ITEM_DEFS,
  ClientMessage,
  getCategoryName,
} from "@rotmg-lite/shared";
import { ItemTooltip } from "./ItemTooltip";
import { getUIScale } from "./UIScale";

const BASE_SLOT_SIZE = 36;
const BASE_SLOT_GAP = 4;
const COLS = 4;
const ROWS = 2;
const BASE_PADDING = 8;
const BASE_HEADER = 18;
const BASE_EQ_GAP = 4;

const EQ_SLOT_LABELS = ["Wpn", "Abl", "Arm", "Rng"];

export class InventoryUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.Graphics;
  private slotGraphics: Phaser.GameObjects.Graphics;
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];
  private headerText: Phaser.GameObjects.Text;
  private room: any = null;
  private currentInventory: number[] = new Array(INVENTORY_SIZE).fill(-1);

  // Equipment
  private eqPanelBg: Phaser.GameObjects.Graphics;
  private eqSlotGraphics: Phaser.GameObjects.Graphics;
  private eqItemTexts: Phaser.GameObjects.Text[] = [];
  private eqSlotZones: Phaser.GameObjects.Zone[] = [];
  private eqHeaderText: Phaser.GameObjects.Text;
  private currentEquipment: number[] = new Array(EQUIPMENT_SLOTS).fill(-1);

  // Tooltip
  private tooltip: ItemTooltip;

  // Scaled dimensions (instance-level)
  private S: number;
  private slotSize: number;
  private slotGap: number;
  private padding: number;
  private header: number;
  private eqGap: number;
  private panelWidth: number;
  private invPanelHeight: number;
  private eqRowHeight: number;
  private totalHeight: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.tooltip = new ItemTooltip(scene);

    // Compute scaled dimensions
    this.S = getUIScale();
    const S = this.S;
    this.slotSize = Math.round(BASE_SLOT_SIZE * S);
    this.slotGap = Math.round(BASE_SLOT_GAP * S);
    this.padding = Math.round(BASE_PADDING * S);
    this.header = Math.round(BASE_HEADER * S);
    this.eqGap = Math.round(BASE_EQ_GAP * S);
    this.panelWidth = COLS * this.slotSize + (COLS - 1) * this.slotGap + this.padding * 2;
    this.invPanelHeight = ROWS * this.slotSize + (ROWS - 1) * this.slotGap + this.padding * 2 + this.header;
    this.eqRowHeight = this.slotSize + this.padding * 2 + this.header;
    this.totalHeight = this.invPanelHeight + this.eqGap + this.eqRowHeight;

    const panelX = 16;
    const invPanelY = scene.scale.height - this.invPanelHeight - 16;
    const eqPanelY = invPanelY - this.eqGap - this.eqRowHeight;

    const headerFontSize = `${Math.round(12 * S)}px`;
    const slotFontSize = `${Math.round(8 * S)}px`;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // --- Equipment panel background ---
    this.eqPanelBg = scene.add.graphics();
    this.eqPanelBg.fillStyle(0x111122, 0.85);
    this.eqPanelBg.fillRoundedRect(panelX, eqPanelY, this.panelWidth, this.eqRowHeight, 6);
    this.eqPanelBg.lineStyle(1, 0x666688, 1);
    this.eqPanelBg.strokeRoundedRect(panelX, eqPanelY, this.panelWidth, this.eqRowHeight, 6);
    this.container.add(this.eqPanelBg);

    this.eqHeaderText = scene.add
      .text(panelX + this.padding, eqPanelY + 4, "Equipment", {
        fontSize: headerFontSize,
        color: "#cccc88",
        fontFamily: "monospace",
      });
    this.container.add(this.eqHeaderText);

    this.eqSlotGraphics = scene.add.graphics();
    this.container.add(this.eqSlotGraphics);

    // Equipment slot zones and texts
    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const sx = panelX + this.padding + i * (this.slotSize + this.slotGap);
      const sy = eqPanelY + this.header + this.padding;

      const zone = scene.add
        .zone(sx + this.slotSize / 2, sy + this.slotSize / 2, this.slotSize, this.slotSize)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerover", () => {
        const itemId = this.currentEquipment[i];
        if (itemId >= 0) {
          this.tooltip.show(itemId, sx, eqPanelY - Math.round(8 * S));
        }
      });
      zone.on("pointerout", () => {
        this.tooltip.hide();
      });

      this.eqSlotZones.push(zone);

      const text = scene.add
        .text(sx + this.slotSize / 2, sy + this.slotSize / 2, EQ_SLOT_LABELS[i], {
          fontSize: slotFontSize,
          color: "#666666",
          fontFamily: "monospace",
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(102)
        .setWordWrapWidth(this.slotSize - 4);
      this.eqItemTexts.push(text);
    }

    // --- Inventory panel background ---
    this.panelBg = scene.add.graphics();
    this.panelBg.fillStyle(0x111122, 0.85);
    this.panelBg.fillRoundedRect(panelX, invPanelY, this.panelWidth, this.invPanelHeight, 6);
    this.panelBg.lineStyle(1, 0x444466, 1);
    this.panelBg.strokeRoundedRect(panelX, invPanelY, this.panelWidth, this.invPanelHeight, 6);
    this.container.add(this.panelBg);

    this.headerText = scene.add
      .text(panelX + this.padding, invPanelY + 4, "Inventory", {
        fontSize: headerFontSize,
        color: "#aaaacc",
        fontFamily: "monospace",
      });
    this.container.add(this.headerText);

    this.slotGraphics = scene.add.graphics();
    this.container.add(this.slotGraphics);

    // Inventory slot zones and texts
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = panelX + this.padding + col * (this.slotSize + this.slotGap);
      const sy = invPanelY + this.header + this.padding + row * (this.slotSize + this.slotGap);

      const zone = scene.add
        .zone(sx + this.slotSize / 2, sy + this.slotSize / 2, this.slotSize, this.slotSize)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          this.onDropItem(i);
        } else if (pointer.leftButtonDown()) {
          this.onEquipItem(i);
        }
      });

      zone.on("pointerover", () => {
        const itemId = this.currentInventory[i];
        if (itemId >= 0) {
          this.tooltip.show(itemId, sx, invPanelY - Math.round(8 * S));
        }
      });
      zone.on("pointerout", () => {
        this.tooltip.hide();
      });

      this.slotZones.push(zone);

      const text = scene.add
        .text(sx + this.slotSize / 2, sy + this.slotSize / 2, "", {
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
    }

    this.drawSlots();
    this.drawEquipmentSlots();
  }

  setRoom(room: any): void {
    this.room = room;
  }

  getTooltip(): ItemTooltip {
    return this.tooltip;
  }

  getPanelWidth(): number {
    return this.panelWidth;
  }

  getInvPanelHeight(): number {
    return this.invPanelHeight;
  }

  updateInventory(inventory: number[]): void {
    let changed = false;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const val = i < inventory.length ? inventory[i] : -1;
      if (this.currentInventory[i] !== val) {
        this.currentInventory[i] = val;
        changed = true;
      }
    }
    if (changed) {
      this.drawSlots();
    }
  }

  updateEquipment(equipment: number[]): void {
    let changed = false;
    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const val = i < equipment.length ? equipment[i] : -1;
      if (this.currentEquipment[i] !== val) {
        this.currentEquipment[i] = val;
        changed = true;
      }
    }
    if (changed) {
      this.drawEquipmentSlots();
    }
  }

  private drawSlots(): void {
    this.slotGraphics.clear();
    const panelX = 16;
    const panelY = this.scene.scale.height - this.invPanelHeight - 16;

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = panelX + this.padding + col * (this.slotSize + this.slotGap);
      const sy = panelY + this.header + this.padding + row * (this.slotSize + this.slotGap);

      const itemType = this.currentInventory[i];
      const def = itemType >= 0 ? ITEM_DEFS[itemType] : null;

      // Slot background
      if (def) {
        this.slotGraphics.fillStyle(def.color, 0.4);
      } else {
        this.slotGraphics.fillStyle(0x222233, 0.6);
      }
      this.slotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);

      // Border: use tier color if item present
      const borderColor = def ? def.tierColor : 0x333344;
      this.slotGraphics.lineStyle(1, borderColor, 1);
      this.slotGraphics.strokeRect(sx, sy, this.slotSize, this.slotSize);

      // Update text
      if (def) {
        const shortName =
          def.name.length > 8 ? def.name.substring(0, 7) + "." : def.name;
        this.itemTexts[i].setText(shortName);
        this.itemTexts[i].setColor("#ffffff");
      } else {
        this.itemTexts[i].setText("");
      }

      // Update zone position
      this.slotZones[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
    }
  }

  private drawEquipmentSlots(): void {
    this.eqSlotGraphics.clear();
    const panelX = 16;
    const invPanelY = this.scene.scale.height - this.invPanelHeight - 16;
    const eqPanelY = invPanelY - this.eqGap - this.eqRowHeight;

    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const sx = panelX + this.padding + i * (this.slotSize + this.slotGap);
      const sy = eqPanelY + this.header + this.padding;

      const itemId = this.currentEquipment[i];
      const def = itemId >= 0 ? ITEM_DEFS[itemId] : null;

      // Slot background
      if (def) {
        this.eqSlotGraphics.fillStyle(def.color, 0.4);
      } else {
        this.eqSlotGraphics.fillStyle(0x222233, 0.6);
      }
      this.eqSlotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);

      // Border: tier color
      const borderColor = def ? def.tierColor : 0x444455;
      this.eqSlotGraphics.lineStyle(2, borderColor, 1);
      this.eqSlotGraphics.strokeRect(sx, sy, this.slotSize, this.slotSize);

      // Text
      if (def) {
        const shortName =
          def.name.length > 8 ? def.name.substring(0, 7) + "." : def.name;
        this.eqItemTexts[i].setText(shortName);
        this.eqItemTexts[i].setColor("#ffffff");
      } else {
        this.eqItemTexts[i].setText(EQ_SLOT_LABELS[i]);
        this.eqItemTexts[i].setColor("#666666");
      }

      this.eqSlotZones[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
    }
  }

  private onDropItem(slotIndex: number): void {
    if (!this.room) return;
    if (this.currentInventory[slotIndex] === -1) return;
    this.room.send(ClientMessage.DropItem, { slotIndex });
  }

  private onEquipItem(slotIndex: number): void {
    if (!this.room) return;
    if (this.currentInventory[slotIndex] === -1) return;
    this.room.send(ClientMessage.EquipItem, { inventorySlot: slotIndex });
  }

  /** Returns true if the given screen coordinates are over either panel */
  isOverPanel(screenX: number, screenY: number): boolean {
    const panelX = 16;
    const invPanelY = this.scene.scale.height - this.invPanelHeight - 16;
    const eqPanelY = invPanelY - this.eqGap - this.eqRowHeight;
    return (
      screenX >= panelX &&
      screenX <= panelX + this.panelWidth &&
      screenY >= eqPanelY &&
      screenY <= invPanelY + this.invPanelHeight
    );
  }
}
