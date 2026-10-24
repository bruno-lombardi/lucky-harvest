export type FloaterKind = 'coins' | 'spend' | 'xp' | 'level' | 'say';

/** Short message banner near the top of the screen. */
export class Toast {
  private timer = 0;

  constructor(private readonly el: HTMLElement) {}

  show(message: string, ms = 1900): void {
    this.el.textContent = message;
    this.el.classList.add('show');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('show'), ms);
  }
}

/** Rising "+10" style numbers anchored to a screen position; `html` may carry an inline icon. */
export class Floaters {
  constructor(private readonly layer: HTMLElement) {}

  spawn(text: string, x: number, y: number, kind: FloaterKind, iconHtml = ''): void {
    const el = document.createElement('div');
    el.className = `floater ${kind}`;
    el.textContent = text;
    if (iconHtml) el.insertAdjacentHTML('beforeend', `<i class="ico">${iconHtml}</i>`);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.layer.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}
