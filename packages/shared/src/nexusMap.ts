import { TILE_SIZE } from "./constants";
import { DungeonTile, DungeonRoom, DungeonMapData } from "./dungeonMap";

let cachedNexusMap: DungeonMapData | null = null;

export function generateNexusMap(): DungeonMapData {
  if (cachedNexusMap) return cachedNexusMap;

  const W = 50;
  const H = 50;
  const tiles = new Uint8Array(W * H); // all Wall=0

  // Helper: carve a rectangle of floor tiles
  function carveRect(rx: number, ry: number, rw: number, rh: number): void {
    for (let ty = ry; ty < ry + rh; ty++) {
      for (let tx = rx; tx < rx + rw; tx++) {
        if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
          tiles[ty * W + tx] = DungeonTile.Floor;
        }
      }
    }
  }

  // Helper: create a room and carve it
  function makeRoom(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    type: "spawn" | "normal" | "boss",
  ): DungeonRoom {
    carveRect(rx, ry, rw, rh);
    return {
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      centerX: (rx + rw / 2) * TILE_SIZE,
      centerY: (ry + rh / 2) * TILE_SIZE,
      type,
    };
  }

  const rooms: DungeonRoom[] = [];

  // --- Center Room (spawn hub) — 21x21 so center tile is exactly 25 ---
  const centerRoom = makeRoom(15, 15, 21, 21, "spawn");
  rooms.push(centerRoom);

  // --- North Room (portal to hostile zone) ---
  const northRoom = makeRoom(19, 2, 13, 10, "boss");
  rooms.push(northRoom);

  // --- South Room (dungeon test portals) ---
  const southRoom = makeRoom(19, 38, 13, 10, "normal");
  rooms.push(southRoom);

  // --- West Room (future: shop, etc.) ---
  const westRoom = makeRoom(2, 19, 10, 13, "normal");
  rooms.push(westRoom);

  // --- East Room (future: shop, etc.) ---
  const eastRoom = makeRoom(38, 19, 10, 13, "normal");
  rooms.push(eastRoom);

  // --- Doorways (5 tiles wide, connecting room edges to center) ---
  const doorWidth = 5;
  const centerTX = 25; // center tile X of the map (15 + 21/2 floored)
  const centerTY = 25; // center tile Y of the map

  // North doorway: vertical gap from north room bottom (y=12) to center top (y=15)
  carveRect(centerTX - Math.floor(doorWidth / 2), 12, doorWidth, 3);

  // South doorway: vertical gap from center bottom (y=36) to south room top (y=38)
  carveRect(centerTX - Math.floor(doorWidth / 2), 36, doorWidth, 2);

  // West doorway: horizontal gap from west room right (x=12) to center left (x=15)
  carveRect(12, centerTY - Math.floor(doorWidth / 2), 3, doorWidth);

  // East doorway: horizontal gap from center right (x=36) to east room left (x=38)
  carveRect(36, centerTY - Math.floor(doorWidth / 2), 2, doorWidth);

  cachedNexusMap = {
    tiles,
    width: W,
    height: H,
    rooms,
    spawnRoom: centerRoom,
    bossRoom: northRoom, // portal room = "bossRoom" for interface compatibility
  };
  return cachedNexusMap;
}
