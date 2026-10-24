import { describe, expect, it } from 'vitest';
import { DayNight, atmosphereAt, createAtmosphere, lightPosition } from '../src/render/daynight';
import { Effects, Fireflies, Particles } from '../src/render/particles';
import type { BurstKind } from '../src/render/particles';

describe('day and night', () => {
  it('is bright at noon, dark at midnight, and wraps around the clock', () => {
    const noon = atmosphereAt(12);
    const midnight = atmosphereAt(0);
    expect(noon.night).toBe(0);
    expect(midnight.night).toBe(1);
    expect(noon.sunIntensity).toBeGreaterThan(midnight.sunIntensity * 2);
    expect(atmosphereAt(24).night).toBe(midnight.night);
    expect(atmosphereAt(36).skyTop.getHex()).toBe(noon.skyTop.getHex());
    expect(atmosphereAt(-12).skyTop.getHex()).toBe(noon.skyTop.getHex());
  });

  it('changes smoothly: no jump between neighbouring minutes', () => {
    const a = createAtmosphere();
    const b = createAtmosphere();
    for (let h = 0; h < 24; h += 1 / 60) {
      atmosphereAt(h, a);
      atmosphereAt(h + 1 / 60, b);
      expect(Math.abs(a.night - b.night)).toBeLessThan(0.05);
      expect(Math.abs(a.sunIntensity - b.sunIntensity)).toBeLessThan(0.08);
    }
  });

  it('places the sun overhead by day and the moon in a fixed spot at night', () => {
    const noon = { x: 0, y: 0, z: 0 };
    const night = { x: 0, y: 0, z: 0 };
    lightPosition(12.75, noon);
    lightPosition(23, night);
    expect(noon.y).toBeGreaterThan(20);
    expect(night.y).toBeGreaterThan(0);
  });

  it('runs the clock, honours freezing, and formats the time', () => {
    const clock = new DayNight(23.5, 480);
    clock.update(10); // 10 s of a 480 s day = 0.5 h
    expect(clock.hour).toBeCloseTo(0, 5);
    expect(clock.label()).toBe('00:00');

    const frozen = new DayNight(9.25, 480, true);
    frozen.update(100);
    expect(frozen.label()).toBe('09:15');
  });
});

describe('particles', () => {
  it('plays every burst kind without errors and lets particles expire', () => {
    const particles = new Particles(300);
    const effects = new Effects(particles);
    const kinds: BurstKind[] = ['plow', 'plant', 'water', 'care', 'harvest', 'levelup', 'expand', 'clear'];
    for (const kind of kinds) effects.burst(kind, 1, -2);
    for (let t = 0; t < 4; t += 0.05) particles.update(0.05);

    const sizes = particles.object.geometry.getAttribute('aSize');
    for (let i = 0; i < sizes.count; i++) expect(sizes.getX(i)).toBe(0);
  });

  it('keeps fireflies hidden by day and visible at night', () => {
    const fireflies = new Fireflies(10);
    fireflies.update(1, 0);
    expect(fireflies.object.visible).toBe(false);
    fireflies.update(2, 1);
    expect(fireflies.object.visible).toBe(true);
  });
});
