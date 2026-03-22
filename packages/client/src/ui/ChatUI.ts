import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";
import { ChatChannel, CHAT_MAX_LENGTH, CHAT_LOG_MAX, ENEMY_SYNC_RADIUS } from "@rotmg-lite/shared";
import { getUIScale, getScreenWidth, getScreenHeight } from "./UIScale";
import { UI_PANEL_CORNER, UI_BTN_CORNER } from "./UITextures";
import { addFriend, removeFriend, isFriendByCharacterName, getFriendAccountIdByCharacterName, isAuthenticated } from "./FriendStore";
import { canTeleportTo } from "./TeleportHelper";
import { addText } from "./TextFactory";

interface ChatEntry {
  playerName: string;
  text: string;
  channel: ChatChannel;
  actions?: { label: string; callback: () => void }[];
  actionId?: string;
}

const VISIBLE_LINES = 8;
const FONT_SIZE_REF = 7; // reference font size at scale 1
const LINE_HEIGHT_REF = 10;
const PANEL_WIDTH_REF = 260;
const PANEL_PADDING = 6;

export class ChatUI {
  private scene: Phaser.Scene;
  private network: NetworkManager;
  private bg: Phaser.GameObjects.NineSlice;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private channelLabel: Phaser.GameObjects.Text;
  private messages: ChatEntry[] = [];
  private channel: ChatChannel = "global";
  private inputEl: HTMLInputElement;
  private _isTyping = false;
  private linePlayerNames: string[] = [];

  // Client-side tracking of names we've blocked (mirrors server blockedDMs)
  private blockedNames = new Set<string>();

  // Context menu state
  private ctxMenu: {
    bg: Phaser.GameObjects.NineSlice;
    menuTexts: Phaser.GameObjects.Text[];
    menuZones: Phaser.GameObjects.Zone[];
    menuIcons: Phaser.GameObjects.Image[];
  } | null = null;
  private ctxDismissListener: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  // Action button elements (for trade request accept/decline)
  private actionBgs: Phaser.GameObjects.NineSlice[] = [];
  private actionTexts: Phaser.GameObjects.Text[] = [];
  private actionZones: Phaser.GameObjects.Zone[] = [];

  // Layout cache
  private panelX = 0;
  private panelY = 0;
  private panelW = 0;
  private panelH = 0;
  private _offsetX = 0;
  private _offsetY = 0;

  get isTyping(): boolean {
    return this._isTyping;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.network = NetworkManager.getInstance();

    // Background
    const C = UI_PANEL_CORNER;
    this.bg = scene.add.nineslice(0, 0, "ui-panel-chat", undefined, 100, 100, C, C, C, C)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(90).setAlpha(0.1);

    // Pre-create text objects for visible lines
    for (let i = 0; i < VISIBLE_LINES; i++) {
      const t = addText(scene, 0, 0, "", {
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "7px",
          color: "#cccccc",
          wordWrap: { callback: this.charWrap, callbackScope: this, width: PANEL_WIDTH_REF },
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setScrollFactor(0)
        .setDepth(91);
      this.lineTexts.push(t);
    }

    // Channel indicator (shown when typing)
    this.channelLabel = addText(scene, 0, 0, "", {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "7px",
        color: "#ffcc44",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setScrollFactor(0)
      .setDepth(92)
      .setVisible(false);

    // DOM input element
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.maxLength = CHAT_MAX_LENGTH;
    this.inputEl.style.position = "absolute";
    this.inputEl.style.background = "rgba(0,0,0,0.7)";
    this.inputEl.style.color = "#ffffff";
    this.inputEl.style.border = "1px solid #555";
    this.inputEl.style.borderRadius = "3px";
    this.inputEl.style.outline = "none";
    this.inputEl.style.fontFamily = "'Press Start 2P', monospace";
    this.inputEl.style.padding = "2px 4px";
    this.inputEl.style.boxSizing = "border-box";
    this.inputEl.style.display = "none";
    this.inputEl.style.zIndex = "1000";
    // Append to Phaser's DOM container (inside the fullscreen-target element)
    // so the input remains visible and focusable in fullscreen mode
    const container = scene.game.domContainer || scene.game.canvas.parentElement || document.body;
    container.appendChild(this.inputEl);

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.sendAndClose();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cancelInput();
      } else if (e.key === "Tab") {
        e.preventDefault();
        this.toggleChannel();
      }
      e.stopPropagation();
    });

    this.inputEl.addEventListener("blur", () => {
      // Re-focus if still in typing mode (handles fullscreen focus quirks)
      if (this._isTyping) {
        setTimeout(() => this.inputEl.focus(), 0);
      }
    });

    // Right-click on chat lines to open context menu
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) return;
      for (let i = 0; i < VISIBLE_LINES; i++) {
        const t = this.lineTexts[i];
        if (!t.visible || !this.linePlayerNames[i]) continue;
        const bounds = t.getBounds();
        if (bounds.contains(pointer.x, pointer.y)) {
          this.showContextMenu(this.linePlayerNames[i], pointer.x, pointer.y);
          return;
        }
      }
    });

    this.computeLayout();
    this.drawLog();
  }

  private computeLayout(): void {
    const S = getUIScale();
    const H = this.scene.scale.height;

    this.panelW = Math.round(PANEL_WIDTH_REF * S);
    this.panelX = Math.round(8 * S) + this._offsetX;

    const fontSize = Math.max(8, Math.round(FONT_SIZE_REF * S));
    const lineH = Math.round(LINE_HEIGHT_REF * S);
    const pad = Math.round(PANEL_PADDING * S);
    const margin = Math.round(8 * S);
    const inputH = Math.round(18 * S);
    const gap = Math.round(8 * S);

    // Build layout bottom-up from screen edge:
    // margin -> input -> gap -> label -> gap -> message lines
    const inputTop = H - margin - inputH + this._offsetY;
    const labelTop = inputTop - gap - lineH;
    const messagesBottom = labelTop - gap;
    this.panelH = VISIBLE_LINES * lineH + pad * 2;
    this.panelY = messagesBottom - this.panelH;

    for (let i = 0; i < VISIBLE_LINES; i++) {
      const t = this.lineTexts[i];
      t.setFontSize(fontSize);
      t.setWordWrapWidth(this.panelW - pad * 2);
      t.setPosition(this.panelX + pad, this.panelY + pad + i * lineH);
    }

    this.channelLabel.setFontSize(fontSize);
    this.channelLabel.setPosition(this.panelX + pad, labelTop);

    // Cache input position in Phaser coords for positionInput()
    this._inputTop = inputTop;
    this._inputH = inputH;

    this.positionInput();
  }

  // Cached from computeLayout for DOM positioning
  private _inputTop = 0;
  private _inputH = 0;

  private positionInput(): void {
    // The Phaser DOM container overlays the canvas 1:1, so we position
    // using percentages of the game resolution. This works in both
    // windowed and fullscreen modes.
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const pad = Math.round(PANEL_PADDING * getUIScale());

    this.inputEl.style.left = `${((this.panelX + pad) / W) * 100}%`;
    this.inputEl.style.top = `${(this._inputTop / H) * 100}%`;
    this.inputEl.style.width = `${(((this.panelW - pad * 2)) / W) * 100}%`;
    this.inputEl.style.height = `${(this._inputH / H) * 100}%`;
    this.inputEl.style.fontSize = `${Math.max(8, Math.round(FONT_SIZE_REF * getUIScale()))}px`;
  }

  /** Hybrid word wrap: breaks at word boundaries, falls back to character-level for long words. */
  private charWrap(text: string, textObject: Phaser.GameObjects.Text): string {
    const ctx = textObject.context;
    const wrapWidth = (textObject.style.wordWrapWidth as number) || 200;
    const lines: string[] = [];

    for (const paragraph of text.split("\n")) {
      const words = paragraph.split(" ");
      let line = "";
      let lineWidth = 0;

      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        const wordWidth = ctx.measureText(word).width;
        const spaceWidth = line.length > 0 ? ctx.measureText(" ").width : 0;

        if (lineWidth + spaceWidth + wordWidth <= wrapWidth || lineWidth === 0 && wordWidth <= wrapWidth) {
          // Word fits on current line
          if (line.length > 0) {
            line += " ";
            lineWidth += spaceWidth;
          }
          line += word;
          lineWidth += wordWidth;
        } else if (wordWidth > wrapWidth) {
          // Word is too long for any line – character-break it
          for (let i = 0; i < word.length; i++) {
            const ch = word[i];
            const cw = ctx.measureText(ch).width;
            if (lineWidth + (line.length > 0 && i === 0 ? spaceWidth : 0) + cw > wrapWidth && lineWidth > 0) {
              lines.push(line);
              line = "";
              lineWidth = 0;
            }
            if (i === 0 && line.length > 0) {
              line += " ";
              lineWidth += spaceWidth;
            }
            line += ch;
            lineWidth += cw;
          }
        } else {
          // Word doesn't fit – start a new line
          lines.push(line);
          line = word;
          lineWidth = wordWidth;
        }
      }
      lines.push(line);
    }

    return lines.join("\n");
  }

  private clearActionElements(): void {
    for (const bg of this.actionBgs) bg.destroy();
    for (const t of this.actionTexts) t.destroy();
    for (const z of this.actionZones) z.destroy();
    this.actionBgs = [];
    this.actionTexts = [];
    this.actionZones = [];
  }

  private drawLog(): void {
    this.hideContextMenu();
    this.clearActionElements();
    this.bg.setPosition(this.panelX, this.panelY);
    this.bg.setSize(this.panelW, this.panelH);

    const S = getUIScale();
    const pad = Math.round(PANEL_PADDING * S);
    const gap = Math.round(2 * S);
    const fontSize = Math.max(8, Math.round(FONT_SIZE_REF * S));

    // Reset player name tracking
    this.linePlayerNames = new Array(VISIBLE_LINES).fill("");

    // Hide all text objects first
    for (const t of this.lineTexts) {
      t.setText("");
      t.setVisible(false);
    }

    if (this.messages.length === 0) return;

    // Lay out messages bottom-up so newest is at the bottom
    let curBottom = this.panelY + this.panelH - pad;
    const topLimit = this.panelY + pad;
    let slot = VISIBLE_LINES - 1;
    let msgIdx = this.messages.length - 1;

    while (slot >= 0 && msgIdx >= 0) {
      const m = this.messages[msgIdx];
      const t = this.lineTexts[slot];

      // If this message has action buttons, render them first (below the text)
      if (m.actions && m.actions.length > 0) {
        const btnH = Math.round(12 * S);
        const btnGap = Math.round(8 * S);
        const btnY = curBottom - btnH;

        if (btnY < topLimit) { msgIdx--; continue; }

        let btnX = this.panelX + pad;
        const BC = UI_BTN_CORNER;
        for (const act of m.actions) {
          const btnText = addText(this.scene, btnX, btnY, act.label, {
            fontFamily: "'Press Start 2P', monospace",
            fontSize: `${fontSize}px`,
            color: act.label === "ACCEPT" ? "#44ff44" : "#ff4444",
            stroke: "#000000",
            strokeThickness: 2,
          }).setScrollFactor(0).setDepth(92);

          const btnW = btnText.width + Math.round(8 * S);
          const btnBg = this.scene.add.nineslice(
            btnX + btnW / 2, btnY + btnH / 2,
            "ui-btn-default", undefined, btnW, btnH, BC, BC, BC, BC,
          ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(91);

          // Center text on the background
          btnText.setPosition(btnX + btnW / 2, btnY + btnH / 2).setOrigin(0.5, 0.5);

          const zone = this.scene.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
            .setScrollFactor(0).setDepth(93).setInteractive({ useHandCursor: true });

          const origColor = act.label === "ACCEPT" ? "#44ff44" : "#ff4444";
          zone.on("pointerover", () => {
            btnText.setColor("#ffffff");
            btnBg.setTexture("ui-btn-hover");
          });
          zone.on("pointerout", () => {
            btnText.setColor(origColor);
            btnBg.setTexture("ui-btn-default");
          });

          const callback = act.callback;
          const actionId = m.actionId;
          zone.on("pointerdown", () => {
            btnBg.setTexture("ui-btn-pressed");
            callback();
            // Remove the action buttons from this message
            if (actionId) this.removeActionMessage(actionId);
          });

          this.actionBgs.push(btnBg);
          this.actionTexts.push(btnText);
          this.actionZones.push(zone);
          btnX += btnW + btnGap;
        }

        curBottom = btnY - gap;
      }

      if (m.playerName) {
        t.setText(`${m.playerName}: ${m.text}`);
        t.setColor(m.channel === "global" ? "#ffcc44" : m.channel === "dm" ? "#cc66ff" : "#44ccff");
      } else {
        t.setText(m.text);
        t.setColor("#cccccc");
      }

      const h = t.height;
      const top = curBottom - h;

      if (top < topLimit) {
        // Doesn't fit – hide and stop
        t.setText("");
        t.setVisible(false);
        break;
      }

      t.setPosition(this.panelX + pad, top);
      t.setVisible(true);
      this.linePlayerNames[slot] = m.playerName;
      curBottom = top - gap;
      slot--;
      msgIdx--;
    }
  }

  addMessage(data: { playerName: string; text: string; channel: ChatChannel }): void {
    this.messages.push({
      playerName: data.playerName,
      text: data.text,
      channel: data.channel,
    });
    if (this.messages.length > CHAT_LOG_MAX) {
      this.messages.shift();
    }
    this.drawLog();
  }

  addActionMessage(text: string, actions: { label: string; callback: () => void }[], actionId: string): void {
    this.messages.push({
      playerName: "",
      text,
      channel: "global" as ChatChannel,
      actions,
      actionId,
    });
    if (this.messages.length > CHAT_LOG_MAX) {
      this.messages.shift();
    }
    this.drawLog();
  }

  removeActionMessage(actionId: string): void {
    for (const m of this.messages) {
      if (m.actionId === actionId) {
        m.actions = undefined;
        m.actionId = undefined;
      }
    }
    this.drawLog();
  }

  openInput(): void {
    this.hideContextMenu();
    if (this._isTyping) return;
    this._isTyping = true;
    this.updateChannelLabel();
    this.channelLabel.setVisible(true);
    this.positionInput();
    this.inputEl.style.display = "block";
    this.inputEl.value = "";
    // Delay focus slightly so the Enter keypress that opens chat doesn't immediately close it
    setTimeout(() => {
      this.inputEl.focus();
      // Safety: if focus failed (e.g. element outside fullscreen boundary),
      // automatically close to prevent stuck state
      setTimeout(() => {
        if (this._isTyping && document.activeElement !== this.inputEl) {
          this.closeInput();
        }
      }, 100);
    }, 50);
  }

  openInputWithText(text: string): void {
    this.hideContextMenu();
    if (this._isTyping) return;
    this._isTyping = true;
    this.updateChannelLabel();
    this.channelLabel.setVisible(true);
    this.positionInput();
    this.inputEl.style.display = "block";
    this.inputEl.value = text;
    setTimeout(() => {
      this.inputEl.focus();
      this.inputEl.setSelectionRange(text.length, text.length);
      setTimeout(() => {
        if (this._isTyping && document.activeElement !== this.inputEl) {
          this.closeInput();
        }
      }, 100);
    }, 50);
  }

  private sendAndClose(): void {
    const text = this.inputEl.value.trim();
    if (text.length > 0) {
      this.network.sendChatMessage(text, this.channel);
    }
    this.closeInput();
  }

  cancelInput(): void {
    this.closeInput();
  }

  private closeInput(): void {
    this._isTyping = false;
    this.inputEl.style.display = "none";
    this.inputEl.value = "";
    this.channelLabel.setVisible(false);
    // Return focus to the game canvas
    this.scene.game.canvas.focus();
  }

  private toggleChannel(): void {
    this.channel = this.channel === "global" ? "local" : "global";
    this.updateChannelLabel();
  }

  private updateChannelLabel(): void {
    if (this.channel === "global") {
      this.channelLabel.setText("[Global] Press Tab to switch");
      this.channelLabel.setColor("#ffcc44");
    } else {
      this.channelLabel.setText("[Local] Press Tab to switch");
      this.channelLabel.setColor("#44ccff");
    }
  }

  setOffset(offsetX: number, offsetY: number): void {
    if (this._offsetX === offsetX && this._offsetY === offsetY) return;
    this._offsetX = offsetX;
    this._offsetY = offsetY;
    this.computeLayout();
    this.drawLog();
  }

  relayout(): void {
    this.hideContextMenu();
    this.computeLayout();
    this.drawLog();
  }

  // ---- Context menu ----

  private showContextMenu(playerName: string, screenX: number, screenY: number): void {
    this.hideContextMenu();
    if (!isAuthenticated()) return;

    const S = getUIScale();
    const menuW = Math.round(100 * S);
    const itemH = Math.round(16 * S);
    const pad = Math.round(6 * S);
    const fontSize = `${Math.round(6 * S)}px`;

    const menuItems: { label: string; action: () => void; icon?: string }[] = [];

    // Check if this is our own name
    const room = this.network.getRoom();
    const localPlayer = room?.state.players.get(this.network.getSessionId()) as any;
    const isOwnName = localPlayer && localPlayer.name === playerName;

    // Resolve account name for block checks
    let accountName: string | null = null;
    room?.state.players.forEach((p: any) => {
      if (p.name === playerName && p.accountName) accountName = p.accountName as string;
    });
    const isBlocked = accountName ? this.blockedNames.has(accountName) : false;

    if (!isOwnName && isBlocked) {
      // Blocked players: only show Unblock
      menuItems.push({
        label: "Unblock",
        action: () => {
          if (accountName) this.blockedNames.delete(accountName);
          this.network.sendChatMessage(`/unblock ${playerName}`, "global");
        },
      });
    } else if (!isOwnName) {
      // DM
      const dmName = playerName.startsWith("To ") ? playerName.substring(3) : playerName;
      menuItems.push({
        label: "DM",
        action: () => this.openInputWithText(`/dm ${dmName} `),
      });

      // Trade (nearby players within sync radius)
      if (localPlayer) {
        let targetNearby = false;
        room?.state.players.forEach((p: any) => {
          if (p.name === playerName && p.zone === localPlayer.zone) {
            const dx = p.x - localPlayer.x;
            const dy = p.y - localPlayer.y;
            if (Math.sqrt(dx * dx + dy * dy) <= ENEMY_SYNC_RADIUS) {
              targetNearby = true;
            }
          }
        });
        if (targetNearby) {
          menuItems.push({
            label: "Trade",
            action: () => this.network.sendTradeRequest(playerName),
          });
        }
      }

      // Teleport To
      let targetZone: string | undefined;
      room?.state.players.forEach((p: any) => {
        if (p.name === playerName) targetZone = p.zone as string;
      });
      if (targetZone && canTeleportTo(playerName, targetZone)) {
        menuItems.push({
          label: "Teleport To",
          action: () => this.network.sendTeleportToPlayer(playerName),
          icon: "item-portal-gem",
        });
      }

      // Block / Unfriend and Block
      const isFriend = isFriendByCharacterName(playerName);
      menuItems.push({
        label: isFriend ? "Unfriend and Block" : "Block",
        action: () => {
          if (accountName) this.blockedNames.add(accountName);
          this.network.sendChatMessage(`/block ${playerName}`, "global");
        },
      });

      // Add Friend / Remove Friend
      if (isFriend) {
        menuItems.push({
          label: "Remove Friend",
          action: () => {
            const accId = getFriendAccountIdByCharacterName(playerName);
            if (accId) removeFriend(accId);
          },
        });
      } else {
        menuItems.push({
          label: "Add Friend",
          action: () => addFriend(playerName),
        });
      }
    }

    if (menuItems.length === 0) return;

    const gaps = Math.max(0, menuItems.length - 1) * Math.round(4 * S);
    const menuH = pad * 2 + itemH * menuItems.length + gaps;

    const C = UI_PANEL_CORNER;
    const bg = this.scene.add
      .nineslice(screenX, screenY, "ui-panel-dark", undefined, menuW, menuH, C, C, C, C)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(310);

    // Clamp to screen
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();
    if (screenX + menuW > screenW - 4) bg.setX(screenW - 4 - menuW);
    if (screenY + menuH > screenH - 4) bg.setY(screenH - 4 - menuH);
    const mx = bg.x;
    const my = bg.y;

    const menuTexts: Phaser.GameObjects.Text[] = [];
    const menuZones: Phaser.GameObjects.Zone[] = [];
    const menuIcons: Phaser.GameObjects.Image[] = [];

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const itemY = my + pad + i * (itemH + Math.round(4 * S));

      let iconOffset = 0;
      if (item.icon) {
        const iconSize = itemH - 2;
        const icon = this.scene.add.image(mx + pad + iconSize / 2, itemY + itemH / 2, item.icon)
          .setDisplaySize(iconSize, iconSize)
          .setScrollFactor(0).setDepth(311);
        menuIcons.push(icon);
        iconOffset = itemH;
      }

      const text = addText(this.scene, mx + pad + iconOffset, itemY, item.label, {
          fontSize,
          color: "#cccccc",
          fontFamily: "'Press Start 2P', monospace",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setScrollFactor(0)
        .setDepth(311);

      const zone = this.scene.add
        .zone(mx + menuW / 2, itemY + itemH / 2, menuW, itemH)
        .setScrollFactor(0)
        .setDepth(312)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => text.setColor("#44ffaa"));
      zone.on("pointerout", () => text.setColor("#cccccc"));
      zone.on("pointerdown", () => {
        item.action();
        this.hideContextMenu();
      });

      menuTexts.push(text);
      menuZones.push(zone);
    }

    this.ctxMenu = { bg, menuTexts, menuZones, menuIcons };

    // Dismiss on any left-click outside
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
    for (const ic of this.ctxMenu.menuIcons) ic.destroy();
    this.ctxMenu = null;
  }

  setBlockedNames(names: string[]): void {
    this.blockedNames.clear();
    for (const n of names) this.blockedNames.add(n);
  }

  destroy(): void {
    this.hideContextMenu();
    this.bg.destroy();
    for (const t of this.lineTexts) t.destroy();
    this.channelLabel.destroy();
    if (this.inputEl.parentElement) {
      this.inputEl.remove();
    }
  }
}
