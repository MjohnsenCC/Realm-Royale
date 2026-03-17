import Phaser from "phaser";
import { ItemCategory } from "@rotmg-lite/shared";
import { addOutlineToImageData } from "./EntityTextures";
import { getUIScale } from "./UIScale";

const ITEM_SOURCE_SIZE = 12;

/** Stored original source images for regeneration at different scales. */
const originalSources = new Map<string, HTMLImageElement | HTMLCanvasElement>();

/**
 * Ratio of item sprite display size to slot size.
 * 0.85 = 85% fill, leaving ~7.5% padding on each side.
 */
export const ITEM_FILL_RATIO = 0.80;

/**
 * Current outlined display size — the exact pixel dimension of the
 * pre-rendered texture.  All UIs should use this for setDisplaySize()
 * so the texture maps 1:1 to screen pixels and the 1px outline stays crisp.
 */
let currentOutlinedSize = 38; // sensible default until first generation

/** Returns the current texture display size (call after generateItemTextures). */
export function getItemOutlinedSize(): number {
  return currentOutlinedSize;
}

/** Maps weapon subtype index to name for per-tier sprite keys. */
const WEAPON_SUBTYPE_NAMES: Record<number, string> = {
  0: "sword",  // WeaponSubtype.Sword
  1: "bow",    // WeaponSubtype.Bow
  2: "wand",   // WeaponSubtype.Wand
};

/** Maps "category-subtype" to the loaded sprite texture key. */
const ITEM_SPRITE_MAP: Record<string, string> = {
  "0-0": "item-sword",
  "0-1": "item-bow",
  "0-2": "item-wand",
  "1-0": "item-quiver",
  "1-1": "item-helm",
  "1-2": "item-relic",
  "2-0": "item-heavy-armor",
  "2-1": "item-light-armor",
  "2-2": "item-mantle",
  // Consumables
  "4-2": "item-portal-gem",
  // Crafting orbs
  "5-0": "item-blank-orb",
  "5-1": "item-ember-orb",
  "5-2": "item-shard-orb",
  "5-3": "item-chaos-orb",
  "5-4": "item-flux-orb",
  "5-5": "item-void-orb",
  "5-6": "item-prism-orb",
  "5-7": "item-forge-orb",
  "5-8": "item-calibrate-orb",
  "5-9": "item-divine-orb",
};

/**
 * Returns the sprite texture key for a given item category and subtype.
 * For weapons, pass tier and isUT to get the per-tier sprite.
 * Falls back to the generic sprite if no per-tier sprite is loaded.
 */
export function getItemSpriteKey(
  category: number,
  subtype: number,
  tier?: number,
  isUT?: boolean,
): string | null {
  if (category === ItemCategory.Ring) return "item-ring";

  // Weapons: per-tier sprites
  if (category === ItemCategory.Weapon) {
    const weaponName = WEAPON_SUBTYPE_NAMES[subtype];
    if (weaponName) {
      if (isUT) return `item-ut-${weaponName}`;
      if (tier && tier >= 1 && tier <= 12) return `item-${weaponName}-t${tier}`;
    }
    return ITEM_SPRITE_MAP[`${category}-${subtype}`] ?? null;
  }

  return ITEM_SPRITE_MAP[`${category}-${subtype}`] ?? null;
}

/** All unique item sprite keys (includes per-tier weapon keys). */
function getAllKeys(): string[] {
  const keys = new Set<string>(Object.values(ITEM_SPRITE_MAP));
  keys.add("item-ring");
  // Per-tier weapon keys
  for (const name of Object.values(WEAPON_SUBTYPE_NAMES)) {
    for (let t = 1; t <= 12; t++) keys.add(`item-${name}-t${t}`);
    keys.add(`item-ut-${name}`);
  }
  return Array.from(keys);
}

/**
 * Pre-render item textures: upscale 12×12 sprites with nearest-neighbor,
 * then add 1px black outline. Replaces textures in-place.
 *
 * The texture is generated at exactly the display size so that UIs can
 * show it at 1:1 resolution — no fractional scaling, keeping the 1px
 * outline crisp and consistent on all sides.
 *
 * @param slotSize  The actual slot pixel size from the HUD. When omitted
 *                  (e.g. at boot before HUD exists) a default based on
 *                  the UI scale factor is used.
 *
 * Safe to call multiple times (e.g. on relayout) — original sources are cached.
 */
export function generateItemTextures(scene: Phaser.Scene, slotSize?: number): void {
  const S = getUIScale();
  const effectiveSlot = slotSize ?? Math.max(16, Math.round(36 * S));
  currentOutlinedSize = Math.max(8, Math.round(effectiveSlot * ITEM_FILL_RATIO));

  for (const key of getAllKeys()) {
    upscaleAndOutlineItem(scene, key);
  }
}

function upscaleAndOutlineItem(scene: Phaser.Scene, key: string): void {
  // Use original source (first call stores it, subsequent calls reuse it)
  let src: HTMLImageElement | HTMLCanvasElement;
  if (originalSources.has(key)) {
    src = originalSources.get(key)!;
  } else {
    const tex = scene.textures.get(key);
    if (!tex || tex.key === "__MISSING") return;
    src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    originalSources.set(key, src);
  }

  const size = currentOutlinedSize;
  const artSize = size - 2; // 1px outline border on each side

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Nearest-neighbor upscale: draw source at offset (1,1) filling the art area
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 1, 1, artSize, artSize);

  addOutlineToImageData(ctx, size, size);

  // Replace texture with outlined version using the same key
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}
