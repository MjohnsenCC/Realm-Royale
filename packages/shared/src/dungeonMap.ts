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
  // Circular room support (VoidSanctum)
  circularRooms?: boolean;
  corridorWidth?: number; // default 2
  spawnRadius?: [number, number];
  normalRadius?: [number, number];
  bossRadius?: [number, number];
  switchRadius?: [number, number];
}

export const DUNGEON_CONFIGS: Record<number, DungeonConfig> = {
  [DungeonType.InfernalPit]: {
    tilesX: 56,
    tilesY: 230,
    spawnW: [9, 12],
    spawnH: [8, 9],
    normalW: [9, 12],
    normalH: [8, 10],
    bossW: [17, 20],
    bossH: [14, 16],
    corridorWidth: 3,
  },
  [DungeonType.VoidSanctum]: {
    tilesX: 64,
    tilesY: 120,
    spawnW: [12, 14],
    spawnH: [12, 14],
    normalW: [12, 14],
    normalH: [12, 14],
    bossW: [22, 26],
    bossH: [22, 26],
    circularRooms: true,
    corridorWidth: 3,
    spawnRadius: [6, 7],
    normalRadius: [6, 7],
    bossRadius: [11, 13],
    switchRadius: [4, 5],
  },
};

// --- Interfaces ---

export interface DungeonRoom {
  x: number; // tile x of room top-left (bounding box)
  y: number; // tile y of room top-left (bounding box)
  w: number; // room width in tiles (bounding box)
  h: number; // room height in tiles (bounding box)
  centerX: number; // pixel center X
  centerY: number; // pixel center Y
  type: "spawn" | "normal" | "boss" | "switch";
}

export interface DungeonMapData {
  tiles: Uint8Array;
  width: number; // in tiles
  height: number; // in tiles
  rooms: DungeonRoom[];
  spawnRoom: DungeonRoom;
  bossRoom: DungeonRoom;
  switchRooms?: DungeonRoom[];
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

// --- Runtime dimension cache (set by generateDungeonMap, used by getZoneDimensions) ---

const generatedDungeonDims = new Map<number, { width: number; height: number }>();

/** Get the actual generated map dimensions for a dungeon type (in tiles). */
export function getGeneratedDungeonDimensions(
  dungeonType: number
): { width: number; height: number } | undefined {
  return generatedDungeonDims.get(dungeonType);
}

// --- Map Generation ---

export function generateDungeonMap(seed: number, dungeonType?: number): DungeonMapData {
  const dType = dungeonType ?? DungeonType.InfernalPit;
  const config = DUNGEON_CONFIGS[dType] ?? DUNGEON_CONFIGS[DungeonType.InfernalPit];
  const rng = mulberry32(seed);
  let W = config.tilesX;
  let H = config.tilesY;
  let tiles = new Uint8Array(W * H); // all Wall=0
  const corridorW = config.corridorWidth ?? 2;

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

  // Helper: carve a rectangular room into the tile grid
  function carveRoom(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    type: "spawn" | "normal" | "boss" | "switch"
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

  // Helper: carve a circular room into the tile grid
  function carveCircularRoom(
    cx: number,
    cy: number,
    radius: number,
    type: "spawn" | "normal" | "boss" | "switch"
  ): DungeonRoom {
    // Clamp center so circle fits within grid (1-tile border)
    const clampedCX = Math.max(radius + 1, Math.min(W - radius - 2, cx));
    const clampedCY = Math.max(radius + 1, Math.min(H - radius - 2, cy));
    const rSq = radius * radius;

    for (let ty = clampedCY - radius; ty <= clampedCY + radius; ty++) {
      for (let tx = clampedCX - radius; tx <= clampedCX + radius; tx++) {
        const dx = tx - clampedCX;
        const dy = ty - clampedCY;
        if (dx * dx + dy * dy <= rSq) {
          if (tx >= 1 && tx < W - 1 && ty >= 1 && ty < H - 1) {
            tiles[ty * W + tx] = DungeonTile.Floor;
          }
        }
      }
    }

    // Bounding box for compatibility
    const bx = clampedCX - radius;
    const by = clampedCY - radius;
    const bw = radius * 2;
    const bh = radius * 2;

    return {
      x: bx,
      y: by,
      w: bw,
      h: bh,
      centerX: clampedCX * TILE_SIZE + TILE_SIZE / 2,
      centerY: clampedCY * TILE_SIZE + TILE_SIZE / 2,
      type,
    };
  }

  // Helper: carve a horizontal line of floor tiles
  function carveHLine(x1: number, x2: number, y: number, width: number = 2): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const halfW = Math.floor(width / 2);
    for (let x = minX; x <= maxX; x++) {
      for (let dy = -halfW; dy < width - halfW; dy++) {
        const cx = clampTX(x);
        const cy = clampTY(y + dy);
        tiles[cy * W + cx] = DungeonTile.Floor;
      }
    }
  }

  // Helper: carve a vertical line of floor tiles
  function carveVLine(x: number, y1: number, y2: number, width: number = 2): void {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const halfW = Math.floor(width / 2);
    for (let y = minY; y <= maxY; y++) {
      for (let dx = -halfW; dx < width - halfW; dx++) {
        const cx = clampTX(x + dx);
        const cy = clampTY(y);
        tiles[cy * W + cx] = DungeonTile.Floor;
      }
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
      carveHLine(fromCX, toCX, fromCY, corridorW);
      carveVLine(toCX, fromCY, toCY, corridorW);
    } else {
      carveVLine(fromCX, fromCY, toCY, corridorW);
      carveHLine(fromCX, toCX, toCY, corridorW);
    }
  }

  // --- Void Sanctum: two-phase dynamic generation with circular rooms ---
  if (dType === DungeonType.VoidSanctum) {
    const spawnR = randInt(config.spawnRadius![0], config.spawnRadius![1]);
    const normalR = config.normalRadius!;
    const bossR = randInt(config.bossRadius![0], config.bossRadius![1]);
    const switchR = config.switchRadius!;

    // Phase 1: Position all rooms in unbounded space (no grid constraints)
    interface CircularPlacement {
      cx: number; cy: number; radius: number;
      type: "spawn" | "normal" | "boss" | "switch";
    }
    const circPlacements: CircularPlacement[] = [];
    const circLinks: [number, number][] = [];

    // Room 0: Spawn room (origin)
    const spawnCX = randInt(-2, 2);
    const spawnCY = 0;
    circPlacements.push({ cx: spawnCX, cy: spawnCY, radius: spawnR, type: "spawn" });

    // Room 1: offset to one side, above spawn
    const r1R = randInt(normalR[0], normalR[1]);
    const r1Left = rng() > 0.5;
    const r1CX = r1Left ? randInt(-20, -r1R - 3) : randInt(r1R + 3, 20);
    const r1CY = spawnCY - spawnR - r1R - randInt(1, 2);
    circPlacements.push({ cx: r1CX, cy: r1CY, radius: r1R, type: "normal" });
    circLinks.push([0, 1]);

    // Room 2: offset to the other side, above room 1
    const r2R = randInt(normalR[0], normalR[1]);
    const r2CX = r1Left ? randInt(r2R + 3, 20) : randInt(-20, -r2R - 3);
    const r2CY = r1CY - r1R - r2R - randInt(1, 2);
    circPlacements.push({ cx: r2CX, cy: r2CY, radius: r2R, type: "normal" });
    circLinks.push([1, 2]);

    // Room 3: center-ish crossroads (connects to switchA and preBoss)
    const r3R = randInt(normalR[0], normalR[1]);
    const r3CX = randInt(-3, 3);
    const r3CY = r2CY - r2R - r3R - randInt(1, 2);
    circPlacements.push({ cx: r3CX, cy: r3CY, radius: r3R, type: "normal" });
    circLinks.push([2, 3]);

    // Room 4: switchRoomA (dead-end branch from room3)
    const sAR = randInt(switchR[0], switchR[1]);
    const sACX = r1Left ? randInt(-25, -15) : randInt(15, 25);
    const sACY = r3CY + randInt(-2, 2);
    circPlacements.push({ cx: sACX, cy: sACY, radius: sAR, type: "switch" });
    circLinks.push([3, 4]);

    // Room 5: preBoss room (above room3, center)
    const pbR = randInt(normalR[0], normalR[1]);
    const pbCX = randInt(-2, 2);
    const pbCY = r3CY - r3R - pbR - randInt(1, 2);
    circPlacements.push({ cx: pbCX, cy: pbCY, radius: pbR, type: "normal" });
    circLinks.push([3, 5]);

    // Room 6: Boss room (large, above preBoss, center)
    const bossCX = 0;
    const bossCY = pbCY - pbR - bossR - randInt(1, 2);
    circPlacements.push({ cx: bossCX, cy: bossCY, radius: bossR, type: "boss" });
    circLinks.push([5, 6]);

    // Room 7: switchRoomB (dead-end branch left from boss)
    const sBR = randInt(switchR[0], switchR[1]);
    const sBCX = randInt(-25, -15);
    const sBCY = bossCY + randInt(-2, 2);
    circPlacements.push({ cx: sBCX, cy: sBCY, radius: sBR, type: "switch" });
    circLinks.push([6, 7]);

    // Room 8: switchRoomC (dead-end branch right from boss)
    const sCR = randInt(switchR[0], switchR[1]);
    const sCCX = randInt(15, 25);
    const sCCY = bossCY + randInt(-2, 2);
    circPlacements.push({ cx: sCCX, cy: sCCY, radius: sCR, type: "switch" });
    circLinks.push([6, 8]);

    // Phase 2: Compute bounding box, resize grid, offset all rooms to fit
    const pad = 4;
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
    for (const r of circPlacements) {
      if (r.cx - r.radius < pMinX) pMinX = r.cx - r.radius;
      if (r.cy - r.radius < pMinY) pMinY = r.cy - r.radius;
      if (r.cx + r.radius > pMaxX) pMaxX = r.cx + r.radius;
      if (r.cy + r.radius > pMaxY) pMaxY = r.cy + r.radius;
    }
    const offX = pad - pMinX;
    const offY = pad - pMinY;
    for (const r of circPlacements) {
      r.cx += offX;
      r.cy += offY;
    }
    W = pMaxX - pMinX + pad * 2;
    H = pMaxY - pMinY + pad * 2;
    tiles = new Uint8Array(W * H);

    // Phase 3: Carve rooms and corridors into the dynamically-sized grid
    let spawnRoom!: DungeonRoom;
    let bossRoom!: DungeonRoom;
    const switchRoomIndices: number[] = [];
    for (let i = 0; i < circPlacements.length; i++) {
      const p = circPlacements[i];
      const room = carveCircularRoom(p.cx, p.cy, p.radius, p.type);
      rooms.push(room);
      if (p.type === "spawn") spawnRoom = room;
      if (p.type === "boss") bossRoom = room;
      if (p.type === "switch") switchRoomIndices.push(i);
    }
    for (const [fromIdx, toIdx] of circLinks) {
      carveCorridor(rooms[fromIdx], rooms[toIdx]);
    }

    const switchRooms = switchRoomIndices.map(i => rooms[i]);
    generatedDungeonDims.set(dType, { width: W, height: H });
    return { tiles, width: W, height: H, rooms, spawnRoom, bossRoom, switchRooms };
  }

  // --- InfernalPit: two-phase generation (position rooms, then compute grid) ---
  // Phase 1: Position all rooms in unbounded space (no grid constraints)

  interface RoomPlacement {
    x: number; y: number; w: number; h: number;
    type: "spawn" | "normal" | "boss";
  }

  const placements: RoomPlacement[] = [];
  const links: [number, number][] = []; // corridor connections as index pairs

  // Overlap check against placed rooms (no grid clamping)
  function placementsOverlap(ax: number, ay: number, aw: number, ah: number): boolean {
    const margin = 2;
    for (const r of placements) {
      if (
        ax < r.x + r.w + margin &&
        ax + aw + margin > r.x &&
        ay < r.y + r.h + margin &&
        ay + ah + margin > r.y
      ) {
        return true;
      }
    }
    return false;
  }

  // Spawn room (reference point at origin)
  const spawnW = randInt(config.spawnW[0], config.spawnW[1]);
  const spawnH = randInt(config.spawnH[0], config.spawnH[1]);
  placements.push({ x: 0, y: 0, w: spawnW, h: spawnH, type: "spawn" });

  // Main path: 8-12 rooms (including spawn, excluding boss)
  const mainPathLen = randInt(8, 12);
  const branchCount = randInt(1, 2);

  // Pick branch point indices along main path
  const branchPoints: number[] = [];
  branchPoints.push(randInt(1, mainPathLen - 1));
  if (branchCount >= 2) {
    let bp2 = randInt(1, mainPathLen - 1);
    let tries = 0;
    while (bp2 === branchPoints[0] && tries < 10) {
      bp2 = randInt(1, mainPathLen - 1);
      tries++;
    }
    branchPoints.push(bp2);
  }

  // Place main path rooms (zigzag upward)
  const mainPathIndices: number[] = [0];
  let zigzagLeft = rng() > 0.5;

  for (let i = 1; i < mainPathLen; i++) {
    const prevIdx = mainPathIndices[mainPathIndices.length - 1];
    const prev = placements[prevIdx];
    const rW = randInt(config.normalW[0], config.normalW[1]);
    const rH = randInt(config.normalH[0], config.normalH[1]);
    const parentCX = prev.x + Math.floor(prev.w / 2);

    const hOffset = randInt(8, 14) * (zigzagLeft ? -1 : 1);
    let rX = parentCX - Math.floor(rW / 2) + hOffset;
    let rY = prev.y - rH - randInt(3, 5);

    for (let attempt = 0; attempt < 5 && placementsOverlap(rX, rY, rW, rH); attempt++) {
      rX = parentCX - Math.floor(rW / 2);
      rY -= 2;
    }

    const idx = placements.length;
    placements.push({ x: rX, y: rY, w: rW, h: rH, type: "normal" });
    links.push([prevIdx, idx]);
    mainPathIndices.push(idx);
    zigzagLeft = !zigzagLeft;
  }

  // Place branch chains (2-4 rooms each, no grid boundary to worry about)
  for (let b = 0; b < branchPoints.length; b++) {
    const parentMainIdx = branchPoints[b];
    let branchParentIdx = mainPathIndices[parentMainIdx];
    const branchLen = randInt(2, 4);
    const goLeft = rng() > 0.5;

    for (let step = 0; step < branchLen; step++) {
      const parent = placements[branchParentIdx];
      const rW = randInt(config.normalW[0], config.normalW[1]);
      const rH = randInt(config.normalH[0], config.normalH[1]);

      const hGap = randInt(2, 4);
      const vGap = randInt(2, 5);
      let rX = goLeft ? parent.x - rW - hGap : parent.x + parent.w + hGap;
      let rY = parent.y - rH - vGap;

      // Collision retries (no clamping needed — grid will fit around rooms)
      if (placementsOverlap(rX, rY, rW, rH)) {
        rX = goLeft ? parent.x + parent.w + hGap : parent.x - rW - hGap;
      }
      if (placementsOverlap(rX, rY, rW, rH)) {
        rY -= randInt(4, 8);
      }
      if (placementsOverlap(rX, rY, rW, rH)) {
        rX = Math.floor(parent.x + parent.w / 2) - Math.floor(rW / 2) + randInt(-6, 6);
        rY = parent.y - rH - randInt(4, 8);
      }
      if (placementsOverlap(rX, rY, rW, rH)) break;

      const idx = placements.length;
      placements.push({ x: rX, y: rY, w: rW, h: rH, type: "normal" });
      links.push([branchParentIdx, idx]);
      branchParentIdx = idx;
    }
  }

  // Boss room: randomly placed above, left, or right of last main path room
  const bW = randInt(config.bossW[0], config.bossW[1]);
  const bH = randInt(config.bossH[0], config.bossH[1]);
  const lastMainIdx = mainPathIndices[mainPathIndices.length - 1];
  const lastMain = placements[lastMainIdx];
  const lmCX = lastMain.x + Math.floor(lastMain.w / 2);
  const lmCY = lastMain.y + Math.floor(lastMain.h / 2);
  const bossDir = randInt(0, 2); // 0 = above, 1 = left, 2 = right
  let bX: number, bY: number;
  if (bossDir === 1) {
    bX = lastMain.x - bW - randInt(3, 5);
    bY = lmCY - Math.floor(bH / 2) + randInt(-3, 3);
  } else if (bossDir === 2) {
    bX = lastMain.x + lastMain.w + randInt(3, 5);
    bY = lmCY - Math.floor(bH / 2) + randInt(-3, 3);
  } else {
    bX = lmCX - Math.floor(bW / 2);
    bY = lastMain.y - bH - randInt(3, 5);
  }
  const bossIdx = placements.length;
  placements.push({ x: bX, y: bY, w: bW, h: bH, type: "boss" });
  links.push([lastMainIdx, bossIdx]);

  // Phase 2: Compute bounding box, resize grid, offset all rooms to fit
  const pad = 4;
  let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
  for (const r of placements) {
    if (r.x < pMinX) pMinX = r.x;
    if (r.y < pMinY) pMinY = r.y;
    if (r.x + r.w > pMaxX) pMaxX = r.x + r.w;
    if (r.y + r.h > pMaxY) pMaxY = r.y + r.h;
  }
  const offX = pad - pMinX;
  const offY = pad - pMinY;
  for (const r of placements) {
    r.x += offX;
    r.y += offY;
  }
  W = pMaxX - pMinX + pad * 2;
  H = pMaxY - pMinY + pad * 2;
  tiles = new Uint8Array(W * H);

  // Phase 3: Carve rooms and corridors into the dynamically-sized grid
  let spawnRoom!: DungeonRoom;
  let bossRoom!: DungeonRoom;
  for (const p of placements) {
    const room = carveRoom(p.x, p.y, p.w, p.h, p.type);
    rooms.push(room);
    if (p.type === "spawn") spawnRoom = room;
    if (p.type === "boss") bossRoom = room;
  }
  for (const [fromIdx, toIdx] of links) {
    carveCorridor(rooms[fromIdx], rooms[toIdx]);
  }

  generatedDungeonDims.set(dType, { width: W, height: H });
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
