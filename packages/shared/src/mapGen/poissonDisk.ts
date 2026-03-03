/**
 * Stage 1: Poisson Disk point distribution.
 * Generates well-spaced seed points across the map area.
 */

import PoissonDiskSampling from "poisson-disk-sampling";
import type { Point, MapConfig } from "./types";
import { mulberry32 } from "./rng";

export function generatePoints(config: MapConfig): Point[] {
  const rng = mulberry32(config.seed);

  const pds = new PoissonDiskSampling({
    shape: [config.mapSize, config.mapSize],
    minDistance: config.poissonMinDistance,
    maxDistance: config.poissonMinDistance * 2,
    tries: 30,
  }, undefined, rng);

  const raw: number[][] = pds.fill();
  return raw.map(([x, y]) => ({ x, y }));
}
