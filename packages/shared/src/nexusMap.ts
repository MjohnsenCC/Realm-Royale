import { TILE_SIZE } from "./constants";
import { DungeonTile, DungeonRoom, DungeonMapData } from "./dungeonMap";
import {
  parseTiledMap,
  TiledMapResult,
  TiledObjectDef,
  DecorationDef,
  findObjectsByClass,
  findObjectByClass,
  getObjectProperty,
  getDecorations,
} from "./tiledMapLoader";
import nexusTmj from "./maps/nexus.tmj.json";

let cachedResult: { map: DungeonMapData; tiled: TiledMapResult } | null = null;

function loadNexus(): { map: DungeonMapData; tiled: TiledMapResult } {
  if (cachedResult) return cachedResult;

  const tiled = parseTiledMap(nexusTmj);

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
    bossRoom: spawnRoom, // nexus has no boss room; satisfy interface
  };

  cachedResult = { map, tiled };
  return cachedResult;
}

export function generateNexusMap(): DungeonMapData {
  return loadNexus().map;
}

/** Get the full Tiled parse result (visual tile IDs, tileset info, objects). */
export function getNexusTiledResult(): TiledMapResult {
  return loadNexus().tiled;
}

/** Get all objects from the nexus Tiled map. */
export function getNexusObjects(): TiledObjectDef[] {
  return loadNexus().tiled.objects;
}

/** Get decoration objects from the nexus Tiled map. */
export function getNexusDecorations(): DecorationDef[] {
  return getDecorations(getNexusObjects());
}

/** Get nexus portal positions from the Tiled object layer. */
export function getNexusPortalPositions(): {
  wildPortals: { x: number; y: number }[];
  vaultPortal: { x: number; y: number };
  infernalPitPortal: { x: number; y: number };
  voidSanctumPortal: { x: number; y: number };
  craftingTable: { x: number; y: number };
  spawnPoint: { x: number; y: number };
} {
  const objects = getNexusObjects();

  // Wild portals (NexusToHostile)
  const portalObjs = findObjectsByClass(objects, "portal");
  const wildPortals = portalObjs
    .filter((o) => getObjectProperty<string>(o, "portalType") === "NexusToHostile")
    .map((o) => ({ x: o.x, y: o.y }));

  const vaultObj = portalObjs.find(
    (o) => getObjectProperty<string>(o, "portalType") === "NexusToVault"
  );
  const infernalObj = portalObjs.find(
    (o) => getObjectProperty<string>(o, "portalType") === "InfernalPitEntrance"
  );
  const voidObj = portalObjs.find(
    (o) => getObjectProperty<string>(o, "portalType") === "VoidSanctumEntrance"
  );
  const craftObj = findObjectByClass(objects, "crafting_table");
  const spawnObj = findObjectByClass(objects, "spawn_point");

  const center = { x: (loadNexus().tiled.width / 2) * TILE_SIZE, y: (loadNexus().tiled.height / 2) * TILE_SIZE };

  return {
    wildPortals: wildPortals.length >= 2 ? wildPortals : [center, center],
    vaultPortal: vaultObj ? { x: vaultObj.x, y: vaultObj.y } : center,
    infernalPitPortal: infernalObj ? { x: infernalObj.x, y: infernalObj.y } : center,
    voidSanctumPortal: voidObj ? { x: voidObj.x, y: voidObj.y } : center,
    craftingTable: craftObj ? { x: craftObj.x, y: craftObj.y } : center,
    spawnPoint: spawnObj ? { x: spawnObj.x, y: spawnObj.y } : center,
  };
}
