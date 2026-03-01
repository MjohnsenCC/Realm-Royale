// Input sent from client to server each tick
export interface PlayerInput {
  seq: number; // monotonically increasing sequence number for reconciliation
  movement: { x: number; y: number }; // -1 to 1 on each axis
  aimAngle: number; // radians
  shooting: boolean;
  useAbility: boolean; // Space key
  dt: number; // accumulated delta time (ms) the client predicted with
}

// 15 enemy types across 5 biomes
export const EnemyType = {
  // Shoreline (Tier 1)
  Crab: 0,
  Jellyfish: 1,
  Sandworm: 2,
  // Meadow (Tier 2)
  Goblin: 3,
  Wasp: 4,
  Mushroom: 5,
  // Forest (Tier 3)
  Treant: 6,
  DarkElf: 7,
  Spider: 8,
  // Hellscape (Tier 4)
  Imp: 9,
  FireElemental: 10,
  LavaGolem: 11,
  // Godlands (Tier 5)
  FallenGod: 12,
  VoidWraith: 13,
  Leviathan: 14,
} as const;
export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType];

export const BiomeType = {
  Shoreline: 0,
  Meadow: 1,
  Forest: 2,
  Hellscape: 3,
  Godlands: 4,
} as const;
export type BiomeType = (typeof BiomeType)[keyof typeof BiomeType];

export const EnemyAIState = {
  Idle: 0,
  Aggro: 1,
  Returning: 2,
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
} as const;
export type ShootingPatternType =
  (typeof ShootingPatternType)[keyof typeof ShootingPatternType];

export const EntityType = {
  Player: 0,
  Enemy: 1,
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const PlayerZone = {
  Nexus: "nexus",
  Hostile: "hostile",
} as const;
export type PlayerZone = (typeof PlayerZone)[keyof typeof PlayerZone];

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
} as const;
export type ClientMessage = (typeof ClientMessage)[keyof typeof ClientMessage];
