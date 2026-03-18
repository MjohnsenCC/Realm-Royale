import Phaser from "phaser";
import { AuthManager } from "../auth/AuthManager";
import { NetworkManager } from "../network/NetworkManager";
import {
  CharacterSummary,
  MAX_CHARACTERS_PER_ACCOUNT,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_NAME_MIN_LENGTH,
  CharacterClass,
  CLASS_NAMES,
} from "@rotmg-lite/shared";
import { getPlayerSpriteKey, OUTLINED_DISPLAY_SIZE } from "../ui/EntityTextures";
import {
  SERVERS,
  getSelectedServerId,
  setSelectedServerId,
} from "../network/ServerConfig";

export class CharacterSelectScene extends Phaser.Scene {
  private characters: CharacterSummary[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private characterContainer!: Phaser.GameObjects.Container;
  private currentIndex: number = 0;
  private leftArrow!: Phaser.GameObjects.Text;
  private rightArrow!: Phaser.GameObjects.Text;
  private slotIndicator!: Phaser.GameObjects.Text;
  private resizeHandler?: (gameSize: Phaser.Structs.Size) => void;
  private lastWidth = 0;
  private lastHeight = 0;
  private resizeTimer?: ReturnType<typeof setTimeout>;
  private dialogOpen = false;

  constructor() {
    super({ key: "CharacterSelectScene" });
  }

  async create(data?: { characters?: CharacterSummary[]; currentIndex?: number }) {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Restore cached data if restarting from resize
    if (data?.characters) {
      this.characters = data.characters;
      this.currentIndex = data.currentIndex ?? 0;
    }

    // Handle window resize — debounced, only on real dimension changes
    this.lastWidth = width;
    this.lastHeight = height;
    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      if (this.dialogOpen) return;
      const newW = gameSize.width;
      const newH = gameSize.height;
      if (Math.abs(newW - this.lastWidth) < 2 && Math.abs(newH - this.lastHeight) < 2) return;
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.scale.off("resize", this.resizeHandler!);
        this.scene.restart({ characters: this.characters, currentIndex: this.currentIndex });
      }, 200);
    };
    this.scale.on("resize", this.resizeHandler);
    this.events.once("shutdown", this.shutdown, this);

    // Background
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.drawBackground(width, height);

    // ─── LOGOUT BUTTON (top-right, pill) ───
    const logoutBtnW = 120;
    const logoutBtnH = 32;
    const logoutBtnX = width - logoutBtnW - 16;
    const logoutBtnY = 16;

    const logoutBtnGfx = this.add.graphics().setDepth(5);
    logoutBtnGfx.fillStyle(0x441111, 0.6);
    logoutBtnGfx.fillRoundedRect(logoutBtnX, logoutBtnY, logoutBtnW, logoutBtnH, 6);
    logoutBtnGfx.lineStyle(1, 0x664444, 0.5);
    logoutBtnGfx.strokeRoundedRect(logoutBtnX, logoutBtnY, logoutBtnW, logoutBtnH, 6);

    const logoutBtnText = this.add
      .text(logoutBtnX + logoutBtnW / 2, logoutBtnY + logoutBtnH / 2, "LOG OUT", {
        fontSize: "11px",
        color: "#aa6666",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const logoutBtnZone = this.add
      .zone(logoutBtnX + logoutBtnW / 2, logoutBtnY + logoutBtnH / 2, logoutBtnW, logoutBtnH)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    logoutBtnZone.on("pointerover", () => {
      logoutBtnGfx.clear();
      logoutBtnGfx.fillStyle(0x662222, 0.7);
      logoutBtnGfx.fillRoundedRect(logoutBtnX, logoutBtnY, logoutBtnW, logoutBtnH, 6);
      logoutBtnGfx.lineStyle(1, 0x884444, 0.6);
      logoutBtnGfx.strokeRoundedRect(logoutBtnX, logoutBtnY, logoutBtnW, logoutBtnH, 6);
      logoutBtnText.setColor("#ff6666");
    });
    logoutBtnZone.on("pointerout", () => {
      logoutBtnGfx.clear();
      logoutBtnGfx.fillStyle(0x441111, 0.6);
      logoutBtnGfx.fillRoundedRect(logoutBtnX, logoutBtnY, logoutBtnW, logoutBtnH, 6);
      logoutBtnGfx.lineStyle(1, 0x664444, 0.5);
      logoutBtnGfx.strokeRoundedRect(logoutBtnX, logoutBtnY, logoutBtnW, logoutBtnH, 6);
      logoutBtnText.setColor("#aa6666");
    });
    logoutBtnZone.on("pointerdown", () => {
      AuthManager.getInstance().logout();
      this.scene.start("MenuScene");
    });

    // Title
    this.add
      .text(cx, height * 0.1, "SELECT CHARACTER", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Status text
    this.statusText = this.add
      .text(cx, height * 0.17, "", {
        fontSize: "8px",
        color: "#aaaaaa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Character display container
    this.characterContainer = this.add.container(0, 0).setDepth(5);

    // Compute the vertical center of the card area:
    // Available area is between header (height * 0.20) and server panel top (height - 104)
    const areaTop = height * 0.20;
    const areaBottom = height - 120;
    const cardH = 260;
    const areaCenterY = (areaTop + areaBottom) / 2;

    // Navigation arrows — vertically centered in the card area
    this.leftArrow = this.add
      .text(cx - 200, areaCenterY, "<", {
        fontSize: "24px",
        color: "#4488ff",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });

    this.rightArrow = this.add
      .text(cx + 200, areaCenterY, ">", {
        fontSize: "24px",
        color: "#4488ff",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });

    this.leftArrow.on("pointerdown", () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.renderCurrentCard();
      }
    });
    this.leftArrow.on("pointerover", () => {
      if (this.currentIndex > 0) this.leftArrow.setColor("#66aaff");
    });
    this.leftArrow.on("pointerout", () => {
      this.leftArrow.setColor(this.currentIndex > 0 ? "#4488ff" : "#222244");
    });

    this.rightArrow.on("pointerdown", () => {
      if (this.currentIndex < MAX_CHARACTERS_PER_ACCOUNT - 1) {
        this.currentIndex++;
        this.renderCurrentCard();
      }
    });
    this.rightArrow.on("pointerover", () => {
      if (this.currentIndex < MAX_CHARACTERS_PER_ACCOUNT - 1) this.rightArrow.setColor("#66aaff");
    });
    this.rightArrow.on("pointerout", () => {
      this.rightArrow.setColor(this.currentIndex < MAX_CHARACTERS_PER_ACCOUNT - 1 ? "#4488ff" : "#222244");
    });

    // Slot indicator — below the card
    this.slotIndicator = this.add
      .text(cx, areaCenterY + cardH / 2 + 16, "", {
        fontSize: "8px",
        color: "#667788",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Server selector
    this.drawServerSelector(cx, width, height);

    // Load characters (or render from cache if we already have them)
    if (data?.characters) {
      this.renderCurrentCard();
    } else {
      await this.loadCharacters();
    }
  }

  shutdown() {
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
    }
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
  }

  private async loadCharacters() {
    this.statusText.setText("Loading...");
    try {
      const auth = AuthManager.getInstance();

      // Check if account name is set; redirect to setup if not
      const accountName = await auth.fetchAccountName();
      if (!accountName) {
        this.scene.start("AccountSetupScene");
        return;
      }

      this.characters = await auth.fetchCharacters();
      this.statusText.setText("");
      this.renderCurrentCard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      this.statusText.setText(`Error: ${msg}`);
      if (msg === "Session expired") {
        this.time.delayedCall(1500, () => this.scene.start("MenuScene"));
      }
    }
  }

  private renderCurrentCard() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Clear existing card
    this.characterContainer.removeAll(true);

    // Update arrows
    this.leftArrow.setColor(this.currentIndex > 0 ? "#4488ff" : "#222244");
    this.rightArrow.setColor(this.currentIndex < MAX_CHARACTERS_PER_ACCOUNT - 1 ? "#4488ff" : "#222244");

    // Update slot indicator
    this.slotIndicator.setText(`${this.currentIndex + 1} / ${MAX_CHARACTERS_PER_ACCOUNT}`);

    const cardW = 300;
    const cardH = 260;
    // Center the card in the available area (same math as arrows)
    const areaTop = height * 0.20;
    const areaBottom = height - 120;
    const areaCenterY = (areaTop + areaBottom) / 2;
    const cardY = areaCenterY - cardH / 2;
    const cardX = cx - cardW / 2;

    if (this.currentIndex < this.characters.length) {
      // Existing character card
      const char = this.characters[this.currentIndex];
      this.renderCharacterCard(cx, cardX, cardY, cardW, cardH, char);
    } else {
      // Empty slot — create character card
      this.renderCreateSlot(cx, cardX, cardY, cardW, cardH);
    }
  }

  private renderCharacterCard(
    cx: number,
    cardX: number,
    cardY: number,
    cardW: number,
    cardH: number,
    char: CharacterSummary
  ) {
    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 0.9);
    bg.fillRoundedRect(cardX, cardY, cardW, cardH, 8);
    bg.lineStyle(1, 0x4488ff, 0.4);
    bg.strokeRoundedRect(cardX, cardY, cardW, cardH, 8);

    // Delete button (top-right of card)
    const delBtn = this.add
      .text(cardX + cardW - 14, cardY + 14, "DELETE", {
        fontSize: "7px",
        color: "#664444",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(1, 0)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    delBtn.on("pointerover", () => delBtn.setColor("#ff4444"));
    delBtn.on("pointerout", () => delBtn.setColor("#664444"));
    delBtn.on("pointerdown", () => this.confirmDeleteCharacter(char));

    // Player sprite with outline
    const spriteKey = getPlayerSpriteKey(char.characterClass);
    const sprite = this.add.image(cx, cardY + 70, spriteKey)
      .setDisplaySize(OUTLINED_DISPLAY_SIZE, OUTLINED_DISPLAY_SIZE)
      .setDepth(6);

    // Character name
    const nameText = this.add
      .text(cx, cardY + 115, char.name, {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Level and class
    const className = CLASS_NAMES[char.characterClass] ?? "Unknown";
    const levelText = this.add
      .text(cx, cardY + 142, `Level ${char.level} ${className}`, {
        fontSize: "9px",
        color: "#8888aa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Last played
    const lastPlayed = this.formatLastPlayed(char.lastPlayed);
    const lastPlayedText = this.add
      .text(cx, cardY + 164, lastPlayed, {
        fontSize: "7px",
        color: "#666688",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // PLAY button
    const playBtnW = 180;
    const playBtnH = 40;
    const playBtnX = cx - playBtnW / 2;
    const playBtnY = cardY + cardH - playBtnH - 20;

    const playBtnGfx = this.add.graphics().setDepth(6);
    playBtnGfx.fillStyle(0x224433, 0.9);
    playBtnGfx.fillRoundedRect(playBtnX, playBtnY, playBtnW, playBtnH, 6);
    playBtnGfx.lineStyle(2, 0x44ff88, 0.6);
    playBtnGfx.strokeRoundedRect(playBtnX, playBtnY, playBtnW, playBtnH, 6);

    const playBtnText = this.add
      .text(cx, playBtnY + playBtnH / 2, "PLAY", {
        fontSize: "12px",
        color: "#44ff88",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(7);

    const playBtnZone = this.add
      .zone(cx, playBtnY + playBtnH / 2, playBtnW, playBtnH)
      .setDepth(8)
      .setInteractive({ useHandCursor: true });

    playBtnZone.on("pointerover", () => {
      playBtnGfx.clear();
      playBtnGfx.fillStyle(0x335544, 0.9);
      playBtnGfx.fillRoundedRect(playBtnX, playBtnY, playBtnW, playBtnH, 6);
      playBtnGfx.lineStyle(2, 0x66ffaa, 0.8);
      playBtnGfx.strokeRoundedRect(playBtnX, playBtnY, playBtnW, playBtnH, 6);
      playBtnText.setColor("#66ffaa");
    });
    playBtnZone.on("pointerout", () => {
      playBtnGfx.clear();
      playBtnGfx.fillStyle(0x224433, 0.9);
      playBtnGfx.fillRoundedRect(playBtnX, playBtnY, playBtnW, playBtnH, 6);
      playBtnGfx.lineStyle(2, 0x44ff88, 0.6);
      playBtnGfx.strokeRoundedRect(playBtnX, playBtnY, playBtnW, playBtnH, 6);
      playBtnText.setColor("#44ff88");
    });
    playBtnZone.on("pointerdown", () => this.selectCharacter(char.id));

    this.characterContainer.add([
      bg, delBtn, sprite, nameText, levelText, lastPlayedText,
      playBtnGfx, playBtnText, playBtnZone,
    ]);
  }

  private renderCreateSlot(
    cx: number,
    cardX: number,
    cardY: number,
    cardW: number,
    cardH: number
  ) {
    const bg = this.add.graphics();
    const dashLen = 8;
    const gapLen = 6;

    const drawDashedCard = (fillColor: number, fillAlpha: number, lineAlpha: number) => {
      bg.clear();
      bg.fillStyle(fillColor, fillAlpha);
      bg.fillRoundedRect(cardX, cardY, cardW, cardH, 8);
      bg.lineStyle(1, 0x4488ff, lineAlpha);
      // Top edge
      for (let x = cardX + 8; x < cardX + cardW - 8; x += dashLen + gapLen) {
        bg.beginPath();
        bg.moveTo(x, cardY);
        bg.lineTo(Math.min(x + dashLen, cardX + cardW - 8), cardY);
        bg.strokePath();
      }
      // Bottom edge
      for (let x = cardX + 8; x < cardX + cardW - 8; x += dashLen + gapLen) {
        bg.beginPath();
        bg.moveTo(x, cardY + cardH);
        bg.lineTo(Math.min(x + dashLen, cardX + cardW - 8), cardY + cardH);
        bg.strokePath();
      }
      // Left edge
      for (let y = cardY + 8; y < cardY + cardH - 8; y += dashLen + gapLen) {
        bg.beginPath();
        bg.moveTo(cardX, y);
        bg.lineTo(cardX, Math.min(y + dashLen, cardY + cardH - 8));
        bg.strokePath();
      }
      // Right edge
      for (let y = cardY + 8; y < cardY + cardH - 8; y += dashLen + gapLen) {
        bg.beginPath();
        bg.moveTo(cardX + cardW, y);
        bg.lineTo(cardX + cardW, Math.min(y + dashLen, cardY + cardH - 8));
        bg.strokePath();
      }
    };

    drawDashedCard(0x1a1a33, 0.5, 0.25);

    // Plus icon
    const plusText = this.add
      .text(cx, cardY + cardH / 2 - 20, "+", {
        fontSize: "32px",
        color: "#4488ff",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Create label
    const createLabel = this.add
      .text(cx, cardY + cardH / 2 + 24, "CREATE CHARACTER", {
        fontSize: "10px",
        color: "#4488ff",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Interactive zone for entire card
    const zone = this.add
      .zone(cx, cardY + cardH / 2, cardW, cardH)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    zone.on("pointerover", () => {
      drawDashedCard(0x222255, 0.6, 0.4);
      plusText.setColor("#66aaff");
      createLabel.setColor("#66aaff");
    });
    zone.on("pointerout", () => {
      drawDashedCard(0x1a1a33, 0.5, 0.25);
      plusText.setColor("#4488ff");
      createLabel.setColor("#4488ff");
    });
    zone.on("pointerdown", () => this.showCreateCharacterInput());

    this.characterContainer.add([bg, plusText, createLabel, zone]);
  }

  private showCreateCharacterInput() {
    if (this.dialogOpen) return;
    this.dialogOpen = true;
    const { width, height } = this.scale;
    const cx = width / 2;

    // Overlay
    const overlay = this.add.graphics().setDepth(20);
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

    // Dialog box
    const dialogW = 500;
    const dialogH = 340;
    const dialogX = cx - dialogW / 2;
    const dialogY = height / 2 - dialogH / 2;

    const dialogBg = this.add.graphics().setDepth(21);
    dialogBg.fillStyle(0x1a1a33, 1);
    dialogBg.fillRoundedRect(dialogX, dialogY, dialogW, dialogH, 8);
    dialogBg.lineStyle(1, 0x4488ff, 0.5);
    dialogBg.strokeRoundedRect(dialogX, dialogY, dialogW, dialogH, 8);

    const title = this.add
      .text(cx, dialogY + 25, "CREATE CHARACTER", {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22);

    // Class selector
    let selectedClass: number = CharacterClass.Archer;
    const classLabel = this.add
      .text(cx, dialogY + 52, "SELECT CLASS", {
        fontSize: "7px",
        color: "#667788",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const classOptions = [
      { id: CharacterClass.Archer, name: "ARCHER" },
      { id: CharacterClass.Warrior, name: "WARRIOR" },
      { id: CharacterClass.Arcanist, name: "ARCANIST" },
    ];

    // Class cards with player sprites
    const cardW = 140;
    const cardH = 100;
    const cardGap = 16;
    const totalCardsW = classOptions.length * cardW + (classOptions.length - 1) * cardGap;
    const cardsStartX = cx - totalCardsW / 2;
    const cardTopY = dialogY + 68;

    const cardGraphics = this.add.graphics().setDepth(21);
    const cardElements: Phaser.GameObjects.GameObject[] = [cardGraphics];

    // Create player sprite images for each class card
    const playerImages: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < classOptions.length; i++) {
      const spriteKey = getPlayerSpriteKey(classOptions[i].id);
      const img = this.add.image(0, 0, spriteKey)
        .setDepth(22)
        .setDisplaySize(OUTLINED_DISPLAY_SIZE, OUTLINED_DISPLAY_SIZE);
      playerImages.push(img);
      cardElements.push(img);
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
          playerImages[i].setPosition(cardX + cardW / 2, cardTopY + 40);
          if (isSelected) {
            playerImages[i].clearTint().setAlpha(1);
          } else {
            playerImages[i].setTint(0x555577).setAlpha(0.7);
          }
        }
      }
    };

    // Text elements for each card (class name only)
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
        .setDepth(22);

      const zone = this.add
        .zone(cardCx, cardTopY + cardH / 2, cardW, cardH)
        .setDepth(23)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", () => {
        selectedClass = opt.id;
        updateClassCards();
      });

      cardTextElements.push(nameText);
      cardElements.push(nameText, zone);
    }

    const updateClassCards = () => {
      drawCards();
      for (let i = 0; i < classOptions.length; i++) {
        const isSelected = classOptions[i].id === selectedClass;
        cardTextElements[i].setColor(isSelected ? "#ffffff" : "#666688");
      }
    };

    drawCards();

    // Name input
    const inputHTML = `
      <input type="text" id="charNameInput" maxlength="${CHARACTER_NAME_MAX_LENGTH}" placeholder="Character name..."
        style="
          width: 220px;
          padding: 10px 16px;
          font-size: 14px;
          font-family: 'Press Start 2P', monospace;
          background: rgba(22, 33, 62, 0.9);
          border: 1px solid rgba(68, 136, 255, 0.5);
          border-radius: 6px;
          color: #ffffff;
          text-align: center;
          outline: none;
        "
      />
    `;
    const inputElement = this.add
      .dom(cx, dialogY + 200)
      .createFromHTML(inputHTML)
      .setDepth(22);

    const htmlInput = inputElement.getChildByID("charNameInput") as HTMLInputElement;
    if (htmlInput) {
      htmlInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
      });
      htmlInput.addEventListener("keyup", (e) => {
        e.stopPropagation();
      });
      this.time.delayedCall(100, () => htmlInput.focus());
    }

    const errorText = this.add
      .text(cx, dialogY + 235, "", {
        fontSize: "7px",
        color: "#ff4444",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    // Buttons
    const confirmBtn = this.add
      .text(cx - 50, dialogY + 280, "CREATE", {
        fontSize: "10px",
        color: "#44ff88",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cancelBtn = this.add
      .text(cx + 50, dialogY + 280, "CANCEL", {
        fontSize: "10px",
        color: "#aa6666",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cleanup = () => {
      this.dialogOpen = false;
      overlay.destroy();
      dialogBg.destroy();
      title.destroy();
      classLabel.destroy();
      for (const el of cardElements) el.destroy();
      inputElement.destroy();
      errorText.destroy();
      confirmBtn.destroy();
      cancelBtn.destroy();
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    };

    cancelBtn.on("pointerdown", cleanup);

    confirmBtn.on("pointerdown", async () => {
      const name = htmlInput?.value?.trim() ?? "";
      if (name.length < CHARACTER_NAME_MIN_LENGTH) {
        errorText.setText(`Name must be at least ${CHARACTER_NAME_MIN_LENGTH} characters`);
        return;
      }

      confirmBtn.disableInteractive();
      errorText.setText("");
      try {
        await AuthManager.getInstance().createCharacter(name, selectedClass);
        cleanup();
        await this.loadCharacters();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create";
        errorText.setText(msg);
        confirmBtn.setInteractive({ useHandCursor: true });
      }
    });
  }

  private confirmDeleteCharacter(char: CharacterSummary) {
    if (this.dialogOpen) return;
    this.dialogOpen = true;
    const { width, height } = this.scale;
    const cx = width / 2;

    const overlay = this.add.graphics().setDepth(20);
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

    const dialogW = 320;
    const dialogH = 140;
    const dialogX = cx - dialogW / 2;
    const dialogY = height / 2 - dialogH / 2;

    const dialogBg = this.add.graphics().setDepth(21);
    dialogBg.fillStyle(0x1a1a33, 1);
    dialogBg.fillRoundedRect(dialogX, dialogY, dialogW, dialogH, 8);
    dialogBg.lineStyle(1, 0xff4444, 0.5);
    dialogBg.strokeRoundedRect(dialogX, dialogY, dialogW, dialogH, 8);

    const title = this.add
      .text(cx, dialogY + 25, "DELETE CHARACTER", {
        fontSize: "10px",
        color: "#ff4444",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const msg = this.add
      .text(cx, dialogY + 55, `Delete "${char.name}" (Lv.${char.level})?`, {
        fontSize: "8px",
        color: "#cccccc",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const errorText = this.add
      .text(cx, dialogY + 78, "", {
        fontSize: "7px",
        color: "#ff4444",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const confirmBtn = this.add
      .text(cx - 50, dialogY + 110, "DELETE", {
        fontSize: "10px",
        color: "#ff4444",
        fontFamily: "'Press Start 2P', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cancelBtn = this.add
      .text(cx + 50, dialogY + 110, "CANCEL", {
        fontSize: "10px",
        color: "#aaaaaa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cleanup = () => {
      this.dialogOpen = false;
      overlay.destroy();
      dialogBg.destroy();
      title.destroy();
      msg.destroy();
      errorText.destroy();
      confirmBtn.destroy();
      cancelBtn.destroy();
    };

    cancelBtn.on("pointerdown", cleanup);

    confirmBtn.on("pointerdown", async () => {
      confirmBtn.disableInteractive();
      try {
        await AuthManager.getInstance().deleteCharacter(char.id);
        cleanup();
        // Adjust index if we deleted the last character in the list
        if (this.currentIndex >= this.characters.length - 1 && this.currentIndex > 0) {
          this.currentIndex--;
        }
        await this.loadCharacters();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to delete";
        errorText.setText(errMsg);
        confirmBtn.setInteractive({ useHandCursor: true });
      }
    });
  }

  private async selectCharacter(characterId: string) {
    this.statusText.setText("Connecting...");

    try {
      const auth = AuthManager.getInstance();
      const network = NetworkManager.getInstance();
      await network.joinGame(auth.getJoinOptions(characterId));
      this.statusText.setText("Connected!");

      const { width, height } = this.scale;
      const fadeOut = this.add.graphics().setDepth(100);
      fadeOut.fillStyle(0x000000, 1);
      fadeOut.fillRect(0, 0, width, height);
      fadeOut.setAlpha(0);
      this.tweens.add({
        targets: fadeOut,
        alpha: { from: 0, to: 1 },
        duration: 400,
        ease: "Power2",
        onComplete: () => this.scene.start("GameScene"),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      this.statusText.setText(`Error: ${msg}`);
    }
  }

  private formatLastPlayed(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

  private drawServerSelector(cx: number, _width: number, height: number) {
    // Server selector panel
    const panelW = 280;
    const panelH = 80;
    const panelX = cx - panelW / 2;
    const panelY = height - panelH - 24;

    const panel = this.add.graphics().setDepth(5);
    panel.fillStyle(0x191930, 0.9);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(1, 0x333355, 0.5);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    // Server label
    this.add
      .text(cx, panelY + 16, "SERVER", {
        fontSize: "8px",
        color: "#8899aa",
        fontFamily: "'Press Start 2P', monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Pill-shaped server buttons
    const serverBtnW = 120;
    const serverBtnH = 32;
    const serverBtnGap = 12;
    const totalW = SERVERS.length * serverBtnW + (SERVERS.length - 1) * serverBtnGap;
    const startX = cx - totalW / 2;
    const btnY = panelY + 34;

    const currentServerId = getSelectedServerId();
    const btnGraphics = this.add.graphics().setDepth(5);
    const btnTexts: Phaser.GameObjects.Text[] = [];

    const drawBtns = () => {
      btnGraphics.clear();
      const selId = getSelectedServerId();
      for (let i = 0; i < SERVERS.length; i++) {
        const btnX = startX + i * (serverBtnW + serverBtnGap);
        const isSel = SERVERS[i].id === selId;

        btnGraphics.fillStyle(isSel ? 0x222255 : 0x1a1a33, 1);
        btnGraphics.fillRoundedRect(btnX, btnY, serverBtnW, serverBtnH, 6);
        btnGraphics.lineStyle(isSel ? 2 : 1, isSel ? 0x4488ff : 0x333355, isSel ? 0.8 : 0.4);
        btnGraphics.strokeRoundedRect(btnX, btnY, serverBtnW, serverBtnH, 6);

        if (btnTexts[i]) {
          btnTexts[i].setColor(isSel ? "#4488ff" : "#667788");
          btnTexts[i].setFontStyle(isSel ? "bold" : "");
        }
      }
    };

    for (let i = 0; i < SERVERS.length; i++) {
      const server = SERVERS[i];
      const btnX = startX + i * (serverBtnW + serverBtnGap);
      const btnCx = btnX + serverBtnW / 2;
      const btnCy = btnY + serverBtnH / 2;

      const txt = this.add
        .text(btnCx, btnCy, server.name, {
          fontSize: "9px",
          color: server.id === currentServerId ? "#4488ff" : "#667788",
          fontFamily: "'Press Start 2P', monospace",
          fontStyle: server.id === currentServerId ? "bold" : "",
        })
        .setOrigin(0.5)
        .setDepth(6);
      btnTexts.push(txt);

      const zone = this.add
        .zone(btnCx, btnCy, serverBtnW, serverBtnH)
        .setDepth(7)
        .setInteractive({ useHandCursor: true });

      zone.on("pointerdown", () => {
        setSelectedServerId(server.id);
        drawBtns();
      });
      zone.on("pointerover", () => {
        if (getSelectedServerId() !== server.id) {
          btnTexts[i].setColor("#8888aa");
        }
      });
      zone.on("pointerout", () => {
        btnTexts[i].setColor(
          getSelectedServerId() === server.id ? "#4488ff" : "#667788"
        );
      });
    }

    drawBtns();
  }
}
