import {
  ItemCategory,
  ItemTier,
  WeaponSubtype,
  AbilitySubtype,
  BagRarity,
  DungeonType,
  DifficultyZone,
  CraftingOrbType,
} from "./types";
import {
  ItemInstanceData,
  LOCKED_STATS_BY_CATEGORY,
  rollStatTier,
  createEmptyItemInstance,
  pickRandom,
  rollInitialOpenStats,
  ORB_DROP_CHANCES,
  ORBS_BY_RARITY,
  OrbRarity,
  ORB_DEFINITIONS,
} from "./itemStats";

// --- Item ID Encoding: category * 100 + subtype * 10 + tier ---

export function getItemCategory(itemId: number): number {
  return Math.floor(itemId / 100);
}

export function getItemSubtype(itemId: number): number {
  return Math.floor((itemId % 100) / 10);
}

export function getItemTier(itemId: number): number {
  return itemId % 10;
}

export function makeItemId(
  category: number,
  subtype: number,
  tier: number
): number {
  return category * 100 + subtype * 10 + tier;
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
  7: 0x00ffff, // Cyan (UT)
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

  // ===== UT ITEMS (tier=7, unique) =====
  [makeItemId(0, 0, 7)]: {
    id: 7, name: "Doom Blade", category: 0, subtype: 0, tier: 7,
    color: 0x00cccc, tierColor: TIER_COLORS[7],
    description: "An accursed blade that fractures reality into three slashes.",
    weaponStats: {
      damage: 55, range: 170, shootCooldown: 350,
      projectileSpeed: 420, projectileSize: 14,
      projectileCount: 3, spreadAngle: Math.PI / 6,
    },
  },
  [makeItemId(1, 0, 7)]: {
    id: 107, name: "Phantom Quiver", category: 1, subtype: 0, tier: 7,
    color: 0x00cccc, tierColor: TIER_COLORS[7],
    description: "Spectral arrows grant otherworldly swiftness.",
    abilityStats: {
      damage: 120, range: 500, projectileSpeed: 700, projectileSize: 14,
      manaCost: 45, cooldown: 1200, piercing: true,
      speedBoostAmount: 80, speedBoostDuration: 3000,
    },
  },
  [makeItemId(2, 0, 7)]: {
    id: 207, name: "Ethereal Shroud", category: 2, subtype: 0, tier: 7,
    color: 0x00cccc, tierColor: TIER_COLORS[7],
    description: "Woven from ether, it feeds your magic at the cost of protection.",
    armorStats: { maxHpBonus: 50, manaRegenBonus: 8 },
  },
  [makeItemId(3, 0, 7)]: {
    id: 307, name: "Ring of the Void", category: 3, subtype: 0, tier: 7,
    color: 0x00cccc, tierColor: TIER_COLORS[7],
    description: "The void amplifies power but offers no shelter.",
    ringStats: { speedBonus: 30, damageBonus: 25, hpRegenBonus: 0, maxHpBonus: 0, maxManaBonus: 0, projSpeedBonus: 100 },
  },

  // ===== CONSUMABLES (category=4) =====
  [makeItemId(4, 0, 1)]: {
    id: 401, name: "Health Potion", category: 4, subtype: 0, tier: 1,
    color: 0xcc3333, tierColor: TIER_COLORS[1],
    description: "Restores 100 HP. Press F to use.",
    consumableStats: { maxStack: 6, healAmount: 100 },
  },
  [makeItemId(4, 1, 1)]: {
    id: 411, name: "Mana Potion", category: 4, subtype: 1, tier: 1,
    color: 0x4466cc, tierColor: TIER_COLORS[1],
    description: "Restores 100 Mana. Press G to use.",
    consumableStats: { maxStack: 6, manaAmount: 100 },
  },
  [makeItemId(4, 2, 1)]: {
    id: 421, name: "Portal Gem", category: 4, subtype: 2, tier: 1,
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
    lockedStat2Type: lockedStats[1],
    lockedStat2Tier: rollStatTier(tier),
    openStats: prerollOpenStats ? rollInitialOpenStats(category) : [],
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
    lockedStat2Type: -1,
    lockedStat2Tier: 0,
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
    lockedStat2Type: -1,
    lockedStat2Tier: 0,
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
    lockedStat2Type: -1,
    lockedStat2Tier: 0,
    openStats: [],
    forgeProtectedSlot: -1,
  };
}

// --- Drop chance per difficulty zone ---

export const BAG_DROP_CHANCES: Record<
  number,
  { green: number; red: number; black: number }
> = {
  [DifficultyZone.Shore]: { green: 0.15, red: 0.0, black: 0.0 },
  [DifficultyZone.Lowlands]: { green: 0.2, red: 0.03, black: 0.0 },
  [DifficultyZone.Midlands]: { green: 0.15, red: 0.08, black: 0.01 },
  [DifficultyZone.Highlands]: { green: 0.1, red: 0.12, black: 0.03 },
  [DifficultyZone.Godlands]: { green: 0.05, red: 0.1, black: 0.06 },
};

// --- Loot generation ---

/**
 * Roll which bag rarity (if any) drops from an enemy in the given biome.
 * Returns -1 if no bag drops.
 */
export function rollBagDrop(biome: number): number {
  const chances = BAG_DROP_CHANCES[biome];
  if (!chances) return -1;

  const roll = Math.random();
  if (roll < chances.black) return BagRarity.Black;
  if (roll < chances.black + chances.red) return BagRarity.Red;
  if (roll < chances.black + chances.red + chances.green) return BagRarity.Green;
  return -1;
}

/** Difficulty zone -> tier ranges per bag rarity */
const ZONE_TIER_RANGES: Record<
  number,
  { green: [number, number]; red: [number, number]; black: [number, number] }
> = {
  [DifficultyZone.Shore]: { green: [1, 1], red: [1, 2], black: [2, 2] },
  [DifficultyZone.Lowlands]: { green: [1, 2], red: [2, 3], black: [3, 3] },
  [DifficultyZone.Midlands]: { green: [2, 3], red: [3, 4], black: [4, 4] },
  [DifficultyZone.Highlands]: { green: [3, 4], red: [4, 5], black: [5, 5] },
  [DifficultyZone.Godlands]: { green: [4, 5], red: [5, 6], black: [6, 6] },
};

/** All UT item IDs (tier 7). */
const UT_ITEM_IDS: number[] = Object.keys(ITEM_DEFS)
  .map(Number)
  .filter((id) => getItemTier(id) === ItemTier.UT);

/** Dungeon-exclusive UT items (only drop from specific bosses). */
const UT_WEAPON_ID = makeItemId(0, 0, 7); // Doom Blade
const UT_ARMOR_ID = makeItemId(2, 0, 7); // Ethereal Shroud
const DUNGEON_EXCLUSIVE_UT_IDS = new Set([UT_WEAPON_ID, UT_ARMOR_ID]);

/** UT items available from overworld black bags (excludes dungeon-exclusive UTs). */
const GENERAL_UT_ITEM_IDS = UT_ITEM_IDS.filter(
  (id) => !DUNGEON_EXCLUSIVE_UT_IDS.has(id)
);

/**
 * Roll orb drops for an enemy kill in a given biome.
 * Returns an array of orb ItemInstanceData (may be empty).
 */
export function rollOrbDrops(biome: number): ItemInstanceData[] {
  // Crafting orbs only drop in Godlands
  if (biome !== DifficultyZone.Godlands) return [];

  const chances = ORB_DROP_CHANCES[biome];
  if (!chances) return [];

  const orbs: ItemInstanceData[] = [];
  for (const [rarityStr, chance] of Object.entries(chances)) {
    const rarity = Number(rarityStr);
    if (Math.random() < chance) {
      const orbTypes = ORBS_BY_RARITY[rarity];
      if (orbTypes && orbTypes.length > 0) {
        orbs.push(generateOrbInstance(pickRandom(orbTypes)));
      }
    }
  }
  return orbs;
}

/**
 * Generate item instances for a loot bag of the given rarity in the given biome.
 * Returns an array of ItemInstanceData.
 */
export function rollBagLoot(bagRarity: number, biome: number): ItemInstanceData[] {
  // Black bags drop 1 random non-dungeon-exclusive UT item
  if (bagRarity === BagRarity.Black) {
    return [generateUTItemInstance(pickRandom(GENERAL_UT_ITEM_IDS))];
  }

  const tierRanges = ZONE_TIER_RANGES[biome];
  if (!tierRanges) return [];

  let tierRange: [number, number];
  let itemCount: number;

  switch (bagRarity) {
    case BagRarity.Green:
      tierRange = tierRanges.green;
      itemCount = 1 + Math.floor(Math.random() * 3); // 1-3
      break;
    case BagRarity.Red:
      tierRange = tierRanges.red;
      itemCount = 1 + Math.floor(Math.random() * 2); // 1-2
      break;
    default:
      return [];
  }

  const categories = [
    ItemCategory.Weapon,
    ItemCategory.Ability,
    ItemCategory.Armor,
    ItemCategory.Ring,
  ];

  const items: ItemInstanceData[] = [];
  for (let i = 0; i < itemCount; i++) {
    const category = pickRandom(categories);
    const tier =
      tierRange[0] +
      Math.floor(Math.random() * (tierRange[1] - tierRange[0] + 1));

    let subtype = 0;
    if (category === ItemCategory.Weapon) {
      subtype =
        Math.random() < 0.5 ? WeaponSubtype.Sword : WeaponSubtype.Bow;
    }

    items.push(generateItemInstance(category, subtype, tier));
  }

  // Consumable drops (Lowlands and above)
  if (biome >= DifficultyZone.Lowlands && Math.random() < 0.4) {
    const roll = Math.random();
    if (roll < 0.4) items.push(generateConsumableInstance(makeItemId(4, 0, 1)));
    else if (roll < 0.8) items.push(generateConsumableInstance(makeItemId(4, 1, 1)));
    else items.push(generateConsumableInstance(makeItemId(4, 2, 1)));
  }

  // Orb drops
  const orbDrops = rollOrbDrops(biome);
  items.push(...orbDrops);

  return items;
}

/**
 * Roll loot for a boss kill. Bosses always drop a Red or Black bag.
 */
export function rollBossLoot(dungeonType: number): {
  bagRarity: number;
  items: ItemInstanceData[];
} {
  return rollBossLootWithRarity(dungeonType, 0.3);
}

/**
 * Roll boss loot with a custom black bag chance (for dungeon rarity boosts).
 * Infernal boss always drops UT weapon, Void boss always drops UT armor.
 */
export function rollBossLootWithRarity(
  dungeonType: number,
  blackBagChance: number
): { bagRarity: number; items: ItemInstanceData[] } {
  const isBlack = Math.random() < blackBagChance;
  const bagRarity = isBlack ? BagRarity.Black : BagRarity.Red;

  if (bagRarity === BagRarity.Black) {
    if (dungeonType === DungeonType.InfernalPit) {
      return { bagRarity, items: [generateUTItemInstance(UT_WEAPON_ID)] };
    }
    if (dungeonType === DungeonType.VoidSanctum) {
      return { bagRarity, items: [generateUTItemInstance(UT_ARMOR_ID)] };
    }
    return { bagRarity, items: [generateUTItemInstance(pickRandom(GENERAL_UT_ITEM_IDS))] };
  }

  const itemCount = 1 + Math.floor(Math.random() * 2); // 1-2
  const categories = [
    ItemCategory.Weapon,
    ItemCategory.Ability,
    ItemCategory.Armor,
    ItemCategory.Ring,
  ];
  const items: ItemInstanceData[] = [];
  for (let i = 0; i < itemCount; i++) {
    const category = pickRandom(categories);
    const tier = Math.random() < 0.5 ? 5 : 6;
    let subtype = 0;
    if (category === ItemCategory.Weapon) {
      subtype =
        Math.random() < 0.5 ? WeaponSubtype.Sword : WeaponSubtype.Bow;
    }
    items.push(generateItemInstance(category, subtype, tier));
  }
  return { bagRarity, items };
}
