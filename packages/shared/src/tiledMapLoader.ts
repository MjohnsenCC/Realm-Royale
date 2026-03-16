import { DungeonTile } from "./dungeonMap";
import { TILE_SIZE } from "./constants";

// --- Tiled .tmj parser ---

/** Metadata about the tileset image (for client-side rendering). */
export interface TilesetInfo {
  columns: number;
  tileCount: number;
  tileWidth: number; // source pixel size of each tile in the image
  tileHeight: number;
  imageWidth: number;
  imageHeight: number;
  spacing: number; // pixels between tiles in the tileset image
  margin: number; // pixels around the edge of the tileset image
}

/** A point/rectangle object extracted from a Tiled object layer. */
export interface TiledObjectDef {
  name: string;
  class: string; // "portal", "crafting_table", "spawn_point", etc.
  x: number; // pixel coordinates (in game world space, i.e. TILE_SIZE units)
  y: number;
  properties: Record<string, string | number | boolean>;
}

/** Result of parsing a Tiled .tmj map. */
export interface TiledMapResult {
  /** Binary collision grid: 0 = wall, 1 = floor (matches DungeonTile). */
  collisionGrid: Uint8Array;
  width: number; // in tiles
  height: number; // in tiles
  /** Per-tile local tile ID from the tileset (-1 = empty / no tile). */
  visualTileIds: number[];
  /** Objects from the object layer (portals, spawn points, etc.). */
  objects: TiledObjectDef[];
  /** Tileset image metadata for rendering. */
  tileset: TilesetInfo;
}

/**
 * Optional embedded tileset data. When the .tmj references an external .tsx
 * file, the tileset metadata (tiles, columns, etc.) isn't in the .tmj itself.
 * Pass the parsed .tsx JSON here.
 */
export interface EmbeddedTilesetData {
  columns?: number;
  tilecount?: number;
  tilewidth?: number;
  tileheight?: number;
  imagewidth?: number;
  imageheight?: number;
  spacing?: number;
  margin?: number;
  tiles?: { id: number; class?: string; type?: string }[];
}

// Tiled encodes flip/rotation flags in the upper bits of global tile IDs.
const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
const GID_MASK = ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG) >>> 0;

/**
 * Parse a Tiled .tmj (JSON) map into a TiledMapResult.
 *
 * The map can use any tile size (e.g. 8x8 pixel art). Object coordinates
 * are automatically scaled to game-world coordinates (TILE_SIZE per tile).
 *
 * If the tileset is external (.tsx), pass its data as `externalTileset`.
 */
export function parseTiledMap(
  tmj: any,
  externalTileset?: EmbeddedTilesetData
): TiledMapResult {
  const width: number = tmj.width;
  const height: number = tmj.height;
  const totalTiles = width * height;
  const mapTileWidth: number = tmj.tilewidth;
  const mapTileHeight: number = tmj.tileheight;

  // Scale factor: Tiled pixel coords → game world coords
  const scaleX = TILE_SIZE / mapTileWidth;
  const scaleY = TILE_SIZE / mapTileHeight;

  // --- Find the first tile layer ---
  const tileLayer = tmj.layers.find((l: any) => l.type === "tilelayer");
  if (!tileLayer) throw new Error("Tiled map has no tile layer");
  const data: number[] = tileLayer.data;

  // --- Find the tileset ---
  if (!tmj.tilesets || tmj.tilesets.length === 0) {
    throw new Error("Tiled map has no tilesets");
  }
  const tsRef = tmj.tilesets[0];
  const firstGid: number = tsRef.firstgid;

  // Merge external tileset data if the tileset is referenced externally
  const ts = tsRef.source ? { ...tsRef, ...(externalTileset ?? {}) } : tsRef;

  // Build a lookup: local tile ID → class ("wall" | "floor")
  const tileClassMap = new Map<number, string>();
  if (ts.tiles) {
    for (const tileDef of ts.tiles) {
      if (tileDef.class || tileDef.type) {
        tileClassMap.set(tileDef.id, (tileDef.class || tileDef.type).toLowerCase());
      }
    }
  }

  // --- Build collision grid and visual tile IDs ---
  const collisionGrid = new Uint8Array(totalTiles);
  const visualTileIds: number[] = new Array(totalTiles);

  for (let i = 0; i < totalTiles; i++) {
    const rawGid = data[i];
    if (rawGid === 0) {
      // Empty cell — treat as wall
      collisionGrid[i] = DungeonTile.Wall;
      visualTileIds[i] = -1;
      continue;
    }

    const gid = (rawGid & GID_MASK) >>> 0;
    const localId = gid - firstGid;
    const tileClass = tileClassMap.get(localId);

    if (tileClass === "wall") {
      collisionGrid[i] = DungeonTile.Wall;
    } else {
      // Default to floor if class is "floor" or unset
      collisionGrid[i] = DungeonTile.Floor;
    }

    visualTileIds[i] = localId;
  }

  // --- Extract objects from object layers ---
  const objects: TiledObjectDef[] = [];
  for (const layer of tmj.layers) {
    if (layer.type !== "objectgroup") continue;
    for (const obj of layer.objects) {
      const props: Record<string, string | number | boolean> = {};
      if (obj.properties) {
        for (const p of obj.properties) {
          // Handle malformed properties where name contains "key: value"
          const parsed = parsePropertyEntry(p.name, p.value);
          props[parsed.key] = parsed.value;
        }
      }
      objects.push({
        name: obj.name || "",
        class: (obj.class || obj.type || "").toLowerCase(),
        // Scale from Tiled pixel coords to game world coords
        x: obj.x * scaleX,
        y: obj.y * scaleY,
        properties: props,
      });
    }
  }

  // --- Extract tileset info ---
  const tileset: TilesetInfo = {
    columns: ts.columns ?? 1,
    tileCount: ts.tilecount ?? 1,
    tileWidth: ts.tilewidth ?? mapTileWidth,
    tileHeight: ts.tileheight ?? mapTileHeight,
    imageWidth: ts.imagewidth ?? ts.tilewidth ?? mapTileWidth,
    imageHeight: ts.imageheight ?? ts.tileheight ?? mapTileHeight,
    spacing: ts.spacing ?? 0,
    margin: ts.margin ?? 0,
  };

  return { collisionGrid, width, height, visualTileIds, objects, tileset };
}

/**
 * Parse a property entry, handling malformed formats like:
 *   name='portalType: "NexusToHostile"\n', value=''
 * which should become key='portalType', value='NexusToHostile'
 */
function parsePropertyEntry(
  name: string,
  value: string | number | boolean
): { key: string; value: string | number | boolean } {
  // Normal case: name is just a key, value is the value
  if (typeof value === "number" || typeof value === "boolean") {
    return { key: name.trim(), value };
  }
  if (typeof value === "string" && value !== "") {
    return { key: name.trim(), value };
  }

  // Malformed case: name contains "key: value" or 'key: "value"'
  const trimmed = name.trim().replace(/\n$/, "");
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx > 0) {
    const key = trimmed.substring(0, colonIdx).trim();
    let val = trimmed.substring(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    return { key, value: val };
  }

  // Fallback: use as-is
  return { key: trimmed, value: value ?? "" };
}

// --- Helper functions ---

/** Find all objects with a given class (e.g., "portal", "crafting_table"). */
export function findObjectsByClass(
  objects: TiledObjectDef[],
  objectClass: string
): TiledObjectDef[] {
  const lc = objectClass.toLowerCase();
  return objects.filter((o) => o.class === lc);
}

/** Find the first object with a given class. */
export function findObjectByClass(
  objects: TiledObjectDef[],
  objectClass: string
): TiledObjectDef | undefined {
  const lc = objectClass.toLowerCase();
  return objects.find((o) => o.class === lc);
}

/** Get a typed custom property from an object. */
export function getObjectProperty<T extends string | number | boolean>(
  obj: TiledObjectDef,
  key: string
): T | undefined {
  return obj.properties[key] as T | undefined;
}
