import Phaser from "phaser";
import {
  DUNGEON_MODIFIER_DEFS,
  DungeonModifierId,
  PortalType,
  MINIMAP_HEIGHT,
  getModifierTierValue,
} from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";

export class DungeonTooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private rarityText: Phaser.GameObjects.Text;
  private quantityText: Phaser.GameObjects.Text;
  private dividerGfx: Phaser.GameObjects.Graphics;
  private difficultyText: Phaser.GameObjects.Text;
  private modifierTexts: Phaser.GameObjects.Text[] = [];
  private shiftHintText: Phaser.GameObjects.Text;

  private S: number;
  private tooltipWidth: number;
  private padding: number;
  private visible: boolean = false;
  private lastShiftHeld: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    const S = this.S;

    this.tooltipWidth = Math.round(220 * S);
    this.padding = Math.round(8 * S);

    const nameFontSize = `${Math.round(13 * S)}px`;
    const statFontSize = `${Math.round(11 * S)}px`;
    const modFontSize = `${Math.round(10 * S)}px`;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(250)
      .setVisible(false);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    // Dungeon name
    this.nameText = scene.add
      .text(this.padding, this.padding, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setWordWrapWidth(this.tooltipWidth - this.padding * 2);
    this.container.add(this.nameText);

    // Difficulty rating
    this.difficultyText = scene.add.text(
      this.padding,
      this.padding + Math.round(18 * S),
      "",
      {
        fontSize: `${Math.round(10 * S)}px`,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      }
    );
    this.container.add(this.difficultyText);

    // Loot rarity boost
    this.rarityText = scene.add.text(
      this.padding,
      this.padding + Math.round(32 * S),
      "",
      {
        fontSize: statFontSize,
        color: "#44ff44",
        fontFamily: "monospace",
      }
    );
    this.container.add(this.rarityText);

    // Loot quantity boost
    this.quantityText = scene.add.text(
      this.padding,
      this.padding + Math.round(46 * S),
      "",
      {
        fontSize: statFontSize,
        color: "#44ff44",
        fontFamily: "monospace",
      }
    );
    this.container.add(this.quantityText);

    // Divider line
    this.dividerGfx = scene.add.graphics();
    this.container.add(this.dividerGfx);

    // Pre-allocate 5 modifier text objects (max possible)
    for (let i = 0; i < 5; i++) {
      const t = scene.add
        .text(this.padding, 0, "", {
          fontSize: modFontSize,
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setWordWrapWidth(this.tooltipWidth - this.padding * 2);
      this.container.add(t);
      this.modifierTexts.push(t);
    }

    // "[SHIFT] for more info" hint
    this.shiftHintText = scene.add.text(this.padding, 0, "[SHIFT] for more info", {
      fontSize: `${Math.round(9 * S)}px`,
      color: "#888888",
      fontFamily: "monospace",
      fontStyle: "italic",
    });
    this.container.add(this.shiftHintText);
  }

  show(
    portalType: number,
    modifierIds: number[],
    modifierTiers: number[],
    lootRarityBoost: number,
    lootQuantityBoost: number,
    shiftHeld: boolean = false
  ): void {
    // Allow re-render when shift state changes
    if (this.visible && shiftHeld === this.lastShiftHeld) return;
    this.lastShiftHeld = shiftHeld;

    const S = this.S;

    // Determine dungeon name and color from portal type
    let dungeonName = "Dungeon";
    let nameColor = "#ffffff";
    let borderColor = 0x666688;
    if (portalType === PortalType.InfernalPitEntrance) {
      dungeonName = "The Infernal Pit";
      nameColor = "#ff4400";
      borderColor = 0xff4400;
    } else if (portalType === PortalType.VoidSanctumEntrance) {
      dungeonName = "The Void Sanctum";
      nameColor = "#8833ee";
      borderColor = 0x8833ee;
    }

    this.nameText.setText(dungeonName);
    this.nameText.setColor(nameColor);

    // Difficulty rating
    let diffLabel = "Unknown";
    let diffColor = "#ffffff";
    if (portalType === PortalType.InfernalPitEntrance) {
      diffLabel = "Hard";
      diffColor = "#ff8844";
    } else if (portalType === PortalType.VoidSanctumEntrance) {
      diffLabel = "Extreme";
      diffColor = "#ff4444";
    }
    this.difficultyText.setText(`Difficulty: ${diffLabel}`);
    this.difficultyText.setColor(diffColor);

    this.rarityText.setText(`Loot Rarity: +${lootRarityBoost}%`);
    this.quantityText.setText(`Loot Quantity: +${lootQuantityBoost}%`);

    // Divider line position
    const dividerY = this.padding + Math.round(62 * S);
    this.dividerGfx.clear();
    this.dividerGfx.lineStyle(1, 0x666666, 0.6);
    this.dividerGfx.lineBetween(
      this.padding,
      dividerY,
      this.tooltipWidth - this.padding,
      dividerY
    );

    // Modifier texts
    let modY = dividerY + Math.round(6 * S);
    const modSpacing = Math.round(4 * S);
    for (let i = 0; i < 5; i++) {
      if (i < modifierIds.length) {
        const modId = modifierIds[i];
        const def = DUNGEON_MODIFIER_DEFS[modId];
        if (def) {
          const tier = modifierTiers[i] ?? 1;
          const pct = getModifierTierValue(modId, tier);
          const valueStr = modId === DungeonModifierId.EnemyCountUp
            ? `(+${pct} enemies)`
            : `(${pct}%)`;
          const tierStr = shiftHeld ? ` [Tier ${tier}]` : "";
          this.modifierTexts[i].setText(`${def.name}${tierStr} - ${def.description} ${valueStr}`);
          this.modifierTexts[i].setColor("#ffffff");
          this.modifierTexts[i].setY(modY);
          this.modifierTexts[i].setVisible(true);
          modY += this.modifierTexts[i].height + modSpacing;
        } else {
          this.modifierTexts[i].setVisible(false);
        }
      } else {
        this.modifierTexts[i].setVisible(false);
      }
    }

    // "[SHIFT] for more info" hint
    if (!shiftHeld) {
      this.shiftHintText.setY(modY + Math.round(2 * S));
      this.shiftHintText.setVisible(true);
      modY += this.shiftHintText.height + Math.round(6 * S);
    } else {
      this.shiftHintText.setVisible(false);
    }

    // Calculate total height
    const totalHeight = modY + this.padding;

    // Draw background
    this.bg.clear();
    this.bg.fillStyle(0x111122, 0.92);
    this.bg.fillRoundedRect(0, 0, this.tooltipWidth, totalHeight, 6);
    this.bg.lineStyle(1, borderColor, 0.8);
    this.bg.strokeRoundedRect(0, 0, this.tooltipWidth, totalHeight, 6);

    // Position: above the minimap, right-aligned with minimap's right edge
    const mmPadding = 16;
    const mmY =
      this.scene.scale.height - Math.round(MINIMAP_HEIGHT * S) - mmPadding;

    const tx = this.scene.scale.width - mmPadding - this.tooltipWidth;
    const ty = mmY - totalHeight - 8;

    this.container.setPosition(tx, ty);
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) return;
    this.container.setVisible(false);
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }
}
