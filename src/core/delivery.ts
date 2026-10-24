import { CROPS, CROP_ORDER, CropId } from './crops';
import { hashUnit } from './noise';

/**
 * The seed truck. A delivery happens on a fixed clock: slot k arrives at k * DELIVERY_INTERVAL_MS
 * (wall-clock aligned, so every device agrees without any state beyond "last slot delivered").
 * What is on the truck depends only on the farm's seed, the slot and the player's level.
 */
export const DELIVERY_INTERVAL_MS = 5 * 60 * 1000;
/** Seeds on every truck. */
export const DELIVERY_SEEDS = 6;
/** The first draws are always cheap staples, so a broke player can always start over. */
export const STAPLE_DRAWS = 2;
/** Away for longer than this many slots: the truck only left this many at the door. */
export const MAX_CATCHUP_SLOTS = 6;

export type SeedLoad = Record<CropId, number>;

export const slotOf = (now: number): number => Math.floor(now / DELIVERY_INTERVAL_MS);
export const slotTime = (slot: number): number => slot * DELIVERY_INTERVAL_MS;

const emptyLoad = (): SeedLoad => Object.fromEntries(CROP_ORDER.map((id) => [id, 0])) as SeedLoad;

function pick(options: CropId[], weights: number[], u: number): CropId {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = u * total;
  for (let n = 0; n < options.length; n++) {
    r -= weights[n]!;
    if (r < 0) return options[n]!;
  }
  return options[options.length - 1]!;
}

/** Deterministic contents of a delivery: staples first, then crops the player has unlocked (cheap ones more often). */
export function rollDelivery(seed: number, slot: number, level: number): SeedLoad {
  const load = emptyLoad();
  const unlocked = CROP_ORDER.filter((id) => CROPS[id].unlockLevel <= level);
  const staples = unlocked.filter((id) => CROPS[id].seedCost <= 15);
  const weights = unlocked.map((id) => 1 / Math.sqrt(CROPS[id].seedCost));
  for (let k = 0; k < DELIVERY_SEEDS; k++) {
    const u = hashUnit(seed, slot, 0xd311, k);
    const crop =
      k < STAPLE_DRAWS
        ? pick(staples, staples.map(() => 1), u)
        : pick(unlocked, weights, u);
    load[crop]++;
  }
  return load;
}
