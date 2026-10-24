import { describe, expect, it } from 'vitest';
import { Command, LoggedCommand, applyCommand } from '../src/core/commands';
import { CROPS } from '../src/core/crops';
import { Farm } from '../src/core/farm';
import {
  HELPERS,
  OFFLINE_LIMIT_MS,
  WAGE_PERIOD_MS,
  helperWage,
  pointAlong,
  route,
  routeLength,
  sprinklerSpots,
} from '../src/core/helpers';
import { levelThreshold } from '../src/core/levels';
import { decodeSave, encodeSave } from '../src/core/save';

const SEC = 1000;

function richFarm(seed = 5, pestChance = 0): Farm {
  const farm = new Farm({ seed, pestChance });
  farm.xp = levelThreshold(9);
  farm.coins = 50_000;
  farm.landSize = 6;
  return farm;
}

/** Plow, plant and water a crop at (i, j). */
function sow(farm: Farm, i: number, j: number, cropId: 'cenoura' | 'trigo' = 'cenoura', now = 0, water = true): void {
  farm.seeds[cropId] += 1;
  expect(farm.plow(i, j).ok).toBe(true);
  expect(farm.plant(i, j, cropId, now).ok).toBe(true);
  if (water) expect(farm.water(i, j, now).ok).toBe(true);
}

describe('hiring', () => {
  it('needs the level and the coins, once per helper', () => {
    const farm = new Farm({ seed: 1 });
    expect(farm.hireHelper('regador', 0)).toEqual({ ok: false, reason: 'helper-locked' });
    farm.xp = levelThreshold(HELPERS.regador.unlockLevel);
    farm.coins = HELPERS.regador.hireCost - 1;
    expect(farm.hireHelper('regador', 0)).toEqual({ ok: false, reason: 'no-coins' });
    farm.coins = HELPERS.regador.hireCost;
    expect(farm.hireHelper('regador', 0).ok).toBe(true);
    expect(farm.coins).toBe(0);
    expect(farm.hireHelper('regador', 0)).toEqual({ ok: false, reason: 'helper-exists' });
  });

  it('upgrades up to level 3', () => {
    const farm = richFarm();
    expect(farm.upgradeHelper('ajudante')).toEqual({ ok: false, reason: 'no-helper' });
    farm.hireHelper('ajudante', 0);
    expect(farm.upgradeHelper('ajudante').ok).toBe(true);
    expect(farm.upgradeHelper('ajudante').ok).toBe(true);
    expect(farm.helpers.ajudante!.level).toBe(3);
    expect(farm.upgradeHelper('ajudante')).toEqual({ ok: false, reason: 'max-level' });
  });
});

describe('sprinklers', () => {
  it('water thirsty crops near their heads and leave far ones alone', () => {
    const farm = richFarm();
    farm.hireHelper('regador', 0);
    const [head] = sprinklerSpots(6, 1);
    sow(farm, head!.i, head!.j, 'cenoura', 0, false);
    // A tile that no level-1 head covers.
    const covered = new Set<string>();
    for (const h of sprinklerSpots(6, 1)) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) covered.add(`${h.i + di},${h.j + dj}`);
    const far = [9, 10, 11, 12, 13, 14].flatMap((i) => [9, 10, 11, 12, 13, 14].map((j) => ({ i, j }))).find((t) => !covered.has(`${t.i},${t.j}`));
    expect(far).toBeDefined();
    sow(farm, far!.i, far!.j, 'cenoura', 0, false);

    farm.runHelpers(20 * SEC);
    expect(farm.tile(head!.i, head!.j).crop!.watered).toBe(true);
    expect(farm.tile(far!.i, far!.j).crop!.watered).toBe(false);
  });
});

describe('the farmhand', () => {
  it('walks to a ripe crop and harvests it', () => {
    const farm = richFarm();
    sow(farm, 10, 10, 'cenoura', 0);
    farm.hireHelper('ajudante', 0);
    const ripeAt = CROPS.cenoura.growthMs;
    farm.runHelpers(ripeAt - 1000);
    expect(farm.produce.cenoura).toBe(0);
    farm.runHelpers(ripeAt + 60 * SEC);
    expect(farm.produce.cenoura).toBe(1);
    expect(farm.tile(10, 10).crop).toBeNull();
    expect(farm.helperEvents.some((e) => e.kind === 'harvest' && e.i === 10 && e.j === 10)).toBe(true);
  });

  it('picks the nearest ripe crop first, deterministically', () => {
    const farm = richFarm();
    sow(farm, 14, 14);
    sow(farm, 10, 12);
    farm.hireHelper('ajudante', 0);
    farm.runHelpers(CROPS.cenoura.growthMs + 40 * SEC);
    const harvested = farm.helperEvents.filter((e) => e.kind === 'harvest').map((e) => `${e.i},${e.j}`);
    expect(harvested).toEqual(['10,12', '14,14']);
  });

  it('stops walking when the wage cannot be paid and resumes once paid', () => {
    const farm = richFarm();
    farm.hireHelper('ajudante', 0);
    farm.coins = 0;
    farm.runHelpers(WAGE_PERIOD_MS + 1);
    expect(farm.helpers.ajudante!.paid).toBe(false);
    expect(farm.helperEvents.some((e) => e.kind === 'unpaid')).toBe(true);

    sow(farm, 10, 10, 'cenoura', WAGE_PERIOD_MS);
    farm.coins = 1000;
    const t = WAGE_PERIOD_MS + CROPS.cenoura.growthMs + 30 * SEC;
    farm.runHelpers(t);
    expect(farm.produce.cenoura).toBe(0); // still unpaid: nothing moves
    expect(applyCommand(farm, { type: 'payHelper', helper: 'ajudante' }, t).ok).toBe(true);
    farm.runHelpers(t + 60 * SEC);
    expect(farm.produce.cenoura).toBe(1);
  });
});

describe('the cat', () => {
  it('chases pests away', () => {
    const farm = richFarm(3, 1); // every crop gets a pest
    sow(farm, 11, 11, 'trigo');
    farm.hireHelper('gato', 0);
    const tile = farm.tile(11, 11).crop!;
    const at = tile.pestAt! + 1000;
    expect(farm.status(11, 11, at)!.pest).not.toBeNull();
    farm.runHelpers(at + 60 * SEC);
    expect(farm.helperEvents.some((e) => e.kind === 'care')).toBe(true);
    expect(farm.status(11, 11, at + 60 * SEC)!.pest).toBeNull();
  });
});

describe('wages and time away', () => {
  it('charges a wage every period while the coins last', () => {
    const farm = richFarm();
    farm.hireHelper('ajudante', 0);
    const before = farm.coins;
    farm.runHelpers(WAGE_PERIOD_MS * 3 + 1);
    expect(before - farm.coins).toBe(helperWage('ajudante', 1) * 3);
  });

  it('does not work through more than the offline limit', () => {
    const farm = richFarm();
    farm.hireHelper('ajudante', 0);
    const before = farm.coins;
    farm.runHelpers(10 * 60 * 60 * 1000); // ten hours away
    const periods = Math.floor(OFFLINE_LIMIT_MS / WAGE_PERIOD_MS) + 1;
    expect(before - farm.coins).toBeLessThanOrEqual(helperWage('ajudante', 1) * periods);
    expect(farm.helpers.ajudante!.paid).toBe(true);
  });
});

describe('routes', () => {
  it('go through the gate when crossing the fence', () => {
    const outside = { u: 6, v: 9 };
    const inside = { u: 11, v: 11 };
    const path = route(outside, inside, 6);
    expect(path).toHaveLength(3);
    expect(routeLength(path)).toBeGreaterThan(routeLength([outside, inside]));
    expect(pointAlong(path, 0)).toEqual(outside);
    expect(pointAlong(path, 1000)).toEqual(inside);
    expect(route(inside, { u: 12, v: 12 }, 6)).toHaveLength(2);
  });
});

describe('determinism with helpers', () => {
  const script: Array<[Command, number]> = [
    [{ type: 'hireHelper', helper: 'regador' }, 0],
    [{ type: 'hireHelper', helper: 'ajudante' }, 500],
    [{ type: 'hireHelper', helper: 'gato' }, 800],
    [{ type: 'tool', tool: 'arar', i: 10, j: 10, crop: 'cenoura' }, 1000],
    [{ type: 'tool', tool: 'semear', i: 10, j: 10, crop: 'trigo' }, 2000],
    [{ type: 'tool', tool: 'arar', i: 12, j: 10, crop: 'cenoura' }, 3000],
    [{ type: 'tool', tool: 'semear', i: 12, j: 10, crop: 'cenoura' }, 4000],
    [{ type: 'upgradeHelper', helper: 'ajudante' }, 200_000],
    [{ type: 'sellAll' }, 400_000],
    [{ type: 'tool', tool: 'arar', i: 13, j: 13, crop: 'cenoura' }, 900_000],
  ];

  it('replay equals live play, even when the live client also ran the helpers every frame', () => {
    const start = richFarm(11, 0.5).toSnapshot();
    const live = Farm.fromSnapshot(start);
    const log: LoggedCommand[] = [];
    let clock = 0;
    for (const [command, now] of script) {
      // The browser advances helpers on every frame between commands.
      for (; clock < now; clock += 7_321) live.runHelpers(Math.min(clock, now));
      clock = now;
      if (applyCommand(live, command, now).ok) log.push({ command, now });
    }
    live.runHelpers(1_000_000);

    const server = Farm.fromSnapshot(start);
    for (const { command, now } of log) applyCommand(server, command, now);
    server.runHelpers(1_000_000);
    expect(server.toSnapshot()).toEqual(live.toSnapshot());
    expect(log.length).toBeGreaterThan(6);
  });

  it('survives a save round trip, and old saves without helpers still load', () => {
    const farm = richFarm();
    farm.hireHelper('gato', 0);
    const text = encodeSave({
      playerId: 'p',
      savedAt: 1,
      state: farm.toSnapshot(),
      sync: { baseline: farm.toSnapshot(), outbox: [] },
    });
    const decoded = decodeSave(text);
    expect(decoded.ok && decoded.save.state.helpers.gato?.level).toBe(1);

    const legacy = { ...farm.toSnapshot(), version: 3 } as Record<string, unknown>;
    delete legacy['helpers'];
    const old = Farm.fromSnapshot(legacy as never);
    expect(old.helpers).toEqual({});
  });
});
