import { ProductId, SpeciesId } from '../core/animals';

/** Icons for animal products, feed sacks and species, in the same chunky outlined style as icons.ts. */
const INK = '#4a2b0f';
const open = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
const line = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;

export const PRODUCT_ICONS: Record<ProductId, string> = {
  ovo: `${open}>
  <path d="M24 5 C14 5 8 20 8 29 C8 38 15 44 24 44 C33 44 40 38 40 29 C40 20 34 5 24 5Z" fill="#fff6e4" ${line}/>
  <path d="M15 24 C16 17 19 12 22 10" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".9"/>
  <path d="M30 40 C36 38 38 33 38 29" fill="none" stroke="#e8cfa4" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  leite: `${open}>
  <path d="M18 5 H30 V12 L35 18 V41 Q35 44 32 44 H16 Q13 44 13 41 V18 L18 12 Z" fill="#fbfdff" ${line}/>
  <path d="M13 24 H35 V41 Q35 44 32 44 H16 Q13 44 13 41 Z" fill="#dff0ff" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="17" y="3.5" width="14" height="5.5" rx="2" fill="#4f86c9" ${line}/>
  <circle cx="24" cy="32" r="4.2" fill="#fff" stroke="${INK}" stroke-width="2"/>
  <path d="M17 17 L19 14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
</svg>`,
  trufa: `${open}>
  <path d="M8 30 C6 18 14 8 25 8 C37 8 43 18 40 30 C38 40 30 44 22 43 C14 42 9 38 8 30Z" fill="#6b4a3a" ${line}/>
  <path d="M15 20 L19 24 M26 14 L29 19 M30 27 L34 31 M17 33 L22 35 M23 22 L25 27" stroke="#3c2518" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M14 16 C17 12 20 11 22 11" stroke="#a37c63" stroke-width="3" stroke-linecap="round" fill="none"/>
</svg>`,
};

const SACK_COLORS: Record<SpeciesId, { body: string; tie: string; mark: string }> = {
  galinha: { body: '#e8c75d', tie: '#c23b2c', mark: '#fff6e4' },
  vaca: { body: '#b8d88a', tie: '#4f86c9', mark: '#fbfdff' },
  porco: { body: '#e7a6a0', tie: '#7a4a26', mark: '#fff0e6' },
};

/** A sack of feed, tinted per species, with a small seed mark. */
export const FEED_ICONS: Record<SpeciesId, string> = Object.fromEntries(
  (Object.keys(SACK_COLORS) as SpeciesId[]).map((id) => {
    const c = SACK_COLORS[id];
    return [
      id,
      `${open}>
  <path d="M13 14 Q9 24 9 36 Q9 44 17 44 H31 Q39 44 39 36 Q39 24 35 14 Z" fill="${c.body}" ${line}/>
  <path d="M14 14 Q16 7 18 5 L24 9 L30 5 Q32 7 34 14 Z" fill="${c.body}" ${line}/>
  <path d="M15 14 Q24 18 33 14" fill="none" stroke="${c.tie}" stroke-width="4.4" stroke-linecap="round"/>
  <ellipse cx="24" cy="31" rx="7" ry="8" fill="${c.mark}" stroke="${INK}" stroke-width="2"/>
  <path d="M24 25 Q21 31 24 37 M24 25 Q27 31 24 37" fill="none" stroke="${c.tie}" stroke-width="2" stroke-linecap="round"/>
</svg>`,
    ];
  }),
) as Record<SpeciesId, string>;

export const SPECIES_ICONS: Record<SpeciesId, string> = {
  galinha: `${open}>
  <path d="M10 28 C10 17 18 10 27 12 C36 14 40 24 36 33 C33 40 26 43 19 41 C13 39 10 34 10 28Z" fill="#fff6e4" ${line}/>
  <path d="M18 13 C17 8 20 6 22 8 C23 4 27 4 28 8 C30 7 32 10 30 13Z" fill="#e5372b" ${line}/>
  <path d="M38 22 L45 25 L38 28Z" fill="#f2a625" ${line}/>
  <circle cx="31" cy="21" r="2.4" fill="${INK}"/>
  <path d="M28 31 C28 36 31 38 34 37" fill="#e5372b" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M13 28 C16 24 20 25 22 29 C20 33 16 34 13 31Z" fill="#f3e4c6" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
</svg>`,
  vaca: `${open}>
  <path d="M9 14 L4 8 M39 14 L44 8" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  <path d="M9 14 L4 8 M39 14 L44 8" stroke="#f3e4c6" stroke-width="2" stroke-linecap="round"/>
  <path d="M10 16 C10 9 17 7 24 7 C31 7 38 9 38 16 V30 C38 38 32 42 24 42 C16 42 10 38 10 30Z" fill="#fbfdff" ${line}/>
  <path d="M10 17 C10 11 14 9 18 9 C19 14 16 19 10 22Z" fill="#4a3a33" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <ellipse cx="24" cy="34" rx="10.5" ry="7.5" fill="#f4b9b0" ${line}/>
  <circle cx="20.5" cy="34" r="1.8" fill="${INK}"/><circle cx="27.5" cy="34" r="1.8" fill="${INK}"/>
  <circle cx="17" cy="21" r="2.4" fill="${INK}"/><circle cx="31" cy="21" r="2.4" fill="${INK}"/>
</svg>`,
  porco: `${open}>
  <path d="M10 14 L8 6 L17 10 M38 14 L40 6 L31 10" fill="#f2a5ad" ${line}/>
  <path d="M8 26 C8 14 15 9 24 9 C33 9 40 14 40 26 C40 36 33 42 24 42 C15 42 8 36 8 26Z" fill="#f7b9bf" ${line}/>
  <ellipse cx="24" cy="30" rx="10" ry="7.5" fill="#f08c98" ${line}/>
  <ellipse cx="20.5" cy="30" rx="1.8" ry="2.6" fill="${INK}"/><ellipse cx="27.5" cy="30" rx="1.8" ry="2.6" fill="${INK}"/>
  <circle cx="16.5" cy="21" r="2.4" fill="${INK}"/><circle cx="31.5" cy="21" r="2.4" fill="${INK}"/>
</svg>`,
};

export const PEN_ICON = `${open}>
  <path d="M5 40 V22 M17 40 V22 M31 40 V22 M43 40 V22" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M5 40 V22 M17 40 V22 M31 40 V22 M43 40 V22" stroke="#d9a066" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M4 27 H44 M4 35 H44" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M4 27 H44 M4 35 H44" stroke="#e8be84" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M10 22 L24 8 L38 22Z" fill="#d6372b" ${line}/>
</svg>`;

export const GEAR_ICON = `${open}>
  <path d="M21 5 H27 L28.5 10 L32.5 11.7 L37 9 L41 13 L38.3 17.5 L40 21.5 L45 23 V29 L40 30.5 L38.3 34.5 L41 39 L37 43 L32.5 40.3 L28.5 42 L27 47 H21 L19.5 42 L15.5 40.3 L11 43 L7 39 L9.7 34.5 L8 30.5 L3 29 V23 L8 21.5 L9.7 17.5 L7 13 L11 9 L15.5 11.7 L19.5 10Z" transform="translate(0 -3) scale(1 .98)" fill="#d9dee5" ${line}/>
  <circle cx="24" cy="23" r="6.5" fill="#7a8696" ${line}/>
</svg>`;
