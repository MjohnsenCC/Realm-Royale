/**
 * Decoration placement.
 * Scatters trees, rocks, bushes etc. based on biome with density controlled by seeded RNG.
 */

import { RealmBiome, DecorationType } from "../types";
import type { DecorationEntry } from "../realmMap";
import { mulberry32 } from "./rng";

interface DecorationRule {
  type: DecorationType;
  density: number; // probability per tile
}

const DECORATION_TABLE: Partial<Record<number, DecorationRule[]>> = {
  [RealmBiome.Beach]: [
    { type: DecorationType.RockSmall, density: 0.02 },
  ],
  [RealmBiome.Marsh]: [
    { type: DecorationType.Bush, density: 0.06 },
    { type: DecorationType.Mushroom, density: 0.02 },
  ],
  [RealmBiome.Desert]: [
    { type: DecorationType.Cactus, density: 0.02 },
    { type: DecorationType.RockSmall, density: 0.01 },
    { type: DecorationType.Bones, density: 0.005 },
  ],
  [RealmBiome.DryPlains]: [
    { type: DecorationType.Bush, density: 0.03 },
    { type: DecorationType.RockSmall, density: 0.01 },
  ],
  [RealmBiome.Grassland]: [
    { type: DecorationType.TreeOak, density: 0.03 },
    { type: DecorationType.Bush, density: 0.04 },
    { type: DecorationType.Flower, density: 0.02 },
  ],
  [RealmBiome.Forest]: [
    { type: DecorationType.TreeOak, density: 0.12 },
    { type: DecorationType.Bush, density: 0.05 },
    { type: DecorationType.Mushroom, density: 0.02 },
  ],
  [RealmBiome.Jungle]: [
    { type: DecorationType.TreePalm, density: 0.15 },
    { type: DecorationType.Bush, density: 0.08 },
    { type: DecorationType.Flower, density: 0.03 },
  ],
  [RealmBiome.Shrubland]: [
    { type: DecorationType.Bush, density: 0.06 },
    { type: DecorationType.RockSmall, density: 0.02 },
  ],
  [RealmBiome.Taiga]: [
    { type: DecorationType.TreePine, density: 0.10 },
    { type: DecorationType.RockSmall, density: 0.03 },
  ],
  [RealmBiome.DesertCliffs]: [
    { type: DecorationType.RockLarge, density: 0.04 },
    { type: DecorationType.RockSmall, density: 0.03 },
    { type: DecorationType.Bones, density: 0.005 },
  ],
  [RealmBiome.Tundra]: [
    { type: DecorationType.RockLarge, density: 0.03 },
    { type: DecorationType.TreeDead, density: 0.01 },
  ],
  [RealmBiome.Scorched]: [
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.Bones, density: 0.01 },
    { type: DecorationType.Ruins, density: 0.005 },
  ],
  [RealmBiome.Snow]: [
    { type: DecorationType.TreePine, density: 0.04 },
    { type: DecorationType.RockSmall, density: 0.02 },
  ],
};

export function placeDecorations(
  biomes: Uint8Array,
  rivers: Uint8Array,
  roads: Uint8Array,
  mapSize: number,
  seed: number
): DecorationEntry[] {
  const rng = mulberry32(seed + 4);
  const decorations: DecorationEntry[] = [];

  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const idx = y * mapSize + x;

      // Skip rivers and roads
      if (rivers[idx] > 0 || roads[idx] > 0) continue;

      const biome = biomes[idx];
      const rules = DECORATION_TABLE[biome];
      if (!rules) continue;

      for (const { type, density } of rules) {
        if (rng() < density) {
          decorations.push({ tileX: x, tileY: y, type });
          break; // one decoration per tile
        }
      }
    }
  }

  return decorations;
}
