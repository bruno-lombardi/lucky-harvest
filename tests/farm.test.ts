import { describe, expect, it } from 'vitest';
import { applyTool } from '../src/core/actions';
import { CROPS } from '../src/core/crops';
import { Farm, FarmSnapshot, LAND, START_COINS, isUnlocked } from '../src/core/farm';

const I = LAND.min;
const J = LAND.min;
const carrot = CROPS.cenoura;
const SEC = 1000;

function plantedCarrot(now = 0): Farm {
  const farm = new Farm();
  expect(farm.plow(I, J).ok).toBe(true);
  expect(farm.plant(I, J, 'cenoura', now).ok).toBe(true);
  return farm;
}

describe('plowing', () => {
  it('turns grass into soil and grants a little XP', () => {
    const farm = new Farm();
    const result = farm.plow(I, J);
    expect(result).toEqual({ ok: true, gain: { coins: 0, xp: 1, levelUp: null } });
    expect(farm.tile(I, J).kind).toBe('soil');
  });

  it('refuses locked land, already-plowed soil and out-of-range tiles', () => {
    const farm = new Farm();
    expect(farm.plow(0, 0)).toEqual({ ok: false, reason: 'locked-land' });
    expect(farm.plow(-1, 5)).toEqual({ ok: false, reason: 'locked-land' });
    farm.plow(I, J);
    expect(farm.plow(I, J)).toEqual({ ok: false, reason: 'not-grass' });
    expect(isUnlocked(LAND.max, LAND.max)).toBe(true);
    expect(isUnlocked(LAND.max + 1, LAND.max)).toBe(false);
  });
});

describe('planting', () => {
  it('needs plowed, empty soil', () => {
    const farm = new Farm();
    expect(farm.plant(I, J, 'cenoura', 0)).toEqual({ ok: false, reason: 'not-soil' });
    farm.plow(I, J);
    farm.plant(I, J, 'cenoura', 0);
    expect(farm.plant(I, J, 'cenoura', 0)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('charges the seed cost', () => {
    const farm = plantedCarrot();
    expect(farm.coins).toBe(START_COINS - carrot.seedCost);
  });

  it('respects level unlocks and available coins', () => {
    const farm = new Farm();
    farm.plow(I, J);
    expect(farm.plant(I, J, 'tomate', 0)).toEqual({ ok: false, reason: 'crop-locked' });
    farm.coins = 5;
    expect(farm.plant(I, J, 'cenoura', 0)).toEqual({ ok: false, reason: 'no-coins' });
    expect(farm.coins).toBe(5);
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
    expect(new Farm().water(I, J, 0)).toEqual({ ok: false, reason: 'no-crop' });
  });
});

describe('harvesting', () => {
  it('pays coins and XP and leaves plowed soil', () => {
    const farm = plantedCarrot(0);
    farm.water(I, J, 0);
    const before = { coins: farm.coins, xp: farm.xp };

    const result = farm.harvest(I, J, carrot.growthMs);
    expect(result).toEqual({ ok: true, gain: { coins: carrot.sellPrice, xp: carrot.xp, levelUp: null } });
    expect(farm.coins).toBe(before.coins + carrot.sellPrice);
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
    const farm = new Farm();
    expect(farm.clear(I, J)).toEqual({ ok: false, reason: 'nothing-to-clear' });
    farm.plow(I, J);
    expect(farm.clear(I, J).ok).toBe(true);
    expect(farm.tile(I, J).kind).toBe('grass');
    expect([...farm.entries()]).toHaveLength(0);
  });
});

describe('levelling', () => {
  it('reports a level-up when XP crosses a threshold', () => {
    const farm = Farm.fromSnapshot({ version: 1, coins: 100, xp: 49, tiles: {} });
    const result = farm.plow(I, J);
    expect(result).toEqual({ ok: true, gain: { coins: 0, xp: 1, levelUp: 2 } });
    expect(farm.level).toBe(2);
  });

  it('unlocks crops as the level rises', () => {
    const farm = Farm.fromSnapshot({ version: 1, coins: 500, xp: 50, tiles: {} });
    farm.plow(I, J);
    expect(farm.plant(I, J, 'milho', 0).ok).toBe(true);
  });
});

describe('applyTool and snapshots', () => {
  it('dispatches each tool to the right action', () => {
    const farm = new Farm();
    expect(applyTool(farm, 'arar', I, J, 0, 'cenoura').ok).toBe(true);
    expect(applyTool(farm, 'semear', I, J, 0, 'cenoura').ok).toBe(true);
    expect(applyTool(farm, 'regar', I, J, 0, 'cenoura').ok).toBe(true);
    expect(applyTool(farm, 'colher', I, J, carrot.growthMs, 'cenoura').ok).toBe(true);
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
