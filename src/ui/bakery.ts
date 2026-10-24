import { PRODUCTS } from '../core/animals';
import { CROPS } from '../core/crops';
import { Farm } from '../core/farm';
import {
  BATCH_OPTIONS,
  GOODS,
  GOOD_ORDER,
  GoodId,
  GoodKind,
  Ingredient,
  MAX_BAKERY_LEVEL,
  ZEFA_LINES,
  bakeMs,
  bakeryTier,
  nextBakeryTier,
} from '../core/goods';
import { TREES } from '../core/trees';
import { formatDuration } from './messages';
import { GOOD_ICONS } from './good-icons';
import { BAKERY_ICON } from './bakery-icon';
import { LOCK_ICON } from './icons';
import { Dispatch, coin, heading, row } from './kit';
import { Modal } from './modal';

type BakeryTab = 'forno' | 'receitas';

export interface BakeryEvents {
  openShop(tab: 'seeds' | 'trees' | 'land'): void;
}

export const ingredientName = (ing: Ingredient): string => {
  switch (ing.kind) {
    case 'crop':
      return CROPS[ing.id].name;
    case 'product':
      return PRODUCTS[ing.id].name;
    case 'fruit':
      return TREES[ing.id].fruitName;
    case 'good':
      return GOODS[ing.id].name;
  }
};

const KIND_TITLES: Record<GoodKind, string> = { base: 'Ingredientes', pao: 'Pães', doce: 'Doces', bebida: 'Bebidas' };
const KIND_ORDER: readonly GoodKind[] = ['base', 'pao', 'doce', 'bebida'];

/** The Confeitaria: the ovens Dona Zefa works at, and the recipes the player can order. */
export class BakeryDialog extends Modal<BakeryTab> {
  private line = ZEFA_LINES[0]!;

  constructor(
    root: HTMLElement,
    private readonly farm: Farm,
    private readonly dispatch: Dispatch,
    private readonly events: BakeryEvents,
  ) {
    super(root, 'Confeitaria', [{ id: 'forno', label: 'Fornos' }, { id: 'receitas', label: 'Receitas' }], 'forno');
  }

  open(tab: BakeryTab = 'forno'): void {
    this.line = ZEFA_LINES[Math.floor(Math.random() * ZEFA_LINES.length)]!;
    this.openAt(tab);
  }

  protected title(): string {
    return `<i class="ico">${BAKERY_ICON}</i>${this.farm.bakery ? bakeryTier(this.farm.bakery.level).name : 'Confeitaria'}`;
  }

  protected html(): string {
    return this.tab === 'forno' ? this.ovensHtml() : this.recipesHtml();
  }

  protected onAction(action: string, data: DOMStringMap): void {
    switch (action) {
      case 'bake':
        this.dispatch({ type: 'bake', good: data['good'] as GoodId, batches: Number(data['batches'] ?? 1) });
        break;
      case 'collect':
        this.dispatch({ type: 'collectBakery' });
        break;
      case 'upgrade':
        this.dispatch({ type: 'upgradeBakery' });
        break;
      case 'tab':
        this.show(data['tab'] as BakeryTab);
        return;
      case 'shop':
        this.close();
        this.events.openShop(data['tab'] as 'seeds');
        return;
    }
    this.repaint();
  }

  private ovensHtml(): string {
    const { farm } = this;
    const bakery = farm.bakery;
    if (!bakery) return '<p class="tip">Construa a confeitaria na Loja (aba Fazenda).</p>';
    const now = Date.now();
    const tier = bakeryTier(bakery.level);
    let html = `<p class="tip speech">“${this.line}” <small>Dona Zefa</small></p>`;
    html += heading(`Fornos (${bakery.jobs.length}/${tier.slots})`);
    for (let n = 0; n < tier.slots; n++) {
      const job = bakery.jobs[n];
      if (!job) {
        html += row('<i class="ico slot">+</i>', '<b>Forno livre</b><small>Escolha uma receita na aba Receitas.</small>', '', false, '', 'empty');
        continue;
      }
      const def = GOODS[job.good];
      const left = job.readyAt - now;
      const total = job.readyAt - job.startedAt;
      const done = left <= 0;
      const pct = done ? 100 : Math.max(2, Math.min(100, ((now - job.startedAt) / total) * 100));
      html += row(
        GOOD_ICONS[job.good],
        `<b>${def.name} <span class="count">×${def.yield * job.batches}</span></b>` +
          `<span class="bar${done ? ' done' : ''}"><i style="width:${pct.toFixed(0)}%"></i></span>` +
          `<small>${done ? 'Pronto! Pegue no balcão.' : `Falta ${formatDuration(left)}`}</small>`,
        '',
        false,
        `good:${job.good}`,
      );
    }
    const ready = farm.bakeryReady(now);
    html += `<button type="button" class="big-action" data-act="collect" ${ready ? '' : 'disabled'}>${ready ? `Pegar o que está pronto (${ready})` : 'Nada pronto ainda'}</button>`;

    const next = nextBakeryTier(bakery.level);
    html += heading('Melhorias');
    if (!next) {
      html += `<p class="tip">${tier.perk}. A doceria já está no máximo (${MAX_BAKERY_LEVEL}/${MAX_BAKERY_LEVEL}).</p>`;
    } else {
      const locked = farm.level < next.unlockLevel;
      html += row(
        `<i class="ico">${BAKERY_ICON}</i>`,
        `<b>${next.name}</b><small>${next.perk} · ${locked ? `<i class="ico">${LOCK_ICON}</i>Nível ${next.unlockLevel}` : coin(next.cost)}</small>`,
        `<button type="button" class="buy wide" data-act="upgrade" ${locked || farm.coins < next.cost ? 'disabled' : ''}>Melhorar</button>`,
        locked,
      );
    }
    return html;
  }

  private ingredientHtml(ing: Ingredient, batches: number): string {
    const need = ing.qty * batches;
    const have = this.haveOf(ing);
    return `<span class="ing${have >= need ? ' ok' : ' miss'}">${ingredientName(ing)} ${have}/${need}</span>`;
  }

  private haveOf(ing: Ingredient): number {
    const { farm } = this;
    switch (ing.kind) {
      case 'crop':
        return farm.produce[ing.id];
      case 'product':
        return farm.products[ing.id];
      case 'fruit':
        return farm.fruit[ing.id];
      case 'good':
        return farm.goods[ing.id];
    }
  }

  private recipesHtml(): string {
    const { farm } = this;
    const bakery = farm.bakery;
    if (!bakery) return '<p class="tip">Construa a confeitaria na Loja (aba Fazenda).</p>';
    const full = bakery.jobs.length >= bakeryTier(bakery.level).slots;
    let html = full ? '<p class="tip warn">Todos os fornos estão ocupados. Pegue o que já ficou pronto.</p>' : '<p class="tip hint">Segure o dedo (ou passe o mouse) numa receita para ver os detalhes. Fazer várias fornadas de uma vez sai mais rápido.</p>';
    for (const kind of KIND_ORDER) {
      const goods = GOOD_ORDER.filter((id) => GOODS[id].kind === kind);
      html += heading(KIND_TITLES[kind]);
      html += goods
        .map((id) => {
          const def = GOODS[id];
          const locked = farm.level < def.unlockLevel;
          if (locked) {
            return row(GOOD_ICONS[id], `<b>${def.name}</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${def.unlockLevel}</small>`, '', true, `good:${id}`);
          }
          const ings = def.inputs.map((ing) => this.ingredientHtml(ing, 1)).join(' ');
          const buttons = BATCH_OPTIONS.map(
            (n) =>
              `<button type="button" class="buy" data-act="bake" data-good="${id}" data-batches="${n}" ${full || !farm.canBake(id, n) ? 'disabled' : ''}>×${n}</button>`,
          ).join('');
          return row(
            GOOD_ICONS[id],
            `<b>${def.name} <span class="count">→ ${def.yield}</span></b><span class="ings">${ings}</span><small>${coin(def.sellPrice)} cada · ${formatDuration(bakeMs(id, bakery.level, 1))} · ${def.xp} XP</small>`,
            buttons,
            false,
            `good:${id}`,
          );
        })
        .join('');
    }
    html += `<button type="button" class="big-action alt" data-act="shop" data-tab="seeds">Comprar sementes</button>`;
    return html;
  }
}
