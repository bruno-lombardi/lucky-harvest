/**
 * @module persistence
 *
 * `SaveManager`: everything that touches `localStorage` (save, rolling backup, autosave, import/export, reset). The file format and the
 * validation are in src/core/save.ts, so a server can share them.
 *
 * The save carries `sync.baseline` + `sync.outbox` (every successful command since the baseline). Nothing sends them anywhere yet.
 *
 * NEXT(backend): add a `SyncManager` beside this class: POST the outbox, adopt the server snapshot as the new baseline, drop acknowledged
 *   commands and re-apply the rest. Give `LoggedCommand` a `seq` for idempotent retries. The outbox cap (`MAX_OUTBOX`) then becomes
 *   "drain on acknowledgement". Design in docs/Roadmap-Backend-Multiplayer-Social.md.
 */

import { Command, LoggedCommand } from './core/commands';
import { Farm, FarmSnapshot } from './core/farm';
import { DecodeResult, SaveData, decodeSave, encodeSave } from './core/save';

const KEY = 'lucky-harvest:save';
const PREV_KEY = 'lucky-harvest:save:prev';
/** When the outbox grows past this with no server to drain it, fold it into the baseline. */
const MAX_OUTBOX = 1500;
const BACKUP_EVERY_MS = 60_000;

function newPlayerId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Loaded {
  farm: Farm;
  savedAt: number;
  /** True when the primary save was unreadable and the backup was used. */
  recovered: boolean;
}

/**
 * Browser persistence. Everything that touches localStorage lives here; the format and the rules
 * are in src/core, so a server can share them.
 */
export class SaveManager {
  private farm: Farm | null = null;
  /** Random per device today. NEXT(backend): becomes the anonymous device id that an account can later adopt. */
  private playerId = newPlayerId();
  private baseline: FarmSnapshot | null = null;
  private outbox: LoggedCommand[] = [];
  private savedRevision = -1;
  private lastBackup = 0;
  private lastSavedAt = 0;
  private enabled = true;

  constructor(private readonly storage: Storage | null = safeStorage()) {}

  get lastSaved(): number {
    return this.lastSavedAt;
  }

  /** Demo and preview farms are never written over the player's real save. */
  disable(): void {
    this.enabled = false;
  }

  /** Reads the save (falling back to the backup). Returns null for a first-time player. */
  load(): Loaded | null {
    if (!this.storage) return null;
    for (const [key, recovered] of [[KEY, false], [PREV_KEY, true]] as const) {
      const text = this.storage.getItem(key);
      if (!text) continue;
      const decoded = decodeSave(text);
      if (!decoded.ok) continue;
      const { save } = decoded;
      this.playerId = save.playerId;
      this.baseline = save.sync.baseline;
      this.outbox = save.sync.outbox;
      this.lastSavedAt = save.savedAt;
      return { farm: Farm.fromSnapshot(save.state), savedAt: save.savedAt, recovered };
    }
    return null;
  }

  /** Starts tracking a farm (new or loaded). Call once, before the first command. */
  attach(farm: Farm): void {
    this.farm = farm;
    this.baseline ??= farm.toSnapshot();
    this.savedRevision = farm.revision;
  }

  /** Records a successful command so it can be replayed or sent to a server later. */
  record(command: Command, now: number): void {
    this.outbox.push({ command, now });
    if (this.outbox.length > MAX_OUTBOX && this.farm) {
      this.baseline = this.farm.toSnapshot();
      this.outbox = [];
    }
  }

  /** Writes the save if anything changed since the last write (or always with `force`). */
  save(now: number, force = false): boolean {
    const farm = this.farm;
    if (!this.enabled || !this.storage || !farm || !this.baseline) return false;
    if (!force && farm.revision === this.savedRevision) return false;
    const text = encodeSave(this.snapshotData(now));
    try {
      if (now - this.lastBackup > BACKUP_EVERY_MS) {
        const previous = this.storage.getItem(KEY);
        if (previous) this.storage.setItem(PREV_KEY, previous);
        this.lastBackup = now;
      }
      this.storage.setItem(KEY, text);
    } catch {
      return false; // storage full or blocked: keep playing, try again next time
    }
    this.savedRevision = farm.revision;
    this.lastSavedAt = now;
    return true;
  }

  /** Saves on a timer and whenever the page is hidden or closed. */
  startAutosave(clock: () => number = Date.now): void {
    const flush = (): void => void this.save(clock());
    window.setInterval(flush, 3000);
    document.addEventListener('visibilitychange', () => document.hidden && flush());
    window.addEventListener('pagehide', flush);
  }

  /** The save as a downloadable file. */
  exportText(now: number): string {
    return encodeSave(this.snapshotData(now));
  }

  /** Replaces the save with an imported file. The caller reloads the page afterwards. */
  importText(text: string): DecodeResult {
    const decoded = decodeSave(text);
    if (decoded.ok && this.storage) {
      this.storage.setItem(PREV_KEY, this.storage.getItem(KEY) ?? text);
      this.storage.setItem(KEY, text);
    }
    return decoded;
  }

  /** Deletes the save (the caller reloads to start fresh). */
  reset(): void {
    this.enabled = false;
    this.storage?.removeItem(KEY);
    this.storage?.removeItem(PREV_KEY);
  }

  private snapshotData(now: number): SaveData {
    return {
      playerId: this.playerId,
      savedAt: now,
      state: this.farm!.toSnapshot(),
      sync: { baseline: this.baseline!, outbox: this.outbox },
    };
  }
}

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem('lucky-harvest:probe', '1');
    s.removeItem('lucky-harvest:probe');
    return s;
  } catch {
    return null;
  }
}
