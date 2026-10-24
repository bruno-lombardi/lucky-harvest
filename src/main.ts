import '@fontsource-variable/fredoka';
import './ui/style.css';
import { CropId } from './core/crops';
import { SPECIES_ORDER, SpeciesId, animalStatus } from './core/animals';
import { Command, applyCommand } from './core/commands';
import { Farm, Gain } from './core/farm';
import { SaveManager } from './persistence';
import { PEN_LAYOUT } from './render/pens';
import { BarnDialog } from './ui/barn';
import { MenuDialog } from './ui/menu';
import { PenDialog } from './ui/pen';
import { GEAR_ICON, PRODUCT_ICONS } from './ui/item-icons';
import { TileCoord } from './core/grid';
import { createDemoFarm } from './demo';
import { GameAudio, Sfx } from './audio';
import { Game } from './game';
import { BurstKind } from './render/particles';
import { atmosphereAt } from './render/daynight';
import { Floaters, Toast } from './ui/feedback';
import { Hud } from './ui/hud';
import { describeTile, reasonMessage } from './ui/messages';
import { COIN_ICON, MOON_ICON, SOUND_OFF_ICON, SOUND_ON_ICON, SUN_ICON, hydrateIcons } from './ui/icons';
import { Shop, ShopTab } from './ui/shop';
import { Toolbar } from './ui/toolbar';

function required(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} not found`);
  return found;
}

const params = new URLSearchParams(window.location.search);
if (params.has('reset')) {
  new SaveManager().reset();
  window.history.replaceState(null, '', window.location.pathname);
}
const saves = new SaveManager();
const isDemo = params.has('demo');
if (isDemo) saves.disable();
const loaded = isDemo || params.has('reset') ? null : saves.load();
const farm = isDemo ? createDemoFarm(Date.now()) : (loaded?.farm ?? new Farm());
saves.attach(farm);
saves.startAutosave();
const hud = new Hud();
const clockIcon = required('hud-clock-icon');
const clockTime = required('hud-time');
let clockPhase = '';
const toast = new Toast(required('toast'));
const floaters = new Floaters(required('floaters'));
hydrateIcons();

const audio = new GameAudio();
const unlockAudio = (): void => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

const TOOL_EFFECTS: Record<string, { sfx: Sfx; burst: BurstKind }> = {
  colher: { sfx: 'harvest', burst: 'harvest' },
  arar: { sfx: 'plow', burst: 'plow' },
  semear: { sfx: 'plant', burst: 'plant' },
  regar: { sfx: 'water', burst: 'water' },
  cuidar: { sfx: 'care', burst: 'care' },
  limpar: { sfx: 'clear', burst: 'clear' },
};

const soundButton = required('sound-btn');
const syncSoundButton = (): void => {
  soundButton.innerHTML = audio.isMuted ? SOUND_OFF_ICON : SOUND_ON_ICON;
  soundButton.setAttribute('aria-pressed', String(audio.isMuted));
};
syncSoundButton();
soundButton.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted);
  syncSoundButton();
  audio.play('click');
});

// Little UI ticks: tool and seed picks get their own sound, other buttons a click.
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest('button');
  if (!button || button.id === 'sound-btn' || button.closest('.shop-body')) return;
  audio.play(button.classList.contains('tool') || button.classList.contains('seed') ? 'select' : 'click');
});

let selected: TileCoord | null = null;
let toolbar: Toolbar;
let shop: Shop;
let barn: BarnDialog;
let pen: PenDialog;
let lastLevelShown = 1;
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
  shop.refresh();
  barn.refresh();
  pen.refresh();
  const pests = countPests(now);
  if (pests > lastPests) toast.show('Praga na plantação! Use a luva (Cuidar)', 2600);
  lastPests = pests;
  const clock = game.dayNight;
  clockTime.textContent = clock.label();
  const night = atmosphereAt(clock.hour).night;
  audio.setNight(night);
  const phase = night > 0.5 ? 'moon' : 'sun';
  if (phase !== clockPhase) {
    clockPhase = phase;
    clockIcon.innerHTML = phase === 'moon' ? MOON_ICON : SUN_ICON;
  }
  hud.setTileInfo(selected ? describeTile(farm, selected.i, selected.j, now) : 'Toque num terreno');
}

/** Sound and particles for each kind of command; tool commands are handled by TOOL_EFFECTS. */
function commandEffects(command: Command): void {
  const at = (species: SpeciesId): { x: number; z: number } => PEN_LAYOUT[species];
  switch (command.type) {
    case 'buySeeds':
    case 'buyFeed':
      audio.play('buy');
      break;
    case 'sellCrop':
    case 'sellProduct':
    case 'sellAll':
      audio.play('sell');
      break;
    case 'expandLand':
      audio.play('expand');
      game.burstAtCenter('expand');
      break;
    case 'buildPen':
      audio.play('build');
      game.burstAt('expand', at(command.species).x, at(command.species).z);
      break;
    case 'buyAnimal':
      audio.play(command.species);
      game.burstAt('plant', at(command.species).x, at(command.species).z);
      break;
    case 'feed':
    case 'feedAll':
      audio.play('feed');
      game.burstAt('care', at(command.species).x, at(command.species).z);
      break;
    case 'collect':
    case 'collectAll':
      audio.play('collect');
      game.burstAt('harvest', at(command.species).x, at(command.species).z);
      break;
    case 'craftFeed':
      audio.play('collect');
      break;
    case 'upgradePen':
      audio.play('build');
      break;
    case 'tool':
      break;
  }
}

/**
 * The one door for every player action: applies the command, records it for save and server sync,
 * then plays the sounds, particles and floating numbers. Returns whether it succeeded.
 */
function dispatch(command: Command, anchor?: { x: number; y: number }): boolean {
  const now = Date.now();
  const result = applyCommand(farm, command, now);
  if (!result.ok) {
    // Harvesting empty ground is just "looking at the tile", not an error worth a toast.
    const quiet = command.type === 'tool' && command.tool === 'colher' && result.reason === 'no-crop';
    if (!quiet) {
      toast.show(reasonMessage(result.reason));
      audio.play('error');
      if (result.reason === 'no-seeds') shopButton.classList.add('nudge');
    }
    refreshUi(now);
    return false;
  }
  saves.record(command, now);
  if (command.type !== 'tool') commandEffects(command);
  if (anchor) showGain(result.gain, anchor);
  if (result.gain.levelUp !== null) {
    toast.show(`Você chegou ao nível ${result.gain.levelUp}!`, 2800);
    audio.play('levelup');
  }
  refreshUi(now);
  return true;
}

function showGain(gain: Gain, at: { x: number; y: number }): void {
  let offset = 0;
  const emit = (text: string, kind: 'coins' | 'spend' | 'xp' | 'level', icon = ''): void => {
    floaters.spawn(text, at.x, at.y - offset, kind, icon);
    offset += 24;
  };
  if (gain.item) emit(`+${gain.item.qty}`, 'coins', `<img alt="" src="${cropIcons[gain.item.cropId]}" />`);
  if (gain.product) emit(`+${gain.product.qty}`, 'coins', PRODUCT_ICONS[gain.product.productId]);
  if (gain.coins > 0) emit(`+${gain.coins}`, 'coins', COIN_ICON);
  if (gain.coins < 0) emit(`${gain.coins}`, 'spend', COIN_ICON);
  if (gain.xp > 0) emit(`+${gain.xp} XP`, 'xp');
  if (gain.levelUp !== null) emit(`Nível ${gain.levelUp}!`, 'level');
}

function handleTap(tile: TileCoord | null): void {
  selected = tile;
  if (!tile) {
    refreshUi(Date.now());
    return;
  }
  const command: Command = { type: 'tool', tool: toolbar.tool, i: tile.i, j: tile.j, crop: toolbar.crop };
  const ok = dispatch(command, game.screenPositionOf(tile));
  if (ok) {
    const fx = TOOL_EFFECTS[toolbar.tool];
    if (fx) {
      audio.play(fx.sfx);
      game.burst(fx.burst, tile);
    }
    if (farm.level > lastLevelShown) game.burst('levelup', tile);
  }
  lastLevelShown = farm.level;
}

function handleObjectTap(id: string): void {
  audio.play('click');
  if (id === 'barn') {
    barn.open();
  } else if (id.startsWith('pen:')) {
    const species = id.slice(4) as SpeciesId;
    if (SPECIES_ORDER.includes(species)) pen.open(species);
  }
}

const parsedHour = Number(params.get('time') ?? 9);
const startHour = Number.isFinite(parsedHour) ? parsedHour : 9;
const shopButton = required('shop-btn');
const container = required('game');
const game = new Game(container, farm, {
  onTileTap: handleTap,
  onObjectTap: handleObjectTap,
  onFrame: (now) => {
    // The HUD only needs to refresh a few times a second.
    if (now - lastUiUpdate > 200) {
      lastUiUpdate = now;
      refreshUi(now);
    }
  },
}, startHour, params.has('freeze'));

cropIcons = game.renderCropIcons();
lastLevelShown = farm.level;
toolbar = new Toolbar(required('toolbar'), required('seed-tray'), (m) => toast.show(m), cropIcons);
shop = new Shop(required('shop'), farm, cropIcons, (command) => {
  const ok = dispatch(command);
  return ok;
});
barn = new BarnDialog(required('barn'), farm, cropIcons, dispatch, {
  openShop: (tab) => shop.open(tab),
});
pen = new PenDialog(required('pen'), farm, dispatch, {
  openShop: (tab) => shop.open(tab),
  openBarn: (tab) => barn.open(tab),
});

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const menu = new MenuDialog(required('menu'), {
  save: () => saves.save(Date.now(), true),
  exportSave: () => download('lucky-harvest-save.json', saves.exportText(Date.now())),
  importFile: (file) => {
    void file.text().then((text) => {
      const result = saves.importText(text);
      if (result.ok) {
        saves.disable(); // the page is about to reload: do not overwrite the imported file
        window.location.reload();
      } else {
        menu.setMessage(result.error);
        audio.play('error');
      }
    });
  },
  reset: () => {
    saves.reset();
    window.location.href = window.location.pathname;
  },
  lastSaved: () => saves.lastSaved,
  sync: () => 'Cada ação é registrada para poder sincronizar com um servidor no futuro.',
});
const menuButton = required('menu-btn');
menuButton.innerHTML = GEAR_ICON;
menuButton.addEventListener('click', () => menu.open());

shopButton.addEventListener('click', () => {
  shopButton.classList.remove('nudge');
  shop.open();
});

// Debug / screenshot helpers: ?shop=seeds|feed|sell|animals|land  ?barn  ?pen=galinha  ?menu
const SHOP_TABS: readonly ShopTab[] = ['seeds', 'feed', 'sell', 'animals', 'land'];
const openShop = params.get('shop');
if (openShop !== null) shop.open(SHOP_TABS.find((t) => t === openShop) ?? 'seeds');
if (params.has('barn')) barn.open(params.get('barn') === 'feed' ? 'feed' : 'stock');
const openPen = params.get('pen') as SpeciesId | null;
if (openPen && SPECIES_ORDER.includes(openPen)) pen.open(openPen);
if (params.has('menu')) menu.open();

const view = params.get('view')?.split(',').map(Number);
if (view && view.length === 3 && view.every(Number.isFinite)) {
  game.setView(view[0]!, view[1]!, view[2]!);
}

// Welcome back: tell returning players what happened while they were away.
if (loaded && Date.now() - loaded.savedAt > 60_000) {
  const now = Date.now();
  let ripe = 0;
  let waiting = 0;
  for (const { i, j, tile } of farm.entries()) {
    if (tile.crop && farm.status(i, j, now)?.ripe) ripe++;
  }
  for (const species of SPECIES_ORDER) {
    for (const animal of farm.pens[species]?.animals ?? []) {
      if (animalStatus(species, animal, now).phase === 'ready') waiting++;
    }
  }
  const parts: string[] = [];
  if (ripe) parts.push(`${ripe} ${ripe === 1 ? 'planta madura' : 'plantas maduras'}`);
  if (waiting) parts.push(`${waiting} ${waiting === 1 ? 'produto pronto' : 'produtos prontos'}`);
  toast.show(parts.length ? `Bem-vindo de volta! ${parts.join(' e ')}.` : 'Bem-vindo de volta!', 4200);
} else if (loaded?.recovered) {
  toast.show('Save principal danificado: usamos o backup.', 4200);
}

// Animals call out now and then, from whichever pens exist.
function scheduleAnimalSound(): void {
  window.setTimeout(() => {
    const built = SPECIES_ORDER.filter((s) => (farm.pens[s]?.animals.length ?? 0) > 0);
    if (built.length && !document.hidden) audio.play(built[Math.floor(Math.random() * built.length)]!, 0.5);
    scheduleAnimalSound();
  }, 9000 + Math.random() * 14000);
}
scheduleAnimalSound();

refreshUi(Date.now());
game.start();

// Debug: `?fx` replays every particle burst on the plot, once a second (handy for screenshots).
if (params.has('fx')) {
  const kinds: BurstKind[] = ['plow', 'plant', 'water', 'care', 'harvest', 'clear', 'levelup'];
  window.setInterval(() => {
    kinds.forEach((kind, n) => game.burst(kind, { i: 9 + n, j: 11 }));
  }, 1000);
}
