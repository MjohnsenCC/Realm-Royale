import { Schema, type, ArraySchema } from "@colyseus/schema";

export class DungeonPortal extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("uint8") portalType: number = 0;
  @type("string") zone: string = "";

  // Dungeon modifier stats (synced for client tooltip)
  @type(["uint8"]) modifierIds = new ArraySchema<number>();
  @type(["uint8"]) modifierTiers = new ArraySchema<number>();
  @type("uint8") lootRarityBoost: number = 0;
  @type("uint8") lootQuantityBoost: number = 0;

  // Server-only (not synced)
  createdAt: number = 0;
  dungeonType: number = 0;
  exitReturnX: number = 0;
  exitReturnY: number = 0;
  exitReturnZone: string = "";
}
