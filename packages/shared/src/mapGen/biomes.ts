/**
 * Stage 7: Biome assignment.
 * Whittaker-style elevation x moisture lookup table.
 */

import { RealmBiome } from "../types";
import type { Polygon } from "./types";

export function assignBiomes(polygons: Polygon[]): number[] {
  const biomes: number[] = new Array(polygons.length);

  for (const polygon of polygons) {
    if (polygon.isOcean) {
      biomes[polygon.index] = RealmBiome.Ocean;
    } else if (polygon.isLake) {
      biomes[polygon.index] = RealmBiome.Lake;
    } else {
      biomes[polygon.index] = getBiome(polygon.elevation, polygon.moisture);
    }
  }

  return biomes;
}

export function getBiome(elevation: number, moisture: number): number {
  // Shallow water / beach zone
  if (elevation < 0.05) return RealmBiome.Beach;
  if (elevation < 0.1) {
    if (moisture > 0.7) return RealmBiome.Marsh;
    return RealmBiome.Beach;
  }

  // Low elevation (0.1 - 0.3)
  if (elevation < 0.3) {
    if (moisture < 0.2) return RealmBiome.Desert;
    if (moisture < 0.4) return RealmBiome.DryPlains;
    if (moisture < 0.7) return RealmBiome.Grassland;
    return RealmBiome.Jungle;
  }

  // Medium elevation (0.3 - 0.55)
  if (elevation < 0.55) {
    if (moisture < 0.2) return RealmBiome.Desert;
    if (moisture < 0.5) return RealmBiome.Grassland;
    if (moisture < 0.7) return RealmBiome.Forest;
    return RealmBiome.Jungle;
  }

  // High elevation (0.55 - 0.75)
  if (elevation < 0.75) {
    if (moisture < 0.25) return RealmBiome.DesertCliffs;
    if (moisture < 0.5) return RealmBiome.Shrubland;
    return RealmBiome.Taiga;
  }

  // Mountain peaks (0.75 - 1.0)
  if (moisture < 0.2) return RealmBiome.Scorched;
  if (moisture < 0.5) return RealmBiome.Tundra;
  return RealmBiome.Snow;
}
