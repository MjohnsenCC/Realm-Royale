/**
 * CLI tool for generating realm maps.
 *
 * Usage:
 *   npx tsx packages/shared/src/mapGen/generate-cli.ts [seed]
 *
 * Outputs:
 *   packages/client/public/assets/realm-map.json
 */

import * as fs from "fs";
import * as path from "path";
import { generateRealmMap } from "./index";
import { serializeRealmMap } from "../realmMap";

const seed = parseInt(process.argv[2] || "42", 10);

console.log(`\n=== Realm Map Generator ===`);
console.log(`Seed: ${seed}\n`);

const startTime = Date.now();
const mapData = generateRealmMap({ seed });
const genTime = Date.now() - startTime;
console.log(`\nGeneration time: ${(genTime / 1000).toFixed(2)}s`);

// Serialize
console.log("Serializing map data...");
const json = serializeRealmMap(mapData);
const jsonSize = Buffer.byteLength(json, "utf-8");
console.log(`JSON size: ${(jsonSize / 1024).toFixed(1)} KB`);

// Write to client public assets
const projectRoot = path.resolve(__dirname, "../../../..");
const clientAssetsDir = path.join(projectRoot, "packages/client/public/assets");

// Create assets directory if it doesn't exist
fs.mkdirSync(clientAssetsDir, { recursive: true });

const outputPath = path.join(clientAssetsDir, "realm-map.json");
fs.writeFileSync(outputPath, json, "utf-8");
console.log(`\nWritten to: ${outputPath}`);

// Also write to shared data directory for server access
const sharedDataDir = path.join(projectRoot, "packages/shared/data");
fs.mkdirSync(sharedDataDir, { recursive: true });
const serverOutputPath = path.join(sharedDataDir, "realm-map.json");
fs.writeFileSync(serverOutputPath, json, "utf-8");
console.log(`Written to: ${serverOutputPath}`);

// Print map statistics
console.log("\n=== Map Statistics ===");
console.log(`Size: ${mapData.width}x${mapData.height} tiles`);
console.log(`Tile size: ${mapData.tileSize}px`);
console.log(`World size: ${mapData.width * mapData.tileSize}x${mapData.height * mapData.tileSize}px`);
console.log(`Spawn points: ${mapData.spawnPoints.length}`);
console.log(`Setpieces: ${mapData.setpieces.length}`);
console.log(`Decorations: ${mapData.decorations.length}`);

// Biome distribution
const biomeCounts: Record<number, number> = {};
for (let i = 0; i < mapData.biomes.length; i++) {
  const b = mapData.biomes[i];
  biomeCounts[b] = (biomeCounts[b] || 0) + 1;
}
console.log("\nBiome distribution:");
const biomeNames = [
  "Ocean", "ShallowWater", "Beach", "Marsh", "Desert", "DryPlains",
  "Grassland", "Forest", "Jungle", "Shrubland", "Taiga", "DesertCliffs",
  "Tundra", "Scorched", "Snow", "Lake",
];
for (const [biome, count] of Object.entries(biomeCounts)) {
  const pct = ((count / mapData.biomes.length) * 100).toFixed(1);
  const name = biomeNames[parseInt(biome)] || `Unknown(${biome})`;
  console.log(`  ${name}: ${count} tiles (${pct}%)`);
}

// River/road tile counts
let riverTiles = 0;
let roadTiles = 0;
for (let i = 0; i < mapData.rivers.length; i++) {
  if (mapData.rivers[i] > 0) riverTiles++;
}
for (let i = 0; i < mapData.roads.length; i++) {
  if (mapData.roads[i] > 0) roadTiles++;
}
console.log(`\nRiver tiles: ${riverTiles}`);
console.log(`Road tiles: ${roadTiles}`);
console.log(`\nDone!`);
