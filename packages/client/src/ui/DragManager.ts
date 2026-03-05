import Phaser from "phaser";
import {
  ClientMessage,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  ItemCategory,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";
import { drawItemIcon, getSlotBorderColor } from "./ItemIcons";
import type { InventoryUI } from "./InventoryUI";
import type { LootBagUI } from "./LootBagUI";

export type DragSource =
  | { type: "bag"; bagId: string; slotIndex: number }
  | { type: "inventory"; slotIndex: number }
  | { type: "equipment"; slotIndex: number };

export interface DropTarget {
  type: "inventory" | "equipment" | "ground";
  slotIndex?: number;
}

interface SlotBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DRAG_THRESHOLD = 5;

export class DragManager {
  private scene: Phaser.Scene;
  private room: any = null;
  private inventoryUI!: InventoryUI;
  private lootBagUI!: LootBagUI;
  private panelBoundsGetter!: () => SlotBounds;

  // Drag state
  private active = false;
  private source: DragSource | null = null;
  private item: ItemInstanceData | null = null;
  private startX = 0;
  private startY = 0;

  // Ghost visuals
  private ghostGraphics: Phaser.GameObjects.Graphics | null = null;
  private ghostTierText: Phaser.GameObjects.Text | null = null;

  // Current highlight
  private currentHighlight: DropTarget | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.onPointerMove(pointer);
    });
    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.onPointerUp(pointer);
    });
  }

  setRoom(room: any): void {
    this.room = room;
  }

  setInventoryUI(ui: InventoryUI): void {
    this.inventoryUI = ui;
  }

  setLootBagUI(ui: LootBagUI): void {
    this.lootBagUI = ui;
  }

  setPanelBoundsGetter(getter: () => SlotBounds): void {
    this.panelBoundsGetter = getter;
  }

  isDragging(): boolean {
    return this.active;
  }

  /** Called by InventoryUI/LootBagUI when a slot receives pointerdown */
  onSlotPointerDown(source: DragSource, item: ItemInstanceData, x: number, y: number): void {
    // Don't initiate drag for consumables/crafting orbs — click-only
    if (source.type !== "equipment") {
      const category = getItemCategory(item.baseItemId);
      if (category === ItemCategory.Consumable || category === ItemCategory.CraftingOrb) {
        this.executeClick(source, item);
        return;
      }
    }

    // Don't initiate drag when crafting UI is selecting
    if (this.inventoryUI.getCraftingSelectCallback()) {
      if (source.type === "inventory") {
        this.inventoryUI.getCraftingSelectCallback()!("inventory", source.slotIndex, item);
      } else if (source.type === "equipment") {
        this.inventoryUI.getCraftingSelectCallback()!("equipment", source.slotIndex, item);
      }
      return;
    }

    this.source = source;
    this.item = item;
    this.startX = x;
    this.startY = y;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.source || !this.item) return;

    if (!this.active) {
      const dx = pointer.x - this.startX;
      const dy = pointer.y - this.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;

      // Activate drag
      this.active = true;
      this.inventoryUI.setDragActive(true);
      this.lootBagUI.setDragActive(true);
      this.createGhost(this.item);

      // Dim source slot
      if (this.source.type === "inventory") {
        this.inventoryUI.setDragSourceSlot(this.source.slotIndex);
      } else if (this.source.type === "bag") {
        this.lootBagUI.setDragSourceSlot(this.source.slotIndex);
      } else if (this.source.type === "equipment") {
        this.inventoryUI.setDragSourceEqSlot(this.source.slotIndex);
      }
    }

    // Update ghost position
    this.updateGhostPosition(pointer.x, pointer.y);

    // Hit-test for drop target and update highlights
    const target = this.hitTestDropTarget(pointer.x, pointer.y);
    this.updateHighlight(target);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.source || !this.item) return;

    if (!this.active) {
      // No drag occurred — execute click fallback
      this.executeClick(this.source, this.item);
      this.resetState();
      return;
    }

    // Drag completed — check for valid drop
    const target = this.hitTestDropTarget(pointer.x, pointer.y);
    if (target && this.isValidDrop(this.source, target, this.item)) {
      this.executeDrop(this.source, target);
    }

    this.endDrag();
  }

  /** Cancel an active drag (e.g. when bag closes) */
  cancelDrag(): void {
    if (this.active) {
      this.endDrag();
    } else {
      this.resetState();
    }
  }

  private endDrag(): void {
    this.destroyGhost();
    this.clearHighlight();
    this.inventoryUI.setDragActive(false);
    this.inventoryUI.setDragSourceSlot(-1);
    this.inventoryUI.setDragSourceEqSlot(-1);
    this.lootBagUI.setDragActive(false);
    this.lootBagUI.setDragSourceSlot(-1);
    this.resetState();
  }

  private resetState(): void {
    this.active = false;
    this.source = null;
    this.item = null;
  }

  // --- Ghost visual ---

  private createGhost(item: ItemInstanceData): void {
    const S = getUIScale();
    const ghostSize = Math.round(36 * S);

    this.ghostGraphics = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(500)
      .setAlpha(0.8);

    this.ghostGraphics.fillStyle(0x444444, 0.6);
    this.ghostGraphics.fillRect(-ghostSize / 2, -ghostSize / 2, ghostSize, ghostSize);

    const category = getItemCategory(item.baseItemId);
    const subtype = getItemSubtype(item.baseItemId);
    const color = getItemColor(item);
    const iconSize = ghostSize * 0.55;
    drawItemIcon(this.ghostGraphics, 0, -ghostSize * 0.05, iconSize, category, subtype, color);

    const tier = item.isUT ? 13 : item.instanceTier;
    const borderColor = getSlotBorderColor(tier);
    this.ghostGraphics.lineStyle(2, borderColor, 1);
    this.ghostGraphics.strokeRect(-ghostSize / 2, -ghostSize / 2, ghostSize, ghostSize);

    const tierLabel = item.isUT ? "UT" : `T${item.instanceTier}`;
    this.ghostTierText = this.scene.add
      .text(0, 0, tierLabel, {
        fontSize: `${Math.round(7 * S)}px`,
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(501);
  }

  private updateGhostPosition(x: number, y: number): void {
    if (this.ghostGraphics) {
      this.ghostGraphics.setPosition(x, y);
    }
    if (this.ghostTierText) {
      const S = getUIScale();
      const ghostSize = Math.round(36 * S);
      this.ghostTierText.setPosition(x + ghostSize / 2 - 2, y + ghostSize / 2 - 2);
    }
  }

  private destroyGhost(): void {
    this.ghostGraphics?.destroy();
    this.ghostTierText?.destroy();
    this.ghostGraphics = null;
    this.ghostTierText = null;
  }

  // --- Drop target detection ---

  private hitTestDropTarget(px: number, py: number): DropTarget | null {
    // Check inventory slots
    const invBounds = this.inventoryUI.getInvSlotBounds();
    for (let i = 0; i < invBounds.length; i++) {
      if (this.hitTest(px, py, invBounds[i])) {
        return { type: "inventory", slotIndex: i };
      }
    }

    // Check equipment slots (from inventory or equipment source)
    if (this.source?.type === "inventory" || this.source?.type === "equipment") {
      const eqBounds = this.inventoryUI.getEqSlotBounds();
      for (let i = 0; i < eqBounds.length; i++) {
        if (this.hitTest(px, py, eqBounds[i])) {
          return { type: "equipment", slotIndex: i };
        }
      }
    }

    // Check ground drop (above HUD, not over loot bag) — inventory or equipment source
    if (this.source?.type === "inventory" || this.source?.type === "equipment") {
      const panel = this.panelBoundsGetter();
      if (py < panel.y && !this.lootBagUI.isOverPanel(px, py)) {
        return { type: "ground" };
      }
    }

    return null;
  }

  private hitTest(px: number, py: number, b: SlotBounds): boolean {
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  private isValidDrop(source: DragSource, target: DropTarget, item: ItemInstanceData): boolean {
    if (source.type === "bag") {
      return target.type === "inventory";
    }

    if (source.type === "inventory") {
      if (target.type === "equipment") {
        const category = getItemCategory(item.baseItemId);
        return category === target.slotIndex;
      }
      if (target.type === "ground") {
        return true;
      }
      if (target.type === "inventory") {
        return target.slotIndex !== source.slotIndex;
      }
    }

    if (source.type === "equipment") {
      if (target.type === "inventory") {
        return true; // Unequip to any inventory slot
      }
      if (target.type === "ground") {
        return true; // Drop equipped item
      }
      if (target.type === "equipment") {
        return target.slotIndex !== source.slotIndex; // No self-drop
      }
    }

    return false;
  }

  // --- Highlight management ---

  private updateHighlight(target: DropTarget | null): void {
    const valid = target && this.item && this.source
      ? this.isValidDrop(this.source, target, this.item)
      : false;

    // Clear previous
    this.clearHighlight();

    if (!target || !valid) {
      this.currentHighlight = null;
      return;
    }

    this.currentHighlight = target;

    if (target.type === "inventory" && target.slotIndex !== undefined) {
      this.inventoryUI.setHighlightedInvSlot(target.slotIndex);
    } else if (target.type === "equipment" && target.slotIndex !== undefined) {
      this.inventoryUI.setHighlightedEqSlot(target.slotIndex);
    }
  }

  private clearHighlight(): void {
    this.inventoryUI.setHighlightedInvSlot(-1);
    this.inventoryUI.setHighlightedEqSlot(-1);
    this.currentHighlight = null;
  }

  // --- Action execution ---

  private executeDrop(source: DragSource, target: DropTarget): void {
    if (!this.room) return;

    if (source.type === "bag" && target.type === "inventory") {
      this.room.send(ClientMessage.PickupItem, {
        bagId: (source as { type: "bag"; bagId: string; slotIndex: number }).bagId,
        slotIndex: source.slotIndex,
      });
    } else if (source.type === "inventory" && target.type === "equipment") {
      this.room.send(ClientMessage.EquipItem, {
        inventorySlot: source.slotIndex,
      });
    } else if (source.type === "inventory" && target.type === "ground") {
      this.room.send(ClientMessage.DropItem, {
        slotIndex: source.slotIndex,
      });
    } else if (source.type === "inventory" && target.type === "inventory") {
      this.room.send(ClientMessage.SwapInventory, {
        fromSlot: source.slotIndex,
        toSlot: target.slotIndex,
      });
    } else if (source.type === "equipment" && target.type === "inventory") {
      this.room.send(ClientMessage.UnequipItem, {
        equipmentSlot: source.slotIndex,
        inventorySlot: target.slotIndex,
      });
    } else if (source.type === "equipment" && target.type === "ground") {
      this.room.send(ClientMessage.UnequipItem, {
        equipmentSlot: source.slotIndex,
        dropOnGround: true,
      });
    }
  }

  private executeClick(source: DragSource, item: ItemInstanceData): void {
    if (source.type === "inventory") {
      this.inventoryUI.onEquipItem(source.slotIndex);
    } else if (source.type === "bag") {
      this.lootBagUI.onPickupItem(source.slotIndex);
    }
  }
}
