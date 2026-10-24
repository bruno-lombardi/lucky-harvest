import { Rarity } from './crops';

export type TreeId = 'laranjeira' | 'goiabeira' | 'mangueira' | 'jabuticabeira' | 'coqueiro';

export const TREE_ORDER: readonly TreeId[] = ['laranjeira', 'goiabeira', 'mangueira', 'jabuticabeira', 'coqueiro'];

export interface TreeDef {
  readonly id: TreeId;
  readonly name: string;
  /** Name of the sapling and of the fruit it gives. */
  readonly fruitName: string;
  readonly emoji: string;
  readonly lore: string;
  readonly rarity: Rarity;
  readonly unlockLevel: number;
  readonly saplingCost: number;
  /** Time from planting (once watered) to adult. A young tree stalls halfway until watered once. */
  readonly growMs: number;
  /** Time an adult tree needs to ripen its fruit again after a harvest. */
  readonly cycleMs: number;
  /** Fruits per harvest. */
  readonly fruits: number;
  readonly fruitPrice: number;
  /** XP per fruit picked. */
  readonly xp: number;
  readonly colors: { readonly leaf: number; readonly leaf2: number; readonly trunk: number; readonly fruit: number };
}

const MIN = 60_000;

export const TREES: Readonly<Record<TreeId, TreeDef>> = {
  laranjeira: {
    id: 'laranjeira', name: 'Laranjeira', fruitName: 'Laranja', emoji: '🍊', rarity: 'comum', unlockLevel: 11,
    lore: 'Copa redonda e verde-escura. Dá laranjas suculentas.',
    saplingCost: 600, growMs: 20 * MIN, cycleMs: 30 * MIN, fruits: 4, fruitPrice: 95, xp: 2,
    colors: { leaf: 0x2f7d32, leaf2: 0x3f9a3c, trunk: 0x7a5232, fruit: 0xff9a1f },
  },
  goiabeira: {
    id: 'goiabeira', name: 'Goiabeira', fruitName: 'Goiaba', emoji: '🍈', rarity: 'incomum', unlockLevel: 13,
    lore: 'Copa larga e clara, tronco liso. As goiabas amadurecem amarelas.',
    saplingCost: 900, growMs: 25 * MIN, cycleMs: 35 * MIN, fruits: 4, fruitPrice: 150, xp: 3,
    colors: { leaf: 0x6fb04a, leaf2: 0x8cc85c, trunk: 0x9a7a52, fruit: 0xe8d84a },
  },
  mangueira: {
    id: 'mangueira', name: 'Mangueira', fruitName: 'Manga', emoji: '🥭', rarity: 'rara', unlockLevel: 16,
    lore: 'Alta e frondosa. As mangas vermelhas ficam penduradas.',
    saplingCost: 2500, growMs: 45 * MIN, cycleMs: 60 * MIN, fruits: 5, fruitPrice: 280, xp: 5,
    colors: { leaf: 0x1f6b35, leaf2: 0x2c8a43, trunk: 0x6a4a2e, fruit: 0xf0602a },
  },
  jabuticabeira: {
    id: 'jabuticabeira', name: 'Jabuticabeira', fruitName: 'Jabuticaba', emoji: '🫐', rarity: 'rara', unlockLevel: 20,
    lore: 'Frutas roxas brotam direto do tronco e dos galhos.',
    saplingCost: 4000, growMs: 60 * MIN, cycleMs: 80 * MIN, fruits: 6, fruitPrice: 340, xp: 6,
    colors: { leaf: 0x2a6a3a, leaf2: 0x3a8450, trunk: 0x8a6a4a, fruit: 0x4a1a5e },
  },
  coqueiro: {
    id: 'coqueiro', name: 'Coqueiro', fruitName: 'Coco', emoji: '🥥', rarity: 'epica', unlockLevel: 26,
    lore: 'Palmeira alta com um cacho de cocos no alto.',
    saplingCost: 8000, growMs: 90 * MIN, cycleMs: 120 * MIN, fruits: 4, fruitPrice: 1100, xp: 8,
    colors: { leaf: 0x3d8a3a, leaf2: 0x57a64a, trunk: 0x9a7c58, fruit: 0x6a4a2a },
  },
};

export const getTree = (id: TreeId): TreeDef => TREES[id];

/** Chance, at planting and after each harvest, that a pest shows up during the next stretch of growth. */
export const TREE_PEST_CHANCE = 0.2;

/** The Pomar: a fenced orchard beside the windmill, bought once. Trees can only be planted here. */
export const POMAR = { cost: 3000, level: 10, i0: 11, i1: 16, j0: 1, j1: 3 } as const;

export function isOrchardTile(i: number, j: number): boolean {
  return i >= POMAR.i0 && i <= POMAR.i1 && j >= POMAR.j0 && j <= POMAR.j1;
}

export function orchardTiles(): Array<{ i: number; j: number }> {
  const out: Array<{ i: number; j: number }> = [];
  for (let j = POMAR.j0; j <= POMAR.j1; j++) for (let i = POMAR.i0; i <= POMAR.i1; i++) out.push({ i, j });
  return out;
}

/** Coins per minute one tree earns when every harvest is picked right away (documentation and tests). */
export function coinsPerMinute(id: TreeId): number {
  const t = TREES[id];
  return (t.fruits * t.fruitPrice) / (t.cycleMs / MIN);
}

export interface TreeState {
  species: TreeId;
  plantedAt: number;
  /** Young trees stall halfway until watered once; adults never need water again. */
  watered: boolean;
  /** Same anchor idea as crops: at `anchorAt` the tree had `anchorGrowth` ms of growth (youth, then fruit cycle). */
  anchorAt: number;
  anchorGrowth: number;
  pestAt: number | null;
  pestKind: 'weed' | 'bug' | null;
}

/** 0 muda, 1 jovem, 2 adulta, 3 adulta com frutas. */
export type TreeStage = 0 | 1 | 2 | 3;

export interface TreeStatus {
  species: TreeId;
  stage: TreeStage;
  /** 0..1 of the youth, then 0..1 of the fruit cycle once adult. */
  progress: number;
  adult: boolean;
  thirsty: boolean;
  ripe: boolean;
  pest: 'weed' | 'bug' | null;
  msToRipe: number | null;
}

export function treeStatus(tree: TreeState, now: number): TreeStatus {
  const def = TREES[tree.species];
  const total = def.growMs + def.cycleMs;
  const cap = tree.watered ? total : def.growMs / 2;
  const pestActive = tree.pestAt !== null && now >= tree.pestAt;
  const growEnd = pestActive ? Math.max(tree.anchorAt, tree.pestAt!) : now;
  const g = Math.min(cap, tree.anchorGrowth + Math.max(0, growEnd - tree.anchorAt));
  const adult = g >= def.growMs;
  const ripe = g >= total;
  const thirsty = !tree.watered && g >= cap;
  const stage: TreeStage = ripe ? 3 : adult ? 2 : g < def.growMs * 0.2 ? 0 : 1;
  const progress = adult ? Math.min(1, (g - def.growMs) / def.cycleMs) : g / def.growMs;
  const msToRipe = !thirsty && !pestActive && !ripe ? tree.anchorAt + (total - tree.anchorGrowth) - now : null;
  return { species: tree.species, stage, progress, adult, thirsty, ripe, pest: pestActive ? tree.pestKind : null, msToRipe };
}

/** Growth so far, in ms, for re-anchoring. */
export function treeGrowth(tree: TreeState, now: number): number {
  const def = TREES[tree.species];
  const cap = tree.watered ? def.growMs + def.cycleMs : def.growMs / 2;
  const pestActive = tree.pestAt !== null && now >= tree.pestAt;
  const growEnd = pestActive ? Math.max(tree.anchorAt, tree.pestAt!) : now;
  return Math.min(cap, tree.anchorGrowth + Math.max(0, growEnd - tree.anchorAt));
}
