import Phaser from "phaser";
import {
  ITEM_DEFS,
  getCategoryName,
  getItemCategory,
  getItemSubtype,
  getItemInstanceName,
  getItemColor,
  ItemCategory,
  STAT_NAMES,
  getStatValue,
  getScaledWeaponStats,
  getScaledAbilityStats,
  ORB_DEFINITIONS,
  TIER_COLORS,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";
import { getSlotBorderColor } from "./ItemIcons";

const BASE_TOOLTIP_WIDTH = 180;
const BASE_TOOLTIP_PADDING = 8;

export class ItemTooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;
  private dividerAboveLockedText: Phaser.GameObjects.Text;
  private lockedStatsText: Phaser.GameObjects.Text;
  private dividerBelowLockedText: Phaser.GameObjects.Text;
  private openStatsText: Phaser.GameObjects.Text;
  private hiddenStatsText: Phaser.GameObjects.Text;
  private shiftHintText: Phaser.GameObjects.Text;
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
    const cx = this.tooltipWidth / 2;
    const wrapWidth = this.tooltipWidth - this.tooltipPadding * 2;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(300)
      .setVisible(false);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.nameText = scene.add
      .text(cx, this.tooltipPadding, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.nameText);

    const tierY = this.tooltipPadding + Math.round(16 * S);
    this.tierText = scene.add
      .text(cx, tierY, "", {
        fontSize: tierFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0);
    this.container.add(this.tierText);

    const statsY = tierY + Math.round(16 * S);
    this.statsText = scene.add
      .text(cx, statsY, "", {
        fontSize: statsFontSize,
        color: "#aaffaa",
        fontFamily: "monospace",
        lineSpacing: 2,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.statsText);

    this.dividerAboveLockedText = scene.add
      .text(cx, 0, "────────────", {
        fontSize: statsFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0);
    this.container.add(this.dividerAboveLockedText);

    this.lockedStatsText = scene.add
      .text(cx, statsY, "", {
        fontSize: statsFontSize,
        color: "#8a7a6a",
        fontFamily: "monospace",
        lineSpacing: 2,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.lockedStatsText);

    this.dividerBelowLockedText = scene.add
      .text(cx, 0, "────────────", {
        fontSize: statsFontSize,
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0);
    this.container.add(this.dividerBelowLockedText);

    this.openStatsText = scene.add
      .text(cx, statsY, "", {
        fontSize: statsFontSize,
        color: "#88ccff",
        fontFamily: "monospace",
        lineSpacing: 2,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.openStatsText);

    this.hiddenStatsText = scene.add
      .text(cx, 0, "", {
        fontSize: statsFontSize,
        color: "#aaffaa",
        fontFamily: "monospace",
        lineSpacing: 2,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.hiddenStatsText);

    this.shiftHintText = scene.add
      .text(cx, 0, "[SHIFT] for more info", {
        fontSize: `${Math.round(9 * S)}px`,
        color: "#888888",
        fontFamily: "monospace",
        fontStyle: "italic",
        align: "center",
      })
      .setOrigin(0.5, 0);
    this.container.add(this.shiftHintText);

    this.descText = scene.add
      .text(cx, statsY, "", {
        fontSize: descFontSize,
        color: "#888899",
        fontFamily: "monospace",
        fontStyle: "italic",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.descText);
  }

  /** Show tooltip for an item instance. */
  show(item: ItemInstanceData, screenX: number, screenY: number, shiftHeld: boolean = false): void {
    if (item.baseItemId < 0) {
      this.hide();
      return;
    }

    const category = getItemCategory(item.baseItemId);
    const subtype = getItemSubtype(item.baseItemId);
    const S = this.S;
    const statsStartY = this.tooltipPadding + Math.round(32 * S);

    // For UT items and consumables, fall back to static ITEM_DEFS display
    if (item.isUT || category === ItemCategory.Consumable) {
      this.showStaticItem(item.baseItemId, screenX, screenY);
      return;
    }

    // Crafting orbs
    if (category === ItemCategory.CraftingOrb) {
      this.showCraftingOrb(subtype, screenX, screenY);
      return;
    }

    // --- Tiered item display ---
    const itemName = getItemInstanceName(item);
    this.nameText.setText(itemName);
    this.nameText.setColor("#ffffff");

    const tierLabel = `T${item.instanceTier} ${getCategoryName(category)}`;
    this.tierText.setText(tierLabel);
    this.tierText.setColor("#aaaaaa");

    // Clear base stats text (no longer used for tiered items)
    this.statsText.setText("");
    this.statsText.setY(statsStartY);

    // === Build locked stats per category ===
    const lockedLines: string[] = [];
    const hiddenLines: string[] = [];

    if (category === ItemCategory.Weapon) {
      const ws = getScaledWeaponStats(subtype, item.instanceTier, item.lockedStat1Tier, item.lockedStat2Tier);
      const dmgTier = shiftHeld && item.lockedStat1Tier > 0 ? ` (T${item.lockedStat1Tier})` : "";
      const frTier = shiftHeld && item.lockedStat2Tier > 0 ? ` (T${item.lockedStat2Tier})` : "";
      lockedLines.push(`Damage: ${ws.damage}${dmgTier}`);
      lockedLines.push(`Fire Rate: ${(1000 / ws.shootCooldown).toFixed(1)}/s${frTier}`);
      // Range is hidden (shift only)
      hiddenLines.push(`Range: ${ws.range}`);
    } else if (category === ItemCategory.Ability) {
      const as = getScaledAbilityStats(subtype, item.instanceTier, item.lockedStat1Tier, item.lockedStat2Tier);
      const dmgTier = shiftHeld && item.lockedStat1Tier > 0 ? ` (T${item.lockedStat1Tier})` : "";
      const manaTier = shiftHeld && item.lockedStat2Tier > 0 ? ` (T${item.lockedStat2Tier})` : "";
      lockedLines.push(`Damage: ${as.damage}${dmgTier}`);
      lockedLines.push(`Mana Cost: ${as.manaCost}${manaTier}`);
      // Range and piercing are hidden (shift only)
      hiddenLines.push(`Range: ${as.range}`);
      if (as.piercing) hiddenLines.push(`Piercing: Yes`);
    } else {
      // Armor and Ring: use rolled locked stat bonuses
      if (item.lockedStat1Type >= 0 && item.lockedStat1Tier > 0) {
        const val = getStatValue(item.lockedStat1Type, item.lockedStat1Tier, item.instanceTier, true);
        const name = STAT_NAMES[item.lockedStat1Type] ?? "???";
        const tierInfo = shiftHeld ? ` (T${item.lockedStat1Tier})` : "";
        lockedLines.push(`+${formatStatValue(val)} ${name}${tierInfo}`);
      }
      if (item.lockedStat2Type >= 0 && item.lockedStat2Tier > 0) {
        const val = getStatValue(item.lockedStat2Type, item.lockedStat2Tier, item.instanceTier, true);
        const name = STAT_NAMES[item.lockedStat2Type] ?? "???";
        const tierInfo = shiftHeld ? ` (T${item.lockedStat2Tier})` : "";
        lockedLines.push(`+${formatStatValue(val)} ${name}${tierInfo}`);
      }
    }

    // === Divider above locked stats ===
    let currentY = statsStartY;
    if (lockedLines.length > 0) {
      this.dividerAboveLockedText.setText("────────────");
      this.dividerAboveLockedText.setY(currentY);
      currentY += this.dividerAboveLockedText.height + 2;
    } else {
      this.dividerAboveLockedText.setText("");
    }

    // === Locked stats ===
    this.lockedStatsText.setText(lockedLines.join("\n"));
    this.lockedStatsText.setY(currentY);
    if (lockedLines.length > 0) {
      currentY += this.lockedStatsText.height + 2;
    }

    // === Open stats ===
    const openLines: string[] = [];
    const openStatCount = Math.floor(item.openStats.length / 2);
    if (openStatCount > 0) {
      for (let i = 0; i < item.openStats.length; i += 2) {
        const sType = item.openStats[i];
        const sTier = item.openStats[i + 1];
        const val = getStatValue(sType, sTier, item.instanceTier);
        const name = STAT_NAMES[sType] ?? "???";
        const forgeIcon = item.forgeProtectedSlot === Math.floor(i / 2) ? " [P]" : "";
        const tierInfo = shiftHeld ? ` (T${sTier})` : "";
        openLines.push(`+${formatStatValue(val)} ${name}${tierInfo}${forgeIcon}`);
      }
    }

    // === Divider below locked stats (always shown when locked stats exist) ===
    if (lockedLines.length > 0) {
      this.dividerBelowLockedText.setText("────────────");
      this.dividerBelowLockedText.setY(currentY);
      currentY += this.dividerBelowLockedText.height + 2;
    } else {
      this.dividerBelowLockedText.setText("");
    }

    this.openStatsText.setText(openLines.join("\n"));
    this.openStatsText.setY(currentY);
    if (openStatCount > 0) {
      currentY += this.openStatsText.height;
    }

    // === Hidden stats (shift-only) ===
    if (shiftHeld && hiddenLines.length > 0) {
      this.hiddenStatsText.setText(hiddenLines.join("\n"));
      this.hiddenStatsText.setY(currentY + 4);
      currentY += 4 + this.hiddenStatsText.height;
      this.hiddenStatsText.setVisible(true);
    } else {
      this.hiddenStatsText.setText("");
      this.hiddenStatsText.setVisible(false);
    }

    // === SHIFT hint ===
    const hasHiddenContent = hiddenLines.length > 0 || lockedLines.length > 0 || openStatCount > 0;
    if (!shiftHeld && hasHiddenContent) {
      this.shiftHintText.setY(currentY + 10);
      this.shiftHintText.setVisible(true);
      currentY += 10 + this.shiftHintText.height;
    } else {
      this.shiftHintText.setVisible(false);
    }

    const statsBottom = currentY + 4;
    this.descText.setY(statsBottom);
    this.descText.setText("");

    const totalHeight = statsBottom + this.descText.height + this.tooltipPadding;
    const borderTier = item.isUT ? 13 : item.instanceTier;
    this.drawBgAndPosition(totalHeight, getSlotBorderColor(borderTier), screenX, screenY);
  }

  /** Show tooltip for a static item by ID (consumables, UT items). */
  showById(itemId: number, screenX: number, screenY: number): void {
    this.showStaticItem(itemId, screenX, screenY);
  }

  private showStaticItem(itemId: number, screenX: number, screenY: number): void {
    const def = ITEM_DEFS[itemId];
    if (!def) {
      this.hide();
      return;
    }

    const S = this.S;
    const statsStartY = this.tooltipPadding + Math.round(32 * S);

    // Name
    this.nameText.setText(def.name);
    this.nameText.setColor("#ffffff");

    // Tier + category
    if (def.consumableStats) {
      this.tierText.setText(getCategoryName(def.category));
      this.tierText.setColor("#aaaaaa");
    } else {
      const tierLabel = def.tier === 13 ? "UT" : `T${def.tier}`;
      this.tierText.setText(`${tierLabel} ${getCategoryName(def.category)}`);
      this.tierText.setColor(def.tier === 13 ? "#ffaa00" : "#aaaaaa");
    }

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
    } else if (def.consumableStats) {
      if (def.consumableStats.healAmount) {
        statsLines.push(`Heals: ${def.consumableStats.healAmount} HP`);
      }
      if (def.consumableStats.manaAmount) {
        statsLines.push(`Restores: ${def.consumableStats.manaAmount} Mana`);
      }
      statsLines.push(`Max Stack: ${def.consumableStats.maxStack}`);
    }
    this.statsText.setText(statsLines.join("\n"));
    this.statsText.setY(statsStartY);

    // Clear tiered-only text elements
    this.dividerAboveLockedText.setText("");
    this.lockedStatsText.setText("");
    this.dividerBelowLockedText.setText("");
    this.openStatsText.setText("");
    this.hiddenStatsText.setText("");
    this.hiddenStatsText.setVisible(false);
    this.shiftHintText.setVisible(false);

    // Description
    const statsBottom = statsStartY + this.statsText.height + 4;
    this.descText.setY(statsBottom);
    this.descText.setText(def.description);

    const totalHeight = statsBottom + this.descText.height + this.tooltipPadding;
    this.drawBgAndPosition(totalHeight, getSlotBorderColor(def.tier), screenX, screenY);
  }

  private showCraftingOrb(orbType: number, screenX: number, screenY: number): void {
    const orbDef = ORB_DEFINITIONS[orbType];
    if (!orbDef) {
      this.hide();
      return;
    }

    const S = this.S;
    const statsStartY = this.tooltipPadding + Math.round(32 * S);

    this.nameText.setText(orbDef.name);
    const colorStr = `#${orbDef.color.toString(16).padStart(6, "0")}`;
    this.nameText.setColor(colorStr);

    this.tierText.setText("Crafting Orb");
    this.tierText.setColor("#aaaaaa");

    this.statsText.setText("");
    this.statsText.setY(statsStartY);

    // Clear tiered-only text elements
    this.dividerAboveLockedText.setText("");
    this.lockedStatsText.setText("");
    this.dividerBelowLockedText.setText("");
    this.openStatsText.setText("");
    this.hiddenStatsText.setText("");
    this.hiddenStatsText.setVisible(false);
    this.shiftHintText.setVisible(false);

    const statsBottom = statsStartY + this.statsText.height + 4;
    this.descText.setY(statsBottom);
    this.descText.setText(orbDef.description);

    const totalHeight = statsBottom + this.descText.height + this.tooltipPadding;
    this.drawBgAndPosition(totalHeight, orbDef.color, screenX, screenY);
  }

  private drawBgAndPosition(totalHeight: number, borderColor: number, screenX: number, screenY: number): void {
    const S = this.S;

    this.bg.clear();
    this.bg.fillStyle(0x111122, 0.95);
    this.bg.fillRoundedRect(0, 0, this.tooltipWidth, totalHeight, 4);
    this.bg.lineStyle(1, borderColor, 0.8);
    this.bg.strokeRoundedRect(0, 0, this.tooltipWidth, totalHeight, 4);

    // Position: above the cursor, centered horizontally
    let tx = screenX - this.tooltipWidth / 2;
    let ty = screenY - totalHeight - Math.round(8 * S);

    // Clamp to screen bounds
    const sw = this.scene.scale.width;
    if (tx + this.tooltipWidth > sw - 4) tx = sw - this.tooltipWidth - 4;
    if (tx < 4) tx = 4;
    if (ty < 4) ty = screenY + Math.round(20 * S); // flip below if too high

    this.container.setPosition(tx, ty);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }
}

function formatStatValue(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}
