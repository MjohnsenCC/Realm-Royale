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
import { isFriend } from "./FriendStore";

export interface NearbyPlayerInfo {
  sessionId: string;
  name: string;
  level: number;
  characterClass: number;
  distance: number;
  equipment: ItemInstanceData[];
  isFriend: boolean;
  online: boolean;
}

const MAX_ROWS = 30;

interface RowObjects {
  bg: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  distText: Phaser.GameObjects.Text;
  dmBtn: Phaser.GameObjects.Image;
  dmZone: Phaser.GameObjects.Zone;
  friendBtn: Phaser.GameObjects.Image;
  friendZone: Phaser.GameObjects.Zone;
  hoverZone: Phaser.GameObjects.Zone;
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

  // Layout
  private pad!: number;
  private lineH!: number;
  private scrollBarWidth!: number;
  private tabY!: number;
  private rowStartY!: number;
  private btnSize!: number;

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
  private onHover: ((info: NearbyPlayerInfo | null, screenX: number, screenY: number) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    this.computeLayout();

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
    const tabGap = Math.round(20 * S);
    this.nearbyTab = scene.add
      .text(centerX - tabGap, tabBaseY, "NEARBY", {
        fontSize: tabFontSize,
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.nearbyTab);

    this.friendsTab = scene.add
      .text(centerX + tabGap, tabBaseY, "FRIENDS", {
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

    for (let i = 0; i < MAX_ROWS; i++) {
      const rowY = this.rowStartY + i * this.lineH;
      const bgColor = i % 2 === 0 ? 0x222233 : 0x1a1a2a;
      const rowW = contentW;

      const bg = scene.add.rectangle(rowW / 2, rowY + this.lineH / 2, rowW, this.lineH, bgColor, 0.5)
        .setOrigin(0.5, 0.5);
      this.contentContainer.add(bg);

      const nameText = scene.add.text(this.pad + this.btnSize * 2 + Math.round(8 * S), rowY + Math.round(2 * S), "", {
        fontSize: nameFontSize,
        color: "#66cc66",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0, 0);
      this.contentContainer.add(nameText);

      const levelText = scene.add.text(this.pad + this.btnSize * 2 + Math.round(8 * S), rowY + Math.round(2 * S) + Math.round(10 * S), "", {
        fontSize: smallFontSize,
        color: "#aaaaaa",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0, 0);
      this.contentContainer.add(levelText);

      const distText = scene.add.text(rowW - this.pad - this.scrollBarWidth, rowY + Math.round(2 * S), "", {
        fontSize: smallFontSize,
        color: "#666666",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(1, 0);
      this.contentContainer.add(distText);

      // DM button
      const dmBtnX = this.pad;
      const dmBtnCenterX = dmBtnX + this.btnSize / 2;
      const dmBtnCenterY = rowY + this.lineH / 2;
      const dmBtn = scene.add.image(dmBtnCenterX, dmBtnCenterY, "ui-btn-dm")
        .setDisplaySize(this.btnSize, this.btnSize);
      this.contentContainer.add(dmBtn);

      const dmZone = scene.add.zone(0, 0, this.btnSize, this.btnSize)
        .setScrollFactor(0).setDepth(255).setInteractive({ useHandCursor: true });
      const rowIdx = i;
      dmZone.on("pointerover", () => dmBtn.setTint(0x44ffaa));
      dmZone.on("pointerout", () => dmBtn.clearTint());
      dmZone.on("pointerdown", () => {
        const info = this.getVisiblePlayers()[rowIdx];
        if (info && this.onDM) this.onDM(info.name);
      });

      // Friend button
      const friendBtnX = this.pad + this.btnSize + Math.round(2 * S);
      const friendBtnCenterX = friendBtnX + this.btnSize / 2;
      const friendBtn = scene.add.image(friendBtnCenterX, dmBtnCenterY, "ui-btn-addfriend")
        .setDisplaySize(this.btnSize, this.btnSize);
      this.contentContainer.add(friendBtn);

      const friendZone = scene.add.zone(0, 0, this.btnSize, this.btnSize)
        .setScrollFactor(0).setDepth(255).setInteractive({ useHandCursor: true });
      friendZone.on("pointerover", () => friendBtn.setTint(0x44ffaa));
      friendZone.on("pointerout", () => {
        const info = this.getVisiblePlayers()[rowIdx];
        if (info && info.isFriend) {
          friendBtn.setTint(0xff6666);
        } else {
          friendBtn.clearTint();
        }
      });
      friendZone.on("pointerdown", () => {
        const info = this.getVisiblePlayers()[rowIdx];
        if (info && this.onToggleFriend) this.onToggleFriend(info.name);
      });

      // Hover zone for tooltip (full row)
      const hoverZone = scene.add.zone(0, 0, rowW, this.lineH)
        .setScrollFactor(0).setDepth(254).setInteractive();
      hoverZone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        const info = this.getVisiblePlayers()[rowIdx];
        if (info && this.onHover) this.onHover(info, pointer.x, pointer.y);
      });
      hoverZone.on("pointerout", () => {
        if (this.onHover) this.onHover(null, 0, 0);
      });
      hoverZone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const info = this.getVisiblePlayers()[rowIdx];
        if (info && this.onHover) this.onHover(info, pointer.x, pointer.y);
      });

      this.rows.push({ bg, nameText, levelText, distText, dmBtn, dmZone, friendBtn, friendZone, hoverZone });
    }

    // Start hidden
    this.setAllVisible(false);
  }

  setCallbacks(
    onDM: (name: string) => void,
    onToggleFriend: (name: string) => void,
    onHover: (info: NearbyPlayerInfo | null, screenX: number, screenY: number) => void,
  ): void {
    this.onDM = onDM;
    this.onToggleFriend = onToggleFriend;
    this.onHover = onHover;
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
        e.preventDefault();
      }
    };
    this.scene.game.canvas.addEventListener("wheel", this.wheelListener, { passive: false });
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
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
    const tabGap = Math.round(20 * S);

    this.titleText.setPosition(centerX, this.pad).setFontSize(titleFontSize);
    this.hintText.setPosition(centerX, this.pad + Math.round(14 * S)).setFontSize(hintFontSize);
    this.nearbyTab.setPosition(centerX - tabGap, this.tabY).setFontSize(tabFontSize);
    this.friendsTab.setPosition(centerX + tabGap, this.tabY).setFontSize(tabFontSize);

    // Update rows layout
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.rows[i];
      const rowY = this.rowStartY + i * this.lineH;
      const rowW = contentW;

      row.bg.setPosition(rowW / 2, rowY + this.lineH / 2);
      row.bg.setSize(rowW, this.lineH);

      const textX = this.pad + this.btnSize * 2 + Math.round(8 * S);
      row.nameText.setPosition(textX, rowY + Math.round(2 * S)).setFontSize(nameFontSize);
      row.levelText.setPosition(textX, rowY + Math.round(2 * S) + Math.round(10 * S)).setFontSize(smallFontSize);
      row.distText.setPosition(rowW - this.pad - this.scrollBarWidth, rowY + Math.round(2 * S)).setFontSize(smallFontSize);

      const dmBtnCenterX = this.pad + this.btnSize / 2;
      const dmBtnCenterY = rowY + this.lineH / 2;
      row.dmBtn.setPosition(dmBtnCenterX, dmBtnCenterY).setDisplaySize(this.btnSize, this.btnSize);

      const friendBtnCenterX = this.pad + this.btnSize + Math.round(2 * S) + this.btnSize / 2;
      row.friendBtn.setPosition(friendBtnCenterX, dmBtnCenterY).setDisplaySize(this.btnSize, this.btnSize);
    }

    // Rebuild mask
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(this.px, this.py, this.panelWidth, this.viewHeight);
    const mask = this.maskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    this.scrollY = 0;

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
    this.lineH = Math.round(22 * S);
    this.scrollBarWidth = Math.round(8 * S);
    this.btnSize = Math.round(14 * S);

    this.panelWidth = Math.min(Math.round(PANEL_REF_WIDTH * S), Math.round(screenW * 0.28));

    this.tabY = this.pad + Math.round(14 * S) + Math.round(14 * S);
    this.rowStartY = this.tabY + Math.round(18 * S);

    const panelMargin = Math.round(12 * S);
    this.px = this.side === "right"
      ? screenW - panelMargin - this.panelWidth
      : panelMargin;
    this.py = panelMargin;
    this.viewHeight = screenH - panelMargin * 2;

    this.contentHeight = this.rowStartY + MAX_ROWS * this.lineH + this.pad;
    this.maxScrollY = Math.max(0, this.contentHeight - this.viewHeight);
  }

  private setTab(tab: "nearby" | "friends"): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.nearbyTab.setColor(tab === "nearby" ? "#ffffff" : "#888888");
    this.friendsTab.setColor(tab === "friends" ? "#ffffff" : "#888888");
    this.scrollY = 0;
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
        row.nameText.setText(info.name).setVisible(true);

        if (info.online) {
          row.nameText.setColor("#66cc66");
          if (this.activeTab === "friends") {
            row.levelText.setText(`Lv.${info.level}  ${CLASS_NAMES[info.characterClass] ?? "???"}  Online`).setVisible(true);
          } else {
            row.levelText.setText(`Lv.${info.level}  ${CLASS_NAMES[info.characterClass] ?? "???"}`).setVisible(true);
          }
        } else {
          row.nameText.setColor("#666666");
          row.levelText.setText("Offline").setVisible(true);
        }

        if (this.activeTab === "nearby") {
          const dist = Math.round(info.distance);
          row.distText.setText(`${dist}`).setVisible(true);
        } else {
          row.distText.setVisible(false);
        }

        // DM button only for online players
        row.dmBtn.setVisible(info.online);
        row.dmZone.setVisible(info.online);

        row.friendBtn.setVisible(true);
        row.friendZone.setVisible(true);
        row.hoverZone.setVisible(info.online);

        // Tint friend button if already a friend
        if (info.isFriend) {
          row.friendBtn.setTint(0xff6666);
        } else {
          row.friendBtn.clearTint();
        }
      } else {
        row.bg.setVisible(false);
        row.nameText.setVisible(false);
        row.levelText.setVisible(false);
        row.distText.setVisible(false);
        row.dmBtn.setVisible(false);
        row.dmZone.setVisible(false);
        row.friendBtn.setVisible(false);
        row.friendZone.setVisible(false);
        row.hoverZone.setVisible(false);
      }
    }

    // Update content height based on actual visible count
    const visibleCount = Math.min(visible.length, MAX_ROWS);
    this.contentHeight = this.rowStartY + visibleCount * this.lineH + this.pad;
    this.maxScrollY = Math.max(0, this.contentHeight - this.viewHeight);
    if (this.scrollY > this.maxScrollY) this.scrollY = this.maxScrollY;
  }

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
    const tabGap = Math.round(20 * S);

    // Tab zones (screen space)
    this.nearbyTabZone.setPosition(this.px + centerX - tabGap, this.py + this.tabY + Math.round(7 * S) - this.scrollY);
    this.friendsTabZone.setPosition(this.px + centerX + tabGap, this.py + this.tabY + Math.round(7 * S) - this.scrollY);

    // Row zones (screen space)
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.rows[i];
      const rowY = this.rowStartY + i * this.lineH;
      const screenRowY = this.py + rowY + this.lineH / 2 - this.scrollY;

      const dmBtnCenterX = this.px + this.pad + this.btnSize / 2;
      row.dmZone.setPosition(dmBtnCenterX, screenRowY);
      row.dmZone.setSize(this.btnSize, this.btnSize);

      const friendBtnCenterX = this.px + this.pad + this.btnSize + Math.round(2 * S) + this.btnSize / 2;
      row.friendZone.setPosition(friendBtnCenterX, screenRowY);
      row.friendZone.setSize(this.btnSize, this.btnSize);

      row.hoverZone.setPosition(this.px + contentW / 2, screenRowY);
      row.hoverZone.setSize(contentW, this.lineH);
    }
  }

  private setAllVisible(vis: boolean): void {
    this.panelBg.setVisible(vis);
    this.contentContainer.setVisible(vis);
    this.scrollBarBg.setVisible(vis);
    this.scrollBarThumb.setVisible(vis);
    this.nearbyTabZone.setVisible(vis);
    this.friendsTabZone.setVisible(vis);

    for (const row of this.rows) {
      row.dmZone.setVisible(vis);
      row.friendZone.setVisible(vis);
      row.hoverZone.setVisible(vis);
    }

    // Disable/enable interactivity
    if (vis) {
      this.nearbyTabZone.setInteractive({ useHandCursor: true });
      this.friendsTabZone.setInteractive({ useHandCursor: true });
      for (const row of this.rows) {
        row.dmZone.setInteractive({ useHandCursor: true });
        row.friendZone.setInteractive({ useHandCursor: true });
        row.hoverZone.setInteractive();
      }
    } else {
      this.nearbyTabZone.disableInteractive();
      this.friendsTabZone.disableInteractive();
      for (const row of this.rows) {
        row.dmZone.disableInteractive();
        row.friendZone.disableInteractive();
        row.hoverZone.disableInteractive();
      }
    }
  }
}
