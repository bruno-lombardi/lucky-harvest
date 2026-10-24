import { CropId } from './crops';

/** Each species lives in its own pen and eats its own feed. */
export type SpeciesId = 'galinha' | 'vaca' | 'porco';
export type ProductId = 'ovo' | 'leite' | 'trufa';

export const SPECIES_ORDER: readonly SpeciesId[] = ['galinha', 'vaca', 'porco'];
export const PRODUCT_ORDER: readonly ProductId[] = ['ovo', 'leite', 'trufa'];

const MIN = 60_000;

export interface ProductDef {
  readonly id: ProductId;
  readonly name: string;
  readonly lore: string;
  readonly sellPrice: number;
}

export interface FeedRecipe {
  /** Crops consumed per batch. */
  readonly inputs: Readonly<Partial<Record<CropId, number>>>;
  /** Feed produced per batch. */
  readonly yield: number;
}

export interface SpeciesDef {
  readonly id: SpeciesId;
  readonly name: string;
  readonly penName: string;
  /** Flavour text for the animal and its pen. */
  readonly lore: string;
  /** Flavour text for the feed. */
  readonly feedLore: string;
  readonly feedName: string;
  readonly product: ProductId;
  readonly unlockLevel: number;
  readonly penCost: number;
  readonly animalCost: number;
  /** Animals the pen holds, per pen level (index 0 = level 1). Add entries to make pens upgradable. */
  readonly capacity: readonly number[];
  /** Cost to reach each pen level above 1 (index 0 = level 2). */
  readonly upgradeCost: readonly number[];
  /** Time from feeding to a collectable product. */
  readonly cycleMs: number;
  readonly xp: number;
  /** Price of a ready-made bag of feed in the shop. */
  readonly feedPrice: number;
  readonly recipe: FeedRecipe;
}

export const PRODUCTS: Readonly<Record<ProductId, ProductDef>> = {
  ovo: { id: 'ovo', name: 'Ovo', lore: 'Fresquinho, ainda morno do ninho. Serve para o café da manhã de toda a vila.', sellPrice: 40 },
  leite: { id: 'leite', name: 'Leite', lore: 'Tirado de manhã cedo, cremoso e docinho. A vila inteira vem buscar.', sellPrice: 120 },
  trufa: { id: 'trufa', name: 'Trufa', lore: 'Um tesouro escondido na lama que só o focinho de um porco encontra. Os cozinheiros pagam caro.', sellPrice: 260 },
};

export const SPECIES: Readonly<Record<SpeciesId, SpeciesDef>> = {
  galinha: {
    id: 'galinha',
    name: 'Galinha',
    penName: 'Galinheiro',
    lore: 'Cacarejam desde o nascer do sol e põem ovos sem reclamar. A primeira moradora de toda fazenda.',
    feedLore: 'Grãos de trigo moídos, do jeito que as galinhas gostam.',
    feedName: 'Ração de galinha',
    product: 'ovo',
    unlockLevel: 2,
    penCost: 250,
    animalCost: 120,
    capacity: [4, 5, 6],
    upgradeCost: [2000, 5000],
    cycleMs: 3 * MIN,
    xp: 6,
    feedPrice: 15,
    recipe: { inputs: { trigo: 2 }, yield: 3 },
  },
  vaca: {
    id: 'vaca',
    name: 'Vaca',
    penName: 'Curral',
    lore: 'Mansas e pacientes, comem sem pressa e dão leite fresco. Gostam de companhia e de um capim fofo.',
    feedLore: 'Milho moído e misturado, gostoso e cheio de força.',
    feedName: 'Ração de vaca',
    product: 'leite',
    unlockLevel: 4,
    penCost: 900,
    animalCost: 500,
    capacity: [3, 4, 5],
    upgradeCost: [3500, 9000],
    cycleMs: 8 * MIN,
    xp: 18,
    feedPrice: 45,
    recipe: { inputs: { milho: 2 }, yield: 2 },
  },
  porco: {
    id: 'porco',
    name: 'Porco',
    penName: 'Chiqueiro',
    lore: 'Fuçadores e gulosos. Passam o dia na lama atrás de trufas: dão pouco, mas valem muito.',
    feedLore: 'Tomate amassado e bem temperado. Porco que come bem, fareja melhor.',
    feedName: 'Ração de porco',
    product: 'trufa',
    unlockLevel: 6,
    penCost: 2200,
    animalCost: 1200,
    capacity: [3, 4, 5],
    upgradeCost: [5000, 12000],
    cycleMs: 15 * MIN,
    xp: 40,
    feedPrice: 100,
    recipe: { inputs: { tomate: 3 }, yield: 2 },
  },
};

export const getSpecies = (id: SpeciesId): SpeciesDef => SPECIES[id];
export const getProduct = (id: ProductId): ProductDef => PRODUCTS[id];

/** How many animals a pen of this level holds. */
export function penCapacity(species: SpeciesId, level: number): number {
  const table = SPECIES[species].capacity;
  return table[Math.min(Math.max(level, 1), table.length) - 1]!;
}

/** Player level needed to upgrade a pen to each tier above 1 (index 0 = tier 2). */
export const PEN_UPGRADE_LEVELS: readonly number[] = [9, 15];

/** Share of the base cycle a pen of each tier needs: bigger pens are faster. */
export const PEN_CYCLE_FACTOR: readonly number[] = [1, 0.85, 0.7];

/** The next pen upgrade, or null at the top tier. */
export function nextPenUpgrade(
  species: SpeciesId,
  level: number,
): { level: number; cost: number; unlockLevel: number } | null {
  const cost = SPECIES[species].upgradeCost[level - 1];
  const unlockLevel = PEN_UPGRADE_LEVELS[level - 1];
  return cost === undefined || unlockLevel === undefined ? null : { level: level + 1, cost, unlockLevel };
}

/** Time from feeding to a product for a pen of this tier. */
export function penCycleMs(species: SpeciesId, level: number): number {
  const factor = PEN_CYCLE_FACTOR[Math.min(Math.max(level, 1), PEN_CYCLE_FACTOR.length) - 1]!;
  return Math.round(SPECIES[species].cycleMs * factor);
}

export interface AnimalState {
  id: number;
  /** When the product will be ready, or null while the animal is hungry. */
  readyAt: number | null;
}

export interface PenState {
  level: number;
  animals: AnimalState[];
}

export type AnimalPhase = 'hungry' | 'working' | 'ready';

export interface AnimalStatus {
  phase: AnimalPhase;
  /** Time until the product is ready (only while working). */
  msToReady: number | null;
  /** 0..1 progress of the current cycle. */
  progress: number;
}

export function animalStatus(species: SpeciesId, animal: AnimalState, now: number, penLevel = 1): AnimalStatus {
  if (animal.readyAt === null) return { phase: 'hungry', msToReady: null, progress: 0 };
  const cycle = penCycleMs(species, penLevel);
  if (now >= animal.readyAt) return { phase: 'ready', msToReady: null, progress: 1 };
  const left = animal.readyAt - now;
  return { phase: 'working', msToReady: left, progress: Math.max(0, 1 - left / cycle) };
}
