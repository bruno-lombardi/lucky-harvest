# Roadmap: backend, multiplayer and social

This page is a plan, not a promise. It starts from what the code can already do, lists what must be fixed first (found by reading the code and, for blocker 1, reproducing it), and then proposes phases. Sizes are relative (S/M/L), not calendar estimates.

## Where we are

Strengths to build on:

- **Deterministic rules in a pure module.** `src/core` has no DOM, Three.js, clock or `Math.random`, so it can run in Node on a server unchanged.
- **Every action is a serialisable `Command`**, applied through one function, `applyCommand(farm, command, now)`.
- **The save file already carries a sync log:** `sync.baseline` (a snapshot) plus `sync.outbox` (commands with timestamps). Replaying the outbox on the baseline is tested to reproduce the state.
- **Views are read-only** and take a `Farm`, which is what a "visit a neighbor" mode needs.
- **Validation on load** (`normalizeSnapshot`) already treats saves as untrusted input.

What does *not* exist yet: any network code, accounts, a server-side clock, cross-farm operations, or a way to show a farm that is not the player's own.

## Blockers to fix first

### Blocker 1: offline cap depends on tick cadence

`Farm.runHelpers(now)` skips helper clocks forward when they are more than 30 minutes behind `now` (the offline cap), and limits seed-truck catch-up to 6 slots. The check uses the `now` of the *call*. A client with the tab open calls it every frame and never skips; a server replaying commands that are hours apart calls it once and skips. Result: the same player history yields different farms.

Reproduced in `tests/known-issues.test.ts` (an `it.fails` test: farm A is ticked every second for 3 h, farm B once at +3 h; coins differ).

Fix options:

| Option | Idea | Trade-off |
|---|---|---|
| A. Server-style ticks | Define a canonical cadence: `runHelpers` always advances in steps of at most N minutes (for example 10), so one call over 3 h is identical to many small ones | Simple, but must be applied to every call site and still ignores whether the player was really present |
| **B. Presence-based cap (recommended)** | Add `farm.lastSeenAt`, advanced by a logged `heartbeat` command (client sends one at most every ~5 min while the tab is visible and on resume). The cap is `now - lastSeenAt` instead of "how long since this call" | Replays exactly, models "was the player here" honestly, and gives the server a natural anti-idle signal. Needs a new command and a snapshot field (optional, no version bump) |
| C. Remove the cap | Helpers work while you are away, forever | Changes the game's economy and removes a pacing guardrail |

Whichever is chosen, flip the `it.fails` test to a normal `it`, and add a replay test that replays a log with multi-hour gaps.

### Blocker 2: the client decides what time it is

Commands carry `now` from `Date.now()`. A server must not trust it blindly (a cheater could claim a crop ripened). Define the rule now: the server stamps commands with its own clock, or accepts a client `now` only if `lastServerNow <= now <= serverNow + skew`, and non-decreasing within a batch. The rules code needs no change, only the sync layer.

### Blocker 3: the client creates the random seed

`new Farm()` picks `seed` with `Math.random()` and stores it in the snapshot. Pest and golden-harvest rolls derive from `seed`, `revision` and coordinates, so a client that controls its seed can pre-compute outcomes. With a server, the server must assign the seed at account creation and ignore a client-supplied one.

### Blocker 4: `main.ts` assumes one farm

`main.ts` is a composition root with module-level singletons (`farm`, `game`, dialogs). Visiting someone else's farm, or even switching accounts, needs these in a `Session` object that can be created for any `Farm` and any mode (`owner` or `visitor`). This is a refactor, not a rewrite: most of `main.ts` is already functions over `farm`.

### Blocker 5: cross-farm rules do not exist

Everything in `Farm` is about one player. Gifts, stealing and trading change two farms and need a place where both changes are decided together, which can only be a server. See "Cross-farm operations" below.

### Smaller items

- `Farm` is about 1,400 lines in one class. It works, but a server team will want it split by area (crops, pens, helpers, bakery, orchard) behind the same `Farm` facade before more features land.
- Add `seq` (per-farm command counter) to `LoggedCommand` for idempotent retries.
- The outbox is capped at 1,500 commands and then folded into the baseline; with a server, drain it on acknowledgement instead.
- Snapshot size grows with the number of tiles and stats; fine for now, but measure before syncing whole snapshots often.

## Phase plan

### Phase 0: hygiene (S to M, no new features)

1. Fix blocker 1 (option B) and its tests.
2. Move `core` and `save.ts` into a package both the web app and a server can import. The simplest route is npm workspaces: `packages/core`, `apps/web`, `apps/server`.
3. Introduce a `Session` in the client (blocker 4) with an `owner` mode only.
4. Add `seq` to `LoggedCommand`; add a protocol version constant.
5. Extend the pace simulator (`tests/support/pace-bot.ts`) to include the bakery and helpers, so economy changes are checked before real players share a market.

### Phase 1: server authority, single player (L)

Goal: the browser stops being the authority, with no new social features yet.

- **Auth:** anonymous device id first (what `playerId` already is), upgrade to an account later (Google/Apple/e-mail) so the same farm opens on a phone and a laptop.
- **Storage:** per farm, the latest snapshot (JSON) plus an append-only command log with `seq`, `now`, the command and its result. A relational database with a JSON column is enough.
- **Sync protocol (HTTP first, WebSocket later):**
  1. Client keeps playing offline-first exactly as now, appending to `outbox`.
  2. `POST /sync { farmId, baselineSeq, commands: [{seq, now, command}] }`.
  3. Server loads the farm at `baselineSeq`, validates each command (clock rule, rate limit, batch size), applies it with the shared `applyCommand`, and stores the accepted ones.
  4. Response: `{ acceptedUpTo, rejected: [{seq, reason}], snapshot, serverNow }`.
  5. Client adopts `snapshot` as its new baseline, drops acknowledged commands, and **re-applies any remaining or rejected-then-fixed commands on top** (rejected commands are dropped and the player sees a short message).
- **Conflicts between devices:** the server's log is the single order of truth; the second device to sync rebases onto it. Because rules are deterministic, "rebase" is just replay.
- **Anti-cheat stance:** the server never trusts `gain` or state from the client, only commands. It replays them. Cheating is then limited to what the rules allow (and to botting, handled by rate limits).
- **Offline play stays supported**, which is a product strength; the server only validates after the fact.

### Phase 2: asynchronous social (M to L)

All of these work with a request/response server and no live connections.

- **Profiles and leaderboards:** level, coins earned, achievements (all derivable from `stats` and `claimed`). Cheap and motivating.
- **Friends:** invite link or code; a friends list.
- **Visiting a neighbor (read-only):** fetch the neighbor's snapshot plus the server's `now`, build a `Farm` with `Farm.fromSnapshot`, and show it with the same views in `visitor` mode (no dispatch, a different toolbar: "greet", "water a crop", "leave a gift"). Because growth is a function of `now`, the neighbor's farm looks correct without any simulation on the server.
- **Gifts:** see below.
- **Notifications:** "Dona Zefa finished a cake" via web push once the PWA exists (roadmap item 9 in the README).

### Phase 3: live features (L)

WebSocket presence ("João is on the farm"), co-op events (a shared community crop or a town fair with a goal), chat or emotes with moderation. Do this only after phases 1 and 2 are stable; most of the value of a farm game is asynchronous.

## Cross-farm operations (gifts, help, stealing, trading)

The single hardest design question, so decide it deliberately:

- **One ordered log per farm, authored by the server.** Client commands are *proposals*; the server appends them. Server-originated events (a gift arrived, a crop was stolen) are appended to the *receiver's* log as commands with an `origin: 'server'` marker, and every client applies them like any other command. This keeps the rules deterministic and replayable on both sides.
- **Gifts:** sender submits `giftItem { to, item, qty }`. Server atomically debits the sender (a normal command on their log) and appends `receiveGift { from, item, qty }` to the receiver's log. Add rate and daily limits and the same level restrictions as the shop, to prevent alt-account farming.
- **Helping a neighbor:** `waterNeighbor { to, i, j }`. The server checks the target tile in the neighbor's farm at server `now` and records the effect as a server command on the neighbor's log, plus a small reward for the helper.
- **Stealing (if wanted):** must be resolved on the server against the victim's state at server time, with game-design guard rails: only ripe crops, a per-crop cap, a protection window after being stolen from, a daily limit per thief, and a defence tie-in (Rex or Mingau as guards, a scarecrow) so it is a game and not a griefing tool. Consider "borrowing" or "helping yourself to a share that the owner can still harvest in full" as a friendlier variant. Decide this with players in mind before building it.
- **Trading and a market:** server-side listings with a fee and price bounds, never direct client-to-client transfers. Model the economy first (the pace simulator extended with a market) because trade can break balance quickly.

## Data model sketch

```
accounts(id, created_at, display_name, locale)
devices(id, account_id)                           -- anonymous device ids map to an account
farms(id, account_id, seed, snapshot jsonb, snapshot_seq, updated_at)
farm_commands(farm_id, seq, origin, now, command jsonb, result jsonb)   -- append-only
friendships(a_id, b_id, status)
gifts(id, from_farm, to_farm, item jsonb, created_at, claimed_seq)
leaderboard_entries(farm_id, metric, value, updated_at)   -- derived from snapshots
```

Take a snapshot every N commands so loading a farm is `snapshot + short tail`.

## Client changes needed along the way

- `Session` object (see blocker 4); `owner` and `visitor` modes; a read-only `Farm` view type for visitors.
- A sync module beside `src/persistence.ts` (`SyncManager`), with states `offline`, `syncing`, `behind`, `conflict`, and a small status indicator in the HUD.
- Dialogs for friends, profile, mailbox. They follow the normal pattern: subclass `Modal`, render HTML from state, dispatch commands. If any of them show player-chosen text, escape it (see [UI and audio](UI-and-Audio.md)).
- Localisation: UI text is spread across `messages.ts`, `info.ts` and the data tables. Before adding English, centralise strings behind a lookup, since social features will bring users who do not read Portuguese.

## Content roadmap (what the architecture makes cheap)

- **PWA** (installable, offline cache): the game is already offline-first; this is mostly a manifest and a service worker.
- **More buildings in the Confeitaria mould:** a dairy for butter and cheese, a mill, a sawmill. The recipe is in [How to add content](How-To-Add-Content.md#a-new-building-with-its-own-dialog-the-confeitaria-is-the-template).
- **Seasons and weather:** `DayNight` keyframes plus a core rule that modifies growth multipliers; deterministic if derived from the wall clock.
- **Events and daily quests:** goals are already data; add a time window and a `claimQuest` command.
- **Cosmetics as medal rewards:** the achievements system already tracks medals; rewards are coins plus a few fertilizers today.
- **Premium currency:** fertilizers are deliberately reward-only (level-ups, medals) so they can become the first premium-currency purchase without breaking the coin economy: give `FertilizerDef` a premium price and a shop entry, and keep `ms` as the tuning knob. Decide first whether premium items may be gifted to neighbors, since a gift is a cross-farm operation (see below). Orchard-tree fertilizing and "fertilize the whole field" are natural follow-ups.
- **More species and crops:** pure data plus a model each; always run the pace test.

## Risks and open questions

- **Cheating tolerance.** Offline-first means a modified client can still cheat *offline*; with phase 1 the server replays and corrects it. Decide whether leaderboards are only server-verified farms.
- **Cost and hosting.** A tiny Node service and a database are enough for a hobby scale; the Pages deploy stays for the client.
- **Privacy and law.** Brazilian users: LGPD applies once you store accounts. Collect the minimum (no real names), offer deletion and export (the save-file export already exists).
- **Moderation.** Any player-visible text (names, chat) needs filtering and reporting; the safest first version has neither (preset emotes, generated names).
- **Schema evolution.** Client and server must agree on `FarmSnapshot.version` and a protocol version; the server should refuse to sync old clients with a "please update" message instead of misinterpreting commands.
- **Balance with a shared economy.** Goods multiply income; verify with the extended pace bot before any market exists.
- **Time zones and day length.** The day/night cycle is purely visual (8 real minutes); keep it out of the rules, or the server must simulate it too.

## Suggested next steps, in order

1. Fix blocker 1 with option B and flip the known-issues test.
2. Split into workspaces and extract a `Session` in the client.
3. Build the Phase 1 server with `/sync`, then migrate the existing save to it (the outbox format already matches).
4. Ship leaderboards and read-only visiting as the first social features: high delight, no cross-farm writes.
5. Only then design gifts and helping with the one-log-per-farm model above, and decide about stealing with the community.
