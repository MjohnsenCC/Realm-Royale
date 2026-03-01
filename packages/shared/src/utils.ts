export function distanceBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  return distanceBetween(x1, y1, x2, y2) < r1 + r2;
}

export function normalizeVector(
  x: number,
  y: number
): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/**
 * Apply a single movement input to a position. Used by both server (authoritative)
 * and client (prediction + reconciliation) to guarantee identical results.
 */
export function applyMovement(
  x: number,
  y: number,
  inputX: number,
  inputY: number,
  speed: number,
  dt: number,
  radius: number,
  arenaW: number,
  arenaH: number
): { x: number; y: number } {
  const norm = normalizeVector(inputX, inputY);
  const dist = speed * (dt / 1000);
  return {
    x: clamp(x + norm.x * dist, radius, arenaW - radius),
    y: clamp(y + norm.y * dist, radius, arenaH - radius),
  };
}
