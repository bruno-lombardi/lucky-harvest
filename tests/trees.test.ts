import { describe, expect, it } from 'vitest';
import { LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { Farm, FarmSnapshot, LegacySnapshot } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { decodeSave, encodeSave } from '../src/core/save';
import { POMAR, TREES, TREE_ORDER, TreeId, coinsPerMinute, isOrchardTile } from '../src/core/trees';

const MIN = 60_000;
const T = { i: 12, j: 2 };

function orchardFarm(tree: TreeId = 'laranjeira', pestChance = 0): Farm {
  const farm = new Farm({ seed: 5, pestChance });
  farm.xp = levelThreshold(30);
  farm.coins = 100_000;
  expect(farm.buyPomar().ok).toBe(true);
  expect(farm.buySapling(tree, 3).ok).toBe(true);
  return farm;
}

function calm(tree: TreeId = 'laranjeira'): Farm {
  return orchardFarm(tree, 0);
}

describe('orchard', () => {
  it('is bought once, needs the level and the coins', () => {
    const farm = new Farm({ seed: 1 });
    expect(farm.buyPomar()).toEqual({ ok: false, reason: 'level-too-low' });
    farm.xp = levelThreshold(POMAR.level);
    expect(farm.buyPomar()).toEqual({ ok: false, reason: 'no-coins' });
    farm.coins = POMAR.cost;
    expect(farm.buyPomar().ok).toBe(true);
    expect(farm.coins).toBe(0);
    expect(farm.buyPomar().ok).toBe(false);
  });

  it('only accepts trees on orchard tiles, once bought, with a sapling and the level', () => {
    const farm = new Farm({ seed: 1 });
    farm.xp = levelThreshold(30);
    farm.coins = 10_000;
    expect(farm.buySapling('laranjeira', 1)).toEqual({ ok: false, reason: 'pomar-locked' });
    farm.buyPomar();
    expect(farm.plantTree('laranjeira', T.i, T.j, 0)).toEqual({ ok: false, reason: 'no-sapling' });
    farm.buySapling('laranjeira', 2);
    expect(farm.plantTree('laranjeira', 9, 9, 0)).toEqual({ ok: false, reason: 'not-orchard' });
    expect(isOrchardTile(9, 9)).toBe(false);
    expect(farm.plantTree('laranjeira', T.i, T.j, 0).ok).toBe(true);
    expect(farm.plantTree('laranjeira', T.i, T.j, 0)).toEqual({ ok: false, reason: 'occupied' });
    const low = new Farm({ seed: 1 });
    low.xp = levelThreshold(10);
    low.coins = 100_000;
    low.buyPomar();
    expect(low.buySapling('coqueiro', 1)).toEqual({ ok: false, reason: 'tree-locked' });
  });

  it('keeps crops out: the plow and the seeds cannot touch orchard tiles', () => {
    const farm = calm();
    expect(farm.plow(T.i, T.j).ok).toBe(false);
    expect(farm.plant(T.i, T.j, 'cenoura', 0).ok).toBe(false);
  });
});

describe('tree growth', () => {
  it('stalls young at halfway until watered once, then needs no more water', () => {
    const farm = calm();
    const def = TREES.laranjeira;
    farm.plantTree('laranjeira', T.i, T.j, 0);
    expect(farm.treeStatus(T.i, T.j, 0)!.stage).toBe(0);
    const stalled = farm.treeStatus(T.i, T.j, def.growMs * 5)!;
    expect(stalled.thirsty).toBe(true);
    expect(stalled.adult).toBe(false);
    expect(farm.waterTree(T.i, T.j, def.growMs * 5).ok).toBe(true);
    expect(farm.waterTree(T.i, T.j, def.growMs * 5).ok).toBe(false);
    const later = def.growMs * 5;
    expect(farm.treeStatus(T.i, T.j, later + def.growMs / 2)!.adult).toBe(true);
    expect(farm.treeStatus(T.i, T.j, later + def.growMs / 2)!.thirsty).toBe(false);
  });

  it('ripens after growth plus one cycle, and a harvest waits on the tree (offline cap)', () => {
    const farm = calm();
    const def = TREES.laranjeira;
    farm.plantTree('laranjeira', T.i, T.j, 0);
    farm.waterTree(T.i, T.j, 0);
    const ripeAt = def.growMs + def.cycleMs;
    expect(farm.treeStatus(T.i, T.j, ripeAt - 1)!.ripe).toBe(false);
    expect(farm.harvestTree(T.i, T.j, ripeAt - 1)).toEqual({ ok: false, reason: 'not-ripe' });
    expect(farm.treeStatus(T.i, T.j, ripeAt)!.ripe).toBe(true);
    // A week away still gives one harvest only.
    const week = 7 * 24 * 60 * MIN;
    const r = farm.harvestTree(T.i, T.j, week);
    expect(r.ok).toBe(true);
    expect(farm.fruit.laranjeira).toBe(def.fruits);
    expect(farm.treeStatus(T.i, T.j, week)!.ripe).toBe(false);
    expect(farm.treeStatus(T.i, T.j, week)!.stage).toBe(2);
    // A second cycle.
    expect(farm.treeStatus(T.i, T.j, week + def.cycleMs)!.ripe).toBe(true);
  });

  it('pays fruit XP and sells fruit from the barn', () => {
    const farm = calm();
    const def = TREES.laranjeira;
    farm.plantTree('laranjeira', T.i, T.j, 0);
    farm.waterTree(T.i, T.j, 0);
    const xp = farm.xp;
    farm.harvestTree(T.i, T.j, def.growMs + def.cycleMs);
    expect(farm.xp - xp).toBe(def.xp * def.fruits);
    const coins = farm.coins;
    expect(farm.sellFruit('laranjeira', Infinity).ok).toBe(true);
    expect(farm.coins - coins).toBe(def.fruits * def.fruitPrice);
    expect(farm.fruit.laranjeira).toBe(0);
  });

  it('gives golden fruit only to rare and epic trees, at roughly the rarity rate', () => {
    const count = (tree: TreeId): number => {
      let golden = 0;
      for (let seed = 0; seed < 400; seed++) {
        const farm = new Farm({ seed, pestChance: 0 });
        farm.xp = levelThreshold(30);
        farm.coins = 1e6;
        farm.buyPomar();
        farm.buySapling(tree, 1);
        farm.plantTree(tree, T.i, T.j, 0);
        const tr = farm.tree(T.i, T.j)!;
        tr.pestAt = null;
        farm.waterTree(T.i, T.j, 0);
        const def = TREES[tree];
        const r = farm.harvestTree(T.i, T.j, def.growMs + def.cycleMs);
        if (r.ok && r.gain.fruit?.golden) golden++;
      }
      return golden;
    };
    expect(count('laranjeira')).toBe(0);
    expect(count('goiabeira')).toBe(0);
    const mango = count('mangueira');
    expect(mango).toBeGreaterThan(15);
    expect(mango).toBeLessThan(70);
    const coco = count('coqueiro');
    expect(coco).toBeGreaterThan(40);
    expect(coco).toBeLessThan(100);
  });

  it('freezes growth under a pest until cared for, and clearing removes the tree without refund', () => {
    const farm = orchardFarm('laranjeira', 1);
    const def = TREES.laranjeira;
    // Force a pest.
    farm.plantTree('laranjeira', T.i, T.j, 0);
    const tree = farm.tree(T.i, T.j)!;
    tree.pestAt = 10 * MIN;
    tree.pestKind = 'bug';
    farm.waterTree(T.i, T.j, 0);
    const ripeAt = def.growMs + def.cycleMs;
    expect(farm.treeStatus(T.i, T.j, 20 * MIN)!.pest).toBe('bug');
    expect(farm.treeStatus(T.i, T.j, ripeAt * 3)!.ripe).toBe(false);
    expect(farm.careTree(T.i, T.j, 40 * MIN).ok).toBe(true);
    expect(farm.careTree(T.i, T.j, 40 * MIN).ok).toBe(false);
    // 10 minutes of growth before the pest, none while it sat there.
    expect(farm.treeStatus(T.i, T.j, 40 * MIN + (ripeAt - 10 * MIN))!.ripe).toBe(true);
    expect(farm.treeStatus(T.i, T.j, 40 * MIN + (ripeAt - 10 * MIN) - 1000)!.ripe).toBe(false);
    const coins = farm.coins;
    expect(farm.clearTree(T.i, T.j).ok).toBe(true);
    expect(farm.coins).toBe(coins);
    expect(farm.tree(T.i, T.j)).toBeNull();
  });
});

describe('economy', () => {
  it('pays more per minute the higher the tree, and rarer fruit costs more', () => {
    const rates = TREE_ORDER.map(coinsPerMinute);
    for (let n = 1; n < rates.length; n++) expect(rates[n]!).toBeGreaterThan(rates[n - 1]!);
    for (const id of TREE_ORDER) {
      const t = TREES[id];
      // Paying the sapling back takes a handful of cycles.
      const cycles = t.saplingCost / (t.fruits * t.fruitPrice);
      expect(cycles).toBeLessThan(3);
    }
  });
});

describe('persistence', () => {
  it('replays to the same state as playing live', () => {
    const live = new Farm({ seed: 21 });
    const base = live.toSnapshot();
    live.xp = levelThreshold(30);
    live.coins = 100_000;
    const start = live.toSnapshot();
    const log: LoggedCommand[] = [];
    const run = (command: Parameters<typeof applyCommand>[1], now: number): void => {
      const r = applyCommand(live, command, now);
      if (r.ok) log.push({ command, now });
    };
    run({ type: 'buyPomar' }, 0);
    run({ type: 'buySapling', tree: 'laranjeira', qty: 2 }, 0);
    run({ type: 'tool', tool: 'semear', i: T.i, j: T.j, crop: 'cenoura', tree: 'laranjeira' }, 1000);
    run({ type: 'tool', tool: 'regar', i: T.i, j: T.j, crop: 'cenoura' }, 2000);
    run({ type: 'tool', tool: 'cuidar', i: T.i, j: T.j, crop: 'cenoura' }, 3000);
    const ripe = 60 * MIN;
    run({ type: 'tool', tool: 'colher', i: T.i, j: T.j, crop: 'cenoura' }, ripe);
    run({ type: 'sellFruit', tree: 'laranjeira', qty: 99 }, ripe + 1000);
    void base;
    const copy = Farm.fromSnapshot(start);
    replay(copy, log);
    expect(copy.toSnapshot()).toEqual(live.toSnapshot());
    expect(live.stats.treesPlanted).toBe(1);
  });

  it('round-trips through a save file', () => {
    const farm = orchardFarm();
    farm.plantTree('laranjeira', T.i, T.j, 5);
    const snap = farm.toSnapshot();
    const text = encodeSave({ playerId: 'p', savedAt: 1, state: snap, sync: { baseline: snap, outbox: [] } });
    const decoded = decodeSave(text);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.save.state).toEqual(snap);
      expect(Farm.fromSnapshot(decoded.save.state).tree(T.i, T.j)).toEqual(farm.tree(T.i, T.j));
    }
  });

  it('loads a v6 save with an empty orchard and a fresh sync history', () => {
    const farm = new Farm({ seed: 9 });
    farm.coins = 777;
    const { pomar, saplings, fruit, trees, ...rest } = farm.toSnapshot();
    void pomar; void saplings; void fruit; void trees;
    const v6 = { ...rest, version: 6 } as LegacySnapshot;
    const loaded = Farm.fromSnapshot(v6);
    expect(loaded.coins).toBe(777);
    expect(loaded.pomar).toBe(false);
    expect(loaded.treeCount()).toBe(0);
    const snap = loaded.toSnapshot() as FarmSnapshot;
    expect(snap.version).toBe(8);
    const text = JSON.stringify({ format: 'lucky-harvest', version: 1, playerId: 'p', savedAt: 1, state: v6, sync: { baseline: v6, outbox: [] } });
    // Without a valid checksum the file is refused, which is the right behaviour for hand-edited saves.
    expect(decodeSave(text).ok).toBe(false);
  });
});

describe('helpers in the orchard', () => {
  const hire = (farm: Farm, id: 'ajudante' | 'gato' | 'regador'): void => {
    expect(applyCommand(farm, { type: 'hireHelper', helper: id }, 0).ok).toBe(true);
  };

  it('the sprinklers water young trees', () => {
    const farm = calm();
    farm.plantTree('laranjeira', T.i, T.j, 0);
    hire(farm, 'regador');
    farm.runHelpers(10 * MIN);
    expect(farm.tree(T.i, T.j)!.watered).toBe(true);
  });

  it('Tonico walks to the orchard and picks ripe fruit', () => {
    const farm = calm();
    const def = TREES.laranjeira;
    farm.plantTree('laranjeira', T.i, T.j, 0);
    farm.waterTree(T.i, T.j, 0);
    hire(farm, 'ajudante');
    const ripeAt = def.growMs + def.cycleMs;
    farm.runHelpers(ripeAt - 1);
    expect(farm.fruit.laranjeira).toBe(0);
    farm.runHelpers(ripeAt + 2 * MIN);
    expect(farm.fruit.laranjeira).toBe(def.fruits);
    expect(farm.stats.farmhandHarvests).toBe(def.fruits);
  });

  it('Mingau cares for a tree with a pest', () => {
    const farm = orchardFarm('laranjeira', 0);
    farm.plantTree('laranjeira', T.i, T.j, 0);
    const tree = farm.tree(T.i, T.j)!;
    tree.pestAt = 5 * MIN;
    tree.pestKind = 'weed';
    hire(farm, 'gato');
    farm.runHelpers(20 * MIN);
    expect(farm.treeStatus(T.i, T.j, 20 * MIN)!.pest).toBeNull();
    expect(farm.stats.catCares).toBe(1);
  });
});
