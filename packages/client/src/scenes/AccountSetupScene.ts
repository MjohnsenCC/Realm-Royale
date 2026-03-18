import Phaser from "phaser";
import { AuthManager } from "../auth/AuthManager";
import { ACCOUNT_NAME_MIN_LENGTH, ACCOUNT_NAME_MAX_LENGTH } from "@rotmg-lite/shared";

export class AccountSetupScene extends Phaser.Scene {
  private confirmBtnGlowGraphics!: Phaser.GameObjects.Graphics;
  private confirmBtnGraphics!: Phaser.GameObjects.Graphics;
  private confirmBtnText!: Phaser.GameObjects.Text;
  private confirmBtnZone!: Phaser.GameObjects.Zone;
  private confirmBtnHovered = false;
  private confirmBtnPulsePhase = 0;
  private confirmBtnY = 0;

  private resizeHandler?: (gameSize: Phaser.Structs.Size) => void;
  private lastWidth = 0;
  private lastHeight = 0;
  private resizeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super({ key: "AccountSetupScene" });
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Handle window resize
    this.lastWidth = width;
    this.lastHeight = height;
    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      const newW = gameSize.width;
      const newH = gameSize.height;
      if (Math.abs(newW - this.lastWidth) < 2 && Math.abs(newH - this.lastHeight) < 2) return;
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.scale.off("resize", this.resizeHandler!);
        this.scene.restart();
      }, 200);
    };
    this.scale.on("resize", this.resizeHandler);
    this.events.once("shutdown", this.shutdown, this);

    // Background
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.drawBackground(width, height);

    // Layout
    const contentH = 240;
    const startY = Math.max(16, (height - contentH) / 2);

    // Title
    this.add
      .text(cx, startY, "CHOOSE YOUR", {
        fontSize: "12px",
        color: "#8899aa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(cx, startY + 24, "ACCOUNT NAME", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Subtitle
    this.add
      .text(cx, startY + 56, "This name is visible to other players", {
        fontSize: "6px",
        color: "#556677",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Name input
    const inputY = startY + 86;

    const inputHTML = `
      <input type="text" id="accountNameInput" maxlength="${ACCOUNT_NAME_MAX_LENGTH}" placeholder="Letters, numbers, underscores..."
        style="
          width: 280px;
          padding: 10px 16px;
          font-size: 14px;
          font-family: 'Press Start 2P', monospace;
          background: rgba(22, 33, 62, 0.9);
          border: 1px solid rgba(68, 136, 255, 0.5);
          border-radius: 6px;
          color: #ffffff;
          text-align: center;
          outline: none;
          box-shadow: 0 0 10px rgba(68, 136, 255, 0.1);
          transition: border-color 0.2s, box-shadow 0.2s;
        "
        onfocus="this.style.borderColor='rgba(68,136,255,0.8)';this.style.boxShadow='0 0 15px rgba(68,136,255,0.3)'"
        onblur="this.style.borderColor='rgba(68,136,255,0.5)';this.style.boxShadow='0 0 10px rgba(68,136,255,0.1)'"
      />
    `;
    const inputElement = this.add
      .dom(cx, inputY)
      .createFromHTML(inputHTML)
      .setDepth(6);

    const htmlInput = inputElement.getChildByID("accountNameInput") as HTMLInputElement;
    if (htmlInput) {
      htmlInput.addEventListener("keydown", (e) => e.stopPropagation());
      htmlInput.addEventListener("keyup", (e) => e.stopPropagation());
      htmlInput.addEventListener("focus", () => {
        if (this.input.keyboard) this.input.keyboard.enabled = false;
      });
      htmlInput.addEventListener("blur", () => {
        if (this.input.keyboard) this.input.keyboard.enabled = true;
      });
    }

    // Rules text
    this.add
      .text(cx, inputY + 30, `${ACCOUNT_NAME_MIN_LENGTH}-${ACCOUNT_NAME_MAX_LENGTH} characters, letters/numbers/underscores only`, {
        fontSize: "5px",
        color: "#445566",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Confirm button
    const btnW = 220;
    const btnH = 48;
    this.confirmBtnY = inputY + 56;

    this.confirmBtnGlowGraphics = this.add.graphics().setDepth(7);
    this.confirmBtnGraphics = this.add.graphics().setDepth(8);

    this.confirmBtnText = this.add
      .text(cx, this.confirmBtnY + btnH / 2, "CONFIRM", {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.confirmBtnZone = this.add
      .zone(cx, this.confirmBtnY + btnH / 2, btnW, btnH)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    this.confirmBtnZone.on("pointerover", () => { this.confirmBtnHovered = true; });
    this.confirmBtnZone.on("pointerout", () => { this.confirmBtnHovered = false; });

    // Status/error text
    const statusText = this.add
      .text(cx, this.confirmBtnY + btnH + 16, "", {
        fontSize: "7px",
        color: "#ff6666",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Confirm handler
    this.confirmBtnZone.on("pointerdown", async () => {
      const name = htmlInput?.value?.trim() ?? "";

      if (name.length < ACCOUNT_NAME_MIN_LENGTH || name.length > ACCOUNT_NAME_MAX_LENGTH) {
        statusText.setText(`Name must be ${ACCOUNT_NAME_MIN_LENGTH}-${ACCOUNT_NAME_MAX_LENGTH} characters`);
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        statusText.setText("Letters, numbers, and underscores only");
        return;
      }

      this.confirmBtnZone.disableInteractive();
      statusText.setColor("#aaaaaa").setText("Setting name...");

      htmlInput?.blur();
      if (this.input.keyboard) this.input.keyboard.enabled = true;

      try {
        const auth = AuthManager.getInstance();
        await auth.setAccountName(name);
        statusText.setColor("#66cc66").setText("Name set!");

        // Fade out and go to character select
        const fadeOut = this.add.graphics().setDepth(100);
        fadeOut.fillStyle(0x000000, 1);
        fadeOut.fillRect(0, 0, width, height);
        fadeOut.setAlpha(0);
        this.tweens.add({
          targets: fadeOut,
          alpha: { from: 0, to: 1 },
          duration: 400,
          ease: "Power2",
          onComplete: () => {
            this.scene.start("CharacterSelectScene");
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to set name";
        statusText.setColor("#ff6666").setText(message);
        this.confirmBtnZone.setInteractive({ useHandCursor: true });
      }
    });

    // Draw initial button state
    this.drawConfirmButton();

    // Fade in
    const fadeIn = this.add.graphics().setDepth(100);
    fadeIn.fillStyle(0x000000, 1);
    fadeIn.fillRect(0, 0, width, height);
    this.tweens.add({
      targets: fadeIn,
      alpha: 0,
      duration: 400,
      ease: "Power2",
      onComplete: () => fadeIn.destroy(),
    });
  }

  shutdown() {
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
    }
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.confirmBtnPulsePhase += dt * 2.5;
    this.drawConfirmButton();
  }

  private drawConfirmButton(): void {
    const { width } = this.scale;
    const cx = width / 2;
    const btnW = 220;
    const btnH = 48;
    const btnX = cx - btnW / 2;
    const btnY = this.confirmBtnY;
    const hovered = this.confirmBtnHovered;
    const pulse = Math.sin(this.confirmBtnPulsePhase) * 0.5 + 0.5;

    // Glow
    this.confirmBtnGlowGraphics.clear();
    const glowExpand = hovered ? 12 : 6 + pulse * 4;
    const glowAlpha = hovered ? 0.25 : 0.08 + pulse * 0.1;
    this.confirmBtnGlowGraphics.fillStyle(0x4488ff, glowAlpha);
    this.confirmBtnGlowGraphics.fillRoundedRect(
      btnX - glowExpand, btnY - glowExpand,
      btnW + glowExpand * 2, btnH + glowExpand * 2,
      12 + glowExpand / 2
    );

    // Body
    this.confirmBtnGraphics.clear();
    const bodyColor = hovered ? 0x3366cc : 0x2a2a44;
    const borderColor = hovered ? 0x66aaff : 0x4488ff;
    const borderAlpha = hovered ? 1.0 : 0.6 + pulse * 0.3;

    this.confirmBtnGraphics.fillStyle(bodyColor, 0.9);
    this.confirmBtnGraphics.fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    this.confirmBtnGraphics.lineStyle(2, borderColor, borderAlpha);
    this.confirmBtnGraphics.strokeRoundedRect(btnX, btnY, btnW, btnH, 10);

    this.confirmBtnText.setColor(hovered ? "#ffffff" : "#ddddff");
    this.confirmBtnText.setScale(hovered ? 1.05 : 1.0);
  }

  private drawBackground(width: number, height: number) {
    const grid = this.add.graphics().setDepth(0);
    const gridSpacing = 40;
    grid.lineStyle(1, 0x4488ff, 0.04);
    for (let x = 0; x <= width; x += gridSpacing) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSpacing) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.strokePath();
    grid.fillStyle(0x4488ff, 0.08);
    for (let x = 0; x <= width; x += gridSpacing) {
      for (let y = 0; y <= height; y += gridSpacing) {
        grid.fillCircle(x, y, 1.5);
      }
    }

    const vignette = this.add.graphics().setDepth(2);
    const edgeDepth = Math.round(width * 0.25);
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps;
      const alpha = 0.4 * (1 - ratio) * (1 - ratio);
      vignette.fillStyle(0x000000, alpha);
      const offset = Math.round(edgeDepth * ratio);
      const thickness = Math.ceil(edgeDepth / steps) + 1;
      vignette.fillRect(offset, 0, thickness, height);
      vignette.fillRect(width - offset - thickness, 0, thickness, height);
      vignette.fillRect(0, offset, width, thickness);
      vignette.fillRect(0, height - offset - thickness, width, thickness);
    }
  }
}
