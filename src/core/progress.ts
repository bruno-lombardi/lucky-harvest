import { SPECIES_ORDER, penCapacity } from './animals';
import { CROP_ORDER, CropId } from './crops';
import { DECOR_ORDER } from './decor';
import { Farm, MAX_LAND } from './farm';
import { GOOD_ORDER } from './goods';
import { HELPERS, HELPER_ORDER } from './helpers';
import { totalCollected, totalFruit, totalHarvested } from './stats';
import { TREE_ORDER, TreeId } from './trees';

/**
 * Goals (Metas) and achievements (Conquistas), as plain data. Whether something is done is a pure
 * function of the farm, so the screen never decides and a server can verify a claim.
 * Rewards are coins only; cosmetics come later.
 */

export interface Goal {
  /** 1-based, in the order the player meets them. */
  readonly id: number;
  readonly chapter: number;
  readonly text: string;
  /** What to do, in a few friendly words. */
  readonly hint: string;
  readonly reward: number;
  readonly value: (farm: Farm) => number;
  readonly target: number;
  /** Which tool button or building the chip should point at. */
  readonly point?: 'arar' | 'semear' | 'regar' | 'colher' | 'cuidar' | 'loja' | 'celeiro' | 'galinheiro' | 'confeitaria';
}

export const CHAPTERS: readonly { readonly name: string; readonly intro: string }[] = [
  { name: 'Primeiros passos', intro: 'Arar, plantar, regar, colher e vender: o ciclo de toda fazenda.' },
  { name: 'Crescendo', intro: 'Mais sementes, mais terra e as primeiras pragas.' },
  { name: 'Bichos', intro: 'Galinhas dão ovos, ovos dão moedas. E ração vem do celeiro.' },
  { name: 'Ajudantes', intro: 'Contrate quem trabalha por você, mas lembre do salário e do custo dos bichos.' },
  { name: 'Mestre', intro: 'O que falta para ser dono de uma fazenda de verdade.' },
  { name: 'Pomar', intro: 'Árvores demoram para crescer, mas depois dão frutas para sempre.' },
  { name: 'Confeitaria', intro: 'Dona Zefa transforma a colheita em pães, doces e sucos que valem bem mais.' },
];

const pensBuilt = (f: Farm): number => SPECIES_ORDER.filter((s) => f.pens[s]).length;
const animalsOwned = (f: Farm): number => SPECIES_ORDER.reduce((n, s) => n + (f.pens[s]?.animals.length ?? 0), 0);
const speciesPicked = (f: Farm): number => TREE_ORDER.filter((t: TreeId) => f.stats.fruitPicked[t] > 0).length;
const bestHelperLevel = (f: Farm): number => Math.max(0, ...HELPER_ORDER.map((id) => f.helpers[id]?.level ?? 0));

// NEXT(content): daily quests and seasonal events are goals with a time window plus a `claimQuest` command; the data shape already
// fits. Never renumber or reuse goal ids: `farm.claimed` stores them.
export const GOALS: readonly Goal[] = [
  { id: 1, chapter: 0, text: 'Arar 3 terrenos', hint: 'Escolha a enxada e toque na grama dentro da cerca.', reward: 20, value: (f) => f.stats.plowed, target: 3, point: 'arar' },
  { id: 2, chapter: 0, text: 'Plantar uma cenoura', hint: 'Escolha o saquinho de sementes e toque na terra arada.', reward: 15, value: (f) => f.stats.planted, target: 1, point: 'semear' },
  { id: 3, chapter: 0, text: 'Regar a planta', hint: 'Planta sem água para na metade do caminho.', reward: 10, value: (f) => f.stats.watered, target: 1, point: 'regar' },
  { id: 4, chapter: 0, text: 'Colher a primeira cenoura', hint: 'Quando brilhar uma moeda dourada, ela está madura.', reward: 30, value: (f) => totalHarvested(f.stats), target: 1, point: 'colher' },
  { id: 5, chapter: 0, text: 'Vender sua colheita na Loja', hint: 'Abra a Loja e vá na aba Vender.', reward: 10, value: (f) => f.stats.sales, target: 1, point: 'loja' },
  { id: 6, chapter: 0, text: 'Comprar sementes novas', hint: 'Na Loja, aba Sementes: o dinheiro da venda vira plantação.', reward: 100, value: (f) => f.stats.seedsBought, target: 1, point: 'loja' },
  { id: 7, chapter: 1, text: 'Chegar ao nível 2', hint: 'Toda tarefa na horta dá experiência.', reward: 30, value: (f) => f.level, target: 2 },
  { id: 8, chapter: 1, text: 'Colher 10 culturas', hint: 'Plante vários terrenos de uma vez.', reward: 50, value: (f) => totalHarvested(f.stats), target: 10, point: 'colher' },
  { id: 9, chapter: 1, text: 'Cuidar de uma praga', hint: 'Plantas com ! precisam de carinho: use a mão.', reward: 20, value: (f) => f.stats.cared, target: 1, point: 'cuidar' },
  { id: 10, chapter: 1, text: 'Receber a entrega de sementes', hint: 'O caminhão passa a cada 5 minutos e deixa sementes no celeiro.', reward: 80, value: (f) => f.stats.deliveries, target: 1 },
  { id: 11, chapter: 1, text: 'Expandir o terreno para 8×8', hint: 'No nível 3, aba Fazenda da Loja.', reward: 150, value: (f) => f.landSize, target: 8, point: 'loja' },
  { id: 12, chapter: 2, text: 'Construir o Galinheiro', hint: 'No nível 2, aba Animais da Loja.', reward: 20, value: (f) => (f.pens.galinha ? 1 : 0), target: 1, point: 'loja' },
  { id: 13, chapter: 2, text: 'Comprar uma galinha', hint: 'Cada abrigo tem um número de vagas.', reward: 15, value: animalsOwned, target: 1, point: 'loja' },
  { id: 14, chapter: 2, text: 'Alimentar e coletar o primeiro ovo', hint: 'Dê ração, espere o ciclo e toque na galinha.', reward: 100, value: (f) => totalCollected(f.stats), target: 1, point: 'galinheiro' },
  { id: 15, chapter: 2, text: 'Moer ração no Celeiro', hint: 'Toque no celeiro: culturas viram ração.', reward: 200, value: (f) => f.stats.milled, target: 1, point: 'celeiro' },
  { id: 16, chapter: 3, text: 'Contratar o Regador do moinho', hint: 'No nível 3, aba Ajudantes da Loja.', reward: 150, value: (f) => (f.helpers.regador ? 1 : 0), target: 1, point: 'loja' },
  { id: 17, chapter: 3, text: 'Pagar um salário', hint: 'Ajudantes são pagos sozinhos enquanto você tiver moedas.', reward: 40, value: (f) => f.stats.wagesPaid, target: 1 },
  { id: 18, chapter: 3, text: 'Melhorar um ajudante', hint: 'Ajudantes melhores trabalham mais rápido.', reward: 300, value: bestHelperLevel, target: 2, point: 'loja' },
  { id: 19, chapter: 4, text: 'Colher 5 abóboras', hint: 'Abóbora libera no nível 8 e demora 25 minutos.', reward: 400, value: (f) => f.stats.harvested.abobora, target: 5, point: 'colher' },
  { id: 20, chapter: 4, text: 'Ter os três bichos no sítio', hint: 'Galinheiro, Curral e Chiqueiro.', reward: 500, value: pensBuilt, target: 3, point: 'loja' },
  { id: 21, chapter: 4, text: 'Chegar ao nível 10', hint: 'Girassol e a Entrega maior esperam por você.', reward: 200, value: (f) => f.level, target: 10 },
  { id: 22, chapter: 4, text: 'Terreno máximo', hint: 'O terreno de 12×12 chega no nível 12.', reward: 800, value: (f) => f.landSize, target: MAX_LAND, point: 'loja' },
  { id: 23, chapter: 4, text: 'Ganhar 10.000 moedas vendendo', hint: 'Culturas raras rendem bem mais por colheita.', reward: 60, value: (f) => f.stats.coinsEarned, target: 10_000 },
  { id: 24, chapter: 4, text: 'Completar o primeiro livro', hint: 'Resgate todas as metas e ganhe o título de Fazendeiro.', reward: 1000, value: (f) => GOALS.slice(0, 23).filter((g) => f.claimed.includes(goalKey(g.id))).length, target: 23 },
  { id: 25, chapter: 5, text: 'Plantar sua primeira árvore', hint: 'No nível 10, compre o Pomar na Loja (aba Árvores), depois uma muda e plante lá.', reward: 400, value: (f) => f.stats.treesPlanted, target: 1, point: 'loja' },
  { id: 26, chapter: 5, text: 'Colher a primeira fruta', hint: 'Regue a muda uma vez. Quando a moeda dourada brilhar na copa, é só colher.', reward: 500, value: (f) => totalFruit(f.stats), target: 1, point: 'colher' },
  { id: 27, chapter: 5, text: 'Ter 5 árvores no Pomar', hint: 'Cada árvore dá frutas para sempre, sem precisar replantar.', reward: 1500, value: (f) => f.treeCount(), target: 5, point: 'loja' },
  { id: 28, chapter: 6, text: 'Abrir a Confeitaria', hint: 'No nível 8, aba Fazenda da Loja. Plante cana-de-açúcar para o açúcar.', reward: 600, value: (f) => (f.bakery ? 1 : 0), target: 1, point: 'loja' },
  { id: 29, chapter: 6, text: 'Fazer 10 quitutes', hint: 'Toque na confeitaria, escolha uma receita e depois pegue a fornada pronta.', reward: 500, value: (f) => f.stats.baked, target: 10, point: 'confeitaria' },
  { id: 30, chapter: 6, text: 'Fazer um bolo', hint: 'Bolo de fubá (nível 11) ou de cenoura (nível 12): farinha, açúcar, ovos e muito carinho.', reward: 900, value: (f) => f.stats.bakedCakes, target: 1, point: 'confeitaria' },
];

export const goalKey = (id: number): string => `g${id}`;
export const goalDone = (g: Goal, farm: Farm): boolean => g.value(farm) >= g.target;
export const goalClaimed = (g: Goal, farm: Farm): boolean => farm.claimed.includes(goalKey(g.id));

/** The next goal the player has not finished (claimed goals are skipped). */
export function currentGoal(farm: Farm): Goal | null {
  return GOALS.find((g) => !goalClaimed(g, farm)) ?? null;
}

export const claimableGoals = (farm: Farm): Goal[] => GOALS.filter((g) => !goalClaimed(g, farm) && goalDone(g, farm));

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export type Medal = 'bronze' | 'prata' | 'ouro';
export const MEDALS: readonly Medal[] = ['bronze', 'prata', 'ouro'];

export interface Achievement {
  readonly id: string;
  readonly category: string;
  readonly name: string;
  /** "{n} colheitas" style text for a step, given its goal number. */
  readonly describe: (target: number) => string;
  readonly value: (farm: Farm) => number;
  /** One target per medal (a single-step achievement has only the first). */
  readonly steps: readonly number[];
  /** Coins for each step. */
  readonly rewards: readonly number[];
}

const tiered = (
  id: string,
  category: string,
  name: string,
  describe: (n: number) => string,
  value: (f: Farm) => number,
  steps: [number, number, number],
  rewards: [number, number, number] = [100, 1000, 6000],
): Achievement => ({ id, category, name, describe, value, steps, rewards });

const single = (id: string, category: string, name: string, text: string, value: (f: Farm) => number, target: number, reward: number): Achievement => ({
  id,
  category,
  name,
  describe: () => text,
  value,
  steps: [target],
  rewards: [reward],
});

const harvestedOf = (crop: CropId) => (f: Farm): number => f.stats.harvested[crop];
const maxedPens = (f: Farm): number =>
  SPECIES_ORDER.filter((s) => {
    const pen = f.pens[s];
    return pen !== undefined && pen.animals.length >= penCapacity(s, pen.level);
  }).length;
const helperLevelsBought = (f: Farm): number => f.stats.helperUpgrades;

export const ACHIEVEMENTS: readonly Achievement[] = [
  tiered('colheitas', 'Lavoura', 'Mão na terra', (n) => `Colher ${n.toLocaleString('pt-BR')} culturas`, (f) => totalHarvested(f.stats), [50, 500, 5000]),
  tiered('variedade', 'Lavoura', 'Colheita variada', (n) => `Colher ${n} tipos de cultura`, (f) => CROP_ORDER.filter((c) => f.stats.harvested[c] > 0).length, [3, 6, CROP_ORDER.length], [100, 1000, 6000]),
  tiered('arado', 'Lavoura', 'Terra arada', (n) => `Arar ${n.toLocaleString('pt-BR')} terrenos`, (f) => f.stats.plowed, [100, 1000, 10000]),
  tiered('regador', 'Lavoura', 'Sede de vencer', (n) => `Regar ${n.toLocaleString('pt-BR')} plantas`, (f) => f.stats.watered, [100, 1000, 10000]),
  tiered('abobora', 'Lavoura', 'Rei da abóbora', (n) => `Colher ${n.toLocaleString('pt-BR')} abóboras`, harvestedOf('abobora'), [10, 100, 1000]),
  tiered('pragas', 'Lavoura', 'Mão amiga', (n) => `Cuidar de ${n.toLocaleString('pt-BR')} pragas`, (f) => f.stats.cared, [10, 100, 1000]),
  tiered('garimpeiro', 'Lavoura', 'Garimpeiro', (n) => `Colher ${n.toLocaleString('pt-BR')} culturas raras ou épicas`, (f) => f.stats.rareHarvested, [5, 50, 500], [300, 2500, 12000]),
  tiered('ovos', 'Pecuária', 'Galinha dos ovos de ouro', (n) => `Coletar ${n.toLocaleString('pt-BR')} ovos`, (f) => f.stats.collected.ovo, [25, 250, 2500]),
  tiered('leite', 'Pecuária', 'Leiteiro', (n) => `Coletar ${n.toLocaleString('pt-BR')} leites`, (f) => f.stats.collected.leite, [15, 150, 1500]),
  tiered('trufas', 'Pecuária', 'Caçador de trufas', (n) => `Coletar ${n.toLocaleString('pt-BR')} trufas`, (f) => f.stats.collected.trufa, [10, 100, 1000]),
  tiered('alimentados', 'Pecuária', 'Bicho bem tratado', (n) => `Alimentar ${n.toLocaleString('pt-BR')} animais`, (f) => f.stats.fed, [50, 500, 5000]),
  tiered('sitio', 'Pecuária', 'Sítio completo', (n) => (n === 1 ? 'Encher 1 abrigo' : `Encher ${n} abrigos`), maxedPens, [1, 2, 3], [200, 1500, 8000]),
  tiered('caixa', 'Comércio', 'Primeiro caixa', (n) => `Ganhar ${n.toLocaleString('pt-BR')} moedas vendendo`, (f) => f.stats.coinsEarned, [1000, 25_000, 500_000], [100, 2500, 25_000]),
  tiered('negocio', 'Comércio', 'Bom negócio', (n) => `Fazer uma venda de ${n.toLocaleString('pt-BR')} moedas`, (f) => f.stats.bestSale, [200, 1000, 5000]),
  tiered('racao', 'Comércio', 'Mestre da ração', (n) => `Moer ${n.toLocaleString('pt-BR')} lotes de ração`, (f) => f.stats.milled, [10, 100, 1000]),
  tiered('salarios', 'Ajudantes', 'Patrão justo', (n) => `Pagar ${n.toLocaleString('pt-BR')} salários`, (f) => f.stats.wagesPaid, [5, 50, 500]),
  tiered('equipe', 'Ajudantes', 'Equipe completa', (n) => `Contratar ${n} ajudantes`, (f) => HELPER_ORDER.filter((id) => f.helpers[id]).length, [1, 3, HELPER_ORDER.length], [100, 1500, 8000]),
  tiered('capricho', 'Ajudantes', 'Capricho de patrão', (n) => `Melhorar ajudantes ${n} vezes`, helperLevelsBought, [1, 4, HELPER_ORDER.reduce((n, id) => n + HELPERS[id].upgradeCost.length, 0)], [150, 1500, 8000]),
  tiered('entregas', 'Entregas', 'Caminhão amigo', (n) => `Receber ${n.toLocaleString('pt-BR')} entregas`, (f) => f.stats.deliveries, [5, 50, 500]),
  tiered('feira', 'Entregas', 'Dia de feira', (n) => `Receber ${n.toLocaleString('pt-BR')} sementes do caminhão`, (f) => f.stats.seedsReceived, [30, 300, 3000]),
  tiered('nivel', 'Fazendeiro', 'Subindo na vida', (n) => `Chegar ao nível ${n}`, (f) => f.level, [5, 15, 30], [150, 2000, 10_000]),
  tiered('terra', 'Fazendeiro', 'Dono da terra', (n) => `Ter um terreno de ${n}×${n}`, (f) => f.landSize, [8, 10, MAX_LAND], [300, 1500, 8000]),
  tiered('celeiro', 'Fazendeiro', 'Celeiro dos sonhos', (n) => `Ter o celeiro no nível ${n}`, (f) => f.barn, [2, 3, 4], [300, 1500, 8000]),
  tiered('enfeites', 'Fazendeiro', 'Meu cantinho', (n) => `Ter ${n} ${n === 1 ? 'enfeite' : 'enfeites'}`, (f) => DECOR_ORDER.filter((d) => f.decor[d]).length, [1, 3, DECOR_ORDER.length], [100, 1000, 6000]),
  tiered('frutas', 'Pomar', 'Pomareiro', (n) => `Colher ${n.toLocaleString('pt-BR')} frutas`, (f) => totalFruit(f.stats), [50, 500, 5000], [200, 2000, 10_000]),
  tiered('bosque', 'Pomar', 'Bosque', (n) => `Ter ${n} árvores no Pomar`, (f) => f.treeCount(), [3, 8, 18], [200, 1500, 8000]),
  tiered('pomarvar', 'Pomar', 'Variedade de pomar', (n) => `Colher ${n} tipos de fruta`, speciesPicked, [2, 4, 5], [300, 1500, 6000]),
  tiered('quitutes', 'Confeitaria', 'Mão na massa', (n) => `Fazer ${n.toLocaleString('pt-BR')} quitutes`, (f) => f.stats.baked, [20, 250, 2500], [300, 2500, 12_000]),
  tiered('sabores', 'Confeitaria', 'Cardápio completo', (n) => `Fazer ${n} receitas diferentes`, (f) => GOOD_ORDER.filter((g) => f.stats.bakedBy[g] > 0).length, [5, 12, GOOD_ORDER.length], [300, 2500, 10_000]),
  tiered('doceria', 'Confeitaria', 'Doceria dos sonhos', (n) => `Ter a confeitaria no nível ${n}`, (f) => f.bakery?.level ?? 0, [1, 2, 3], [300, 1500, 8000]),
  single('ouro', 'Especiais', 'Fruta de ouro', 'Colher uma fruta dourada', (f) => f.stats.goldenFruit, 1, 600),
  single('resgate', 'Especiais', 'Resgate', 'Plantar uma semente com a carteira vazia', (f) => f.stats.rescues, 1, 100),
  single('mingau', 'Especiais', 'Mingau no comando', 'O gato cuidar de 25 pragas', (f) => f.stats.catCares, 25, 500),
  single('tonico', 'Especiais', 'Tonico trabalhador', 'O Tonico colher 100 culturas', (f) => f.stats.farmhandHarvests, 100, 800),
  single('sorte', 'Especiais', 'Sorte grande', 'Receber uma semente rara no caminhão', (f) => f.stats.rareSeedsReceived, 1, 500),
  single(
    'mestre',
    'Especiais',
    'Mestre da fazenda',
    'Resgatar todas as metas e todas as medalhas de ouro',
    (f) => {
      const goals = GOALS.every((g) => goalClaimed(g, f));
      const golds = ACHIEVEMENTS.filter((a) => a.id !== 'mestre' && a.steps.length === 3).every((a) => f.claimed.includes(achievementKey(a.id, 2)));
      return goals && golds ? 1 : 0;
    },
    1,
    5000,
  ),
];

export const achievementKey = (id: string, step: number): string => `a:${id}:${step}`;
export const stepDone = (a: Achievement, step: number, farm: Farm): boolean => a.value(farm) >= a.steps[step]!;
export const stepClaimed = (a: Achievement, step: number, farm: Farm): boolean => farm.claimed.includes(achievementKey(a.id, step));

/** The medals reached so far (0 to steps.length), claimed or not. */
export const stepsReached = (a: Achievement, farm: Farm): number => a.steps.filter((_, n) => stepDone(a, n, farm)).length;

export interface Claimable {
  achievement: Achievement;
  step: number;
}

export function claimableSteps(farm: Farm): Claimable[] {
  const out: Claimable[] = [];
  for (const achievement of ACHIEVEMENTS) {
    for (let step = 0; step < achievement.steps.length; step++) {
      if (stepDone(achievement, step, farm) && !stepClaimed(achievement, step, farm)) out.push({ achievement, step });
    }
  }
  return out;
}

/** Everything waiting to be collected in the book (for the red dot). */
export const claimableCount = (farm: Farm): number => claimableGoals(farm).length + claimableSteps(farm).length;

export const findAchievement = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id);
export const findGoal = (id: number): Goal | undefined => GOALS.find((g) => g.id === id);

/** The chip shows only the first this many goals; the rest live in the book. */
export const CHIP_GOALS = 10;
export const BOOK_TITLE_GOAL = 24;
