import { describe, expect, it } from 'vitest';
import { Farm } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';

/**
 * Executable notes about gaps we know about. `it.fails` passes while the bug exists and starts failing
 * (loudly) once it is fixed, which is the cue to turn it into a normal test.
 * See docs/Roadmap-Backend-Multiplayer-Social.md for the plan.
 */
describe('known issues', () => {
  function farmWithTonico(): Farm {
    const farm = new Farm({ seed: 5, pestChance: 0 });
    farm.xp = levelThreshold(9);
    farm.coins = 50_000;
    farm.landSize = 6;
    for (let i = 9; i < 12; i++) {
      farm.seeds.cenoura += 1;
      farm.plow(i, 9);
      farm.plant(i, 9, 'cenoura', 0);
      farm.water(i, 9, 0);
    }
    farm.hireHelper('ajudante', 0);
    return farm;
  }

  it.fails('helper catch-up gives the same result however often runHelpers is called (offline cap vs tick cadence)', () => {
    const horizon = 3 * 3_600_000;
    const everySecond = farmWithTonico();
    for (let t = 1000; t <= horizon; t += 1000) everySecond.runHelpers(t);
    const once = farmWithTonico();
    once.runHelpers(horizon);
    expect(once.toSnapshot()).toEqual(everySecond.toSnapshot());
  });
});
