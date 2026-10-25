/**
 * @module core/crops
 *
 * The crop table: ids, rarity, prices, growth times and colours, as plain data. The rules in `farm.ts` read it; the renderer
 * picks a procedural model from `shape`; the shop, the seed truck and the saves all derive their lists from `CROP_ORDER`.
 *
 * To add a crop: see docs/How-To-Add-Content.md. Always run `tests/pace.test.ts` after touching prices or times.
 *
 * NEXT(content): seasons or weather would be a growth multiplier applied in `Farm.growth`; keep it a pure function of the wall clock
 *   so replays still agree.
 */

export type CropId =
  | 'cenoura'
  | 'trigo'
  | 'milho'
  | 'tomate'
  | 'morango'
  | 'cana'
  | 'abobora'
  | 'girassol'
  | 'melancia'
  | 'pitaya'
  | 'uva'
  | 'flor';

/**
 * How special a seed is. It sets the profit premium over the level's base curve, how often the seed truck
 * brings it, and (for the top two) the chance of a golden harvest that yields double.
 */
export type Rarity = 'comum' | 'incomum' | 'rara' | 'epica';

export interface RarityDef {
  readonly id: Rarity;
  readonly name: string;
  /** Multiplier on the base profit per tile-minute (documentation and tests; prices are set per crop). */
  readonly premium: number;
  /** Share of a truck draw, compared with a comum seed. */
  readonly truckWeight: number;
  /** Chance that a ripe crop is golden and yields two. */
  readonly goldenChance: number;
  /** CSS colour for badges. */
  readonly color: string;
}

export const RARITIES: Readonly<Record<Rarity, RarityDef>> = {
  comum: { id: 'comum', name: 'Comum', premium: 1, truckWeight: 1, goldenChance: 0, color: '#b9a37c' },
  incomum: { id: 'incomum', name: 'Incomum', premium: 1.1, truckWeight: 0.6, goldenChance: 0, color: '#4fae3a' },
  rara: { id: 'rara', name: 'Rara', premium: 1.4, truckWeight: 0.2, goldenChance: 1 / 10, color: '#3f7fe0' },
  epica: { id: 'epica', name: 'Épica', premium: 1.8, truckWeight: 0.05, goldenChance: 1 / 6, color: '#e0a21a' },
};

/** Drives which procedural model is used when rendering the crop. */
export type CropShape = 'cane' | 'root' | 'grain' | 'tall' | 'bush' | 'berry' | 'gourd' | 'sunflower' | 'melon' | 'cactus' | 'vine' | 'moon';

export interface CropDef {
  readonly id: CropId;
  readonly name: string;
  /** A line of flavour text shown before buying. */
  readonly lore: string;
  readonly emoji: string;
  readonly shape: CropShape;
  readonly rarity: Rarity;
  readonly unlockLevel: number;
  readonly seedCost: number;
  readonly sellPrice: number;
  readonly xp: number;
  /** Time from planting (once watered) to ripe. Tuned for short play sessions; raise later. */
  readonly growthMs: number;
  /** How long a ripe (or forgotten, thirsty) crop survives before it withers. */
  readonly witherMs: number;
  readonly colors: { readonly leaf: number; readonly fruit: number };
}

const MIN = 60_000;

export const CROPS: Readonly<Record<CropId, CropDef>> = {
  cenoura: {
    id: 'cenoura',
    rarity: 'comum',
    name: 'Cenoura',
    lore: 'Crocante e apressada: a primeira amiga de toda horta. Ótima para quem está começando.',
    emoji: '🥕',
    shape: 'root',
    unlockLevel: 1,
    seedCost: 10,
    sellPrice: 20,
    xp: 2,
    growthMs: 45_000,
    witherMs: 10 * MIN,
    colors: { leaf: 0x4fae3a, fruit: 0xff8a1f },
  },
  trigo: {
    id: 'trigo',
    rarity: 'comum',
    name: 'Trigo',
    lore: 'Dourado ao sol, vira ração de galinha e pão de domingo. Quem planta trigo nunca fica sem serviço.',
    emoji: '🌾',
    shape: 'grain',
    unlockLevel: 1,
    seedCost: 15,
    sellPrice: 35,
    xp: 3,
    growthMs: 90_000,
    witherMs: 15 * MIN,
    colors: { leaf: 0x7cc042, fruit: 0xf0c542 },
  },
  milho: {
    id: 'milho',
    rarity: 'comum',
    name: 'Milho',
    lore: 'Alto e orgulhoso, adora sol. Vaca nenhuma resiste a uma ração de milho bem moído.',
    emoji: '🌽',
    shape: 'tall',
    unlockLevel: 2,
    seedCost: 30,
    sellPrice: 75,
    xp: 5,
    growthMs: 3 * MIN,
    witherMs: 30 * MIN,
    colors: { leaf: 0x3f9a3a, fruit: 0xffd93b },
  },
  tomate: {
    id: 'tomate',
    rarity: 'incomum',
    name: 'Tomate',
    lore: 'Vermelho e suculento. Os porcos são loucos por ele, mas a planta pede rega e atenção.',
    emoji: '🍅',
    shape: 'bush',
    unlockLevel: 3,
    seedCost: 45,
    sellPrice: 160,
    xp: 6,
    growthMs: 6 * MIN,
    witherMs: 45 * MIN,
    colors: { leaf: 0x3d9a45, fruit: 0xe5372b },
  },
  morango: {
    id: 'morango',
    rarity: 'incomum',
    name: 'Morango',
    lore: 'Docinho e delicado. Dá bom lucro, mas não perdoa quem esquece de cuidar.',
    emoji: '🍓',
    shape: 'berry',
    unlockLevel: 5,
    seedCost: 80,
    sellPrice: 345,
    xp: 8,
    growthMs: 12 * MIN,
    witherMs: 60 * MIN,
    colors: { leaf: 0x37a04a, fruit: 0xf0405a },
  },
  abobora: {
    id: 'abobora',
    rarity: 'incomum',
    name: 'Abóbora',
    lore: 'A rainha da horta! Demora para crescer, mas cada uma vale muitas moedas.',
    emoji: '🎃',
    shape: 'gourd',
    unlockLevel: 8,
    seedCost: 150,
    sellPrice: 810,
    xp: 8,
    growthMs: 25 * MIN,
    witherMs: 90 * MIN,
    colors: { leaf: 0x3a8f3a, fruit: 0xff8c1a },
  },
  girassol: {
    id: 'girassol',
    rarity: 'incomum',
    name: 'Girassol',
    lore: 'Vira o rosto para o sol o dia inteiro. Suas sementes e flores pagam bem para quem tem paciência.',
    emoji: '🌻',
    shape: 'sunflower',
    unlockLevel: 10,
    seedCost: 220,
    sellPrice: 1260,
    xp: 9,
    growthMs: 35 * MIN,
    witherMs: 2 * 60 * MIN,
    colors: { leaf: 0x4a9a2e, fruit: 0xffc61a },
  },
  melancia: {
    id: 'melancia',
    rarity: 'incomum',
    name: 'Melancia',
    lore: 'Enorme, listrada e docinha. Faz o verão durar o ano todo na vila e rende uma boa soma.',
    emoji: '🍉',
    shape: 'melon',
    unlockLevel: 14,
    seedCost: 300,
    sellPrice: 2010,
    xp: 10,
    growthMs: 50 * MIN,
    witherMs: 150 * MIN,
    colors: { leaf: 0x2f8a3a, fruit: 0x58b04a },
  },
  cana: {
    id: 'cana',
    rarity: 'comum',
    name: 'Cana-de-açúcar',
    lore: 'Alta, doce e teimosa. Dela saem o açúcar, o caldo e metade das sobremesas do Brasil. Sem cana, a confeitaria fecha.',
    emoji: '🎋',
    shape: 'cane',
    unlockLevel: 6,
    seedCost: 90,
    sellPrice: 330,
    xp: 7,
    growthMs: 10 * MIN,
    witherMs: 60 * MIN,
    colors: { leaf: 0x5aa83a, fruit: 0x9a3f78 },
  },
  pitaya: {
    id: 'pitaya',
    rarity: 'rara',
    name: 'Pitaya',
    lore: 'A fruta-dragão: um cacto de flor noturna e fruto rosa-choque. Semente cara, rara de achar, e que paga o que custa.',
    emoji: '🐉',
    shape: 'cactus',
    unlockLevel: 15,
    seedCost: 1100,
    sellPrice: 3800,
    xp: 12,
    growthMs: 60 * MIN,
    witherMs: 180 * MIN,
    colors: { leaf: 0x4ea36a, fruit: 0xe83a8c },
  },
  uva: {
    id: 'uva',
    rarity: 'rara',
    name: 'Uva',
    lore: 'Cachos roxos pendurados na latada. Demora a amadurecer e exige parreira, mas é a joia do pomar.',
    emoji: '🍇',
    shape: 'vine',
    unlockLevel: 18,
    seedCost: 1000,
    sellPrice: 5400,
    xp: 14,
    growthMs: 90 * MIN,
    witherMs: 240 * MIN,
    colors: { leaf: 0x4f9a3a, fruit: 0x7a3fb0 },
  },
  flor: {
    id: 'flor',
    rarity: 'epica',
    name: 'Flor-da-lua',
    lore: 'Só abre quando o céu escurece e brilha como se guardasse um pedaço da lua. Quem a cultiva vira lenda na vila.',
    emoji: '🌙',
    shape: 'moon',
    unlockLevel: 25,
    seedCost: 2500,
    sellPrice: 11600,
    xp: 18,
    growthMs: 120 * MIN,
    witherMs: 360 * MIN,
    colors: { leaf: 0x3f9a8a, fruit: 0xdcecff },
  },
};

export const CROP_ORDER: readonly CropId[] = [
  'cenoura',
  'trigo',
  'milho',
  'tomate',
  'morango',
  'cana',
  'abobora',
  'girassol',
  'melancia',
  'pitaya',
  'uva',
  'flor',
];

export function getCrop(id: CropId): CropDef {
  return CROPS[id];
}
