import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";

interface Particle {
  graphics: Phaser.GameObjects.Graphics;
  vy: number;
}

export class MenuScene extends Phaser.Scene {
  private particles: Particle[] = [];

  constructor() {
    super({ key: "MenuScene" });
  }

  create() {
    const { width, height } = this.scale;

    // Background floating particles
    for (let i = 0; i < 30; i++) {
      const g = this.add.graphics();
      const size = 2 + Math.random() * 3;
      const alpha = 0.1 + Math.random() * 0.3;
      g.fillStyle(0x4488ff, alpha);
      g.fillCircle(0, 0, size);
      g.setPosition(Math.random() * width, Math.random() * height);
      g.setScrollFactor(0);
      this.particles.push({ graphics: g, vy: -(10 + Math.random() * 20) });
    }

    // Title glow (behind)
    this.add
      .text(width / 2, height / 4, "Realm Royale", {
        fontSize: "56px",
        color: "#4488ff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0.3);

    // Title
    this.add
      .text(width / 2, height / 4, "Realm Royale", {
        fontSize: "52px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, height / 4 + 55, "Multiplayer Top-Down Shooter", {
        fontSize: "16px",
        color: "#666688",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Name input (HTML via Phaser DOM)
    const inputHTML = `
      <input type="text" id="nameInput" maxlength="16" placeholder="Enter your name..."
        style="
          width: 240px;
          padding: 10px 16px;
          font-size: 18px;
          font-family: monospace;
          background: #16213e;
          border: 2px solid #4488ff;
          border-radius: 6px;
          color: #ffffff;
          text-align: center;
          outline: none;
        "
      />
    `;
    const inputElement = this.add
      .dom(width / 2, height / 2 - 10)
      .createFromHTML(inputHTML);

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

    // Play button
    const playBtn = this.add
      .text(width / 2, height / 2 + 60, "[ PLAY ]", {
        fontSize: "32px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Status text
    const statusText = this.add
      .text(width / 2, height / 2 + 110, "", {
        fontSize: "16px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Hover effects
    playBtn.on("pointerover", () => playBtn.setColor("#4488ff"));
    playBtn.on("pointerout", () => playBtn.setColor("#ffffff"));

    // Connect handler
    playBtn.on("pointerdown", async () => {
      playBtn.disableInteractive();
      statusText.setText("Connecting...");

      // Blur input and re-enable keyboard before transitioning
      htmlInput?.blur();
      if (this.input.keyboard) this.input.keyboard.enabled = true;

      const rawName = htmlInput?.value?.trim() ?? "";
      const playerName = rawName.length > 0 ? rawName : "Player";

      try {
        const network = NetworkManager.getInstance();
        await network.joinGame(playerName);
        statusText.setText("Connected!");
        this.scene.start("GameScene");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        statusText.setText(`Error: ${message}`);
        playBtn.setInteractive({ useHandCursor: true });
      }
    });

    // Controls hint
    this.add
      .text(
        width / 2,
        height - 30,
        "WASD move | Mouse aim | Click shoot | Q return to nexus",
        {
          fontSize: "12px",
          color: "#444466",
          fontFamily: "monospace",
        }
      )
      .setOrigin(0.5);
  }

  update(_time: number, delta: number): void {
    const { width, height } = this.scale;
    for (const p of this.particles) {
      p.graphics.y += p.vy * (delta / 1000);
      if (p.graphics.y < -10) {
        p.graphics.y = height + 10;
        p.graphics.x = Math.random() * width;
      }
    }
  }
}
