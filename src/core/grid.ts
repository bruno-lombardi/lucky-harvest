/**
 * Pure grid math. No Three.js here, so the same logic can run on a future server.
 *
 * Tile (i, j) covers world x in [i - N/2, i - N/2 + 1] and z in [j - N/2, j - N/2 + 1].
 * The grid is centered on the world origin, and tile tops sit at y = 0.
 */

export const GRID_SIZE = 24;

export interface TileCoord {
  readonly i: number;
  readonly j: number;
}

export interface WorldXZ {
  readonly x: number;
  readonly z: number;
}

export function inBounds(i: number, j: number, size: number = GRID_SIZE): boolean {
  return Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < size && j < size;
}

/** World-space center of a tile. */
export function tileToWorld(i: number, j: number, size: number = GRID_SIZE): WorldXZ {
  const half = size / 2;
  return { x: i - half + 0.5, z: j - half + 0.5 };
}

/** The tile under a world-space point, or null if outside the grid. */
export function worldToTile(x: number, z: number, size: number = GRID_SIZE): TileCoord | null {
  const half = size / 2;
  const i = Math.floor(x + half);
  const j = Math.floor(z + half);
  return inBounds(i, j, size) ? { i, j } : null;
}

export function tileKey(i: number, j: number): string {
  return `${i},${j}`;
}

export function sameTile(a: TileCoord | null, b: TileCoord | null): boolean {
  if (a === null || b === null) return a === b;
  return a.i === b.i && a.j === b.j;
}
