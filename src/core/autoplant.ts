/**
 * Tonico's top tier: he also plows, sows and waters. The player tunes him with these settings.
 * Pure data and validation: the work itself is simulated by `Farm.walk`.
 */

import { CROP_ORDER, CropId, getCrop } from './crops';

/** How Tonico picks what to sow. */
export type PlantMode =
  /** The most profitable seed among the allowed ones. */
  | 'melhor'
  /** The first allowed seed in the order the player listed. */
  | 'ordem'
  /** A different one every time, drawn from the allowed seeds. */
  | 'variar';

/** How chatty Tonico is. Only changes the speech bubbles. */
export type Humor = 'quieto' | 'falante' | 'cantor';

export interface AutoPlant {
  /** Master switch: when off, Tonico only harvests, as in the lower levels. */
  on: boolean;
  mode: PlantMode;
  /** The seeds he may sow, in order of preference. Empty means every seed the player has unlocked. */
  crops: CropId[];
  /** Buy seeds when the barn runs out. */
  buy: boolean;
  /** Coins he never spends on seeds: the purse stays at or above this. */
  reserve: number;
  /** Plow bare grass to make room. */
  plow: boolean;
  /** Water what he sows. */
  water: boolean;
  /** Leave rare and epic seeds alone (and only use the ones the player already has when false). */
  skipRare: boolean;
  humor: Humor;
}

export const PLANT_MODES: readonly PlantMode[] = ['melhor', 'ordem', 'variar'];
export const HUMORS: readonly Humor[] = ['quieto', 'falante', 'cantor'];
/** The reserve choices the dialog offers. */
export const RESERVES: readonly number[] = [0, 100, 500, 2000, 10000];
export const MAX_RESERVE = 1_000_000;

export const MODE_INFO: Readonly<Record<PlantMode, { name: string; text: string }>> = {
  melhor: { name: 'O que rende mais', text: 'Escolhe a semente com o melhor lucro por minuto.' },
  ordem: { name: 'Na ordem da lista', text: 'Usa a primeira semente da sua lista que estiver à mão.' },
  variar: { name: 'Variar sempre', text: 'Sorteia a cada canteiro. Uma horta sortida e imprevisível.' },
};

export const HUMOR_INFO: Readonly<Record<Humor, { name: string; icon: string; text: string }>> = {
  quieto: { name: 'Quieto', icon: '🤐', text: 'Trabalha em silêncio.' },
  falante: { name: 'Falante', icon: '🗣️', text: 'Resmunga e comenta o que está plantando.' },
  cantor: { name: 'Cantor', icon: '🎶', text: 'Canta sozinho enquanto trabalha. Desafina.' },
};

export const defaultAutoPlant = (): AutoPlant => ({
  on: true,
  mode: 'melhor',
  crops: [],
  buy: true,
  reserve: 100,
  plow: true,
  water: true,
  skipRare: false,
  humor: 'falante',
});

/** Rebuilds the settings from anything found in a save or a command: bad fields fall back to the defaults. */
export function normalizeAutoPlant(raw: unknown): AutoPlant {
  const out = defaultAutoPlant();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r['on'] === 'boolean') out.on = r['on'];
  if (PLANT_MODES.includes(r['mode'] as PlantMode)) out.mode = r['mode'] as PlantMode;
  if (Array.isArray(r['crops'])) {
    out.crops = [...new Set((r['crops'] as unknown[]).filter((c): c is CropId => CROP_ORDER.includes(c as CropId)))];
  }
  if (typeof r['buy'] === 'boolean') out.buy = r['buy'];
  if (typeof r['reserve'] === 'number' && Number.isFinite(r['reserve'])) out.reserve = Math.min(Math.max(Math.floor(r['reserve']), 0), MAX_RESERVE);
  if (typeof r['plow'] === 'boolean') out.plow = r['plow'];
  if (typeof r['water'] === 'boolean') out.water = r['water'];
  if (typeof r['skipRare'] === 'boolean') out.skipRare = r['skipRare'];
  if (HUMORS.includes(r['humor'] as Humor)) out.humor = r['humor'] as Humor;
  return out;
}

export const cloneAutoPlant = (a: AutoPlant): AutoPlant => normalizeAutoPlant(a);

/** Profit per minute of a seed, used by the "melhor" mode. */
export const profitRate = (id: CropId): number => {
  const c = getCrop(id);
  return ((c.sellPrice - c.seedCost) / c.growthMs) * 60_000;
};

/** The seeds Tonico may sow at this player level, in the order he should try them. `roll` is a 0..1 draw for "variar". */
export function plantOrder(cfg: AutoPlant, level: number, roll: number): CropId[] {
  const unlocked = (id: CropId): boolean => getCrop(id).unlockLevel <= level;
  const rare = (id: CropId): boolean => {
    const r = getCrop(id).rarity;
    return r === 'rara' || r === 'epica';
  };
  const base = (cfg.crops.length > 0 ? cfg.crops : CROP_ORDER).filter((id) => unlocked(id) && !(cfg.skipRare && rare(id)));
  if (cfg.mode === 'ordem') return [...base];
  if (cfg.mode === 'melhor') return [...base].sort((a, b) => profitRate(b) - profitRate(a) || CROP_ORDER.indexOf(a) - CROP_ORDER.indexOf(b));
  if (base.length === 0) return [];
  const start = Math.min(base.length - 1, Math.floor(roll * base.length));
  return [...base.slice(start), ...base.slice(0, start)];
}

/** What Tonico mutters. Picked by a deterministic hash so replays agree; the text itself is cosmetic. */
export const TALK: Readonly<Record<Humor, readonly string[]>> = {
  quieto: [],
  falante: [
    'Essa aqui vai dar bom!',
    'Cresce, florzinha, cresce.',
    'No meu tempo era tudo na enxada.',
    'Mais uma pra conta.',
    'Quem planta colhe. E eu planto bastante.',
    'Hoje a terra está de bom humor.',
    'Ai, minhas costas... brincadeira.',
    'Isso é que é trabalho de gente grande.',
  ],
  cantor: [
    '🎵 Lá-lá-rá, semente no chão 🎵',
    '🎶 Ô, minha enxada, não me abandona 🎶',
    '🎵 Planta aqui, planta ali 🎵',
    '🎶 Cenoura, cenoura, meu amor 🎶',
    '🎵 Trá-lá-lá, que dia bonito 🎵',
    '🎶 Eu sou o rei da horta! 🎶',
  ],
};

/** A line for the given draw, or null when he is quiet. */
export function sayLine(humor: Humor, roll: number): string | null {
  const lines = TALK[humor];
  if (lines.length === 0) return null;
  return lines[Math.min(lines.length - 1, Math.floor(roll * lines.length))]!;
}
