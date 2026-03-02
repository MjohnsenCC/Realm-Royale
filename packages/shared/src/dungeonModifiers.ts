// --- Dungeon Modifier System ---
// Each dungeon portal gets 1-5 random difficulty modifiers with hidden tiers (1-5).
// Higher count + higher tiers = harder dungeon = better loot bonuses.

export const DungeonModifierId = {
  EnemyHpUp: 0,
  EnemyDamageUp: 1,
  EnemySpeedUp: 2,
  EnemyFireRateUp: 3,
  EnemyDamageResist: 4,
  EnemyCountUp: 5,
  EnemyRegenUp: 6,
  EnemyAggroUp: 7,
  EnemyProjSizeUp: 8,
  EnemyProjSpeedUp: 9,
} as const;
export type DungeonModifierId =
  (typeof DungeonModifierId)[keyof typeof DungeonModifierId];

export interface DungeonModifierDef {
  id: number;
  name: string;
  description: string;
  color: string;
  tierValues: [number, number, number, number, number]; // tiers 1-5
}

export const DUNGEON_MODIFIER_DEFS: Record<number, DungeonModifierDef> = {
  [DungeonModifierId.EnemyHpUp]: {
    id: 0,
    name: "Hardened Foes",
    description: "Enemies have increased HP",
    color: "#ff6666",
    tierValues: [15, 30, 50, 75, 100],
  },
  [DungeonModifierId.EnemyDamageUp]: {
    id: 1,
    name: "Lethal Force",
    description: "Enemies deal more damage",
    color: "#ff4444",
    tierValues: [10, 25, 40, 60, 80],
  },
  [DungeonModifierId.EnemySpeedUp]: {
    id: 2,
    name: "Swift Enemies",
    description: "Enemies move faster",
    color: "#ff8844",
    tierValues: [10, 20, 30, 45, 60],
  },
  [DungeonModifierId.EnemyFireRateUp]: {
    id: 3,
    name: "Rapid Barrage",
    description: "Enemies shoot faster",
    color: "#ff6644",
    tierValues: [10, 20, 30, 40, 50],
  },
  [DungeonModifierId.EnemyDamageResist]: {
    id: 4,
    name: "Thick Hides",
    description: "Enemies take reduced damage",
    color: "#dd6644",
    tierValues: [8, 15, 22, 30, 40],
  },
  [DungeonModifierId.EnemyCountUp]: {
    id: 5,
    name: "Swarming",
    description: "Extra enemies spawn per room",
    color: "#dd8844",
    tierValues: [1, 2, 3, 4, 5],
  },
  [DungeonModifierId.EnemyRegenUp]: {
    id: 6,
    name: "Regenerating Foes",
    description: "Enemies heal over time",
    color: "#44dd66",
    tierValues: [2, 4, 7, 10, 15],
  },
  [DungeonModifierId.EnemyAggroUp]: {
    id: 7,
    name: "Keen Senses",
    description: "Enemy aggro range increased",
    color: "#ffaa44",
    tierValues: [15, 30, 50, 70, 100],
  },
  [DungeonModifierId.EnemyProjSizeUp]: {
    id: 8,
    name: "Massive Volleys",
    description: "Enemy projectiles are larger",
    color: "#dd44aa",
    tierValues: [20, 40, 60, 80, 100],
  },
  [DungeonModifierId.EnemyProjSpeedUp]: {
    id: 9,
    name: "Velocity Surge",
    description: "Enemy projectiles are faster",
    color: "#ffcc44",
    tierValues: [10, 20, 35, 50, 70],
  },
};

// --- Dungeon Stats Data ---

export interface DungeonStats {
  modifierIds: number[];
  modifierTiers: number[];
  lootRarityBoost: number;
  lootQuantityBoost: number;
}

/**
 * Generate random dungeon stats.
 * Picks 1-5 random difficulty modifiers, each with hidden tier 1-5.
 * Loot bonuses scale with modifier count and total tier weight.
 */
export function generateDungeonStats(): DungeonStats {
  const modCount = 1 + Math.floor(Math.random() * 5); // 1-5

  const allIds = Object.values(DungeonModifierId).filter(
    (v) => typeof v === "number"
  ) as number[];

  // Shuffle and pick
  const shuffled = [...allIds].sort(() => Math.random() - 0.5);
  const modifierIds = shuffled.slice(0, modCount);

  const modifierTiers: number[] = [];
  // Per-tier loot contributions: [tier1, tier2, tier3, tier4, tier5]
  const quantityPerTier = [2, 5, 10, 15, 20];
  const rarityPerTier = [1, 2.5, 5, 7.5, 10];

  // Weighted tier roll: higher tiers are slightly rarer
  // Weights: tier1=25, tier2=25, tier3=20, tier4=18, tier5=12
  const tierWeights = [25, 25, 20, 18, 12];
  const tierWeightTotal = 100;

  let totalQuantity = 0;
  let totalRarity = 0;
  for (let i = 0; i < modCount; i++) {
    let roll = Math.random() * tierWeightTotal;
    let tier = 1;
    for (let t = 0; t < tierWeights.length; t++) {
      roll -= tierWeights[t];
      if (roll <= 0) { tier = t + 1; break; }
    }
    modifierTiers.push(tier);
    totalQuantity += quantityPerTier[tier - 1];
    totalRarity += rarityPerTier[tier - 1];
  }

  return { modifierIds, modifierTiers, lootRarityBoost: totalRarity, lootQuantityBoost: totalQuantity };
}

// --- Display Helpers ---

export function getModifierDisplayName(modId: number): string {
  return DUNGEON_MODIFIER_DEFS[modId]?.name ?? "Unknown";
}

export function getModifierDescription(modId: number): string {
  return DUNGEON_MODIFIER_DEFS[modId]?.description ?? "";
}

export function getModifierColor(modId: number): string {
  return DUNGEON_MODIFIER_DEFS[modId]?.color ?? "#ff6666";
}

/**
 * Get the actual percentage value for a modifier at a given tier.
 * Used server-side to compute gameplay effects.
 */
export function getModifierTierValue(modId: number, tier: number): number {
  const def = DUNGEON_MODIFIER_DEFS[modId];
  if (!def) return 0;
  return def.tierValues[Math.max(0, Math.min(4, tier - 1))] ?? 0;
}
