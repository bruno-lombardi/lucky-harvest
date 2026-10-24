import { describe, expect, it } from 'vitest';
import { PRODUCTS, SPECIES, animalStatus, nextPenUpgrade, penCapacity, penCycleMs } from '../src/core/animals';
import { Command, LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { Farm } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';

const MIN = 60_000;

/** A rich, high-level farm so tests can focus on animal rules. */
function richFarm(): Farm {
  const farm = new Farm({ seed: 7, pestChance: 0 });
  farm.xp = levelThreshold(10);
  farm.coins = 100_000;
  return farm;
}

describe('pens', () => {
  it('need the level and the coins, and exist once per species', () => {
    const farm = new Farm({ seed: 1, pestChance: 0 });
    expect(farm.buildPen('galinha')).toEqual({ ok: false, reason: 'pen-locked' });
    farm.xp = levelThreshold(2);
    farm.coins = SPECIES.galinha.penCost - 1;
    expect(farm.buildPen('galinha')).toEqual({ ok: false, reason: 'no-coins' });
    farm.coins = SPECIES.galinha.penCost;
    expect(farm.buildPen('galinha').ok).toBe(true);
    expect(farm.coins).toBe(0);
    expect(farm.buildPen('galinha')).toEqual({ ok: false, reason: 'pen-exists' });
  });

  it('hold a limited number of animals and grow through upgrade tiers', () => {
    const farm = richFarm();
    expect(farm.buyAnimal('vaca')).toEqual({ ok: false, reason: 'no-pen' });
    farm.buildPen('vaca');
    const cap = penCapacity('vaca', 1);
    for (let n = 0; n < cap; n++) expect(farm.buyAnimal('vaca').ok).toBe(true);
    expect(farm.buyAnimal('vaca')).toEqual({ ok: false, reason: 'pen-full' });

    // Tier 2 needs the player level (richFarm is level 10), then makes room.
    const up = nextPenUpgrade('vaca', 1)!;
    expect(up.level).toBe(2);
    farm.xp = levelThreshold(up.unlockLevel - 1);
    expect(farm.upgradePen('vaca')).toEqual({ ok: false, reason: 'pen-locked' });
    farm.xp = levelThreshold(up.unlockLevel);
    expect(farm.upgradePen('vaca').ok).toBe(true);
    expect(penCapacity('vaca', 2)).toBeGreaterThan(cap);
    expect(farm.buyAnimal('vaca').ok).toBe(true);
    expect(penCycleMs('vaca', 2)).toBeLessThan(penCycleMs('vaca', 1));

    farm.xp = levelThreshold(20);
    expect(farm.upgradePen('vaca').ok).toBe(true);
    expect(nextPenUpgrade('vaca', 3)).toBeNull();
    expect(farm.upgradePen('vaca')).toEqual({ ok: false, reason: 'max-level' });
    expect(farm.pens.vaca!.animals.map((a) => a.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('feeding and collecting', () => {
  function withChicken(): Farm {
    const farm = richFarm();
    farm.buildPen('galinha');
    farm.buyAnimal('galinha');
    return farm;
  }

  it('needs species feed, then produces after one cycle', () => {
    const farm = withChicken();
    const cycle = SPECIES.galinha.cycleMs;
    expect(farm.feedAnimal('galinha', 1, 0)).toEqual({ ok: false, reason: 'no-feed' });
    farm.buyFeed('galinha', 2);
    expect(farm.feed.galinha).toBe(2);

    expect(farm.feedAnimal('galinha', 1, 0).ok).toBe(true);
    expect(farm.feed.galinha).toBe(1);
    const animal = farm.pens.galinha!.animals[0]!;
    expect(animalStatus('galinha', animal, cycle / 2)).toMatchObject({ phase: 'working', msToReady: cycle / 2 });
    expect(farm.feedAnimal('galinha', 1, 1)).toEqual({ ok: false, reason: 'already-fed' });
    expect(farm.collect('galinha', 1, cycle - 1)).toEqual({ ok: false, reason: 'not-ready' });

    const result = farm.collect('galinha', 1, cycle);
    expect(result).toMatchObject({ ok: true, gain: { product: { productId: 'ovo', qty: 1 } } });
    expect(farm.products.ovo).toBe(1);
    expect(farm.feedAnimal('galinha', 99, cycle)).toEqual({ ok: false, reason: 'no-animal' });
  });

  it('keeps an uncollected product until it is picked up, and blocks feeding meanwhile', () => {
    const farm = withChicken();
    farm.buyFeed('galinha', 3);
    farm.feedAnimal('galinha', 1, 0);
    const late = SPECIES.galinha.cycleMs * 10;
    expect(farm.feedAnimal('galinha', 1, late)).toEqual({ ok: false, reason: 'product-waiting' });
    farm.collect('galinha', 1, late);
    expect(farm.feedAnimal('galinha', 1, late).ok).toBe(true);
  });

  it('feeds and collects whole pens at once', () => {
    const farm = richFarm();
    farm.buildPen('galinha');
    for (let n = 0; n < 4; n++) farm.buyAnimal('galinha');
    farm.buyFeed('galinha', 3);
    const fed = farm.feedAll('galinha', 0);
    expect(fed.ok).toBe(true);
    expect(farm.feed.galinha).toBe(0);
    expect(farm.pens.galinha!.animals.filter((a) => a.readyAt !== null)).toHaveLength(3);
    expect(farm.collectAll('galinha', 1)).toEqual({ ok: false, reason: 'not-ready' });
    const done = farm.collectAll('galinha', SPECIES.galinha.cycleMs);
    expect(done).toMatchObject({ ok: true, gain: { product: { productId: 'ovo', qty: 3 } } });
  });
});

describe('feed and products', () => {
  it('feed can be milled from crops in the barn, or bought', () => {
    const farm = richFarm();
    expect(farm.craftFeed('galinha', 1)).toEqual({ ok: false, reason: 'no-ingredients' });
    farm.produce.trigo = 5;
    expect(farm.maxFeedBatches('galinha')).toBe(2);
    expect(farm.craftFeed('galinha', 2).ok).toBe(true);
    expect(farm.produce.trigo).toBe(1);
    expect(farm.feed.galinha).toBe(SPECIES.galinha.recipe.yield * 2);

    const before = farm.coins;
    farm.buyFeed('porco', 2);
    expect(farm.coins).toBe(before - 2 * SPECIES.porco.feedPrice);
    expect(farm.feed.porco).toBe(2);
  });

  it('products sell separately or with everything else', () => {
    const farm = richFarm();
    farm.products.ovo = 3;
    farm.products.leite = 2;
    farm.produce.cenoura = 1;
    const before = farm.coins;
    expect(farm.sellProduct('ovo', 2).ok).toBe(true);
    expect(farm.coins).toBe(before + 2 * PRODUCTS.ovo.sellPrice);
    expect(farm.sellAll().ok).toBe(true);
    expect(farm.products).toEqual({ ovo: 0, leite: 0, trufa: 0 });
    expect(farm.produce.cenoura).toBe(0);
    expect(farm.sellAll()).toEqual({ ok: false, reason: 'nothing-to-sell' });
  });
});

describe('determinism and sync', () => {
  /** A busy session touching crops, pests, shop, land and animals. */
  function session(): LoggedCommand[] {
    const script: Array<[Command, number]> = [
      [{ type: 'tool', tool: 'arar', i: 9, j: 9, crop: 'cenoura' }, 0],
      [{ type: 'tool', tool: 'semear', i: 9, j: 9, crop: 'cenoura' }, 1000],
      [{ type: 'tool', tool: 'regar', i: 9, j: 9, crop: 'cenoura' }, 2000],
      [{ type: 'tool', tool: 'arar', i: 10, j: 9, crop: 'cenoura' }, 3000],
      [{ type: 'tool', tool: 'semear', i: 10, j: 9, crop: 'trigo' }, 4000],
      [{ type: 'tool', tool: 'cuidar', i: 10, j: 9, crop: 'trigo' }, 60_000],
      [{ type: 'tool', tool: 'colher', i: 9, j: 9, crop: 'cenoura' }, 120_000],
      [{ type: 'buySeeds', crop: 'milho', qty: 3 }, 121_000],
      [{ type: 'buildPen', species: 'galinha' }, 122_000],
      [{ type: 'buyAnimal', species: 'galinha' }, 123_000],
      [{ type: 'buyFeed', species: 'galinha', qty: 2 }, 124_000],
      [{ type: 'feed', species: 'galinha', animalId: 1 }, 125_000],
      [{ type: 'collect', species: 'galinha', animalId: 1 }, 125_000 + 3 * MIN],
      [{ type: 'sellAll' }, 126_000 + 3 * MIN],
      [{ type: 'expandLand' }, 127_000 + 3 * MIN],
    ];
    const farm = richStart();
    const log: LoggedCommand[] = [];
    for (const [command, now] of script) {
      if (applyCommand(farm, command, now).ok) log.push({ command, now });
    }
    return log;
  }

  const richStart = (): Farm => {
    const farm = new Farm({ seed: 99 });
    farm.xp = levelThreshold(6);
    farm.coins = 5000;
    return farm;
  };

  it('replaying the logged commands on the same snapshot gives the identical state', () => {
    const start = richStart().toSnapshot();
    const live = richStart();
    const log: LoggedCommand[] = [];
    for (const entry of session()) {
      expect(applyCommand(live, entry.command, entry.now).ok).toBe(true);
      log.push(entry);
    }
    expect(log.length).toBeGreaterThan(10);

    const replica = Farm.fromSnapshot(start);
    replay(replica, log);
    expect(replica.toSnapshot()).toEqual(live.toSnapshot());
  });

  it('pests depend on the seed and the history, never on Math.random', () => {
    const run = (seed: number): Array<number | null> => {
      const farm = new Farm({ seed });
      farm.seeds.cenoura = 40;
      const out: Array<number | null> = [];
      for (let i = 9; i < 15; i++) {
        for (let j = 9; j < 15; j++) {
          farm.plow(i, j);
          farm.plant(i, j, 'cenoura', 0);
          out.push(farm.tile(i, j).crop!.pestAt);
        }
      }
      return out;
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
    expect(run(5).some((p) => p !== null)).toBe(true);
    expect(run(5).some((p) => p === null)).toBe(true);
  });

  it('commands survive JSON, so they can travel to a server', () => {
    const log = session();
    expect(JSON.parse(JSON.stringify(log))).toEqual(log);
    const farm = richStart();
    applyCommand(farm, JSON.parse(JSON.stringify({ type: 'sellAll' })) as Command, 0);
  });
});
