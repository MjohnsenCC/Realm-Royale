import { ItemCategory } from "./types";
import { getItemCategory } from "./items";
import {
  ItemInstanceData,
  MAX_OPEN_STATS,
  OPEN_STAT_POOL,
  getOpenStatCount,
  getEmptySlotCount,
  rollOpenStatTier,
  rollStatRoll,
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

/** Get stat types already present on an item's open stats. */
function getExistingStatTypes(item: ItemInstanceData): Set<number> {
  const types = new Set<number>();
  for (let i = 0; i < item.openStats.length; i += 3) {
    types.add(item.openStats[i]);
  }
  return types;
}

/** Roll a random stat from the pool at a random tier, excluding stat types in the exclude set.
 *  Returns [type, tier, roll] or null if no valid stat types remain. */
function rollRandomStat(item: ItemInstanceData, exclude?: Set<number>): [number, number, number] | null {
  const pool = getPool(item);
  const available = exclude ? pool.filter(t => !exclude.has(t)) : pool;
  if (available.length === 0) return null;
  const statType = pickRandom(available);
  const statTier = rollOpenStatTier(item.instanceTier);
  const statRoll = rollStatRoll();
  return [statType, statTier, statRoll];
}

/** Check if a stat slot is forge-protected (by either slot). */
function isProtectedSlot(item: ItemInstanceData, slotIdx: number): boolean {
  return slotIdx === item.forgeProtectedSlot || slotIdx === item.forgeProtectedSlot2;
}

/** Get indices of open stats that are NOT forge-protected. */
function getUnprotectedIndices(item: ItemInstanceData): number[] {
  const count = getOpenStatCount(item);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!isProtectedSlot(item, i)) {
      indices.push(i);
    }
  }
  return indices;
}

/** Consume forge protection after an orb is applied. */
function consumeForgeProtection(item: ItemInstanceData): void {
  item.forgeProtectedSlot = -1;
  item.forgeProtectedSlot2 = -1;
}

// --- Orb Implementations ---

/**
 * Blank Orb: Clears all 5 open stats. Safe reset.
 */
export function applyBlankOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  if (item.openStats.length === 0) {
    return { success: false, item, message: "Item has no open stats to clear." };
  }

  const result = cloneItem(item);
  const hasProtection = result.forgeProtectedSlot >= 0 || result.forgeProtectedSlot2 >= 0;
  if (hasProtection) {
    // Preserve all forge-protected stats, clear the rest
    const kept: number[] = [];
    const openCount = getOpenStatCount(result);
    // Collect protected slots in order
    const protectedSlots: number[] = [];
    if (result.forgeProtectedSlot >= 0 && result.forgeProtectedSlot < openCount) {
      protectedSlots.push(result.forgeProtectedSlot);
    }
    if (result.forgeProtectedSlot2 >= 0 && result.forgeProtectedSlot2 < openCount) {
      protectedSlots.push(result.forgeProtectedSlot2);
    }
    protectedSlots.sort((a, b) => a - b);
    for (const idx of protectedSlots) {
      kept.push(result.openStats[idx * 3], result.openStats[idx * 3 + 1], result.openStats[idx * 3 + 2]);
    }
    result.openStats = kept;
    consumeForgeProtection(result);
  } else {
    result.openStats = [];
  }
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
  const usedTypes = getExistingStatTypes(result);
  for (let i = 0; i < emptyCount; i++) {
    const rolled = rollRandomStat(result, usedTypes);
    if (!rolled) break;
    const [statType, statTier, statRoll] = rolled;
    result.openStats.push(statType, statTier, statRoll);
    usedTypes.add(statType);
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
  const usedTypes = getExistingStatTypes(result);
  const rolled = rollRandomStat(result, usedTypes);
  if (!rolled) {
    return { success: false, item, message: "No unique stat types available." };
  }
  const [statType, statTier, statRoll] = rolled;
  result.openStats.push(statType, statTier, statRoll);
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Chaos Orb: Rerolls ALL 5 open stats completely (types + tiers + rolls).
 * Forge-protected slots are preserved.
 */
export function applyChaosOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const openCount = getOpenStatCount(item);
  if (openCount === 0) {
    return { success: false, item, message: "No open stats to reroll." };
  }

  const result = cloneItem(item);
  const newStats: number[] = [];
  const usedTypes = new Set<number>();

  // Reserve types of all forge-protected stats first
  if (item.forgeProtectedSlot >= 0 && item.forgeProtectedSlot < openCount) {
    usedTypes.add(item.openStats[item.forgeProtectedSlot * 3]);
  }
  if (item.forgeProtectedSlot2 >= 0 && item.forgeProtectedSlot2 < openCount) {
    usedTypes.add(item.openStats[item.forgeProtectedSlot2 * 3]);
  }

  for (let i = 0; i < openCount; i++) {
    if (isProtectedSlot(item, i) && i < openCount) {
      // Preserve protected stat
      newStats.push(item.openStats[i * 3], item.openStats[i * 3 + 1], item.openStats[i * 3 + 2]);
    } else {
      const rolled = rollRandomStat(result, usedTypes);
      if (!rolled) break;
      const [statType, statTier, statRoll] = rolled;
      newStats.push(statType, statTier, statRoll);
      usedTypes.add(statType);
    }
  }

  result.openStats = newStats;
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Flux Orb: Rerolls ONE randomly selected existing stat (type + tier + roll).
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
  // Exclude all existing stat types except the one being rerolled
  const usedTypes = getExistingStatTypes(result);
  usedTypes.delete(result.openStats[targetIdx * 3]);
  const rolled = rollRandomStat(result, usedTypes);
  if (!rolled) {
    return { success: false, item, message: "No unique stat types available." };
  }
  const [statType, statTier, statRoll] = rolled;
  result.openStats[targetIdx * 3] = statType;
  result.openStats[targetIdx * 3 + 1] = statTier;
  result.openStats[targetIdx * 3 + 2] = statRoll;
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

  // Remove the stat triple at targetIdx
  result.openStats.splice(targetIdx * 3, 3);

  // Adjust forge protected slot indices if needed
  if (result.forgeProtectedSlot > targetIdx) {
    result.forgeProtectedSlot--;
  }
  if (result.forgeProtectedSlot2 > targetIdx) {
    result.forgeProtectedSlot2--;
  }

  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Prism Orb: Rerolls the TIER of one randomly selected existing stat.
 * The stat type stays the same, its tier and roll are re-randomized.
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
  const newTier = rollOpenStatTier(item.instanceTier);
  result.openStats[targetIdx * 3 + 1] = newTier;
  result.openStats[targetIdx * 3 + 2] = rollStatRoll(); // re-roll value for new tier
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/**
 * Forge Orb: Protects one random open stat from the next orb.
 * Can be used repeatedly to re-roll which stat is protected.
 */
export function applyForgeOrb(
  item: ItemInstanceData,
): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const openCount = getOpenStatCount(item);
  if (openCount === 0) {
    return { success: false, item, message: "No stats to protect." };
  }

  const result = cloneItem(item);
  const indices: number[] = [];
  for (let i = 0; i < openCount; i++) indices.push(i);
  result.forgeProtectedSlot = pickRandom(indices);
  result.forgeProtectedSlot2 = -1; // Regular forge only protects one stat
  return { success: true, item: result };
}

/**
 * Divine Forge Orb: Protects two random different open stats from the next orb.
 * Can be used repeatedly to re-roll which stats are protected.
 */
export function applyDivineForgeOrb(
  item: ItemInstanceData,
): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const openCount = getOpenStatCount(item);
  if (openCount < 2) {
    return { success: false, item, message: "Need at least 2 stats to protect." };
  }

  const result = cloneItem(item);
  const indices: number[] = [];
  for (let i = 0; i < openCount; i++) indices.push(i);
  // Pick first slot
  const firstIdx = Math.floor(Math.random() * indices.length);
  result.forgeProtectedSlot = indices[firstIdx];
  indices.splice(firstIdx, 1);
  // Pick second slot (guaranteed different)
  result.forgeProtectedSlot2 = pickRandom(indices);
  return { success: true, item: result };
}

/**
 * Calibrate Orb: Re-rolls the value (0-100 percentile) of one random open stat,
 * keeping its type and tier unchanged. Cannot target forge-protected stats.
 */
export function applyCalibrateOrb(item: ItemInstanceData): CraftingResult {
  const error = validateCraftTarget(item);
  if (error) return { success: false, item, message: error };

  const unprotected = getUnprotectedIndices(item);
  if (unprotected.length === 0) {
    return { success: false, item, message: "No stats to calibrate." };
  }

  const result = cloneItem(item);
  const targetIdx = pickRandom(unprotected);
  result.openStats[targetIdx * 3 + 2] = rollStatRoll();
  consumeForgeProtection(result);
  return { success: true, item: result };
}

/** Map of orb type to apply function. */
export function applyCraftingOrb(
  orbType: number,
  item: ItemInstanceData,
): CraftingResult {
  switch (orbType) {
    case 0: return applyBlankOrb(item);
    case 1: return applyEmberOrb(item);
    case 2: return applyShardOrb(item);
    case 3: return applyChaosOrb(item);
    case 4: return applyFluxOrb(item);
    case 5: return applyVoidOrb(item);
    case 6: return applyPrismOrb(item);
    case 7: return applyForgeOrb(item);
    case 8: return applyCalibrateOrb(item);
    case 9: return applyDivineForgeOrb(item);
    default: return { success: false, item, message: "Unknown orb type." };
  }
}
