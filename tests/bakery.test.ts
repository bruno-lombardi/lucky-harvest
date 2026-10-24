import { describe, expect, it } from 'vitest';
import { LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { CROPS } from '../src/core/crops';
import { Farm } from '../src/core/farm';
import { BAKERY_COST, BAKERY_TIERS, GOODS, GOOD_ORDER, bakeMs, batchCost } from '../src/core/goods';
import { levelThreshold } from '../src/core/levels';
import { decodeSave, encodeSave } from '../src/core/save';
import { TREES } from '../src/core/trees';

const MIN = 60_000;

function bakeFarm(level = 30): Farm {
  const farm = new Farm({ seed: 4, pestChance: 0 });
  farm.xp = levelThreshold(level);
  farm.coins = 100_000;
  expect(farm.buyBakery().ok).toBe(true);
  return farm;
}

describe('sugar cane', () => {
  it('is a plain crop that fits the profit curve', () => {
    expect(CROPS.cana.rarity).toBe('comum');
    expect(CROPS.cana.unlockLevel).toBe(6);
  });
});

describe('recipes', () => {
  it('always pay more than the ingredients and use only known things', () => {
    for (const id of GOOD_ORDER) {
      const g = GOODS[id];
      expect(g.sellPrice * g.yield, id).toBeGreaterThan(batchCost(id) * 1.1);
      for (const ing of g.inputs) {
        if (ing.kind === 'good') expect(GOOD_ORDER.indexOf(ing.id), id).toBeLessThan(GOOD_ORDER.indexOf(id));
        if (ing.kind === 'fruit') expect(g.unlockLevel, id).toBeGreaterThanOrEqual(TREES[ing.id].unlockLevel);
        if (ing.kind === 'crop') expect(g.unlockLevel, id).toBeGreaterThanOrEqual(CROPS[ing.id].unlockLevel);
      }
    }
  });

  it('finished dishes pay clearly more than the base goods', () => {
    for (const id of GOOD_ORDER) if (GOODS[id].kind !== 'base') expect(GOODS[id].sellPrice * GOODS[id].yield / batchCost(id), id).toBeGreaterThanOrEqual(1.55);
  });
});

describe('the Confeitaria', () => {
  it('needs the level and the coins, once', () => {
    const farm = new Farm({ seed: 1 });
    expect(farm.buyBakery()).toEqual({ ok: false, reason: 'bakery-locked' });
    farm.xp = levelThreshold(8);
    farm.coins = BAKERY_COST - 1;
    expect(farm.buyBakery()).toEqual({ ok: false, reason: 'no-coins' });
    farm.coins = BAKERY_COST;
    expect(farm.buyBakery().ok).toBe(true);
    expect(farm.buyBakery()).toEqual({ ok: false, reason: 'bakery-exists' });
  });

  it('turns ingredients into goods after the time, with XP', () => {
    const farm = bakeFarm();
    farm.produce.trigo = 3;
    expect(farm.bake('farinha', 1, 0).ok).toBe(true);
    expect(farm.produce.trigo).toBe(0);
    expect(farm.collectBakery(1000)).toEqual({ ok: false, reason: 'not-ready' });
    const xp = farm.xp;
    expect(farm.collectBakery(bakeMs('farinha', 1, 1)).ok).toBe(true);
    expect(farm.goods.farinha).toBe(GOODS.farinha.yield);
    expect(farm.xp - xp).toBe(GOODS.farinha.xp);
    expect(farm.stats.baked).toBe(GOODS.farinha.yield);
  });

  it('refuses without ingredients, a free oven, the level or a sane amount', () => {
    const farm = bakeFarm(9);
    expect(farm.bake('farinha', 1, 0)).toEqual({ ok: false, reason: 'no-ingredients' });
    expect(farm.bake('beijinho', 1, 0)).toEqual({ ok: false, reason: 'recipe-locked' });
    expect(farm.bake('farinha', 0, 0)).toEqual({ ok: false, reason: 'bad-qty' });
    farm.produce.trigo = 30;
    expect(farm.bake('farinha', 1, 0).ok).toBe(true);
    expect(farm.bake('farinha', 1, 0).ok).toBe(true);
    expect(farm.bake('farinha', 1, 0)).toEqual({ ok: false, reason: 'no-slot' });
    expect(new Farm({ seed: 1 }).bake('farinha', 1, 0)).toEqual({ ok: false, reason: 'no-bakery' });
  });

  it('batches multiply the cost and the output, and take less time per batch', () => {
    const farm = bakeFarm();
    farm.produce.milho = 15;
    expect(farm.bake('fuba', 5, 0).ok).toBe(true);
    expect(farm.produce.milho).toBe(0);
    expect(bakeMs('fuba', 1, 5)).toBeLessThan(5 * bakeMs('fuba', 1, 1));
    farm.collectBakery(bakeMs('fuba', 1, 5));
    expect(farm.goods.fuba).toBe(10);
  });

  it('chains goods into dishes (pão de queijo from fubá, queijo and ovos)', () => {
    const farm = bakeFarm();
    farm.goods.fuba = 1;
    farm.goods.queijo = 1;
    farm.products.ovo = 1;
    expect(farm.bake('paodequeijo', 1, 0).ok).toBe(true);
    expect(farm.goods.fuba + farm.goods.queijo + farm.products.ovo).toBe(0);
  });

  it('upgrades add ovens and speed, and need level and coins', () => {
    const farm = bakeFarm(10);
    expect(farm.upgradeBakery()).toEqual({ ok: false, reason: 'bakery-locked' });
    farm.xp = levelThreshold(30);
    expect(farm.upgradeBakery().ok).toBe(true);
    expect(farm.upgradeBakery().ok).toBe(true);
    expect(farm.upgradeBakery()).toEqual({ ok: false, reason: 'max-level' });
    expect(farm.bakery!.level).toBe(BAKERY_TIERS.length);
    expect(bakeMs('pao', 3, 1)).toBeLessThan(bakeMs('pao', 1, 1));
  });

  it('sells goods one by one or with sell-all', () => {
    const farm = bakeFarm();
    farm.goods.pao = 3;
    farm.goods.pudim = 1;
    const coins = farm.coins;
    expect(farm.sellGood('pao', 2).ok).toBe(true);
    expect(farm.coins).toBe(coins + 2 * GOODS.pao.sellPrice);
    expect(farm.sellGood('pao', 5).ok).toBe(true);
    expect(farm.goods.pao).toBe(0);
    expect(farm.sellGood('pao', 1)).toEqual({ ok: false, reason: 'nothing-to-sell' });
    expect(farm.sellAll().ok).toBe(true);
    expect(farm.goods.pudim).toBe(0);
  });

  it('survives a save, and old v8 saves load without a bakery', () => {
    const farm = bakeFarm();
    farm.produce.trigo = 6;
    farm.bake('farinha', 2, 5 * MIN);
    farm.goods.pao = 7;
    const snap = farm.toSnapshot();
    const loaded = decodeSave(encodeSave({ playerId: 'p', savedAt: 1, state: snap, sync: { baseline: snap, outbox: [] } }));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      const copy = Farm.fromSnapshot(loaded.save.state);
      expect(copy.bakery).toEqual(farm.bakery);
      expect(copy.goods.pao).toBe(7);
    }
    const bare = farm.toSnapshot() as unknown as Record<string, unknown>;
    delete bare['bakery'];
    delete bare['goods'];
    const old = Farm.fromSnapshot(bare as never);
    expect(old.bakery).toBeNull();
    expect(old.goods.pao).toBe(0);
  });

  it('replays to the same farm', () => {
    const live = bakeFarm();
    live.produce.trigo = 9;
    live.produce.milho = 9;
    live.products.leite = 8;
    const start = live.toSnapshot();
    const log: LoggedCommand[] = [];
    const run = (command: LoggedCommand['command'], now: number): void => {
      if (applyCommand(live, command, now).ok) log.push({ command, now });
    };
    run({ type: 'bake', good: 'farinha', batches: 3, now: 0 } as never, 0);
    run({ type: 'bake', good: 'manteiga', batches: 1 }, 1000);
    run({ type: 'collectBakery' }, 20 * MIN);
    run({ type: 'bake', good: 'pao', batches: 1 }, 21 * MIN);
    run({ type: 'collectBakery' }, 40 * MIN);
    run({ type: 'sellGood', good: 'pao', qty: 2 }, 41 * MIN);
    const copy = Farm.fromSnapshot(start, { pestChance: 0 });
    replay(copy, log);
    expect(copy.toSnapshot()).toEqual(live.toSnapshot());
    expect(live.goods.pao).toBeGreaterThan(0);
  });
});
