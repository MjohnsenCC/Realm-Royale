/**
 * Map generation orchestrator.
 * Runs the full 8-stage pipeline and produces a RealmMapData.
 */

import { RealmBiome } from "../types";
import { HOSTILE_TILES, HOSTILE_TILE_SIZE } from "../constants";
import type { RealmMapData, SpawnAnchor } from "../realmMap";
import type { MapConfig, Polygon } from "./types";
import { DEFAULT_CONFIG } from "./types";
import { generatePoints } from "./poissonDisk";
import { buildGraph } from "./voronoiGraph";
import { assignLandWater } from "./islandShape";
import { assignElevation } from "./elevation";
import { generateRivers } from "./rivers";
import { assignMoisture } from "./moisture";
import { assignBiomes } from "./biomes";
import { rasterize } from "./rasterizer";
import { placeDecorations } from "./decorations";
import { placeSetpieces } from "./setpieces";
import { generateRoads } from "./roads";

export { DEFAULT_CONFIG } from "./types";
export type { MapConfig } from "./types";

export function generateRealmMap(
  configOverrides?: Partial<MapConfig>
): RealmMapData {
  const config: MapConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  console.log(`[MapGen] Generating realm map with seed ${config.seed}...`);
  console.log(`[MapGen] Map size: ${config.mapSize}x${config.mapSize} tiles`);

  // Stage 1: Point distribution
  console.log("[MapGen] Stage 1: Generating Poisson disk points...");
  const points = generatePoints(config);
  console.log(`[MapGen]   Generated ${points.length} seed points`);

  // Stage 2: Voronoi graph
  console.log("[MapGen] Stage 2: Building Voronoi graph...");
  const { polygons, corners, edges } = buildGraph(points, config.mapSize);
  console.log(
    `[MapGen]   ${polygons.length} polygons, ${corners.length} corners, ${edges.length} edges`
  );

  // Stage 3: Island shape
  console.log("[MapGen] Stage 3: Assigning land/water...");
  assignLandWater(polygons, corners, config);
  const landCount = polygons.filter((p) => !p.isWater).length;
  const oceanCount = polygons.filter((p) => p.isOcean).length;
  const lakeCount = polygons.filter((p) => p.isLake).length;
  console.log(
    `[MapGen]   Land: ${landCount}, Ocean: ${oceanCount}, Lakes: ${lakeCount}`
  );

  // Stage 4: Elevation
  console.log("[MapGen] Stage 4: Assigning elevation...");
  assignElevation(polygons, corners, config);

  // Stage 5: Rivers
  console.log("[MapGen] Stage 5: Generating rivers...");
  generateRivers(polygons, corners, edges, config);
  const riverCorners = corners.filter((c) => c.isRiver).length;
  console.log(`[MapGen]   ${riverCorners} river corners`);

  // Stage 6: Moisture
  console.log("[MapGen] Stage 6: Calculating moisture...");
  assignMoisture(polygons, corners, config);

  // Stage 7: Biomes
  console.log("[MapGen] Stage 7: Assigning biomes...");
  const polygonBiomes = assignBiomes(polygons);

  // Stage 8: Rasterize
  console.log("[MapGen] Stage 8: Rasterizing to tile grid...");
  const rasterized = rasterize(
    polygons,
    corners,
    edges,
    polygonBiomes,
    config.mapSize
  );

  // Place setpieces
  console.log("[MapGen] Placing setpieces...");
  const { setpieces, setpiecePolygonIndices } = placeSetpieces(
    polygons,
    rasterized.biomes,
    config.mapSize,
    config.seed
  );
  console.log(`[MapGen]   Placed ${setpieces.length} setpieces`);

  // Generate roads between setpieces
  console.log("[MapGen] Generating roads...");
  generateRoads(
    rasterized.roads,
    polygons,
    setpiecePolygonIndices,
    config.mapSize
  );

  // Place decorations
  console.log("[MapGen] Placing decorations...");
  const decorations = placeDecorations(
    rasterized.biomes,
    rasterized.rivers,
    rasterized.roads,
    config.mapSize,
    config.seed
  );
  console.log(`[MapGen]   Placed ${decorations.length} decorations`);

  // Find spawn points (beach polygons suitable for player spawning)
  const spawnPoints = findSpawnPoints(polygons, polygonBiomes);
  console.log(`[MapGen]   Found ${spawnPoints.length} spawn points`);

  console.log("[MapGen] Map generation complete!");

  return {
    version: 1,
    seed: config.seed,
    width: config.mapSize,
    height: config.mapSize,
    tileSize: HOSTILE_TILE_SIZE,
    biomes: rasterized.biomes,
    elevation: rasterized.elevation,
    moisture: rasterized.moisture,
    difficulty: rasterized.difficulty,
    rivers: rasterized.rivers,
    roads: rasterized.roads,
    decorations,
    setpieces,
    spawnPoints,
  };
}

/**
 * Find beach polygons suitable for player spawning.
 * Picks coastal land polygons that are near the map center.
 */
function findSpawnPoints(
  polygons: Polygon[],
  polygonBiomes: number[]
): SpawnAnchor[] {
  const halfSize = HOSTILE_TILES / 2;

  // Find beach/coastal polygons
  const beachPolygons = polygons.filter(
    (p) =>
      p.isCoast &&
      !p.isWater &&
      polygonBiomes[p.index] === RealmBiome.Beach
  );

  // Sort by distance to center (prefer centrally-located beaches)
  beachPolygons.sort((a, b) => {
    const da =
      Math.sqrt(
        (a.center.x - halfSize) ** 2 + (a.center.y - halfSize) ** 2
      );
    const db =
      Math.sqrt(
        (b.center.x - halfSize) ** 2 + (b.center.y - halfSize) ** 2
      );
    return da - db;
  });

  // Take up to 8 spawn points, spaced apart
  const spawnPoints: SpawnAnchor[] = [];
  const minSpacing = HOSTILE_TILES * 0.05; // 5% of map

  for (const poly of beachPolygons) {
    if (spawnPoints.length >= 8) break;

    const tooClose = spawnPoints.some((sp) => {
      const dx = sp.x / HOSTILE_TILE_SIZE - poly.center.x;
      const dy = sp.y / HOSTILE_TILE_SIZE - poly.center.y;
      return Math.sqrt(dx * dx + dy * dy) < minSpacing;
    });
    if (tooClose) continue;

    spawnPoints.push({
      x: Math.round(poly.center.x * HOSTILE_TILE_SIZE),
      y: Math.round(poly.center.y * HOSTILE_TILE_SIZE),
    });
  }

  // Fallback: if no beach found, use center of map
  if (spawnPoints.length === 0) {
    spawnPoints.push({
      x: halfSize * HOSTILE_TILE_SIZE,
      y: halfSize * HOSTILE_TILE_SIZE,
    });
  }

  return spawnPoints;
}
