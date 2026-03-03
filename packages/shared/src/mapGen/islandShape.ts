/**
 * Stage 3: Island shape & coastline.
 * Determines which polygons are land vs water using radial falloff + simplex noise.
 */

import { createNoise2D } from "simplex-noise";
import type { MapConfig, Polygon, Corner } from "./types";
import { mulberry32 } from "./rng";

export function assignLandWater(
  polygons: Polygon[],
  corners: Corner[],
  config: MapConfig
): void {
  const noise2D = createNoise2D(mulberry32(config.seed));
  const halfSize = config.mapSize / 2;

  // Determine water for each corner
  for (const corner of corners) {
    const nx = (corner.position.x - halfSize) / halfSize; // -1 to 1
    const ny = (corner.position.y - halfSize) / halfSize;
    const distFromCenter = Math.sqrt(nx * nx + ny * ny);

    // Radial falloff: force edges to be water
    const radialFalloff = 1 - distFromCenter * config.islandFalloffRate;

    // Multi-octave noise for organic coastline shape
    const scale = config.noiseScale * config.mapSize;
    const px = corner.position.x / scale;
    const py = corner.position.y / scale;
    const n =
      noise2D(px, py) * 0.5 +
      noise2D(px * 2, py * 2) * 0.3 +
      noise2D(px * 4, py * 4) * 0.2;

    corner.isWater = radialFalloff + n * 0.6 < 0.1;
  }

  // Assign polygon land/water based on corner majority
  for (const polygon of polygons) {
    if (polygon.corners.length === 0) {
      polygon.isWater = true;
      continue;
    }
    const waterCorners = polygon.corners.filter(
      (ci) => corners[ci].isWater
    ).length;
    polygon.isWater = waterCorners >= polygon.corners.length * 0.5;
  }

  // Flood fill from map border to distinguish ocean vs lake
  floodFillOcean(polygons, config.mapSize);

  // Mark coastal polygons (land polygons adjacent to ocean)
  for (const polygon of polygons) {
    if (!polygon.isWater) {
      polygon.isCoast = polygon.neighbors.some(
        (ni) => polygons[ni].isOcean
      );
    }
  }

  // Mark coastal corners
  for (const corner of corners) {
    const hasLand = corner.polygons.some((pi) => !polygons[pi].isWater);
    const hasOcean = corner.polygons.some((pi) => polygons[pi].isOcean);
    corner.isCoast = hasLand && hasOcean;
  }
}

/**
 * BFS from border water polygons to mark ocean vs lake.
 * Water polygons reachable from the border are ocean; unreachable are lakes.
 */
function floodFillOcean(polygons: Polygon[], mapSize: number): void {
  const margin = mapSize * 0.02; // polygons near map edge

  // Find border water polygons (seed for BFS)
  const queue: number[] = [];
  const visited = new Set<number>();

  for (const polygon of polygons) {
    if (!polygon.isWater) continue;
    const { x, y } = polygon.center;
    if (
      x < margin ||
      x > mapSize - margin ||
      y < margin ||
      y > mapSize - margin
    ) {
      polygon.isOcean = true;
      visited.add(polygon.index);
      queue.push(polygon.index);
    }
  }

  // BFS: spread ocean to connected water polygons
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    for (const ni of polygons[current].neighbors) {
      if (!visited.has(ni) && polygons[ni].isWater) {
        visited.add(ni);
        polygons[ni].isOcean = true;
        queue.push(ni);
      }
    }
  }

  // Remaining water polygons are lakes
  for (const polygon of polygons) {
    if (polygon.isWater && !polygon.isOcean) {
      polygon.isLake = true;
    }
  }
}
