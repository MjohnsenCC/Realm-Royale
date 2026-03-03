/**
 * Road generation.
 * Generates roads between setpiece locations using A* on the polygon adjacency graph.
 */

import type { Polygon, Point } from "./types";
import { rasterizeRoads } from "./rasterizer";

/**
 * Generate roads connecting setpiece polygon centers.
 * Uses A* on the polygon adjacency graph with elevation-based cost.
 */
export function generateRoads(
  roads: Uint8Array,
  polygons: Polygon[],
  setpiecePolygonIndices: number[],
  mapSize: number
): void {
  if (setpiecePolygonIndices.length < 2) return;

  // Connect setpieces sequentially (each to the next nearest unconnected one)
  const connected = new Set<number>();
  connected.add(setpiecePolygonIndices[0]);
  const remaining = new Set(setpiecePolygonIndices.slice(1));

  while (remaining.size > 0) {
    // Find nearest unconnected setpiece to any connected one
    let bestStart = -1;
    let bestEnd = -1;
    let bestDist = Infinity;

    for (const c of connected) {
      for (const r of remaining) {
        const dx = polygons[c].center.x - polygons[r].center.x;
        const dy = polygons[c].center.y - polygons[r].center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestStart = c;
          bestEnd = r;
        }
      }
    }

    if (bestStart === -1 || bestEnd === -1) break;

    // A* path between them
    const path = astarPolygonPath(polygons, bestStart, bestEnd);
    if (path.length > 0) {
      // Convert polygon centers to points and rasterize
      const pathPoints: Point[] = path.map((pi) => polygons[pi].center);
      rasterizeRoads(roads, pathPoints, 2, mapSize);
    }

    connected.add(bestEnd);
    remaining.delete(bestEnd);
  }
}

/**
 * A* pathfinding on polygon adjacency graph.
 * Cost function: prefer flat terrain, penalize water crossing.
 */
function astarPolygonPath(
  polygons: Polygon[],
  start: number,
  end: number
): number[] {
  const openSet = new Set<number>([start]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();

  gScore.set(start, 0);
  fScore.set(start, heuristic(polygons[start], polygons[end]));

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current = -1;
    let currentF = Infinity;
    for (const n of openSet) {
      const f = fScore.get(n) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = n;
      }
    }

    if (current === end) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);

    for (const neighbor of polygons[current].neighbors) {
      const moveCost = edgeCost(polygons[current], polygons[neighbor]);
      const tentativeG = (gScore.get(current) ?? Infinity) + moveCost;

      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(
          neighbor,
          tentativeG + heuristic(polygons[neighbor], polygons[end])
        );
        openSet.add(neighbor);
      }
    }
  }

  return []; // no path found
}

function heuristic(a: Polygon, b: Polygon): number {
  const dx = a.center.x - b.center.x;
  const dy = a.center.y - b.center.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function edgeCost(from: Polygon, to: Polygon): number {
  if (to.isWater) return 1000; // heavy penalty for water
  const elevDiff = Math.abs(to.elevation - from.elevation);
  const dx = to.center.x - from.center.x;
  const dy = to.center.y - from.center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist + elevDiff * dist * 5;
}

function reconstructPath(
  cameFrom: Map<number, number>,
  current: number
): number[] {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}
