/** The loading screen lives in index.html (so it shows before any script runs); this drives it. */

const root = document.getElementById('splash');
const bar = document.getElementById('splash-bar');
const msg = document.getElementById('splash-msg');

const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    // rAF alone never fires in a hidden tab, so a timeout keeps startup moving there too.
    const timer = window.setTimeout(resolve, 80);
    requestAnimationFrame(() => {
      window.clearTimeout(timer);
      window.setTimeout(resolve, 0);
    });
  });

/** Moves the bar to `fraction` (0..1) with a short message, and lets the browser paint it before heavy work continues. */
export async function splashStage(fraction: number, text: string): Promise<void> {
  if (!root) return;
  if (bar) bar.style.width = `${Math.round(Math.min(Math.max(fraction, 0.04), 1) * 100)}%`;
  if (msg) msg.textContent = text;
  await nextPaint();
}

/** Fades the loading screen out once the first frames of the game are on screen. */
export async function splashDone(): Promise<void> {
  if (!root) return;
  await splashStage(1, 'Tudo pronto!');
  await nextPaint();
  await nextPaint();
  root.classList.add('gone');
  window.setTimeout(() => root.remove(), 700);
}
