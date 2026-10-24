import { TOOLS } from '../core/actions';
import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { Farm } from '../core/farm';
import { TREES, TREE_ORDER, TreeId } from '../core/trees';
import { ToolMode } from './cursors';
import { LOCK_ICON, LOOK_ICON, TOOL_ICONS } from './icons';

const MODES: readonly ToolMode[] = ['olhar', ...TOOLS];

const TOOL_LABEL: Record<ToolMode, string> = {
  olhar: 'Olhar',
  colher: 'Colher',
  arar: 'Arar',
  semear: 'Semear',
  regar: 'Regar',
  cuidar: 'Cuidar',
  limpar: 'Limpar',
};

/** Bottom toolbar plus the seed picker that appears while "Semear" is active. */
export class Toolbar {
  tool: ToolMode = 'olhar';
  /** Called whenever the active tool changes (to update the cursor). */
  onToolChange: (tool: ToolMode) => void = () => {};
  crop: CropId = 'cenoura';
  /** The sapling that goes into the Pomar (the tapped tile decides between this and `crop`). */
  tree: TreeId = 'laranjeira';

  private readonly toolButtons = new Map<ToolMode, HTMLButtonElement>();
  private readonly cropButtons = new Map<CropId, HTMLButtonElement>();
  private readonly treeButtons = new Map<TreeId, HTMLButtonElement>();
  private readonly divider = document.createElement('span');
  private lastSignature = '';

  constructor(
    private readonly bar: HTMLElement,
    private readonly tray: HTMLElement,
    private readonly notify: (message: string) => void,
    cropIcons: Record<CropId, string>,
    treeIcons: Record<TreeId, string>,
  ) {
    for (const tool of MODES) {
      const button = this.makeButton('tool', `<span class="pic">${tool === 'olhar' ? LOOK_ICON : TOOL_ICONS[tool]}</span><span class="name">${TOOL_LABEL[tool]}</span>`);
      button.setAttribute('aria-label', TOOL_LABEL[tool]);
      button.dataset['info'] = `tool:${tool}`;
      button.addEventListener('click', () => this.selectTool(tool));
      this.toolButtons.set(tool, button);
      this.bar.appendChild(button);
    }

    for (const id of CROP_ORDER) {
      const crop = CROPS[id];
      const button = this.makeButton(
        'seed',
        `<span class="pic"><img alt="" draggable="false" src="${cropIcons[id]}" /></span><span class="name">${crop.name}</span><span class="cost"></span>`,
      );
      button.dataset['info'] = `crop:${id}`;
      button.addEventListener('click', () => this.selectCrop(id));
      this.cropButtons.set(id, button);
      this.tray.appendChild(button);
    }

    this.divider.className = 'tray-divider';
    this.divider.hidden = true;
    this.tray.appendChild(this.divider);
    for (const id of TREE_ORDER) {
      const tree = TREES[id];
      const button = this.makeButton(
        'seed',
        `<span class="pic"><img alt="" draggable="false" src="${treeIcons[id]}" /></span><span class="name">Muda: ${tree.fruitName}</span><span class="cost"></span>`,
      );
      button.dataset['info'] = `tree:${id}`;
      button.classList.add(`rar-${tree.rarity}`, 'sapling');
      button.hidden = true;
      button.addEventListener('click', () => this.selectTree(id));
      this.treeButtons.set(id, button);
      this.tray.appendChild(button);
    }

    this.syncActive();
  }

  /** Makes one tool button pulse (the current goal points at it), or none. */
  point(mode: ToolMode | null): void {
    for (const [id, button] of this.toolButtons) button.classList.toggle('point', id === mode);
  }

  /** Re-evaluates seed availability (level) and affordability (coins). Cheap to call often. */
  refresh(farm: Farm): void {
    const signature = `${farm.level}|${farm.pomar}|${CROP_ORDER.map((id) => farm.seeds[id]).join(',')}|${TREE_ORDER.map((id) => farm.saplings[id]).join(',')}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.refreshTrees(farm);

    const firstLocked = CROP_ORDER.find((id) => farm.level < CROPS[id].unlockLevel);
    for (const id of CROP_ORDER) {
      const crop = CROPS[id];
      const button = this.cropButtons.get(id);
      if (!button) continue;
      const locked = farm.level < crop.unlockLevel;
      const owned = farm.seeds[id];
      const poor = !locked && owned < 1;
      button.classList.toggle('locked', locked);
      button.classList.toggle('poor', poor);
      button.classList.toggle(`rar-${crop.rarity}`, true);
      // Only the next seed to unlock shows as locked: the rest stay hidden until it is close.
      button.hidden = locked && id !== firstLocked;
      const cost = button.querySelector('.cost');
      if (cost) {
        cost.innerHTML = locked
          ? `<i class="ico">${LOCK_ICON}</i>Nv ${crop.unlockLevel}`
          : `×${owned}`;
      }
    }
  }

  private refreshTrees(farm: Farm): void {
    this.divider.hidden = !farm.pomar;
    const firstLocked = TREE_ORDER.find((id) => farm.level < TREES[id].unlockLevel);
    for (const id of TREE_ORDER) {
      const tree = TREES[id];
      const button = this.treeButtons.get(id)!;
      const locked = farm.level < tree.unlockLevel;
      button.classList.toggle('locked', locked);
      button.classList.toggle('poor', !locked && farm.saplings[id] < 1);
      button.hidden = !farm.pomar || (locked && id !== firstLocked);
      const cost = button.querySelector('.cost');
      if (cost) cost.innerHTML = locked ? `<i class="ico">${LOCK_ICON}</i>Nv ${tree.unlockLevel}` : `×${farm.saplings[id]}`;
    }
  }

  private selectTree(id: TreeId): void {
    const tree = TREES[id];
    if (this.treeButtons.get(id)?.classList.contains('locked')) {
      this.notify(`${tree.name} libera no nível ${tree.unlockLevel}`);
      return;
    }
    this.tree = id;
    this.syncActive();
  }

  private selectTool(tool: ToolMode): void {
    // Tapping Semear again while it is active toggles the tray.
    if (tool === 'semear' && this.tool === 'semear') {
      this.tray.hidden = !this.tray.hidden;
      return;
    }
    this.tool = tool;
    this.syncActive();
    this.onToolChange(tool);
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
    for (const [id, button] of this.treeButtons) button.classList.toggle('active', id === this.tree);
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
