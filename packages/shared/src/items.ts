import { ItemType, ItemRarity, BagRarity, BiomeType } from "./types";

// --- Item Definitions ---

export interface ItemDefinition {
  type: number;
  name: string;
  rarity: number; // ItemRarity
  color: number; // hex display color
}

export const ITEM_DEFS: Record<number, ItemDefinition> = {
  // Common items
  [ItemType.WoodenSword]: { type: ItemType.WoodenSword, name: "Wooden Sword", rarity: ItemRarity.Common, color: 0x8b7355 },
  [ItemType.LeatherShield]: { type: ItemType.LeatherShield, name: "Leather Shield", rarity: ItemRarity.Common, color: 0x9c6b30 },
  [ItemType.HealthPotion]: { type: ItemType.HealthPotion, name: "Health Potion", rarity: ItemRarity.Common, color: 0xcc4444 },
  [ItemType.IronRing]: { type: ItemType.IronRing, name: "Iron Ring", rarity: ItemRarity.Common, color: 0x888888 },
  [ItemType.ClothArmor]: { type: ItemType.ClothArmor, name: "Cloth Armor", rarity: ItemRarity.Common, color: 0x6b6b6b },
  // Uncommon items
  [ItemType.SteelBlade]: { type: ItemType.SteelBlade, name: "Steel Blade", rarity: ItemRarity.Uncommon, color: 0xaabbcc },
  [ItemType.MysticOrb]: { type: ItemType.MysticOrb, name: "Mystic Orb", rarity: ItemRarity.Uncommon, color: 0x7744cc },
  [ItemType.ChainMail]: { type: ItemType.ChainMail, name: "Chain Mail", rarity: ItemRarity.Uncommon, color: 0x778899 },
  [ItemType.EmeraldAmulet]: { type: ItemType.EmeraldAmulet, name: "Emerald Amulet", rarity: ItemRarity.Uncommon, color: 0x44cc66 },
  // Rare items
  [ItemType.FlameStaff]: { type: ItemType.FlameStaff, name: "Flame Staff", rarity: ItemRarity.Rare, color: 0xff6622 },
  [ItemType.ShadowCloak]: { type: ItemType.ShadowCloak, name: "Shadow Cloak", rarity: ItemRarity.Rare, color: 0x332244 },
  [ItemType.DiamondRing]: { type: ItemType.DiamondRing, name: "Diamond Ring", rarity: ItemRarity.Rare, color: 0xaaeeff },
  // Legendary items
  [ItemType.VoidBlade]: { type: ItemType.VoidBlade, name: "Void Blade", rarity: ItemRarity.Legendary, color: 0x6600cc },
  [ItemType.CelestialOrb]: { type: ItemType.CelestialOrb, name: "Celestial Orb", rarity: ItemRarity.Legendary, color: 0xffdd00 },
  [ItemType.DragonArmor]: { type: ItemType.DragonArmor, name: "Dragon Armor", rarity: ItemRarity.Legendary, color: 0xcc2200 },
  [ItemType.GodSlayer]: { type: ItemType.GodSlayer, name: "God Slayer", rarity: ItemRarity.Legendary, color: 0xffffff },
};

// --- Item pools grouped by rarity ---

const COMMON_ITEMS = Object.values(ITEM_DEFS)
  .filter((d) => d.rarity === ItemRarity.Common)
  .map((d) => d.type);

const UNCOMMON_ITEMS = Object.values(ITEM_DEFS)
  .filter((d) => d.rarity === ItemRarity.Uncommon)
  .map((d) => d.type);

const RARE_ITEMS = Object.values(ITEM_DEFS)
  .filter((d) => d.rarity === ItemRarity.Rare)
  .map((d) => d.type);

const LEGENDARY_ITEMS = Object.values(ITEM_DEFS)
  .filter((d) => d.rarity === ItemRarity.Legendary)
  .map((d) => d.type);

// --- Drop chance per biome (roll black first, then red, then green) ---

export const BAG_DROP_CHANCES: Record<
  number,
  { green: number; red: number; black: number }
> = {
  [BiomeType.Shoreline]: { green: 0.15, red: 0.0, black: 0.0 },
  [BiomeType.Meadow]: { green: 0.2, red: 0.03, black: 0.0 },
  [BiomeType.Forest]: { green: 0.15, red: 0.08, black: 0.01 },
  [BiomeType.Hellscape]: { green: 0.1, red: 0.12, black: 0.03 },
  [BiomeType.Godlands]: { green: 0.05, red: 0.1, black: 0.06 },
};

// --- Loot generation ---

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Roll which bag rarity (if any) drops from an enemy in the given biome.
 * Returns -1 if no bag drops.
 */
export function rollBagDrop(biome: number): number {
  const chances = BAG_DROP_CHANCES[biome];
  if (!chances) return -1;

  const roll = Math.random();
  // Check highest tier first
  if (roll < chances.black) return BagRarity.Black;
  if (roll < chances.black + chances.red) return BagRarity.Red;
  if (roll < chances.black + chances.red + chances.green) return BagRarity.Green;
  return -1; // no drop
}

/**
 * Generate item contents for a loot bag of the given rarity.
 * Returns an array of ItemType values (length varies by bag rarity).
 */
export function rollBagLoot(bagRarity: number): number[] {
  switch (bagRarity) {
    case BagRarity.Green: {
      // 1-3 common items
      const count = 1 + Math.floor(Math.random() * 3);
      const items: number[] = [];
      for (let i = 0; i < count; i++) {
        items.push(pickRandom(COMMON_ITEMS));
      }
      return items;
    }
    case BagRarity.Red: {
      // 1-2 items from uncommon + rare pool
      const count = 1 + Math.floor(Math.random() * 2);
      const pool = [...UNCOMMON_ITEMS, ...RARE_ITEMS];
      const items: number[] = [];
      for (let i = 0; i < count; i++) {
        items.push(pickRandom(pool));
      }
      return items;
    }
    case BagRarity.Black: {
      // 1 legendary item
      return [pickRandom(LEGENDARY_ITEMS)];
    }
    default:
      return [];
  }
}
