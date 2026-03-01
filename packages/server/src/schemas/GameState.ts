import { Schema, type, MapSchema, filterChildren } from "@colyseus/schema";
import { Player } from "./Player";
import { Enemy } from "./Enemy";
import { Projectile } from "./Projectile";

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
    if (!player || !player.alive || player.zone !== "hostile") return false;
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
    if (!player || !player.alive || player.zone !== "hostile") return false;
    const dx = player.x - value.x;
    const dy = player.y - value.y;
    return dx * dx + dy * dy <= ENEMY_SYNC_RADIUS_SQ;
  })
  @type({ map: Projectile })
  projectiles = new MapSchema<Projectile>();
}
