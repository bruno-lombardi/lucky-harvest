/**
 * @module core/levels
 *
 * The XP curve (`25 * (level - 1) * level`, level cap 50). Most unlock levels in the other tables are read against it, so changing
 * the curve shifts the pacing of the whole game; check `tests/pace.test.ts`.
 */

export const MAX_LEVEL = 50;

/** Total XP needed to reach `level`. Level 1 = 0, 2 = 50, 3 = 150, 4 = 300... */
export function levelThreshold(level: number): number {
  return 25 * (level - 1) * level;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= levelThreshold(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  readonly level: number;
  /** XP earned within the current level. */
  readonly current: number;
  /** XP span of the current level (0 at max level). */
  readonly needed: number;
  /** 0..1 fill for an XP bar. */
  readonly fraction: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, current: 0, needed: 0, fraction: 1 };
  const base = levelThreshold(level);
  const needed = levelThreshold(level + 1) - base;
  const current = xp - base;
  return { level, current, needed, fraction: Math.min(1, current / needed) };
}
