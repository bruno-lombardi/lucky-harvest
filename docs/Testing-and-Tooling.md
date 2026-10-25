# Testing and tooling

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173, add -- --host for phones)
npm test             # Vitest, runs everything in tests/
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build into dist/
npm run preview      # serve dist/ (use this for performance work)
```

Note: `vite build` alone does **not** type-check; `npm run build` does. CI runs `npm test` then `npm run build`.

## What the tests cover

| Suite | Protects |
|---|---|
| `farm.test.ts`, `crops.test.ts`, `levels.test.ts`, `grid.test.ts`, `noise.test.ts` | Core rules, growth, thirst, pests, shop, land, maths |
| `animals.test.ts`, `helpers.test.ts`, `planter.test.ts`, `barn.test.ts`, `trees.test.ts`, `bakery.test.ts`, `delivery.test.ts`, `progress.test.ts` | One feature each, including **replay equality** (apply commands live, then replay the log on the baseline, expect identical snapshots) |
| `save.test.ts` | Encode/decode, checksum, version upgrades, round trip |
| `atmosphere.test.ts` | Day/night keyframes |
| `render.test.ts`, `merge.test.ts` | Procedural models build for every crop/stage/tier without a GL context (Three.js builds scene graphs in Node) |
| `pace.test.ts` + `support/pace-bot.ts` | Economy pacing: a simulated casual player must hit levels 8, 12, 20 in roughly 45 min, 2 h, 8 h |
| `known-issues.test.ts` | Executable notes for known bugs, written with `it.fails` (see below) |

### Writing a test for a new rule

1. Build a farm: `new Farm({ seed: 1, pestChance: 0 })` (zero pest chance removes randomness), set `farm.xp = levelThreshold(n)`, `farm.coins`, `farm.landSize`.
2. Drive it with the real entry point where possible: `applyCommand(farm, command, now)`, so the test exercises the same path as the UI.
3. Choose explicit `now` values (`0`, `60_000`, …). Never use the real clock.
4. For anything that mutates state over time, add a replay test: log each successful command, then `replay(Farm.fromSnapshot(baseline), log)` and compare `toSnapshot()`.

### `it.fails`

`tests/known-issues.test.ts` uses `it.fails` for bugs we have documented but not fixed. The test passes *while the bug exists*; when someone fixes it, the test starts failing, which is the signal to change it into a normal `it`. This keeps known problems visible in CI without turning it red.

## Debug URLs

Append to the game URL (these are handled in `src/main.ts`):

| Param | Effect |
|---|---|
| `?demo` | Showcase farm with every crop at every stage; never touches the real save; exposes `window.__lh` for profiling |
| `?reset` | Wipe the save and start fresh |
| `?view=x,z,zoom` | Place the camera; `?time=21` sets the hour, `&freeze` stops the clock |
| `?shop=seeds\|feed\|sell\|animals\|land`, `?barn`, `?pen=galinha`, `?menu`, `?book=guia\|metas\|conquistas`, `?baker=forno\|receitas`, `?tonico` | Open a dialog directly |
| `?bakery=1..3` (`&busy`, `&ready`) | Give the farm a bakery of that tier, optionally with a job running or finished |
| `?tier=1..4` | Show a barn tier |
| `?follow=ajudante\|gato\|cao\|tratador&zoom=6` | Camera follows a helper |
| `?spray`, `?fx` | Keep sprinklers on / replay every particle burst |
| `?truck=-4` (`&stopclock`) | Put the clock 4 s before the next seed truck |

## Profiling

1. `npm run build && npm run preview`.
2. Open `/?demo&bakery=3` and in the console run `__lh.stats()`, `__lh.breakdown()`, `__lh.detail(1)` (index is the scene child: 0 terrain, 1 countryside, 2 props, 3 pens, 4 helpers, …).
3. Watch draw calls (`calls`), `triangles`, `geometries`, and `update` (JS time per frame before rendering).

For automated runs we used Puppeteer with software GL (SwiftShader). Frame times there are meaningless, but draw calls, triangle counts, JS time and screenshots are useful. Screenshots are the quickest way to catch a broken model.

## CI and deploy

`.github/workflows/deploy.yml`: on push to `main`: `npm ci` → `npm test` → `npm run build` → upload `dist` → deploy to GitHub Pages. `vite.config.ts` sets `base: './'` so the site works under a repo sub-path. A red test blocks the deploy.

## Publishing these docs to the GitHub Wiki

The pages in `docs/` are the source of truth and render on GitHub as they are (relative links work, and `_Sidebar.md` is the wiki sidebar). To mirror them to the repository's Wiki tab: save any first page in the Wiki tab once (this creates the wiki repository), then run `bash scripts/publish-wiki.sh`. It replaces the wiki's pages with `docs/*.md`.
