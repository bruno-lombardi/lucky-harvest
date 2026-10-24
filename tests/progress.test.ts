import { describe, expect, it } from 'vitest';
import { LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { Farm } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { ACHIEVEMENTS, GOALS, achievementKey, claimableCount, claimableGoals, currentGoal, goalKey } from '../src/core/progress';
import { decodeSave, encodeSave } from '../src/core/save';

const SEC = 1000;
const MIN = 60 * SEC;

describe('tables', () => {
  it('have unique ids, ordered chapters and positive thresholds and rewards', () => {
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(GOALS.length);
    expect(GOALS.map((g) => g.id)).toEqual(GOALS.map((_, n) => n + 1));
    for (let n = 1; n < GOALS.length; n++) expect(GOALS[n]!.chapter).toBeGreaterThanOrEqual(GOALS[n - 1]!.chapter);
    for (const g of GOALS) {
      expect(g.target).toBeGreaterThan(0);
      expect(g.reward).toBeGreaterThan(0);
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.steps.length).toBe(a.rewards.length);
      a.steps.forEach((t, n) => {
        expect(t).toBeGreaterThan(0);
        expect(a.rewards[n]).toBeGreaterThan(0);
        if (n > 0) expect(t).toBeGreaterThan(a.steps[n - 1]!);
        if (n > 0) expect(a.rewards[n]).toBeGreaterThanOrEqual(a.rewards[n - 1]!);
      });
    }
  });

  it('give nothing on a brand new farm', () => {
    const farm = new Farm({ seed: 3 });
    expect(claimableCount(farm)).toBe(0);
    expect(currentGoal(farm)!.id).toBe(1);
  });
});

describe('claiming', () => {
  const log: LoggedCommand[] = [];
  const play = (farm: Farm, command: Parameters<typeof applyCommand>[1], now: number): boolean => {
    const r = applyCommand(farm, command, now);
    if (r.ok) log.push({ command, now });
    return r.ok;
  };

  it('walks the tutorial goals through real commands and replays identically', () => {
    const base = new Farm({ seed: 11, now: 0 });
    const farm = Farm.fromSnapshot(base.toSnapshot());
    log.length = 0;
    let now = 1000;
    for (const [i, j] of [[10, 10], [10, 11], [10, 12]] as const) expect(play(farm, { type: 'tool', tool: 'arar', i, j, crop: 'cenoura' }, now)).toBe(true);
    expect(play(farm, { type: 'tool', tool: 'semear', i: 10, j: 10, crop: 'cenoura' }, now)).toBe(true);
    expect(play(farm, { type: 'tool', tool: 'regar', i: 10, j: 10, crop: 'cenoura' }, now)).toBe(true);
    now += 2 * MIN;
    expect(play(farm, { type: 'tool', tool: 'colher', i: 10, j: 10, crop: 'cenoura' }, now)).toBe(true);
    expect(play(farm, { type: 'sellAll' }, now)).toBe(true);
    expect(play(farm, { type: 'buySeeds', crop: 'cenoura', qty: 1 }, now)).toBe(true);

    // Goals 1-6 are done; claiming pays once, in any order.
    expect(claimableGoals(farm).map((g) => g.id)).toEqual([1, 2, 3, 4, 5, 6]);
    const before = farm.coins;
    expect(play(farm, { type: 'claimGoal', goal: 6 }, now)).toBe(true);
    expect(farm.coins).toBe(before + GOALS[5]!.reward);
    expect(play(farm, { type: 'claimGoal', goal: 6 }, now)).toBe(false);
    expect(play(farm, { type: 'claimGoal', goal: 11 }, now)).toBe(false);
    expect(play(farm, { type: 'claimGoal', goal: 99 }, now)).toBe(false);
    expect(currentGoal(farm)!.id).toBe(1);
    for (const id of [1, 2, 3, 4, 5]) expect(play(farm, { type: 'claimGoal', goal: id }, now)).toBe(true);
    expect(currentGoal(farm)!.id).toBe(7);

    const again = Farm.fromSnapshot(base.toSnapshot());
    replay(again, log);
    expect(again.toSnapshot()).toEqual(farm.toSnapshot());
  });

  it('pays achievement steps once each, in tiers', () => {
    const farm = new Farm({ seed: 12, now: 0 });
    farm.stats.plowed = 150;
    const a = ACHIEVEMENTS.find((x) => x.id === 'arado')!;
    expect(claimableCount(farm)).toBeGreaterThanOrEqual(1);
    expect(applyCommand(farm, { type: 'claimAchievement', achievement: 'arado', step: 1 }, 0).ok).toBe(false);
    const coins = farm.coins;
    expect(applyCommand(farm, { type: 'claimAchievement', achievement: 'arado', step: 0 }, 0).ok).toBe(true);
    expect(farm.coins).toBe(coins + a.rewards[0]!);
    expect(applyCommand(farm, { type: 'claimAchievement', achievement: 'arado', step: 0 }, 0).ok).toBe(false);
    expect(farm.claimed).toContain(achievementKey('arado', 0));
  });

  it('lets level and plot goals complete at once on an existing farm', () => {
    const farm = new Farm({ seed: 13 });
    farm.xp = levelThreshold(10);
    farm.landSize = 10;
    expect(claimableGoals(farm).map((g) => g.id)).toEqual(expect.arrayContaining([7, 11, 21]));
  });

  it('claims survive a save round trip', () => {
    const farm = new Farm({ seed: 14, now: 0 });
    farm.stats.plowed = 3;
    applyCommand(farm, { type: 'claimGoal', goal: 1 }, 0);
    const snap = farm.toSnapshot();
    expect(snap.version).toBe(7);
    expect(snap.claimed).toContain(goalKey(1));
    const text = encodeSave({ playerId: 'p', savedAt: 1, state: snap, sync: { baseline: snap, outbox: [] } });
    const out = decodeSave(text);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.save.state).toEqual(snap);
  });
});

describe('no dead end', () => {
  it('a farm with no coins and no seeds is restarted by the truck', () => {
    const farm = new Farm({ seed: 21, now: 0 });
    farm.coins = 0;
    for (const k of Object.keys(farm.seeds)) farm.seeds[k as keyof typeof farm.seeds] = 0;
    let now = 5 * MIN;
    farm.runHelpers(now);
    expect(farm.seeds.cenoura + farm.seeds.trigo).toBeGreaterThan(0);
    // Plant carrots on the first tiles, wait, harvest and sell.
    let planted = 0;
    for (let j = 10; j < 14 && farm.seeds.cenoura > 0; j++) {
      expect(applyCommand(farm, { type: 'tool', tool: 'arar', i: 10, j, crop: 'cenoura' }, now).ok).toBe(true);
      if (applyCommand(farm, { type: 'tool', tool: 'semear', i: 10, j, crop: 'cenoura' }, now).ok) planted++;
      applyCommand(farm, { type: 'tool', tool: 'regar', i: 10, j, crop: 'cenoura' }, now);
    }
    expect(planted).toBeGreaterThan(0);
    now += 2 * MIN;
    for (let j = 10; j < 14; j++) applyCommand(farm, { type: 'tool', tool: 'colher', i: 10, j, crop: 'cenoura' }, now);
    applyCommand(farm, { type: 'sellAll' }, now);
    expect(farm.coins).toBeGreaterThan(0);
  });
});

describe('orchard goals', () => {
  it('follow the first book, and the title stays with goal 24', async () => {
    const { BOOK_TITLE_GOAL } = await import('../src/core/progress');
    expect(GOALS.length).toBeGreaterThan(BOOK_TITLE_GOAL);
    expect(GOALS.slice(BOOK_TITLE_GOAL).every((g) => g.chapter === 5)).toBe(true);
    const farm = new Farm({ seed: 2 });
    expect(GOALS[24]!.value(farm)).toBe(0);
    expect(ACHIEVEMENTS.some((a) => a.category === 'Pomar')).toBe(true);
  });
});
