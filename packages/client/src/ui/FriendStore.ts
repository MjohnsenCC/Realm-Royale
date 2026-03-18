import { NetworkManager } from "../network/NetworkManager";

// In-memory cache populated from server on join
let friendsCache: string[] = [];
let authenticated = false;

/**
 * Initialize the friend store with data from the server.
 * Called when the server sends FriendsList on join.
 */
export function initFriendsFromServer(friends: string[]): void {
  friendsCache = [...friends];
  authenticated = true;
}

/**
 * Reset for non-authenticated (guest) players. Guests cannot use friends.
 */
export function initFriendsDisabled(): void {
  friendsCache = [];
  authenticated = false;
}

export function isAuthenticated(): boolean {
  return authenticated;
}

export function getFriends(): string[] {
  return friendsCache;
}

export function addFriend(name: string): void {
  if (!authenticated) return;
  if (friendsCache.includes(name)) return;
  NetworkManager.getInstance().sendAddFriend(name);
  // Don't update cache yet — wait for server confirmation via onFriendAdded
}

export function removeFriend(name: string): void {
  if (!authenticated) return;
  if (!friendsCache.includes(name)) return;
  NetworkManager.getInstance().sendRemoveFriend(name);
  // Don't update cache yet — wait for server confirmation via onFriendRemoved
}

export function isFriend(name: string): boolean {
  return friendsCache.includes(name);
}

/**
 * Called when server confirms a friend was added.
 */
export function onFriendAdded(name: string): void {
  if (!friendsCache.includes(name)) {
    friendsCache.push(name);
  }
}

/**
 * Called when server confirms a friend was removed.
 */
export function onFriendRemoved(name: string): void {
  friendsCache = friendsCache.filter((f) => f !== name);
}
