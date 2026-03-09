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
import { ItemInstance, createEmptyItemSchema } from "./ItemInstance";

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("uint8") characterClass: number = 0;
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
  @type([ItemInstance]) inventory = new ArraySchema<ItemInstance>(
    ...Array.from({ length: INVENTORY_SIZE }, () => createEmptyItemSchema())
  );
  @type([ItemInstance]) equipment = new ArraySchema<ItemInstance>(
    ...Array.from({ length: EQUIPMENT_SLOTS }, () => createEmptyItemSchema())
  );
  @type("number") mana: number = BASE_MAX_MANA;
  @type("number") maxMana: number = BASE_MAX_MANA;
  @type("number") cachedSpeed: number = PLAYER_SPEED; // synced for client prediction

  // Synced: last hit info for client damage indicators
  @type("uint8") lastHitDamageType: number = 0; // 0=Physical, 1=Magic
  @type("number") lastHitAmount: number = 0;
  @type("uint32") lastHitSeq: number = 0; // monotonic counter for detecting new hits

  // Server-only: persistence tracking (not synced)
  accountId: string = "";
  characterId: string = "";

  // Server-only fields (not synced — no @type decorator)
  lastShootTime: number = 0;
  lastAbilityTime: number = 0;
  inputMovementX: number = 0;
  inputMovementY: number = 0;
  inputAimAngle: number = 0;
  inputAimX: number = 0;
  inputAimY: number = 0;
  inputShooting: boolean = false;
  inputUseAbility: boolean = false;
  pendingInputs: Array<{
    seq: number;
    movementX: number;
    movementY: number;
    aimAngle: number;
    aimX: number;
    aimY: number;
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
  cachedPhysDmgReduce: number = 0;
  cachedMagicDmgReduce: number = 0;
  cachedAbilityDamageBonus: number = 0;
  cachedAbilityCooldownReduction: number = 0;
  cachedCritChance: number = 0;
  cachedCritMult: number = 0;

  // Speed boost from UT ability (server-only)
  speedBoostUntil: number = 0;
  speedBoostAmount: number = 0;

  // Server-only: ID of the loot bag currently open for this player (empty = none)
  openBagId: string = "";

  // Server-only: dungeon return position and zone
  dungeonReturnX: number = 0;
  dungeonReturnY: number = 0;
  dungeonReturnZone: string = "";

  // Server-only: portal gem vault portal state
  portalGemReturnX: number = 0;
  portalGemReturnY: number = 0;
  portalGemReturnZone: string = "";
  portalGemPortalActive: boolean = false;

  // Server-only: invulnerable during zone loading transition or portal gem
  invulnerable: boolean = false;
  invulnerableSince: number = 0;
  invulnerableUntil: number = 0; // explicit end time (0 = use ZoneReady or 5s safety net)

  // Server-only: vault storage (loaded on demand when entering vault zone)
  vaultItems: import("@rotmg-lite/shared").ItemInstanceData[] | null = null;
  vaultDirty: boolean = false;
  nearVaultChest: boolean = false;

  // Server-only: chat rate limiting
  lastChatTime: number = 0;
}
