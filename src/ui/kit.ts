import { Command } from '../core/commands';
import { COIN_ICON } from './icons';

/** Runs a command through the game (apply, record for save and sync, sound, effects). True when it succeeded. */
export type Dispatch = (command: Command) => boolean;

export const coin = (amount: number): string =>
  `<span class="price"><i class="ico">${COIN_ICON}</i>${amount.toLocaleString('pt-BR')}</span>`;

/** A list row: icon (inline svg or img markup), text, buttons. */
export function row(pic: string, info: string, buttons = '', locked = false, infoKey = '', extraClass = ''): string {
  return `
    <div class="shop-row${locked ? ' locked' : ''}${extraClass ? ` ${extraClass}` : ''}"${infoKey ? ` data-info="${infoKey}"` : ''}>
      <span class="pic">${pic}</span>
      <span class="info">${info}</span>
      <span class="buttons">${buttons}</span>
    </div>`;
}

import { RARITIES, Rarity } from '../core/crops';

/** A small coloured tag for incomum, rara and épica seeds (comum has none). */
export const rarityBadge = (rarity: Rarity): string =>
  rarity === 'comum' ? '' : `<span class="rar rar-${rarity}">${RARITIES[rarity].name}</span>`;

export const img = (src: string): string => `<img alt="" draggable="false" src="${src}" />`;

export function heading(text: string): string {
  return `<h4 class="section">${text}</h4>`;
}

export function empty(icon: string, title: string, hint: string): string {
  return `<div class="shop-empty"><i class="ico big">${icon}</i><p>${title}</p><small>${hint}</small></div>`;
}

/** Plural-aware unit count, e.g. "3 galinhas". */
export const countOf = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
