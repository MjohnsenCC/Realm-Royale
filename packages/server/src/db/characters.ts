import { getSupabase } from "./supabase";
import {
  CharacterSummary,
  CharacterData,
  MAX_CHARACTERS_PER_ACCOUNT,
  ItemInstanceData,
  generateItemInstance,
  generateConsumableInstance,
  generateOrbInstance,
  createEmptyItemInstance,
  ItemCategory,
  WeaponSubtype,
  CraftingOrbType,
  INVENTORY_SIZE,
  PORTAL_GEM_ID,
} from "@rotmg-lite/shared";

/** Legacy orb counter fields from DB. Used for one-time migration to inventory items. */
interface LegacyCharacterOrbs {
  blank?: number;
  ember?: number;
  shard?: number;
  chaos?: number;
  flux?: number;
  void?: number;
  prism?: number;
  forge?: number;
  calibrate?: number;
  divine?: number;
}

const ORB_FIELD_TO_TYPE: [keyof LegacyCharacterOrbs, number][] = [
  ["blank", CraftingOrbType.Blank],
  ["ember", CraftingOrbType.Ember],
  ["shard", CraftingOrbType.Shard],
  ["chaos", CraftingOrbType.Chaos],
  ["flux", CraftingOrbType.Flux],
  ["void", CraftingOrbType.Void],
  ["prism", CraftingOrbType.Prism],
  ["forge", CraftingOrbType.Forge],
  ["calibrate", CraftingOrbType.Calibrate],
  ["divine", CraftingOrbType.Divine],
];

/** Migrate legacy orb counters into inventory items. Returns updated inventory. */
function migrateOrbCountersToInventory(
  inventory: ItemInstanceData[],
  legacyOrbs: LegacyCharacterOrbs | undefined | null,
): ItemInstanceData[] {
  if (!legacyOrbs) return inventory;

  const inv = [...inventory];
  for (const [field, orbType] of ORB_FIELD_TO_TYPE) {
    const count = legacyOrbs[field] ?? 0;
    if (count <= 0) continue;

    // Find existing stack of same orb in inventory
    const orbItem = generateOrbInstance(orbType);
    const existingIdx = inv.findIndex(
      (item) => item.baseItemId === orbItem.baseItemId && item.baseItemId >= 0,
    );
    if (existingIdx >= 0) {
      inv[existingIdx] = { ...inv[existingIdx], quantity: (inv[existingIdx].quantity || 1) + count };
    } else {
      // Find empty slot
      const emptyIdx = inv.findIndex((item) => item.baseItemId < 0);
      if (emptyIdx >= 0) {
        inv[emptyIdx] = { ...orbItem, quantity: count };
      }
      // If no empty slot, orbs are lost (player needs to free up space)
    }
  }
  return inv;
}

function generateDefaultEquipment(): ItemInstanceData[] {
  return [
    generateItemInstance(ItemCategory.Weapon, WeaponSubtype.Bow, 1, false),
    generateItemInstance(ItemCategory.Ability, 0, 1, false),
    generateItemInstance(ItemCategory.Armor, 0, 1, false),
    generateItemInstance(ItemCategory.Ring, 0, 1, false),
  ];
}

function generateDefaultInventory(): ItemInstanceData[] {
  const inv = Array.from({ length: INVENTORY_SIZE }, () => createEmptyItemInstance());
  // Starting portal gems
  const portalGem = generateConsumableInstance(PORTAL_GEM_ID);
  portalGem.quantity = 5;
  inv[0] = portalGem;
  return inv;
}

/** Migrate legacy consumable counters (portalGems) into inventory items. */
function migrateConsumablesToInventory(
  inventory: ItemInstanceData[],
  consumables: { healthPots?: number; manaPots?: number; portalGems?: number } | undefined | null,
): ItemInstanceData[] {
  if (!consumables) return inventory;
  const portalGemCount = consumables.portalGems ?? 0;
  if (portalGemCount <= 0) return inventory;

  const inv = [...inventory];
  // Find existing portal gem stack
  const existingIdx = inv.findIndex(
    (item) => item.baseItemId === PORTAL_GEM_ID && item.baseItemId >= 0,
  );
  if (existingIdx >= 0) {
    inv[existingIdx] = { ...inv[existingIdx], quantity: (inv[existingIdx].quantity || 1) + portalGemCount };
  } else {
    const emptyIdx = inv.findIndex((item) => item.baseItemId < 0);
    if (emptyIdx >= 0) {
      const gem = generateConsumableInstance(PORTAL_GEM_ID);
      gem.quantity = portalGemCount;
      inv[emptyIdx] = gem;
    }
  }
  return inv;
}

export async function getCharactersByAccount(
  accountId: string
): Promise<CharacterSummary[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("characters")
    .select("id, name, level, created_at, last_played")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch characters: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    createdAt: row.created_at,
    lastPlayed: row.last_played,
  }));
}

export async function getCharacter(
  characterId: string,
  accountId: string
): Promise<CharacterData | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .eq("account_id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  let inventory = data.inventory as ItemInstanceData[];

  // Migrate legacy orb counters into inventory items (one-time)
  const legacyOrbs = data.orbs as LegacyCharacterOrbs | undefined;
  if (legacyOrbs && Object.values(legacyOrbs).some((v) => typeof v === "number" && v > 0)) {
    inventory = migrateOrbCountersToInventory(inventory, legacyOrbs);
  }

  // Migrate legacy consumable counters (portalGems) into inventory items (one-time)
  const legacyConsumables = data.consumables as { healthPots?: number; manaPots?: number; portalGems?: number } | undefined;
  if (legacyConsumables && (legacyConsumables.portalGems ?? 0) > 0) {
    inventory = migrateConsumablesToInventory(inventory, legacyConsumables);
  }

  return {
    id: data.id,
    accountId: data.account_id,
    name: data.name,
    level: data.level,
    xp: data.xp,
    equipment: data.equipment as ItemInstanceData[],
    inventory,
  };
}

export async function createCharacter(
  accountId: string,
  name: string
): Promise<CharacterData> {
  const supabase = getSupabase();

  // Check character count
  const { count } = await supabase
    .from("characters")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);

  if ((count ?? 0) >= MAX_CHARACTERS_PER_ACCOUNT) {
    throw new Error(`Maximum ${MAX_CHARACTERS_PER_ACCOUNT} characters per account`);
  }

  const equipment = generateDefaultEquipment();
  const inventory = generateDefaultInventory();

  const { data, error } = await supabase
    .from("characters")
    .insert({
      account_id: accountId,
      name,
      level: 1,
      xp: 0,
      equipment,
      inventory,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create character: ${error?.message}`);
  }

  return {
    id: data.id,
    accountId: data.account_id,
    name: data.name,
    level: data.level,
    xp: data.xp,
    equipment: data.equipment as ItemInstanceData[],
    inventory: data.inventory as ItemInstanceData[],
  };
}

export interface CharacterSaveData {
  level: number;
  xp: number;
  equipment: ItemInstanceData[];
  inventory: ItemInstanceData[];
}

export async function saveCharacter(
  characterId: string,
  data: CharacterSaveData
): Promise<void> {
  const supabase = getSupabase();

  const updatePayload: Record<string, unknown> = {
    level: data.level,
    xp: data.xp,
    equipment: data.equipment,
    inventory: data.inventory,
    consumables: {}, // Clear legacy consumable counters (portal gems now stored as inventory items)
    orbs: {}, // Clear legacy orb counters (orbs now stored as inventory items)
    last_played: new Date().toISOString(),
  };

  const { error, count } = await supabase
    .from("characters")
    .update(updatePayload, { count: "exact" })
    .eq("id", characterId);

  if (error) {
    throw new Error(
      `Failed to save character ${characterId}: ${error.message}`
    );
  }

  if (count === 0 || count === null) {
    throw new Error(
      `Save character ${characterId}: update matched ${count} rows`
    );
  }
}

export async function deleteCharacter(
  characterId: string,
  accountId: string
): Promise<boolean> {
  const supabase = getSupabase();

  const { error, count } = await supabase
    .from("characters")
    .delete({ count: "exact" })
    .eq("id", characterId)
    .eq("account_id", accountId);

  if (error) {
    throw new Error(`Failed to delete character: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
