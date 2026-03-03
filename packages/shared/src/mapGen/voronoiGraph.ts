/**
 * Stage 2: Voronoi/Delaunay graph construction.
 * Builds the dual graph (polygons + corners + edges) from seed points.
 */

import { Delaunay } from "d3-delaunay";
import type { Point, Polygon, Corner, Edge } from "./types";

export interface GraphData {
  polygons: Polygon[];
  corners: Corner[];
  edges: Edge[];
}

export function buildGraph(points: Point[], mapSize: number): GraphData {
  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].y;
  }

  const delaunay = new Delaunay(coords);
  const voronoi = delaunay.voronoi([0, 0, mapSize, mapSize]);

  // Build polygon shells
  const polygons: Polygon[] = points.map((center, i) => ({
    index: i,
    center,
    corners: [],
    neighbors: [],
    isWater: false,
    isOcean: false,
    isLake: false,
    isCoast: false,
    elevation: 0,
    moisture: 0,
    distanceFromCoast: 0,
  }));

  // Neighbor relationships from Delaunay
  for (let i = 0; i < points.length; i++) {
    const neighbors: number[] = [];
    for (const j of voronoi.neighbors(i)) {
      neighbors.push(j);
    }
    polygons[i].neighbors = neighbors;
  }

  // Extract unique corners by deduplication
  const cornerMap = new Map<string, number>(); // "roundedX,roundedY" -> corner index
  const corners: Corner[] = [];

  function getOrCreateCorner(x: number, y: number): number {
    // Snap to grid for deduplication
    const kx = Math.round(x * 100) / 100;
    const ky = Math.round(y * 100) / 100;
    const key = `${kx},${ky}`;
    let idx = cornerMap.get(key);
    if (idx !== undefined) return idx;
    idx = corners.length;
    cornerMap.set(key, idx);
    corners.push({
      index: idx,
      position: { x: kx, y: ky },
      polygons: [],
      adjacent: [],
      elevation: 0,
      moisture: 0,
      isWater: false,
      isCoast: false,
      isRiver: false,
      riverSize: 0,
      downslope: -1,
    });
    return idx;
  }

  // Extract corners from each Voronoi cell polygon
  for (let i = 0; i < points.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    const cellCorners: number[] = [];
    // cell is a closed polygon: [p0, p1, ..., pN, p0]
    // skip the last point (duplicate of first)
    for (let j = 0; j < cell.length - 1; j++) {
      const ci = getOrCreateCorner(cell[j][0], cell[j][1]);
      cellCorners.push(ci);
      // Record which polygon this corner belongs to
      if (!corners[ci].polygons.includes(i)) {
        corners[ci].polygons.push(i);
      }
    }
    polygons[i].corners = cellCorners;
  }

  // Build corner adjacency (corners that share a polygon edge)
  for (const polygon of polygons) {
    const cs = polygon.corners;
    for (let j = 0; j < cs.length; j++) {
      const c0 = cs[j];
      const c1 = cs[(j + 1) % cs.length];
      if (!corners[c0].adjacent.includes(c1)) corners[c0].adjacent.push(c1);
      if (!corners[c1].adjacent.includes(c0)) corners[c1].adjacent.push(c0);
    }
  }

  // Build edges from adjacent polygon pairs
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const polygon of polygons) {
    for (const ni of polygon.neighbors) {
      if (ni <= polygon.index) continue; // avoid duplicates
      const key = `${polygon.index},${ni}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);

      // Find the two shared corners between polygon and neighbor
      const sharedCorners = polygon.corners.filter((ci) =>
        polygons[ni].corners.includes(ci)
      );

      if (sharedCorners.length >= 2) {
        edges.push({
          index: edges.length,
          polygons: [polygon.index, ni],
          corners: [sharedCorners[0], sharedCorners[1]],
          isCoastEdge: false,
          riverVolume: 0,
        });
      }
    }
  }

  return { polygons, corners, edges };
}
