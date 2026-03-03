/**
 * Stage 5: River generation.
 * Rivers flow from high-elevation corners downhill to the coast.
 */

import type { MapConfig, Polygon, Corner, Edge } from "./types";
import { mulberry32 } from "./rng";

export function generateRivers(
  polygons: Polygon[],
  corners: Corner[],
  edges: Edge[],
  config: MapConfig
): void {
  const rng = mulberry32(config.seed + 2);

  // Collect high-elevation land corners as river source candidates
  const candidates = corners
    .filter(
      (c) =>
        c.elevation > 0.6 &&
        !c.isWater &&
        c.downslope !== -1
    )
    .sort((a, b) => b.elevation - a.elevation);

  // Pick river sources, ensuring they're spaced apart
  const sources: number[] = [];
  const minRiverSpacing = config.mapSize * 0.12;

  for (const candidate of candidates) {
    if (sources.length >= config.riverCount) break;
    const tooClose = sources.some((si) => {
      const s = corners[si].position;
      const c = candidate.position;
      const dx = s.x - c.x;
      const dy = s.y - c.y;
      return Math.sqrt(dx * dx + dy * dy) < minRiverSpacing;
    });
    if (!tooClose) {
      sources.push(candidate.index);
    }
  }

  // Build edge lookup by corner pair
  const edgeLookup = new Map<string, number>();
  for (const edge of edges) {
    const [c0, c1] = edge.corners;
    edgeLookup.set(`${Math.min(c0, c1)},${Math.max(c0, c1)}`, edge.index);
  }

  // Trace each river downhill
  for (const sourceIdx of sources) {
    let current = sourceIdx;
    let volume = 1;

    const visited = new Set<number>();
    while (current !== -1) {
      if (visited.has(current)) break; // prevent cycles
      visited.add(current);

      const corner = corners[current];
      corner.isRiver = true;
      corner.riverSize = Math.max(corner.riverSize, volume);

      const next = corner.downslope;
      if (next === -1 || corners[next].isWater) break;

      // Find and mark the edge
      const edgeKey = `${Math.min(current, next)},${Math.max(current, next)}`;
      const edgeIdx = edgeLookup.get(edgeKey);
      if (edgeIdx !== undefined) {
        edges[edgeIdx].riverVolume += volume;
      }

      volume++;
      current = next;

      // Safety: prevent very long rivers
      if (volume > 500) break;
    }
  }
}
