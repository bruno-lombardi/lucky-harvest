import { applyCommand } from '../../src/core/commands';
import { CROPS, CROP_ORDER, CropId } from '../../src/core/crops';
import { Farm, landBounds } from '../../src/core/farm';
import { POMAR, TREES, TREE_ORDER, coinsPerMinute, orchardTiles } from '../../src/core/trees';

export interface PaceOptions {
  /** Seconds between the bot's visits to the farm. */
  visitSec?: number;
  maxHours?: number;
  seed?: number;
  /** Share of the plot the player tends (the rest is left alone), 0..1. */
  coverage?: number;
  /** Stop when this level is reached. */
  stopLevel?: number;
  /** Also buy the Pomar and keep it planted with the best tree it can afford. */
  orchard?: boolean;
}

export interface PaceResult {
  /** Minutes of play at which each level was first reached. */
  levelAt: Record<number, number>;
  farm: Farm;
  coinsEarned: number;
}

/**
 * A simple active player: visits the farm on a fixed rhythm, harvests, clears, cares, sells, plants the best
 * crop it can afford everywhere, waters, and buys land when it can. It ignores animals and helpers, so it
 * measures the crop economy alone.
 */
export function playCrops({ visitSec = 45, maxHours = 12, seed = 1, coverage = 1, stopLevel = 21, orchard = false }: PaceOptions = {}): PaceResult {
  const T0 = 1_800_000_000_000;
  const farm = new Farm({ seed, now: T0 });
  const levelAt: Record<number, number> = { 1: 0 };
  const visit = visitSec * 1000;
  const cmd = (c: Parameters<typeof applyCommand>[1], now: number): boolean => applyCommand(farm, c, now).ok;

  const score = (id: CropId): number => {
    const c = CROPS[id];
    return (c.sellPrice - c.seedCost) / (c.growthMs + visit / 2);
  };

  for (let now = T0 + visit; now <= T0 + maxHours * 3_600_000; now += visit) {
    farm.runHelpers(now);
    const { min, max } = landBounds(farm.landSize);
    const free: Array<[number, number]> = [];
    const rows = Math.max(1, Math.round((max - min + 1) * coverage));
    for (let j = min; j < min + rows; j++) {
      for (let i = min; i <= max; i++) {
        const status = farm.status(i, j, now);
        const tile = farm.tile(i, j);
        if (tile.crop) {
          if (status?.withered) cmd({ type: 'tool', tool: 'limpar', i, j, crop: 'cenoura' }, now);
          else if (status?.pest) cmd({ type: 'tool', tool: 'cuidar', i, j, crop: 'cenoura' }, now);
          else if (status?.ripe) {
            cmd({ type: 'tool', tool: 'colher', i, j, crop: 'cenoura' }, now);
            free.push([i, j]);
          } else if (!tile.crop.watered) cmd({ type: 'tool', tool: 'regar', i, j, crop: 'cenoura' }, now);
        } else free.push([i, j]);
      }
    }
    cmd({ type: 'sellAll' }, now);

    // Land first when it is within reach, then seeds for the empty tiles.
    const step = farm.nextExpansion();
    if (step && farm.level >= step.level && farm.coins >= step.cost) cmd({ type: 'expandLand' }, now);

    if (orchard) tendOrchard(farm, now, cmd);

    const unlocked = CROP_ORDER.filter((id) => CROPS[id].unlockLevel <= farm.level).sort((a, b) => score(b) - score(a));
    for (const [i, j] of free) {
      let pick: CropId | undefined = unlocked.find((id) => farm.seeds[id] > 0);
      // Buy the best crop we can afford for this tile if its score beats what is in stock.
      const best = unlocked.find((id) => farm.coins >= CROPS[id].seedCost);
      if (best && (!pick || score(best) > score(pick))) {
        if (cmd({ type: 'buySeeds', crop: best, qty: 1 }, now)) pick = best;
      }
      if (!pick) continue;
      if (farm.tile(i, j).kind === 'grass') cmd({ type: 'tool', tool: 'arar', i, j, crop: pick }, now);
      if (cmd({ type: 'tool', tool: 'semear', i, j, crop: pick }, now)) cmd({ type: 'tool', tool: 'regar', i, j, crop: pick }, now);
    }

    if (levelAt[farm.level] === undefined) {
      for (let l = 2; l <= farm.level; l++) if (levelAt[l] === undefined) levelAt[l] = (now - T0) / 60_000;
    }
    if (farm.level >= stopLevel) break;
  }
  return { levelAt, farm, coinsEarned: farm.stats.coinsEarned };
}

/** Buys the Pomar when it can, then harvests, cares, waters and replants every tree spot. */
function tendOrchard(farm: Farm, now: number, cmd: (c: Parameters<typeof applyCommand>[1], now: number) => boolean): void {
  if (!farm.pomar) {
    if (farm.level >= POMAR.level && farm.coins >= POMAR.cost) cmd({ type: 'buyPomar' }, now);
    return;
  }
  const species = TREE_ORDER.filter((id) => TREES[id].unlockLevel <= farm.level).sort((a, b) => coinsPerMinute(b) - coinsPerMinute(a));
  for (const { i, j } of orchardTiles()) {
    const status = farm.treeStatus(i, j, now);
    if (status) {
      if (status.pest) cmd({ type: 'tool', tool: 'cuidar', i, j, crop: 'cenoura' }, now);
      else if (status.ripe) cmd({ type: 'tool', tool: 'colher', i, j, crop: 'cenoura' }, now);
      else if (status.thirsty) cmd({ type: 'tool', tool: 'regar', i, j, crop: 'cenoura' }, now);
      continue;
    }
    const pick = species.find((id) => farm.saplings[id] > 0) ?? species.find((id) => farm.coins >= TREES[id].saplingCost);
    if (!pick) continue;
    if (farm.saplings[pick] < 1 && !cmd({ type: 'buySapling', tree: pick, qty: 1 }, now)) continue;
    if (cmd({ type: 'tool', tool: 'semear', i, j, crop: 'cenoura', tree: pick }, now)) cmd({ type: 'tool', tool: 'regar', i, j, crop: 'cenoura' }, now);
  }
  cmd({ type: 'sellAll' }, now);
}
