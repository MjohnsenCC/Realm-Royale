/**
 * Stage 7: Biome assignment.
 * Whittaker-style elevation x moisture lookup table.
 * Each realm tier has its own 15 unique biomes — no sharing between tiers.
 */

import { RealmBiome, RealmTier } from "../types";
import type { Polygon } from "./types";

export function assignBiomes(polygons: Polygon[]): number[] {
  return assignBiomesForTier(polygons, RealmTier.Wild);
}

/** Assign biomes for a specific realm tier. */
export function assignBiomesForTier(polygons: Polygon[], tier: number): number[] {
  const biomes: number[] = new Array(polygons.length);
  const getBiomeFn = tier === RealmTier.DevineHell ? getBiomeTier3
    : tier === RealmTier.Ruins ? getBiomeTier2
    : getBiomeTier1;

  const oceanBiome = tier === RealmTier.DevineHell ? RealmBiome.HellOcean
    : tier === RealmTier.Ruins ? RealmBiome.RuinsOcean
    : RealmBiome.WildOcean;

  const lakeBiome = tier === RealmTier.DevineHell ? RealmBiome.HellLava
    : tier === RealmTier.Ruins ? RealmBiome.RuinsShallows
    : RealmBiome.WildShallows;

  for (const polygon of polygons) {
    if (polygon.isOcean) {
      biomes[polygon.index] = oceanBiome;
    } else if (polygon.isLake) {
      biomes[polygon.index] = lakeBiome;
    } else {
      biomes[polygon.index] = getBiomeFn(polygon.elevation, polygon.moisture);
    }
  }

  return biomes;
}

// ===== TIER 1: THE WILD (natural/lush) =====

function getBiomeTier1(elevation: number, moisture: number): number {
  // Shore (0 - 0.15)
  if (elevation < 0.15) return RealmBiome.WildShore;

  // Lowlands (0.15 - 0.35)
  if (elevation < 0.35) {
    if (moisture < 0.3) return RealmBiome.WildPlains;
    if (moisture < 0.6) return RealmBiome.WildMeadow;
    return RealmBiome.WildMarsh;
  }

  // Midlands (0.35 - 0.55)
  if (elevation < 0.55) {
    if (moisture < 0.3) return RealmBiome.WildDesert;
    if (moisture < 0.6) return RealmBiome.WildForest;
    return RealmBiome.WildJungle;
  }

  // Highlands (0.55 - 0.75)
  if (elevation < 0.75) {
    if (moisture < 0.3) return RealmBiome.WildCliffs;
    if (moisture < 0.6) return RealmBiome.WildShrubland;
    return RealmBiome.WildTaiga;
  }

  // Godlands (0.75 - 1.0)
  if (moisture < 0.3) return RealmBiome.WildVolcanic;
  if (moisture < 0.6) return RealmBiome.WildTundra;
  return RealmBiome.WildPeaks;
}

// ===== TIER 2: THE RUINS (decayed/ancient) =====

function getBiomeTier2(elevation: number, moisture: number): number {
  // Shore (0 - 0.15)
  if (elevation < 0.15) return RealmBiome.RuinsShore;

  // Lowlands (0.15 - 0.35)
  if (elevation < 0.35) {
    if (moisture < 0.3) return RealmBiome.RuinsBarrens;
    if (moisture < 0.6) return RealmBiome.RuinsDustlands;
    return RealmBiome.RuinsBog;
  }

  // Midlands (0.35 - 0.55)
  if (elevation < 0.55) {
    if (moisture < 0.3) return RealmBiome.RuinsWasteland;
    if (moisture < 0.6) return RealmBiome.RuinsCatacombs;
    return RealmBiome.RuinsDesolation;
  }

  // Highlands (0.55 - 0.75)
  if (elevation < 0.75) {
    if (moisture < 0.3) return RealmBiome.RuinsObsidian;
    if (moisture < 0.6) return RealmBiome.RuinsAshlands;
    return RealmBiome.RuinsFrostfall;
  }

  // Godlands (0.75 - 1.0)
  if (moisture < 0.3) return RealmBiome.RuinsVoidEdge;
  if (moisture < 0.6) return RealmBiome.RuinsShadowlands;
  return RealmBiome.RuinsDarkSpire;
}

// ===== TIER 3: DEVINE HELL (hellish/demonic) =====

function getBiomeTier3(elevation: number, moisture: number): number {
  // Shore (0 - 0.15)
  if (elevation < 0.15) return RealmBiome.HellScorch;

  // Lowlands (0.15 - 0.35)
  if (elevation < 0.35) {
    if (moisture < 0.3) return RealmBiome.HellBrimstone;
    if (moisture < 0.6) return RealmBiome.HellCinder;
    return RealmBiome.HellEmberfield;
  }

  // Midlands (0.35 - 0.55)
  if (elevation < 0.55) {
    if (moisture < 0.3) return RealmBiome.HellInferno;
    if (moisture < 0.6) return RealmBiome.HellDemonforge;
    return RealmBiome.HellBloodmire;
  }

  // Highlands (0.55 - 0.75)
  if (elevation < 0.75) {
    if (moisture < 0.3) return RealmBiome.HellAbyssal;
    if (moisture < 0.6) return RealmBiome.HellDoomspire;
    return RealmBiome.HellSoulfire;
  }

  // Godlands (0.75 - 1.0)
  if (moisture < 0.3) return RealmBiome.HellVoidmaw;
  if (moisture < 0.6) return RealmBiome.HellChaosrift;
  return RealmBiome.HellAnnihilation;
}
