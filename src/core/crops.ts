export type CropId = 'cenoura' | 'trigo' | 'milho' | 'tomate' | 'morango' | 'abobora';

/** Drives which procedural model is used when rendering the crop. */
export type CropShape = 'root' | 'grain' | 'tall' | 'bush' | 'berry' | 'gourd';

export interface CropDef {
  readonly id: CropId;
  readonly name: string;
  readonly emoji: string;
  readonly shape: CropShape;
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
    name: 'Cenoura',
    emoji: '🥕',
    shape: 'root',
    unlockLevel: 1,
    seedCost: 10,
    sellPrice: 20,
    xp: 5,
    growthMs: 45_000,
    witherMs: 10 * MIN,
    colors: { leaf: 0x4fae3a, fruit: 0xff8a1f },
  },
  trigo: {
    id: 'trigo',
    name: 'Trigo',
    emoji: '🌾',
    shape: 'grain',
    unlockLevel: 1,
    seedCost: 15,
    sellPrice: 32,
    xp: 8,
    growthMs: 90_000,
    witherMs: 15 * MIN,
    colors: { leaf: 0x7cc042, fruit: 0xf0c542 },
  },
  milho: {
    id: 'milho',
    name: 'Milho',
    emoji: '🌽',
    shape: 'tall',
    unlockLevel: 2,
    seedCost: 30,
    sellPrice: 70,
    xp: 15,
    growthMs: 3 * MIN,
    witherMs: 30 * MIN,
    colors: { leaf: 0x3f9a3a, fruit: 0xffd93b },
  },
  tomate: {
    id: 'tomate',
    name: 'Tomate',
    emoji: '🍅',
    shape: 'bush',
    unlockLevel: 3,
    seedCost: 45,
    sellPrice: 110,
    xp: 22,
    growthMs: 6 * MIN,
    witherMs: 45 * MIN,
    colors: { leaf: 0x3d9a45, fruit: 0xe5372b },
  },
  morango: {
    id: 'morango',
    name: 'Morango',
    emoji: '🍓',
    shape: 'berry',
    unlockLevel: 5,
    seedCost: 80,
    sellPrice: 210,
    xp: 40,
    growthMs: 12 * MIN,
    witherMs: 60 * MIN,
    colors: { leaf: 0x37a04a, fruit: 0xf0405a },
  },
  abobora: {
    id: 'abobora',
    name: 'Abóbora',
    emoji: '🎃',
    shape: 'gourd',
    unlockLevel: 8,
    seedCost: 150,
    sellPrice: 420,
    xp: 80,
    growthMs: 25 * MIN,
    witherMs: 90 * MIN,
    colors: { leaf: 0x3a8f3a, fruit: 0xff8c1a },
  },
};

export const CROP_ORDER: readonly CropId[] = ['cenoura', 'trigo', 'milho', 'tomate', 'morango', 'abobora'];

export function getCrop(id: CropId): CropDef {
  return CROPS[id];
}
