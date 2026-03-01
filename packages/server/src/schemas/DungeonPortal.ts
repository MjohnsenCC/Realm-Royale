import { Schema, type } from "@colyseus/schema";

export class DungeonPortal extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("uint8") portalType: number = 0;
  @type("string") zone: string = "";

  // Server-only (not synced)
  createdAt: number = 0;
  dungeonType: number = 0;
  exitReturnX: number = 0;
  exitReturnY: number = 0;
  exitReturnZone: string = "";
}
