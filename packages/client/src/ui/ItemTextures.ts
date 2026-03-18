import Phaser from "phaser";
import { ItemCategory } from "@rotmg-lite/shared";
import { addOutlineToImageData } from "./EntityTextures";
import { getUIScale } from "./UIScale";

const ITEM_SOURCE_SIZE = 12;

/** Stored original source images for regeneration at different scales. */
const originalSources = new Map<string, HTMLImageElement | HTMLCanvasElement>();

/**
 * Maps item sprite keys to [col, row] positions in items-spreadsheet.png.
 * Spreadsheet layout: 13 columns × 11 rows, 8px tiles with 8px spacing (stride = 16px).
 */
const ITEM_SHEET_POSITIONS: Record<string, [number, number]> = {};

// Row 0: Swords t1-t12 + UT sword
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-sword-t${t}`] = [t - 1, 0];
ITEM_SHEET_POSITIONS["item-ut-sword"] = [12, 0];

// Row 1: Bows t1-t12
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-bow-t${t}`] = [t - 1, 1];

// Row 2: Wands t1-t12
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-wand-t${t}`] = [t - 1, 2];

// Row 3: Heavy armor t1-t12
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-heavy-armor-t${t}`] = [t - 1, 3];

// Row 4: Light armor t1-t12
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-light-armor-t${t}`] = [t - 1, 4];

// Row 5: Robes t1-t12
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-robe-t${t}`] = [t - 1, 5];

// Row 6: Rings t1-t12 + UT
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-ring-t${t}`] = [t - 1, 6];
ITEM_SHEET_POSITIONS["item-ut-ring"] = [12, 6];
ITEM_SHEET_POSITIONS["item-ring"] = [0, 6]; // fallback → t1

// Row 7: Quivers t1-t12 + UT
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-quiver-t${t}`] = [t - 1, 7];
ITEM_SHEET_POSITIONS["item-ut-quiver"] = [12, 7];
ITEM_SHEET_POSITIONS["item-quiver"] = [0, 7]; // fallback → t1

// Row 8: Helms t1-t12 + UT
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-helm-t${t}`] = [t - 1, 8];
ITEM_SHEET_POSITIONS["item-ut-helm"] = [12, 8];
ITEM_SHEET_POSITIONS["item-helm"] = [0, 8]; // fallback → t1

// Row 9: Relics t1-t12 + UT
for (let t = 1; t <= 12; t++) ITEM_SHEET_POSITIONS[`item-relic-t${t}`] = [t - 1, 9];
ITEM_SHEET_POSITIONS["item-ut-relic"] = [12, 9];
ITEM_SHEET_POSITIONS["item-relic"] = [0, 9]; // fallback → t1

// Row 10: Consumables
const CONSUMABLE_KEYS = [
  "item-portal-gem", "item-blank-orb", "item-ember-orb", "item-shard-orb",
  "item-chaos-orb", "item-flux-orb", "item-void-orb", "item-prism-orb",
  "item-forge-orb", "item-calibrate-orb", "item-divine-orb",
];
for (let i = 0; i < CONSUMABLE_KEYS.length; i++) ITEM_SHEET_POSITIONS[CONSUMABLE_KEYS[i]] = [i, 10];

// Generic fallback keys → t1 sprite (used when no tier is specified)
ITEM_SHEET_POSITIONS["item-sword"] = [0, 0];
ITEM_SHEET_POSITIONS["item-bow"] = [0, 1];
ITEM_SHEET_POSITIONS["item-wand"] = [0, 2];
ITEM_SHEET_POSITIONS["item-heavy-armor"] = [0, 3];
ITEM_SHEET_POSITIONS["item-light-armor"] = [0, 4];
ITEM_SHEET_POSITIONS["item-robe"] = [0, 5];

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

/** Maps armor subtype index to name for per-tier sprite keys. */
const ARMOR_SUBTYPE_NAMES: Record<number, string> = {
  0: "heavy-armor",  // ArmorSubtype.Heavy
  1: "light-armor",  // ArmorSubtype.Light
  2: "robe",         // ArmorSubtype.Mantle
};

/** Maps ability subtype index to name for per-tier sprite keys. */
const ABILITY_SUBTYPE_NAMES: Record<number, string> = {
  0: "quiver",  // AbilitySubtype.Quiver
  1: "helm",    // AbilitySubtype.Helm
  2: "relic",   // AbilitySubtype.Relic
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
  "2-2": "item-robe",
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
  // Weapons: per-tier sprites
  if (category === ItemCategory.Weapon) {
    const weaponName = WEAPON_SUBTYPE_NAMES[subtype];
    if (weaponName) {
      if (isUT) return `item-ut-${weaponName}`;
      if (tier && tier >= 1 && tier <= 12) return `item-${weaponName}-t${tier}`;
    }
    return ITEM_SPRITE_MAP[`${category}-${subtype}`] ?? null;
  }

  // Abilities: per-tier sprites
  if (category === ItemCategory.Ability) {
    const abilityName = ABILITY_SUBTYPE_NAMES[subtype];
    if (abilityName) {
      if (isUT) return `item-ut-${abilityName}`;
      if (tier && tier >= 1 && tier <= 12) return `item-${abilityName}-t${tier}`;
    }
    return ITEM_SPRITE_MAP[`${category}-${subtype}`] ?? null;
  }

  // Armors: per-tier sprites
  if (category === ItemCategory.Armor) {
    const armorName = ARMOR_SUBTYPE_NAMES[subtype];
    if (armorName && tier && tier >= 1 && tier <= 12) return `item-${armorName}-t${tier}`;
    return ITEM_SPRITE_MAP[`${category}-${subtype}`] ?? null;
  }

  // Rings: per-tier sprites
  if (category === ItemCategory.Ring) {
    if (isUT) return "item-ut-ring";
    if (tier && tier >= 1 && tier <= 12) return `item-ring-t${tier}`;
    return "item-ring";
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
  // Per-tier ability keys
  for (const name of Object.values(ABILITY_SUBTYPE_NAMES)) {
    for (let t = 1; t <= 12; t++) keys.add(`item-${name}-t${t}`);
    keys.add(`item-ut-${name}`);
  }
  // Per-tier armor keys
  for (const name of Object.values(ARMOR_SUBTYPE_NAMES)) {
    for (let t = 1; t <= 12; t++) keys.add(`item-${name}-t${t}`);
  }
  // Per-tier ring keys
  for (let t = 1; t <= 12; t++) keys.add(`item-ring-t${t}`);
  keys.add("item-ut-ring");
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
  const newSize = Math.max(8, Math.round(effectiveSlot * ITEM_FILL_RATIO));
  if (newSize === currentOutlinedSize && originalSources.size > 0) return;
  currentOutlinedSize = newSize;

  for (const key of getAllKeys()) {
    upscaleAndOutlineItem(scene, key);
  }
}

function upscaleAndOutlineItem(scene: Phaser.Scene, key: string): void {
  // Use original source (first call stores it, subsequent calls reuse it)
  let src: HTMLImageElement | HTMLCanvasElement;
  let srcX = 0, srcY = 0, srcW = 0, srcH = 0;
  let useRegion = false;

  if (originalSources.has(key)) {
    src = originalSources.get(key)!;
  } else {
    const sheetPos = ITEM_SHEET_POSITIONS[key];
    if (sheetPos) {
      // Extract from items-spreadsheet.png
      const sheetTex = scene.textures.get("items-spreadsheet");
      if (!sheetTex || sheetTex.key === "__MISSING") return;
      src = sheetTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const SPRITE_SIZE = 8;
      const SPRITE_STRIDE = 16; // 8px tile + 8px spacing
      srcX = sheetPos[0] * SPRITE_STRIDE;
      srcY = sheetPos[1] * SPRITE_STRIDE;
      srcW = SPRITE_SIZE;
      srcH = SPRITE_SIZE;
      useRegion = true;
      // Cache an extracted 8x8 canvas as the original source for regeneration
      const extractCanvas = document.createElement("canvas");
      extractCanvas.width = SPRITE_SIZE;
      extractCanvas.height = SPRITE_SIZE;
      const ectx = extractCanvas.getContext("2d")!;
      ectx.drawImage(src, srcX, srcY, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
      originalSources.set(key, extractCanvas);
      src = extractCanvas;
      useRegion = false;
    } else {
      // Individual texture (fallback sprites)
      const tex = scene.textures.get(key);
      if (!tex || tex.key === "__MISSING") return;
      src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      originalSources.set(key, src);
    }
  }

  const size = currentOutlinedSize;
  const artSize = size - 2; // 1px outline border on each side

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Nearest-neighbor upscale: draw source at offset (1,1) filling the art area
  ctx.imageSmoothingEnabled = false;
  if (useRegion) {
    ctx.drawImage(src, srcX, srcY, srcW, srcH, 1, 1, artSize, artSize);
  } else {
    ctx.drawImage(src, 1, 1, artSize, artSize);
  }

  addOutlineToImageData(ctx, size, size);

  // Replace texture with outlined version using the same key
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}
