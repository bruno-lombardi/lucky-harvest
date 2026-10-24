import { describe, expect, it } from 'vitest';
import { LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { CROP_ORDER } from '../src/core/crops';
import {
  DELIVERY_INTERVAL_MS,
  DELIVERY_SEEDS,
  MAX_CATCHUP_SLOTS,
  rollDelivery,
  slotOf,
  slotTime,
} from '../src/core/delivery';
import { Farm } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { checksumOf, decodeSave } from '../src/core/save';

const total = (seeds: Record<string, number>): number => Object.values(seeds).reduce((a, b) => a + b, 0);
const START = 1_000 * DELIVERY_INTERVAL_MS; // an arbitrary slot boundary

describe('seed delivery', () => {
  it('rolls the same load for the same farm, slot and level', () => {
    expect(rollDelivery(7, 12, 5)).toEqual(rollDelivery(7, 12, 5));
    expect(rollDelivery(7, 12, 5)).not.toEqual(rollDelivery(7, 13, 5));
  });

  it('always brings DELIVERY_SEEDS seeds, starting with cheap staples, and only unlocked crops', () => {
    for (let slot = 0; slot < 200; slot++) {
      const load = rollDelivery(99, slot, 1);
      expect(total(load)).toBe(DELIVERY_SEEDS);
      expect(load.cenoura + load.trigo).toBeGreaterThanOrEqual(2);
      for (const id of CROP_ORDER) if (id !== 'cenoura' && id !== 'trigo') expect(load[id]).toBe(0);
    }
  });

  it('brings pricier crops once they are unlocked', () => {
    const seen = new Set<string>();
    for (let slot = 0; slot < 6000; slot++) {
      const load = rollDelivery(3, slot, 30);
      for (const id of CROP_ORDER) if (load[id] > 0) seen.add(id);
    }
    expect(seen.size).toBe(CROP_ORDER.length);
  });

  it('brings rare seeds far less often than common ones', () => {
    let common = 0;
    let rare = 0;
    for (let slot = 0; slot < 3000; slot++) {
      const load = rollDelivery(11, slot, 30);
      common += load.milho;
      rare += load.pitaya;
    }
    expect(rare).toBeGreaterThan(0);
    expect(rare).toBeLessThan(common / 3); // one rare crop against one common crop
  });

  it('delivers once per five minutes, exactly on the slot', () => {
    const farm = new Farm({ seed: 1, now: START });
    const before = total(farm.seeds);
    farm.runHelpers(START + DELIVERY_INTERVAL_MS - 1);
    expect(total(farm.seeds)).toBe(before);
    farm.runHelpers(START + DELIVERY_INTERVAL_MS);
    expect(total(farm.seeds)).toBe(before + DELIVERY_SEEDS);
    expect(farm.deliveryEvents).toHaveLength(1);
    expect(farm.deliveryEvents[0]!.at).toBe(slotTime(slotOf(START) + 1));
    farm.runHelpers(START + DELIVERY_INTERVAL_MS + 10_000);
    expect(total(farm.seeds)).toBe(before + DELIVERY_SEEDS);
  });

  it('is idempotent: calling many times is the same as calling once', () => {
    const a = new Farm({ seed: 2, now: START });
    const b = new Farm({ seed: 2, now: START });
    for (let t = 0; t <= 20 * 60_000; t += 1_000) a.runHelpers(START + t);
    b.runHelpers(START + 20 * 60_000);
    expect(a.toSnapshot()).toEqual(b.toSnapshot());
  });

  it('leaves at most a few deliveries after a long absence', () => {
    const farm = new Farm({ seed: 3, now: START });
    const before = total(farm.seeds);
    farm.runHelpers(START + 3 * 24 * 3600_000);
    expect(total(farm.seeds)).toBe(before + MAX_CATCHUP_SLOTS * DELIVERY_SEEDS);
  });

  it('rescues a player with no seeds and no coins', () => {
    const farm = new Farm({ seed: 4, now: START });
    farm.coins = 0;
    for (const id of CROP_ORDER) farm.seeds[id] = 0;
    farm.runHelpers(START + DELIVERY_INTERVAL_MS);
    expect(farm.seeds.cenoura + farm.seeds.trigo).toBeGreaterThanOrEqual(2);
  });

  it('survives a save and reload, and old saves still load', () => {
    const farm = new Farm({ seed: 5, now: START });
    farm.runHelpers(START + 2 * DELIVERY_INTERVAL_MS);
    const snapshot = farm.toSnapshot();
    expect(snapshot.version).toBe(6);
    expect(Farm.fromSnapshot(snapshot).toSnapshot()).toEqual(snapshot);

    const { version: _v, deliveredSlot: _d, truck: _t, ...rest } = snapshot;
    const v4 = { ...rest, version: 4 as const };
    const old = Farm.fromSnapshot(v4);
    expect(old.deliveredSlot).toBe(0);
    const { helpers: _h, ...v3rest } = v4;
    expect(Farm.fromSnapshot({ ...v3rest, version: 3 }).toSnapshot().version).toBe(6);
  });

  it('migrates a v4 save file with a fresh sync history', () => {
    const farm = new Farm({ seed: 6, now: START });
    const snapshot = farm.toSnapshot();
    const { version: _v, deliveredSlot: _d, truck: _t, ...rest } = snapshot;
    const v4 = { ...rest, version: 4 };
    const text = JSON.stringify({
      format: 'lucky-harvest',
      version: 1,
      playerId: 'p',
      savedAt: START,
      state: v4,
      sync: { baseline: v4, outbox: [] },
      checksum: '',
    });
    // The checksum must match the payload as written.
    const payload = JSON.stringify({ playerId: 'p', savedAt: START, state: v4, sync: { baseline: v4, outbox: [] } });
    const fixed = text.replace('"checksum":""', `"checksum":"${checksumOf(payload)}"`);
    const decoded = decodeSave(fixed);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.save.state.version).toBe(6);
      expect(decoded.save.sync.outbox).toEqual([]);
      expect(decoded.save.sync.baseline).toEqual(decoded.save.state);
    }
  });

  it('replay equals live play, with deliveries and a helper earning xp in between', () => {
    const seed = 8;
    const live = new Farm({ seed, now: START, pestChance: 0 });
    live.coins = 5000;
    live.xp = levelThreshold(5);
    const baseline = live.toSnapshot();
    const log: LoggedCommand[] = [];
    const run = (t: number, command: Parameters<typeof applyCommand>[1]): void => {
      const r = applyCommand(live, command, START + t);
      if (r.ok) log.push({ command, now: START + t });
    };

    run(1_000, { type: 'hireHelper', helper: 'ajudante' });
    run(2_000, { type: 'buySeeds', crop: 'cenoura', qty: 3 });
    // The browser keeps advancing the farm every frame, like the render loop.
    for (let t = 2_000; t <= 14 * 60_000; t += 500) live.runHelpers(START + t);
    run(14 * 60_000, { type: 'sellAll' });
    run(14 * 60_000 + 1, { type: 'buySeeds', crop: 'trigo', qty: 1 });

    const server = Farm.fromSnapshot(baseline);
    replay(server, log);
    server.runHelpers(START + 14 * 60_000 + 1);
    live.runHelpers(START + 14 * 60_000 + 1);
    expect(server.toSnapshot()).toEqual(live.toSnapshot());
  });
});

describe('truck upgrades', () => {
  const T0 = 1_700_000_000_000;
  const rich = (): Farm => {
    const farm = new Farm({ seed: 5, now: T0 });
    farm.coins = 100_000;
    farm.xp = levelThreshold(25);
    return farm;
  };

  it('are gated by level and coins and bought once', () => {
    const farm = new Farm({ seed: 5, now: T0 });
    expect(farm.upgradeTruck('big', T0)).toEqual({ ok: false, reason: 'truck-locked' });
    farm.xp = levelThreshold(10);
    expect(farm.upgradeTruck('big', T0)).toEqual({ ok: false, reason: 'no-coins' });
    farm.coins = 5000;
    expect(farm.upgradeTruck('big', T0).ok).toBe(true);
    expect(farm.upgradeTruck('big', T0)).toEqual({ ok: false, reason: 'max-level' });
  });

  it('a bigger load brings more seeds', () => {
    const farm = rich();
    farm.upgradeTruck('big', T0);
    const before = Object.values(farm.seeds).reduce((a, b) => a + b, 0);
    farm.runHelpers(T0 + DELIVERY_INTERVAL_MS);
    const after = Object.values(farm.seeds).reduce((a, b) => a + b, 0);
    expect(after - before).toBe(10);
  });

  it('a faster truck comes every four minutes', () => {
    const farm = rich();
    farm.upgradeTruck('fast', T0);
    const slots = farm.deliveredSlot;
    farm.runHelpers(T0 + 12 * 60 * 1000 + 1);
    expect(farm.deliveredSlot - slots).toBeGreaterThanOrEqual(3);
    expect(farm.toSnapshot().truck).toEqual({ big: false, fast: true });
  });

  it('replays to the same state through commands', () => {
    const a = rich();
    const log: LoggedCommand[] = [{ command: { type: 'upgradeTruck', upgrade: 'fast' }, now: T0 + 1000 }];
    const base = a.toSnapshot();
    const live = Farm.fromSnapshot(base);
    for (const e of log) applyCommand(live, e.command, e.now);
    const again = Farm.fromSnapshot(base);
    replay(again, log);
    expect(again.toSnapshot()).toEqual(live.toSnapshot());
  });
});
