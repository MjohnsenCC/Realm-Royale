/**
 * Stage 8: Tile rasterization.
 * Converts polygon-based map into the final 2048x2048 tile grid.
 */

import { Delaunay } from "d3-delaunay";
import { RealmBiome } from "../types";
import type { Polygon, Corner, Edge, Point } from "./types";
import { getDifficultyFromElevation } from "./difficulty";

export interface RasterizedMap {
  biomes: Uint8Array;
  elevation: Uint8Array;
  moisture: Uint8Array;
  difficulty: Uint8Array;
  rivers: Uint8Array;
  roads: Uint8Array;
}

export function rasterize(
  polygons: Polygon[],
  corners: Corner[],
  edges: Edge[],
  polygonBiomes: number[],
  mapSize: number
): RasterizedMap {
  const totalTiles = mapSize * mapSize;
  const biomes = new Uint8Array(totalTiles);
  const elevation = new Uint8Array(totalTiles);
  const moisture = new Uint8Array(totalTiles);
  const difficulty = new Uint8Array(totalTiles);
  const rivers = new Uint8Array(totalTiles);
  const roads = new Uint8Array(totalTiles);

  // Build spatial index for polygon nearest-neighbor lookup
  const coords = new Float64Array(polygons.length * 2);
  for (let i = 0; i < polygons.length; i++) {
    coords[i * 2] = polygons[i].center.x;
    coords[i * 2 + 1] = polygons[i].center.y;
  }
  const delaunay = new Delaunay(coords);

  // Rasterize: assign each tile to nearest polygon
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const pi = delaunay.find(x + 0.5, y + 0.5);
      const polygon = polygons[pi];
      const idx = y * mapSize + x;

      biomes[idx] = polygonBiomes[pi];
      elevation[idx] = Math.round(polygon.elevation * 255);
      moisture[idx] = Math.round(polygon.moisture * 255);
      difficulty[idx] = getDifficultyFromElevation(polygon.elevation);
    }
  }

  // Rasterize rivers
  rasterizeRivers(rivers, corners, edges, mapSize);

  return { biomes, elevation, moisture, difficulty, rivers, roads };
}

/**
 * Draw rivers onto the tile grid by rasterizing corner-to-corner river paths.
 */
function rasterizeRivers(
  rivers: Uint8Array,
  corners: Corner[],
  edges: Edge[],
  mapSize: number
): void {
  for (const edge of edges) {
    if (edge.riverVolume <= 0) continue;

    const c0 = corners[edge.corners[0]].position;
    const c1 = corners[edge.corners[1]].position;
    const width = Math.min(4, 1 + Math.floor(edge.riverVolume / 3));

    rasterizeLine(rivers, c0, c1, width, mapSize);
  }
}

/**
 * Rasterize a line with given width onto a Uint8Array grid.
 * Uses Bresenham-style with variable width.
 */
function rasterizeLine(
  grid: Uint8Array,
  p0: Point,
  p1: Point,
  width: number,
  mapSize: number
): void {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) return;

  const steps = Math.ceil(dist);
  const halfWidth = width / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = p0.x + dx * t;
    const cy = p0.y + dy * t;

    const minX = Math.max(0, Math.floor(cx - halfWidth));
    const maxX = Math.min(mapSize - 1, Math.floor(cx + halfWidth));
    const minY = Math.max(0, Math.floor(cy - halfWidth));
    const maxY = Math.min(mapSize - 1, Math.floor(cy + halfWidth));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tdx = x + 0.5 - cx;
        const tdy = y + 0.5 - cy;
        if (tdx * tdx + tdy * tdy <= halfWidth * halfWidth) {
          grid[y * mapSize + x] = width;
        }
      }
    }
  }
}

/**
 * Rasterize road paths onto the tile grid.
 */
export function rasterizeRoads(
  roads: Uint8Array,
  path: Point[],
  width: number,
  mapSize: number
): void {
  for (let i = 0; i < path.length - 1; i++) {
    rasterizeRoadLine(roads, path[i], path[i + 1], width, mapSize);
  }
}

function rasterizeRoadLine(
  grid: Uint8Array,
  p0: Point,
  p1: Point,
  width: number,
  mapSize: number
): void {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) return;

  const steps = Math.ceil(dist);
  const halfWidth = width / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = p0.x + dx * t;
    const cy = p0.y + dy * t;

    const minX = Math.max(0, Math.floor(cx - halfWidth));
    const maxX = Math.min(mapSize - 1, Math.floor(cx + halfWidth));
    const minY = Math.max(0, Math.floor(cy - halfWidth));
    const maxY = Math.min(mapSize - 1, Math.floor(cy + halfWidth));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        grid[y * mapSize + x] = 1;
      }
    }
  }
}
