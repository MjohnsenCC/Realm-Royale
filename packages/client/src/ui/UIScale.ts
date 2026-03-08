const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 600;

let cachedWidth = REFERENCE_WIDTH;
let cachedHeight = REFERENCE_HEIGHT;
let cachedScale = 1.0;

/** Call once at scene creation and on every resize event */
export function updateScreenDimensions(width: number, height: number): void {
  cachedWidth = width;
  cachedHeight = height;
  cachedScale = Math.max(
    0.75,
    Math.min(Math.min(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT), 3.0)
  );
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
