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

1. **Arar:** tap grass inside the bright plot to plow it into soil.
2. **Semear:** pick a seed from the tray and tap plowed soil. Seeds cost coins.
3. **Regar:** water the crop. An unwatered crop stalls at halfway (a blue droplet appears) and wilts if left too long.
4. **Colher:** when a gold coin spins over the crop, tap it to harvest coins and XP.
5. **Limpar:** clears withered crops, or turns bare soil back to grass.

Level up to unlock more valuable crops: 🥕 🌾 → 🌽 (Nv 2) → 🍅 (Nv 3) → 🍓 (Nv 5) → 🎃 (Nv 8).
Growth times are short for now (45 s to 25 min); tune them in `src/core/crops.ts`.

Debug URLs: `?demo` loads a showcase farm with every crop at every stage; `?view=x,z,zoom` sets the camera.

| | Desktop | Mobile |
|---|---|---|
| Pan | Drag | One-finger drag |
| Zoom | Mouse wheel | Pinch |
| Use tool | Click | Tap |

## Project layout

```
src/core/     Pure game logic: grid, noise, crops, levels, Farm rules, tool actions. No Three.js,
              no clock (time is passed in), so a future server can reuse it as-is.
src/render/   Three.js: iso camera, terrain, water shader, clouds, props (barn, windmill, fence, trees, pond),
              outlines, crop models, seed-icon renderer, FarmView.
src/ui/       DOM HUD: top bar, toolbar + seed tray, toast, floating numbers, Portuguese messages.
src/game.ts   Renderer, scene and main loop.
tests/        Vitest suites for src/core plus render smoke tests.
```

## Roadmap

- [x] **1. Foundation:** Vite + TS + Three.js, isometric camera (mouse + touch), 24×24 grid, tile picking
- [x] **2. Farming loop:** tools, plow / plant / water / harvest, growth stages, thirst and withering, coins and XP, levels, locked land
- [x] **3. Procedural art pass:** detailed crop models, toon outlines, barn, windmill, fence, forest, pond, animated water, Fredoka UI with custom icons
- [ ] **4. Progression:** shop, inventory, land expansion, weeds and bugs
- [ ] **5. Polish:** particles, sound, day/night, glossy HUD
- [ ] **6. Persistence and PWA:** saves, offline growth catch-up (the core is already snapshot-ready), install to home screen
- [ ] **7. Server and social:** neighbors, visiting, stealing, gifts
