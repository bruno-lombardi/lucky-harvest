import { Tool } from '../core/actions';

/**
 * Hand-drawn SVG icons in the same chunky, outlined style as the 3D art.
 * One shared outline colour (the same dark brown as the in-game toon outlines).
 */

const INK = '#4a2b0f';
const open = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
const line = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;

// ---------------------------------------------------------------------------
// Tool icons. House rules, so the six tools read as one set (and match the 3D art and the logo):
//   * 48x48 box, subject filling roughly 40x40, centred; a small ground shadow or soil tile anchors it
//   * a 3-unit dark-brown outline on every part, round joins; wooden parts are a thick ink stroke with a lighter stroke on top
//   * flat fills from the game palette, one light highlight stroke per big shape, no gradients
//   * light comes from the top left, so shade sits right and below
// ---------------------------------------------------------------------------

const T = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
/** A wooden rod: ink stroke underneath, wood on top, a thin highlight along the lit side. */
const rod = (d: string, w = 4.4, wood = '#d9a066', hi = '#f3cf9d'): string =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 3.6}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="${wood}" stroke-width="${w}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="${hi}" stroke-width="${(w * 0.28).toFixed(1)}" stroke-linecap="round" transform="translate(-0.9 -0.5)" opacity=".85"/>`;
const shadow = (cx: number, cy: number, rx: number, ry = rx * 0.32): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#4a2b0f" opacity=".22"/>`;

/** Arar: a hoe working a freshly furrowed tile, the same soil the game draws. */
const hoe = `${open}>
  <path d="M5 35.5 L24 28.5 L43 35.5 V38.5 L24 46 L5 38.5Z" fill="#5a3820" ${T}/>
  <path d="M5 35.5 L24 28.5 L43 35.5 L24 43 Z" fill="#8a5527" ${T}/>
  <path d="M10.3 37.4 L28.9 30.4 M15.6 39.4 L33.9 32.4 M20.9 41.4 L38.6 34.3" stroke="#b97a3e" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M10.3 38.9 L28.9 31.9 M15.6 40.9 L33.9 33.9" stroke="#5a3820" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".5"/>
  ${rod('M40 4 L23 26.5', 4.2)}
  <g transform="translate(22 30.5) rotate(40)">
    <path d="M-2.2 -1 L2.2 -1 L3.4 -9 L-3.4 -9Z" fill="#9aa6b3" ${T}/>
    <path d="M-12 -2.6 H11 Q13 -2.6 13 -0.6 V3 Q13 5.4 10.6 5.4 H-10.6 Q-12 5.4 -12 3.8Z" fill="#c5ced6" ${T}/>
    <path d="M-9.5 -0.2 H8.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>
    <path d="M-9 3.2 H9.5" stroke="#8d99a6" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <circle cx="35.5" cy="27" r="1.8" fill="#8a5527" ${T.replace('stroke-width="3"', 'stroke-width="1.6"')}/>
  <circle cx="40" cy="31.5" r="1.3" fill="#8a5527"/>
</svg>`;

/** Colher: a wicker basket with the harvest piled in. */
const basket = `${open}>
  ${shadow(24, 44.5, 15)}
  <path d="M10.5 22 C10.5 3 37.5 3 37.5 22" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/>
  <path d="M10.5 22 C10.5 3 37.5 3 37.5 22" fill="none" stroke="#d9a066" stroke-width="3" stroke-linecap="round"/>
  <path d="M24 20 C21.5 10.5 16.5 9 13.5 11.5 C18 11.5 21 14.5 22.6 20.5Z" fill="#5cbc3f" ${T}/>
  <path d="M25.5 20 C27 11 32 8.5 35 10.5 C31 11.5 28.5 14.5 27.6 20.5Z" fill="#7ed957" ${T}/>
  <path d="M30 22 L35.5 12.5 C37 12 38.5 13.5 38 15 L33 24Z" fill="#ff8a1f" ${T}/>
  <circle cx="19.5" cy="22" r="6.2" fill="#e5372b" ${T}/>
  <path d="M16 19.8 C17 18.4 18.4 18 19.6 18.3" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".75"/>
  <path d="M5.5 24 H42.5 L38.5 40 Q37.6 43.5 34 43.5 H14 Q10.4 43.5 9.5 40 Z" fill="#e0a050" ${T}/>
  <path d="M9.8 31.5 H38.2 M11.4 37.5 H36.6" stroke="#a9702f" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  <path d="M17.5 25 L16.5 42 M24 25 V43 M30.5 25 L31.5 42" stroke="#b9803a" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <rect x="3.5" y="19.5" width="41" height="6.5" rx="3.25" fill="#c98a3e" ${T}/>
  <path d="M8 22.2 H22" stroke="#e8b569" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Semear: a burlap seed sack, tied at the neck, with a sprout on its label. */
const seedBag = `${open}>
  ${shadow(24, 45, 14)}
  <path d="M16.5 15 C9.5 21 7.5 33 11.5 40.5 Q13 43.5 16.5 43.5 H31.5 Q35 43.5 36.5 40.5 C40.5 33 38.5 21 31.5 15 Z" fill="#ecd9a6" ${T}/>
  <path d="M13 24 C11.5 29 12 34 14 38" stroke="#fff8e0" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".8"/>
  <path d="M16 15.5 L13.5 7 L20.5 11.5 L24 5.5 L27.5 11.5 L34.5 7 L32 15.5 Z" fill="#ecd9a6" ${T}/>
  <path d="M14.5 17.4 Q24 22 33.5 17.4" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M14.5 17.4 Q24 22 33.5 17.4" fill="none" stroke="#c0392b" stroke-width="2.8" stroke-linecap="round"/>
  <rect x="16.5" y="24" width="15" height="15" rx="3" fill="#fff4dc" stroke="${INK}" stroke-width="2.2"/>
  <path d="M24 37 V30.5" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>
  <path d="M24 37 V30.5" stroke="#3f9a3a" stroke-width="2" stroke-linecap="round"/>
  <path d="M24 33.5 C20 33.5 18.4 30.8 18.4 28 C22 28 24 29.8 24 33.5Z" fill="#5cbc3f" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M24 31.5 C28 31.5 29.6 28.8 29.6 26 C26 26 24 27.8 24 31.5Z" fill="#7ed957" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <ellipse cx="40.5" cy="30" rx="1.7" ry="2.4" transform="rotate(-25 40.5 30)" fill="#c98a3e" stroke="${INK}" stroke-width="1.6"/>
  <ellipse cx="6.5" cy="38" rx="1.7" ry="2.4" transform="rotate(30 6.5 38)" fill="#c98a3e" stroke="${INK}" stroke-width="1.6"/>
</svg>`;

/** Regar: a watering can pouring a few drops, all inside the box. */
const wateringCan = `${open}>
  ${shadow(24, 45.5, 13)}
  <path d="M34 24 C43 23.5 43 37 34 36.5" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M34 24 C43 23.5 43 37 34 36.5" fill="none" stroke="#3a8bd0" stroke-width="3" stroke-linecap="round"/>
  <path d="M12.5 35 L6 25 L9.8 22.4 L17 30.5Z" fill="#3a8bd0" ${T}/>
  <path d="M3.4 21 L10.8 17 L13.4 22.4 L6.2 26.4Z" fill="#8ccbf5" ${T}/>
  <rect x="11.5" y="21" width="24" height="22.5" rx="6" fill="#4aa3e8" ${T}/>
  <rect x="15" y="17.5" width="17" height="6" rx="3" fill="#8ccbf5" ${T}/>
  <path d="M16 27 V38" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
  <path d="M30 40 H32.5" stroke="#2f78b8" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M4.8 30 C4.8 32 3.4 33 3.4 34.4 C3.4 35.6 4.2 36.4 5.2 36.4 C6.2 36.4 7 35.6 7 34.4 C7 33 4.8 32 4.8 30Z" fill="#8ccbf5" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M9.4 38.4 C9.4 40 8.2 40.9 8.2 42 C8.2 43 8.9 43.7 9.8 43.7 C10.7 43.7 11.4 43 11.4 42 C11.4 40.9 9.4 40 9.4 38.4Z" fill="#8ccbf5" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Cuidar: a gardening glove (the hand tool) with a sparkle for the care. */
const glove = `${open}>
  ${shadow(23, 46, 12)}
  <rect x="3.5" y="22.5" width="16" height="7" rx="3.5" transform="rotate(40 11.5 26)" fill="#fff4dc" ${T}/>
  <rect x="12.5" y="8" width="6.4" height="19" rx="3.2" fill="#fff4dc" ${T}/>
  <rect x="18.9" y="4.5" width="6.4" height="21" rx="3.2" fill="#fff4dc" ${T}/>
  <rect x="25.3" y="6" width="6.4" height="20" rx="3.2" fill="#fff4dc" ${T}/>
  <rect x="31.7" y="10.5" width="6" height="17" rx="3" fill="#fff4dc" ${T}/>
  <rect x="12" y="20" width="26" height="19" rx="7" fill="#fff4dc" ${T}/>
  <path d="M16 11 V19 M22.2 8 V19 M28.5 9.5 V19" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9" transform="translate(-1.4 0)"/>
  <path d="M33 24 C35 27 35 32 33.5 35" stroke="#d9b98a" stroke-width="2" stroke-linecap="round" fill="none"/>
  <rect x="11" y="36.5" width="28" height="8.5" rx="3.2" fill="#5cbc3f" ${T}/>
  <path d="M14.5 40 H27" stroke="#9be35a" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M41 3 L42.4 7 L46.5 8.4 L42.4 9.8 L41 14 L39.6 9.8 L35.5 8.4 L39.6 7Z" fill="#ffe14d" stroke="#c98300" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Limpar: a straw broom sweeping up a puff of dust and a dry leaf. */
const broom = `${open}>
  ${shadow(25, 45.5, 15)}
  <g transform="rotate(32 24 26)">
    ${rod('M24 2.5 V28', 4)}
    <path d="M17.5 30 H30.5 L36 45 H12 Z" fill="#f0c548" ${T}/>
    <path d="M17 31.5 H31" stroke="#fff3b0" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    <path d="M19.8 36 L18 44 M24 36 V44.5 M28.2 36 L30 44" stroke="#b8902a" stroke-width="1.7" stroke-linecap="round" fill="none"/>
    <rect x="17" y="26.3" width="14" height="6.6" rx="2.4" fill="#c0392b" ${T}/>
    <path d="M19.5 28.7 H25" stroke="#ff8f80" stroke-width="1.6" stroke-linecap="round"/>
  </g>
  <path d="M34.5 43.5 C32.5 43.5 31.8 40.6 34.2 39.8 C34.4 37.4 37.6 36.8 38.8 38.8 C40.6 37.6 43.4 38.8 43 41 C45 41.2 45.4 43.5 43.4 43.5 Z" fill="#fff4dc" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M5.5 15 C9.5 13 13 15 13.5 19 C9.5 20 6 18.6 5.5 15Z" fill="#b97a3e" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M6.5 15.6 L12 18.3" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

const look = `${open}>
  <path d="M10.5 4.5 V28.5 L16.5 23.5 L21 34 L26.5 31.6 L22 21.4 L30.5 21 Z" fill="#fff4dc" ${T}/>
  <path d="M34.5 35.5 L42.5 43.5" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
  <path d="M34.5 35.5 L42.5 43.5" stroke="#c98a3e" stroke-width="4" stroke-linecap="round"/>
  <circle cx="30" cy="30" r="8.4" fill="#cfe9ff" ${T}/>
  <path d="M25.5 28.2 C26 25.8 28 24.4 30.2 24.3" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>
</svg>`;

/** The neutral "look" mode: inspects tiles and buildings without changing anything. */
export const LOOK_ICON = look;

export const TOOL_ICONS: Record<Tool, string> = {
  colher: basket,
  arar: hoe,
  semear: seedBag,
  regar: wateringCan,
  cuidar: glove,
  limpar: broom,
};

export const COIN_ICON = `${open}>
  <circle cx="24" cy="24" r="21" fill="#ffc92e" stroke="#7a4a08" stroke-width="3"/>
  <circle cx="24" cy="24" r="14.5" fill="none" stroke="#d9920a" stroke-width="2.4"/>
  <path d="M24 12.5 L27.1 20.2 L35.4 20.8 L29 26.1 L31.1 34.2 L24 29.7 L16.9 34.2 L19 26.1 L12.6 20.8 L20.9 20.2 Z" fill="#fff3a8" stroke="#c98300" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M10.5 17 A15 15 0 0 1 19 9.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
</svg>`;

export const STAR_ICON = `${open}>
  <path d="M24 3.5 L29.8 16.2 L43.6 17.6 L33.3 26.9 L36.3 40.5 L24 33.6 L11.7 40.5 L14.7 26.9 L4.4 17.6 L18.2 16.2 Z" fill="#ffd23a" stroke="#8a4f06" stroke-width="3" stroke-linejoin="round"/>
  <path d="M24 9 L28 17.8 L37 18.7" fill="none" stroke="#fff6bd" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
</svg>`;

export const LOCK_ICON = `${open}>
  <path d="M15 21 V15 A9 9 0 0 1 33 15 V21" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <rect x="9" y="20" width="30" height="23" rx="5" fill="#c9ced6" ${line}/>
  <circle cx="24" cy="30.5" r="3.2" fill="${INK}"/>
  <path d="M24 32 V37" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
</svg>`;

export const SHOP_ICON = `${open}>
  <path d="M7 20 H41 V41 Q41 44 38 44 H10 Q7 44 7 41 Z" fill="#e8c28a" ${line}/>
  <rect x="11.5" y="26" width="25" height="18" rx="2" fill="#7a4a26" ${line}/>
  <rect x="15" y="29.5" width="18" height="9" rx="1.5" fill="#ffe9b0" stroke="${INK}" stroke-width="2"/>
  <circle cx="21" cy="34" r="2.6" fill="#e5372b"/><circle cx="27.5" cy="34" r="2.6" fill="#5cbc3f"/>
  <path d="M5 20 L9 6 H39 L43 20 Z" fill="#fff" ${line}/>
  <path d="M9 6 H15.5 L14 20 H5 Z M22.5 6 H29 L28 20 H20 Z M35 6 H39 L43 20 H34 Z" fill="#e5372b" ${line}/>
  <path d="M5 20 Q9.5 25 14 20 Q19 25 24 20 Q29 25 34 20 Q38.5 25 43 20" fill="#fff" ${line}/>
</svg>`;

export const BARN_ICON = `${open}>
  <path d="M6 22 L24 6 L42 22 V42 Q42 44 40 44 H8 Q6 44 6 42 Z" fill="#d6372b" ${line}/>
  <path d="M3.5 23.5 L24 5 L44.5 23.5" fill="none" stroke="#6b4423" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="15" y="26" width="18" height="18" rx="1.5" fill="#b02a20" ${line}/>
  <path d="M15 26 L33 44 M33 26 L15 44" stroke="#fff4dc" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="24" cy="16" r="3" fill="#ffe9b0" stroke="${INK}" stroke-width="2"/>
</svg>`;

export const LAND_ICON = `${open}>
  <path d="M24 9 L43 20 L24 31 L5 20 Z" fill="#7fd04e" ${line}/>
  <path d="M5 20 V26 L24 37 V31 Z" fill="#8a5a2a" ${line}/>
  <path d="M43 20 V26 L24 37 V31 Z" fill="#6b4423" ${line}/>
  <path d="M24 3 V14 M19.5 8 L24 3 L28.5 8" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M24 3 V14 M19.5 8 L24 3 L28.5 8" stroke="#fff4dc" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M9 40 H39" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" opacity=".0"/>
</svg>`;

export const SOUND_ON_ICON = `${open}>
  <path d="M8 18 H15 L25 9 V39 L15 30 H8 Z" fill="#fff4dc" ${line}/>
  <path d="M31 17 Q36 24 31 31 M35.5 12 Q44 24 35.5 36" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
</svg>`;

export const SOUND_OFF_ICON = `${open}>
  <path d="M8 18 H15 L25 9 V39 L15 30 H8 Z" fill="#d9ccb0" ${line}/>
  <path d="M31 18 L42 30 M42 18 L31 30" fill="none" stroke="#d6372b" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export const SUN_ICON = `${open}>
  <g stroke="#c98300" stroke-width="3.2" stroke-linecap="round">
    <path d="M24 3 V9 M24 39 V45 M3 24 H9 M39 24 H45 M9.2 9.2 L13.4 13.4 M34.6 34.6 L38.8 38.8 M38.8 9.2 L34.6 13.4 M13.4 34.6 L9.2 38.8"/>
  </g>
  <circle cx="24" cy="24" r="10.5" fill="#ffd23a" stroke="#c98300" stroke-width="3"/>
  <path d="M18 20 A8 8 0 0 1 24 16" fill="none" stroke="#fff6bd" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;

export const MOON_ICON = `${open}>
  <path d="M33 7 A18 18 0 1 0 41 33 A14 14 0 0 1 33 7 Z" fill="#f4efc8" stroke="#6a6a9a" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="19" cy="26" r="2.6" fill="#d8d2a4"/><circle cx="25" cy="34" r="1.8" fill="#d8d2a4"/>
</svg>`;

/** Fills every `[data-icon]` placeholder in the page with its SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  const icons: Record<string, string> = { coin: COIN_ICON, star: STAR_ICON, shop: SHOP_ICON };
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const svg = icons[el.dataset['icon'] ?? ''];
    if (svg) el.innerHTML = svg;
  });
}

export const TRUCK_ICON = `${open}>
  <path d="M5 16 H29 V34 H5 Z" fill="#e8c27a" ${line}/>
  <path d="M29 22 H38 L43 28 V34 H29 Z" fill="#d6372b" ${line}/>
  <path d="M33 25 H37 L40 28.5 H33 Z" fill="#bfe6f5" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="15" cy="36" r="5" fill="#4a3a2a" ${line}/>
  <circle cx="36" cy="36" r="5" fill="#4a3a2a" ${line}/>
  <circle cx="15" cy="36" r="1.8" fill="#fff4dc"/>
  <circle cx="36" cy="36" r="1.8" fill="#fff4dc"/>
  <path d="M10 16 V11 M18 16 V9 M24 16 V12" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;

export const BOOK_ICON = `${open}>
  <path d="M7 10 Q15 6 24 10 Q33 6 41 10 V39 Q33 35 24 39 Q15 35 7 39 Z" fill="#fff4dc" ${line}/>
  <path d="M24 10 V39" stroke="${INK}" stroke-width="2.4"/>
  <path d="M12 16 Q17 14 21 16 M12 22 Q17 20 21 22 M12 28 Q17 26 21 28" fill="none" stroke="#b48a52" stroke-width="2" stroke-linecap="round"/>
  <path d="M27 17 L30 14 L33 17 L36 14" fill="none" stroke="#d6372b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M27 26 H37 M27 31 H34" stroke="#b48a52" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export const MEDAL_ICON = (fill: string): string => `${open}>
  <path d="M14 4 L24 20 L34 4 Z" fill="#d6372b" ${line}/>
  <circle cx="24" cy="30" r="12.5" fill="${fill}" ${line}/>
  <path d="M24 22.5 L26.4 27.6 L32 28.3 L27.9 32.1 L29 37.6 L24 34.9 L19 37.6 L20.1 32.1 L16 28.3 L21.6 27.6 Z" fill="#fff4dc" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;
