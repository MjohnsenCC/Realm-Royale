import Phaser from "phaser";
import { PIXEL_SCALE } from "@rotmg-lite/shared";

/**
 * Upscale UI sprite textures with nearest-neighbor (no outline).
 * Call once in BootScene.create() after loading all UI sprites.
 *
 * Panels (11×11) → 55×55, slots (8×8) → 40×40, bars (24×5) → 120×25, etc.
 */

const UI_SPRITE_KEYS = [
  // Panels
  "ui-panel-dark",
  "ui-panel-header",
  "ui-panel-tooltip",
  "ui-panel-overlay",
  "ui-panel-chat",
  // Slots
  "ui-slot-empty",
  "ui-slot-filled",
  "ui-slot-highlight",
  // Bars
  "ui-bar-frame",
  "ui-bar-hp",
  "ui-bar-mp",
  "ui-bar-xp",
  "ui-bar-bg",
  // Buttons
  "ui-btn-default",
  "ui-btn-hover",
  "ui-btn-pressed",
  "ui-btn-close",
  "ui-btn-statpanel",
  // Minimap icons
  "ui-icon-player",
  "ui-icon-enemy",
  "ui-icon-portal",
  "ui-icon-chest",
  "ui-icon-bag",
  // Minimap button icons
  "ui-icon-zoom-in",
  "ui-icon-zoom-out",
  "ui-icon-fullscreen-enter",
  "ui-icon-fullscreen-exit",
  // Misc
  "ui-minimap-frame",
  "ui-scrollbar-track",
  "ui-scrollbar-thumb",
  "ui-tab-active",
  "ui-tab-inactive",
];

export function generateUITextures(scene: Phaser.Scene): void {
  for (const key of UI_SPRITE_KEYS) {
    upscaleUISprite(scene, key);
  }
}

function upscaleUISprite(scene: Phaser.Scene, key: string): void {
  const tex = scene.textures.get(key);
  if (!tex || tex.key === "__MISSING") return;

  const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const upW = src.width * PIXEL_SCALE;
  const upH = src.height * PIXEL_SCALE;

  const canvas = document.createElement("canvas");
  canvas.width = upW;
  canvas.height = upH;
  const ctx = canvas.getContext("2d")!;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, upW, upH);

  scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** NineSlice corner sizes (in display pixels after 5× upscale). */
export const UI_PANEL_CORNER = 3 * PIXEL_SCALE;     // 15px — for 11×11 panels
export const UI_BAR_CORNER = 2 * PIXEL_SCALE;        // 10px — for bar frame
export const UI_BTN_CORNER = 3 * PIXEL_SCALE;        // 15px — for buttons
export const UI_MINIMAP_CORNER = 4 * PIXEL_SCALE;    // 20px — for minimap frame
export const UI_SCROLLBAR_CORNER = 1 * PIXEL_SCALE;  // 5px — for scrollbar
export const UI_TAB_CORNER = 3 * PIXEL_SCALE;        // 15px — for tabs
