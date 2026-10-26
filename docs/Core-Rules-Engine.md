# Core rules engine (`src/core`)

Everything that decides *what happens* lives here. The folder has no dependency on Three.js, the DOM, `Date.now()` or `Math.random`, so it runs unchanged in Node (tests, a future server) and in the browser.

## Module map

| File | What it holds |
|---|---|
| `farm.ts` | The `Farm` class: all state and all rules (plow, plant, water, harvest, shop, pens, helpers, bakery, orchard, snapshots). The biggest file, about 1,400 lines |
| `commands.ts` | The `Command` union, `applyCommand`, `replay`, `LoggedCommand` |
| `actions.ts` | The seven tools (`colher arar semear regar cuidar limpar adubar`) mapped to `Farm` methods; routes orchard tiles to tree rules |
| `fertilizer.ts` | Fertilizers (adubos): the four tiers, the level-up gift table, gift helpers. Data only; the rule is `Farm.fertilize` |
| `crops.ts` | `CROPS` table, rarities, growth and price data |
| `trees.ts` | Orchard (the *Pomar*): tree species, growth cycle, fruit |
| `animals.ts` | Species, pens, feed recipes, products, animal cycle |
| `helpers.ts` | Helper definitions (wages, levels, routes) and pure path/pose maths |
| `autoplant.ts` | Settings for Tonico's level-4 planting and the seed-choice logic |
| `goods.ts` | Confeitaria recipes, bakery tiers, ingredient maths |
| `barn.ts` | Barn tiers and the helper buffs they give |
| `delivery.ts` | The seed truck: slot clock and the seeded draw of what it brings |
| `decor.ts` | Decorations (pure cosmetics that cost coins) |
| `progress.ts` | Goals (*Metas*) and achievements (*Conquistas*) as data plus pure "is it done" functions |
| `stats.ts` | Lifetime counters used by goals and achievements |
| `levels.ts` | XP curve (`25 * (level-1) * level`, max level 50) |
| `grid.ts` | Tile ↔ world coordinates (the grid is 24×24 and centred on the origin) |
| `noise.ts` | `mulberry32` PRNG, `hashUnit`, value noise; deterministic helpers |
| `save.ts` | Save file encode/decode, versioning, checksum |

## Fertilizers (adubos)

A consumable that skips a **fixed** number of milliseconds of a growing crop's time: Esterco curtido 10 min, Composto da Dona Zefa 30 min, Húmus de minhoca 1 h, Poeira de lua 2 h (the Luz da lua growth time, a test pins that). They are **never sold**; they only arrive as gifts:

- **Level-ups** (`levelGift` in `fertilizer.ts`, paid inside `Farm.done`, so a helper's harvest that crosses a level pays too): from level 3 an Esterco per level; a Composto instead on every 5th; plus a Húmus on every 10th; plus a Poeira de lua at 25 and 50. Through level 50 that is 38 Esterco, 10 Composto, 5 Húmus, 2 Poeira de lua.
- **Achievement medals** (`gifts` on an `Achievement`, paid by `Farm.claim`): the Lavoura set follows a ladder (bronze 3 Esterco, silver 2 Composto, gold 2 Húmus), the harder ones a richer ladder, and a few special achievements carry one (Fruta de ouro and Mestre da fazenda give Poeira de lua). Goals (*Metas*) give coins only.

`Farm.fertilize(i, j, id, now)` refuses (spending nothing) a thirsty crop (`not-watered`: its growth is capped at half, so the dose would be wasted), a pest-frozen one (`pest-active`), a ripe one (`already-ripe`), a withered one, and an empty tile. It re-anchors the crop, adds the time (never past ripe) and moves a pest still to come earlier by the same share of the remaining growth, so it still strikes at the same point; a crop that ripens on the spot outruns its pest. The command is `{ type: 'tool', tool: 'adubar', ..., fertilizer }`. Orchard trees are not fertilizable yet (`NEXT(content)` in `actions.ts`).

State: `Farm.fertilizer` (saved as an optional `fertilizer` field, no version bump), `stats.fertilized`. Tests: `tests/fertilizer.test.ts`.

## Determinism: the one rule

> The result of a command depends only on **(farm state, command, `now`)**.

Consequences you must respect when editing `core`:

- Never call `Date.now()`, `performance.now()` or `Math.random()`. Take `now` as a parameter. For randomness use `hashUnit(farm.seed, farm.revision, ...salts)` from `noise.ts`; it is a stateless hash, so the same inputs always give the same draw.
- Do not iterate over unordered collections when order affects the outcome. `Map` iteration order is insertion order, which is deterministic as long as inserts happen in the same order.
- Every state change must go through a path that bumps `revision` (`done()` for player actions; helper steps bump it themselves). `revision` is part of the random stream, so skipping it changes later outcomes.
- Anything the screen needs but the rules do not (helper speech bubbles, delivery toasts) goes into `helperEvents` / `deliveryEvents`, never into saved state.

Tests that prove it: `replay` equality in `tests/save.test.ts`, `tests/animals.test.ts`, `tests/helpers.test.ts`, `tests/planter.test.ts`, `tests/bakery.test.ts`.

### Known gap in determinism

Catch-up of *very long gaps* currently depends on how often `runHelpers` is called. See "Offline cap and tick cadence" below and the [Roadmap](Roadmap-Backend-Multiplayer-Social.md#blocker-1-offline-cap-depends-on-tick-cadence). Fix this before building a server.

## Time model: anchors, not timers

A planted crop stores `plantedAt`, `anchorAt`, `anchorGrowth`:

- `anchorGrowth` is how many ms of growth the crop had at `anchorAt`.
- Growth at any later `now` is `anchorGrowth + (now - anchorAt)`, capped.
- **Thirst:** an unwatered crop caps at half of `growthMs`. Watering *re-anchors* (freezes the growth so far into the anchor) and removes the cap.
- **Pests:** a pest appears at `pestAt`; growth stops from then until `care()` re-anchors and clears it.
- **Withering:** a crop that has been ripe or stalled longer than `witherMs` withers.

So `Farm.status(i, j, now)` is a pure calculation; nothing ticks. That is why a reloaded page, a day-long absence and a replay on a server all agree. Trees (`trees.ts`) and animals (`animals.ts`) use the same idea with their own cycles.

## Commands

`Command` (in `commands.ts`) is a discriminated union, one member per player intent: `tool`, `buySeeds`, `sellCrop`, `upgradePen`, `hireHelper`, `bake`, `claimGoal`, … `applyCommand(farm, command, now)`:

1. calls `farm.runHelpers(now)` so background work up to `now` is applied first;
2. dispatches on `command.type` to a `Farm` method (a `switch` with no default, so TypeScript errors when a new command type is not handled);
3. returns `ActionResult`: `{ ok: true, gain }` or `{ ok: false, reason }`. Failed commands change nothing and are not logged.

`gain` (`{ coins, xp, levelUp, item?, product?, fruit? }`) exists for feedback only: floating numbers, sounds, toasts.

## Helpers and the seed truck: one timeline

`Farm.runHelpers(now)` is the engine for everything that happens without the player:

- **Sprinklers** (`regador`) pulse on an interval and water every thirsty crop and young tree near their heads (`sprinklerSpots` covers the plot in thirds by level).
- **Walkers** (`ajudante` Tonico, `gato` Mingau, `cao` Rex, `tratador` Lúcia) follow a state machine: pick a target, walk a route (`route`, `walkerPose`), act on arrival (`walk()`), repeat. Tonico at level 4 also plows, sows and waters according to `AutoPlant` settings.
- **Wages** are charged every `WAGE_PERIOD_MS` (10 min) by `payday()`; if coins run out the helper stops (`paid = false`).
- **The seed truck** delivers on a wall-clock grid: slot *k* arrives at `k * interval` (5 min, or 4 with the upgrade). What it brings is `rollDelivery(seed, slot, level, seeds)`.

The loop picks the earliest due event across all helpers and the truck, applies it at its own timestamp, and repeats until nothing is due before `now`. Helpers and deliveries therefore see each other's effects in the correct order no matter when the loop was called. (This is the property that makes the engine replayable. The exception is the offline cap below.)

### Offline cap and tick cadence

To stop a player coming back after a week to a farm that ran for a week, `runHelpers` skips helper clocks forward when `earliest event < now - OFFLINE_LIMIT_MS` (30 min). Likewise the truck leaves at most `MAX_CATCHUP_SLOTS` (6) deliveries.

The catch: the skip is evaluated against *the `now` of the call*. A browser tab that stays open calls it every frame, so it never skips; a replay that only sees commands 3 hours apart calls it once and skips. The two end in different states (reproduced in `tests/known-issues.test.ts`). Until fixed, the client and a replaying server can disagree after any idle gap longer than 30 minutes.

## Progression data

- `progress.ts` defines goals as `{ id, chapter, text, hint, reward, value(farm), target, point }` and achievements via a `tiered(...)` helper (bronze/silver/gold steps). `value` is a pure function of `Farm`, so the UI never decides whether something is done.
- Claiming is a command (`claimGoal`, `claimAchievement`); claimed ids are stored in `farm.claimed`.
- `stats.ts` counters are bumped *inside* the `Farm` methods that cause them, so replaying commands reproduces them.

## Economy and balance

- Crop prices and times are in `crops.ts`; `tests/pace.test.ts` runs a simulated casual player (`tests/support/pace-bot.ts`) and asserts how long levels 8, 12 and 20 take (about 45 min, 2 h, 8 h). When you change prices, run it first; it is the early-warning system for balance.
- Animal products, feed, helper wages, barn buffs, and bakery markups are tuned per table. Finished goods pay `markup` over their ingredients (see `goods.ts`).
- Wages and costs are scaled by `barnTier(barn).costMul`; walking and working speed by `speedMul`.

## Snapshots

`Farm.toSnapshot()` returns a plain-JSON `FarmSnapshot` (currently `version: 8`); `Farm.fromSnapshot()` rebuilds a farm, upgrading older versions. See [Persistence and saves](Persistence-and-Saves.md) for the rules about adding fields.
