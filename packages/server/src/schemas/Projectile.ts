import { Schema, type } from "@colyseus/schema";
import { EntityType, ProjectileType } from "@rotmg-lite/shared";

export class Projectile extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") angle: number = 0;
  @type("uint8") ownerType: number = EntityType.Player;
  @type("number") speed: number = 0;
  @type("uint8") projType: number = ProjectileType.BowArrow;

  // Server-only
  ownerId: string = "";
  damage: number = 0;
  startX: number = 0;
  startY: number = 0;
  maxRange: number = 0;
  piercing: boolean = false;
  collisionRadius: number = 5;
  hitEnemies: Set<string> = new Set();
  zone: string = "hostile";
}
