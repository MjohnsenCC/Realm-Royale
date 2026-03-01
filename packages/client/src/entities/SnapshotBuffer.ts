import { INTERPOLATION_DELAY } from "@rotmg-lite/shared";

export interface Snapshot {
  timestamp: number;
  x: number;
  y: number;
}

/**
 * Stores timestamped position snapshots from the server and provides
 * smooth interpolation between them with a configurable render delay.
 *
 * Render delay should be >= one server tick interval (50ms at 20Hz)
 * to guarantee we always have two snapshots to interpolate between.
 */
export class SnapshotBuffer {
  private buffer: Snapshot[] = [];
  private readonly maxSize: number;
  private readonly renderDelay: number;

  constructor(renderDelay: number = INTERPOLATION_DELAY, maxSize: number = 20) {
    this.renderDelay = renderDelay;
    this.maxSize = maxSize;
  }

  push(x: number, y: number, timestamp: number = performance.now()): void {
    this.buffer.push({ timestamp, x, y });
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getInterpolatedPosition(
    currentTime: number = performance.now()
  ): { x: number; y: number } | null {
    const renderTime = currentTime - this.renderDelay;

    if (this.buffer.length < 2) return null;

    // Find two snapshots that straddle renderTime
    for (let i = 0; i < this.buffer.length - 1; i++) {
      const a = this.buffer[i];
      const b = this.buffer[i + 1];

      if (a.timestamp <= renderTime && renderTime <= b.timestamp) {
        const range = b.timestamp - a.timestamp;
        const t = range > 0 ? (renderTime - a.timestamp) / range : 0;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        };
      }
    }

    // If renderTime is past all snapshots, extrapolate from last two (capped)
    const last = this.buffer[this.buffer.length - 1];
    const prev = this.buffer[this.buffer.length - 2];
    if (renderTime > last.timestamp) {
      const maxExtrapolate = 200; // ms
      const elapsed = Math.min(renderTime - last.timestamp, maxExtrapolate);
      const range = last.timestamp - prev.timestamp;
      if (range > 0) {
        const vx = (last.x - prev.x) / range;
        const vy = (last.y - prev.y) / range;
        return {
          x: last.x + vx * elapsed,
          y: last.y + vy * elapsed,
        };
      }
    }

    // If renderTime is before all snapshots, use the earliest
    return { x: this.buffer[0].x, y: this.buffer[0].y };
  }

  clear(): void {
    this.buffer.length = 0;
  }
}
