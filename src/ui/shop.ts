import { PRODUCTS, PRODUCT_ORDER, SPECIES, SPECIES_ORDER, SpeciesId, penCapacity } from '../core/animals';
import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { Farm } from '../core/farm';
import { BARN_ICON, LAND_ICON, LOCK_ICON, SHOP_ICON } from './icons';
import { FEED_ICONS, PRODUCT_ICONS, SPECIES_ICONS } from './item-icons';
import { Dispatch, coin, empty, heading, img, row } from './kit';
import { Modal } from './modal';

export type ShopTab = 'seeds' | 'feed' | 'sell' | 'animals' | 'land';

const TABS = [
  { id: 'seeds', label: 'Sementes' },
  { id: 'feed', label: 'Ração' },
  { id: 'sell', label: 'Vender' },
  { id: 'animals', label: 'Animais' },
  { id: 'land', label: 'Terreno' },
] as const;

/** The village market: seeds, feed, selling, animals and pens, and land. */
export class Shop extends Modal<ShopTab> {
  constructor(
    root: HTMLElement,
    private readonly farm: Farm,
    private readonly cropIcons: Record<CropId, string>,
    private readonly dispatch: Dispatch,
  ) {
    super(root, 'Loja', TABS, 'seeds');
  }

  open(tab: ShopTab = this.tab): void {
    this.openAt(tab);
  }

  protected title(): string {
    return `<i class="ico">${SHOP_ICON}</i>Loja da Vila`;
  }

  protected html(): string {
    switch (this.tab) {
      case 'seeds':
        return this.seedsHtml();
      case 'feed':
        return this.feedHtml();
      case 'sell':
        return this.sellHtml();
      case 'animals':
        return this.animalsHtml();
      case 'land':
        return this.landHtml();
    }
  }

  protected onAction(action: string, data: DOMStringMap): void {
    const qty = Number(data['qty'] ?? 1);
    const species = data['species'] as SpeciesId | undefined;
    const crop = data['crop'] as CropId | undefined;
    switch (action) {
      case 'buy':
        this.dispatch({ type: 'buySeeds', crop: crop!, qty });
        break;
      case 'buy-feed':
        this.dispatch({ type: 'buyFeed', species: species!, qty });
        break;
      case 'sell':
        this.dispatch({ type: 'sellCrop', crop: crop!, qty });
        break;
      case 'sell-product':
        this.dispatch({ type: 'sellProduct', product: data['product'] as 'ovo', qty });
        break;
      case 'sell-all':
        this.dispatch({ type: 'sellAll' });
        break;
      case 'expand':
        this.dispatch({ type: 'expandLand' });
        break;
      case 'build':
        this.dispatch({ type: 'buildPen', species: species! });
        break;
      case 'animal':
        this.dispatch({ type: 'buyAnimal', species: species! });
        break;
    }
    this.repaint();
  }

  private seedsHtml(): string {
    const { farm } = this;
    return CROP_ORDER.map((id) => {
      const crop = CROPS[id];
      const locked = farm.level < crop.unlockLevel;
      const info = locked
        ? `<b>${crop.name}</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${crop.unlockLevel}</small>`
        : `<b>${crop.name}</b><small>${coin(crop.seedCost)} cada · você tem ${farm.seeds[id]}</small>`;
      const button = (qty: number): string =>
        `<button type="button" class="buy" data-act="buy" data-crop="${id}" data-qty="${qty}" ${
          locked || farm.coins < crop.seedCost * qty ? 'disabled' : ''
        }>×${qty}</button>`;
      return row(img(this.cropIcons[id]), info, locked ? '' : `${button(1)}${button(5)}${button(10)}`, locked);
    }).join('');
  }

  private feedHtml(): string {
    const { farm } = this;
    const rows = SPECIES_ORDER.map((id) => {
      const def = SPECIES[id];
      const hasPen = !!farm.pens[id];
      const info = `<b>${def.feedName}</b><small>${coin(def.feedPrice)} o saco · você tem ${farm.feed[id]}</small>`;
      const button = (qty: number): string =>
        `<button type="button" class="buy" data-act="buy-feed" data-species="${id}" data-qty="${qty}" ${
          farm.coins < def.feedPrice * qty ? 'disabled' : ''
        }>×${qty}</button>`;
      return row(FEED_ICONS[id], info, `${button(1)}${button(5)}`, !hasPen && farm.level < def.unlockLevel);
    }).join('');
    return `${rows}<p class="tip">Dica: no celeiro você transforma suas colheitas em ração, de graça.</p>`;
  }

  private sellHtml(): string {
    const { farm } = this;
    const crops = CROP_ORDER.filter((id) => farm.produce[id] > 0);
    const products = PRODUCT_ORDER.filter((id) => farm.products[id] > 0);
    if (crops.length + products.length === 0) {
      return empty(BARN_ICON, 'Você não tem nada para vender.', 'Colha plantas ou colete produtos dos animais.');
    }
    const total =
      crops.reduce((sum, id) => sum + farm.produce[id] * CROPS[id].sellPrice, 0) +
      products.reduce((sum, id) => sum + farm.products[id] * PRODUCTS[id].sellPrice, 0);
    const sellButtons = (act: string, key: string, id: string, qty: number): string =>
      `<button type="button" class="sell" data-act="${act}" data-${key}="${id}" data-qty="1">Vender 1</button>` +
      (qty > 1 ? `<button type="button" class="sell" data-act="${act}" data-${key}="${id}" data-qty="${qty}">Tudo</button>` : '');
    let html = '';
    if (crops.length) {
      html += heading('Colheitas');
      html += crops
        .map((id) =>
          row(
            img(this.cropIcons[id]),
            `<b>${CROPS[id].name} <span class="count">×${farm.produce[id]}</span></b><small>${coin(CROPS[id].sellPrice)} cada</small>`,
            sellButtons('sell', 'crop', id, farm.produce[id]),
          ),
        )
        .join('');
    }
    if (products.length) {
      html += heading('Produtos');
      html += products
        .map((id) =>
          row(
            PRODUCT_ICONS[id],
            `<b>${PRODUCTS[id].name} <span class="count">×${farm.products[id]}</span></b><small>${coin(PRODUCTS[id].sellPrice)} cada</small>`,
            sellButtons('sell-product', 'product', id, farm.products[id]),
          ),
        )
        .join('');
    }
    return `${html}<button type="button" class="big-action" data-act="sell-all">Vender tudo ${coin(total)}</button>`;
  }

  private animalsHtml(): string {
    const { farm } = this;
    return SPECIES_ORDER.map((id) => {
      const def = SPECIES[id];
      const pen = farm.pens[id];
      if (!pen) {
        const locked = farm.level < def.unlockLevel;
        const info = locked
          ? `<b>${def.penName}</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${def.unlockLevel}</small>`
          : `<b>${def.penName}</b><small>Abrigo para ${def.name.toLowerCase()}s · ${coin(def.penCost)}</small>`;
        const button = locked
          ? ''
          : `<button type="button" class="buy wide" data-act="build" data-species="${id}" ${
              farm.coins < def.penCost ? 'disabled' : ''
            }>Construir</button>`;
        return row(SPECIES_ICONS[id], info, button, locked);
      }
      const cap = penCapacity(id, pen.level);
      const full = pen.animals.length >= cap;
      const info = `<b>${def.name}</b><small>${coin(def.animalCost)} · no ${def.penName.toLowerCase()}: ${pen.animals.length}/${cap}</small>`;
      const button = `<button type="button" class="buy wide" data-act="animal" data-species="${id}" ${
        full || farm.coins < def.animalCost ? 'disabled' : ''
      }>${full ? 'Cheio' : 'Comprar'}</button>`;
      return row(SPECIES_ICONS[id], info, button);
    }).join('');
  }

  private landHtml(): string {
    const { farm } = this;
    const next = farm.nextExpansion();
    const now = `${farm.landSize}×${farm.landSize}`;
    if (!next) {
      return empty(LAND_ICON, `Seu terreno está no tamanho máximo (${now}).`, 'Mais terras virão em breve.');
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
