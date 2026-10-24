import { describe, expect, it } from 'vitest';
import { defaultAutoPlant, normalizeAutoPlant, plantOrder } from '../src/core/autoplant';
import { LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { CROPS } from '../src/core/crops';
import { Farm } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { decodeSave, encodeSave } from '../src/core/save';

const MIN = 60_000;

/** A level-16 farm with a level-4 Tonico and a 6×6 plot. */
function planterFarm(): Farm {
  const farm = new Farm({ seed: 3, pestChance: 0 });
  farm.xp = levelThreshold(16);
  farm.coins = 20_000;
  farm.landSize = 6;
  farm.hireHelper('ajudante', 0);
  for (let i = 0; i < 3; i++) expect(farm.upgradeHelper('ajudante').ok).toBe(true);
  expect(farm.helpers.ajudante!.level).toBe(4);
  return farm;
}

describe('Tonico, level 4', () => {
  it('plows, sows and waters bare land on his own', () => {
    const farm = planterFarm();
    farm.runHelpers(3 * MIN);
    expect(farm.stats.farmhandPlants).toBeGreaterThan(3);
    expect(farm.stats.plowed).toBeGreaterThan(3);
    const planted = [...farm.entries()].filter((e) => e.tile.crop);
    expect(planted.length).toBeGreaterThan(3);
    expect(planted.length).toBeLessThanOrEqual(farm.stats.farmhandPlants);
    expect(planted.every((e) => e.tile.crop!.watered)).toBe(true);
    expect(farm.helperEvents.some((e) => e.kind === 'plant')).toBe(true);
  });

  it('does nothing extra below level 4 or when switched off', () => {
    const low = planterFarm();
    low.helpers.ajudante!.level = 3;
    low.runHelpers(3 * MIN);
    expect(low.stats.farmhandPlants).toBe(0);

    const off = planterFarm();
    off.setAutoPlant({ ...off.autoPlant, on: false });
    off.runHelpers(3 * MIN);
    expect(off.stats.farmhandPlants).toBe(0);
  });

  it('only sows the allowed seeds, and the list order wins in "ordem" mode', () => {
    const farm = planterFarm();
    farm.setAutoPlant({ ...defaultAutoPlant(), mode: 'ordem', crops: ['trigo', 'cenoura'] });
    farm.runHelpers(3 * MIN);
    const kinds = new Set([...farm.entries()].filter((e) => e.tile.crop).map((e) => e.tile.crop!.cropId));
    expect([...kinds]).toEqual(['trigo']);
  });

  it('"melhor" picks the most profitable seed and "variar" mixes several', () => {
    expect(plantOrder({ ...defaultAutoPlant(), mode: 'melhor' }, 16, 0)[0]).toBeDefined();
    const farm = planterFarm();
    farm.setAutoPlant({ ...defaultAutoPlant(), mode: 'variar', crops: ['cenoura', 'trigo', 'milho'] });
    farm.runHelpers(8 * MIN);
    const kinds = new Set([...farm.entries()].filter((e) => e.tile.crop).map((e) => e.tile.crop!.cropId));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('buys seeds but keeps the coin reserve', () => {
    const farm = planterFarm();
    farm.seeds = { ...farm.seeds, cenoura: 0, trigo: 0 };
    for (const id of Object.keys(farm.seeds) as Array<keyof typeof farm.seeds>) farm.seeds[id] = 0;
    farm.coins = 500;
    farm.setAutoPlant({ ...defaultAutoPlant(), mode: 'ordem', crops: ['cenoura'], reserve: 450 });
    farm.runHelpers(5 * MIN);
    expect(farm.coins).toBeGreaterThanOrEqual(450 - CROPS.cenoura.seedCost);
    expect(farm.stats.seedsBought).toBeLessThanOrEqual(Math.floor(50 / CROPS.cenoura.seedCost) + 1);

    const broke = planterFarm();
    for (const id of Object.keys(broke.seeds) as Array<keyof typeof broke.seeds>) broke.seeds[id] = 0;
    broke.setAutoPlant({ ...defaultAutoPlant(), buy: false });
    broke.runHelpers(5 * MIN);
    expect(broke.stats.farmhandPlants).toBe(0);
  });

  it('harvests a ripe crop and replants the same tile', () => {
    const farm = planterFarm();
    farm.setAutoPlant({ ...defaultAutoPlant(), mode: 'ordem', crops: ['cenoura'], plow: false });
    farm.seeds.cenoura += 1;
    farm.plow(10, 10);
    farm.plant(10, 10, 'cenoura', 0);
    farm.water(10, 10, 0);
    farm.runHelpers(CROPS.cenoura.growthMs + 2 * MIN);
    expect(farm.stats.farmhandHarvests).toBeGreaterThanOrEqual(1);
    expect(farm.tile(10, 10).crop).not.toBeNull();
  });

  it('can be talkative or quiet', () => {
    const chatty = planterFarm();
    chatty.setAutoPlant({ ...defaultAutoPlant(), humor: 'cantor' });
    chatty.runHelpers(4 * MIN);
    expect(chatty.helperEvents.some((e) => e.kind === 'say' && e.text)).toBe(true);
    const quiet = planterFarm();
    quiet.setAutoPlant({ ...defaultAutoPlant(), humor: 'quieto' });
    quiet.runHelpers(4 * MIN);
    expect(quiet.helperEvents.some((e) => e.kind === 'say')).toBe(false);
  });

  it('replays to the same farm from the logged commands', () => {
    const live = planterFarm();
    const start = live.toSnapshot();
    const log: LoggedCommand[] = [];
    const run = (command: LoggedCommand['command'], now: number): void => {
      if (applyCommand(live, command, now).ok) log.push({ command, now });
    };
    run({ type: 'setAutoPlant', settings: { ...defaultAutoPlant(), mode: 'variar', humor: 'cantor', reserve: 500 } }, 10_000);
    run({ type: 'sellAll' }, 4 * MIN);
    run({ type: 'buySeeds', crop: 'cenoura', qty: 2 }, 7 * MIN);
    live.runHelpers(12 * MIN);
    const copy = Farm.fromSnapshot(start, { pestChance: 0 });
    replay(copy, log);
    copy.runHelpers(12 * MIN);
    expect(copy.toSnapshot()).toEqual(live.toSnapshot());
  });
});

describe('planting settings', () => {
  it('survive a save, and a v8 save without them gets the defaults', () => {
    const farm = planterFarm();
    farm.setAutoPlant({ ...defaultAutoPlant(), mode: 'ordem', crops: ['trigo'], reserve: 2000, humor: 'quieto', skipRare: true });
    const snap = farm.toSnapshot();
    const loaded = decodeSave(encodeSave({ playerId: 'p', savedAt: 1, state: snap, sync: { baseline: snap, outbox: [] } }));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(Farm.fromSnapshot(loaded.save.state).autoPlant).toEqual(farm.autoPlant);

    const bare = farm.toSnapshot() as unknown as Record<string, unknown>;
    delete bare['autoPlant'];
    expect(Farm.fromSnapshot(bare as never).autoPlant).toEqual(defaultAutoPlant());
  });

  it('repair anything invalid', () => {
    const fixed = normalizeAutoPlant({ on: 'x', mode: 'caos', crops: ['trigo', 'trigo', 'banana', 3], reserve: -5, humor: 9, buy: false });
    expect(fixed).toEqual({ ...defaultAutoPlant(), crops: ['trigo'], reserve: 0, buy: false });
  });
});
