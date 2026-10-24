import { GOOD_ORDER, GoodId } from '../core/goods';
import { BAKERY_ICON } from './bakery-icon';

/** Icons for the Confeitaria's goods, in the chunky outlined style of the other item icons. */
const INK = '#4a2b0f';
const open = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
const line = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body: string): string => `${open}>${body}</svg>`;

const sack = (body: string, mark: string): string =>
  svg(`<path d="M14 9 Q24 4 34 9 L38 40 Q38 44 34 44 H14 Q10 44 10 40 Z" fill="${body}" ${line}/>
  <path d="M15 9 Q24 14 33 9" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="24" cy="29" r="6.5" fill="${mark}" stroke="${INK}" stroke-width="2"/>
  <path d="M21 30 Q24 25 27 30" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`);

const block = (body: string, top: string): string =>
  svg(`<path d="M6 20 L24 12 L42 20 V34 L24 42 L6 34 Z" fill="${body}" ${line}/>
  <path d="M6 20 L24 28 L42 20 L24 12 Z" fill="${top}" ${line}/>
  <path d="M24 28 V42" stroke="${INK}" stroke-width="2.6"/>`);

const jar = (fill: string, lid: string): string =>
  svg(`<rect x="11" y="9" width="26" height="7" rx="3" fill="${lid}" ${line}/>
  <path d="M12 16 H36 V38 Q36 44 30 44 H18 Q12 44 12 38 Z" fill="#f4fbff" ${line}/>
  <path d="M14 24 H34 V38 Q34 42 30 42 H18 Q14 42 14 38 Z" fill="${fill}" stroke="${INK}" stroke-width="2"/>
  <rect x="17" y="26" width="14" height="9" rx="2" fill="#fff6e4" stroke="${INK}" stroke-width="1.8"/>
  <path d="M16 18 V22" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`);

const glass = (fill: string, garnish: string): string =>
  svg(`<path d="M11 8 H37 L34 41 Q34 44 31 44 H17 Q14 44 14 41 Z" fill="#eaf7ff" ${line}/>
  <path d="M12.5 18 H35.5 L34 41 Q34 44 31 44 H17 Q14 44 14 41 Z" fill="${fill}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M30 4 L27 22" stroke="#e8618c" stroke-width="3" stroke-linecap="round"/>
  <circle cx="35" cy="10" r="5" fill="${garnish}" ${line}/>`);

const cake = (sponge: string, icing: string, cherry: string): string =>
  svg(`<path d="M6 26 H42 V38 Q42 43 37 43 H11 Q6 43 6 38 Z" fill="${sponge}" ${line}/>
  <path d="M6 26 Q6 14 24 14 Q42 14 42 26 Q40 31 36 28 Q33 33 29 28 Q25 33 21 28 Q17 33 12 28 Q8 31 6 26Z" fill="${icing}" ${line}/>
  <circle cx="24" cy="10" r="4" fill="${cherry}" ${line}/>
  <path d="M10 36 H38" stroke="#fff6e4" stroke-width="2" stroke-dasharray="3 4" opacity=".7"/>`);

const BODY: Record<GoodId, string> = {
  farinha: sack('#fff6e4', '#e8c75d'),
  fuba: sack('#f2d14a', '#fff6e4'),
  manteiga: block('#ffe27a', '#fff3b0'),
  queijo: svg(`<path d="M5 34 L44 30 L40 15 Z" fill="#f7d65a" ${line}/>
  <path d="M5 34 L44 30 V38 L5 42 Z" fill="#e8b93a" ${line}/>
  <circle cx="30" cy="25" r="2.8" fill="#e8b93a" stroke="${INK}" stroke-width="1.8"/>
  <circle cx="20" cy="31" r="2" fill="#e8b93a" stroke="${INK}" stroke-width="1.8"/>`),
  acucar: sack('#ffffff', '#cfe9ff'),
  pao: svg(`<path d="M5 26 C5 16 14 11 24 11 C34 11 43 16 43 26 C43 36 35 40 24 40 C13 40 5 36 5 26Z" fill="#e8a64a" ${line}/>
  <path d="M13 20 L19 29 M22 17 L28 27 M31 19 L36 28" stroke="#fff0c8" stroke-width="3.4" stroke-linecap="round"/>`),
  geleiamorango: jar('#e5372b', '#e8618c'),
  paodequeijo: svg(`<circle cx="15" cy="30" r="9" fill="#f0b24a" ${line}/>
  <circle cx="32" cy="30" r="9" fill="#e8a23a" ${line}/>
  <circle cx="24" cy="17" r="9" fill="#f6c25a" ${line}/>
  <path d="M20 14 Q24 11 28 14 M11 27 Q15 24 19 27 M28 27 Q32 24 36 27" fill="none" stroke="#fff0c8" stroke-width="2.4" stroke-linecap="round"/>`),
  oleo: svg(`<rect x="19" y="4" width="10" height="7" rx="2" fill="#6b4423" ${line}/>
  <path d="M19 11 H29 L35 20 V40 Q35 44 31 44 H17 Q13 44 13 40 V20 Z" fill="#f6d34a" ${line}/>
  <circle cx="24" cy="30" r="6" fill="#fff6e4" stroke="${INK}" stroke-width="2"/>
  <circle cx="24" cy="30" r="2.4" fill="#6b4423"/>`),
  sucolaranja: glass('#ffa21f', '#ff8a1f'),
  bolofuba: cake('#f2d14a', '#fff1b8', '#e5372b'),
  bolocenoura: cake('#ff8a1f', '#5a3320', '#fff6e4'),
  docedeabobora: jar('#ff9a2f', '#8a5a2a'),
  pudim: svg(`<path d="M7 36 L12 20 Q24 12 36 20 L41 36 Q41 41 36 41 H12 Q7 41 7 36Z" fill="#f2a63a" ${line}/>
  <path d="M10 28 Q24 20 38 28 L40 36 Q40 40 36 40 H12 Q8 40 8 36Z" fill="#f9dc84" stroke="${INK}" stroke-width="2.2"/>
  <path d="M12 21 Q24 13 36 21 Q36 26 31 25 Q28 30 24 26 Q20 30 17 25 Q12 26 12 21Z" fill="#a8531f" ${line}/>`),
  goiabada: block('#c23b4a', '#d9566a'),
  sucomelancia: glass('#ff6f8a', '#3f9a45'),
  geleiapitaya: jar('#e83a8c', '#3f9a45'),
  tortamanga: svg(`<path d="M4 28 L24 12 L44 28 V36 Q44 41 39 41 H9 Q4 41 4 36Z" fill="#f4d28a" ${line}/>
  <path d="M8 29 L24 17 L40 29 Q38 34 33 31 Q28 35 24 31 Q20 35 15 31 Q10 34 8 29Z" fill="#ffb627" ${line}/>
  <circle cx="24" cy="26" r="3.6" fill="#ff7a1f" stroke="${INK}" stroke-width="2"/>`),
  sucouva: glass('#7a2f9a', '#7a2f9a'),
  geleiajabuticaba: jar('#3a1f4a', '#7a2f9a'),
  beijinho: svg(`<circle cx="15" cy="30" r="9" fill="#fff6e4" ${line}/>
  <circle cx="33" cy="30" r="9" fill="#fff6e4" ${line}/>
  <circle cx="24" cy="15" r="9" fill="#fff6e4" ${line}/>
  <path d="M10 28 L12 32 M19 31 L21 34 M28 29 L30 33 M37 31 L38 34 M20 13 L22 17 M27 14 L29 18" stroke="#e3d9c1" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="24" cy="9" r="2" fill="#6b4423"/><circle cx="15" cy="24" r="2" fill="#6b4423"/><circle cx="33" cy="24" r="2" fill="#6b4423"/>`),
};

export const GOOD_ICONS: Record<GoodId, string> = Object.fromEntries(
  GOOD_ORDER.map((id) => [id, BODY[id].startsWith('<svg') ? BODY[id] : svg(BODY[id])]),
) as Record<GoodId, string>;

export { BAKERY_ICON };
