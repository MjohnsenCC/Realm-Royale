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
  corridorWidth?: number; // default 2
  // Unified generation params
  roomShape?: "square" | "circular"; // default "square"
  spawnRadius?: [number, number]; // circular room radii
  normalRadius?: [number, number];
  bossRadius?: [number, number];
  mainPathLength?: [number, number]; // [min, max] rooms on main path
  deadEndCount?: [number, number]; // [min, max] dead-end branches
  deadEndLengthMin?: number; // min rooms per dead end
  deadEndLengthMax?: number; // max rooms per dead end
  corridorLength?: number; // gap tiles between rooms
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
    roomShape: "square",
    mainPathLength: [8, 12],
    deadEndCount: [1, 2],
    deadEndLengthMin: 2,
    deadEndLengthMax: 4,
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
    corridorWidth: 3,
    roomShape: "circular",
    spawnRadius: [6, 7],
    normalRadius: [6, 7],
    bossRadius: [11, 13],
    mainPathLength: [5, 7],
    deadEndCount: [2, 3],
    deadEndLengthMin: 1,
    deadEndLengthMax: 2,
  },
  [DungeonType.DeepJungle]: {
    tilesX: 80,
    tilesY: 200,
    spawnW: [10, 10],
    spawnH: [10, 10],
    normalW: [10, 10],
    normalH: [10, 10],
    bossW: [20, 20],
    bossH: [20, 20],
    corridorWidth: 4,
    roomShape: "square",
    mainPathLength: [6, 8],
    deadEndCount: [3, 3],
    deadEndLengthMin: 2,
    deadEndLengthMax: 5,
    corridorLength: 10,
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

  // Helper: carve a rectangular room into the tile grid
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

  // Helper: carve a circular room into the tile grid
  function carveCircularRoom(
    cx: number,
    cy: number,
    radius: number,
    type: "spawn" | "normal" | "boss"
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

  // --- Room-aware corridor helpers ---

  // roomOwner: populated after rooms are carved; each cell stores (roomIndex+1) or 0
  let roomOwner = new Uint8Array(0);

  // Find the closest edge points between two rooms for corridor routing
  function findClosestEdgePoints(a: DungeonRoom, b: DungeonRoom, ap?: RoomPlacement, bp?: RoomPlacement): { sx: number; sy: number; ex: number; ey: number } {
    const aCX = Math.floor(a.x + a.w / 2);
    const aCY = Math.floor(a.y + a.h / 2);
    const bCX = Math.floor(b.x + b.w / 2);
    const bCY = Math.floor(b.y + b.h / 2);

    function clampToRoomEdge(room: DungeonRoom, targetX: number, targetY: number, placement?: RoomPlacement): { x: number; y: number } {
      if (isCircular && placement?.radius) {
        const cx = room.x + Math.floor(room.w / 2);
        const cy = room.y + Math.floor(room.h / 2);
        const dx = targetX - cx;
        const dy = targetY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const r = placement.radius - 1;
        return { x: Math.floor(cx + (dx / dist) * r), y: Math.floor(cy + (dy / dist) * r) };
      }
      // Rectangular: clamp target to room interior edge
      return {
        x: Math.max(room.x + 1, Math.min(room.x + room.w - 2, targetX)),
        y: Math.max(room.y + 1, Math.min(room.y + room.h - 2, targetY)),
      };
    }

    const start = clampToRoomEdge(a, bCX, bCY, ap);
    const end = clampToRoomEdge(b, aCX, aCY, bp);
    return { sx: start.x, sy: start.y, ex: end.x, ey: end.y };
  }

  // BFS pathfinding for corridors — routes around room ownership zones
  function bfsPath(
    sx: number, sy: number, ex: number, ey: number,
    ownerA: number, ownerB: number, allowForeign: boolean
  ): [number, number][] | null {
    const halfW = Math.floor(corridorW / 2);

    function isTraversable(tx: number, ty: number): boolean {
      for (let dy = -halfW; dy < corridorW - halfW; dy++) {
        for (let dx = -halfW; dx < corridorW - halfW; dx++) {
          const cx = tx + dx;
          const cy = ty + dy;
          if (cx < 1 || cx >= W - 1 || cy < 1 || cy >= H - 1) return false;
          const owner = roomOwner[cy * W + cx];
          if (owner !== 0 && owner !== ownerA && owner !== ownerB && owner !== 255) {
            if (!allowForeign) return false;
          }
        }
      }
      return true;
    }

    const visited = new Uint8Array(W * H);
    const parent = new Int32Array(W * H).fill(-1);
    // Use a simple queue with index pointer for performance
    const queue: number[] = [];
    let qHead = 0;
    const startIdx = sy * W + sx;
    const endIdx = ey * W + ex;

    queue.push(startIdx);
    visited[startIdx] = 1;

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (qHead < queue.length) {
      const idx = queue[qHead++];
      if (idx === endIdx) {
        // Reconstruct path
        const path: [number, number][] = [];
        let cur = idx;
        while (cur !== -1) {
          path.push([cur % W, Math.floor(cur / W)]);
          cur = parent[cur];
        }
        return path.reverse();
      }

      const x = idx % W;
      const y = Math.floor(idx / W);
      for (const [ddx, ddy] of dirs) {
        const nx = x + ddx;
        const ny = y + ddy;
        if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
        const ni = ny * W + nx;
        if (!visited[ni] && isTraversable(nx, ny)) {
          visited[ni] = 1;
          parent[ni] = idx;
          queue.push(ni);
        }
      }
    }

    return null;
  }

  // Carve corridor tiles along a path with the configured width
  function carveCorridorPath(path: [number, number][]): void {
    const halfW = Math.floor(corridorW / 2);
    for (const [tx, ty] of path) {
      for (let dy = -halfW; dy < corridorW - halfW; dy++) {
        for (let dx = -halfW; dx < corridorW - halfW; dx++) {
          const cx = Math.max(1, Math.min(W - 2, tx + dx));
          const cy = Math.max(1, Math.min(H - 2, ty + dy));
          const idx = cy * W + cx;
          tiles[idx] = DungeonTile.Floor;
          if (roomOwner[idx] === 0) roomOwner[idx] = 255;
        }
      }
    }
  }

  // Emergency fallback: force-carve an L-shaped corridor ignoring ownership
  function forceCarveL(sx: number, sy: number, ex: number, ey: number): void {
    const halfW = Math.floor(corridorW / 2);
    // Horizontal segment from sx to ex at sy
    const minX = Math.min(sx, ex);
    const maxX = Math.max(sx, ex);
    for (let x = minX; x <= maxX; x++) {
      for (let dy = -halfW; dy < corridorW - halfW; dy++) {
        const cx = Math.max(1, Math.min(W - 2, x));
        const cy = Math.max(1, Math.min(H - 2, sy + dy));
        const idx = cy * W + cx;
        tiles[idx] = DungeonTile.Floor;
        if (roomOwner[idx] === 0) roomOwner[idx] = 255;
      }
    }
    // Vertical segment from sy to ey at ex
    const minY = Math.min(sy, ey);
    const maxY = Math.max(sy, ey);
    for (let y = minY; y <= maxY; y++) {
      for (let dx = -halfW; dx < corridorW - halfW; dx++) {
        const cx = Math.max(1, Math.min(W - 2, ex + dx));
        const cy = Math.max(1, Math.min(H - 2, y));
        const idx = cy * W + cx;
        tiles[idx] = DungeonTile.Floor;
        if (roomOwner[idx] === 0) roomOwner[idx] = 255;
      }
    }
  }

  // BFS-routed corridor between two rooms by index
  function carveCorridor(fromIdx: number, toIdx: number): void {
    const from = rooms[fromIdx];
    const to = rooms[toIdx];
    const ownerA = fromIdx + 1;
    const ownerB = toIdx + 1;
    const fp = placements[fromIdx];
    const tp = placements[toIdx];

    const { sx, sy, ex, ey } = findClosestEdgePoints(from, to, fp, tp);

    // Try strict BFS first (avoid foreign rooms)
    let path = bfsPath(sx, sy, ex, ey, ownerA, ownerB, false);
    if (!path) {
      // Relaxed BFS: allow traversing foreign room ownership zones
      path = bfsPath(sx, sy, ex, ey, ownerA, ownerB, true);
    }

    if (path) {
      carveCorridorPath(path);
    } else {
      // Last resort: force-carve L-shaped corridor
      forceCarveL(sx, sy, ex, ey);
    }
  }

  // --- Unified dungeon generation algorithm ---
  // All dungeon types use the same flow: main path → dead-end branches → boss room
  // Config variables control room shape, count, corridor dimensions, etc.

  const isCircular = config.roomShape === "circular";
  const mainPathLen = config.mainPathLength
    ? randInt(config.mainPathLength[0], config.mainPathLength[1])
    : randInt(8, 12);
  const branchCount = config.deadEndCount
    ? randInt(config.deadEndCount[0], config.deadEndCount[1])
    : randInt(1, 2);
  const branchLenMin = config.deadEndLengthMin ?? 2;
  const branchLenMax = config.deadEndLengthMax ?? 4;
  const corridorGap = config.corridorLength ?? randInt(3, 5);

  // For circular rooms, compute sizes from radius configs
  function getRoomSize(sizeW: [number, number], sizeH: [number, number], radiusCfg?: [number, number]): { w: number; h: number; radius?: number } {
    if (isCircular && radiusCfg) {
      const r = randInt(radiusCfg[0], radiusCfg[1]);
      return { w: r * 2, h: r * 2, radius: r };
    }
    return { w: randInt(sizeW[0], sizeW[1]), h: randInt(sizeH[0], sizeH[1]) };
  }

  // Phase 1: Position all rooms in unbounded space (no grid constraints)
  interface RoomPlacement {
    x: number; y: number; w: number; h: number;
    type: "spawn" | "normal" | "boss";
    radius?: number; // for circular rooms
  }

  const placements: RoomPlacement[] = [];
  const links: [number, number][] = [];

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

  // Spawn room at origin
  const spawnSize = getRoomSize(config.spawnW, config.spawnH, config.spawnRadius);
  placements.push({ x: 0, y: 0, w: spawnSize.w, h: spawnSize.h, type: "spawn", radius: spawnSize.radius });

  // Pick branch point indices along main path
  const branchPoints: number[] = [];
  if (branchCount >= 1) {
    branchPoints.push(randInt(1, mainPathLen - 1));
  }
  for (let b = 1; b < branchCount; b++) {
    let bp = randInt(1, mainPathLen - 1);
    let tries = 0;
    while (branchPoints.includes(bp) && tries < 10) {
      bp = randInt(1, mainPathLen - 1);
      tries++;
    }
    branchPoints.push(bp);
  }

  // Place main path rooms — pick from 4 directions with bias to avoid backtracking
  const mainPathIndices: number[] = [0];
  // Direction: 0=up, 1=left, 2=right, 3=down
  let lastDir = -1;

  for (let i = 1; i < mainPathLen; i++) {
    const prevIdx = mainPathIndices[mainPathIndices.length - 1];
    const prev = placements[prevIdx];
    const size = getRoomSize(config.normalW, config.normalH, config.normalRadius);
    const parentCX = prev.x + Math.floor(prev.w / 2);
    const parentCY = prev.y + Math.floor(prev.h / 2);
    const gap = corridorGap + randInt(0, 3);

    // Build candidate directions, weighting away from the last direction's opposite
    // Opposite pairs: up(0)<->down(3), left(1)<->right(2)
    const opposite = [3, 2, 1, 0];
    const dirs = [0, 1, 2, 3].filter(d => d !== opposite[lastDir] || lastDir === -1);
    // Shuffle available directions
    for (let j = dirs.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [dirs[j], dirs[k]] = [dirs[k], dirs[j]];
    }

    let placed = false;
    for (const dir of dirs) {
      let rX: number, rY: number;
      const jitter = randInt(-3, 3);
      if (dir === 0) { // up
        rX = parentCX - Math.floor(size.w / 2) + jitter;
        rY = prev.y - size.h - gap;
      } else if (dir === 1) { // left
        rX = prev.x - size.w - gap;
        rY = parentCY - Math.floor(size.h / 2) + jitter;
      } else if (dir === 2) { // right
        rX = prev.x + prev.w + gap;
        rY = parentCY - Math.floor(size.h / 2) + jitter;
      } else { // down
        rX = parentCX - Math.floor(size.w / 2) + jitter;
        rY = prev.y + prev.h + gap;
      }

      if (!placementsOverlap(rX, rY, size.w, size.h)) {
        const idx = placements.length;
        placements.push({ x: rX, y: rY, w: size.w, h: size.h, type: "normal", radius: size.radius });
        links.push([prevIdx, idx]);
        mainPathIndices.push(idx);
        lastDir = dir;
        placed = true;
        break;
      }
    }

    // Fallback: try all 4 directions with increasing gap
    if (!placed) {
      for (let extra = 2; extra <= 10 && !placed; extra += 2) {
        for (const dir of dirs) {
          let rX: number, rY: number;
          if (dir === 0) {
            rX = parentCX - Math.floor(size.w / 2);
            rY = prev.y - size.h - gap - extra;
          } else if (dir === 1) {
            rX = prev.x - size.w - gap - extra;
            rY = parentCY - Math.floor(size.h / 2);
          } else if (dir === 2) {
            rX = prev.x + prev.w + gap + extra;
            rY = parentCY - Math.floor(size.h / 2);
          } else {
            rX = parentCX - Math.floor(size.w / 2);
            rY = prev.y + prev.h + gap + extra;
          }

          if (!placementsOverlap(rX, rY, size.w, size.h)) {
            const idx = placements.length;
            placements.push({ x: rX, y: rY, w: size.w, h: size.h, type: "normal", radius: size.radius });
            links.push([prevIdx, idx]);
            mainPathIndices.push(idx);
            lastDir = dir;
            placed = true;
            break;
          }
        }
      }
    }

    // Last resort: place above with large gap (ensures chain doesn't break)
    if (!placed) {
      const rX = parentCX - Math.floor(size.w / 2);
      const rY = prev.y - size.h - gap - 12;
      const idx = placements.length;
      placements.push({ x: rX, y: rY, w: size.w, h: size.h, type: "normal", radius: size.radius });
      links.push([prevIdx, idx]);
      mainPathIndices.push(idx);
      lastDir = 0;
    }
  }

  // Boss room: placed BEFORE dead-end branches so branches can avoid it via placementsOverlap.
  // Tries all 3 directions with increasing gap to find a non-overlapping position.
  const bossSize = getRoomSize(config.bossW, config.bossH, config.bossRadius);
  const lastMainIdx = mainPathIndices[mainPathIndices.length - 1];
  const lastMain = placements[lastMainIdx];
  const lmCX = lastMain.x + Math.floor(lastMain.w / 2);
  const lmCY = lastMain.y + Math.floor(lastMain.h / 2);
  const bossDir = randInt(0, 2);
  const bossGap = randInt(3, 5);
  const bossVOffset = randInt(-3, 3);

  function getBossPos(dir: number, extraGap: number): { x: number; y: number } {
    if (dir === 1) {
      return {
        x: lastMain.x - bossSize.w - bossGap - extraGap,
        y: lmCY - Math.floor(bossSize.h / 2) + bossVOffset,
      };
    } else if (dir === 2) {
      return {
        x: lastMain.x + lastMain.w + bossGap + extraGap,
        y: lmCY - Math.floor(bossSize.h / 2) + bossVOffset,
      };
    } else {
      return {
        x: lmCX - Math.floor(bossSize.w / 2),
        y: lastMain.y - bossSize.h - bossGap - extraGap,
      };
    }
  }

  let bX!: number, bY!: number;
  let bossPlaced = false;
  // Try preferred direction first, then rotate through all 3, with increasing gap
  for (let attempt = 0; attempt < 9 && !bossPlaced; attempt++) {
    const dir = (bossDir + Math.floor(attempt / 3)) % 3;
    const extraGap = (attempt % 3) * 4;
    const pos = getBossPos(dir, extraGap);
    if (!placementsOverlap(pos.x, pos.y, bossSize.w, bossSize.h)) {
      bX = pos.x;
      bY = pos.y;
      bossPlaced = true;
    }
  }
  if (!bossPlaced) {
    // Last resort: use original position
    const pos = getBossPos(bossDir, 0);
    bX = pos.x;
    bY = pos.y;
  }

  const bossIdx = placements.length;
  placements.push({ x: bX, y: bY, w: bossSize.w, h: bossSize.h, type: "boss", radius: bossSize.radius });
  links.push([lastMainIdx, bossIdx]);

  // Place dead-end branch chains (boss room is already placed, so branches will avoid it)
  for (let b = 0; b < branchPoints.length; b++) {
    const parentMainIdx = branchPoints[b];
    let branchParentIdx = mainPathIndices[parentMainIdx];
    const branchLen = randInt(branchLenMin, branchLenMax);
    // Pick a preferred direction for this branch (0=up, 1=left, 2=right, 3=down)
    const branchDir = Math.floor(rng() * 4);

    for (let step = 0; step < branchLen; step++) {
      const parent = placements[branchParentIdx];
      const size = getRoomSize(config.normalW, config.normalH, config.normalRadius);
      const pCX = parent.x + Math.floor(parent.w / 2);
      const pCY = parent.y + Math.floor(parent.h / 2);
      const gap = randInt(2, 5);

      // Try preferred direction first, then rotate through others
      const tryDirs = [0, 1, 2, 3];
      // Rotate so branchDir is first
      for (let r = 0; r < branchDir; r++) tryDirs.push(tryDirs.shift()!);

      let placed = false;
      for (const dir of tryDirs) {
        let rX: number, rY: number;
        const jitter = randInt(-2, 2);
        if (dir === 0) {
          rX = pCX - Math.floor(size.w / 2) + jitter;
          rY = parent.y - size.h - gap;
        } else if (dir === 1) {
          rX = parent.x - size.w - gap;
          rY = pCY - Math.floor(size.h / 2) + jitter;
        } else if (dir === 2) {
          rX = parent.x + parent.w + gap;
          rY = pCY - Math.floor(size.h / 2) + jitter;
        } else {
          rX = pCX - Math.floor(size.w / 2) + jitter;
          rY = parent.y + parent.h + gap;
        }

        if (!placementsOverlap(rX, rY, size.w, size.h)) {
          const idx = placements.length;
          placements.push({ x: rX, y: rY, w: size.w, h: size.h, type: "normal", radius: size.radius });
          links.push([branchParentIdx, idx]);
          branchParentIdx = idx;
          placed = true;
          break;
        }
      }
      if (!placed) break; // can't place this room, stop the branch
    }
  }

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
    let room: DungeonRoom;
    if (isCircular && p.radius) {
      const cx = p.x + Math.floor(p.w / 2);
      const cy = p.y + Math.floor(p.h / 2);
      room = carveCircularRoom(cx, cy, p.radius, p.type);
    } else {
      room = carveRoom(p.x, p.y, p.w, p.h, p.type);
    }
    rooms.push(room);
    if (p.type === "spawn") spawnRoom = room;
    if (p.type === "boss") bossRoom = room;
  }
  // Build roomOwner map: each cell stores (roomIndex+1) for room interior + 1-tile wall border
  roomOwner = new Uint8Array(W * H);
  for (let ri = 0; ri < rooms.length; ri++) {
    const r = rooms[ri];
    const p = placements[ri];
    if (isCircular && p.radius) {
      const cx = r.x + Math.floor(r.w / 2);
      const cy = r.y + Math.floor(r.h / 2);
      const guardR = p.radius + 1;
      const guardRSq = guardR * guardR;
      for (let ty = cy - guardR; ty <= cy + guardR; ty++) {
        for (let tx = cx - guardR; tx <= cx + guardR; tx++) {
          if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
            const dx = tx - cx;
            const dy = ty - cy;
            if (dx * dx + dy * dy <= guardRSq) {
              roomOwner[ty * W + tx] = ri + 1;
            }
          }
        }
      }
    } else {
      const x0 = Math.max(0, r.x - 1);
      const y0 = Math.max(0, r.y - 1);
      const x1 = Math.min(W - 1, r.x + r.w);
      const y1 = Math.min(H - 1, r.y + r.h);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          roomOwner[ty * W + tx] = ri + 1;
        }
      }
    }
  }

  // Carve corridors using BFS-routed pathfinding
  for (const [fromIdx, toIdx] of links) {
    carveCorridor(fromIdx, toIdx);
  }

  // --- Connectivity validation via flood fill ---
  // Verify every room is reachable from spawn; emergency-patch if not
  const visited = new Uint8Array(W * H);
  const floodQueue: number[] = [];
  let fqHead = 0;
  const startTX = Math.floor(spawnRoom.x + spawnRoom.w / 2);
  const startTY = Math.floor(spawnRoom.y + spawnRoom.h / 2);
  const startFIdx = startTY * W + startTX;
  visited[startFIdx] = 1;
  floodQueue.push(startFIdx);
  const floodDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (fqHead < floodQueue.length) {
    const fi = floodQueue[fqHead++];
    const fx = fi % W;
    const fy = Math.floor(fi / W);
    for (const [ddx, ddy] of floodDirs) {
      const nx = fx + ddx;
      const ny = fy + ddy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const ni = ny * W + nx;
        if (!visited[ni] && tiles[ni] === DungeonTile.Floor) {
          visited[ni] = 1;
          floodQueue.push(ni);
        }
      }
    }
  }

  // Check each room is reachable; force-carve corridors for any that aren't
  for (const [fromIdx, toIdx] of links) {
    const room = rooms[toIdx];
    const rcx = Math.floor(room.x + room.w / 2);
    const rcy = Math.floor(room.y + room.h / 2);
    if (!visited[rcy * W + rcx]) {
      // This room is disconnected — force-carve its link
      const from = rooms[fromIdx];
      const fCX = Math.floor(from.x + from.w / 2);
      const fCY = Math.floor(from.y + from.h / 2);
      forceCarveL(fCX, fCY, rcx, rcy);
    }
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
