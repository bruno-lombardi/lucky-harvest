import { describe, expect, it } from 'vitest';
import { applyTool } from '../src/core/actions';
import { CROPS } from '../src/core/crops';
import { Farm, FarmSnapshot, LAND_STEPS, START_COINS, START_LAND, landBounds } from '../src/core/farm';

const START = landBounds(START_LAND);
const I = START.min;
const J = START.min;
const NO_PEST = (): number => 0.99;
const ALWAYS_PEST = (): number => 0.1;
const newFarm = (rng = NO_PEST): Farm => new Farm(rng);
const carrot = CROPS.cenoura;
const SEC = 1000;

function plantedCarrot(now = 0): Farm {
  const farm = newFarm();
  expect(farm.plow(I, J).ok).toBe(true);
  expect(farm.plant(I, J, 'cenoura', now).ok).toBe(true);
  return farm;
}

describe('plowing', () => {
  it('turns grass into soil and grants a little XP', () => {
    const farm = newFarm();
    const result = farm.plow(I, J);
    expect(result).toEqual({ ok: true, gain: { coins: 0, xp: 1, levelUp: null } });
    expect(farm.tile(I, J).kind).toBe('soil');
  });

  it('refuses locked land, already-plowed soil and out-of-range tiles', () => {
    const farm = newFarm();
    expect(farm.plow(START.min - 1, J)).toEqual({ ok: false, reason: 'locked-land' });
    expect(farm.plow(0, 0)).toEqual({ ok: false, reason: 'locked-land' });
    expect(farm.plow(-1, 5)).toEqual({ ok: false, reason: 'locked-land' });
    farm.plow(I, J);
    expect(farm.plow(I, J)).toEqual({ ok: false, reason: 'not-grass' });
    expect(farm.isUnlocked(START.max, START.max)).toBe(true);
    expect(farm.isUnlocked(START.max + 1, START.max)).toBe(false);
  });
});

describe('planting', () => {
  it('needs plowed, empty soil', () => {
    const farm = newFarm();
    expect(farm.plant(I, J, 'cenoura', 0)).toEqual({ ok: false, reason: 'not-soil' });
    farm.plow(I, J);
    farm.plant(I, J, 'cenoura', 0);
    expect(farm.plant(I, J, 'cenoura', 0)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('uses one seed from the inventory and costs no coins', () => {
    const farm = plantedCarrot();
    expect(farm.seeds.cenoura).toBe(5);
    expect(farm.coins).toBe(START_COINS);
  });

  it('respects level unlocks and available coins', () => {
    const farm = newFarm();
    farm.plow(I, J);
    expect(farm.plant(I, J, 'tomate', 0)).toEqual({ ok: false, reason: 'crop-locked' });
    farm.seeds.cenoura = 0;
    expect(farm.plant(I, J, 'cenoura', 0)).toEqual({ ok: false, reason: 'no-seeds' });
    expect(farm.seeds.cenoura).toBe(0);
  });
});

describe('growth', () => {
  it('moves through the four stages once watered', () => {
    const farm = plantedCarrot(0);
    farm.water(I, J, 0);
    const at = (ms: number) => farm.status(I, J, ms)!;
    expect(at(0).stage).toBe(0);
    expect(at(0.3 * carrot.growthMs).stage).toBe(1);
    expect(at(0.7 * carrot.growthMs).stage).toBe(2);
    expect(at(carrot.growthMs).stage).toBe(3);
    expect(at(carrot.growthMs).ripe).toBe(true);
  });

  it('stalls at halfway and turns thirsty until watered', () => {
    const farm = plantedCarrot(0);
    const half = carrot.growthMs / 2;
    expect(farm.status(I, J, half - SEC)!.thirsty).toBe(false);

    const stalled = farm.status(I, J, 5 * 60 * SEC)!;
    expect(stalled.thirsty).toBe(true);
    expect(stalled.progress).toBeCloseTo(0.5);
    expect(stalled.ripe).toBe(false);
    expect(stalled.msToRipe).toBeNull();
  });

  it('resumes after late watering, delayed by the time it spent thirsty', () => {
    const farm = plantedCarrot(0);
    const wateredAt = 5 * 60 * SEC;
    expect(farm.water(I, J, wateredAt).ok).toBe(true);

    // Still needs the second half of growth after being watered.
    expect(farm.status(I, J, wateredAt)!.msToRipe).toBe(carrot.growthMs / 2);
    expect(farm.status(I, J, wateredAt + carrot.growthMs / 2 - SEC)!.ripe).toBe(false);
    expect(farm.status(I, J, wateredAt + carrot.growthMs / 2)!.ripe).toBe(true);
  });

  it('watering before thirst does not delay anything', () => {
    const farm = plantedCarrot(0);
    farm.water(I, J, 5 * SEC);
    expect(farm.status(I, J, carrot.growthMs)!.ripe).toBe(true);
  });

  it('refuses to water twice', () => {
    const farm = plantedCarrot(0);
    farm.water(I, J, 0);
    expect(farm.water(I, J, 1)).toEqual({ ok: false, reason: 'already-watered' });
    expect(newFarm().water(I, J, 0)).toEqual({ ok: false, reason: 'no-crop' });
  });
});

describe('harvesting', () => {
  it('stores the produce, pays XP and leaves plowed soil', () => {
    const farm = plantedCarrot(0);
    farm.water(I, J, 0);
    const before = { coins: farm.coins, xp: farm.xp };

    const result = farm.harvest(I, J, carrot.growthMs);
    expect(result).toEqual({
      ok: true,
      gain: { coins: 0, xp: carrot.xp, levelUp: null, item: { cropId: 'cenoura', qty: 1 } },
    });
    expect(farm.produce.cenoura).toBe(1);
    expect(farm.coins).toBe(before.coins);
    expect(farm.xp).toBe(before.xp + carrot.xp);
    expect(farm.tile(I, J)).toEqual({ kind: 'soil', crop: null });
  });

  it('is refused before the crop is ripe', () => {
    const farm = plantedCarrot(0);
    farm.water(I, J, 0);
    expect(farm.harvest(I, J, carrot.growthMs - SEC)).toEqual({ ok: false, reason: 'not-ripe' });
    expect(farm.harvest(I + 1, J, 0)).toEqual({ ok: false, reason: 'no-crop' });
  });
});

describe('withering', () => {
  it('kills a ripe crop that is left too long, and the shovel clears it', () => {
    const farm = plantedCarrot(0);
    farm.water(I, J, 0);
    const late = carrot.growthMs + carrot.witherMs + SEC;

    const status = farm.status(I, J, late)!;
    expect(status.withered).toBe(true);
    expect(status.ripe).toBe(false);
    expect(farm.harvest(I, J, late)).toEqual({ ok: false, reason: 'withered' });
    expect(farm.water(I, J, late)).toEqual({ ok: false, reason: 'withered' });

    expect(farm.clear(I, J).ok).toBe(true);
    expect(farm.tile(I, J)).toEqual({ kind: 'soil', crop: null });
  });

  it('kills a crop that is never watered', () => {
    const farm = plantedCarrot(0);
    const late = carrot.growthMs / 2 + carrot.witherMs + SEC;
    expect(farm.status(I, J, late)!.withered).toBe(true);
  });
});

describe('shovel', () => {
  it('turns bare soil back into grass and refuses plain grass', () => {
    const farm = newFarm();
    expect(farm.clear(I, J)).toEqual({ ok: false, reason: 'nothing-to-clear' });
    farm.plow(I, J);
    expect(farm.clear(I, J).ok).toBe(true);
    expect(farm.tile(I, J).kind).toBe('grass');
    expect([...farm.entries()]).toHaveLength(0);
  });
});

describe('levelling', () => {
  it('reports a level-up when XP crosses a threshold', () => {
    const farm = Farm.fromSnapshot({ version: 2, coins: 100, xp: 49, landSize: START_LAND, seeds: {} as FarmSnapshot['seeds'], produce: {} as FarmSnapshot['produce'], tiles: {} });
    const result = farm.plow(I, J);
    expect(result).toEqual({ ok: true, gain: { coins: 0, xp: 1, levelUp: 2 } });
    expect(farm.level).toBe(2);
  });

  it('unlocks crops as the level rises', () => {
    const farm = Farm.fromSnapshot({ version: 2, coins: 500, xp: 50, landSize: START_LAND, seeds: { milho: 1 } as FarmSnapshot['seeds'], produce: {} as FarmSnapshot['produce'], tiles: {} });
    farm.plow(I, J);
    expect(farm.plant(I, J, 'milho', 0).ok).toBe(true);
  });
});

describe('applyTool and snapshots', () => {
  it('dispatches each tool to the right action', () => {
    const farm = newFarm();
    expect(applyTool(farm, 'arar', I, J, 0, 'cenoura').ok).toBe(true);
    expect(applyTool(farm, 'semear', I, J, 0, 'cenoura').ok).toBe(true);
    expect(applyTool(farm, 'regar', I, J, 0, 'cenoura').ok).toBe(true);
    expect(applyTool(farm, 'colher', I, J, carrot.growthMs, 'cenoura').ok).toBe(true);
    expect(applyTool(farm, 'cuidar', I, J, 0, 'cenoura')).toEqual({ ok: false, reason: 'no-crop' });
    expect(applyTool(farm, 'limpar', I, J, 0, 'cenoura').ok).toBe(true);
  });

  it('round-trips through a JSON snapshot', () => {
    const farm = plantedCarrot(1234);
    farm.water(I, J, 5000);
    const json = JSON.stringify(farm.toSnapshot());
    const restored = Farm.fromSnapshot(JSON.parse(json) as FarmSnapshot);

    expect(restored.coins).toBe(farm.coins);
    expect(restored.xp).toBe(farm.xp);
    expect(restored.status(I, J, 100_000)).toEqual(farm.status(I, J, 100_000));
  });

  it('snapshots are deep copies', () => {
    const farm = plantedCarrot(0);
    const snap = farm.toSnapshot();
    snap.tiles[`${I},${J}`]!.crop!.watered = true;
    expect(farm.tile(I, J).crop!.watered).toBe(false);
  });
});

describe('pests', () => {
  /** A carrot that is guaranteed to get a pest; returns the farm and when the pest arrives. */
  function infested() {
    const farm = newFarm(ALWAYS_PEST);
    farm.plow(I, J);
    farm.plant(I, J, 'cenoura', 0);
    const crop = farm.tile(I, J).crop!;
    return { farm, pestAt: crop.pestAt!, kind: crop.pestKind! };
  }

  it('appear at some point during growth, for crops chosen by the rng', () => {
    const { pestAt } = infested();
    expect(pestAt).toBeGreaterThan(0.19 * carrot.growthMs);
    expect(pestAt).toBeLessThan(0.71 * carrot.growthMs);
    expect(plantedCarrot().tile(I, J).crop!.pestAt).toBeNull();
  });

  it('freeze growth until removed, and the lost time delays ripening', () => {
    const { farm, pestAt, kind } = infested();
    farm.water(I, J, 0);
    expect(farm.status(I, J, pestAt - SEC)!.pest).toBeNull();

    const hit = farm.status(I, J, pestAt + 10 * SEC)!;
    expect(hit.pest).toBe(kind);
    expect(hit.progress).toBeCloseTo(pestAt / carrot.growthMs);
    expect(hit.msToRipe).toBeNull();

    const cleanedAt = pestAt + 20 * SEC;
    expect(farm.care(I, J, cleanedAt)).toEqual({ ok: true, gain: { coins: 0, xp: 2, levelUp: null } });
    expect(farm.status(I, J, cleanedAt)!.pest).toBeNull();
    // 20 s were lost: ripe exactly 20 s later than a pest-free crop.
    expect(farm.status(I, J, carrot.growthMs + 19 * SEC)!.ripe).toBe(false);
    expect(farm.status(I, J, carrot.growthMs + 20 * SEC)!.ripe).toBe(true);
  });

  it('kill the crop if ignored too long', () => {
    const { farm, pestAt } = infested();
    farm.water(I, J, 0);
    expect(farm.status(I, J, pestAt + carrot.witherMs - SEC)!.withered).toBe(false);
    const dead = farm.status(I, J, pestAt + carrot.witherMs + SEC)!;
    expect(dead.withered).toBe(true);
    expect(dead.pest).toBeNull();
    expect(farm.care(I, J, pestAt + carrot.witherMs + SEC)).toEqual({ ok: false, reason: 'withered' });
  });

  it('keep stalling a crop that was watered while infested', () => {
    const { farm, pestAt } = infested();
    farm.water(I, J, pestAt + 5 * SEC);
    expect(farm.status(I, J, pestAt + 60 * SEC)!.progress).toBeCloseTo(pestAt / carrot.growthMs);
    farm.care(I, J, pestAt + 60 * SEC);
    expect(farm.status(I, J, pestAt + 61 * SEC)!.progress).toBeGreaterThan(pestAt / carrot.growthMs);
  });

  it('cannot be treated when there is none', () => {
    const farm = plantedCarrot();
    expect(farm.care(I, J, 0)).toEqual({ ok: false, reason: 'no-pest' });
    expect(farm.care(I + 1, J, 0)).toEqual({ ok: false, reason: 'no-crop' });
  });
});

describe('shop', () => {
  it('buys seeds with coins, only for unlocked crops', () => {
    const farm = newFarm();
    expect(farm.buySeeds('cenoura', 5)).toEqual({ ok: true, gain: { coins: -50, xp: 0, levelUp: null } });
    expect(farm.seeds.cenoura).toBe(11);
    expect(farm.buySeeds('tomate', 1)).toEqual({ ok: false, reason: 'crop-locked' });
    expect(farm.buySeeds('trigo', 100)).toEqual({ ok: false, reason: 'no-coins' });
    expect(farm.coins).toBe(START_COINS - 50);
  });

  it('sells produce, one kind or everything', () => {
    const farm = newFarm();
    expect(farm.sell('cenoura', 1)).toEqual({ ok: false, reason: 'nothing-to-sell' });
    expect(farm.sellAll()).toEqual({ ok: false, reason: 'nothing-to-sell' });
    farm.produce.cenoura = 3;
    farm.produce.trigo = 2;
    expect(farm.sell('cenoura', 2).ok).toBe(true);
    expect(farm.coins).toBe(START_COINS + 2 * carrot.sellPrice);
    expect(farm.sell('cenoura', Infinity).ok).toBe(true);
    expect(farm.produce.cenoura).toBe(0);
    farm.sellAll();
    expect(farm.produce.trigo).toBe(0);
    expect(farm.coins).toBe(START_COINS + 3 * carrot.sellPrice + 2 * CROPS.trigo.sellPrice);
  });
});

describe('land expansion', () => {
  it('needs level and coins, then unlocks a bigger centred plot', () => {
    const farm = newFarm();
    const step = LAND_STEPS[1]!;
    expect(farm.nextExpansion()).toEqual(step);
    expect(farm.expandLand()).toEqual({ ok: false, reason: 'level-too-low' });

    farm.xp = 10_000;
    expect(farm.expandLand()).toEqual({ ok: false, reason: 'no-coins' });

    farm.coins = step.cost + 7;
    expect(farm.isUnlocked(START.min - 1, J)).toBe(false);
    expect(farm.expandLand().ok).toBe(true);
    expect(farm.coins).toBe(7);
    expect(farm.landSize).toBe(step.size);
    expect(farm.isUnlocked(START.min - 1, J)).toBe(true);
    expect(farm.plow(START.min - 1, J).ok).toBe(true);
  });

  it('stops at the largest plot', () => {
    const farm = newFarm();
    farm.xp = 10_000;
    farm.coins = 1_000_000;
    while (farm.nextExpansion()) expect(farm.expandLand().ok).toBe(true);
    expect(farm.expandLand()).toEqual({ ok: false, reason: 'max-land' });
  });
});
