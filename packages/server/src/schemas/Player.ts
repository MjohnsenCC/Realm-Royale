import { Schema, type, ArraySchema } from "@colyseus/schema";
import {
  PLAYER_MAX_HP,
  BASE_DAMAGE,
  BASE_SHOOT_COOLDOWN,
  PLAYER_SPEED,
  BASE_HP_REGEN,
  INVENTORY_SIZE,
} from "@rotmg-lite/shared";

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") aimAngle: number = 0;
  @type("number") hp: number = PLAYER_MAX_HP;
  @type("number") maxHp: number = PLAYER_MAX_HP;
  @type("number") xp: number = 0;
  @type("number") level: number = 1;
  @type("boolean") alive: boolean = true;
  @type("uint32") lastProcessedInput: number = 0; // synced to client for reconciliation
  @type("string") zone: string = "nexus"; // "nexus" | "hostile"
  @type(["int8"]) inventory = new ArraySchema<number>(
    ...new Array(INVENTORY_SIZE).fill(-1)
  ); // 8 slots, -1 = empty

  // Server-only fields (not synced — no @type decorator)
  lastShootTime: number = 0;
  inputMovementX: number = 0;
  inputMovementY: number = 0;
  inputAimAngle: number = 0;
  inputShooting: boolean = false;
  pendingInputs: Array<{
    seq: number;
    movementX: number;
    movementY: number;
    aimAngle: number;
    shooting: boolean;
    dt: number;
  }> = [];

  // Cached level-derived stats (server-only, recalculated when level changes)
  cachedDamage: number = BASE_DAMAGE;
  cachedShootCooldown: number = BASE_SHOOT_COOLDOWN;
  cachedSpeed: number = PLAYER_SPEED;
  cachedHpRegen: number = BASE_HP_REGEN;

  // Server-only: ID of the loot bag currently open for this player (empty = none)
  openBagId: string = "";
}
