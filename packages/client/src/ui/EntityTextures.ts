import Phaser from "phaser";
import { CharacterClass, CLASS_NAMES, EnemyType, PIXEL_SCALE } from "@rotmg-lite/shared";

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

/** Walk direction constants. */
export enum WalkDirection {
  Right = 0,
  Down = 1,
  Up = 2,
  Left = 3,
}

/** Maps CharacterClass → tileset spritesheet key (if one exists). */
const CLASS_TILESET_KEYS: Record<number, string> = {
  [CharacterClass.Archer]: "tileset-player-archer",
  [CharacterClass.Warrior]: "tileset-player-warrior",
  [CharacterClass.Arcanist]: "tileset-player-arcanist",
};

const WALK_FRAMES_PER_DIR = 4;
const WALK_FRAME_RATE = 8;

/** Returns true if a walk animation tileset is loaded for this class. */
export function hasWalkTileset(characterClass: number): boolean {
  return characterClass in CLASS_TILESET_KEYS;
}

/** Returns the tileset key for a class (or undefined). */
export function getPlayerTilesetKey(characterClass: number): string | undefined {
  return CLASS_TILESET_KEYS[characterClass];
}

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

  // Upscale walk animation tilesets and create Phaser animations
  for (const [classId, tilesetKey] of Object.entries(CLASS_TILESET_KEYS)) {
    upscaleAndOutlineSpritesheet(scene, tilesetKey);
    createWalkAnimations(scene, Number(classId), tilesetKey);
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
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!

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

/**
 * Upscales each frame of a spritesheet individually (nearest-neighbor + outline),
 * then packs them into a new spritesheet texture with the same key.
 * Each frame becomes (8 * PIXEL_SCALE + 2) × (8 * PIXEL_SCALE + 2).
 */
function upscaleAndOutlineSpritesheet(scene: Phaser.Scene, key: string): void {
  if (processedKeys.has(key)) return;
  const tex = scene.textures.get(key);
  if (!tex || tex.key === "__MISSING") return;

  const frameKeys = tex.getFrameNames();
  // Phaser spritesheet frames are numbered 0..N (stored under __BASE)
  const totalFrames = frameKeys.length > 0 ? frameKeys.length : Object.keys(tex.frames).length - 1;
  if (totalFrames <= 0) return;

  const frameW = 8;
  const frameH = 8;
  const outW = frameW * PIXEL_SCALE + 2;
  const outH = frameH * PIXEL_SCALE + 2;

  // Create a horizontal strip of upscaled+outlined frames
  const canvas = document.createElement("canvas");
  canvas.width = outW * totalFrames;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;

  const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;

  for (let i = 0; i < totalFrames; i++) {
    const frame = tex.get(i);
    if (!frame) continue;

    // Create a temp canvas for this single frame
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = outW;
    tmpCanvas.height = outH;
    const tmpCtx = tmpCanvas.getContext("2d", { willReadFrequently: true })!;
    tmpCtx.imageSmoothingEnabled = false;

    // Draw source frame upscaled into temp canvas at offset (1,1)
    tmpCtx.drawImage(
      src,
      frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      1, 1, frameW * PIXEL_SCALE, frameH * PIXEL_SCALE
    );

    // Add outline to this frame
    addOutlineToImageData(tmpCtx, outW, outH);

    // Copy into the strip
    ctx.drawImage(tmpCanvas, i * outW, 0);
  }

  // Replace the texture with the upscaled strip — use addCanvas then manually add frames
  scene.textures.remove(key);
  const newTex = scene.textures.addCanvas(key, canvas)!;
  newTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  // Add numbered frames matching spritesheet convention
  for (let i = 0; i < totalFrames; i++) {
    newTex.add(i, 0, i * outW, 0, outW, outH);
  }
  processedKeys.add(key);
}

/** Direction names matching WalkDirection enum order. */
const DIRECTION_NAMES = ["right", "down", "up", "left"] as const;

/**
 * Creates Phaser walk animations for a character class from its tileset.
 * Animation keys: "walk-{className}-{direction}" e.g. "walk-arcanist-down"
 * Also creates idle keys: "idle-{className}-{direction}" (single frame)
 */
function createWalkAnimations(scene: Phaser.Scene, classId: number, tilesetKey: string): void {
  const className = CLASS_NAMES[classId]?.toLowerCase();
  if (!className) return;

  for (let dir = 0; dir < 4; dir++) {
    const startFrame = dir * WALK_FRAMES_PER_DIR;
    const dirName = DIRECTION_NAMES[dir];

    // Walk animation (4 frames looping)
    scene.anims.create({
      key: `walk-${className}-${dirName}`,
      frames: scene.anims.generateFrameNumbers(tilesetKey, {
        start: startFrame,
        end: startFrame + WALK_FRAMES_PER_DIR - 1,
      }),
      frameRate: WALK_FRAME_RATE,
      repeat: -1,
    });

    // Idle pose (first frame of each direction)
    scene.anims.create({
      key: `idle-${className}-${dirName}`,
      frames: [{ key: tilesetKey, frame: startFrame }],
      frameRate: 1,
      repeat: 0,
    });
  }
}
