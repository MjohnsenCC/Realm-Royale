import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";
import { AuthManager } from "../auth/AuthManager";
import { getUISize, setUISize, UISize } from "../ui/UIScale";
import {
  SERVERS,
  getSelectedServerId,
  setSelectedServerId,
} from "../network/ServerConfig";

interface Particle {
  graphics: Phaser.GameObjects.Graphics;
  vx: number;
  vy: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface FloatingShape {
  graphics: Phaser.GameObjects.Graphics;
  vy: number;
  vx: number;
  rotationSpeed: number;
  currentRotation: number;
}

export class MenuScene extends Phaser.Scene {
  private particles: Particle[] = [];
  private floatingShapes: FloatingShape[] = [];
  private playBtnGlowGraphics!: Phaser.GameObjects.Graphics;
  private playBtnGraphics!: Phaser.GameObjects.Graphics;
  private playBtnText!: Phaser.GameObjects.Text;
  private playBtnZone!: Phaser.GameObjects.Zone;
  private playBtnHovered = false;
  private playBtnPulsePhase = 0;
  private playBtnY = 0;
  private elapsed = 0;

  constructor() {
    super({ key: "MenuScene" });
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // If already authenticated, go straight to character select
    if (AuthManager.getInstance().isAuthenticated()) {
      this.scene.start("CharacterSelectScene");
      return;
    }

    // ─── 1. GRID BACKGROUND ───
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

    // ─── 2. FLOATING GEOMETRIC SHAPES ───
    for (let i = 0; i < 8; i++) {
      const g = this.add.graphics().setDepth(0);
      const isHex = i % 2 === 0;
      const size = 20 + Math.random() * 40;
      const alpha = 0.02 + Math.random() * 0.04;
      g.lineStyle(1, 0x4488ff, alpha);
      if (isHex) {
        g.beginPath();
        for (let s = 0; s < 6; s++) {
          const angle = (Math.PI / 3) * s - Math.PI / 2;
          const px = Math.cos(angle) * size;
          const py = Math.sin(angle) * size;
          if (s === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.strokePath();
      } else {
        g.beginPath();
        g.moveTo(0, -size);
        g.lineTo(size * 0.6, 0);
        g.lineTo(0, size);
        g.lineTo(-size * 0.6, 0);
        g.closePath();
        g.strokePath();
      }
      g.setPosition(Math.random() * width, Math.random() * height);
      this.floatingShapes.push({
        graphics: g,
        vy: -(3 + Math.random() * 8),
        vx: -2 + Math.random() * 4,
        rotationSpeed: -0.2 + Math.random() * 0.4,
        currentRotation: Math.random() * Math.PI * 2,
      });
    }

    // ─── 3. PARTICLES ───
    const particleColors = [0x4488ff, 0x4488ff, 0x4488ff, 0x6644cc, 0x44aaff, 0xffffff];
    for (let i = 0; i < 60; i++) {
      const g = this.add.graphics().setDepth(1);
      const size = 1 + Math.random() * 4;
      const baseAlpha = 0.05 + Math.random() * 0.25;
      const color = particleColors[Math.floor(Math.random() * particleColors.length)];
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, size);
      g.setPosition(Math.random() * width, Math.random() * height);
      g.setAlpha(baseAlpha);
      this.particles.push({
        graphics: g,
        vx: -5 + Math.random() * 10,
        vy: -(8 + Math.random() * 25),
        baseAlpha,
        twinkleSpeed: 1.5 + Math.random() * 3,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    // ─── 4. VIGNETTE ───
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

    // ─── 5. TITLE ───
    const titleY = height * 0.22;

    // Glow text (behind, larger, pulsing)
    const titleGlow = this.add
      .text(cx, titleY, "REALM ROYALE", {
        fontSize: "68px",
        color: "#4488ff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0.15)
      .setDepth(10);

    this.tweens.add({
      targets: titleGlow,
      alpha: { from: 0.1, to: 0.3 },
      scaleX: { from: 1.0, to: 1.02 },
      scaleY: { from: 1.0, to: 1.02 },
      duration: 2000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    // Main title with color shimmer
    const titleMain = this.add
      .text(cx, titleY, "REALM ROYALE", {
        fontSize: "62px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(11);

    const shimmerObj = { t: 0 };
    this.tweens.add({
      targets: shimmerObj,
      t: 1,
      duration: 3000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        const r = Math.round(255 - shimmerObj.t * (255 - 68));
        const g = Math.round(255 - shimmerObj.t * (255 - 136));
        const b = 255;
        titleMain.setColor(`rgb(${r}, ${g}, ${b})`);
      },
    });

    // Decorative dividers flanking title
    const titleHalfW = titleMain.width / 2;
    const lineGap = 15;
    const lineLength = 100;

    const leftDiv = this.add.graphics().setDepth(10);
    leftDiv.lineStyle(1.5, 0x4488ff, 0.4);
    const lx1 = cx - titleHalfW - lineGap;
    const lx2 = lx1 - lineLength;
    leftDiv.beginPath();
    leftDiv.moveTo(lx1, titleY);
    leftDiv.lineTo(lx2, titleY);
    leftDiv.strokePath();
    leftDiv.fillStyle(0x4488ff, 0.5);
    this.drawDiamond(leftDiv, lx2 - 6, titleY, 5);

    const rightDiv = this.add.graphics().setDepth(10);
    rightDiv.lineStyle(1.5, 0x4488ff, 0.4);
    const rx1 = cx + titleHalfW + lineGap;
    const rx2 = rx1 + lineLength;
    rightDiv.beginPath();
    rightDiv.moveTo(rx1, titleY);
    rightDiv.lineTo(rx2, titleY);
    rightDiv.strokePath();
    rightDiv.fillStyle(0x4488ff, 0.5);
    this.drawDiamond(rightDiv, rx2 + 6, titleY, 5);

    // Subtitle
    this.add
      .text(cx, titleY + 48, "MULTIPLAYER  TOP-DOWN  SHOOTER", {
        fontSize: "13px",
        color: "#556688",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(11);

    // ─── 5b. SIGN IN WITH GOOGLE ───
    const googleBtnY = height * 0.37;
    const googleBtnW = 240;
    const googleBtnH = 40;

    const googleBtnGfx = this.add.graphics().setDepth(5);
    googleBtnGfx.fillStyle(0x222244, 0.9);
    googleBtnGfx.fillRoundedRect(cx - googleBtnW / 2, googleBtnY, googleBtnW, googleBtnH, 6);
    googleBtnGfx.lineStyle(1, 0x4488ff, 0.4);
    googleBtnGfx.strokeRoundedRect(cx - googleBtnW / 2, googleBtnY, googleBtnW, googleBtnH, 6);

    const googleBtnText = this.add
      .text(cx, googleBtnY + googleBtnH / 2, "SIGN IN WITH GOOGLE", {
        fontSize: "15px",
        color: "#4488ff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const googleBtnZone = this.add
      .zone(cx, googleBtnY + googleBtnH / 2, googleBtnW, googleBtnH)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    googleBtnZone.on("pointerover", () => {
      googleBtnGfx.clear();
      googleBtnGfx.fillStyle(0x333366, 0.9);
      googleBtnGfx.fillRoundedRect(cx - googleBtnW / 2, googleBtnY, googleBtnW, googleBtnH, 6);
      googleBtnGfx.lineStyle(1, 0x4488ff, 0.7);
      googleBtnGfx.strokeRoundedRect(cx - googleBtnW / 2, googleBtnY, googleBtnW, googleBtnH, 6);
      googleBtnText.setColor("#66aaff");
    });
    googleBtnZone.on("pointerout", () => {
      googleBtnGfx.clear();
      googleBtnGfx.fillStyle(0x222244, 0.9);
      googleBtnGfx.fillRoundedRect(cx - googleBtnW / 2, googleBtnY, googleBtnW, googleBtnH, 6);
      googleBtnGfx.lineStyle(1, 0x4488ff, 0.4);
      googleBtnGfx.strokeRoundedRect(cx - googleBtnW / 2, googleBtnY, googleBtnW, googleBtnH, 6);
      googleBtnText.setColor("#4488ff");
    });
    googleBtnZone.on("pointerdown", () => {
      window.location.href = "/auth/google";
    });

    // Divider: "or"
    this.add
      .text(cx, googleBtnY + googleBtnH + 14, "— or play as guest —", {
        fontSize: "11px",
        color: "#445566",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // ─── 6. SETTINGS PANEL ───
    const panelW = 280;
    const panelH = 130;
    const panelX = cx - panelW / 2;
    const panelY = googleBtnY + googleBtnH + 38;

    const panel = this.add.graphics().setDepth(5);
    panel.fillStyle(0x222222, 0.85);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(1, 0x555555, 0.6);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    // Top accent line
    panel.lineStyle(1, 0x4488ff, 0.2);
    panel.beginPath();
    panel.moveTo(panelX + 8, panelY);
    panel.lineTo(panelX + panelW - 8, panelY);
    panel.strokePath();

    // Server selector
    const serverLabelY = panelY + 18;
    this.add
      .text(cx, serverLabelY, "SERVER", {
        fontSize: "10px",
        color: "#667788",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const serverBtnY = serverLabelY + 20;
    const currentServerId = getSelectedServerId();
    const serverButtons: Phaser.GameObjects.Text[] = [];
    const totalServerBtnWidth = 180;
    const serverBtnSpacing = totalServerBtnWidth / SERVERS.length;
    const serverStartX = cx - totalServerBtnWidth / 2 + serverBtnSpacing / 2;

    for (let i = 0; i < SERVERS.length; i++) {
      const server = SERVERS[i];
      const btn = this.add
        .text(serverStartX + i * serverBtnSpacing, serverBtnY, server.name, {
          fontSize: "16px",
          color: server.id === currentServerId ? "#4488ff" : "#555566",
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerdown", () => {
        setSelectedServerId(server.id);
        for (let j = 0; j < serverButtons.length; j++) {
          serverButtons[j].setColor(
            SERVERS[j].id === server.id ? "#4488ff" : "#555566"
          );
        }
      });
      btn.on("pointerover", () => {
        if (getSelectedServerId() !== server.id) btn.setColor("#8888aa");
      });
      btn.on("pointerout", () => {
        btn.setColor(
          getSelectedServerId() === server.id ? "#4488ff" : "#555566"
        );
      });
      serverButtons.push(btn);
    }

    // Separator line
    const sepY = serverBtnY + 18;
    panel.lineStyle(1, 0x444466, 0.3);
    panel.beginPath();
    panel.moveTo(panelX + 20, sepY);
    panel.lineTo(panelX + panelW - 20, sepY);
    panel.strokePath();

    // UI Scale selector
    const scaleLabelY = sepY + 12;
    this.add
      .text(cx, scaleLabelY, "UI SCALE", {
        fontSize: "10px",
        color: "#667788",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const scaleBtnY = scaleLabelY + 20;
    const uiSizes: UISize[] = ["small", "medium", "large"];
    const sizeLabels = ["Small", "Medium", "Large"];
    const currentSize = getUISize();
    const sizeButtons: Phaser.GameObjects.Text[] = [];
    const totalBtnWidth = 180;
    const btnSpacing = totalBtnWidth / uiSizes.length;
    const startX = cx - totalBtnWidth / 2 + btnSpacing / 2;

    for (let i = 0; i < uiSizes.length; i++) {
      const btn = this.add
        .text(startX + i * btnSpacing, scaleBtnY, sizeLabels[i], {
          fontSize: "16px",
          color: uiSizes[i] === currentSize ? "#4488ff" : "#555566",
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerdown", () => {
        setUISize(uiSizes[i]);
        for (let j = 0; j < sizeButtons.length; j++) {
          sizeButtons[j].setColor(j === i ? "#4488ff" : "#555566");
        }
      });
      btn.on("pointerover", () => {
        if (getUISize() !== uiSizes[i]) btn.setColor("#8888aa");
      });
      btn.on("pointerout", () => {
        btn.setColor(getUISize() === uiSizes[i] ? "#4488ff" : "#555566");
      });
      sizeButtons.push(btn);
    }

    // ─── 7. NAME INPUT ───
    const nameY = panelY + panelH + 25;

    this.add
      .text(cx, nameY - 12, "PLAYER NAME", {
        fontSize: "10px",
        color: "#667788",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const inputHTML = `
      <input type="text" id="nameInput" maxlength="16" placeholder="Enter your name..."
        style="
          width: 240px;
          padding: 10px 16px;
          font-size: 18px;
          font-family: monospace;
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
      .dom(cx, nameY + 12)
      .createFromHTML(inputHTML)
      .setDepth(6);

    const htmlInput = inputElement.getChildByID(
      "nameInput"
    ) as HTMLInputElement;
    if (htmlInput) {
      htmlInput.addEventListener("focus", () => {
        if (this.input.keyboard) this.input.keyboard.enabled = false;
      });
      htmlInput.addEventListener("blur", () => {
        if (this.input.keyboard) this.input.keyboard.enabled = true;
      });
    }

    // ─── 8. PLAY BUTTON ───
    const playBtnW = 220;
    const playBtnH = 52;
    this.playBtnY = nameY + 65;

    this.playBtnGlowGraphics = this.add.graphics().setDepth(7);
    this.playBtnGraphics = this.add.graphics().setDepth(8);

    this.playBtnText = this.add
      .text(cx, this.playBtnY + playBtnH / 2, "PLAY", {
        fontSize: "28px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.playBtnZone = this.add
      .zone(cx, this.playBtnY + playBtnH / 2, playBtnW, playBtnH)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    this.playBtnZone.on("pointerover", () => {
      this.playBtnHovered = true;
    });
    this.playBtnZone.on("pointerout", () => {
      this.playBtnHovered = false;
    });

    // Status text
    const statusText = this.add
      .text(cx, this.playBtnY + playBtnH + 20, "", {
        fontSize: "14px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Connect handler
    this.playBtnZone.on("pointerdown", async () => {
      this.playBtnZone.disableInteractive();
      statusText.setText("Connecting...");

      htmlInput?.blur();
      if (this.input.keyboard) this.input.keyboard.enabled = true;

      const rawName = htmlInput?.value?.trim() ?? "";
      const playerName = rawName.length > 0 ? rawName : "Player";

      try {
        const network = NetworkManager.getInstance();
        await network.joinGame(playerName);
        statusText.setText("Connected!");

        // Fade out transition
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
            this.scene.start("GameScene");
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        statusText.setText(`Error: ${message}`);
        this.playBtnZone.setInteractive({ useHandCursor: true });
      }
    });

    // Draw initial play button state
    this.drawPlayButton();

    // ─── 9. CONTROLS HINT & VERSION ───
    this.add
      .text(
        cx,
        height - 25,
        "WASD move  |  Mouse aim  |  Click shoot  |  Q return to nexus",
        {
          fontSize: "11px",
          color: "#334455",
          fontFamily: "monospace",
        }
      )
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(width - 10, height - 10, "v0.0.28", {
        fontSize: "10px",
        color: "#333344",
        fontFamily: "monospace",
      })
      .setOrigin(1, 1)
      .setDepth(5);

    // ─── 10. FADE IN ───
    const fadeIn = this.add.graphics().setDepth(100);
    fadeIn.fillStyle(0x000000, 1);
    fadeIn.fillRect(0, 0, width, height);
    this.tweens.add({
      targets: fadeIn,
      alpha: 0,
      duration: 800,
      ease: "Power2",
      onComplete: () => fadeIn.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    const { width, height } = this.scale;

    // Particles: move + twinkle
    for (const p of this.particles) {
      p.graphics.x += p.vx * dt;
      p.graphics.y += p.vy * dt;
      const twinkle = Math.sin(this.elapsed * p.twinkleSpeed + p.twinkleOffset);
      p.graphics.setAlpha(p.baseAlpha * (0.5 + 0.5 * twinkle));

      if (p.graphics.y < -10) {
        p.graphics.y = height + 10;
        p.graphics.x = Math.random() * width;
      }
      if (p.graphics.x < -10) p.graphics.x = width + 10;
      if (p.graphics.x > width + 10) p.graphics.x = -10;
    }

    // Floating shapes: drift + rotate
    for (const s of this.floatingShapes) {
      s.graphics.x += s.vx * dt;
      s.graphics.y += s.vy * dt;
      s.currentRotation += s.rotationSpeed * dt;
      s.graphics.setRotation(s.currentRotation);

      if (s.graphics.y < -80) {
        s.graphics.y = height + 80;
        s.graphics.x = Math.random() * width;
      }
      if (s.graphics.x < -80) s.graphics.x = width + 80;
      if (s.graphics.x > width + 80) s.graphics.x = -80;
    }

    // Play button pulse
    this.playBtnPulsePhase += dt * 2.5;
    this.drawPlayButton();
  }

  private drawPlayButton(): void {
    const { width } = this.scale;
    const cx = width / 2;
    const btnW = 220;
    const btnH = 52;
    const btnX = cx - btnW / 2;
    const btnY = this.playBtnY;
    const hovered = this.playBtnHovered;
    const pulse = Math.sin(this.playBtnPulsePhase) * 0.5 + 0.5;

    // Glow
    this.playBtnGlowGraphics.clear();
    const glowExpand = hovered ? 12 : 6 + pulse * 4;
    const glowAlpha = hovered ? 0.25 : 0.08 + pulse * 0.1;
    this.playBtnGlowGraphics.fillStyle(0x4488ff, glowAlpha);
    this.playBtnGlowGraphics.fillRoundedRect(
      btnX - glowExpand,
      btnY - glowExpand,
      btnW + glowExpand * 2,
      btnH + glowExpand * 2,
      12 + glowExpand / 2
    );

    // Body
    this.playBtnGraphics.clear();
    const bodyColor = hovered ? 0x3366cc : 0x2a2a44;
    const borderColor = hovered ? 0x66aaff : 0x4488ff;
    const borderAlpha = hovered ? 1.0 : 0.6 + pulse * 0.3;

    this.playBtnGraphics.fillStyle(bodyColor, 0.9);
    this.playBtnGraphics.fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    this.playBtnGraphics.lineStyle(2, borderColor, borderAlpha);
    this.playBtnGraphics.strokeRoundedRect(btnX, btnY, btnW, btnH, 10);

    // Text
    this.playBtnText.setColor(hovered ? "#ffffff" : "#ddddff");
    this.playBtnText.setScale(hovered ? 1.05 : 1.0);
  }

  private drawDiamond(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    r: number
  ): void {
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
    g.fillPath();
  }

  shutdown(): void {
    this.particles = [];
    this.floatingShapes = [];
  }
}
