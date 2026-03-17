import { Schema, type, MapSchema, filterChildren } from "@colyseus/schema";
import { Player } from "./Player";
import { Enemy } from "./Enemy";
import { Projectile } from "./Projectile";
import { LootBag } from "./LootBag";
import { DungeonPortal } from "./DungeonPortal";
import { Gravestone } from "./Gravestone";

// IMPORTANT: Keep in sync with ENEMY_SYNC_RADIUS in @rotmg-lite/shared/constants.ts
const ENEMY_SYNC_RADIUS = 1600;
const ENEMY_SYNC_RADIUS_SQ = ENEMY_SYNC_RADIUS * ENEMY_SYNC_RADIUS;

export class GameState extends Schema {
  @type("uint8") playerCount: number = 0;

  // No @filterChildren on players — Colyseus filterChildren only controls whether
  // property CHANGES are forwarded, it does NOT generate onAdd/onRemove on filter
  // transitions. Since players persist in the map across zone changes (unlike enemies
  // which are added/removed), filtered zone changes would be permanently lost,
  // leaving clients with stale data. 30 players is manageable without AOI filtering.
  @type({ map: Player })
  players = new MapSchema<Player>();

  @filterChildren(function (
    this: GameState,
    client: any,
    _key: string,
    value: Enemy
  ): boolean {
    const player = this.players.get(client.sessionId);
    if (!player || !player.alive || player.zone === "nexus") return false;
    if (player.zone !== value.zone) return false;
    const dx = player.x - value.x;
    const dy = player.y - value.y;
    return dx * dx + dy * dy <= ENEMY_SYNC_RADIUS_SQ;
  })
  @type({ map: Enemy })
  enemies = new MapSchema<Enemy>();

  @filterChildren(function (
    this: GameState,
    client: any,
    _key: string,
    value: Projectile
  ): boolean {
    const player = this.players.get(client.sessionId);
    if (!player || !player.alive) return false;
    if (player.zone !== value.zone) return false;
    const dx = player.x - value.x;
    const dy = player.y - value.y;
    return dx * dx + dy * dy <= ENEMY_SYNC_RADIUS_SQ;
  })
  @type({ map: Projectile })
  projectiles = new MapSchema<Projectile>();

  @filterChildren(function (
    this: GameState,
    client: any,
    _key: string,
    value: LootBag
  ): boolean {
    const player = this.players.get(client.sessionId);
    if (!player || !player.alive) return false;
    if (player.zone !== value.zone) return false;
    // Solo bag: only visible to the owner
    if (value.ownerId && value.ownerId !== client.sessionId) return false;
    const dx = player.x - value.x;
    const dy = player.y - value.y;
    return dx * dx + dy * dy <= ENEMY_SYNC_RADIUS_SQ;
  })
  @type({ map: LootBag })
  lootBags = new MapSchema<LootBag>();

  @filterChildren(function (
    this: GameState,
    client: any,
    _key: string,
    value: DungeonPortal
  ): boolean {
    const player = this.players.get(client.sessionId);
    if (!player || !player.alive) return false;
    if (player.zone !== value.zone) return false;
    const dx = player.x - value.x;
    const dy = player.y - value.y;
    return dx * dx + dy * dy <= ENEMY_SYNC_RADIUS_SQ;
  })
  @type({ map: DungeonPortal })
  dungeonPortals = new MapSchema<DungeonPortal>();

  // No @filterChildren on gravestones — filterChildren only controls whether
  // property CHANGES are forwarded, not onAdd/onRemove on filter transitions.
  // Since gravestones are static (x/y never change), re-entering a zone would
  // not trigger onAdd. Gravestones are lightweight so syncing all is fine.
  @type({ map: Gravestone })
  gravestones = new MapSchema<Gravestone>();
}
