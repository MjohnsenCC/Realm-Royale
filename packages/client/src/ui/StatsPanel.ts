import Phaser from "phaser";
import {
  computePlayerStats,
  getStatsForLevel,
  getScaledAbilityStats,
  getItemSubtype,
  isEmptyItem,
  ItemCategory,
  ITEM_DEFS,
  BASE_MAX_MANA,
  MANA_PER_LEVEL,
  BASE_MANA_REGEN,
  MANA_REGEN_PER_LEVEL,
  MAX_LEVEL,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";

// Stat row definitions: [label, section]
const STAT_ROWS: { label: string; section: "offensive" | "defensive" | "utility" }[] = [
  { label: "Damage Per Second", section: "offensive" },
  { label: "Weapon DPS", section: "offensive" },
  { label: "Weapon Damage", section: "offensive" },
  { label: "Attack Speed", section: "offensive" },
  { label: "Weapon Range", section: "offensive" },
  { label: "Projectile Speed", section: "offensive" },
  { label: "Ability DPS", section: "offensive" },
  { label: "Sustained Ability DPS", section: "offensive" },
  { label: "Ability Damage", section: "offensive" },
  { label: "Ability Cooldown", section: "offensive" },
  { label: "Ability Mana Cost", section: "offensive" },
  { label: "Max Health", section: "defensive" },
  { label: "Health Regen", section: "defensive" },
  { label: "Max Mana", section: "defensive" },
  { label: "Mana Regen", section: "defensive" },
  { label: "Movement Speed", section: "utility" },
  { label: "Level", section: "utility" },
];

export class StatsPanel {
  private scene: Phaser.Scene;
  private visible = false;
  private S: number;

  // Panel position & size
  private px: number;
  private py: number;
  private panelWidth: number;
  private panelHeight: number;

  // Graphics
  private panelBg: Phaser.GameObjects.Graphics;
  private separatorGraphics: Phaser.GameObjects.Graphics;

  // Texts
  private titleText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private sectionHeaders: Phaser.GameObjects.Text[] = [];
  private statLabelTexts: Phaser.GameObjects.Text[] = [];
  private statValueTexts: Phaser.GameObjects.Text[] = [];
  private statBonusTexts: Phaser.GameObjects.Text[] = [];

  // Layout constants (pre-scaled)
  private pad: number;
  private lineH: number;
  private sectionGap: number;
  private headerH: number;

  // Cached Y positions for separators
  private separatorYs: number[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    const S = this.S;

    this.pad = Math.round(12 * S);
    this.lineH = Math.round(16 * S);
    this.sectionGap = Math.round(10 * S);
    this.headerH = Math.round(18 * S);

    this.panelWidth = Math.round(300 * S);
    // Calculate height dynamically
    // title + hint + separator + 3 sections (header + separator each) + stat rows + bottom pad
    const offensiveRows = 11;
    const defensiveRows = 4;
    const utilityRows = 2;
    const totalRows = offensiveRows + defensiveRows + utilityRows;
    this.panelHeight =
      this.pad +
      this.headerH + // title
      this.lineH + // hint
      2 + // separator
      3 * (this.sectionGap + this.headerH + 2) + // 3 section headers + separators
      totalRows * this.lineH +
      this.pad;

    const screenW = scene.scale.width;
    const screenH = scene.scale.height;
    this.px = Math.round(screenW / 2 - this.panelWidth / 2);
    this.py = Math.round(screenH / 2 - this.panelHeight / 2);

    const labelFontSize = `${Math.round(10 * S)}px`;
    const valueFontSize = `${Math.round(10 * S)}px`;
    const headerFontSize = `${Math.round(11 * S)}px`;
    const titleFontSize = `${Math.round(14 * S)}px`;
    const hintFontSize = `${Math.round(9 * S)}px`;

    const labelX = this.px + this.pad;
    const valueX = this.px + this.panelWidth - this.pad;
    const bonusOffsetX = Math.round(70 * S);
    const centerX = this.px + this.panelWidth / 2;

    // --- Panel background ---
    this.panelBg = scene.add.graphics().setScrollFactor(0).setDepth(250);

    // --- Separator graphics ---
    this.separatorGraphics = scene.add.graphics().setScrollFactor(0).setDepth(250);

    // --- Title ---
    this.titleText = scene.add
      .text(centerX, this.py + this.pad, "CHARACTER STATS", {
        fontSize: titleFontSize,
        color: "#aaaaff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Hint ---
    this.hintText = scene.add
      .text(centerX, this.py + this.pad + this.headerH, "Press P to close", {
        fontSize: hintFontSize,
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(251);

    // --- Build rows ---
    let curY = this.py + this.pad + this.headerH + this.lineH;

    // Top separator after hint
    this.separatorYs.push(curY);
    curY += 2;

    let currentSection = "";
    const sectionNames: Record<string, string> = {
      offensive: "OFFENSIVE",
      defensive: "DEFENSIVE",
      utility: "UTILITY",
    };

    for (let i = 0; i < STAT_ROWS.length; i++) {
      const row = STAT_ROWS[i];

      // New section header
      if (row.section !== currentSection) {
        currentSection = row.section;
        curY += this.sectionGap;

        const header = scene.add
          .text(labelX, curY, sectionNames[row.section], {
            fontSize: headerFontSize,
            color: "#ffcc44",
            fontFamily: "monospace",
            fontStyle: "bold",
          })
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(251);
        this.sectionHeaders.push(header);

        curY += this.headerH;
        this.separatorYs.push(curY);
        curY += 2;
      }

      // Label
      const label = scene.add
        .text(labelX, curY, row.label, {
          fontSize: labelFontSize,
          color: "#bbbbbb",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(251);
      this.statLabelTexts.push(label);

      // Value (right-aligned, but leave room for bonus)
      const value = scene.add
        .text(valueX - bonusOffsetX, curY, "", {
          fontSize: valueFontSize,
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(251);
      this.statValueTexts.push(value);

      // Bonus (right of value)
      const bonus = scene.add
        .text(valueX, curY, "", {
          fontSize: valueFontSize,
          color: "#88ccff",
          fontFamily: "monospace",
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(251);
      this.statBonusTexts.push(bonus);

      curY += this.lineH;
    }

    // Start hidden
    this.setAllVisible(false);
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.setAllVisible(true);
    this.drawBackground();
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.setAllVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  update(level: number, equipment: ItemInstanceData[]): void {
    if (!this.visible) return;
    this.redraw(level, equipment);
  }

  private drawBackground(): void {
    this.panelBg.clear();
    this.panelBg.fillStyle(0x0a0a14, 0.95);
    this.panelBg.fillRoundedRect(this.px, this.py, this.panelWidth, this.panelHeight, 8);
    this.panelBg.lineStyle(2, 0x4a4a6a, 0.8);
    this.panelBg.strokeRoundedRect(this.px, this.py, this.panelWidth, this.panelHeight, 8);

    // Draw separators
    this.separatorGraphics.clear();
    for (const sy of this.separatorYs) {
      this.separatorGraphics.lineStyle(1, 0x444466, 0.6);
      this.separatorGraphics.lineBetween(
        this.px + this.pad,
        sy,
        this.px + this.panelWidth - this.pad,
        sy
      );
    }
  }

  private redraw(level: number, equipment: ItemInstanceData[]): void {
    // Base stats (level only)
    const baseStats = getStatsForLevel(level);
    // Full stats (level + equipment)
    const fullStats = computePlayerStats(level, equipment);

    // Ability stats
    const abilityItem = equipment[ItemCategory.Ability];
    let abilityDmg = 0;
    let abilityCooldown = 0;
    let abilityManaCost = 0;
    let hasAbility = false;

    if (abilityItem && !isEmptyItem(abilityItem)) {
      hasAbility = true;
      if (abilityItem.isUT) {
        const def = ITEM_DEFS[abilityItem.baseItemId];
        if (def?.abilityStats) {
          abilityDmg = def.abilityStats.damage;
          abilityCooldown = def.abilityStats.cooldown;
          abilityManaCost = def.abilityStats.manaCost;
        }
      } else {
        const subtype = getItemSubtype(abilityItem.baseItemId);
        const as = getScaledAbilityStats(
          subtype,
          abilityItem.instanceTier,
          abilityItem.lockedStat1Tier,
          abilityItem.lockedStat2Tier
        );
        abilityDmg = as.damage;
        abilityCooldown = as.cooldown;
        abilityManaCost = as.manaCost;
      }
    }

    // DPS calculations
    const weaponDPS = fullStats.damage / (fullStats.shootCooldown / 1000);

    let rawAbilityDPS = 0;
    let sustainedAbilityDPS = 0;
    if (hasAbility && abilityCooldown > 0) {
      rawAbilityDPS = abilityDmg / (abilityCooldown / 1000);

      if (abilityManaCost <= 0) {
        sustainedAbilityDPS = rawAbilityDPS;
      } else if (abilityManaCost > fullStats.maxMana) {
        sustainedAbilityDPS = 0;
      } else {
        const castsPerSecFromCooldown = 1000 / abilityCooldown;
        const castsPerSecFromMana =
          fullStats.manaRegen > 0 ? fullStats.manaRegen / abilityManaCost : 0;
        const sustainedCastsPerSec = Math.min(castsPerSecFromCooldown, castsPerSecFromMana);
        sustainedAbilityDPS = abilityDmg * sustainedCastsPerSec;
      }
    }

    const combinedDPS = weaponDPS + rawAbilityDPS;

    // Bonuses (full - base)
    const dmgBonus = fullStats.damage - baseStats.damage;
    const hpBonus = fullStats.maxHp - baseStats.maxHp;
    const hpRegenBonus = +(fullStats.hpRegen - baseStats.hpRegen).toFixed(2);
    const speedBonus = fullStats.speed - baseStats.speed;

    const l = Math.min(Math.max(level, 1), MAX_LEVEL);
    const baseMana = BASE_MAX_MANA + (l - 1) * MANA_PER_LEVEL;
    const baseManaRegen = BASE_MANA_REGEN + (l - 1) * MANA_REGEN_PER_LEVEL;
    const manaBonus = fullStats.maxMana - baseMana;
    const manaRegenBonus = +(fullStats.manaRegen - baseManaRegen).toFixed(2);

    // Row 0: Combined DPS (gold highlight)
    this.setStatRow(0, combinedDPS.toFixed(1), undefined, "#ffcc44");
    // Row 1: Weapon DPS
    this.setStatRow(1, weaponDPS.toFixed(1));
    // Row 2: Weapon Damage
    this.setStatRow(2, String(Math.round(fullStats.damage)), dmgBonus);
    // Row 3: Attack Speed
    this.setStatRow(3, (1000 / fullStats.shootCooldown).toFixed(2) + "/s");
    // Row 4: Weapon Range
    this.setStatRow(4, String(fullStats.weaponRange));
    // Row 5: Projectile Speed
    this.setStatRow(5, String(fullStats.weaponProjSpeed));
    // Row 6: Ability DPS (raw, cooldown-based)
    this.setStatRow(6, hasAbility ? rawAbilityDPS.toFixed(1) : "N/A");
    // Row 7: Sustained Ability DPS (mana-limited)
    if (hasAbility && sustainedAbilityDPS < rawAbilityDPS - 0.1) {
      this.setStatRow(7, sustainedAbilityDPS.toFixed(1), undefined, "#ff8866");
    } else {
      this.setStatRow(7, hasAbility ? sustainedAbilityDPS.toFixed(1) : "N/A");
    }
    // Row 8: Ability Damage
    this.setStatRow(8, hasAbility ? String(abilityDmg) : "N/A");
    // Row 9: Ability Cooldown
    this.setStatRow(9, hasAbility ? (abilityCooldown / 1000).toFixed(2) + "s" : "N/A");
    // Row 10: Ability Mana Cost
    this.setStatRow(10, hasAbility ? String(abilityManaCost) : "N/A");
    // Row 11: Max Health
    this.setStatRow(11, String(Math.round(fullStats.maxHp)), hpBonus);
    // Row 12: Health Regen
    this.setStatRow(12, fullStats.hpRegen.toFixed(1) + "/s", hpRegenBonus);
    // Row 13: Max Mana
    this.setStatRow(13, String(Math.round(fullStats.maxMana)), manaBonus);
    // Row 14: Mana Regen
    this.setStatRow(14, fullStats.manaRegen.toFixed(1) + "/s", manaRegenBonus);
    // Row 15: Movement Speed
    this.setStatRow(15, String(Math.round(fullStats.speed)), speedBonus);
    // Row 16: Level
    this.setStatRow(16, String(level));
  }

  private setStatRow(
    index: number,
    value: string,
    bonus?: number,
    valueColor?: string
  ): void {
    this.statValueTexts[index].setText(value);
    this.statValueTexts[index].setColor(valueColor ?? "#ffffff");

    if (bonus !== undefined && Math.abs(bonus) >= 0.1) {
      const sign = bonus > 0 ? "+" : "";
      const formatted = Number.isInteger(bonus) ? String(Math.round(bonus)) : bonus.toFixed(1);
      this.statBonusTexts[index].setText(`(${sign}${formatted})`);
      this.statBonusTexts[index].setColor(bonus > 0 ? "#88ccff" : "#ff6666");
    } else {
      this.statBonusTexts[index].setText("");
    }
  }

  private setAllVisible(v: boolean): void {
    this.panelBg.setVisible(v);
    this.separatorGraphics.setVisible(v);
    this.titleText.setVisible(v);
    this.hintText.setVisible(v);
    for (const h of this.sectionHeaders) h.setVisible(v);
    for (const t of this.statLabelTexts) t.setVisible(v);
    for (const t of this.statValueTexts) t.setVisible(v);
    for (const t of this.statBonusTexts) t.setVisible(v);
  }
}
