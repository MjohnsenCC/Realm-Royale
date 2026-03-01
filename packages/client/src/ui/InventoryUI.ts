import Phaser from "phaser";
import {
  INVENTORY_SIZE,
  EQUIPMENT_SLOTS,
  ITEM_DEFS,
  ClientMessage,
  getCategoryName,
} from "@rotmg-lite/shared";
import { ItemTooltip } from "./ItemTooltip";

const SLOT_SIZE = 36;
const SLOT_GAP = 4;
const COLS = 4;
const ROWS = 2;
const PADDING = 8;
const PANEL_WIDTH = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
const INV_PANEL_HEIGHT =
  ROWS * SLOT_SIZE + (ROWS - 1) * SLOT_GAP + PADDING * 2 + 18; // +18 for header

// Equipment row sits above the inventory panel
const EQ_ROW_HEIGHT = SLOT_SIZE + PADDING * 2 + 18; // one row + header + padding
const EQ_GAP = 4; // gap between equipment and inventory panels

// Total area for isOverPanel
const TOTAL_HEIGHT = INV_PANEL_HEIGHT + EQ_GAP + EQ_ROW_HEIGHT;

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

  // Expose panel dimensions for LootBagUI positioning
  static readonly PANEL_WIDTH = PANEL_WIDTH;
  static readonly PANEL_HEIGHT = INV_PANEL_HEIGHT;
  static readonly TOTAL_HEIGHT = TOTAL_HEIGHT;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.tooltip = new ItemTooltip(scene);

    const panelX = 16;
    const invPanelY = scene.scale.height - INV_PANEL_HEIGHT - 16;
    const eqPanelY = invPanelY - EQ_GAP - EQ_ROW_HEIGHT;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // --- Equipment panel background ---
    this.eqPanelBg = scene.add.graphics();
    this.eqPanelBg.fillStyle(0x111122, 0.85);
    this.eqPanelBg.fillRoundedRect(panelX, eqPanelY, PANEL_WIDTH, EQ_ROW_HEIGHT, 6);
    this.eqPanelBg.lineStyle(1, 0x666688, 1);
    this.eqPanelBg.strokeRoundedRect(panelX, eqPanelY, PANEL_WIDTH, EQ_ROW_HEIGHT, 6);
    this.container.add(this.eqPanelBg);

    this.eqHeaderText = scene.add
      .text(panelX + PADDING, eqPanelY + 4, "Equipment", {
        fontSize: "12px",
        color: "#cccc88",
        fontFamily: "monospace",
      });
    this.container.add(this.eqHeaderText);

    this.eqSlotGraphics = scene.add.graphics();
    this.container.add(this.eqSlotGraphics);

    // Equipment slot zones and texts
    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const sx = panelX + PADDING + i * (SLOT_SIZE + SLOT_GAP);
      const sy = eqPanelY + 18 + PADDING;

      const zone = scene.add
        .zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerover", () => {
        const itemId = this.currentEquipment[i];
        if (itemId >= 0) {
          this.tooltip.show(itemId, sx, eqPanelY - 8);
        }
      });
      zone.on("pointerout", () => {
        this.tooltip.hide();
      });

      this.eqSlotZones.push(zone);

      const text = scene.add
        .text(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, EQ_SLOT_LABELS[i], {
          fontSize: "8px",
          color: "#666666",
          fontFamily: "monospace",
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(102)
        .setWordWrapWidth(SLOT_SIZE - 4);
      this.eqItemTexts.push(text);
    }

    // --- Inventory panel background ---
    this.panelBg = scene.add.graphics();
    this.panelBg.fillStyle(0x111122, 0.85);
    this.panelBg.fillRoundedRect(panelX, invPanelY, PANEL_WIDTH, INV_PANEL_HEIGHT, 6);
    this.panelBg.lineStyle(1, 0x444466, 1);
    this.panelBg.strokeRoundedRect(panelX, invPanelY, PANEL_WIDTH, INV_PANEL_HEIGHT, 6);
    this.container.add(this.panelBg);

    this.headerText = scene.add
      .text(panelX + PADDING, invPanelY + 4, "Inventory", {
        fontSize: "12px",
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
      const sx = panelX + PADDING + col * (SLOT_SIZE + SLOT_GAP);
      const sy = invPanelY + 18 + PADDING + row * (SLOT_SIZE + SLOT_GAP);

      const zone = scene.add
        .zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
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
          this.tooltip.show(itemId, sx, invPanelY - 8);
        }
      });
      zone.on("pointerout", () => {
        this.tooltip.hide();
      });

      this.slotZones.push(zone);

      const text = scene.add
        .text(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, "", {
          fontSize: "8px",
          color: "#ffffff",
          fontFamily: "monospace",
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(102)
        .setWordWrapWidth(SLOT_SIZE - 4);
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
    const panelY = this.scene.scale.height - INV_PANEL_HEIGHT - 16;

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = panelX + PADDING + col * (SLOT_SIZE + SLOT_GAP);
      const sy = panelY + 18 + PADDING + row * (SLOT_SIZE + SLOT_GAP);

      const itemType = this.currentInventory[i];
      const def = itemType >= 0 ? ITEM_DEFS[itemType] : null;

      // Slot background
      if (def) {
        this.slotGraphics.fillStyle(def.color, 0.4);
      } else {
        this.slotGraphics.fillStyle(0x222233, 0.6);
      }
      this.slotGraphics.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

      // Border: use tier color if item present
      const borderColor = def ? def.tierColor : 0x333344;
      this.slotGraphics.lineStyle(1, borderColor, 1);
      this.slotGraphics.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

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
      this.slotZones[i].setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2);
    }
  }

  private drawEquipmentSlots(): void {
    this.eqSlotGraphics.clear();
    const panelX = 16;
    const invPanelY = this.scene.scale.height - INV_PANEL_HEIGHT - 16;
    const eqPanelY = invPanelY - EQ_GAP - EQ_ROW_HEIGHT;

    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const sx = panelX + PADDING + i * (SLOT_SIZE + SLOT_GAP);
      const sy = eqPanelY + 18 + PADDING;

      const itemId = this.currentEquipment[i];
      const def = itemId >= 0 ? ITEM_DEFS[itemId] : null;

      // Slot background
      if (def) {
        this.eqSlotGraphics.fillStyle(def.color, 0.4);
      } else {
        this.eqSlotGraphics.fillStyle(0x222233, 0.6);
      }
      this.eqSlotGraphics.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

      // Border: tier color
      const borderColor = def ? def.tierColor : 0x444455;
      this.eqSlotGraphics.lineStyle(2, borderColor, 1);
      this.eqSlotGraphics.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

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

      this.eqSlotZones[i].setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2);
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
    const invPanelY = this.scene.scale.height - INV_PANEL_HEIGHT - 16;
    const eqPanelY = invPanelY - EQ_GAP - EQ_ROW_HEIGHT;
    return (
      screenX >= panelX &&
      screenX <= panelX + PANEL_WIDTH &&
      screenY >= eqPanelY &&
      screenY <= invPanelY + INV_PANEL_HEIGHT
    );
  }
}
