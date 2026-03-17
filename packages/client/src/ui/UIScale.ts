const REFERENCE_WIDTH = 1066;
export const PANEL_REF_WIDTH = 280;
export const HUD_REF_WIDTH = 430; // gameplay HUD (wider to fit bars + slots)

let cachedWidth = REFERENCE_WIDTH;
let cachedHeight = 600;
let cachedScale = 1.0;

/** Call once at scene creation and on every resize event */
export function updateScreenDimensions(width: number, height: number): void {
  cachedWidth = width;
  cachedHeight = height;
  cachedScale = Math.max(0.75, Math.min(width / REFERENCE_WIDTH, 3.0));
}

export function getUIScale(): number {
  return cachedScale;
}

export function getScreenWidth(): number {
  return cachedWidth;
}

export function getScreenHeight(): number {
  return cachedHeight;
}
