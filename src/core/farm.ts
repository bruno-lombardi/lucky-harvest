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
} from './animals';
import { CROP_ORDER, CropId, getCrop } from './crops';
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
  | 'pen-exists'
  | 'no-pen'
  | 'pen-full'
  | 'no-animal'
  | 'no-feed'
  | 'already-fed'
  | 'product-waiting'
  | 'not-ready'
  | 'max-level'
  | 'no-ingredients';

export interface Gain {
  coins: number;
  xp: number;
  /** The new level if this action levelled the player up. */
  levelUp: number | null;
  /** Produce added to the barn (harvest). */
  item?: { cropId: CropId; qty: number };
  /** Animal product added to the barn (collect). */
  product?: { productId: ProductId; qty: number };
}

export type Stock = Record<CropId, number>;
export type ProductStock = Record<ProductId, number>;
export type FeedStock = Record<SpeciesId, number>;
export type Pens = Partial<Record<SpeciesId, PenState>>;

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

export type ActionResult = { ok: true; gain: Gain } | { ok: false; reason: FailReason };

export interface FarmSnapshot {
  version: 3;
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
  tiles: Record<string, TileState>;
}

export interface FarmOptions {
  seed?: number;
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
  seed: number;
  revision = 0;
  nextAnimalId = 1;
  private readonly pestChance: number;
  private readonly tiles = new Map<string, TileState>();

  /** Every random outcome comes from `seed`, so a server can replay the same commands to the same result. */
  constructor(options: FarmOptions = {}) {
    this.seed = (options.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.pestChance = options.pestChance ?? PEST_CHANCE;
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
    this.produce[crop.cropId] += 1;
    return this.done(0, def.xp, { cropId: crop.cropId, qty: 1 });
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

  /** Upgrades a pen to hold more animals. No upgrade exists yet, so this is refused for now. */
  upgradePen(species: SpeciesId): ActionResult {
    const pen = this.pens[species];
    if (!pen) return fail('no-pen');
    const next = nextPenUpgrade(species, pen.level);
    if (!next) return fail('max-level');
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
    animal.readyAt = now + SPECIES[species].cycleMs;
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
      animal.readyAt = now + SPECIES[species].cycleMs;
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

  // ---- Persistence --------------------------------------------------------

  toSnapshot(): FarmSnapshot {
    const tiles: Record<string, TileState> = {};
    for (const [key, tile] of this.tiles) {
      tiles[key] = { kind: tile.kind, crop: tile.crop ? { ...tile.crop } : null };
    }
    return {
      version: 3,
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
      tiles,
    };
  }

  static fromSnapshot(snapshot: FarmSnapshot, options: Omit<FarmOptions, 'seed'> = {}): Farm {
    const farm = new Farm({ ...options, seed: snapshot.seed });
    farm.revision = snapshot.revision;
    farm.nextAnimalId = snapshot.nextAnimalId;
    farm.products = { ...emptyProducts(), ...snapshot.products };
    farm.feed = { ...emptyFeed(), ...snapshot.feed };
    farm.pens = clonePens(snapshot.pens);
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
    item?: { cropId: CropId; qty: number },
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
