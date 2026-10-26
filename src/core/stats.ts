/**
 * @module core/stats
 *
 * Lifetime counters. `Farm` bumps them inside the same methods that change state, so replaying commands reproduces them exactly.
 * Goals and achievements (`progress.ts`) are pure functions of these counters and the farm. To track something new, add a field to
 * `Stats`, `emptyStats`, `cloneStats` and `normalizeStats` (saves from before it existed must load as zero).
 */

import { CROP_ORDER, CropId } from './crops';
import { PRODUCT_ORDER, ProductId } from './animals';
import { GOOD_ORDER, GoodId } from './goods';
import { TREE_ORDER, TreeId } from './trees';

/** Lifetime counters. The farm bumps them inside the actions that change state, so replaying commands reproduces them. */
export interface Stats {
  plowed: number;
  planted: number;
  watered: number;
  cared: number;
  seedsBought: number;
  /** Number of sales (a sale-all counts once). */
  sales: number;
  /** Coins taken in from sales only (rewards do not count). */
  coinsEarned: number;
  /** The most coins a single sale brought in. */
  bestSale: number;
  harvested: Record<CropId, number>;
  /** Rare and epic crops picked, a golden one counting twice. */
  rareHarvested: number;
  collected: Record<ProductId, number>;
  fed: number;
  milled: number;
  /** Wages paid on time or after a stop. */
  wagesPaid: number;
  /** Helper levels bought. */
  helperUpgrades: number;
  /** Crops the farmhand harvested. */
  farmhandHarvests: number;
  /** Seeds the level-4 Tonico sowed. */
  farmhandPlants: number;
  /** Goods Dona Zefa baked and the player collected. */
  baked: number;
  /** Goods baked by recipe, and cakes in particular. */
  bakedBy: Record<GoodId, number>;
  bakedCakes: number;
  /** Pests the cat took care of. */
  catCares: number;
  deliveries: number;
  seedsReceived: number;
  /** Rare or epic seeds that came on the truck. */
  rareSeedsReceived: number;
  /** Seeds planted with an empty purse. */
  rescues: number;
  treesPlanted: number;
  /** Fruit picked by species, a golden harvest counting double. */
  fruitPicked: Record<TreeId, number>;
  goldenFruit: number;
  /** Fertilizers applied to crops. */
  fertilized: number;
}

export function emptyStats(): Stats {
  return {
    plowed: 0,
    planted: 0,
    watered: 0,
    cared: 0,
    seedsBought: 0,
    sales: 0,
    coinsEarned: 0,
    bestSale: 0,
    harvested: Object.fromEntries(CROP_ORDER.map((id) => [id, 0])) as Record<CropId, number>,
    rareHarvested: 0,
    collected: Object.fromEntries(PRODUCT_ORDER.map((id) => [id, 0])) as Record<ProductId, number>,
    fed: 0,
    milled: 0,
    wagesPaid: 0,
    helperUpgrades: 0,
    farmhandHarvests: 0,
    farmhandPlants: 0,
    baked: 0,
    bakedBy: Object.fromEntries(GOOD_ORDER.map((id) => [id, 0])) as Record<GoodId, number>,
    bakedCakes: 0,
    catCares: 0,
    deliveries: 0,
    seedsReceived: 0,
    rareSeedsReceived: 0,
    rescues: 0,
    treesPlanted: 0,
    fruitPicked: Object.fromEntries(TREE_ORDER.map((id) => [id, 0])) as Record<TreeId, number>,
    goldenFruit: 0,
    fertilized: 0,
  };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Rebuilds stats from anything found in a save: unknown keys are dropped, missing or bad ones become zero. */
export function normalizeStats(raw: unknown): Stats {
  const out = emptyStats();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(out) as Array<keyof Stats>) {
    if (key === 'harvested' || key === 'collected' || key === 'fruitPicked' || key === 'bakedBy') continue;
    (out[key] as number) = num(r[key]);
  }
  const harvested = (r['harvested'] ?? {}) as Record<string, unknown>;
  for (const id of CROP_ORDER) out.harvested[id] = num(harvested[id]);
  const picked = (r['fruitPicked'] ?? {}) as Record<string, unknown>;
  for (const id of TREE_ORDER) out.fruitPicked[id] = num(picked[id]);
  const bakedBy = (r['bakedBy'] ?? {}) as Record<string, unknown>;
  for (const id of GOOD_ORDER) out.bakedBy[id] = num(bakedBy[id]);
  const collected = (r['collected'] ?? {}) as Record<string, unknown>;
  for (const id of PRODUCT_ORDER) out.collected[id] = num(collected[id]);
  return out;
}

export const cloneStats = (s: Stats): Stats => normalizeStats(s);

export const totalHarvested = (s: Stats): number => Object.values(s.harvested).reduce((a, b) => a + b, 0);
export const totalCollected = (s: Stats): number => Object.values(s.collected).reduce((a, b) => a + b, 0);
export const totalFruit = (s: Stats): number => Object.values(s.fruitPicked).reduce((a, b) => a + b, 0);
