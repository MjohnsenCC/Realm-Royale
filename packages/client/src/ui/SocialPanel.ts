import Phaser from "phaser";
import {
  isEmptyItem,
  getItemCategory,
  getItemSubtype,
  CLASS_NAMES,
  getZoneDisplayName,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale, getScreenWidth, getScreenHeight, PANEL_REF_WIDTH } from "./UIScale";
import { UI_PANEL_CORNER, UI_SCROLLBAR_CORNER } from "./UITextures";
import { getItemSpriteKey, getItemOutlinedSize } from "./ItemTextures";
import { isFriendByAccountName, hasPendingRequestToByName, hasPendingRequestFromByName, type FriendRequestEntry } from "./FriendStore";
import { getPlayerSpriteKey, OUTLINED_DISPLAY_SIZE } from "./EntityTextures";
import { ItemTooltip } from "./ItemTooltip";
import { addText } from "./TextFactory";

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
  zone?: string;
  lastOnlineAt?: string;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return "over a month ago";
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
  // Inline action buttons for friend requests
  actionBtn1: Phaser.GameObjects.Text;
  actionBtn2: Phaser.GameObjects.Text;
  actionZone1: Phaser.GameObjects.Zone;
  actionZone2: Phaser.GameObjects.Zone;
}

// Context menu
interface ContextMenuObjects {
  bg: Phaser.GameObjects.NineSlice;
  menuTexts: Phaser.GameObjects.Text[];
  menuZones: Phaser.GameObjects.Zone[];
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
  private requestsTab: Phaser.GameObjects.Text;
  private nearbyTabZone: Phaser.GameObjects.Zone;
  private friendsTabZone: Phaser.GameObjects.Zone;
  private requestsTabZone: Phaser.GameObjects.Zone;
  private activeTab: "nearby" | "friends" | "requests" = "nearby";

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
  private incomingRequests: FriendRequestEntry[] = [];
  private outgoingRequests: FriendRequestEntry[] = [];

  // Callbacks
  private onDM: ((name: string) => void) | null = null;
  private onBlock: ((name: string, block: boolean) => void) | null = null;
  private onToggleFriend: ((name: string) => void) | null = null;
  private onAcceptRequest: ((accountId: string) => void) | null = null;
  private onDeclineRequest: ((accountId: string) => void) | null = null;
  private onCancelRequest: ((accountId: string) => void) | null = null;

  // Client-side tracking of blocked names
  private blockedNames = new Set<string>();

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
    this.titleText = addText(scene,
      centerX, this.pad, "SOCIAL", {
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
    this.hintText = addText(scene,
      centerX, this.pad + Math.round(14 * S), "Press O to close", {
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
    this.nearbyTab = addText(scene,
      centerX - this.tabGap, tabBaseY, "NEARBY", {
        fontSize: tabFontSize,
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.nearbyTab);

    this.friendsTab = addText(scene,
      centerX, tabBaseY, "FRIENDS", {
        fontSize: tabFontSize,
        color: "#888888",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.friendsTab);

    this.requestsTab = addText(scene,
      centerX + this.tabGap, tabBaseY, "REQUESTS", {
        fontSize: tabFontSize,
        color: "#888888",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.requestsTab);

    // Tab zones (added to scene, not container, for correct input)
    this.nearbyTabZone = scene.add.zone(0, 0, Math.round(50 * S), Math.round(14 * S))
      .setScrollFactor(0).setDepth(254).setInteractive({ useHandCursor: true });
    this.nearbyTabZone.on("pointerdown", () => this.setTab("nearby"));

    this.friendsTabZone = scene.add.zone(0, 0, Math.round(50 * S), Math.round(14 * S))
      .setScrollFactor(0).setDepth(254).setInteractive({ useHandCursor: true });
    this.friendsTabZone.on("pointerdown", () => this.setTab("friends"));

    this.requestsTabZone = scene.add.zone(0, 0, Math.round(50 * S), Math.round(14 * S))
      .setScrollFactor(0).setDepth(254).setInteractive({ useHandCursor: true });
    this.requestsTabZone.on("pointerdown", () => this.setTab("requests"));

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
      const nameText = addText(scene, textX, rowY + rowPad, "", {
        fontSize: nameFontSize,
        color: "#66cc66",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0, 0);
      this.contentContainer.add(nameText);

      const levelText = addText(scene, textX, rowY + rowPad + Math.round(10 * S), "", {
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
        .setDisplaySize(OUTLINED_DISPLAY_SIZE, OUTLINED_DISPLAY_SIZE);
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

        const tierText = addText(scene, slotX + this.equipSize - 1, slotsRowCenterY + this.equipSize / 2 - 1, "", {
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
          if (this.ctxMenu) return;
          const info = this.getVisiblePlayers()[rowIdx];
          if (info && info.online && slotIdx < info.equipment.length && !isEmptyItem(info.equipment[slotIdx])) {
            this.tooltip.show(info.equipment[slotIdx], pointer.x, pointer.y);
          }
        });
        eqZone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
          if (this.ctxMenu) return;
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
        eqZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) {
            this.tooltip.hide();
            const info = this.getVisiblePlayers()[rowIdx];
            if (info && (info.online || this.activeTab === "friends" || this.activeTab === "requests")) {
              this.showContextMenu(info, pointer.x, pointer.y);
            }
          }
        });
        slotZones.push(eqZone);
      }
      this.equipZones.push(slotZones);

      // Inline action buttons for friend requests (positioned at bottom-right of row)
      const btnFontSize = `${Math.round(5 * S)}px`;
      const actionBtn1 = addText(scene, 0, 0, "", {
        fontSize: btnFontSize,
        color: "#44ff44",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(1, 0.5).setVisible(false);
      this.contentContainer.add(actionBtn1);

      const actionBtn2 = addText(scene, 0, 0, "", {
        fontSize: btnFontSize,
        color: "#ff4444",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(1, 0.5).setVisible(false);
      this.contentContainer.add(actionBtn2);

      // Action zones (in screen space, like equip zones)
      const actionZone1 = scene.add.zone(0, 0, Math.round(50 * S), Math.round(14 * S))
        .setScrollFactor(0).setDepth(256).setInteractive({ useHandCursor: true });
      actionZone1.on("pointerover", () => actionBtn1.setColor("#88ff88"));
      actionZone1.on("pointerout", () => actionBtn1.setColor("#44ff44"));
      actionZone1.on("pointerdown", () => {
        const info = this.getVisiblePlayers()[rowIdx];
        if (!info || this.activeTab !== "requests") return;
        const isIncoming = info.serverRegion === "incoming";
        if (isIncoming) {
          if (this.onAcceptRequest) this.onAcceptRequest(info.accountId);
        } else {
          if (this.onCancelRequest) this.onCancelRequest(info.accountId);
        }
      });

      const actionZone2 = scene.add.zone(0, 0, Math.round(50 * S), Math.round(14 * S))
        .setScrollFactor(0).setDepth(256).setInteractive({ useHandCursor: true });
      actionZone2.on("pointerover", () => actionBtn2.setColor("#ff8888"));
      actionZone2.on("pointerout", () => actionBtn2.setColor("#ff4444"));
      actionZone2.on("pointerdown", () => {
        const info = this.getVisiblePlayers()[rowIdx];
        if (!info || this.activeTab !== "requests") return;
        if (info.serverRegion === "incoming") {
          if (this.onDeclineRequest) this.onDeclineRequest(info.accountId);
        }
      });

      // Row zone for right-click context menu
      const rowZone = scene.add.zone(0, 0, rowW, this.lineH)
        .setScrollFactor(0).setDepth(254).setInteractive();
      rowZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          const info = this.getVisiblePlayers()[rowIdx];
          if (info && (info.online || this.activeTab === "friends" || this.activeTab === "requests")) this.showContextMenu(info, pointer.x, pointer.y);
        }
      });

      this.rows.push({ bg, charSprite, nameText, levelText, equipSlots, equipSlotBgs, equipTierTexts, rowZone, actionBtn1, actionBtn2, actionZone1, actionZone2 });
    }

    // Disable browser right-click menu on canvas
    scene.game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Start hidden
    this.setAllVisible(false);
  }

  setCallbacks(
    onDM: (name: string) => void,
    onBlock: (name: string, block: boolean) => void,
    onToggleFriend: (name: string) => void,
    onAcceptRequest: (accountId: string) => void,
    onDeclineRequest: (accountId: string) => void,
    onCancelRequest: (accountId: string) => void,
  ): void {
    this.onDM = onDM;
    this.onBlock = onBlock;
    this.onToggleFriend = onToggleFriend;
    this.onAcceptRequest = onAcceptRequest;
    this.onDeclineRequest = onDeclineRequest;
    this.onCancelRequest = onCancelRequest;
  }

  populate(players: NearbyPlayerInfo[], allFriends: NearbyPlayerInfo[], incomingRequests: FriendRequestEntry[] = [], outgoingRequests: FriendRequestEntry[] = []): void {
    this.players = players;
    this.allFriends = allFriends;
    this.incomingRequests = incomingRequests;
    this.outgoingRequests = outgoingRequests;
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

  isOverPanel(x: number, y: number): boolean {
    if (!this.visible) return false;
    return (
      x >= this.px &&
      x <= this.px + this.panelWidth &&
      y >= this.py &&
      y <= this.py + this.viewHeight
    );
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
    this.friendsTab.setPosition(centerX, this.tabY).setFontSize(tabFontSize);
    this.requestsTab.setPosition(centerX + this.tabGap, this.tabY).setFontSize(tabFontSize);

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
      row.charSprite.setPosition(spriteX, slotsRowCenterY).setDisplaySize(OUTLINED_DISPLAY_SIZE, OUTLINED_DISPLAY_SIZE);

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

      // Action buttons font size (positions set by renderRows)
      const btnFontSize = `${Math.round(5 * S)}px`;
      row.actionBtn1.setFontSize(btnFontSize);
      row.actionBtn2.setFontSize(btnFontSize);
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
    this.tabGap = Math.round(55 * S);
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

  private setTab(tab: "nearby" | "friends" | "requests"): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.nearbyTab.setColor(tab === "nearby" ? "#ffffff" : "#888888");
    this.friendsTab.setColor(tab === "friends" ? "#ffffff" : "#888888");
    this.requestsTab.setColor(tab === "requests" ? "#ffffff" : "#888888");
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
    if (this.activeTab === "requests") {
      return this.getRequestRows();
    }
    return this.players;
  }

  /**
   * Build virtual NearbyPlayerInfo rows for the requests tab.
   * Incoming requests first (with a header-like marker), then outgoing.
   */
  private getRequestRows(): NearbyPlayerInfo[] {
    const rows: NearbyPlayerInfo[] = [];
    for (const req of this.incomingRequests) {
      rows.push({
        sessionId: "",
        name: "",
        accountName: req.accountName,
        accountId: req.accountId,
        level: 0,
        characterClass: 0,
        distance: 0,
        equipment: [],
        isFriend: false,
        online: false,
        serverRegion: "incoming",
      });
    }
    for (const req of this.outgoingRequests) {
      rows.push({
        sessionId: "",
        name: "",
        accountName: req.accountName,
        accountId: req.accountId,
        level: 0,
        characterClass: 0,
        distance: 0,
        equipment: [],
        isFriend: false,
        online: false,
        serverRegion: "outgoing",
      });
    }
    return rows;
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
        if (this.activeTab === "requests") {
          const isIncoming = info.serverRegion === "incoming";
          displayName = info.accountName;
          row.nameText.setText(displayName).setScale(1).setVisible(true);
          if (row.nameText.width > this.textMaxW) {
            row.nameText.setScale(this.textMaxW / row.nameText.width);
          }
          row.nameText.setColor(isIncoming ? "#ffcc44" : "#888888");
          row.levelText.setText(isIncoming ? "Incoming request" : "Outgoing request");
          row.levelText.setColor(isIncoming ? "#aa8833" : "#555555");
        } else if (this.activeTab === "friends" && info.accountName) {
          displayName = info.online && info.name
            ? `${info.accountName} (${info.name})`
            : info.accountName;
          row.nameText.setText(displayName).setScale(1).setVisible(true);
          if (row.nameText.width > this.textMaxW) {
            row.nameText.setScale(this.textMaxW / row.nameText.width);
          }
          if (info.online) {
            row.nameText.setColor("#66cc66");
            const zoneStr = info.zone ? ` - ${getZoneDisplayName(info.zone)}` : "";
            row.levelText.setText(`${CLASS_NAMES[info.characterClass] ?? "???"} Lv. ${info.level}${zoneStr}`);
          } else {
            row.nameText.setColor("#666666");
            row.levelText.setText(info.lastOnlineAt ? `Last seen: ${formatTimeAgo(info.lastOnlineAt)}` : "");
            row.levelText.setColor("#555555");
          }
        } else {
          if (info.accountName && this.activeTab === "nearby") {
            displayName = `${info.accountName} (${info.name})`;
          }
          row.nameText.setText(displayName).setScale(1).setVisible(true);
          if (row.nameText.width > this.textMaxW) {
            row.nameText.setScale(this.textMaxW / row.nameText.width);
          }
          if (info.online) {
            row.nameText.setColor("#66cc66");
            const zoneStr = info.zone ? ` - ${getZoneDisplayName(info.zone)}` : "";
            row.levelText.setText(`${CLASS_NAMES[info.characterClass] ?? "???"} Lv. ${info.level}${zoneStr}`);
          } else {
            row.nameText.setColor("#666666");
            row.levelText.setText(info.lastOnlineAt ? `Last seen: ${formatTimeAgo(info.lastOnlineAt)}` : "");
            row.levelText.setColor("#555555");
          }
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

        // Action buttons for requests tab
        if (this.activeTab === "requests") {
          const isIncoming = info.serverRegion === "incoming";
          const rowY = this.rowStartY + i * this.rowStride;
          const rowPad = Math.round(4 * S);
          const contentW = this.panelWidth - this.scrollBarWidth - Math.round(8 * S);
          const btnRightX = contentW - this.pad - rowPad;
          const btnCenterY = rowY + this.lineH / 2;

          if (isIncoming) {
            row.actionBtn1.setText("Accept").setColor("#44ff44")
              .setPosition(btnRightX, btnCenterY - Math.round(6 * S)).setVisible(true);
            row.actionBtn2.setText("Decline").setColor("#ff4444")
              .setPosition(btnRightX, btnCenterY + Math.round(6 * S)).setVisible(true);
            row.actionZone1.setVisible(true).setInteractive({ useHandCursor: true });
            row.actionZone2.setVisible(true).setInteractive({ useHandCursor: true });
          } else {
            row.actionBtn1.setText("Cancel").setColor("#ff8844")
              .setPosition(btnRightX, btnCenterY).setVisible(true);
            row.actionBtn2.setVisible(false);
            row.actionZone1.setVisible(true).setInteractive({ useHandCursor: true });
            row.actionZone2.setVisible(false);
            row.actionZone2.disableInteractive();
          }
        } else {
          row.actionBtn1.setVisible(false);
          row.actionBtn2.setVisible(false);
          row.actionZone1.setVisible(false);
          row.actionZone2.setVisible(false);
          row.actionZone1.disableInteractive();
          row.actionZone2.disableInteractive();
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
        row.actionBtn1.setVisible(false);
        row.actionBtn2.setVisible(false);
        row.actionZone1.setVisible(false);
        row.actionZone2.setVisible(false);
        row.actionZone1.disableInteractive();
        row.actionZone2.disableInteractive();
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
    const fontSize = `${Math.round(6 * S)}px`;

    // Build menu items based on context
    const menuItems: { label: string; action: () => void }[] = [];

    if (this.activeTab === "requests") {
      const isIncoming = info.serverRegion === "incoming";
      if (isIncoming) {
        menuItems.push({
          label: "Accept",
          action: () => { if (this.ctxTarget && this.onAcceptRequest) this.onAcceptRequest(this.ctxTarget.accountId); },
        });
        menuItems.push({
          label: "Decline",
          action: () => { if (this.ctxTarget && this.onDeclineRequest) this.onDeclineRequest(this.ctxTarget.accountId); },
        });
      } else {
        menuItems.push({
          label: "Cancel Request",
          action: () => { if (this.ctxTarget && this.onCancelRequest) this.onCancelRequest(this.ctxTarget.accountId); },
        });
      }
    } else {
      // DM option (only for online players with a character name)
      if (info.name) {
        menuItems.push({
          label: "DM",
          action: () => { if (this.ctxTarget && this.onDM) this.onDM(this.ctxTarget!.name); },
        });
      }

      // Block / Unblock
      if (info.name) {
        const isBlocked = this.blockedNames.has(info.name);
        menuItems.push({
          label: isBlocked ? "Unblock" : "Block",
          action: () => {
            if (!this.ctxTarget || !this.onBlock) return;
            const name = this.ctxTarget.name;
            if (isBlocked) {
              this.blockedNames.delete(name);
              this.onBlock(name, false);
            } else {
              this.blockedNames.add(name);
              this.onBlock(name, true);
            }
          },
        });
      }

      // Friend/request option
      if (info.isFriend) {
        menuItems.push({
          label: "Remove Friend",
          action: () => { if (this.ctxTarget && this.onToggleFriend) this.onToggleFriend(this.ctxTarget!.accountName || this.ctxTarget!.name); },
        });
      } else if (hasPendingRequestToByName(info.accountName)) {
        menuItems.push({
          label: "Cancel Request",
          action: () => { if (this.ctxTarget && this.onToggleFriend) this.onToggleFriend(this.ctxTarget!.accountName || this.ctxTarget!.name); },
        });
      } else if (hasPendingRequestFromByName(info.accountName)) {
        menuItems.push({
          label: "Accept Request",
          action: () => { if (this.ctxTarget && this.onToggleFriend) this.onToggleFriend(this.ctxTarget!.accountName || this.ctxTarget!.name); },
        });
      } else {
        menuItems.push({
          label: "Send Request",
          action: () => { if (this.ctxTarget && this.onToggleFriend) this.onToggleFriend(this.ctxTarget!.accountName || this.ctxTarget!.name); },
        });
      }
    }

    if (menuItems.length === 0) return;

    const gaps = Math.max(0, menuItems.length - 1) * Math.round(4 * S);
    const menuH = pad * 2 + itemH * menuItems.length + gaps;

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

    const menuTexts: Phaser.GameObjects.Text[] = [];
    const menuZones: Phaser.GameObjects.Zone[] = [];

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const itemY = my + pad + i * (itemH + Math.round(4 * S));

      const text = addText(this.scene, mx + pad, itemY, item.label, {
        fontSize,
        color: "#cccccc",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setScrollFactor(0).setDepth(311);

      const zone = this.scene.add.zone(mx + menuW / 2, itemY + itemH / 2, menuW, itemH)
        .setScrollFactor(0).setDepth(312).setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => text.setColor("#44ffaa"));
      zone.on("pointerout", () => text.setColor("#cccccc"));
      zone.on("pointerdown", () => {
        item.action();
        this.hideContextMenu();
      });

      menuTexts.push(text);
      menuZones.push(zone);
    }

    this.ctxMenu = { bg, menuTexts, menuZones };

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
    for (const t of this.ctxMenu.menuTexts) t.destroy();
    for (const z of this.ctxMenu.menuZones) z.destroy();
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
    this.friendsTabZone.setPosition(this.px + centerX, this.py + this.tabY + Math.round(7 * S) - this.scrollY);
    this.requestsTabZone.setPosition(this.px + centerX + this.tabGap, this.py + this.tabY + Math.round(7 * S) - this.scrollY);

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

      // Action button zones (aligned with the text buttons in content space)
      const btnRightX = contentW - this.pad - rowPad;
      const screenBtnRightX = this.px + btnRightX;
      const btnZoneW = Math.round(50 * S);
      // btn1: upper position for incoming ("Accept"), center for outgoing ("Cancel")
      row.actionZone1.setPosition(screenBtnRightX - btnZoneW / 2, screenRowY - Math.round(6 * S));
      row.actionZone1.setSize(btnZoneW, Math.round(12 * S));
      // btn2: lower position ("Decline")
      row.actionZone2.setPosition(screenBtnRightX - btnZoneW / 2, screenRowY + Math.round(6 * S));
      row.actionZone2.setSize(btnZoneW, Math.round(12 * S));
    }
  }

  private setAllVisible(vis: boolean): void {
    this.panelBg.setVisible(vis);
    this.contentContainer.setVisible(vis);
    this.scrollBarBg.setVisible(vis);
    this.scrollBarThumb.setVisible(vis);
    this.nearbyTabZone.setVisible(vis);
    this.friendsTabZone.setVisible(vis);
    this.requestsTabZone.setVisible(vis);

    for (let i = 0; i < this.rows.length; i++) {
      this.rows[i].rowZone.setVisible(vis);
      // Action buttons are controlled by renderRows, just hide when panel hides
      if (!vis) {
        this.rows[i].actionBtn1.setVisible(false);
        this.rows[i].actionBtn2.setVisible(false);
        this.rows[i].actionZone1.setVisible(false);
        this.rows[i].actionZone2.setVisible(false);
      }
      for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
        this.equipZones[i][j].setVisible(vis);
      }
    }

    // Disable/enable interactivity
    if (vis) {
      this.nearbyTabZone.setInteractive({ useHandCursor: true });
      this.friendsTabZone.setInteractive({ useHandCursor: true });
      this.requestsTabZone.setInteractive({ useHandCursor: true });
      for (let i = 0; i < this.rows.length; i++) {
        this.rows[i].rowZone.setInteractive();
        for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
          this.equipZones[i][j].setInteractive();
        }
      }
    } else {
      this.nearbyTabZone.disableInteractive();
      this.friendsTabZone.disableInteractive();
      this.requestsTabZone.disableInteractive();
      for (let i = 0; i < this.rows.length; i++) {
        this.rows[i].rowZone.disableInteractive();
        this.rows[i].actionZone1.disableInteractive();
        this.rows[i].actionZone2.disableInteractive();
        for (let j = 0; j < EQUIP_SLOT_COUNT; j++) {
          this.equipZones[i][j].disableInteractive();
        }
      }
    }
  }
}
