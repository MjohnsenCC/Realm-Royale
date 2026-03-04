import {
  ItemCategory,
  StatType,
  CraftingOrbType,
  WeaponSubtype,
  AbilitySubtype,
} from "./types";

// --- Item Instance Data Interface ---

export interface ItemInstanceData {
  baseItemId: number; // category*100 + subtype*10 + referenceTier (or UT id)
  instanceTier: number; // 1-6 for tiered items, 0 for UT
  isUT: boolean;
  lockedStat1Type: number;
  lockedStat1Tier: number;
  lockedStat2Type: number;
  lockedStat2Tier: number;
  openStats: number[]; // packed pairs: [type, tier, type, tier, ...]
  forgeProtectedSlot: number; // index into openStats pairs (0-4), -1 if none
}

// --- Constants ---

export const MAX_OPEN_STATS = 5;
export const MAX_STAT_TIER = 5;
export const MAX_ITEM_TIER = 6;
export const ORB_MAX_STACK = 99;

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
  ],
  [ItemCategory.Ability]: [
    StatType.AttackDamage,
    StatType.AttackSpeed,
    StatType.MovementSpeed,
  ],
  [ItemCategory.Armor]: [
    StatType.Health,
    StatType.HealthRegen,
    StatType.ManaRegen,
    StatType.MovementSpeed,
  ],
  [ItemCategory.Ring]: [
    StatType.AttackDamage,
    StatType.AttackSpeed,
    StatType.Health,
    StatType.HealthRegen,
    StatType.ManaRegen,
    StatType.MovementSpeed,
  ],
};

// --- Stat Values by Stat Tier (T1-T5) ---
// These are BASE values, multiplied by ITEM_TIER_MULTIPLIER

export const STAT_VALUES_BY_TIER: Record<number, Record<number, number>> = {
  [StatType.AttackDamage]: { 1: 3, 2: 6, 3: 10, 4: 15, 5: 22 },
  [StatType.AttackSpeed]: { 1: 5, 2: 10, 3: 18, 4: 28, 5: 40 }, // ms cooldown reduction
  [StatType.Health]: { 1: 5, 2: 12, 3: 20, 4: 30, 5: 45 },
  [StatType.HealthRegen]: { 1: 0.3, 2: 0.7, 3: 1.2, 4: 2.0, 5: 3.0 },
  [StatType.ManaRegen]: { 1: 0.5, 2: 1.0, 3: 2.0, 4: 3.5, 5: 5.0 },
  [StatType.MovementSpeed]: { 1: 2, 2: 5, 3: 8, 4: 12, 5: 18 },
  [StatType.Mana]: { 1: 25, 2: 60, 3: 100, 4: 150, 5: 225 },
};

// Separate locked stat value table for stats that scale differently as locked stats
// (e.g., Health on armor gives much more than Health as an open stat)
export const LOCKED_STAT_VALUES_BY_TIER: Record<number, Record<number, number>> = {
  [StatType.Health]: { 1: 125, 2: 300, 3: 500, 4: 750, 5: 1125 },
  [StatType.Mana]: { 1: 25, 2: 60, 3: 100, 4: 150, 5: 225 },
};

// --- Locked Quality Multiplier ---
// For weapon/ability inherent stats, the locked stat tier acts as a quality modifier.
// T3 is baseline (1.0), lower tiers reduce, higher tiers boost.
export const LOCKED_QUALITY_MULTIPLIER: Record<number, number> = {
  1: 0.85,
  2: 0.93,
  3: 1.0,
  4: 1.08,
  5: 1.18,
};

// --- Item Tier Multiplier ---
// Scales stat values based on item tier. T4=1.0 is the baseline.

export const ITEM_TIER_MULTIPLIER: Record<number, number> = {
  1: 0.4,
  2: 0.6,
  3: 0.8,
  4: 1.0,
  5: 1.2,
  6: 1.5,
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
    baseCooldown: 240,
    baseRange: 180,
    baseProjSpeed: 460,
    baseProjSize: 18,
  },
  [WeaponSubtype.Bow]: {
    baseDamage: 55,
    baseCooldown: 290,
    baseRange: 470,
    baseProjSpeed: 560,
    baseProjSize: 6,
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
};

// --- Stat Display Names ---

export const STAT_NAMES: Record<number, string> = {
  [StatType.AttackDamage]: "Attack Damage",
  [StatType.AttackSpeed]: "Attack Speed",
  [StatType.Health]: "Health",
  [StatType.HealthRegen]: "Health Regen",
  [StatType.ManaRegen]: "Mana Regen",
  [StatType.MovementSpeed]: "Movement Speed",
  [StatType.Mana]: "Mana",
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
  rarity: number;
  color: number;
}

export const ORB_DEFINITIONS: Record<number, OrbDefinition> = {
  [CraftingOrbType.Blank]: {
    type: CraftingOrbType.Blank,
    name: "Blank Orb",
    description: "Clears all open stats. Safe reset.",
    rarity: OrbRarity.Common,
    color: 0xdddddd,
  },
  [CraftingOrbType.Ember]: {
    type: CraftingOrbType.Ember,
    name: "Ember Orb",
    description: "Fills all empty open slots with random stats.",
    rarity: OrbRarity.Common,
    color: 0xff6622,
  },
  [CraftingOrbType.Shard]: {
    type: CraftingOrbType.Shard,
    name: "Shard Orb",
    description: "Adds one random stat to an empty slot.",
    rarity: OrbRarity.Uncommon,
    color: 0x44ccff,
  },
  [CraftingOrbType.Chaos]: {
    type: CraftingOrbType.Chaos,
    name: "Chaos Orb",
    description: "Rerolls ALL open stats completely. High risk.",
    rarity: OrbRarity.VeryRare,
    color: 0xff2244,
  },
  [CraftingOrbType.Flux]: {
    type: CraftingOrbType.Flux,
    name: "Flux Orb",
    description: "Rerolls one random existing stat.",
    rarity: OrbRarity.Uncommon,
    color: 0xaa44ff,
  },
  [CraftingOrbType.Void]: {
    type: CraftingOrbType.Void,
    name: "Void Orb",
    description: "Removes one random existing stat.",
    rarity: OrbRarity.Rare,
    color: 0x222244,
  },
  [CraftingOrbType.Prism]: {
    type: CraftingOrbType.Prism,
    name: "Prism Orb",
    description: "Rerolls the tier of one random stat.",
    rarity: OrbRarity.Rare,
    color: 0xff88ff,
  },
  [CraftingOrbType.Forge]: {
    type: CraftingOrbType.Forge,
    name: "Forge Orb",
    description: "Protects one chosen stat from the next orb.",
    rarity: OrbRarity.VeryRare,
    color: 0xffaa00,
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
  [OrbRarity.Uncommon]: [CraftingOrbType.Shard, CraftingOrbType.Flux],
  [OrbRarity.Rare]: [CraftingOrbType.Void, CraftingOrbType.Prism],
  [OrbRarity.VeryRare]: [CraftingOrbType.Chaos, CraftingOrbType.Forge],
};

// --- Stat Tier Roll Weights by Item Tier ---
// Higher item tiers bias toward higher stat tiers

const STAT_TIER_WEIGHTS: Record<number, number[]> = {
  1: [0.50, 0.30, 0.15, 0.04, 0.01], // T1 items: mostly T1-T2 stats
  2: [0.35, 0.30, 0.20, 0.10, 0.05],
  3: [0.20, 0.25, 0.25, 0.20, 0.10],
  4: [0.10, 0.20, 0.30, 0.25, 0.15],
  5: [0.05, 0.15, 0.25, 0.30, 0.25],
  6: [0.02, 0.08, 0.20, 0.35, 0.35], // T6 items: mostly T4-T5 stats
};

// --- Open Stat Tier Weights ---
// Flat weights for open stats: T1 most common, T5 rarest
export const OPEN_STAT_TIER_WEIGHTS: number[] = [0.35, 0.28, 0.20, 0.12, 0.05];

/** Roll a random stat tier for open stats, using the flat open-stat weight table. */
export function rollOpenStatTier(): number {
  const weights = OPEN_STAT_TIER_WEIGHTS;
  const roll = Math.random();
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

/**
 * Roll initial open stats for a newly generated item.
 * No duplicate stat types. Returns packed array: [type, tier, type, tier, ...].
 */
export function rollInitialOpenStats(category: number): number[] {
  const count = rollPrerollCount();
  if (count === 0) return [];

  const pool = OPEN_STAT_POOL[category];
  if (!pool || pool.length === 0) return [];

  // Shuffle pool and take up to count (no duplicates)
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const actual = Math.min(count, shuffled.length);
  const stats: number[] = [];
  for (let i = 0; i < actual; i++) {
    stats.push(shuffled[i], rollOpenStatTier());
  }
  return stats;
}

// --- Helper Functions ---

/** Get the final stat value for a stat, accounting for stat tier and item tier. */
export function getStatValue(
  statType: number,
  statTier: number,
  itemTier: number,
  isLocked: boolean = false
): number {
  const table =
    isLocked && LOCKED_STAT_VALUES_BY_TIER[statType]
      ? LOCKED_STAT_VALUES_BY_TIER
      : STAT_VALUES_BY_TIER;
  const baseValue = table[statType]?.[statTier] ?? 0;
  const multiplier = ITEM_TIER_MULTIPLIER[itemTier] ?? 1.0;
  return baseValue * multiplier;
}

/** Roll a random stat tier based on item tier weights. */
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
    lockedStat2Type: -1,
    lockedStat2Tier: 0,
    openStats: [],
    forgeProtectedSlot: -1,
  };
}

/** Get the number of filled open stat slots. */
export function getOpenStatCount(item: ItemInstanceData): number {
  return Math.floor(item.openStats.length / 2);
}

/** Get the number of empty open stat slots. */
export function getEmptySlotCount(item: ItemInstanceData): number {
  return MAX_OPEN_STATS - getOpenStatCount(item);
}

/** Get weapon stats scaled by item tier and optional locked quality tiers. */
export function getScaledWeaponStats(
  subtype: number,
  itemTier: number,
  damageTier: number = 0,
  fireRateTier: number = 0
): {
  damage: number;
  shootCooldown: number;
  range: number;
  projectileSpeed: number;
  projectileSize: number;
} {
  const template = WEAPON_TEMPLATES[subtype];
  if (!template) {
    return { damage: 20, shootCooldown: 300, range: 100, projectileSpeed: 300, projectileSize: 5 };
  }
  const mult = ITEM_TIER_MULTIPLIER[itemTier] ?? 1.0;
  const dmgQuality = damageTier > 0 ? (LOCKED_QUALITY_MULTIPLIER[damageTier] ?? 1.0) : 1.0;
  const frQuality = fireRateTier > 0 ? (LOCKED_QUALITY_MULTIPLIER[fireRateTier] ?? 1.0) : 1.0;
  return {
    damage: Math.round(template.baseDamage * mult * dmgQuality),
    shootCooldown: Math.round(template.baseCooldown / mult / frQuality),
    range: Math.round(template.baseRange * (0.8 + 0.2 * mult)),
    projectileSpeed: Math.round(template.baseProjSpeed * (0.85 + 0.15 * mult)),
    projectileSize: Math.round(template.baseProjSize * (0.85 + 0.15 * mult)),
  };
}

/** Get ability stats scaled by item tier and optional locked quality tiers. */
export function getScaledAbilityStats(
  subtype: number,
  itemTier: number,
  damageTier: number = 0,
  manaCostTier: number = 0
): {
  damage: number;
  range: number;
  projectileSpeed: number;
  projectileSize: number;
  manaCost: number;
  cooldown: number;
  piercing: boolean;
} {
  const template = ABILITY_TEMPLATES[subtype];
  if (!template) {
    return { damage: 50, range: 500, projectileSpeed: 600, projectileSize: 12, manaCost: 30, cooldown: 1000, piercing: true };
  }
  const mult = ITEM_TIER_MULTIPLIER[itemTier] ?? 1.0;
  const dmgQuality = damageTier > 0 ? (LOCKED_QUALITY_MULTIPLIER[damageTier] ?? 1.0) : 1.0;
  const manaQuality = manaCostTier > 0 ? (LOCKED_QUALITY_MULTIPLIER[manaCostTier] ?? 1.0) : 1.0;
  return {
    damage: Math.round(template.baseDamage * mult * dmgQuality),
    range: Math.round(template.baseRange * (0.8 + 0.2 * mult)),
    projectileSpeed: Math.round(template.baseProjSpeed * (0.85 + 0.15 * mult)),
    projectileSize: Math.round(template.baseProjSize * (0.85 + 0.15 * mult)),
    manaCost: Math.round(template.baseManaCost * (1.1 - 0.1 * mult) / manaQuality),
    cooldown: Math.round(template.baseCooldown / mult),
    piercing: template.piercing,
  };
}
