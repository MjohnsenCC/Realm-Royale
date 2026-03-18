import Phaser from "phaser";
import { CharacterClass, EnemyType, PIXEL_SCALE } from "@rotmg-lite/shared";

const ENEMY_SPRITE_COUNT = 6;
const SPRITE_SOURCE_SIZE = 12;
const BOSS_SPRITE_SOURCE_SIZE = 24;

/** Display size of outlined sprites (upscaled + 1px outline on each side). */
export const OUTLINED_DISPLAY_SIZE = SPRITE_SOURCE_SIZE * PIXEL_SCALE + 2;

/** Display size of boss outlined sprites (24x24 source). */
export const BOSS_OUTLINED_DISPLAY_SIZE = BOSS_SPRITE_SOURCE_SIZE * PIXEL_SCALE + 2;

/** Boss enemy type → sprite key mapping. */
const BOSS_SPRITE_KEYS: Record<number, string> = {
  [EnemyType.MoltenWyrm]: "sprite-boss-infernal",
  [EnemyType.TheArchitect]: "sprite-boss-void",
};

/** Maps a CharacterClass id to its loaded sprite texture key. */
const CLASS_SPRITE_KEYS: Record<number, string> = {
  [CharacterClass.Archer]: "sprite-player-archer",
  [CharacterClass.Warrior]: "sprite-player-warrior",
  [CharacterClass.Arcanist]: "sprite-player-arcanist",
};

/** Returns the sprite texture key for a given character class. */
export function getPlayerSpriteKey(characterClass: number): string {
  return CLASS_SPRITE_KEYS[characterClass] ?? "sprite-player-archer";
}

/** Returns the sprite texture key for a given enemy type number. */
export function getEnemySpriteKey(enemyType: number): string {
  if (enemyType in BOSS_SPRITE_KEYS) return BOSS_SPRITE_KEYS[enemyType];
  return `sprite-enemy-${(enemyType % ENEMY_SPRITE_COUNT) + 1}`;
}

/** Returns the outlined display size for a given enemy type. */
export function getEnemyDisplaySize(enemyType: number): number {
  if (enemyType in BOSS_SPRITE_KEYS) return BOSS_OUTLINED_DISPLAY_SIZE;
  return OUTLINED_DISPLAY_SIZE;
}

/**
 * Pre-render shared utility textures and projectile shapes.
 * Call once per scene that uses entities (GameScene.create).
 */
export function generateEntityTextures(scene: Phaser.Scene): void {
  // Shared 1×1 white pixel — used for HP bars (tinted + scaled per entity)
  if (!scene.textures.exists("pixel")) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("pixel", 1, 1);
    g.destroy();
  }

  // Upscale sprites to display resolution and add 1px outline
  for (const key of Object.values(CLASS_SPRITE_KEYS)) {
    upscaleAndOutline(scene, key);
  }
  for (let i = 1; i <= ENEMY_SPRITE_COUNT; i++) {
    upscaleAndOutline(scene, `sprite-enemy-${i}`);
  }

  // Boss sprites
  for (const key of Object.values(BOSS_SPRITE_KEYS)) {
    upscaleAndOutline(scene, key);
  }

  // Portal sprites
  for (const key of ["portal-the-wild", "portal-the-ruins", "portal-devine-hell", "portal-infernal-pit", "portal-void-sanctum", "portal-vault", "portal-gem"]) {
    upscaleAndOutline(scene, key);
  }

  // Interactive decoration sprites
  for (const key of ["deco-chest", "deco-crafting-table"]) {
    upscaleAndOutline(scene, key);
  }

  // Zone decoration sprites (placed via Tiled)
  for (const key of ["deco-torch_small", "deco-torch_tall"]) {
    upscaleAndOutline(scene, key);
  }

  // Death gravestone sprite
  upscaleAndOutline(scene, "deco-gravestone");

  // Loot bag sprites
  for (const key of ["bag-green", "bag-red", "bag-black", "bag-orange"]) {
    upscaleAndOutline(scene, key);
  }
}

/**
 * Upscales a sprite to display resolution with nearest-neighbor, then adds
 * a 1-screen-pixel black outline. Replaces the texture in-place so all
 * existing key references keep working. Zero per-frame cost — the outline
 * is baked into the texture at boot.
 */
const processedKeys = new Set<string>();

function upscaleAndOutline(scene: Phaser.Scene, key: string): void {
  if (processedKeys.has(key)) return;
  const tex = scene.textures.get(key);
  if (!tex || tex.key === "__MISSING") return;

  const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;

  const upW = src.width * PIXEL_SCALE;
  const upH = src.height * PIXEL_SCALE;
  // +2 for 1px outline border on each side
  const outW = upW + 2;
  const outH = upH + 2;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  // Nearest-neighbor upscale: draw source at offset (1,1) scaled to display size
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 1, 1, upW, upH);

  addOutlineToImageData(ctx, outW, outH);

  // Replace texture with outlined version using the same key
  scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  processedKeys.add(key);
}

export interface OutlineEdges {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

/**
 * Adds a 1px black outline to opaque pixel edges in the given canvas context.
 * skipEdges allows suppressing the outline on specific sides (for tree seams).
 */
export function addOutlineToImageData(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  skipEdges?: OutlineEdges
): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const skipTop = skipEdges?.top ?? false;
  const skipBottom = skipEdges?.bottom ?? false;
  const skipLeft = skipEdges?.left ?? false;
  const skipRight = skipEdges?.right ?? false;

  // Collect outline pixel indices first, then write — avoids reading our own writes
  const outlinePixels: number[] = [];

  // Find the bounding box of opaque pixels to know where the edges are
  let minOpaqueY = h, maxOpaqueY = 0, minOpaqueX = w, maxOpaqueX = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] !== 0) {
        if (y < minOpaqueY) minOpaqueY = y;
        if (y > maxOpaqueY) maxOpaqueY = y;
        if (x < minOpaqueX) minOpaqueX = x;
        if (x > maxOpaqueX) maxOpaqueX = x;
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] !== 0) continue; // skip opaque pixels

      // Skip outline pixels on suppressed edges (by position)
      if (skipTop && y < minOpaqueY) continue;
      if (skipBottom && y > maxOpaqueY) continue;
      if (skipLeft && x < minOpaqueX) continue;
      if (skipRight && x > maxOpaqueX) continue;

      // Check 8 neighbours for any opaque pixel
      let found = false;
      for (let dy = -1; dy <= 1 && !found; dy++) {
        for (let dx = -1; dx <= 1 && !found; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          if (data[(ny * w + nx) * 4 + 3] !== 0) {
            found = true;
          }
        }
      }
      if (found) outlinePixels.push(idx);
    }
  }

  // Write outline pixels (black, fully opaque)
  for (const idx of outlinePixels) {
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}
