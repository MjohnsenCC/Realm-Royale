import Phaser from "phaser";
import {
  ITEM_DEFS,
  getCategoryName,
  getItemCategory,
  getItemSubtype,
  getItemInstanceName,
  getSubtypeName,
  ItemCategory,
  StatType,
  STAT_NAMES,
  STAT_TITLES,
  STAT_DESCRIPTIONS,
  getStatValue,
  getStatRange,
  getLockedStatValue,
  getLockedStatRange,
  getScaledWeaponStats,
  getScaledAbilityStats,
  getScaledWeaponStatsRange,
  getScaledAbilityStatsRange,
  ORB_DEFINITIONS,
  ORB_MAX_STACK,
  ARMOR_LOCKED_STAT_MULTIPLIER,
  getEquippableClassNames,
} from "@rotmg-lite/shared";
import type { ItemInstanceData } from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";
import { getSlotBorderColor } from "./ItemIcons";
import { getItemSpriteKey, getItemOutlinedSize } from "./ItemTextures";
import { UI_PANEL_CORNER } from "./UITextures";

const BASE_TOOLTIP_WIDTH = 240;
const BASE_TOOLTIP_PADDING = 8;
const BASE_BANNER_HEIGHT = 32;
const BASE_STAT_ICON_SIZE = 18;

/** Generic placeholder descriptions by category+subtype. */
function getPlaceholderDesc(category: number, subtype: number): string {
  const name = getSubtypeName(category, subtype);
  switch (category) {
    case ItemCategory.Weapon:
      return `A powerful ${name.toLowerCase()}.`;
    case ItemCategory.Ability:
      return `A mystic ${name.toLowerCase()}.`;
    case ItemCategory.Armor:
      return `A sturdy ${name.toLowerCase()}.`;
    case ItemCategory.Ring:
      return "A ring imbued with magical energy.";
    default:
      return "";
  }
}

/** Fixed tier badge color — always light grey for readability. */
const TIER_BADGE_COLOR = "#cccccc";

/**
 * Set a sprite's texture and display size to match the pre-rendered outlined
 * texture exactly (1:1 pixels), so the 1px outline stays crisp on all sides.
 */
function setSpriteTexture1to1(sprite: Phaser.GameObjects.Image, key: string): void {
  sprite.setTexture(key);
  const outlinedSize = getItemOutlinedSize();
  sprite.setDisplaySize(outlinedSize, outlinedSize);
}

export class ItemTooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bgPanel: Phaser.GameObjects.NineSlice;
  private bgOverlay: Phaser.GameObjects.Graphics;

  // Header
  private itemSprite: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private tierBadge: Phaser.GameObjects.Text;

  // Below banner
  private classText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;

  // Locked stats pool (max 2)
  private lockedStatPool: Phaser.GameObjects.Text[] = [];

  // Open stats pool (max 5) — icon + text
  private openStatPool: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }[] = [];

  // Generic stats text (for static/consumable items)
  private statsText: Phaser.GameObjects.Text;

  // Shift hint
  private shiftHintText: Phaser.GameObjects.Text;

  // Divider Y positions (drawn each frame in drawBgAndPosition)
  private dividerYs: number[] = [];

  private S: number;
  private tooltipWidth: number;
  private tooltipPadding: number;
  private bannerHeight: number;
  private spriteSize: number;
  private statIconSize: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.S = getUIScale();
    const S = this.S;
    this.tooltipWidth = Math.round(BASE_TOOLTIP_WIDTH * S);
    this.tooltipPadding = Math.round(BASE_TOOLTIP_PADDING * S);
    this.spriteSize = getItemOutlinedSize();
    this.bannerHeight = Math.max(Math.round(BASE_BANNER_HEIGHT * S), this.spriteSize + Math.round(6 * S));
    this.statIconSize = Math.round(BASE_STAT_ICON_SIZE * S);

    const pad = this.tooltipPadding;
    const nameFontSize = `${Math.round(8 * S)}px`;
    const tierFontSize = `${Math.round(7 * S)}px`;
    const smallFontSize = `${Math.round(6 * S)}px`;
    const statFontSize = `${Math.round(6 * S)}px`;
    const wrapWidth = this.tooltipWidth - pad * 2;
    const nameWrapWidth = this.tooltipWidth - pad * 2 - this.spriteSize - Math.round(4 * S) - Math.round(30 * S);

    const fontFamily = "'Press Start 2P', monospace";
    const stroke = "#000000";
    const strokeThickness = 2;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(300)
      .setVisible(false);

    const C = UI_PANEL_CORNER;
    this.bgPanel = scene.add
      .nineslice(0, 0, "ui-panel-tooltip", undefined, 100, 100, C, C, C, C)
      .setOrigin(0, 0);
    this.container.add(this.bgPanel);

    this.bgOverlay = scene.add.graphics();
    this.container.add(this.bgOverlay);

    // Item sprite in banner top-left (display size set per-show via setSpriteTexture1to1)
    this.itemSprite = scene.add
      .image(pad + this.spriteSize / 2, this.bannerHeight / 2, "__DEFAULT")
      .setVisible(false);
    this.container.add(this.itemSprite);

    // Name text — left-aligned, right of sprite
    const nameX = pad + this.spriteSize + Math.round(4 * S);
    this.nameText = scene.add
      .text(nameX, this.bannerHeight / 2, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily,
        fontStyle: "bold",
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0.5)
      .setWordWrapWidth(nameWrapWidth);
    this.container.add(this.nameText);

    // Tier badge — right-aligned in banner
    this.tierBadge = scene.add
      .text(this.tooltipWidth - pad, this.bannerHeight / 2, "", {
        fontSize: tierFontSize,
        color: "#aaaaaa",
        fontFamily,
        align: "right",
        stroke,
        strokeThickness,
      })
      .setOrigin(1, 0.5);
    this.container.add(this.tierBadge);

    // Class text — below banner
    this.classText = scene.add
      .text(pad, 0, "", {
        fontSize: smallFontSize,
        color: "#aaaaaa",
        fontFamily,
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.classText);

    // Description text
    this.descText = scene.add
      .text(pad, 0, "", {
        fontSize: smallFontSize,
        color: "#888899",
        fontFamily,
        fontStyle: "italic",
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.descText);

    // Locked stat pool (2 entries)
    for (let i = 0; i < 2; i++) {
      const txt = scene.add
        .text(pad, 0, "", {
          fontSize: statFontSize,
          color: "#ffffff",
          fontFamily,
          align: "left",
          stroke,
          strokeThickness,
        })
        .setOrigin(0, 0)
        .setWordWrapWidth(wrapWidth)
        .setVisible(false);
      this.container.add(txt);
      this.lockedStatPool.push(txt);
    }

    // Open stat pool (5 entries, each with icon + text)
    const iconX = pad + this.statIconSize / 2;
    const statTextX = pad + this.statIconSize + Math.round(3 * S);
    for (let i = 0; i < 5; i++) {
      const icon = scene.add
        .image(iconX, 0, "open-stat-icon-t1")
        .setDisplaySize(this.statIconSize, this.statIconSize)
        .setVisible(false);
      this.container.add(icon);

      const txt = scene.add
        .text(statTextX, 0, "", {
          fontSize: statFontSize,
          color: "#66bbff",
          fontFamily,
          align: "left",
          stroke,
          strokeThickness,
        })
        .setOrigin(0, 0)
        .setWordWrapWidth(wrapWidth - this.statIconSize - Math.round(3 * S))
        .setVisible(false);
      this.container.add(txt);

      this.openStatPool.push({ icon, text: txt });
    }

    // Generic stats text (for static items / consumables / UT lore)
    this.statsText = scene.add
      .text(pad, 0, "", {
        fontSize: statFontSize,
        color: "#aaffaa",
        fontFamily,
        lineSpacing: 2,
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.statsText);

    // Shift hint
    this.shiftHintText = scene.add
      .text(pad, 0, "[SHIFT] for more info", {
        fontSize: smallFontSize,
        color: "#888888",
        fontFamily,
        fontStyle: "italic",
        align: "left",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0)
      .setWordWrapWidth(wrapWidth);
    this.container.add(this.shiftHintText);
  }

  /** Show tooltip for an item instance. */
  show(item: ItemInstanceData, screenX: number, screenY: number, shiftHeld: boolean = false): void {
    if (item.baseItemId < 0) {
      this.hide();
      return;
    }

    const category = getItemCategory(item.baseItemId);
    const subtype = getItemSubtype(item.baseItemId);

    // Consumables still use static ITEM_DEFS display
    if (category === ItemCategory.Consumable) {
      this.showStaticItem(item.baseItemId, screenX, screenY);
      return;
    }

    // Crafting orbs
    if (category === ItemCategory.CraftingOrb) {
      this.showCraftingOrb(subtype, screenX, screenY);
      return;
    }

    // --- Tiered item display ---
    const S = this.S;
    const pad = this.tooltipPadding;
    this.clearAll();

    // Banner: sprite, name, tier badge
    const spriteKey = getItemSpriteKey(category, subtype, item.instanceTier, item.isUT);
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      setSpriteTexture1to1(this.itemSprite, spriteKey);
      this.itemSprite.setVisible(true);
    } else {
      this.itemSprite.setVisible(false);
    }

    const itemName = getItemInstanceName(item);
    this.nameText.setText(itemName);
    this.nameText.setColor("#ffffff");

    const tierLabel = item.isUT ? "UT" : `T${item.instanceTier}`;
    this.tierBadge.setText(tierLabel);
    this.tierBadge.setColor(TIER_BADGE_COLOR);

    // Dynamic banner height
    const bannerH = Math.max(this.bannerHeight, this.nameText.height + Math.round(8 * S));
    this.itemSprite.setY(bannerH / 2);
    this.nameText.setY(bannerH / 2);
    this.tierBadge.setY(bannerH / 2);

    // Consistent spacing constants
    const sectionGap = Math.round(8 * S);   // space above/below dividers
    const lineGap = Math.round(3 * S);      // space between lines within a section
    const itemGap = Math.round(6 * S);      // space between content sections

    let currentY = bannerH + itemGap;

    // Class names
    const classNames = getEquippableClassNames(category, subtype);
    if (classNames.length > 0) {
      this.classText.setText(classNames.join(", "));
      this.classText.setY(currentY);
      this.classText.setVisible(true);
      currentY += this.classText.height + lineGap;
    } else {
      this.classText.setVisible(false);
    }

    // Description placeholder
    const desc = getPlaceholderDesc(category, subtype);
    if (desc) {
      this.descText.setText(desc);
      this.descText.setColor("#888899");
      this.descText.setFontStyle("italic");
      this.descText.setY(currentY);
      this.descText.setVisible(true);
      currentY += this.descText.height;
    } else {
      this.descText.setVisible(false);
    }

    // === Build locked stats (value determined by item tier + roll, no stat tiers) ===
    const lockedLines: string[] = [];

    // For UT weapons/abilities, read base stats from ITEM_DEFS
    const utDef = item.isUT ? ITEM_DEFS[item.baseItemId] : undefined;
    const utWeaponBase = utDef?.weaponStats ? {
      baseDamage: utDef.weaponStats.damage, baseCooldown: utDef.weaponStats.shootCooldown,
      baseRange: utDef.weaponStats.range, baseProjSpeed: utDef.weaponStats.projectileSpeed,
      baseProjSize: utDef.weaponStats.projectileSize,
    } : undefined;
    const utAbilityBase = utDef?.abilityStats ? {
      baseDamage: utDef.abilityStats.damage, baseCooldown: utDef.abilityStats.cooldown,
      baseRange: utDef.abilityStats.range, baseProjSpeed: utDef.abilityStats.projectileSpeed,
      baseProjSize: utDef.abilityStats.projectileSize, baseManaCost: utDef.abilityStats.manaCost,
      piercing: utDef.abilityStats.piercing,
    } : undefined;

    if (category === ItemCategory.Weapon) {
      const ws = getScaledWeaponStats(subtype, item.instanceTier, item.lockedStat1Roll, item.lockedStat2Roll, item.isUT, utWeaponBase);
      // Sum open stat bonuses from this weapon's own open stats
      let openDmgBonus = 0;
      let openFireRateBonus = 0;
      for (let i = 0; i < item.openStats.length; i += 3) {
        const sType = item.openStats[i];
        const sTier = item.openStats[i + 1];
        const sRoll = item.openStats[i + 2];
        if (sType === StatType.AttackDamage) openDmgBonus += getStatValue(sType, sTier, sRoll);
        if (sType === StatType.AttackSpeed) openFireRateBonus += getStatValue(sType, sTier, sRoll);
      }
      const baseFireRate = Math.round(90 + 20 * (item.lockedStat2Roll / 100));
      const fireRatePercent = baseFireRate + openFireRateBonus;
      const dmg = ws.damage + openDmgBonus;
      if (shiftHeld) {
        const range = getScaledWeaponStatsRange(subtype, item.instanceTier, item.isUT, utWeaponBase);
        lockedLines.push(`Damage: ${dmg}(${range.damageMin + openDmgBonus}-${range.damageMax + openDmgBonus})`);
        lockedLines.push(`Fire Rate: ${fireRatePercent}%(${90 + openFireRateBonus}%-${110 + openFireRateBonus}%)`);
      } else {
        lockedLines.push(`Damage: ${dmg}`);
        lockedLines.push(`Fire Rate: ${fireRatePercent}%`);
      }
    } else if (category === ItemCategory.Ability) {
      const as = getScaledAbilityStats(subtype, item.instanceTier, item.lockedStat1Roll, item.lockedStat2Roll, item.isUT, utAbilityBase);
      if (shiftHeld) {
        const range = getScaledAbilityStatsRange(subtype, item.instanceTier, item.isUT, utAbilityBase);
        lockedLines.push(`Damage: ${as.damage}(${range.damageMin}-${range.damageMax})`);
        lockedLines.push(`Mana Cost: ${as.manaCost}(${range.manaCostMin}-${range.manaCostMax})`);
      } else {
        lockedLines.push(`Damage: ${as.damage}`);
        lockedLines.push(`Mana Cost: ${as.manaCost}`);
      }
    } else {
      // Armor and Ring: locked stat values determined by item tier (or UT range)
      const armorMult = category === ItemCategory.Armor
        ? (ARMOR_LOCKED_STAT_MULTIPLIER[subtype] ?? 1.0)
        : 1.0;
      if (item.lockedStat1Type >= 0) {
        const rawVal = getLockedStatValue(item.lockedStat1Type, item.instanceTier, item.lockedStat1Roll, item.isUT);
        const val = armorMult !== 1.0 ? Math.round(rawVal * armorMult) : rawVal;
        const name = STAT_NAMES[item.lockedStat1Type] ?? "???";
        if (shiftHeld) {
          const [rawMin, rawMax] = getLockedStatRange(item.lockedStat1Type, item.instanceTier, item.isUT);
          const min = armorMult !== 1.0 ? Math.round(rawMin * armorMult) : rawMin;
          const max = armorMult !== 1.0 ? Math.round(rawMax * armorMult) : rawMax;
          lockedLines.push(`+${fmtStat(val)}(${fmtStat(min)}-${fmtStat(max)}) ${name}`);
        } else {
          lockedLines.push(`+${fmtStat(val)} ${name}`);
        }
      }
      if (item.lockedStat2Type >= 0) {
        const rawVal = getLockedStatValue(item.lockedStat2Type, item.instanceTier, item.lockedStat2Roll, item.isUT);
        const val = armorMult !== 1.0 ? Math.round(rawVal * armorMult) : rawVal;
        const name = STAT_NAMES[item.lockedStat2Type] ?? "???";
        if (shiftHeld) {
          const [rawMin, rawMax] = getLockedStatRange(item.lockedStat2Type, item.instanceTier, item.isUT);
          const min = armorMult !== 1.0 ? Math.round(rawMin * armorMult) : rawMin;
          const max = armorMult !== 1.0 ? Math.round(rawMax * armorMult) : rawMax;
          lockedLines.push(`+${fmtStat(val)}(${fmtStat(min)}-${fmtStat(max)}) ${name}`);
        } else {
          lockedLines.push(`+${fmtStat(val)} ${name}`);
        }
      }
    }

    // === Build open stats ===
    const openTitles: string[] = [];
    const openDescs: string[] = [];
    const openTiers: number[] = [];
    const openForgeProtected: boolean[] = [];
    const openStatCount = Math.floor(item.openStats.length / 3);
    if (openStatCount > 0) {
      for (let i = 0; i < item.openStats.length; i += 3) {
        const sType = item.openStats[i];
        const sTier = item.openStats[i + 1];
        const sRoll = item.openStats[i + 2];
        const val = getStatValue(sType, sTier, sRoll);
        const suffix = isPercentStat(sType) ? "%" : "";
        const title = STAT_TITLES[sType] ?? "???";
        const descTemplate = STAT_DESCRIPTIONS[sType] ?? `+{value} ${STAT_NAMES[sType] ?? "???"}`;
        let desc: string;
        if (shiftHeld) {
          const [min, max] = getStatRange(sType, sTier);
          desc = descTemplate.replace("{value}", `${fmtStat(val)}(${fmtStat(min)}-${fmtStat(max)})${suffix}`);
        } else {
          desc = descTemplate.replace("{value}", `${fmtStat(val)}${suffix}`);
        }
        openTitles.push(title + ":");
        openDescs.push(desc);
        openTiers.push(sTier);
        const slotIdx = Math.floor(i / 3);
        openForgeProtected.push(item.forgeProtectedSlot === slotIdx || item.forgeProtectedSlot2 === slotIdx);
      }
    }

    // === Layout locked stats ===
    this.dividerYs = [];

    if (lockedLines.length > 0) {
      // Divider above locked stats (symmetric spacing)
      currentY += sectionGap;
      this.dividerYs.push(currentY);
      currentY += sectionGap;

      for (let i = 0; i < lockedLines.length; i++) {
        const txt = this.lockedStatPool[i];
        txt.setText(lockedLines[i]);
        txt.setColor("#ffffff");
        txt.setY(currentY);
        txt.setVisible(true);
        currentY += txt.height + lineGap;
      }
    }

    // === Layout open stats or UT unique stats ===
    const statTextX = this.tooltipPadding + this.statIconSize + Math.round(3 * this.S);
    const statWrapW = this.tooltipWidth - this.tooltipPadding * 2 - this.statIconSize - Math.round(3 * this.S);
    const statDescColor = "#66bbff";
    if (item.isUT) {
      // UT items: show unique stats with UT icon (same layout as open stats)
      const utDef2 = ITEM_DEFS[item.baseItemId];
      const uStats = utDef2?.uniqueStats;
      if (uStats && uStats.length > 0) {
        currentY += sectionGap;
        this.dividerYs.push(currentY);
        currentY += sectionGap;

        for (let i = 0; i < uStats.length && i < this.openStatPool.length; i++) {
          const entry = this.openStatPool[i];
          const stat = uStats[i];
          const titleStr = stat.title + ": ";

          entry.text.setX(statTextX);
          entry.text.setWordWrapWidth(statWrapW);
          entry.text.setLineSpacing(Math.round(4 * this.S));
          setStatTextWithTitle(entry.text, titleStr, titleStr + stat.desc, statDescColor);
          entry.text.setVisible(true);

          entry.icon.setTexture("ut-stat-icon");
          entry.icon.setDisplaySize(this.statIconSize, this.statIconSize);
          const rowH = Math.max(entry.text.height, this.statIconSize);
          entry.text.setY(currentY + (rowH - entry.text.height) / 2);
          entry.icon.setY(currentY + rowH / 2);
          entry.icon.setVisible(true);

          currentY += rowH + Math.round(7 * this.S);
        }
      }
    } else if (openDescs.length > 0) {
      // Divider between locked and open (symmetric spacing)
      currentY += sectionGap;
      this.dividerYs.push(currentY);
      currentY += sectionGap;

      for (let i = 0; i < openDescs.length; i++) {
        const entry = this.openStatPool[i];
        const titleStr = openTitles[i] + " ";
        const desc = openDescs[i];

        const descColor = openForgeProtected[i] ? "#ffaa00" : statDescColor;
        entry.text.setX(statTextX);
        entry.text.setWordWrapWidth(statWrapW);
        entry.text.setLineSpacing(Math.round(4 * this.S));
        setStatTextWithTitle(entry.text, titleStr, titleStr + desc, descColor);
        entry.text.setVisible(true);

        const tierKey = `open-stat-icon-t${Math.min(Math.max(openTiers[i], 1), 6)}`;
        entry.icon.setTexture(tierKey);
        entry.icon.setDisplaySize(this.statIconSize, this.statIconSize);
        const rowH = Math.max(entry.text.height, this.statIconSize);
        entry.text.setY(currentY + (rowH - entry.text.height) / 2);
        entry.icon.setY(currentY + rowH / 2);
        entry.icon.setVisible(true);

        currentY += rowH + Math.round(7 * this.S);
      }
    }

    this.shiftHintText.setVisible(false);

    const totalHeight = currentY + pad;
    const borderTier = item.isUT ? 13 : item.instanceTier;
    const bannerColor = item.isUT ? 0xffaa00 : 0x666688;
    this.drawBgAndPosition(totalHeight, bannerH, getSlotBorderColor(borderTier), bannerColor, screenX, screenY);
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

    // Consumables use the same layout as crafting orbs
    if (def.consumableStats) {
      this.showConsumable(def, itemId, screenX, screenY);
      return;
    }

    const S = this.S;
    const pad = this.tooltipPadding;
    this.clearAll();

    const category = getItemCategory(itemId);
    const subtype = getItemSubtype(itemId);

    // Banner: sprite, name, tier badge
    const spriteKey = getItemSpriteKey(category, subtype);
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      setSpriteTexture1to1(this.itemSprite, spriteKey);
      this.itemSprite.setVisible(true);
    } else {
      this.itemSprite.setVisible(false);
    }

    this.nameText.setText(def.name);
    this.nameText.setColor("#ffffff");

    const tierLabel = def.tier === 13 ? "UT" : `T${def.tier}`;
    this.tierBadge.setText(tierLabel);
    this.tierBadge.setColor(TIER_BADGE_COLOR);

    const bannerH = Math.max(this.bannerHeight, this.nameText.height + Math.round(8 * S));
    this.itemSprite.setY(bannerH / 2);
    this.nameText.setY(bannerH / 2);
    this.tierBadge.setY(bannerH / 2);

    let currentY = bannerH + Math.round(6 * S);

    // Class names
    const classNames = getEquippableClassNames(category, subtype);
    if (classNames.length > 0) {
      this.classText.setText(classNames.join(", "));
      this.classText.setY(currentY);
      this.classText.setVisible(true);
      currentY += this.classText.height + Math.round(4 * S);
    } else {
      this.classText.setVisible(false);
    }

    // Description
    if (def.description) {
      this.descText.setText(def.description);
      this.descText.setColor("#888899");
      this.descText.setFontStyle("italic");
      this.descText.setY(currentY);
      this.descText.setVisible(true);
      currentY += this.descText.height + Math.round(4 * S);
    } else {
      this.descText.setVisible(false);
    }

    // Stats
    this.dividerYs = [];
    const statsLines: string[] = [];
    if (def.weaponStats) {
      statsLines.push(`Damage: ${def.weaponStats.damage}`);
      if (def.weaponStats.projectileCount && def.weaponStats.projectileCount > 1) {
        statsLines.push(`Projectiles: ${def.weaponStats.projectileCount}`);
      }
      statsLines.push(`Range: ${def.weaponStats.range}`);
      statsLines.push(`Fire Rate: ${(1000 / def.weaponStats.shootCooldown).toFixed(1)}/s`);
    } else if (def.abilityStats) {
      statsLines.push(`Damage: ${def.abilityStats.damage}`);
      statsLines.push(`Mana Cost: ${def.abilityStats.manaCost}`);
      statsLines.push(`Cooldown: ${(def.abilityStats.cooldown / 1000).toFixed(2)}s`);
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

    if (statsLines.length > 0) {
      currentY += Math.round(2 * S);
      this.dividerYs.push(currentY);
      currentY += Math.round(4 * S);

      this.statsText.setText(statsLines.join("\n"));
      this.statsText.setColor("#aaffaa");
      this.statsText.setY(currentY);
      this.statsText.setVisible(true);
      currentY += this.statsText.height;
    }

    this.shiftHintText.setVisible(false);

    const totalHeight = currentY + pad;
    const bannerColor = def.tier === 13 ? 0xffaa00 : 0x666688;
    this.drawBgAndPosition(totalHeight, bannerH, getSlotBorderColor(def.tier), bannerColor, screenX, screenY);
  }

  private showConsumable(def: (typeof ITEM_DEFS)[number], itemId: number, screenX: number, screenY: number): void {
    const S = this.S;
    const pad = this.tooltipPadding;
    this.clearAll();

    const category = getItemCategory(itemId);
    const subtype = getItemSubtype(itemId);

    // Banner: sprite, name
    const spriteKey = getItemSpriteKey(category, subtype);
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      setSpriteTexture1to1(this.itemSprite, spriteKey);
      this.itemSprite.setVisible(true);
    } else {
      this.itemSprite.setVisible(false);
    }

    this.nameText.setText(def.name);
    this.nameText.setColor("#ffffff");
    this.tierBadge.setText("");

    const bannerH = Math.max(this.bannerHeight, this.nameText.height + Math.round(8 * S));
    this.itemSprite.setY(bannerH / 2);
    this.nameText.setY(bannerH / 2);
    this.tierBadge.setY(bannerH / 2);

    let currentY = bannerH + Math.round(6 * S);

    // No class row for consumables
    this.classText.setVisible(false);

    // Stack size
    this.statsText.setText(`Stack Size: ${def.consumableStats!.maxStack}`);
    this.statsText.setColor("#aaaaaa");
    this.statsText.setY(currentY);
    this.statsText.setVisible(true);
    currentY += this.statsText.height + Math.round(4 * S);

    // Description
    this.dividerYs = [];
    if (def.description) {
      this.descText.setText(def.description);
      this.descText.setColor("#4488ff");
      this.descText.setFontStyle("normal");
      this.descText.setY(currentY);
      this.descText.setVisible(true);
      currentY += this.descText.height + Math.round(4 * S);
    } else {
      this.descText.setVisible(false);
    }

    // Usage hint
    if (def.usageHint) {
      this.shiftHintText.setText(def.usageHint);
      this.shiftHintText.setColor("#777777");
      this.shiftHintText.setFontStyle("italic");
      this.shiftHintText.setY(currentY);
      this.shiftHintText.setVisible(true);
      currentY += this.shiftHintText.height;
    } else {
      this.shiftHintText.setVisible(false);
    }

    const totalHeight = currentY + pad;
    const bannerColor = def.color;
    this.drawBgAndPosition(totalHeight, bannerH, bannerColor, bannerColor, screenX, screenY);
  }

  showCraftingOrb(orbType: number, screenX: number, screenY: number): void {
    const orbDef = ORB_DEFINITIONS[orbType];
    if (!orbDef) {
      this.hide();
      return;
    }

    const S = this.S;
    const pad = this.tooltipPadding;
    this.clearAll();

    // Banner: sprite, name
    const spriteKey = getItemSpriteKey(ItemCategory.CraftingOrb, orbType);
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      setSpriteTexture1to1(this.itemSprite, spriteKey);
      this.itemSprite.setVisible(true);
    } else {
      this.itemSprite.setVisible(false);
    }

    this.nameText.setText(orbDef.name);
    this.nameText.setColor("#ffffff");
    this.tierBadge.setText("");

    const bannerH = Math.max(this.bannerHeight, this.nameText.height + Math.round(8 * S));
    this.itemSprite.setY(bannerH / 2);
    this.nameText.setY(bannerH / 2);
    this.tierBadge.setY(bannerH / 2);

    let currentY = bannerH + Math.round(6 * S);

    this.classText.setVisible(false);

    // Stack size
    this.statsText.setText(`Stack Size: ${ORB_MAX_STACK}`);
    this.statsText.setColor("#aaaaaa");
    this.statsText.setY(currentY);
    this.statsText.setVisible(true);
    currentY += this.statsText.height + Math.round(4 * S);

    // Description
    this.dividerYs = [];
    this.descText.setText(orbDef.description);
    this.descText.setColor("#4488ff");
    this.descText.setFontStyle("normal");
    this.descText.setY(currentY);
    this.descText.setVisible(true);
    currentY += this.descText.height + Math.round(4 * S);

    // Usage hint
    this.shiftHintText.setText(orbDef.usageHint);
    this.shiftHintText.setColor("#777777");
    this.shiftHintText.setFontStyle("italic");
    this.shiftHintText.setY(currentY);
    this.shiftHintText.setVisible(true);
    currentY += this.shiftHintText.height;

    const totalHeight = currentY + pad;
    this.drawBgAndPosition(totalHeight, bannerH, orbDef.color, orbDef.color, screenX, screenY);
  }

  private drawBgAndPosition(totalHeight: number, bannerH: number, borderColor: number, bannerColor: number, screenX: number, screenY: number): void {
    const S = this.S;
    const pad = this.tooltipPadding;

    // NineSlice background panel
    this.bgPanel.setSize(this.tooltipWidth, totalHeight);
    this.bgPanel.setPosition(0, 0);

    // Overlay graphics: banner tint, separator, dividers
    this.bgOverlay.clear();

    // Colored banner at top
    this.bgOverlay.fillStyle(bannerColor, 0.35);
    this.bgOverlay.fillRect(0, 0, this.tooltipWidth, bannerH);

    // Separator line below banner
    this.bgOverlay.lineStyle(1, bannerColor, 0.5);
    this.bgOverlay.beginPath();
    this.bgOverlay.moveTo(0, bannerH);
    this.bgOverlay.lineTo(this.tooltipWidth, bannerH);
    this.bgOverlay.strokePath();

    // Divider lines
    this.bgOverlay.lineStyle(1, 0x555566, 0.6);
    for (const y of this.dividerYs) {
      this.bgOverlay.beginPath();
      this.bgOverlay.moveTo(pad, y);
      this.bgOverlay.lineTo(this.tooltipWidth - pad, y);
      this.bgOverlay.strokePath();
    }

    // Position: above cursor, centered horizontally
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

  /** Clear all dynamic elements to prepare for a new tooltip render. */
  private clearAll(): void {
    this.itemSprite.setVisible(false);
    this.nameText.setText("");
    this.tierBadge.setText("");
    this.classText.setText("").setVisible(false);
    this.descText.setText("").setVisible(false);
    this.statsText.setText("").setVisible(false);
    this.shiftHintText.setVisible(false);
    this.dividerYs = [];

    for (const txt of this.lockedStatPool) {
      txt.setText("").setVisible(false);
    }
    for (const entry of this.openStatPool) {
      entry.icon.setVisible(false);
      entry.text.setText("").setVisible(false);
    }
  }

  hide(): void {
    this.container.setVisible(false);
  }

  relayout(): void {
    this.S = getUIScale();
    const S = this.S;
    this.tooltipWidth = Math.round(BASE_TOOLTIP_WIDTH * S);
    this.tooltipPadding = Math.round(BASE_TOOLTIP_PADDING * S);
    this.spriteSize = getItemOutlinedSize();
    this.bannerHeight = Math.max(Math.round(BASE_BANNER_HEIGHT * S), this.spriteSize + Math.round(6 * S));
    this.statIconSize = Math.round(BASE_STAT_ICON_SIZE * S);

    const pad = this.tooltipPadding;
    const nameFontSize = `${Math.round(8 * S)}px`;
    const tierFontSize = `${Math.round(7 * S)}px`;
    const smallFontSize = `${Math.round(6 * S)}px`;
    const statFontSize = `${Math.round(6 * S)}px`;
    const wrapWidth = this.tooltipWidth - pad * 2;
    const nameWrapWidth = this.tooltipWidth - pad * 2 - this.spriteSize - Math.round(4 * S) - Math.round(30 * S);

    // Item sprite (display size set per-show via setSpriteTexture1to1)
    this.itemSprite.setPosition(pad + this.spriteSize / 2, this.bannerHeight / 2);

    // Name
    const nameX = pad + this.spriteSize + Math.round(4 * S);
    this.nameText.setX(nameX);
    this.nameText.setFontSize(nameFontSize);
    this.nameText.setWordWrapWidth(nameWrapWidth);

    // Tier badge
    this.tierBadge.setX(this.tooltipWidth - pad);
    this.tierBadge.setFontSize(tierFontSize);

    // Class text
    this.classText.setX(pad);
    this.classText.setFontSize(smallFontSize);
    this.classText.setWordWrapWidth(wrapWidth);

    // Description
    this.descText.setX(pad);
    this.descText.setFontSize(smallFontSize);
    this.descText.setWordWrapWidth(wrapWidth);

    // Locked stat pool
    for (const txt of this.lockedStatPool) {
      txt.setX(pad);
      txt.setFontSize(statFontSize);
      txt.setWordWrapWidth(wrapWidth);
    }

    // Open stat pool
    const iconX = pad + this.statIconSize / 2;
    const statTextX = pad + this.statIconSize + Math.round(3 * S);
    for (const entry of this.openStatPool) {
      entry.icon.setX(iconX);
      entry.icon.setDisplaySize(this.statIconSize, this.statIconSize);
      entry.text.setX(statTextX);
      entry.text.setFontSize(statFontSize);
      entry.text.setWordWrapWidth(wrapWidth - this.statIconSize - Math.round(3 * S));
    }

    // Stats text
    this.statsText.setX(pad);
    this.statsText.setFontSize(statFontSize);
    this.statsText.setWordWrapWidth(wrapWidth);

    // Shift hint
    this.shiftHintText.setX(pad);
    this.shiftHintText.setFontSize(smallFontSize);
    this.shiftHintText.setWordWrapWidth(wrapWidth);

    this.hide();
  }
}

/**
 * Sets text with a title prefix in white and the rest in descColor.
 * Uses a single Phaser Text object: first lets Phaser render the full text
 * normally, then repaints the title portion in white on the canvas and
 * re-uploads to WebGL.
 */
function setStatTextWithTitle(
  textObj: Phaser.GameObjects.Text,
  titleStr: string,
  fullText: string,
  descColor: string,
): void {
  // Let Phaser render the full text in the description color
  textObj.setColor(descColor);
  textObj.setText(fullText);
  // setText calls updateText() which renders to canvas AND uploads to GL.

  // Now repaint the title portion in white on the already-rendered canvas.
  const canvas = textObj.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const style = textObj.style as any;
  const resolution = style.resolution ?? 1;
  const strokeThickness = style.strokeThickness ?? 0;
  const strokeColor = style.stroke ?? "#000000";
  const metrics = style.metrics;

  // Match Phaser's internal font setup
  ctx.save();
  ctx.scale(resolution, resolution);
  style.syncFont(canvas, ctx);
  style.syncStyle(canvas, ctx);

  // Phaser applies padding translation
  const padding = (textObj as any).padding ?? { left: 0, top: 0 };
  ctx.translate(padding.left, padding.top);

  // Position matches Phaser's first-line drawing position
  const lineX = strokeThickness / 2;
  const lineY = (strokeThickness / 2) + metrics.ascent;

  // Redraw stroke for title in black
  if (strokeThickness > 0) {
    style.syncShadow(ctx, style.shadowStroke);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeThickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeText(titleStr, lineX, lineY);
  }

  // Redraw fill for title in white
  style.syncShadow(ctx, style.shadowFill);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(titleStr, lineX, lineY);

  ctx.restore();

  // Re-upload the modified canvas to the WebGL texture
  const renderer = (textObj as any).renderer;
  if (renderer && renderer.gl) {
    const source = textObj.frame.source;
    source.glTexture = renderer.canvasToTexture(canvas, source.glTexture, true);
  }
}

function fmtStat(val: number): string {
  return String(Math.round(val));
}

function isPercentStat(sType: number): boolean {
  return (
    sType === StatType.AttackSpeed ||
    sType === StatType.PhysicalDamageReduction ||
    sType === StatType.MagicDamageReduction ||
    sType === StatType.ReducedAbilityCooldown ||
    sType === StatType.IncreasedProjectileSpeed ||
    sType === StatType.CriticalStrikeChance ||
    sType === StatType.CriticalStrikeMultiplier
  );
}
