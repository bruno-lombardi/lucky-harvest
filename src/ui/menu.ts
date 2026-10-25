import { GEAR_ICON } from './item-icons';
import { Modal } from './modal';

export interface MenuEvents {
  save(): boolean;
  exportSave(): void;
  importFile(file: File): void;
  reset(): void;
  lastSaved(): number;
  sync(): string;
}

/** Game menu: save now, export/import the save file, start over. */
export class MenuDialog extends Modal {
  private confirming = false;
  private message = '';

  constructor(
    root: HTMLElement,
    private readonly events: MenuEvents,
  ) {
    super(root, 'Menu', [], 'main');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) this.events.importFile(file);
    });
    root.appendChild(input);
    this.fileInput = input;
  }

  private readonly fileInput: HTMLInputElement;

  open(): void {
    this.confirming = false;
    this.message = '';
    this.openAt('main');
  }

  setMessage(message: string): void {
    this.message = message;
    this.repaint();
  }

  protected title(): string {
    return `<i class="ico">${GEAR_ICON}</i>Menu`;
  }

  protected html(): string {
    const saved = this.events.lastSaved();
    const when = saved ? new Date(saved).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'ainda não salvo';
    const reset = this.confirming
      ? `<p class="tip warn">Isso apaga toda a sua fazenda. Tem certeza?</p>
         <div class="bulk"><button type="button" class="big-action danger" data-act="reset-yes">Sim, apagar</button>
         <button type="button" class="big-action alt" data-act="reset-no">Cancelar</button></div>`
      : `<button type="button" class="big-action danger" data-act="reset">Começar de novo</button>`;
    return `
      <img class="menu-logo" src="${import.meta.env.BASE_URL}logo-horizontal.svg" alt="Lucky Harvest" width="220" height="auto" draggable="false" />
      <p class="tip">Seu jogo é salvo sozinho neste aparelho. Último salvamento: <b>${when}</b>.</p>
      ${this.message ? `<p class="tip ok">${this.message}</p>` : ''}
      <button type="button" class="big-action" data-act="save">Salvar agora</button>
      <div class="bulk">
        <button type="button" class="big-action gold" data-act="export">Exportar arquivo</button>
        <button type="button" class="big-action gold" data-act="import">Importar arquivo</button>
      </div>
      <p class="tip">${this.events.sync()}</p>
      ${reset}`;
  }

  protected onAction(action: string): void {
    switch (action) {
      case 'save':
        this.message = this.events.save() ? 'Jogo salvo!' : 'Não foi possível salvar neste navegador.';
        break;
      case 'export':
        this.events.exportSave();
        this.message = 'Arquivo de save baixado.';
        break;
      case 'import':
        this.fileInput.click();
        return;
      case 'reset':
        this.confirming = true;
        break;
      case 'reset-no':
        this.confirming = false;
        break;
      case 'reset-yes':
        this.events.reset();
        return;
    }
    this.repaint();
  }
}
