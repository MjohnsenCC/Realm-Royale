import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";
import {
  CharacterClass,
  CLASS_NAMES,
} from "@rotmg-lite/shared";
import { getPlayerSpriteKey, OUTLINED_DISPLAY_SIZE } from "../ui/EntityTextures";
import {
  SERVERS,
  getSelectedServerId,
  setSelectedServerId,
} from "../network/ServerConfig";

export class GuestSetupScene extends Phaser.Scene {
  private playBtnGlowGraphics!: Phaser.GameObjects.Graphics;
  private playBtnGraphics!: Phaser.GameObjects.Graphics;
  private playBtnText!: Phaser.GameObjects.Text;
  private playBtnZone!: Phaser.GameObjects.Zone;
  private playBtnHovered = false;
  private playBtnPulsePhase = 0;
  private playBtnY = 0;
  private elapsed = 0;

  constructor() {
    super({ key: "GuestSetupScene" });
  }

  private resizeHandler?: (gameSize: Phaser.Structs.Size) => void;
  private lastWidth = 0;
  private lastHeight = 0;
  private resizeTimer?: ReturnType<typeof setTimeout>;

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Handle window resize — debounced, only on real dimension changes
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

    // ─── BACKGROUND ───
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.drawBackground(width, height);

    // ─── BACK BUTTON (with pill background) ───
    const backBtnW = 110;
    const backBtnH = 32;
    const backBtnX = 16;
    const backBtnY = 16;

    const backBtnGfx = this.add.graphics().setDepth(5);
    backBtnGfx.fillStyle(0x222244, 0.6);
    backBtnGfx.fillRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
    backBtnGfx.lineStyle(1, 0x445566, 0.5);
    backBtnGfx.strokeRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);

    const backBtn = this.add
      .text(backBtnX + backBtnW / 2, backBtnY + backBtnH / 2, "< BACK", {
        fontSize: "11px",
        color: "#8899aa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const backBtnZone = this.add
      .zone(backBtnX + backBtnW / 2, backBtnY + backBtnH / 2, backBtnW, backBtnH)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    backBtnZone.on("pointerover", () => {
      backBtnGfx.clear();
      backBtnGfx.fillStyle(0x333366, 0.7);
      backBtnGfx.fillRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
      backBtnGfx.lineStyle(1, 0x5566aa, 0.6);
      backBtnGfx.strokeRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
      backBtn.setColor("#aabbcc");
    });
    backBtnZone.on("pointerout", () => {
      backBtnGfx.clear();
      backBtnGfx.fillStyle(0x222244, 0.6);
      backBtnGfx.fillRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
      backBtnGfx.lineStyle(1, 0x445566, 0.5);
      backBtnGfx.strokeRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
      backBtn.setColor("#8899aa");
    });
    backBtnZone.on("pointerdown", () => {
      this.scene.start("MenuScene");
    });

    // ─── LAYOUT: vertically center content block ───
    const contentH = 410;
    const startY = Math.max(16, (height - contentH) / 2);

    // ─── TITLE ───
    this.add
      .text(cx, startY, "PLAY AS GUEST", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // ─── CLASS SELECTION ───
    this.add
      .text(cx, startY + 48, "SELECT CLASS", {
        fontSize: "7px",
        color: "#667788",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    let selectedClass: number = CharacterClass.Archer;

    const classOptions = [
      { id: CharacterClass.Archer, name: "ARCHER" },
      { id: CharacterClass.Warrior, name: "WARRIOR" },
      { id: CharacterClass.Arcanist, name: "ARCANIST" },
    ];

    const cardW = 140;
    const cardH = 100;
    const cardGap = 16;
    const totalCardsW = classOptions.length * cardW + (classOptions.length - 1) * cardGap;
    const cardsStartX = cx - totalCardsW / 2;
    const cardTopY = startY + 66;

    const cardGraphics = this.add.graphics().setDepth(5);

    // Create player sprite images for each class card
    const playerImages: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < classOptions.length; i++) {
      const spriteKey = getPlayerSpriteKey(classOptions[i].id);
      const img = this.add.image(0, 0, spriteKey)
        .setDepth(6)
        .setDisplaySize(OUTLINED_DISPLAY_SIZE, OUTLINED_DISPLAY_SIZE);
      playerImages.push(img);
    }

    const drawCards = () => {
      cardGraphics.clear();
      for (let i = 0; i < classOptions.length; i++) {
        const opt = classOptions[i];
        const cardX = cardsStartX + i * (cardW + cardGap);
        const isSelected = opt.id === selectedClass;

        cardGraphics.fillStyle(isSelected ? 0x2a2a55 : 0x1a1a33, 1);
        cardGraphics.fillRoundedRect(cardX, cardTopY, cardW, cardH, 6);
        cardGraphics.lineStyle(isSelected ? 2 : 1, isSelected ? 0x4488ff : 0x333355, isSelected ? 0.8 : 0.4);
        cardGraphics.strokeRoundedRect(cardX, cardTopY, cardW, cardH, 6);

        // Position player sprite
        if (playerImages[i]) {
          playerImages[i].setPosition(cardX + cardW / 2, cardTopY + 42);
          if (isSelected) {
            playerImages[i].clearTint().setAlpha(1);
          } else {
            playerImages[i].setTint(0x555577).setAlpha(0.7);
          }
        }
      }
    };

    // Text elements for each card (just class name, no equipment details)
    const cardTextElements: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < classOptions.length; i++) {
      const opt = classOptions[i];
      const cardX = cardsStartX + i * (cardW + cardGap);
      const cardCx = cardX + cardW / 2;
      const isSelected = opt.id === selectedClass;

      const nameText = this.add
        .text(cardCx, cardTopY + 82, opt.name, {
          fontSize: "8px",
          color: isSelected ? "#ffffff" : "#666688",
          fontFamily: "'Press Start 2P', monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(6);

      const zone = this.add
        .zone(cardCx, cardTopY + cardH / 2, cardW, cardH)
        .setDepth(7)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", () => {
        selectedClass = opt.id;
        updateClassCards();
      });

      cardTextElements.push(nameText);
    }

    const updateClassCards = () => {
      drawCards();
      for (let i = 0; i < classOptions.length; i++) {
        const isSelected = classOptions[i].id === selectedClass;
        cardTextElements[i].setColor(isSelected ? "#ffffff" : "#666688");
      }
    };

    drawCards();

    // ─── NAME INPUT ───
    const nameY = cardTopY + cardH + 24;

    this.add
      .text(cx, nameY, "PLAYER NAME", {
        fontSize: "6px",
        color: "#667788",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const inputHTML = `
      <input type="text" id="nameInput" maxlength="16" placeholder="Enter your name..."
        style="
          width: 240px;
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
      .dom(cx, nameY + 24)
      .createFromHTML(inputHTML)
      .setDepth(6);

    const htmlInput = inputElement.getChildByID("nameInput") as HTMLInputElement;
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

    // ─── SERVER SELECTOR (pill buttons) ───
    const serverY = nameY + 64;

    this.add
      .text(cx, serverY, "SERVER", {
        fontSize: "8px",
        color: "#8899aa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const serverBtnY = serverY + 18;
    const currentServerId = getSelectedServerId();
    const serverBtnW = 120;
    const serverBtnH = 32;
    const serverBtnGap = 12;
    const totalServerW = SERVERS.length * serverBtnW + (SERVERS.length - 1) * serverBtnGap;
    const serverStartX = cx - totalServerW / 2;

    const serverBtnGraphics = this.add.graphics().setDepth(5);
    const serverBtnTexts: Phaser.GameObjects.Text[] = [];
    const serverBtnZones: Phaser.GameObjects.Zone[] = [];

    const drawServerButtons = () => {
      serverBtnGraphics.clear();
      const selId = getSelectedServerId();
      for (let i = 0; i < SERVERS.length; i++) {
        const btnX = serverStartX + i * (serverBtnW + serverBtnGap);
        const isSel = SERVERS[i].id === selId;

        serverBtnGraphics.fillStyle(isSel ? 0x222255 : 0x1a1a33, 1);
        serverBtnGraphics.fillRoundedRect(btnX, serverBtnY, serverBtnW, serverBtnH, 6);
        serverBtnGraphics.lineStyle(isSel ? 2 : 1, isSel ? 0x4488ff : 0x333355, isSel ? 0.8 : 0.4);
        serverBtnGraphics.strokeRoundedRect(btnX, serverBtnY, serverBtnW, serverBtnH, 6);

        if (serverBtnTexts[i]) {
          serverBtnTexts[i].setColor(isSel ? "#4488ff" : "#667788");
          serverBtnTexts[i].setFontStyle(isSel ? "bold" : "");
        }
      }
    };

    for (let i = 0; i < SERVERS.length; i++) {
      const server = SERVERS[i];
      const btnX = serverStartX + i * (serverBtnW + serverBtnGap);
      const btnCx = btnX + serverBtnW / 2;
      const btnCy = serverBtnY + serverBtnH / 2;

      const txt = this.add
        .text(btnCx, btnCy, server.name, {
          fontSize: "9px",
          color: server.id === currentServerId ? "#4488ff" : "#667788",
          fontFamily: "'Press Start 2P', monospace",
          fontStyle: server.id === currentServerId ? "bold" : "",
        })
        .setOrigin(0.5)
        .setDepth(6);
      serverBtnTexts.push(txt);

      const zone = this.add
        .zone(btnCx, btnCy, serverBtnW, serverBtnH)
        .setDepth(7)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", () => {
        setSelectedServerId(server.id);
        drawServerButtons();
      });
      zone.on("pointerover", () => {
        if (getSelectedServerId() !== server.id) {
          serverBtnTexts[i].setColor("#8888aa");
        }
      });
      zone.on("pointerout", () => {
        serverBtnTexts[i].setColor(
          getSelectedServerId() === server.id ? "#4488ff" : "#667788"
        );
      });
      serverBtnZones.push(zone);
    }

    drawServerButtons();

    // ─── PLAY BUTTON ───
    const playBtnW = 220;
    const playBtnH = 52;
    this.playBtnY = serverBtnY + serverBtnH + 20;

    this.playBtnGlowGraphics = this.add.graphics().setDepth(7);
    this.playBtnGraphics = this.add.graphics().setDepth(8);

    this.playBtnText = this.add
      .text(cx, this.playBtnY + playBtnH / 2, "PLAY", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
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
        fontSize: "8px",
        color: "#aaaaaa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Connect handler
    this.playBtnZone.on("pointerdown", async () => {
      this.playBtnZone.disableInteractive();
      statusText.setText("Connecting...");

      htmlInput?.blur();
      if (this.input.keyboard) this.input.keyboard.enabled = true;

      const rawName = (htmlInput?.value?.trim() ?? "").replace(/\s+/g, "");
      const playerName = rawName.length > 0 ? rawName : "Player";

      try {
        const network = NetworkManager.getInstance();
        await network.joinGame({ name: playerName, characterClass: selectedClass });
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

    // ─── FADE IN ───
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
    this.elapsed += dt;

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

  private drawBackground(width: number, height: number) {
    // Grid background
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

    // Vignette
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
