import { RealmBiome, DifficultyZone, DecorationType, RealmTier } from "./types";
import { HOSTILE_TILES, HOSTILE_TILE_SIZE } from "./constants";

// --- Map Data Types ---

export interface DecorationEntry {
  tileX: number;
  tileY: number;
  type: DecorationType;
}

export interface SetpieceEntry {
  id: string;
  tileX: number;
  tileY: number;
  radius: number; // tiles
}

export interface SpawnAnchor {
  x: number; // pixel coordinates
  y: number;
}

export interface RealmMapData {
  version: number;
  seed: number;
  width: number; // tile count (2048)
  height: number; // tile count (2048)
  tileSize: number; // pixels per tile (16)
  biomes: Uint8Array; // width*height, RealmBiome values (tier 1)
  biomesByTier: Uint8Array[]; // biomes per realm tier [0]=T1, [1]=T2, [2]=T3
  elevation: Uint8Array; // width*height, 0-255 quantized
  moisture: Uint8Array; // width*height, 0-255 quantized
  difficulty: Uint8Array; // width*height, DifficultyZone values (0-4)
  rivers: Uint8Array; // width*height, 0=no river, >0=river width
  roads: Uint8Array; // width*height, 0=no road, 1=road
  decorations: DecorationEntry[];
  setpieces: SetpieceEntry[];
  spawnPoints: SpawnAnchor[];
  decorationCollision: Uint8Array; // width*height, 1=collidable decoration (built at load time)
}

// --- Serialized (JSON-safe) format ---

export interface RealmMapJSON {
  version: number;
  seed: number;
  width: number;
  height: number;
  tileSize: number;
  biomesRLE: string; // base64 of RLE-encoded biomes (tier 1)
  biomesTier2RLE?: string; // base64 of RLE-encoded biomes (tier 2)
  biomesTier3RLE?: string; // base64 of RLE-encoded biomes (tier 3)
  elevationRLE: string;
  moistureRLE: string;
  difficultyRLE: string;
  riversRLE: string;
  roadsRLE: string;
  decorations: DecorationEntry[];
  setpieces: SetpieceEntry[];
  spawnPoints: SpawnAnchor[];
}

// --- RLE Encode / Decode ---

export function rleEncode(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;
  while (i < data.length) {
    const value = data[i];
    let count = 1;
    while (i + count < data.length && data[i + count] === value && count < 255) {
      count++;
    }
    result.push(count, value);
    i += count;
  }
  return new Uint8Array(result);
}

export function rleDecode(encoded: Uint8Array, expectedLength: number): Uint8Array {
  const result = new Uint8Array(expectedLength);
  let outIdx = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    const count = encoded[i];
    const value = encoded[i + 1];
    for (let j = 0; j < count && outIdx < expectedLength; j++) {
      result[outIdx++] = value;
    }
  }
  return result;
}

// --- Base64 helpers (works in both Node.js and browser) ---

function uint8ToBase64(data: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data).toString("base64");
  }
  // Browser fallback
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  // Browser fallback
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Serialize / Deserialize ---

export function serializeRealmMap(map: RealmMapData): string {
  const json: RealmMapJSON = {
    version: map.version,
    seed: map.seed,
    width: map.width,
    height: map.height,
    tileSize: map.tileSize,
    biomesRLE: uint8ToBase64(rleEncode(map.biomes)),
    biomesTier2RLE: map.biomesByTier[1] ? uint8ToBase64(rleEncode(map.biomesByTier[1])) : undefined,
    biomesTier3RLE: map.biomesByTier[2] ? uint8ToBase64(rleEncode(map.biomesByTier[2])) : undefined,
    elevationRLE: uint8ToBase64(rleEncode(map.elevation)),
    moistureRLE: uint8ToBase64(rleEncode(map.moisture)),
    difficultyRLE: uint8ToBase64(rleEncode(map.difficulty)),
    riversRLE: uint8ToBase64(rleEncode(map.rivers)),
    roadsRLE: uint8ToBase64(rleEncode(map.roads)),
    decorations: map.decorations,
    setpieces: map.setpieces,
    spawnPoints: map.spawnPoints,
  };
  return JSON.stringify(json);
}

export function loadRealmMapFromJSON(jsonStr: string): RealmMapData {
  const json: RealmMapJSON = JSON.parse(jsonStr);
  const totalTiles = json.width * json.height;
  const decorations = json.decorations;
  const tier1Biomes = rleDecode(base64ToUint8(json.biomesRLE), totalTiles);
  const tier2Biomes = json.biomesTier2RLE
    ? rleDecode(base64ToUint8(json.biomesTier2RLE), totalTiles)
    : tier1Biomes;
  const tier3Biomes = json.biomesTier3RLE
    ? rleDecode(base64ToUint8(json.biomesTier3RLE), totalTiles)
    : tier1Biomes;
  return {
    version: json.version,
    seed: json.seed,
    width: json.width,
    height: json.height,
    tileSize: json.tileSize,
    biomes: tier1Biomes,
    biomesByTier: [tier1Biomes, tier2Biomes, tier3Biomes],
    elevation: rleDecode(base64ToUint8(json.elevationRLE), totalTiles),
    moisture: rleDecode(base64ToUint8(json.moistureRLE), totalTiles),
    difficulty: rleDecode(base64ToUint8(json.difficultyRLE), totalTiles),
    rivers: rleDecode(base64ToUint8(json.riversRLE), totalTiles),
    roads: rleDecode(base64ToUint8(json.roadsRLE), totalTiles),
    decorations,
    setpieces: json.setpieces,
    spawnPoints: json.spawnPoints,
    decorationCollision: buildDecorationCollision(decorations, json.width, json.height),
  };
}

// --- Decoration collision grid ---

// Collidable decoration types: trees, large rocks, cacti, ruins
const COLLIDABLE_DECORATIONS: ReadonlySet<number> = new Set([
  DecorationType.TreePalm,   // 0
  DecorationType.TreeOak,    // 1
  DecorationType.TreePine,   // 2
  DecorationType.TreeDead,   // 3
  DecorationType.RockLarge,  // 5
  DecorationType.Cactus,     // 7
  DecorationType.Ruins,      // 11
]);

export function buildDecorationCollision(
  decorations: DecorationEntry[],
  width: number,
  height: number
): Uint8Array {
  const grid = new Uint8Array(width * height);
  for (const deco of decorations) {
    if (COLLIDABLE_DECORATIONS.has(deco.type)) {
      grid[deco.tileY * width + deco.tileX] = 1;
    }
  }
  return grid;
}

// --- Runtime global map state ---

let loadedMap: RealmMapData | null = null;
let activeRealmTier: number = RealmTier.Wild;

/** Set the active realm tier for biome lookups (client-side). */
export function setActiveRealmTier(tier: number): void {
  activeRealmTier = tier;
}

export function getActiveRealmTier(): number {
  return activeRealmTier;
}

export function setRealmMap(data: RealmMapData): void {
  // Build collision grid if not already present (server generates maps without it)
  if (!data.decorationCollision) {
    data.decorationCollision = buildDecorationCollision(data.decorations, data.width, data.height);
  }
  loadedMap = data;
}

export function getRealmMap(): RealmMapData | null {
  return loadedMap;
}

// --- Tile lookup helpers ---

function pixelToTile(px: number): number {
  return Math.floor(px / HOSTILE_TILE_SIZE);
}

function tileIndex(tx: number, ty: number, width: number): number {
  return ty * width + tx;
}

function isInBounds(tx: number, ty: number): boolean {
  return tx >= 0 && tx < HOSTILE_TILES && ty >= 0 && ty < HOSTILE_TILES;
}

export function getRealmBiomeAt(px: number, py: number): RealmBiome {
  if (!loadedMap) return RealmBiome.WildOcean;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return RealmBiome.WildOcean;
  const biomeArray = loadedMap.biomesByTier?.[activeRealmTier - 1] ?? loadedMap.biomes;
  return biomeArray[tileIndex(tx, ty, loadedMap.width)] as RealmBiome;
}

/** Get biome at a pixel position for a specific realm tier (server-side). */
export function getRealmBiomeAtForTier(px: number, py: number, tier: number): RealmBiome {
  if (!loadedMap) return RealmBiome.WildOcean;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return RealmBiome.WildOcean;
  const biomeArray = loadedMap.biomesByTier?.[tier - 1] ?? loadedMap.biomes;
  return biomeArray[tileIndex(tx, ty, loadedMap.width)] as RealmBiome;
}

export function getDifficultyAt(px: number, py: number): DifficultyZone {
  if (!loadedMap) return DifficultyZone.Shore;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return DifficultyZone.Shore;
  return loadedMap.difficulty[tileIndex(tx, ty, loadedMap.width)] as DifficultyZone;
}

export function getElevationAt(px: number, py: number): number {
  if (!loadedMap) return 0;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return 0;
  return loadedMap.elevation[tileIndex(tx, ty, loadedMap.width)] / 255;
}

/** All water biome IDs across all tiers. */
const WATER_BIOMES: ReadonlySet<number> = new Set([
  RealmBiome.WildOcean, RealmBiome.WildShallows,
  RealmBiome.RuinsOcean, RealmBiome.RuinsShallows,
  RealmBiome.HellOcean, RealmBiome.HellLava,
]);

export function isWaterBiome(biome: number): boolean {
  return WATER_BIOMES.has(biome);
}

export function isWaterTile(px: number, py: number): boolean {
  return isWaterBiome(getRealmBiomeAt(px, py));
}

export function isHostileTileWalkable(px: number, py: number): boolean {
  return !isWaterTile(px, py);
}

export function isRiverAt(px: number, py: number): boolean {
  if (!loadedMap) return false;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return false;
  return loadedMap.rivers[tileIndex(tx, ty, loadedMap.width)] > 0;
}

export function isRoadAt(px: number, py: number): boolean {
  if (!loadedMap) return false;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return false;
  return loadedMap.roads[tileIndex(tx, ty, loadedMap.width)] > 0;
}

export function isDecorationCollisionAt(px: number, py: number): boolean {
  if (!loadedMap || !loadedMap.decorationCollision) return false;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return false;
  return loadedMap.decorationCollision[tileIndex(tx, ty, loadedMap.width)] > 0;
}

// --- Decoration collision (circle-vs-tile-AABB, same pattern as water collision) ---

export function resolveDecorationCollision(
  px: number,
  py: number,
  radius: number
): { x: number; y: number } {
  if (!loadedMap || !loadedMap.decorationCollision) return { x: px, y: py };

  let resolvedX = px;
  let resolvedY = py;
  const ts = HOSTILE_TILE_SIZE;

  // Two passes for corner resolution
  for (let pass = 0; pass < 2; pass++) {
    const minTX = Math.max(0, Math.floor((resolvedX - radius) / ts));
    const maxTX = Math.min(HOSTILE_TILES - 1, Math.floor((resolvedX + radius) / ts));
    const minTY = Math.max(0, Math.floor((resolvedY - radius) / ts));
    const maxTY = Math.min(HOSTILE_TILES - 1, Math.floor((resolvedY + radius) / ts));

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (loadedMap.decorationCollision[tileIndex(tx, ty, loadedMap.width)] === 0) {
          continue;
        }

        // Decoration tile AABB
        const wallLeft = tx * ts;
        const wallRight = (tx + 1) * ts;
        const wallTop = ty * ts;
        const wallBottom = (ty + 1) * ts;

        // Find nearest point on tile AABB to circle center
        const nearestX = Math.max(wallLeft, Math.min(resolvedX, wallRight));
        const nearestY = Math.max(wallTop, Math.min(resolvedY, wallBottom));

        const dx = resolvedX - nearestX;
        const dy = resolvedY - nearestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          if (distSq > 0) {
            const dist = Math.sqrt(distSq);
            const overlap = radius - dist;
            resolvedX += (dx / dist) * overlap;
            resolvedY += (dy / dist) * overlap;
          } else {
            // Center inside decoration tile - push to nearest edge
            const pushLeft = resolvedX - wallLeft;
            const pushRight = wallRight - resolvedX;
            const pushTop = resolvedY - wallTop;
            const pushBottom = wallBottom - resolvedY;
            const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);
            if (minPush === pushLeft) resolvedX = wallLeft - radius;
            else if (minPush === pushRight) resolvedX = wallRight + radius;
            else if (minPush === pushTop) resolvedY = wallTop - radius;
            else resolvedY = wallBottom + radius;
          }
        }
      }
    }
  }

  return { x: resolvedX, y: resolvedY };
}

// --- Water collision (same pattern as resolveWallCollision in dungeonMap.ts) ---

export function resolveHostileCollision(
  px: number,
  py: number,
  radius: number
): { x: number; y: number } {
  if (!loadedMap) return { x: px, y: py };

  let resolvedX = px;
  let resolvedY = py;
  const ts = HOSTILE_TILE_SIZE;

  // Two passes for corner resolution
  for (let pass = 0; pass < 2; pass++) {
    const minTX = Math.max(0, Math.floor((resolvedX - radius) / ts));
    const maxTX = Math.min(HOSTILE_TILES - 1, Math.floor((resolvedX + radius) / ts));
    const minTY = Math.max(0, Math.floor((resolvedY - radius) / ts));
    const maxTY = Math.min(HOSTILE_TILES - 1, Math.floor((resolvedY + radius) / ts));

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        const biome = loadedMap.biomes[tileIndex(tx, ty, loadedMap.width)];
        // Only collide with blocking water tiles
        if (!isWaterBiome(biome)) {
          continue;
        }

        // Water tile AABB
        const wallLeft = tx * ts;
        const wallRight = (tx + 1) * ts;
        const wallTop = ty * ts;
        const wallBottom = (ty + 1) * ts;

        // Find nearest point on tile AABB to circle center
        const nearestX = Math.max(wallLeft, Math.min(resolvedX, wallRight));
        const nearestY = Math.max(wallTop, Math.min(resolvedY, wallBottom));

        const dx = resolvedX - nearestX;
        const dy = resolvedY - nearestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          if (distSq > 0) {
            const dist = Math.sqrt(distSq);
            const overlap = radius - dist;
            resolvedX += (dx / dist) * overlap;
            resolvedY += (dy / dist) * overlap;
          } else {
            // Center inside water tile - push to nearest edge
            const pushLeft = resolvedX - wallLeft;
            const pushRight = wallRight - resolvedX;
            const pushTop = resolvedY - wallTop;
            const pushBottom = wallBottom - resolvedY;
            const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);
            if (minPush === pushLeft) resolvedX = wallLeft - radius;
            else if (minPush === pushRight) resolvedX = wallRight + radius;
            else if (minPush === pushTop) resolvedY = wallTop - radius;
            else resolvedY = wallBottom + radius;
          }
        }
      }
    }
  }

  return { x: resolvedX, y: resolvedY };
}

// --- Difficulty zone from elevation ---

export function getDifficultyZoneFromElevation(elevation: number): DifficultyZone {
  if (elevation < 0.15) return DifficultyZone.Shore;
  if (elevation < 0.35) return DifficultyZone.Lowlands;
  if (elevation < 0.55) return DifficultyZone.Midlands;
  if (elevation < 0.75) return DifficultyZone.Highlands;
  return DifficultyZone.Godlands;
}

// --- Biome visual config ---

export interface RealmBiomeVisual {
  groundFill: number;
  name: string;
}

export const REALM_BIOME_VISUALS: Record<number, RealmBiomeVisual> = {
  // ===== TIER 1: THE WILD =====
  [RealmBiome.WildOcean]: { groundFill: 0x0a1a3e, name: "Ocean" },
  [RealmBiome.WildShallows]: { groundFill: 0x1a3a5e, name: "Shallows" },
  [RealmBiome.WildShore]: { groundFill: 0xc2b280, name: "Shore" },
  [RealmBiome.WildMeadow]: { groundFill: 0x3a6a2a, name: "Meadow" },
  [RealmBiome.WildMarsh]: { groundFill: 0x3a5a3a, name: "Marsh" },
  [RealmBiome.WildPlains]: { groundFill: 0x9a8a4a, name: "Plains" },
  [RealmBiome.WildForest]: { groundFill: 0x1a4a1a, name: "Forest" },
  [RealmBiome.WildJungle]: { groundFill: 0x0a3a1a, name: "Jungle" },
  [RealmBiome.WildDesert]: { groundFill: 0xc4a44a, name: "Desert" },
  [RealmBiome.WildTaiga]: { groundFill: 0x2a4a3a, name: "Taiga" },
  [RealmBiome.WildCliffs]: { groundFill: 0x8a5a2a, name: "Cliffs" },
  [RealmBiome.WildShrubland]: { groundFill: 0x6a6a3a, name: "Shrubland" },
  [RealmBiome.WildTundra]: { groundFill: 0x7a8a8a, name: "Tundra" },
  [RealmBiome.WildPeaks]: { groundFill: 0xd0d8e0, name: "Peaks" },
  [RealmBiome.WildVolcanic]: { groundFill: 0x4a2a1a, name: "Volcanic" },

  // ===== TIER 2: THE RUINS =====
  [RealmBiome.RuinsOcean]: { groundFill: 0x0a152e, name: "Dark Sea" },
  [RealmBiome.RuinsShallows]: { groundFill: 0x1a2a4e, name: "Stagnant Water" },
  [RealmBiome.RuinsShore]: { groundFill: 0x7a7060, name: "Ashen Shore" },
  [RealmBiome.RuinsDustlands]: { groundFill: 0x8a7a5a, name: "Dustlands" },
  [RealmBiome.RuinsBog]: { groundFill: 0x3a4a2a, name: "Bog" },
  [RealmBiome.RuinsBarrens]: { groundFill: 0x6a5a3a, name: "Barrens" },
  [RealmBiome.RuinsCatacombs]: { groundFill: 0x4a3a2a, name: "Catacombs" },
  [RealmBiome.RuinsWasteland]: { groundFill: 0x5a4a3a, name: "Wasteland" },
  [RealmBiome.RuinsDesolation]: { groundFill: 0x3a3a3a, name: "Desolation" },
  [RealmBiome.RuinsObsidian]: { groundFill: 0x2a2a3a, name: "Obsidian" },
  [RealmBiome.RuinsFrostfall]: { groundFill: 0x5a6a7a, name: "Frostfall" },
  [RealmBiome.RuinsAshlands]: { groundFill: 0x5a4a4a, name: "Ashlands" },
  [RealmBiome.RuinsShadowlands]: { groundFill: 0x1a1a2a, name: "Shadowlands" },
  [RealmBiome.RuinsDarkSpire]: { groundFill: 0x2a1a3a, name: "Dark Spire" },
  [RealmBiome.RuinsVoidEdge]: { groundFill: 0x3a2a4a, name: "Void Edge" },

  // ===== TIER 3: DEVINE HELL =====
  [RealmBiome.HellOcean]: { groundFill: 0x1a0a0a, name: "Blood Sea" },
  [RealmBiome.HellLava]: { groundFill: 0x4a1a0a, name: "Lava" },
  [RealmBiome.HellScorch]: { groundFill: 0x3a1a0a, name: "Scorched Coast" },
  [RealmBiome.HellBrimstone]: { groundFill: 0x5a2a1a, name: "Brimstone" },
  [RealmBiome.HellCinder]: { groundFill: 0x4a2a2a, name: "Cinder" },
  [RealmBiome.HellEmberfield]: { groundFill: 0x6a3a1a, name: "Emberfield" },
  [RealmBiome.HellInferno]: { groundFill: 0x6a1a0a, name: "Inferno" },
  [RealmBiome.HellDemonforge]: { groundFill: 0x3a0a1a, name: "Demonforge" },
  [RealmBiome.HellBloodmire]: { groundFill: 0x4a0a0a, name: "Bloodmire" },
  [RealmBiome.HellAbyssal]: { groundFill: 0x1a0a1a, name: "Abyssal" },
  [RealmBiome.HellDoomspire]: { groundFill: 0x2a0a0a, name: "Doomspire" },
  [RealmBiome.HellSoulfire]: { groundFill: 0x3a1a2a, name: "Soulfire" },
  [RealmBiome.HellVoidmaw]: { groundFill: 0x0a0a0a, name: "Voidmaw" },
  [RealmBiome.HellChaosrift]: { groundFill: 0x2a0a2a, name: "Chaosrift" },
  [RealmBiome.HellAnnihilation]: { groundFill: 0x1a0a0a, name: "Annihilation" },
};

// --- Difficulty zone visual config ---

export const DIFFICULTY_ZONE_NAMES: Record<number, string> = {
  [DifficultyZone.Shore]: "Shore",
  [DifficultyZone.Lowlands]: "Lowlands",
  [DifficultyZone.Midlands]: "Midlands",
  [DifficultyZone.Highlands]: "Highlands",
  [DifficultyZone.Godlands]: "Godlands",
};
