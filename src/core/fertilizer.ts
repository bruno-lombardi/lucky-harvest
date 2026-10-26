/**
 * @module core/fertilizer
 *
 * Fertilizers (adubos): a consumable that skips a fixed slice of a growing crop's time. They are never sold. They come only
 * as gifts: a small one for most level-ups and a few for achievement medals (`levelGift`, and the `gifts` on achievements in
 * progress.ts). That keeps them a treat instead of a way to skip the pacing, and leaves room for a premium currency later
 * (see NEXT below).
 *
 * The effect is a fixed number of milliseconds (not a percentage), so a 10-minute dose finishes a carrot on the spot but only
 * nibbles a 2-hour Luz da lua. The rules live in `Farm.fertilize`; this file is just the data.
 *
 * NEXT(economy): once there is a premium currency, add a shop price here (coins would break the "reward only" idea, so use the
 *   premium currency only). Keep `ms` as the single tuning knob.
 * NEXT(content): fertilizing orchard trees (same anchor model in trees.ts) and a "bulk" apply-to-field helper.
 */

import { Rarity } from './crops';

export type FertilizerId = 'esterco' | 'composto' | 'humus' | 'lua';

export const FERTILIZER_ORDER: readonly FertilizerId[] = ['esterco', 'composto', 'humus', 'lua'];

const MIN = 60_000;

export interface FertilizerDef {
  readonly id: FertilizerId;
  readonly name: string;
  /** Time skipped on one crop. */
  readonly ms: number;
  /** Only used for the colour of badges and the shine of the icon. */
  readonly rarity: Rarity;
  readonly lore: string;
}

export const FERTILIZERS: Readonly<Record<FertilizerId, FertilizerDef>> = {
  esterco: {
    id: 'esterco',
    name: 'Esterco curtido',
    ms: 10 * MIN,
    rarity: 'comum',
    lore: 'O adubo de sempre, direto do curral. Cenoura e trigo amadurecem na hora; as outras ganham um bom empurrão.',
  },
  composto: {
    id: 'composto',
    name: 'Composto da Dona Zefa',
    ms: 30 * MIN,
    rarity: 'incomum',
    lore: 'Casca de legume, palha e muita paciência. Dona Zefa jura que ele faz milagre em horta cansada.',
  },
  humus: {
    id: 'humus',
    name: 'Húmus de minhoca',
    ms: 60 * MIN,
    rarity: 'rara',
    lore: 'Escuro, fofo e cheirando a chuva. Uma hora de crescimento num punhado só.',
  },
  lua: {
    id: 'lua',
    name: 'Poeira de lua',
    ms: 120 * MIN,
    rarity: 'epica',
    lore: 'Brilha no escuro. Duas horas inteiras, o suficiente para fazer a Luz da lua florescer de uma vez.',
  },
};

export type FertilizerStock = Record<FertilizerId, number>;
/** A bundle of fertilizers handed out as a reward. */
export type FertilizerGift = Partial<Record<FertilizerId, number>>;

export const emptyFertilizer = (): FertilizerStock => ({ esterco: 0, composto: 0, humus: 0, lua: 0 });

export const totalFertilizer = (stock: FertilizerStock): number => FERTILIZER_ORDER.reduce((n, id) => n + stock[id], 0);

/** Rebuilds a stock from anything found in a save: unknown keys dropped, bad or missing counts become zero. */
export function normalizeFertilizer(raw: unknown): FertilizerStock {
  const out = emptyFertilizer();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const id of FERTILIZER_ORDER) {
    const n = r[id];
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[id] = Math.floor(n);
  }
  return out;
}

/** First level that brings a gift. */
export const FIRST_GIFT_LEVEL = 3;

/**
 * What reaching `level` gives. One small dose most levels, a Composto every fifth, a Húmus every tenth and
 * Poeira de lua at 25 and 50. Through level 50 that is 40 Esterco, 10 Composto, 5 Húmus and 2 Poeira de lua.
 * Pure function of the level, so the server can verify it.
 */
export function levelGift(level: number): FertilizerGift {
  if (!Number.isInteger(level) || level < FIRST_GIFT_LEVEL) return {};
  const gift: FertilizerGift = {};
  if (level % 5 !== 0) gift.esterco = 1;
  else gift.composto = 1;
  if (level % 10 === 0) gift.humus = 1;
  if (level % 25 === 0) gift.lua = 1;
  return gift;
}

/** Sum of the gifts for every level in (from, to]. */
export function levelGifts(from: number, to: number): FertilizerGift {
  let sum: FertilizerGift = {};
  for (let level = from + 1; level <= to; level++) sum = mergeGifts(sum, levelGift(level));
  return sum;
}

export function mergeGifts(a: FertilizerGift, b: FertilizerGift): FertilizerGift {
  const out: FertilizerGift = { ...a };
  for (const id of FERTILIZER_ORDER) {
    const n = b[id];
    if (n) out[id] = (out[id] ?? 0) + n;
  }
  return out;
}

export const giftCount = (gift: FertilizerGift): number => FERTILIZER_ORDER.reduce((n, id) => n + (gift[id] ?? 0), 0);

/** "10 min", "30 min", "1 h", "2 h" (and "45 s" for a short crop that finishes early). */
export function skipLabel(ms: number): string {
  if (ms < MIN) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const minutes = Math.round(ms / MIN);
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

/** "2 Esterco curtido + 1 Composto da Dona Zefa". */
export function giftText(gift: FertilizerGift): string {
  return FERTILIZER_ORDER.filter((id) => gift[id])
    .map((id) => `${gift[id]}× ${FERTILIZERS[id].name}`)
    .join(' + ');
}
