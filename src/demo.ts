import { AnimalState, SPECIES, SpeciesId } from './core/animals';
import { CROPS, CROP_ORDER, CropId } from './core/crops';
import { HOME, HelperState } from './core/helpers';
import { CropState, Farm, FarmSnapshot, LAND, MAX_LAND, TileState } from './core/farm';
import { tileKey } from './core/grid';
import { levelThreshold } from './core/levels';
import { mulberry32 } from './core/noise';

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
    version: 4,
    seed: 20240601,
    revision: 0,
    nextAnimalId: 10,
    coins: 1250,
    xp: levelThreshold(8) + 120,
    landSize: MAX_LAND,
    seeds: Object.fromEntries(CROP_ORDER.map((id) => [id, 12])) as FarmSnapshot['seeds'],
    produce: Object.fromEntries(CROP_ORDER.map((id, n) => [id, 3 + n * 2])) as FarmSnapshot['produce'],
    products: { ovo: 5, leite: 3, trufa: 1 },
    feed: { galinha: 6, vaca: 3, porco: 2 },
    pens,
    helpers: {
      regador: helper(2, { u: 12, v: 12 }),
      ajudante: helper(2, HOME.ajudante),
      gato: helper(1, HOME.gato),
    },
    tiles,
  };
  return Farm.fromSnapshot(snapshot);
}
