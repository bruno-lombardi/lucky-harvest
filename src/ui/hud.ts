import { Farm } from '../core/farm';
import { levelProgress } from '../core/levels';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} not found`);
  return found as T;
}

/** Top bar (level, XP bar, coins) and the tile info strip. */
export class Hud {
  private readonly level = el('hud-level');
  private readonly fill = el('hud-xp-fill');
  private readonly xpText = el('hud-xp-text');
  private readonly coins = el('hud-coins');
  private readonly tileInfo = el('hud-tile');
  private lastCoins = -1;

  update(farm: Farm): void {
    const progress = levelProgress(farm.xp);
    this.level.textContent = String(progress.level);
    this.fill.style.width = `${Math.round(progress.fraction * 100)}%`;
    this.xpText.textContent = progress.needed > 0 ? `${progress.current}/${progress.needed} XP` : 'MAX';

    if (farm.coins !== this.lastCoins) {
      if (this.lastCoins !== -1) this.bump(this.coins);
      this.lastCoins = farm.coins;
      this.coins.textContent = farm.coins.toLocaleString('pt-BR');
    }
  }

  setTileInfo(text: string): void {
    if (this.tileInfo.textContent !== text) this.tileInfo.textContent = text;
  }

  private bump(target: HTMLElement): void {
    target.classList.remove('bump');
    void target.offsetWidth; // restart the CSS animation
    target.classList.add('bump');
  }
}
