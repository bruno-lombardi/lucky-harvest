import '@fontsource-variable/fredoka';
import './ui/style.css';
import { deliveryInterval, slotOf, slotTime } from './core/delivery';
import { CROPS, CROP_ORDER, CropId } from './core/crops';
import { TREES, TreeId } from './core/trees';
import { SPECIES, SPECIES_ORDER, SpeciesId, animalStatus } from './core/animals';
import { Command, applyCommand } from './core/commands';
import { Farm, Gain } from './core/farm';
import { SaveManager } from './persistence';
import { HELPERS, HELPER_ORDER, HOME, HelperId, payWord, walkerPose } from './core/helpers';
import { PEN_LAYOUT } from './render/pens';
import { BarnDialog } from './ui/barn';
import { levelThreshold } from './core/levels';
import { BAKERY_SPOT } from './render/bakery-view';
import { BakeryDialog } from './ui/bakery';
import { TonicoDialog } from './ui/tonico';
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
import { BookDialog } from './ui/book';
import { Shop, ShopTab } from './ui/shop';
import { CHIP_GOALS, achievementKey, claimableSteps, claimableGoals, currentGoal, goalDone, goalKey } from './core/progress';
import { BOOK_ICON } from './ui/icons';
import { Toolbar } from './ui/toolbar';
import { cursorFor } from './ui/cursors';
import { InfoCard } from './ui/info-card';
import { infoCard } from './ui/info';

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
const farm = isDemo ? createDemoFarm(Date.now()) : (loaded?.farm ?? new Farm({ now: Date.now() }));
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
let book: BookDialog;
let barn: BarnDialog;
let tonico: TonicoDialog;
let bakeryDialog: BakeryDialog;
let pen: PenDialog;
let lastLevelShown = 1;
let cropIcons: Record<CropId, string>;
let treeIcons: Record<TreeId, string>;
let lastPests = 0;
let lastUiUpdate = 0;

function countPests(now: number): number {
  let count = 0;
  for (const { i, j, tile } of farm.entries()) {
    if (tile.crop && farm.status(i, j, now)?.pest) count++;
  }
  return count;
}

const unpaidKnown = new Set<HelperId>();
let knownLevel = 0;
/** Goals and medal steps already announced, so each toasts once when it first completes. */
const announced = new Set<string>();
let announcedReady = false;
const QUIET_VOLUME = 0.5;

/** Shows what helpers did since the last look: bursts, floating crops and quiet sounds (only for recent events). */
function showHelperEvents(now: number): void {
  const events = farm.helperEvents.splice(0);
  let sprinkled = false;
  for (const e of events) {
    if (e.kind === 'feed' && e.species && now - e.at <= 2500) {
      const spot = PEN_LAYOUT[e.species];
      game.burstAt('care', spot.x, spot.z);
      audio.play('feed', QUIET_VOLUME);
      continue;
    }
    if (e.kind === 'collect' && e.species && now - e.at <= 2500) {
      const spot = PEN_LAYOUT[e.species];
      game.burstAt('harvest', spot.x, spot.z);
      audio.play('collect', QUIET_VOLUME);
      continue;
    }
    if (now - e.at > 2500 || e.i === undefined || e.j === undefined) continue;
    const tile = { i: e.i, j: e.j };
    if (e.kind === 'harvest') {
      game.burst('harvest', tile);
      audio.play('harvest', QUIET_VOLUME);
      const at = game.screenPositionOf(tile);
      if (e.crop) floaters.spawn('+1', at.x, at.y, 'coins', `<img alt="" src="${cropIcons[e.crop]}" />`);
      else if (farm.tree(e.i, e.j)) floaters.spawn('+', at.x, at.y, 'coins', `<img alt="" src="${treeIcons[farm.tree(e.i, e.j)!.species]}" />`);
    } else if (e.kind === 'plant') {
      game.burst('plant', tile);
      audio.play('plant', QUIET_VOLUME);
    } else if (e.kind === 'say' && e.text) {
      const at = game.screenPositionOf(tile);
      floaters.spawn(e.text, at.x, at.y - 34, 'say');
    } else if (e.kind === 'care') {
      game.burst('care', tile);
      audio.play('meow', QUIET_VOLUME);
    } else if (e.kind === 'water' && !sprinkled) {
      sprinkled = true;
      audio.play('sprinkle', QUIET_VOLUME);
    }
  }
  for (const id of HELPER_ORDER) {
    const state = farm.helpers[id];
    if (state && !state.paid) {
      if (!unpaidKnown.has(id)) {
        unpaidKnown.add(id);
        toast.show(`${HELPERS[id].name} parou: sem moedas para o ${payWord(id)}!`, 3600);
        audio.play('error');
      }
    } else unpaidKnown.delete(id);
  }
}

/** The seed truck's arrivals: one toast for everything dropped off, and floating seeds above the barn for fresh ones. */
function showDeliveries(now: number): void {
  const events = farm.deliveryEvents.splice(0);
  if (events.length === 0) return;
  const total = Object.fromEntries(CROP_ORDER.map((id) => [id, 0])) as Record<CropId, number>;
  for (const e of events) for (const id of CROP_ORDER) total[id] += e.seeds[id];
  const parts = CROP_ORDER.filter((id) => total[id] > 0).map((id) => `${total[id]}× ${CROPS[id].name}`);
  const many = events.length > 1 ? ` (${events.length} entregas)` : '';
  toast.show(`Chegou a entrega de sementes${many}: ${parts.join(', ')}`, 4200);
  audio.play('delivery');
  if (now - events[events.length - 1]!.at > 4000) return;
  const spot = game.deliverySpot();
  let n = 0;
  for (const id of CROP_ORDER) {
    if (total[id] === 0) continue;
    window.setTimeout(() => {
      const pos = game.screenPositionOfWorld(spot.x, 1.6, spot.z);
      floaters.spawn(`+${total[id]}`, pos.x, pos.y, 'coins', `<img alt="" src="${cropIcons[id]}" />`);
    }, 250 * n);
    n++;
  }
}

const goalChip = required('goal-chip');
const bookButton = required('book-btn');
const bookDot = bookButton.querySelector<HTMLElement>('.dot')!;

/** The goal chip, the book's red dot and the "done!" toasts. */
function refreshGoals(): void {
  const ready = [
    ...claimableGoals(farm).map((g) => ({ key: goalKey(g.id), text: `Meta cumprida: ${g.text}` })),
    ...claimableSteps(farm).map((c) => ({ key: achievementKey(c.achievement.id, c.step), text: `Medalha de ${['bronze', 'prata', 'ouro'][c.step] ?? 'ouro'}: ${c.achievement.name}` })),
  ];
  for (const item of ready) {
    if (announced.has(item.key)) continue;
    announced.add(item.key);
    if (announcedReady) {
      toast.show(`${item.text}! Abra o Livro para resgatar`, 3200);
      audio.play('levelup', 0.7);
    }
  }
  announcedReady = true;
  bookDot.hidden = ready.length === 0;

  const goal = currentGoal(farm);
  const show = goal !== null && goal.id <= CHIP_GOALS;
  goalChip.hidden = !show;
  toolbar.point(null);
  shopButton.classList.remove('point');
  if (!show) return;
  const done = goalDone(goal, farm);
  const text = done ? `Meta pronta! Toque para resgatar` : `Meta: ${goal.text}`;
  if (goalChip.textContent !== text) goalChip.textContent = text;
  goalChip.classList.toggle('ready', done);
  if (!done && goal.point) {
    if (goal.point === 'loja') shopButton.classList.add('point');
    else if (goal.point === 'arar' || goal.point === 'semear' || goal.point === 'regar' || goal.point === 'colher' || goal.point === 'cuidar') toolbar.point(goal.point);
  }
}

function refreshUi(now: number): void {
  showHelperEvents(now);
  showDeliveries(now);
  if (farm.level > knownLevel) {
    if (knownLevel > 0) {
      toast.show(`Você chegou ao nível ${farm.level}!`, 2800);
      audio.play('levelup');
    }
    knownLevel = farm.level;
  }
  hud.update(farm);
  toolbar.refresh(farm);
  refreshGoals();
  shop.refresh();
  book.refresh();
  barn.refresh();
  tonico.refresh();
  bakeryDialog.refresh();
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
    case 'buySapling':
    case 'buyFeed':
      audio.play('buy');
      break;
    case 'sellCrop':
    case 'sellProduct':
    case 'sellFruit':
    case 'sellAll':
      audio.play('sell');
      break;
    case 'expandLand':
      audio.play('expand');
      game.burstAtCenter('expand');
      break;
    case 'buyPomar':
      audio.play('expand');
      game.burstAt('expand', 2.2, -9.5);
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
    case 'upgradeTruck':
    case 'upgradeBarn':
    case 'buyDecor':
      audio.play('build');
      break;
    case 'buyBakery':
    case 'upgradeBakery':
      audio.play('expand');
      game.burstAt('expand', BAKERY_SPOT.x, BAKERY_SPOT.z);
      break;
    case 'bake':
      audio.play('plant');
      game.burstAt('plant', BAKERY_SPOT.x, BAKERY_SPOT.z);
      break;
    case 'collectBakery':
      audio.play('collect');
      game.burstAt('harvest', BAKERY_SPOT.x, BAKERY_SPOT.z);
      break;
    case 'sellGood':
      audio.play('sell');
      break;
    case 'hireHelper': {
      audio.play('build');
      const home = command.helper === 'regador' ? { u: 12, v: 12 } : HOME[command.helper];
      game.burstAt('expand', home.u - 12, home.v - 12);
      break;
    }
    case 'upgradeHelper':
      audio.play('levelup');
      break;
    case 'payHelper':
      audio.play('buy');
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
  if (gain.item?.golden) {
    emit('Colheita dourada!', 'level');
    toast.show(`Colheita dourada: ${CROPS[gain.item.cropId].name} em dobro!`, 2600);
    audio.play('levelup', 0.6);
  }
  if (gain.fruit) emit(`+${gain.fruit.qty}`, 'coins', `<img alt="" src="${treeIcons[gain.fruit.tree]}" />`);
  if (gain.fruit?.golden) {
    emit('Colheita dourada!', 'level');
    toast.show(`Frutas douradas: ${TREES[gain.fruit.tree].fruitName} em dobro!`, 2600);
    audio.play('levelup', 0.6);
  }
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
  if (toolbar.tool === 'olhar') {
    // Look mode never changes anything: it only selects the tile for the info bar.
    refreshUi(Date.now());
    return;
  }
  const command: Command = { type: 'tool', tool: toolbar.tool, i: tile.i, j: tile.j, crop: toolbar.crop, tree: toolbar.tree };
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

const tip = required('tip');
const OBJECT_NAMES: Record<string, string> = { barn: 'Celeiro: toque para abrir', bakery: 'Confeitaria da Dona Zefa: toque para abrir' };

/** In look mode, a small label follows the pointer and says what is underneath. */
function handleHover(hit: { tile: TileCoord | null; object: string | null; x: number; y: number } | null): void {
  if (!hit || toolbar.tool !== 'olhar') {
    tip.hidden = true;
    return;
  }
  let text = '';
  if (hit.object) {
    const species = hit.object.startsWith('pen:') ? (hit.object.slice(4) as SpeciesId) : null;
    text = species ? penTip(species) : hit.object.startsWith('helper:') ? helperTip(hit.object.slice(7) as HelperId) : (OBJECT_NAMES[hit.object] ?? '');
  } else if (hit.tile) {
    text = describeTile(farm, hit.tile.i, hit.tile.j, Date.now());
  }
  tip.hidden = !text;
  if (!text) return;
  tip.textContent = text;
  const rect = tip.getBoundingClientRect();
  const x = Math.min(hit.x + 18, window.innerWidth - rect.width - 8);
  const y = hit.y + 24 + rect.height > window.innerHeight ? hit.y - rect.height - 12 : hit.y + 24;
  tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
}

function helperTip(id: HelperId): string {
  const def = HELPERS[id];
  const state = farm.helpers[id];
  if (!state) return def.name;
  if (!state.paid) return `${def.name}: parou, sem ${payWord(id)}`;
  return `${def.name} · nível ${state.level}: ${def.job}`;
}

function penTip(species: SpeciesId): string {
  const def = SPECIES[species];
  const state = farm.pens[species];
  if (!state) return `${def.penName}: ainda não construído`;
  const now = Date.now();
  let ready = 0;
  let hungry = 0;
  for (const a of state.animals) {
    const phase = animalStatus(species, a, now).phase;
    if (phase === 'ready') ready++;
    else if (phase === 'hungry') hungry++;
  }
  const parts = [`${state.animals.length} ${def.name.toLowerCase()}${state.animals.length === 1 ? '' : 's'}`];
  if (ready) parts.push(`${ready} pronto${ready === 1 ? '' : 's'}`);
  if (hungry) parts.push(`${hungry} com fome`);
  return `${def.penName}: ${parts.join(' · ')}`;
}

function handleObjectTap(id: string): void {
  audio.play('click');
  if (id === 'barn') {
    barn.open();
  } else if (id === 'bakery') {
    bakeryDialog.open();
  } else if (id === 'helper:ajudante' && farm.helpers.ajudante) {
    tonico.open();
  } else if (id.startsWith('helper:')) {
    shop.open('helpers');
  } else if (id.startsWith('pen:')) {
    const species = id.slice(4) as SpeciesId;
    if (SPECIES_ORDER.includes(species)) pen.open(species);
  }
}

// Debug: ?follow=ajudante|gato|cao keeps the camera on a helper (&zoom=4 to get close).
const followParam = params.get('follow');
const follow = followParam === 'ajudante' || followParam === 'gato' || followParam === 'cao' || followParam === 'tratador' ? followParam : null;
const followZoom = Number(params.get('zoom') ?? 4) || 4;

const parsedHour = Number(params.get('time') ?? 9);
const startHour = Number.isFinite(parsedHour) ? parsedHour : 9;
const truckParam = params.get('truck');
const shopButton = required('shop-btn');
const container = required('game');
const game = new Game(container, farm, {
  onTileTap: handleTap,
  onObjectTap: handleObjectTap,
  onHover: handleHover,
  onTruck: (cue) => {
    if (cue === 'honk') audio.play('truck', 0.7);
  },
  onFrame: (now) => {
    if (follow) {
      const state = farm.helpers[follow];
      if (state) {
        const at = walkerPose(follow, state, farm.landSize, now).at;
        game.setView(at.u - 12, at.v - 12, followZoom);
      }
    }
    // The HUD only needs to refresh a few times a second.
    if (now - lastUiUpdate > 200) {
      lastUiUpdate = now;
      refreshUi(now);
    }
  },
}, startHour, params.has('freeze'));

cropIcons = game.renderCropIcons();
treeIcons = game.renderTreeIcons();
game.setToolCursor(cursorFor('olhar'));
lastLevelShown = farm.level;
toolbar = new Toolbar(required('toolbar'), required('seed-tray'), (m) => toast.show(m), cropIcons, treeIcons);
new InfoCard((key) => infoCard(key, farm));
toolbar.onToolChange = (mode) => {
  game.setToolCursor(cursorFor(mode));
  tip.hidden = true;
};
shop = new Shop(required('shop'), farm, cropIcons, treeIcons, (command) => {
  const ok = dispatch(command);
  return ok;
});
barn = new BarnDialog(required('barn'), farm, cropIcons, treeIcons, dispatch, {
  openShop: (tab) => shop.open(tab),
});
bakeryDialog = new BakeryDialog(required('bakery'), farm, dispatch, { openShop: (tab) => shop.open(tab) });
tonico = new TonicoDialog(required('tonico'), farm, cropIcons, dispatch);
shop.onConfigure = () => tonico.open();
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
book = new BookDialog(required('book'), farm, dispatch);
bookButton.insertAdjacentHTML('afterbegin', BOOK_ICON);
bookButton.addEventListener('click', () => {
  const goal = currentGoal(farm);
  book.open(claimableGoals(farm).length > 0 || (goal !== null && goal.id <= CHIP_GOALS) ? 'metas' : 'conquistas');
});
goalChip.addEventListener('click', () => book.open('metas'));
if (params.has('book')) book.open(['guia', 'metas', 'conquistas'].includes(params.get('book')!) ? (params.get('book') as 'guia' | 'metas' | 'conquistas') : 'metas');
const menuButton = required('menu-btn');
menuButton.innerHTML = GEAR_ICON;
menuButton.addEventListener('click', () => menu.open());

shopButton.addEventListener('click', () => {
  shopButton.classList.remove('nudge');
  shop.open();
});

// Debug / screenshot helpers: ?shop=seeds|feed|sell|animals|land  ?barn  ?pen=galinha  ?menu
const SHOP_TABS: readonly ShopTab[] = ['seeds', 'trees', 'feed', 'sell', 'animals', 'helpers', 'land'];
const openShop = params.get('shop');
if (openShop !== null) shop.open(SHOP_TABS.find((t) => t === openShop) ?? 'seeds');
if (params.has('barn')) barn.open(params.get('barn') === 'feed' ? 'feed' : 'stock');
const openPen = params.get('pen') as SpeciesId | null;
if (openPen && SPECIES_ORDER.includes(openPen)) pen.open(openPen);
if (params.has('menu')) menu.open();

if (params.has('tonico')) {
  // debug: give Tonico his fourth tier and open his settings
  farm.xp = Math.max(farm.xp, levelThreshold(16));
  if (!farm.helpers.ajudante) farm.hireHelper('ajudante', Date.now());
  farm.helpers.ajudante!.level = 4;
  tonico.open();
}
if (params.has('bakery')) {
  // debug: a built Confeitaria (?bakery=1..3, add &busy or &ready, &baker opens the dialog)
  const now = Date.now();
  const level = Math.min(3, Math.max(1, Number(params.get('bakery')) || 1));
  const job = { good: 'pao' as const, batches: 1, startedAt: now, readyAt: params.has('ready') ? now - 1 : now + 3_600_000 };
  farm.bakery = { level, jobs: params.has('busy') || params.has('ready') ? [job] : [] };
}
if (params.has('baker')) bakeryDialog.open(params.get('baker') === 'receitas' ? 'receitas' : 'forno');
if (params.has('spray')) game.forceSpray(true);
if (params.has('tier')) farm.barn = Math.min(4, Math.max(1, Number(params.get('tier')) || 1)); // debug: look at a barn tier

// Debug hook for the end-to-end checks (only with ?demo).
if (isDemo) (window as unknown as Record<string, unknown>)['__lh'] = { farm, tileAt: (i: number, j: number) => game.screenPositionOf({ i, j }) };

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
// Debug: `?truck=-4` puts the clock four seconds before the next seed truck arrives (positive = after);
// add `&stopclock` to hold it there.
if (truckParam !== null && Number.isFinite(Number(truckParam))) {
  const nowMs = Date.now();
  const at = slotTime(slotOf(nowMs, deliveryInterval(farm.truck)) + 1, deliveryInterval(farm.truck)) + Number(truckParam) * 1000;
  if (params.has('stopclock')) game.freezeClockAt(at);
  else game.setClockOffset(at - nowMs);
}
game.start();

// Debug: `?fx` replays every particle burst on the plot, once a second (handy for screenshots).
if (params.has('fx')) {
  const kinds: BurstKind[] = ['plow', 'plant', 'water', 'care', 'harvest', 'clear', 'levelup'];
  window.setInterval(() => {
    kinds.forEach((kind, n) => game.burst(kind, { i: 9 + n, j: 11 }));
  }, 1000);
}
