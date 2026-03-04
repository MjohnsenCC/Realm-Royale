import { Schema, type, ArraySchema } from "@colyseus/schema";
import { ItemInstanceData, createEmptyItemInstance } from "@rotmg-lite/shared";

export class ItemInstance extends Schema {
  @type("int16") baseItemId: number = -1;
  @type("int8") instanceTier: number = 0;
  @type("boolean") isUT: boolean = false;
  @type("int8") lockedStat1Type: number = -1;
  @type("int8") lockedStat1Tier: number = 0;
  @type("int8") lockedStat2Type: number = -1;
  @type("int8") lockedStat2Tier: number = 0;
  @type(["int8"]) openStats = new ArraySchema<number>();
  @type("int8") forgeProtectedSlot: number = -1;
}

/** Convert a Schema ItemInstance to a plain ItemInstanceData object. */
export function schemaToItemData(schema: ItemInstance): ItemInstanceData {
  return {
    baseItemId: schema.baseItemId,
    instanceTier: schema.instanceTier,
    isUT: schema.isUT,
    lockedStat1Type: schema.lockedStat1Type,
    lockedStat1Tier: schema.lockedStat1Tier,
    lockedStat2Type: schema.lockedStat2Type,
    lockedStat2Tier: schema.lockedStat2Tier,
    openStats: schema.openStats.map((v) => v as number),
    forgeProtectedSlot: schema.forgeProtectedSlot,
  };
}

/** Convert a plain ItemInstanceData to a Schema ItemInstance. */
export function itemDataToSchema(data: ItemInstanceData): ItemInstance {
  const schema = new ItemInstance();
  schema.baseItemId = data.baseItemId;
  schema.instanceTier = data.instanceTier;
  schema.isUT = data.isUT;
  schema.lockedStat1Type = data.lockedStat1Type;
  schema.lockedStat1Tier = data.lockedStat1Tier;
  schema.lockedStat2Type = data.lockedStat2Type;
  schema.lockedStat2Tier = data.lockedStat2Tier;
  schema.openStats = new ArraySchema<number>(...data.openStats);
  schema.forgeProtectedSlot = data.forgeProtectedSlot;
  return schema;
}

/** Update an existing Schema ItemInstance from ItemInstanceData (in-place). */
export function updateSchemaFromData(
  schema: ItemInstance,
  data: ItemInstanceData
): void {
  schema.baseItemId = data.baseItemId;
  schema.instanceTier = data.instanceTier;
  schema.isUT = data.isUT;
  schema.lockedStat1Type = data.lockedStat1Type;
  schema.lockedStat1Tier = data.lockedStat1Tier;
  schema.lockedStat2Type = data.lockedStat2Type;
  schema.lockedStat2Tier = data.lockedStat2Tier;
  // Replace openStats array contents
  schema.openStats.splice(0, schema.openStats.length);
  for (const val of data.openStats) {
    schema.openStats.push(val);
  }
  schema.forgeProtectedSlot = data.forgeProtectedSlot;
}

/** Create an empty ItemInstance schema (represents empty slot). */
export function createEmptyItemSchema(): ItemInstance {
  return itemDataToSchema(createEmptyItemInstance());
}
