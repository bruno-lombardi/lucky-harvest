import { PRODUCTS, PRODUCT_ORDER, SPECIES, SPECIES_ORDER, SpeciesId, penCapacity } from '../core/animals';
import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { DECOR, DECOR_ORDER, DECOR_UNLOCK_LEVEL, DecorId } from '../core/decor';
import { TRUCK_UPGRADES, TRUCK_UPGRADE_ORDER, TruckUpgradeId } from '../core/delivery';
import { BARN_TIERS, barnPerk, barnTier, nextBarnTier } from '../core/barn';
import { Farm } from '../core/farm';
import { POMAR, TREES, TREE_ORDER, TreeId } from '../core/trees';
import { HELPERS, HELPER_ORDER, HelperId, maxHelperLevel, WAGE_PERIOD_MS, helperWage, nextHelperUpgrade, payWord } from '../core/helpers';
import { formatDuration } from './messages';
import { humanDuration } from './info';
import { BARN_ICON, LAND_ICON, LOCK_ICON, SHOP_ICON, TRUCK_ICON } from './icons';
import { FEED_ICONS, HELPER_ICONS, PRODUCT_ICONS, SPECIES_ICONS } from './item-icons';
import { Dispatch, coin, empty, heading, img, rarityBadge, row } from './kit';
import { Modal } from './modal';

export type ShopTab = 'seeds' | 'trees' | 'feed' | 'sell' | 'animals' | 'helpers' | 'land';

const TABS = [
  { id: 'seeds', label: 'Sementes' },
  { id: 'trees', label: 'Árvores' },
  { id: 'feed', label: 'Ração' },
  { id: 'sell', label: 'Vender' },
  { id: 'animals', label: 'Animais' },
  { id: 'helpers', label: 'Ajudantes' },
  { id: 'land', label: 'Fazenda' },
] as const;

/** The village market: seeds, feed, selling, animals and pens, and land. */
export class Shop extends Modal<ShopTab> {
  constructor(
    root: HTMLElement,
    private readonly farm: Farm,
    private readonly cropIcons: Record<CropId, string>,
    private readonly treeIcons: Record<TreeId, string>,
    private readonly dispatch: Dispatch,
  ) {
    super(root, 'Loja', TABS, 'seeds');
  }

  /** Opens Tonico's settings (set by the game). */
  onConfigure: () => void = () => {};

  open(tab: ShopTab = this.tab): void {
    this.openAt(tab);
  }

  protected title(): string {
    return `<i class="ico">${SHOP_ICON}</i>Loja da Vila`;
  }

  protected html(): string {
    const hint = '<p class="tip hint">Passe o mouse (ou segure o dedo) sobre um item para ver os detalhes.</p>';
    return this.tab === 'land' ? this.tabHtml() : this.tabHtml() + hint;
  }

  private tabHtml(): string {
    switch (this.tab) {
      case 'seeds':
        return this.seedsHtml();
      case 'trees':
        return this.treesHtml();
      case 'feed':
        return this.feedHtml();
      case 'sell':
        return this.sellHtml();
      case 'animals':
        return this.animalsHtml();
      case 'helpers':
        return this.helpersHtml();
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
      case 'sapling':
        this.dispatch({ type: 'buySapling', tree: data['tree'] as TreeId, qty });
        break;
      case 'pomar':
        this.dispatch({ type: 'buyPomar' });
        break;
      case 'sell-fruit':
        this.dispatch({ type: 'sellFruit', tree: data['tree'] as TreeId, qty });
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
      case 'decor':
        this.dispatch({ type: 'buyDecor', decor: data['decor'] as DecorId });
        break;
      case 'barn':
        this.dispatch({ type: 'upgradeBarn' });
        break;
      case 'truck':
        this.dispatch({ type: 'upgradeTruck', upgrade: data['upgrade'] as TruckUpgradeId });
        break;
      case 'build':
        this.dispatch({ type: 'buildPen', species: species! });
        break;
      case 'animal':
        this.dispatch({ type: 'buyAnimal', species: species! });
        break;
      case 'hire':
        this.dispatch({ type: 'hireHelper', helper: data['helper'] as HelperId });
        break;
      case 'upgrade':
        this.dispatch({ type: 'upgradeHelper', helper: data['helper'] as HelperId });
        break;
      case 'pay':
        this.dispatch({ type: 'payHelper', helper: data['helper'] as HelperId });
        break;
      case 'configure':
        this.onConfigure();
        return;
    }
    this.repaint();
  }

  private seedsHtml(): string {
    const { farm } = this;
    return CROP_ORDER.map((id) => {
      const crop = CROPS[id];
      const locked = farm.level < crop.unlockLevel;
      const badge = rarityBadge(crop.rarity);
      const info = locked
        ? `<b>${crop.name}${badge}</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${crop.unlockLevel}</small>`
        : `<b>${crop.name}${badge}</b><small>${coin(crop.seedCost)} cada · você tem ${farm.seeds[id]}</small>`;
      const button = (qty: number): string =>
        `<button type="button" class="buy" data-act="buy" data-crop="${id}" data-qty="${qty}" ${
          locked || farm.coins < crop.seedCost * qty ? 'disabled' : ''
        }>×${qty}</button>`;
      return row(img(this.cropIcons[id]), info, locked ? '' : `${button(1)}${button(5)}${button(10)}`, locked, `crop:${id}`, `rar-${crop.rarity}`);
    }).join('');
  }

  private treesHtml(): string {
    const { farm } = this;
    let html = '';
    if (!farm.pomar) {
      const levelOk = farm.level >= POMAR.level;
      const coinsOk = farm.coins >= POMAR.cost;
      html += `
      <div class="land-card" data-info="pomar:">
        <i class="ico big">${LAND_ICON}</i>
        <h3>Pomar</h3>
        <p>Um cantinho cercado ao lado do moinho, só para árvores frutíferas. Plantou, regou uma vez e ela dá frutos para sempre.</p>
        <ul class="needs">
          <li class="${levelOk ? 'ok' : 'miss'}">Nível ${POMAR.level}</li>
          <li class="${coinsOk ? 'ok' : 'miss'}">${coin(POMAR.cost)}</li>
        </ul>
        <button type="button" class="big-action" data-act="pomar" ${levelOk && coinsOk ? '' : 'disabled'}>Comprar o Pomar</button>
      </div>`;
    }
    html += TREE_ORDER.map((id) => {
      const t = TREES[id];
      const locked = farm.level < t.unlockLevel;
      const info = locked
        ? `<b>${t.name}${rarityBadge(t.rarity)}</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${t.unlockLevel}</small>`
        : `<b>${t.name}${rarityBadge(t.rarity)}</b><small>${coin(t.saplingCost)} a muda · ${t.fruits} frutos a cada ${humanDuration(t.cycleMs)} · você tem ${farm.saplings[id]}</small>`;
      const button = (qty: number): string =>
        `<button type="button" class="buy" data-act="sapling" data-tree="${id}" data-qty="${qty}" ${
          !farm.pomar || farm.coins < t.saplingCost * qty ? 'disabled' : ''
        }>×${qty}</button>`;
      return row(img(this.treeIcons[id]), info, locked ? '' : `${button(1)}${button(3)}`, locked, `tree:${id}`, `rar-${t.rarity}`);
    }).join('');
    return `${html}<p class="tip">Árvores só crescem no Pomar. Elas precisam de uma rega enquanto jovens e depois cuidam de si mesmas.</p>`;
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
      return row(FEED_ICONS[id], info, `${button(1)}${button(5)}`, !hasPen && farm.level < def.unlockLevel, `feed:${id}`);
    }).join('');
    return `${rows}<p class="tip">Dica: no celeiro você transforma suas colheitas em ração, de graça.</p>`;
  }

  private sellHtml(): string {
    const { farm } = this;
    const crops = CROP_ORDER.filter((id) => farm.produce[id] > 0);
    const products = PRODUCT_ORDER.filter((id) => farm.products[id] > 0);
    const fruits = TREE_ORDER.filter((id) => farm.fruit[id] > 0);
    if (crops.length + products.length + fruits.length === 0) {
      return empty(BARN_ICON, 'Você não tem nada para vender.', 'Colha plantas ou colete produtos dos animais.');
    }
    const total =
      crops.reduce((sum, id) => sum + farm.produce[id] * CROPS[id].sellPrice, 0) +
      products.reduce((sum, id) => sum + farm.products[id] * PRODUCTS[id].sellPrice, 0) +
      fruits.reduce((sum, id) => sum + farm.fruit[id] * TREES[id].fruitPrice, 0);
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
            false,
            `crop:${id}`,
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
            false,
            `product:${id}`,
          ),
        )
        .join('');
    }
    if (fruits.length) {
      html += heading('Frutas');
      html += fruits
        .map((id) =>
          row(
            img(this.treeIcons[id]),
            `<b>${TREES[id].fruitName} <span class="count">×${farm.fruit[id]}</span></b><small>${coin(TREES[id].fruitPrice)} cada</small>`,
            sellButtons('sell-fruit', 'tree', id, farm.fruit[id]),
            false,
            `tree:${id}`,
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
        return row(SPECIES_ICONS[id], info, button, locked, `species:${id}`);
      }
      const cap = penCapacity(id, pen.level);
      const full = pen.animals.length >= cap;
      const info = `<b>${def.name}</b><small>${coin(def.animalCost)} · no ${def.penName.toLowerCase()}: ${pen.animals.length}/${cap}</small>`;
      const button = `<button type="button" class="buy wide" data-act="animal" data-species="${id}" ${
        full || farm.coins < def.animalCost ? 'disabled' : ''
      }>${full ? 'Cheio' : 'Comprar'}</button>`;
      return row(SPECIES_ICONS[id], info, button, false, `species:${id}`);
    }).join('');
  }

  private helpersHtml(): string {
    const { farm } = this;
    const now = Date.now();
    const intro = `<p class="tip">Ajudantes trabalham sozinhos, mas cobram a cada ${WAGE_PERIOD_MS / 60_000} minutos: salário para as pessoas, custo para os bichos. Sem moedas, eles param. Um celeiro melhor baixa esses valores.</p>`;
    const rows = HELPER_ORDER.map((id) => {
      const def = HELPERS[id];
      const state = farm.helpers[id];
      if (!state) {
        const locked = farm.level < def.unlockLevel;
        const info = locked
          ? `<b>${def.name}</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${def.unlockLevel}</small>`
          : `<b>${def.name}</b><small>${def.job[0]!.toUpperCase()}${def.job.slice(1)} · ${coin(def.hireCost)} · ${payWord(id)} ${coin(helperWage(id, 1, farm.barn))}</small>`;
        const button = locked
          ? ''
          : `<button type="button" class="buy wide" data-act="hire" data-helper="${id}" ${farm.coins < def.hireCost ? 'disabled' : ''}>Contratar</button>`;
        return row(HELPER_ICONS[id], info, button, locked, `helper:${id}`);
      }
      const wage = helperWage(id, state.level, farm.barn);
      const next = nextHelperUpgrade(id, state.level);
      const stars = '★'.repeat(state.level) + '☆'.repeat(maxHelperLevel(id) - state.level);
      const status = state.paid
        ? `<small class="ok">Trabalhando · ${payWord(id)} ${coin(wage)} em ${formatDuration(state.paidUntil - now)}</small>`
        : `<small class="warn">Parou: sem ${payWord(id)} (${coin(wage)})</small>`;
      const configure =
        id === 'ajudante' ? `<button type="button" class="buy wide alt" data-act="configure" data-helper="${id}">Configurar</button>` : '';
      const buttons = configure + (state.paid
        ? next
          ? farm.level < next.needLevel
            ? `<button type="button" class="buy wide" disabled>Nível ${next.needLevel}</button>`
            : `<button type="button" class="buy wide" data-act="upgrade" data-helper="${id}" ${farm.coins < next.cost ? 'disabled' : ''}>Melhorar ${coin(next.cost)}</button>`
          : `<button type="button" class="buy wide" disabled>Nível máx.</button>`
        : `<button type="button" class="sell wide" data-act="pay" data-helper="${id}" ${farm.coins < wage ? 'disabled' : ''}>Pagar</button>`);
      return row(
        HELPER_ICONS[id],
        `<b>${def.name} <span class="count">${stars}</span></b>${status}<small>${def.perks[state.level - 1]}</small>`,
        buttons,
        false,
        `helper:${id}`,
      );
    }).join('');
    return `${intro}${rows}`;
  }

  private landHtml(): string {
    const { farm } = this;
    const next = farm.nextExpansion();
    const now = `${farm.landSize}×${farm.landSize}`;
    return `${this.landCard(next, now)}${this.barnHtml()}${this.truckHtml()}${this.decorHtml()}`;
  }

  private barnHtml(): string {
    const { farm } = this;
    const tier = barnTier(farm.barn);
    const next = nextBarnTier(farm.barn);
    const current = row(
      `<i class="ico">${BARN_ICON}</i>`,
      `<b>${tier.name} <span class="count">${farm.barn}/${BARN_TIERS.length}</span></b><small>${barnPerk(tier)}</small>`,
      '',
      false,
      `barn:${tier.level}`,
    );
    if (!next) return `${heading('Celeiro')}${current}<p class="tip">Seu celeiro já é o maior da região.</p>`;
    const locked = farm.level < next.unlockLevel;
    const detail = locked ? `<i class="ico">${LOCK_ICON}</i>Libera no nível ${next.unlockLevel}` : coin(next.cost);
    const upgrade = row(
      `<i class="ico">${BARN_ICON}</i>`,
      `<b>${next.name}</b><small>${barnPerk(next)} · ${detail}</small>`,
      `<button type="button" class="buy wide" data-act="barn" ${locked || farm.coins < next.cost ? 'disabled' : ''}>Melhorar</button>`,
      locked,
      `barn:${next.level}`,
    );
    return `${heading('Celeiro')}${current}${upgrade}`;
  }

  private truckHtml(): string {
    const { farm } = this;
    const rows = TRUCK_UPGRADE_ORDER.map((id) => {
      const def = TRUCK_UPGRADES[id];
      const owned = farm.truck[id];
      const locked = farm.level < def.level;
      const detail = owned ? 'Comprado' : locked ? `<i class="ico">${LOCK_ICON}</i>Libera no nível ${def.level}` : coin(def.cost);
      const button = owned
        ? `<button type="button" class="buy wide" disabled>Comprado</button>`
        : `<button type="button" class="buy wide" data-act="truck" data-upgrade="${id}" ${locked || farm.coins < def.cost ? 'disabled' : ''}>Comprar</button>`;
      return row(
        `<i class="ico">${TRUCK_ICON}</i>`,
        `<b>${def.name}</b><small>${def.text} ${detail}</small>`,
        button,
        locked && !owned,
        `truck:${id}`,
      );
    }).join('');
    return `${heading('Caminhão de sementes')}${rows}`;
  }

  private decorHtml(): string {
    const { farm } = this;
    if (farm.level < DECOR_UNLOCK_LEVEL) {
      return `${heading('Enfeites')}${row(`<i class="ico">${LAND_ICON}</i>`, `<b>Enfeites da fazenda</b><small><i class="ico">${LOCK_ICON}</i>Libera no nível ${DECOR_UNLOCK_LEVEL}</small>`, '', true)}`;
    }
    const rows = DECOR_ORDER.map((id) => {
      const def = DECOR[id];
      const owned = !!farm.decor[id];
      const button = owned
        ? `<button type="button" class="buy wide" disabled>Na fazenda</button>`
        : `<button type="button" class="buy wide" data-act="decor" data-decor="${id}" ${farm.coins < def.cost ? 'disabled' : ''}>Comprar</button>`;
      return row(`<i class="ico">${LAND_ICON}</i>`, `<b>${def.name}</b><small>${owned ? def.text : `${def.text} ${coin(def.cost)}`}</small>`, button, false, `decor:${id}`);
    }).join('');
    return `${heading('Enfeites')}${rows}`;
  }

  private landCard(next: ReturnType<Farm['nextExpansion']>, now: string): string {
    if (!next) {
      return empty(LAND_ICON, `Seu terreno está no tamanho máximo (${now}).`, 'Você já tem toda a terra da fazenda.');
    }
    const levelOk = this.farm.level >= next.level;
    const coinsOk = this.farm.coins >= next.cost;
    return `
      <div class="land-card" data-info="land:next">
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
