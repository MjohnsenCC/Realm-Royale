import { getSupabase } from "./supabase";

/**
 * Get the friend list (character names) for an account.
 */
export async function getAccountFriends(accountId: string): Promise<string[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("friends")
    .select("friend_name")
    .eq("account_id", accountId);

  if (error || !data) {
    return [];
  }

  return data.map((row: { friend_name: string }) => row.friend_name);
}

/**
 * Add a friend by character name.
 */
export async function addAccountFriend(
  accountId: string,
  friendName: string,
): Promise<void> {
  const supabase = getSupabase();

  // Upsert to avoid duplicates
  const { error } = await supabase
    .from("friends")
    .upsert(
      { account_id: accountId, friend_name: friendName },
      { onConflict: "account_id,friend_name" },
    );

  if (error) {
    throw new Error(`Failed to add friend for account ${accountId}: ${error.message}`);
  }
}

/**
 * Remove a friend by character name.
 */
export async function removeAccountFriend(
  accountId: string,
  friendName: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("account_id", accountId)
    .eq("friend_name", friendName);

  if (error) {
    throw new Error(`Failed to remove friend for account ${accountId}: ${error.message}`);
  }
}
