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
  POLL_MS,
  SPRINKLER_INTERVAL_MS,
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
}

export type Stock = Record<CropId, number>;
export type ProductStock = Record<ProductId, number>;
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
  kind: 'harvest' | 'water' | 'care' | 'wage' | 'unpaid';
  at: number;
  i?: number;
  j?: number;
  crop?: CropId;
  /** Tiles watered by a sprinkler pulse. */
  count?: number;
  amount?: number;
}

const emptyStock = (): Stock => Object.fromEntries(CROP_ORDER.map((id) => [id, 0])) as Stock;
const emptyProducts = (): ProductStock => Object.fromEntries(PRODUCT_ORDER.map((id) => [id, 0])) as ProductStock;
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
  version: 6;
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
  tiles: Record<string, TileState>;
}

/** Saves from before helpers (v3) and before the seed truck (v4). */
export type LegacySnapshot =
  | (Omit<FarmSnapshot, 'version' | 'helpers' | 'deliveredSlot' | 'truck'> & { version: 3 })
  | (Omit<FarmSnapshot, 'version' | 'deliveredSlot' | 'truck'> & { version: 4 })
  | (Omit<FarmSnapshot, 'version' | 'truck'> & { version: 5 });

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
  seed: number;
  revision = 0;
  nextAnimalId = 1;
  private readonly pestChance: number;
  private readonly tiles = new Map<string, TileState>();

  /** Every random outcome comes from `seed`, so a server can replay the same commands to the same result. */
  constructor(options: FarmOptions = {}) {
    this.seed = (options.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.pestChance = options.pestChance ?? PEST_CHANCE;
    if (options.now !== undefined) this.deliveredSlot = slotOf(options.now);
  }

  get level(): number {
    return levelFromXp(this.xp);
  }

  isUnlocked(i: number, j: number): boolean {
    return isUnlockedFor(this.landSize, i, j);
  }

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

  // ---- Shop ---------------------------------------------------------------

  buySeeds(cropId: CropId, qty: number): ActionResult {
    const def = getCrop(cropId);
    if (this.level < def.unlockLevel) return fail('crop-locked');
    if (qty < 1 || this.coins < def.seedCost * qty) return fail('no-coins');
    this.seeds[cropId] += qty;
    return this.done(-def.seedCost * qty, 0);
  }

  /** Sells harvested produce from the barn. Pass Infinity to sell everything of that crop. */
  sell(cropId: CropId, qty: number): ActionResult {
    const count = Math.min(Number.isFinite(qty) ? qty : this.produce[cropId], this.produce[cropId]);
    if (count < 1) return fail('nothing-to-sell');
    this.produce[cropId] -= count;
    return this.done(count * getCrop(cropId).sellPrice, 0);
  }

  /** Sells animal products (eggs, milk, truffles). */
  sellProduct(productId: ProductId, qty: number): ActionResult {
    const count = Math.min(Number.isFinite(qty) ? qty : this.products[productId], this.products[productId]);
    if (count < 1) return fail('nothing-to-sell');
    this.products[productId] -= count;
    return this.done(count * PRODUCTS[productId].sellPrice, 0);
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
    if (coins === 0) return fail('nothing-to-sell');
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
    if (this.coins < next.cost) return fail('no-coins');
    helper.level = next.level;
    return this.done(-next.cost, 0);
  }

  /** Pays the wage of a helper who stopped because the money ran out. */
  payHelper(id: HelperId, now: number): ActionResult {
    const helper = this.helpers[id];
    if (!helper) return fail('no-helper');
    if (helper.paid) return fail('already-paid');
    const wage = helperWage(id, helper.level);
    if (this.coins < wage) return fail('no-coins');
    helper.paid = true;
    helper.paidUntil = now + WAGE_PERIOD_MS;
    helper.nextAt = now + POLL_MS;
    helper.leftAt = now;
    helper.working = false;
    return this.done(-wage, 0);
  }

  /**
   * Plays the helpers' routines forward to `now`, one event at a time in time order.
   * Called before every command and every frame; since each event depends only on the state and its
   * own timestamp, running it at any moment gives the same result, which a server can reproduce.
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

  /** The seed truck pulls up: its load goes straight into the barn. */
  private deliver(at: number): void {
    this.deliveredSlot++;
    this.revision++;
    const load = rollDelivery(this.seed, this.deliveredSlot, this.level, deliverySeeds(this.truck));
    for (const id of CROP_ORDER) this.seeds[id] += load[id];
    this.deliveryEvents.push({ at, slot: this.deliveredSlot, seeds: load });
  }

  private payday(id: HelperId, h: HelperState, at: number): void {
    const wage = helperWage(id, h.level);
    this.revision++;
    if (this.coins >= wage) {
      this.coins -= wage;
      h.paidUntil += WAGE_PERIOD_MS;
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
    this.revision++;
    h.lastAt = at;
    h.nextAt = at + (SPRINKLER_INTERVAL_MS[h.level - 1] ?? SPRINKLER_INTERVAL_MS[0]!);
    void count;
  }

  /** One step of a walking helper: do the chore it arrived for, then choose where to go next. */
  private walk(id: 'ajudante' | 'gato', h: HelperState, at: number): void {
    if (h.working) {
      const i = Math.floor(h.target.u);
      const j = Math.floor(h.target.v);
      if (id === 'ajudante') {
        const result = this.harvest(i, j, at);
        if (result.ok) this.helperEvents.push({ helper: id, kind: 'harvest', at, i, j, crop: result.gain.item?.cropId });
      } else if (this.care(i, j, at).ok) {
        this.helperEvents.push({ helper: id, kind: 'care', at, i, j });
      }
    }

    // Choose the nearest tile with work; ties go to the lowest row, then column, so the choice is stable.
    let best: { i: number; j: number } | null = null;
    let bestDistance = Infinity;
    const here = h.target;
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

    const stats = walkerStats(id, h.level);
    h.from = { ...here };
    h.leftAt = at;
    if (best) {
      h.target = { u: best.i + 0.5, v: best.j + 0.5 };
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
      version: 6,
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
    if (snapshot.version === 6) farm.truck = { ...snapshot.truck };
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
  ): ActionResult {
    this.revision++;
    const before = this.level;
    this.coins += coins;
    this.xp += xp;
    const after = this.level;
    const gain: Gain = { coins, xp, levelUp: after > before ? after : null };
    if (item) gain.item = item;
    if (product) gain.product = product;
    return { ok: true, gain };
  }
}
