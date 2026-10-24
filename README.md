# Lucky Harvest 🌾

A nostalgic isometric 3D farming game, inspired by *Happy Harvest* from the Orkut days.
Everything you see is modeled procedurally in code: no external art assets.

**Stack:** TypeScript · Vite · Three.js · Vitest

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm test           # game-logic tests
```

## Controls

| | Desktop | Mobile |
|---|---|---|
| Pan | Drag | One-finger drag |
| Zoom | Mouse wheel | Pinch |
| Select tile | Click | Tap |

## Project layout

```
src/core/     Pure game logic (grid math, noise). No Three.js, so a future server can reuse it.
src/render/   Three.js: iso camera, terrain, clouds, tile picking, highlights, toon material.
src/ui/       HUD styling (plain DOM/CSS).
src/game.ts   Renderer, scene and main loop.
tests/        Vitest suites for src/core.
```

## Roadmap

- [x] **1. Foundation:** Vite + TS + Three.js, isometric camera (mouse + touch), 24×24 grid, tile picking
- [ ] **2. Farming loop:** tools, plow / plant / water / harvest, growth timers, coins and XP
- [ ] **3. Procedural art pass:** crops (6-8), fences, barn, trees, toon outlines
- [ ] **4. Progression:** shop, inventory, levels, land expansion, weeds and bugs
- [ ] **5. Polish:** animations, particles, sound, day/night, glossy HUD
- [ ] **6. Persistence and PWA:** saves, offline growth catch-up, install to home screen
- [ ] **7. Server and social:** neighbors, visiting, stealing, gifts
