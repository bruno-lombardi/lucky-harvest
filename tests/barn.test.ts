import { describe, expect, it } from 'vitest';
import { animalStatus } from '../src/core/animals';
import { BARN_TIERS, MAX_BARN_LEVEL, barnTier } from '../src/core/barn';
import { LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { Farm } from '../src/core/farm';
import { HELPERS, HOME, PEN_SPOTS, WAGE_PERIOD_MS, helperWage, payWord, route, routeLength, walkerStats } from '../src/core/helpers';
import { levelThreshold } from '../src/core/levels';

const MIN = 60_000;

describe('barn tiers', () => {
  it('cost more and give more at every tier', () => {
    for (let n = 1; n < BARN_TIERS.length; n++) {
      const a = BARN_TIERS[n - 1]!;
      const b = BARN_TIERS[n]!;
      expect(b.level).toBe(a.level + 1);
      expect(b.cost).toBeGreaterThan(a.cost);
      expect(b.unlockLevel).toBeGreaterThan(a.unlockLevel);
      expect(b.costMul).toBeLessThan(a.costMul);
      expect(b.speedMul).toBeGreaterThan(a.speedMul);
    }
    expect(MAX_BARN_LEVEL).toBe(4);
  });

  it('are bought in order, with the level and the coins', () => {
    const farm = new Farm({ seed: 1 });
    expect(farm.barn).toBe(1);
    expect(farm.upgradeBarn()).toEqual({ ok: false, reason: 'barn-locked' });
    farm.xp = levelThreshold(30);
    expect(farm.upgradeBarn()).toEqual({ ok: false, reason: 'no-coins' });
    farm.coins = 100_000;
    for (let n = 2; n <= MAX_BARN_LEVEL; n++) {
      const before = farm.coins;
      expect(farm.upgradeBarn().ok).toBe(true);
      expect(farm.barn).toBe(n);
      expect(before - farm.coins).toBe(barnTier(n).cost);
    }
    expect(farm.upgradeBarn()).toEqual({ ok: false, reason: 'max-level' });
  });

  it('lower what helpers cost and make walkers faster', () => {
    expect(helperWage('ajudante', 1, 1)).toBe(60);
    expect(helperWage('ajudante', 1, 2)).toBe(54);
    expect(helperWage('ajudante', 1, 4)).toBe(42);
    expect(walkerStats('ajudante', 1, 4).speed).toBeCloseTo(1.5 * 1.4);
    expect(walkerStats('ajudante', 1, 4).workMs).toBeCloseTo(1500 / 1.4);

    const farm = new Farm({ seed: 2 });
    farm.xp = levelThreshold(30);
    farm.coins = 100_000;
    farm.hireHelper('ajudante', 0);
    farm.upgradeBarn();
    const before = farm.coins;
    farm.runHelpers(WAGE_PERIOD_MS + 1);
    expect(before - farm.coins).toBe(helperWage('ajudante', 1, 2));
  });

  it('call it "custo" for animals and "salário" for people', () => {
    expect(payWord('gato')).toBe('custo');
    expect(payWord('cao')).toBe('custo');
    expect(payWord('ajudante')).toBe('salário');
    expect(payWord('tratador')).toBe('salário');
  });

  it('replays to the same state', () => {
    const live = new Farm({ seed: 8 });
    live.xp = levelThreshold(30);
    live.coins = 100_000;
    const start = live.toSnapshot();
    const log: LoggedCommand[] = [];
    const run = (command: Parameters<typeof applyCommand>[1], now: number): void => {
      if (applyCommand(live, command, now).ok) log.push({ command, now });
    };
    run({ type: 'hireHelper', helper: 'regador' }, 0);
    run({ type: 'upgradeBarn' }, 5 * MIN);
    run({ type: 'hireHelper', helper: 'tratador' }, 6 * MIN);
    run({ type: 'upgradeBarn' }, 25 * MIN);
    const copy = Farm.fromSnapshot(start);
    replay(copy, log);
    expect(copy.toSnapshot()).toEqual(live.toSnapshot());
  });
});

describe('Lúcia, the keeper', () => {
  function ranch(): Farm {
    const farm = new Farm({ seed: 3 });
    farm.xp = levelThreshold(30);
    farm.coins = 100_000;
    farm.buildPen('galinha');
    farm.buyAnimal('galinha');
    farm.buyAnimal('galinha');
    farm.buyFeed('galinha', 5);
    return farm;
  }

  it('is a person who works for a salary, and walks around the plot to the pens', () => {
    expect(HELPERS.tratador.animal).toBe(false);
    const path = route(HOME.tratador, PEN_SPOTS.galinha, 12);
    expect(path.length).toBeGreaterThan(2);
    const straight = routeLength([HOME.tratador, PEN_SPOTS.galinha]);
    expect(routeLength(path)).toBeGreaterThan(straight);
    // Nothing on the way cuts through the fenced plot.
    for (const p of path.slice(1, -1)) expect(Math.max(Math.abs(p.u - 12), Math.abs(p.v - 12))).toBeGreaterThan(6.45);
  });

  it('feeds every hungry animal with the stored feed', () => {
    const farm = ranch();
    farm.hireHelper('tratador', 0);
    farm.runHelpers(3 * MIN);
    const pen = farm.pens.galinha!;
    for (const a of pen.animals) expect(animalStatus('galinha', a, 3 * MIN, pen.level).phase).not.toBe('hungry');
    expect(farm.feed.galinha).toBe(3);
    expect(farm.stats.fed).toBe(2);
  });

  it('stays home without feed', () => {
    const farm = ranch();
    farm.feed.galinha = 0;
    farm.hireHelper('tratador', 0);
    farm.runHelpers(3 * MIN);
    expect(farm.stats.fed).toBe(0);
  });

  it('keeps feeding cycle after cycle while the feed lasts', () => {
    const farm = ranch();
    farm.hireHelper('tratador', 0);
    farm.runHelpers(3 * MIN);
    // Collect the product, then she feeds them again.
    const cycle = 5 * MIN;
    farm.collectAll('galinha', 3 * MIN + 60 * MIN);
    farm.runHelpers(3 * MIN + 60 * MIN + cycle);
    expect(farm.stats.fed).toBe(4);
  });
});
