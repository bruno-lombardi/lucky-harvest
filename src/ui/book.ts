import { CROPS, CROP_ORDER } from '../core/crops';
import { Farm } from '../core/farm';
import {
  ACHIEVEMENTS,
  Achievement,
  CHAPTERS,
  GOALS,
  Goal,
  BOOK_TITLE_GOAL,
  MEDALS,
  claimableCount,
  goalClaimed,
  goalDone,
  stepClaimed,
  stepDone,
} from '../core/progress';
import { BOOK_ICON, MEDAL_ICON } from './icons';
import { Dispatch, coin, heading } from './kit';
import { Modal } from './modal';

export type BookTab = 'guia' | 'metas' | 'conquistas';

const TABS = [
  { id: 'guia', label: 'Guia' },
  { id: 'metas', label: 'Metas' },
  { id: 'conquistas', label: 'Conquistas' },
] as const;

const MEDAL_COLOR = { bronze: '#c9783a', prata: '#b9c4cf', ouro: '#f5c030' } as const;
const medal = (kind: keyof typeof MEDAL_COLOR, got: boolean): string =>
  `<i class="medal${got ? ' got' : ''}" title="${kind}">${MEDAL_ICON(MEDAL_COLOR[kind])}</i>`;

const bar = (value: number, target: number): string =>
  `<span class="prog"><i style="width:${Math.round(Math.min(1, value / target) * 100)}%"></i></span>`;

const fmt = (n: number): string => Math.floor(n).toLocaleString('pt-BR');

interface Stage {
  from: number;
  title: string;
  lines: string[];
}

/** The journey, told in the order a player lives it. `from` is the level where the stage starts. */
const STAGES: readonly Stage[] = [
  {
    from: 1,
    title: 'Primeiros passos',
    lines: [
      'Escolha a enxada e are um pedaço de grama. Depois escolha o saquinho, toque na terra e plante uma cenoura.',
      'Regue com o regador: planta sem água para na metade do caminho. Quando uma moeda dourada brilhar, colha com a cesta.',
      'Venda a colheita na Loja (aba Vender) e compre mais sementes. Pronto: esse é o ciclo da fazenda.',
    ],
  },
  {
    from: 2,
    title: 'Crescendo',
    lines: [
      'Milho e tomate chegam logo, e o terreno cresce para 8×8 no nível 3.',
      'Pragas travam o crescimento: um ! sobre a planta pede a luva. Planta esquecida murcha, e aí só com a vassoura.',
      'A cada 5 minutos o caminhão deixa sementes no celeiro, mesmo com a fazenda quebrada. Dá para recomeçar sempre.',
    ],
  },
  {
    from: 4,
    title: 'Fazenda viva',
    lines: [
      'Galinhas, vacas e porcos dão ovos, leite e trufas. Dê ração, espere o ciclo e toque no bicho para coletar.',
      'No Celeiro, culturas viram ração. Contrate o Regador, o Tonico e o Mingau, mas lembre: eles cobram salário (ou custo, no caso dos bichos).',
      'Terreno de 10×10 no nível 6, e morango e abóbora no caminho.',
    ],
  },
  {
    from: 9,
    title: 'Fazenda próspera',
    lines: [
      'Abrigos melhoram (mais bichos, ciclo mais rápido), o caminhão ganha upgrades e o terreno chega a 12×12.',
      'Sementes raras valem muito mais e podem render colheita dourada. Rex, o cão, recolhe os produtos dos abrigos e a Lúcia dá ração aos bichos. Melhore o celeiro para baixar os custos dos ajudantes.',
      'No nível 10, compre o Pomar ao lado do moinho: árvores precisam de uma rega enquanto jovens e depois dão frutas para sempre.',
      'Enfeites a partir do nível 14: para gastar moedas com estilo.',
    ],
  },
  {
    from: 20,
    title: 'Mestre da fazenda',
    lines: [
      'Medalhas de ouro, a Flor-da-lua e a Entrega rápida. O nível 50 é a meta de uma vida inteira.',
      'Resgate todas as metas e medalhas de ouro para o título de Mestre da fazenda.',
    ],
  },
];

/** The Livro da Fazenda: a short guide, the goals (Metas) and the medals (Conquistas). */
export class BookDialog extends Modal<BookTab> {
  constructor(
    root: HTMLElement,
    private readonly farm: Farm,
    private readonly dispatch: Dispatch,
  ) {
    super(root, 'Livro da Fazenda', TABS, 'metas');
  }

  open(tab: BookTab = this.tab): void {
    this.openAt(tab);
  }

  protected title(): string {
    return `<i class="ico">${BOOK_ICON}</i>Livro da Fazenda`;
  }

  protected html(): string {
    const dot = (n: number): string => (n > 0 ? ` <span class="dot-count">${n}</span>` : '');
    const tabs = this.root.querySelectorAll<HTMLButtonElement>('.shop-tab');
    const goals = GOALS.filter((g) => goalDone(g, this.farm) && !goalClaimed(g, this.farm)).length;
    const medals = claimableCount(this.farm) - goals;
    tabs[1] && (tabs[1].innerHTML = `Metas${dot(goals)}`);
    tabs[2] && (tabs[2].innerHTML = `Conquistas${dot(medals)}`);
    switch (this.tab) {
      case 'guia':
        return this.guideHtml();
      case 'metas':
        return this.goalsHtml();
      case 'conquistas':
        return this.achievementsHtml();
    }
  }

  protected onAction(action: string, data: DOMStringMap): void {
    if (action === 'goal') this.dispatch({ type: 'claimGoal', goal: Number(data['goal']) });
    else if (action === 'medal') this.dispatch({ type: 'claimAchievement', achievement: data['id']!, step: Number(data['step']) });
    else if (action === 'claim-all') this.claimAll();
    this.repaint();
  }

  private claimAll(): void {
    for (const g of GOALS) if (goalDone(g, this.farm) && !goalClaimed(g, this.farm)) this.dispatch({ type: 'claimGoal', goal: g.id });
    for (const a of ACHIEVEMENTS) {
      for (let step = 0; step < a.steps.length; step++) {
        if (stepDone(a, step, this.farm) && !stepClaimed(a, step, this.farm)) this.dispatch({ type: 'claimAchievement', achievement: a.id, step });
      }
    }
  }

  private guideHtml(): string {
    const level = this.farm.level;
    const current = [...STAGES].reverse().find((s) => level >= s.from) ?? STAGES[0]!;
    const cards = STAGES.map((stage) => {
      const here = stage === current;
      const locked = level < stage.from;
      return `
        <section class="guide-card${here ? ' here' : ''}${locked ? ' later' : ''}">
          <h4>${here ? '<span class="you">Você está aqui</span>' : ''}${stage.title}<small>${locked ? `a partir do nível ${stage.from}` : ''}</small></h4>
          ${stage.lines.map((l) => `<p>${l}</p>`).join('')}
        </section>`;
    }).join('');
    const rares = CROP_ORDER.filter((id) => CROPS[id].rarity !== 'comum' && CROPS[id].rarity !== 'incomum')
      .map((id) => CROPS[id].name)
      .join(', ');
    return `
      <p class="tip">Toque em <b>Metas</b> para ver o que fazer agora. Você pode ignorar o guia e resgatar as recompensas quando quiser.</p>
      ${cards}
      <p class="tip">Sementes de raridade alta (${rares}) custam caro e demoram, mas pagam muito mais.</p>`;
  }

  private goalRow(g: Goal, current: boolean): string {
    const { farm } = this;
    const value = Math.min(g.value(farm), g.target);
    const done = goalDone(g, farm);
    const claimed = goalClaimed(g, farm);
    const state = claimed ? 'claimed' : done ? 'ready' : current ? 'now' : '';
    const button = claimed
      ? `<span class="check" aria-label="Resgatado">✓</span>`
      : done
        ? `<button type="button" class="sell wide" data-act="goal" data-goal="${g.id}">Resgatar</button>`
        : '';
    const progress = !done && g.target > 1 ? ` ${bar(value, g.target)}<small>${fmt(value)}/${fmt(g.target)}</small>` : '';
    return `
      <div class="goal-row ${state}">
        <span class="num">${g.id}</span>
        <span class="info"><b>${g.text}</b><small>${claimed ? '' : g.hint}</small>${progress}</span>
        <span class="reward">${coin(g.reward)}</span>
        <span class="buttons">${button}</span>
      </div>`;
  }

  private goalsHtml(): string {
    const { farm } = this;
    const next = GOALS.find((g) => !goalClaimed(g, farm));
    const claimable = claimableCount(farm);
    const total = GOALS.filter((g) => goalClaimed(g, farm)).length;
    const parts: string[] = [];
    parts.push(
      `<div class="book-summary"><span><b>${total}</b> de ${GOALS.length} metas resgatadas</span>${
        claimable > 0 ? `<button type="button" class="sell" data-act="claim-all">Resgatar tudo (${claimable})</button>` : ''
      }</div>`,
    );
    if (goalClaimed(GOALS[BOOK_TITLE_GOAL - 1]!, farm)) parts.push(`<p class="tip ok">Título conquistado: <b>Fazendeiro</b></p>`);
    CHAPTERS.forEach((chapter, c) => {
      const list = GOALS.filter((g) => g.chapter === c);
      const done = list.filter((g) => goalClaimed(g, farm)).length;
      parts.push(`${heading(`${chapter.name} <small>${done}/${list.length}</small>`)}<p class="chapter-intro">${chapter.intro}</p>`);
      parts.push(list.map((g) => this.goalRow(g, g === next)).join(''));
    });
    return parts.join('');
  }

  private achievementRow(a: Achievement): string {
    const { farm } = this;
    const value = a.value(farm);
    const nextStep = a.steps.findIndex((t) => value < t);
    const claimStep = a.steps.findIndex((_, n) => stepDone(a, n, farm) && !stepClaimed(a, n, farm));
    const medals = a.steps.length === 3 ? MEDALS.map((kind, n) => medal(kind, stepClaimed(a, n, farm))).join('') : medal('ouro', stepClaimed(a, 0, farm));
    const finished = nextStep === -1;
    const target = finished ? a.steps[a.steps.length - 1]! : a.steps[nextStep]!;
    const text = a.describe(target);
    const button =
      claimStep >= 0
        ? `<button type="button" class="sell wide" data-act="medal" data-id="${a.id}" data-step="${claimStep}">Resgatar ${coin(a.rewards[claimStep]!)}</button>`
        : '';
    const progress = finished ? '' : `${bar(value, target)}<small>${fmt(value)}/${fmt(target)}</small>`;
    return `
      <div class="goal-row medal-row${claimStep >= 0 ? ' ready' : ''}${finished && claimStep < 0 ? ' claimed' : ''}">
        <span class="medals">${medals}</span>
        <span class="info"><b>${a.name}</b><small>${text}</small>${progress}</span>
        <span class="buttons">${button}</span>
      </div>`;
  }

  private achievementsHtml(): string {
    const { farm } = this;
    let got = 0;
    let all = 0;
    for (const a of ACHIEVEMENTS) {
      all += a.steps.length;
      got += a.steps.filter((_, n) => stepDone(a, n, farm)).length;
    }
    const categories = [...new Set(ACHIEVEMENTS.map((a) => a.category))];
    const claimable = claimableCount(farm);
    const parts = [
      `<div class="book-summary"><span><b>${got}</b> de ${all} medalhas</span>${
        claimable > 0 ? `<button type="button" class="sell" data-act="claim-all">Resgatar tudo (${claimable})</button>` : ''
      }</div>`,
    ];
    for (const category of categories) {
      parts.push(heading(category));
      parts.push(ACHIEVEMENTS.filter((a) => a.category === category).map((a) => this.achievementRow(a)).join(''));
    }
    return parts.join('');
  }
}
