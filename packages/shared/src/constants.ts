export const TILE_SIZE = 40; // used by nexus + dungeons

// Hostile zone island map
export const HOSTILE_TILES = 2048; // tile grid dimensions
export const HOSTILE_TILE_SIZE = 40; // pixels per tile (matches TILE_SIZE)
export const HOSTILE_WIDTH = HOSTILE_TILES * HOSTILE_TILE_SIZE; // 81920
export const HOSTILE_HEIGHT = HOSTILE_TILES * HOSTILE_TILE_SIZE; // 81920
export const HOSTILE_CENTER_X = HOSTILE_WIDTH / 2; // 40960
export const HOSTILE_CENTER_Y = HOSTILE_HEIGHT / 2; // 40960

// Player
export const PLAYER_SPEED = 200; // pixels per second
export const PLAYER_MAX_HP = 100;
export const PLAYER_RADIUS = 16;
export const PLAYER_SHOOT_COOLDOWN = 250; // ms between shots

// Player projectile
export const PROJECTILE_SPEED = 500; // pixels per second
export const PROJECTILE_RANGE = 400; // max travel distance
export const PROJECTILE_DAMAGE = 20;
export const PROJECTILE_RADIUS = 5;

// Spawning
export const MIN_SPAWN_DISTANCE = 300; // min px from any player

// Leveling
export const MAX_LEVEL = 100;
export const XP_SHARE_RADIUS = 600; // px from dead enemy to award XP

// Base stats (level 1)
export const BASE_MAX_HP = 100;
export const BASE_DAMAGE = 20;
export const BASE_SHOOT_COOLDOWN = 250; // ms
export const BASE_SPEED = 200; // px/s
export const BASE_HP_REGEN = 0; // hp/s

// Per-level stat increments
export const HP_PER_LEVEL = 3;
export const DAMAGE_PER_LEVEL = 0.5;
export const COOLDOWN_REDUCTION_PER_LEVEL = 1.5; // ms reduction per level
export const MIN_SHOOT_COOLDOWN = 100; // hard floor
export const SPEED_PER_LEVEL = 1;
export const MAX_SPEED = 300; // hard ceiling
export const HP_REGEN_PER_LEVEL = 0.1; // hp/s per level

// Server
export const TICK_RATE = 20; // updates per second
export const TICK_INTERVAL = 1000 / TICK_RATE; // 50ms
export const MAX_PLAYERS = 4;
export const SERVER_PORT = 2567;

// Network interpolation
export const INTERPOLATION_DELAY = 100; // ms behind server time for rendering remote entities

// Minimap
export const MINIMAP_WIDTH = 150;
export const MINIMAP_HEIGHT = 150;

// Enemy sync (area-of-interest filtering)
export const ENEMY_SYNC_RADIUS = 1600;

// Nexus (safe zone — hub with center room + 4 side rooms)
export const NEXUS_TILES_X = 50;
export const NEXUS_TILES_Y = 50;
export const NEXUS_WIDTH = NEXUS_TILES_X * TILE_SIZE; // 2000
export const NEXUS_HEIGHT = NEXUS_TILES_Y * TILE_SIZE; // 2000

// Portal (located in nexus north room, takes player to hostile zone)
export const PORTAL_X = 25.5 * TILE_SIZE; // 1020 — center of north room
export const PORTAL_Y = 7 * TILE_SIZE; // 280 — center of north room
export const PORTAL_RADIUS = 40;

// Inventory & Loot Bags
export const INVENTORY_SIZE = 8;
export const BAG_SIZE = 8;
export const BAG_PICKUP_RADIUS = 40; // px — how close to interact with a bag
export const BAG_LIFETIME = 60000; // ms — bags despawn after 60s
export const BAG_RADIUS = 12; // visual/collision radius

// Equipment
export const EQUIPMENT_SLOTS = 4; // weapon, ability, armor, ring

// Mana
export const BASE_MAX_MANA = 100;
export const BASE_MANA_REGEN = 5; // mana/s
export const MANA_PER_LEVEL = 2; // bonus max mana per level
export const MANA_REGEN_PER_LEVEL = 0.2; // bonus mana regen per level

// Default starting equipment (tier 1 of each)
export const DEFAULT_WEAPON = 11; // Bow T1
export const DEFAULT_ABILITY = 101; // Quiver T1
export const DEFAULT_ARMOR = 201; // Armor T1
export const DEFAULT_RING = 301; // Ring T1

// Dungeons
export const DUNGEON_WIDTH = 800;
export const DUNGEON_HEIGHT = 1440;
export const DUNGEON_SPAWN_X = 400; // fallback; actual spawn derived from map data
export const DUNGEON_SPAWN_Y = 1280; // fallback; actual spawn derived from map data
export const DUNGEON_BOSS_X = 400; // fallback; actual boss pos derived from map data
export const DUNGEON_BOSS_Y = 160; // fallback; actual boss pos derived from map data

// Dungeon portals
export const DUNGEON_PORTAL_RADIUS = 35;
export const DUNGEON_PORTAL_LIFETIME = 30000; // 30s
export const DUNGEON_PORTAL_INTERACT_RADIUS = 50;

// Dungeon portal drop chances (per kill)
export const INFERNAL_PORTAL_CHANCE = 0.02;
export const VOID_PORTAL_CHANCE = 0.015;
