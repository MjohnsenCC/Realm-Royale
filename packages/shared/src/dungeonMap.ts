import { TILE_SIZE } from "./constants";
import { DungeonType } from "./types";

// --- Tile Types ---

export const DungeonTile = {
  Wall: 0,
  Floor: 1,
} as const;
export type DungeonTileType = (typeof DungeonTile)[keyof typeof DungeonTile];

// --- Dungeon Map Dimensions (in tiles) --- (legacy defaults)

export const DUNGEON_TILES_X = 20;
export const DUNGEON_TILES_Y = 36;

// --- Per-Dungeon-Type Configuration ---

export interface DungeonConfig {
  tilesX: number;
  tilesY: number;
  spawnW: [number, number]; // [min, max] for randInt
  spawnH: [number, number];
  normalW: [number, number];
  normalH: [number, number];
  bossW: [number, number];
  bossH: [number, number];
}

export const DUNGEON_CONFIGS: Record<number, DungeonConfig> = {
  [DungeonType.InfernalPit]: {
    tilesX: 36,
    tilesY: 64,
    spawnW: [9, 12],
    spawnH: [8, 9],
    normalW: [9, 12],
    normalH: [8, 10],
    bossW: [17, 20],
    bossH: [14, 16],
  },
  [DungeonType.VoidSanctum]: {
    tilesX: 44,
    tilesY: 80,
    spawnW: [12, 14],
    spawnH: [10, 12],
    normalW: [12, 14],
    normalH: [10, 13],
    bossW: [20, 24],
    bossH: [17, 20],
  },
};

// --- Interfaces ---

export interface DungeonRoom {
  x: number; // tile x of room top-left
  y: number; // tile y of room top-left
  w: number; // room width in tiles
  h: number; // room height in tiles
  centerX: number; // pixel center X
  centerY: number; // pixel center Y
  type: "spawn" | "normal" | "boss";
}

export interface DungeonMapData {
  tiles: Uint8Array;
  width: number; // in tiles
  height: number; // in tiles
  rooms: DungeonRoom[];
  spawnRoom: DungeonRoom;
  bossRoom: DungeonRoom;
}

// --- Seeded PRNG (mulberry32) ---

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Map Generation ---

export function generateDungeonMap(seed: number, dungeonType?: number): DungeonMapData {
  const config = DUNGEON_CONFIGS[dungeonType ?? DungeonType.InfernalPit] ?? DUNGEON_CONFIGS[DungeonType.InfernalPit];
  const rng = mulberry32(seed);
  const W = config.tilesX;
  const H = config.tilesY;
  const tiles = new Uint8Array(W * H); // all Wall=0

  const rooms: DungeonRoom[] = [];

  // Helper: random int in [min, max] inclusive
  function randInt(min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
  }

  // Helper: clamp tile coordinate
  function clampTX(tx: number): number {
    return Math.max(1, Math.min(W - 2, tx));
  }
  function clampTY(ty: number): number {
    return Math.max(1, Math.min(H - 2, ty));
  }

  // Helper: carve a room into the tile grid
  function carveRoom(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    type: "spawn" | "normal" | "boss"
  ): DungeonRoom {
    // Ensure room fits within grid (1-tile border from edges)
    const x = Math.max(1, Math.min(rx, W - rw - 1));
    const y = Math.max(1, Math.min(ry, H - rh - 1));
    const w = Math.min(rw, W - x - 1);
    const h = Math.min(rh, H - y - 1);

    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        tiles[ty * W + tx] = DungeonTile.Floor;
      }
    }

    return {
      x,
      y,
      w,
      h,
      centerX: (x + w / 2) * TILE_SIZE,
      centerY: (y + h / 2) * TILE_SIZE,
      type,
    };
  }

  // Helper: carve a horizontal line of floor tiles (2 tiles wide)
  function carveHLine(x1: number, x2: number, y: number): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      const cx = clampTX(x);
      const cy = clampTY(y);
      tiles[cy * W + cx] = DungeonTile.Floor;
      if (cy + 1 < H - 1) tiles[(cy + 1) * W + cx] = DungeonTile.Floor;
    }
  }

  // Helper: carve a vertical line of floor tiles (2 tiles wide)
  function carveVLine(x: number, y1: number, y2: number): void {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const cx = clampTX(x);
      const cy = clampTY(y);
      tiles[cy * W + cx] = DungeonTile.Floor;
      if (cx + 1 < W - 1) tiles[cy * W + (cx + 1)] = DungeonTile.Floor;
    }
  }

  // Helper: carve L-shaped corridor between two rooms
  function carveCorridor(from: DungeonRoom, to: DungeonRoom): void {
    const fromCX = Math.floor(from.x + from.w / 2);
    const fromCY = Math.floor(from.y + from.h / 2);
    const toCX = Math.floor(to.x + to.w / 2);
    const toCY = Math.floor(to.y + to.h / 2);

    // Randomly choose horizontal-first or vertical-first
    if (rng() > 0.5) {
      carveHLine(fromCX, toCX, fromCY);
      carveVLine(toCX, fromCY, toCY);
    } else {
      carveVLine(fromCX, fromCY, toCY);
      carveHLine(fromCX, toCX, toCY);
    }
  }

  // --- Place rooms ---

  // Spawn room (bottom area)
  const spawnW = randInt(config.spawnW[0], config.spawnW[1]);
  const spawnH = randInt(config.spawnH[0], config.spawnH[1]);
  const spawnX = Math.floor((W - spawnW) / 2) + randInt(-2, 2);
  const spawnY = H - spawnH - 2;
  const spawnRoom = carveRoom(spawnX, spawnY, spawnW, spawnH, "spawn");
  rooms.push(spawnRoom);

  // Room 1: offset to one side
  const r1W = randInt(config.normalW[0], config.normalW[1]);
  const r1H = randInt(config.normalH[0], config.normalH[1]);
  const r1Left = rng() > 0.5;
  const r1X = r1Left ? randInt(1, 3) : randInt(W - r1W - 3, W - r1W - 1);
  const r1Y = spawnRoom.y - r1H - randInt(2, 4);
  const room1 = carveRoom(r1X, r1Y, r1W, r1H, "normal");
  rooms.push(room1);
  carveCorridor(spawnRoom, room1);

  // Room 2: offset to the other side
  const r2W = randInt(config.normalW[0], config.normalW[1]);
  const r2H = randInt(config.normalH[0], config.normalH[1]);
  const r2X = r1Left
    ? randInt(W - r2W - 3, W - r2W - 1)
    : randInt(1, 3);
  const r2Y = room1.y - r2H - randInt(2, 4);
  const room2 = carveRoom(r2X, r2Y, r2W, r2H, "normal");
  rooms.push(room2);
  carveCorridor(room1, room2);

  // Room 3: center-ish (must leave space for boss room above)
  const r3W = randInt(config.normalW[0], config.normalW[1]);
  const r3H = randInt(config.normalH[0], config.normalH[1]);
  const r3X = Math.floor((W - r3W) / 2) + randInt(-2, 2);
  const r3Y = Math.max(Math.floor(H / 3), room2.y - r3H - randInt(2, 4));
  const room3 = carveRoom(r3X, r3Y, r3W, r3H, "normal");
  rooms.push(room3);
  carveCorridor(room2, room3);

  // Boss room (above room 3, larger)
  const bossW = randInt(config.bossW[0], config.bossW[1]);
  const bossH = randInt(config.bossH[0], config.bossH[1]);
  const bossX = Math.floor((W - bossW) / 2);
  const bossY = Math.max(2, room3.y - bossH - randInt(2, 3));
  const bossRoom = carveRoom(bossX, bossY, bossW, bossH, "boss");
  rooms.push(bossRoom);
  carveCorridor(room3, bossRoom);

  return { tiles, width: W, height: H, rooms, spawnRoom, bossRoom };
}

// --- Line-of-Sight ---

/**
 * Check if there is an unobstructed line of sight between two pixel positions.
 * Uses Bresenham's line algorithm (supercover variant) over the tile grid.
 * Returns true if no wall tile blocks the line.
 */
export function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mapData: DungeonMapData
): boolean {
  const { tiles, width, height } = mapData;

  let tx1 = Math.floor(x1 / TILE_SIZE);
  let ty1 = Math.floor(y1 / TILE_SIZE);
  const tx2 = Math.floor(x2 / TILE_SIZE);
  const ty2 = Math.floor(y2 / TILE_SIZE);

  const dx = Math.abs(tx2 - tx1);
  const dy = Math.abs(ty2 - ty1);
  const sx = tx1 < tx2 ? 1 : -1;
  const sy = ty1 < ty2 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    // Check current tile
    if (tx1 < 0 || tx1 >= width || ty1 < 0 || ty1 >= height) return false;
    if (tiles[ty1 * width + tx1] === DungeonTile.Wall) return false;

    // Reached target tile
    if (tx1 === tx2 && ty1 === ty2) return true;

    const e2 = 2 * err;

    // Supercover: at diagonal steps, check both adjacent tiles
    // to prevent seeing through diagonal wall corners
    if (e2 > -dy && e2 < dx) {
      const nx = tx1 + sx;
      const ny = ty1 + sy;
      const horizWall =
        nx >= 0 && nx < width && tiles[ty1 * width + nx] === DungeonTile.Wall;
      const vertWall =
        ny >= 0 && ny < height && tiles[ny * width + tx1] === DungeonTile.Wall;
      if (horizWall && vertWall) return false;
    }

    if (e2 > -dy) {
      err -= dy;
      tx1 += sx;
    }
    if (e2 < dx) {
      err += dx;
      ty1 += sy;
    }
  }
}

// --- Collision Helpers ---

/**
 * Check if a pixel position is on a walkable floor tile.
 */
export function isTileWalkable(
  px: number,
  py: number,
  mapData: DungeonMapData
): boolean {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || tx >= mapData.width || ty < 0 || ty >= mapData.height)
    return false;
  return mapData.tiles[ty * mapData.width + tx] === DungeonTile.Floor;
}

/**
 * Resolve wall collision for a circle at (px, py) with given radius.
 * Pushes the entity out of any overlapping wall tiles.
 */
export function resolveWallCollision(
  px: number,
  py: number,
  radius: number,
  mapData: DungeonMapData
): { x: number; y: number } {
  const { tiles, width, height } = mapData;

  let resolvedX = px;
  let resolvedY = py;

  // Run two passes for better corner resolution
  for (let pass = 0; pass < 2; pass++) {
    const minTX = Math.max(0, Math.floor((resolvedX - radius) / TILE_SIZE));
    const maxTX = Math.min(
      width - 1,
      Math.floor((resolvedX + radius) / TILE_SIZE)
    );
    const minTY = Math.max(0, Math.floor((resolvedY - radius) / TILE_SIZE));
    const maxTY = Math.min(
      height - 1,
      Math.floor((resolvedY + radius) / TILE_SIZE)
    );

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (tiles[ty * width + tx] !== DungeonTile.Wall) continue;

        // Wall tile AABB
        const wallLeft = tx * TILE_SIZE;
        const wallRight = (tx + 1) * TILE_SIZE;
        const wallTop = ty * TILE_SIZE;
        const wallBottom = (ty + 1) * TILE_SIZE;

        // Find nearest point on wall AABB to circle center
        const nearestX = Math.max(wallLeft, Math.min(resolvedX, wallRight));
        const nearestY = Math.max(wallTop, Math.min(resolvedY, wallBottom));

        const dx = resolvedX - nearestX;
        const dy = resolvedY - nearestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          if (distSq > 0) {
            // Push entity out of wall
            const dist = Math.sqrt(distSq);
            const overlap = radius - dist;
            resolvedX += (dx / dist) * overlap;
            resolvedY += (dy / dist) * overlap;
          } else {
            // Center is inside wall tile - push to nearest edge
            const pushLeft = resolvedX - wallLeft;
            const pushRight = wallRight - resolvedX;
            const pushTop = resolvedY - wallTop;
            const pushBottom = wallBottom - resolvedY;
            const minPush = Math.min(
              pushLeft,
              pushRight,
              pushTop,
              pushBottom
            );
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
