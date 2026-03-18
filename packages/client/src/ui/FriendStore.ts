import { NetworkManager } from "../network/NetworkManager";

export interface FriendEntry {
  accountId: string;
  accountName: string;
  online: boolean;
  characterName?: string;
  characterClass?: number;
  level?: number;
}

// In-memory cache populated from server on join
let friendsCache: FriendEntry[] = [];
let friendAccountIds = new Set<string>();
let authenticated = false;

/**
 * Initialize the friend store with data from the server.
 * Called when the server sends FriendsList on join.
 */
export function initFriendsFromServer(friends: FriendEntry[]): void {
  friendsCache = [...friends];
  friendAccountIds = new Set(friends.map((f) => f.accountId));
  authenticated = true;
}

/**
 * Reset for non-authenticated (guest) players. Guests cannot use friends.
 */
export function initFriendsDisabled(): void {
  friendsCache = [];
  friendAccountIds.clear();
  authenticated = false;
}

export function isAuthenticated(): boolean {
  return authenticated;
}

export function getFriends(): FriendEntry[] {
  return friendsCache;
}

export function addFriend(characterName: string): void {
  if (!authenticated) return;
  NetworkManager.getInstance().sendAddFriend(characterName);
  // Don't update cache yet — wait for server confirmation via onFriendAdded
}

export function removeFriend(accountId: string): void {
  if (!authenticated) return;
  if (!friendAccountIds.has(accountId)) return;
  NetworkManager.getInstance().sendRemoveFriend(accountId);
  // Don't update cache yet — wait for server confirmation via onFriendRemoved
}

export function isFriendByAccountName(accountName: string): boolean {
  if (!accountName) return false;
  return friendsCache.some((f) => f.accountName === accountName);
}

/**
 * Called when server confirms a friend was added.
 */
export function onFriendAdded(entry: { accountId: string; accountName: string }): void {
  if (!friendAccountIds.has(entry.accountId)) {
    friendsCache.push({
      accountId: entry.accountId,
      accountName: entry.accountName,
      online: true,
    });
    friendAccountIds.add(entry.accountId);
  }
}

/**
 * Called when server confirms a friend was removed.
 */
export function onFriendRemoved(accountId: string): void {
  friendsCache = friendsCache.filter((f) => f.accountId !== accountId);
  friendAccountIds.delete(accountId);
}
