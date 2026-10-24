/**
 * Farm helpers: characters and machines that do a chore for the player and cost wages to keep running.
 * Everything here is pure data and arithmetic. The actual work is simulated by `Farm.runHelpers`,
 * a deterministic function of the farm state and the clock, so a server can reproduce it.
 */

import { barnTier } from './barn';

export type HelperId = 'regador' | 'ajudante' | 'gato' | 'cao' | 'tratador';
/** The helpers that walk around (everyone but the sprinklers). */
export type WalkerId = Exclude<HelperId, 'regador'>;

export const HELPER_ORDER: readonly HelperId[] = ['regador', 'ajudante', 'gato', 'cao', 'tratador'];

export const MIN = 60_000;
/** Wages are charged once per period, automatically, while the owner can afford them. */
export const WAGE_PERIOD_MS = 10 * MIN;
/** A helper never works through more than this much time the player was away. */
export const OFFLINE_LIMIT_MS = 30 * MIN;
/** How often an idle walker looks for new work. */
export const POLL_MS = 3000;

export interface HelperDef {
  readonly id: HelperId;
  /** What the helper is called in the interface. */
  readonly name: string;
  /** The chore, in a few words. */
  readonly job: string;
  /** Flavour text shown before hiring. */
  readonly lore: string;
  /** Animals charge a "custo" to stay on the farm; people charge a "salário". */
  readonly animal: boolean;
  readonly unlockLevel: number;
  readonly hireCost: number;
  /** Cost to reach each level above 1 (index 0 = level 2). */
  readonly upgradeCost: readonly number[];
  /** Wage per period, by level (index 0 = level 1). */
  readonly wage: readonly number[];
  /** What each level does, for the shop. */
  readonly perks: readonly string[];
}

export const HELPERS: Readonly<Record<HelperId, HelperDef>> = {
  regador: {
    id: 'regador',
    name: 'Regador do moinho',
    job: 'rega as plantações sozinho',
    lore: 'O moinho bombeia água do poço até aspersores de latão espalhados pela horta. Gira, gira, rega.',
    animal: false,
    unlockLevel: 3,
    hireCost: 400,
    upgradeCost: [700, 1500],
    wage: [20, 35, 55],
    perks: ['2 aspersores, regam a cada 15 s', '4 aspersores, a cada 10 s', '6 aspersores, a cada 6 s'],
  },
  ajudante: {
    id: 'ajudante',
    name: 'Tonico, o ajudante',
    job: 'colhe as plantas maduras',
    lore: 'Seu Tonico cuida de hortas desde antes de você nascer. Chapéu de palha, bigode e muita paciência.',
    animal: false,
    unlockLevel: 5,
    hireCost: 900,
    upgradeCost: [1400, 3000],
    wage: [60, 100, 160],
    perks: ['Caminha devagar, colhe uma por vez', 'Mais rápido e colhe com mais jeito', 'Corre pela horta e colhe num instante'],
  },
  gato: {
    id: 'gato',
    name: 'Mingau, o gato',
    job: 'espanta pragas e ervas daninhas',
    lore: 'Mingau chegou de mansinho e ficou. Não se sabe se gosta de você, mas pragas ele detesta.',
    animal: true,
    unlockLevel: 7,
    hireCost: 600,
    upgradeCost: [1000, 2200],
    wage: [30, 50, 80],
    perks: ['Atento, mas dorminhoco', 'Mais ágil na caçada', 'Pula em cima das pragas num piscar de olhos'],
  },
  cao: {
    id: 'cao',
    name: 'Rex, o cão',
    job: 'recolhe os produtos dos abrigos',
    lore: 'Rex trota de abrigo em abrigo, fareja o que está pronto e leva tudo para o celeiro. Só pede um carinho e o custo da ração.',
    animal: true,
    unlockLevel: 12,
    hireCost: 3000,
    upgradeCost: [4500, 9000],
    wage: [150, 240, 360],
    perks: ['Trota devagar, recolhe um abrigo por vez', 'Mais veloz e recolhe mais rápido', 'Corre de abrigo em abrigo sem parar'],
  },
  tratador: {
    id: 'tratador',
    name: 'Lúcia, a tratadora',
    job: 'dá ração aos animais dos abrigos',
    lore: 'Dona Lúcia acorda antes do galo. Pega um saco de ração no celeiro e não deixa bicho nenhum esperando.',
    animal: false,
    unlockLevel: 10,
    hireCost: 2500,
    upgradeCost: [4000, 8000],
    wage: [120, 200, 300],
    perks: ['Anda devagar e alimenta um abrigo por vez', 'Mais rápida, alimenta num instante', 'Corre de abrigo em abrigo sem parar'],
  },
};

export const MAX_HELPER_LEVEL = 3;

export const getHelper = (id: HelperId): HelperDef => HELPERS[id];

/** What the helper costs per period; a better barn lowers it. */
export const helperWage = (id: HelperId, level: number, barn = 1): number =>
  Math.round(HELPERS[id].wage[Math.min(Math.max(level, 1), MAX_HELPER_LEVEL) - 1]! * barnTier(barn).costMul);

/** "salário" for people, "custo" for animals. */
export const payWord = (id: HelperId): 'salário' | 'custo' => (HELPERS[id].animal ? 'custo' : 'salário');

export function nextHelperUpgrade(id: HelperId, level: number): { level: number; cost: number } | null {
  const cost = HELPERS[id].upgradeCost[level - 1];
  return cost === undefined ? null : { level: level + 1, cost };
}

/** A position on the island in tile units: world x = u - 12, world z = v - 12 (tile (i, j) is centred at i + .5, j + .5). */
export interface Spot {
  u: number;
  v: number;
}

export interface HelperState {
  level: number;
  /** Wages are covered up to this time; at that moment the next wage is taken from the coins. */
  paidUntil: number;
  /** False after a wage could not be paid: the helper stands idle until the player pays. */
  paid: boolean;
  /** When the next step of the helper's routine happens (a work step, or a sprinkler pulse). */
  nextAt: number;
  /** Walkers: when they left `from` for `target` (position is interpolated from this, so it survives a reload). */
  leftAt: number;
  from: Spot;
  /** Walkers: the tile they are heading to, or their home while idle. */
  target: Spot;
  /** True while `target` is a chore; false while walking home or resting. */
  working: boolean;
  /** Sprinklers: when the last pulse happened (drives the spray animation). */
  lastAt: number;
  /** Walkers: tiles per second of the current walk (set when it starts, so a barn upgrade never makes anyone jump). */
  speed?: number;
}

/** Walkers rest here when there is nothing to do. */
export const HOME: Readonly<Record<WalkerId, Spot>> = {
  ajudante: { u: 5.9, v: 12.9 },
  gato: { u: 6.4, v: 9.2 },
  cao: { u: 19.3, v: 19.9 },
  tratador: { u: 4.4, v: 12.4 },
};

/**
 * Where the dog stands to collect from each pen: the lane between the fence and the pens' back wall
 * (the pens sit at the positions in render/pens.ts).
 */
export const PEN_SPOTS: Readonly<Record<'galinha' | 'porco' | 'vaca', Spot>> = {
  galinha: { u: 19.35, v: 8.7 },
  porco: { u: 19.35, v: 12.9 },
  vaca: { u: 19.25, v: 17.3 },
};

export interface WalkerStats {
  /** Tiles per second. */
  speed: number;
  /** Time spent working once there. */
  workMs: number;
}

export const WALKERS: Readonly<Record<WalkerId, readonly WalkerStats[]>> = {
  ajudante: [
    { speed: 1.5, workMs: 1500 },
    { speed: 2.2, workMs: 1100 },
    { speed: 3.2, workMs: 750 },
  ],
  gato: [
    { speed: 2.4, workMs: 1100 },
    { speed: 3.2, workMs: 800 },
    { speed: 4.4, workMs: 550 },
  ],
  cao: [
    { speed: 2.2, workMs: 1400 },
    { speed: 3.0, workMs: 1000 },
    { speed: 4.0, workMs: 700 },
  ],
  tratador: [
    { speed: 1.6, workMs: 1800 },
    { speed: 2.3, workMs: 1300 },
    { speed: 3.2, workMs: 900 },
  ],
};

export function walkerStats(id: WalkerId, level: number, barn = 1): WalkerStats {
  const base = WALKERS[id][Math.min(Math.max(level, 1), MAX_HELPER_LEVEL) - 1]!;
  const mul = barnTier(barn).speedMul;
  return { speed: base.speed * mul, workMs: base.workMs / mul };
}

/** Sprinkler pulse interval and head count by level. */
export const SPRINKLER_INTERVAL_MS: readonly number[] = [15_000, 10_000, 6000];
export const sprinklerHeadCount = (level: number): number => level * 2;

/** Where the island fence has its gate, in tile units (walkers cross the fence only there). */
export function gateSpot(landSize: number): Spot {
  return { u: 12 - landSize / 2 - 0.45, v: 13 };
}

/** True when the straight segment passes through the (slightly shrunk) rectangle. */
function crossesSquare(a: Spot, b: Spot, half: number): boolean {
  const lo = 12 - half + 0.05;
  const hi = 12 + half - 0.05;
  let t0 = 0;
  let t1 = 1;
  for (const [p, d] of [[a.u, b.u - a.u], [a.v, b.v - a.v]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 >= t1) return false;
  }
  return true;
}

/**
 * The path a walker takes: straight, unless it has to pass through the gate in the fence,
 * or go around the fenced plot when the straight line would cut through it.
 */
export function route(from: Spot, to: Spot, landSize: number): Spot[] {
  const half = landSize / 2 + 0.45;
  const inside = (s: Spot): boolean => Math.abs(s.u - 12) < half && Math.abs(s.v - 12) < half;
  if (inside(from) !== inside(to)) return [from, gateSpot(landSize), to];
  if (inside(from) || !crossesSquare(from, to, half)) return [from, to];
  // Both outside, with the plot in between: walk around it by the shorter side.
  const h = half + 0.6;
  const corners: Spot[] = [
    { u: 12 - h, v: 12 - h },
    { u: 12 + h, v: 12 - h },
    { u: 12 + h, v: 12 + h },
    { u: 12 - h, v: 12 + h },
  ];
  let best: Spot[] = [from, to];
  let bestLength = Infinity;
  for (let n = 0; n < 4; n++) {
    for (const step of [1, 3]) {
      const first = corners[n]!;
      const second = corners[(n + step) % 4]!;
      if (crossesSquare(from, first, half) || crossesSquare(second, to, half)) continue;
      const path = [from, first, second, to];
      const length = routeLength(path);
      if (length < bestLength - 1e-9) {
        bestLength = length;
        best = path;
      }
    }
  }
  return best;
}

export function routeLength(points: readonly Spot[]): number {
  let total = 0;
  for (let n = 1; n < points.length; n++) total += Math.hypot(points[n]!.u - points[n - 1]!.u, points[n]!.v - points[n - 1]!.v);
  return total;
}

/** Where a point a given distance along a route is. */
export function pointAlong(points: readonly Spot[], distance: number): Spot {
  let left = Math.max(0, distance);
  for (let n = 1; n < points.length; n++) {
    const a = points[n - 1]!;
    const b = points[n]!;
    const length = Math.hypot(b.u - a.u, b.v - a.v);
    if (left <= length || n === points.length - 1) {
      const t = length === 0 ? 1 : Math.min(1, left / length);
      return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t };
    }
    left -= length;
  }
  return points[points.length - 1]!;
}

export interface WalkerPose {
  at: Spot;
  /** Direction of travel in radians (0 faces +z in the scene, atan2(dx, dz)). */
  heading: number;
  mode: 'walking' | 'working' | 'resting';
  /** 0..1 within the current work animation. */
  workProgress: number;
}

/** Where a walker is and what it is doing at `now`, derived purely from its saved state. */
export function walkerPose(id: WalkerId, state: HelperState, landSize: number, now: number): WalkerPose {
  const stats = walkerStats(id, state.level);
  const speed = state.speed ?? stats.speed;
  const path = route(state.from, state.target, landSize);
  const length = routeLength(path);
  const walkMs = (length / speed) * 1000;
  const arriveAt = state.leftAt + walkMs;
  const elapsed = Math.max(0, now - state.leftAt);

  const headingOf = (distance: number): number => {
    const a = pointAlong(path, Math.max(0, distance - 0.05));
    const b = pointAlong(path, distance + 0.05);
    return Math.atan2(b.u - a.u, b.v - a.v);
  };

  if (now < arriveAt) {
    const distance = (elapsed / 1000) * speed;
    return { at: pointAlong(path, distance), heading: headingOf(distance), mode: 'walking', workProgress: 0 };
  }
  const end = path[path.length - 1]!;
  const heading = length > 0.01 ? headingOf(length) : 0;
  if (state.working && now < state.nextAt) {
    return { at: end, heading, mode: 'working', workProgress: Math.min(1, (now - arriveAt) / Math.max(1, state.nextAt - arriveAt)) };
  }
  return { at: end, heading, mode: 'resting', workProgress: 0 };
}

/** The sprinkler heads for a plot: a lattice with a head every third tile, filled in a fixed order. */
export function sprinklerSpots(landSize: number, level: number): Array<{ i: number; j: number }> {
  const min = 12 - landSize / 2;
  const max = 11 + landSize / 2;
  const all: Array<{ i: number; j: number }> = [];
  for (let j = min + 1; j <= max; j += 3) for (let i = min + 1; i <= max; i += 3) all.push({ i, j });
  return all.slice(0, sprinklerHeadCount(level));
}
