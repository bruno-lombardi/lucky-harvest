# How to add content

Step-by-step recipes, each based on how the existing features were built. The TypeScript compiler is your checklist: most tables are keyed by an id union, so a missing entry is a compile error. After any change run `npm test && npm run typecheck`, then look at the result with `?demo` (see [Testing and tooling](Testing-and-Tooling.md)).

## A new crop

1. `src/core/crops.ts`: add the id to the `CropId` union, add an entry to `CROPS`, and add the id to `CROP_ORDER` at the right place. Set `shape` to an existing `CropShape`, so you only choose colours. Everything keyed by crops (stock, stats, delivery draws, saves) derives from `CROP_ORDER`.
2. Balance with the pace simulator: `npx vitest run tests/pace.test.ts`. A crop should beat the previous tier in coins per tile-minute without breaking the level targets.
3. Only if no shape fits: add a `CropShape` and a `buildXxx(context)` builder in `src/render/crop-models.ts`, and a case in `buildShape`.
4. The icon in the shop and toolbar is rendered from the model automatically. Add info-card text in `src/ui/info.ts` only if the generic card is not enough.
5. Optional: add it to the demo farm (`src/demo.ts`) and a goal in `progress.ts`.

## A new orchard tree

Same as a crop, in `src/core/trees.ts` (`TreeId`, `TREES`, `TREE_ORDER`), with a model builder in `src/render/tree-models.ts`. Trees also feed the bakery (fruit ingredients), so remember `goods.ts` if recipes should use it.

## A new bakery recipe or good

1. `src/core/goods.ts`: add the id to `GoodId` and `GOOD_ORDER`, and a `Raw` entry (inputs, `yield`, `ms`, `xp`, `markup`, `unlockLevel`). `sellPrice` is derived; check it beats the raw ingredients.
2. `src/ui/good-icons.ts`: add an icon (inline SVG).
3. It appears in the recipe list and the barn by itself (they loop over `GOOD_ORDER`). Add a stat or goal only if you want it counted.

## A new animal species

`src/core/animals.ts` (`SpeciesId`, `SPECIES`, `SPECIES_ORDER`, `PRODUCTS`, feed recipe), `src/render/animal-models.ts` (model), `src/render/pens.ts` (pen model and its `PEN_LAYOUT` entry), `src/core/helpers.ts` (`PEN_SPOTS` so helpers can walk there), sounds in `audio.ts`. Add tests next to `tests/animals.test.ts`, including replay.

## A new command (player action)

1. `src/core/commands.ts`: add a member to the `Command` union and a `case` in `applyCommand`. There is no default, so the compiler flags a forgotten case.
2. `src/core/farm.ts`: implement the rule as a `Farm` method returning `ActionResult`. Validate first and return `fail('reason')` without changing anything; mutate; finish with `this.done(coins, xp, ...)` (which bumps `revision`). Take `now` as a parameter if time matters. Use `hashUnit(this.seed, this.revision, ...)` if you need randomness.
3. New failure reason: add it to `FailReason` and to the `switch` in `src/ui/messages.ts` (Portuguese text).
4. Counters for goals: add a field to `src/core/stats.ts` (`emptyStats`, `cloneStats`, `normalizeStats`) and bump it inside the method.
5. UI: dispatch the command from a dialog button (`data-act`) or a tool; nothing else needs to change. Sounds and effects for non-tool commands go in `commandEffects` in `main.ts`.
6. Tests: success, each failure reason, and a replay-equality case.

## A new field in the saved state

See [Persistence and saves](Persistence-and-Saves.md#changing-the-snapshot-safely). Short version: make it optional, default it in `fromSnapshot`, normalise it, write it in `toSnapshot`, test the round trip, and do not bump the version unless you must transform old data.

## A new helper

1. `src/core/helpers.ts`: `HelperId` (and `WalkerId` if it walks), `HELPER_ORDER`, a `HELPERS` entry (unlock level, hire cost, upgrade costs, wages, perks), home position, and any route or pose maths.
2. `src/core/farm.ts`: behaviour in `walk()` (what it does on arrival and where it goes next) or its own step like `pulse()`. Keep it a pure function of state and the event's timestamp; push a `helperEvents` entry for the screen.
3. `src/render/characters.ts`: a `CharacterKit` builder; wire it in `src/render/helper-view.ts` (it sets `userData.pickId = 'helper:<id>'`).
4. `src/ui`: the shop's helper tab loops over `HELPER_ORDER`; add wording in `payWord` (`core/helpers.ts`) and `src/ui/info.ts`; handle taps in `handleObjectTap` if it needs a dialog.
5. Tests in the style of `tests/helpers.test.ts` (hire, work, wages, offline cap, replay).

## A new building with its own dialog (the Confeitaria is the template)

Core:
- State as an optional snapshot field (for example `bakery?: BakeryState | null`), `normalizeX` on load, `toSnapshot` / `fromSnapshot` handling.
- Commands: `buyX`, `upgradeX`, and the work commands; stats and goals.

Render:
- `src/render/x-view.ts` with `group`, a `root` tagged `userData.pickId = 'x'`, tier builders and `update(dt, now)`.
- `src/game.ts`: construct it, add `group` to the scene, add `root` to the `ObjectPicker` roots and `group` to the occlusion list in `isOccluded` (so helpers get x-ray silhouettes behind it), call `update` in `frame()`.
- Keep the forest and decorations from growing through it (exclusion in `props.ts`'s forest `free` function).

UI:
- A `<div id="x" hidden>` in `index.html`, a `class XDialog extends Modal` in `src/ui/`, instantiate it in `main.ts`, call `refresh()` from `refreshUi`, open it from `handleObjectTap`, add a shop row (Fazenda tab) to buy it, and a `?x` debug URL.

Docs and tests: a `tests/x.test.ts` with replay equality, an entry in `src/demo.ts`, and a line in the README.

## A new dialog or tab

Subclass `Modal` (`src/ui/modal.ts`): implement `title()`, `html()` and `onAction()`; build rows with the helpers in `src/ui/kit.ts`; dispatch commands through the injected `Dispatch`. Never mutate the farm from a dialog.

## A new goal or achievement

`src/core/progress.ts`: append to `GOALS` with the next sequential `id`, the chapter index, a pure `value(farm)` and a `target`. Never renumber or reuse ids, because `farm.claimed` stores them. Achievements use the `tiered(...)` helper. Add a counter to `stats.ts` first if nothing measures what you want.

## A new sound

Add the name to the `Sfx` union in `src/audio.ts`, synthesise it in the effect table, and call `audio.play('name')` from `main.ts`.

## A new look (outline, lighting, time-of-day colour)

Time-of-day colours: a field on `Keyframe` in `src/render/daynight.ts` and its use in `Game.applyAtmosphere`. Materials: always through `Palette.toon` / `CropKit.material` so they are shared.
