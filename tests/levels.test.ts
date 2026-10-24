import { describe, expect, it } from 'vitest';
import { CROPS, CROP_ORDER } from '../src/core/crops';
import { MAX_LEVEL, levelFromXp, levelProgress, levelThreshold } from '../src/core/levels';

describe('level curve', () => {
  it('has the documented thresholds', () => {
    expect(levelThreshold(1)).toBe(0);
    expect(levelThreshold(2)).toBe(50);
    expect(levelThreshold(3)).toBe(150);
    expect(levelThreshold(4)).toBe(300);
  });

  it('maps XP to level at the boundaries', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(49)).toBe(1);
    expect(levelFromXp(50)).toBe(2);
    expect(levelFromXp(149)).toBe(2);
    expect(levelFromXp(150)).toBe(3);
    expect(levelFromXp(10_000_000)).toBe(MAX_LEVEL);
  });

  it('reports progress within a level', () => {
    expect(levelProgress(0)).toEqual({ level: 1, current: 0, needed: 50, fraction: 0 });
    const mid = levelProgress(100); // level 2 spans 50..150
    expect(mid.level).toBe(2);
    expect(mid.current).toBe(50);
    expect(mid.needed).toBe(100);
    expect(mid.fraction).toBeCloseTo(0.5);
    expect(levelProgress(10_000_000).fraction).toBe(1);
  });
});

describe('crop data', () => {
  it('is complete and profitable', () => {
    expect(CROP_ORDER).toHaveLength(Object.keys(CROPS).length);
    for (const id of CROP_ORDER) {
      const crop = CROPS[id];
      expect(crop.id).toBe(id);
      expect(crop.sellPrice).toBeGreaterThan(crop.seedCost);
      expect(crop.growthMs).toBeGreaterThan(0);
      expect(crop.witherMs).toBeGreaterThan(0);
    }
  });

  it('unlocks in ascending level order and the first crops are available at level 1', () => {
    const levels = CROP_ORDER.map((id) => CROPS[id].unlockLevel);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(levels[0]).toBe(1);
  });
});
