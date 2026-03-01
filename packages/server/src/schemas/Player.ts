import { Schema, type } from "@colyseus/schema";
import { PLAYER_MAX_HP } from "@rotmg-lite/shared";

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") aimAngle: number = 0;
  @type("number") hp: number = PLAYER_MAX_HP;
  @type("number") maxHp: number = PLAYER_MAX_HP;
  @type("number") xp: number = 0;
  @type("boolean") alive: boolean = true;
  @type("uint32") lastProcessedInput: number = 0; // synced to client for reconciliation
  @type("string") zone: string = "nexus"; // "nexus" | "hostile"

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
}
