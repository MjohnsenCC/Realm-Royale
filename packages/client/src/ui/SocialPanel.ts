import Phaser from "phaser";
import {
  isEmptyItem,
  getItemCategory,
  getItemSubtype,
  CLASS_NAMES,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale, getScreenWidth, getScreenHeight, PANEL_REF_WIDTH } from "./UIScale";
import { UI_PANEL_CORNER, UI_SCROLLBAR_CORNER } from "./UITextures";
import { getItemSpriteKey, getItemOutlinedSize } from "./ItemTextures";
import { isFriendByAccountName } from "./FriendStore";
import { getPlayerSpriteKey } from "./EntityTextures";
import { ItemTooltip } from "./ItemTooltip";

export interface NearbyPlayerInfo {
  sessionId: string;
  name: string;
  accountName: string;
  accountId: string;
  level: number;
  characterClass: number;
  distance: number;
  equipment: ItemInstanceData[];
  isFriend: boolean;
  online: boolean;
  serverRegion?: string;
}

const MAX_ROWS = 30;
const EQUIP_SLOT_COUNT = 4;

interface RowObjects {
  bg: Phaser.GameObjects.Rectangle;
  charSprite: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  equipSlots: Phaser.GameObjects.Image[];
  equipSlotBgs: Phaser.GameObjects.Image[];
  equipTierTexts: Phaser.GameObjects.Text[];
  rowZone: Phaser.GameObjects.Zone;
}

// Context menu
interface ContextMenuObjects {
  bg: Phaser.GameObjects.NineSlice;
  dmText: Phaser.GameObjects.Text;
  dmZone: Phaser.GameObjects.Zone;
  friendText: Phaser.GameObjects.Text;
  friendZone: Phaser.GameObjects.Zone;
}

export class SocialPanel {
  private scene: Phaser.Scene;
  private visible = false;
  private side: "left" | "right" = "left";
  private S: number;

  private px!: number;
  private py!: number;
  private panelWidth!: number;
  private viewHeight!: number;
  private contentHeight!: number;

  private panelBg: Phaser.GameObjects.NineSlice;
  private contentContainer: Phaser.GameObjects.Container;

  private scrollBarBg: Phaser.GameObjects.NineSlice;
  private scrollBarThumb: Phaser.GameObjects.NineSlice;

  private titleText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;

  // Tabs
  private nearbyTab: Phaser.GameObjects.Text;
  private friendsTab: Phaser.GameObjects.Text;
  private nearbyTabZone: Phaser.GameObjects.Zone;
  private friendsTabZone: Phaser.GameObjects.Zone;
  private activeTab: "nearby" | "friends" = "nearby";

  // Row pool
  private rows: RowObjects[] = [];
  private equipZones: Phaser.GameObjects.Zone[][] = [];
  private tooltip: ItemTooltip;

  // Context menu
  private ctxMenu: ContextMenuObjects | null = null;
  private ctxTarget: NearbyPlayerInfo | null = null;
  private ctxDismissListener: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  // Layout
  private pad!: number;
  private lineH!: number;
  private scrollBarWidth!: number;
  private tabY!: number;
  private tabGap!: number;
  private rowStartY!: number;
  private equipSize!: number;
  private rowStride!: number;
  private textMaxW!: number;

  // Scroll state
  private scrollY = 0;
  private maxScrollY = 0;

  // Mask
  private maskGraphics: Phaser.GameObjects.Graphics;
  private wheelListener: ((e: WheelEvent) => void) | null = null;

  // Data
  private players: NearbyPlayerInfo[] = [];
  private allFriends: NearbyPlayerInfo[] = [];

  // Callbacks
  private onDM: ((name: string) => void) | null = null;
  private onToggleFriend: ((name: string) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    this.computeLayout();
    this.tooltip = new ItemTooltip(scene);

    const C = UI_PANEL_CORNER;
    this.panelBg = scene.add.nineslice(0, 0, "ui-panel-dark", undefined, 100, 100, C, C, C, C)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(250);

    const SC = UI_SCROLLBAR_CORNER;
    this.scrollBarBg = scene.add.nineslice(0, 0, "ui-scrollbar-track", undefined, 10, 100, SC, SC, SC, SC)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(252);
    this.scrollBarThumb = scene.add.nineslice(0, 0, "ui-scrollbar-thumb", undefined, 10, 30, SC, SC, SC, SC)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(253);

    // Mask
    this.maskGraphics = scene.add.graphics().setScrollFactor(0);
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(this.px, this.py, this.panelWidth, this.viewHeight);
    this.maskGraphics.setVisible(false);
    const mask = this.maskGraphics.createGeometryMask();

    // Content container
    this.contentContainer = scene.add.container(this.px, this.py)
      .setScrollFactor(0)
      .setDepth(251);
    this.contentContainer.setMask(mask);

    const S = this.S;
    const titleFontSize = `${Math.round(9 * S)}px`;
    const hintFontSize = `${Math.round(6 * S)}px`;
    const tabFontSize = `${Math.round(7 * S)}px`;
    const contentW = this.panelWidth - this.scrollBarWidth - Math.round(8 * S);
    const centerX = contentW / 2;

    // Title
    this.titleText = scene.add
      .text(centerX, this.pad, "SOCIAL", {
        fontSize: titleFontSize,
        color: "#aaaaff",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.titleText);

    // Hint
    this.hintText = scene.add
      .text(centerX, this.pad + Math.round(14 * S), "Press O to close", {
        fontSize: hintFontSize,
        color: "#666666",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.hintText);

    // Tabs
    const tabBaseY = this.tabY;
    this.nearbyTab = scene.add
      .text(centerX - this.tabGap, tabBaseY, "NEARBY", {
        fontSize: tabFontSize,
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.nearbyTab);

    this.friendsTab = scene.add
      .text(centerX + this.tabGap, tabBaseY, "FRIENDS", {
        fontSize: tabFontSize,
        color: "#888888",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.friendsTab);

    // Tab zones (added to scene, not container, for correct input)
    this.nearbyTabZone = scene.add.zone(0, 0, Math.round(50 * S), Math.round(14 * S))
      .setScrollFactor(0).setDepth(254).setInteractive({ useHandCursor: true });
    this.nearbyTabZone.on("pointerdown", () => this.setTab("nearby"));

    this.friendsTabZone = scene.add.zone(0, 0, Math.round(50 * S), Math.round(14 * S))
      .setScrollFactor(0).setDepth(254).setInteractive({ useHandCursor: true });
    this.friendsTabZone.on("pointerdown", () => this.setTab("friends"));

    // Build row pool
    const nameFontSize = `${Math.round(6 * S)}px`;
    const smallFontSize = `${Math.round(5 * S)}px`;
    const tierFontSize = `${Math.round(5 * S)}px`;

    for (let i = 0; i < MAX_ROWS; i++) {
      const rowY = this.rowStartY + i * this.rowStride;
      const bgColor = i % 2 === 0 ? 0x222233 : 0x1a1a2a;
      const rowW = contentW;

      const bgW = rowW - this.pad;
      const bg = scene.add.rectangle(this.pad + bgW / 2, rowY + this.lineH / 2, bgW, this.lineH, bgColor, 0.5)
        .setOrigin(0.5, 0.5);
      this.contentContainer.add(bg);

      // Name text (top of row, inset by row padding)
      const rowPad = Math.round(4 * S);
      const textX = this.pad + rowPad;
      const nameText = scene.add.text(textX, rowY + rowPad, "", {
        fontSize: nameFontSize,
        color: "#66cc66",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0, 0);
      this.contentContainer.add(nameText);

      const levelText = scene.add.text(textX, rowY + rowPad + Math.round(10 * S), "", {
        fontSize: smallFontSize,
        color: "#aaaaaa",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0, 0);
      this.contentContainer.add(levelText);

      // Character sprite (bottom row, inline with equip slots, same size)
      const slotsRowCenterY = rowY + this.lineH - this.equipSize / 2 - rowPad;
      const spriteX = this.pad + rowPad + this.equipSize / 2;
      const charSprite = scene.add.image(spriteX, slotsRowCenterY, "sprite-player-archer")
        .setDisplaySize(this.equipSize, this.equipSize);
      this.contentContainer.add(charSprite);

      // Equipment slots (bottom row, after sprite)
      const equipSlots: Phaser.GameObjects.Image[] = [];
      const equipSlotBgs: Phaser.GameObjects.Image[] = [];
      const equipTierTexts: Phaser.GameObjects.Text[] = [];
      const eqGap = Math.round(2 * S);
      const eqStartX = this.pad + rowPad + this.equipSize + eqGap;

      for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
        const slotX = eqStartX + j * (this.equipSize + eqGap);
        const slotCenterX = slotX + this.equipSize / 2;
        const slotCenterY = slotsRowCenterY;

        const bgImg = scene.add.image(slotCenterX, slotCenterY, "ui-slot-empty")
          .setDisplaySize(this.equipSize, this.equipSize);
        this.contentContainer.add(bgImg);

        const img = scene.add.image(slotCenterX, slotCenterY, "__DEFAULT")
          .setDisplaySize(getItemOutlinedSize(), getItemOutlinedSize())
          .setVisible(false);
        this.contentContainer.add(img);

        const tierText = scene.add.text(slotX + this.equipSize - 1, slotsRowCenterY + this.equipSize / 2 - 1, "", {
          fontSize: tierFontSize,
          color: "#ffffff",
          fontFamily: "'Press Start 2P', monospace",
          stroke: "#000000",
          strokeThickness: 2,
        }).setOrigin(1, 1).setVisible(false);
        this.contentContainer.add(tierText);

        equipSlotBgs.push(bgImg);
        equipSlots.push(img);
        equipTierTexts.push(tierText);
      }

      // Per-slot zones for hover tooltips
      const rowIdx = i;
      const slotZones: Phaser.GameObjects.Zone[] = [];
      for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
        const eqZone = scene.add.zone(0, 0, this.equipSize, this.equipSize)
          .setScrollFactor(0).setDepth(255).setInteractive();
        const slotIdx = j;
        eqZone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
          const info = this.getVisiblePlayers()[rowIdx];
          if (info && info.online && slotIdx < info.equipment.length && !isEmptyItem(info.equipment[slotIdx])) {
            this.tooltip.show(info.equipment[slotIdx], pointer.x, pointer.y);
          }
        });
        eqZone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
          const info = this.getVisiblePlayers()[rowIdx];
          if (info && info.online && slotIdx < info.equipment.length && !isEmptyItem(info.equipment[slotIdx])) {
            this.tooltip.show(info.equipment[slotIdx], pointer.x, pointer.y);
          } else {
            this.tooltip.hide();
          }
        });
        eqZone.on("pointerout", () => {
          this.tooltip.hide();
        });
        slotZones.push(eqZone);
      }
      this.equipZones.push(slotZones);

      // Row zone for right-click context menu
      const rowZone = scene.add.zone(0, 0, rowW, this.lineH)
        .setScrollFactor(0).setDepth(254).setInteractive();
      rowZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          const info = this.getVisiblePlayers()[rowIdx];
          if (info && info.online) this.showContextMenu(info, pointer.x, pointer.y);
        }
      });

      this.rows.push({ bg, charSprite, nameText, levelText, equipSlots, equipSlotBgs, equipTierTexts, rowZone });
    }

    // Disable browser right-click menu on canvas
    scene.game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Start hidden
    this.setAllVisible(false);
  }

  setCallbacks(
    onDM: (name: string) => void,
    onToggleFriend: (name: string) => void,
  ): void {
    this.onDM = onDM;
    this.onToggleFriend = onToggleFriend;
  }

  populate(players: NearbyPlayerInfo[], allFriends: NearbyPlayerInfo[]): void {
    this.players = players;
    this.allFriends = allFriends;
    this.renderRows();
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.scrollY = 0;
    this.setAllVisible(true);
    this.drawBackground();
    this.renderRows();
    this.applyScroll();

    this.wheelListener = (e: WheelEvent) => {
      if (!this.visible) return;
      const pointer = this.scene.input.activePointer;
      if (
        pointer.x >= this.px &&
        pointer.x <= this.px + this.panelWidth &&
        pointer.y >= this.py &&
        pointer.y <= this.py + this.viewHeight
      ) {
        this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + e.deltaY * 0.5));
        this.applyScroll();
        this.tooltip.hide();
        e.preventDefault();
      }
    };
    this.scene.game.canvas.addEventListener("wheel", this.wheelListener, { passive: false });
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.hideContextMenu();
    this.tooltip.hide();
    this.setAllVisible(false);
    if (this.wheelListener) {
      this.scene.game.canvas.removeEventListener("wheel", this.wheelListener);
      this.wheelListener = null;
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  setSide(side: "left" | "right"): void {
    if (this.side === side) return;
    this.side = side;
    this.computeLayout();
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(this.px, this.py, this.panelWidth, this.viewHeight);
    const mask = this.maskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);
    if (this.visible) {
      this.drawBackground();
      this.applyScroll();
      this.updateZonePositions();
    }
  }

  relayout(): void {
    this.S = getUIScale();
    this.computeLayout();

    const S = this.S;
    const titleFontSize = `${Math.round(9 * S)}px`;
    const hintFontSize = `${Math.round(6 * S)}px`;
    const tabFontSize = `${Math.round(7 * S)}px`;
    const nameFontSize = `${Math.round(6 * S)}px`;
    const smallFontSize = `${Math.round(5 * S)}px`;
    const contentW = this.panelWidth - this.scrollBarWidth - Math.round(8 * S);
    const centerX = contentW / 2;

    this.titleText.setPosition(centerX, this.pad).setFontSize(titleFontSize);
    this.hintText.setPosition(centerX, this.pad + Math.round(14 * S)).setFontSize(hintFontSize);
    this.nearbyTab.setPosition(centerX - this.tabGap, this.tabY).setFontSize(tabFontSize);
    this.friendsTab.setPosition(centerX + this.tabGap, this.tabY).setFontSize(tabFontSize);

    // Update rows layout
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.rows[i];
      const rowY = this.rowStartY + i * this.rowStride;
      const rowW = contentW;

      const bgW = rowW - this.pad;
      row.bg.setPosition(this.pad + bgW / 2, rowY + this.lineH / 2);
      row.bg.setSize(bgW, this.lineH);

      // Text (top of row, inset by row padding)
      const rowPad = Math.round(4 * S);
      const textX = this.pad + rowPad;
      row.nameText.setPosition(textX, rowY + rowPad).setFontSize(nameFontSize).setScale(1);
      row.levelText.setPosition(textX, rowY + rowPad + Math.round(10 * S)).setFontSize(smallFontSize).setScale(1);

      // Character sprite (bottom row, inline with equip slots)
      const slotsRowCenterY = rowY + this.lineH - this.equipSize / 2 - rowPad;
      const spriteX = this.pad + rowPad + this.equipSize / 2;
      row.charSprite.setPosition(spriteX, slotsRowCenterY).setDisplaySize(this.equipSize, this.equipSize);

      // Equipment slots (bottom row, after sprite)
      const eqGap = Math.round(2 * S);
      const eqStartX = this.pad + rowPad + this.equipSize + eqGap;
      const tierFontSize = `${Math.round(5 * S)}px`;
      for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
        const slotX = eqStartX + j * (this.equipSize + eqGap);
        const slotCenterX = slotX + this.equipSize / 2;
        row.equipSlotBgs[j].setPosition(slotCenterX, slotsRowCenterY).setDisplaySize(this.equipSize, this.equipSize);
        row.equipSlots[j].setPosition(slotCenterX, slotsRowCenterY);
        if (row.equipSlots[j].texture.key !== "__DEFAULT") {
          row.equipSlots[j].setDisplaySize(getItemOutlinedSize(), getItemOutlinedSize());
        }
        row.equipTierTexts[j].setPosition(slotX + this.equipSize - 1, slotsRowCenterY + this.equipSize / 2 - 1).setFontSize(tierFontSize);
      }
    }

    // Rebuild mask
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(this.px, this.py, this.panelWidth, this.viewHeight);
    const mask = this.maskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    this.scrollY = 0;
    this.hideContextMenu();
    this.tooltip.hide();
    this.tooltip.relayout();

    if (this.visible) {
      this.drawBackground();
      this.renderRows();
      this.applyScroll();
    }
  }

  private computeLayout(): void {
    const S = this.S;
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();

    this.pad = Math.round(12 * S);
    this.scrollBarWidth = Math.round(8 * S);
    // Size slot to fit the pre-rendered item sprite (same ratio as HUD equip slots)
    const nativeItemSize = getItemOutlinedSize();
    this.equipSize = Math.round(nativeItemSize / 0.8);
    // Row has 3 sections: padding + name text + class/level text + sprite/slots row + padding
    const rowPad = Math.round(4 * S);
    this.lineH = rowPad + Math.round(10 * S) + Math.round(10 * S) + this.equipSize + rowPad;
    this.tabGap = Math.round(40 * S);
    this.rowStride = this.lineH + Math.round(4 * S);

    this.panelWidth = Math.min(Math.round(PANEL_REF_WIDTH * S), Math.round(screenW * 0.28));

    this.tabY = this.pad + Math.round(14 * S) + Math.round(14 * S);
    this.rowStartY = this.tabY + Math.round(18 * S);

    const panelMargin = Math.round(12 * S);
    this.px = this.side === "right"
      ? screenW - panelMargin - this.panelWidth
      : panelMargin;
    this.py = panelMargin;
    this.viewHeight = screenH - panelMargin * 2;

    this.contentHeight = this.rowStartY + MAX_ROWS * this.rowStride + this.pad;
    this.maxScrollY = Math.max(0, this.contentHeight - this.viewHeight);

    // Max width for name/level text (text spans full row width now, inset by row padding)
    const contentW = this.panelWidth - this.scrollBarWidth - Math.round(8 * S);
    this.textMaxW = Math.max(0, contentW - this.pad * 2 - rowPad * 2);
  }

  private setTab(tab: "nearby" | "friends"): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.nearbyTab.setColor(tab === "nearby" ? "#ffffff" : "#888888");
    this.friendsTab.setColor(tab === "friends" ? "#ffffff" : "#888888");
    this.scrollY = 0;
    this.hideContextMenu();
    this.tooltip.hide();
    this.renderRows();
    this.applyScroll();
  }

  private getVisiblePlayers(): NearbyPlayerInfo[] {
    if (this.activeTab === "friends") {
      return this.allFriends;
    }
    return this.players;
  }

  private renderRows(): void {
    const visible = this.getVisiblePlayers();
    const S = this.S;

    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.rows[i];
      if (i < visible.length) {
        const info = visible[i];
        row.bg.setVisible(true);

        // Character sprite
        if (info.online) {
          row.charSprite.setTexture(getPlayerSpriteKey(info.characterClass));
          row.charSprite.setVisible(true);
        } else {
          row.charSprite.setVisible(false);
        }

        // Display name
        let displayName = info.name;
        if (this.activeTab === "friends" && info.accountName) {
          displayName = info.online && info.name
            ? `${info.accountName} (${info.name})`
            : info.accountName;
        } else if (info.accountName && this.activeTab === "nearby") {
          displayName = `${info.accountName} (${info.name})`;
        }
        row.nameText.setText(displayName).setScale(1).setVisible(true);
        if (row.nameText.width > this.textMaxW) {
          row.nameText.setScale(this.textMaxW / row.nameText.width);
        }

        if (info.online) {
          row.nameText.setColor("#66cc66");
          row.levelText.setText(`${CLASS_NAMES[info.characterClass] ?? "???"} Lv. ${info.level}`);
        } else {
          row.nameText.setColor("#666666");
          row.levelText.setText("");
        }
        row.levelText.setScale(1).setVisible(true);
        if (row.levelText.width > this.textMaxW) {
          row.levelText.setScale(this.textMaxW / row.levelText.width);
        }

        // Equipment slots
        for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
          if (info.online) {
            const hasItem = j < info.equipment.length && !isEmptyItem(info.equipment[j]);
            row.equipSlotBgs[j].setTexture(hasItem ? "ui-slot-filled" : "ui-slot-empty");
            row.equipSlotBgs[j].setDisplaySize(this.equipSize, this.equipSize);
            row.equipSlotBgs[j].setVisible(true);
            if (hasItem) {
              const item = info.equipment[j];
              const category = getItemCategory(item.baseItemId);
              const subtype = getItemSubtype(item.baseItemId);
              const key = getItemSpriteKey(category, subtype, item.instanceTier, item.isUT);
              if (key && this.scene.textures.exists(key)) {
                row.equipSlots[j].setTexture(key);
                row.equipSlots[j].setDisplaySize(getItemOutlinedSize(), getItemOutlinedSize());
                row.equipSlots[j].setVisible(true);
              } else {
                row.equipSlots[j].setVisible(false);
              }
              const tierLabel = item.isUT ? "UT" : `T${item.instanceTier}`;
              row.equipTierTexts[j].setText(tierLabel).setVisible(true);
            } else {
              row.equipSlots[j].setVisible(false);
              row.equipTierTexts[j].setVisible(false);
            }
          } else {
            row.equipSlotBgs[j].setVisible(false);
            row.equipSlots[j].setVisible(false);
            row.equipTierTexts[j].setVisible(false);
          }
        }

        row.rowZone.setVisible(true);
      } else {
        row.bg.setVisible(false);
        row.charSprite.setVisible(false);
        row.nameText.setVisible(false);
        row.levelText.setVisible(false);
        for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
          row.equipSlotBgs[j].setVisible(false);
          row.equipSlots[j].setVisible(false);
          row.equipTierTexts[j].setVisible(false);
        }
        row.rowZone.setVisible(false);
      }
    }

    // Update content height based on actual visible count
    const visibleCount = Math.min(visible.length, MAX_ROWS);
    this.contentHeight = this.rowStartY + visibleCount * this.rowStride + this.pad;
    this.maxScrollY = Math.max(0, this.contentHeight - this.viewHeight);
    if (this.scrollY > this.maxScrollY) this.scrollY = this.maxScrollY;
  }

  // ---- Context menu ----

  private showContextMenu(info: NearbyPlayerInfo, screenX: number, screenY: number): void {
    this.hideContextMenu();
    this.ctxTarget = info;

    const S = this.S;
    const menuW = Math.round(100 * S);
    const itemH = Math.round(16 * S);
    const pad = Math.round(6 * S);
    const menuH = pad * 2 + itemH * 2 + Math.round(4 * S);
    const fontSize = `${Math.round(6 * S)}px`;

    const C = UI_PANEL_CORNER;
    const bg = this.scene.add.nineslice(screenX, screenY, "ui-panel-dark", undefined, menuW, menuH, C, C, C, C)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(310);

    // Clamp to screen
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();
    if (screenX + menuW > screenW - 4) bg.setX(screenW - 4 - menuW);
    if (screenY + menuH > screenH - 4) bg.setY(screenH - 4 - menuH);
    const mx = bg.x;
    const my = bg.y;

    // DM option
    const dmText = this.scene.add.text(mx + pad, my + pad, "DM", {
      fontSize,
      color: "#cccccc",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(311);

    const dmZone = this.scene.add.zone(mx + menuW / 2, my + pad + itemH / 2, menuW, itemH)
      .setScrollFactor(0).setDepth(312).setInteractive({ useHandCursor: true });
    dmZone.on("pointerover", () => dmText.setColor("#44ffaa"));
    dmZone.on("pointerout", () => dmText.setColor("#cccccc"));
    dmZone.on("pointerdown", () => {
      if (this.ctxTarget && this.onDM) this.onDM(this.ctxTarget.name);
      this.hideContextMenu();
    });

    // Friend option
    const friendLabel = info.isFriend ? "Remove Friend" : "Add Friend";
    const friendText = this.scene.add.text(mx + pad, my + pad + itemH + Math.round(4 * S), friendLabel, {
      fontSize,
      color: "#cccccc",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(311);

    const friendZone = this.scene.add.zone(mx + menuW / 2, my + pad + itemH + Math.round(4 * S) + itemH / 2, menuW, itemH)
      .setScrollFactor(0).setDepth(312).setInteractive({ useHandCursor: true });
    friendZone.on("pointerover", () => friendText.setColor("#44ffaa"));
    friendZone.on("pointerout", () => friendText.setColor("#cccccc"));
    friendZone.on("pointerdown", () => {
      if (this.ctxTarget && this.onToggleFriend) this.onToggleFriend(this.ctxTarget.name);
      this.hideContextMenu();
    });

    this.ctxMenu = { bg, dmText, dmZone, friendText, friendZone };

    // Close on any left click outside the menu (delayed so the current right-click doesn't consume it)
    this.scene.time.delayedCall(0, () => {
      if (this.ctxDismissListener) {
        this.scene.input.off("pointerdown", this.ctxDismissListener);
      }
      this.ctxDismissListener = (pointer: Phaser.Input.Pointer) => {
        if (!pointer.rightButtonDown()) {
          this.hideContextMenu();
        }
      };
      this.scene.input.on("pointerdown", this.ctxDismissListener);
    });
  }

  private hideContextMenu(): void {
    if (this.ctxDismissListener) {
      this.scene.input.off("pointerdown", this.ctxDismissListener);
      this.ctxDismissListener = null;
    }
    if (!this.ctxMenu) return;
    this.ctxMenu.bg.destroy();
    this.ctxMenu.dmText.destroy();
    this.ctxMenu.dmZone.destroy();
    this.ctxMenu.friendText.destroy();
    this.ctxMenu.friendZone.destroy();
    this.ctxMenu = null;
    this.ctxTarget = null;
  }

  // ---- Drawing helpers ----

  private drawBackground(): void {
    this.panelBg.setPosition(this.px, this.py);
    this.panelBg.setSize(this.panelWidth, this.viewHeight);
  }

  private applyScroll(): void {
    this.contentContainer.setPosition(this.px, this.py - this.scrollY);
    this.updateZonePositions();

    // Draw scroll bar
    if (this.maxScrollY > 0) {
      const sbX = this.px + this.panelWidth - this.scrollBarWidth - 2;
      const sbY = this.py + 4;
      const sbH = this.viewHeight - 8;

      this.scrollBarBg.setPosition(sbX, sbY);
      this.scrollBarBg.setSize(this.scrollBarWidth, sbH);
      this.scrollBarBg.setVisible(true);

      const thumbRatio = this.viewHeight / this.contentHeight;
      const thumbH = Math.max(Math.round(20 * this.S), sbH * thumbRatio);
      const thumbY = sbY + (sbH - thumbH) * (this.scrollY / this.maxScrollY);
      this.scrollBarThumb.setPosition(sbX, thumbY);
      this.scrollBarThumb.setSize(this.scrollBarWidth, thumbH);
      this.scrollBarThumb.setVisible(true);
    } else {
      this.scrollBarBg.setVisible(false);
      this.scrollBarThumb.setVisible(false);
    }
  }

  private updateZonePositions(): void {
    const S = this.S;
    const contentW = this.panelWidth - this.scrollBarWidth - Math.round(8 * S);
    const centerX = contentW / 2;

    // Tab zones (screen space)
    this.nearbyTabZone.setPosition(this.px + centerX - this.tabGap, this.py + this.tabY + Math.round(7 * S) - this.scrollY);
    this.friendsTabZone.setPosition(this.px + centerX + this.tabGap, this.py + this.tabY + Math.round(7 * S) - this.scrollY);

    // Row zones and equip zones (screen space)
    const rowPad = Math.round(S * 4);
    const eqGap = Math.round(S * 2);
    const eqStartX = this.pad + rowPad + this.equipSize + eqGap;

    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.rows[i];
      const rowY = this.rowStartY + i * this.rowStride;
      const screenRowY = this.py + rowY + this.lineH / 2 - this.scrollY;
      const slotsRowCenterY = rowY + this.lineH - this.equipSize / 2 - rowPad;
      const screenSlotsY = this.py + slotsRowCenterY - this.scrollY;

      row.rowZone.setPosition(this.px + contentW / 2, screenRowY);
      row.rowZone.setSize(contentW, this.lineH);

      // Equip slot zones
      for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
        const slotX = eqStartX + j * (this.equipSize + eqGap);
        const screenSlotCenterX = this.px + slotX + this.equipSize / 2;
        this.equipZones[i][j].setPosition(screenSlotCenterX, screenSlotsY);
        this.equipZones[i][j].setSize(this.equipSize, this.equipSize);
      }
    }
  }

  private setAllVisible(vis: boolean): void {
    this.panelBg.setVisible(vis);
    this.contentContainer.setVisible(vis);
    this.scrollBarBg.setVisible(vis);
    this.scrollBarThumb.setVisible(vis);
    this.nearbyTabZone.setVisible(vis);
    this.friendsTabZone.setVisible(vis);

    for (let i = 0; i < this.rows.length; i++) {
      this.rows[i].rowZone.setVisible(vis);
      for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
        this.equipZones[i][j].setVisible(vis);
      }
    }

    // Disable/enable interactivity
    if (vis) {
      this.nearbyTabZone.setInteractive({ useHandCursor: true });
      this.friendsTabZone.setInteractive({ useHandCursor: true });
      for (let i = 0; i < this.rows.length; i++) {
        this.rows[i].rowZone.setInteractive();
        for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
          this.equipZones[i][j].setInteractive();
        }
      }
    } else {
      this.nearbyTabZone.disableInteractive();
      this.friendsTabZone.disableInteractive();
      for (let i = 0; i < this.rows.length; i++) {
        this.rows[i].rowZone.disableInteractive();
        for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
          this.equipZones[i][j].disableInteractive();
        }
      }
    }
  }
}
