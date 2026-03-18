import { getSupabase } from "./supabase";

export interface FriendRecord {
  accountId: string;
  accountName: string;
}

/**
 * Get the friend list (account IDs + names) for an account.
 */
export async function getAccountFriends(accountId: string): Promise<FriendRecord[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("friends")
    .select("friend_account_id, accounts!friends_friend_account_id_fkey(account_name)")
    .eq("account_id", accountId);

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    accountId: row.friend_account_id as string,
    accountName: (row.accounts?.account_name as string) ?? "",
  }));
}

/**
 * Add a friend by account ID.
 */
export async function addAccountFriend(
  accountId: string,
  friendAccountId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("friends")
    .upsert(
      { account_id: accountId, friend_account_id: friendAccountId },
      { onConflict: "account_id,friend_account_id" },
    );

  if (error) {
    throw new Error(`Failed to add friend for account ${accountId}: ${error.message}`);
  }
}

/**
 * Remove a friend by account ID.
 */
export async function removeAccountFriend(
  accountId: string,
  friendAccountId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("account_id", accountId)
    .eq("friend_account_id", friendAccountId);

  if (error) {
    throw new Error(`Failed to remove friend for account ${accountId}: ${error.message}`);
  }
}
