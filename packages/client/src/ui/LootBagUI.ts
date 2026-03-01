import Phaser from "phaser";
import { BAG_SIZE, BagRarity, ITEM_DEFS, ClientMessage } from "@rotmg-lite/shared";
import { ItemTooltip } from "./ItemTooltip";

const SLOT_SIZE = 36;
const SLOT_GAP = 4;
const COLS = 4;
const ROWS = 2;
const PADDING = 8;
const PANEL_WIDTH = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
const PANEL_HEIGHT = ROWS * SLOT_SIZE + (ROWS - 1) * SLOT_GAP + PADDING * 2 + 18;

const BAG_HEADER_COLORS: Record<number, string> = {
  [BagRarity.Green]: "#44aa44",
  [BagRarity.Red]: "#cc3333",
  [BagRarity.Black]: "#cccccc",
};

const BAG_HEADER_NAMES: Record<number, string> = {
  [BagRarity.Green]: "Green Bag",
  [BagRarity.Red]: "Red Bag",
  [BagRarity.Black]: "Black Bag",
};

const BAG_BORDER_COLORS: Record<number, number> = {
  [BagRarity.Green]: 0x44aa44,
  [BagRarity.Red]: 0xcc3333,
  [BagRarity.Black]: 0xaaaaaa,
};

export class LootBagUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.Graphics;
  private slotGraphics: Phaser.GameObjects.Graphics;
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];
  private headerText: Phaser.GameObjects.Text;
  private room: any = null;
  private visible: boolean = false;
  private currentBagId: string = "";
  private currentItems: number[] = new Array(BAG_SIZE).fill(-1);
  private currentBagRarity: number = 0;
  private tooltip: ItemTooltip;

  constructor(scene: Phaser.Scene, tooltip: ItemTooltip) {
    this.scene = scene;
    this.tooltip = tooltip;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    // Background panel
    this.panelBg = scene.add.graphics();
    this.container.add(this.panelBg);

    // Header
    this.headerText = scene.add
      .text(0, 0, "Loot Bag", {
        fontSize: "12px",
        color: "#44aa44",
        fontFamily: "monospace",
      });
    this.container.add(this.headerText);

    // Slot graphics
    this.slotGraphics = scene.add.graphics();
    this.container.add(this.slotGraphics);

    // Create slot zones and texts
    for (let i = 0; i < BAG_SIZE; i++) {
      const zone = scene.add
        .zone(0, 0, SLOT_SIZE, SLOT_SIZE)
        .setScrollFactor(0)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) {
          this.onPickupItem(i);
        }
      });

      zone.on("pointerover", () => {
        const itemId = this.currentItems[i];
        if (itemId >= 0) {
          const invPanelWidth = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
          const panelX = 16 + invPanelWidth + 8;
          const panelY = this.scene.scale.height - PANEL_HEIGHT - 16;
          this.tooltip.show(itemId, panelX, panelY - 8);
        }
      });
      zone.on("pointerout", () => {
        this.tooltip.hide();
      });

      this.slotZones.push(zone);

      const text = scene.add
        .text(0, 0, "", {
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

    this.setVisible(false);
  }

  setRoom(room: any): void {
    this.room = room;
  }

  show(bagId: string, bagRarity: number, items: number[]): void {
    this.currentBagId = bagId;
    this.currentBagRarity = bagRarity;
    for (let i = 0; i < BAG_SIZE; i++) {
      this.currentItems[i] = i < items.length ? items[i] : -1;
    }
    this.setVisible(true);
    this.redraw();
  }

  hide(): void {
    this.currentBagId = "";
    this.setVisible(false);
  }

  /** Update bag contents (called when bag state changes while open) */
  updateItems(items: number[]): void {
    if (!this.visible) return;
    let changed = false;
    for (let i = 0; i < BAG_SIZE; i++) {
      const val = i < items.length ? items[i] : -1;
      if (this.currentItems[i] !== val) {
        this.currentItems[i] = val;
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
  }

  private redraw(): void {
    // Position: next to inventory panel (to the right of it)
    const invPanelWidth = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
    const panelX = 16 + invPanelWidth + 8;
    const panelY = this.scene.scale.height - PANEL_HEIGHT - 16;

    // Background
    this.panelBg.clear();
    const borderColor = BAG_BORDER_COLORS[this.currentBagRarity] ?? 0x44aa44;
    this.panelBg.fillStyle(0x111122, 0.9);
    this.panelBg.fillRoundedRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 6);
    this.panelBg.lineStyle(2, borderColor, 1);
    this.panelBg.strokeRoundedRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 6);

    // Header
    const headerColor = BAG_HEADER_COLORS[this.currentBagRarity] ?? "#44aa44";
    const headerName = BAG_HEADER_NAMES[this.currentBagRarity] ?? "Loot Bag";
    this.headerText.setText(headerName);
    this.headerText.setColor(headerColor);
    this.headerText.setPosition(panelX + PADDING, panelY + 4);

    // Slots
    this.slotGraphics.clear();
    for (let i = 0; i < BAG_SIZE; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = panelX + PADDING + col * (SLOT_SIZE + SLOT_GAP);
      const sy = panelY + 18 + PADDING + row * (SLOT_SIZE + SLOT_GAP);

      const itemType = this.currentItems[i];
      const def = itemType >= 0 ? ITEM_DEFS[itemType] : null;

      if (def) {
        this.slotGraphics.fillStyle(def.color, 0.4);
      } else {
        this.slotGraphics.fillStyle(0x222233, 0.6);
      }
      this.slotGraphics.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

      // Use tier color for border
      const slotBorder = def ? def.tierColor : 0x333344;
      this.slotGraphics.lineStyle(1, slotBorder, 1);
      this.slotGraphics.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE);

      if (def) {
        const shortName = def.name.length > 8 ? def.name.substring(0, 7) + "." : def.name;
        this.itemTexts[i].setText(shortName);
        this.itemTexts[i].setColor("#ffffff");
      } else {
        this.itemTexts[i].setText("");
      }
      this.itemTexts[i].setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2);
      this.slotZones[i].setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2);
    }
  }

  private onPickupItem(slotIndex: number): void {
    if (!this.room || !this.currentBagId) return;
    if (this.currentItems[slotIndex] === -1) return;
    this.room.send(ClientMessage.PickupItem, {
      bagId: this.currentBagId,
      slotIndex,
    });
  }

  /** Returns true if the given screen coordinates are over the loot bag panel */
  isOverPanel(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    const invPanelWidth = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
    const panelX = 16 + invPanelWidth + 8;
    const panelY = this.scene.scale.height - PANEL_HEIGHT - 16;
    return (
      screenX >= panelX &&
      screenX <= panelX + PANEL_WIDTH &&
      screenY >= panelY &&
      screenY <= panelY + PANEL_HEIGHT
    );
  }
}
