import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";
import {
  CharacterClass,
  CLASS_NAMES,
  CLASS_EQUIPMENT_MAP,
  ItemCategory,
  getSubtypeName,
} from "@rotmg-lite/shared";
import { drawItemIcon } from "../ui/ItemIcons";
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

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // ─── BACKGROUND ───
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.drawBackground(width, height);

    // ─── BACK BUTTON ───
    const backBtn = this.add
      .text(20, 20, "< BACK", {
        fontSize: "14px",
        color: "#667788",
        fontFamily: "monospace",
      })
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#aaaacc"));
    backBtn.on("pointerout", () => backBtn.setColor("#667788"));
    backBtn.on("pointerdown", () => {
      this.scene.start("MenuScene");
    });

    // ─── TITLE ───
    this.add
      .text(cx, height * 0.08, "PLAY AS GUEST", {
        fontSize: "32px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // ─── CLASS SELECTION ───
    this.add
      .text(cx, height * 0.16, "SELECT CLASS", {
        fontSize: "11px",
        color: "#667788",
        fontFamily: "monospace",
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
    const cardH = 120;
    const cardGap = 16;
    const totalCardsW = classOptions.length * cardW + (classOptions.length - 1) * cardGap;
    const cardsStartX = cx - totalCardsW / 2;
    const cardTopY = height * 0.19;

    const cardGraphics = this.add.graphics().setDepth(5);

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

        const equip = CLASS_EQUIPMENT_MAP[opt.id];
        const iconColor = isSelected ? 0x4488ff : 0x555577;
        drawItemIcon(cardGraphics, cardX + cardW / 2, cardTopY + 48, 28, ItemCategory.Weapon, equip.weapon, iconColor);
      }
    };

    // Text elements for each card
    const cardTextElements: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < classOptions.length; i++) {
      const opt = classOptions[i];
      const cardX = cardsStartX + i * (cardW + cardGap);
      const cardCx = cardX + cardW / 2;
      const equip = CLASS_EQUIPMENT_MAP[opt.id];
      const isSelected = opt.id === selectedClass;

      const nameText = this.add
        .text(cardCx, cardTopY + 16, opt.name, {
          fontSize: "14px",
          color: isSelected ? "#ffffff" : "#666688",
          fontFamily: "monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(6);

      const weaponName = getSubtypeName(ItemCategory.Weapon, equip.weapon);
      const abilityName = getSubtypeName(ItemCategory.Ability, equip.ability);
      const info1Text = this.add
        .text(cardCx, cardTopY + 78, `${weaponName} · ${abilityName}`, {
          fontSize: "10px",
          color: isSelected ? "#8888aa" : "#555566",
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(6);

      const armorName = getSubtypeName(ItemCategory.Armor, equip.armor);
      const info2Text = this.add
        .text(cardCx, cardTopY + 94, armorName, {
          fontSize: "10px",
          color: isSelected ? "#8888aa" : "#555566",
          fontFamily: "monospace",
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

      cardTextElements.push(nameText, info1Text, info2Text);
    }

    const updateClassCards = () => {
      drawCards();
      for (let i = 0; i < classOptions.length; i++) {
        const isSelected = classOptions[i].id === selectedClass;
        const base = i * 3;
        cardTextElements[base].setColor(isSelected ? "#ffffff" : "#666688");
        cardTextElements[base + 1].setColor(isSelected ? "#8888aa" : "#555566");
        cardTextElements[base + 2].setColor(isSelected ? "#8888aa" : "#555566");
      }
    };

    drawCards();

    // ─── NAME INPUT ───
    const nameY = cardTopY + cardH + 30;

    this.add
      .text(cx, nameY, "PLAYER NAME", {
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
      .dom(cx, nameY + 24)
      .createFromHTML(inputHTML)
      .setDepth(6);

    const htmlInput = inputElement.getChildByID("nameInput") as HTMLInputElement;
    if (htmlInput) {
      htmlInput.addEventListener("focus", () => {
        if (this.input.keyboard) this.input.keyboard.enabled = false;
      });
      htmlInput.addEventListener("blur", () => {
        if (this.input.keyboard) this.input.keyboard.enabled = true;
      });
    }

    // ─── SERVER SELECTOR (compact) ───
    const serverY = nameY + 72;

    this.add
      .text(cx, serverY, "SERVER", {
        fontSize: "10px",
        color: "#667788",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const serverBtnY = serverY + 16;
    const currentServerId = getSelectedServerId();
    const serverButtons: Phaser.GameObjects.Text[] = [];
    const totalServerBtnWidth = 140;
    const serverBtnSpacing = totalServerBtnWidth / SERVERS.length;
    const serverStartX = cx - totalServerBtnWidth / 2 + serverBtnSpacing / 2;

    for (let i = 0; i < SERVERS.length; i++) {
      const server = SERVERS[i];
      const btn = this.add
        .text(serverStartX + i * serverBtnSpacing, serverBtnY, server.name, {
          fontSize: "13px",
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

    // ─── PLAY BUTTON ───
    const playBtnW = 220;
    const playBtnH = 52;
    this.playBtnY = serverBtnY + 35;

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

    // ─── CONTROLS HINT & VERSION ───
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
