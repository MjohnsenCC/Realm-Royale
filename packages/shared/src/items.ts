import {
  ItemCategory,
  ItemTier,
  WeaponSubtype,
  AbilitySubtype,
  BagRarity,
  DungeonType,
  EnemyType,
  CraftingOrbType,
} from "./types";
import {
  ItemInstanceData,
  LOCKED_STATS_BY_CATEGORY,
  rollStatTier,
  rollStatRoll,
  createEmptyItemInstance,
  pickRandom,
  rollInitialOpenStats,
  ORBS_BY_RARITY,
  OrbRarity,
  ORB_DEFINITIONS,
} from "./itemStats";

// --- Loot Table Types ---

export interface TierGroupItem {
  category: number;
  subtype: number;
  tierMin: number;
  tierMax: number;
}

export interface IndependentDropEntry {
  type: "independent";
  dropChance: number;
  itemId?: number;
  orbRarityWeighted?: boolean;
  category?: number;
  subtype?: number;
  tier?: number;
}

export interface TierGroupDropEntry {
  type: "tierGroup";
  dropChance: number;
  items: TierGroupItem[];
}

export type LootTableEntry = IndependentDropEntry | TierGroupDropEntry;

export interface LootTable {
  entries: LootTableEntry[];
}

// --- Item ID Encoding: category * 1000 + subtype * 100 + tier ---

export function getItemCategory(itemId: number): number {
  return Math.floor(itemId / 1000);
}

export function getItemSubtype(itemId: number): number {
  return Math.floor((itemId % 1000) / 100);
}

export function getItemTier(itemId: number): number {
  return itemId % 100;
}

export function makeItemId(
  category: number,
  subtype: number,
  tier: number
): number {
  return category * 1000 + subtype * 100 + tier;
}

// --- Stat interfaces (kept for UT item definitions) ---

export interface WeaponStats {
  damage: number;
  range: number;
  shootCooldown: number;
  projectileSpeed: number;
  projectileSize: number;
  projectileCount?: number;
  spreadAngle?: number;
}

export interface AbilityStats {
  damage: number;
  range: number;
  projectileSpeed: number;
  projectileSize: number;
  manaCost: number;
  cooldown: number;
  piercing: boolean;
  speedBoostAmount?: number;
  speedBoostDuration?: number;
}

export interface ArmorStats {
  maxHpBonus: number;
  manaRegenBonus?: number;
}

export interface RingStats {
  speedBonus: number;
  damageBonus: number;
  hpRegenBonus: number;
  maxHpBonus: number;
  maxManaBonus: number;
  projSpeedBonus?: number;
}

export interface ConsumableStats {
  maxStack: number;
  healAmount?: number;
  manaAmount?: number;
}

export interface ItemDefinition {
  id: number;
  name: string;
  category: number;
  subtype: number;
  tier: number;
  color: number;
  tierColor: number;
  description: string;
  weaponStats?: WeaponStats;
  abilityStats?: AbilityStats;
  armorStats?: ArmorStats;
  ringStats?: RingStats;
  consumableStats?: ConsumableStats;
}

// --- Tier colors ---

export const TIER_COLORS: Record<number, number> = {
  1: 0x888888, // Gray
  2: 0x44aa44, // Green
  3: 0x4488ff, // Blue
  4: 0xcc44cc, // Purple
  5: 0xffaa22, // Orange
  6: 0xffdd00, // Gold
  7: 0xff4444, // Red
  8: 0xff66aa, // Pink
  9: 0x44ffcc, // Aquamarine
  10: 0xffffff, // White
  11: 0xff8844, // Flame
  12: 0xff2266, // Crimson
  13: 0x00ffff, // Cyan (UT)
};

export function getTierColor(tier: number): number {
  return TIER_COLORS[tier] ?? 0x888888;
}

export function isUTItem(itemId: number): boolean {
  return getItemTier(itemId) === ItemTier.UT;
}

// --- Item Definitions (used for UT items and name/color lookups) ---

export const ITEM_DEFS: Record<number, ItemDefinition> = {
  // ===== SWORDS (category=0, subtype=0) =====
  [makeItemId(0, 0, 1)]: {
    id: 1, name: "Rusty Blade", category: 0, subtype: 0, tier: 1,
    color: 0x8b7355, tierColor: TIER_COLORS[1],
    description: "A worn blade. Better than bare hands.",
    weaponStats: { damage: 35, range: 150, shootCooldown: 300, projectileSpeed: 400, projectileSize: 15 },
  },
  [makeItemId(0, 0, 2)]: {
    id: 2, name: "Iron Sword", category: 0, subtype: 0, tier: 2,
    color: 0xaabbcc, tierColor: TIER_COLORS[2],
    description: "A sturdy iron blade.",
    weaponStats: { damage: 50, range: 160, shootCooldown: 280, projectileSpeed: 420, projectileSize: 16 },
  },
  [makeItemId(0, 0, 3)]: {
    id: 3, name: "Steel Sword", category: 0, subtype: 0, tier: 3,
    color: 0x778899, tierColor: TIER_COLORS[3],
    description: "Tempered steel, sharp and reliable.",
    weaponStats: { damage: 70, range: 170, shootCooldown: 260, projectileSpeed: 440, projectileSize: 17 },
  },
  [makeItemId(0, 0, 4)]: {
    id: 4, name: "Crystal Blade", category: 0, subtype: 0, tier: 4,
    color: 0x44ccee, tierColor: TIER_COLORS[4],
    description: "Crystalline edge that cuts through armor.",
    weaponStats: { damage: 95, range: 180, shootCooldown: 240, projectileSpeed: 460, projectileSize: 18 },
  },
  [makeItemId(0, 0, 5)]: {
    id: 5, name: "Demon Edge", category: 0, subtype: 0, tier: 5,
    color: 0xff4422, tierColor: TIER_COLORS[5],
    description: "Forged in hellfire. Burns on contact.",
    weaponStats: { damage: 125, range: 190, shootCooldown: 220, projectileSpeed: 480, projectileSize: 19 },
  },
  [makeItemId(0, 0, 6)]: {
    id: 6, name: "Void Blade", category: 0, subtype: 0, tier: 6,
    color: 0xaa44ff, tierColor: TIER_COLORS[6],
    description: "Tears the fabric of reality itself.",
    weaponStats: { damage: 160, range: 200, shootCooldown: 200, projectileSpeed: 500, projectileSize: 20 },
  },
  [makeItemId(0, 0, 7)]: {
    id: 7, name: "Infernal Edge", category: 0, subtype: 0, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "A blade forged in infernal flames.",
    weaponStats: { damage: 171, range: 210, shootCooldown: 190, projectileSpeed: 520, projectileSize: 21 },
  },
  [makeItemId(0, 0, 8)]: {
    id: 8, name: "Abyssal Cleaver", category: 0, subtype: 0, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Cuts through dimensions themselves.",
    weaponStats: { damage: 209, range: 220, shootCooldown: 180, projectileSpeed: 540, projectileSize: 22 },
  },
  [makeItemId(0, 0, 9)]: {
    id: 9, name: "Phantom Reaper", category: 0, subtype: 0, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Harvests souls with each swing.",
    weaponStats: { damage: 247, range: 230, shootCooldown: 170, projectileSpeed: 560, projectileSize: 23 },
  },
  [makeItemId(0, 0, 10)]: {
    id: 10, name: "Celestial Saber", category: 0, subtype: 0, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Forged from a dying star.",
    weaponStats: { damage: 285, range: 240, shootCooldown: 160, projectileSpeed: 580, projectileSize: 24 },
  },
  [makeItemId(0, 0, 11)]: {
    id: 11, name: "Doomfire Blade", category: 0, subtype: 0, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Burns with the fire of creation.",
    weaponStats: { damage: 333, range: 250, shootCooldown: 150, projectileSpeed: 600, projectileSize: 25 },
  },
  [makeItemId(0, 0, 12)]: {
    id: 12, name: "Eternity's End", category: 0, subtype: 0, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "The last blade ever forged.",
    weaponStats: { damage: 380, range: 260, shootCooldown: 140, projectileSpeed: 620, projectileSize: 26 },
  },

  // ===== BOWS (category=0, subtype=1) =====
  [makeItemId(0, 1, 1)]: {
    id: 11, name: "Wooden Bow", category: 0, subtype: 1, tier: 1,
    color: 0x8b7355, tierColor: TIER_COLORS[1],
    description: "A simple wooden bow.",
    weaponStats: { damage: 20, range: 400, shootCooldown: 350, projectileSpeed: 500, projectileSize: 5 },
  },
  [makeItemId(0, 1, 2)]: {
    id: 12, name: "Hunter's Bow", category: 0, subtype: 1, tier: 2,
    color: 0x44aa44, tierColor: TIER_COLORS[2],
    description: "Favored by woodland hunters.",
    weaponStats: { damage: 30, range: 420, shootCooldown: 330, projectileSpeed: 520, projectileSize: 5 },
  },
  [makeItemId(0, 1, 3)]: {
    id: 13, name: "Iron Bow", category: 0, subtype: 1, tier: 3,
    color: 0x778899, tierColor: TIER_COLORS[3],
    description: "Reinforced with iron limbs.",
    weaponStats: { damage: 42, range: 440, shootCooldown: 310, projectileSpeed: 540, projectileSize: 5 },
  },
  [makeItemId(0, 1, 4)]: {
    id: 14, name: "War Bow", category: 0, subtype: 1, tier: 4,
    color: 0xcc6633, tierColor: TIER_COLORS[4],
    description: "Built for the battlefield.",
    weaponStats: { damage: 55, range: 470, shootCooldown: 290, projectileSpeed: 560, projectileSize: 6 },
  },
  [makeItemId(0, 1, 5)]: {
    id: 15, name: "Shadow Bow", category: 0, subtype: 1, tier: 5,
    color: 0x6644aa, tierColor: TIER_COLORS[5],
    description: "Arrows vanish into shadow before striking.",
    weaponStats: { damage: 70, range: 500, shootCooldown: 270, projectileSpeed: 580, projectileSize: 6 },
  },
  [makeItemId(0, 1, 6)]: {
    id: 16, name: "Divine Bow", category: 0, subtype: 1, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Blessed by the gods themselves.",
    weaponStats: { damage: 90, range: 550, shootCooldown: 250, projectileSpeed: 600, projectileSize: 7 },
  },
  [makeItemId(0, 1, 7)]: {
    id: 17, name: "Hellfire Bow", category: 0, subtype: 1, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Arrows ignite in demonic flame.",
    weaponStats: { damage: 99, range: 570, shootCooldown: 240, projectileSpeed: 620, projectileSize: 7 },
  },
  [makeItemId(0, 1, 8)]: {
    id: 18, name: "Spectral Longbow", category: 0, subtype: 1, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Fires arrows from beyond the veil.",
    weaponStats: { damage: 121, range: 590, shootCooldown: 230, projectileSpeed: 640, projectileSize: 7 },
  },
  [makeItemId(0, 1, 9)]: {
    id: 19, name: "Void Recurve", category: 0, subtype: 1, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Bends space to strike true.",
    weaponStats: { damage: 143, range: 610, shootCooldown: 220, projectileSpeed: 660, projectileSize: 8 },
  },
  [makeItemId(0, 1, 10)]: {
    id: 110, name: "Astral Bow", category: 0, subtype: 1, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Woven from starlight and moonbeams.",
    weaponStats: { damage: 165, range: 630, shootCooldown: 210, projectileSpeed: 680, projectileSize: 8 },
  },
  [makeItemId(0, 1, 11)]: {
    id: 111, name: "Phoenix Bow", category: 0, subtype: 1, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Each arrow is reborn in flame.",
    weaponStats: { damage: 193, range: 650, shootCooldown: 200, projectileSpeed: 700, projectileSize: 8 },
  },
  [makeItemId(0, 1, 12)]: {
    id: 112, name: "Oblivion Bow", category: 0, subtype: 1, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "Erases what it strikes from existence.",
    weaponStats: { damage: 220, range: 670, shootCooldown: 190, projectileSpeed: 720, projectileSize: 9 },
  },

  // ===== QUIVERS (category=1, subtype=0) =====
  [makeItemId(1, 0, 1)]: {
    id: 101, name: "Crude Quiver", category: 1, subtype: 0, tier: 1,
    color: 0xcc8844, tierColor: TIER_COLORS[1],
    description: "Fires a piercing energy bolt.",
    abilityStats: { damage: 50, range: 500, projectileSpeed: 600, projectileSize: 12, manaCost: 30, cooldown: 1000, piercing: true },
  },
  [makeItemId(1, 0, 2)]: {
    id: 102, name: "Iron Quiver", category: 1, subtype: 0, tier: 2,
    color: 0xaabbcc, tierColor: TIER_COLORS[2],
    description: "Reinforced bolts pierce deeper.",
    abilityStats: { damage: 75, range: 520, projectileSpeed: 620, projectileSize: 13, manaCost: 32, cooldown: 950, piercing: true },
  },
  [makeItemId(1, 0, 3)]: {
    id: 103, name: "Elven Quiver", category: 1, subtype: 0, tier: 3,
    color: 0x44cc66, tierColor: TIER_COLORS[3],
    description: "Elven craft, devastating force.",
    abilityStats: { damage: 105, range: 550, projectileSpeed: 650, projectileSize: 14, manaCost: 34, cooldown: 900, piercing: true },
  },
  [makeItemId(1, 0, 4)]: {
    id: 104, name: "Crystal Quiver", category: 1, subtype: 0, tier: 4,
    color: 0x44ccee, tierColor: TIER_COLORS[4],
    description: "Crystal shards shred everything in their path.",
    abilityStats: { damage: 140, range: 580, projectileSpeed: 680, projectileSize: 15, manaCost: 36, cooldown: 850, piercing: true },
  },
  [makeItemId(1, 0, 5)]: {
    id: 105, name: "Shadow Quiver", category: 1, subtype: 0, tier: 5,
    color: 0x8844cc, tierColor: TIER_COLORS[5],
    description: "Shadow bolts consume all in their wake.",
    abilityStats: { damage: 180, range: 620, projectileSpeed: 720, projectileSize: 16, manaCost: 38, cooldown: 800, piercing: true },
  },
  [makeItemId(1, 0, 6)]: {
    id: 106, name: "Divine Quiver", category: 1, subtype: 0, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Holy wrath made manifest.",
    abilityStats: { damage: 230, range: 660, projectileSpeed: 760, projectileSize: 18, manaCost: 40, cooldown: 750, piercing: true },
  },
  [makeItemId(1, 0, 7)]: {
    id: 107, name: "Infernal Quiver", category: 1, subtype: 0, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Bolts forged in hellfire.",
    abilityStats: { damage: 252, range: 690, projectileSpeed: 790, projectileSize: 19, manaCost: 42, cooldown: 720, piercing: true },
  },
  [makeItemId(1, 0, 8)]: {
    id: 108, name: "Abyssal Quiver", category: 1, subtype: 0, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Draws power from the deep abyss.",
    abilityStats: { damage: 308, range: 720, projectileSpeed: 820, projectileSize: 20, manaCost: 44, cooldown: 690, piercing: true },
  },
  [makeItemId(1, 0, 9)]: {
    id: 109, name: "Wraith Quiver", category: 1, subtype: 0, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Spectral bolts phase through the living.",
    abilityStats: { damage: 364, range: 750, projectileSpeed: 850, projectileSize: 21, manaCost: 46, cooldown: 660, piercing: true },
  },
  [makeItemId(1, 0, 10)]: {
    id: 1010, name: "Celestial Quiver", category: 1, subtype: 0, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Fires shards of pure starlight.",
    abilityStats: { damage: 420, range: 780, projectileSpeed: 880, projectileSize: 22, manaCost: 48, cooldown: 630, piercing: true },
  },
  [makeItemId(1, 0, 11)]: {
    id: 1011, name: "Doomfire Quiver", category: 1, subtype: 0, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Each bolt carries the doom of worlds.",
    abilityStats: { damage: 490, range: 810, projectileSpeed: 910, projectileSize: 23, manaCost: 50, cooldown: 600, piercing: true },
  },
  [makeItemId(1, 0, 12)]: {
    id: 1012, name: "Eternity Quiver", category: 1, subtype: 0, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "Bolts that echo through time itself.",
    abilityStats: { damage: 560, range: 840, projectileSpeed: 940, projectileSize: 24, manaCost: 52, cooldown: 570, piercing: true },
  },

  // ===== ARMOR (category=2, subtype=0) =====
  [makeItemId(2, 0, 1)]: {
    id: 201, name: "Cloth Robe", category: 2, subtype: 0, tier: 1,
    color: 0x6b6b6b, tierColor: TIER_COLORS[1],
    description: "Basic protection.",
    armorStats: { maxHpBonus: 10 },
  },
  [makeItemId(2, 0, 2)]: {
    id: 202, name: "Leather Armor", category: 2, subtype: 0, tier: 2,
    color: 0x9c6b30, tierColor: TIER_COLORS[2],
    description: "Tough hide, decent protection.",
    armorStats: { maxHpBonus: 25 },
  },
  [makeItemId(2, 0, 3)]: {
    id: 203, name: "Chain Mail", category: 2, subtype: 0, tier: 3,
    color: 0x778899, tierColor: TIER_COLORS[3],
    description: "Interlocking rings deflect blows.",
    armorStats: { maxHpBonus: 45 },
  },
  [makeItemId(2, 0, 4)]: {
    id: 204, name: "Plate Armor", category: 2, subtype: 0, tier: 4,
    color: 0xaabbcc, tierColor: TIER_COLORS[4],
    description: "Heavy plates absorb massive hits.",
    armorStats: { maxHpBonus: 70 },
  },
  [makeItemId(2, 0, 5)]: {
    id: 205, name: "Dragon Hide", category: 2, subtype: 0, tier: 5,
    color: 0xcc2200, tierColor: TIER_COLORS[5],
    description: "Scales of a slain dragon.",
    armorStats: { maxHpBonus: 100 },
  },
  [makeItemId(2, 0, 6)]: {
    id: 206, name: "Divine Armor", category: 2, subtype: 0, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Blessed plate of the gods.",
    armorStats: { maxHpBonus: 140 },
  },
  [makeItemId(2, 0, 7)]: {
    id: 2007, name: "Infernal Plate", category: 2, subtype: 0, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Forged in hellfire, resists all flame.",
    armorStats: { maxHpBonus: 170 },
  },
  [makeItemId(2, 0, 8)]: {
    id: 2008, name: "Abyssal Mail", category: 2, subtype: 0, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Woven from the darkness of the deep.",
    armorStats: { maxHpBonus: 210 },
  },
  [makeItemId(2, 0, 9)]: {
    id: 2009, name: "Spectral Armor", category: 2, subtype: 0, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Phases between realms to deflect blows.",
    armorStats: { maxHpBonus: 250 },
  },
  [makeItemId(2, 0, 10)]: {
    id: 2010, name: "Celestial Plate", category: 2, subtype: 0, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Armor of the stars themselves.",
    armorStats: { maxHpBonus: 290 },
  },
  [makeItemId(2, 0, 11)]: {
    id: 2011, name: "Doomfire Aegis", category: 2, subtype: 0, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Shields the wearer in apocalyptic flame.",
    armorStats: { maxHpBonus: 340 },
  },
  [makeItemId(2, 0, 12)]: {
    id: 2012, name: "Eternity Ward", category: 2, subtype: 0, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "The ultimate protection, beyond time.",
    armorStats: { maxHpBonus: 400 },
  },

  // ===== RINGS (category=3, subtype=0) =====
  [makeItemId(3, 0, 1)]: {
    id: 301, name: "Iron Ring", category: 3, subtype: 0, tier: 1,
    color: 0x888888, tierColor: TIER_COLORS[1],
    description: "A simple band with minor enchantment.",
    ringStats: { speedBonus: 3, damageBonus: 2, hpRegenBonus: 0.5, maxHpBonus: 5, maxManaBonus: 5 },
  },
  [makeItemId(3, 0, 2)]: {
    id: 302, name: "Silver Ring", category: 3, subtype: 0, tier: 2,
    color: 0xcccccc, tierColor: TIER_COLORS[2],
    description: "Polished silver amplifies magic.",
    ringStats: { speedBonus: 6, damageBonus: 4, hpRegenBonus: 1.0, maxHpBonus: 10, maxManaBonus: 10 },
  },
  [makeItemId(3, 0, 3)]: {
    id: 303, name: "Emerald Ring", category: 3, subtype: 0, tier: 3,
    color: 0x44cc66, tierColor: TIER_COLORS[3],
    description: "Emerald pulses with natural power.",
    ringStats: { speedBonus: 10, damageBonus: 6, hpRegenBonus: 1.5, maxHpBonus: 15, maxManaBonus: 15 },
  },
  [makeItemId(3, 0, 4)]: {
    id: 304, name: "Ruby Ring", category: 3, subtype: 0, tier: 4,
    color: 0xcc3344, tierColor: TIER_COLORS[4],
    description: "Burning ruby fuels aggression.",
    ringStats: { speedBonus: 14, damageBonus: 9, hpRegenBonus: 2.0, maxHpBonus: 20, maxManaBonus: 20 },
  },
  [makeItemId(3, 0, 5)]: {
    id: 305, name: "Diamond Ring", category: 3, subtype: 0, tier: 5,
    color: 0xaaeeff, tierColor: TIER_COLORS[5],
    description: "Flawless diamond radiates power.",
    ringStats: { speedBonus: 18, damageBonus: 12, hpRegenBonus: 3.0, maxHpBonus: 30, maxManaBonus: 30 },
  },
  [makeItemId(3, 0, 6)]: {
    id: 306, name: "Celestial Ring", category: 3, subtype: 0, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "A fragment of a fallen star.",
    ringStats: { speedBonus: 22, damageBonus: 16, hpRegenBonus: 4.0, maxHpBonus: 40, maxManaBonus: 40 },
  },
  [makeItemId(3, 0, 7)]: {
    id: 3007, name: "Infernal Band", category: 3, subtype: 0, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "A ring that burns with hellfire.",
    ringStats: { speedBonus: 26, damageBonus: 20, hpRegenBonus: 5.0, maxHpBonus: 50, maxManaBonus: 50 },
  },
  [makeItemId(3, 0, 8)]: {
    id: 3008, name: "Abyssal Loop", category: 3, subtype: 0, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Draws power from the endless abyss.",
    ringStats: { speedBonus: 32, damageBonus: 24, hpRegenBonus: 6.0, maxHpBonus: 60, maxManaBonus: 60 },
  },
  [makeItemId(3, 0, 9)]: {
    id: 3009, name: "Wraith Ring", category: 3, subtype: 0, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Whispers of the dead empower the wearer.",
    ringStats: { speedBonus: 38, damageBonus: 28, hpRegenBonus: 7.0, maxHpBonus: 70, maxManaBonus: 70 },
  },
  [makeItemId(3, 0, 10)]: {
    id: 3010, name: "Celestial Band", category: 3, subtype: 0, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Forged from condensed starlight.",
    ringStats: { speedBonus: 44, damageBonus: 33, hpRegenBonus: 8.0, maxHpBonus: 80, maxManaBonus: 80 },
  },
  [makeItemId(3, 0, 11)]: {
    id: 3011, name: "Doomfire Signet", category: 3, subtype: 0, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Sealed with the mark of apocalypse.",
    ringStats: { speedBonus: 50, damageBonus: 38, hpRegenBonus: 9.5, maxHpBonus: 95, maxManaBonus: 95 },
  },
  [makeItemId(3, 0, 12)]: {
    id: 3012, name: "Eternity Ring", category: 3, subtype: 0, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "Power beyond the end of time.",
    ringStats: { speedBonus: 58, damageBonus: 44, hpRegenBonus: 11.0, maxHpBonus: 110, maxManaBonus: 110 },
  },

  // ===== UT ITEMS (tier=13, unique) =====
  [makeItemId(0, 0, 13)]: {
    id: 13, name: "Doom Blade", category: 0, subtype: 0, tier: 13,
    color: 0x00cccc, tierColor: TIER_COLORS[13],
    description: "An accursed blade that fractures reality into three slashes.",
    weaponStats: {
      damage: 55, range: 170, shootCooldown: 350,
      projectileSpeed: 420, projectileSize: 14,
      projectileCount: 3, spreadAngle: Math.PI / 6,
    },
  },
  [makeItemId(1, 0, 13)]: {
    id: 1013, name: "Phantom Quiver", category: 1, subtype: 0, tier: 13,
    color: 0x00cccc, tierColor: TIER_COLORS[13],
    description: "Spectral arrows grant otherworldly swiftness.",
    abilityStats: {
      damage: 120, range: 500, projectileSpeed: 700, projectileSize: 14,
      manaCost: 45, cooldown: 1200, piercing: true,
      speedBoostAmount: 80, speedBoostDuration: 3000,
    },
  },
  [makeItemId(2, 0, 13)]: {
    id: 2013, name: "Ethereal Shroud", category: 2, subtype: 0, tier: 13,
    color: 0x00cccc, tierColor: TIER_COLORS[13],
    description: "Woven from ether, it feeds your magic at the cost of protection.",
    armorStats: { maxHpBonus: 50, manaRegenBonus: 8 },
  },
  [makeItemId(3, 0, 13)]: {
    id: 3013, name: "Ring of the Void", category: 3, subtype: 0, tier: 13,
    color: 0x00cccc, tierColor: TIER_COLORS[13],
    description: "The void amplifies power but offers no shelter.",
    ringStats: { speedBonus: 30, damageBonus: 25, hpRegenBonus: 0, maxHpBonus: 0, maxManaBonus: 0, projSpeedBonus: 100 },
  },

  // ===== CONSUMABLES (category=4) =====
  [makeItemId(4, 0, 1)]: {
    id: 4001, name: "Health Potion", category: 4, subtype: 0, tier: 1,
    color: 0xcc3333, tierColor: TIER_COLORS[1],
    description: "Restores 100 HP. Press F to use.",
    consumableStats: { maxStack: 6, healAmount: 100 },
  },
  [makeItemId(4, 1, 1)]: {
    id: 4101, name: "Mana Potion", category: 4, subtype: 1, tier: 1,
    color: 0x4466cc, tierColor: TIER_COLORS[1],
    description: "Restores 100 Mana. Press G to use.",
    consumableStats: { maxStack: 6, manaAmount: 100 },
  },
  [makeItemId(4, 2, 1)]: {
    id: 4201, name: "Portal Gem", category: 4, subtype: 2, tier: 1,
    color: 0xaa44ff, tierColor: TIER_COLORS[1],
    description: "Teleport anywhere on the map. Right-click minimap to target.",
    consumableStats: { maxStack: 20 },
  },
};

// --- Category display names ---

const CATEGORY_NAMES: Record<number, string> = {
  [ItemCategory.Weapon]: "Weapon",
  [ItemCategory.Ability]: "Ability",
  [ItemCategory.Armor]: "Armor",
  [ItemCategory.Ring]: "Ring",
  [ItemCategory.Consumable]: "Consumable",
  [ItemCategory.CraftingOrb]: "Crafting Orb",
};

export function getCategoryName(category: number): string {
  return CATEGORY_NAMES[category] ?? "Unknown";
}

export function isConsumableItem(itemId: number): boolean {
  return getItemCategory(itemId) === ItemCategory.Consumable;
}

export function isCraftingOrbItem(itemId: number): boolean {
  return getItemCategory(itemId) === ItemCategory.CraftingOrb;
}

export function getConsumableSlotIndex(itemId: number): number {
  return getItemSubtype(itemId);
}

// --- Subtype display names ---

const WEAPON_SUBTYPE_NAMES: Record<number, string> = {
  [WeaponSubtype.Sword]: "Sword",
  [WeaponSubtype.Bow]: "Bow",
};

const ABILITY_SUBTYPE_NAMES: Record<number, string> = {
  [AbilitySubtype.Quiver]: "Quiver",
};

export function getSubtypeName(category: number, subtype: number): string {
  if (category === ItemCategory.Weapon) return WEAPON_SUBTYPE_NAMES[subtype] ?? "Weapon";
  if (category === ItemCategory.Ability) return ABILITY_SUBTYPE_NAMES[subtype] ?? "Ability";
  if (category === ItemCategory.Armor) return "Armor";
  if (category === ItemCategory.Ring) return "Ring";
  if (category === ItemCategory.CraftingOrb) return ORB_DEFINITIONS[subtype]?.name ?? "Orb";
  return "Unknown";
}

/** Get the display name for an item instance. */
export function getItemInstanceName(item: ItemInstanceData): string {
  if (item.baseItemId < 0) return "";

  const category = getItemCategory(item.baseItemId);

  // Crafting orbs
  if (category === ItemCategory.CraftingOrb) {
    const subtype = getItemSubtype(item.baseItemId);
    return ORB_DEFINITIONS[subtype]?.name ?? "Unknown Orb";
  }

  // Consumables
  if (category === ItemCategory.Consumable) {
    const def = ITEM_DEFS[item.baseItemId];
    return def?.name ?? "Consumable";
  }

  // UT items - use ITEM_DEFS name
  if (item.isUT) {
    const def = ITEM_DEFS[item.baseItemId];
    return def?.name ?? "Unknown UT";
  }

  // Tiered items - use ITEM_DEFS name by looking up (category, subtype, tier)
  const def = ITEM_DEFS[item.baseItemId];
  if (def) return def.name;

  // Fallback: generate name from category/subtype
  const subtype = getItemSubtype(item.baseItemId);
  return `${getSubtypeName(category, subtype)} T${item.instanceTier}`;
}

/** Get the display color for an item instance (used for icons). */
export function getItemColor(item: ItemInstanceData): number {
  if (item.baseItemId < 0) return 0x666666;

  const category = getItemCategory(item.baseItemId);

  // Crafting orbs
  if (category === ItemCategory.CraftingOrb) {
    const subtype = getItemSubtype(item.baseItemId);
    return ORB_DEFINITIONS[subtype]?.color ?? 0xffffff;
  }

  // Consumables / UT items - use ITEM_DEFS color
  if (category === ItemCategory.Consumable || item.isUT) {
    const def = ITEM_DEFS[item.baseItemId];
    return def?.color ?? 0xffffff;
  }

  // Tiered items - color by instance tier
  return TIER_COLORS[item.instanceTier] ?? 0x888888;
}

// --- Item Instance Generation ---

/** Generate a tiered item instance with random locked stat tiers and optional pre-rolled open stats. */
export function generateItemInstance(
  category: number,
  subtype: number,
  tier: number,
  prerollOpenStats: boolean = true
): ItemInstanceData {
  const lockedStats = LOCKED_STATS_BY_CATEGORY[category];
  if (!lockedStats) {
    return createEmptyItemInstance();
  }

  return {
    baseItemId: makeItemId(category, subtype, tier),
    instanceTier: tier,
    isUT: false,
    lockedStat1Type: lockedStats[0],
    lockedStat1Tier: rollStatTier(tier),
    lockedStat1Roll: rollStatRoll(),
    lockedStat2Type: lockedStats[1],
    lockedStat2Tier: rollStatTier(tier),
    lockedStat2Roll: rollStatRoll(),
    openStats: prerollOpenStats ? rollInitialOpenStats(category, tier) : [],
    forgeProtectedSlot: -1,
  };
}

/** Generate a UT item instance (static stats from ITEM_DEFS, no crafting). */
export function generateUTItemInstance(baseItemId: number): ItemInstanceData {
  return {
    baseItemId,
    instanceTier: 0,
    isUT: true,
    lockedStat1Type: -1,
    lockedStat1Tier: 0,
    lockedStat1Roll: 0,
    lockedStat2Type: -1,
    lockedStat2Tier: 0,
    lockedStat2Roll: 0,
    openStats: [],
    forgeProtectedSlot: -1,
  };
}

/** Generate a consumable item instance. */
export function generateConsumableInstance(baseItemId: number): ItemInstanceData {
  return {
    baseItemId,
    instanceTier: 0,
    isUT: false,
    lockedStat1Type: -1,
    lockedStat1Tier: 0,
    lockedStat1Roll: 0,
    lockedStat2Type: -1,
    lockedStat2Tier: 0,
    lockedStat2Roll: 0,
    openStats: [],
    forgeProtectedSlot: -1,
  };
}

/** Generate a crafting orb item instance. */
export function generateOrbInstance(orbType: number): ItemInstanceData {
  return {
    baseItemId: makeItemId(ItemCategory.CraftingOrb, orbType, 1),
    instanceTier: 0,
    isUT: false,
    lockedStat1Type: -1,
    lockedStat1Tier: 0,
    lockedStat1Roll: 0,
    lockedStat2Type: -1,
    lockedStat2Tier: 0,
    lockedStat2Roll: 0,
    openStats: [],
    forgeProtectedSlot: -1,
  };
}

// --- Loot Tables ---

/** All UT item IDs (tier 13). UTs only drop from Void dungeon. */
const UT_ITEM_IDS: number[] = Object.keys(ITEM_DEFS)
  .map(Number)
  .filter((id) => getItemTier(id) === ItemTier.UT);

/** Roll a random crafting orb instance using the rarity weight system. */
function rollRandomOrb(): ItemInstanceData {
  const roll = Math.random();
  let rarity: number;
  if (roll < 0.50) rarity = OrbRarity.Common;
  else if (roll < 0.80) rarity = OrbRarity.Uncommon;
  else if (roll < 0.95) rarity = OrbRarity.Rare;
  else rarity = OrbRarity.VeryRare;

  const orbTypes = ORBS_BY_RARITY[rarity];
  return generateOrbInstance(pickRandom(orbTypes));
}

/** Equipment tier group: one roll picks a random Weapon/Ability/Armor/Ring. */
function makeEquipmentTierGroup(
  dropChance: number,
  tierMin: number,
  tierMax: number
): TierGroupDropEntry {
  return {
    type: "tierGroup",
    dropChance,
    items: [
      { category: ItemCategory.Weapon, subtype: WeaponSubtype.Bow, tierMin, tierMax },
      { category: ItemCategory.Ability, subtype: 0, tierMin, tierMax },
      { category: ItemCategory.Armor, subtype: 0, tierMin, tierMax },
      { category: ItemCategory.Ring, subtype: 0, tierMin, tierMax },
    ],
  };
}

/** Standard consumable entries for Lowlands+. */
const CONSUMABLE_ENTRIES: LootTableEntry[] = [
  { type: "independent", dropChance: 0.02, itemId: makeItemId(4, 0, 1) }, // Health Potion
  { type: "independent", dropChance: 0.02, itemId: makeItemId(4, 1, 1) }, // Mana Potion
  { type: "independent", dropChance: 0.01, itemId: makeItemId(4, 2, 1) }, // Portal Gem
];

/** Reduced consumable entries for minions/spawned adds. */
const MINION_CONSUMABLE_ENTRIES: LootTableEntry[] = [
  { type: "independent", dropChance: 0.01, itemId: makeItemId(4, 0, 1) }, // Health Potion
  { type: "independent", dropChance: 0.01, itemId: makeItemId(4, 1, 1) }, // Mana Potion
  { type: "independent", dropChance: 0.005, itemId: makeItemId(4, 2, 1) }, // Portal Gem
];

/** Boss loot tables by dungeon type. */
export const BOSS_LOOT_TABLES: Record<number, LootTable> = {
  [DungeonType.InfernalPit]: {
    entries: [
      { type: "independent", dropChance: 1.0, orbRarityWeighted: true },
      makeEquipmentTierGroup(0.25, 10, 10),
    ],
  },
  [DungeonType.VoidSanctum]: {
    entries: [
      { type: "independent", dropChance: 1.0, orbRarityWeighted: true },
      // Each UT rolled independently (base 1.25% each = ~5% total for at least one)
      ...UT_ITEM_IDS.map(
        (id): IndependentDropEntry => ({
          type: "independent",
          dropChance: 0.05 / Math.max(1, UT_ITEM_IDS.length),
          itemId: id,
        })
      ),
      makeEquipmentTierGroup(0.15, 11, 12),
    ],
  },
};

/** Per-enemy loot tables. Every enemy has its own entry. */
export const ENEMY_LOOT_TABLES: Partial<Record<number, LootTable>> = {
  // ===== SHORE (Tier 1) — no drops =====
  [EnemyType.HermitCrab]: { entries: [] },
  [EnemyType.Frog]: { entries: [] },
  [EnemyType.Sandpiper]: { entries: [] },
  [EnemyType.Jellyfish]: { entries: [] },
  [EnemyType.CoconutCrab]: { entries: [] },

  // ===== LOWLANDS (Tier 2) — 12.5% tier 2-3 equipment + consumables =====
  [EnemyType.Wolf]: {
    entries: [makeEquipmentTierGroup(0.125, 2, 3), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.Rattlesnake]: {
    entries: [makeEquipmentTierGroup(0.125, 2, 3), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.BogLurker]: {
    entries: [makeEquipmentTierGroup(0.125, 2, 3), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.SwampToad]: {
    entries: [makeEquipmentTierGroup(0.125, 2, 3), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.ThornBush]: {
    entries: [makeEquipmentTierGroup(0.125, 2, 3), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.DesertScorpion]: {
    entries: [makeEquipmentTierGroup(0.125, 2, 3), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.BriarBeast]: { // Pack leader — full drops
    entries: [makeEquipmentTierGroup(0.125, 2, 3), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.BriarImp]: { // Pack minion — reduced drops
    entries: [makeEquipmentTierGroup(0.04, 2, 3), ...MINION_CONSUMABLE_ENTRIES],
  },

  // ===== MIDLANDS (Tier 3) — 12.5% tier 4-5 equipment + consumables =====
  [EnemyType.ForestGuardian]: {
    entries: [makeEquipmentTierGroup(0.125, 4, 5), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.DustDevil]: {
    entries: [makeEquipmentTierGroup(0.125, 4, 5), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.JungleStalker]: {
    entries: [makeEquipmentTierGroup(0.125, 4, 5), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.StoneGolem]: {
    entries: [makeEquipmentTierGroup(0.125, 4, 5), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.VenomSpitter]: {
    entries: [makeEquipmentTierGroup(0.125, 4, 5), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.SandWraith]: {
    entries: [makeEquipmentTierGroup(0.125, 4, 5), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.BroodMother]: { // Pack leader — full drops
    entries: [makeEquipmentTierGroup(0.125, 4, 5), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.Broodling]: { // Pack minion — reduced drops
    entries: [makeEquipmentTierGroup(0.04, 4, 5), ...MINION_CONSUMABLE_ENTRIES],
  },

  // ===== HIGHLANDS (Tier 4) — 12.5% tier 6-7 equipment + consumables =====
  [EnemyType.FrostWarden]: {
    entries: [makeEquipmentTierGroup(0.125, 6, 7), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.CliffDrake]: {
    entries: [makeEquipmentTierGroup(0.125, 6, 7), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.StormElemental]: {
    entries: [makeEquipmentTierGroup(0.125, 6, 7), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.IceWraith]: {
    entries: [makeEquipmentTierGroup(0.125, 6, 7), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.ThunderHawk]: {
    entries: [makeEquipmentTierGroup(0.125, 6, 7), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.MountainTroll]: {
    entries: [makeEquipmentTierGroup(0.125, 6, 7), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.FrostMatriarch]: { // Pack leader — full drops
    entries: [makeEquipmentTierGroup(0.125, 6, 7), ...CONSUMABLE_ENTRIES],
  },
  [EnemyType.FrostSprite]: { // Pack minion — reduced drops
    entries: [makeEquipmentTierGroup(0.04, 6, 7), ...MINION_CONSUMABLE_ENTRIES],
  },

  // ===== GODLANDS (Tier 5) — 7.5% tier 8-9 equipment, 3.75% orb + consumables =====
  [EnemyType.FallenSeraph]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.VoidWalker]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.AncientTitan]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.AbyssalEye]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.ChaosSpawn]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.DoomPriest]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },

  // ===== DUNGEON: The Infernal Pit — Godlands-level drops =====
  [EnemyType.InfernalHound]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.MagmaSerpent]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.CinderWraith]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },

  // ===== DUNGEON: The Void Sanctum — Godlands-level drops =====
  [EnemyType.VoidAcolyte]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.ShadowWeaver]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.AbyssalSentry]: {
    entries: [
      makeEquipmentTierGroup(0.075, 8, 9),
      { type: "independent", dropChance: 0.0375, orbRarityWeighted: true },
      ...CONSUMABLE_ENTRIES,
    ],
  },
  [EnemyType.VoidMinion]: { // Spawned add — reduced drops
    entries: [makeEquipmentTierGroup(0.02, 8, 9), ...MINION_CONSUMABLE_ENTRIES],
  },
  [EnemyType.VoidSwitch]: { entries: [] }, // Destructible object — no drops
};

/** Resolve the loot table for an enemy by type. */
export function getLootTable(enemyType: number): LootTable {
  return ENEMY_LOOT_TABLES[enemyType] ?? { entries: [] };
}

/** Get boss loot table by dungeon type. */
export function getBossLootTable(dungeonType: number): LootTable {
  return BOSS_LOOT_TABLES[dungeonType] ?? { entries: [] };
}

// --- Loot Roll Functions ---

/** Resolve an independent drop entry into an item. */
function resolveIndependentDrop(
  entry: IndependentDropEntry
): ItemInstanceData | null {
  if (entry.orbRarityWeighted) {
    return rollRandomOrb();
  }
  if (entry.itemId !== undefined) {
    const category = getItemCategory(entry.itemId);
    const tier = getItemTier(entry.itemId);
    if (tier === ItemTier.UT) {
      return generateUTItemInstance(entry.itemId);
    }
    if (category === ItemCategory.Consumable) {
      return generateConsumableInstance(entry.itemId);
    }
    return generateItemInstance(
      category,
      getItemSubtype(entry.itemId),
      tier
    );
  }
  if (entry.category !== undefined && entry.tier !== undefined) {
    return generateItemInstance(
      entry.category,
      entry.subtype ?? 0,
      entry.tier
    );
  }
  return null;
}

/** Resolve a tier group entry: pick one random item from the pool. */
function resolveTierGroupDrop(
  entry: TierGroupDropEntry
): ItemInstanceData | null {
  if (entry.items.length === 0) return null;
  const picked = pickRandom(entry.items);
  const tier =
    picked.tierMin +
    Math.floor(Math.random() * (picked.tierMax - picked.tierMin + 1));
  return generateItemInstance(picked.category, picked.subtype, tier);
}

/**
 * Roll a loot table: each entry is rolled independently.
 * Returns all items that dropped (empty array = no drop).
 */
export function rollLootTable(table: LootTable): ItemInstanceData[] {
  const items: ItemInstanceData[] = [];
  for (const entry of table.entries) {
    if (Math.random() >= entry.dropChance) continue;
    const item =
      entry.type === "independent"
        ? resolveIndependentDrop(entry)
        : resolveTierGroupDrop(entry);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Roll boss loot with a custom UT chance (for dungeon rarity boosts).
 * Distributes utTotalChance across all UT entries in the table.
 */
export function rollBossLootTable(
  dungeonType: number,
  utTotalChance: number = 0.05
): ItemInstanceData[] {
  const baseTable = getBossLootTable(dungeonType);

  const utEntries = baseTable.entries.filter(
    (e) =>
      e.type === "independent" &&
      e.itemId !== undefined &&
      getItemTier(e.itemId) === ItemTier.UT
  );
  const utCount = utEntries.length;
  const perUtChance = utCount > 0 ? utTotalChance / utCount : 0;

  const modifiedEntries = baseTable.entries.map((entry) => {
    if (
      entry.type === "independent" &&
      entry.itemId !== undefined &&
      getItemTier(entry.itemId) === ItemTier.UT
    ) {
      return { ...entry, dropChance: Math.min(1.0, perUtChance) };
    }
    return entry;
  });

  return rollLootTable({ entries: modifiedEntries });
}

/**
 * Determine bag rarity from item contents.
 * Priority: UT → Black, T8+ equipment → Red, only orbs → Orange, else Green.
 */
export function determineBagRarity(items: ItemInstanceData[]): number {
  let hasUT = false;
  let hasHighTier = false;
  let allCraftingOrbs = true;

  for (const item of items) {
    if (item.baseItemId === -1) continue;
    const category = getItemCategory(item.baseItemId);
    const tier = getItemTier(item.baseItemId);

    if (category === ItemCategory.CraftingOrb) {
      // Crafting orbs don't affect hasHighTier/hasUT
      continue;
    }

    allCraftingOrbs = false;

    if (tier === ItemTier.UT) {
      hasUT = true;
    } else if (tier >= 8) {
      hasHighTier = true;
    }
  }

  if (hasUT) return BagRarity.Black;
  if (hasHighTier) return BagRarity.Red;
  if (allCraftingOrbs) return BagRarity.Orange;
  return BagRarity.Green;
}
