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
export class CharacterSelectScene extends Phaser.Scene {
  private characters: CharacterSummary[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private characterContainer!: Phaser.GameObjects.Container;
  private createBtn!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: "CharacterSelectScene" });
  }

  async create() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Background
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.drawBackground(width, height);

    // Title
    this.add
      .text(cx, height * 0.1, "SELECT CHARACTER", {
        fontSize: "36px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Status text
    this.statusText = this.add
      .text(cx, height * 0.18, "", {
        fontSize: "14px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Character list container
    this.characterContainer = this.add.container(0, 0).setDepth(5);

    // Settings panel (server + UI scale) at bottom
    this.drawSettingsPanel(cx, width, height);

    // Log out button (top right)
    const logoutBtn = this.add
      .text(width - 20, 20, "LOG OUT", {
        fontSize: "14px",
        color: "#aa4444",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    logoutBtn.on("pointerover", () => logoutBtn.setColor("#ff6666"));
    logoutBtn.on("pointerout", () => logoutBtn.setColor("#aa4444"));
    logoutBtn.on("pointerdown", () => {
      AuthManager.getInstance().logout();
      this.scene.start("MenuScene");
    });

    // Load characters
    await this.loadCharacters();
  }

  private async loadCharacters() {
    this.statusText.setText("Loading characters...");
    try {
      const auth = AuthManager.getInstance();
      this.characters = await auth.fetchCharacters();
      this.statusText.setText("");
      this.renderCharacters();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      this.statusText.setText(`Error: ${msg}`);
      if (msg === "Session expired") {
        this.time.delayedCall(1500, () => this.scene.start("MenuScene"));
      }
    }
  }

  private renderCharacters() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Clear existing
    this.characterContainer.removeAll(true);

    const cardW = 340;
    const cardH = 70;
    const cardGap = 12;
    const startY = height * 0.26;

    // Character cards
    for (let i = 0; i < this.characters.length; i++) {
      const char = this.characters[i];
      const cardY = startY + i * (cardH + cardGap);
      this.createCharacterCard(cx, cardY, cardW, cardH, char);
    }

    // Create new character button
    if (this.characters.length < MAX_CHARACTERS_PER_ACCOUNT) {
      const btnY = startY + this.characters.length * (cardH + cardGap);
      this.createNewCharacterButton(cx, btnY, cardW, cardH);
    }
  }

  private createCharacterCard(
    cx: number,
    y: number,
    w: number,
    h: number,
    char: CharacterSummary
  ) {
    const x = cx - w / 2;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 0.9);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(1, 0x4488ff, 0.3);
    bg.strokeRoundedRect(x, y, w, h, 6);

    // Character name
    const nameText = this.add
      .text(x + 16, y + 16, char.name, {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setDepth(6);

    // Level and class
    const className = CLASS_NAMES[char.characterClass] ?? "Unknown";
    const levelText = this.add
      .text(x + 16, y + 42, `Level ${char.level} ${className}`, {
        fontSize: "13px",
        color: "#8888aa",
        fontFamily: "monospace",
      })
      .setDepth(6);

    // Last played
    const lastPlayed = this.formatLastPlayed(char.lastPlayed);
    const lastPlayedText = this.add
      .text(x + w - 80, y + 42, lastPlayed, {
        fontSize: "11px",
        color: "#666688",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0)
      .setDepth(6);

    // Play button zone (the entire card)
    const zone = this.add
      .zone(cx, y + h / 2, w, h)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    zone.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x333366, 0.9);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x4488ff, 0.6);
      bg.strokeRoundedRect(x, y, w, h, 6);
    });
    zone.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x222244, 0.9);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x4488ff, 0.3);
      bg.strokeRoundedRect(x, y, w, h, 6);
    });
    zone.on("pointerdown", () => this.selectCharacter(char.id));

    // Delete button
    const delBtn = this.add
      .text(x + w - 16, y + 16, "X", {
        fontSize: "16px",
        color: "#664444",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setDepth(8)
      .setInteractive({ useHandCursor: true });

    delBtn.on("pointerover", () => delBtn.setColor("#ff4444"));
    delBtn.on("pointerout", () => delBtn.setColor("#664444"));
    delBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.confirmDeleteCharacter(char);
    });

    this.characterContainer.add([bg, nameText, levelText, lastPlayedText, zone, delBtn]);
  }

  private createNewCharacterButton(cx: number, y: number, w: number, h: number) {
    const x = cx - w / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a33, 0.7);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(1, 0x4488ff, 0.15);
    bg.strokeRoundedRect(x, y, w, h, 6);

    const label = this.add
      .text(cx, y + h / 2, "+ CREATE CHARACTER", {
        fontSize: "18px",
        color: "#4488ff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const zone = this.add
      .zone(cx, y + h / 2, w, h)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    zone.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x222255, 0.7);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x4488ff, 0.4);
      bg.strokeRoundedRect(x, y, w, h, 6);
      label.setColor("#66aaff");
    });
    zone.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x1a1a33, 0.7);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x4488ff, 0.15);
      bg.strokeRoundedRect(x, y, w, h, 6);
      label.setColor("#4488ff");
    });
    zone.on("pointerdown", () => this.showCreateCharacterInput());

    this.characterContainer.add([bg, label, zone]);
  }

  private showCreateCharacterInput() {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Overlay
    const overlay = this.add.graphics().setDepth(20);
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);

    // Dialog box
    const dialogW = 500;
    const dialogH = 380;
    const dialogX = cx - dialogW / 2;
    const dialogY = height / 2 - dialogH / 2;

    const dialogBg = this.add.graphics().setDepth(21);
    dialogBg.fillStyle(0x1a1a33, 1);
    dialogBg.fillRoundedRect(dialogX, dialogY, dialogW, dialogH, 8);
    dialogBg.lineStyle(1, 0x4488ff, 0.5);
    dialogBg.strokeRoundedRect(dialogX, dialogY, dialogW, dialogH, 8);

    const title = this.add
      .text(cx, dialogY + 25, "CREATE CHARACTER", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22);

    // Class selector
    let selectedClass: number = CharacterClass.Archer;
    const classLabel = this.add
      .text(cx, dialogY + 52, "SELECT CLASS", {
        fontSize: "11px",
        color: "#667788",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const classOptions = [
      { id: CharacterClass.Archer, name: "ARCHER" },
      { id: CharacterClass.Warrior, name: "WARRIOR" },
      { id: CharacterClass.Arcanist, name: "ARCANIST" },
    ];

    // Class cards
    const cardW = 140;
    const cardH = 120;
    const cardGap = 16;
    const totalCardsW = classOptions.length * cardW + (classOptions.length - 1) * cardGap;
    const cardsStartX = cx - totalCardsW / 2;
    const cardTopY = dialogY + 68;

    const cardGraphics = this.add.graphics().setDepth(21);
    const cardElements: Phaser.GameObjects.GameObject[] = [cardGraphics];

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

        // Draw weapon icon
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
        .setDepth(22);

      const weaponName = getSubtypeName(ItemCategory.Weapon, equip.weapon);
      const abilityName = getSubtypeName(ItemCategory.Ability, equip.ability);
      const info1Text = this.add
        .text(cardCx, cardTopY + 78, `${weaponName} · ${abilityName}`, {
          fontSize: "10px",
          color: isSelected ? "#8888aa" : "#555566",
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(22);

      const armorName = getSubtypeName(ItemCategory.Armor, equip.armor);
      const info2Text = this.add
        .text(cardCx, cardTopY + 94, armorName, {
          fontSize: "10px",
          color: isSelected ? "#8888aa" : "#555566",
          fontFamily: "monospace",
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

      cardTextElements.push(nameText, info1Text, info2Text);
      cardElements.push(nameText, info1Text, info2Text, zone);
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

    // Name input
    const inputHTML = `
      <input type="text" id="charNameInput" maxlength="${CHARACTER_NAME_MAX_LENGTH}" placeholder="Character name..."
        style="
          width: 220px;
          padding: 10px 16px;
          font-size: 18px;
          font-family: monospace;
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
      .dom(cx, dialogY + 218)
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
      .text(cx, dialogY + 258, "", {
        fontSize: "12px",
        color: "#ff4444",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    // Buttons
    const confirmBtn = this.add
      .text(cx - 50, dialogY + 305, "CREATE", {
        fontSize: "16px",
        color: "#44ff88",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cancelBtn = this.add
      .text(cx + 50, dialogY + 305, "CANCEL", {
        fontSize: "16px",
        color: "#aa6666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cleanup = () => {
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
    const { width, height } = this.scale;
    const cx = width / 2;

    const overlay = this.add.graphics().setDepth(20);
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);

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
        fontSize: "16px",
        color: "#ff4444",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const msg = this.add
      .text(cx, dialogY + 55, `Delete "${char.name}" (Lv.${char.level})?`, {
        fontSize: "14px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const errorText = this.add
      .text(cx, dialogY + 78, "", {
        fontSize: "12px",
        color: "#ff4444",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(22);

    const confirmBtn = this.add
      .text(cx - 50, dialogY + 110, "DELETE", {
        fontSize: "16px",
        color: "#ff4444",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cancelBtn = this.add
      .text(cx + 50, dialogY + 110, "CANCEL", {
        fontSize: "16px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const cleanup = () => {
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
    // Grid background (matching MenuScene style)
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

  private drawSettingsPanel(cx: number, width: number, height: number) {
    const panelW = 200;
    const panelH = 60;
    const panelX = cx - panelW / 2;
    const panelY = height - panelH - 30;

    const panel = this.add.graphics().setDepth(5);
    panel.fillStyle(0x222222, 0.85);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(1, 0x555555, 0.6);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(1, 0x4488ff, 0.2);
    panel.beginPath();
    panel.moveTo(panelX + 8, panelY);
    panel.lineTo(panelX + panelW - 8, panelY);
    panel.strokePath();

    // Server selector
    const serverLabelY = panelY + 12;
    this.add
      .text(cx, serverLabelY, "SERVER", {
        fontSize: "10px",
        color: "#667788",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(6);

    const serverBtnY = serverLabelY + 16;
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

  }
}
