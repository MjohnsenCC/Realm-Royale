import Phaser from "phaser";
import {
  INVENTORY_SIZE,
  EQUIPMENT_SLOTS,
  ClientMessage,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  ItemCategory,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { createEmptyItemInstance } from "@rotmg-lite/shared";
import { ItemTooltip } from "./ItemTooltip";
import { getUIScale } from "./UIScale";
import { drawItemIcon, getSlotBorderColor } from "./ItemIcons";

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
  private currentInventory: ItemInstanceData[] = Array.from(
    { length: INVENTORY_SIZE },
    () => createEmptyItemInstance()
  );

  private tierTexts: Phaser.GameObjects.Text[] = [];

  // Equipment
  private eqSlotGraphics: Phaser.GameObjects.Graphics;
  private eqItemTexts: Phaser.GameObjects.Text[] = [];
  private eqSlotZones: Phaser.GameObjects.Zone[] = [];
  private eqTierTexts: Phaser.GameObjects.Text[] = [];
  private currentEquipment: ItemInstanceData[] = Array.from(
    { length: EQUIPMENT_SLOTS },
    () => createEmptyItemInstance()
  );

  // Tooltip
  private tooltip: ItemTooltip;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private lastHoveredItem: { item: ItemInstanceData; screenX: number; screenY: number } | null = null;

  // Crafting mode: when set, left-clicks select items for crafting instead of equipping
  private craftingSelectCallback: ((location: "inventory" | "equipment", slotIndex: number, item: ItemInstanceData) => void) | null = null;

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

    if (scene.input.keyboard) {
      this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.shiftKey.on("down", () => this.refreshTooltipShift());
      this.shiftKey.on("up", () => this.refreshTooltipShift());
    }

    this.S = getUIScale();
    const S = this.S;
    this.slotSize = Math.round(BASE_SLOT_SIZE * S);
    this.slotGap = Math.round(BASE_SLOT_GAP * S);

    this.eqX = config.eqX;
    this.eqY = config.eqY;
    this.invX = config.invX;
    this.invY = config.invY;

    const slotFontSize = `${Math.round(8 * S)}px`;
    const tierFontSize = `${Math.round(7 * S)}px`;

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
        const item = this.currentEquipment[i];
        if (item && item.baseItemId >= 0) {
          const ptr = this.scene.input.activePointer;
          const shiftHeld = this.shiftKey?.isDown ?? false;
          this.lastHoveredItem = { item, screenX: ptr.x, screenY: ptr.y };
          this.tooltip.show(item, ptr.x, ptr.y, shiftHeld);
        }
      });
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const item = this.currentEquipment[i];
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
      zone.on("pointerdown", () => {
        if (this.craftingSelectCallback) {
          const item = this.currentEquipment[i];
          if (item && item.baseItemId >= 0) {
            this.craftingSelectCallback("equipment", i, item);
          }
        }
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

      const tierText = scene.add
        .text(sx + this.slotSize - 2, sy + this.slotSize - 2, "", {
          fontSize: tierFontSize,
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(102);
      this.eqTierTexts.push(tierText);
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
        if (this.craftingSelectCallback && pointer.leftButtonDown()) {
          const item = this.currentInventory[i];
          if (item && item.baseItemId >= 0) {
            this.craftingSelectCallback("inventory", i, item);
          }
          return;
        }
        if (pointer.rightButtonDown()) {
          this.onDropItem(i);
        } else if (pointer.leftButtonDown()) {
          this.onEquipItem(i);
        }
      });

      zone.on("pointerover", () => {
        const item = this.currentInventory[i];
        if (item && item.baseItemId >= 0) {
          const ptr = this.scene.input.activePointer;
          const shiftHeld = this.shiftKey?.isDown ?? false;
          this.lastHoveredItem = { item, screenX: ptr.x, screenY: ptr.y };
          this.tooltip.show(item, ptr.x, ptr.y, shiftHeld);
        }
      });
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const item = this.currentInventory[i];
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

      const tierText = scene.add
        .text(sx + this.slotSize - 2, sy + this.slotSize - 2, "", {
          fontSize: tierFontSize,
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(102);
      this.tierTexts.push(tierText);
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

  getEquipment(): ItemInstanceData[] {
    return this.currentEquipment;
  }

  getSlotSize(): number {
    return this.slotSize;
  }

  getSlotGap(): number {
    return this.slotGap;
  }

  setCraftingSelectCallback(cb: ((location: "inventory" | "equipment", slotIndex: number, item: ItemInstanceData) => void) | null): void {
    this.craftingSelectCallback = cb;
  }

  getInventory(): ItemInstanceData[] {
    return this.currentInventory;
  }

  updateInventory(inventory: ItemInstanceData[]): void {
    let changed = false;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const newItem = i < inventory.length ? inventory[i] : createEmptyItemInstance();
      if (this.currentInventory[i].baseItemId !== newItem.baseItemId ||
          this.currentInventory[i].instanceTier !== newItem.instanceTier ||
          this.currentInventory[i].openStats.length !== newItem.openStats.length ||
          this.currentInventory[i].lockedStat1Tier !== newItem.lockedStat1Tier ||
          this.currentInventory[i].lockedStat2Tier !== newItem.lockedStat2Tier ||
          !openStatsEqual(this.currentInventory[i].openStats, newItem.openStats) ||
          this.currentInventory[i].forgeProtectedSlot !== newItem.forgeProtectedSlot) {
        this.currentInventory[i] = newItem;
        changed = true;
      }
    }
    if (changed) {
      this.drawSlots();
    }
  }

  updateEquipment(equipment: ItemInstanceData[]): void {
    let changed = false;
    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const newItem = i < equipment.length ? equipment[i] : createEmptyItemInstance();
      if (this.currentEquipment[i].baseItemId !== newItem.baseItemId ||
          this.currentEquipment[i].instanceTier !== newItem.instanceTier ||
          this.currentEquipment[i].openStats.length !== newItem.openStats.length ||
          this.currentEquipment[i].lockedStat1Tier !== newItem.lockedStat1Tier ||
          this.currentEquipment[i].lockedStat2Tier !== newItem.lockedStat2Tier ||
          !openStatsEqual(this.currentEquipment[i].openStats, newItem.openStats) ||
          this.currentEquipment[i].forgeProtectedSlot !== newItem.forgeProtectedSlot) {
        this.currentEquipment[i] = newItem;
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

      const item = this.currentInventory[i];
      const hasItem = item && item.baseItemId >= 0;

      if (hasItem) {
        this.slotGraphics.fillStyle(0x444444, 0.4);
      } else {
        this.slotGraphics.fillStyle(0x222233, 0.6);
      }
      this.slotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);

      const tier = hasItem ? (item.isUT ? 13 : item.instanceTier) : 0;
      const borderColor = hasItem ? getSlotBorderColor(tier) : 0x333344;
      this.slotGraphics.lineStyle(1, borderColor, 1);
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
        const tierLabel = item.isUT ? "UT" : `T${item.instanceTier}`;
        this.tierTexts[i].setText(tierLabel);
      } else {
        this.tierTexts[i].setText("");
      }

      this.tierTexts[i].setPosition(sx + this.slotSize - 2, sy + this.slotSize - 2);
      this.itemTexts[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
      this.slotZones[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
    }
  }

  private drawEquipmentSlots(): void {
    this.eqSlotGraphics.clear();

    for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
      const sx = this.eqX + i * (this.slotSize + this.slotGap);
      const sy = this.eqY;

      const item = this.currentEquipment[i];
      const hasItem = item && item.baseItemId >= 0;

      if (hasItem) {
        this.eqSlotGraphics.fillStyle(0x444444, 0.4);
      } else {
        this.eqSlotGraphics.fillStyle(0x222233, 0.6);
      }
      this.eqSlotGraphics.fillRect(sx, sy, this.slotSize, this.slotSize);

      const tier = hasItem ? (item.isUT ? 13 : item.instanceTier) : 0;
      const borderColor = hasItem ? getSlotBorderColor(tier) : 0x444455;
      this.eqSlotGraphics.lineStyle(2, borderColor, 1);
      this.eqSlotGraphics.strokeRect(sx, sy, this.slotSize, this.slotSize);

      if (hasItem) {
        this.eqItemTexts[i].setText("");
        const category = getItemCategory(item.baseItemId);
        const subtype = getItemSubtype(item.baseItemId);
        const color = getItemColor(item);
        const iconSize = this.slotSize * 0.55;
        drawItemIcon(
          this.eqSlotGraphics,
          sx + this.slotSize / 2,
          sy + this.slotSize / 2 - this.slotSize * 0.05,
          iconSize,
          category,
          subtype,
          color
        );
        const tierLabel = item.isUT ? "UT" : `T${item.instanceTier}`;
        this.eqTierTexts[i].setText(tierLabel);
      } else {
        this.eqItemTexts[i].setText(EQ_SLOT_LABELS[i]);
        this.eqItemTexts[i].setColor("#666666");
        this.eqTierTexts[i].setText("");
      }

      this.eqTierTexts[i].setPosition(sx + this.slotSize - 2, sy + this.slotSize - 2);
      this.eqItemTexts[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
      this.eqSlotZones[i].setPosition(sx + this.slotSize / 2, sy + this.slotSize / 2);
    }
  }

  private refreshTooltipShift(): void {
    if (this.lastHoveredItem) {
      const { item, screenX, screenY } = this.lastHoveredItem;
      const shiftHeld = this.shiftKey?.isDown ?? false;
      this.tooltip.show(item, screenX, screenY, shiftHeld);
    }
  }

  private onDropItem(slotIndex: number): void {
    if (!this.room) return;
    if (this.currentInventory[slotIndex].baseItemId < 0) return;
    this.room.send(ClientMessage.DropItem, { slotIndex });
  }

  private onEquipItem(slotIndex: number): void {
    if (!this.room) return;
    if (this.currentInventory[slotIndex].baseItemId < 0) return;
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

function openStatsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
