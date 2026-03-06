import Phaser from "phaser";
import {
  computePlayerStats,
  getStatsForLevel,
  getScaledAbilityStats,
  getScaledWeaponStats,
  getItemSubtype,
  MIN_SHOOT_COOLDOWN,
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

// Stat row definitions
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
  { label: "Phys Dmg Reduction", section: "defensive" },
  { label: "Magic Dmg Reduction", section: "defensive" },
  { label: "Movement Speed", section: "utility" },
  { label: "Level", section: "utility" },
];

export class StatsPanel {
  private scene: Phaser.Scene;
  private visible = false;
  private S: number;

  // Panel outer position & visible size (the clipped viewport)
  private px: number;
  private py: number;
  private panelWidth: number;
  private viewHeight: number;

  // Full content height (may exceed viewHeight)
  private contentHeight: number;

  // Panel background (drawn at panel position, not scrolled)
  private panelBg: Phaser.GameObjects.Graphics;

  // Scrollable content container — holds all text + separator graphics
  private contentContainer: Phaser.GameObjects.Container;
  private separatorGraphics: Phaser.GameObjects.Graphics;

  // Texts (added to contentContainer, positioned relative to container origin)
  private titleText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private sectionHeaders: Phaser.GameObjects.Text[] = [];
  private statLabelTexts: Phaser.GameObjects.Text[] = [];
  private statValueTexts: Phaser.GameObjects.Text[] = [];
  private statBonusTexts: Phaser.GameObjects.Text[] = [];

  // Scroll bar
  private scrollBarBg: Phaser.GameObjects.Graphics;
  private scrollBarThumb: Phaser.GameObjects.Graphics;

  // Layout constants (pre-scaled)
  private pad: number;
  private lineH: number;
  private sectionGap: number;
  private headerH: number;

  // Separator Y positions relative to content container
  private separatorYs: number[] = [];

  // Scroll state
  private scrollY = 0;
  private maxScrollY = 0;
  private scrollBarWidth: number;

  // Mask for clipping
  private maskGraphics: Phaser.GameObjects.Graphics;

  // Wheel listener reference for cleanup
  private wheelListener: ((e: WheelEvent) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    const S = this.S;

    this.pad = Math.round(12 * S);
    this.lineH = Math.round(16 * S);
    this.sectionGap = Math.round(10 * S);
    this.headerH = Math.round(18 * S);
    this.scrollBarWidth = Math.round(4 * S);

    this.panelWidth = Math.round(260 * S);

    // Calculate full content height
    const offensiveRows = 11;
    const defensiveRows = 6;
    const utilityRows = 2;
    const totalRows = offensiveRows + defensiveRows + utilityRows;
    this.contentHeight =
      this.pad +
      this.headerH + // title
      this.lineH + // hint
      2 + // separator
      3 * (this.sectionGap + this.headerH + 2) + // 3 section headers + separators
      totalRows * this.lineH +
      this.pad;

    // Position: left side, from top down to just above the HUD panel
    // HUD panel Y = screenH - panelH - 12*S
    // panelH = innerPad + maxH + innerPad where innerPad=8*S, maxH = max(barsH, eqSectionH, invH)
    // eqSectionH = 36*S + 4*S + 36*S = 76*S  (the tallest section)
    // So panelH = 8*S + 76*S + 8*S = 92*S
    // HUD top Y = screenH - 92*S - 12*S = screenH - 104*S
    const screenH = scene.scale.height;
    const hudPanelH = Math.round(92 * S);
    const hudMargin = Math.round(12 * S);
    const hudTopY = screenH - hudPanelH - hudMargin;
    const panelMargin = Math.round(12 * S);

    this.px = panelMargin;
    this.py = panelMargin;
    this.viewHeight = hudTopY - panelMargin - panelMargin; // gap above HUD

    // Clamp viewHeight to content if content is shorter
    if (this.contentHeight <= this.viewHeight) {
      this.viewHeight = this.contentHeight;
    }
    this.maxScrollY = Math.max(0, this.contentHeight - this.viewHeight);

    // --- Panel background (fixed, not scrolled) ---
    this.panelBg = scene.add.graphics().setScrollFactor(0).setDepth(250);

    // --- Scroll bar ---
    this.scrollBarBg = scene.add.graphics().setScrollFactor(0).setDepth(252);
    this.scrollBarThumb = scene.add.graphics().setScrollFactor(0).setDepth(253);

    // --- Mask for clipping content ---
    this.maskGraphics = scene.add.graphics().setScrollFactor(0);
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(this.px, this.py, this.panelWidth, this.viewHeight);
    this.maskGraphics.setVisible(false);
    const mask = this.maskGraphics.createGeometryMask();

    // --- Scrollable content container ---
    this.contentContainer = scene.add.container(this.px, this.py)
      .setScrollFactor(0)
      .setDepth(251);
    this.contentContainer.setMask(mask);

    // --- Separator graphics (inside container) ---
    this.separatorGraphics = scene.add.graphics();
    this.contentContainer.add(this.separatorGraphics);

    // Font sizes
    const labelFontSize = `${Math.round(10 * S)}px`;
    const valueFontSize = `${Math.round(10 * S)}px`;
    const headerFontSize = `${Math.round(11 * S)}px`;
    const titleFontSize = `${Math.round(14 * S)}px`;
    const hintFontSize = `${Math.round(9 * S)}px`;

    // Content positions (relative to container)
    const contentW = this.panelWidth - this.scrollBarWidth - Math.round(2 * S);
    const labelX = this.pad;
    const valueX = contentW - this.pad;
    const bonusOffsetX = Math.round(70 * S);
    const centerX = contentW / 2;

    // --- Title ---
    this.titleText = scene.add
      .text(centerX, this.pad, "CHARACTER STATS", {
        fontSize: titleFontSize,
        color: "#aaaaff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.titleText);

    // --- Hint ---
    this.hintText = scene.add
      .text(centerX, this.pad + this.headerH, "Press P to close", {
        fontSize: hintFontSize,
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    this.contentContainer.add(this.hintText);

    // --- Build rows ---
    let curY = this.pad + this.headerH + this.lineH;

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
          .setOrigin(0, 0);
        this.contentContainer.add(header);
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
        .setOrigin(0, 0);
      this.contentContainer.add(label);
      this.statLabelTexts.push(label);

      // Value (right-aligned, leave room for bonus)
      const value = scene.add
        .text(valueX - bonusOffsetX, curY, "", {
          fontSize: valueFontSize,
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(1, 0);
      this.contentContainer.add(value);
      this.statValueTexts.push(value);

      // Bonus (right of value)
      const bonus = scene.add
        .text(valueX, curY, "", {
          fontSize: valueFontSize,
          color: "#88ccff",
          fontFamily: "monospace",
        })
        .setOrigin(1, 0);
      this.contentContainer.add(bonus);
      this.statBonusTexts.push(bonus);

      curY += this.lineH;
    }

    // Start hidden
    this.setAllVisible(false);
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.scrollY = 0;
    this.setAllVisible(true);
    this.drawBackground();
    this.drawSeparators();
    this.applyScroll();

    // Mouse wheel scrolling
    this.wheelListener = (e: WheelEvent) => {
      if (!this.visible) return;
      // Only scroll when cursor is over the panel
      const pointer = this.scene.input.activePointer;
      if (
        pointer.x >= this.px &&
        pointer.x <= this.px + this.panelWidth &&
        pointer.y >= this.py &&
        pointer.y <= this.py + this.viewHeight
      ) {
        this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + e.deltaY * 0.5));
        this.applyScroll();
        e.preventDefault();
      }
    };
    this.scene.game.canvas.addEventListener("wheel", this.wheelListener, { passive: false });
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.setAllVisible(false);
    if (this.wheelListener) {
      this.scene.game.canvas.removeEventListener("wheel", this.wheelListener);
      this.wheelListener = null;
    }
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
    this.panelBg.fillRoundedRect(this.px, this.py, this.panelWidth, this.viewHeight, 8);
    this.panelBg.lineStyle(2, 0x4a4a6a, 0.8);
    this.panelBg.strokeRoundedRect(this.px, this.py, this.panelWidth, this.viewHeight, 8);
  }

  private drawSeparators(): void {
    this.separatorGraphics.clear();
    const contentW = this.panelWidth - this.scrollBarWidth - Math.round(2 * this.S);
    for (const sy of this.separatorYs) {
      this.separatorGraphics.lineStyle(1, 0x444466, 0.6);
      this.separatorGraphics.lineBetween(this.pad, sy, contentW - this.pad, sy);
    }
  }

  private applyScroll(): void {
    this.contentContainer.setPosition(this.px, this.py - this.scrollY);

    // Draw scroll bar
    this.scrollBarBg.clear();
    this.scrollBarThumb.clear();
    if (this.maxScrollY > 0) {
      const sbX = this.px + this.panelWidth - this.scrollBarWidth - 2;
      const sbY = this.py + 4;
      const sbH = this.viewHeight - 8;

      // Track
      this.scrollBarBg.fillStyle(0x222233, 0.5);
      this.scrollBarBg.fillRoundedRect(sbX, sbY, this.scrollBarWidth, sbH, 2);

      // Thumb
      const thumbRatio = this.viewHeight / this.contentHeight;
      const thumbH = Math.max(Math.round(20 * this.S), sbH * thumbRatio);
      const thumbY = sbY + (sbH - thumbH) * (this.scrollY / this.maxScrollY);
      this.scrollBarThumb.fillStyle(0x6666aa, 0.7);
      this.scrollBarThumb.fillRoundedRect(sbX, thumbY, this.scrollBarWidth, thumbH, 2);
    }
  }

  private redraw(level: number, equipment: ItemInstanceData[]): void {
    // Base stats (level only)
    const baseStats = getStatsForLevel(level);
    // Full stats (level + equipment)
    const fullStats = computePlayerStats(level, equipment);

    // Weapon base stats (before open stat bonuses)
    const weaponItem = equipment[ItemCategory.Weapon];
    let weaponCooldown = baseStats.shootCooldown;
    let weaponBaseDamage = baseStats.damage;
    if (weaponItem && !isEmptyItem(weaponItem)) {
      if (weaponItem.isUT) {
        const def = ITEM_DEFS[weaponItem.baseItemId];
        if (def?.weaponStats) {
          weaponCooldown = def.weaponStats.shootCooldown;
          weaponBaseDamage = def.weaponStats.damage;
        }
      } else {
        const subtype = getItemSubtype(weaponItem.baseItemId);
        const scaled = getScaledWeaponStats(subtype, weaponItem.instanceTier, weaponItem.lockedStat1Tier, weaponItem.lockedStat2Tier);
        weaponCooldown = scaled.shootCooldown;
        weaponBaseDamage = scaled.damage;
      }
    }

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
    const dmgBonus = fullStats.damage - weaponBaseDamage;
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
    const baseAtkSpd = 1000 / Math.max(MIN_SHOOT_COOLDOWN, weaponCooldown);
    const fullAtkSpd = 1000 / fullStats.shootCooldown;
    const atkSpdBonus = +(fullAtkSpd - baseAtkSpd).toFixed(2);
    this.setStatRow(3, fullAtkSpd.toFixed(2) + "/s", atkSpdBonus);
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
    this.setStatRow(12, Math.round(fullStats.hpRegen) + "/s", hpRegenBonus);
    // Row 13: Max Mana
    this.setStatRow(13, String(Math.round(fullStats.maxMana)), manaBonus);
    // Row 14: Mana Regen
    this.setStatRow(14, Math.round(fullStats.manaRegen) + "/s", manaRegenBonus);
    // Row 15: Physical Damage Reduction
    this.setStatRow(15, Math.round(fullStats.physDmgReduce) + "%", fullStats.physDmgReduce, undefined, "%");
    // Row 16: Magic Damage Reduction
    this.setStatRow(16, Math.round(fullStats.magicDmgReduce) + "%", fullStats.magicDmgReduce, undefined, "%");
    // Row 17: Movement Speed
    this.setStatRow(17, String(Math.round(fullStats.speed)), speedBonus);
    // Row 18: Level
    this.setStatRow(18, String(level));
  }

  private setStatRow(
    index: number,
    value: string,
    bonus?: number,
    valueColor?: string,
    bonusSuffix?: string
  ): void {
    this.statValueTexts[index].setText(value);
    this.statValueTexts[index].setColor(valueColor ?? "#ffffff");

    if (bonus !== undefined && Math.abs(bonus) >= 0.1) {
      const sign = bonus > 0 ? "+" : "";
      const formatted = Number.isInteger(bonus) ? String(Math.round(bonus)) : bonus.toFixed(1);
      const sfx = bonusSuffix ?? "";
      this.statBonusTexts[index].setText(`(${sign}${formatted}${sfx})`);
      this.statBonusTexts[index].setColor(bonus > 0 ? "#88ccff" : "#ff6666");
    } else {
      this.statBonusTexts[index].setText("");
    }
  }

  private setAllVisible(v: boolean): void {
    this.panelBg.setVisible(v);
    this.contentContainer.setVisible(v);
    this.scrollBarBg.setVisible(v);
    this.scrollBarThumb.setVisible(v);
    if (!v) {
      this.panelBg.clear();
      this.scrollBarBg.clear();
      this.scrollBarThumb.clear();
    }
  }
}
