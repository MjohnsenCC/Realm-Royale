import { RealmBiome, DifficultyZone, DecorationType } from "./types";
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
  biomes: Uint8Array; // width*height, RealmBiome values
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
  biomesRLE: string; // base64 of RLE-encoded biomes
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
  return {
    version: json.version,
    seed: json.seed,
    width: json.width,
    height: json.height,
    tileSize: json.tileSize,
    biomes: rleDecode(base64ToUint8(json.biomesRLE), totalTiles),
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
  if (!loadedMap) return RealmBiome.Ocean;
  const tx = pixelToTile(px);
  const ty = pixelToTile(py);
  if (!isInBounds(tx, ty)) return RealmBiome.Ocean;
  return loadedMap.biomes[tileIndex(tx, ty, loadedMap.width)] as RealmBiome;
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

export function isWaterTile(px: number, py: number): boolean {
  const biome = getRealmBiomeAt(px, py);
  return (
    biome === RealmBiome.Ocean ||
    biome === RealmBiome.ShallowWater ||
    biome === RealmBiome.Lake
  );
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
        if (
          biome !== RealmBiome.Ocean &&
          biome !== RealmBiome.ShallowWater &&
          biome !== RealmBiome.Lake
        ) {
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
  [RealmBiome.Ocean]: { groundFill: 0x0a1a3e, name: "Ocean" },
  [RealmBiome.ShallowWater]: { groundFill: 0x1a3a5e, name: "Shallow Water" },
  [RealmBiome.Beach]: { groundFill: 0xc2b280, name: "Beach" },
  [RealmBiome.Marsh]: { groundFill: 0x3a5a3a, name: "Marsh" },
  [RealmBiome.Desert]: { groundFill: 0xc4a44a, name: "Desert" },
  [RealmBiome.DryPlains]: { groundFill: 0x9a8a4a, name: "Dry Plains" },
  [RealmBiome.Grassland]: { groundFill: 0x3a6a2a, name: "Grassland" },
  [RealmBiome.Forest]: { groundFill: 0x1a4a1a, name: "Forest" },
  [RealmBiome.Jungle]: { groundFill: 0x0a3a1a, name: "Jungle" },
  [RealmBiome.Shrubland]: { groundFill: 0x6a6a3a, name: "Shrubland" },
  [RealmBiome.Taiga]: { groundFill: 0x2a4a3a, name: "Taiga" },
  [RealmBiome.DesertCliffs]: { groundFill: 0x8a5a2a, name: "Desert Cliffs" },
  [RealmBiome.Tundra]: { groundFill: 0x7a8a8a, name: "Tundra" },
  [RealmBiome.Scorched]: { groundFill: 0x4a2a1a, name: "Scorched" },
  [RealmBiome.Snow]: { groundFill: 0xd0d8e0, name: "Snow" },
  [RealmBiome.Lake]: { groundFill: 0x2a4a6a, name: "Lake" },
};

// --- Difficulty zone visual config ---

export const DIFFICULTY_ZONE_NAMES: Record<number, string> = {
  [DifficultyZone.Shore]: "Shore",
  [DifficultyZone.Lowlands]: "Lowlands",
  [DifficultyZone.Midlands]: "Midlands",
  [DifficultyZone.Highlands]: "Highlands",
  [DifficultyZone.Godlands]: "Godlands",
};
