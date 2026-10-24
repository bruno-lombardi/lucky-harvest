import { CROPS, CROP_ORDER, CropId, RARITIES } from './crops';
import { hashUnit } from './noise';

/**
 * The seed truck. A delivery happens on a fixed clock: slot k arrives at k * DELIVERY_INTERVAL_MS
 * (wall-clock aligned, so every device agrees without any state beyond "last slot delivered").
 * What is on the truck depends only on the farm's seed, the slot and the player's level.
 */
export const DELIVERY_INTERVAL_MS = 5 * 60 * 1000;
/** Seeds on every truck. */
export const DELIVERY_SEEDS = 6;

/** Two shop upgrades for the truck: a bigger load ("Entrega maior") and a shorter wait ("Entrega rápida"). */
export interface TruckUpgrades {
  big: boolean;
  fast: boolean;
}
export const TRUCK_UPGRADES = {
  big: { name: 'Entrega maior', cost: 4000, level: 10, seeds: 10, text: 'Cada entrega traz 10 sementes em vez de 6.' },
  fast: { name: 'Entrega rápida', cost: 15000, level: 20, intervalMs: 4 * 60 * 1000, text: 'O caminhão passa a cada 4 minutos em vez de 5.' },
} as const;
export type TruckUpgradeId = keyof typeof TRUCK_UPGRADES;
export const TRUCK_UPGRADE_ORDER: readonly TruckUpgradeId[] = ['big', 'fast'];

export const deliveryInterval = (t: TruckUpgrades): number => (t.fast ? TRUCK_UPGRADES.fast.intervalMs : DELIVERY_INTERVAL_MS);
export const deliverySeeds = (t: TruckUpgrades): number => (t.big ? TRUCK_UPGRADES.big.seeds : DELIVERY_SEEDS);
/** The first draws are always cheap staples, so a broke player can always start over. */
export const STAPLE_DRAWS = 2;
/** Away for longer than this many slots: the truck only left this many at the door. */
export const MAX_CATCHUP_SLOTS = 6;

export type SeedLoad = Record<CropId, number>;

export const slotOf = (now: number, interval = DELIVERY_INTERVAL_MS): number => Math.floor(now / interval);
export const slotTime = (slot: number, interval = DELIVERY_INTERVAL_MS): number => slot * interval;

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

/** Deterministic contents of a delivery: staples first, then crops the player has unlocked (by rarity: rare seeds are a treat). */
export function rollDelivery(seed: number, slot: number, level: number, count = DELIVERY_SEEDS): SeedLoad {
  const load = emptyLoad();
  const unlocked = CROP_ORDER.filter((id) => CROPS[id].unlockLevel <= level);
  const staples = unlocked.filter((id) => CROPS[id].seedCost <= 15);
  const weights = unlocked.map((id) => RARITIES[CROPS[id].rarity].truckWeight);
  for (let k = 0; k < count; k++) {
    const u = hashUnit(seed, slot, 0xd311, k);
    const crop =
      k < STAPLE_DRAWS
        ? pick(staples, staples.map(() => 1), u)
        : pick(unlocked, weights, u);
    load[crop]++;
  }
  return load;
}
