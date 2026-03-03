/**
 * Stage 6: Moisture calculation.
 * Combines distance from freshwater with a wind model for asymmetric biome distribution.
 */

import { createNoise2D } from "simplex-noise";
import type { MapConfig, Polygon, Corner } from "./types";
import { mulberry32 } from "./rng";

export function assignMoisture(
  polygons: Polygon[],
  corners: Corner[],
  config: MapConfig
): void {
  const noise2D = createNoise2D(mulberry32(config.seed + 3));

  // BFS moisture from freshwater sources (lakes, rivers)
  const queue: number[] = [];
  const moistureDist = new Map<number, number>();

  // Seed from lake polygons
  for (const polygon of polygons) {
    if (polygon.isLake) {
      moistureDist.set(polygon.index, 0);
      queue.push(polygon.index);
    }
  }

  // Seed from polygons containing river corners
  for (const corner of corners) {
    if (corner.isRiver) {
      for (const pi of corner.polygons) {
        if (!moistureDist.has(pi) && !polygons[pi].isWater) {
          moistureDist.set(pi, 0);
          queue.push(pi);
        }
      }
    }
  }

  // Also seed from coastal polygons (ocean is a moisture source)
  for (const polygon of polygons) {
    if (polygon.isCoast && !moistureDist.has(polygon.index)) {
      moistureDist.set(polygon.index, 1); // slight distance to differentiate from rivers/lakes
      queue.push(polygon.index);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const dist = moistureDist.get(current)!;
    for (const ni of polygons[current].neighbors) {
      if (!moistureDist.has(ni) && !polygons[ni].isWater) {
        moistureDist.set(ni, dist + 1);
        queue.push(ni);
      }
    }
  }

  let maxMoistureDist = 0;
  for (const d of moistureDist.values()) {
    if (d > maxMoistureDist) maxMoistureDist = d;
  }
  if (maxMoistureDist === 0) maxMoistureDist = 1;

  // Wind model: moisture decreases downwind from ocean
  const windDx = Math.cos(config.moistureWindDirection);
  const windDy = Math.sin(config.moistureWindDirection);
  const halfSize = config.mapSize / 2;

  for (const polygon of polygons) {
    if (polygon.isWater) {
      polygon.moisture = 1.0;
      continue;
    }

    // Base moisture from freshwater distance
    const freshwaterDist = moistureDist.get(polygon.index) ?? maxMoistureDist;
    const baseMoisture = 1 - freshwaterDist / maxMoistureDist;

    // Wind factor: dot product with wind direction
    const nx = (polygon.center.x - halfSize) / halfSize;
    const ny = (polygon.center.y - halfSize) / halfSize;
    const windExposure = -(nx * windDx + ny * windDy);
    const windFactor = windExposure * 0.2;

    // Noise for variation
    const noiseFactor =
      noise2D(polygon.center.x * 0.01, polygon.center.y * 0.01) * 0.15;

    polygon.moisture = Math.max(
      0,
      Math.min(1, baseMoisture + windFactor + noiseFactor)
    );
  }

  // Set corner moisture to average of adjacent polygons
  for (const corner of corners) {
    if (corner.polygons.length === 0) continue;
    let sum = 0;
    for (const pi of corner.polygons) {
      sum += polygons[pi].moisture;
    }
    corner.moisture = sum / corner.polygons.length;
    // Rivers boost moisture directly
    if (corner.isRiver) {
      corner.moisture = Math.min(1, corner.moisture + 0.3);
    }
  }
}
