import { Schema, type, ArraySchema } from "@colyseus/schema";
import {
  PLAYER_MAX_HP,
  BASE_DAMAGE,
  BASE_SHOOT_COOLDOWN,
  PLAYER_SPEED,
  BASE_HP_REGEN,
  INVENTORY_SIZE,
  EQUIPMENT_SLOTS,
  BASE_MAX_MANA,
  BASE_MANA_REGEN,
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
  @type(["int16"]) inventory = new ArraySchema<number>(
    ...new Array(INVENTORY_SIZE).fill(-1)
  ); // 8 slots, -1 = empty
  @type(["int16"]) equipment = new ArraySchema<number>(
    ...new Array(EQUIPMENT_SLOTS).fill(-1)
  ); // 4 slots: weapon, ability, armor, ring
  @type("number") mana: number = BASE_MAX_MANA;
  @type("number") maxMana: number = BASE_MAX_MANA;
  @type("number") cachedSpeed: number = PLAYER_SPEED; // synced for client prediction

  // Server-only fields (not synced — no @type decorator)
  lastShootTime: number = 0;
  lastAbilityTime: number = 0;
  inputMovementX: number = 0;
  inputMovementY: number = 0;
  inputAimAngle: number = 0;
  inputShooting: boolean = false;
  inputUseAbility: boolean = false;
  pendingInputs: Array<{
    seq: number;
    movementX: number;
    movementY: number;
    aimAngle: number;
    shooting: boolean;
    useAbility: boolean;
    dt: number;
  }> = [];

  // Cached level-derived stats (server-only, recalculated when level or equipment changes)
  cachedDamage: number = BASE_DAMAGE;
  cachedShootCooldown: number = BASE_SHOOT_COOLDOWN;
  cachedHpRegen: number = BASE_HP_REGEN;
  cachedManaRegen: number = BASE_MANA_REGEN;
  // Cached weapon stats
  cachedWeaponRange: number = 400;
  cachedWeaponProjSpeed: number = 500;
  cachedWeaponProjSize: number = 5;

  // Speed boost from UT ability (server-only)
  speedBoostUntil: number = 0;
  speedBoostAmount: number = 0;

  // Server-only: ID of the loot bag currently open for this player (empty = none)
  openBagId: string = "";

  // Server-only: dungeon return position and zone
  dungeonReturnX: number = 0;
  dungeonReturnY: number = 0;
  dungeonReturnZone: string = "";
}
