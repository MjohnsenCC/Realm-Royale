import { ItemCategory } from "./types";
import { getItemCategory } from "./items";
import {
  ItemInstanceData,
  MAX_OPEN_STATS,
  MAX_STAT_TIER,
  OPEN_STAT_POOL,
  getOpenStatCount,
  getEmptySlotCount,
  rollOpenStatTier,
  pickRandom,
  isEmptyItem,
} from "./itemStats";

export interface CraftingResult {
  success: boolean;
  item: ItemInstanceData;
  message?: string;
}

/** Validate that an item can be crafted on. */
function validateCraftTarget(item: ItemInstanceData): string | null {
  if (isEmptyItem(item)) return "No item selected.";
  if (item.isUT) return "Cannot craft on Unique items.";
  const category = getItemCategory(item.baseItemId);
  if (category === ItemCategory.Consumable) return "Cannot craft on consumables.";
  if (category === ItemCategory.CraftingOrb) return "Cannot craft on orbs.";
  return null;
}

/** Clone an item instance (deep copy of openStats). */
function cloneItem(item: ItemInstanceData): ItemInstanceData {
  return {
    ...item,
    openStats: [...item.openStats],
  };
}

/** Get the stat pool for this item's category. */
function getPool(item: ItemInstanceData): number[] {
  const category = getItemCategory(item.baseItemId);
  return OPEN_STAT_POOL[category] ?? [];
}

/** Roll a random stat from the pool at a random tier. Returns [type, tier]. */
function rollRandomStat(item: ItemInstanceData): [number, number] {
  const pool = getPool(item);
  const statType = pickRandom(pool);
  const statTier = rollOpenStatTier();
  return [statType, statTier];
}

/** Get indices of open stats that are NOT forge-protected. */
function getUnprotectedIndices(item: ItemInstanceData): number[] {
  const count = getOpenStatCount(item);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i !== item.forgeProtectedSlot) {
      indices.push(i);
    }
  }
  return indices;
}

/** Consume forge protection after an orb is applied. */
function consumeForgeProtection(item: ItemInstanceData): void {
  item.forgeProtectedSlot = -1;
}

// --- Orb Implementations ---

/**
 * Blank Orb: Clears all 5 open stats. Safe reset.
 */
export function applyBlankOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const result = cloneItem(item);
  result.openStats = [];
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Ember Orb: Fills ALL empty open slots with random stats.
 */
export function applyEmberOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const emptyCount = getEmptySlotCount(item);
  if (emptyCount === 0) {
    return { success: false, item, message: "All open slots are full." };
  }

  const result = cloneItem(item);
  for (let i = 0; i < emptyCount; i++) {
    const [statType, statTier] = rollRandomStat(result);
    result.openStats.push(statType, statTier);
  }
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Shard Orb: Adds ONE random stat to a single empty slot.
 */
export function applyShardOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  if (getEmptySlotCount(item) === 0) {
    return { success: false, item, message: "All open slots are full." };
  }

  const result = cloneItem(item);
  const [statType, statTier] = rollRandomStat(result);
  result.openStats.push(statType, statTier);
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Chaos Orb: Rerolls ALL 5 open stats completely (types + tiers).
 * Forge-protected slots are preserved.
 */
export function applyChaosOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const result = cloneItem(item);
  const newStats: number[] = [];

  for (let i = 0; i < MAX_OPEN_STATS; i++) {
    if (i === item.forgeProtectedSlot && i < getOpenStatCount(item)) {
      // Preserve protected stat
      newStats.push(item.openStats[i * 2], item.openStats[i * 2 + 1]);
    } else {
      const [statType, statTier] = rollRandomStat(result);
      newStats.push(statType, statTier);
    }
  }

  result.openStats = newStats;
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Flux Orb: Rerolls ONE randomly selected existing stat (type + tier).
 * Cannot reroll a forge-protected stat.
 */
export function applyFluxOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const unprotected = getUnprotectedIndices(item);
  if (unprotected.length === 0) {
    return { success: false, item, message: "No stats to reroll." };
  }

  const result = cloneItem(item);
  const targetIdx = pickRandom(unprotected);
  const [statType, statTier] = rollRandomStat(result);
  result.openStats[targetIdx * 2] = statType;
  result.openStats[targetIdx * 2 + 1] = statTier;
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Void Orb: Removes ONE randomly selected existing stat.
 * Cannot remove a forge-protected stat.
 */
export function applyVoidOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const unprotected = getUnprotectedIndices(item);
  if (unprotected.length === 0) {
    return { success: false, item, message: "No stats to remove." };
  }

  const result = cloneItem(item);
  const targetIdx = pickRandom(unprotected);

  // Remove the stat pair at targetIdx
  result.openStats.splice(targetIdx * 2, 2);

  // Adjust forge protected slot index if needed
  if (result.forgeProtectedSlot > targetIdx) {
    result.forgeProtectedSlot--;
  }

  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Prism Orb: Rerolls the TIER of one randomly selected existing stat.
 * The stat type stays the same, only its tier (T1-T5) is re-randomized.
 * Cannot target a forge-protected stat.
 */
export function applyPrismOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const unprotected = getUnprotectedIndices(item);
  if (unprotected.length === 0) {
    return { success: false, item, message: "No stats to reroll." };
  }

  const result = cloneItem(item);
  const targetIdx = pickRandom(unprotected);
  const newTier = rollOpenStatTier();
  result.openStats[targetIdx * 2 + 1] = newTier;
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Forge Orb: Protects one player-chosen stat from the next orb.
 * @param slotIndex - The open stat slot index (0-4) to protect.
 */
export function applyForgeOrb(
  item: ItemInstanceData,
  slotIndex: number
): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  if (slotIndex < 0 || slotIndex >= getOpenStatCount(item)) {
    return { success: false, item, message: "Invalid slot to protect." };
  }

  if (item.forgeProtectedSlot >= 0) {
    return { success: false, item, message: "A stat is already protected." };
  }

  const result = cloneItem(item);
  result.forgeProtectedSlot = slotIndex;
  return { success: true, item: result };
}

/** Map of orb type to apply function (except Forge which needs extra param). */
export function applyCraftingOrb(
  orbType: number,
  item: ItemInstanceData,
  forgeSlotIndex?: number
): CraftingResult {
  switch (orbType) {
    case 0: return applyBlankOrb(item);
    case 1: return applyEmberOrb(item);
    case 2: return applyShardOrb(item);
    case 3: return applyChaosOrb(item);
    case 4: return applyFluxOrb(item);
    case 5: return applyVoidOrb(item);
    case 6: return applyPrismOrb(item);
    case 7: return applyForgeOrb(item, forgeSlotIndex ?? -1);
    default: return { success: false, item, message: "Unknown orb type." };
  }
}
