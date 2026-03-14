import Phaser from "phaser";
import { AuthManager } from "../auth/AuthManager";

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

    // ─── 6. SIGN IN WITH GOOGLE ───
    const btnW = 240;
    const btnH = 44;
    const googleBtnY = height * 0.42;

    const googleBtnGfx = this.add.graphics().setDepth(5);
    googleBtnGfx.fillStyle(0x222244, 0.9);
    googleBtnGfx.fillRoundedRect(cx - btnW / 2, googleBtnY, btnW, btnH, 6);
    googleBtnGfx.lineStyle(1, 0x4488ff, 0.4);
    googleBtnGfx.strokeRoundedRect(cx - btnW / 2, googleBtnY, btnW, btnH, 6);

    const googleBtnText = this.add
      .text(cx, googleBtnY + btnH / 2, "SIGN IN WITH GOOGLE", {
        fontSize: "15px",
        color: "#4488ff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const googleBtnZone = this.add
      .zone(cx, googleBtnY + btnH / 2, btnW, btnH)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    googleBtnZone.on("pointerover", () => {
      googleBtnGfx.clear();
      googleBtnGfx.fillStyle(0x333366, 0.9);
      googleBtnGfx.fillRoundedRect(cx - btnW / 2, googleBtnY, btnW, btnH, 6);
      googleBtnGfx.lineStyle(1, 0x4488ff, 0.7);
      googleBtnGfx.strokeRoundedRect(cx - btnW / 2, googleBtnY, btnW, btnH, 6);
      googleBtnText.setColor("#66aaff");
    });
    googleBtnZone.on("pointerout", () => {
      googleBtnGfx.clear();
      googleBtnGfx.fillStyle(0x222244, 0.9);
      googleBtnGfx.fillRoundedRect(cx - btnW / 2, googleBtnY, btnW, btnH, 6);
      googleBtnGfx.lineStyle(1, 0x4488ff, 0.4);
      googleBtnGfx.strokeRoundedRect(cx - btnW / 2, googleBtnY, btnW, btnH, 6);
      googleBtnText.setColor("#4488ff");
    });
    googleBtnZone.on("pointerdown", () => {
      window.location.href = "/auth/google";
    });

    // ─── 7. DIVIDER ───
    this.add
      .text(cx, googleBtnY + btnH + 18, "— or —", {
        fontSize: "11px",
        color: "#445566",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // ─── 8. PLAY AS GUEST BUTTON ───
    const guestBtnY = googleBtnY + btnH + 40;

    const guestBtnGfx = this.add.graphics().setDepth(5);
    guestBtnGfx.fillStyle(0x222244, 0.9);
    guestBtnGfx.fillRoundedRect(cx - btnW / 2, guestBtnY, btnW, btnH, 6);
    guestBtnGfx.lineStyle(1, 0x4488ff, 0.4);
    guestBtnGfx.strokeRoundedRect(cx - btnW / 2, guestBtnY, btnW, btnH, 6);

    const guestBtnText = this.add
      .text(cx, guestBtnY + btnH / 2, "PLAY AS GUEST", {
        fontSize: "15px",
        color: "#4488ff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const guestBtnZone = this.add
      .zone(cx, guestBtnY + btnH / 2, btnW, btnH)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    guestBtnZone.on("pointerover", () => {
      guestBtnGfx.clear();
      guestBtnGfx.fillStyle(0x333366, 0.9);
      guestBtnGfx.fillRoundedRect(cx - btnW / 2, guestBtnY, btnW, btnH, 6);
      guestBtnGfx.lineStyle(1, 0x4488ff, 0.7);
      guestBtnGfx.strokeRoundedRect(cx - btnW / 2, guestBtnY, btnW, btnH, 6);
      guestBtnText.setColor("#66aaff");
    });
    guestBtnZone.on("pointerout", () => {
      guestBtnGfx.clear();
      guestBtnGfx.fillStyle(0x222244, 0.9);
      guestBtnGfx.fillRoundedRect(cx - btnW / 2, guestBtnY, btnW, btnH, 6);
      guestBtnGfx.lineStyle(1, 0x4488ff, 0.4);
      guestBtnGfx.strokeRoundedRect(cx - btnW / 2, guestBtnY, btnW, btnH, 6);
      guestBtnText.setColor("#4488ff");
    });
    guestBtnZone.on("pointerdown", () => {
      // Fade out transition to guest setup
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
          this.scene.start("GuestSetupScene");
        },
      });
    });

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
