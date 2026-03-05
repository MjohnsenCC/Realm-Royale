import { Schema, type, MapSchema, filterChildren } from "@colyseus/schema";
import { Player } from "./Player";
import { Enemy } from "./Enemy";
import { Projectile } from "./Projectile";
import { LootBag } from "./LootBag";
import { DungeonPortal } from "./DungeonPortal";

// IMPORTANT: Keep in sync with ENEMY_SYNC_RADIUS in @rotmg-lite/shared/constants.ts
const ENEMY_SYNC_RADIUS = 1600;
const ENEMY_SYNC_RADIUS_SQ = ENEMY_SYNC_RADIUS * ENEMY_SYNC_RADIUS;

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();

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
}
