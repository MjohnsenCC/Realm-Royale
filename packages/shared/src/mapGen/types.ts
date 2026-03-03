/**
 * Internal types for the map generation pipeline.
 * These are intermediate graph structures, not exported to the game.
 */

export interface Point {
  x: number;
  y: number;
}

export interface MapConfig {
  seed: number;
  mapSize: number; // tile grid dimensions (2048)
  numPoints: number; // Poisson disk point count target (~2000)
  poissonMinDistance: number; // minimum distance between seed points (~30-50)
  islandFalloffRate: number; // how aggressively edges become ocean (1.0-1.5)
  noiseScale: number; // base noise frequency for coastline (0.005-0.02)
  elevationNoiseFactor: number; // noise added to BFS elevation (0.1-0.2)
  moistureWindDirection: number; // wind angle in radians
  riverCount: number; // number of rivers to generate (5-15)
}

export interface Polygon {
  index: number;
  center: Point;
  corners: number[]; // indices into corners array
  neighbors: number[]; // indices into polygons array
  isWater: boolean;
  isOcean: boolean;
  isLake: boolean;
  isCoast: boolean; // land polygon adjacent to ocean
  elevation: number; // 0.0 (coast) to 1.0 (mountain peak)
  moisture: number; // 0.0 (dry) to 1.0 (wet)
  distanceFromCoast: number; // raw BFS distance before normalization
}

export interface Corner {
  index: number;
  position: Point;
  polygons: number[]; // indices into polygons array (up to 3)
  adjacent: number[]; // neighboring corner indices
  elevation: number;
  moisture: number;
  isWater: boolean;
  isCoast: boolean;
  isRiver: boolean;
  riverSize: number; // 0 = no river, higher = wider
  downslope: number; // index of downhill neighbor corner (-1 if none)
}

export interface Edge {
  index: number;
  polygons: [number, number]; // the two polygon indices on either side
  corners: [number, number]; // the two corner indices at endpoints
  isCoastEdge: boolean;
  riverVolume: number; // 0 = no river, higher = more flow
}

export const DEFAULT_CONFIG: MapConfig = {
  seed: 42,
  mapSize: 2048,
  numPoints: 2000,
  poissonMinDistance: 40,
  islandFalloffRate: 1.2,
  noiseScale: 0.01,
  elevationNoiseFactor: 0.15,
  moistureWindDirection: Math.PI * 0.25,
  riverCount: 10,
};
