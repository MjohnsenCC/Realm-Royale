// Input sent from client to server each tick
export interface PlayerInput {
  seq: number; // monotonically increasing sequence number for reconciliation
  movement: { x: number; y: number }; // -1 to 1 on each axis
  aimAngle: number; // radians
  aimX: number; // cursor world X
  aimY: number; // cursor world Y
  shooting: boolean;
  useAbility: boolean; // Space key
  dt: number; // accumulated delta time (ms) the client predicted with
}

export const EnemyType = {
  // --- Dungeon: The Infernal Pit ---
  InfernalHound: 15,
  MagmaSerpent: 16,
  CinderWraith: 17,
  MoltenWyrm: 18, // Boss
  // --- Dungeon: The Void Sanctum ---
  VoidAcolyte: 19,
  ShadowWeaver: 20,
  AbyssalSentry: 21,
  TheArchitect: 22, // Boss
  VoidMinion: 23, // Spawned add
  VoidSwitch: 24, // Destructible switch in Void Sanctum
  // --- Overworld: Shore (Tier 1) ---
  HermitCrab: 30,
  Frog: 31,
  Sandpiper: 32,
  // --- Overworld: Lowlands (Tier 2) ---
  Wolf: 33,
  Rattlesnake: 34,
  BogLurker: 35,
  // --- Overworld: Midlands (Tier 3) ---
  ForestGuardian: 36,
  DustDevil: 37,
  JungleStalker: 38,
  // --- Overworld: Highlands (Tier 4) ---
  FrostWarden: 39,
  CliffDrake: 40,
  StormElemental: 41,
  // --- Overworld: Godlands (Tier 5) ---
  FallenSeraph: 42,
  VoidWalker: 43,
  AncientTitan: 44,
  // --- Overworld: New Enemies ---
  // Shore (Tier 1)
  Jellyfish: 45,
  CoconutCrab: 46,
  // Lowlands (Tier 2)
  SwampToad: 47,
  ThornBush: 48,
  DesertScorpion: 49,
  // Midlands (Tier 3)
  StoneGolem: 50,
  VenomSpitter: 51,
  SandWraith: 52,
  // Highlands (Tier 4)
  IceWraith: 53,
  ThunderHawk: 54,
  MountainTroll: 55,
  // Godlands (Tier 5)
  AbyssalEye: 56,
  ChaosSpawn: 57,
  DoomPriest: 58,
  // --- Overworld: Pack Enemies ---
  // Lowlands Pack (Tier 2)
  BriarBeast: 59, // Pack leader
  BriarImp: 60, // Pack minion
  // Midlands Pack (Tier 3)
  BroodMother: 61, // Pack leader
  Broodling: 62, // Pack minion
  // Highlands Pack (Tier 4)
  FrostMatriarch: 63, // Pack leader
  FrostSprite: 64, // Pack minion

  // ========== REALM TIER 2: THE RUINS ==========
  // Shore (T2)
  RuinCrawler: 70,
  AshScarab: 71,
  DustWraith: 72,
  // Lowlands (T2)
  CursedArcher: 73,
  RuinedGolem: 74,
  BlightedVine: 75,
  // Midlands (T2)
  TombGuard: 76,
  SandPhantom: 77,
  CursedObelisk: 78,
  // Highlands (T2)
  ObsidianSentinel: 79,
  StormCaller: 80,
  AshDrake: 81,
  // Godlands (T2)
  RuinLord: 82,
  VoidHerald: 83,
  ForgottenTitan: 84,
  // T2 Pack: Lowlands
  PlagueBrood: 85, // Pack leader
  PlagueRat: 86, // Pack minion
  // T2 Pack: Midlands
  CursedMatron: 87, // Pack leader
  CursedSpawn: 88, // Pack minion
  // T2 Pack: Highlands
  AshMatriarch: 89, // Pack leader
  AshSprite: 90, // Pack minion

  // ========== REALM TIER 3: DEVINE HELL ==========
  // Shore (T3)
  HellCrab: 100,
  MagmaSlug: 101,
  EmberWisp: 102,
  // Lowlands (T3)
  DemonHound: 103,
  HellfireImp: 104,
  BrimstoneGolem: 105,
  // Midlands (T3)
  InfernalKnight: 106,
  LavaWyrm: 107,
  SoulReaper: 108,
  // Highlands (T3)
  AbyssalLord: 109,
  HellfireDrake: 110,
  DoomSentinel: 111,
  // Godlands (T3)
  ArchDemon: 112,
  VoidEmperor: 113,
  WorldEnder: 114,
  // T3 Pack: Lowlands
  DemonBroodmother: 115, // Pack leader
  DemonWhelp: 116, // Pack minion
  // T3 Pack: Midlands
  SoulHarvester: 117, // Pack leader
  LostSoul: 118, // Pack minion
  // T3 Pack: Highlands
  DoomMatriarch: 119, // Pack leader
  DoomSprite: 120, // Pack minion
} as const;
export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType];

// 45-biome system — 15 unique biomes per realm tier, no sharing
export const RealmBiome = {
  // ===== TIER 1: THE WILD (natural/lush) =====
  WildOcean: 0,       // water — deep ocean
  WildShallows: 1,    // water — coastal/lake
  WildShore: 2,       // shore — sandy beach
  WildMeadow: 3,      // lowlands — green meadow
  WildMarsh: 4,       // lowlands — murky swamp
  WildPlains: 5,      // lowlands — dry grass
  WildForest: 6,      // midlands — dense forest
  WildJungle: 7,      // midlands — thick tropical
  WildDesert: 8,      // midlands — sandy dunes
  WildTaiga: 9,       // highlands — cold conifers
  WildCliffs: 10,     // highlands — rocky cliffs
  WildShrubland: 11,  // highlands — sparse bushes
  WildTundra: 12,     // godlands — frozen barren
  WildPeaks: 13,      // godlands — snowy peaks
  WildVolcanic: 14,   // godlands — charred earth

  // ===== TIER 2: THE RUINS (decayed/ancient) =====
  RuinsOcean: 15,      // water — dark murky sea
  RuinsShallows: 16,   // water — stagnant water
  RuinsShore: 17,      // shore — ashen sand
  RuinsDustlands: 18,  // lowlands — dusty wastes
  RuinsBog: 19,        // lowlands — decayed swamp
  RuinsBarrens: 20,    // lowlands — cracked earth
  RuinsCatacombs: 21,  // midlands — ancient stone
  RuinsWasteland: 22,  // midlands — desolate waste
  RuinsDesolation: 23, // midlands — gray ruins
  RuinsObsidian: 24,   // highlands — dark glass stone
  RuinsFrostfall: 25,  // highlands — frozen decay
  RuinsAshlands: 26,   // highlands — ash-covered
  RuinsShadowlands: 27, // godlands — deep shadow
  RuinsDarkSpire: 28,  // godlands — dark purple
  RuinsVoidEdge: 29,   // godlands — void-tinged

  // ===== TIER 3: DEVINE HELL (hellish/demonic) =====
  HellOcean: 30,       // water — blood sea
  HellLava: 31,        // water — molten lava
  HellScorch: 32,      // shore — scorched coast
  HellBrimstone: 33,   // lowlands — sulfur ground
  HellCinder: 34,      // lowlands — burning cinders
  HellEmberfield: 35,  // lowlands — glowing embers
  HellInferno: 36,     // midlands — active fire
  HellDemonforge: 37,  // midlands — dark forge
  HellBloodmire: 38,   // midlands — blood pools
  HellAbyssal: 39,     // highlands — deep abyss
  HellDoomspire: 40,   // highlands — black rock
  HellSoulfire: 41,    // highlands — soul flames
  HellVoidmaw: 42,     // godlands — pure void
  HellChaosrift: 43,   // godlands — chaos energy
  HellAnnihilation: 44, // godlands — total destruction
} as const;
export type RealmBiome = (typeof RealmBiome)[keyof typeof RealmBiome];

// Elevation-based difficulty progression (coast -> mountain peak)
export const DifficultyZone = {
  Shore: 0, // elevation 0.00 - 0.15
  Lowlands: 1, // elevation 0.15 - 0.35
  Midlands: 2, // elevation 0.35 - 0.55
  Highlands: 3, // elevation 0.55 - 0.75
  Godlands: 4, // elevation 0.75 - 1.00
} as const;
export type DifficultyZone = (typeof DifficultyZone)[keyof typeof DifficultyZone];

// Map decoration types
export const DecorationType = {
  TreePalm: 0,
  TreeOak: 1,
  TreePine: 2,
  TreeDead: 3,
  RockSmall: 4,
  RockLarge: 5,
  Bush: 6,
  Cactus: 7,
  Flower: 8,
  Mushroom: 9,
  Bones: 10,
  Ruins: 11,
  Grass1: 12,
  Grass2: 13,
  Grass3: 14,
  Grass4: 15,
  Flowers1: 16,
  Flowers2: 17,
  Flowers3: 18,
} as const;
export type DecorationType =
  (typeof DecorationType)[keyof typeof DecorationType];

export const EnemyAIState = {
  Idle: 0,
  Aggro: 1,
  Returning: 2,
  Sleeping: 3,
} as const;
export type EnemyAIState = (typeof EnemyAIState)[keyof typeof EnemyAIState];

export const ShootingPatternType = {
  SingleAimed: 0,
  Spread3: 1,
  Spread5: 2,
  BurstRing4: 3,
  BurstRing8: 4,
  BurstRing12: 5,
  BurstRing16: 6,
  Spiral3: 7,
  Spiral5: 8,
  Spiral8: 9,
  DoubleSingle: 10,
  CounterSpiralDouble: 11,
  MultiSpeedRing: 12,
  RotatingCross: 13,
} as const;
export type ShootingPatternType =
  (typeof ShootingPatternType)[keyof typeof ShootingPatternType];

// Enemy movement AI patterns (realm overworld)
export const MovementPatternType = {
  WanderingSprayer: 0, // Slow drift, face player on aggro, chase
  RingPulser: 1, // Stationary, emits 360-degree rings
  Orbiter: 2, // Circles a point at ~3-tile radius
  ChargerRetreater: 3, // Rush 1.5s, fire fan, retreat
  SpiralSpinner: 4, // Near-stationary turret, continuous spiral
  Shotgunner: 5, // Maintains 5-6 tile range, kites
  BurstMage: 6, // Teleports every 3-4s, fires burst after blink
} as const;
export type MovementPatternType =
  (typeof MovementPatternType)[keyof typeof MovementPatternType];

// Idle movement intensity tiers (realm overworld)
export const IdleIntensity = {
  Low: 0, // 30% speed, 30-80px range, 1-3s pause (default)
  Medium: 1, // 50% speed, 50-120px range, 0.5-1.5s pause
  High: 2, // 70% speed, 80-160px range, 0.3-0.8s pause
} as const;
export type IdleIntensity = (typeof IdleIntensity)[keyof typeof IdleIntensity];

export const EntityType = {
  Player: 0,
  Enemy: 1,
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const PlayerZone = {
  Nexus: "nexus",
  Hostile: "hostile",
  DungeonInfernal: "dungeon_infernal",
  DungeonVoid: "dungeon_void",
  Vault: "vault",
} as const;
export type PlayerZone = (typeof PlayerZone)[keyof typeof PlayerZone];

// Zone instance helpers — zones use "base:instanceId" format
// e.g. "hostile:1", "dungeon_infernal:dportal_abc"
export function getZoneBase(zone: string): string {
  const i = zone.indexOf(":");
  return i === -1 ? zone : zone.substring(0, i);
}

export function getZoneInstance(zone: string): string {
  const i = zone.indexOf(":");
  return i === -1 ? "" : zone.substring(i + 1);
}

export function isHostileZone(zone: string): boolean {
  return getZoneBase(zone) === "hostile";
}

export function isVaultZone(zone: string): boolean {
  return getZoneBase(zone) === "vault";
}

// Realm tiers — each hostile zone maps to a tier
export const RealmTier = {
  Wild: 1,
  Ruins: 2,
  DevineHell: 3,
} as const;
export type RealmTier = (typeof RealmTier)[keyof typeof RealmTier];

export const REALM_TIER_CONFIG: Record<number, { name: string; requiredLevel: number; color: string }> = {
  [RealmTier.Wild]: { name: "The Wild", requiredLevel: 1, color: "#aa66ff" },
  [RealmTier.Ruins]: { name: "The Ruins", requiredLevel: 35, color: "#cc8844" },
  [RealmTier.DevineHell]: { name: "Devine Hell", requiredLevel: 70, color: "#ff2244" },
};

/** Extract realm tier from a hostile zone string. e.g. "hostile:2" -> 2 */
export function getRealmTierFromZone(zone: string): number {
  if (!isHostileZone(zone)) return RealmTier.Wild;
  const instance = getZoneInstance(zone);
  const tier = Number(instance);
  if (tier >= RealmTier.Wild && tier <= RealmTier.DevineHell) return tier;
  return RealmTier.Wild;
}

/** Convert a zone string to a human-readable display name. */
export function getZoneDisplayName(zone: string): string {
  if (!zone) return "Unknown";
  const base = getZoneBase(zone);
  if (base === PlayerZone.Nexus) return "Nexus";
  if (base === PlayerZone.Vault) return "Vault";
  if (base === PlayerZone.Hostile) {
    const tier = getRealmTierFromZone(zone);
    return REALM_TIER_CONFIG[tier]?.name ?? "The Wild";
  }
  if (base === PlayerZone.DungeonInfernal) return "The Infernal Pit";
  if (base === PlayerZone.DungeonVoid) return "The Void Sanctum";
  return "Unknown";
}

export const DungeonType = {
  InfernalPit: 0,
  VoidSanctum: 1,
} as const;
export type DungeonType = (typeof DungeonType)[keyof typeof DungeonType];

export const PortalType = {
  NexusToHostile: 0,
  InfernalPitEntrance: 1,
  VoidSanctumEntrance: 2,
  DungeonExit: 3,
  NexusToVault: 4,
} as const;
export type PortalType = (typeof PortalType)[keyof typeof PortalType];

// Item category (determines which equipment slot it uses)
export const ItemCategory = {
  Weapon: 0,
  Ability: 1,
  Armor: 2,
  Ring: 3,
  Consumable: 4,
  CraftingOrb: 5,
} as const;
export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

// Stat types for the item instance system
export const StatType = {
  AttackDamage: 0,
  AttackSpeed: 1,
  Health: 2,
  HealthRegen: 3,
  ManaRegen: 4,
  MovementSpeed: 5,
  Mana: 6,
  PhysicalDamageReduction: 7,
  MagicDamageReduction: 8,
  AbilityDamage: 9,
  ReducedAbilityCooldown: 10,
  IncreasedProjectileSpeed: 11,
  CriticalStrikeChance: 12,
  CriticalStrikeMultiplier: 13,
} as const;
export type StatType = (typeof StatType)[keyof typeof StatType];

// Crafting orb types
export const CraftingOrbType = {
  Blank: 0,
  Ember: 1,
  Shard: 2,
  Chaos: 3,
  Flux: 4,
  Void: 5,
  Prism: 6,
  Forge: 7,
  Calibrate: 8,
  Divine: 9,
} as const;
export type CraftingOrbType = (typeof CraftingOrbType)[keyof typeof CraftingOrbType];

// Weapon subtypes
export const WeaponSubtype = {
  Sword: 0,
  Bow: 1,
  Wand: 2,
} as const;
export type WeaponSubtype = (typeof WeaponSubtype)[keyof typeof WeaponSubtype];

// Ability subtypes
export const AbilitySubtype = {
  Quiver: 0,
  Helm: 1,
  Relic: 2,
} as const;
export type AbilitySubtype =
  (typeof AbilitySubtype)[keyof typeof AbilitySubtype];

// Armor subtypes
export const ArmorSubtype = {
  Heavy: 0,
  Light: 1,
  Mantle: 2,
} as const;
export type ArmorSubtype = (typeof ArmorSubtype)[keyof typeof ArmorSubtype];

// Consumable subtypes
export const ConsumableSubtype = {
  PortalGem: 2,
} as const;
export type ConsumableSubtype =
  (typeof ConsumableSubtype)[keyof typeof ConsumableSubtype];

// Item tier (1-12, 13=UT)
export const ItemTier = {
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
  T6: 6,
  T7: 7,
  T8: 8,
  T9: 9,
  T10: 10,
  T11: 11,
  T12: 12,
  UT: 13,
} as const;
export type ItemTier = (typeof ItemTier)[keyof typeof ItemTier];

// Projectile visual type (synced to client for rendering)
export const ProjectileType = {
  BowArrow: 0,
  SwordSlash: 1,
  QuiverShot: 2,
  EnemyBullet: 3,
  HelmSpin: 4,
  WandBolt: 5,
  RelicExpand: 6,
} as const;
export type ProjectileType =
  (typeof ProjectileType)[keyof typeof ProjectileType];

// Damage types for projectiles
export const DamageType = {
  Physical: 0,
  Magic: 1,
} as const;
export type DamageType = (typeof DamageType)[keyof typeof DamageType];

// Loot bag rarity (visual + loot quality)
export const BagRarity = {
  Green: 0,
  Red: 1,
  Black: 2,
  Orange: 3,
} as const;
export type BagRarity = (typeof BagRarity)[keyof typeof BagRarity];

export const ServerMessage = {
  PlayerDied: "playerDied",
  ZoneChanged: "zoneChanged",
  BagOpened: "bagOpened",
  BagClosed: "bagClosed",
  BagUpdated: "bagUpdated",
  PortalPrompt: "portalPrompt",
  SwitchDestroyed: "switchDestroyed",
  BossAwakened: "bossAwakened",
  VaultOpened: "vaultOpened",
  VaultClosed: "vaultClosed",
  VaultUpdated: "vaultUpdated",
  VaultPortalCreated: "vaultPortalCreated",
  VaultPortalClosed: "vaultPortalClosed",
  CraftingOpened: "craftingOpened",
  CraftingOrbsUpdated: "craftingOrbsUpdated",
  ChatMessage: "chatMessage",
  Pong: "pong",
  FriendsList: "friendsList",
  FriendAdded: "friendAdded",
  FriendRemoved: "friendRemoved",
  FriendRequestReceived: "friendRequestReceived",
  FriendRequestAccepted: "friendRequestAccepted",
  FriendRequestDeclined: "friendRequestDeclined",
  FriendRequestCancelled: "friendRequestCancelled",
  FriendRequestsList: "friendRequestsList",
  FriendStatusUpdate: "friendStatusUpdate",
  TradeRequested: "tradeRequested",
  TradeStarted: "tradeStarted",
  TradeDeclined: "tradeDeclined",
  TradeCancelled: "tradeCancelled",
  TradePartnerUpdate: "tradePartnerUpdate",
  TradeCompleted: "tradeCompleted",
  BlockList: "blockList",
} as const;
export type ServerMessage = (typeof ServerMessage)[keyof typeof ServerMessage];

export const ClientMessage = {
  Input: "input",
  ReturnToNexus: "returnToNexus",
  Respawn: "respawn",
  PickupItem: "pickupItem",
  DropItem: "dropItem",
  EquipItem: "equipItem",
  UseAbility: "useAbility",
  InteractPortal: "interactPortal",
  ZoneReady: "zoneReady",
  UsePortalGem: "usePortalGem",
  UseCraftingOrb: "useCraftingOrb",
  ToggleUnlimitedOrbs: "toggleUnlimitedOrbs",
  SwapInventory: "swapInventory",
  UnequipItem: "unequipItem",
  OpenVault: "openVault",
  VaultMoveItem: "vaultMoveItem",
  UsePortalGemVault: "usePortalGemVault",
  StackConsumables: "stackConsumables",
  OpenCraftingTable: "openCraftingTable",
  ChatMessage: "chatMessage",
  Ping: "ping",
  AddFriend: "addFriend",
  RemoveFriend: "removeFriend",
  GetFriendsList: "getFriendsList",
  AcceptFriendRequest: "acceptFriendRequest",
  DeclineFriendRequest: "declineFriendRequest",
  CancelFriendRequest: "cancelFriendRequest",
  GetFriendRequests: "getFriendRequests",
  RefreshAccountName: "refreshAccountName",
  TeleportToPlayer: "teleportToPlayer",
  TradeRequest: "tradeRequest",
  TradeAccept: "tradeAccept",
  TradeDecline: "tradeDecline",
  TradeSelectSlot: "tradeSelectSlot",
  TradeDeselectSlot: "tradeDeselectSlot",
  TradeConfirm: "tradeConfirm",
  TradeUnconfirm: "tradeUnconfirm",
  TradeExit: "tradeExit",
  GetBlockList: "getBlockList",
} as const;
export type ClientMessage = (typeof ClientMessage)[keyof typeof ClientMessage];

export type ChatChannel = "global" | "local" | "dm";

// --- Character Classes ---

export const CharacterClass = {
  Archer: 0,
  Warrior: 1,
  Arcanist: 2,
} as const;
export type CharacterClass =
  (typeof CharacterClass)[keyof typeof CharacterClass];

export const CLASS_NAMES: Record<number, string> = {
  [CharacterClass.Archer]: "Archer",
  [CharacterClass.Warrior]: "Warrior",
  [CharacterClass.Arcanist]: "Arcanist",
};

/** Maps each class to its allowed weapon/ability/armor subtypes. Rings are universal. */
export const CLASS_EQUIPMENT_MAP: Record<
  number,
  { weapon: number; ability: number; armor: number }
> = {
  [CharacterClass.Archer]: {
    weapon: WeaponSubtype.Bow,
    ability: AbilitySubtype.Quiver,
    armor: ArmorSubtype.Light,
  },
  [CharacterClass.Warrior]: {
    weapon: WeaponSubtype.Sword,
    ability: AbilitySubtype.Helm,
    armor: ArmorSubtype.Heavy,
  },
  [CharacterClass.Arcanist]: {
    weapon: WeaponSubtype.Wand,
    ability: AbilitySubtype.Relic,
    armor: ArmorSubtype.Mantle,
  },
};

/** Check if a class can equip an item. Rings are universal. */
export function canClassEquip(
  characterClass: number,
  itemCategory: number,
  itemSubtype: number
): boolean {
  if (itemCategory === ItemCategory.Ring) return true;
  const mapping = CLASS_EQUIPMENT_MAP[characterClass];
  if (!mapping) return false;
  if (itemCategory === ItemCategory.Weapon)
    return itemSubtype === mapping.weapon;
  if (itemCategory === ItemCategory.Ability)
    return itemSubtype === mapping.ability;
  if (itemCategory === ItemCategory.Armor)
    return itemSubtype === mapping.armor;
  return false;
}

/** Returns display names of classes that can equip an item with the given category/subtype. */
export function getEquippableClassNames(
  category: number,
  subtype: number
): string[] {
  if (category === ItemCategory.Ring) return ["All Classes"];
  if (
    category === ItemCategory.Consumable ||
    category === ItemCategory.CraftingOrb
  )
    return [];
  const names: string[] = [];
  for (const [classId, mapping] of Object.entries(CLASS_EQUIPMENT_MAP)) {
    if (
      (category === ItemCategory.Weapon && subtype === mapping.weapon) ||
      (category === ItemCategory.Ability && subtype === mapping.ability) ||
      (category === ItemCategory.Armor && subtype === mapping.armor)
    ) {
      names.push(CLASS_NAMES[Number(classId)] ?? "???");
    }
  }
  return names;
}
