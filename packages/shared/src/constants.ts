// Arena (hostile zone — large RotMG-style overworld)
export const ARENA_WIDTH = 16000;
export const ARENA_HEIGHT = 16000;
export const ARENA_CENTER_X = 8000;
export const ARENA_CENTER_Y = 8000;
export const TILE_SIZE = 40;

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

// Nexus (safe zone — 4x original size)
export const NEXUS_WIDTH = 2400;
export const NEXUS_HEIGHT = 2400;

// Portal (located in nexus, takes player to hostile zone)
export const PORTAL_X = 1200; // center of nexus horizontally
export const PORTAL_Y = 400; // near top area of nexus
export const PORTAL_RADIUS = 40;

// Inventory & Loot Bags
export const INVENTORY_SIZE = 8;
export const BAG_SIZE = 8;
export const BAG_PICKUP_RADIUS = 40; // px — how close to interact with a bag
export const BAG_LIFETIME = 60000; // ms — bags despawn after 60s
export const BAG_RADIUS = 12; // visual/collision radius
