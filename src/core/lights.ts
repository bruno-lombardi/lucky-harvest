/**
 * @module core/lights
 *
 * The farm lights (luzes da fazenda): string lights along the fence, lamp posts and soft pools of glow that come on in the
 * evening. Having the lights is free and they can be switched off; only the *colours* are bought, as farm decorations.
 * Amber is the free default. Pure data and normalisers; the rules are `Farm.setLights` and `Farm.buyLightColor`, the drawing is
 * `render/lights-view.ts` (which reads these colours), and the shop and HUD button live in `ui/`.
 *
 * NEXT(content): more palettes are just rows here (add the colour to the `LightColorId` union and a `bulbs` list). A premium
 *   currency could price some of them; see the Roadmap.
 */

export type LightColorId = 'ambar' | 'rosa' | 'verde' | 'azul' | 'roxo' | 'festa';

export const LIGHT_COLOR_ORDER: readonly LightColorId[] = ['ambar', 'rosa', 'verde', 'azul', 'roxo', 'festa'];

export interface LightColorDef {
  readonly id: LightColorId;
  readonly name: string;
  /** 0 for the free default. */
  readonly cost: number;
  readonly text: string;
  /** The bulb colours (0xRRGGBB). One colour lights everything with it; several are handed out bulb by bulb ("festa"). */
  readonly bulbs: readonly number[];
}

export const LIGHT_COLORS: Readonly<Record<LightColorId, LightColorDef>> = {
  ambar: { id: 'ambar', name: 'Âmbar', cost: 0, text: 'O brilho quente de sempre. Já vem com a fazenda.', bulbs: [0xffc95a] },
  rosa: { id: 'rosa', name: 'Rosa', cost: 300, text: 'Luzinhas cor de algodão-doce.', bulbs: [0xff7fb8] },
  verde: { id: 'verde', name: 'Verde vaga-lume', cost: 300, text: 'Parece que os vaga-lumes se mudaram para a cerca.', bulbs: [0x7dff8f] },
  azul: { id: 'azul', name: 'Azul luar', cost: 500, text: 'Um brilho frio, bonito com a lua alta.', bulbs: [0x6ab8ff] },
  roxo: { id: 'roxo', name: 'Roxo', cost: 500, text: 'Lavanda ao anoitecer.', bulbs: [0xb48aff] },
  festa: { id: 'festa', name: 'Festa junina', cost: 1500, text: 'Cada lâmpada de uma cor, como bandeirinha de arraial.', bulbs: [0xff6a5a, 0xffc95a, 0x7dff8f, 0x6ab8ff, 0xff7fb8] },
};

export interface LightSettings {
  on: boolean;
  color: LightColorId;
}

/** Colours bought so far. Amber is always usable and is never stored. */
export type LightColors = Partial<Record<LightColorId, true>>;

export const defaultLights = (): LightSettings => ({ on: true, color: 'ambar' });

export const isLightColor = (v: unknown): v is LightColorId => typeof v === 'string' && (LIGHT_COLOR_ORDER as readonly string[]).includes(v);

export const ownsLightColor = (owned: LightColors, id: LightColorId): boolean => id === 'ambar' || owned[id] === true;

/** Rebuilds the colours bought from anything found in a save. */
export function normalizeLightColors(raw: unknown): LightColors {
  const out: LightColors = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const id of LIGHT_COLOR_ORDER) if (id !== 'ambar' && r[id] === true) out[id] = true;
  return out;
}

/** Rebuilds the settings from a save; a colour that is not owned falls back to amber, so a hand-edited file cannot unlock one. */
export function normalizeLights(raw: unknown, owned: LightColors): LightSettings {
  const out = defaultLights();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r['on'] === 'boolean') out.on = r['on'];
  if (isLightColor(r['color']) && ownsLightColor(owned, r['color'])) out.color = r['color'];
  return out;
}
