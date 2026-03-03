// Input sent from client to server each tick
export interface PlayerInput {
  seq: number; // monotonically increasing sequence number for reconciliation
  movement: { x: number; y: number }; // -1 to 1 on each axis
  aimAngle: number; // radians
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
} as const;
export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType];

// 16-biome island map system
export const RealmBiome = {
  Ocean: 0,
  ShallowWater: 1,
  Beach: 2,
  Marsh: 3,
  Desert: 4,
  DryPlains: 5,
  Grassland: 6,
  Forest: 7,
  Jungle: 8,
  Shrubland: 9,
  Taiga: 10,
  DesertCliffs: 11,
  Tundra: 12,
  Scorched: 13,
  Snow: 14,
  Lake: 15,
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
} as const;
export type PlayerZone = (typeof PlayerZone)[keyof typeof PlayerZone];

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
} as const;
export type PortalType = (typeof PortalType)[keyof typeof PortalType];

// Item category (determines which equipment slot it uses)
export const ItemCategory = {
  Weapon: 0,
  Ability: 1,
  Armor: 2,
  Ring: 3,
} as const;
export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

// Weapon subtypes
export const WeaponSubtype = {
  Sword: 0,
  Bow: 1,
} as const;
export type WeaponSubtype = (typeof WeaponSubtype)[keyof typeof WeaponSubtype];

// Ability subtypes
export const AbilitySubtype = {
  Quiver: 0,
} as const;
export type AbilitySubtype =
  (typeof AbilitySubtype)[keyof typeof AbilitySubtype];

// Item tier (1-6)
export const ItemTier = {
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
  T6: 6,
  UT: 7,
} as const;
export type ItemTier = (typeof ItemTier)[keyof typeof ItemTier];

// Projectile visual type (synced to client for rendering)
export const ProjectileType = {
  BowArrow: 0,
  SwordSlash: 1,
  QuiverShot: 2,
  EnemyBullet: 3,
} as const;
export type ProjectileType =
  (typeof ProjectileType)[keyof typeof ProjectileType];

// Loot bag rarity (visual + loot quality)
export const BagRarity = {
  Green: 0,
  Red: 1,
  Black: 2,
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
} as const;
export type ClientMessage = (typeof ClientMessage)[keyof typeof ClientMessage];
