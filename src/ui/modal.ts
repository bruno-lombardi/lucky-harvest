/** Shared dialog chrome (backdrop, framed panel, title, close button, optional tabs) used by the shop, barn, pens and menu. */
export interface ModalTab<T extends string> {
  id: T;
  label: string;
  /** Inline svg or img markup. Only shown where the tabs become a sidebar (large screens). */
  icon?: string;
}

/**
 * NEXT(multiplayer): dialogs build HTML strings from trusted data tables. Anything a player types (names, messages) must be escaped or
 * set with `textContent` before it reaches `html()`.
 */
export abstract class Modal<T extends string = string> {
  protected readonly body: HTMLElement;
  protected readonly titleEl: HTMLElement;
  private readonly tabButtons = new Map<T, HTMLButtonElement>();
  private lastHtml = '';
  private lastTitle = '';
  private pressed = false;
  protected tab: T;

  constructor(
    protected readonly root: HTMLElement,
    label: string,
    tabs: ReadonlyArray<ModalTab<T>>,
    initial: T,
  ) {
    this.tab = initial;
    root.classList.add('modal');
    root.hidden = true;
    root.innerHTML = `
      <div class="shop-backdrop" data-close></div>
      <section class="shop-panel" role="dialog" aria-modal="true" aria-label="${label}">
        <header class="shop-head">
          <span class="shop-title"></span>
          <button type="button" class="shop-close" data-close aria-label="Fechar">×</button>
        </header>
        ${tabs.length ? '<nav class="shop-tabs"></nav>' : ''}
        <div class="shop-body"></div>
      </section>`;
    this.titleEl = root.querySelector('.shop-title') as HTMLElement;
    this.body = root.querySelector('.shop-body') as HTMLElement;

    const nav = root.querySelector('.shop-tabs');
    for (const { id, label: text, icon } of tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shop-tab';
      if (icon) {
        // Labels are trusted constants (see the NEXT(multiplayer) note above), so innerHTML is fine here.
        button.innerHTML = `<i class="tab-ico">${icon}</i><span>${text}</span>`;
      } else {
        button.textContent = text;
      }
      button.addEventListener('click', () => this.show(id));
      this.tabButtons.set(id, button);
      nav?.appendChild(button);
    }

    root.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('[data-close]')) this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
    // Never swap the buttons out from under a finger or mouse button that is still down.
    const release = (): void => {
      window.setTimeout(() => (this.pressed = false), 60);
    };
    root.addEventListener('pointerdown', () => (this.pressed = true));
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerleave', release);
    this.body.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (button && !button.disabled) this.onAction(button.dataset['act']!, button.dataset);
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  close(): void {
    this.root.hidden = true;
  }

  protected openAt(tab: T = this.tab): void {
    this.root.hidden = false;
    this.show(tab);
  }

  /** Re-renders while open; skipped when nothing changed, so buttons are not swapped under a finger. */
  refresh(): void {
    if (this.isOpen && !this.pressed) this.paint(false);
  }

  protected show(tab: T): void {
    this.tab = tab;
    this.paint(true);
  }

  private paint(reset: boolean): void {
    for (const [id, button] of this.tabButtons) button.classList.toggle('active', id === this.tab);
    // The title can show live numbers (the shop's wallet), so it is refreshed on its own, even when the body has not changed.
    const title = this.title();
    if (title !== this.lastTitle) {
      this.lastTitle = title;
      this.titleEl.innerHTML = title;
    }
    const html = this.html();
    if (html === this.lastHtml && !reset) return;
    this.lastHtml = html;
    const scroll = this.body.scrollTop;
    this.body.innerHTML = html;
    this.body.scrollTop = reset ? 0 : scroll;
    document.dispatchEvent(new CustomEvent('ui-repainted'));
  }

  /** Re-render now (after an action). */
  protected repaint(): void {
    this.paint(false);
  }

  protected abstract title(): string;
  protected abstract html(): string;
  protected abstract onAction(action: string, data: DOMStringMap): void;
}
