import { describe, expect, it } from 'vitest';
import { applyCommand, replay, LoggedCommand } from '../src/core/commands';
import { CROPS } from '../src/core/crops';
import { Farm, FarmSnapshot, START_LAND, landBounds } from '../src/core/farm';
import {
  FERTILIZERS,
  FERTILIZER_ORDER,
  giftText,
  levelGift,
  levelGifts,
  normalizeFertilizer,
  skipLabel,
  totalFertilizer,
} from '../src/core/fertilizer';
import { ACHIEVEMENTS, achievementKey } from '../src/core/progress';
import { levelThreshold } from '../src/core/levels';
import { decodeSave, encodeSave } from '../src/core/save';

const { min: I } = landBounds(START_LAND);
const J = I;
const MIN = 60_000;
const newFarm = (pestChance = 0): Farm => new Farm({ seed: 1, pestChance });

/** A farm with one watered crop planted at t=0 and a bag of every fertilizer. */
function growing(crop: 'cenoura' | 'flor' = 'flor', pestChance = 0): Farm {
  const farm = newFarm(pestChance);
  farm.plow(I, J);
  farm.seeds[crop] = 1;
  farm.xp = levelThreshold(50);
  farm.plant(I, J, crop, 0);
  farm.water(I, J, 0);
  for (const id of FERTILIZER_ORDER) farm.fertilizer[id] = 5;
  return farm;
}

describe('fertilizer data', () => {
  it('skips 10 min, 30 min, 1 h and 2 h, the last matching the slowest crop', () => {
    expect(FERTILIZER_ORDER.map((id) => FERTILIZERS[id].ms / MIN)).toEqual([10, 30, 60, 120]);
    const slowest = Math.max(...Object.values(CROPS).map((c) => c.growthMs));
    expect(FERTILIZERS.lua.ms).toBe(slowest);
  });

  it('labels the skipped time', () => {
    expect(FERTILIZER_ORDER.map((id) => skipLabel(FERTILIZERS[id].ms))).toEqual(['10 min', '30 min', '1 h', '2 h']);
  });

  it('normalises whatever a save holds', () => {
    expect(normalizeFertilizer(undefined)).toEqual({ esterco: 0, composto: 0, humus: 0, lua: 0 });
    expect(normalizeFertilizer({ esterco: 3.9, composto: -2, humus: 'x', lua: Infinity, bogus: 4 })).toEqual({
      esterco: 3,
      composto: 0,
      humus: 0,
      lua: 0,
    });
  });
});

describe('fertilizing a crop', () => {
  it('cuts a fixed slice off the remaining time', () => {
    const farm = growing('flor');
    const before = farm.status(I, J, 0)!.msToRipe!;
    const result = farm.fertilize(I, J, 'composto', 0);
    expect(result.ok && result.gain.fertilized).toEqual({ id: 'composto', savedMs: 30 * MIN, ripe: false });
    expect(farm.status(I, J, 0)!.msToRipe).toBe(before - 30 * MIN);
    expect(farm.fertilizer.composto).toBe(4);
    expect(farm.stats.fertilized).toBe(1);
  });

  it('is instant for a quick crop and reports only the time really skipped', () => {
    const farm = growing('cenoura');
    const result = farm.fertilize(I, J, 'esterco', 0);
    expect(result.ok && result.gain.fertilized).toEqual({ id: 'esterco', savedMs: CROPS.cenoura.growthMs, ripe: true });
    expect(farm.status(I, J, 0)!.ripe).toBe(true);
  });

  it('stacks: the 2 h dust finishes the Luz da lua', () => {
    const farm = growing('flor');
    expect(CROPS.flor.growthMs).toBe(120 * MIN);
    farm.fertilize(I, J, 'lua', 0);
    expect(farm.status(I, J, 0)!.ripe).toBe(true);
    const other = growing('flor');
    other.fertilize(I, J, 'humus', 0);
    other.fertilize(I, J, 'humus', 0);
    expect(other.status(I, J, 0)!.ripe).toBe(true);
  });

  it('adds to growth that has already happened', () => {
    const farm = growing('flor');
    farm.fertilize(I, J, 'esterco', 20 * MIN);
    expect(farm.status(I, J, 20 * MIN)!.msToRipe).toBe(120 * MIN - 20 * MIN - 10 * MIN);
  });

  it('does not change when a ripe crop withers', () => {
    const farm = growing('cenoura');
    farm.fertilize(I, J, 'esterco', 0);
    const def = CROPS.cenoura;
    expect(farm.status(I, J, def.witherMs - 1)!.withered).toBe(false);
    expect(farm.status(I, J, def.witherMs + 1)!.withered).toBe(true);
  });

  it('gives 1 XP and counts as a revision', () => {
    const farm = growing('flor');
    const xp = farm.xp;
    const revision = farm.revision;
    farm.fertilize(I, J, 'esterco', 0);
    expect(farm.xp).toBe(xp + 1);
    expect(farm.revision).toBe(revision + 1);
  });
});

describe('when fertilizing is refused (nothing is spent)', () => {
  const stockOf = (farm: Farm): number => totalFertilizer(farm.fertilizer);

  it('without fertilizer', () => {
    const farm = growing('flor');
    farm.fertilizer.esterco = 0;
    expect(farm.fertilize(I, J, 'esterco', 0)).toEqual({ ok: false, reason: 'no-fertilizer' });
  });

  it('for an unknown fertilizer id coming from a command log', () => {
    const farm = growing('flor');
    expect(farm.fertilize(I, J, 'veneno' as never, 0)).toEqual({ ok: false, reason: 'no-fertilizer' });
  });

  it('on an empty tile or locked land', () => {
    const farm = growing('flor');
    expect(farm.fertilize(I + 1, J, 'esterco', 0)).toEqual({ ok: false, reason: 'no-crop' });
    expect(farm.fertilize(0, 0, 'esterco', 0)).toEqual({ ok: false, reason: 'locked-land' });
    expect(stockOf(farm)).toBe(20);
  });

  it('on a thirsty crop (the dose would be wasted)', () => {
    const farm = newFarm();
    farm.plow(I, J);
    farm.plant(I, J, 'cenoura', 0);
    for (const id of FERTILIZER_ORDER) farm.fertilizer[id] = 1;
    expect(farm.fertilize(I, J, 'esterco', 0)).toEqual({ ok: false, reason: 'not-watered' });
    expect(stockOf(farm)).toBe(4);
  });

  it('on a ripe crop', () => {
    const farm = growing('cenoura');
    expect(farm.fertilize(I, J, 'esterco', 10 * MIN - 1)).toEqual({ ok: false, reason: 'already-ripe' });
    expect(stockOf(farm)).toBe(20);
  });

  it('on a withered crop', () => {
    const farm = growing('cenoura');
    expect(farm.fertilize(I, J, 'esterco', 60 * MIN)).toEqual({ ok: false, reason: 'withered' });
  });

  it('on a crop frozen by a pest', () => {
    const farm = growing('flor', 1);
    const at = 100 * MIN;
    expect(farm.status(I, J, at)!.pest).not.toBeNull();
    expect(farm.fertilize(I, J, 'esterco', at)).toEqual({ ok: false, reason: 'pest-active' });
    expect(stockOf(farm)).toBe(20);
  });
});

describe('fertilizing and pests', () => {
  it('brings a coming pest forward by the same share of the growth', () => {
    const farm = growing('flor', 1);
    const crop = farm.tile(I, J).crop!;
    const total = CROPS.flor.growthMs;
    const pestAt = crop.pestAt!; // planted and watered at t=0, so wall time equals growth until the pest
    farm.fertilize(I, J, 'esterco', 0);
    // The pest still strikes at the same fraction of the *remaining* growth.
    expect(crop.pestAt).toBe(Math.round((pestAt * (total - 10 * MIN)) / total));
    expect(crop.pestAt!).toBeLessThan(pestAt);
  });

  it('lets a crop that ripens on the spot outrun its pest', () => {
    const farm = growing('flor', 1);
    expect(farm.tile(I, J).crop!.pestAt).not.toBeNull();
    farm.fertilize(I, J, 'lua', 0);
    const crop = farm.tile(I, J).crop!;
    expect(crop.pestAt).toBeNull();
    expect(crop.pestKind).toBeNull();
    expect(farm.status(I, J, 0)!.pest).toBeNull();
    expect(farm.status(I, J, 0)!.ripe).toBe(true);
  });

  it('never leaves a ripe crop with a pest still to come', () => {
    const farm = growing('flor', 1);
    farm.fertilize(I, J, 'humus', 0);
    farm.fertilize(I, J, 'humus', 0);
    expect(farm.status(I, J, 3 * 60 * MIN)?.pest ?? null).toBeNull();
  });
});

describe('level-up gifts', () => {
  it('follows the table', () => {
    expect(levelGift(1)).toEqual({});
    expect(levelGift(2)).toEqual({});
    expect(levelGift(3)).toEqual({ esterco: 1 });
    expect(levelGift(4)).toEqual({ esterco: 1 });
    expect(levelGift(5)).toEqual({ composto: 1 });
    expect(levelGift(10)).toEqual({ composto: 1, humus: 1 });
    expect(levelGift(25)).toEqual({ composto: 1, lua: 1 });
    expect(levelGift(50)).toEqual({ composto: 1, humus: 1, lua: 1 });
  });

  it('adds up to a modest total over the whole game', () => {
    expect(levelGifts(1, 50)).toEqual({ esterco: 38, composto: 10, humus: 5, lua: 2 });
  });

  it('is paid into the barn when XP crosses a level, once', () => {
    const farm = newFarm();
    farm.xp = levelThreshold(3) - 1;
    farm.plow(I, J); // +1 XP: level 3
    expect(farm.level).toBe(3);
    expect(farm.fertilizer.esterco).toBe(1);
    farm.plant(I, J, 'cenoura', 0);
    farm.water(I, J, 0);
    expect(farm.fertilizer.esterco).toBe(1);
  });

  it('reports the gift on the gain and pays every level of a big jump', () => {
    const farm = newFarm();
    // Levels 3, 4 and 5 in one go: two Esterco and a Composto.
    const result = (farm as unknown as { done(coins: number, xp: number): ReturnType<Farm['plow']> }).done(0, levelThreshold(5));
    expect(result.ok && result.gain.gift).toEqual({ esterco: 2, composto: 1 });
    expect(farm.fertilizer).toEqual({ esterco: 2, composto: 1, humus: 0, lua: 0 });
  });

  it('does not pay again after a save and load', () => {
    const farm = newFarm();
    farm.xp = levelThreshold(5);
    const loaded = Farm.fromSnapshot(farm.toSnapshot());
    expect(loaded.fertilizer).toEqual(farm.fertilizer);
    loaded.plow(I, J);
    expect(totalFertilizer(loaded.fertilizer)).toBe(totalFertilizer(farm.fertilizer));
  });
});

describe('achievement gifts', () => {
  const find = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

  it('are paid with the medal and not twice', () => {
    const farm = newFarm();
    farm.stats.harvested.cenoura = 50;
    const first = applyCommand(farm, { type: 'claimAchievement', achievement: 'colheitas', step: 0 }, 0);
    expect(first.ok && first.gain.gift).toEqual({ esterco: 3 });
    expect(farm.fertilizer.esterco).toBe(3);
    expect(applyCommand(farm, { type: 'claimAchievement', achievement: 'colheitas', step: 0 }, 0)).toEqual({ ok: false, reason: 'already-claimed' });
    expect(farm.fertilizer.esterco).toBe(3);
  });

  it('are not paid for a medal that is not earned', () => {
    const farm = newFarm();
    expect(applyCommand(farm, { type: 'claimAchievement', achievement: 'colheitas', step: 0 }, 0)).toEqual({ ok: false, reason: 'not-done' });
    expect(totalFertilizer(farm.fertilizer)).toBe(0);
  });

  it('are listed for some achievements only, with one entry per step at most', () => {
    const withGifts = ACHIEVEMENTS.filter((a) => a.gifts);
    expect(withGifts.length).toBeGreaterThanOrEqual(8);
    expect(withGifts.length).toBeLessThan(ACHIEVEMENTS.length);
    for (const a of withGifts) expect(a.gifts!.length).toBeLessThanOrEqual(a.steps.length);
    expect(find('ouro').gifts).toEqual([{ lua: 1 }]);
  });

  it('tracks the fertilizer achievement through the stats', () => {
    const a = find('adubo');
    const farm = growing('flor');
    for (let n = 0; n < 5; n++) farm.fertilize(I, J, 'esterco', 0);
    expect(a.value(farm)).toBe(5);
    expect(farm.claimed).not.toContain(achievementKey('adubo', 0));
  });
});

describe('commands, saves and replay', () => {
  const snap = (farm: Farm): string => JSON.stringify(farm.toSnapshot());

  it('applies the adubar tool through the command with the chosen fertilizer', () => {
    const farm = growing('flor');
    const result = applyCommand(farm, { type: 'tool', tool: 'adubar', i: I, j: J, crop: 'cenoura', fertilizer: 'composto' }, 0);
    expect(result.ok).toBe(true);
    expect(farm.fertilizer.composto).toBe(4);
    expect(farm.fertilizer.esterco).toBe(5);
  });

  it('answers the orchard with a refusal rather than crashing', () => {
    const farm = growing('flor');
    const result = applyCommand(farm, { type: 'tool', tool: 'adubar', i: 12, j: 2, crop: 'cenoura' }, 0);
    expect(result.ok).toBe(false);
  });

  it('survives a save file round trip', () => {
    const farm = growing('flor');
    farm.fertilize(I, J, 'humus', 5 * MIN);
    const state = farm.toSnapshot();
    const text = encodeSave({ playerId: 'p1', savedAt: 1, state, sync: { baseline: state, outbox: [] } });
    const decoded = decodeSave(text);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const back = Farm.fromSnapshot(decoded.save.state as FarmSnapshot);
    expect(back.fertilizer).toEqual(farm.fertilizer);
    expect(back.stats.fertilized).toBe(1);
    expect(snap(back)).toBe(snap(farm));
  });

  it('loads saves from before fertilizers existed as empty', () => {
    const farm = growing('flor');
    const old = farm.toSnapshot() as Partial<FarmSnapshot>;
    delete old.fertilizer;
    const stats = old.stats as unknown as Record<string, unknown>;
    delete stats['fertilized'];
    const back = Farm.fromSnapshot(old as FarmSnapshot);
    expect(totalFertilizer(back.fertilizer)).toBe(0);
    expect(back.stats.fertilized).toBe(0);
  });

  it('replays to the same farm', () => {
    const log: LoggedCommand[] = [
      { now: 0, command: { type: 'tool', tool: 'arar', i: I, j: J, crop: 'flor' } },
      { now: 0, command: { type: 'tool', tool: 'semear', i: I, j: J, crop: 'flor' } },
      { now: 1000, command: { type: 'tool', tool: 'regar', i: I, j: J, crop: 'flor' } },
      { now: 2000, command: { type: 'tool', tool: 'adubar', i: I, j: J, crop: 'flor', fertilizer: 'composto' } },
      { now: 3000, command: { type: 'tool', tool: 'adubar', i: I, j: J, crop: 'flor', fertilizer: 'lua' } },
    ];
    const make = (): Farm => {
      const farm = new Farm({ seed: 7 });
      farm.seeds.flor = 1;
      farm.xp = levelThreshold(30);
      farm.fertilizer = { esterco: 0, composto: 1, humus: 0, lua: 1 };
      return farm;
    };
    const a = make();
    const b = make();
    replay(a, log);
    replay(b, log);
    expect(snap(a)).toBe(snap(b));
    expect(a.stats.fertilized).toBe(2);
  });

  it('shows what a gift contains', () => {
    expect(giftText({ esterco: 2, composto: 1 })).toBe('2× Esterco curtido + 1× Composto da Dona Zefa');
    expect(giftText({})).toBe('');
  });
});
