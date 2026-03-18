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
  // ===== TIER 1: THE WILD =====
  [RealmBiome.WildShore]: [
    { type: DecorationType.RockSmall, density: 0.02 },
    { type: DecorationType.Grass4, density: 0.01 },
  ],
  [RealmBiome.WildMeadow]: [
    { type: DecorationType.TreeOak, density: 0.015 },
    { type: DecorationType.Bush, density: 0.04 },
    { type: DecorationType.Flower, density: 0.02 },
    { type: DecorationType.Grass1, density: 0.03 },
    { type: DecorationType.Grass2, density: 0.02 },
    { type: DecorationType.Flowers1, density: 0.015 },
    { type: DecorationType.Flowers3, density: 0.01 },
  ],
  [RealmBiome.WildMarsh]: [
    { type: DecorationType.Bush, density: 0.06 },
    { type: DecorationType.Mushroom, density: 0.02 },
    { type: DecorationType.Grass1, density: 0.02 },
    { type: DecorationType.Grass4, density: 0.02 },
  ],
  [RealmBiome.WildPlains]: [
    { type: DecorationType.Bush, density: 0.03 },
    { type: DecorationType.RockSmall, density: 0.01 },
    { type: DecorationType.Grass3, density: 0.02 },
    { type: DecorationType.Flowers3, density: 0.01 },
  ],
  [RealmBiome.WildForest]: [
    { type: DecorationType.TreeOak, density: 0.042 },
    { type: DecorationType.Bush, density: 0.035 },
    { type: DecorationType.Mushroom, density: 0.014 },
    { type: DecorationType.Grass1, density: 0.02 },
    { type: DecorationType.Grass2, density: 0.015 },
    { type: DecorationType.Flowers2, density: 0.01 },
  ],
  [RealmBiome.WildJungle]: [
    { type: DecorationType.TreePalm, density: 0.075 },
    { type: DecorationType.Bush, density: 0.08 },
    { type: DecorationType.Flower, density: 0.03 },
    { type: DecorationType.Grass2, density: 0.03 },
    { type: DecorationType.Flowers1, density: 0.02 },
    { type: DecorationType.Flowers2, density: 0.015 },
  ],
  [RealmBiome.WildDesert]: [
    { type: DecorationType.Cactus, density: 0.02 },
    { type: DecorationType.RockSmall, density: 0.01 },
    { type: DecorationType.Bones, density: 0.005 },
  ],
  [RealmBiome.WildTaiga]: [
    { type: DecorationType.TreePine, density: 0.05 },
    { type: DecorationType.RockSmall, density: 0.03 },
  ],
  [RealmBiome.WildCliffs]: [
    { type: DecorationType.RockLarge, density: 0.04 },
    { type: DecorationType.RockSmall, density: 0.03 },
    { type: DecorationType.Bones, density: 0.005 },
  ],
  [RealmBiome.WildShrubland]: [
    { type: DecorationType.Bush, density: 0.06 },
    { type: DecorationType.RockSmall, density: 0.02 },
    { type: DecorationType.Grass3, density: 0.02 },
  ],
  [RealmBiome.WildTundra]: [
    { type: DecorationType.RockLarge, density: 0.03 },
    { type: DecorationType.TreeDead, density: 0.01 },
  ],
  [RealmBiome.WildPeaks]: [
    { type: DecorationType.TreePine, density: 0.04 },
    { type: DecorationType.RockSmall, density: 0.02 },
  ],
  [RealmBiome.WildVolcanic]: [
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.Bones, density: 0.01 },
    { type: DecorationType.Ruins, density: 0.005 },
  ],

  // ===== TIER 2: THE RUINS =====
  [RealmBiome.RuinsShore]: [
    { type: DecorationType.RockSmall, density: 0.03 },
    { type: DecorationType.Bones, density: 0.005 },
  ],
  [RealmBiome.RuinsDustlands]: [
    { type: DecorationType.Bush, density: 0.02 },
    { type: DecorationType.RockSmall, density: 0.02 },
    { type: DecorationType.Grass3, density: 0.01 },
    { type: DecorationType.Ruins, density: 0.003 },
  ],
  [RealmBiome.RuinsBog]: [
    { type: DecorationType.TreeDead, density: 0.02 },
    { type: DecorationType.Bush, density: 0.04 },
    { type: DecorationType.Mushroom, density: 0.03 },
    { type: DecorationType.Grass4, density: 0.02 },
  ],
  [RealmBiome.RuinsBarrens]: [
    { type: DecorationType.RockSmall, density: 0.03 },
    { type: DecorationType.Bones, density: 0.01 },
    { type: DecorationType.Cactus, density: 0.01 },
  ],
  [RealmBiome.RuinsCatacombs]: [
    { type: DecorationType.RockLarge, density: 0.03 },
    { type: DecorationType.Ruins, density: 0.01 },
    { type: DecorationType.Bones, density: 0.01 },
  ],
  [RealmBiome.RuinsWasteland]: [
    { type: DecorationType.TreeDead, density: 0.015 },
    { type: DecorationType.RockSmall, density: 0.03 },
    { type: DecorationType.Bones, density: 0.008 },
  ],
  [RealmBiome.RuinsDesolation]: [
    { type: DecorationType.Ruins, density: 0.015 },
    { type: DecorationType.RockLarge, density: 0.02 },
    { type: DecorationType.Bones, density: 0.01 },
  ],
  [RealmBiome.RuinsObsidian]: [
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.RockSmall, density: 0.03 },
  ],
  [RealmBiome.RuinsFrostfall]: [
    { type: DecorationType.TreeDead, density: 0.02 },
    { type: DecorationType.RockSmall, density: 0.03 },
  ],
  [RealmBiome.RuinsAshlands]: [
    { type: DecorationType.RockLarge, density: 0.04 },
    { type: DecorationType.Bones, density: 0.015 },
    { type: DecorationType.Ruins, density: 0.005 },
  ],
  [RealmBiome.RuinsShadowlands]: [
    { type: DecorationType.RockLarge, density: 0.04 },
    { type: DecorationType.Ruins, density: 0.01 },
    { type: DecorationType.Bones, density: 0.015 },
  ],
  [RealmBiome.RuinsDarkSpire]: [
    { type: DecorationType.Ruins, density: 0.015 },
    { type: DecorationType.RockLarge, density: 0.05 },
  ],
  [RealmBiome.RuinsVoidEdge]: [
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.Bones, density: 0.02 },
    { type: DecorationType.Ruins, density: 0.01 },
  ],

  // ===== TIER 3: DEVINE HELL =====
  [RealmBiome.HellScorch]: [
    { type: DecorationType.RockSmall, density: 0.03 },
    { type: DecorationType.Bones, density: 0.01 },
  ],
  [RealmBiome.HellBrimstone]: [
    { type: DecorationType.RockLarge, density: 0.03 },
    { type: DecorationType.Bones, density: 0.015 },
    { type: DecorationType.RockSmall, density: 0.02 },
  ],
  [RealmBiome.HellCinder]: [
    { type: DecorationType.RockSmall, density: 0.04 },
    { type: DecorationType.Bones, density: 0.01 },
  ],
  [RealmBiome.HellEmberfield]: [
    { type: DecorationType.RockLarge, density: 0.02 },
    { type: DecorationType.Bones, density: 0.02 },
    { type: DecorationType.Ruins, density: 0.005 },
  ],
  [RealmBiome.HellInferno]: [
    { type: DecorationType.RockLarge, density: 0.04 },
    { type: DecorationType.Bones, density: 0.02 },
  ],
  [RealmBiome.HellDemonforge]: [
    { type: DecorationType.Ruins, density: 0.015 },
    { type: DecorationType.RockLarge, density: 0.04 },
    { type: DecorationType.Bones, density: 0.015 },
  ],
  [RealmBiome.HellBloodmire]: [
    { type: DecorationType.Bones, density: 0.03 },
    { type: DecorationType.RockSmall, density: 0.02 },
  ],
  [RealmBiome.HellAbyssal]: [
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.Ruins, density: 0.01 },
  ],
  [RealmBiome.HellDoomspire]: [
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.Bones, density: 0.02 },
  ],
  [RealmBiome.HellSoulfire]: [
    { type: DecorationType.Ruins, density: 0.01 },
    { type: DecorationType.Bones, density: 0.025 },
    { type: DecorationType.RockLarge, density: 0.03 },
  ],
  [RealmBiome.HellVoidmaw]: [
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.Ruins, density: 0.015 },
    { type: DecorationType.Bones, density: 0.02 },
  ],
  [RealmBiome.HellChaosrift]: [
    { type: DecorationType.Ruins, density: 0.02 },
    { type: DecorationType.RockLarge, density: 0.04 },
  ],
  [RealmBiome.HellAnnihilation]: [
    { type: DecorationType.Ruins, density: 0.02 },
    { type: DecorationType.RockLarge, density: 0.05 },
    { type: DecorationType.Bones, density: 0.025 },
  ],
};

// Tall tree types that occupy 2 vertical tiles (trunk + canopy above)
const TALL_TYPES: ReadonlySet<number> = new Set([
  DecorationType.TreePalm,
  DecorationType.TreeOak,
  DecorationType.TreePine,
  DecorationType.TreeDead,
]);

export function placeDecorations(
  biomes: Uint8Array,
  rivers: Uint8Array,
  roads: Uint8Array,
  mapSize: number,
  seed: number
): DecorationEntry[] {
  const rng = mulberry32(seed + 4);
  const decorations: DecorationEntry[] = [];
  // Track occupied tiles so tall trees can reserve their canopy tile (tileY-1)
  const occupied = new Set<number>();

  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const idx = y * mapSize + x;

      // Skip rivers and roads
      if (rivers[idx] > 0 || roads[idx] > 0) continue;
      // Skip already-occupied tiles (reserved by a canopy above)
      if (occupied.has(idx)) continue;

      const biome = biomes[idx];
      const rules = DECORATION_TABLE[biome];
      if (!rules) continue;

      for (const { type, density } of rules) {
        if (rng() < density) {
          if (TALL_TYPES.has(type)) {
            // Tall trees need the tile above (y-1) free for their canopy
            if (y === 0) break; // can't place canopy above top edge
            const aboveIdx = (y - 1) * mapSize + x;
            if (occupied.has(aboveIdx)) break; // canopy slot taken
            occupied.add(aboveIdx);
          }
          occupied.add(idx);
          decorations.push({ tileX: x, tileY: y, type });
          break; // one decoration per tile
        }
      }
    }
  }

  return decorations;
}
