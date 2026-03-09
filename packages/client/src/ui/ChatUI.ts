import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";
import { ChatChannel, CHAT_MAX_LENGTH, CHAT_LOG_MAX } from "@rotmg-lite/shared";
import { getUIScale, getScreenWidth, getScreenHeight } from "./UIScale";

interface ChatEntry {
  playerName: string;
  text: string;
  channel: ChatChannel;
}

const VISIBLE_LINES = 8;
const FONT_SIZE_REF = 10; // reference font size at scale 1
const LINE_HEIGHT_REF = 14;
const PANEL_WIDTH_REF = 260;
const PANEL_PADDING = 6;

export class ChatUI {
  private scene: Phaser.Scene;
  private network: NetworkManager;
  private bg: Phaser.GameObjects.Graphics;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private channelLabel: Phaser.GameObjects.Text;
  private messages: ChatEntry[] = [];
  private channel: ChatChannel = "global";
  private inputEl: HTMLInputElement;
  private _isTyping = false;

  // Layout cache
  private panelX = 0;
  private panelY = 0;
  private panelW = 0;
  private panelH = 0;

  get isTyping(): boolean {
    return this._isTyping;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.network = NetworkManager.getInstance();

    // Background
    this.bg = scene.add.graphics();
    this.bg.setScrollFactor(0);
    this.bg.setDepth(90);

    // Pre-create text objects for visible lines
    for (let i = 0; i < VISIBLE_LINES; i++) {
      const t = scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#cccccc",
          wordWrap: { width: PANEL_WIDTH_REF },
        })
        .setScrollFactor(0)
        .setDepth(91);
      this.lineTexts.push(t);
    }

    // Channel indicator (shown when typing)
    this.channelLabel = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffcc44",
        fontStyle: "bold",
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
    this.inputEl.style.fontFamily = "monospace";
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

    this.computeLayout();
    this.drawLog();
  }

  private computeLayout(): void {
    const S = getUIScale();
    const H = getScreenHeight();

    this.panelW = Math.round(PANEL_WIDTH_REF * S);
    this.panelX = Math.round(8 * S);

    const fontSize = Math.max(8, Math.round(FONT_SIZE_REF * S));
    const lineH = Math.round(LINE_HEIGHT_REF * S);
    const pad = Math.round(PANEL_PADDING * S);
    const margin = Math.round(8 * S);
    const inputH = Math.round(18 * S);
    const gap = Math.round(2 * S);

    // Build layout bottom-up from screen edge:
    // margin -> input -> gap -> label -> gap -> message lines
    const inputTop = H - margin - inputH;
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
    const W = getScreenWidth();
    const H = getScreenHeight();
    const pad = Math.round(PANEL_PADDING * getUIScale());

    this.inputEl.style.left = `${((this.panelX + pad) / W) * 100}%`;
    this.inputEl.style.top = `${(this._inputTop / H) * 100}%`;
    this.inputEl.style.width = `${(((this.panelW - pad * 2)) / W) * 100}%`;
    this.inputEl.style.height = `${(this._inputH / H) * 100}%`;
    this.inputEl.style.fontSize = `${Math.max(8, Math.round(FONT_SIZE_REF * getUIScale()))}px`;
  }

  private drawLog(): void {
    this.bg.clear();

    // Show last VISIBLE_LINES messages
    const start = Math.max(0, this.messages.length - VISIBLE_LINES);
    for (let i = 0; i < VISIBLE_LINES; i++) {
      const idx = start + i;
      const t = this.lineTexts[i];
      if (idx < this.messages.length) {
        const m = this.messages[idx];
        const prefix = m.channel === "global" ? "[G]" : "[L]";
        t.setText(`${prefix} ${m.playerName}: ${m.text}`);
        t.setColor(m.channel === "global" ? "#ffcc44" : "#44ccff");
        t.setVisible(true);
      } else {
        t.setText("");
        t.setVisible(false);
      }
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

  openInput(): void {
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

  relayout(): void {
    this.computeLayout();
    this.drawLog();
  }

  destroy(): void {
    this.bg.destroy();
    for (const t of this.lineTexts) t.destroy();
    this.channelLabel.destroy();
    if (this.inputEl.parentElement) {
      this.inputEl.remove();
    }
  }
}
