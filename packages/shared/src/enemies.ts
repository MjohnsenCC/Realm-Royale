import {
  EnemyType,
  DungeonType,
  PlayerZone,
  ShootingPatternType,
  MovementPatternType,
  IdleIntensity,
  RealmBiome,
  DifficultyZone,
} from "./types";

// --- Enemy Definition ---

export type EnemyShape =
  | "circle"
  | "diamond"
  | "triangle"
  | "square"
  | "hexagon"
  | "star";

export interface EnemyDefinition {
  type: number;
  biome: number;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  aggroRange: number;
  leashRange: number;
  shootCooldown: number; // ms
  projectileDamage: number;
  projectileSpeed: number;
  projectileRange: number;
  shootingPattern: number;
  xpValue: number;
  shape: EnemyShape;
  color: number;
  projectileCollisionRadius?: number;
  difficultyZone?: number; // DifficultyZone value (realm overworld only)
  biomeAffinity?: number[]; // RealmBiome values this enemy prefers
  movementPattern?: number; // MovementPatternType value (realm overworld only)
  idleIntensity?: number; // IdleIntensity value (0=low, 1=medium, 2=high)
  dungeonDrop?: number; // DungeonType value — this enemy drops a portal for this dungeon
}

// --- Pack (cluster) enemy definitions ---

export interface PackDefinition {
  leaderType: number;
  minionType: number;
  minionCount: number;
  respawnCooldown: number; // ms — how often leader respawns dead minions
}

export const PACK_DEFS: Record<number, PackDefinition> = {
  [EnemyType.BriarBeast]: {
    leaderType: EnemyType.BriarBeast,
    minionType: EnemyType.BriarImp,
    minionCount: 3,
    respawnCooldown: 8000,
  },
  [EnemyType.BroodMother]: {
    leaderType: EnemyType.BroodMother,
    minionType: EnemyType.Broodling,
    minionCount: 4,
    respawnCooldown: 6000,
  },
  [EnemyType.FrostMatriarch]: {
    leaderType: EnemyType.FrostMatriarch,
    minionType: EnemyType.FrostSprite,
    minionCount: 3,
    respawnCooldown: 10000,
  },
};

export function isPackLeader(type: number): boolean {
  return type in PACK_DEFS;
}

export function getPackDef(type: number): PackDefinition | undefined {
  return PACK_DEFS[type];
}

// --- All Enemy Definitions (populated by realm + dungeon defs below) ---

export const ENEMY_DEFS: Record<number, EnemyDefinition> = {};

// ===== NEW REALM OVERWORLD ENEMIES (15 enemies, 3 per difficulty tier) =====

export const REALM_ENEMY_DEFS: Record<number, EnemyDefinition> = {
  // ===== SHORE - Tier 1 (DifficultyZone.Shore) =====
  [EnemyType.HermitCrab]: {
    type: EnemyType.HermitCrab,
    biome: 0, // not used for realm enemies
    name: "Hermit Crab",
    hp: 35,
    speed: 35,
    radius: 14,
    aggroRange: 180,
    leashRange: 350,
    shootCooldown: 2200,
    projectileDamage: 8,
    projectileSpeed: 120,
    projectileRange: 300,
    shootingPattern: ShootingPatternType.SingleAimed,
    movementPattern: MovementPatternType.WanderingSprayer,
    xpValue: 5,
    shape: "circle",
    color: 0xcc8866,
    difficultyZone: DifficultyZone.Shore,
    biomeAffinity: [RealmBiome.Beach, RealmBiome.DryPlains],
  },
  [EnemyType.Frog]: {
    type: EnemyType.Frog,
    biome: 0,
    name: "Frog",
    hp: 25,
    speed: 55,
    radius: 11,
    aggroRange: 200,
    leashRange: 320,
    shootCooldown: 2500,
    projectileDamage: 6,
    projectileSpeed: 120,
    projectileRange: 280,
    shootingPattern: ShootingPatternType.Spread3,
    movementPattern: MovementPatternType.Shotgunner,
    xpValue: 5,
    shape: "diamond",
    color: 0x44aa44,
    difficultyZone: DifficultyZone.Shore,
    biomeAffinity: [RealmBiome.Marsh, RealmBiome.Grassland],
  },
  [EnemyType.Sandpiper]: {
    type: EnemyType.Sandpiper,
    biome: 0,
    name: "Sandpiper",
    hp: 20,
    speed: 70,
    radius: 10,
    aggroRange: 220,
    leashRange: 380,
    shootCooldown: 1800,
    projectileDamage: 5,
    projectileSpeed: 120,
    projectileRange: 320,
    shootingPattern: ShootingPatternType.SingleAimed,
    movementPattern: MovementPatternType.WanderingSprayer,
    idleIntensity: IdleIntensity.High,
    xpValue: 4,
    shape: "triangle",
    color: 0xccaa88,
    difficultyZone: DifficultyZone.Shore,
    biomeAffinity: [RealmBiome.Beach, RealmBiome.Marsh, RealmBiome.DryPlains],
  },

  // ===== LOWLANDS - Tier 2 (DifficultyZone.Lowlands) =====
  [EnemyType.Wolf]: {
    type: EnemyType.Wolf,
    biome: 0,
    name: "Wolf",
    hp: 60,
    speed: 80,
    radius: 14,
    aggroRange: 280,
    leashRange: 480,
    shootCooldown: 1400,
    projectileDamage: 12,
    projectileSpeed: 120,
    projectileRange: 380,
    shootingPattern: ShootingPatternType.SingleAimed,
    movementPattern: MovementPatternType.WanderingSprayer,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 12,
    shape: "triangle",
    color: 0x888888,
    difficultyZone: DifficultyZone.Lowlands,
    biomeAffinity: [RealmBiome.Grassland, RealmBiome.Forest],
  },
  [EnemyType.Rattlesnake]: {
    type: EnemyType.Rattlesnake,
    biome: 0,
    name: "Rattlesnake",
    hp: 45,
    speed: 60,
    radius: 12,
    aggroRange: 250,
    leashRange: 420,
    shootCooldown: 1200,
    projectileDamage: 14,
    projectileSpeed: 120,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.Spread3,
    movementPattern: MovementPatternType.ChargerRetreater,
    xpValue: 10,
    shape: "diamond",
    color: 0xaa8844,
    difficultyZone: DifficultyZone.Lowlands,
    biomeAffinity: [RealmBiome.Desert, RealmBiome.DryPlains, RealmBiome.Shrubland],
  },
  [EnemyType.BogLurker]: {
    type: EnemyType.BogLurker,
    biome: 0,
    name: "Bog Lurker",
    hp: 90,
    speed: 30,
    radius: 16,
    aggroRange: 220,
    leashRange: 380,
    shootCooldown: 2000,
    projectileDamage: 10,
    projectileSpeed: 120,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.BurstRing4,
    movementPattern: MovementPatternType.RingPulser,
    xpValue: 15,
    shape: "hexagon",
    color: 0x446644,
    difficultyZone: DifficultyZone.Lowlands,
    biomeAffinity: [RealmBiome.Marsh, RealmBiome.Jungle],
  },

  // ===== MIDLANDS - Tier 3 (DifficultyZone.Midlands) =====
  [EnemyType.ForestGuardian]: {
    type: EnemyType.ForestGuardian,
    biome: 0,
    name: "Forest Guardian",
    hp: 160,
    speed: 30,
    radius: 20,
    aggroRange: 250,
    leashRange: 420,
    shootCooldown: 1600,
    projectileDamage: 16,
    projectileSpeed: 120,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spread5,
    movementPattern: MovementPatternType.SpiralSpinner,
    xpValue: 28,
    shape: "square",
    color: 0x2a6a2a,
    difficultyZone: DifficultyZone.Midlands,
    biomeAffinity: [RealmBiome.Forest, RealmBiome.Taiga],
  },
  [EnemyType.DustDevil]: {
    type: EnemyType.DustDevil,
    biome: 0,
    name: "Dust Devil",
    hp: 90,
    speed: 90,
    radius: 14,
    aggroRange: 300,
    leashRange: 500,
    shootCooldown: 1000,
    projectileDamage: 14,
    projectileSpeed: 120,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.Spiral3,
    movementPattern: MovementPatternType.SpiralSpinner,
    idleIntensity: IdleIntensity.High,
    xpValue: 22,
    shape: "diamond",
    color: 0xccaa66,
    difficultyZone: DifficultyZone.Midlands,
    biomeAffinity: [RealmBiome.Desert, RealmBiome.Shrubland, RealmBiome.DesertCliffs],
  },
  [EnemyType.JungleStalker]: {
    type: EnemyType.JungleStalker,
    biome: 0,
    name: "Jungle Stalker",
    hp: 100,
    speed: 75,
    radius: 14,
    aggroRange: 320,
    leashRange: 520,
    shootCooldown: 900,
    projectileDamage: 13,
    projectileSpeed: 120,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.DoubleSingle,
    movementPattern: MovementPatternType.BurstMage,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 25,
    shape: "triangle",
    color: 0x226622,
    difficultyZone: DifficultyZone.Midlands,
    biomeAffinity: [RealmBiome.Jungle, RealmBiome.Forest],
  },

  // ===== HIGHLANDS - Tier 4 (DifficultyZone.Highlands) =====
  [EnemyType.FrostWarden]: {
    type: EnemyType.FrostWarden,
    biome: 0,
    name: "Frost Warden",
    hp: 130,
    speed: 55,
    radius: 18,
    aggroRange: 300,
    leashRange: 500,
    shootCooldown: 1200,
    projectileDamage: 18,
    projectileSpeed: 120,
    projectileRange: 440,
    shootingPattern: ShootingPatternType.BurstRing8,
    movementPattern: MovementPatternType.BurstMage,
    xpValue: 40,
    shape: "star",
    color: 0x88bbdd,
    difficultyZone: DifficultyZone.Highlands,
    biomeAffinity: [RealmBiome.Snow, RealmBiome.Tundra],
  },
  [EnemyType.CliffDrake]: {
    type: EnemyType.CliffDrake,
    biome: 0,
    name: "Cliff Drake",
    hp: 80,
    speed: 100,
    radius: 14,
    aggroRange: 340,
    leashRange: 580,
    shootCooldown: 700,
    projectileDamage: 16,
    projectileSpeed: 120,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spread3,
    movementPattern: MovementPatternType.Orbiter,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 35,
    shape: "triangle",
    color: 0x886644,
    difficultyZone: DifficultyZone.Highlands,
    biomeAffinity: [RealmBiome.DesertCliffs, RealmBiome.Scorched, RealmBiome.Taiga],
  },
  [EnemyType.StormElemental]: {
    type: EnemyType.StormElemental,
    biome: 0,
    name: "Storm Elemental",
    hp: 200,
    speed: 40,
    radius: 20,
    aggroRange: 280,
    leashRange: 460,
    shootCooldown: 1400,
    projectileDamage: 22,
    projectileSpeed: 120,
    projectileRange: 450,
    shootingPattern: ShootingPatternType.BurstRing12,
    movementPattern: MovementPatternType.Orbiter,
    xpValue: 50,
    shape: "hexagon",
    color: 0x6688cc,
    difficultyZone: DifficultyZone.Highlands,
    biomeAffinity: [RealmBiome.Tundra, RealmBiome.Snow, RealmBiome.DesertCliffs],
  },

  // ===== GODLANDS - Tier 5 (DifficultyZone.Godlands) =====
  [EnemyType.FallenSeraph]: {
    type: EnemyType.FallenSeraph,
    biome: 0,
    name: "Fallen Seraph",
    hp: 220,
    speed: 65,
    radius: 20,
    aggroRange: 400,
    leashRange: 640,
    shootCooldown: 1100,
    projectileDamage: 30,
    projectileSpeed: 120,
    projectileRange: 500,
    shootingPattern: ShootingPatternType.BurstRing8,
    movementPattern: MovementPatternType.Shotgunner,
    xpValue: 85,
    shape: "star",
    color: 0xffcc44,
    difficultyZone: DifficultyZone.Godlands,
    biomeAffinity: [RealmBiome.Snow, RealmBiome.Scorched],
  },
  [EnemyType.VoidWalker]: {
    type: EnemyType.VoidWalker,
    biome: 0,
    name: "Void Walker",
    hp: 140,
    speed: 95,
    radius: 14,
    aggroRange: 360,
    leashRange: 580,
    shootCooldown: 450,
    projectileDamage: 22,
    projectileSpeed: 120,
    projectileRange: 460,
    shootingPattern: ShootingPatternType.Spread5,
    movementPattern: MovementPatternType.BurstMage,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 75,
    shape: "diamond",
    color: 0x9922cc,
    difficultyZone: DifficultyZone.Godlands,
    biomeAffinity: [RealmBiome.Tundra, RealmBiome.Scorched, RealmBiome.DesertCliffs],
  },
  [EnemyType.AncientTitan]: {
    type: EnemyType.AncientTitan,
    biome: 0,
    name: "Ancient Titan",
    hp: 320,
    speed: 30,
    radius: 24,
    aggroRange: 320,
    leashRange: 520,
    shootCooldown: 900,
    projectileDamage: 32,
    projectileSpeed: 120,
    projectileRange: 500,
    shootingPattern: ShootingPatternType.Spiral8,
    movementPattern: MovementPatternType.RingPulser,
    xpValue: 110,
    shape: "square",
    color: 0x442266,
    difficultyZone: DifficultyZone.Godlands,
    biomeAffinity: [RealmBiome.Snow, RealmBiome.Tundra, RealmBiome.Scorched],
    dungeonDrop: DungeonType.InfernalPit,
  },

  // ===== SHORE - Tier 1 (NEW) =====
  [EnemyType.Jellyfish]: {
    type: EnemyType.Jellyfish,
    biome: 0,
    name: "Jellyfish",
    hp: 30,
    speed: 25,
    radius: 12,
    aggroRange: 200,
    leashRange: 340,
    shootCooldown: 2000,
    projectileDamage: 7,
    projectileSpeed: 120,
    projectileRange: 300,
    shootingPattern: ShootingPatternType.BurstRing4,
    movementPattern: MovementPatternType.RingPulser,
    xpValue: 6,
    shape: "circle",
    color: 0x88bbff,
    difficultyZone: DifficultyZone.Shore,
    biomeAffinity: [RealmBiome.Beach, RealmBiome.Marsh],
  },
  [EnemyType.CoconutCrab]: {
    type: EnemyType.CoconutCrab,
    biome: 0,
    name: "Coconut Crab",
    hp: 40,
    speed: 60,
    radius: 14,
    aggroRange: 190,
    leashRange: 360,
    shootCooldown: 1800,
    projectileDamage: 9,
    projectileSpeed: 120,
    projectileRange: 280,
    shootingPattern: ShootingPatternType.Spread3,
    movementPattern: MovementPatternType.ChargerRetreater,
    xpValue: 7,
    shape: "square",
    color: 0xbb6633,
    difficultyZone: DifficultyZone.Shore,
    biomeAffinity: [RealmBiome.Beach, RealmBiome.DryPlains],
  },

  // ===== LOWLANDS - Tier 2 (NEW) =====
  [EnemyType.SwampToad]: {
    type: EnemyType.SwampToad,
    biome: 0,
    name: "Swamp Toad",
    hp: 55,
    speed: 50,
    radius: 13,
    aggroRange: 240,
    leashRange: 420,
    shootCooldown: 1600,
    projectileDamage: 10,
    projectileSpeed: 120,
    projectileRange: 340,
    shootingPattern: ShootingPatternType.SingleAimed,
    movementPattern: MovementPatternType.Orbiter,
    xpValue: 11,
    shape: "circle",
    color: 0x558833,
    difficultyZone: DifficultyZone.Lowlands,
    biomeAffinity: [RealmBiome.Marsh, RealmBiome.Jungle, RealmBiome.Grassland],
  },
  [EnemyType.ThornBush]: {
    type: EnemyType.ThornBush,
    biome: 0,
    name: "Thorn Bush",
    hp: 70,
    speed: 20,
    radius: 16,
    aggroRange: 220,
    leashRange: 380,
    shootCooldown: 800,
    projectileDamage: 8,
    projectileSpeed: 120,
    projectileRange: 320,
    shootingPattern: ShootingPatternType.Spiral3,
    movementPattern: MovementPatternType.SpiralSpinner,
    xpValue: 13,
    shape: "hexagon",
    color: 0x336622,
    difficultyZone: DifficultyZone.Lowlands,
    biomeAffinity: [RealmBiome.Forest, RealmBiome.Grassland, RealmBiome.Shrubland],
  },
  [EnemyType.DesertScorpion]: {
    type: EnemyType.DesertScorpion,
    biome: 0,
    name: "Desert Scorpion",
    hp: 50,
    speed: 75,
    radius: 13,
    aggroRange: 260,
    leashRange: 440,
    shootCooldown: 1500,
    projectileDamage: 13,
    projectileSpeed: 120,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.Spread3,
    movementPattern: MovementPatternType.ChargerRetreater,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 12,
    shape: "triangle",
    color: 0xcc9944,
    difficultyZone: DifficultyZone.Lowlands,
    biomeAffinity: [RealmBiome.Desert, RealmBiome.DryPlains, RealmBiome.DesertCliffs],
  },

  // ===== MIDLANDS - Tier 3 (NEW) =====
  [EnemyType.StoneGolem]: {
    type: EnemyType.StoneGolem,
    biome: 0,
    name: "Stone Golem",
    hp: 200,
    speed: 20,
    radius: 22,
    aggroRange: 240,
    leashRange: 400,
    shootCooldown: 1800,
    projectileDamage: 18,
    projectileSpeed: 120,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.BurstRing8,
    movementPattern: MovementPatternType.SpiralSpinner,
    xpValue: 30,
    shape: "square",
    color: 0x888877,
    difficultyZone: DifficultyZone.Midlands,
    biomeAffinity: [RealmBiome.DesertCliffs, RealmBiome.Shrubland, RealmBiome.Tundra],
  },
  [EnemyType.VenomSpitter]: {
    type: EnemyType.VenomSpitter,
    biome: 0,
    name: "Venom Spitter",
    hp: 80,
    speed: 65,
    radius: 13,
    aggroRange: 300,
    leashRange: 500,
    shootCooldown: 1100,
    projectileDamage: 12,
    projectileSpeed: 120,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spread5,
    movementPattern: MovementPatternType.Shotgunner,
    xpValue: 24,
    shape: "diamond",
    color: 0x66cc22,
    difficultyZone: DifficultyZone.Midlands,
    biomeAffinity: [RealmBiome.Jungle, RealmBiome.Marsh, RealmBiome.Forest],
  },
  [EnemyType.SandWraith]: {
    type: EnemyType.SandWraith,
    biome: 0,
    name: "Sand Wraith",
    hp: 75,
    speed: 50,
    radius: 14,
    aggroRange: 320,
    leashRange: 520,
    shootCooldown: 1400,
    projectileDamage: 15,
    projectileSpeed: 120,
    projectileRange: 380,
    shootingPattern: ShootingPatternType.BurstRing4,
    movementPattern: MovementPatternType.BurstMage,
    xpValue: 26,
    shape: "star",
    color: 0xddcc88,
    difficultyZone: DifficultyZone.Midlands,
    biomeAffinity: [RealmBiome.Desert, RealmBiome.DryPlains, RealmBiome.DesertCliffs],
  },

  // ===== HIGHLANDS - Tier 4 (NEW) =====
  [EnemyType.IceWraith]: {
    type: EnemyType.IceWraith,
    biome: 0,
    name: "Ice Wraith",
    hp: 100,
    speed: 70,
    radius: 14,
    aggroRange: 310,
    leashRange: 520,
    shootCooldown: 1000,
    projectileDamage: 16,
    projectileSpeed: 120,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spread3,
    movementPattern: MovementPatternType.Orbiter,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 38,
    shape: "diamond",
    color: 0xaaddff,
    difficultyZone: DifficultyZone.Highlands,
    biomeAffinity: [RealmBiome.Snow, RealmBiome.Tundra, RealmBiome.Taiga],
  },
  [EnemyType.ThunderHawk]: {
    type: EnemyType.ThunderHawk,
    biome: 0,
    name: "Thunder Hawk",
    hp: 70,
    speed: 110,
    radius: 13,
    aggroRange: 350,
    leashRange: 600,
    shootCooldown: 1200,
    projectileDamage: 18,
    projectileSpeed: 120,
    projectileRange: 440,
    shootingPattern: ShootingPatternType.Spread5,
    movementPattern: MovementPatternType.ChargerRetreater,
    idleIntensity: IdleIntensity.High,
    xpValue: 42,
    shape: "triangle",
    color: 0xffdd44,
    difficultyZone: DifficultyZone.Highlands,
    biomeAffinity: [RealmBiome.DesertCliffs, RealmBiome.Shrubland, RealmBiome.Scorched],
  },
  [EnemyType.MountainTroll]: {
    type: EnemyType.MountainTroll,
    biome: 0,
    name: "Mountain Troll",
    hp: 240,
    speed: 40,
    radius: 22,
    aggroRange: 260,
    leashRange: 440,
    shootCooldown: 1600,
    projectileDamage: 24,
    projectileSpeed: 120,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.BurstRing8,
    movementPattern: MovementPatternType.Shotgunner,
    xpValue: 55,
    shape: "square",
    color: 0x665544,
    difficultyZone: DifficultyZone.Highlands,
    biomeAffinity: [RealmBiome.Tundra, RealmBiome.Taiga, RealmBiome.DesertCliffs],
  },

  // ===== GODLANDS - Tier 5 (NEW) =====
  [EnemyType.AbyssalEye]: {
    type: EnemyType.AbyssalEye,
    biome: 0,
    name: "Abyssal Eye",
    hp: 160,
    speed: 60,
    radius: 18,
    aggroRange: 380,
    leashRange: 620,
    shootCooldown: 600,
    projectileDamage: 24,
    projectileSpeed: 120,
    projectileRange: 480,
    shootingPattern: ShootingPatternType.BurstRing12,
    movementPattern: MovementPatternType.Orbiter,
    xpValue: 80,
    shape: "circle",
    color: 0xcc22aa,
    difficultyZone: DifficultyZone.Godlands,
    biomeAffinity: [RealmBiome.Scorched, RealmBiome.Tundra, RealmBiome.DesertCliffs],
  },
  [EnemyType.ChaosSpawn]: {
    type: EnemyType.ChaosSpawn,
    biome: 0,
    name: "Chaos Spawn",
    hp: 120,
    speed: 100,
    radius: 16,
    aggroRange: 360,
    leashRange: 600,
    shootCooldown: 500,
    projectileDamage: 22,
    projectileSpeed: 120,
    projectileRange: 460,
    shootingPattern: ShootingPatternType.Spread5,
    movementPattern: MovementPatternType.ChargerRetreater,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 90,
    shape: "triangle",
    color: 0xff2244,
    difficultyZone: DifficultyZone.Godlands,
    biomeAffinity: [RealmBiome.Scorched, RealmBiome.Snow, RealmBiome.Tundra],
  },
  [EnemyType.DoomPriest]: {
    type: EnemyType.DoomPriest,
    biome: 0,
    name: "Doom Priest",
    hp: 180,
    speed: 25,
    radius: 18,
    aggroRange: 340,
    leashRange: 540,
    shootCooldown: 700,
    projectileDamage: 28,
    projectileSpeed: 120,
    projectileRange: 500,
    shootingPattern: ShootingPatternType.Spiral8,
    movementPattern: MovementPatternType.SpiralSpinner,
    xpValue: 100,
    shape: "hexagon",
    color: 0x440066,
    difficultyZone: DifficultyZone.Godlands,
    biomeAffinity: [RealmBiome.Snow, RealmBiome.Scorched, RealmBiome.Tundra],
    dungeonDrop: DungeonType.VoidSanctum,
  },

  // ===== PACK ENEMIES =====

  // --- Lowlands Pack (Tier 2): BriarBeast (leader) + BriarImp (minion) ---
  [EnemyType.BriarBeast]: {
    type: EnemyType.BriarBeast,
    biome: 0,
    name: "Briar Beast",
    hp: 120,
    speed: 25,
    radius: 20,
    aggroRange: 260,
    leashRange: 440,
    shootCooldown: 1800,
    projectileDamage: 12,
    projectileSpeed: 120,
    projectileRange: 380,
    shootingPattern: ShootingPatternType.BurstRing8,
    movementPattern: MovementPatternType.RingPulser,
    xpValue: 18,
    shape: "hexagon",
    color: 0x556b2f,
    difficultyZone: DifficultyZone.Lowlands,
    biomeAffinity: [RealmBiome.Forest, RealmBiome.Grassland, RealmBiome.Shrubland],
  },
  [EnemyType.BriarImp]: {
    type: EnemyType.BriarImp,
    biome: 0,
    name: "Briar Imp",
    hp: 20,
    speed: 100,
    radius: 9,
    aggroRange: 240,
    leashRange: 420,
    shootCooldown: 1400,
    projectileDamage: 8,
    projectileSpeed: 120,
    projectileRange: 300,
    shootingPattern: ShootingPatternType.SingleAimed,
    movementPattern: MovementPatternType.ChargerRetreater,
    idleIntensity: IdleIntensity.High,
    xpValue: 5,
    shape: "triangle",
    color: 0x6b8e23,
    // No difficultyZone/biomeAffinity — never spawns independently
  },

  // --- Midlands Pack (Tier 3): BroodMother (leader) + Broodling (minion) ---
  [EnemyType.BroodMother]: {
    type: EnemyType.BroodMother,
    biome: 0,
    name: "Brood Mother",
    hp: 220,
    speed: 20,
    radius: 22,
    aggroRange: 300,
    leashRange: 500,
    shootCooldown: 1200,
    projectileDamage: 18,
    projectileSpeed: 120,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spiral5,
    movementPattern: MovementPatternType.SpiralSpinner,
    xpValue: 35,
    shape: "star",
    color: 0x4a2040,
    difficultyZone: DifficultyZone.Midlands,
    biomeAffinity: [RealmBiome.Jungle, RealmBiome.Forest, RealmBiome.Marsh],
  },
  [EnemyType.Broodling]: {
    type: EnemyType.Broodling,
    biome: 0,
    name: "Broodling",
    hp: 25,
    speed: 110,
    radius: 8,
    aggroRange: 280,
    leashRange: 460,
    shootCooldown: 1600,
    projectileDamage: 10,
    projectileSpeed: 120,
    projectileRange: 340,
    shootingPattern: ShootingPatternType.Spread3,
    movementPattern: MovementPatternType.ChargerRetreater,
    idleIntensity: IdleIntensity.Medium,
    xpValue: 7,
    shape: "diamond",
    color: 0x6a3050,
    // No difficultyZone/biomeAffinity — never spawns independently
  },

  // --- Highlands Pack (Tier 4): FrostMatriarch (leader) + FrostSprite (minion) ---
  [EnemyType.FrostMatriarch]: {
    type: EnemyType.FrostMatriarch,
    biome: 0,
    name: "Frost Matriarch",
    hp: 280,
    speed: 30,
    radius: 22,
    aggroRange: 320,
    leashRange: 540,
    shootCooldown: 1400,
    projectileDamage: 22,
    projectileSpeed: 120,
    projectileRange: 450,
    shootingPattern: ShootingPatternType.BurstRing12,
    movementPattern: MovementPatternType.Shotgunner,
    xpValue: 55,
    shape: "star",
    color: 0x4488bb,
    difficultyZone: DifficultyZone.Highlands,
    biomeAffinity: [RealmBiome.Snow, RealmBiome.Tundra, RealmBiome.Taiga],
  },
  [EnemyType.FrostSprite]: {
    type: EnemyType.FrostSprite,
    biome: 0,
    name: "Frost Sprite",
    hp: 30,
    speed: 120,
    radius: 9,
    aggroRange: 300,
    leashRange: 500,
    shootCooldown: 1200,
    projectileDamage: 12,
    projectileSpeed: 120,
    projectileRange: 360,
    shootingPattern: ShootingPatternType.SingleAimed,
    movementPattern: MovementPatternType.Orbiter,
    idleIntensity: IdleIntensity.High,
    xpValue: 8,
    shape: "diamond",
    color: 0x66aadd,
    // No difficultyZone/biomeAffinity — never spawns independently
  },
};

// Merge realm enemy defs into main ENEMY_DEFS
Object.assign(ENEMY_DEFS, REALM_ENEMY_DEFS);

// --- Realm Spawn Config (keyed by DifficultyZone) ---

export interface RealmSpawnConfig {
  maxEnemies: number;
  respawnDelay: number; // ms
}

export const REALM_SPAWN_CONFIG: Record<number, RealmSpawnConfig> = {
  [DifficultyZone.Shore]: { maxEnemies: 160, respawnDelay: 8000 },
  [DifficultyZone.Lowlands]: { maxEnemies: 200, respawnDelay: 7000 },
  [DifficultyZone.Midlands]: { maxEnemies: 180, respawnDelay: 6000 },
  [DifficultyZone.Highlands]: { maxEnemies: 140, respawnDelay: 5000 },
  [DifficultyZone.Godlands]: { maxEnemies: 100, respawnDelay: 5000 },
};

// Helper: get all realm enemy types for a difficulty zone
export function getEnemyTypesForDifficultyZone(zone: number): number[] {
  return Object.values(REALM_ENEMY_DEFS)
    .filter((def) => def.difficultyZone === zone)
    .map((def) => def.type);
}

// Helper: get realm enemy types matching both zone and biome affinity
export function getEnemyTypesForBiomeAndZone(
  biome: number,
  zone: number
): number[] {
  const matches = Object.values(REALM_ENEMY_DEFS).filter(
    (def) =>
      def.difficultyZone === zone &&
      def.biomeAffinity &&
      def.biomeAffinity.includes(biome)
  );
  // If no biome-specific match, fall back to all enemies in that zone
  if (matches.length === 0) return getEnemyTypesForDifficultyZone(zone);
  return matches.map((def) => def.type);
}

// --- Dungeon Biome Types (separate ID space from overworld) ---

export const DungeonBiomeType = {
  InfernalPit: 100,
  VoidSanctum: 101,
} as const;

// --- Dungeon Enemy Definitions ---

export const DUNGEON_ENEMY_DEFS: Record<number, EnemyDefinition> = {
  // ===== THE INFERNAL PIT =====
  [EnemyType.InfernalHound]: {
    type: EnemyType.InfernalHound,
    biome: DungeonBiomeType.InfernalPit,
    name: "Infernal Hound",
    hp: 100,
    speed: 120,
    radius: 14,
    aggroRange: 350,
    leashRange: 800,
    shootCooldown: 2800,
    projectileDamage: 15,
    projectileSpeed: 120,
    projectileRange: 200,
    shootingPattern: ShootingPatternType.SingleAimed,
    xpValue: 40,
    shape: "triangle",
    color: 0xff4400,
  },
  [EnemyType.MagmaSerpent]: {
    type: EnemyType.MagmaSerpent,
    biome: DungeonBiomeType.InfernalPit,
    name: "Magma Serpent",
    hp: 150,
    speed: 100,
    radius: 16,
    aggroRange: 300,
    leashRange: 800,
    shootCooldown: 3200,
    projectileDamage: 18,
    projectileSpeed: 120,
    projectileRange: 220,
    shootingPattern: ShootingPatternType.Spread3,
    xpValue: 50,
    shape: "hexagon",
    color: 0xff6600,
  },
  [EnemyType.CinderWraith]: {
    type: EnemyType.CinderWraith,
    biome: DungeonBiomeType.InfernalPit,
    name: "Cinder Wraith",
    hp: 80,
    speed: 140,
    radius: 12,
    aggroRange: 400,
    leashRange: 800,
    shootCooldown: 2000,
    projectileDamage: 12,
    projectileSpeed: 120,
    projectileRange: 200,
    shootingPattern: ShootingPatternType.BurstRing4,
    xpValue: 35,
    shape: "diamond",
    color: 0xffaa22,
  },
  // BOSS
  [EnemyType.MoltenWyrm]: {
    type: EnemyType.MoltenWyrm,
    biome: DungeonBiomeType.InfernalPit,
    name: "Molten Wyrm",
    hp: 1500,
    speed: 55,
    radius: 30,
    aggroRange: 600,
    leashRange: 1200,
    shootCooldown: 1200,
    projectileDamage: 20,
    projectileSpeed: 120,
    projectileRange: 280,
    shootingPattern: ShootingPatternType.BurstRing8,
    xpValue: 500,
    shape: "star",
    color: 0xff4400,
  },

  // ===== THE VOID SANCTUM =====
  [EnemyType.VoidAcolyte]: {
    type: EnemyType.VoidAcolyte,
    biome: DungeonBiomeType.VoidSanctum,
    name: "Void Acolyte",
    hp: 120,
    speed: 60,
    radius: 14,
    aggroRange: 350,
    leashRange: 800,
    shootCooldown: 900,
    projectileDamage: 18,
    projectileSpeed: 120,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.BurstRing8,
    xpValue: 50,
    shape: "circle",
    color: 0x6622cc,
  },
  [EnemyType.ShadowWeaver]: {
    type: EnemyType.ShadowWeaver,
    biome: DungeonBiomeType.VoidSanctum,
    name: "Shadow Weaver",
    hp: 90,
    speed: 90,
    radius: 12,
    aggroRange: 380,
    leashRange: 800,
    shootCooldown: 700,
    projectileDamage: 15,
    projectileSpeed: 120,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.Spread5,
    xpValue: 45,
    shape: "diamond",
    color: 0x8844cc,
  },
  [EnemyType.AbyssalSentry]: {
    type: EnemyType.AbyssalSentry,
    biome: DungeonBiomeType.VoidSanctum,
    name: "Abyssal Sentry",
    hp: 200,
    speed: 35,
    radius: 20,
    aggroRange: 300,
    leashRange: 800,
    shootCooldown: 1500,
    projectileDamage: 25,
    projectileSpeed: 120,
    projectileRange: 450,
    shootingPattern: ShootingPatternType.BurstRing12,
    xpValue: 60,
    shape: "square",
    color: 0x4400aa,
  },
  // BOSS
  [EnemyType.TheArchitect]: {
    type: EnemyType.TheArchitect,
    biome: DungeonBiomeType.VoidSanctum,
    name: "The Architect",
    hp: 2500,
    speed: 30,
    radius: 35,
    aggroRange: 700,
    leashRange: 1200,
    shootCooldown: 1000,
    projectileDamage: 22,
    projectileSpeed: 120,
    projectileRange: 550,
    shootingPattern: ShootingPatternType.Spiral8,
    xpValue: 800,
    shape: "star",
    color: 0x6600cc,
  },
  // ADD (spawned by The Architect)
  [EnemyType.VoidMinion]: {
    type: EnemyType.VoidMinion,
    biome: DungeonBiomeType.VoidSanctum,
    name: "Void Minion",
    hp: 40,
    speed: 80,
    radius: 10,
    aggroRange: 400,
    leashRange: 1000,
    shootCooldown: 1200,
    projectileDamage: 10,
    projectileSpeed: 120,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.SingleAimed,
    xpValue: 10,
    shape: "circle",
    color: 0x9944ff,
  },
  // Destructible switch (stationary, no AI)
  [EnemyType.VoidSwitch]: {
    type: EnemyType.VoidSwitch,
    biome: DungeonBiomeType.VoidSanctum,
    name: "Void Switch",
    hp: 300,
    speed: 0,
    radius: 18,
    aggroRange: 0,
    leashRange: 0,
    shootCooldown: 999999,
    projectileDamage: 0,
    projectileSpeed: 120,
    projectileRange: 0,
    shootingPattern: ShootingPatternType.SingleAimed,
    xpValue: 25,
    shape: "hexagon",
    color: 0x00ccff,
  },
};

// Merge dungeon defs into main ENEMY_DEFS for lookup
Object.assign(ENEMY_DEFS, DUNGEON_ENEMY_DEFS);

// --- Dungeon Visuals ---

export const DUNGEON_VISUALS: Record<
  number,
  { groundFill: number; tileLineColor: number; tileLineAlpha: number; name: string }
> = {
  [DungeonType.InfernalPit]: {
    groundFill: 0x2e0a0a,
    tileLineColor: 0x4e1a0a,
    tileLineAlpha: 0.4,
    name: "The Infernal Pit",
  },
  [DungeonType.VoidSanctum]: {
    groundFill: 0x0a0a2e,
    tileLineColor: 0x1a0a4e,
    tileLineAlpha: 0.4,
    name: "The Void Sanctum",
  },
};

// --- Dungeon Layouts (pre-placed enemy positions) ---

export interface DungeonEnemyPlacement {
  enemyType: number;
  x: number;
  y: number;
}

export const DUNGEON_LAYOUTS: Record<number, DungeonEnemyPlacement[]> = {
  [DungeonType.InfernalPit]: [
    // Group 1: Near entrance
    { enemyType: EnemyType.InfernalHound, x: 100, y: 1600 },
    { enemyType: EnemyType.CinderWraith, x: 200, y: 1550 },
    { enemyType: EnemyType.InfernalHound, x: 300, y: 1600 },
    // Group 2: Mid-path
    { enemyType: EnemyType.MagmaSerpent, x: 100, y: 1200 },
    { enemyType: EnemyType.InfernalHound, x: 200, y: 1200 },
    { enemyType: EnemyType.CinderWraith, x: 300, y: 1200 },
    // Group 3: Pre-boss
    { enemyType: EnemyType.MagmaSerpent, x: 100, y: 700 },
    { enemyType: EnemyType.MagmaSerpent, x: 300, y: 700 },
    { enemyType: EnemyType.CinderWraith, x: 200, y: 600 },
    { enemyType: EnemyType.InfernalHound, x: 80, y: 600 },
    { enemyType: EnemyType.InfernalHound, x: 320, y: 600 },
  ],
  [DungeonType.VoidSanctum]: [
    // Group 1: Near entrance
    { enemyType: EnemyType.VoidAcolyte, x: 100, y: 1600 },
    { enemyType: EnemyType.VoidAcolyte, x: 300, y: 1600 },
    { enemyType: EnemyType.ShadowWeaver, x: 200, y: 1550 },
    // Group 2: Mid-path
    { enemyType: EnemyType.AbyssalSentry, x: 200, y: 1200 },
    { enemyType: EnemyType.ShadowWeaver, x: 80, y: 1250 },
    { enemyType: EnemyType.ShadowWeaver, x: 320, y: 1250 },
    { enemyType: EnemyType.VoidAcolyte, x: 150, y: 1150 },
    // Group 3: Pre-boss
    { enemyType: EnemyType.AbyssalSentry, x: 80, y: 700 },
    { enemyType: EnemyType.AbyssalSentry, x: 320, y: 700 },
    { enemyType: EnemyType.ShadowWeaver, x: 200, y: 600 },
    { enemyType: EnemyType.VoidAcolyte, x: 120, y: 550 },
    { enemyType: EnemyType.VoidAcolyte, x: 280, y: 550 },
  ],
};

// --- Dungeon Lookup Maps ---

export const DUNGEON_BOSS_TYPE: Record<number, number> = {
  [DungeonType.InfernalPit]: EnemyType.MoltenWyrm,
  [DungeonType.VoidSanctum]: EnemyType.TheArchitect,
};

export const ZONE_TO_DUNGEON: Record<string, number> = {
  [PlayerZone.DungeonInfernal]: DungeonType.InfernalPit,
  [PlayerZone.DungeonVoid]: DungeonType.VoidSanctum,
};

export const DUNGEON_TO_ZONE: Record<number, string> = {
  [DungeonType.InfernalPit]: PlayerZone.DungeonInfernal,
  [DungeonType.VoidSanctum]: PlayerZone.DungeonVoid,
};

// --- Room-Based Dungeon Enemy Config ---
// Each entry corresponds to a room by index:
// InfernalPit: [0] = spawn, [1-7] = normal rooms (3 enemies each), [8] = boss room
// VoidSanctum: [0] = spawn, [1-3] = normal, [4] = switchA, [5] = preBoss, [6] = boss, [7-8] = switches

export interface DungeonRoomEnemyConfig {
  enemies: number[]; // EnemyType values
}

export const DUNGEON_ROOM_ENEMIES: Record<number, DungeonRoomEnemyConfig[]> = {
  [DungeonType.InfernalPit]: [
    // Room 0: spawn room - no enemies
    { enemies: [] },
    // Room 1
    { enemies: [EnemyType.InfernalHound, EnemyType.InfernalHound, EnemyType.InfernalHound] },
    // Room 2
    { enemies: [EnemyType.InfernalHound, EnemyType.CinderWraith, EnemyType.InfernalHound] },
    // Room 3
    { enemies: [EnemyType.MagmaSerpent, EnemyType.InfernalHound, EnemyType.CinderWraith] },
    // Room 4
    { enemies: [EnemyType.CinderWraith, EnemyType.CinderWraith, EnemyType.MagmaSerpent] },
    // Room 5
    { enemies: [EnemyType.MagmaSerpent, EnemyType.MagmaSerpent, EnemyType.CinderWraith] },
    // Room 6
    { enemies: [EnemyType.MagmaSerpent, EnemyType.CinderWraith, EnemyType.InfernalHound] },
    // Room 7
    { enemies: [EnemyType.MagmaSerpent, EnemyType.MagmaSerpent, EnemyType.MagmaSerpent] },
    // Room 8: boss room - boss spawned separately
    { enemies: [] },
  ],
  [DungeonType.VoidSanctum]: [
    // Room 0: spawn room - no enemies
    { enemies: [] },
    // Room 1: first encounter
    { enemies: [EnemyType.VoidAcolyte, EnemyType.VoidAcolyte, EnemyType.ShadowWeaver] },
    // Room 2: mid dungeon
    { enemies: [EnemyType.AbyssalSentry, EnemyType.ShadowWeaver, EnemyType.ShadowWeaver, EnemyType.VoidAcolyte] },
    // Room 3: crossroads (connects to switchA and preBoss)
    { enemies: [EnemyType.AbyssalSentry, EnemyType.AbyssalSentry, EnemyType.ShadowWeaver, EnemyType.VoidAcolyte, EnemyType.VoidAcolyte] },
    // Room 4: switchRoomA (guarded dead-end)
    { enemies: [EnemyType.ShadowWeaver, EnemyType.VoidAcolyte] },
    // Room 5: preBoss room (heavy guard)
    { enemies: [EnemyType.AbyssalSentry, EnemyType.AbyssalSentry, EnemyType.ShadowWeaver, EnemyType.ShadowWeaver] },
    // Room 6: boss room - boss spawned separately after switches
    { enemies: [] },
    // Room 7: switchRoomB (guarded dead-end, left of boss)
    { enemies: [EnemyType.AbyssalSentry, EnemyType.VoidAcolyte] },
    // Room 8: switchRoomC (guarded dead-end, right of boss)
    { enemies: [EnemyType.AbyssalSentry, EnemyType.VoidAcolyte] },
  ],
};

// --- Infernal Pit Normal Room Enemy Variants ---
// Pool of enemy lists for normal rooms (cycled through for variable room counts)
export const INFERNAL_NORMAL_ROOM_VARIANTS: number[][] = [
  [EnemyType.InfernalHound, EnemyType.InfernalHound, EnemyType.InfernalHound],
  [EnemyType.InfernalHound, EnemyType.CinderWraith, EnemyType.InfernalHound],
  [EnemyType.MagmaSerpent, EnemyType.InfernalHound, EnemyType.CinderWraith],
  [EnemyType.CinderWraith, EnemyType.CinderWraith, EnemyType.MagmaSerpent],
  [EnemyType.MagmaSerpent, EnemyType.MagmaSerpent, EnemyType.CinderWraith],
  [EnemyType.MagmaSerpent, EnemyType.CinderWraith, EnemyType.InfernalHound],
  [EnemyType.MagmaSerpent, EnemyType.MagmaSerpent, EnemyType.MagmaSerpent],
];

// --- Dungeon Helpers ---

export function isDungeonZone(zone: string): boolean {
  return zone === PlayerZone.DungeonInfernal || zone === PlayerZone.DungeonVoid;
}

export function isBossEnemy(enemyType: number): boolean {
  return enemyType === EnemyType.MoltenWyrm || enemyType === EnemyType.TheArchitect;
}
