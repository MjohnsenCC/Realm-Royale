import { TILE_SIZE } from "./constants";
import { DungeonTile, DungeonRoom, DungeonMapData } from "./dungeonMap";

let cachedVaultMap: DungeonMapData | null = null;

export function generateVaultMap(): DungeonMapData {
  if (cachedVaultMap) return cachedVaultMap;

  const W = 20;
  const H = 20;
  const tiles = new Uint8Array(W * H); // all Wall=0

  function carveRect(rx: number, ry: number, rw: number, rh: number): void {
    for (let ty = ry; ty < ry + rh; ty++) {
      for (let tx = rx; tx < rx + rw; tx++) {
        if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
          tiles[ty * W + tx] = DungeonTile.Floor;
        }
      }
    }
  }

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

  // Single 14x14 room centered in the 20x20 grid
  const mainRoom = makeRoom(3, 3, 14, 14, "spawn");

  cachedVaultMap = {
    tiles,
    width: W,
    height: H,
    rooms: [mainRoom],
    spawnRoom: mainRoom,
    bossRoom: mainRoom,
  };
  return cachedVaultMap;
}
