/**
 * The Confeitaria: goods Dona Zefa makes from the farm's crops, animal products and fruit.
 * Pure data and arithmetic. Prices follow from the ingredients, so a finished good always pays
 * more than the raw things that went into it, and the recipes give XP on top.
 */

import { PRODUCTS, ProductId } from './animals';
import { CROPS, CropId } from './crops';
import { TREES, TreeId } from './trees';

export type GoodId =
  | 'farinha'
  | 'fuba'
  | 'manteiga'
  | 'queijo'
  | 'acucar'
  | 'pao'
  | 'geleiamorango'
  | 'paodequeijo'
  | 'oleo'
  | 'sucolaranja'
  | 'bolofuba'
  | 'bolocenoura'
  | 'docedeabobora'
  | 'pudim'
  | 'goiabada'
  | 'sucomelancia'
  | 'geleiapitaya'
  | 'tortamanga'
  | 'sucouva'
  | 'geleiajabuticaba'
  | 'beijinho';

export const GOOD_ORDER: readonly GoodId[] = [
  'farinha',
  'fuba',
  'manteiga',
  'queijo',
  'acucar',
  'pao',
  'geleiamorango',
  'paodequeijo',
  'oleo',
  'sucolaranja',
  'bolofuba',
  'bolocenoura',
  'docedeabobora',
  'pudim',
  'goiabada',
  'sucomelancia',
  'geleiapitaya',
  'tortamanga',
  'sucouva',
  'geleiajabuticaba',
  'beijinho',
];

export type GoodStock = Record<GoodId, number>;
export const emptyGoods = (): GoodStock => Object.fromEntries(GOOD_ORDER.map((id) => [id, 0])) as GoodStock;

/** Where an ingredient comes from. */
export type Ingredient =
  | { kind: 'crop'; id: CropId; qty: number }
  | { kind: 'product'; id: ProductId; qty: number }
  | { kind: 'fruit'; id: TreeId; qty: number }
  | { kind: 'good'; id: GoodId; qty: number };

export type GoodKind = 'base' | 'pao' | 'doce' | 'bebida';

export interface GoodDef {
  readonly id: GoodId;
  readonly name: string;
  readonly kind: GoodKind;
  readonly lore: string;
  /** Player level needed to make it. */
  readonly unlockLevel: number;
  readonly inputs: readonly Ingredient[];
  /** How many come out of one batch. */
  readonly yield: number;
  /** Time for one batch at the first tier. */
  readonly ms: number;
  /** XP per batch. */
  readonly xp: number;
  /** Value of the output compared with the ingredients: sets the price. */
  readonly markup: number;
  /** Coins per unit. Derived from the ingredients and the markup. */
  readonly sellPrice: number;
}

const SEC = 1000;
const MIN = 60 * SEC;

const crop = (id: CropId, qty: number): Ingredient => ({ kind: 'crop', id, qty });
const product = (id: ProductId, qty: number): Ingredient => ({ kind: 'product', id, qty });
const fruit = (id: TreeId, qty: number): Ingredient => ({ kind: 'fruit', id, qty });
const good = (id: GoodId, qty: number): Ingredient => ({ kind: 'good', id, qty });

type Raw = Omit<GoodDef, 'sellPrice'>;

const RAW: readonly Raw[] = [
  { id: 'farinha', name: 'Farinha de trigo', kind: 'base', lore: 'Trigo moído na pedra do moinho: a base de quase tudo que sai do forno.', unlockLevel: 8, inputs: [crop('trigo', 3)], yield: 2, ms: 45 * SEC, xp: 4, markup: 1.2 },
  { id: 'fuba', name: 'Fubá', kind: 'base', lore: 'Milho moído fininho, amarelo de dar gosto. Sem ele não existe bolo de fubá nem pão de queijo mineiro.', unlockLevel: 8, inputs: [crop('milho', 3)], yield: 2, ms: 60 * SEC, xp: 5, markup: 1.2 },
  { id: 'manteiga', name: 'Manteiga', kind: 'base', lore: 'Batida no pote até a nata virar ouro. A Zefa jura que o segredo é bater cantando.', unlockLevel: 8, inputs: [product('leite', 2)], yield: 2, ms: 60 * SEC, xp: 6, markup: 1.2 },
  { id: 'queijo', name: 'Queijo minas', kind: 'base', lore: 'Fresquinho, de massa macia. Esconde-se em todo pão de queijo que se preze.', unlockLevel: 9, inputs: [product('leite', 3)], yield: 2, ms: 90 * SEC, xp: 8, markup: 1.25 },
  { id: 'acucar', name: 'Açúcar', kind: 'base', lore: 'Caldo de cana cozido e cristalizado. O motivo de a confeitaria existir.', unlockLevel: 8, inputs: [crop('cana', 3)], yield: 3, ms: 2 * MIN, xp: 10, markup: 1.2 },
  { id: 'pao', name: 'Pão francês', kind: 'pao', lore: 'Casquinha crocante, miolo macio. Sai quentinho às seis da manhã e some antes das sete.', unlockLevel: 8, inputs: [good('farinha', 2), good('manteiga', 1)], yield: 4, ms: 90 * SEC, xp: 14, markup: 1.8 },
  { id: 'geleiamorango', name: 'Geleia de morango', kind: 'doce', lore: 'Vermelhinha, cozida em tacho de cobre e mexida com colher de pau.', unlockLevel: 9, inputs: [crop('morango', 3), good('acucar', 1)], yield: 3, ms: 2 * MIN, xp: 20, markup: 1.8 },
  { id: 'paodequeijo', name: 'Pão de queijo', kind: 'pao', lore: 'Bolinha dourada que estala por fora e estica por dentro. Ninguém come só um.', unlockLevel: 10, inputs: [good('fuba', 1), good('queijo', 1), product('ovo', 1)], yield: 6, ms: 2 * MIN, xp: 26, markup: 2.0 },
  { id: 'oleo', name: 'Óleo de girassol', kind: 'base', lore: 'Espremido a frio das sementes do girassol. Dourado e leve, bom para fritar e para vender.', unlockLevel: 10, inputs: [crop('girassol', 3)], yield: 2, ms: 90 * SEC, xp: 28, markup: 1.5 },
  { id: 'sucolaranja', name: 'Suco de laranja', kind: 'bebida', lore: 'Espremido na hora, com gelo e um pouquinho de pólen do pomar.', unlockLevel: 11, inputs: [fruit('laranjeira', 3)], yield: 3, ms: 90 * SEC, xp: 30, markup: 1.7 },
  { id: 'bolofuba', name: 'Bolo de fubá', kind: 'doce', lore: 'O bolo do café da tarde: farelento, cheirando a erva-doce e pedindo um café coado.', unlockLevel: 11, inputs: [good('fuba', 2), good('acucar', 1), product('leite', 1), product('ovo', 2)], yield: 1, ms: 3 * MIN, xp: 36, markup: 1.9 },
  { id: 'bolocenoura', name: 'Bolo de cenoura', kind: 'doce', lore: 'Fofinho, alaranjado, com cobertura de chocolate. Aniversário que se preze começa por ele.', unlockLevel: 12, inputs: [crop('cenoura', 3), good('farinha', 2), good('acucar', 1), product('ovo', 2)], yield: 1, ms: 3 * MIN, xp: 40, markup: 2.0 },
  { id: 'docedeabobora', name: 'Doce de abóbora', kind: 'doce', lore: 'Em pedaços macios na calda, com cravo e canela. Cheiro de fogão a lenha.', unlockLevel: 12, inputs: [crop('abobora', 3), good('acucar', 2)], yield: 3, ms: 4 * MIN, xp: 46, markup: 1.9 },
  { id: 'pudim', name: 'Pudim de leite', kind: 'doce', lore: 'Liso, sem furinhos, com calda de caramelo brilhando. A Zefa tem orgulho de cada um.', unlockLevel: 13, inputs: [product('leite', 2), product('ovo', 3), good('acucar', 2)], yield: 1, ms: 4 * MIN, xp: 54, markup: 2.1 },
  { id: 'goiabada', name: 'Goiabada', kind: 'doce', lore: 'Cascão ou cremosa? Aqui é cortada em barrinha, para comer com queijo: Romeu e Julieta.', unlockLevel: 13, inputs: [fruit('goiabeira', 3), good('acucar', 2)], yield: 3, ms: 5 * MIN, xp: 60, markup: 1.9 },
  { id: 'sucomelancia', name: 'Suco de melancia', kind: 'bebida', lore: 'Rosadinho e gelado, o melhor jeito de aguentar a tarde de verão na fazenda.', unlockLevel: 14, inputs: [crop('melancia', 2)], yield: 3, ms: 3 * MIN, xp: 52, markup: 1.6 },
  { id: 'geleiapitaya', name: 'Geleia de pitaya', kind: 'doce', lore: 'Cor de magenta de cinema, com sementinhas pretas. Parece de outro planeta e é uma delícia.', unlockLevel: 15, inputs: [crop('pitaya', 2), good('acucar', 1)], yield: 3, ms: 6 * MIN, xp: 70, markup: 1.7 },
  { id: 'tortamanga', name: 'Torta de manga', kind: 'doce', lore: 'Massa amanteigada e creme de manga madura. A vizinhança toda aparece sem avisar.', unlockLevel: 16, inputs: [fruit('mangueira', 2), good('farinha', 2), good('manteiga', 1), good('acucar', 1), product('ovo', 2)], yield: 1, ms: 6 * MIN, xp: 90, markup: 2.1 },
  { id: 'sucouva', name: 'Suco de uva', kind: 'bebida', lore: 'Roxo e encorpado, sem uma gota de álcool. Servido no copo de vidro da vovó.', unlockLevel: 18, inputs: [crop('uva', 2)], yield: 3, ms: 5 * MIN, xp: 76, markup: 1.6 },
  { id: 'geleiajabuticaba', name: 'Geleia de jabuticaba', kind: 'doce', lore: 'Preta e brilhante, colhida direto do tronco. Só quem tem jabuticabeira conhece o sabor.', unlockLevel: 20, inputs: [fruit('jabuticabeira', 3), good('acucar', 1)], yield: 3, ms: 7 * MIN, xp: 100, markup: 1.8 },
  { id: 'beijinho', name: 'Beijinho de coco', kind: 'doce', lore: 'Bolinha de coco ralado com cravo no topo. Doce de festa, sempre a primeira bandeja a acabar.', unlockLevel: 26, inputs: [fruit('coqueiro', 1), product('leite', 1), good('acucar', 1)], yield: 8, ms: 8 * MIN, xp: 150, markup: 1.9 },
];

const ingredientValue = (ing: Ingredient, price: (id: GoodId) => number): number => {
  switch (ing.kind) {
    case 'crop':
      return CROPS[ing.id].sellPrice * ing.qty;
    case 'product':
      return PRODUCTS[ing.id].sellPrice * ing.qty;
    case 'fruit':
      return TREES[ing.id].fruitPrice * ing.qty;
    case 'good':
      return price(ing.id) * ing.qty;
  }
};

const rounded = (n: number): number => (n < 100 ? Math.round(n / 5) * 5 : Math.round(n / 10) * 10);

const prices = new Map<GoodId, number>();
const rawOf = (id: GoodId): Raw => RAW.find((r) => r.id === id)!;
function priceOf(id: GoodId): number {
  const known = prices.get(id);
  if (known !== undefined) return known;
  const r = rawOf(id);
  const value = r.inputs.reduce((sum, ing) => sum + ingredientValue(ing, priceOf), 0);
  const price = Math.max(5, rounded((value * r.markup) / r.yield));
  prices.set(id, price);
  return price;
}

export const GOODS: Readonly<Record<GoodId, GoodDef>> = Object.fromEntries(
  RAW.map((r) => [r.id, { ...r, sellPrice: priceOf(r.id) } satisfies GoodDef]),
) as Record<GoodId, GoodDef>;

export const getGood = (id: GoodId): GoodDef => GOODS[id];

/** Raw value of everything one batch consumes, at sell prices. */
export const batchCost = (id: GoodId): number => GOODS[id].inputs.reduce((sum, ing) => sum + ingredientValue(ing, (g) => GOODS[g].sellPrice), 0);

// ---- The building and its baker --------------------------------------------

export interface BakeryTier {
  readonly level: number;
  readonly name: string;
  /** Batches that can be in the ovens at once. */
  readonly slots: number;
  /** Share of the base time: bigger ovens are quicker. */
  readonly timeMul: number;
  /** Cost and player level to reach this tier (tier 1 is the purchase itself). */
  readonly cost: number;
  readonly unlockLevel: number;
  readonly perk: string;
}

export const BAKERY_TIERS: readonly BakeryTier[] = [
  { level: 1, name: 'Confeitaria da Zefa', slots: 2, timeMul: 1, cost: 4000, unlockLevel: 8, perk: '2 fornadas ao mesmo tempo' },
  { level: 2, name: 'Confeitaria com salão', slots: 3, timeMul: 0.8, cost: 9000, unlockLevel: 15, perk: '3 fornadas, 20% mais rápido' },
  { level: 3, name: 'Grande doceria', slots: 4, timeMul: 0.65, cost: 26000, unlockLevel: 22, perk: '4 fornadas, 35% mais rápido' },
];
export const MAX_BAKERY_LEVEL = BAKERY_TIERS.length;
export const BAKERY_UNLOCK_LEVEL = BAKERY_TIERS[0]!.unlockLevel;
export const BAKERY_COST = BAKERY_TIERS[0]!.cost;
export const MAX_BATCHES = 5;
export const BATCH_OPTIONS: readonly number[] = [1, 3, 5];

export const bakeryTier = (level: number): BakeryTier => BAKERY_TIERS[Math.min(Math.max(Math.floor(level) || 1, 1), MAX_BAKERY_LEVEL) - 1]!;
export const nextBakeryTier = (level: number): BakeryTier | null => BAKERY_TIERS[level] ?? null;

/** How long `batches` batches take at a tier: several at once are cheaper per batch. */
export const bakeMs = (id: GoodId, level: number, batches: number): number =>
  Math.round(GOODS[id].ms * bakeryTier(level).timeMul * (1 + 0.6 * (batches - 1)));

/** One job in the ovens. */
export interface BakeJob {
  good: GoodId;
  batches: number;
  startedAt: number;
  readyAt: number;
}

export interface BakeryState {
  level: number;
  jobs: BakeJob[];
}

export function normalizeBakery(raw: unknown): BakeryState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const level = typeof r['level'] === 'number' && Number.isFinite(r['level']) ? Math.min(Math.max(Math.floor(r['level']), 1), MAX_BAKERY_LEVEL) : 1;
  const jobs: BakeJob[] = [];
  if (Array.isArray(r['jobs'])) {
    for (const j of r['jobs'] as unknown[]) {
      if (typeof j !== 'object' || j === null) continue;
      const o = j as Record<string, unknown>;
      if (!GOOD_ORDER.includes(o['good'] as GoodId)) continue;
      const batches = o['batches'];
      if (typeof batches !== 'number' || !Number.isInteger(batches) || batches < 1 || batches > MAX_BATCHES) continue;
      if (typeof o['startedAt'] !== 'number' || typeof o['readyAt'] !== 'number' || !Number.isFinite(o['startedAt']) || !Number.isFinite(o['readyAt'])) continue;
      jobs.push({ good: o['good'] as GoodId, batches, startedAt: o['startedAt'], readyAt: o['readyAt'] });
    }
  }
  return { level, jobs: jobs.slice(0, bakeryTier(level).slots) };
}

/** What Dona Zefa says now and then (cosmetic). */
export const ZEFA_LINES: readonly string[] = [
  'Já vai sair uma fornada, viu?',
  'Ai, que cheiro bom!',
  'Quem quer um bolinho?',
  'Pode vir que tem café coado.',
  'Mexe, mexe, mexe, que o doce pega!',
  'Isso aqui é receita da minha avó.',
];
