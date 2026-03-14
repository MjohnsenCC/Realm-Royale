import Phaser from "phaser";
import { getUIScale, getScreenWidth, getScreenHeight } from "./UIScale";

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
  bg: Phaser.GameObjects.Graphics;
}

export class OptionsUI {
  private scene: Phaser.Scene;
  private visible = false;

  private overlay: Phaser.GameObjects.Graphics;
  private panelBg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private backText: Phaser.GameObjects.Text;
  private backZone: Phaser.GameObjects.Zone;

  private toggleRows: ToggleRow[] = [];
  private onCloseCallback: (() => void) | null = null;
  private onToggleChangedCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.overlay = new Phaser.GameObjects.Graphics(scene);
    this.overlay.setDepth(310).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.overlay);

    this.panelBg = new Phaser.GameObjects.Graphics(scene);
    this.panelBg.setDepth(311).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.panelBg);

    this.titleText = new Phaser.GameObjects.Text(scene, 0, 0, "OPTIONS", {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    this.titleText.setOrigin(0.5, 0.5).setDepth(312).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.titleText);

    this.backText = new Phaser.GameObjects.Text(scene, 0, 0, "BACK", {
      fontSize: "12px",
      color: "#aaaacc",
      fontFamily: "monospace",
    });
    this.backText.setOrigin(0.5, 0.5).setDepth(312).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.backText);

    this.backZone = new Phaser.GameObjects.Zone(scene, 0, 0, 10, 10);
    this.backZone.setDepth(313).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.backZone);

    this.backZone.on("pointerover", () => this.backText.setColor("#ffffff"));
    this.backZone.on("pointerout", () => this.backText.setColor("#aaaacc"));
    this.backZone.on("pointerdown", () => this.hide());

    // Create toggle rows
    const toggleDefs = [
      { key: "showFps", label: "Show FPS" },
      { key: "showPing", label: "Show Ping" },
    ];

    for (const def of toggleDefs) {
      const bg = new Phaser.GameObjects.Graphics(scene);
      bg.setDepth(312).setScrollFactor(0).setVisible(false);
      scene.add.existing(bg);

      const label = new Phaser.GameObjects.Text(scene, 0, 0, def.label, {
        fontSize: "12px",
        color: "#aaaacc",
        fontFamily: "monospace",
      });
      label.setOrigin(0, 0.5).setDepth(313).setScrollFactor(0).setVisible(false);
      scene.add.existing(label);

      const isOn = localStorage.getItem(def.key) === "true";
      const value = new Phaser.GameObjects.Text(scene, 0, 0, isOn ? "ON" : "OFF", {
        fontSize: "12px",
        color: isOn ? "#44ff88" : "#666688",
        fontFamily: "monospace",
        fontStyle: "bold",
      });
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

  show(callbacks: { onClose: () => void; onToggleChanged: () => void }): void {
    if (this.visible) return;
    this.visible = true;
    this.onCloseCallback = callbacks.onClose;
    this.onToggleChangedCallback = callbacks.onToggleChanged;

    // Refresh toggle states from localStorage
    const keys = ["showFps", "showPing"];
    for (let i = 0; i < this.toggleRows.length; i++) {
      const isOn = localStorage.getItem(keys[i]) === "true";
      this.toggleRows[i].value.setText(isOn ? "ON" : "OFF");
      this.toggleRows[i].value.setColor(isOn ? "#44ff88" : "#666688");
    }

    this.setAllVisible(true);
    this.redraw();
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.setAllVisible(false);
    this.onCloseCallback?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  relayout(): void {
    if (this.visible) this.redraw();
  }

  private redraw(): void {
    const S = getUIScale();
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();

    const panelW = Math.round(240 * S);
    const rowH = Math.round(34 * S);
    const rowGap = Math.round(8 * S);
    const titleH = Math.round(30 * S);
    const pad = Math.round(20 * S);
    const backH = Math.round(30 * S);

    const panelH = pad + titleH + this.toggleRows.length * rowH + (this.toggleRows.length - 1) * rowGap + rowGap + backH + pad;
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
    this.panelBg.clear();
    this.panelBg.fillStyle(0x111122, 0.95);
    this.panelBg.fillRoundedRect(px, py, panelW, panelH, 6);
    this.panelBg.lineStyle(2, 0x6666aa, 0.8);
    this.panelBg.strokeRoundedRect(px, py, panelW, panelH, 6);

    // Title
    this.titleText.setPosition(px + panelW / 2, py + pad + titleH / 2);
    this.titleText.setFontSize(Math.round(16 * S));

    // Toggle rows
    const rowW = panelW - pad * 2;
    for (let i = 0; i < this.toggleRows.length; i++) {
      const row = this.toggleRows[i];
      const rx = px + pad;
      const ry = py + pad + titleH + i * (rowH + rowGap);

      row.bg.clear();
      row.bg.fillStyle(0x222244, 0.8);
      row.bg.fillRoundedRect(rx, ry, rowW, rowH, 4);
      row.bg.lineStyle(1, 0x444466, 0.8);
      row.bg.strokeRoundedRect(rx, ry, rowW, rowH, 4);

      row.label.setPosition(rx + Math.round(10 * S), ry + rowH / 2);
      row.label.setFontSize(Math.round(11 * S));

      row.value.setPosition(rx + rowW - Math.round(10 * S), ry + rowH / 2);
      row.value.setFontSize(Math.round(11 * S));

      row.zone.setPosition(rx + rowW / 2, ry + rowH / 2);
      row.zone.setSize(rowW, rowH);
      row.zone.setInteractive({ useHandCursor: true });
    }

    // Back button
    const backY = py + pad + titleH + this.toggleRows.length * (rowH + rowGap) + rowGap;
    const backBtnW = Math.round(80 * S);
    const backBtnX = px + panelW / 2;

    this.backText.setPosition(backBtnX, backY + backH / 2);
    this.backText.setFontSize(Math.round(11 * S));

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

    if (v) {
      this.backZone.setInteractive({ useHandCursor: true });
      this.overlay.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, getScreenWidth(), getScreenHeight()),
        Phaser.Geom.Rectangle.Contains
      );
    } else {
      this.backZone.disableInteractive();
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
