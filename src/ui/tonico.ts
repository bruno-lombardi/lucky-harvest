import { AutoPlant, HUMORS, HUMOR_INFO, MODE_INFO, PLANT_MODES, RESERVES } from '../core/autoplant';
import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { Farm } from '../core/farm';
import { HELPERS, PLANTER_LEVEL } from '../core/helpers';
import { HELPER_ICONS } from './item-icons';
import { Dispatch, heading, img } from './kit';
import { Modal } from './modal';

/** Tonico's planting settings: what he sows, what he may spend, and how chatty he is. */
export class TonicoDialog extends Modal<'cfg'> {
  constructor(
    root: HTMLElement,
    private readonly farm: Farm,
    private readonly cropIcons: Record<CropId, string>,
    private readonly dispatch: Dispatch,
  ) {
    super(root, 'Tonico', [], 'cfg');
  }

  open(): void {
    this.openAt('cfg');
  }

  protected title(): string {
    return `<i class="ico">${HELPER_ICONS.ajudante}</i>${HELPERS.ajudante.name}`;
  }

  private get cfg(): AutoPlant {
    return this.farm.autoPlant;
  }

  private save(change: Partial<AutoPlant>): void {
    this.dispatch({ type: 'setAutoPlant', settings: { ...this.cfg, ...change, crops: [...(change.crops ?? this.cfg.crops)] } });
    this.repaint();
  }

  protected onAction(action: string, data: DOMStringMap): void {
    const cfg = this.cfg;
    switch (action) {
      case 'flag': {
        const key = data['key'] as 'on' | 'buy' | 'plow' | 'water' | 'skipRare';
        this.save({ [key]: !cfg[key] });
        break;
      }
      case 'mode':
        this.save({ mode: data['value'] as AutoPlant['mode'] });
        break;
      case 'humor':
        this.save({ humor: data['value'] as AutoPlant['humor'] });
        break;
      case 'reserve':
        this.save({ reserve: Number(data['value']) });
        break;
      case 'crop': {
        const id = data['value'] as CropId;
        this.save({ crops: cfg.crops.includes(id) ? cfg.crops.filter((c) => c !== id) : [...cfg.crops, id] });
        break;
      }
      case 'all':
        this.save({ crops: [] });
        break;
    }
  }

  private flag(key: 'on' | 'buy' | 'plow' | 'water' | 'skipRare', label: string, hint: string): string {
    const on = this.cfg[key];
    return `<button type="button" class="opt${on ? ' on' : ''}" data-act="flag" data-key="${key}" aria-pressed="${on}">
      <span class="knob"></span><span class="txt"><b>${label}</b><small>${hint}</small></span></button>`;
  }

  protected html(): string {
    const { farm } = this;
    const cfg = this.cfg;
    const state = farm.helpers.ajudante;
    const ready = (state?.level ?? 0) >= PLANTER_LEVEL;
    let html = '';
    if (!state) {
      html += `<p class="tip warn">Contrate o Tonico na loja e melhore-o até o nível ${PLANTER_LEVEL}: só então ele planta. Você já pode deixar tudo pronto aqui.</p>`;
    } else if (!ready) {
      html += `<p class="tip warn">O Tonico ainda está no nível ${state.level}. No nível ${PLANTER_LEVEL} ele passa a plantar do jeito que você configurar abaixo.</p>`;
    } else {
      html += `<p class="tip ok">Tonico planta sozinho. Cada mudança vale na hora.</p>`;
    }

    html += this.flag('on', 'Plantar sozinho', 'Desligado, ele só colhe.');

    html += heading('O que plantar');
    html += `<div class="chips col">${PLANT_MODES.map(
      (m) => `<button type="button" class="chip${cfg.mode === m ? ' on' : ''}" data-act="mode" data-value="${m}"><b>${MODE_INFO[m].name}</b><small>${MODE_INFO[m].text}</small></button>`,
    ).join('')}</div>`;

    html += heading('Sementes permitidas');
    const ordered = cfg.mode === 'ordem';
    html += `<p class="tip hint">${
      cfg.crops.length === 0
        ? 'Nenhuma marcada: ele usa qualquer semente que você já liberou.'
        : ordered
          ? 'Ele tenta na ordem em que você tocou (1, 2, 3…).'
          : 'Só estas. Toque de novo para tirar.'
    }</p>`;
    html += `<div class="chips grid">${CROP_ORDER.map((id) => {
      const crop = CROPS[id];
      const locked = farm.level < crop.unlockLevel;
      const at = cfg.crops.indexOf(id);
      const badge = at >= 0 && ordered ? `<em>${at + 1}</em>` : '';
      return `<button type="button" class="chip crop${at >= 0 ? ' on' : ''}" data-act="crop" data-value="${id}" ${locked ? 'disabled' : ''} title="${crop.name}">${img(this.cropIcons[id])}<small>${locked ? `Nv ${crop.unlockLevel}` : crop.name}</small>${badge}</button>`;
    }).join('')}</div>`;
    if (cfg.crops.length > 0) html += `<button type="button" class="big-action alt" data-act="all">Liberar todas</button>`;

    html += heading('Compras e cuidados');
    html += this.flag('buy', 'Comprar sementes', 'Quando o celeiro não tiver a semente, ele paga do seu bolso.');
    html += `<div class="reserve"><b>Reserva de moedas</b><small>Ele nunca gasta abaixo disso.</small><div class="chips row">${RESERVES.map(
      (r) => `<button type="button" class="chip${cfg.reserve === r ? ' on' : ''}" data-act="reserve" data-value="${r}" ${cfg.buy ? '' : 'disabled'}>${r === 0 ? 'Nenhuma' : r.toLocaleString('pt-BR')}</button>`,
    ).join('')}</div></div>`;
    html += this.flag('plow', 'Arar a grama', 'Abre terra nova nos lotes vazios (e limpa plantas murchas).');
    html += this.flag('water', 'Regar o que planta', 'Dá a primeira regada para a muda crescer.');
    html += this.flag('skipRare', 'Poupar sementes raras', 'Ignora as raras e épicas: guarde para ocasiões especiais.');

    html += heading('Humor do Tonico');
    html += `<div class="chips row">${HUMORS.map(
      (h) => `<button type="button" class="chip${cfg.humor === h ? ' on' : ''}" data-act="humor" data-value="${h}"><b>${HUMOR_INFO[h].icon} ${HUMOR_INFO[h].name}</b><small>${HUMOR_INFO[h].text}</small></button>`,
    ).join('')}</div>`;
    return html;
  }
}
