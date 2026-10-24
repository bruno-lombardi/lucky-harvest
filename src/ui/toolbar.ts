import { TOOLS, Tool } from '../core/actions';
import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { Farm } from '../core/farm';

const TOOL_META: Record<Tool, { emoji: string; label: string }> = {
  colher: { emoji: '🧺', label: 'Colher' },
  arar: { emoji: '⛏️', label: 'Arar' },
  semear: { emoji: '🌱', label: 'Semear' },
  regar: { emoji: '💧', label: 'Regar' },
  limpar: { emoji: '🧹', label: 'Limpar' },
};

/** Bottom toolbar plus the seed picker that appears while "Semear" is active. */
export class Toolbar {
  tool: Tool = 'colher';
  crop: CropId = 'cenoura';

  private readonly toolButtons = new Map<Tool, HTMLButtonElement>();
  private readonly cropButtons = new Map<CropId, HTMLButtonElement>();
  private lastSignature = '';

  constructor(
    private readonly bar: HTMLElement,
    private readonly tray: HTMLElement,
    private readonly notify: (message: string) => void,
  ) {
    for (const tool of TOOLS) {
      const meta = TOOL_META[tool];
      const button = this.makeButton('tool', `<span class="emoji">${meta.emoji}</span><span class="name">${meta.label}</span>`);
      button.addEventListener('click', () => this.selectTool(tool));
      this.toolButtons.set(tool, button);
      this.bar.appendChild(button);
    }

    for (const id of CROP_ORDER) {
      const crop = CROPS[id];
      const button = this.makeButton(
        'seed',
        `<span class="emoji">${crop.emoji}</span><span class="name">${crop.name}</span><span class="cost"></span>`,
      );
      button.addEventListener('click', () => this.selectCrop(id));
      this.cropButtons.set(id, button);
      this.tray.appendChild(button);
    }

    this.syncActive();
  }

  /** Re-evaluates seed availability (level) and affordability (coins). Cheap to call often. */
  refresh(farm: Farm): void {
    const signature = `${farm.level}|${farm.coins}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    for (const id of CROP_ORDER) {
      const crop = CROPS[id];
      const button = this.cropButtons.get(id);
      if (!button) continue;
      const locked = farm.level < crop.unlockLevel;
      const poor = !locked && farm.coins < crop.seedCost;
      button.classList.toggle('locked', locked);
      button.classList.toggle('poor', poor);
      const cost = button.querySelector('.cost');
      if (cost) cost.textContent = locked ? `🔒 Nv ${crop.unlockLevel}` : `🪙 ${crop.seedCost}`;
    }
  }

  private selectTool(tool: Tool): void {
    // Tapping Semear again while it is active toggles the tray.
    if (tool === 'semear' && this.tool === 'semear') {
      this.tray.hidden = !this.tray.hidden;
      return;
    }
    this.tool = tool;
    this.syncActive();
  }

  private selectCrop(id: CropId): void {
    const crop = CROPS[id];
    const button = this.cropButtons.get(id);
    if (button?.classList.contains('locked')) {
      this.notify(`${crop.name} libera no nível ${crop.unlockLevel}`);
      return;
    }
    this.crop = id;
    this.syncActive();
  }

  private syncActive(): void {
    for (const [tool, button] of this.toolButtons) button.classList.toggle('active', tool === this.tool);
    for (const [id, button] of this.cropButtons) button.classList.toggle('active', id === this.crop);
    this.tray.hidden = this.tool !== 'semear';
  }

  private makeButton(kind: 'tool' | 'seed', html: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = kind;
    button.innerHTML = html;
    return button;
  }
}
