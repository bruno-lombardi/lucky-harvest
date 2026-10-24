import { CropId, getCrop } from './crops';
import { inBounds, tileKey } from './grid';
import { levelFromXp } from './levels';

export const START_COINS = 100;

/** Inclusive tile-index range of the starting (unlocked) 10x10 plot. Expansion comes later. */
export const LAND = { min: 7, max: 16 } as const;

export function isUnlocked(i: number, j: number): boolean {
  return i >= LAND.min && i <= LAND.max && j >= LAND.min && j <= LAND.max;
}

export type TileKind = 'grass' | 'soil';

export interface CropState {
  cropId: CropId;
  plantedAt: number;
  watered: boolean;
  /** Time the crop stood thirsty before it was watered. Delays ripening. */
  pausedMs: number;
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
  | 'nothing-to-clear';

export interface Gain {
  coins: number;
  xp: number;
  /** The new level if this action levelled the player up. */
  levelUp: number | null;
}

export type ActionResult = { ok: true; gain: Gain } | { ok: false; reason: FailReason };

export interface FarmSnapshot {
  version: 1;
  coins: number;
  xp: number;
  tiles: Record<string, TileState>;
}

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });

/**
 * All farming rules. Time is always passed in (`now`, ms), never read from a clock,
 * so growth is deterministic, testable, and can be replayed after being offline.
 */
export class Farm {
  coins = START_COINS;
  xp = 0;
  private readonly tiles = new Map<string, TileState>();

  get level(): number {
    return levelFromXp(this.xp);
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

  status(i: number, j: number, now: number): CropStatus | null {
    const crop = this.tile(i, j).crop;
    if (!crop) return null;
    const def = getCrop(crop.cropId);
    const elapsed = Math.max(0, now - crop.plantedAt);
    const half = def.growthMs / 2;

    let effective: number;
    let thirsty = false;
    let withered: boolean;
    let msToRipe: number | null = null;

    if (crop.watered) {
      effective = Math.max(0, elapsed - crop.pausedMs);
      const ripeAt = crop.plantedAt + crop.pausedMs + def.growthMs;
      withered = now > ripeAt + def.witherMs;
      if (!withered && effective < def.growthMs) msToRipe = ripeAt - now;
    } else {
      effective = Math.min(elapsed, half);
      thirsty = elapsed >= half;
      withered = elapsed > half + def.witherMs;
    }

    const progress = Math.min(1, effective / def.growthMs);
    const ripe = !withered && progress >= 1;
    const stage: CropStage = ripe ? 3 : progress < 0.15 ? 0 : progress < 0.45 ? 1 : 2;
    return { cropId: crop.cropId, progress, stage, thirsty: thirsty && !withered, ripe, withered, msToRipe };
  }

  /** Hoe: grass -> soil. */
  plow(i: number, j: number): ActionResult {
    if (!inBounds(i, j) || !isUnlocked(i, j)) return fail('locked-land');
    if (this.tile(i, j).kind !== 'grass') return fail('not-grass');
    this.tiles.set(tileKey(i, j), { kind: 'soil', crop: null });
    return this.done(0, 1);
  }

  /** Plant a seed in empty soil. Costs coins. */
  plant(i: number, j: number, cropId: CropId, now: number): ActionResult {
    if (!inBounds(i, j) || !isUnlocked(i, j)) return fail('locked-land');
    const tile = this.tile(i, j);
    if (tile.kind !== 'soil') return fail('not-soil');
    if (tile.crop) return fail('occupied');
    const def = getCrop(cropId);
    if (this.level < def.unlockLevel) return fail('crop-locked');
    if (this.coins < def.seedCost) return fail('no-coins');
    tile.crop = { cropId, plantedAt: now, watered: false, pausedMs: 0 };
    this.tiles.set(tileKey(i, j), tile);
    return this.done(-def.seedCost, 0);
  }

  /** Watering can: lets a crop grow past the halfway point. */
  water(i: number, j: number, now: number): ActionResult {
    const crop = this.tile(i, j).crop;
    if (!crop) return fail('no-crop');
    const status = this.status(i, j, now);
    if (status?.withered) return fail('withered');
    if (crop.watered) return fail('already-watered');
    const def = getCrop(crop.cropId);
    crop.pausedMs = Math.max(0, now - (crop.plantedAt + def.growthMs / 2));
    crop.watered = true;
    return this.done(0, 1);
  }

  /** Pick a ripe crop: pays coins and XP. The soil stays plowed for replanting. */
  harvest(i: number, j: number, now: number): ActionResult {
    const crop = this.tile(i, j).crop;
    if (!crop) return fail('no-crop');
    const status = this.status(i, j, now);
    if (status?.withered) return fail('withered');
    if (!status?.ripe) return fail('not-ripe');
    const def = getCrop(crop.cropId);
    this.tile(i, j).crop = null;
    return this.done(def.sellPrice, def.xp);
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

  toSnapshot(): FarmSnapshot {
    const tiles: Record<string, TileState> = {};
    for (const [key, tile] of this.tiles) {
      tiles[key] = { kind: tile.kind, crop: tile.crop ? { ...tile.crop } : null };
    }
    return { version: 1, coins: this.coins, xp: this.xp, tiles };
  }

  static fromSnapshot(snapshot: FarmSnapshot): Farm {
    const farm = new Farm();
    farm.coins = snapshot.coins;
    farm.xp = snapshot.xp;
    for (const [key, tile] of Object.entries(snapshot.tiles)) {
      farm.tiles.set(key, { kind: tile.kind, crop: tile.crop ? { ...tile.crop } : null });
    }
    return farm;
  }

  private done(coins: number, xp: number): ActionResult {
    const before = this.level;
    this.coins += coins;
    this.xp += xp;
    const after = this.level;
    return { ok: true, gain: { coins, xp, levelUp: after > before ? after : null } };
  }
}
