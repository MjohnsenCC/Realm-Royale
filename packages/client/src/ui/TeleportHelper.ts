import { isDungeonZone, isVaultZone, DUNGEON_TELEPORT_WINDOW_MS } from "@rotmg-lite/shared";

/**
 * Tracks when players enter dungeon zones so the UI can hide
 * the "Teleport To" button after the 20-second window expires.
 */
const dungeonEntryTimes = new Map<string, number>(); // playerName → timestamp

/**
 * Call whenever any player's zone changes (from room state sync or friend status updates).
 */
export function onPlayerZoneChanged(playerName: string, zone: string): void {
  if (isDungeonZone(zone)) {
    // Only record entry time if not already tracked (avoid resetting on re-sync)
    if (!dungeonEntryTimes.has(playerName)) {
      dungeonEntryTimes.set(playerName, Date.now());
    }
  } else {
    dungeonEntryTimes.delete(playerName);
  }
}

/**
 * Remove tracking for a player (e.g. on disconnect).
 */
export function clearPlayerTracking(playerName: string): void {
  dungeonEntryTimes.delete(playerName);
}

/**
 * Returns true if the local player should be allowed to teleport to
 * the given player based on their current zone.
 * - Vault: always blocked
 * - Dungeon: only within 20s of entry
 * - Otherwise: allowed
 */
export function canTeleportTo(playerName: string, zone: string | undefined): boolean {
  if (!zone) return false;
  if (isVaultZone(zone)) return false;
  if (isDungeonZone(zone)) {
    const entryTime = dungeonEntryTimes.get(playerName);
    if (!entryTime) return false; // unknown entry time — can't teleport
    return Date.now() - entryTime <= DUNGEON_TELEPORT_WINDOW_MS;
  }
  return true;
}
