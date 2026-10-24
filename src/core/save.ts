import { SPECIES_ORDER } from './animals';
import { LoggedCommand } from './commands';
import { CROPS } from './crops';
import { Farm, FarmSnapshot } from './farm';

/**
 * The save file: the whole farm, plus what a server needs to take over later.
 *
 *  - `state`    the current farm.
 *  - `baseline` the farm as the server last knew it (initially the very first state).
 *  - `outbox`   every successful command since `baseline`, with its timestamp.
 *
 * Replaying `outbox` on `baseline` always reproduces `state` (the rules are deterministic), so a
 * server can verify a client by replaying, or a client can recover from a server by re-applying
 * its outbox on top of a newer baseline.
 */
export const SAVE_FORMAT = 'lucky-harvest';
export const SAVE_VERSION = 1;

export interface SaveData {
  playerId: string;
  /** Wall-clock ms when the file was written. */
  savedAt: number;
  state: FarmSnapshot;
  sync: { baseline: FarmSnapshot; outbox: LoggedCommand[] };
}

export interface SaveFile extends SaveData {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  /** FNV-1a of the payload: catches truncated or hand-mangled files (it is not a security measure). */
  checksum: string;
}

export type DecodeResult = { ok: true; save: SaveFile } | { ok: false; error: string };

export function checksumOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const payloadOf = (data: SaveData): string =>
  JSON.stringify({ playerId: data.playerId, savedAt: data.savedAt, state: data.state, sync: data.sync });

export function encodeSave(data: SaveData): string {
  const file: SaveFile = { format: SAVE_FORMAT, version: SAVE_VERSION, checksum: checksumOf(payloadOf(data)), ...data };
  return JSON.stringify(file);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validates a snapshot found in a save and rebuilds it through Farm, which fills in anything missing
 * (new crops, new species) and drops anything unknown. Returns null if it is not a farm at all.
 */
export function normalizeSnapshot(raw: unknown): FarmSnapshot | null {
  if (!isObject(raw) || raw['version'] !== 3) return null;
  const { coins, xp, landSize, seed, revision, nextAnimalId, tiles } = raw;
  if (![coins, xp, landSize, seed, revision, nextAnimalId].every(isNumber) || !isObject(tiles)) return null;
  if ((coins as number) < 0 || (xp as number) < 0) return null;

  const clean = raw as unknown as FarmSnapshot;
  const safeTiles: FarmSnapshot['tiles'] = {};
  for (const [key, tile] of Object.entries(clean.tiles)) {
    if (!/^\d+,\d+$/.test(key) || !isObject(tile)) return null;
    if (tile['kind'] !== 'grass' && tile['kind'] !== 'soil') return null;
    const crop = tile['crop'];
    if (crop !== null) {
      if (!isObject(crop) || !(String(crop['cropId']) in CROPS)) return null;
      if (![crop['plantedAt'], crop['anchorAt'], crop['anchorGrowth']].every(isNumber)) return null;
    }
    safeTiles[key] = tile as unknown as FarmSnapshot['tiles'][string];
  }

  const pens: FarmSnapshot['pens'] = {};
  for (const species of SPECIES_ORDER) {
    const pen = isObject(clean.pens) ? clean.pens[species] : undefined;
    if (pen === undefined) continue;
    if (!isObject(pen) || !isNumber(pen.level) || !Array.isArray(pen.animals)) return null;
    if (!pen.animals.every((a) => isObject(a) && isNumber(a.id) && (a.readyAt === null || isNumber(a.readyAt)))) return null;
    pens[species] = pen;
  }

  try {
    return Farm.fromSnapshot({ ...clean, tiles: safeTiles, pens }).toSnapshot();
  } catch {
    return null;
  }
}

const isCommandLog = (v: unknown): v is LoggedCommand[] =>
  Array.isArray(v) && v.every((e) => isObject(e) && isObject(e['command']) && typeof e['command']['type'] === 'string' && isNumber(e['now']));

export function decodeSave(text: string): DecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um jogo salvo válido.' };
  }
  if (!isObject(raw) || raw['format'] !== SAVE_FORMAT) return { ok: false, error: 'Esse arquivo não é do Lucky Harvest.' };
  if (raw['version'] !== SAVE_VERSION) return { ok: false, error: 'Versão de jogo salvo não suportada.' };
  if (typeof raw['playerId'] !== 'string' || !isNumber(raw['savedAt']) || !isObject(raw['sync'])) {
    return { ok: false, error: 'O jogo salvo está incompleto.' };
  }

  const state = normalizeSnapshot(raw['state']);
  const baseline = normalizeSnapshot(raw['sync']['baseline']);
  const outbox = raw['sync']['outbox'];
  if (!state || !baseline || !isCommandLog(outbox)) return { ok: false, error: 'O jogo salvo está corrompido.' };

  const data: SaveData = { playerId: raw['playerId'], savedAt: raw['savedAt'], state, sync: { baseline, outbox } };
  // Checksum is over the file as written; normalising may add defaults, so compare against the original payload.
  const original = JSON.stringify({ playerId: raw['playerId'], savedAt: raw['savedAt'], state: raw['state'], sync: raw['sync'] });
  if (checksumOf(original) !== raw['checksum']) return { ok: false, error: 'O jogo salvo está corrompido (verificação falhou).' };
  return { ok: true, save: { format: SAVE_FORMAT, version: SAVE_VERSION, checksum: String(raw['checksum']), ...data } };
}
