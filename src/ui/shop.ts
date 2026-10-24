import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { ActionResult, Farm } from '../core/farm';
import { COIN_ICON, LAND_ICON, LOCK_ICON, SHOP_ICON } from './icons';
import { reasonMessage } from './messages';

type TabId = 'seeds' | 'barn' | 'land';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'seeds', label: 'Sementes' },
  { id: 'barn', label: 'Celeiro' },
  { id: 'land', label: 'Terreno' },
];

const coin = (amount: number): string => `<span class="price"><i class="ico">${COIN_ICON}</i>${amount.toLocaleString('pt-BR')}</span>`;

export interface ShopEvents {
  /** Called after any successful purchase, sale or expansion, so the HUD can refresh. */
  onChange(action: string): void;
  onFail(): void;
  notify(message: string): void;
}

/** The village market: buy seeds, sell harvested produce from the barn, and expand the land. */
export class Shop {
  private tab: TabId = 'seeds';
  private readonly body: HTMLElement;
  private readonly tabs = new Map<TabId, HTMLButtonElement>();

  constructor(
    private readonly root: HTMLElement,
    private readonly farm: Farm,
    private readonly cropIcons: Record<CropId, string>,
    private readonly events: ShopEvents,
  ) {
    root.innerHTML = `
      <div class="shop-backdrop" data-close></div>
      <section class="shop-panel" role="dialog" aria-modal="true" aria-label="Loja">
        <header class="shop-head">
          <span class="shop-title"><i class="ico">${SHOP_ICON}</i>Loja da Vila</span>
          <button type="button" class="shop-close" data-close aria-label="Fechar">×</button>
        </header>
        <nav class="shop-tabs"></nav>
        <div class="shop-body"></div>
      </section>`;
    this.body = root.querySelector('.shop-body') as HTMLElement;

    const nav = root.querySelector('.shop-tabs') as HTMLElement;
    for (const { id, label } of TABS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shop-tab';
      button.textContent = label;
      button.addEventListener('click', () => this.show(id));
      this.tabs.set(id, button);
      nav.appendChild(button);
    }

    root.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('[data-close]')) this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });

    // One delegated handler for every button inside the list.
    this.body.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (!button || button.disabled) return;
      this.act(button.dataset['act']!, button.dataset['crop'] as CropId | undefined, Number(button.dataset['qty'] ?? 1));
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(tab: TabId = this.tab): void {
    this.root.hidden = false;
    this.show(tab);
  }

  close(): void {
    this.root.hidden = true;
  }

  /** Re-renders the visible tab (cheap; only while open). */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  private show(tab: TabId): void {
    this.tab = tab;
    this.render();
    this.body.scrollTop = 0;
  }

  private act(action: string, crop: CropId | undefined, qty: number): void {
    let result: ActionResult;
    switch (action) {
      case 'buy':
        result = this.farm.buySeeds(crop!, qty);
        break;
      case 'sell':
        result = this.farm.sell(crop!, qty);
        break;
      case 'sell-all':
        result = this.farm.sellAll();
        break;
      case 'expand':
        result = this.farm.expandLand();
        break;
      default:
        return;
    }
    if (!result.ok) {
      this.events.notify(reasonMessage(result.reason));
      this.events.onFail();
    } else {
      if (action === 'expand') this.events.notify(`Terreno ampliado para ${this.farm.landSize}×${this.farm.landSize}!`);
      this.events.onChange(action);
    }
    this.render();
  }

  private render(): void {
    for (const [id, button] of this.tabs) button.classList.toggle('active', id === this.tab);
    const scroll = this.body.scrollTop;
    this.body.innerHTML = this.tab === 'seeds' ? this.seedsHtml() : this.tab === 'barn' ? this.barnHtml() : this.landHtml();
    this.body.scrollTop = scroll;
  }

  private row(id: CropId, content: string, buttons: string, locked = false): string {
    return `
      <div class="shop-row${locked ? ' locked' : ''}">
        <span class="pic"><img alt="" draggable="false" src="${this.cropIcons[id]}" /></span>
        <span class="info">${content}</span>
        <span class="buttons">${buttons}</span>
      </div>`;
  }

  private seedsHtml(): string {
    const { farm } = this;
    const rows = CROP_ORDER.map((id) => {
      const crop = CROPS[id];
      const locked = farm.level < crop.unlockLevel;
      const info = locked
        ? `<b>${crop.name}</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${crop.unlockLevel}</small>`
        : `<b>${crop.name}</b><small>${coin(crop.seedCost)} cada · você tem ${farm.seeds[id]}</small>`;
      const button = (qty: number): string =>
        `<button type="button" class="buy" data-act="buy" data-crop="${id}" data-qty="${qty}" ${
          locked || farm.coins < crop.seedCost * qty ? 'disabled' : ''
        }>×${qty}</button>`;
      return this.row(id, info, locked ? '' : `${button(1)}${button(5)}${button(10)}`, locked);
    });
    return rows.join('');
  }

  private barnHtml(): string {
    const { farm } = this;
    const held = CROP_ORDER.filter((id) => farm.produce[id] > 0);
    if (held.length === 0) {
      return `<div class="shop-empty"><i class="ico big">${BARN_EMPTY}</i><p>Seu celeiro está vazio.</p><small>Colha plantas maduras para vendê-las aqui.</small></div>`;
    }
    const total = held.reduce((sum, id) => sum + farm.produce[id] * CROPS[id].sellPrice, 0);
    const rows = held.map((id) => {
      const crop = CROPS[id];
      const qty = farm.produce[id];
      return this.row(
        id,
        `<b>${crop.name} <span class="count">×${qty}</span></b><small>${coin(crop.sellPrice)} cada</small>`,
        `<button type="button" class="sell" data-act="sell" data-crop="${id}" data-qty="1">Vender 1</button>` +
          (qty > 1 ? `<button type="button" class="sell" data-act="sell" data-crop="${id}" data-qty="${qty}">Tudo</button>` : ''),
      );
    });
    return `${rows.join('')}
      <button type="button" class="big-action" data-act="sell-all">Vender tudo ${coin(total)}</button>`;
  }

  private landHtml(): string {
    const { farm } = this;
    const next = farm.nextExpansion();
    const now = `${farm.landSize}×${farm.landSize}`;
    if (!next) {
      return `<div class="shop-empty"><i class="ico big">${LAND_ICON}</i><p>Seu terreno está no tamanho máximo (${now}).</p><small>Mais terras virão em breve.</small></div>`;
    }
    const levelOk = farm.level >= next.level;
    const coinsOk = farm.coins >= next.cost;
    return `
      <div class="land-card">
        <i class="ico big">${LAND_ICON}</i>
        <h3>Terreno ${next.size}×${next.size}</h3>
        <p>Hoje você cultiva ${now}. Mais espaço, mais plantações!</p>
        <ul class="needs">
          <li class="${levelOk ? 'ok' : 'miss'}">Nível ${next.level}</li>
          <li class="${coinsOk ? 'ok' : 'miss'}">${coin(next.cost)}</li>
        </ul>
        <button type="button" class="big-action" data-act="expand" ${levelOk && coinsOk ? '' : 'disabled'}>Ampliar terreno</button>
      </div>`;
  }
}

const BARN_EMPTY = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 22 L24 6 L42 22 V42 Q42 44 40 44 H8 Q6 44 6 42 Z" fill="#e8c28a" stroke="#4a2b0f" stroke-width="2.6" stroke-linejoin="round"/><rect x="15" y="26" width="18" height="18" rx="1.5" fill="#c99a5b" stroke="#4a2b0f" stroke-width="2.6"/></svg>`;
