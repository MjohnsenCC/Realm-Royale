/**
 * Setpiece placement.
 * Places dungeon entrances, boss arenas, quest areas at polygon centers based on difficulty zone.
 */

import { DifficultyZone } from "../types";
import type { SetpieceEntry } from "../realmMap";
import type { Polygon } from "./types";
import { getDifficultyFromElevation } from "./difficulty";
import { mulberry32, shuffleArray } from "./rng";

interface SetpieceDefinition {
  id: string;
  zone: DifficultyZone;
  radius: number; // tiles radius of the setpiece area
  maxCount: number;
  minSpacing: number; // minimum distance between same-type setpieces (in tiles)
}

const SETPIECE_DEFS: SetpieceDefinition[] = [
  { id: "bandit_camp", zone: DifficultyZone.Shore, radius: 8, maxCount: 3, minSpacing: 78 },
  { id: "pirate_cove", zone: DifficultyZone.Shore, radius: 10, maxCount: 2, minSpacing: 117 },
  { id: "spider_den", zone: DifficultyZone.Lowlands, radius: 8, maxCount: 4, minSpacing: 59 },
  { id: "undead_lair", zone: DifficultyZone.Lowlands, radius: 10, maxCount: 3, minSpacing: 78 },
  { id: "ancient_ruins", zone: DifficultyZone.Midlands, radius: 12, maxCount: 3, minSpacing: 78 },
  { id: "demon_gate", zone: DifficultyZone.Highlands, radius: 10, maxCount: 2, minSpacing: 98 },
  { id: "dragon_lair", zone: DifficultyZone.Godlands, radius: 15, maxCount: 1, minSpacing: 156 },
  { id: "dark_temple", zone: DifficultyZone.Godlands, radius: 12, maxCount: 2, minSpacing: 117 },
];

export function placeSetpieces(
  polygons: Polygon[],
  biomes: Uint8Array,
  mapSize: number,
  seed: number
): { setpieces: SetpieceEntry[]; setpiecePolygonIndices: number[] } {
  const rng = mulberry32(seed + 5);
  const setpieces: SetpieceEntry[] = [];
  const setpiecePolygonIndices: number[] = [];
  const placedPositions: { x: number; y: number }[] = [];

  for (const def of SETPIECE_DEFS) {
    // Find candidate polygons in the right zone
    const candidates = polygons.filter(
      (p) =>
        !p.isWater &&
        getDifficultyFromElevation(p.elevation) === def.zone &&
        !p.neighbors.some((ni) => polygons[ni].isWater)
    );

    shuffleArray(candidates, rng);

    let placed = 0;
    for (const candidate of candidates) {
      if (placed >= def.maxCount) break;

      // Check spacing from already-placed setpieces
      const tooClose = placedPositions.some((pos) => {
        const dx = pos.x - candidate.center.x;
        const dy = pos.y - candidate.center.y;
        return Math.sqrt(dx * dx + dy * dy) < def.minSpacing;
      });
      if (tooClose) continue;

      // Verify center tile is walkable
      const tx = Math.floor(candidate.center.x);
      const ty = Math.floor(candidate.center.y);
      if (tx < 0 || tx >= mapSize || ty < 0 || ty >= mapSize) continue;

      setpieces.push({
        id: def.id,
        tileX: tx,
        tileY: ty,
        radius: def.radius,
      });

      placedPositions.push({ x: candidate.center.x, y: candidate.center.y });
      setpiecePolygonIndices.push(candidate.index);
      placed++;
    }
  }

  return { setpieces, setpiecePolygonIndices };
}

/**
 * Mark setpiece tiles on the biomes/road grid for later use.
 * Returns the tile indices that are part of setpieces.
 */
export function markSetpieceTiles(
  setpieces: SetpieceEntry[],
  mapSize: number
): Set<number> {
  const marked = new Set<number>();

  for (const sp of setpieces) {
    const cx = sp.tileX;
    const cy = sp.tileY;
    for (let dy = -sp.radius; dy <= sp.radius; dy++) {
      for (let dx = -sp.radius; dx <= sp.radius; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (
          tx >= 0 && tx < mapSize &&
          ty >= 0 && ty < mapSize &&
          dx * dx + dy * dy <= sp.radius * sp.radius
        ) {
          marked.add(ty * mapSize + tx);
        }
      }
    }
  }

  return marked;
}
