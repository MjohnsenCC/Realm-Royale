/**
 * Spatial hash grid for efficient proximity queries.
 * Divides the world into cells; entities are inserted into cells,
 * and queries return only entities in nearby cells.
 */
export class SpatialGrid<T extends { x: number; y: number }> {
  private cells = new Map<string, T[]>();
  private cellSize: number;

  constructor(cellSize: number = 200) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(entity: T): void {
    const key = this.getKey(entity.x, entity.y);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(entity);
  }

  query(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (cell) {
          for (const entity of cell) {
            results.push(entity);
          }
        }
      }
    }
    return results;
  }

  private getKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }
}
