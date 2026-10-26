/**
 * @module demo
 *
 * A showcase farm for `?demo`: every crop at every stage, trees, animals, helpers, decorations, a rich inventory. Used for screenshots,
 * profiling (`window.__lh`) and eyeballing new models. It never touches the player's real save. When you add content, add it here too.
 */

import { AnimalState, SPECIES, SpeciesId } from './core/animals';
import { CROPS, CROP_ORDER, CropId } from './core/crops';
import { HOME, HelperState } from './core/helpers';
import { CropState, Farm, FarmSnapshot, LAND, MAX_LAND, TileState } from './core/farm';
import { emptyStats } from './core/stats';
import { TreeId, TreeState } from './core/trees';
import { slotOf } from './core/delivery';
import { tileKey } from './core/grid';
import { levelThreshold } from './core/levels';
import { mulberry32 } from './core/noise';

const MIN = 60_000;

/** One tree of each species at a different stage, so every model can be looked at. */
function demoTrees(now: number): FarmSnapshot['trees'] {
  const tree = (species: TreeId, ageMin: number, over: Partial<TreeState> = {}): TreeState => ({
    species, plantedAt: now - ageMin * MIN, watered: true, anchorAt: now - ageMin * MIN, anchorGrowth: 0, pestAt: null, pestKind: null, ...over,
  });
  return {
    [tileKey(11, 3)]: tree('laranjeira', 1),
    [tileKey(12, 3)]: tree('laranjeira', 12),
    [tileKey(13, 3)]: tree('goiabeira', 20, { watered: false }),
    [tileKey(14, 3)]: tree('mangueira', 80),
    [tileKey(15, 3)]: tree('jabuticabeira', 10_000),
    [tileKey(16, 3)]: tree('coqueiro', 10_000),
    [tileKey(11, 2)]: tree('laranjeira', 10_000),
    [tileKey(13, 2)]: tree('mangueira', 10_000),
    [tileKey(15, 2)]: tree('coqueiro', 40, { pestAt: now - 5 * MIN, pestKind: 'bug' }),
    [tileKey(16, 2)]: tree('jabuticabeira', 3),
  };
}

/**
 * A pre-populated farm for previews and screenshots (open the game with `?demo`).
 * The first six rows show every crop at every stage; the rest of the plot is filled at random.
 */
export function createDemoFarm(now: number): Farm {
  const tiles: Record<string, TileState> = {};
  const rand = mulberry32(2024);

  const make = (cropId: CropId, progress: number, over: Partial<CropState> = {}): CropState => {
    const plantedAt = now - progress * CROPS[cropId].growthMs;
    return {
      cropId,
      plantedAt,
      watered: true,
      anchorAt: plantedAt,
      anchorGrowth: 0,
      pestAt: null,
      pestKind: null,
      ...over,
    };
  };
  const grown = (cropId: CropId, progress: number): CropState => make(cropId, progress);
  const thirsty = (cropId: CropId): CropState => make(cropId, 0.6, { watered: false });
  const withered = (cropId: CropId): CropState =>
    make(cropId, 1 + (CROPS[cropId].witherMs + 5000) / CROPS[cropId].growthMs);
  /** Growth froze 20 s into the infestation; the crop keeps its progress until it is cleaned. */
  const infested = (cropId: CropId, kind: 'weed' | 'bug'): CropState => {
    const def = CROPS[cropId];
    const pestAt = now - 20_000;
    return make(cropId, 0.55, { anchorAt: pestAt, anchorGrowth: 0.35 * def.growthMs, pestAt, pestKind: kind });
  };

  const put = (i: number, j: number, crop: CropState | null): void => {
    tiles[tileKey(i, j)] = { kind: 'soil', crop };
  };

  CROP_ORDER.forEach((id, row) => {
    const j = LAND.min + row;
    const states: (CropState | null)[] = [
      grown(id, 0.05),
      grown(id, 0.3),
      grown(id, 0.7),
      thirsty(id),
      grown(id, 1),
      withered(id),
      row % 2 === 0 ? infested(id, 'weed') : infested(id, 'bug'),
    ];
    states.forEach((crop, col) => put(LAND.min + col, j, crop));
  });

  for (let j = LAND.min; j <= LAND.max; j++) {
    for (let i = LAND.min + 7; i <= LAND.max; i++) {
      if (rand() < 0.15) continue; // leave a few bare grass tiles
      const id = CROP_ORDER[Math.floor(rand() * CROP_ORDER.length)]!;
      put(i, j, rand() < 0.8 ? grown(id, 0.2 + rand() * 0.9) : null);
    }
  }

  // Pens with animals in every state: hungry, producing, and ready to collect.
  const animal = (id: number, state: 'hungry' | 'working' | 'ready', species: SpeciesId): AnimalState => ({
    id,
    readyAt: state === 'hungry' ? null : state === 'ready' ? now - 1000 : now + SPECIES[species].cycleMs * 0.4,
  });
  const pens: FarmSnapshot['pens'] = {
    galinha: {
      level: 1,
      animals: [animal(1, 'ready', 'galinha'), animal(2, 'working', 'galinha'), animal(3, 'hungry', 'galinha'), animal(4, 'ready', 'galinha')],
    },
    vaca: { level: 1, animals: [animal(5, 'working', 'vaca'), animal(6, 'ready', 'vaca'), animal(7, 'hungry', 'vaca')] },
    porco: { level: 1, animals: [animal(8, 'hungry', 'porco'), animal(9, 'working', 'porco')] },
  };

  const helper = (level: number, home: { u: number; v: number }): HelperState => ({
    level,
    paidUntil: now + 9 * 60_000,
    paid: true,
    nextAt: now + 1500,
    leftAt: now,
    from: { ...home },
    target: { ...home },
    working: false,
    lastAt: 0,
  });

  const snapshot: FarmSnapshot = {
    version: 8,
    barn: 2,
    pomar: true,
    saplings: { laranjeira: 2, goiabeira: 1, mangueira: 1, jabuticabeira: 0, coqueiro: 0 },
    fruit: { laranjeira: 8, goiabeira: 4, mangueira: 0, jabuticabeira: 6, coqueiro: 0 },
    trees: demoTrees(now),
    deliveredSlot: slotOf(now),
    truck: { big: false, fast: false },
    stats: emptyStats(),
    claimed: [],
    decor: { banco: true, flores: true, lanterna: true, balanco: true, fonte: true, coreto: true },
    seed: 20240601,
    revision: 0,
    nextAnimalId: 10,
    coins: 1250,
    xp: levelThreshold(20) + 120,
    landSize: MAX_LAND,
    seeds: Object.fromEntries(CROP_ORDER.map((id) => [id, 12])) as FarmSnapshot['seeds'],
    produce: Object.fromEntries(CROP_ORDER.map((id, n) => [id, 3 + n * 2])) as FarmSnapshot['produce'],
    products: { ovo: 5, leite: 3, trufa: 1 },
    feed: { galinha: 6, vaca: 3, porco: 2 },
    fertilizer: { esterco: 12, composto: 4, humus: 2, lua: 1 },
    pens,
    helpers: {
      regador: helper(2, { u: 12, v: 12 }),
      ajudante: helper(2, HOME.ajudante),
      gato: helper(1, HOME.gato),
      cao: helper(1, HOME.cao),
      tratador: helper(2, HOME.tratador),
    },
    tiles,
  };
  return Farm.fromSnapshot(snapshot);
}
