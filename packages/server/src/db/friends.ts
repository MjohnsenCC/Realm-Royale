import { getSupabase } from "./supabase";

export interface FriendRecord {
  accountId: string;
  accountName: string;
  isOnline: boolean;
  serverRegion: string | null;
  characterName: string | null;
  characterClass: number | null;
  characterLevel: number | null;
  lastOnlineAt: string | null;
}

export interface FriendRequestRecord {
  accountId: string;
  accountName: string;
}

/**
 * Get the accepted friend list for an account.
 */
export async function getAccountFriends(accountId: string): Promise<FriendRecord[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("friends")
    .select("friend_account_id, accounts!friends_friend_account_id_fkey(account_name, is_online, server_region, online_character_name, online_character_class, online_character_level, last_online_at)")
    .eq("account_id", accountId)
    .eq("status", "accepted");

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    accountId: row.friend_account_id as string,
    accountName: (row.accounts?.account_name as string) ?? "",
    isOnline: row.accounts?.is_online ?? false,
    serverRegion: row.accounts?.server_region ?? null,
    characterName: row.accounts?.online_character_name ?? null,
    characterClass: row.accounts?.online_character_class ?? null,
    characterLevel: row.accounts?.online_character_level ?? null,
    lastOnlineAt: row.accounts?.last_online_at ?? null,
  }));
}

/**
 * Check if any relationship (pending or accepted) exists between two accounts.
 * Returns: "accepted" | "pending_outgoing" | "pending_incoming" | null
 */
export async function getExistingRelationship(
  accountId: string,
  targetAccountId: string,
): Promise<"accepted" | "pending_outgoing" | "pending_incoming" | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("friends")
    .select("account_id, friend_account_id, status")
    .or(
      `and(account_id.eq.${accountId},friend_account_id.eq.${targetAccountId}),and(account_id.eq.${targetAccountId},friend_account_id.eq.${accountId})`,
    );

  if (error || !data || data.length === 0) {
    return null;
  }

  for (const row of data) {
    if (row.status === "accepted") return "accepted";
    if (row.status === "pending" && row.account_id === accountId) return "pending_outgoing";
    if (row.status === "pending" && row.account_id === targetAccountId) return "pending_incoming";
  }

  return null;
}

/**
 * Create a pending friend request from sender to target.
 */
export async function createFriendRequest(
  senderAccountId: string,
  targetAccountId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("friends")
    .insert({ account_id: senderAccountId, friend_account_id: targetAccountId, status: "pending" });

  if (error) {
    throw new Error(`Failed to create friend request: ${error.message}`);
  }
}

/**
 * Accept a friend request: update the pending row to accepted and insert the reverse row.
 */
export async function acceptFriendRequest(
  requesterAccountId: string,
  accepterAccountId: string,
): Promise<void> {
  const supabase = getSupabase();

  // Update the pending row to accepted
  const { error: updateError } = await supabase
    .from("friends")
    .update({ status: "accepted" })
    .eq("account_id", requesterAccountId)
    .eq("friend_account_id", accepterAccountId)
    .eq("status", "pending");

  if (updateError) {
    throw new Error(`Failed to accept friend request: ${updateError.message}`);
  }

  // Insert the reverse row as accepted
  const { error: insertError } = await supabase
    .from("friends")
    .upsert(
      { account_id: accepterAccountId, friend_account_id: requesterAccountId, status: "accepted" },
      { onConflict: "account_id,friend_account_id" },
    );

  if (insertError) {
    throw new Error(`Failed to insert reverse friendship: ${insertError.message}`);
  }
}

/**
 * Decline a friend request (delete the pending row).
 */
export async function declineFriendRequest(
  requesterAccountId: string,
  targetAccountId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("account_id", requesterAccountId)
    .eq("friend_account_id", targetAccountId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to decline friend request: ${error.message}`);
  }
}

/**
 * Cancel an outgoing friend request (delete the pending row).
 */
export async function cancelFriendRequest(
  senderAccountId: string,
  targetAccountId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("account_id", senderAccountId)
    .eq("friend_account_id", targetAccountId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to cancel friend request: ${error.message}`);
  }
}

/**
 * Get all pending friend requests (incoming and outgoing) for an account.
 */
export async function getPendingRequests(
  accountId: string,
): Promise<{ incoming: FriendRequestRecord[]; outgoing: FriendRequestRecord[] }> {
  const supabase = getSupabase();

  // Incoming: others requested me
  const { data: incomingData, error: incomingError } = await supabase
    .from("friends")
    .select("account_id, accounts!friends_account_id_fkey(account_name)")
    .eq("friend_account_id", accountId)
    .eq("status", "pending");

  // Outgoing: I requested others
  const { data: outgoingData, error: outgoingError } = await supabase
    .from("friends")
    .select("friend_account_id, accounts!friends_friend_account_id_fkey(account_name)")
    .eq("account_id", accountId)
    .eq("status", "pending");

  const incoming: FriendRequestRecord[] = (incomingData && !incomingError)
    ? incomingData.map((row: any) => ({
        accountId: row.account_id as string,
        accountName: (row.accounts?.account_name as string) ?? "",
      }))
    : [];

  const outgoing: FriendRequestRecord[] = (outgoingData && !outgoingError)
    ? outgoingData.map((row: any) => ({
        accountId: row.friend_account_id as string,
        accountName: (row.accounts?.account_name as string) ?? "",
      }))
    : [];

  return { incoming, outgoing };
}

/**
 * Remove a friend (delete both directions).
 */
export async function removeAccountFriend(
  accountId: string,
  friendAccountId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("friends")
    .delete()
    .or(
      `and(account_id.eq.${accountId},friend_account_id.eq.${friendAccountId}),and(account_id.eq.${friendAccountId},friend_account_id.eq.${accountId})`,
    );

  if (error) {
    throw new Error(`Failed to remove friend between ${accountId} and ${friendAccountId}: ${error.message}`);
  }
}
