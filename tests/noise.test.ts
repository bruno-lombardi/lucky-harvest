import { describe, expect, it } from 'vitest';
import { fbm2D, mulberry32, valueNoise2D } from '../src/core/noise';

describe('procedural noise', () => {
  it('mulberry32 is deterministic and in range', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let n = 0; n < 100; n++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('value noise is deterministic, bounded and continuous', () => {
    expect(valueNoise2D(3.3, 4.7, 9)).toBe(valueNoise2D(3.3, 4.7, 9));
    let prev = valueNoise2D(0, 1.25, 5);
    for (let x = 0.01; x < 5; x += 0.01) {
      const v = valueNoise2D(x, 1.25, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Math.abs(v - prev)).toBeLessThan(0.1);
      prev = v;
    }
  });

  it('fbm stays in range', () => {
    for (let n = 0; n < 200; n++) {
      const v = fbm2D(n * 0.37, n * 0.91, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
