import { Schema, type } from "@colyseus/schema";
import { EnemyType, EnemyAIState } from "@rotmg-lite/shared";

export class Enemy extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 0;
  @type("number") maxHp: number = 0;
  @type("uint8") enemyType: number = EnemyType.Crab;
  @type("uint8") aiState: number = EnemyAIState.Idle;

  // Server-only (not synced to clients)
  spawnX: number = 0;
  spawnY: number = 0;
  targetPlayerId: string = "";
  idleTargetX: number = 0;
  idleTargetY: number = 0;
  idlePauseTimer: number = 0;
  spiralAngleOffset: number = 0;
  lastShootTime: number = 0;
}
