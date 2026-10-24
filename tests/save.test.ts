import { describe, expect, it } from 'vitest';
import { LoggedCommand, applyCommand, replay } from '../src/core/commands';
import { Farm } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { SaveData, decodeSave, encodeSave } from '../src/core/save';
import { createDemoFarm } from '../src/demo';
import { SaveManager } from '../src/persistence';

function playedFarm(): { data: SaveData; farm: Farm } {
  const farm = new Farm({ seed: 321 });
  farm.xp = levelThreshold(7);
  farm.coins = 4000;
  const baseline = farm.toSnapshot();
  const outbox: LoggedCommand[] = [];
  const run = (command: LoggedCommand['command'], now: number): void => {
    if (applyCommand(farm, command, now).ok) outbox.push({ command, now });
  };
  run({ type: 'tool', tool: 'arar', i: 9, j: 9, crop: 'cenoura' }, 0);
  run({ type: 'tool', tool: 'semear', i: 9, j: 9, crop: 'trigo' }, 10);
  run({ type: 'buildPen', species: 'galinha' }, 20);
  run({ type: 'buyAnimal', species: 'galinha' }, 30);
  run({ type: 'buyFeed', species: 'galinha', qty: 1 }, 40);
  run({ type: 'feed', species: 'galinha', animalId: 1 }, 50);
  return { farm, data: { playerId: 'abc123', savedAt: 999, state: farm.toSnapshot(), sync: { baseline, outbox } } };
}

describe('save files', () => {
  it('round-trip exactly, and the outbox replays to the saved state', () => {
    const { data } = playedFarm();
    const decoded = decodeSave(encodeSave(data));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.save.state).toEqual(data.state);
    expect(decoded.save.playerId).toBe('abc123');

    const replica = Farm.fromSnapshot(decoded.save.sync.baseline);
    replay(replica, decoded.save.sync.outbox);
    expect(replica.toSnapshot()).toEqual(decoded.save.state);
  });

  it('keeps the whole demo farm intact, animals included', () => {
    const demo = createDemoFarm(1_000_000);
    const snapshot = demo.toSnapshot();
    const decoded = decodeSave(encodeSave({ playerId: 'x', savedAt: 1, state: snapshot, sync: { baseline: snapshot, outbox: [] } }));
    expect(decoded.ok && decoded.save.state).toEqual(snapshot);
  });

  it('rejects garbage, other files, tampering and truncation with a readable message', () => {
    const { data } = playedFarm();
    const text = encodeSave(data);
    for (const bad of ['', 'not json', '{}', '{"format":"other"}', text.slice(0, text.length - 20)]) {
      const result = decodeSave(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(5);
    }
    const cheated = text.replace('"coins":4000', '"coins":9999999');
    expect(cheated).not.toBe(text);
    expect(decodeSave(cheated).ok).toBe(false);
  });

  it('refuses structurally invalid farms even with a matching checksum', () => {
    const { data } = playedFarm();
    const broken = { ...data, state: { ...data.state, coins: -5 } };
    expect(decodeSave(encodeSave(broken)).ok).toBe(false);
    const badTile = { ...data, state: { ...data.state, tiles: { 'x,y': { kind: 'soil', crop: null } } } };
    expect(decodeSave(encodeSave(badTile as unknown as SaveData)).ok).toBe(false);
  });
});

/** A minimal in-memory Storage, so SaveManager runs under node. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('SaveManager', () => {
  it('saves only when something changed, and loads the same farm back', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager(storage);
    expect(first.load()).toBeNull();

    const farm = new Farm({ seed: 5, pestChance: 0 });
    first.attach(farm);
    expect(first.save(1000)).toBe(false); // untouched
    const command = { type: 'tool', tool: 'arar', i: 9, j: 9, crop: 'cenoura' } as const;
    expect(applyCommand(farm, command, 1000).ok).toBe(true);
    first.record(command, 1000);
    expect(first.save(2000)).toBe(true);
    expect(first.save(3000)).toBe(false);

    const second = new SaveManager(storage);
    const loaded = second.load();
    expect(loaded?.savedAt).toBe(2000);
    expect(loaded?.recovered).toBe(false);
    expect(loaded?.farm.toSnapshot()).toEqual(farm.toSnapshot());
  });

  it('falls back to the backup when the main save is damaged, and never writes in demo mode', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const farm = new Farm({ seed: 5, pestChance: 0 });
    manager.attach(farm);
    farm.xp = 100;
    farm.plow(9, 9);
    manager.save(1_000_000); // writes main
    farm.plow(10, 9);
    manager.save(1_200_000); // rotates main into the backup, then overwrites main
    storage.setItem('lucky-harvest:save', '{broken');

    const recovered = new SaveManager(storage).load();
    expect(recovered?.recovered).toBe(true);
    expect(recovered?.farm.tile(9, 9).kind).toBe('soil');

    const demo = new SaveManager(new MemoryStorage());
    demo.attach(farm);
    demo.disable();
    expect(demo.save(5, true)).toBe(false);
  });

  it('exports text that imports back, and rejects bad imports without touching the save', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    manager.attach(new Farm({ seed: 8 }));
    const text = manager.exportText(77);

    const other = new SaveManager(storage);
    expect(other.importText('nope').ok).toBe(false);
    expect(storage.getItem('lucky-harvest:save')).toBeNull();
    expect(other.importText(text).ok).toBe(true);
    expect(other.load()?.savedAt).toBe(77);
  });
});
