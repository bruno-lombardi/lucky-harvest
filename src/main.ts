import { applyTool } from './core/actions';
import { Farm } from './core/farm';
import { TileCoord } from './core/grid';
import { Game } from './game';
import { Floaters, Toast } from './ui/feedback';
import { Hud } from './ui/hud';
import { describeTile, reasonMessage } from './ui/messages';
import { Toolbar } from './ui/toolbar';

function required(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} not found`);
  return found;
}

const farm = new Farm();
const hud = new Hud();
const toast = new Toast(required('toast'));
const floaters = new Floaters(required('floaters'));
const toolbar = new Toolbar(required('toolbar'), required('seed-tray'), (m) => toast.show(m));

let selected: TileCoord | null = null;
let lastUiUpdate = 0;

function refreshUi(now: number): void {
  hud.update(farm);
  toolbar.refresh(farm);
  hud.setTileInfo(selected ? describeTile(farm, selected.i, selected.j, now) : 'Toque num terreno');
}

function handleTap(tile: TileCoord | null): void {
  selected = tile;
  if (!tile) {
    refreshUi(Date.now());
    return;
  }

  const now = Date.now();
  const result = applyTool(farm, toolbar.tool, tile.i, tile.j, now, toolbar.crop);

  if (!result.ok) {
    // Harvesting empty ground is just "looking at the tile", not an error worth a toast.
    if (!(toolbar.tool === 'colher' && result.reason === 'no-crop')) {
      toast.show(reasonMessage(result.reason));
    }
  } else {
    const { coins, xp, levelUp } = result.gain;
    const at = game.screenPositionOf(tile);
    let offset = 0;
    const emit = (text: string, kind: 'coins' | 'spend' | 'xp' | 'level'): void => {
      floaters.spawn(text, at.x, at.y - offset, kind);
      offset += 24;
    };
    if (coins > 0) emit(`+${coins} 🪙`, 'coins');
    if (coins < 0) emit(`${coins} 🪙`, 'spend');
    if (xp > 0) emit(`+${xp} XP`, 'xp');
    if (levelUp !== null) {
      emit(`Nível ${levelUp}!`, 'level');
      toast.show(`🎉 Você chegou ao nível ${levelUp}!`, 2800);
    }
  }
  refreshUi(now);
}

const container = required('game');
const game = new Game(container, farm, {
  onTileTap: handleTap,
  onFrame: (now) => {
    // The HUD only needs to refresh a few times a second.
    if (now - lastUiUpdate > 200) {
      lastUiUpdate = now;
      refreshUi(now);
    }
  },
});

refreshUi(Date.now());
game.start();
