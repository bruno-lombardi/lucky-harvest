import '@fontsource-variable/fredoka';
import './ui/style.css';
import { applyTool } from './core/actions';
import { CropId } from './core/crops';
import { Farm } from './core/farm';
import { TileCoord } from './core/grid';
import { createDemoFarm } from './demo';
import { Game } from './game';
import { Floaters, Toast } from './ui/feedback';
import { Hud } from './ui/hud';
import { describeTile, reasonMessage } from './ui/messages';
import { COIN_ICON, hydrateIcons } from './ui/icons';
import { Shop } from './ui/shop';
import { Toolbar } from './ui/toolbar';

function required(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} not found`);
  return found;
}

const params = new URLSearchParams(window.location.search);
const farm = params.has('demo') ? createDemoFarm(Date.now()) : new Farm();
const hud = new Hud();
const toast = new Toast(required('toast'));
const floaters = new Floaters(required('floaters'));
hydrateIcons();

let selected: TileCoord | null = null;
let toolbar: Toolbar;
let shop: Shop;
let cropIcons: Record<CropId, string>;
let lastPests = 0;
let lastUiUpdate = 0;

function countPests(now: number): number {
  let count = 0;
  for (const { i, j, tile } of farm.entries()) {
    if (tile.crop && farm.status(i, j, now)?.pest) count++;
  }
  return count;
}

function refreshUi(now: number): void {
  hud.update(farm);
  toolbar.refresh(farm);
  const pests = countPests(now);
  if (pests > lastPests) toast.show('Praga na plantação! Use a luva (Cuidar)', 2600);
  lastPests = pests;
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
      if (result.reason === 'no-seeds') shopButton.classList.add('nudge');
    }
  } else {
    const { coins, xp, levelUp, item } = result.gain;
    const at = game.screenPositionOf(tile);
    let offset = 0;
    const emit = (text: string, kind: 'coins' | 'spend' | 'xp' | 'level', icon = ''): void => {
      floaters.spawn(text, at.x, at.y - offset, kind, icon);
      offset += 24;
    };
    if (item) emit(`+${item.qty}`, 'coins', `<img alt="" src="${cropIcons[item.cropId]}" />`);
    if (coins > 0) emit(`+${coins}`, 'coins', COIN_ICON);
    if (coins < 0) emit(`${coins}`, 'spend', COIN_ICON);
    if (xp > 0) emit(`+${xp} XP`, 'xp');
    if (levelUp !== null) {
      emit(`Nível ${levelUp}!`, 'level');
      toast.show(`Você chegou ao nível ${levelUp}!`, 2800);
    }
  }
  refreshUi(now);
}

const shopButton = required('shop-btn');
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

cropIcons = game.renderCropIcons();
toolbar = new Toolbar(required('toolbar'), required('seed-tray'), (m) => toast.show(m), cropIcons);
shop = new Shop(required('shop'), farm, cropIcons, {
  notify: (m) => toast.show(m),
  onChange: () => refreshUi(Date.now()),
});
shopButton.addEventListener('click', () => {
  shopButton.classList.remove('nudge');
  shop.open();
});
const openShop = params.get('shop');
if (openShop !== null) shop.open((['seeds', 'barn', 'land'] as const).find((t) => t === openShop) ?? 'seeds');

const view = params.get('view')?.split(',').map(Number);
if (view && view.length === 3 && view.every(Number.isFinite)) {
  game.setView(view[0]!, view[1]!, view[2]!);
}

refreshUi(Date.now());
game.start();
