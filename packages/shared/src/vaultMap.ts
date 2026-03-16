import { TILE_SIZE } from "./constants";
import { DungeonRoom, DungeonMapData } from "./dungeonMap";
import {
  parseTiledMap,
  TiledMapResult,
  TiledObjectDef,
  findObjectByClass,
  getObjectProperty,
} from "./tiledMapLoader";
import vaultTmj from "./maps/vault.tmj.json";

let cachedResult: { map: DungeonMapData; tiled: TiledMapResult } | null = null;

function loadVault(): { map: DungeonMapData; tiled: TiledMapResult } {
  if (cachedResult) return cachedResult;

  const tiled = parseTiledMap(vaultTmj);

  // Synthesize spawnRoom from the spawn_point object
  const spawnObj = findObjectByClass(tiled.objects, "spawn_point");
  const spawnX = spawnObj ? spawnObj.x : (tiled.width / 2) * TILE_SIZE;
  const spawnY = spawnObj ? spawnObj.y : (tiled.height / 2) * TILE_SIZE;

  const spawnRoom: DungeonRoom = {
    x: Math.floor(spawnX / TILE_SIZE) - 5,
    y: Math.floor(spawnY / TILE_SIZE) - 5,
    w: 10,
    h: 10,
    centerX: spawnX,
    centerY: spawnY,
    type: "spawn",
  };

  const map: DungeonMapData = {
    tiles: tiled.collisionGrid,
    width: tiled.width,
    height: tiled.height,
    rooms: [spawnRoom],
    spawnRoom,
    bossRoom: spawnRoom,
  };

  cachedResult = { map, tiled };
  return cachedResult;
}

export function generateVaultMap(): DungeonMapData {
  return loadVault().map;
}

/** Get the full Tiled parse result (visual tile IDs, tileset info, objects). */
export function getVaultTiledResult(): TiledMapResult {
  return loadVault().tiled;
}

/** Get all objects from the vault Tiled map. */
export function getVaultObjects(): TiledObjectDef[] {
  return loadVault().tiled.objects;
}

/** Get vault object positions from the Tiled object layer. */
export function getVaultPositions(): {
  chest: { x: number; y: number };
  returnPortal: { x: number; y: number };
  craftingTable: { x: number; y: number };
  spawnPoint: { x: number; y: number };
} {
  const objects = getVaultObjects();
  const center = {
    x: (loadVault().tiled.width / 2) * TILE_SIZE,
    y: (loadVault().tiled.height / 2) * TILE_SIZE,
  };

  const chestObj = findObjectByClass(objects, "vault_chest");
  const portalObjs = objects.filter((o) => o.class === "portal");
  const returnObj =
    portalObjs.find(
      (o) => getObjectProperty<string>(o, "portalType") === "VaultReturn"
    ) || findObjectByClass(objects, "return_portal");
  const craftObj = findObjectByClass(objects, "crafting_table");
  const spawnObj = findObjectByClass(objects, "spawn_point");

  return {
    chest: chestObj ? { x: chestObj.x, y: chestObj.y } : center,
    returnPortal: returnObj ? { x: returnObj.x, y: returnObj.y } : center,
    craftingTable: craftObj ? { x: craftObj.x, y: craftObj.y } : center,
    spawnPoint: spawnObj ? { x: spawnObj.x, y: spawnObj.y } : center,
  };
}
