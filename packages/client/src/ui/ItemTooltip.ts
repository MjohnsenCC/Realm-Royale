import Phaser from "phaser";
import { ITEM_DEFS, getCategoryName } from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";

const BASE_TOOLTIP_WIDTH = 160;
const BASE_TOOLTIP_PADDING = 8;

export class ItemTooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;

  private S: number;
  private tooltipWidth: number;
  private tooltipPadding: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.S = getUIScale();
    const S = this.S;
    this.tooltipWidth = Math.round(BASE_TOOLTIP_WIDTH * S);
    this.tooltipPadding = Math.round(BASE_TOOLTIP_PADDING * S);

    const nameFontSize = `${Math.round(12 * S)}px`;
    const tierFontSize = `${Math.round(10 * S)}px`;
    const statsFontSize = `${Math.round(10 * S)}px`;
    const descFontSize = `${Math.round(9 * S)}px`;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(300)
      .setVisible(false);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.nameText = scene.add
      .text(this.tooltipPadding, this.tooltipPadding, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setWordWrapWidth(this.tooltipWidth - this.tooltipPadding * 2);
    this.container.add(this.nameText);

    const tierY = this.tooltipPadding + Math.round(16 * S);
    this.tierText = scene.add.text(this.tooltipPadding, tierY, "", {
      fontSize: tierFontSize,
      color: "#aaaaaa",
      fontFamily: "monospace",
    });
    this.container.add(this.tierText);

    const statsY = tierY + Math.round(16 * S);
    this.statsText = scene.add
      .text(this.tooltipPadding, statsY, "", {
        fontSize: statsFontSize,
        color: "#aaffaa",
        fontFamily: "monospace",
        lineSpacing: 2,
      })
      .setWordWrapWidth(this.tooltipWidth - this.tooltipPadding * 2);
    this.container.add(this.statsText);

    this.descText = scene.add
      .text(this.tooltipPadding, statsY, "", {
        fontSize: descFontSize,
        color: "#888899",
        fontFamily: "monospace",
        fontStyle: "italic",
      })
      .setWordWrapWidth(this.tooltipWidth - this.tooltipPadding * 2);
    this.container.add(this.descText);
  }

  show(itemId: number, screenX: number, screenY: number): void {
    const def = ITEM_DEFS[itemId];
    if (!def) {
      this.hide();
      return;
    }

    const S = this.S;
    const statsStartY = this.tooltipPadding + Math.round(32 * S);

    // Name (colored by tier)
    this.nameText.setText(def.name);
    const tierHex = "#" + def.tierColor.toString(16).padStart(6, "0");
    this.nameText.setColor(tierHex);

    // Tier + category
    const tierLabel = def.tier === 7 ? "UT" : `T${def.tier}`;
    this.tierText.setText(`${tierLabel} ${getCategoryName(def.category)}`);

    // Stats
    const statsLines: string[] = [];
    if (def.weaponStats) {
      statsLines.push(`Damage: ${def.weaponStats.damage}`);
      if (def.weaponStats.projectileCount && def.weaponStats.projectileCount > 1) {
        statsLines.push(`Projectiles: ${def.weaponStats.projectileCount}`);
      }
      statsLines.push(`Range: ${def.weaponStats.range}`);
      statsLines.push(
        `Fire Rate: ${(1000 / def.weaponStats.shootCooldown).toFixed(1)}/s`
      );
    } else if (def.abilityStats) {
      statsLines.push(`Damage: ${def.abilityStats.damage}`);
      statsLines.push(`Mana Cost: ${def.abilityStats.manaCost}`);
      statsLines.push(`Range: ${def.abilityStats.range}`);
      if (def.abilityStats.piercing) statsLines.push(`Piercing: Yes`);
      if (def.abilityStats.speedBoostAmount) {
        statsLines.push(`Speed Boost: +${def.abilityStats.speedBoostAmount}`);
        statsLines.push(`Boost Duration: ${(def.abilityStats.speedBoostDuration! / 1000).toFixed(1)}s`);
      }
    } else if (def.armorStats) {
      statsLines.push(`+${def.armorStats.maxHpBonus} Max HP`);
      if (def.armorStats.manaRegenBonus) {
        statsLines.push(`+${def.armorStats.manaRegenBonus} Mana Regen`);
      }
    } else if (def.ringStats) {
      const r = def.ringStats;
      if (r.speedBonus) statsLines.push(`+${r.speedBonus} Speed`);
      if (r.damageBonus) statsLines.push(`+${r.damageBonus} Damage`);
      if (r.hpRegenBonus) statsLines.push(`+${r.hpRegenBonus} HP Regen`);
      if (r.maxHpBonus) statsLines.push(`+${r.maxHpBonus} Max HP`);
      if (r.maxManaBonus) statsLines.push(`+${r.maxManaBonus} Max Mana`);
      if (r.projSpeedBonus) statsLines.push(`+${r.projSpeedBonus} Proj Speed`);
    }
    this.statsText.setText(statsLines.join("\n"));
    this.statsText.setY(statsStartY);

    // Description
    const statsBottom = statsStartY + this.statsText.height + 4;
    this.descText.setY(statsBottom);
    this.descText.setText(def.description);

    // Calculate total height
    const totalHeight = statsBottom + this.descText.height + this.tooltipPadding;

    // Draw background
    this.bg.clear();
    this.bg.fillStyle(0x111122, 0.95);
    this.bg.fillRoundedRect(0, 0, this.tooltipWidth, totalHeight, 4);
    this.bg.lineStyle(1, def.tierColor, 0.8);
    this.bg.strokeRoundedRect(0, 0, this.tooltipWidth, totalHeight, 4);

    // Position: above the given point, clamped to screen
    let tx = screenX;
    let ty = screenY - totalHeight;

    // Clamp to screen bounds
    const sw = this.scene.scale.width;
    if (tx + this.tooltipWidth > sw) tx = sw - this.tooltipWidth - 4;
    if (tx < 4) tx = 4;
    if (ty < 4) ty = screenY + Math.round(40 * S); // flip below if too high

    this.container.setPosition(tx, ty);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }
}
