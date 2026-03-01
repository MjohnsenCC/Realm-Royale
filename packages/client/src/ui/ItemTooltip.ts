import Phaser from "phaser";
import { ITEM_DEFS, getCategoryName } from "@rotmg-lite/shared";

const TOOLTIP_WIDTH = 160;
const TOOLTIP_PADDING = 8;

export class ItemTooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(300)
      .setVisible(false);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.nameText = scene.add
      .text(TOOLTIP_PADDING, TOOLTIP_PADDING, "", {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setWordWrapWidth(TOOLTIP_WIDTH - TOOLTIP_PADDING * 2);
    this.container.add(this.nameText);

    this.tierText = scene.add.text(TOOLTIP_PADDING, 24, "", {
      fontSize: "10px",
      color: "#aaaaaa",
      fontFamily: "monospace",
    });
    this.container.add(this.tierText);

    this.statsText = scene.add
      .text(TOOLTIP_PADDING, 40, "", {
        fontSize: "10px",
        color: "#aaffaa",
        fontFamily: "monospace",
        lineSpacing: 2,
      })
      .setWordWrapWidth(TOOLTIP_WIDTH - TOOLTIP_PADDING * 2);
    this.container.add(this.statsText);

    this.descText = scene.add
      .text(TOOLTIP_PADDING, 40, "", {
        fontSize: "9px",
        color: "#888899",
        fontFamily: "monospace",
        fontStyle: "italic",
      })
      .setWordWrapWidth(TOOLTIP_WIDTH - TOOLTIP_PADDING * 2);
    this.container.add(this.descText);
  }

  show(itemId: number, screenX: number, screenY: number): void {
    const def = ITEM_DEFS[itemId];
    if (!def) {
      this.hide();
      return;
    }

    // Name (colored by tier)
    this.nameText.setText(def.name);
    const tierHex = "#" + def.tierColor.toString(16).padStart(6, "0");
    this.nameText.setColor(tierHex);

    // Tier + category
    this.tierText.setText(`T${def.tier} ${getCategoryName(def.category)}`);

    // Stats
    const statsLines: string[] = [];
    if (def.weaponStats) {
      statsLines.push(`Damage: ${def.weaponStats.damage}`);
      statsLines.push(`Range: ${def.weaponStats.range}`);
      statsLines.push(
        `Fire Rate: ${(1000 / def.weaponStats.shootCooldown).toFixed(1)}/s`
      );
    } else if (def.abilityStats) {
      statsLines.push(`Damage: ${def.abilityStats.damage}`);
      statsLines.push(`Mana Cost: ${def.abilityStats.manaCost}`);
      statsLines.push(`Range: ${def.abilityStats.range}`);
      statsLines.push(`Piercing: Yes`);
    } else if (def.armorStats) {
      statsLines.push(`+${def.armorStats.maxHpBonus} Max HP`);
    } else if (def.ringStats) {
      const r = def.ringStats;
      if (r.speedBonus) statsLines.push(`+${r.speedBonus} Speed`);
      if (r.damageBonus) statsLines.push(`+${r.damageBonus} Damage`);
      if (r.hpRegenBonus) statsLines.push(`+${r.hpRegenBonus} HP Regen`);
      if (r.maxHpBonus) statsLines.push(`+${r.maxHpBonus} Max HP`);
      if (r.maxManaBonus) statsLines.push(`+${r.maxManaBonus} Max Mana`);
    }
    this.statsText.setText(statsLines.join("\n"));

    // Description
    const statsBottom = 40 + this.statsText.height + 4;
    this.descText.setY(statsBottom);
    this.descText.setText(def.description);

    // Calculate total height
    const totalHeight = statsBottom + this.descText.height + TOOLTIP_PADDING;

    // Draw background
    this.bg.clear();
    this.bg.fillStyle(0x111122, 0.95);
    this.bg.fillRoundedRect(0, 0, TOOLTIP_WIDTH, totalHeight, 4);
    this.bg.lineStyle(1, def.tierColor, 0.8);
    this.bg.strokeRoundedRect(0, 0, TOOLTIP_WIDTH, totalHeight, 4);

    // Position: above the given point, clamped to screen
    let tx = screenX;
    let ty = screenY - totalHeight;

    // Clamp to screen bounds
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    if (tx + TOOLTIP_WIDTH > sw) tx = sw - TOOLTIP_WIDTH - 4;
    if (tx < 4) tx = 4;
    if (ty < 4) ty = screenY + 40; // flip below if too high

    this.container.setPosition(tx, ty);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }
}
