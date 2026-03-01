import {
  EnemyType,
  BiomeType,
  DungeonType,
  PlayerZone,
  ShootingPatternType,
} from "./types";
import { ARENA_WIDTH, ARENA_HEIGHT } from "./constants";
import { distanceBetween } from "./utils";
import { simplex2 } from "./noise";

// --- Biome Anchor Points (create Shoreline zones around the map) ---

export const BIOME_ANCHORS: readonly { x: number; y: number }[] = [
  { x: 8000, y: 8000 }, // Center — primary player spawn
  { x: 3200, y: 3800 }, // North-west
  { x: 12800, y: 4200 }, // North-east
  { x: 5500, y: 13000 }, // South
];

// Distance at which the furthest biome is fully reached
const MAX_BIOME_DIST = 6000;

// Guaranteed Shoreline radius around each anchor (no noise override)
const SAFE_RADIUS = 600;

export function getBiomeAtPosition(x: number, y: number): BiomeType {
  // Find distance to the nearest anchor
  let minDist = Infinity;
  for (const anchor of BIOME_ANCHORS) {
    const d = distanceBetween(x, y, anchor.x, anchor.y);
    if (d < minDist) minDist = d;
  }

  // Guaranteed safe zone around anchors
  if (minDist < SAFE_RADIUS) return BiomeType.Shoreline;

  // Normalize distance to [0, 1]
  const normalizedDist = Math.min(1, minDist / MAX_BIOME_DIST);

  // Multi-octave noise for organic, blob-like regions
  const n1 = simplex2(x * 0.0006, y * 0.0006); // Large blobs (~10,000px)
  const n2 = simplex2(x * 0.002, y * 0.002) * 0.4; // Medium boundary detail
  const noiseVal = (n1 + n2 + 1.4) / 2.8; // Normalize to [0, 1]

  // Blend distance gradient with noise — distance dominates to preserve progression
  const difficulty = normalizedDist * 0.6 + noiseVal * 0.4;

  // Map difficulty to biome (even 20% bands)
  if (difficulty < 0.2) return BiomeType.Shoreline;
  if (difficulty < 0.4) return BiomeType.Meadow;
  if (difficulty < 0.6) return BiomeType.Forest;
  if (difficulty < 0.8) return BiomeType.Hellscape;
  return BiomeType.Godlands;
}

// --- Biome Visual Config (client-side ground rendering) ---

export interface BiomeVisual {
  groundFill: number;
  tileLineColor: number;
  tileLineAlpha: number;
  name: string;
}

export const BIOME_VISUALS: Record<number, BiomeVisual> = {
  [BiomeType.Shoreline]: {
    groundFill: 0x2a2a1e,
    tileLineColor: 0x3a3a2e,
    tileLineAlpha: 0.3,
    name: "Shoreline",
  },
  [BiomeType.Meadow]: {
    groundFill: 0x1a2e1a,
    tileLineColor: 0x2a4a2a,
    tileLineAlpha: 0.3,
    name: "Meadow",
  },
  [BiomeType.Forest]: {
    groundFill: 0x0e1e0e,
    tileLineColor: 0x1e3a1e,
    tileLineAlpha: 0.4,
    name: "Forest",
  },
  [BiomeType.Hellscape]: {
    groundFill: 0x2e1010,
    tileLineColor: 0x4e1a1a,
    tileLineAlpha: 0.35,
    name: "Hellscape",
  },
  [BiomeType.Godlands]: {
    groundFill: 0x1a0a2e,
    tileLineColor: 0x2a1a4e,
    tileLineAlpha: 0.4,
    name: "Godlands",
  },
};

// --- Biome Spawn Config ---

export interface BiomeSpawnConfig {
  maxEnemies: number;
  respawnDelay: number; // ms
}

export const BIOME_SPAWN_CONFIG: Record<number, BiomeSpawnConfig> = {
  [BiomeType.Shoreline]: { maxEnemies: 160, respawnDelay: 8000 },
  [BiomeType.Meadow]: { maxEnemies: 200, respawnDelay: 7000 },
  [BiomeType.Forest]: { maxEnemies: 180, respawnDelay: 6000 },
  [BiomeType.Hellscape]: { maxEnemies: 140, respawnDelay: 5000 },
  [BiomeType.Godlands]: { maxEnemies: 100, respawnDelay: 5000 },
};

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
}

// --- All 15 Enemy Definitions ---

export const ENEMY_DEFS: Record<number, EnemyDefinition> = {
  // ===== SHORELINE (Tier 1) =====
  [EnemyType.Crab]: {
    type: EnemyType.Crab,
    biome: BiomeType.Shoreline,
    name: "Crab",
    hp: 30,
    speed: 40,
    radius: 14,
    aggroRange: 207,
    leashRange: 403,
    shootCooldown: 2000,
    projectileDamage: 8,
    projectileSpeed: 200,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.SingleAimed,
    xpValue: 5,
    shape: "circle",
    color: 0xcc6644,
  },
  [EnemyType.Jellyfish]: {
    type: EnemyType.Jellyfish,
    biome: BiomeType.Shoreline,
    name: "Jellyfish",
    hp: 25,
    speed: 50,
    radius: 12,
    aggroRange: 230,
    leashRange: 345,
    shootCooldown: 2500,
    projectileDamage: 6,
    projectileSpeed: 150,
    projectileRange: 300,
    shootingPattern: ShootingPatternType.Spread3,
    xpValue: 5,
    shape: "diamond",
    color: 0x66aacc,
  },
  [EnemyType.Sandworm]: {
    type: EnemyType.Sandworm,
    biome: BiomeType.Shoreline,
    name: "Sandworm",
    hp: 50,
    speed: 30,
    radius: 16,
    aggroRange: 173,
    leashRange: 460,
    shootCooldown: 1800,
    projectileDamage: 10,
    projectileSpeed: 250,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.BurstRing4,
    xpValue: 8,
    shape: "triangle",
    color: 0xccaa44,
  },

  // ===== MEADOW (Tier 2) =====
  [EnemyType.Goblin]: {
    type: EnemyType.Goblin,
    biome: BiomeType.Meadow,
    name: "Goblin",
    hp: 50,
    speed: 70,
    radius: 14,
    aggroRange: 253,
    leashRange: 460,
    shootCooldown: 1500,
    projectileDamage: 12,
    projectileSpeed: 280,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.SingleAimed,
    xpValue: 10,
    shape: "circle",
    color: 0x44aa44,
  },
  [EnemyType.Wasp]: {
    type: EnemyType.Wasp,
    biome: BiomeType.Meadow,
    name: "Wasp",
    hp: 35,
    speed: 100,
    radius: 10,
    aggroRange: 288,
    leashRange: 518,
    shootCooldown: 1200,
    projectileDamage: 10,
    projectileSpeed: 320,
    projectileRange: 380,
    shootingPattern: ShootingPatternType.Spread3,
    xpValue: 10,
    shape: "diamond",
    color: 0xcccc22,
  },
  [EnemyType.Mushroom]: {
    type: EnemyType.Mushroom,
    biome: BiomeType.Meadow,
    name: "Mushroom",
    hp: 80,
    speed: 20,
    radius: 16,
    aggroRange: 207,
    leashRange: 345,
    shootCooldown: 2000,
    projectileDamage: 8,
    projectileSpeed: 200,
    projectileRange: 350,
    shootingPattern: ShootingPatternType.BurstRing8,
    xpValue: 15,
    shape: "hexagon",
    color: 0x884488,
  },

  // ===== FOREST (Tier 3) =====
  [EnemyType.Treant]: {
    type: EnemyType.Treant,
    biome: BiomeType.Forest,
    name: "Treant",
    hp: 150,
    speed: 25,
    radius: 20,
    aggroRange: 230,
    leashRange: 403,
    shootCooldown: 1800,
    projectileDamage: 15,
    projectileSpeed: 200,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.Spread5,
    xpValue: 25,
    shape: "square",
    color: 0x336633,
  },
  [EnemyType.DarkElf]: {
    type: EnemyType.DarkElf,
    biome: BiomeType.Forest,
    name: "Dark Elf",
    hp: 80,
    speed: 80,
    radius: 12,
    aggroRange: 345,
    leashRange: 575,
    shootCooldown: 800,
    projectileDamage: 12,
    projectileSpeed: 350,
    projectileRange: 450,
    shootingPattern: ShootingPatternType.DoubleSingle,
    xpValue: 20,
    shape: "diamond",
    color: 0x6644aa,
  },
  [EnemyType.Spider]: {
    type: EnemyType.Spider,
    biome: BiomeType.Forest,
    name: "Spider",
    hp: 60,
    speed: 60,
    radius: 14,
    aggroRange: 288,
    leashRange: 460,
    shootCooldown: 1500,
    projectileDamage: 10,
    projectileSpeed: 250,
    projectileRange: 380,
    shootingPattern: ShootingPatternType.Spiral3,
    xpValue: 20,
    shape: "hexagon",
    color: 0x444444,
  },

  // ===== HELLSCAPE (Tier 4) =====
  [EnemyType.Imp]: {
    type: EnemyType.Imp,
    biome: BiomeType.Hellscape,
    name: "Imp",
    hp: 70,
    speed: 100,
    radius: 12,
    aggroRange: 322,
    leashRange: 575,
    shootCooldown: 600,
    projectileDamage: 15,
    projectileSpeed: 380,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spread3,
    xpValue: 30,
    shape: "triangle",
    color: 0xcc4422,
  },
  [EnemyType.FireElemental]: {
    type: EnemyType.FireElemental,
    biome: BiomeType.Hellscape,
    name: "Fire Elemental",
    hp: 120,
    speed: 50,
    radius: 18,
    aggroRange: 288,
    leashRange: 460,
    shootCooldown: 1200,
    projectileDamage: 18,
    projectileSpeed: 300,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.BurstRing12,
    xpValue: 40,
    shape: "star",
    color: 0xff6600,
  },
  [EnemyType.LavaGolem]: {
    type: EnemyType.LavaGolem,
    biome: BiomeType.Hellscape,
    name: "Lava Golem",
    hp: 200,
    speed: 30,
    radius: 22,
    aggroRange: 253,
    leashRange: 437,
    shootCooldown: 1500,
    projectileDamage: 22,
    projectileSpeed: 250,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spiral5,
    xpValue: 50,
    shape: "square",
    color: 0xcc2200,
  },

  // ===== GODLANDS (Tier 5) =====
  [EnemyType.FallenGod]: {
    type: EnemyType.FallenGod,
    biome: BiomeType.Godlands,
    name: "Fallen God",
    hp: 200,
    speed: 60,
    radius: 20,
    aggroRange: 403,
    leashRange: 633,
    shootCooldown: 700,
    projectileDamage: 25,
    projectileSpeed: 350,
    projectileRange: 500,
    shootingPattern: ShootingPatternType.BurstRing16,
    xpValue: 80,
    shape: "star",
    color: 0xffcc00,
  },
  [EnemyType.VoidWraith]: {
    type: EnemyType.VoidWraith,
    biome: BiomeType.Godlands,
    name: "Void Wraith",
    hp: 120,
    speed: 90,
    radius: 14,
    aggroRange: 345,
    leashRange: 575,
    shootCooldown: 500,
    projectileDamage: 20,
    projectileSpeed: 400,
    projectileRange: 450,
    shootingPattern: ShootingPatternType.Spread5,
    xpValue: 70,
    shape: "diamond",
    color: 0x8800cc,
  },
  [EnemyType.Leviathan]: {
    type: EnemyType.Leviathan,
    biome: BiomeType.Godlands,
    name: "Leviathan",
    hp: 300,
    speed: 35,
    radius: 24,
    aggroRange: 322,
    leashRange: 518,
    shootCooldown: 1000,
    projectileDamage: 30,
    projectileSpeed: 300,
    projectileRange: 480,
    shootingPattern: ShootingPatternType.Spiral8,
    xpValue: 100,
    shape: "hexagon",
    color: 0x220066,
  },
};

// Helper: get all enemy types belonging to a biome
export function getEnemyTypesForBiome(biome: number): number[] {
  return Object.values(ENEMY_DEFS)
    .filter((def) => def.biome === biome)
    .map((def) => def.type);
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
    speed: 80,
    radius: 14,
    aggroRange: 350,
    leashRange: 800,
    shootCooldown: 1000,
    projectileDamage: 15,
    projectileSpeed: 300,
    projectileRange: 400,
    shootingPattern: ShootingPatternType.Spread3,
    xpValue: 40,
    shape: "triangle",
    color: 0xff4400,
  },
  [EnemyType.MagmaSerpent]: {
    type: EnemyType.MagmaSerpent,
    biome: DungeonBiomeType.InfernalPit,
    name: "Magma Serpent",
    hp: 150,
    speed: 50,
    radius: 16,
    aggroRange: 300,
    leashRange: 800,
    shootCooldown: 1200,
    projectileDamage: 18,
    projectileSpeed: 280,
    projectileRange: 420,
    shootingPattern: ShootingPatternType.Spiral5,
    xpValue: 50,
    shape: "hexagon",
    color: 0xff6600,
  },
  [EnemyType.CinderWraith]: {
    type: EnemyType.CinderWraith,
    biome: DungeonBiomeType.InfernalPit,
    name: "Cinder Wraith",
    hp: 80,
    speed: 100,
    radius: 12,
    aggroRange: 400,
    leashRange: 800,
    shootCooldown: 600,
    projectileDamage: 12,
    projectileSpeed: 380,
    projectileRange: 380,
    shootingPattern: ShootingPatternType.DoubleSingle,
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
    speed: 40,
    radius: 30,
    aggroRange: 600,
    leashRange: 1200,
    shootCooldown: 800,
    projectileDamage: 20,
    projectileSpeed: 280,
    projectileRange: 500,
    shootingPattern: ShootingPatternType.BurstRing12,
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
// [0] = spawn room, [1-3] = normal rooms, [4] = boss room (boss spawned separately)

export interface DungeonRoomEnemyConfig {
  enemies: number[]; // EnemyType values
}

export const DUNGEON_ROOM_ENEMIES: Record<number, DungeonRoomEnemyConfig[]> = {
  [DungeonType.InfernalPit]: [
    // Room 0: spawn room - no enemies
    { enemies: [] },
    // Room 1: first encounter
    { enemies: [EnemyType.InfernalHound, EnemyType.CinderWraith, EnemyType.InfernalHound] },
    // Room 2: mid dungeon
    { enemies: [EnemyType.MagmaSerpent, EnemyType.InfernalHound, EnemyType.CinderWraith] },
    // Room 3: pre-boss
    { enemies: [EnemyType.MagmaSerpent, EnemyType.MagmaSerpent, EnemyType.CinderWraith, EnemyType.InfernalHound, EnemyType.InfernalHound] },
    // Room 4: boss room - boss spawned separately
    { enemies: [] },
  ],
  [DungeonType.VoidSanctum]: [
    // Room 0: spawn room - no enemies
    { enemies: [] },
    // Room 1: first encounter
    { enemies: [EnemyType.VoidAcolyte, EnemyType.VoidAcolyte, EnemyType.ShadowWeaver] },
    // Room 2: mid dungeon
    { enemies: [EnemyType.AbyssalSentry, EnemyType.ShadowWeaver, EnemyType.ShadowWeaver, EnemyType.VoidAcolyte] },
    // Room 3: pre-boss
    { enemies: [EnemyType.AbyssalSentry, EnemyType.AbyssalSentry, EnemyType.ShadowWeaver, EnemyType.VoidAcolyte, EnemyType.VoidAcolyte] },
    // Room 4: boss room - boss spawned separately
    { enemies: [] },
  ],
};

// --- Dungeon Helpers ---

export function isDungeonZone(zone: string): boolean {
  return zone === PlayerZone.DungeonInfernal || zone === PlayerZone.DungeonVoid;
}

export function isBossEnemy(enemyType: number): boolean {
  return enemyType === EnemyType.MoltenWyrm || enemyType === EnemyType.TheArchitect;
}
