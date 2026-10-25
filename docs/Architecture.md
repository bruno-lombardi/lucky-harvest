# Architecture

## Layers

```
            ┌───────────────────────────────────────────────┐
            │ src/main.ts   composition root (wires it all) │
            └───────┬───────────────┬──────────────┬────────┘
                    │               │              │
             ┌──────▼─────┐  ┌──────▼──────┐ ┌─────▼──────────┐
             │ src/ui     │  │ src/game.ts │ │ src/persistence│
             │ DOM, HUD,  │  │ + src/render│ │ localStorage   │
             │ dialogs    │  │ Three.js    │ │ save manager   │
             └──────┬─────┘  └──────┬──────┘ └─────┬──────────┘
                    │ commands      │ reads        │ records commands
                    ▼               ▼              ▼
            ┌───────────────────────────────────────────────┐
            │ src/core   Farm + rules, pure, no I/O, no time │
            └───────────────────────────────────────────────┘
```

Dependencies only point **downwards**: `ui` and `render` import `core`; `core` imports nothing from them. `src/audio.ts` (Web Audio synthesis) is a leaf used by `main.ts`.

| Folder / file | Responsibility | May import |
|---|---|---|
| `src/core/` | All rules and data tables: `Farm`, commands, crops, animals, helpers, goods, trees, progress, saves | only `core` |
| `src/render/` | Three.js scene: models, camera, terrain, day/night, particles, per-feature views | `core`, `three` |
| `src/ui/` | DOM HUD, dialogs, tooltips, icons, Portuguese messages | `core`, `render` (icons only) |
| `src/game.ts` | Creates the renderer and scene, owns the main loop, exposes the view API the UI needs | `core`, `render` |
| `src/main.ts` | Creates the `Farm`, `Game`, dialogs and audio; connects events to commands | everything |
| `src/persistence.ts` | `SaveManager`: autosave, backup slot, import/export, command outbox | `core` |
| `src/demo.ts` | A showcase farm for `?demo` (screenshots, perf tests) | `core` |
| `tests/` | Vitest: rules, saves, render smoke tests, the pace simulator | everything |

## The life of a player action

Example: the player has the hoe selected and taps a grass tile.

1. `IsoCameraController` (render) turns the pointer event into a *tap* and `TilePicker` raycasts it to a tile `(i, j)`; `Game` calls `events.onTileTap(tile)`.
2. `handleTap` in `main.ts` builds `{ type: 'tool', tool: 'arar', i, j, crop, tree }` and calls `dispatch(command)`.
3. `dispatch` calls `applyCommand(farm, command, Date.now())` (`src/core/commands.ts`). That first runs `farm.runHelpers(now)` so background workers are caught up, then routes to `applyTool` → `Farm.plow(i, j)`.
4. The farm mutates itself and returns `{ ok: true, gain }` or `{ ok: false, reason }`.
5. On success `dispatch` records the command in the save outbox (`saves.record`), shows floating numbers from `gain`, plays a sound, and calls `refreshUi`.
6. On the next frame `FarmView.update` sees the new tile state and builds the soil mesh. Particles and sounds were triggered directly by `main.ts`; nothing in the renderer is told "a plow happened", it just diffs the state.

Failures are values, not exceptions: `reasonMessage(reason)` in `src/ui/messages.ts` turns a `FailReason` into a toast.

## The frame loop

`Game.frame()` (called by `renderer.setAnimationLoop`) does, in order: advance the camera and the day/night clock, call `farm.runHelpers(now)` to play helper routines and seed deliveries forward, update every view (`farmView`, `orchardView`, `props`, `pens`, `helperView`, `decorView`, `bakeryView`, `deliveryView`, `clouds`, particles, highlight), call `events.onFrame(now)` (which refreshes the HUD about five times a second), then render.

`now` is `Date.now()` plus a debug offset. It is the only clock in the program, and it is *passed into* the rules rather than read by them.

## State ownership

- **Game state** lives in one `Farm` instance (`src/core/farm.ts`). It is the single source of truth and is what gets saved.
- **View state** (animation phases, particle pools, camera position, open dialog, selected tool) lives in the views and `main.ts` and is never saved.
- `Farm` also holds two *render queues*, `helperEvents` and `deliveryEvents`. They are filled by the rules so the screen can show a burst or a toast, are never saved, and are never read by the rules.

## Key design decisions (and the trade-offs)

- **Time passed in, not read.** Growth is stored as an *anchor* (`anchorAt`, `anchorGrowth`) so a crop's progress is an arithmetic function of `now`; there are no timers to restore after a reload and offline progress is free. The cost is that every rule must be written in terms of timestamps.
- **Tables as data.** Crops, animals, helpers, goods, trees and goals are `Record`s of plain objects. Adding content is mostly adding an entry plus a model; see [How to add content](How-To-Add-Content.md).
- **Procedural everything.** No asset pipeline, tiny download, easy theming; the cost is that models are code (see [Rendering](Rendering.md)) and artists cannot contribute without writing TypeScript.
- **Portuguese ids.** Ids such as `cenoura`, `galinha`, `tratador` match the UI language. See the [Glossary](Glossary.md).
- **Client-authoritative today.** The browser is the only authority. The command log in the save file is the groundwork for server authority; see the [Roadmap](Roadmap-Backend-Multiplayer-Social.md) for what still has to change.
