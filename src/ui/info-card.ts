/**
 * A floating detail card for anything marked with `data-info="kind:id"`.
 * Mouse: appears on hover. Touch: hold a finger on it (or tap a shop row's text). Closes on the next tap.
 */
export class InfoCard {
  private readonly el: HTMLElement;
  private timer = 0;
  private current: HTMLElement | null = null;
  private suppressClick = false;
  private inModal = false;
  private startX = 0;
  private startY = 0;

  constructor(
    private readonly resolve: (key: string) => string | null,
    host: HTMLElement = document.body,
  ) {
    this.el = document.createElement('div');
    this.el.id = 'info-card';
    this.el.setAttribute('role', 'tooltip');
    this.el.hidden = true;
    host.appendChild(this.el);

    const target = (event: Event): HTMLElement | null => (event.target as HTMLElement | null)?.closest?.('[data-info]') ?? null;

    document.addEventListener('pointerover', (event) => {
      if (event.pointerType !== 'mouse') return;
      const t = target(event);
      if (!t || t === this.current) return;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.show(t), 220);
    });
    document.addEventListener('pointerout', (event) => {
      if (event.pointerType !== 'mouse') return;
      const to = (event as PointerEvent).relatedTarget as HTMLElement | null;
      if (to?.closest?.('[data-info]') === this.current && this.current) return;
      window.clearTimeout(this.timer);
      this.hide();
    });

    // Touch: a long press shows the card and swallows the tap that would follow.
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') {
        this.hide();
        return;
      }
      const t = target(event);
      if (!(event.target as HTMLElement).closest('#info-card')) this.hide();
      window.clearTimeout(this.timer);
      if (!t) return;
      this.startX = event.clientX;
      this.startY = event.clientY;
      this.timer = window.setTimeout(() => {
        this.show(t);
        this.suppressClick = true;
        window.setTimeout(() => (this.suppressClick = false), 600);
      }, 450);
    });
    const cancel = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse') return;
      window.clearTimeout(this.timer);
    };
    document.addEventListener('pointerup', cancel);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') return;
      if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) > 10) window.clearTimeout(this.timer);
    });
    document.addEventListener(
      'click',
      (event) => {
        if (this.suppressClick) {
          event.stopPropagation();
          event.preventDefault();
          this.suppressClick = false;
          return;
        }
        // Tapping the text of a shop row (not its buttons) opens the card on touch screens.
        const pointerType = (event as PointerEvent).pointerType;
        const t = target(event);
        if (t && pointerType && pointerType !== 'mouse' && t.closest('.shop-body') && !(event.target as HTMLElement).closest('button')) {
          this.show(t);
        }
      },
      true,
    );
    // Dialogs redraw their rows now and then: follow the same item into the new markup.
    document.addEventListener('ui-repainted', () => {
      const key = this.current?.dataset['info'];
      if (!key || this.el.hidden) return;
      const scope = this.inModal ? '.modal:not([hidden]) ' : '';
      const again = this.current?.isConnected
        ? this.current
        : (document.querySelector<HTMLElement>(`${scope}[data-info="${key}"]:hover`) ?? document.querySelector<HTMLElement>(`${scope}[data-info="${key}"]`));
      if (again) this.show(again);
      else this.hide();
    });
    document.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('keydown', (event) => event.key === 'Escape' && this.hide());
    window.addEventListener('resize', () => this.hide());
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.el.hidden = true;
    this.current = null;
  }

  /** The live element for a key (the old one may have been redrawn away). */
  private live(anchor: HTMLElement): HTMLElement | null {
    if (anchor.isConnected) return anchor;
    const key = anchor.dataset['info'];
    const scope = anchor.dataset['infoScope'] === 'modal' ? '.modal:not([hidden]) ' : '';
    return key ? (document.querySelector<HTMLElement>(`${scope}[data-info="${key}"]:hover`) ?? document.querySelector<HTMLElement>(`${scope}[data-info="${key}"]`)) : null;
  }

  private show(stale: HTMLElement): void {
    const anchor = this.live(stale);
    if (!anchor) return;
    const html = this.resolve(anchor.dataset['info'] ?? '');
    if (!html) return;
    this.current = anchor;
    this.inModal = !!anchor.closest('.modal');
    anchor.dataset['infoScope'] = this.inModal ? 'modal' : '';
    this.el.innerHTML = html;
    this.el.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const card = this.el.getBoundingClientRect();
    const margin = 8;
    // Prefer above the element; otherwise below; keep it inside the screen either way.
    let y = rect.top - card.height - margin;
    if (y < margin) y = rect.bottom + margin;
    if (y + card.height > window.innerHeight - margin) y = Math.max(margin, window.innerHeight - card.height - margin);
    const x = Math.min(Math.max(margin, rect.left + rect.width / 2 - card.width / 2), window.innerWidth - card.width - margin);
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
