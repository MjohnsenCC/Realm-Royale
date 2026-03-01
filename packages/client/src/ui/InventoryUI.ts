import Phaser from "phaser";
import { INVENTORY_SIZE, ITEM_DEFS, ClientMessage } from "@rotmg-lite/shared";

const SLOT_SIZE = 36;
const SLOT_GAP = 4;
const COLS = 4;
const ROWS = 2;
const PADDING = 8;
const PANEL_WIDTH = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
const PANEL_HEIGHT = ROWS * SLOT_SIZE + (ROWS - 1) * SLOT_GAP + PADDING * 2 + 18; // +18 for header

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

  // Expose panel dimensions for LootBagUI positioning
  static readonly PANEL_WIDTH = PANEL_WIDTH;
  static readonly PANEL_HEIGHT = PANEL_HEIGHT;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Position: bottom-left of screen
    const panelX = 16;
    const panelY = scene.scale.height - PANEL_HEIGHT - 16;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    // Background panel
    this.panelBg = scene.add.graphics();
    this.panelBg.fillStyle(0x111122, 0.85);
    this.panelBg.fillRoundedRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 6);
    this.panelBg.lineStyle(1, 0x444466, 1);
    this.panelBg.strokeRoundedRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 6);
    this.container.add(this.panelBg);

    // Header
    this.headerText = scene.add
      .text(panelX + PADDING, panelY + 4, "Inventory", {
        fontSize: "12px",
        color: "#aaaacc",
        fontFamily: "monospace",
      });
    this.container.add(this.headerText);

    // Slot graphics
    this.slotGraphics = scene.add.graphics();
    this.container.add(this.slotGraphics);

    // Create slot zones for interaction + item texts
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = panelX + PADDING + col * (SLOT_SIZE + SLOT_GAP);
      const sy = panelY + 18 + PADDING + row * (SLOT_SIZE + SLOT_GAP);

      // Interactive zone for right-click
      const zone = scene.add
        .zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          this.onDropItem(i);
        }
      });

      this.slotZones.push(zone);

      // Item label text (centered in slot)
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
  }

  setRoom(room: any): void {
    this.room = room;
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

  private drawSlots(): void {
    this.slotGraphics.clear();
    const panelX = 16;
    const panelY = this.scene.scale.height - PANEL_HEIGHT - 16;

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
      this.slotGraphics.lineStyle(1, def ? 0x888888 : 0x333344, 1);
      this.slotGraphics.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

      // Update text
      if (def) {
        // Show abbreviated name (first word or truncated)
        const shortName = def.name.length > 8 ? def.name.substring(0, 7) + "." : def.name;
        this.itemTexts[i].setText(shortName);
        this.itemTexts[i].setColor("#ffffff");
      } else {
        this.itemTexts[i].setText("");
      }

      // Update zone position
      this.slotZones[i].setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2);
    }
  }

  private onDropItem(slotIndex: number): void {
    if (!this.room) return;
    if (this.currentInventory[slotIndex] === -1) return;
    this.room.send(ClientMessage.DropItem, { slotIndex });
  }

  /** Returns true if the given screen coordinates are over the inventory panel */
  isOverPanel(screenX: number, screenY: number): boolean {
    const panelX = 16;
    const panelY = this.scene.scale.height - PANEL_HEIGHT - 16;
    return (
      screenX >= panelX &&
      screenX <= panelX + PANEL_WIDTH &&
      screenY >= panelY &&
      screenY <= panelY + PANEL_HEIGHT
    );
  }
}
