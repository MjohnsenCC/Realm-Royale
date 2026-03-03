import {
  EnemyType,
  DungeonType,
  PlayerZone,
  ShootingPatternType,
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
    projectileSpeed: 180,
    projectileRange: 300,
    shootingPattern: ShootingPatternType.SingleAimed,
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
    projectileSpeed: 160,
    projectileRange: 280,
    shootingPattern: ShootingPatternType.Spread3,
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
    projectileSpeed: 220,
    projectileRange: 320,
    shootingPattern: ShootingPatternType.SingleAimed,
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
    projectileSpeed: 280,
    projectileRange: 380,
    shootingPattern: ShootingPatternType.SingleAimed,
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
    projectileSpeed: 300,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.Spread3,
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
    projectileSpeed: 200,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.BurstRing4,
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
    projectileSpeed: 220,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spread5,
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
    projectileSpeed: 320,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.Spiral3,
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
    projectileSpeed: 340,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.DoubleSingle,
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
    projectileSpeed: 300,
    projectileRange: 440,
    shootingPattern: ShootingPatternType.BurstRing8,
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
    projectileSpeed: 380,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spread3,
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
    projectileSpeed: 260,
    projectileRange: 450,
    shootingPattern: ShootingPatternType.BurstRing12,
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
    shootCooldown: 650,
    projectileDamage: 26,
    projectileSpeed: 360,
    projectileRange: 500,
    shootingPattern: ShootingPatternType.BurstRing16,
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
    projectileSpeed: 400,
    projectileRange: 460,
    shootingPattern: ShootingPatternType.Spread5,
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
    projectileSpeed: 300,
    projectileRange: 500,
    shootingPattern: ShootingPatternType.Spiral8,
    xpValue: 110,
    shape: "square",
    color: 0x442266,
    difficultyZone: DifficultyZone.Godlands,
    biomeAffinity: [RealmBiome.Snow, RealmBiome.Tundra, RealmBiome.Scorched],
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
    projectileSpeed: 160,
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
    projectileSpeed: 320,
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
    projectileSpeed: 350,
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
    projectileSpeed: 250,
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
    projectileSpeed: 300,
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
    projectileSpeed: 280,
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
    projectileSpeed: 0,
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
