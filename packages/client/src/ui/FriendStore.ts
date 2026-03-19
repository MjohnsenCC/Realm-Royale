import { NetworkManager } from "../network/NetworkManager";

export interface FriendEntry {
  accountId: string;
  accountName: string;
  online: boolean;
  characterName?: string;
  characterClass?: number;
  level?: number;
  serverRegion?: string;
}

export interface FriendRequestEntry {
  accountId: string;
  accountName: string;
}

// In-memory cache populated from server on join
let friendsCache: FriendEntry[] = [];
let friendAccountIds = new Set<string>();
let incomingRequests: FriendRequestEntry[] = [];
let outgoingRequests: FriendRequestEntry[] = [];
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
 * Initialize pending requests from server.
 */
export function initRequestsFromServer(incoming: FriendRequestEntry[], outgoing: FriendRequestEntry[]): void {
  incomingRequests = [...incoming];
  outgoingRequests = [...outgoing];
}

/**
 * Reset for non-authenticated (guest) players. Guests cannot use friends.
 */
export function initFriendsDisabled(): void {
  friendsCache = [];
  friendAccountIds.clear();
  incomingRequests = [];
  outgoingRequests = [];
  authenticated = false;
}

export function isAuthenticated(): boolean {
  return authenticated;
}

export function getFriends(): FriendEntry[] {
  return friendsCache;
}

export function getIncomingRequests(): FriendRequestEntry[] {
  return incomingRequests;
}

export function getOutgoingRequests(): FriendRequestEntry[] {
  return outgoingRequests;
}

export function addFriend(characterName: string): void {
  if (!authenticated) return;
  NetworkManager.getInstance().sendAddFriend(characterName);
  // Now sends a friend request instead of instant add — wait for server confirmation
}

export function removeFriend(accountId: string): void {
  if (!authenticated) return;
  if (!friendAccountIds.has(accountId)) return;
  NetworkManager.getInstance().sendRemoveFriend(accountId);
}

export function acceptRequest(accountId: string): void {
  if (!authenticated) return;
  NetworkManager.getInstance().sendAcceptFriendRequest(accountId);
}

export function declineRequest(accountId: string): void {
  if (!authenticated) return;
  NetworkManager.getInstance().sendDeclineFriendRequest(accountId);
}

export function cancelRequest(accountId: string): void {
  if (!authenticated) return;
  NetworkManager.getInstance().sendCancelFriendRequest(accountId);
}

export function isFriendByAccountName(accountName: string): boolean {
  if (!accountName) return false;
  return friendsCache.some((f) => f.accountName === accountName);
}

export function hasPendingRequestTo(accountId: string): boolean {
  return outgoingRequests.some((r) => r.accountId === accountId);
}

export function hasPendingRequestFrom(accountId: string): boolean {
  return incomingRequests.some((r) => r.accountId === accountId);
}

export function hasPendingRequestToByName(accountName: string): boolean {
  if (!accountName) return false;
  return outgoingRequests.some((r) => r.accountName === accountName);
}

export function hasPendingRequestFromByName(accountName: string): boolean {
  if (!accountName) return false;
  return incomingRequests.some((r) => r.accountName === accountName);
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
  // Clean up any pending requests for this account
  incomingRequests = incomingRequests.filter((r) => r.accountId !== entry.accountId);
  outgoingRequests = outgoingRequests.filter((r) => r.accountId !== entry.accountId);
}

/**
 * Called when a friend's online status changes.
 */
export function updateFriendStatus(
  accountId: string,
  online: boolean,
  characterName?: string,
  characterClass?: number,
  level?: number,
  serverRegion?: string,
): void {
  const friend = friendsCache.find((f) => f.accountId === accountId);
  if (!friend) return;
  friend.online = online;
  friend.characterName = online ? characterName : undefined;
  friend.characterClass = online ? characterClass : undefined;
  friend.level = online ? level : undefined;
  friend.serverRegion = online ? serverRegion : undefined;
}

/**
 * Called when server confirms a friend was removed.
 */
export function onFriendRemoved(accountId: string): void {
  friendsCache = friendsCache.filter((f) => f.accountId !== accountId);
  friendAccountIds.delete(accountId);
}

/**
 * Called when a friend request is received (incoming) or confirmed sent (outgoing).
 */
export function onFriendRequestReceived(entry: FriendRequestEntry, direction: "incoming" | "outgoing"): void {
  if (direction === "incoming") {
    if (!incomingRequests.some((r) => r.accountId === entry.accountId)) {
      incomingRequests.push(entry);
    }
  } else {
    if (!outgoingRequests.some((r) => r.accountId === entry.accountId)) {
      outgoingRequests.push(entry);
    }
  }
}

/**
 * Called when a friend request is declined.
 */
export function onFriendRequestDeclined(accountId: string): void {
  outgoingRequests = outgoingRequests.filter((r) => r.accountId !== accountId);
  incomingRequests = incomingRequests.filter((r) => r.accountId !== accountId);
}

/**
 * Called when a friend request is cancelled.
 */
export function onFriendRequestCancelled(accountId: string): void {
  incomingRequests = incomingRequests.filter((r) => r.accountId !== accountId);
  outgoingRequests = outgoingRequests.filter((r) => r.accountId !== accountId);
}
