/**
 * @module core/farm
 *
 * The `Farm` class: the whole game state and every rule that changes it. If a rule exists, it is a method here.
 *
 * Reading guide (search for the section comments):
 *   - Types and constants       snapshot shape, FailReason, land steps (top of file)
 *   - Crops and tiles           plow / plant / water / care / harvest / clear, `status()` growth maths
 *   - Orchard                   fruit trees (Pomar)
 *   - Shop                      buying seeds, selling crops, products, fruit and goods
 *   - The Confeitaria           bakery jobs, ingredients, collecting
 *   - Pens and animals, Feed    the animal loop and feed milling, and land expansion
 *   - Helpers                   hiring, wages, `runHelpers`, the walkers' state machine, sprinklers, the seed truck
 *   - Truck, barn, decorations  upgrades bought in the shop, goal and achievement claims
 *   - Persistence               `toSnapshot` / `fromSnapshot`
 *
 * Ground rules (see docs/Core-Rules-Engine.md):
 *   1. Time is a parameter (`now`), never read from a clock. No `Math.random`; use `hashUnit(seed, revision, ...)`.
 *   2. A player action returns `ActionResult` (`fail(reason)` or `done(...)`) and changes nothing on failure.
 *   3. Every successful change goes through `done()` (or bumps `revision` itself): `revision` feeds the random stream.
 *   4. Never put view data here. The renderer's queues (`helperEvents`, `deliveryEvents`) are the one exception and are not saved.
 *
 * NEXT(backend): this is the class a server will run. It is large (about 1,400 lines); before the server work, split it by area
 *   (crops, pens, helpers, bakery, orchard) behind this same facade so the pieces can be tested and owned separately.
 * NEXT(multiplayer): everything here is about ONE player. Cross-farm effects (gifts, helping a neighbor, stealing) must not be
 *   added as methods that touch two farms; see docs/Roadmap-Backend-Multiplayer-Social.md ("Cross-farm operations").
 */

import {
  AnimalState,
  PRODUCTS,
  PRODUCT_ORDER,
  PenState,
  ProductId,
  SPECIES,
  SPECIES_ORDER,
  SpeciesId,
  animalStatus,
  nextPenUpgrade,
  penCapacity,
  penCycleMs,
} from './animals';
import { CROP_ORDER, CropId, RARITIES, getCrop } from './crops';
import { MAX_BARN_LEVEL, barnTier, nextBarnTier } from './barn';
import { AutoPlant, cloneAutoPlant, defaultAutoPlant, normalizeAutoPlant, plantOrder, sayLine } from './autoplant';
import {
  BAKERY_COST,
  BAKERY_UNLOCK_LEVEL,
  BakeryState,
  GOODS,
  GOOD_ORDER,
  GoodId,
  GoodStock,
  Ingredient,
  MAX_BATCHES,
  bakeMs,
  bakeryTier,
  emptyGoods,
  nextBakeryTier,
  normalizeBakery,
} from './goods';
import { Stats, cloneStats, emptyStats, normalizeStats } from './stats';
import { DECOR, DECOR_ORDER, DECOR_UNLOCK_LEVEL, DecorId, Decorations } from './decor';
import {
  MAX_CATCHUP_SLOTS,
  SeedLoad,
  TRUCK_UPGRADES,
  TruckUpgradeId,
  TruckUpgrades,
  deliveryInterval,
  deliverySeeds,
  rollDelivery,
  slotOf,
  slotTime,
} from './delivery';
import {
  HELPERS,
  HELPER_ORDER,
  HOME,
  HelperId,
  HelperState,
  OFFLINE_LIMIT_MS,
  PEN_SPOTS,
  PLANTER_LEVEL,
  POLL_MS,
  SPRINKLER_INTERVAL_MS,
  Spot,
  WalkerId,
  WAGE_PERIOD_MS,
  helperWage,
  nextHelperUpgrade,
  route,
  routeLength,
  sprinklerSpots,
  walkerPose,
  walkerStats,
} from './helpers';
import { inBounds, tileKey } from './grid';
import { POMAR, TREE_ORDER, TREE_PEST_CHANCE, TREES, TreeId, TreeState, TreeStatus, isOrchardTile, treeGrowth, treeStatus } from './trees';
import { levelFromXp } from './levels';
import { hashUnit } from './noise';

export const START_COINS = 100;
export const START_SEEDS: Readonly<Partial<Record<CropId, number>>> = { cenoura: 6, trigo: 3 };

/** The island's centre sits between tiles 11 and 12, so every plot size is centred on it. */
export interface LandBounds {
  min: number;
  max: number;
}

export function landBounds(size: number): LandBounds {
  return { min: 12 - size / 2, max: 11 + size / 2 };
}

/** Plot sizes (tiles per side) the farm can grow through, with what each expansion asks for. */
export const LAND_STEPS: ReadonlyArray<{ size: number; cost: number; level: number }> = [
  { size: 6, cost: 0, level: 1 },
  { size: 8, cost: 400, level: 3 },
  { size: 10, cost: 1800, level: 6 },
  { size: 12, cost: 12000, level: 12 },
];

export const START_LAND = LAND_STEPS[0]!.size;
export const MAX_LAND = LAND_STEPS[LAND_STEPS.length - 1]!.size;
/** The biggest plot: handy for tests and demos. */
export const LAND = landBounds(MAX_LAND);

export function isUnlockedFor(size: number, i: number, j: number): boolean {
  const { min, max } = landBounds(size);
  return i >= min && i <= max && j >= min && j <= max;
}

/** Chance that a freshly planted crop attracts weeds or bugs at some point while growing. */
export const PEST_CHANCE = 0.45;

export type PestKind = 'weed' | 'bug';
export type TileKind = 'grass' | 'soil';

export interface CropState {
  cropId: CropId;
  plantedAt: number;
  watered: boolean;
  /**
   * Growth is stored as an anchor: at `anchorAt` the crop had `anchorGrowth` ms of growth.
   * Watering and pest removal re-anchor it, which keeps stalls (thirst, pests) exact and replayable.
   */
  anchorAt: number;
  anchorGrowth: number;
  /** When a pest shows up (growth stops from then until it is removed). Null once cleared or never. */
  pestAt: number | null;
  pestKind: PestKind | null;
}

export interface TileState {
  kind: TileKind;
  crop: CropState | null;
}

export type CropStage = 0 | 1 | 2 | 3; // seed, sprout, growing, ripe

export interface CropStatus {
  cropId: CropId;
  /** 0..1 growth. Stalls at 0.5 while thirsty. */
  progress: number;
  stage: CropStage;
  thirsty: boolean;
  ripe: boolean;
  withered: boolean;
  /** Active infestation, which stops growth until removed with the care tool. */
  pest: PestKind | null;
  /** Time until ripe once watered. Null if thirsty, withered, or already ripe. */
  msToRipe: number | null;
}

export type FailReason =
  | 'locked-land'
  | 'not-grass'
  | 'not-soil'
  | 'occupied'
  | 'no-crop'
  | 'crop-locked'
  | 'no-coins'
  | 'already-watered'
  | 'not-ripe'
  | 'withered'
  | 'nothing-to-clear'
  | 'no-seeds'
  | 'no-pest'
  | 'level-too-low'
  | 'max-land'
  | 'nothing-to-sell'
  | 'pen-locked'
  | 'truck-locked'
  | 'already-claimed'
  | 'not-done'
  | 'decor-locked'
  | 'pomar-locked'
  | 'barn-locked'
  | 'not-orchard'
  | 'no-tree'
  | 'tree-locked'
  | 'no-sapling'
  | 'bakery-locked'
  | 'bakery-exists'
  | 'no-bakery'
  | 'recipe-locked'
  | 'no-slot'
  | 'bad-qty'
  | 'pen-exists'
  | 'no-pen'
  | 'pen-full'
  | 'no-animal'
  | 'no-feed'
  | 'already-fed'
  | 'product-waiting'
  | 'not-ready'
  | 'max-level'
  | 'no-ingredients'
  | 'helper-locked'
  | 'helper-exists'
  | 'no-helper'
  | 'already-paid';

export interface Gain {
  coins: number;
  xp: number;
  /** The new level if this action levelled the player up. */
  levelUp: number | null;
  /** Produce added to the barn (harvest). */
  item?: { cropId: CropId; qty: number; golden?: boolean };
  /** Animal product added to the barn (collect). */
  product?: { productId: ProductId; qty: number };
  /** Fruit added to the barn (tree harvest). */
  fruit?: { tree: TreeId; qty: number; golden?: boolean };
}

export type Stock = Record<CropId, number>;
export type ProductStock = Record<ProductId, number>;
export type FruitStock = Record<TreeId, number>;
export type FeedStock = Record<SpeciesId, number>;
export type Pens = Partial<Record<SpeciesId, PenState>>;
export type Helpers = Partial<Record<HelperId, HelperState>>;

/** Something a helper did, for the renderer to show (not saved, not part of the rules). */
/** A seed truck that just pulled up, for toasts and sounds. */
export interface DeliveryEvent {
  at: number;
  slot: number;
  seeds: SeedLoad;
}

export interface HelperEvent {
  helper: HelperId;
  kind: 'harvest' | 'water' | 'care' | 'collect' | 'feed' | 'wage' | 'unpaid' | 'plant' | 'say';
  at: number;
  i?: number;
  j?: number;
  crop?: CropId;
  /** Tiles watered by a sprinkler pulse, or products collected by the dog. */
  count?: number;
  species?: SpeciesId;
  amount?: number;
  /** What a talkative helper says. */
  text?: string;
}

const emptyStock = (): Stock => Object.fromEntries(CROP_ORDER.map((id) => [id, 0])) as Stock;
const emptyProducts = (): ProductStock => Object.fromEntries(PRODUCT_ORDER.map((id) => [id, 0])) as ProductStock;
const emptyFruit = (): FruitStock => Object.fromEntries(TREE_ORDER.map((id) => [id, 0])) as FruitStock;
const emptyFeed = (): FeedStock => Object.fromEntries(SPECIES_ORDER.map((id) => [id, 0])) as FeedStock;
const clonePens = (pens: Pens): Pens => {
  const out: Pens = {};
  for (const id of SPECIES_ORDER) {
    const pen = pens[id];
    if (pen) out[id] = { level: pen.level, animals: pen.animals.map((a) => ({ ...a })) };
  }
  return out;
};

const cloneHelpers = (helpers: Helpers): Helpers => {
  const out: Helpers = {};
  for (const id of HELPER_ORDER) {
    const h = helpers[id];
    if (h) out[id] = { ...h, from: { ...h.from }, target: { ...h.target } };
  }
  return out;
};

export type ActionResult = { ok: true; gain: Gain } | { ok: false; reason: FailReason };

export interface FarmSnapshot {
  version: 8;
  /** Per-player constant that seeds every random outcome (pests). */
  seed: number;
  /** Counts successful mutations; part of the random stream and handy for sync ordering. */
  revision: number;
  /** Next id handed to a bought animal. */
  nextAnimalId: number;
  coins: number;
  xp: number;
  landSize: number;
  seeds: Stock;
  produce: Stock;
  products: ProductStock;
  feed: FeedStock;
  pens: Pens;
  helpers: Helpers;
  /** Last seed-truck slot that has been delivered (see delivery.ts). */
  deliveredSlot: number;
  truck: TruckUpgrades;
  decor: Decorations;
  stats: Stats;
  /** Ids of goals and achievement steps whose reward was taken (see progress.ts). */
  claimed: string[];
  /** Barn tier, 1..MAX_BARN_LEVEL (see barn.ts). */
  barn: number;
  /** The Pomar (orchard) has been bought. */
  pomar: boolean;
  saplings: FruitStock;
  fruit: FruitStock;
  /** Orchard trees by tile key. */
  trees: Record<string, TreeState>;
  /** The Confeitaria (null until bought) and the goods in the barn. Saves from before it leave both out. */
  bakery?: BakeryState | null;
  goods?: GoodStock;
  /** Tonico's planting settings. Saves from before this existed leave it out and get the defaults. */
  autoPlant?: AutoPlant;
  tiles: Record<string, TileState>;
}

/** Saves from before helpers (v3) and before the seed truck (v4). */
export type LegacySnapshot =
  | (Omit<FarmSnapshot, 'version' | 'helpers' | 'deliveredSlot' | 'truck' | 'decor' | 'stats' | 'claimed' | OrchardKeys> & { version: 3 })
  | (Omit<FarmSnapshot, 'version' | 'deliveredSlot' | 'truck' | 'decor' | 'stats' | 'claimed' | OrchardKeys> & { version: 4 })
  | (Omit<FarmSnapshot, 'version' | 'truck' | 'decor' | 'stats' | 'claimed' | OrchardKeys> & { version: 5 })
  | (Omit<FarmSnapshot, 'version' | OrchardKeys> & { version: 6 })
  | (Omit<FarmSnapshot, 'version' | 'barn'> & { version: 7 });

type OrchardKeys = 'pomar' | 'saplings' | 'fruit' | 'trees' | 'barn';

export interface FarmOptions {
  seed?: number;
  /** Wall-clock ms of a brand new game: the first seed truck comes one slot later. */
  now?: number;
  /** Probability that a crop gets a pest. Only tests change it. */
  pestChance?: number;
}

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });

/**
 * All farming rules. Time is always passed in (`now`, ms), never read from a clock,
 * so growth is deterministic, testable, and can be replayed after being offline.
 */
export class Farm {
  coins = START_COINS;
  xp = 0;
  landSize = START_LAND;
  seeds: Stock = { ...emptyStock(), ...START_SEEDS };
  produce: Stock = emptyStock();
  products: ProductStock = emptyProducts();
  feed: FeedStock = emptyFeed();
  pens: Pens = {};
  helpers: Helpers = {};
  /** Recent helper actions for the renderer. Never saved and never read by the rules. */
  helperEvents: HelperEvent[] = [];
  /** Recent seed deliveries for the renderer. Never saved and never read by the rules. */
  deliveryEvents: DeliveryEvent[] = [];
  deliveredSlot = 0;
  truck: TruckUpgrades = { big: false, fast: false };
  decor: Decorations = {};
  stats: Stats = emptyStats();
  claimed: string[] = [];
  barn = 1;
  bakery: BakeryState | null = null;
  goods: GoodStock = emptyGoods();
  /** How the level-4 Tonico plants (see autoplant.ts). */
  autoPlant: AutoPlant = defaultAutoPlant();
  pomar = false;
  saplings: FruitStock = emptyFruit();
  fruit: FruitStock = emptyFruit();
  private readonly trees = new Map<string, TreeState>();
  seed: number;
  revision = 0;
  nextAnimalId = 1;
  private readonly pestChance: number;
  private readonly treePestChance: number;
  private readonly tiles = new Map<string, TileState>();

  /** Every random outcome comes from `seed`, so a server can replay the same commands to the same result. */
  constructor(options: FarmOptions = {}) {
    // The only Math.random in the rules, and it runs once per new farm. The seed then lives in the snapshot and drives every pest and
    // golden-harvest roll.
    // NEXT(backend): a server must assign the seed at account creation and ignore a client-supplied one; a client that picks its own
    //   seed could pre-compute which plantings get pests. Keep this path for offline/new-game only.
    this.seed = (options.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.pestChance = options.pestChance ?? PEST_CHANCE;
    this.treePestChance = options.pestChance ?? TREE_PEST_CHANCE;
    if (options.now !== undefined) this.deliveredSlot = slotOf(options.now);
  }

  get level(): number {
    return levelFromXp(this.xp);
  }

  isUnlocked(i: number, j: number): boolean {
    return isUnlockedFor(this.landSize, i, j);
  }

  // ---- Crops and tiles ----------------------------------------------------

  /** The state of a tile (untouched tiles are plain grass). */
  tile(i: number, j: number): TileState {
    return this.tiles.get(tileKey(i, j)) ?? { kind: 'grass', crop: null };
  }

  /** Every tile that differs from plain grass. */
  *entries(): IterableIterator<{ i: number; j: number; tile: TileState }> {
    for (const [key, tile] of this.tiles) {
      const [i, j] = key.split(',').map(Number) as [number, number];
      yield { i, j, tile };
    }
  }

  /** Growth bookkeeping shared by status() and the actions that re-anchor a crop. */
  private growth(crop: CropState, now: number) {
    const def = getCrop(crop.cropId);
    const half = def.growthMs / 2;
    const cap = crop.watered ? def.growthMs : half;
    const pestActive = crop.pestAt !== null && now >= crop.pestAt;
    // Growth runs until now, or until the moment a pest froze it.
    const growEnd = pestActive ? Math.max(crop.anchorAt, crop.pestAt!) : now;
    const g = Math.min(cap, crop.anchorGrowth + Math.max(0, growEnd - crop.anchorAt));
    return { def, cap, g, pestActive, growEnd, reachedCap: g >= cap, capAt: crop.anchorAt + (cap - crop.anchorGrowth) };
  }

  status(i: number, j: number, now: number): CropStatus | null {
    const crop = this.tile(i, j).crop;
    if (!crop) return null;
    const { def, g, pestActive, growEnd, reachedCap, capAt } = this.growth(crop, now);

    let withered = false;
    if (reachedCap) withered = now > capAt + def.witherMs;
    else if (pestActive) withered = now > growEnd + def.witherMs;

    const thirsty = !crop.watered && reachedCap && !withered;
    const progress = Math.min(1, g / def.growthMs);
    const ripe = !withered && crop.watered && progress >= 1;
    const stage: CropStage = ripe ? 3 : progress < 0.15 ? 0 : progress < 0.45 ? 1 : 2;
    const msToRipe =
      crop.watered && !withered && !pestActive && progress < 1
        ? crop.anchorAt + (def.growthMs - crop.anchorGrowth) - now
        : null;
    return {
      cropId: crop.cropId,
      progress,
      stage,
      thirsty,
      ripe,
      withered,
      pest: pestActive && !withered ? crop.pestKind : null,
      msToRipe,
    };
  }

  /** Hoe: grass -> soil. */
  plow(i: number, j: number): ActionResult {
    if (!inBounds(i, j) || !this.isUnlocked(i, j)) return fail('locked-land');
    if (this.tile(i, j).kind !== 'grass') return fail('not-grass');
    this.tiles.set(tileKey(i, j), { kind: 'soil', crop: null });
    this.stats.plowed++;
    return this.done(0, 1);
  }

  /** Plant a seed from the inventory in empty soil. */
  plant(i: number, j: number, cropId: CropId, now: number): ActionResult {
    if (!inBounds(i, j) || !this.isUnlocked(i, j)) return fail('locked-land');
    const tile = this.tile(i, j);
    if (tile.kind !== 'soil') return fail('not-soil');
    if (tile.crop) return fail('occupied');
    const def = getCrop(cropId);
    if (this.level < def.unlockLevel) return fail('crop-locked');
    if (this.seeds[cropId] < 1) return fail('no-seeds');

    this.seeds[cropId] -= 1;
    this.stats.planted++;
    if (this.coins === 0) this.stats.rescues++;
    const roll = (salt: number): number => hashUnit(this.seed, this.revision, i, j, salt);
    const infested = roll(1) < this.pestChance;
    tile.crop = {
      cropId,
      plantedAt: now,
      watered: false,
      anchorAt: now,
      anchorGrowth: 0,
      pestAt: infested ? now + def.growthMs * (0.2 + 0.5 * roll(2)) : null,
      pestKind: infested ? (roll(3) < 0.5 ? 'weed' : 'bug') : null,
    };
    this.tiles.set(tileKey(i, j), tile);
    return this.done(0, 0);
  }

  /** Watering can: lets a crop grow past the halfway point. */
  water(i: number, j: number, now: number): ActionResult {
    const crop = this.tile(i, j).crop;
    if (!crop) return fail('no-crop');
    if (this.status(i, j, now)?.withered) return fail('withered');
    if (crop.watered) return fail('already-watered');
    this.reanchor(crop, now);
    crop.watered = true;
    this.stats.watered++;
    return this.done(0, 1);
  }

  /** Hand tool: pulls the weeds or shoos the bugs so the crop can grow again. */
  care(i: number, j: number, now: number): ActionResult {
    const crop = this.tile(i, j).crop;
    if (!crop) return fail('no-crop');
    const status = this.status(i, j, now);
    if (status?.withered) return fail('withered');
    if (!status?.pest) return fail('no-pest');
    this.reanchor(crop, now);
    crop.pestAt = null;
    crop.pestKind = null;
    this.stats.cared++;
    return this.done(0, 2);
  }

  /** Pick a ripe crop: it goes to the barn (sell it in the shop) and pays XP. */
  harvest(i: number, j: number, now: number): ActionResult {
    const crop = this.tile(i, j).crop;
    if (!crop) return fail('no-crop');
    const status = this.status(i, j, now);
    if (status?.withered) return fail('withered');
    if (!status?.ripe) return fail('not-ripe');
    const def = getCrop(crop.cropId);
    this.tile(i, j).crop = null;
    // Rare and epic crops sometimes ripen golden and give two.
    const golden = hashUnit(this.seed, this.revision, 0x601d, i, j) < RARITIES[def.rarity].goldenChance;
    const qty = golden ? 2 : 1;
    this.produce[crop.cropId] += qty;
    this.stats.harvested[crop.cropId] += qty;
    if (def.rarity === 'rara' || def.rarity === 'epica') this.stats.rareHarvested += qty;
    return this.done(0, def.xp, golden ? { cropId: crop.cropId, qty, golden: true } : { cropId: crop.cropId, qty });
  }

  /** Shovel: removes a crop (even withered); on bare soil, turns it back to grass. */
  clear(i: number, j: number): ActionResult {
    const tile = this.tiles.get(tileKey(i, j));
    if (!tile) return fail('nothing-to-clear');
    if (tile.crop) {
      tile.crop = null;
    } else {
      this.tiles.delete(tileKey(i, j));
    }
    return this.done(0, 0);
  }

  // ---- Orchard ------------------------------------------------------------

  /** The tree standing on an orchard tile, if any. */
  tree(i: number, j: number): TreeState | null {
    return this.trees.get(tileKey(i, j)) ?? null;
  }

  treeStatus(i: number, j: number, now: number): TreeStatus | null {
    const tree = this.tree(i, j);
    return tree ? treeStatus(tree, now) : null;
  }

  /** Every planted tree. */
  *treeEntries(): IterableIterator<{ i: number; j: number; tree: TreeState }> {
    for (const [key, tree] of this.trees) {
      const [i, j] = key.split(',').map(Number) as [number, number];
      yield { i, j, tree };
    }
  }

  treeCount(): number {
    return this.trees.size;
  }

  /** Buys the Pomar: a fenced orchard beside the windmill where trees can be planted. */
  buyPomar(): ActionResult {
    if (this.pomar) return fail('max-level');
    if (this.level < POMAR.level) return fail('level-too-low');
    if (this.coins < POMAR.cost) return fail('no-coins');
    this.pomar = true;
    return this.done(-POMAR.cost, 20);
  }

  buySapling(id: TreeId, qty: number): ActionResult {
    const def = TREES[id];
    if (!this.pomar) return fail('pomar-locked');
    if (this.level < def.unlockLevel) return fail('tree-locked');
    if (qty < 1 || this.coins < def.saplingCost * qty) return fail('no-coins');
    this.saplings[id] += qty;
    return this.done(-def.saplingCost * qty, 0);
  }

  private pestRoll(tree: TreeState, i: number, j: number, now: number, span: number): void {
    const roll = (salt: number): number => hashUnit(this.seed, this.revision, i, j, 0x7ee0 + salt);
    const infested = roll(1) < this.treePestChance;
    tree.pestAt = infested ? now + span * (0.2 + 0.6 * roll(2)) : null;
    tree.pestKind = infested ? (roll(3) < 0.5 ? 'weed' : 'bug') : null;
  }

  plantTree(id: TreeId, i: number, j: number, now: number): ActionResult {
    if (!this.pomar) return fail('pomar-locked');
    if (!isOrchardTile(i, j)) return fail('not-orchard');
    if (this.trees.has(tileKey(i, j))) return fail('occupied');
    const def = TREES[id];
    if (this.level < def.unlockLevel) return fail('tree-locked');
    if (this.saplings[id] < 1) return fail('no-sapling');
    this.saplings[id] -= 1;
    this.stats.treesPlanted++;
    if (this.coins === 0) this.stats.rescues++;
    const tree: TreeState = { species: id, plantedAt: now, watered: false, anchorAt: now, anchorGrowth: 0, pestAt: null, pestKind: null };
    this.pestRoll(tree, i, j, now, def.growMs);
    this.trees.set(tileKey(i, j), tree);
    return this.done(0, 3);
  }

  private reanchorTree(tree: TreeState, now: number): void {
    tree.anchorGrowth = treeGrowth(tree, now);
    tree.anchorAt = now;
  }

  waterTree(i: number, j: number, now: number): ActionResult {
    const tree = this.tree(i, j);
    if (!tree) return fail('no-tree');
    if (tree.watered) return fail('already-watered');
    this.reanchorTree(tree, now);
    tree.watered = true;
    this.stats.watered++;
    return this.done(0, 1);
  }

  careTree(i: number, j: number, now: number): ActionResult {
    const tree = this.tree(i, j);
    if (!tree) return fail('no-tree');
    if (!treeStatus(tree, now).pest) return fail('no-pest');
    this.reanchorTree(tree, now);
    tree.pestAt = null;
    tree.pestKind = null;
    this.stats.cared++;
    return this.done(0, 2);
  }

  /** Picks every ripe fruit: they go to the barn, and the tree starts a new cycle. */
  harvestTree(i: number, j: number, now: number): ActionResult {
    const tree = this.tree(i, j);
    if (!tree) return fail('no-tree');
    const status = treeStatus(tree, now);
    if (!status.ripe) return fail('not-ripe');
    const def = TREES[tree.species];
    const golden = hashUnit(this.seed, this.revision, 0x601d, i, j) < RARITIES[def.rarity].goldenChance;
    const qty = def.fruits * (golden ? 2 : 1);
    this.fruit[tree.species] += qty;
    this.stats.fruitPicked[tree.species] += qty;
    if (golden) this.stats.goldenFruit++;
    tree.anchorAt = now;
    tree.anchorGrowth = def.growMs;
    this.pestRoll(tree, i, j, now, def.cycleMs);
    return this.done(0, def.xp * qty, undefined, undefined, { tree: tree.species, qty, ...(golden ? { golden: true } : {}) });
  }

  /** Shovel on a tree removes it. No refund. */
  clearTree(i: number, j: number): ActionResult {
    if (!this.trees.delete(tileKey(i, j))) return fail('nothing-to-clear');
    return this.done(0, 0);
  }

  sellFruit(id: TreeId, qty: number): ActionResult {
    const count = Math.min(Number.isFinite(qty) ? qty : this.fruit[id], this.fruit[id]);
    if (count < 1) return fail('nothing-to-sell');
    this.fruit[id] -= count;
    return this.sold(count * TREES[id].fruitPrice);
  }

  // ---- Shop ---------------------------------------------------------------

  buySeeds(cropId: CropId, qty: number): ActionResult {
    const def = getCrop(cropId);
    if (this.level < def.unlockLevel) return fail('crop-locked');
    if (qty < 1 || this.coins < def.seedCost * qty) return fail('no-coins');
    this.seeds[cropId] += qty;
    this.stats.seedsBought += qty;
    return this.done(-def.seedCost * qty, 0);
  }

  /** Sells harvested produce from the barn. Pass Infinity to sell everything of that crop. */
  // NEXT(multiplayer): prices here are fixed by the tables. A player market (listings, fees, price bounds) must be server-side;
  //   do not let clients trade directly. Extend tests/support/pace-bot.ts with the bakery and a market before opening one, because
  //   goods multiply income.
  sell(cropId: CropId, qty: number): ActionResult {
    const count = Math.min(Number.isFinite(qty) ? qty : this.produce[cropId], this.produce[cropId]);
    if (count < 1) return fail('nothing-to-sell');
    this.produce[cropId] -= count;
    return this.sold(count * getCrop(cropId).sellPrice);
  }

  /** Sells animal products (eggs, milk, truffles). */
  sellProduct(productId: ProductId, qty: number): ActionResult {
    const count = Math.min(Number.isFinite(qty) ? qty : this.products[productId], this.products[productId]);
    if (count < 1) return fail('nothing-to-sell');
    this.products[productId] -= count;
    return this.sold(count * PRODUCTS[productId].sellPrice);
  }

  /** Sells everything in the barn: crops and animal products. */
  sellAll(): ActionResult {
    let coins = 0;
    for (const id of CROP_ORDER) {
      coins += this.produce[id] * getCrop(id).sellPrice;
      this.produce[id] = 0;
    }
    for (const id of PRODUCT_ORDER) {
      coins += this.products[id] * PRODUCTS[id].sellPrice;
      this.products[id] = 0;
    }
    for (const id of TREE_ORDER) {
      coins += this.fruit[id] * TREES[id].fruitPrice;
      this.fruit[id] = 0;
    }
    for (const id of GOOD_ORDER) {
      coins += this.goods[id] * GOODS[id].sellPrice;
      this.goods[id] = 0;
    }
    if (coins === 0) return fail('nothing-to-sell');
    return this.sold(coins);
  }

  /** Sells baked goods from the barn. */
  sellGood(id: GoodId, qty: number): ActionResult {
    const count = Math.min(Number.isFinite(qty) ? qty : this.goods[id], this.goods[id]);
    if (!(count >= 1)) return fail('nothing-to-sell');
    this.goods[id] -= count;
    return this.sold(count * GOODS[id].sellPrice);
  }

  // ---- The Confeitaria ----------------------------------------------------

  /** Builds the Confeitaria, where Dona Zefa turns the harvest into sweets and bread. */
  buyBakery(): ActionResult {
    if (this.bakery) return fail('bakery-exists');
    if (this.level < BAKERY_UNLOCK_LEVEL) return fail('bakery-locked');
    if (this.coins < BAKERY_COST) return fail('no-coins');
    this.bakery = { level: 1, jobs: [] };
    return this.done(-BAKERY_COST, 30);
  }

  upgradeBakery(): ActionResult {
    if (!this.bakery) return fail('no-bakery');
    const next = nextBakeryTier(this.bakery.level);
    if (!next) return fail('max-level');
    if (this.level < next.unlockLevel) return fail('bakery-locked');
    if (this.coins < next.cost) return fail('no-coins');
    this.bakery.level = next.level;
    return this.done(-next.cost, 0);
  }

  private have(ing: Ingredient): number {
    switch (ing.kind) {
      case 'crop':
        return this.produce[ing.id];
      case 'product':
        return this.products[ing.id];
      case 'fruit':
        return this.fruit[ing.id];
      case 'good':
        return this.goods[ing.id];
    }
  }

  private take(ing: Ingredient, qty: number): void {
    switch (ing.kind) {
      case 'crop':
        this.produce[ing.id] -= qty;
        break;
      case 'product':
        this.products[ing.id] -= qty;
        break;
      case 'fruit':
        this.fruit[ing.id] -= qty;
        break;
      case 'good':
        this.goods[ing.id] -= qty;
        break;
    }
  }

  /** True when the barn holds everything `batches` batches of the recipe need. */
  canBake(id: GoodId, batches: number): boolean {
    return GOODS[id].inputs.every((ing) => this.have(ing) >= ing.qty * batches);
  }

  /** Puts a recipe in the ovens: takes the ingredients now, gives the goods when collected after the time has passed. */
  bake(id: GoodId, batches: number, now: number): ActionResult {
    if (!this.bakery) return fail('no-bakery');
    const def = GOODS[id];
    if (!def || !Number.isInteger(batches) || batches < 1 || batches > MAX_BATCHES) return fail('bad-qty');
    if (this.level < def.unlockLevel) return fail('recipe-locked');
    if (this.bakery.jobs.length >= bakeryTier(this.bakery.level).slots) return fail('no-slot');
    if (!this.canBake(id, batches)) return fail('no-ingredients');
    for (const ing of def.inputs) this.take(ing, ing.qty * batches);
    this.bakery.jobs.push({ good: id, batches, startedAt: now, readyAt: now + bakeMs(id, this.bakery.level, batches) });
    return this.done(0, 0);
  }

  /** How many jobs are done and waiting. */
  bakeryReady(now: number): number {
    return this.bakery ? this.bakery.jobs.filter((j) => j.readyAt <= now).length : 0;
  }

  /** Takes every finished job out of the ovens into the barn, with its XP. */
  collectBakery(now: number): ActionResult {
    if (!this.bakery) return fail('no-bakery');
    const ready = this.bakery.jobs.filter((j) => j.readyAt <= now);
    if (ready.length === 0) return fail('not-ready');
    let xp = 0;
    for (const job of ready) {
      const made = GOODS[job.good].yield * job.batches;
      this.goods[job.good] += made;
      this.stats.baked += made;
      this.stats.bakedBy[job.good] += made;
      if (job.good === 'bolofuba' || job.good === 'bolocenoura' || job.good === 'tortamanga') this.stats.bakedCakes += made;
      xp += GOODS[job.good].xp * job.batches;
    }
    this.bakery.jobs = this.bakery.jobs.filter((j) => j.readyAt > now);
    return this.done(0, xp);
  }

  private sold(coins: number): ActionResult {
    this.stats.sales++;
    this.stats.coinsEarned += coins;
    this.stats.bestSale = Math.max(this.stats.bestSale, coins);
    return this.done(coins, 0);
  }

  // ---- Pens and animals ---------------------------------------------------

  /** Builds the pen for a species (one pen per species). */
  buildPen(species: SpeciesId): ActionResult {
    const def = SPECIES[species];
    if (this.pens[species]) return fail('pen-exists');
    if (this.level < def.unlockLevel) return fail('pen-locked');
    if (this.coins < def.penCost) return fail('no-coins');
    this.pens[species] = { level: 1, animals: [] };
    return this.done(-def.penCost, 10);
  }

  /** Upgrades a pen: more room and a faster cycle. Each tier needs a player level. */
  upgradePen(species: SpeciesId): ActionResult {
    const pen = this.pens[species];
    if (!pen) return fail('no-pen');
    const next = nextPenUpgrade(species, pen.level);
    if (!next) return fail('max-level');
    if (this.level < next.unlockLevel) return fail('pen-locked');
    if (this.coins < next.cost) return fail('no-coins');
    pen.level = next.level;
    return this.done(-next.cost, 0);
  }

  buyAnimal(species: SpeciesId): ActionResult {
    const pen = this.pens[species];
    if (!pen) return fail('no-pen');
    const def = SPECIES[species];
    if (pen.animals.length >= penCapacity(species, pen.level)) return fail('pen-full');
    if (this.coins < def.animalCost) return fail('no-coins');
    pen.animals.push({ id: this.nextAnimalId++, readyAt: null });
    return this.done(-def.animalCost, 2);
  }

  private animal(species: SpeciesId, animalId: number): AnimalState | null {
    return this.pens[species]?.animals.find((a) => a.id === animalId) ?? null;
  }

  /** Feeds one hungry animal with its species' feed; it produces after one cycle. */
  feedAnimal(species: SpeciesId, animalId: number, now: number): ActionResult {
    if (!this.pens[species]) return fail('no-pen');
    const animal = this.animal(species, animalId);
    if (!animal) return fail('no-animal');
    const phase = animalStatus(species, animal, now).phase;
    if (phase === 'working') return fail('already-fed');
    if (phase === 'ready') return fail('product-waiting');
    if (this.feed[species] < 1) return fail('no-feed');
    this.feed[species] -= 1;
    animal.readyAt = now + penCycleMs(species, this.pens[species]!.level);
    this.stats.fed++;
    return this.done(0, 1);
  }

  /** Feeds every hungry animal in the pen for as long as feed lasts. */
  feedAll(species: SpeciesId, now: number): ActionResult {
    const pen = this.pens[species];
    if (!pen) return fail('no-pen');
    const hungry = pen.animals.filter((a) => animalStatus(species, a, now).phase === 'hungry');
    if (hungry.length === 0) return fail(pen.animals.length === 0 ? 'no-animal' : 'already-fed');
    if (this.feed[species] < 1) return fail('no-feed');
    let fed = 0;
    for (const animal of hungry) {
      if (this.feed[species] < 1) break;
      this.feed[species] -= 1;
      animal.readyAt = now + penCycleMs(species, pen.level);
      fed++;
    }
    this.stats.fed += fed;
    return this.done(0, fed);
  }

  /** Collects the product of one animal that finished its cycle. */
  collect(species: SpeciesId, animalId: number, now: number): ActionResult {
    if (!this.pens[species]) return fail('no-pen');
    const animal = this.animal(species, animalId);
    if (!animal) return fail('no-animal');
    if (animalStatus(species, animal, now).phase !== 'ready') return fail('not-ready');
    const def = SPECIES[species];
    animal.readyAt = null;
    this.products[def.product] += 1;
    this.stats.collected[def.product] += 1;
    return this.done(0, def.xp, undefined, { productId: def.product, qty: 1 });
  }

  collectAll(species: SpeciesId, now: number): ActionResult {
    const pen = this.pens[species];
    if (!pen) return fail('no-pen');
    const ready = pen.animals.filter((a) => animalStatus(species, a, now).phase === 'ready');
    if (ready.length === 0) return fail('not-ready');
    const def = SPECIES[species];
    for (const animal of ready) animal.readyAt = null;
    this.products[def.product] += ready.length;
    this.stats.collected[def.product] += ready.length;
    return this.done(0, def.xp * ready.length, undefined, { productId: def.product, qty: ready.length });
  }

  // ---- Feed ---------------------------------------------------------------

  /** Buys ready-made feed in the shop. */
  buyFeed(species: SpeciesId, qty: number): ActionResult {
    const def = SPECIES[species];
    if (this.level < def.unlockLevel) return fail('pen-locked');
    if (qty < 1 || this.coins < def.feedPrice * qty) return fail('no-coins');
    this.feed[species] += qty;
    return this.done(-def.feedPrice * qty, 0);
  }

  /** Mills feed from harvested crops in the barn. */
  craftFeed(species: SpeciesId, batches: number): ActionResult {
    const def = SPECIES[species];
    if (this.level < def.unlockLevel) return fail('pen-locked');
    if (batches < 1) return fail('no-ingredients');
    const inputs = Object.entries(def.recipe.inputs) as Array<[CropId, number]>;
    if (inputs.some(([crop, qty]) => this.produce[crop] < qty * batches)) return fail('no-ingredients');
    for (const [crop, qty] of inputs) this.produce[crop] -= qty * batches;
    this.feed[species] += def.recipe.yield * batches;
    this.stats.milled += batches;
    return this.done(0, batches);
  }

  /** How many batches of this feed the crops in the barn allow. */
  maxFeedBatches(species: SpeciesId): number {
    const inputs = Object.entries(SPECIES[species].recipe.inputs) as Array<[CropId, number]>;
    return Math.min(...inputs.map(([crop, qty]) => Math.floor(this.produce[crop] / qty)));
  }

  /** The next plot upgrade, or null once the land is fully grown. */
  nextExpansion(): { size: number; cost: number; level: number } | null {
    return LAND_STEPS.find((step) => step.size > this.landSize) ?? null;
  }

  expandLand(): ActionResult {
    const next = this.nextExpansion();
    if (!next) return fail('max-land');
    if (this.level < next.level) return fail('level-too-low');
    if (this.coins < next.cost) return fail('no-coins');
    this.landSize = next.size;
    return this.done(-next.cost, 0);
  }


  // ---- Helpers ------------------------------------------------------------

  /** Hires a helper. The first wage period is covered by the hiring fee. */
  hireHelper(id: HelperId, now: number): ActionResult {
    const def = HELPERS[id];
    if (this.helpers[id]) return fail('helper-exists');
    if (this.level < def.unlockLevel) return fail('helper-locked');
    if (this.coins < def.hireCost) return fail('no-coins');
    const home = id === 'regador' ? { u: 12, v: 12 } : HOME[id];
    this.helpers[id] = {
      level: 1,
      paidUntil: now + WAGE_PERIOD_MS,
      paid: true,
      nextAt: now + (id === 'regador' ? 2000 : POLL_MS),
      leftAt: now,
      from: { ...home },
      target: { ...home },
      working: false,
      lastAt: 0,
    };
    return this.done(-def.hireCost, 15);
  }

  upgradeHelper(id: HelperId): ActionResult {
    const helper = this.helpers[id];
    if (!helper) return fail('no-helper');
    const next = nextHelperUpgrade(id, helper.level);
    if (!next) return fail('max-level');
    if (this.level < next.needLevel) return fail('helper-locked');
    if (this.coins < next.cost) return fail('no-coins');
    helper.level = next.level;
    this.stats.helperUpgrades++;
    return this.done(-next.cost, 0);
  }

  /** Saves Tonico's planting settings (anything invalid falls back to the default). */
  setAutoPlant(settings: AutoPlant): ActionResult {
    this.autoPlant = normalizeAutoPlant(settings);
    return this.done(0, 0);
  }

  /** True when the level-4 Tonico is allowed to plant right now. */
  private planting(id: WalkerId, h: HelperState): boolean {
    return id === 'ajudante' && h.level >= PLANTER_LEVEL && this.autoPlant.on;
  }

  /** The seed Tonico would sow at the tile: one from the barn, or one he can afford to buy. Null when there is none. */
  private pickSeed(i: number, j: number): { crop: CropId; buy: boolean } | null {
    const cfg = this.autoPlant;
    const order = plantOrder(cfg, this.level, hashUnit(this.seed, this.revision, 0x7a1, i, j));
    for (const crop of order) {
      if (this.seeds[crop] >= 1) return { crop, buy: false };
      if (cfg.buy && this.coins - getCrop(crop).seedCost >= cfg.reserve) return { crop, buy: true };
    }
    return null;
  }

  /** Tonico at a free (or withered) tile: clear, plow, sow and water as configured, and maybe say something. */
  private autoSow(i: number, j: number, at: number): void {
    const cfg = this.autoPlant;
    if (this.status(i, j, at)?.withered) this.clear(i, j);
    const tile = this.tile(i, j);
    if (tile.crop) return;
    if (tile.kind === 'grass' && !cfg.plow) return;
    const pick = this.pickSeed(i, j);
    if (!pick) return;
    if (tile.kind === 'grass' && !this.plow(i, j).ok) return;
    if (pick.buy && !this.buySeeds(pick.crop, 1).ok) return;
    if (!this.plant(i, j, pick.crop, at).ok) return;
    this.stats.farmhandPlants++;
    this.helperEvents.push({ helper: 'ajudante', kind: 'plant', at, i, j, crop: pick.crop });
    if (cfg.water && this.water(i, j, at).ok) this.helperEvents.push({ helper: 'ajudante', kind: 'water', at, i, j });
    const talk = hashUnit(this.seed, this.revision, 0x5a1, i, j);
    if (talk < (cfg.humor === 'cantor' ? 0.5 : 0.3)) {
      const text = sayLine(cfg.humor, hashUnit(this.seed, this.revision, 0x5a2, i, j));
      if (text) this.helperEvents.push({ helper: 'ajudante', kind: 'say', at, i, j, text });
    }
  }

  /** Pays the wage of a helper who stopped because the money ran out. */
  payHelper(id: HelperId, now: number): ActionResult {
    const helper = this.helpers[id];
    if (!helper) return fail('no-helper');
    if (helper.paid) return fail('already-paid');
    const wage = helperWage(id, helper.level, this.barn);
    if (this.coins < wage) return fail('no-coins');
    helper.paid = true;
    helper.paidUntil = now + WAGE_PERIOD_MS;
    helper.nextAt = now + POLL_MS;
    helper.leftAt = now;
    helper.working = false;
    this.stats.wagesPaid++;
    return this.done(-wage, 0);
  }

  /**
   * Plays the helpers' routines (and the seed truck) forward to `now`, one event at a time in time order.
   * Called before every command and every frame. Each event depends only on the state and its own timestamp, so splitting a span
   * into many small calls or doing it in one gives the same result, EXCEPT across the offline caps below.
   *
   * KNOWN GAP (NEXT(backend), "Blocker 1" in docs/Roadmap-Backend-Multiplayer-Social.md): the caps are evaluated against the `now` of
   * the call. A tab that stays open calls this every frame and never trips them; a server replaying commands hours apart calls it
   * once and does. The two then disagree (see tests/known-issues.test.ts). Planned fix: base the cap on a logged `lastSeenAt`
   * (advanced by a `heartbeat` command) instead of on call cadence.
   */
  runHelpers(now: number): void {
    // Away for ages: the truck only left the last few deliveries at the door.
    this.deliveredSlot = Math.max(this.deliveredSlot, slotOf(now, deliveryInterval(this.truck)) - MAX_CATCHUP_SLOTS);

    const active = HELPER_ORDER.filter((id) => this.helpers[id]);

    // Away longer than the limit: the helpers rested, so their clocks skip ahead (and aren't paid for the rest).
    const horizon = now - OFFLINE_LIMIT_MS;
    for (const id of active) {
      const h = this.helpers[id]!;
      if (!h.paid) continue;
      const earliest = Math.min(h.nextAt, h.paidUntil);
      if (earliest < horizon) {
        const shift = horizon - earliest;
        h.nextAt += shift;
        h.leftAt += shift;
        h.paidUntil += shift;
      }
    }

    // Helper steps and seed deliveries share one timeline, so each sees the state the other left at that moment.
    for (let guard = 0; guard < 4000; guard++) {
      let pick: HelperId | null = null;
      let pickAt = Infinity;
      for (const id of active) {
        const h = this.helpers[id]!;
        if (!h.paid) continue;
        const t = Math.min(h.nextAt, h.paidUntil);
        if (t < pickAt) {
          pickAt = t;
          pick = id;
        }
      }
      const truckAt = slotTime(this.deliveredSlot + 1, deliveryInterval(this.truck));
      if (truckAt <= now && truckAt <= pickAt) {
        this.deliver(truckAt);
        continue;
      }
      if (pick === null || pickAt > now) break;
      const h = this.helpers[pick]!;
      if (h.paidUntil <= h.nextAt) this.payday(pick, h, pickAt);
      else if (pick === 'regador') this.pulse(h, pickAt);
      else this.walk(pick, h, pickAt);
    }
    if (this.helperEvents.length > 80) this.helperEvents.splice(0, this.helperEvents.length - 80);
    if (this.deliveryEvents.length > 20) this.deliveryEvents.splice(0, this.deliveryEvents.length - 20);
  }

  // ---- Truck, barn and decorations ---------------------------------------

  /** Buys a seed-truck upgrade. The faster clock restarts from now: the next truck is at most one new interval away. */
  upgradeTruck(id: TruckUpgradeId, now: number): ActionResult {
    const def = TRUCK_UPGRADES[id];
    if (this.truck[id]) return fail('max-level');
    if (this.level < def.level) return fail('truck-locked');
    if (this.coins < def.cost) return fail('no-coins');
    this.truck[id] = true;
    if (id === 'fast') this.deliveredSlot = slotOf(now, deliveryInterval(this.truck));
    return this.done(-def.cost, 0);
  }

  /** Upgrades the barn one tier: a nicer barn and cheaper, faster helpers. */
  upgradeBarn(): ActionResult {
    const next = nextBarnTier(this.barn);
    if (!next) return fail('max-level');
    if (this.level < next.unlockLevel) return fail('barn-locked');
    if (this.coins < next.cost) return fail('no-coins');
    this.barn = next.level;
    return this.done(-next.cost, 0);
  }

  /** Buys a decoration (once each). */
  buyDecor(id: DecorId): ActionResult {
    const def = DECOR[id];
    if (this.level < DECOR_UNLOCK_LEVEL) return fail('decor-locked');
    if (this.decor[id]) return fail('max-level');
    if (this.coins < def.cost) return fail('no-coins');
    this.decor[id] = true;
    return this.done(-def.cost, 0);
  }

  /** Pays a goal or achievement reward once (the caller, in commands.ts, has checked it is earned). */
  claim(key: string, coins: number): ActionResult {
    if (this.claimed.includes(key)) return fail('already-claimed');
    this.claimed.push(key);
    return this.done(coins, 0);
  }

  /** The seed truck pulls up: its load goes straight into the barn. */
  private deliver(at: number): void {
    this.deliveredSlot++;
    this.revision++;
    const load = rollDelivery(this.seed, this.deliveredSlot, this.level, deliverySeeds(this.truck));
    for (const id of CROP_ORDER) {
      this.seeds[id] += load[id];
      this.stats.seedsReceived += load[id];
      if (getCrop(id).rarity === 'rara' || getCrop(id).rarity === 'epica') this.stats.rareSeedsReceived += load[id];
    }
    this.stats.deliveries++;
    this.deliveryEvents.push({ at, slot: this.deliveredSlot, seeds: load });
  }

  private payday(id: HelperId, h: HelperState, at: number): void {
    const wage = helperWage(id, h.level, this.barn);
    this.revision++;
    if (this.coins >= wage) {
      this.coins -= wage;
      h.paidUntil += WAGE_PERIOD_MS;
      this.stats.wagesPaid++;
      this.helperEvents.push({ helper: id, kind: 'wage', at, amount: wage });
      return;
    }
    // No money: the helper stops where it stands.
    if (id !== 'regador') {
      const here = walkerPose(id, h, this.landSize, at).at;
      h.from = { ...here };
      h.target = { ...here };
      h.leftAt = at;
      h.working = false;
    }
    h.paid = false;
    this.helperEvents.push({ helper: id, kind: 'unpaid', at });
  }

  /** The sprinklers spray every unwatered crop around their heads. */
  private pulse(h: HelperState, at: number): void {
    const { min, max } = landBounds(this.landSize);
    let count = 0;
    for (const head of sprinklerSpots(this.landSize, h.level)) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i = head.i + di;
          const j = head.j + dj;
          if (i < min || i > max || j < min || j > max) continue;
          if (this.water(i, j, at).ok) {
            count++;
            this.helperEvents.push({ helper: 'regador', kind: 'water', at, i, j });
          }
        }
      }
    }
    for (const { i, j } of [...this.treeEntries()]) {
      if (this.waterTree(i, j, at).ok) {
        count++;
        this.helperEvents.push({ helper: 'regador', kind: 'water', at, i, j });
      }
    }
    this.revision++;
    h.lastAt = at;
    h.nextAt = at + (SPRINKLER_INTERVAL_MS[h.level - 1] ?? SPRINKLER_INTERVAL_MS[0]!) / barnTier(this.barn).speedMul;
    void count;
  }

  /** One step of a walking helper: do the chore it arrived for, then choose where to go next. */
  private walk(id: WalkerId, h: HelperState, at: number): void {
    if (h.working) {
      const i = Math.floor(h.target.u);
      const j = Math.floor(h.target.v);
      if (id === 'tratador') {
        const species = SPECIES_ORDER.find((sp) => PEN_SPOTS[sp].u === h.target.u && PEN_SPOTS[sp].v === h.target.v);
        const pen = species ? this.pens[species] : undefined;
        if (species && pen) {
          const hungry = pen.animals.filter((a) => animalStatus(species, a, at, pen.level).phase === 'hungry').length;
          const fedBefore = this.stats.fed;
          if (this.feedAll(species, at).ok) this.helperEvents.push({ helper: id, kind: 'feed', at, species, count: Math.min(hungry, this.stats.fed - fedBefore) });
        }
      } else if (id === 'cao') {
        const species = SPECIES_ORDER.find((sp) => PEN_SPOTS[sp] === h.target || (PEN_SPOTS[sp].u === h.target.u && PEN_SPOTS[sp].v === h.target.v));
        const pen = species ? this.pens[species] : undefined;
        if (species && pen) {
          const ready = pen.animals.filter((a) => animalStatus(species, a, at, pen.level).phase === 'ready').length;
          if (this.collectAll(species, at).ok) this.helperEvents.push({ helper: id, kind: 'collect', at, species, count: ready });
        }
      } else if (isOrchardTile(i, j)) {
        if (id === 'ajudante') {
          const result = this.harvestTree(i, j, at);
          if (result.ok) {
            this.stats.farmhandHarvests += result.gain.fruit?.qty ?? 1;
            this.helperEvents.push({ helper: id, kind: 'harvest', at, i, j });
          }
        } else if (this.careTree(i, j, at).ok) {
          this.stats.catCares++;
          this.helperEvents.push({ helper: id, kind: 'care', at, i, j });
        }
      } else if (id === 'ajudante') {
        const result = this.harvest(i, j, at);
        if (result.ok) this.stats.farmhandHarvests += result.gain.item?.qty ?? 1;
        if (result.ok) this.helperEvents.push({ helper: id, kind: 'harvest', at, i, j, crop: result.gain.item?.cropId });
        if (this.planting(id, h)) this.autoSow(i, j, at);
      } else if (this.care(i, j, at).ok) {
        this.stats.catCares++;
        this.helperEvents.push({ helper: id, kind: 'care', at, i, j });
      }
    }

    // Choose the nearest tile (or pen) with work; ties go to the lowest row, then column, so the choice is stable.
    let best: { i: number; j: number } | null = null;
    let bestSpot: Spot | null = null;
    let bestDistance = Infinity;
    const here = h.target;
    if (id === 'tratador') {
      for (const species of SPECIES_ORDER) {
        const pen = this.pens[species];
        if (!pen || this.feed[species] < 1 || !pen.animals.some((a) => animalStatus(species, a, at, pen.level).phase === 'hungry')) continue;
        const spot = PEN_SPOTS[species];
        const d = Math.hypot(spot.u - here.u, spot.v - here.v);
        if (d < bestDistance - 1e-9) {
          bestDistance = d;
          bestSpot = spot;
        }
      }
    } else if (id === 'cao') {
      for (const species of SPECIES_ORDER) {
        const pen = this.pens[species];
        if (!pen || !pen.animals.some((a) => animalStatus(species, a, at, pen.level).phase === 'ready')) continue;
        const spot = PEN_SPOTS[species];
        const d = Math.hypot(spot.u - here.u, spot.v - here.v);
        if (d < bestDistance - 1e-9) {
          bestDistance = d;
          bestSpot = spot;
        }
      }
    } else {
      for (const { i, j, tile } of this.entries()) {
        if (!tile.crop || !this.isUnlocked(i, j)) continue;
        const status = this.status(i, j, at);
        const wanted = id === 'ajudante' ? status?.ripe === true : !!status?.pest;
        if (!wanted) continue;
        const d = Math.hypot(i + 0.5 - here.u, j + 0.5 - here.v);
        if (d < bestDistance - 1e-9 || (Math.abs(d - bestDistance) <= 1e-9 && best && (j < best.j || (j === best.j && i < best.i)))) {
          best = { i, j };
          bestDistance = d;
        }
      }
      for (const { i, j, tree } of this.treeEntries()) {
        const status = treeStatus(tree, at);
        const wanted = id === 'ajudante' ? status.ripe : !!status.pest;
        if (!wanted) continue;
        const d = Math.hypot(i + 0.5 - here.u, j + 0.5 - here.v);
        if (d < bestDistance - 1e-9 || (Math.abs(d - bestDistance) <= 1e-9 && best && (j < best.j || (j === best.j && i < best.i)))) {
          best = { i, j };
          bestDistance = d;
        }
      }
      if (this.planting(id, h)) {
        // Free soil, bare grass (when he may plow) and withered crops are all places to sow, if there is a seed to sow.
        const { min, max } = landBounds(this.landSize);
        const canSow = this.pickSeed(0, 0) !== null;
        for (let j = min; j <= max && canSow; j++) {
          for (let i = min; i <= max; i++) {
            const tile = this.tile(i, j);
            const free = tile.crop ? this.status(i, j, at)?.withered === true : tile.kind === 'soil' || this.autoPlant.plow;
            if (!free) continue;
            const d = Math.hypot(i + 0.5 - here.u, j + 0.5 - here.v);
            if (d < bestDistance - 1e-9) {
              best = { i, j };
              bestDistance = d;
            }
          }
        }
      }
      if (best) bestSpot = { u: best.i + 0.5, v: best.j + 0.5 };
    }

    const stats = walkerStats(id, h.level, this.barn);
    h.speed = stats.speed;
    h.from = { ...here };
    h.leftAt = at;
    if (bestSpot) {
      h.target = { ...bestSpot };
      h.working = true;
      const walkMs = (routeLength(route(h.from, h.target, this.landSize)) / stats.speed) * 1000;
      h.nextAt = at + walkMs + stats.workMs;
    } else {
      h.target = { ...HOME[id] };
      h.working = false;
      const walkMs = (routeLength(route(h.from, h.target, this.landSize)) / stats.speed) * 1000;
      h.nextAt = at + Math.max(POLL_MS, walkMs);
    }
  }

  // ---- Persistence --------------------------------------------------------

  toSnapshot(): FarmSnapshot {
    const tiles: Record<string, TileState> = {};
    for (const [key, tile] of this.tiles) {
      tiles[key] = { kind: tile.kind, crop: tile.crop ? { ...tile.crop } : null };
    }
    return {
      version: 8,
      seed: this.seed,
      revision: this.revision,
      nextAnimalId: this.nextAnimalId,
      coins: this.coins,
      xp: this.xp,
      landSize: this.landSize,
      seeds: { ...this.seeds },
      produce: { ...this.produce },
      products: { ...this.products },
      feed: { ...this.feed },
      pens: clonePens(this.pens),
      helpers: cloneHelpers(this.helpers),
      deliveredSlot: this.deliveredSlot,
      truck: { ...this.truck },
      decor: { ...this.decor },
      stats: cloneStats(this.stats),
      claimed: [...this.claimed],
      barn: this.barn,
      pomar: this.pomar,
      saplings: { ...this.saplings },
      fruit: { ...this.fruit },
      autoPlant: cloneAutoPlant(this.autoPlant),
      bakery: this.bakery ? { level: this.bakery.level, jobs: this.bakery.jobs.map((j) => ({ ...j })) } : null,
      goods: { ...this.goods },
      trees: Object.fromEntries([...this.trees].map(([k, t]) => [k, { ...t }])),
      tiles,
    };
  }

  static fromSnapshot(snapshot: FarmSnapshot | LegacySnapshot, options: Omit<FarmOptions, 'seed'> = {}): Farm {
    const farm = new Farm({ ...options, seed: snapshot.seed });
    farm.revision = snapshot.revision;
    farm.nextAnimalId = snapshot.nextAnimalId;
    farm.products = { ...emptyProducts(), ...snapshot.products };
    farm.feed = { ...emptyFeed(), ...snapshot.feed };
    farm.pens = clonePens(snapshot.pens);
    farm.helpers = cloneHelpers(snapshot.version >= 4 ? (snapshot as { helpers: Helpers }).helpers : {});
    // Older saves have no truck record: they catch up on a few deliveries, like returning from a trip.
    farm.deliveredSlot = snapshot.version >= 5 ? (snapshot as { deliveredSlot: number }).deliveredSlot : 0;
    if (snapshot.version >= 6) {
      const v6 = snapshot as FarmSnapshot | Extract<LegacySnapshot, { version: 6 }>;
      farm.truck = { ...v6.truck };
      for (const id of DECOR_ORDER) if (v6.decor[id]) farm.decor[id] = true;
      farm.stats = normalizeStats(v6.stats);
      farm.claimed = [...new Set(v6.claimed.filter((c) => typeof c === 'string'))];
    }
    if (snapshot.version >= 7) {
      const v7 = snapshot as FarmSnapshot | Extract<LegacySnapshot, { version: 7 }>;
      farm.pomar = v7.pomar === true;
      farm.saplings = { ...emptyFruit(), ...v7.saplings };
      farm.fruit = { ...emptyFruit(), ...v7.fruit };
      for (const [key, t] of Object.entries(v7.trees)) {
        const [ti, tj] = key.split(',').map(Number) as [number, number];
        if (t.species in TREES && isOrchardTile(ti, tj)) farm.trees.set(key, { ...t });
      }
    }
    if (snapshot.version === 8) {
      farm.barn = Math.min(Math.max(Math.floor(snapshot.barn) || 1, 1), MAX_BARN_LEVEL);
      farm.autoPlant = normalizeAutoPlant(snapshot.autoPlant);
      farm.bakery = normalizeBakery(snapshot.bakery);
      if (typeof snapshot.goods === 'object' && snapshot.goods !== null) {
        for (const id of GOOD_ORDER) {
          const n = (snapshot.goods as Record<string, unknown>)[id];
          if (typeof n === 'number' && Number.isFinite(n) && n > 0) farm.goods[id] = Math.floor(n);
        }
      }
    }
    farm.coins = snapshot.coins;
    farm.xp = snapshot.xp;
    farm.landSize = snapshot.landSize;
    farm.seeds = { ...emptyStock(), ...snapshot.seeds };
    farm.produce = { ...emptyStock(), ...snapshot.produce };
    for (const [key, tile] of Object.entries(snapshot.tiles)) {
      farm.tiles.set(key, { kind: tile.kind, crop: tile.crop ? { ...tile.crop } : null });
    }
    return farm;
  }

  /** Freezes the crop's growth so far into its anchor, so a stall can start or end exactly now. */
  private reanchor(crop: CropState, now: number): void {
    crop.anchorGrowth = this.growth(crop, now).g;
    crop.anchorAt = now;
  }

  private done(
    coins: number,
    xp: number,
    item?: { cropId: CropId; qty: number; golden?: boolean },
    product?: { productId: ProductId; qty: number },
    fruit?: { tree: TreeId; qty: number; golden?: boolean },
  ): ActionResult {
    this.revision++;
    const before = this.level;
    this.coins += coins;
    this.xp += xp;
    const after = this.level;
    const gain: Gain = { coins, xp, levelUp: after > before ? after : null };
    if (item) gain.item = item;
    if (product) gain.product = product;
    if (fruit) gain.fruit = fruit;
    return { ok: true, gain };
  }
}
