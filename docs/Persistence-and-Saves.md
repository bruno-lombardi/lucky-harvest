# Persistence and saves

Two pieces: the **format and validation** in `src/core/save.ts` (pure, reusable on a server) and the **browser storage** in `src/persistence.ts` (`SaveManager`).

## Two version numbers

| Version | Where | Meaning |
|---|---|---|
| `SAVE_VERSION` (1) | `save.ts` file envelope | Shape of the file: `{ format, version, checksum, playerId, savedAt, state, sync }` |
| `FarmSnapshot.version` (8) | `farm.ts` | Shape of the farm state inside `state` and `sync.baseline` |

Do not confuse them. Almost all changes are snapshot changes.

## The save file

```
{ format: 'lucky-harvest', version: 1, checksum,
  playerId, savedAt,
  state:  FarmSnapshot,                 // the farm right now
  sync: { baseline: FarmSnapshot,       // the farm as a server last knew it
          outbox: LoggedCommand[] } }   // every successful command since baseline, with its `now`
```

- `checksum` is FNV-1a of the payload. It catches truncated or hand-edited files; it is **not** a security measure (anyone can recompute it).
- `outbox` + `baseline` is the seed of the future sync protocol: replaying the outbox on the baseline reproduces `state`. When the outbox passes 1,500 commands with no server to drain it, `SaveManager.record` folds it into a fresh baseline.
- `decodeSave` validates strictly (`normalizeSnapshot`): wrong types, unknown ids and impossible values make a save fail to load rather than corrupt the game. Unknown crops or species are dropped; missing ones are filled with defaults by `Farm.fromSnapshot`.

## SaveManager (browser)

- Keys: `lucky-harvest:save` and a backup `lucky-harvest:save:prev` (refreshed at most every 60 s). `load()` falls back to the backup if the primary is unreadable and reports `recovered`.
- `startAutosave` writes every 3 s *only when `farm.revision` changed*, and on `visibilitychange`/`pagehide`.
- Storage failures (full, blocked, private mode) never throw: the game keeps running.
- `exportText` / `importText` back the menu's export/import; the page reloads after import or reset.
- Demo and preview farms call `saves.disable()` so they never overwrite a real save.

## Changing the snapshot safely

Rules of thumb that every past change has followed:

1. **Prefer optional fields.** Add `newThing?: ...` to `FarmSnapshot`, default it in `Farm.fromSnapshot` (for example `normalizeBakery(snapshot.bakery)`), and write it in `toSnapshot`. Old saves load unchanged and **no version bump** is needed. The bakery, goods and Tonico's settings were added this way.
2. **Bump the version only when old data must be transformed**, not merely extended. Then: add the new number to `LegacySnapshot`, handle it in `fromSnapshot` (branches are written as `snapshot.version >= N`), accept it in `normalizeSnapshot`, and add a test that loads a hand-built old snapshot.
3. **Always normalise on load.** Clamp numbers, filter unknown ids, coerce booleans (see `normalizeAutoPlant`, `normalizeBakery`, `normalizeStats`). A save is untrusted input, even your own.
4. **Update `toSnapshot` and `cloneX` helpers together.** A field missing from `toSnapshot` silently resets on reload; tests in `tests/save.test.ts` round-trip a rich farm to catch this.
5. **Never store derived or view data** (positions of meshes, queued events).

## What a server changes

Today the client trusts itself. With a server, `state` becomes a cache and the authoritative copy is the server's snapshot plus its command log. See the [Roadmap](Roadmap-Backend-Multiplayer-Social.md) for the sync design and the blockers to fix first.
