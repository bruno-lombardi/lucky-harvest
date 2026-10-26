import { describe, expect, it } from 'vitest';
import { Farm } from '../src/core/farm';
import { LightsView } from '../src/render/lights-view';
import { createToonGradient } from '../src/render/toon';

describe('LightsView', () => {
  const make = () => {
    const farm = new Farm({ now: 0 });
    return { farm, view: new LightsView(farm, createToonGradient(4)) };
  };

  it('glows at night and not by day', () => {
    const { view } = make();
    for (let i = 0; i < 60; i++) view.update(0.1, 0);
    expect(view.intensity).toBe(0);
    for (let i = 0; i < 60; i++) view.update(0.1, 1);
    expect(view.intensity).toBeGreaterThan(0.9);
    expect(view.count).toBeGreaterThan(20);
  });

  it('goes dark when switched off, even at night', () => {
    const { farm, view } = make();
    for (let i = 0; i < 60; i++) view.update(0.1, 1);
    farm.setLights({ on: false });
    for (let i = 0; i < 60; i++) view.update(0.1, 1);
    expect(view.intensity).toBe(0);
  });

  it('rebuilds when the plot grows', () => {
    const { farm, view } = make();
    view.update(0.1, 1);
    const before = view.count;
    farm.coins = 1e9;
    farm.xp = 1e7;
    farm.expandLand();
    view.update(0.1, 1);
    expect(view.count).toBeGreaterThan(before);
  });
});
