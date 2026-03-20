import Phaser from "phaser";
import { getUIScale, getScreenWidth, getScreenHeight } from "./UIScale";
import { UI_PANEL_CORNER, UI_BTN_CORNER } from "./UITextures";
import { AuthManager } from "../auth/AuthManager";
import { NetworkManager } from "../network/NetworkManager";
import { ACCOUNT_NAME_MIN_LENGTH, ACCOUNT_NAME_MAX_LENGTH } from "@rotmg-lite/shared";

export function isFpsVisible(): boolean {
  return localStorage.getItem("showFps") === "true";
}

export function isPingVisible(): boolean {
  return localStorage.getItem("showPing") === "true";
}

interface ToggleRow {
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  bg: Phaser.GameObjects.NineSlice;
}

export class OptionsUI {
  private scene: Phaser.Scene;
  private visible = false;

  private overlay: Phaser.GameObjects.Graphics;
  private panelBg: Phaser.GameObjects.NineSlice;
  private titleText: Phaser.GameObjects.Text;
  private backText: Phaser.GameObjects.Text;
  private backZone: Phaser.GameObjects.Zone;

  private toggleRows: ToggleRow[] = [];
  private onCloseCallback: (() => void) | null = null;
  private onToggleChangedCallback: (() => void) | null = null;

  // Account name row
  private acctNameLabel: Phaser.GameObjects.Text;
  private acctNameValue: Phaser.GameObjects.Text;
  private acctNameBg: Phaser.GameObjects.NineSlice;
  private acctNameZone: Phaser.GameObjects.Zone;
  private acctNameStatusText: Phaser.GameObjects.Text;
  private acctNameInputDom: Phaser.GameObjects.DOMElement | null = null;
  private editingAccountName = false;
  private currentAccountName = "";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.overlay = new Phaser.GameObjects.Graphics(scene);
    this.overlay.setDepth(310).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.overlay);

    const C = UI_PANEL_CORNER;
    this.panelBg = new Phaser.GameObjects.NineSlice(scene, 0, 0, "ui-panel-overlay", undefined, 100, 100, C, C, C, C);
    this.panelBg.setOrigin(0, 0);
    this.panelBg.setDepth(311).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.panelBg);

    this.titleText = new Phaser.GameObjects.Text(scene, 0, 0, "OPTIONS", {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "'Press Start 2P', monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);
    this.titleText.setOrigin(0.5, 0.5).setDepth(312).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.titleText);

    this.backText = new Phaser.GameObjects.Text(scene, 0, 0, "BACK", {
      fontSize: "7px",
      color: "#aaaacc",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);
    this.backText.setOrigin(0.5, 0.5).setDepth(312).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.backText);

    this.backZone = new Phaser.GameObjects.Zone(scene, 0, 0, 10, 10);
    this.backZone.setDepth(313).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.backZone);

    this.backZone.on("pointerover", () => this.backText.setColor("#ffffff"));
    this.backZone.on("pointerout", () => this.backText.setColor("#aaaacc"));
    this.backZone.on("pointerdown", () => this.hide());

    // Account name row
    const BC = UI_BTN_CORNER;
    this.acctNameBg = new Phaser.GameObjects.NineSlice(scene, 0, 0, "ui-btn-default", undefined, 10, 10, BC, BC, BC, BC);
    this.acctNameBg.setOrigin(0, 0).setDepth(312).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.acctNameBg);

    this.acctNameLabel = new Phaser.GameObjects.Text(scene, 0, 0, "Account Name", {
      fontSize: "7px",
      color: "#aaaacc",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);
    this.acctNameLabel.setOrigin(0, 0.5).setDepth(313).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.acctNameLabel);

    this.acctNameValue = new Phaser.GameObjects.Text(scene, 0, 0, "CHANGE", {
      fontSize: "7px",
      color: "#4488ff",
      fontFamily: "'Press Start 2P', monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);
    this.acctNameValue.setOrigin(1, 0.5).setDepth(313).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.acctNameValue);

    this.acctNameZone = new Phaser.GameObjects.Zone(scene, 0, 0, 10, 10);
    this.acctNameZone.setDepth(314).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.acctNameZone);

    this.acctNameStatusText = new Phaser.GameObjects.Text(scene, 0, 0, "", {
      fontSize: "5px",
      color: "#ff6666",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);
    this.acctNameStatusText.setOrigin(0.5, 0).setDepth(313).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.acctNameStatusText);

    this.acctNameZone.on("pointerover", () => this.acctNameValue.setColor("#66aaff"));
    this.acctNameZone.on("pointerout", () => this.acctNameValue.setColor("#4488ff"));
    this.acctNameZone.on("pointerdown", () => this.toggleAccountNameEdit());

    // Create toggle rows
    const toggleDefs = [
      { key: "showFps", label: "Show FPS" },
      { key: "showPing", label: "Show Ping" },
    ];

    for (const def of toggleDefs) {
      const bg = new Phaser.GameObjects.NineSlice(scene, 0, 0, "ui-btn-default", undefined, 10, 10, BC, BC, BC, BC);
      bg.setOrigin(0, 0);
      bg.setDepth(312).setScrollFactor(0).setVisible(false);
      scene.add.existing(bg);

      const label = new Phaser.GameObjects.Text(scene, 0, 0, def.label, {
        fontSize: "7px",
        color: "#aaaacc",
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setResolution(2);
      label.setOrigin(0, 0.5).setDepth(313).setScrollFactor(0).setVisible(false);
      scene.add.existing(label);

      const isOn = localStorage.getItem(def.key) === "true";
      const value = new Phaser.GameObjects.Text(scene, 0, 0, isOn ? "ON" : "OFF", {
        fontSize: "7px",
        color: isOn ? "#44ff88" : "#666688",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      }).setResolution(2);
      value.setOrigin(1, 0.5).setDepth(313).setScrollFactor(0).setVisible(false);
      scene.add.existing(value);

      const zone = new Phaser.GameObjects.Zone(scene, 0, 0, 10, 10);
      zone.setDepth(314).setScrollFactor(0).setVisible(false);
      scene.add.existing(zone);

      const storageKey = def.key;
      zone.on("pointerdown", () => {
        const current = localStorage.getItem(storageKey) === "true";
        const next = !current;
        localStorage.setItem(storageKey, String(next));
        value.setText(next ? "ON" : "OFF");
        value.setColor(next ? "#44ff88" : "#666688");
        this.onToggleChangedCallback?.();
      });
      zone.on("pointerover", () => label.setColor("#ffffff"));
      zone.on("pointerout", () => label.setColor("#aaaacc"));

      this.toggleRows.push({ label, value, zone, bg });
    }
  }

  show(callbacks: { onClose: () => void; onToggleChanged: () => void }, accountName?: string): void {
    if (this.visible) return;
    this.visible = true;
    this.onCloseCallback = callbacks.onClose;
    this.onToggleChangedCallback = callbacks.onToggleChanged;
    this.currentAccountName = accountName ?? "";
    this.editingAccountName = false;
    this.acctNameStatusText.setText("");

    // Refresh toggle states from localStorage
    const keys = ["showFps", "showPing"];
    for (let i = 0; i < this.toggleRows.length; i++) {
      const isOn = localStorage.getItem(keys[i]) === "true";
      this.toggleRows[i].value.setText(isOn ? "ON" : "OFF");
      this.toggleRows[i].value.setColor(isOn ? "#44ff88" : "#666688");
    }

    // Set account name display
    this.acctNameLabel.setText(this.currentAccountName || "Account Name");
    this.acctNameValue.setText("CHANGE");

    this.setAllVisible(true);
    this.redraw();
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.cleanupInputDom();
    this.setAllVisible(false);
    this.onCloseCallback?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  relayout(): void {
    if (this.visible) this.redraw();
  }

  private toggleAccountNameEdit(): void {
    if (this.editingAccountName) return;
    this.editingAccountName = true;
    this.acctNameStatusText.setText("");
    this.acctNameValue.setText("");

    const S = getUIScale();
    const screenW = getScreenWidth();
    const panelW = Math.round(240 * S);
    const px = Math.round((screenW - panelW) / 2);
    const pad = Math.round(20 * S);
    const rowW = panelW - pad * 2;

    // Create DOM input
    const inputW = Math.round(rowW * 0.9);
    const inputHTML = `
      <div style="display:flex;gap:4px;align-items:center;">
        <input type="text" id="acctNameInput" maxlength="${ACCOUNT_NAME_MAX_LENGTH}" value="${this.currentAccountName}"
          style="
            width: ${inputW}px;
            padding: 4px 8px;
            font-size: 10px;
            font-family: 'Press Start 2P', monospace;
            background: rgba(22, 33, 62, 0.95);
            border: 1px solid rgba(68, 136, 255, 0.6);
            border-radius: 4px;
            color: #ffffff;
            text-align: center;
            outline: none;
          "
        />
      </div>
    `;

    // Position below the account name row
    const screenH = getScreenHeight();
    const rowH = Math.round(33 * S);
    const rowGap = Math.round(8 * S);
    const titleH = Math.round(30 * S);
    const totalRows = this.toggleRows.length + 1; // +1 for account name row
    const backH = Math.round(30 * S);
    const panelH = pad + titleH + totalRows * rowH + (totalRows - 1) * rowGap + rowGap + backH + pad;
    const py = Math.round((screenH - panelH) / 2);
    const acctRowY = py + pad + titleH;
    const inputDomY = acctRowY + rowH + Math.round(4 * S);

    this.acctNameInputDom = this.scene.add
      .dom(px + panelW / 2, inputDomY)
      .createFromHTML(inputHTML)
      .setDepth(315)
      .setScrollFactor(0);

    const htmlInput = this.acctNameInputDom.getChildByID("acctNameInput") as HTMLInputElement;
    if (htmlInput) {
      htmlInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") this.submitAccountName(htmlInput.value);
        if (e.key === "Escape") this.cancelAccountNameEdit();
      });
      htmlInput.addEventListener("keyup", (e) => e.stopPropagation());
      htmlInput.addEventListener("focus", () => {
        const kb = this.scene.input.keyboard;
        if (kb) kb.enabled = false;
      });
      htmlInput.addEventListener("blur", () => {
        const kb = this.scene.input.keyboard;
        if (kb) kb.enabled = true;
      });
      htmlInput.focus();
      htmlInput.select();
    }
  }

  private async submitAccountName(rawName: string): Promise<void> {
    const name = rawName.trim();
    if (name.length < ACCOUNT_NAME_MIN_LENGTH || name.length > ACCOUNT_NAME_MAX_LENGTH) {
      this.acctNameStatusText.setColor("#ff6666").setText(`${ACCOUNT_NAME_MIN_LENGTH}-${ACCOUNT_NAME_MAX_LENGTH} characters required`);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      this.acctNameStatusText.setColor("#ff6666").setText("Letters, numbers, underscores only");
      return;
    }

    this.acctNameStatusText.setColor("#aaaaaa").setText("Saving...");

    try {
      const auth = AuthManager.getInstance();
      const newName = await auth.setAccountName(name);
      this.currentAccountName = newName;
      this.acctNameLabel.setText(newName);
      this.acctNameStatusText.setColor("#44ff88").setText("Name updated!");

      // Tell the server to refresh the synced accountName field
      NetworkManager.getInstance().sendRefreshAccountName();

      this.cancelAccountNameEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      this.acctNameStatusText.setColor("#ff6666").setText(msg);
    }
  }

  private cancelAccountNameEdit(): void {
    this.editingAccountName = false;
    this.cleanupInputDom();
    this.acctNameValue.setText("CHANGE");
    const kb = this.scene.input.keyboard;
    if (kb) kb.enabled = true;
  }

  private cleanupInputDom(): void {
    if (this.acctNameInputDom) {
      this.acctNameInputDom.destroy();
      this.acctNameInputDom = null;
    }
  }

  private redraw(): void {
    const S = getUIScale();
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();

    const panelW = Math.round(240 * S);
    const rowH = Math.round(33 * S);
    const rowGap = Math.round(8 * S);
    const titleH = Math.round(30 * S);
    const pad = Math.round(20 * S);
    const backH = Math.round(30 * S);

    // Total rows = account name + toggles
    const totalRows = this.toggleRows.length + 1;
    const panelH = pad + titleH + totalRows * rowH + (totalRows - 1) * rowGap + rowGap + backH + pad;
    const px = Math.round((screenW - panelW) / 2);
    const py = Math.round((screenH - panelH) / 2);

    // Overlay
    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 0.5);
    this.overlay.fillRect(0, 0, screenW, screenH);
    this.overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, screenW, screenH),
      Phaser.Geom.Rectangle.Contains
    );

    // Panel background
    this.panelBg.setPosition(px, py);
    this.panelBg.setSize(panelW, panelH);

    // Title
    this.titleText.setPosition(px + panelW / 2, py + pad + titleH / 2);
    this.titleText.setFontSize(Math.round(10 * S));

    const rowW = panelW - pad * 2;

    // Account name row (first row)
    const acctRx = px + pad;
    const acctRy = py + pad + titleH;

    this.acctNameBg.setPosition(acctRx, acctRy);
    this.acctNameBg.setSize(rowW, rowH);

    this.acctNameLabel.setPosition(acctRx + Math.round(10 * S), acctRy + rowH / 2);
    this.acctNameLabel.setFontSize(Math.round(7 * S));

    this.acctNameValue.setPosition(acctRx + rowW - Math.round(10 * S), acctRy + rowH / 2);
    this.acctNameValue.setFontSize(Math.round(7 * S));

    this.acctNameZone.setPosition(acctRx + rowW / 2, acctRy + rowH / 2);
    this.acctNameZone.setSize(rowW, rowH);
    this.acctNameZone.setInteractive({ useHandCursor: true });

    this.acctNameStatusText.setPosition(px + panelW / 2, acctRy + rowH + Math.round(2 * S));
    this.acctNameStatusText.setFontSize(Math.round(5 * S));

    // Toggle rows (offset by 1 for account name row)
    for (let i = 0; i < this.toggleRows.length; i++) {
      const row = this.toggleRows[i];
      const rx = px + pad;
      const ry = py + pad + titleH + (i + 1) * (rowH + rowGap);

      row.bg.setPosition(rx, ry);
      row.bg.setSize(rowW, rowH);

      row.label.setPosition(rx + Math.round(10 * S), ry + rowH / 2);
      row.label.setFontSize(Math.round(7 * S));

      row.value.setPosition(rx + rowW - Math.round(10 * S), ry + rowH / 2);
      row.value.setFontSize(Math.round(7 * S));

      row.zone.setPosition(rx + rowW / 2, ry + rowH / 2);
      row.zone.setSize(rowW, rowH);
      row.zone.setInteractive({ useHandCursor: true });
    }

    // Back button
    const backY = py + pad + titleH + totalRows * (rowH + rowGap) + rowGap;
    const backBtnW = Math.round(80 * S);
    const backBtnX = px + panelW / 2;

    this.backText.setPosition(backBtnX, backY + backH / 2);
    this.backText.setFontSize(Math.round(7 * S));

    this.backZone.setPosition(backBtnX, backY + backH / 2);
    this.backZone.setSize(backBtnW, backH);
    this.backZone.setInteractive({ useHandCursor: true });
  }

  private setAllVisible(v: boolean): void {
    this.overlay.setVisible(v);
    this.panelBg.setVisible(v);
    this.titleText.setVisible(v);
    this.backText.setVisible(v);
    this.backZone.setVisible(v);

    // Account name row
    this.acctNameBg.setVisible(v);
    this.acctNameLabel.setVisible(v);
    this.acctNameValue.setVisible(v);
    this.acctNameZone.setVisible(v);
    this.acctNameStatusText.setVisible(v);

    if (v) {
      this.backZone.setInteractive({ useHandCursor: true });
      this.acctNameZone.setInteractive({ useHandCursor: true });
      this.overlay.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, getScreenWidth(), getScreenHeight()),
        Phaser.Geom.Rectangle.Contains
      );
    } else {
      this.backZone.disableInteractive();
      this.acctNameZone.disableInteractive();
      this.overlay.disableInteractive();
    }

    for (const row of this.toggleRows) {
      row.label.setVisible(v);
      row.value.setVisible(v);
      row.zone.setVisible(v);
      row.bg.setVisible(v);
      if (v) {
        row.zone.setInteractive({ useHandCursor: true });
      } else {
        row.zone.disableInteractive();
      }
    }
  }
}
