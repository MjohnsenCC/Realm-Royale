import Phaser from "phaser";
import {
  ClientMessage,
  getItemCategory,
  getItemSubtype,
  getItemColor,
  ItemCategory,
  isConsumableItem,
  isStackableItem,
  getMaxStack,
  getConsumableSlotIndex,
  HEALTH_POT_ID,
  MANA_POT_ID,
  PORTAL_GEM_ID,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { createEmptyItemInstance } from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";
import { drawItemIcon, getSlotBorderColor } from "./ItemIcons";
import type { InventoryUI } from "./InventoryUI";
import type { LootBagUI } from "./LootBagUI";
import type { CraftingUI } from "./CraftingUI";
import type { VaultUI } from "./VaultUI";
import type { HUD } from "./HUD";

export type DragSource =
  | { type: "bag"; bagId: string; slotIndex: number }
  | { type: "inventory"; slotIndex: number }
  | { type: "equipment"; slotIndex: number }
  | { type: "consumable"; slotIndex: number }
  | { type: "vault"; slotIndex: number };

export interface DropTarget {
  type: "inventory" | "equipment" | "ground" | "crafting" | "consumable" | "vault";
  slotIndex?: number;
}

interface SlotBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DRAG_THRESHOLD = 5;
const CONSUMABLE_ITEM_IDS = [HEALTH_POT_ID, MANA_POT_ID, PORTAL_GEM_ID];

export class DragManager {
  private scene: Phaser.Scene;
  private room: any = null;
  private inventoryUI!: InventoryUI;
  private lootBagUI!: LootBagUI;
  private craftingUI: CraftingUI | null = null;
  private vaultUI: VaultUI | null = null;
  private hud: HUD | null = null;
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

  setCraftingUI(ui: CraftingUI): void {
    this.craftingUI = ui;
  }

  setVaultUI(ui: VaultUI): void {
    this.vaultUI = ui;
  }

  setHUD(hud: HUD): void {
    this.hud = hud;
  }

  setPanelBoundsGetter(getter: () => SlotBounds): void {
    this.panelBoundsGetter = getter;
  }

  isDragging(): boolean {
    return this.active;
  }

  /** Called by InventoryUI/LootBagUI/HUD when a slot receives pointerdown */
  onSlotPointerDown(source: DragSource, item: ItemInstanceData, x: number, y: number): void {
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
      this.vaultUI?.setDragActive(true);
      this.hud?.setDragActive(true);
      this.createGhost(this.item);

      // Dim source slot
      if (this.source.type === "inventory") {
        this.inventoryUI.setDragSourceSlot(this.source.slotIndex);
      } else if (this.source.type === "bag") {
        this.lootBagUI.setDragSourceSlot(this.source.slotIndex);
      } else if (this.source.type === "equipment") {
        this.inventoryUI.setDragSourceEqSlot(this.source.slotIndex);
      } else if (this.source.type === "consumable") {
        this.hud?.setDragSourceConsumableSlot(this.source.slotIndex);
      } else if (this.source.type === "vault") {
        this.vaultUI?.setDragSourceSlot(this.source.slotIndex);
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
      // No drag occurred — do nothing (drag-only for moving items)
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
    this.vaultUI?.setDragActive(false);
    this.vaultUI?.setDragSourceSlot(-1);
    this.hud?.setDragActive(false);
    this.hud?.setDragSourceConsumableSlot(-1);
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

    // Border color: use slot color for consumables, tier-based for others
    const isConsumable = category === ItemCategory.Consumable;
    const consumableColors = [0xcc3333, 0x4466cc, 0xaa44ff];
    const borderColor = isConsumable ? consumableColors[subtype] ?? 0x666666 : getSlotBorderColor(item.isUT ? 13 : item.instanceTier);
    this.ghostGraphics.lineStyle(2, borderColor, 1);
    this.ghostGraphics.strokeRect(-ghostSize / 2, -ghostSize / 2, ghostSize, ghostSize);

    // Tier label: skip for consumables/orbs
    if (category !== ItemCategory.Consumable && category !== ItemCategory.CraftingOrb) {
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

    // Check equipment slots (from inventory, equipment, vault, or bag source)
    if (this.source?.type === "inventory" || this.source?.type === "equipment" || this.source?.type === "vault" || this.source?.type === "bag") {
      const eqBounds = this.inventoryUI.getEqSlotBounds();
      for (let i = 0; i < eqBounds.length; i++) {
        if (this.hitTest(px, py, eqBounds[i])) {
          return { type: "equipment", slotIndex: i };
        }
      }
    }

    // Check consumable slots
    if (this.hud) {
      const consBounds = this.hud.getConsumableSlotBounds();
      for (let i = 0; i < consBounds.length; i++) {
        if (this.hitTest(px, py, consBounds[i])) {
          return { type: "consumable", slotIndex: i };
        }
      }
    }

    // Check vault slots
    if (this.vaultUI?.isVisible()) {
      const vaultBounds = this.vaultUI.getVaultSlotBounds();
      for (let i = 0; i < vaultBounds.length; i++) {
        if (this.hitTest(px, py, vaultBounds[i])) {
          return { type: "vault", slotIndex: i };
        }
      }
    }

    // Check crafting slot (before ground, since crafting panel overlaps game area)
    if (this.craftingUI?.isVisible() && (this.source?.type === "inventory" || this.source?.type === "equipment")) {
      const craftBounds = this.craftingUI.getItemSlotBounds();
      if (craftBounds && this.hitTest(px, py, craftBounds)) {
        return { type: "crafting" };
      }
    }

    // Check ground drop — inventory, equipment, or consumable source
    if (this.source?.type === "inventory" || this.source?.type === "equipment" || this.source?.type === "consumable") {
      const panel = this.panelBoundsGetter();
      if (py < panel.y && !this.lootBagUI.isOverPanel(px, py) && !(this.vaultUI?.isOverPanel(px, py))) {
        return { type: "ground" };
      }
    }

    return null;
  }

  private hitTest(px: number, py: number, b: SlotBounds): boolean {
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  private isValidDrop(source: DragSource, target: DropTarget, item: ItemInstanceData): boolean {
    if (source.type === "vault") {
      if (target.type === "inventory") return true;
      if (target.type === "vault") return target.slotIndex !== source.slotIndex;
      if (target.type === "equipment") {
        const category = getItemCategory(item.baseItemId);
        return category >= 0 && category < 4 && category === target.slotIndex;
      }
      if (target.type === "consumable" && target.slotIndex !== undefined) {
        return isConsumableItem(item.baseItemId) && getConsumableSlotIndex(item.baseItemId) === target.slotIndex;
      }
      return false;
    }

    if (source.type === "bag") {
      if (target.type === "inventory") return true;
      // Bag to consumable slot: item must be the correct consumable
      if (target.type === "consumable" && target.slotIndex !== undefined) {
        return isConsumableItem(item.baseItemId) && getConsumableSlotIndex(item.baseItemId) === target.slotIndex;
      }
      // Bag to equipment: category must match equipment slot
      if (target.type === "equipment") {
        const category = getItemCategory(item.baseItemId);
        return category >= 0 && category < 4 && category === target.slotIndex;
      }
      return false;
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
      if (target.type === "vault") {
        return true;
      }
      // Inventory to consumable slot: item must match the slot
      if (target.type === "consumable" && target.slotIndex !== undefined) {
        return isConsumableItem(item.baseItemId) && getConsumableSlotIndex(item.baseItemId) === target.slotIndex;
      }
      // Inventory to crafting: equipment (select) or crafting orb (add to counter)
      if (target.type === "crafting") {
        return true;
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
      if (target.type === "vault") {
        return true; // Equipment to vault
      }
      if (target.type === "crafting") {
        return true;
      }
    }

    if (source.type === "consumable") {
      if (target.type === "inventory") {
        return true; // Move one consumable to inventory
      }
      if (target.type === "ground") {
        return true; // Drop one consumable on ground
      }
      if (target.type === "consumable") {
        return target.slotIndex !== source.slotIndex; // No self-drop
      }
      if (target.type === "vault") {
        return true; // Move consumable to vault
      }
      return false;
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
    } else if (target.type === "crafting") {
      this.craftingUI?.setHighlighted(true);
    } else if (target.type === "vault" && target.slotIndex !== undefined) {
      this.vaultUI?.setHighlightedVaultSlot(target.slotIndex);
    } else if (target.type === "consumable" && target.slotIndex !== undefined) {
      this.hud?.setHighlightedConsumableSlot(target.slotIndex);
    }
  }

  private clearHighlight(): void {
    this.inventoryUI.setHighlightedInvSlot(-1);
    this.inventoryUI.setHighlightedEqSlot(-1);
    this.craftingUI?.setHighlighted(false);
    this.vaultUI?.setHighlightedVaultSlot(-1);
    this.hud?.setHighlightedConsumableSlot(-1);
    this.currentHighlight = null;
  }

  // --- Action execution ---

  private executeDrop(source: DragSource, target: DropTarget): void {
    if (!this.room) return;

    const inv = this.inventoryUI.getInventory();
    const eq = this.inventoryUI.getEquipment();

    if (source.type === "bag" && target.type === "inventory") {
      // Optimistic: move bag item to first empty inventory slot, clear bag slot
      const bagItems = this.lootBagUI.getItems();
      const bagItem = bagItems[source.slotIndex];
      if (bagItem) {
        const targetSlot = target.slotIndex;
        const dropSlot = targetSlot !== undefined && inv[targetSlot]?.baseItemId < 0 ? targetSlot : inv.findIndex(item => item.baseItemId < 0);
        if (dropSlot !== -1) {
          inv[dropSlot] = { ...bagItem };
          this.inventoryUI.redrawSlots();
        }
        bagItems[source.slotIndex] = createEmptyItemInstance();
        this.lootBagUI.redrawItems();
      }

      this.room.send(ClientMessage.PickupItem, {
        bagId: (source as { type: "bag"; bagId: string; slotIndex: number }).bagId,
        slotIndex: source.slotIndex,
        targetSlot: target.slotIndex,
      });
    } else if (source.type === "bag" && target.type === "consumable") {
      // Bag directly to consumable slot
      const bagItems = this.lootBagUI.getItems();
      bagItems[source.slotIndex] = createEmptyItemInstance();
      this.lootBagUI.redrawItems();

      this.room.send(ClientMessage.PickupItem, {
        bagId: (source as { type: "bag"; bagId: string; slotIndex: number }).bagId,
        slotIndex: source.slotIndex,
        targetConsumableSlot: target.slotIndex,
      });
    } else if (source.type === "inventory" && target.type === "equipment") {
      // Optimistic: swap inventory item with equipment slot
      const category = getItemCategory(inv[source.slotIndex].baseItemId);
      const oldEquip = { ...eq[category] };
      eq[category] = { ...inv[source.slotIndex] };
      inv[source.slotIndex] = oldEquip;
      this.inventoryUI.redrawSlots();
      this.inventoryUI.redrawEquipmentSlots();

      this.room.send(ClientMessage.EquipItem, {
        inventorySlot: source.slotIndex,
      });
    } else if (source.type === "inventory" && target.type === "consumable") {
      // Inventory to consumable slot: send EquipItem (server handles consumable routing)
      inv[source.slotIndex] = createEmptyItemInstance();
      this.inventoryUI.redrawSlots();

      this.room.send(ClientMessage.EquipItem, {
        inventorySlot: source.slotIndex,
      });
    } else if (source.type === "inventory" && target.type === "ground") {
      // Optimistic: clear inventory slot
      inv[source.slotIndex] = createEmptyItemInstance();
      this.inventoryUI.redrawSlots();

      this.room.send(ClientMessage.DropItem, {
        slotIndex: source.slotIndex,
      });
    } else if (source.type === "inventory" && target.type === "inventory") {
      const fromSlot = source.slotIndex;
      const toSlot = target.slotIndex!;
      const fromItem = inv[fromSlot];
      const toItem = inv[toSlot];

      // Check for stackable merge (consumables + crafting orbs)
      if (fromItem.baseItemId >= 0 && toItem.baseItemId >= 0 &&
          isStackableItem(fromItem.baseItemId) && fromItem.baseItemId === toItem.baseItemId) {
        const maxStack = getMaxStack(fromItem.baseItemId);
        const fromQty = fromItem.quantity || 1;
        const toQty = toItem.quantity || 1;
        const merged = Math.min(fromQty + toQty, maxStack);
        const remainder = fromQty + toQty - merged;
        toItem.quantity = merged;
        if (remainder > 0) {
          fromItem.quantity = remainder;
        } else {
          inv[fromSlot] = createEmptyItemInstance();
        }
        this.inventoryUI.redrawSlots();
        this.room.send(ClientMessage.StackConsumables, {
          fromSource: "inventory", fromSlot,
          toSource: "inventory", toSlot,
        });
      } else {
        // Normal swap
        const temp = { ...inv[fromSlot] };
        inv[fromSlot] = { ...inv[toSlot] };
        inv[toSlot] = temp;
        this.inventoryUI.redrawSlots();
        this.room.send(ClientMessage.SwapInventory, { fromSlot, toSlot });
      }
    } else if (source.type === "equipment" && target.type === "inventory") {
      // Optimistic: move equipment to inventory (swap if occupied with same category)
      const eqSlot = source.slotIndex;
      const invSlot = target.slotIndex!;
      const invItem = inv[invSlot];
      const eqItem = { ...eq[eqSlot] };

      if (invItem.baseItemId >= 0) {
        const invCategory = getItemCategory(invItem.baseItemId);
        if (invCategory === eqSlot) {
          eq[eqSlot] = { ...invItem };
        } else {
          // Server will reject — don't optimistically update equipment
          eq[eqSlot] = createEmptyItemInstance();
        }
      } else {
        eq[eqSlot] = createEmptyItemInstance();
      }
      inv[invSlot] = eqItem;
      this.inventoryUI.redrawSlots();
      this.inventoryUI.redrawEquipmentSlots();

      this.room.send(ClientMessage.UnequipItem, {
        equipmentSlot: eqSlot,
        inventorySlot: invSlot,
      });
    } else if (source.type === "equipment" && target.type === "ground") {
      // Optimistic: clear equipment slot
      eq[source.slotIndex] = createEmptyItemInstance();
      this.inventoryUI.redrawEquipmentSlots();

      this.room.send(ClientMessage.UnequipItem, {
        equipmentSlot: source.slotIndex,
        dropOnGround: true,
      });
    } else if (target.type === "crafting" && this.craftingUI) {
      const location = source.type as "inventory" | "equipment";
      const item = location === "inventory" ? inv[source.slotIndex] : eq[source.slotIndex];
      if (item) {
        const category = getItemCategory(item.baseItemId);
        if (category === ItemCategory.CraftingOrb) {
          // Orb dragged to crafting: add to orb counter (same as equip)
          if (location === "inventory") {
            inv[source.slotIndex] = createEmptyItemInstance();
            this.inventoryUI.redrawSlots();
          }
          this.room.send(ClientMessage.EquipItem, {
            inventorySlot: source.slotIndex,
          });
        } else {
          // Equipment dragged to crafting: select for crafting (no move)
          this.craftingUI.selectItem(item, location, source.slotIndex);
        }
      }
    } else if (source.type === "vault" && target.type === "inventory") {
      // Vault -> Inventory
      if (this.vaultUI) {
        const vaultItems = this.vaultUI.getItems();
        const fromItem = vaultItems[source.slotIndex];
        const toItem = inv[target.slotIndex!];

        // Check for stackable merge
        if (fromItem.baseItemId >= 0 && toItem.baseItemId >= 0 &&
            isStackableItem(fromItem.baseItemId) && fromItem.baseItemId === toItem.baseItemId) {
          const maxStack = getMaxStack(fromItem.baseItemId);
          const fromQty = fromItem.quantity || 1;
          const toQty = toItem.quantity || 1;
          const merged = Math.min(fromQty + toQty, maxStack);
          const remainder = fromQty + toQty - merged;
          toItem.quantity = merged;
          if (remainder > 0) {
            fromItem.quantity = remainder;
          } else {
            vaultItems[source.slotIndex] = createEmptyItemInstance();
          }
          this.vaultUI.redrawItems();
          this.inventoryUI.redrawSlots();
          this.room.send(ClientMessage.StackConsumables, {
            fromSource: "vault", fromSlot: source.slotIndex,
            toSource: "inventory", toSlot: target.slotIndex,
          });
        } else {
          // Normal swap
          const fromCopy = { ...fromItem };
          const toCopy = { ...toItem };
          vaultItems[source.slotIndex] = toCopy;
          inv[target.slotIndex!] = fromCopy;
          this.vaultUI.redrawItems();
          this.inventoryUI.redrawSlots();
          this.room.send(ClientMessage.VaultMoveItem, {
            fromSource: "vault", fromSlot: source.slotIndex,
            toSource: "inventory", toSlot: target.slotIndex,
          });
        }
      }
    } else if (source.type === "inventory" && target.type === "vault") {
      // Inventory -> Vault
      if (this.vaultUI) {
        const vaultItems = this.vaultUI.getItems();
        const fromItem = inv[source.slotIndex];
        const toItem = vaultItems[target.slotIndex!];

        // Check for stackable merge
        if (fromItem.baseItemId >= 0 && toItem.baseItemId >= 0 &&
            isStackableItem(fromItem.baseItemId) && fromItem.baseItemId === toItem.baseItemId) {
          const maxStack = getMaxStack(fromItem.baseItemId);
          const fromQty = fromItem.quantity || 1;
          const toQty = toItem.quantity || 1;
          const merged = Math.min(fromQty + toQty, maxStack);
          const remainder = fromQty + toQty - merged;
          toItem.quantity = merged;
          if (remainder > 0) {
            fromItem.quantity = remainder;
          } else {
            inv[source.slotIndex] = createEmptyItemInstance();
          }
          this.inventoryUI.redrawSlots();
          this.vaultUI.redrawItems();
          this.room.send(ClientMessage.StackConsumables, {
            fromSource: "inventory", fromSlot: source.slotIndex,
            toSource: "vault", toSlot: target.slotIndex,
          });
        } else {
          // Normal swap
          const fromCopy = { ...fromItem };
          const toCopy = { ...toItem };
          inv[source.slotIndex] = toCopy;
          vaultItems[target.slotIndex!] = fromCopy;
          this.inventoryUI.redrawSlots();
          this.vaultUI.redrawItems();
          this.room.send(ClientMessage.VaultMoveItem, {
            fromSource: "inventory", fromSlot: source.slotIndex,
            toSource: "vault", toSlot: target.slotIndex,
          });
        }
      }
    } else if (source.type === "vault" && target.type === "vault") {
      // Vault -> Vault
      if (this.vaultUI) {
        const vaultItems = this.vaultUI.getItems();
        const fromItem = vaultItems[source.slotIndex];
        const toItem = vaultItems[target.slotIndex!];

        // Check for stackable merge
        if (fromItem.baseItemId >= 0 && toItem.baseItemId >= 0 &&
            isStackableItem(fromItem.baseItemId) && fromItem.baseItemId === toItem.baseItemId) {
          const maxStack = getMaxStack(fromItem.baseItemId);
          const fromQty = fromItem.quantity || 1;
          const toQty = toItem.quantity || 1;
          const merged = Math.min(fromQty + toQty, maxStack);
          const remainder = fromQty + toQty - merged;
          toItem.quantity = merged;
          if (remainder > 0) {
            fromItem.quantity = remainder;
          } else {
            vaultItems[source.slotIndex] = createEmptyItemInstance();
          }
          this.vaultUI.redrawItems();
          this.room.send(ClientMessage.StackConsumables, {
            fromSource: "vault", fromSlot: source.slotIndex,
            toSource: "vault", toSlot: target.slotIndex,
          });
        } else {
          // Normal swap
          const temp = { ...fromItem };
          vaultItems[source.slotIndex] = { ...toItem };
          vaultItems[target.slotIndex!] = temp;
          this.vaultUI.redrawItems();
          this.room.send(ClientMessage.VaultMoveItem, {
            fromSource: "vault", fromSlot: source.slotIndex,
            toSource: "vault", toSlot: target.slotIndex,
          });
        }
      }
    } else if (source.type === "vault" && target.type === "equipment") {
      // Vault -> Equipment: equip item from vault, old equipment goes to vault slot
      if (this.vaultUI) {
        const vaultItems = this.vaultUI.getItems();
        const fromItem = { ...vaultItems[source.slotIndex] };
        const oldEquip = { ...eq[target.slotIndex!] };
        eq[target.slotIndex!] = fromItem;
        vaultItems[source.slotIndex] = oldEquip;
        this.vaultUI.redrawItems();
        this.inventoryUI.redrawEquipmentSlots();
      }
      this.room.send(ClientMessage.VaultMoveItem, {
        fromSource: "vault", fromSlot: source.slotIndex,
        toSource: "equipment", toSlot: target.slotIndex,
      });
    } else if (source.type === "vault" && target.type === "consumable") {
      // Vault -> Consumable slot
      if (this.vaultUI) {
        const vaultItems = this.vaultUI.getItems();
        vaultItems[source.slotIndex] = createEmptyItemInstance();
        this.vaultUI.redrawItems();
      }
      this.room.send(ClientMessage.MoveVaultToConsumable, {
        vaultSlot: source.slotIndex,
        consumableSlot: target.slotIndex,
      });
    } else if (source.type === "equipment" && target.type === "vault") {
      // Equipment -> Vault: store equipment in vault
      if (this.vaultUI) {
        const vaultItems = this.vaultUI.getItems();
        const eqItem = { ...eq[source.slotIndex] };
        const vaultItem = { ...vaultItems[target.slotIndex!] };
        vaultItems[target.slotIndex!] = eqItem;
        // Only equip vault item back if it matches the equipment slot category
        if (vaultItem.baseItemId >= 0 && getItemCategory(vaultItem.baseItemId) === source.slotIndex) {
          eq[source.slotIndex] = vaultItem;
        } else {
          eq[source.slotIndex] = createEmptyItemInstance();
        }
        this.vaultUI.redrawItems();
        this.inventoryUI.redrawEquipmentSlots();
      }
      this.room.send(ClientMessage.VaultMoveItem, {
        fromSource: "equipment", fromSlot: source.slotIndex,
        toSource: "vault", toSlot: target.slotIndex,
      });
    } else if (source.type === "bag" && target.type === "equipment") {
      // Bag -> Equipment: equip item directly from bag
      const bagItems = this.lootBagUI.getItems();
      const bagItem = bagItems[source.slotIndex];
      if (bagItem) {
        const eqSlot = target.slotIndex!;
        const oldEquip = { ...eq[eqSlot] };
        eq[eqSlot] = { ...bagItem };
        bagItems[source.slotIndex] = createEmptyItemInstance();
        this.lootBagUI.redrawItems();
        this.inventoryUI.redrawEquipmentSlots();
        // If old equipment exists, put it in first empty inventory slot
        if (oldEquip.baseItemId >= 0) {
          const emptySlot = inv.findIndex(item => item.baseItemId < 0);
          if (emptySlot !== -1) {
            inv[emptySlot] = oldEquip;
            this.inventoryUI.redrawSlots();
          }
        }
      }
      this.room.send(ClientMessage.PickupItem, {
        bagId: (source as { type: "bag"; bagId: string; slotIndex: number }).bagId,
        slotIndex: source.slotIndex,
        targetEquipmentSlot: target.slotIndex,
      });
    } else if (source.type === "consumable" && target.type === "inventory") {
      // Move one consumable from slot to inventory (stacks if target has same consumable)
      const consumableIds = [HEALTH_POT_ID, MANA_POT_ID, PORTAL_GEM_ID];
      const consumableId = consumableIds[source.slotIndex];
      const targetSlot = target.slotIndex;
      if (targetSlot !== undefined && inv[targetSlot] && inv[targetSlot].baseItemId === consumableId) {
        // Optimistic stack
        const maxStack = getMaxStack(consumableId);
        const toQty = inv[targetSlot].quantity || 1;
        if (toQty < maxStack) {
          inv[targetSlot].quantity = toQty + 1;
          this.inventoryUI.redrawSlots();
        }
      }
      this.room.send(ClientMessage.MoveConsumableToInventory, {
        consumableSlot: source.slotIndex,
        targetSlot: target.slotIndex,
      });
    } else if (source.type === "consumable" && target.type === "vault") {
      // Move one consumable from slot to vault
      this.room.send(ClientMessage.MoveConsumableToVault, {
        consumableSlot: source.slotIndex,
        targetVaultSlot: target.slotIndex,
      });
    } else if (source.type === "consumable" && target.type === "ground") {
      // Drop one consumable on ground
      this.room.send(ClientMessage.DropConsumable, {
        consumableSlot: source.slotIndex,
      });
    }
  }
}
