import { Schema, type, ArraySchema } from "@colyseus/schema";
import { ItemInstance, createEmptyItemSchema } from "./ItemInstance";

export class LootBagItem extends Schema {
  @type(ItemInstance) item: ItemInstance = createEmptyItemSchema();
}

export class LootBag extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("int8") bagRarity: number = 0; // BagRarity enum
  @type([LootBagItem]) items = new ArraySchema<LootBagItem>();

  // Server-only (not synced)
  createdAt: number = 0;
  zone: string = "";
}
