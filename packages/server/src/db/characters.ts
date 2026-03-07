import { getSupabase } from "./supabase";
import {
  CharacterSummary,
  CharacterData,
  CharacterConsumables,
  CharacterOrbs,
  MAX_CHARACTERS_PER_ACCOUNT,
  ItemInstanceData,
  generateItemInstance,
  createEmptyItemInstance,
  ItemCategory,
  WeaponSubtype,
  INVENTORY_SIZE,
} from "@rotmg-lite/shared";

const DEFAULT_CONSUMABLES: CharacterConsumables = {
  healthPots: 3,
  manaPots: 3,
  portalGems: 5,
};

const DEFAULT_ORBS: CharacterOrbs = {
  blank: 0,
  ember: 0,
  shard: 0,
  chaos: 0,
  flux: 0,
  void: 0,
  prism: 0,
  forge: 0,
  calibrate: 0,
  divine: 0,
};

function generateDefaultEquipment(): ItemInstanceData[] {
  return [
    generateItemInstance(ItemCategory.Weapon, WeaponSubtype.Bow, 1, false),
    generateItemInstance(ItemCategory.Ability, 0, 1, false),
    generateItemInstance(ItemCategory.Armor, 0, 1, false),
    generateItemInstance(ItemCategory.Ring, 0, 1, false),
  ];
}

function generateDefaultInventory(): ItemInstanceData[] {
  return Array.from({ length: INVENTORY_SIZE }, () => createEmptyItemInstance());
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

  return {
    id: data.id,
    accountId: data.account_id,
    name: data.name,
    level: data.level,
    xp: data.xp,
    equipment: data.equipment as ItemInstanceData[],
    inventory: data.inventory as ItemInstanceData[],
    consumables: data.consumables as CharacterConsumables,
    orbs: data.orbs as CharacterOrbs,
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
      consumables: DEFAULT_CONSUMABLES,
      orbs: DEFAULT_ORBS,
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
    consumables: data.consumables as CharacterConsumables,
    orbs: data.orbs as CharacterOrbs,
  };
}

export interface CharacterSaveData {
  level: number;
  xp: number;
  equipment: ItemInstanceData[];
  inventory: ItemInstanceData[];
  consumables: CharacterConsumables;
  orbs: CharacterOrbs;
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
    consumables: data.consumables,
    orbs: data.orbs,
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
