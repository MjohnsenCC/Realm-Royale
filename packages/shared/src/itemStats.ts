import {
  ItemCategory,
  StatType,
  CraftingOrbType,
  WeaponSubtype,
  AbilitySubtype,
  ArmorSubtype,
} from "./types";

// --- Item Instance Data Interface ---

export interface ItemInstanceData {
  baseItemId: number; // category*1000 + subtype*100 + tier (or UT id)
  instanceTier: number; // 1-12 for tiered items, 0 for UT
  isUT: boolean;
  lockedStat1Type: number;
  lockedStat1Tier: number;
  lockedStat1Roll: number; // 0-100 percentile within tier range
  lockedStat2Type: number;
  lockedStat2Tier: number;
  lockedStat2Roll: number; // 0-100 percentile within tier range
  openStats: number[]; // packed triples: [type, tier, roll, type, tier, roll, ...]
  forgeProtectedSlot: number; // index into openStats triples (0-4), -1 if none
  forgeProtectedSlot2: number; // second protected slot for Divine Forge, -1 if none
  quantity: number; // 0 = non-stackable (default), >=1 = consumable stack count
}

// --- Constants ---

export const MAX_OPEN_STATS = 5;
export const MAX_STAT_TIER = 6;
export const MAX_ITEM_TIER = 12;
export const MAX_ABILITY_RING_TIER = 7;
export const ORB_MAX_STACK = 99;

// --- Item Tier to Max Stat Tier Mapping ---
// T1-2 -> Stat T1, T3-4 -> Stat T2, ..., T11-12 -> Stat T6

export const MAX_STAT_TIER_FOR_ITEM_TIER: Record<number, number> = {
  1: 1, 2: 1,
  3: 2, 4: 2,
  5: 3, 6: 3,
  7: 4, 8: 4,
  9: 5, 10: 5,
  11: 6, 12: 6,
};

// Ability/Ring: each tier maps 1:1 to stat tier (T6-7 both cap at stat T6)
export const MAX_STAT_TIER_FOR_ABILITY_RING_TIER: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 6,
};

export function getMaxStatTierForItemTier(itemTier: number, category?: number): number {
  if (category === ItemCategory.Ability || category === ItemCategory.Ring) {
    return MAX_STAT_TIER_FOR_ABILITY_RING_TIER[itemTier] ?? 1;
  }
  return MAX_STAT_TIER_FOR_ITEM_TIER[itemTier] ?? 1;
}

// --- Locked Stats by Item Category ---

export const LOCKED_STATS_BY_CATEGORY: Record<number, [number, number]> = {
  [ItemCategory.Weapon]: [-1, -1],  // Uses inherent weapon stats (damage, fire rate)
  [ItemCategory.Ability]: [-1, -1], // Uses inherent ability stats (damage, mana cost)
  [ItemCategory.Armor]: [StatType.Health, StatType.HealthRegen],
  [ItemCategory.Ring]: [StatType.Mana, StatType.ManaRegen],
};

// --- Open Stat Pools per Category ---

export const OPEN_STAT_POOL: Record<number, number[]> = {
  [ItemCategory.Weapon]: [
    StatType.AttackDamage,
    StatType.AttackSpeed,
    StatType.MovementSpeed,
    StatType.IncreasedProjectileSpeed,
    StatType.CriticalStrikeChance,
    StatType.CriticalStrikeMultiplier,
  ],
  [ItemCategory.Ability]: [
    StatType.AbilityDamage,
    StatType.AttackDamage,
    StatType.AttackSpeed,
    StatType.MovementSpeed,
    StatType.ReducedAbilityCooldown,
  ],
  [ItemCategory.Armor]: [
    StatType.Health,
    StatType.HealthRegen,
    StatType.ManaRegen,
    StatType.MovementSpeed,
    StatType.PhysicalDamageReduction,
    StatType.MagicDamageReduction,
  ],
  [ItemCategory.Ring]: [
    StatType.AttackDamage,
    StatType.AttackSpeed,
    StatType.Health,
    StatType.HealthRegen,
    StatType.ManaRegen,
    StatType.MovementSpeed,
    StatType.PhysicalDamageReduction,
    StatType.MagicDamageReduction,
  ],
};

// --- Stat Ranges by Stat Tier (T1-T6) ---
// Values are FINAL -- no item tier multiplier applied.
// Each entry is [min, max].

export const STAT_RANGES_BY_TIER: Record<number, Record<number, [number, number]>> = {
  [StatType.AttackDamage]:  { 1: [2, 5],     2: [6, 14],    3: [15, 24],   4: [25, 34],   5: [35, 44],   6: [45, 55] },
  [StatType.AttackSpeed]:   { 1: [1, 2],     2: [2, 3],     3: [3, 5],     4: [5, 8],     5: [8, 10],    6: [10, 13] },
  [StatType.Health]:        { 1: [3, 9],     2: [10, 24],   3: [25, 39],   4: [40, 54],   5: [55, 69],   6: [70, 84] },
  [StatType.HealthRegen]:   { 1: [0.1, 0.3], 2: [0.3, 0.5], 3: [0.5, 0.8], 4: [0.8, 1.2], 5: [1.2, 1.6], 6: [1.6, 2.0] },
  [StatType.ManaRegen]:     { 1: [0.2, 0.5], 2: [0.5, 1.0], 3: [1.0, 1.5], 4: [1.5, 2.5], 5: [2.5, 3.5], 6: [3.5, 5.0] },
  [StatType.MovementSpeed]: { 1: [1, 4],     2: [4, 8],     3: [8, 12],    4: [12, 17],   5: [17, 22],   6: [22, 28] },
  [StatType.Mana]:          { 1: [15, 40],   2: [40, 80],   3: [80, 130],  4: [130, 190], 5: [190, 260], 6: [260, 340] },
  [StatType.PhysicalDamageReduction]: { 1: [1, 4], 2: [2, 8], 3: [3, 12], 4: [3, 16], 5: [3, 20], 6: [3, 25] },
  [StatType.MagicDamageReduction]:    { 1: [1, 4], 2: [2, 8], 3: [3, 12], 4: [3, 16], 5: [3, 20], 6: [3, 25] },
  [StatType.AbilityDamage]:            { 1: [2, 5],   2: [6, 14],  3: [15, 24], 4: [25, 34], 5: [35, 44], 6: [45, 55] },
  [StatType.ReducedAbilityCooldown]:   { 1: [1, 3],   2: [3, 7],   3: [7, 12],  4: [12, 18], 5: [18, 24], 6: [24, 30] },
  [StatType.IncreasedProjectileSpeed]: { 1: [3, 6],   2: [6, 12],  3: [12, 20], 4: [20, 30], 5: [30, 40], 6: [40, 50] },
  [StatType.CriticalStrikeChance]:     { 1: [1, 3],   2: [3, 7],   3: [7, 12],  4: [12, 18], 5: [18, 24], 6: [24, 30] },
  [StatType.CriticalStrikeMultiplier]: { 1: [3, 6],   2: [6, 12],  3: [12, 20], 4: [20, 30], 5: [30, 40], 6: [40, 50] },
};

// Separate locked stat range table for stats that scale differently as locked stats
// (e.g., Health on armor gives much more than Health as an open stat)
export const LOCKED_STAT_RANGES_BY_TIER: Record<number, Record<number, [number, number]>> = {
  [StatType.Health]:    { 1: [80, 170], 2: [180, 370], 3: [380, 580], 4: [590, 800], 5: [810, 1030], 6: [1040, 1280] },
  [StatType.Mana]:      { 1: [15, 40],  2: [40, 80],   3: [80, 130],  4: [130, 190], 5: [190, 260],  6: [260, 340] },
  [StatType.ManaRegen]: { 1: [0.3, 0.8], 2: [0.8, 1.6], 3: [1.6, 2.6], 4: [2.6, 3.8], 5: [3.8, 5.2], 6: [5.2, 6.8] },
};

// --- Locked Quality Multiplier (DEPRECATED — kept for backward compat) ---
/** @deprecated Use LOCKED_QUALITY_BY_ITEM_TIER instead. */
export const LOCKED_QUALITY_MULTIPLIER: Record<number, [number, number]> = {
  1: [0.80, 0.90],
  2: [0.88, 0.98],
  3: [0.95, 1.05],
  4: [1.02, 1.14],
  5: [1.12, 1.25],
  6: [1.22, 1.38],
};

/** @deprecated Use getLockedQualityMultiplier instead. */
export function getQualityMultiplier(tier: number, roll: number): number {
  const range = LOCKED_QUALITY_MULTIPLIER[tier];
  if (!range) return 1.0;
  const [min, max] = range;
  return min + (max - min) * (roll / 100);
}

// --- NEW: Locked Quality by Item Tier (non-overlapping) ---
// Weapon/ability quality multiplier determined directly by item tier (1-12).
// Each entry is [min, max]; roll (0-100) interpolates within the range.
// Strict non-overlapping: min[n+1] > max[n].
export const LOCKED_QUALITY_BY_ITEM_TIER: Record<number, [number, number]> = {
  1:  [0.70, 0.74],  2:  [0.75, 0.79],
  3:  [0.80, 0.85],  4:  [0.86, 0.91],
  5:  [0.92, 0.97],  6:  [0.98, 1.04],
  7:  [1.05, 1.11],  8:  [1.12, 1.19],
  9:  [1.20, 1.28],  10: [1.29, 1.37],
  11: [1.38, 1.47],  12: [1.48, 1.58],
};

// Ability/Ring quality: 7 tiers spanning the full T1-12 range.
export const ABILITY_RING_QUALITY_BY_ITEM_TIER: Record<number, [number, number]> = {
  1: [0.70, 0.76],  2: [0.78, 0.86],  3: [0.88, 0.97],
  4: [0.99, 1.10],  5: [1.12, 1.25],  6: [1.27, 1.42],  7: [1.44, 1.58],
};

// UT weapons/abilities: single quality range (~T9-11 equivalent).
export const UT_LOCKED_QUALITY: [number, number] = [1.20, 1.47];

/** Get the locked quality multiplier for an item tier and roll (0-100). */
export function getLockedQualityMultiplier(itemTier: number, roll: number, isUT: boolean = false, category?: number): number {
  let range: [number, number] | undefined;
  if (isUT) {
    range = UT_LOCKED_QUALITY;
  } else if (category === ItemCategory.Ability || category === ItemCategory.Ring) {
    range = ABILITY_RING_QUALITY_BY_ITEM_TIER[itemTier];
  } else {
    range = LOCKED_QUALITY_BY_ITEM_TIER[itemTier];
  }
  if (!range) return 1.0;
  const [min, max] = range;
  return min + (max - min) * (roll / 100);
}

/** Get the locked quality range for an item tier (or UT). */
export function getLockedQualityRange(itemTier: number, isUT: boolean = false, category?: number): [number, number] {
  if (isUT) return UT_LOCKED_QUALITY;
  if (category === ItemCategory.Ability || category === ItemCategory.Ring) {
    return ABILITY_RING_QUALITY_BY_ITEM_TIER[itemTier] ?? [1.0, 1.0];
  }
  return LOCKED_QUALITY_BY_ITEM_TIER[itemTier] ?? [1.0, 1.0];
}

// --- NEW: Locked Stat Ranges by Item Tier (non-overlapping) ---
// For armor/ring locked stats. Indexed by stat type -> item tier (1-12).
// Strict non-overlapping: min[n+1] > max[n].
export const LOCKED_STAT_RANGES_BY_ITEM_TIER: Record<number, Record<number, [number, number]>> = {
  [StatType.Health]: {
    1: [40, 70],     2: [75, 120],    3: [125, 180],   4: [185, 250],
    5: [255, 330],   6: [335, 420],   7: [425, 520],   8: [525, 640],
    9: [645, 770],   10: [775, 920],  11: [925, 1090],  12: [1095, 1280],
  },
  [StatType.HealthRegen]: {
    1: [0.1, 0.2], 2: [0.2, 0.4], 3: [0.4, 0.6], 4: [0.6, 0.9],
    5: [0.9, 1.2], 6: [1.2, 1.6], 7: [1.6, 2.0], 8: [2.0, 2.5],
    9: [2.5, 3.0], 10: [3.0, 3.6], 11: [3.6, 4.3], 12: [4.3, 5.0],
  },
  [StatType.Mana]: {
    1: [15, 35],     2: [40, 65],     3: [70, 100],    4: [105, 145],
    5: [150, 195],   6: [200, 255],   7: [260, 320],   8: [325, 395],
    9: [400, 475],   10: [480, 565],  11: [570, 665],   12: [670, 770],
  },
  [StatType.ManaRegen]: {
    1: [0.3, 0.6],  2: [0.7, 1.1],  3: [1.2, 1.8],  4: [1.9, 2.6],
    5: [2.7, 3.6],  6: [3.7, 4.8],  7: [4.9, 6.2],  8: [6.3, 7.8],
    9: [7.9, 9.6],  10: [9.7, 11.6], 11: [11.7, 13.8], 12: [13.9, 16.2],
  },
};

// Ring-specific locked stat ranges: 7 tiers spanning the full T1-12 range.
export const RING_LOCKED_STAT_RANGES_BY_ITEM_TIER: Record<number, Record<number, [number, number]>> = {
  [StatType.Mana]: {
    1: [15, 50],    2: [55, 115],   3: [120, 205],  4: [210, 325],
    5: [330, 475],  6: [480, 640],  7: [645, 770],
  },
  [StatType.ManaRegen]: {
    1: [0.3, 1.0],  2: [1.2, 2.5],  3: [2.7, 4.5],  4: [4.8, 7.5],
    5: [7.8, 11.0], 6: [11.5, 14.5], 7: [15.0, 16.0],
  },
};

// UT armor/ring: single range per stat type (~T9-11 equivalent).
export const UT_LOCKED_STAT_RANGES: Record<number, [number, number]> = {
  [StatType.Health]:     [645, 1090],
  [StatType.HealthRegen]: [2.5, 4.3],
  [StatType.Mana]:       [400, 665],
  [StatType.ManaRegen]:  [7.8, 13.8],
};

/** Get the locked stat value for an item tier and roll (new system — no stat tier). */
export function getLockedStatValue(
  statType: number,
  itemTier: number,
  roll: number,
  isUT: boolean = false,
  category?: number
): number {
  let range: [number, number] | undefined;
  if (isUT) {
    range = UT_LOCKED_STAT_RANGES[statType];
  } else if (category === ItemCategory.Ring) {
    range = RING_LOCKED_STAT_RANGES_BY_ITEM_TIER[statType]?.[itemTier];
  } else {
    range = LOCKED_STAT_RANGES_BY_ITEM_TIER[statType]?.[itemTier];
  }
  if (!range) return 0;
  const [min, max] = range;
  return Math.round(min + (max - min) * (roll / 100));
}

/** Get the locked stat range for an item tier (or UT). */
export function getLockedStatRange(
  statType: number,
  itemTier: number,
  isUT: boolean = false,
  category?: number
): [number, number] {
  if (isUT) return UT_LOCKED_STAT_RANGES[statType] ?? [0, 0];
  if (category === ItemCategory.Ring) {
    return RING_LOCKED_STAT_RANGES_BY_ITEM_TIER[statType]?.[itemTier] ?? [0, 0];
  }
  return LOCKED_STAT_RANGES_BY_ITEM_TIER[statType]?.[itemTier] ?? [0, 0];
}

// --- Item Tier Multiplier ---
// Used ONLY for weapon/ability base stat scaling. NOT applied to stat tier ranges.

export const ITEM_TIER_MULTIPLIER: Record<number, number> = {
  1: 0.4,
  2: 0.6,
  3: 0.8,
  4: 1.0,
  5: 1.2,
  6: 1.5,
  7: 1.8,
  8: 2.2,
  9: 2.6,
  10: 3.0,
  11: 3.5,
  12: 4.0,
};

// Ability/Ring: 7 tiers spanning the full T1-12 power range (T7 = old T12).
export const ABILITY_RING_TIER_MULTIPLIER: Record<number, number> = {
  1: 0.4,
  2: 0.7,
  3: 1.1,
  4: 1.6,
  5: 2.2,
  6: 3.0,
  7: 4.0,
};

// --- Weapon Templates (base stats at tier multiplier 1.0 = T4) ---

export interface WeaponTemplate {
  baseDamage: number;
  baseCooldown: number;
  baseRange: number;
  baseProjSpeed: number;
  baseProjSize: number;
  projectileCount?: number;
  spreadAngle?: number;
}

export const WEAPON_TEMPLATES: Record<number, WeaponTemplate> = {
  [WeaponSubtype.Sword]: {
    baseDamage: 95,
    baseCooldown: 445,
    baseRange: 180,
    baseProjSpeed: 460,
    baseProjSize: 18,
  },
  [WeaponSubtype.Bow]: {
    baseDamage: 55,
    baseCooldown: 247,
    baseRange: 470,
    baseProjSpeed: 560,
    baseProjSize: 6,
  },
  [WeaponSubtype.Wand]: {
    baseDamage: 45,
    baseCooldown: 290,
    baseRange: 520,
    baseProjSpeed: 620,
    baseProjSize: 5,
  },
};

// --- Ability Templates ---

export interface AbilityTemplate {
  baseDamage: number;
  baseRange: number;
  baseProjSpeed: number;
  baseProjSize: number;
  baseManaCost: number;
  baseCooldown: number;
  piercing: boolean;
  aoeRing?: boolean;
  projectileCount?: number;
  expandingAoe?: boolean;
}

export const ABILITY_TEMPLATES: Record<number, AbilityTemplate> = {
  [AbilitySubtype.Quiver]: {
    baseDamage: 140,
    baseRange: 580,
    baseProjSpeed: 680,
    baseProjSize: 15,
    baseManaCost: 36,
    baseCooldown: 850,
    piercing: true,
  },
  [AbilitySubtype.Helm]: {
    baseDamage: 80,
    baseRange: 150,
    baseProjSpeed: 400,
    baseProjSize: 12,
    baseManaCost: 40,
    baseCooldown: 1000,
    piercing: true,
    aoeRing: true,
    projectileCount: 8,
  },
  [AbilitySubtype.Relic]: {
    baseDamage: 120,
    baseRange: 200,
    baseProjSpeed: 300,
    baseProjSize: 15,
    baseManaCost: 45,
    baseCooldown: 1200,
    piercing: true,
    aoeRing: true,
    projectileCount: 6,
  },
};

// --- Armor Locked Stat Multiplier by Subtype ---
// Heavy armor gets full locked stats, light armor gets reduced values.
export const ARMOR_LOCKED_STAT_MULTIPLIER: Record<number, number> = {
  0: 1.0,   // ArmorSubtype.Heavy
  1: 0.65,  // ArmorSubtype.Light
  2: 0.45,  // ArmorSubtype.Mantle — very low HP, trades survivability for mana
};

// --- Per-Armor-Subtype Locked Stats ---
// Overrides LOCKED_STATS_BY_CATEGORY for armor to allow subtype-specific locked stats.
export const ARMOR_LOCKED_STATS: Record<number, [number, number]> = {
  [ArmorSubtype.Heavy]: [StatType.Health, StatType.HealthRegen],
  [ArmorSubtype.Light]: [StatType.Health, StatType.HealthRegen],
  [ArmorSubtype.Mantle]: [StatType.Health, StatType.ManaRegen],
};

// --- Stat Display Names ---

export const STAT_NAMES: Record<number, string> = {
  [StatType.AttackDamage]: "Weapon Damage",
  [StatType.AttackSpeed]: "Fire Rate",
  [StatType.Health]: "Health",
  [StatType.HealthRegen]: "Health Regen",
  [StatType.ManaRegen]: "Mana Regen",
  [StatType.MovementSpeed]: "Move Speed",
  [StatType.Mana]: "Mana",
  [StatType.PhysicalDamageReduction]: "Phys Reduction",
  [StatType.MagicDamageReduction]: "Magic Reduction",
  [StatType.AbilityDamage]: "Ability Damage",
  [StatType.ReducedAbilityCooldown]: "Ability Cooldown",
  [StatType.IncreasedProjectileSpeed]: "Proj Speed",
  [StatType.CriticalStrikeChance]: "Crit Chance",
  [StatType.CriticalStrikeMultiplier]: "Crit Multiplier",
};

// --- Stat Titles (thematic names for tooltip display) ---

export const STAT_TITLES: Record<number, string> = {
  [StatType.AttackDamage]: "Might",
  [StatType.AttackSpeed]: "Fervor",
  [StatType.Health]: "Vitality",
  [StatType.HealthRegen]: "Regeneration",
  [StatType.ManaRegen]: "Clarity",
  [StatType.MovementSpeed]: "Swiftness",
  [StatType.Mana]: "Arcana",
  [StatType.PhysicalDamageReduction]: "Fortitude",
  [StatType.MagicDamageReduction]: "Warding",
  [StatType.AbilityDamage]: "Sorcery",
  [StatType.ReducedAbilityCooldown]: "Alacrity",
  [StatType.IncreasedProjectileSpeed]: "Velocity",
  [StatType.CriticalStrikeChance]: "Precision",
  [StatType.CriticalStrikeMultiplier]: "Ferocity",
};

// --- Stat Verbose Descriptions (template with {value} placeholder) ---

export const STAT_DESCRIPTIONS: Record<number, string> = {
  [StatType.AttackDamage]: "Increases Weapon Damage by {value}",
  [StatType.AttackSpeed]: "Increases Fire Rate by {value}",
  [StatType.Health]: "Increases Health by {value}",
  [StatType.HealthRegen]: "Increases Health Regen by {value}",
  [StatType.ManaRegen]: "Increases Mana Regen by {value}",
  [StatType.MovementSpeed]: "Increases Move Speed by {value}",
  [StatType.Mana]: "Increases Mana by {value}",
  [StatType.PhysicalDamageReduction]: "Increases Phys Reduction by {value}",
  [StatType.MagicDamageReduction]: "Increases Magic Reduction by {value}",
  [StatType.AbilityDamage]: "Increases Ability Damage by {value}",
  [StatType.ReducedAbilityCooldown]: "Reduces Ability Cooldown by {value}",
  [StatType.IncreasedProjectileSpeed]: "Increases Proj Speed by {value}",
  [StatType.CriticalStrikeChance]: "Increases Crit Chance by {value}",
  [StatType.CriticalStrikeMultiplier]: "Increases Crit Multiplier by {value}",
};

// --- Crafting Orb Definitions ---

export const OrbRarity = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  VeryRare: 3,
} as const;

export interface OrbDefinition {
  type: number;
  name: string;
  description: string;
  usageHint: string;
  rarity: number;
  color: number;
}

export const ORB_DEFINITIONS: Record<number, OrbDefinition> = {
  [CraftingOrbType.Blank]: {
    type: CraftingOrbType.Blank,
    name: "Blank Orb",
    description: "Clears all open stats.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.Common,
    color: 0xdddddd,
  },
  [CraftingOrbType.Ember]: {
    type: CraftingOrbType.Ember,
    name: "Ember Orb",
    description: "Fills all empty open slots with random stats.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.Common,
    color: 0xff6622,
  },
  [CraftingOrbType.Shard]: {
    type: CraftingOrbType.Shard,
    name: "Shard Orb",
    description: "Adds one random stat to an empty slot.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.Uncommon,
    color: 0x44ccff,
  },
  [CraftingOrbType.Chaos]: {
    type: CraftingOrbType.Chaos,
    name: "Chaos Orb",
    description: "Rerolls all open stats.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.VeryRare,
    color: 0xff2244,
  },
  [CraftingOrbType.Flux]: {
    type: CraftingOrbType.Flux,
    name: "Flux Orb",
    description: "Rerolls one random existing stat.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.Uncommon,
    color: 0xaa44ff,
  },
  [CraftingOrbType.Void]: {
    type: CraftingOrbType.Void,
    name: "Void Orb",
    description: "Removes one random existing stat.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.Rare,
    color: 0x222244,
  },
  [CraftingOrbType.Prism]: {
    type: CraftingOrbType.Prism,
    name: "Prism Orb",
    description: "Rerolls the tier of one random stat.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.Rare,
    color: 0xff88ff,
  },
  [CraftingOrbType.Forge]: {
    type: CraftingOrbType.Forge,
    name: "Forge Orb",
    description: "Protects a random stat from the next orb.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.VeryRare,
    color: 0xffaa00,
  },
  [CraftingOrbType.Calibrate]: {
    type: CraftingOrbType.Calibrate,
    name: "Calibrate Orb",
    description: "Re-rolls the value of one open stat within its tier range.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.Uncommon,
    color: 0x66ff88,
  },
  [CraftingOrbType.Divine]: {
    type: CraftingOrbType.Divine,
    name: "Divine Forge Orb",
    description: "Protects two random stats from the next orb.",
    usageHint: "Right click this orb then left click an item to apply it.",
    rarity: OrbRarity.VeryRare,
    color: 0xffd700,
  },
};

// --- Orb Drop Chances per Difficulty Zone ---
// Chance for each orb rarity to drop (per kill, in addition to bag drops)

export const ORB_DROP_CHANCES: Record<
  number,
  Record<number, number>
> = {
  // Shore
  0: { [OrbRarity.Common]: 0.03, [OrbRarity.Uncommon]: 0.0, [OrbRarity.Rare]: 0.0, [OrbRarity.VeryRare]: 0.0 },
  // Lowlands
  1: { [OrbRarity.Common]: 0.05, [OrbRarity.Uncommon]: 0.02, [OrbRarity.Rare]: 0.0, [OrbRarity.VeryRare]: 0.0 },
  // Midlands
  2: { [OrbRarity.Common]: 0.06, [OrbRarity.Uncommon]: 0.03, [OrbRarity.Rare]: 0.01, [OrbRarity.VeryRare]: 0.0 },
  // Highlands
  3: { [OrbRarity.Common]: 0.07, [OrbRarity.Uncommon]: 0.04, [OrbRarity.Rare]: 0.02, [OrbRarity.VeryRare]: 0.005 },
  // Godlands
  4: { [OrbRarity.Common]: 0.08, [OrbRarity.Uncommon]: 0.05, [OrbRarity.Rare]: 0.03, [OrbRarity.VeryRare]: 0.01 },
};

// Map orb rarity to specific orb types
export const ORBS_BY_RARITY: Record<number, number[]> = {
  [OrbRarity.Common]: [CraftingOrbType.Blank, CraftingOrbType.Ember],
  [OrbRarity.Uncommon]: [CraftingOrbType.Shard, CraftingOrbType.Flux, CraftingOrbType.Calibrate],
  [OrbRarity.Rare]: [CraftingOrbType.Void, CraftingOrbType.Prism],
  [OrbRarity.VeryRare]: [CraftingOrbType.Chaos, CraftingOrbType.Forge],
};

// --- Stat Tier Roll Weights by Item Tier ---
// 6-element arrays. Weights for tiers above the item's max stat tier are 0.

const STAT_TIER_WEIGHTS: Record<number, number[]> = {
  // T1-2 items: max stat tier 1
  1:  [1.0,  0,    0,    0,    0,    0],
  2:  [1.0,  0,    0,    0,    0,    0],
  // T3-4 items: max stat tier 2
  3:  [0.60, 0.40, 0,    0,    0,    0],
  4:  [0.45, 0.55, 0,    0,    0,    0],
  // T5-6 items: max stat tier 3
  5:  [0.30, 0.40, 0.30, 0,    0,    0],
  6:  [0.20, 0.35, 0.45, 0,    0,    0],
  // T7-8 items: max stat tier 4
  7:  [0.10, 0.25, 0.35, 0.30, 0,    0],
  8:  [0.05, 0.15, 0.35, 0.45, 0,    0],
  // T9-10 items: max stat tier 5
  9:  [0.03, 0.10, 0.22, 0.35, 0.30, 0],
  10: [0.02, 0.07, 0.18, 0.33, 0.40, 0],
  // T11-12 items: max stat tier 6
  11: [0.01, 0.04, 0.10, 0.25, 0.35, 0.25],
  12: [0.01, 0.03, 0.08, 0.20, 0.33, 0.35],
};

/** Roll a random stat tier for open stats, respecting the item tier cap. */
export function rollOpenStatTier(itemTier: number, category?: number): number {
  const maxStatTier = getMaxStatTierForItemTier(itemTier, category);
  // Linearly decreasing weight: slight bias toward lower tiers
  const weights: number[] = [];
  for (let t = 1; t <= MAX_STAT_TIER; t++) {
    if (t > maxStatTier) {
      weights.push(0);
    } else {
      weights.push(maxStatTier - t + 1);
    }
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const roll = Math.random() * total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return i + 1;
  }
  return 1;
}

// --- Pre-Rolled Open Stat Count Weights ---
// Distribution for how many open stats a dropped item starts with (index = count 0-5)
export const PREROLL_COUNT_WEIGHTS: number[] = [0.30, 0.25, 0.20, 0.13, 0.08, 0.04];

/** Roll the number of pre-filled open stats for a newly generated item. */
export function rollPrerollCount(): number {
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < PREROLL_COUNT_WEIGHTS.length; i++) {
    cumulative += PREROLL_COUNT_WEIGHTS[i];
    if (roll < cumulative) return i;
  }
  return 0;
}

/** Roll a random percentile (0-100 inclusive integer) for a stat value within its range. */
export function rollStatRoll(): number {
  return Math.floor(Math.random() * 101); // 0-100
}

/**
 * Roll initial open stats for a newly generated item.
 * No duplicate stat types. Returns packed triples: [type, tier, roll, type, tier, roll, ...].
 */
export function rollInitialOpenStats(category: number, itemTier: number): number[] {
  const count = rollPrerollCount();
  if (count === 0) return [];

  const pool = OPEN_STAT_POOL[category];
  if (!pool || pool.length === 0) return [];

  // Shuffle pool and take up to count (no duplicates)
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const actual = Math.min(count, shuffled.length);
  const stats: number[] = [];
  for (let i = 0; i < actual; i++) {
    stats.push(shuffled[i], rollOpenStatTier(itemTier, category), rollStatRoll());
  }
  return stats;
}

// --- Helper Functions ---

/** Get the final stat value for a stat, given stat tier and roll percentile (0-100).
 *  The roll linearly interpolates between the tier's min and max.
 *  Item tier is NOT used -- ranges are final values. */
export function getStatValue(
  statType: number,
  statTier: number,
  roll: number,
  isLocked: boolean = false
): number {
  const table =
    isLocked && LOCKED_STAT_RANGES_BY_TIER[statType]
      ? LOCKED_STAT_RANGES_BY_TIER
      : STAT_RANGES_BY_TIER;
  const range = table[statType]?.[statTier];
  if (!range) return 0;
  const [min, max] = range;
  return Math.round(min + (max - min) * (roll / 100));
}

/** Get the min and max values for a stat at a given tier. */
export function getStatRange(
  statType: number,
  statTier: number,
  isLocked: boolean = false
): [number, number] {
  const table =
    isLocked && LOCKED_STAT_RANGES_BY_TIER[statType]
      ? LOCKED_STAT_RANGES_BY_TIER
      : STAT_RANGES_BY_TIER;
  return table[statType]?.[statTier] ?? [0, 0];
}

/** Roll a random stat tier based on item tier weights (for locked stats). */
export function rollStatTier(itemTier: number): number {
  const weights = STAT_TIER_WEIGHTS[itemTier] ?? STAT_TIER_WEIGHTS[1];
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return i + 1;
  }
  return 1;
}

/** Pick a random element from an array. */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Check if an item instance represents an empty slot. */
export function isEmptyItem(item: ItemInstanceData): boolean {
  return item.baseItemId < 0;
}

/** Create an empty item instance (sentinel for empty slots). */
export function createEmptyItemInstance(): ItemInstanceData {
  return {
    baseItemId: -1,
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
    quantity: 0,
  };
}

/** Get the number of filled open stat slots. */
export function getOpenStatCount(item: ItemInstanceData): number {
  return Math.floor(item.openStats.length / 3);
}

/** Get the number of empty open stat slots. */
export function getEmptySlotCount(item: ItemInstanceData): number {
  return MAX_OPEN_STATS - getOpenStatCount(item);
}

/** Get weapon stats scaled by item tier and locked quality rolls.
 *  For UT weapons, pass isUT=true and utBaseStats with ITEM_DEFS base values. */
export function getScaledWeaponStats(
  subtype: number,
  itemTier: number,
  damageRoll: number = 50,
  fireRateRoll: number = 50,
  isUT: boolean = false,
  utBaseStats?: { baseDamage: number; baseCooldown: number; baseRange: number; baseProjSpeed: number; baseProjSize: number }
): {
  damage: number;
  shootCooldown: number;
  range: number;
  projectileSpeed: number;
  projectileSize: number;
} {
  // Fire rate percentage: roll 0 = 90%, roll 50 = 100%, roll 100 = 110%
  const fireRatePercent = 0.90 + 0.20 * (fireRateRoll / 100);
  if (isUT && utBaseStats) {
    // UT weapons use their own base stats with UT quality roll for damage
    const dmgQuality = getLockedQualityMultiplier(0, damageRoll, true);
    return {
      damage: Math.round(utBaseStats.baseDamage * dmgQuality),
      shootCooldown: Math.round(utBaseStats.baseCooldown / fireRatePercent),
      range: utBaseStats.baseRange,
      projectileSpeed: utBaseStats.baseProjSpeed,
      projectileSize: utBaseStats.baseProjSize,
    };
  }
  const template = WEAPON_TEMPLATES[subtype];
  if (!template) {
    return { damage: 20, shootCooldown: 300, range: 100, projectileSpeed: 300, projectileSize: 5 };
  }
  const mult = ITEM_TIER_MULTIPLIER[itemTier] ?? 1.0;
  const dmgQuality = getLockedQualityMultiplier(itemTier, damageRoll);
  return {
    damage: Math.round(template.baseDamage * mult * dmgQuality),
    shootCooldown: Math.round(template.baseCooldown / fireRatePercent),
    range: Math.round(template.baseRange * (0.8 + 0.2 * mult)),
    projectileSpeed: Math.round(template.baseProjSpeed * (0.85 + 0.15 * mult)),
    projectileSize: Math.round(template.baseProjSize * (0.85 + 0.15 * mult)),
  };
}

/** Get ability stats scaled by item tier and locked quality rolls.
 *  For UT abilities, pass isUT=true and utBaseStats with ITEM_DEFS base values. */
export function getScaledAbilityStats(
  subtype: number,
  itemTier: number,
  damageRoll: number = 50,
  manaCostRoll: number = 50,
  isUT: boolean = false,
  utBaseStats?: { baseDamage: number; baseCooldown: number; baseRange: number; baseProjSpeed: number; baseProjSize: number; baseManaCost: number; piercing: boolean }
): {
  damage: number;
  range: number;
  projectileSpeed: number;
  projectileSize: number;
  manaCost: number;
  cooldown: number;
  piercing: boolean;
} {
  if (isUT && utBaseStats) {
    const dmgQuality = getLockedQualityMultiplier(0, damageRoll, true);
    const manaQuality = getLockedQualityMultiplier(0, manaCostRoll, true);
    return {
      damage: Math.round(utBaseStats.baseDamage * dmgQuality),
      range: utBaseStats.baseRange,
      projectileSpeed: utBaseStats.baseProjSpeed,
      projectileSize: utBaseStats.baseProjSize,
      manaCost: Math.round(utBaseStats.baseManaCost / manaQuality),
      cooldown: utBaseStats.baseCooldown,
      piercing: utBaseStats.piercing,
    };
  }
  const template = ABILITY_TEMPLATES[subtype];
  if (!template) {
    return { damage: 50, range: 500, projectileSpeed: 600, projectileSize: 12, manaCost: 30, cooldown: 1000, piercing: true };
  }
  const mult = ABILITY_RING_TIER_MULTIPLIER[itemTier] ?? 1.0;
  const dmgQuality = getLockedQualityMultiplier(itemTier, damageRoll, false, ItemCategory.Ability);
  const manaQuality = getLockedQualityMultiplier(itemTier, manaCostRoll, false, ItemCategory.Ability);
  return {
    damage: Math.round(template.baseDamage * mult * dmgQuality),
    range: Math.round(template.baseRange * (0.8 + 0.2 * mult)),
    projectileSpeed: Math.round(template.baseProjSpeed * (0.85 + 0.15 * mult)),
    projectileSize: Math.round(template.baseProjSize * (0.85 + 0.15 * mult)),
    manaCost: Math.round(template.baseManaCost / manaQuality),
    cooldown: Math.round(template.baseCooldown / (1 + 0.15 * mult)),
    piercing: template.piercing,
  };
}

/** Get weapon stats at min and max quality roll for tooltip range display. */
export function getScaledWeaponStatsRange(
  subtype: number,
  itemTier: number,
  isUT: boolean = false,
  utBaseStats?: { baseDamage: number; baseCooldown: number; baseRange: number; baseProjSpeed: number; baseProjSize: number }
): {
  damageMin: number; damageMax: number;
  shootCooldownMin: number; shootCooldownMax: number;
} {
  const minStats = getScaledWeaponStats(subtype, itemTier, 0, 0, isUT, utBaseStats);
  const maxStats = getScaledWeaponStats(subtype, itemTier, 100, 100, isUT, utBaseStats);
  return {
    damageMin: minStats.damage,
    damageMax: maxStats.damage,
    shootCooldownMin: maxStats.shootCooldown,
    shootCooldownMax: minStats.shootCooldown,
  };
}

/** Get ability stats at min and max quality roll for tooltip range display. */
export function getScaledAbilityStatsRange(
  subtype: number,
  itemTier: number,
  isUT: boolean = false,
  utBaseStats?: { baseDamage: number; baseCooldown: number; baseRange: number; baseProjSpeed: number; baseProjSize: number; baseManaCost: number; piercing: boolean }
): {
  damageMin: number; damageMax: number;
  manaCostMin: number; manaCostMax: number;
} {
  const minStats = getScaledAbilityStats(subtype, itemTier, 0, 0, isUT, utBaseStats);
  const maxStats = getScaledAbilityStats(subtype, itemTier, 100, 100, isUT, utBaseStats);
  return {
    damageMin: minStats.damage,
    damageMax: maxStats.damage,
    manaCostMin: maxStats.manaCost,
    manaCostMax: minStats.manaCost,
  };
}
