import {
  ItemCategory,
  ItemTier,
  WeaponSubtype,
  AbilitySubtype,
  ArmorSubtype,
  BagRarity,
  DungeonType,
  EnemyType,
  CraftingOrbType,
} from "./types";
import { PORTAL_GEM_MAX_STACK } from "./constants";
import {
  ItemInstanceData,
  LOCKED_STATS_BY_CATEGORY,
  ARMOR_LOCKED_STATS,
  rollStatTier,
  rollStatRoll,
  createEmptyItemInstance,
  pickRandom,
  rollInitialOpenStats,
  ORBS_BY_RARITY,
  OrbRarity,
  ORB_DEFINITIONS,
  ORB_MAX_STACK,
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
  usageHint?: string;
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

  // ===== WANDS (category=0, subtype=2) =====
  [makeItemId(0, 2, 1)]: {
    id: 201, name: "Apprentice Wand", category: 0, subtype: 2, tier: 1,
    color: 0x8b7355, tierColor: TIER_COLORS[1],
    description: "A novice's wand. Its bolts pierce weakly.",
    weaponStats: { damage: 18, range: 458, shootCooldown: 850, projectileSpeed: 539, projectileSize: 4 },
  },
  [makeItemId(0, 2, 2)]: {
    id: 202, name: "Aether Wand", category: 0, subtype: 2, tier: 2,
    color: 0x44aa44, tierColor: TIER_COLORS[2],
    description: "Channels raw aether into piercing bolts.",
    weaponStats: { damage: 27, range: 478, shootCooldown: 567, projectileSpeed: 558, projectileSize: 5 },
  },
  [makeItemId(0, 2, 3)]: {
    id: 203, name: "Crystal Wand", category: 0, subtype: 2, tier: 3,
    color: 0x778899, tierColor: TIER_COLORS[3],
    description: "Crystal focus sharpens arcane bolts.",
    weaponStats: { damage: 36, range: 499, shootCooldown: 425, projectileSpeed: 576, projectileSize: 5 },
  },
  [makeItemId(0, 2, 4)]: {
    id: 204, name: "Arcane Wand", category: 0, subtype: 2, tier: 4,
    color: 0xaa44ff, tierColor: TIER_COLORS[4],
    description: "Pure arcane energy tears through foes.",
    weaponStats: { damage: 45, range: 520, shootCooldown: 340, projectileSpeed: 620, projectileSize: 5 },
  },
  [makeItemId(0, 2, 5)]: {
    id: 205, name: "Shadow Wand", category: 0, subtype: 2, tier: 5,
    color: 0x6644aa, tierColor: TIER_COLORS[5],
    description: "Dark magic that pierces all barriers.",
    weaponStats: { damage: 54, range: 541, shootCooldown: 283, projectileSpeed: 639, projectileSize: 5 },
  },
  [makeItemId(0, 2, 6)]: {
    id: 206, name: "Divine Wand", category: 0, subtype: 2, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Blessed bolts of radiant energy.",
    weaponStats: { damage: 68, range: 572, shootCooldown: 227, projectileSpeed: 667, projectileSize: 6 },
  },
  [makeItemId(0, 2, 7)]: {
    id: 207, name: "Infernal Wand", category: 0, subtype: 2, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Hellfire bolts that burn through anything.",
    weaponStats: { damage: 81, range: 603, shootCooldown: 189, projectileSpeed: 696, projectileSize: 6 },
  },
  [makeItemId(0, 2, 8)]: {
    id: 208, name: "Abyssal Wand", category: 0, subtype: 2, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Channels the void into devastating bolts.",
    weaponStats: { damage: 99, range: 645, shootCooldown: 155, projectileSpeed: 734, projectileSize: 7 },
  },
  [makeItemId(0, 2, 9)]: {
    id: 209, name: "Spectral Wand", category: 0, subtype: 2, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Ghostly bolts phase through all resistance.",
    weaponStats: { damage: 117, range: 686, shootCooldown: 131, projectileSpeed: 772, projectileSize: 7 },
  },
  [makeItemId(0, 2, 10)]: {
    id: 210, name: "Celestial Wand", category: 0, subtype: 2, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Starlight condensed into piercing rays.",
    weaponStats: { damage: 135, range: 728, shootCooldown: 113, projectileSpeed: 810, projectileSize: 7 },
  },
  [makeItemId(0, 2, 11)]: {
    id: 211, name: "Doomfire Wand", category: 0, subtype: 2, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Apocalyptic bolts that rend reality.",
    weaponStats: { damage: 158, range: 780, shootCooldown: 97, projectileSpeed: 858, projectileSize: 8 },
  },
  [makeItemId(0, 2, 12)]: {
    id: 212, name: "Eternity Wand", category: 0, subtype: 2, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "The last arcane focus ever created.",
    weaponStats: { damage: 180, range: 832, shootCooldown: 85, projectileSpeed: 906, projectileSize: 8 },
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

  // ===== HELMS (category=1, subtype=1) =====
  [makeItemId(1, 1, 1)]: {
    id: 1101, name: "Iron Helm", category: 1, subtype: 1, tier: 1,
    color: 0x8b7355, tierColor: TIER_COLORS[1],
    description: "A basic helm that spins with force.",
    abilityStats: { damage: 30, range: 130, projectileSpeed: 350, projectileSize: 10, manaCost: 35, cooldown: 1100, piercing: true },
  },
  [makeItemId(1, 1, 2)]: {
    id: 1102, name: "Steel Helm", category: 1, subtype: 1, tier: 2,
    color: 0xaabbcc, tierColor: TIER_COLORS[2],
    description: "Reinforced steel spins with deadly force.",
    abilityStats: { damage: 45, range: 135, projectileSpeed: 360, projectileSize: 10, manaCost: 37, cooldown: 1075, piercing: true },
  },
  [makeItemId(1, 1, 3)]: {
    id: 1103, name: "Crystal Helm", category: 1, subtype: 1, tier: 3,
    color: 0x44cc66, tierColor: TIER_COLORS[3],
    description: "Crystal shards shred nearby foes.",
    abilityStats: { damage: 62, range: 140, projectileSpeed: 370, projectileSize: 11, manaCost: 38, cooldown: 1050, piercing: true },
  },
  [makeItemId(1, 1, 4)]: {
    id: 1104, name: "Demon Helm", category: 1, subtype: 1, tier: 4,
    color: 0xff4422, tierColor: TIER_COLORS[4],
    description: "Demonic fury unleashed in a deadly spin.",
    abilityStats: { damage: 80, range: 150, projectileSpeed: 400, projectileSize: 12, manaCost: 40, cooldown: 1000, piercing: true },
  },
  [makeItemId(1, 1, 5)]: {
    id: 1105, name: "Shadow Helm", category: 1, subtype: 1, tier: 5,
    color: 0x8844cc, tierColor: TIER_COLORS[5],
    description: "Shadows lash out at all nearby enemies.",
    abilityStats: { damage: 100, range: 160, projectileSpeed: 420, projectileSize: 12, manaCost: 42, cooldown: 950, piercing: true },
  },
  [makeItemId(1, 1, 6)]: {
    id: 1106, name: "Divine Helm", category: 1, subtype: 1, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Holy wrath strikes all who stand near.",
    abilityStats: { damage: 128, range: 170, projectileSpeed: 440, projectileSize: 13, manaCost: 44, cooldown: 900, piercing: true },
  },
  [makeItemId(1, 1, 7)]: {
    id: 1107, name: "Infernal Helm", category: 1, subtype: 1, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Hellfire erupts in a devastating circle.",
    abilityStats: { damage: 144, range: 175, projectileSpeed: 450, projectileSize: 13, manaCost: 46, cooldown: 870, piercing: true },
  },
  [makeItemId(1, 1, 8)]: {
    id: 1108, name: "Abyssal Helm", category: 1, subtype: 1, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Abyssal energy tears through everything nearby.",
    abilityStats: { damage: 176, range: 185, projectileSpeed: 460, projectileSize: 14, manaCost: 48, cooldown: 840, piercing: true },
  },
  [makeItemId(1, 1, 9)]: {
    id: 1109, name: "Spectral Helm", category: 1, subtype: 1, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Ghostly blades spin through the living.",
    abilityStats: { damage: 208, range: 195, projectileSpeed: 470, projectileSize: 14, manaCost: 50, cooldown: 810, piercing: true },
  },
  [makeItemId(1, 1, 10)]: {
    id: 1110, name: "Celestial Helm", category: 1, subtype: 1, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Starlight shreds all in its orbit.",
    abilityStats: { damage: 240, range: 205, projectileSpeed: 480, projectileSize: 15, manaCost: 52, cooldown: 780, piercing: true },
  },
  [makeItemId(1, 1, 11)]: {
    id: 1111, name: "Doomfire Helm", category: 1, subtype: 1, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Apocalyptic flames consume the battlefield.",
    abilityStats: { damage: 280, range: 215, projectileSpeed: 490, projectileSize: 15, manaCost: 54, cooldown: 750, piercing: true },
  },
  [makeItemId(1, 1, 12)]: {
    id: 1112, name: "Eternity Helm", category: 1, subtype: 1, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "An endless vortex of annihilation.",
    abilityStats: { damage: 320, range: 225, projectileSpeed: 500, projectileSize: 16, manaCost: 56, cooldown: 720, piercing: true },
  },

  // ===== RELICS (category=1, subtype=2) =====
  [makeItemId(1, 2, 1)]: {
    id: 1201, name: "Stone Relic", category: 1, subtype: 2, tier: 1,
    color: 0x8b7355, tierColor: TIER_COLORS[1],
    description: "Emits a weak expanding pulse.",
    abilityStats: { damage: 48, range: 176, projectileSpeed: 271, projectileSize: 13, manaCost: 47, cooldown: 3000, piercing: true },
  },
  [makeItemId(1, 2, 2)]: {
    id: 1202, name: "Iron Relic", category: 1, subtype: 2, tier: 2,
    color: 0xaabbcc, tierColor: TIER_COLORS[2],
    description: "Arcane energy ripples outward.",
    abilityStats: { damage: 72, range: 184, projectileSpeed: 282, projectileSize: 14, manaCost: 46, cooldown: 2000, piercing: true },
  },
  [makeItemId(1, 2, 3)]: {
    id: 1203, name: "Crystal Relic", category: 1, subtype: 2, tier: 3,
    color: 0x44cc66, tierColor: TIER_COLORS[3],
    description: "Crystal resonance shatters nearby foes.",
    abilityStats: { damage: 96, range: 192, projectileSpeed: 294, projectileSize: 14, manaCost: 45, cooldown: 1500, piercing: true },
  },
  [makeItemId(1, 2, 4)]: {
    id: 1204, name: "Arcane Relic", category: 1, subtype: 2, tier: 4,
    color: 0xaa44ff, tierColor: TIER_COLORS[4],
    description: "Unleashes a devastating arcane nova.",
    abilityStats: { damage: 120, range: 200, projectileSpeed: 300, projectileSize: 15, manaCost: 45, cooldown: 1200, piercing: true },
  },
  [makeItemId(1, 2, 5)]: {
    id: 1205, name: "Shadow Relic", category: 1, subtype: 2, tier: 5,
    color: 0x8844cc, tierColor: TIER_COLORS[5],
    description: "Shadow energy consumes all nearby.",
    abilityStats: { damage: 144, range: 208, projectileSpeed: 318, projectileSize: 16, manaCost: 44, cooldown: 1000, piercing: true },
  },
  [makeItemId(1, 2, 6)]: {
    id: 1206, name: "Divine Relic", category: 1, subtype: 2, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Holy radiance purges all within reach.",
    abilityStats: { damage: 180, range: 220, projectileSpeed: 338, projectileSize: 16, manaCost: 42, cooldown: 800, piercing: true },
  },
  [makeItemId(1, 2, 7)]: {
    id: 1207, name: "Infernal Relic", category: 1, subtype: 2, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Hellfire erupts in an ever-growing wave.",
    abilityStats: { damage: 216, range: 232, projectileSpeed: 357, projectileSize: 17, manaCost: 41, cooldown: 667, piercing: true },
  },
  [makeItemId(1, 2, 8)]: {
    id: 1208, name: "Abyssal Relic", category: 1, subtype: 2, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "The abyss expands to devour everything.",
    abilityStats: { damage: 264, range: 248, projectileSpeed: 381, projectileSize: 18, manaCost: 39, cooldown: 545, piercing: true },
  },
  [makeItemId(1, 2, 9)]: {
    id: 1209, name: "Spectral Relic", category: 1, subtype: 2, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Ghostly energy tears through the living.",
    abilityStats: { damage: 312, range: 264, projectileSpeed: 405, projectileSize: 19, manaCost: 37, cooldown: 462, piercing: true },
  },
  [makeItemId(1, 2, 10)]: {
    id: 1210, name: "Celestial Relic", category: 1, subtype: 2, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Starlight explodes in an expanding nova.",
    abilityStats: { damage: 360, range: 280, projectileSpeed: 429, projectileSize: 20, manaCost: 35, cooldown: 400, piercing: true },
  },
  [makeItemId(1, 2, 11)]: {
    id: 1211, name: "Doomfire Relic", category: 1, subtype: 2, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Apocalyptic flame engulfs the battlefield.",
    abilityStats: { damage: 420, range: 300, projectileSpeed: 459, projectileSize: 20, manaCost: 33, cooldown: 343, piercing: true },
  },
  [makeItemId(1, 2, 12)]: {
    id: 1212, name: "Eternity Relic", category: 1, subtype: 2, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "An infinite expanding wave of annihilation.",
    abilityStats: { damage: 480, range: 320, projectileSpeed: 488, projectileSize: 21, manaCost: 31, cooldown: 300, piercing: true },
  },

  // ===== HEAVY ARMOR (category=2, subtype=0) =====
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

  // ===== LIGHT ARMOR (category=2, subtype=1) =====
  [makeItemId(2, 1, 1)]: {
    id: 2101, name: "Padded Vest", category: 2, subtype: 1, tier: 1,
    color: 0x6b6b6b, tierColor: TIER_COLORS[1],
    description: "Light padding for agile fighters.",
    armorStats: { maxHpBonus: 7 },
  },
  [makeItemId(2, 1, 2)]: {
    id: 2102, name: "Scout's Leather", category: 2, subtype: 1, tier: 2,
    color: 0x9c6b30, tierColor: TIER_COLORS[2],
    description: "Supple leather favored by scouts.",
    armorStats: { maxHpBonus: 16 },
  },
  [makeItemId(2, 1, 3)]: {
    id: 2103, name: "Ranger Mail", category: 2, subtype: 1, tier: 3,
    color: 0x778899, tierColor: TIER_COLORS[3],
    description: "Light chain links over leather.",
    armorStats: { maxHpBonus: 29 },
  },
  [makeItemId(2, 1, 4)]: {
    id: 2104, name: "Shadow Garb", category: 2, subtype: 1, tier: 4,
    color: 0xaabbcc, tierColor: TIER_COLORS[4],
    description: "Dark cloth that absorbs impact.",
    armorStats: { maxHpBonus: 45 },
  },
  [makeItemId(2, 1, 5)]: {
    id: 2105, name: "Windwalker Vest", category: 2, subtype: 1, tier: 5,
    color: 0xcc2200, tierColor: TIER_COLORS[5],
    description: "Enchanted to move with the wind.",
    armorStats: { maxHpBonus: 65 },
  },
  [makeItemId(2, 1, 6)]: {
    id: 2106, name: "Divine Vestments", category: 2, subtype: 1, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Blessed robes of the swift.",
    armorStats: { maxHpBonus: 91 },
  },
  [makeItemId(2, 1, 7)]: {
    id: 2107, name: "Infernal Shroud", category: 2, subtype: 1, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Flame-touched cloth, light as air.",
    armorStats: { maxHpBonus: 110 },
  },
  [makeItemId(2, 1, 8)]: {
    id: 2108, name: "Abyssal Wrap", category: 2, subtype: 1, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Woven from threads of the deep.",
    armorStats: { maxHpBonus: 137 },
  },
  [makeItemId(2, 1, 9)]: {
    id: 2109, name: "Spectral Cloak", category: 2, subtype: 1, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Phases between realms to deflect blows.",
    armorStats: { maxHpBonus: 163 },
  },
  [makeItemId(2, 1, 10)]: {
    id: 2110, name: "Celestial Garb", category: 2, subtype: 1, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Garments spun from starlight.",
    armorStats: { maxHpBonus: 189 },
  },
  [makeItemId(2, 1, 11)]: {
    id: 2111, name: "Doomfire Mantle", category: 2, subtype: 1, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Burns with contained apocalyptic flame.",
    armorStats: { maxHpBonus: 221 },
  },
  [makeItemId(2, 1, 12)]: {
    id: 2112, name: "Eternity Veil", category: 2, subtype: 1, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "Protection beyond the end of time.",
    armorStats: { maxHpBonus: 260 },
  },

  // ===== MANTLES (category=2, subtype=2) =====
  [makeItemId(2, 2, 1)]: {
    id: 2201, name: "Torn Mantle", category: 2, subtype: 2, tier: 1,
    color: 0x6b6b6b, tierColor: TIER_COLORS[1],
    description: "A frayed cloak. Offers little protection.",
    armorStats: { maxHpBonus: 5, manaRegenBonus: 1 },
  },
  [makeItemId(2, 2, 2)]: {
    id: 2202, name: "Woven Mantle", category: 2, subtype: 2, tier: 2,
    color: 0x9c6b30, tierColor: TIER_COLORS[2],
    description: "Enchanted threads channel mana.",
    armorStats: { maxHpBonus: 11, manaRegenBonus: 2 },
  },
  [makeItemId(2, 2, 3)]: {
    id: 2203, name: "Silk Mantle", category: 2, subtype: 2, tier: 3,
    color: 0x778899, tierColor: TIER_COLORS[3],
    description: "Fine silk woven with arcane wards.",
    armorStats: { maxHpBonus: 20, manaRegenBonus: 3 },
  },
  [makeItemId(2, 2, 4)]: {
    id: 2204, name: "Arcane Mantle", category: 2, subtype: 2, tier: 4,
    color: 0xaa44ff, tierColor: TIER_COLORS[4],
    description: "Pulses with raw arcane energy.",
    armorStats: { maxHpBonus: 32, manaRegenBonus: 5 },
  },
  [makeItemId(2, 2, 5)]: {
    id: 2205, name: "Shadow Mantle", category: 2, subtype: 2, tier: 5,
    color: 0x6644aa, tierColor: TIER_COLORS[5],
    description: "Darkness fuels the wearer's mana.",
    armorStats: { maxHpBonus: 45, manaRegenBonus: 7 },
  },
  [makeItemId(2, 2, 6)]: {
    id: 2206, name: "Divine Mantle", category: 2, subtype: 2, tier: 6,
    color: 0xffdd00, tierColor: TIER_COLORS[6],
    description: "Blessed cloth that restores mana rapidly.",
    armorStats: { maxHpBonus: 63, manaRegenBonus: 10 },
  },
  [makeItemId(2, 2, 7)]: {
    id: 2207, name: "Infernal Mantle", category: 2, subtype: 2, tier: 7,
    color: 0xff4444, tierColor: TIER_COLORS[7],
    description: "Hellfire cloth that burns with power.",
    armorStats: { maxHpBonus: 77, manaRegenBonus: 12 },
  },
  [makeItemId(2, 2, 8)]: {
    id: 2208, name: "Abyssal Mantle", category: 2, subtype: 2, tier: 8,
    color: 0xff66aa, tierColor: TIER_COLORS[8],
    description: "Draws mana from the endless abyss.",
    armorStats: { maxHpBonus: 95, manaRegenBonus: 15 },
  },
  [makeItemId(2, 2, 9)]: {
    id: 2209, name: "Spectral Mantle", category: 2, subtype: 2, tier: 9,
    color: 0x44ffcc, tierColor: TIER_COLORS[9],
    description: "Phases between realms, channeling mana.",
    armorStats: { maxHpBonus: 113, manaRegenBonus: 18 },
  },
  [makeItemId(2, 2, 10)]: {
    id: 2210, name: "Celestial Mantle", category: 2, subtype: 2, tier: 10,
    color: 0xffffff, tierColor: TIER_COLORS[10],
    description: "Starlight fabric that floods the wearer with mana.",
    armorStats: { maxHpBonus: 131, manaRegenBonus: 21 },
  },
  [makeItemId(2, 2, 11)]: {
    id: 2211, name: "Doomfire Mantle", category: 2, subtype: 2, tier: 11,
    color: 0xff8844, tierColor: TIER_COLORS[11],
    description: "Apocalyptic cloth that blazes with mana.",
    armorStats: { maxHpBonus: 153, manaRegenBonus: 25 },
  },
  [makeItemId(2, 2, 12)]: {
    id: 2212, name: "Eternity Mantle", category: 2, subtype: 2, tier: 12,
    color: 0xff2266, tierColor: TIER_COLORS[12],
    description: "The ultimate arcane mantle, beyond time.",
    armorStats: { maxHpBonus: 180, manaRegenBonus: 30 },
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
  [makeItemId(1, 1, 13)]: {
    id: 1113, name: "Berserker's Crown", category: 1, subtype: 1, tier: 13,
    color: 0x00cccc, tierColor: TIER_COLORS[13],
    description: "Spins with devastating fury, striking all nearby foes.",
    abilityStats: {
      damage: 100, range: 200, projectileSpeed: 450, projectileSize: 14,
      manaCost: 50, cooldown: 1400, piercing: true,
    },
  },
  [makeItemId(2, 1, 13)]: {
    id: 2113, name: "Windrunner's Cloak", category: 2, subtype: 1, tier: 13,
    color: 0x00cccc, tierColor: TIER_COLORS[13],
    description: "Sacrifices protection for unmatched agility.",
    armorStats: { maxHpBonus: 30, manaRegenBonus: 5 },
  },

  // ===== CONSUMABLES (category=4) =====
  [makeItemId(4, 2, 1)]: {
    id: 4201, name: "Portal Gem", category: 4, subtype: 2, tier: 1,
    color: 0xaa44ff, tierColor: TIER_COLORS[1],
    description: "Teleport anywhere on the map.",
    usageHint: "Right-click minimap to target. Press T to open a portal to your vault.",
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

export function isStackableItem(itemId: number): boolean {
  return isConsumableItem(itemId) || isCraftingOrbItem(itemId);
}

export function getMaxStack(itemId: number): number {
  if (isConsumableItem(itemId)) return PORTAL_GEM_MAX_STACK;
  if (isCraftingOrbItem(itemId)) return ORB_MAX_STACK;
  return 1;
}

// --- Subtype display names ---

const WEAPON_SUBTYPE_NAMES: Record<number, string> = {
  [WeaponSubtype.Sword]: "Sword",
  [WeaponSubtype.Bow]: "Bow",
  [WeaponSubtype.Wand]: "Wand",
};

const ABILITY_SUBTYPE_NAMES: Record<number, string> = {
  [AbilitySubtype.Quiver]: "Quiver",
  [AbilitySubtype.Helm]: "Helm",
  [AbilitySubtype.Relic]: "Relic",
};

const ARMOR_SUBTYPE_NAMES: Record<number, string> = {
  [ArmorSubtype.Heavy]: "Heavy Armor",
  [ArmorSubtype.Light]: "Light Armor",
  [ArmorSubtype.Mantle]: "Mantle",
};

export function getSubtypeName(category: number, subtype: number): string {
  if (category === ItemCategory.Weapon) return WEAPON_SUBTYPE_NAMES[subtype] ?? "Weapon";
  if (category === ItemCategory.Ability) return ABILITY_SUBTYPE_NAMES[subtype] ?? "Ability";
  if (category === ItemCategory.Armor) return ARMOR_SUBTYPE_NAMES[subtype] ?? "Armor";
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
  let lockedStats = LOCKED_STATS_BY_CATEGORY[category];
  if (category === ItemCategory.Armor) {
    lockedStats = ARMOR_LOCKED_STATS[subtype] ?? lockedStats;
  }
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
    forgeProtectedSlot2: -1,
    quantity: 0,
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
    forgeProtectedSlot2: -1,
    quantity: 0,
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
    forgeProtectedSlot2: -1,
    quantity: 1,
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
    forgeProtectedSlot2: -1,
    quantity: 1,
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
      { category: ItemCategory.Weapon, subtype: WeaponSubtype.Sword, tierMin, tierMax },
      { category: ItemCategory.Weapon, subtype: WeaponSubtype.Bow, tierMin, tierMax },
      { category: ItemCategory.Weapon, subtype: WeaponSubtype.Wand, tierMin, tierMax },
      { category: ItemCategory.Ability, subtype: AbilitySubtype.Quiver, tierMin, tierMax },
      { category: ItemCategory.Ability, subtype: AbilitySubtype.Helm, tierMin, tierMax },
      { category: ItemCategory.Ability, subtype: AbilitySubtype.Relic, tierMin, tierMax },
      { category: ItemCategory.Armor, subtype: ArmorSubtype.Heavy, tierMin, tierMax },
      { category: ItemCategory.Armor, subtype: ArmorSubtype.Light, tierMin, tierMax },
      { category: ItemCategory.Armor, subtype: ArmorSubtype.Mantle, tierMin, tierMax },
      { category: ItemCategory.Ring, subtype: 0, tierMin, tierMax },
    ],
  };
}

/** Standard consumable entries for Lowlands+. */
const CONSUMABLE_ENTRIES: LootTableEntry[] = [
  { type: "independent", dropChance: 0.01, itemId: makeItemId(4, 2, 1) }, // Portal Gem
];

/** Reduced consumable entries for minions/spawned adds. */
const MINION_CONSUMABLE_ENTRIES: LootTableEntry[] = [
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
      { type: "independent", dropChance: 0.35, itemId: makeItemId(ItemCategory.CraftingOrb, CraftingOrbType.Divine, 1) },
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
    if (category === ItemCategory.CraftingOrb) {
      return generateOrbInstance(getItemSubtype(entry.itemId));
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
