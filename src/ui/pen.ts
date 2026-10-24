import { SPECIES, SpeciesId, animalStatus, nextPenUpgrade, penCapacity } from '../core/animals';
import { CROPS, CropId } from '../core/crops';
import { Farm } from '../core/farm';
import { LOCK_ICON } from './icons';
import { FEED_ICONS, PEN_ICON, PRODUCT_ICONS, SPECIES_ICONS } from './item-icons';
import { Dispatch, coin, heading, row } from './kit';
import { Modal } from './modal';
import { formatDuration } from './messages';

export interface PenEvents {
  openShop(tab: 'feed'): void;
  openBarn(tab: 'feed'): void;
}

/** One pen: its animals with their timers, feeding, collecting, buying animals and (later) upgrades. */
export class PenDialog extends Modal {
  private species: SpeciesId = 'galinha';

  constructor(
    root: HTMLElement,
    private readonly farm: Farm,
    private readonly dispatch: Dispatch,
    private readonly events: PenEvents,
  ) {
    super(root, 'Abrigo', [], 'main');
  }

  open(species: SpeciesId): void {
    this.species = species;
    this.openAt('main');
  }

  get current(): SpeciesId {
    return this.species;
  }

  protected title(): string {
    const def = SPECIES[this.species];
    const pen = this.farm.pens[this.species];
    return `<i class="ico">${PEN_ICON}</i>${def.penName}${pen ? ` · Nível ${pen.level}` : ''}`;
  }

  protected onAction(action: string, data: DOMStringMap): void {
    const species = this.species;
    const now = Date.now();
    switch (action) {
      case 'build':
        this.dispatch({ type: 'buildPen', species });
        break;
      case 'animal':
        this.dispatch({ type: 'buyAnimal', species });
        break;
      case 'feed':
        this.dispatch({ type: 'feed', species, animalId: Number(data['id']) });
        break;
      case 'collect':
        this.dispatch({ type: 'collect', species, animalId: Number(data['id']) });
        break;
      case 'feed-all':
        this.dispatch({ type: 'feedAll', species });
        break;
      case 'collect-all':
        this.dispatch({ type: 'collectAll', species });
        break;
      case 'get-feed':
        this.close();
        this.events.openShop('feed');
        return;
      case 'make-feed':
        this.close();
        this.events.openBarn('feed');
        return;
      case 'upgrade':
        this.dispatch({ type: 'upgradePen', species });
        break;
    }
    void now;
    this.repaint();
  }

  protected html(): string {
    const { farm, species } = this;
    const def = SPECIES[species];
    const pen = farm.pens[species];
    if (!pen) return this.unbuiltHtml();
    const now = Date.now();
    const cap = penCapacity(species, pen.level);

    let hungry = 0;
    let ready = 0;
    const animals = pen.animals
      .map((animal, n) => {
        const status = animalStatus(species, animal, now);
        let info: string;
        let button = '';
        if (status.phase === 'hungry') {
          hungry++;
          info = `<b>${def.name} ${n + 1}</b><small class="warn">Com fome</small>`;
          button = `<button type="button" class="buy wide" data-act="feed" data-id="${animal.id}" ${
            farm.feed[species] < 1 ? 'disabled' : ''
          }>Alimentar</button>`;
        } else if (status.phase === 'working') {
          info = `<b>${def.name} ${n + 1}</b><small>Produzindo… ${formatDuration(status.msToReady ?? 0)}</small>
            <span class="meter"><i style="width:${Math.round(status.progress * 100)}%"></i></span>`;
        } else {
          ready++;
          info = `<b>${def.name} ${n + 1}</b><small class="ok">Pronto!</small>`;
          button = `<button type="button" class="sell wide" data-act="collect" data-id="${animal.id}">Coletar</button>`;
        }
        return row(SPECIES_ICONS[species], info, button);
      })
      .join('');

    const feedInfo = (() => {
      const inputs = Object.entries(def.recipe.inputs) as [CropId, number][];
      return inputs.map(([crop, qty]) => `${qty} ${CROPS[crop].name.toLowerCase()}`).join(' + ');
    })();
    const feedRow = row(
      FEED_ICONS[species],
      `<b>${def.feedName} <span class="count">×${farm.feed[species]}</span></b><small>${feedInfo} → ${def.recipe.yield} sacos</small>`,
      `<button type="button" class="buy wide" data-act="make-feed">Fazer</button><button type="button" class="buy wide" data-act="get-feed">Loja</button>`,
    );

    const full = pen.animals.length >= cap;
    const buyRow = row(
      SPECIES_ICONS[species],
      `<b>Comprar ${def.name.toLowerCase()}</b><small>${coin(def.animalCost)} · lotação ${pen.animals.length}/${cap}</small>`,
      `<button type="button" class="buy wide" data-act="animal" ${full || farm.coins < def.animalCost ? 'disabled' : ''}>${
        full ? 'Cheio' : 'Comprar'
      }</button>`,
    );

    const next = nextPenUpgrade(species, pen.level);
    const upgradeRow = next
      ? row(
          PEN_ICON,
          `<b>Melhorar para nível ${next.level}</b><small>${coin(next.cost)} · mais espaço</small>`,
          `<button type="button" class="buy wide" data-act="upgrade" ${farm.coins < next.cost ? 'disabled' : ''}>Melhorar</button>`,
        )
      : row(
          PEN_ICON,
          `<b>Melhorias</b><small><i class="ico">${LOCK_ICON}</i>Em breve: mais espaço e produção</small>`,
          `<button type="button" class="buy wide" disabled>Em breve</button>`,
          true,
        );

    const bulk =
      `<div class="bulk">` +
      `<button type="button" class="big-action" data-act="feed-all" ${hungry === 0 || farm.feed[species] < 1 ? 'disabled' : ''}>Alimentar todos</button>` +
      `<button type="button" class="big-action gold" data-act="collect-all" ${ready === 0 ? 'disabled' : ''}>` +
      `<i class="ico sm">${PRODUCT_ICONS[def.product]}</i>Coletar tudo</button></div>`;

    return `${bulk}${
      pen.animals.length ? heading(`${def.name}s (${pen.animals.length}/${cap})`) + animals : '<p class="tip">Nenhum animal ainda. Compre o primeiro abaixo!</p>'
    }${heading('Ração')}${feedRow}${heading('Mais')}${buyRow}${upgradeRow}`;
  }

  private unbuiltHtml(): string {
    const { farm, species } = this;
    const def = SPECIES[species];
    const levelOk = farm.level >= def.unlockLevel;
    const coinsOk = farm.coins >= def.penCost;
    return `
      <div class="land-card">
        <i class="ico big">${SPECIES_ICONS[species]}</i>
        <h3>${def.penName}</h3>
        <p>Um abrigo para ${def.name.toLowerCase()}s. Cada um come ${def.feedName.toLowerCase()} e rende ${def.product === 'ovo' ? 'ovos' : def.product === 'leite' ? 'leite' : 'trufas'}.</p>
        <ul class="needs">
          <li class="${levelOk ? 'ok' : 'miss'}">Nível ${def.unlockLevel}</li>
          <li class="${coinsOk ? 'ok' : 'miss'}">${coin(def.penCost)}</li>
        </ul>
        <button type="button" class="big-action" data-act="build" ${levelOk && coinsOk ? '' : 'disabled'}>Construir ${def.penName.toLowerCase()}</button>
      </div>`;
  }
}
