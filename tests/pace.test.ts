import { describe, expect, it } from 'vitest';
import { claimableGoals, claimableSteps } from '../src/core/progress';
import { playCrops } from './support/pace-bot';

/** A casual player: checks the farm every two minutes and tends 60 percent of the plot. */
const CASUAL = { visitSec: 120, coverage: 0.6, maxHours: 24 };

/** Minutes the plan aims for, and how far the simulation may drift from them. */
const TARGETS: Record<number, number> = { 8: 45, 12: 120, 20: 480 };
const TOLERANCE = 0.25;

describe('pace', () => {
  const run = playCrops(CASUAL);

  it.each(Object.entries(TARGETS))('reaches level %s in about %s minutes', (level, minutes) => {
    const at = run.levelAt[Number(level)]!;
    expect(at).toBeGreaterThan(minutes * (1 - TOLERANCE));
    expect(at).toBeLessThan(minutes * (1 + TOLERANCE));
  });

  it('levels keep coming later and later', () => {
    const times = Object.entries(run.levelAt).map(([l, m]) => [Number(l), m] as const).sort((a, b) => a[0] - b[0]);
    for (let n = 1; n < times.length; n++) expect(times[n]![1]).toBeGreaterThanOrEqual(times[n - 1]![1]);
  });

  it('goal and medal rewards stay a small share of what selling brings in by level 12', () => {
    const early = playCrops({ ...CASUAL, stopLevel: 12 });
    const rewards =
      claimableGoals(early.farm).reduce((n, g) => n + g.reward, 0) +
      claimableSteps(early.farm).reduce((n, c) => n + c.achievement.rewards[c.step]!, 0);
    expect(rewards / early.farm.stats.coinsEarned).toBeLessThan(0.15);
  });
});
