import { describe, expect, it } from 'vitest';
import { GRID_SIZE, inBounds, sameTile, tileKey, tileToWorld, worldToTile } from '../src/core/grid';

describe('grid math', () => {
  it('round-trips every tile through world space', () => {
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const { x, z } = tileToWorld(i, j);
        expect(worldToTile(x, z)).toEqual({ i, j });
      }
    }
  });

  it('centers the grid on the origin', () => {
    const first = tileToWorld(0, 0);
    const last = tileToWorld(GRID_SIZE - 1, GRID_SIZE - 1);
    expect(first.x + last.x).toBeCloseTo(0);
    expect(first.z + last.z).toBeCloseTo(0);
  });

  it('returns null outside the grid', () => {
    const edge = GRID_SIZE / 2;
    expect(worldToTile(edge + 0.01, 0)).toBeNull();
    expect(worldToTile(0, -edge - 0.01)).toBeNull();
    expect(worldToTile(-100, 100)).toBeNull();
  });

  it('validates bounds', () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(GRID_SIZE - 1, GRID_SIZE - 1)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, GRID_SIZE)).toBe(false);
    expect(inBounds(1.5, 2)).toBe(false);
  });

  it('compares tiles and builds keys', () => {
    expect(sameTile({ i: 1, j: 2 }, { i: 1, j: 2 })).toBe(true);
    expect(sameTile({ i: 1, j: 2 }, { i: 2, j: 1 })).toBe(false);
    expect(sameTile(null, null)).toBe(true);
    expect(sameTile(null, { i: 0, j: 0 })).toBe(false);
    expect(tileKey(3, 4)).toBe('3,4');
  });
});
