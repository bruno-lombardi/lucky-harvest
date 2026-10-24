# Lucky Harvest 🌾

A nostalgic isometric 3D farming game, inspired by *Happy Harvest* from the Orkut days.
Everything you see is modeled procedurally in code: no external art assets.

**Stack:** TypeScript · Vite · Three.js · Vitest

## Run it

```bash
npm install
npm run dev                # http://localhost:5173
npm run dev -- --host      # also reachable from your phone on the same Wi-Fi
npm run build              # typecheck + production build
npm test                   # game-logic and render smoke tests
```

Pushes to `main` deploy to GitHub Pages (Settings → Pages → Source: GitHub Actions).

## How to play

You start with 100 coins, a few seeds and a 6×6 plot.

1. **Arar:** tap grass inside the bright plot to plow it into soil.
2. **Semear:** pick a seed from the tray and tap plowed soil. Seeds come from your inventory (the number under each seed); buy more at the **Loja**.
3. **Regar:** water the crop. An unwatered crop stalls at halfway (blue droplet) and wilts if left too long.
4. **Cuidar:** weeds and bugs can show up while a crop grows (red alert). They freeze its growth until you pull or shoo them with the glove, and the crop wilts if ignored.
5. **Colher:** when a gold coin spins over the crop, tap it. The harvest goes to your barn.
6. **Limpar:** clears withered crops, or turns bare soil back to grass.
7. **Sound and time:** the speaker button mutes everything. A day lasts 8 real minutes, and at night the windows light up and fireflies come out.
8. **Loja:** buy seeds (**Sementes**) and animal feed (**Ração**), sell crops and animal products (**Vender**), build pens and buy animals (**Animais**), and expand the plot (**Terreno**: 6×6, 8×8, 10×10).
9. **Celeiro:** tap the barn to see everything you own, and to mill feed from your crops for free (2 trigo → 3 rações de galinha, 2 milho → 2 de vaca, 3 tomate → 2 de porco).
10. **Animais:** each species lives in its own pen (Galinheiro Nv 2, Curral Nv 4, Chiqueiro Nv 6) on the east side of the island. Tap a pen to feed its animals with the matching feed, wait out the timer, and collect eggs, milk or truffles. Pens are built to be upgradable later.
11. **Olhar:** the neutral tool (default). It never changes anything: tap or hover a tile or building to read what it is. Every other tool shows its own icon as the cursor.
12. **Ajudantes (Loja):** three helpers that work by themselves and charge a wage every 10 minutes (taken automatically; if you can't pay, they stop and show a crossed-out coin until you pay them):
    - **Regador do moinho** (Nv 3): sprinkler heads across the plot water thirsty crops. Levels add heads and speed.
    - **Tonico, o ajudante** (Nv 5): a farmhand who walks to the nearest ripe crop, pulls it and tosses it in his basket.
    - **Mingau, o gato** (Nv 7): stalks and pounces on weeds and bugs.
    Each can be upgraded to level 3. Away from the game they work for at most 30 minutes.
13. **Detalhes:** hover (or long-press on touch) any seed, tool, feed, animal, pen, helper or land item for a card with its story, how long it takes, what it costs and what it earns.
14. **Entrega de sementes:** every 5 minutes (on the wall clock) a little green farm truck comes down the country road, stops beside the barn and lobs 6 sacks of seeds into the loft. Two of the six are always cheap staples (cenoura or trigo) and the rest are drawn from every crop you have unlocked, so even a broke farm can always start over. If you were away you find up to 6 deliveries waiting.
15. **Campo:** the farm sits in the countryside: a gravel road circles it and runs off to the horizon past telephone poles, with fields of wheat and plowed rows, pastures, woods, hedges, hay bales and hills.
16. **Menu (gear):** the game saves itself every few seconds on this device. Export or import the save file, or start over.

Level up to unlock more valuable crops: 🥕 🌾 → 🌽 (Nv 2) → 🍅 (Nv 3) → 🍓 (Nv 5) → 🎃 (Nv 8).
Growth times are short for now (45 s to 25 min); tune them in `src/core/crops.ts`.

Debug URLs: `?demo` loads a showcase farm with every crop at every stage; `?view=x,z,zoom` sets the camera; `?shop=seeds|feed|sell|animals|land` opens the shop, `?barn` / `?barn=feed` the barn, `?pen=galinha|vaca|porco` a pen, `?menu` the menu; `?follow=ajudante|gato&zoom=6` keeps the camera on a helper, `?spray` keeps the sprinklers running, `?reset` wipes the save (`?demo` never touches it); `?truck=-4` sets the clock four seconds before the next seed truck arrives (add `&stopclock` to hold it there); `?time=21` sets the hour and `?freeze` stops the clock; `?fx` replays every particle burst.

| | Desktop | Mobile |
|---|---|---|
| Pan | Drag | One-finger drag |
| Zoom | Mouse wheel | Pinch |
| Use tool | Click | Tap |

## Project layout

```
src/core/     Pure game logic: grid, noise, crops, levels, Farm rules (inventory, shop, land, pests), tool actions. No Three.js,
              no clock (time is passed in), so a future server can reuse it as-is.
src/render/   Three.js: iso camera, terrain, countryside (fields, road, poles, hills), seed truck, clouds, props (barn, windmill, fence, trees, pond),
              outlines, crop models, pests, particles, day/night, seed-icon renderer, FarmView.
src/ui/       DOM HUD: top bar, toolbar + seed tray, shop / barn / pen / menu dialogs, toast, floating numbers, Portuguese messages.
src/persistence.ts  Browser save manager (localStorage, backup slot, autosave).
src/audio.ts  Web Audio synthesis: effects, generated music, birds by day and crickets by night.
src/game.ts   Renderer, scene and main loop.
tests/        Vitest suites for src/core plus render smoke tests.
```

## Roadmap

- [x] **1. Foundation:** Vite + TS + Three.js, isometric camera (mouse + touch), 24×24 grid, tile picking
- [x] **2. Farming loop:** tools, plow / plant / water / harvest, growth stages, thirst and withering, coins and XP, levels, locked land
- [x] **3. Procedural art pass:** detailed crop models, toon outlines, barn, windmill, fence, forest, pond, animated water, Fredoka UI with custom icons
- [x] **4. Progression:** seed inventory, shop and barn, land expansion (6×6 to 10×10), weeds and bugs
- [x] **5. Polish:** particle bursts for every action, synthesized sound and music (no audio files), day/night cycle with lit windows and fireflies
- [x] **6. Animals and saves:** a pen per species (chickens, cows, pigs), species-specific feed (milled from crops or bought), clickable barn, versioned save game with backup, determinism for server sync
- [x] **7. Helpers:** neutral look tool and tool cursors, sprinklers, Tonico the farmhand, Mingau the cat, wages, upgrades (all deterministic, offline-capped)
- [x] **7b. Countryside and seed truck:** rural scenery with a road around the farm, a truck that delivers 6 random seeds every 5 minutes (deterministic, offline-capped)
- [ ] **8. PWA:** install to home screen, offline cache
- [ ] **9. Server and social:** neighbors, visiting, stealing, gifts, pen upgrades

## Determinism and server sync

The rules in `src/core` are a pure function of *(state, command, now)*; nothing reads a clock or `Math.random`.
Pests are rolled from `hashUnit(seed, revision, ...)`, so the same farm seed and command history always give the same result.
Helpers are part of the same rules: `Farm.runHelpers(now)` plays their routines forward in time order (each event depends only on state and its own timestamp), and `applyCommand` calls it first, so the client's per-frame catch-up and a server's replay agree.
The seed truck rides the same timeline: delivery slot *k* happens at `k * 5 min` of wall-clock time, its contents are `rollDelivery(seed, slot, level)` (pure hash draws), and `Farm.deliveredSlot` is the only state. Deliveries and helper steps are processed in one time-ordered loop, so the level used for a roll never depends on how often the client ticked. A long absence leaves at most 6 deliveries. The truck on screen is a pure function of the clock, so it needs no state at all.
Every player action is a plain-data `Command` (`src/core/commands.ts`) applied through `applyCommand`.

The save file (`src/core/save.ts`, checksummed JSON) holds the current state plus a *baseline snapshot* and an *outbox* of commands since that baseline.
A server can replay the outbox on the baseline and must land on the same state (covered by `tests/save.test.ts` and `tests/animals.test.ts`); once it acknowledges them the client drops the outbox and rebases the baseline.
