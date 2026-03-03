/**
 * Difficulty zone computation from elevation.
 */

import { DifficultyZone } from "../types";

export function getDifficultyFromElevation(elevation: number): DifficultyZone {
  if (elevation < 0.15) return DifficultyZone.Shore;
  if (elevation < 0.35) return DifficultyZone.Lowlands;
  if (elevation < 0.55) return DifficultyZone.Midlands;
  if (elevation < 0.75) return DifficultyZone.Highlands;
  return DifficultyZone.Godlands;
}
