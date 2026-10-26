import { ProductId, SpeciesId } from '../core/animals';
import { HelperId } from '../core/helpers';
import { FERTILIZER_ORDER, FertilizerId } from '../core/fertilizer';

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

export const HELPER_ICONS: Record<HelperId, string> = {
  regador: `${open}>
  <path d="M8 40 H40" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M8 40 H40" stroke="#8a5a2a" stroke-width="3.4" stroke-linecap="round"/>
  <rect x="19" y="26" width="10" height="14" rx="2" fill="#9aa7b5" ${line}/>
  <rect x="15" y="20" width="18" height="9" rx="3" fill="#d9a441" ${line}/>
  <path d="M10 18 L38 18" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M10 18 L38 18" stroke="#d9a441" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M7 9 Q4 14 5 17 M41 9 Q44 14 43 17 M16 6 Q15 10 15 13 M32 6 Q33 10 33 13 M24 4 V12" fill="none" stroke="#4aa8f0" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  ajudante: `${open}>
  <path d="M7 24 C7 15 15 10 24 10 C33 10 41 15 41 24 C41 35 33 42 24 42 C15 42 7 35 7 24Z" fill="#f0bd93" ${line}/>
  <path d="M2 21 Q24 14 46 21 Q24 27 2 21Z" fill="#d9b24a" ${line}/>
  <path d="M11 19 C11 8 18 4 24 4 C30 4 37 8 37 19 Q24 24 11 19Z" fill="#e8c75d" ${line}/>
  <path d="M11.5 16.5 Q24 21 36.5 16.5" fill="none" stroke="#c23b2c" stroke-width="3.6"/>
  <circle cx="18" cy="27" r="2.4" fill="${INK}"/><circle cx="30" cy="27" r="2.4" fill="${INK}"/>
  <path d="M13 34 Q18 29 24 33 Q30 29 35 34 Q30 40 24 36 Q18 40 13 34Z" fill="#ebe7df" ${line}/>
  <ellipse cx="24" cy="31" rx="3.2" ry="2.6" fill="#e39a74" stroke="${INK}" stroke-width="1.8"/>
</svg>`,
  gato: `${open}>
  <path d="M9 22 L8 6 L20 13 Q24 12 28 13 L40 6 L39 22 C41 36 33 43 24 43 C15 43 7 36 9 22Z" fill="#e8903a" ${line}/>
  <path d="M11 9 L17 13 L11 17Z M37 9 L31 13 L37 17Z" fill="#f4a3ab" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M20 14 V19 M24 13 V19 M28 14 V19" stroke="#b8631f" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="17" cy="26" rx="3.2" ry="4" fill="#78d96b" stroke="${INK}" stroke-width="1.8"/>
  <ellipse cx="31" cy="26" rx="3.2" ry="4" fill="#78d96b" stroke="${INK}" stroke-width="1.8"/>
  <path d="M17 23.5 V28.5 M31 23.5 V28.5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="24" cy="36" rx="8" ry="5.6" fill="#fff4e6" stroke="${INK}" stroke-width="2"/>
  <path d="M22 31.5 H26 L24 34Z" fill="#f08a9a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M3 28 L12 30 M3 35 L12 33 M45 28 L36 30 M45 35 L36 33" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
</svg>`,
  cao: `${open}>
  <path d="M10 14 Q4 16 5 30 Q6 38 12 36 Q14 28 14 20Z" fill="#8a5a2a" ${line}/>
  <path d="M38 14 Q44 16 43 30 Q42 38 36 36 Q34 28 34 20Z" fill="#8a5a2a" ${line}/>
  <path d="M12 22 C12 11 17 8 24 8 C31 8 36 11 36 22 C36 36 31 42 24 42 C17 42 12 36 12 22Z" fill="#d9a35f" ${line}/>
  <path d="M24 8 C28 8 31 10 31 15 Q27 17 24 15Z" fill="#8a5a2a"/>
  <ellipse cx="24" cy="33" rx="8.5" ry="7" fill="#fff0d6" stroke="${INK}" stroke-width="2"/>
  <ellipse cx="24" cy="29.5" rx="3.6" ry="2.6" fill="#2b1b12" stroke="${INK}" stroke-width="1.4"/>
  <circle cx="18" cy="21" r="2.4" fill="${INK}"/><circle cx="30" cy="21" r="2.4" fill="${INK}"/>
  <path d="M24 32 V35 M20.5 36.5 Q24 39 27.5 36.5" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M21 38.5 Q24 44 27 38.5Z" fill="#f08a9a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`,
  tratador: `${open}>
  <path d="M8 44 Q8 34 24 34 Q40 34 40 44Z" fill="#3f9a8a" ${line}/>
  <path d="M7 24 C7 15 15 11 24 11 C33 11 41 15 41 24 C41 34 33 40 24 40 C15 40 7 34 7 24Z" fill="#e6ac82" ${line}/>
  <path d="M6 22 C6 8 15 4 24 4 C33 4 42 8 42 22 Q24 14 6 22Z" fill="#c23b2c" ${line}/>
  <circle cx="38" cy="10" r="4" fill="#fff6e4" ${line}/>
  <path d="M12 21 Q24 15 36 21" fill="none" stroke="#fff6e4" stroke-width="2.4" stroke-dasharray="1 4.5" stroke-linecap="round"/>
  <circle cx="18" cy="27" r="2.4" fill="${INK}"/><circle cx="30" cy="27" r="2.4" fill="${INK}"/>
  <ellipse cx="13" cy="31" rx="3" ry="2" fill="#f0968a"/><ellipse cx="35" cy="31" rx="3" ry="2" fill="#f0968a"/>
  <path d="M19 33 Q24 38 29 33" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <path d="M19 40 L24 44 L29 40" fill="#e9dcc0" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
</svg>`,
};

const T = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

/** Sack colour, label stripe colour and what spills out, per fertilizer. The stripe follows the rarity colours used on the seeds. */
const FERT_LOOK: Record<FertilizerId, { sack: string; fold: string; band: string; grain: string; moon: boolean }> = {
  esterco: { sack: '#d6aa6a', fold: '#c2924f', band: '#9a6b3a', grain: '#6b4423', moon: false },
  composto: { sack: '#d6aa6a', fold: '#c2924f', band: '#4fae3a', grain: '#5e7d2b', moon: false },
  humus: { sack: '#cfae78', fold: '#b99358', band: '#3f7fe0', grain: '#3b2a22', moon: false },
  lua: { sack: '#e4e0f2', fold: '#c9c3e6', band: '#7a5ae0', grain: '#fff1a0', moon: true },
};

/**
 * One fertilizer sack per tier: a folded-top kraft sack (not tied like the seed bag) with a coloured band and a label,
 * a sprout on the label, and the grain heaped beside it. Poeira de lua is silvery with a crescent and sparkles.
 */
export const FERTILIZER_ICONS: Record<FertilizerId, string> = Object.fromEntries(
  FERTILIZER_ORDER.map((id) => {
    const c = FERT_LOOK[id];
    const mark = c.moon
      ? `<path d="M26.5 24 C22 24 19.6 27.6 20.6 31.4 C21.6 35 25.6 36.6 28.8 34.8 C25 34.6 23 31.4 24.2 28.4 C24.8 26.8 25.6 25 26.5 24Z" fill="#ffe14d" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`
      : `<path d="M24 36 V29.5" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M24 36 V29.5" stroke="#3f9a3a" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M24 32.6 C20.2 32.6 18.8 30.2 18.8 27.6 C22.2 27.6 24 29.4 24 32.6Z" fill="#5cbc3f" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>` +
        `<path d="M24 30.8 C27.8 30.8 29.2 28.4 29.2 25.8 C25.8 25.8 24 27.6 24 30.8Z" fill="#7ed957" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>`;
    const sparkles = c.moon
      ? `<path d="M40 5 L41.2 8.2 L44.5 9.4 L41.2 10.6 L40 14 L38.8 10.6 L35.5 9.4 L38.8 8.2Z" fill="#ffe14d" stroke="#c98300" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M7 11 L7.8 13.2 L10 14 L7.8 14.8 L7 17 L6.2 14.8 L4 14 L6.2 13.2Z" fill="#fff1a0" stroke="#c98300" stroke-width="1.2" stroke-linejoin="round"/>`
      : '';
    return [
      id,
      `${open}>
  <ellipse cx="24" cy="45" rx="15" ry="3.4" fill="${INK}" opacity=".22"/>
  <path d="M10.5 15 C8.4 23 7.4 32 8.6 40.2 Q9.2 43.8 12.8 43.8 H35.2 Q38.8 43.8 39.4 40.2 C40.6 32 39.6 23 37.5 15 Z" fill="${c.sack}" ${T}/>
  <path d="M10 15 L11.6 6.5 H36.4 L38 15 Z" fill="${c.fold}" ${T}/>
  <path d="M14.5 10.8 H33.5" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1.6 3" opacity=".55"/>
  <path d="M9.6 17.4 H38.4" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/>
  <path d="M9.6 17.4 H38.4" stroke="${c.band}" stroke-width="3" stroke-linecap="round"/>
  <rect x="14" y="21.6" width="20" height="17" rx="3.4" fill="#fff4dc" stroke="${INK}" stroke-width="2.2"/>
  ${mark}
  <path d="M11.4 22 C10.6 27 11 33 12.4 38" stroke="#fff8e0" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/>
  <path d="M29.5 44.4 C30.4 40.4 38.4 40.4 40.6 44.4 Z" fill="${c.grain}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  ${sparkles}
</svg>`,
    ];
  }),
) as Record<FertilizerId, string>;
