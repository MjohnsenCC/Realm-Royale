import { getSupabase } from "./supabase";
import { ItemInstanceData } from "@rotmg-lite/shared";

export interface AccountRecord {
  id: string;
  google_id: string;
  email: string;
  display_name: string;
  account_name: string | null;
}

export async function findOrCreateAccount(
  googleId: string,
  email: string,
  displayName: string
): Promise<AccountRecord> {
  const supabase = getSupabase();

  // Try to find existing account
  const { data: existing } = await supabase
    .from("accounts")
    .select("id, google_id, email, display_name, account_name")
    .eq("google_id", googleId)
    .single();

  if (existing) {
    // Update email/name in case they changed on Google's side
    await supabase
      .from("accounts")
      .update({ email, display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    return { ...existing, email, display_name: displayName, account_name: existing.account_name };
  }

  // Create new account
  const { data: created, error } = await supabase
    .from("accounts")
    .insert({ google_id: googleId, email, display_name: displayName })
    .select("id, google_id, email, display_name, account_name")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create account: ${error?.message}`);
  }

  return created;
}

export async function getAccountName(
  accountId: string
): Promise<string | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("accounts")
    .select("account_name")
    .eq("id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.account_name as string | null;
}

export async function setAccountName(
  accountId: string,
  name: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("accounts")
    .update({ account_name: name, updated_at: new Date().toISOString() })
    .eq("id", accountId);

  if (error) {
    throw new Error(`Failed to set account name: ${error.message}`);
  }
}

export async function getAccountVault(
  accountId: string
): Promise<ItemInstanceData[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("accounts")
    .select("vault")
    .eq("id", accountId)
    .single();

  if (error || !data) {
    return [];
  }

  return (data.vault as ItemInstanceData[]) ?? [];
}

export async function saveAccountVault(
  accountId: string,
  vault: ItemInstanceData[]
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("accounts")
    .update({ vault, updated_at: new Date().toISOString() })
    .eq("id", accountId);

  if (error) {
    throw new Error(`Failed to save vault for account ${accountId}: ${error.message}`);
  }
}

/**
 * Find an account by account_name (case-insensitive). Returns id + account_name, or null.
 */
export async function findAccountByName(
  name: string,
): Promise<{ id: string; accountName: string } | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("accounts")
    .select("id, account_name")
    .ilike("account_name", name)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return { id: data.id as string, accountName: (data.account_name as string) ?? "" };
}

/**
 * Mark an account as online with character and server info.
 */
export async function setAccountOnline(
  accountId: string,
  serverRegion: string,
  characterName: string,
  characterClass: number,
  characterLevel: number
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("accounts")
    .update({
      is_online: true,
      server_region: serverRegion,
      online_character_name: characterName,
      online_character_class: characterClass,
      online_character_level: characterLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    console.error(`Failed to set account online ${accountId}: ${error.message}`);
  }
}

/**
 * Mark an account as offline and clear presence data.
 */
export async function setAccountOffline(accountId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("accounts")
    .update({
      is_online: false,
      server_region: null,
      online_character_name: null,
      online_character_class: null,
      online_character_level: null,
      last_online_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    console.error(`Failed to set account offline ${accountId}: ${error.message}`);
  }
}
