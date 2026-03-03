/**
 * Stage 4: Elevation assignment.
 * BFS distance from coast + noise perturbation to break up concentric rings.
 */

import { createNoise2D } from "simplex-noise";
import type { MapConfig, Polygon, Corner } from "./types";
import { mulberry32 } from "./rng";

export function assignElevation(
  polygons: Polygon[],
  corners: Corner[],
  config: MapConfig
): void {
  const noise2D = createNoise2D(mulberry32(config.seed + 1));

  // BFS from all coastal polygons simultaneously
  const queue: number[] = [];
  const visited = new Set<number>();

  for (const polygon of polygons) {
    if (polygon.isCoast) {
      polygon.distanceFromCoast = 0;
      queue.push(polygon.index);
      visited.add(polygon.index);
    }
    if (polygon.isWater) {
      polygon.elevation = 0;
      visited.add(polygon.index);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    for (const ni of polygons[current].neighbors) {
      if (!visited.has(ni) && !polygons[ni].isWater) {
        visited.add(ni);
        polygons[ni].distanceFromCoast =
          polygons[current].distanceFromCoast + 1;
        queue.push(ni);
      }
    }
  }

  // Find max distance for normalization
  let maxDist = 0;
  for (const p of polygons) {
    if (p.distanceFromCoast > maxDist) maxDist = p.distanceFromCoast;
  }
  if (maxDist === 0) maxDist = 1;

  // Normalize and add noise perturbation (scaled by distance from coast)
  for (const polygon of polygons) {
    if (!polygon.isWater) {
      const base = polygon.distanceFromCoast / maxDist;
      // Suppress noise near coast to preserve zone layering
      const distanceFactor = Math.min(1.0, polygon.distanceFromCoast / 4);
      const noisePerturbation =
        noise2D(polygon.center.x * 0.02, polygon.center.y * 0.02) *
        config.elevationNoiseFactor *
        distanceFactor;
      polygon.elevation = Math.max(
        0.01,
        Math.min(1.0, base + noisePerturbation)
      );
    }
  }

  // Redistribute elevations: more lowland than mountain
  redistributeElevation(polygons);

  // Clamp coastal polygons to Shore zone so only Shore borders the ocean
  for (const polygon of polygons) {
    if (polygon.isCoast && !polygon.isWater) {
      polygon.elevation = Math.min(polygon.elevation, 0.12);
    }
  }

  // Set corner elevations to average of adjacent polygons
  for (const corner of corners) {
    if (corner.polygons.length === 0) continue;
    let sum = 0;
    for (const pi of corner.polygons) {
      sum += polygons[pi].elevation;
    }
    corner.elevation = sum / corner.polygons.length;
    corner.isWater = corner.polygons.every((pi) => polygons[pi].isWater);
  }

  // Compute downslope for each corner (used by rivers)
  for (const corner of corners) {
    let lowestNeighbor = corner.index;
    let lowestElevation = corner.elevation;
    for (const adj of corner.adjacent) {
      if (corners[adj].elevation < lowestElevation) {
        lowestElevation = corners[adj].elevation;
        lowestNeighbor = adj;
      }
    }
    corner.downslope = lowestNeighbor === corner.index ? -1 : lowestNeighbor;
  }
}

/**
 * Redistribute elevation via piecewise linear mapping from rank to elevation.
 * Sorted by BFS distance from coast to guarantee strict onion-layer ordering.
 * Each segment controls exact zone size: [rank range] -> [elevation range].
 *   Shore    20%  (rank 0.00-0.20 -> elev 0.00-0.15)
 *   Lowlands 26%  (rank 0.20-0.46 -> elev 0.15-0.35)
 *   Midlands 21%  (rank 0.46-0.67 -> elev 0.35-0.55)
 *   Highlands 18% (rank 0.67-0.85 -> elev 0.55-0.75)
 *   Godlands 15%  (rank 0.85-1.00 -> elev 0.75-1.00)
 */
const ZONE_SEGMENTS = [
  { rankEnd: 0.20, elevEnd: 0.15 },
  { rankEnd: 0.46, elevEnd: 0.35 },
  { rankEnd: 0.67, elevEnd: 0.55 },
  { rankEnd: 0.85, elevEnd: 0.75 },
  { rankEnd: 1.00, elevEnd: 1.00 },
];

function redistributeElevation(polygons: Polygon[]): void {
  const landPolygons = polygons
    .filter((p) => !p.isWater)
    .sort(
      (a, b) =>
        a.distanceFromCoast - b.distanceFromCoast ||
        a.elevation - b.elevation
    );

  if (landPolygons.length < 2) return;

  for (let i = 0; i < landPolygons.length; i++) {
    const x = i / (landPolygons.length - 1);
    let prevRank = 0;
    let prevElev = 0;
    for (const seg of ZONE_SEGMENTS) {
      if (x <= seg.rankEnd) {
        const t = (x - prevRank) / (seg.rankEnd - prevRank);
        landPolygons[i].elevation = prevElev + t * (seg.elevEnd - prevElev);
        break;
      }
      prevRank = seg.rankEnd;
      prevElev = seg.elevEnd;
    }
  }
}
