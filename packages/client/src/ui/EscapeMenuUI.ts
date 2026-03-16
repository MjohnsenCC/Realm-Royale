import Phaser from "phaser";
import { getUIScale, getScreenWidth, getScreenHeight } from "./UIScale";
import { UI_PANEL_CORNER, UI_BTN_CORNER } from "./UITextures";

interface ButtonDef {
  label: string;
  color: string;
  callback: () => void;
}

export class EscapeMenuUI {
  private scene: Phaser.Scene;
  private visible = false;

  // Full-screen dimming overlay
  private overlay: Phaser.GameObjects.Graphics;
  // Panel background
  private panelBg: Phaser.GameObjects.NineSlice;
  // Title
  private titleText: Phaser.GameObjects.Text;

  // Buttons
  private buttonBgs: Phaser.GameObjects.NineSlice[] = [];
  private buttonTexts: Phaser.GameObjects.Text[] = [];
  private buttonZones: Phaser.GameObjects.Zone[] = [];
  private buttonDefs: ButtonDef[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.overlay = new Phaser.GameObjects.Graphics(scene);
    this.overlay.setDepth(299).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.overlay);

    const C = UI_PANEL_CORNER;
    this.panelBg = new Phaser.GameObjects.NineSlice(scene, 0, 0, "ui-panel-overlay", undefined, 100, 100, C, C, C, C);
    this.panelBg.setOrigin(0, 0);
    this.panelBg.setDepth(300).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.panelBg);

    this.titleText = new Phaser.GameObjects.Text(scene, 0, 0, "MENU", {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "'Press Start 2P', monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    });
    this.titleText.setOrigin(0.5, 0.5).setDepth(301).setScrollFactor(0).setVisible(false);
    scene.add.existing(this.titleText);
  }

  setCallbacks(callbacks: {
    onReturnToGame: () => void;
    onOptions: () => void;
    onExitToCharacterSelect: () => void;
    onLogOut: () => void;
  }): void {
    // Destroy any existing buttons
    for (const bg of this.buttonBgs) bg.destroy();
    for (const t of this.buttonTexts) t.destroy();
    for (const z of this.buttonZones) z.destroy();
    this.buttonBgs = [];
    this.buttonTexts = [];
    this.buttonZones = [];

    this.buttonDefs = [
      { label: "Return to Game", color: "#aaaacc", callback: callbacks.onReturnToGame },
      { label: "Options", color: "#aaaacc", callback: callbacks.onOptions },
      { label: "Exit to Character Select", color: "#aaaacc", callback: callbacks.onExitToCharacterSelect },
      { label: "Log Out", color: "#aaaacc", callback: callbacks.onLogOut },
    ];

    for (let i = 0; i < this.buttonDefs.length; i++) {
      const def = this.buttonDefs[i];

      const BC = UI_BTN_CORNER;
      const bg = new Phaser.GameObjects.NineSlice(this.scene, 0, 0, "ui-btn-default", undefined, 10, 10, BC, BC, BC, BC);
      bg.setOrigin(0, 0);
      bg.setDepth(301).setScrollFactor(0).setVisible(false);
      this.scene.add.existing(bg);
      this.buttonBgs.push(bg);

      const text = new Phaser.GameObjects.Text(this.scene, 0, 0, def.label, {
        fontSize: "8px",
        color: def.color,
        fontFamily: "'Press Start 2P', monospace",
        stroke: "#000000",
        strokeThickness: 2,
      });
      text.setOrigin(0.5, 0.5).setDepth(302).setScrollFactor(0).setVisible(false);
      this.scene.add.existing(text);
      this.buttonTexts.push(text);

      const zone = new Phaser.GameObjects.Zone(this.scene, 0, 0, 10, 10);
      zone.setDepth(303).setScrollFactor(0).setVisible(false);
      this.scene.add.existing(zone);
      this.buttonZones.push(zone);

      const originalColor = def.color;
      zone.on("pointerover", () => {
        text.setColor("#ffffff");
        bg.setTexture("ui-btn-hover");
      });
      zone.on("pointerout", () => {
        text.setColor(originalColor);
        bg.setTexture("ui-btn-default");
      });
      zone.on("pointerdown", () => {
        bg.setTexture("ui-btn-pressed");
        def.callback();
      });
    }
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.setAllVisible(true);
    this.redraw();
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.setAllVisible(false);
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

    const panelW = Math.round(220 * S);
    const btnH = Math.round(33 * S);
    const btnGap = Math.round(10 * S);
    const titleH = Math.round(30 * S);
    const pad = Math.round(20 * S);

    const panelH = pad + titleH + this.buttonDefs.length * btnH + (this.buttonDefs.length - 1) * btnGap + pad;
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

    // Buttons
    const btnW = panelW - pad * 2;
    for (let i = 0; i < this.buttonDefs.length; i++) {
      const bx = px + pad;
      const by = py + pad + titleH + i * (btnH + btnGap);

      // Background
      const bg = this.buttonBgs[i];
      bg.setPosition(bx, by);
      bg.setSize(btnW, btnH);

      // Text
      const text = this.buttonTexts[i];
      text.setPosition(bx + btnW / 2, by + btnH / 2);
      text.setFontSize(Math.round(7 * S));

      // Zone
      const zone = this.buttonZones[i];
      zone.setPosition(bx + btnW / 2, by + btnH / 2);
      zone.setSize(btnW, btnH);
      zone.setInteractive({ useHandCursor: true });
    }
  }

  private setAllVisible(v: boolean): void {
    this.overlay.setVisible(v);
    this.panelBg.setVisible(v);
    this.titleText.setVisible(v);
    for (const bg of this.buttonBgs) bg.setVisible(v);
    for (const text of this.buttonTexts) text.setVisible(v);
    for (const zone of this.buttonZones) {
      zone.setVisible(v);
      if (v) {
        zone.setInteractive({ useHandCursor: true });
      } else {
        zone.disableInteractive();
      }
    }
    if (v) {
      this.overlay.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, getScreenWidth(), getScreenHeight()),
        Phaser.Geom.Rectangle.Contains
      );
    } else {
      this.overlay.disableInteractive();
    }
  }
}
