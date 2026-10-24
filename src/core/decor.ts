/**
 * Decorations: things to buy for the look of the farm. They do nothing for the rules except cost coins
 * (and count towards achievements), so the shop and the renderer only need this table.
 */

export type DecorId = 'banco' | 'flores' | 'lanterna' | 'balanco' | 'fonte' | 'coreto';

export const DECOR_ORDER: readonly DecorId[] = ['banco', 'flores', 'lanterna', 'balanco', 'fonte', 'coreto'];

/** The shop opens at this player level. */
export const DECOR_UNLOCK_LEVEL = 14;

export interface DecorDef {
  readonly id: DecorId;
  readonly name: string;
  readonly cost: number;
  readonly text: string;
  /** Where it stands, in world units (the camera looks from +x, +z). */
  readonly x: number;
  readonly z: number;
}

export const DECOR: Readonly<Record<DecorId, DecorDef>> = {
  banco: { id: 'banco', name: 'Banco de madeira', cost: 100, text: 'Um lugar para ver a horta crescer.', x: 2.6, z: 8.8 },
  flores: { id: 'flores', name: 'Canteiro de flores', cost: 250, text: 'Margaridas, tulipas e muita abelha.', x: 4.8, z: 9.2 },
  lanterna: { id: 'lanterna', name: 'Lanternas de papel', cost: 600, text: 'À noite, um brilho quente ao longo do caminho.', x: 6.9, z: 9.4 },
  balanco: { id: 'balanco', name: 'Balanço de corda', cost: 1500, text: 'Pendurado no galho, bom para uma pausa.', x: -1.4, z: 9.8 },
  fonte: { id: 'fonte', name: 'Fonte de pedra', cost: 3000, text: 'Água cantando no meio do gramado.', x: 9.2, z: 10.2 },
  coreto: { id: 'coreto', name: 'Coreto da fazenda', cost: 6000, text: 'Para festas de colheita, com bandeirinhas.', x: -2.6, z: -9.6 },
};

export type Decorations = Partial<Record<DecorId, true>>;
