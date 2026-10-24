/**
 * Barn upgrades. Each tier repaints and enlarges the barn and gives every helper a small buff:
 * lower wages (or care costs for the animals) and faster work.
 */
export interface BarnTier {
  readonly level: number;
  readonly name: string;
  readonly text: string;
  readonly cost: number;
  readonly unlockLevel: number;
  /** Multiplier on what helpers cost per period. */
  readonly costMul: number;
  /** Multiplier on how fast helpers walk, work and spray. */
  readonly speedMul: number;
}

export const BARN_TIERS: readonly BarnTier[] = [
  { level: 1, name: 'Celeiro', text: 'O celeiro de sempre: simples e firme.', cost: 0, unlockLevel: 1, costMul: 1, speedMul: 1 },
  {
    level: 2,
    name: 'Celeiro reforçado',
    text: 'Tinta nova, telhado firme e um cata-vento no alto.',
    cost: 3500,
    unlockLevel: 9,
    costMul: 0.9,
    speedMul: 1.1,
  },
  {
    level: 3,
    name: 'Celeiro de pedra',
    text: 'Base de pedra, janelas maiores e um silo ao lado.',
    cost: 12_000,
    unlockLevel: 15,
    costMul: 0.8,
    speedMul: 1.25,
  },
  {
    level: 4,
    name: 'Grande celeiro',
    text: 'Dois silos, anexo e lanternas na entrada.',
    cost: 35_000,
    unlockLevel: 24,
    costMul: 0.7,
    speedMul: 1.4,
  },
];

export const MAX_BARN_LEVEL = BARN_TIERS.length;

export const barnTier = (level: number): BarnTier => BARN_TIERS[Math.min(Math.max(level, 1), MAX_BARN_LEVEL) - 1]!;

export const nextBarnTier = (level: number): BarnTier | null => BARN_TIERS[level] ?? null;

/** "-10% nos custos, +10% de velocidade" for a tier. */
export function barnPerk(tier: BarnTier): string {
  const cut = Math.round((1 - tier.costMul) * 100);
  const fast = Math.round((tier.speedMul - 1) * 100);
  return cut === 0 && fast === 0 ? 'Sem bônus' : `Ajudantes custam ${cut}% menos e trabalham ${fast}% mais rápido`;
}
