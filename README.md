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
7. **Loja:** buy seeds, sell the harvest from the barn (**Celeiro**), and pay to expand the plot (**Terreno**: 6×6, 8×8, 10×10).

Level up to unlock more valuable crops: 🥕 🌾 → 🌽 (Nv 2) → 🍅 (Nv 3) → 🍓 (Nv 5) → 🎃 (Nv 8).
Growth times are short for now (45 s to 25 min); tune them in `src/core/crops.ts`.

Debug URLs: `?demo` loads a showcase farm with every crop at every stage; `?view=x,z,zoom` sets the camera; `?shop=seeds|barn|land` opens the shop.

| | Desktop | Mobile |
|---|---|---|
| Pan | Drag | One-finger drag |
| Zoom | Mouse wheel | Pinch |
| Use tool | Click | Tap |

## Project layout

```
src/core/     Pure game logic: grid, noise, crops, levels, Farm rules (inventory, shop, land, pests), tool actions. No Three.js,
              no clock (time is passed in), so a future server can reuse it as-is.
src/render/   Three.js: iso camera, terrain, water shader, clouds, props (barn, windmill, fence, trees, pond),
              outlines, crop models, pests, seed-icon renderer, FarmView.
src/ui/       DOM HUD: top bar, toolbar + seed tray, shop dialog, toast, floating numbers, Portuguese messages.
src/game.ts   Renderer, scene and main loop.
tests/        Vitest suites for src/core plus render smoke tests.
```

## Roadmap

- [x] **1. Foundation:** Vite + TS + Three.js, isometric camera (mouse + touch), 24×24 grid, tile picking
- [x] **2. Farming loop:** tools, plow / plant / water / harvest, growth stages, thirst and withering, coins and XP, levels, locked land
- [x] **3. Procedural art pass:** detailed crop models, toon outlines, barn, windmill, fence, forest, pond, animated water, Fredoka UI with custom icons
- [x] **4. Progression:** seed inventory, shop and barn, land expansion (6×6 to 10×10), weeds and bugs
- [ ] **5. Polish:** particles, sound, day/night, glossy HUD
- [ ] **6. Persistence and PWA:** saves, offline growth catch-up (the core is already snapshot-ready), install to home screen
- [ ] **7. Server and social:** neighbors, visiting, stealing, gifts
