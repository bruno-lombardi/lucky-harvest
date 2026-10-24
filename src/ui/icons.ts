import { Tool } from '../core/actions';

/**
 * Hand-drawn SVG icons in the same chunky, outlined style as the 3D art.
 * One shared outline colour (the same dark brown as the in-game toon outlines).
 */

const INK = '#4a2b0f';
const open = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
const line = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;

const basket = `${open}>
  <path d="M12 20 C12 5 36 5 36 20" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/>
  <path d="M12 20 C12 5 36 5 36 20" fill="none" stroke="#c98a3e" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M25 17 C22 9 17 8 15 10 C19 10 22 12 24 18Z" fill="#5cbc3f" ${line}/>
  <path d="M26 17 C28 8 33 6 35 8 C31 9 29 12 28 18Z" fill="#7ed957" ${line}/>
  <circle cx="19" cy="21" r="5.5" fill="#e5372b" ${line}/>
  <path d="M5 21 H43 L38.5 40 Q37.6 44 33.5 44 H14.5 Q10.4 44 9.5 40 Z" fill="#e0a050" ${line}/>
  <path d="M10.5 29 H37.5 M11.8 36 H36.2" stroke="#a9702f" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  <path d="M18 22 V43 M24 22 V43 M30 22 V43" stroke="#b9803a" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  <rect x="3.5" y="17.5" width="41" height="6" rx="3" fill="#c98a3e" ${line}/>
</svg>`;

const hoe = `${open}>
  <ellipse cx="14" cy="42" rx="8" ry="3" fill="#7a4a26" ${line}/>
  <path d="M10 41 L31 13" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
  <path d="M10 41 L31 13" stroke="#d9a066" stroke-width="4.2" stroke-linecap="round"/>
  <path d="M26 9 L41 4.5 L44.5 13 L33.5 21 Z" fill="#c5ced6" ${line}/>
  <path d="M30 10.5 L40 7.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>
</svg>`;

const seedBag = `${open}>
  <path d="M16 16 C10 22 8 34 12 41.5 Q13.3 44 16.5 44 H31.5 Q34.7 44 36 41.5 C40 34 38 22 32 16 Z" fill="#ecd9a6" ${line}/>
  <path d="M16.5 16.5 L14.5 8 L21 12.5 L24 7 L27 12.5 L33.5 8 L31.5 16.5 Z" fill="#ecd9a6" ${line}/>
  <path d="M14.5 18 Q24 22.5 33.5 18" fill="none" stroke="#8a5a2a" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M24 40 V30" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/>
  <path d="M24 40 V30" stroke="#3f9a3a" stroke-width="2" stroke-linecap="round"/>
  <path d="M24 33 C19.5 33 17.5 30 17.5 26.5 C22 26.5 24 28.5 24 33Z" fill="#5cbc3f" ${line}/>
  <path d="M24 30.5 C28.5 30.5 30.5 27.5 30.5 24 C26 24 24 26 24 30.5Z" fill="#7ed957" ${line}/>
</svg>`;

const wateringCan = `${open}>
  <g transform="translate(5 3)">
    <path d="M35 21 C45 21 45 35 35 35" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M35 21 C45 21 45 35 35 35" fill="none" stroke="#3a8bd0" stroke-width="3" stroke-linecap="round"/>
    <path d="M11 27 L3.5 17 L7.2 14.4 L14.5 22.5 Z" fill="#3a8bd0" ${line}/>
    <path d="M1.2 13.4 L8.6 9.6 L10.6 14.2 L3.4 18 Z" fill="#8ccbf5" ${line}/>
    <rect x="10" y="17" width="26" height="23" rx="5.5" fill="#4aa3e8" ${line}/>
    <rect x="13" y="13.5" width="20" height="6" rx="3" fill="#8ccbf5" ${line}/>
    <path d="M15 24 V35" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".55"/>
    <circle cx="-1" cy="22" r="1.9" fill="#8ccbf5"/>
    <circle cx="3" cy="28" r="1.9" fill="#8ccbf5"/>
    <circle cx="-2" cy="31" r="1.5" fill="#8ccbf5"/>
  </g>
</svg>`;

const broom = `${open}>
  <g transform="rotate(35 24 24)">
    <path d="M24 3 V29" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M24 3 V29" stroke="#d9a066" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M19.5 31 H28.5 L34 45 H14 Z" fill="#f0c548" ${line}/>
    <path d="M20.2 35 V44 M24 35 V44.5 M27.8 35 V44" stroke="#b8902a" stroke-width="1.7" stroke-linecap="round" fill="none"/>
    <rect x="19" y="26.5" width="10" height="6" rx="2" fill="#c0392b" ${line}/>
  </g>
</svg>`;

const glove = `${open}>
  <path d="M12 30 C9 26 9 21 12.5 20.5 C15.5 20 17 22.5 18 25 V12.5 C18 9.5 22.5 9.5 22.5 12.5 V21 V9 C22.5 6 27 6 27 9 V21 V11 C27 8 31.5 8 31.5 11 V22 V15 C31.5 12.2 36 12.2 36 15 V29 C36 36 32 40 25 40 H22 C17 40 14.5 36 12 30Z" fill="#fff4dc" ${line}/>
  <path d="M22.5 21 V14 M27 21 V13 M31.5 22 V18" stroke="#d9b98a" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <path d="M13.5 38.5 H35.5 V44 Q35.5 45.5 34 45.5 H15 Q13.5 45.5 13.5 44 Z" fill="#5cbc3f" ${line}/>
  <path d="M38 5 L39.2 8.2 L42.5 9.4 L39.2 10.6 L38 14 L36.8 10.6 L33.5 9.4 L36.8 8.2Z" fill="#ffe14d" stroke="#c98300" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

const look = `${open}>
  <path d="M13 6 V26 L18.5 21.5 L22.5 31 L27 29 L23 19.8 L30.5 19.5 Z" fill="#fff4dc" ${line}/>
  <circle cx="33" cy="33" r="7.5" fill="#cfe9ff" fill-opacity=".85" ${line}/>
  <path d="M38.5 38.5 L44 44" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M38.5 38.5 L44 44" stroke="#c98a3e" stroke-width="2.4" stroke-linecap="round"/>
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
