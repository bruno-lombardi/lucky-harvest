import { PRODUCTS, PRODUCT_ORDER, SPECIES, SPECIES_ORDER, SpeciesId } from '../core/animals';
import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { barnTier, nextBarnTier } from '../core/barn';
import { Farm } from '../core/farm';
import { TREES, TREE_ORDER, TreeId } from '../core/trees';
import { BARN_ICON } from './icons';
import { FEED_ICONS, PRODUCT_ICONS } from './item-icons';
import { GOODS, GOOD_ORDER } from '../core/goods';
import { GOOD_ICONS } from './good-icons';
import { Dispatch, empty, heading, img, row } from './kit';
import { Modal } from './modal';

type BarnTab = 'stock' | 'feed';

export interface BarnEvents {
  openShop(tab: 'sell' | 'seeds' | 'feed' | 'land'): void;
}

/** The barn: everything the player owns, and the feed mill that turns crops into animal feed. */
export class BarnDialog extends Modal<BarnTab> {
  constructor(
    root: HTMLElement,
    private readonly farm: Farm,
    private readonly cropIcons: Record<CropId, string>,
    private readonly treeIcons: Record<TreeId, string>,
    private readonly dispatch: Dispatch,
    private readonly events: BarnEvents,
  ) {
    super(root, 'Celeiro', [{ id: 'stock', label: 'Estoque' }, { id: 'feed', label: 'Fazer ração' }], 'stock');
  }

  open(tab: BarnTab = 'stock'): void {
    this.openAt(tab);
  }

  protected title(): string {
    return `<i class="ico">${BARN_ICON}</i>${barnTier(this.farm.barn).name}`;
  }

  protected html(): string {
    return this.tab === 'stock' ? this.stockHtml() : this.millHtml();
  }

  protected onAction(action: string, data: DOMStringMap): void {
    const species = data['species'] as SpeciesId | undefined;
    switch (action) {
      case 'craft':
        this.dispatch({ type: 'craftFeed', species: species!, batches: Number(data['qty'] ?? 1) });
        this.repaint();
        break;
      case 'shop':
        this.close();
        this.events.openShop(data['tab'] as 'sell');
        break;
    }
  }

  private stockHtml(): string {
    const { farm } = this;
    const seeds = CROP_ORDER.filter((id) => farm.seeds[id] > 0);
    const crops = CROP_ORDER.filter((id) => farm.produce[id] > 0);
    const products = PRODUCT_ORDER.filter((id) => farm.products[id] > 0);
    const feed = SPECIES_ORDER.filter((id) => farm.feed[id] > 0);
    const saplings = TREE_ORDER.filter((id) => farm.saplings[id] > 0);
    const fruits = TREE_ORDER.filter((id) => farm.fruit[id] > 0);
    const goods = GOOD_ORDER.filter((id) => farm.goods[id] > 0);
    const count = (n: number): string => `<span class="count">×${n}</span>`;
    let html = '';
    if (seeds.length) {
      html += heading('Sementes');
      html += seeds.map((id) => row(img(this.cropIcons[id]), `<b>${CROPS[id].name} ${count(farm.seeds[id])}</b>`, '', false, `crop:${id}`)).join('');
    }
    if (crops.length) {
      html += heading('Colheitas');
      html += crops.map((id) => row(img(this.cropIcons[id]), `<b>${CROPS[id].name} ${count(farm.produce[id])}</b>`, '', false, `crop:${id}`)).join('');
    }
    if (saplings.length) {
      html += heading('Mudas');
      html += saplings.map((id) => row(img(this.treeIcons[id]), `<b>Muda de ${TREES[id].name.toLowerCase()} ${count(farm.saplings[id])}</b>`, '', false, `tree:${id}`)).join('');
    }
    if (fruits.length) {
      html += heading('Frutas');
      html += fruits.map((id) => row(img(this.treeIcons[id]), `<b>${TREES[id].fruitName} ${count(farm.fruit[id])}</b>`, '', false, `tree:${id}`)).join('');
    }
    if (goods.length) {
      html += heading('Da confeitaria');
      html += goods.map((id) => row(GOOD_ICONS[id], `<b>${GOODS[id].name} ${count(farm.goods[id])}</b>`, '', false, `good:${id}`)).join('');
    }
    if (products.length) {
      html += heading('Produtos');
      html += products.map((id) => row(PRODUCT_ICONS[id], `<b>${PRODUCTS[id].name} ${count(farm.products[id])}</b>`, '', false, `product:${id}`)).join('');
    }
    if (feed.length) {
      html += heading('Ração');
      html += feed.map((id) => row(FEED_ICONS[id], `<b>${SPECIES[id].feedName} ${count(farm.feed[id])}</b>`, '', false, `feed:${id}`)).join('');
    }
    if (!html) {
      return (
        empty(BARN_ICON, 'Seu celeiro está vazio.', 'Colha plantas e colete produtos dos animais.') +
        `<button type="button" class="big-action" data-act="shop" data-tab="seeds">Ir à loja</button>`
      );
    }
    const upgrade = nextBarnTier(this.farm.barn)
      ? `<button type="button" class="big-action alt" data-act="shop" data-tab="land">Melhorar o celeiro</button>`
      : '';
    const sellable = crops.length + products.length + fruits.length + goods.length > 0;
    return `${html}<button type="button" class="big-action" data-act="shop" data-tab="${sellable ? 'sell' : 'seeds'}">${
      sellable ? 'Vender na loja' : 'Ir à loja'
    }</button>${upgrade}`;
  }

  private millHtml(): string {
    const { farm } = this;
    const rows = SPECIES_ORDER.map((id) => {
      const def = SPECIES[id];
      const inputs = Object.entries(def.recipe.inputs) as [CropId, number][];
      const need = inputs
        .map(([crop, qty]) => {
          const have = farm.produce[crop];
          return `<span class="${have >= qty ? 'ok' : 'miss'}">${qty} ${CROPS[crop].name.toLowerCase()} (${have})</span>`;
        })
        .join(' + ');
      const max = farm.maxFeedBatches(id);
      const info = `<b>${def.feedName} <span class="count">×${farm.feed[id]}</span></b><small>${need} → ${def.recipe.yield} sacos</small>`;
      const buttons =
        `<button type="button" class="buy wide" data-act="craft" data-species="${id}" data-qty="1" ${max < 1 ? 'disabled' : ''}>Fazer</button>` +
        (max > 1 ? `<button type="button" class="buy" data-act="craft" data-species="${id}" data-qty="${max}">×${max}</button>` : '');
      return row(FEED_ICONS[id], info, buttons, false, `feed:${id}`);
    }).join('');
    return `${rows}<p class="tip">Cada animal come um saco de ração do seu tipo. Sem ração, ele não produz.</p>
      <button type="button" class="big-action alt" data-act="shop" data-tab="feed">Comprar ração pronta</button>`;
  }
}
