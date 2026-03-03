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

const EQ_SLOT_LABELS = ["Wpn", "Abl", "Arm", "Rng"];

export interface InventoryUIConfig {
  eqX: number;
  eqY: number;
  invX: number;
  invY: number;
}

export class InventoryUI {
  private scene: Phaser.Scene;
  private slotGraphics: Phaser.GameObjects.Graphics;
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];
  private room: any = null;
  private currentInventory: number[] = new Array(INVENTORY_SIZE).fill(-1);

  // Equipment
  private eqSlotGraphics: Phaser.GameObjects.Graphics;
  private eqItemTexts: Phaser.GameObjects.Text[] = [];
  private eqSlotZones: Phaser.GameObjects.Zone[] = [];
  private currentEquipment: number[] = new Array(EQUIPMENT_SLOTS).fill(-1);

  // Tooltip
  private tooltip: ItemTooltip;

  // Scaled dimensions
  private S: number;
  private slotSize: number;
  private slotGap: number;

  // Layout origins (set by HUD)
  private eqX: number;
  private eqY: number;
  private invX: number;
  private invY: number;

  constructor(scene: Phaser.Scene, config: InventoryUIConfig) {
    this.scene = scene;
    this.tooltip = new ItemTooltip(scene);

    this.S = getUIScale();
    const S = this.S;
    this.slotSize = Math.round(BASE_SLOT_SIZE * S);
    this.slotGap = Math.round(BASE_SLOT_GAP * S);

    this.eqX = config.eqX;
    this.eqY = config.eqY;
    this.invX = config.invX;
    this.invY = config.invY;

    const slotFontSize = `${Math.round(8 * S)}px`;

    // --- Equipment slot graphics ---
    this.eqSlotGraphics = scene.add.graphics().setScrollFactor(0).setDepth(101);

    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const sx = this.eqX + i * (this.slotSize + this.slotGap);
      const sy = this.eqY;

      const zone = scene.add
        .zone(sx + this.slotSize / 2, sy + this.slotSize / 2, this.slotSize, this.slotSize)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerover", () => {
        const itemId = this.currentEquipment[i];
        if (itemId >= 0) {
          const ptr = this.scene.input.activePointer;
          this.tooltip.show(itemId, ptr.x, ptr.y);
        }
      });
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const itemId = this.currentEquipment[i];
        if (itemId >= 0) {
          this.tooltip.show(itemId, pointer.x, pointer.y);
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

    // --- Inventory slot graphics ---
    this.slotGraphics = scene.add.graphics().setScrollFactor(0).setDepth(101);

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = this.invX + col * (this.slotSize + this.slotGap);
      const sy = this.invY + row * (this.slotSize + this.slotGap);

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
          const ptr = this.scene.input.activePointer;
          this.tooltip.show(itemId, ptr.x, ptr.y);
        }
      });
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const itemId = this.currentInventory[i];
        if (itemId >= 0) {
          this.tooltip.show(itemId, pointer.x, pointer.y);
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

  getEquipment(): number[] {
    return this.currentEquipment;
  }

  getSlotSize(): number {
    return this.slotSize;
  }

  getSlotGap(): number {
    return this.slotGap;
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

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = this.invX + col * (this.slotSize + this.slotGap);
      const sy = this.invY + row * (this.slotSize + this.slotGap);

      const itemType = this.currentInventory[i];
      const def = itemType >= 0 ? ITEM_DEFS[itemType] : null;

      if (def) {
        this.slotGraphics.fillStyle(def.color, 0.4);
      } else {
        this.slotGraphics.fillStyle(0x222233, 0.6);
      }
      this.slotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);

      const borderColor = def ? def.tierColor : 0x333344;
      this.slotGraphics.lineStyle(1, borderColor, 1);
      this.slotGraphics.strokeRect(sx, sy, this.slotSize, this.slotSize);

      if (def) {
        const shortName =
          def.name.length > 8 ? def.name.substring(0, 7) + "." : def.name;
        this.itemTexts[i].setText(shortName);
        this.itemTexts[i].setColor("#ffffff");
      } else {
        this.itemTexts[i].setText("");
      }

      this.itemTexts[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
      this.slotZones[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
    }
  }

  private drawEquipmentSlots(): void {
    this.eqSlotGraphics.clear();

    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const sx = this.eqX + i * (this.slotSize + this.slotGap);
      const sy = this.eqY;

      const itemId = this.currentEquipment[i];
      const def = itemId >= 0 ? ITEM_DEFS[itemId] : null;

      if (def) {
        this.eqSlotGraphics.fillStyle(def.color, 0.4);
      } else {
        this.eqSlotGraphics.fillStyle(0x222233, 0.6);
      }
      this.eqSlotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);

      const borderColor = def ? def.tierColor : 0x444455;
      this.eqSlotGraphics.lineStyle(2, borderColor, 1);
      this.eqSlotGraphics.strokeRect(sx, sy, this.slotSize, this.slotSize);

      if (def) {
        const shortName =
          def.name.length > 8 ? def.name.substring(0, 7) + "." : def.name;
        this.eqItemTexts[i].setText(shortName);
        this.eqItemTexts[i].setColor("#ffffff");
      } else {
        this.eqItemTexts[i].setText(EQ_SLOT_LABELS[i]);
        this.eqItemTexts[i].setColor("#666666");
      }

      this.eqItemTexts[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
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

  /** Returns true if the given screen coordinates are over the unified HUD panel area */
  isOverPanel(screenX: number, screenY: number, panelX: number, panelY: number, panelW: number, panelH: number): boolean {
    return (
      screenX >= panelX &&
      screenX <= panelX + panelW &&
      screenY >= panelY &&
      screenY <= panelY + panelH
    );
  }
}
