# Rendering (`src/render`, `src/game.ts`)

Three.js, an orthographic camera at true isometric angles (45° azimuth, about 35.26° elevation), toon shading, and inverted-hull outlines. No textures except a tiny gradient map; all geometry is built in code.

## The shape of the code

`Game` (`src/game.ts`) creates the `WebGLRenderer`, the `Scene`, the lights and one *view* object per feature, adds each view's `group` to the scene, and calls `view.update(...)` every frame. Views take the `Farm` (read-only) and a shared toon `gradientMap`.

| View | Draws |
|---|---|
| `Terrain` | Island, water, locked/unlocked plot tiles |
| `Countryside` | Everything beyond the island: ground, roads, hedges, fields, woods, poles, hills |
| `Props` | Barn (4 tiers), windmill, fence, forest ring, pond, scarecrow, lamp, hay, sign |
| `FarmView` | Soil tiles and crops, pests and the coin/drop/alert indicators above them |
| `OrchardView` | The Pomar's fenced plots and fruit trees |
| `Pens` | Pens, animals and their products |
| `HelperView` | Sprinkler heads and the four walking helpers (with x-ray silhouettes) |
| `BakeryView` | Confeitaria building (3 tiers), Dona Zefa, the ready bubble |
| `DecorView` | The six decorations |
| `DeliveryView` + `truck.ts` | The seed truck driving in on the wall clock |
| `Clouds`, `Particles`, `Fireflies`, `TileHighlight` | Ambient and feedback effects |
| `DayNight` | Keyframed sky, sun, water and cloud colours over an 8-minute day |

Rule of thumb: **a view never writes to `Farm`**. It diffs the farm against what it has built (for example `FarmView` keeps a `Map` of tile key → mesh entry, creates or removes entries, and swaps a model when a crop's *signature* changes).

## Building blocks

- `toon.ts`: a 4-step `DataTexture` gradient that gives `MeshToonMaterial` its banding.
- `props.ts`: `Palette` (a colour → `MeshToonMaterial` cache), `box(...)` (a box mesh with an outline), `instanced(...)`, `buildForest(...)`. Use these instead of `new Mesh(...)` so materials are shared.
- `outline.ts`: three outline flavours. `addOutline` (normal extrusion, for rounded closed shapes), `addHullOutline` (a slightly scaled back-face copy, for boxes and cones), and the `addInstanced*` variants that share instance matrices. Each adds a *second* mesh, so outlines double draw calls; avoid them on tiny or distant parts.
- `crop-models.ts`: `CropKit` (shared geometries and materials) and `buildCropModel(kit, def, look)`. One builder per `CropShape` (`root`, `grain`, `tall`, `bush`, `cane`, …) so a new crop usually reuses a shape and only sets colours.
- `characters.ts`: `CharacterKit` builds Tonico, Mingau, Rex, Lúcia and Dona Zefa from boxes and spheres, with a pose API driven from `core/helpers.ts` (`walkerPose`).
- `icons.ts`: renders crop and tree models to offscreen render targets and returns PNG data URLs, so the shop and toolbar show the same models you see on the farm.
- `indicators.ts`: floating coin, drop, alert, "unpaid" and "baked" markers above things.
- `iso-camera.ts`: pan/zoom/tap/hover for mouse and touch; clamps to the island. `picking.ts` maps a pointer to a tile; `object-picker.ts` raycasts tagged groups (`userData.pickId = 'barn'`, `'pen:galinha'`, `'bakery'`, `'helper:ajudante'`) so buildings win over the ground.

## Lighting and time of day

One `DirectionalLight` (the sun, with a 2048² shadow map covering the farm only) and one `HemisphereLight`. `DayNight` interpolates between hour keyframes; `Game.applyAtmosphere()` pushes the result into the lights, the CSS sky gradient (the canvas is transparent), the water, the clouds and the lit windows. Adding a time-of-day effect usually means adding a field to `Keyframe`.

## Performance: what matters here

The scene has a few thousand draw calls on a fully built farm, so the work that pays off is *fewer draw calls* and *fewer triangles*, in that order.

- **Instancing** for repeats (forest, hedges, ground tiles, flowers): one draw call for thousands.
- **Merging** (`merge.ts`, `mergeStatic`) flattens a static model into one mesh per material. `FarmView` builds one merged template per `(crop, stage, thirsty, withered)` and clones it per tile (clones share geometry and material). Normal-extruded outline materials are re-created with the thickness scaled to the baked transform, because their thickness is measured in the mesh's own units.
- **Level of detail by distance:** the countryside uses coarser geometry and no shadow casting (it lies outside the shadow camera anyway). Prefer `castShadow = false` on anything outside the farm.
- **Adaptive resolution:** `Game.adaptResolution()` lowers the pixel ratio in 0.25 steps (down to 1) when the average frame gap is above about 26 ms; it never raises it again, to avoid flapping.
- **Shader warm-up:** `Game.warmUp()` calls `renderer.compileAsync` before the first frame, behind the loading screen.
- **Soil** is one vertex-coloured mesh per tile instead of four meshes.

Remaining hot spots (measure before touching): the animal pens (about 760 meshes), helper characters, and building outlines. They have animated parts, so they need per-part merging rather than whole-model merging.

### How to measure

`?demo` loads a showcase farm and exposes `window.__lh` with `stats()` (draw calls, triangles, geometries, textures, smoothed frame ms), `breakdown()` (meshes and triangles per top-level group) and `detail(n)` (biggest meshes in group *n*). Profile a production build (`npm run build && npm run preview`), because the dev server adds overhead. In a headless browser with software GL, frame time is meaningless but draw calls and triangle counts are reliable. See [Testing and tooling](Testing-and-Tooling.md).

## Loading screen

`index.html` contains the splash markup and CSS inline, so it paints before any script. `main.ts` uses top-level `await splashStage(fraction, text)` between heavy steps (each call lets the browser paint), then `Game.warmUp()`, `game.start()` and `splashDone()`, which fades the splash after two painted frames. To add a stage, add one `await splashStage(...)` line at the right place in `main.ts`.

## Conventions

- World units: one tile is one unit; tile tops sit at y = 0; the camera looks from +x, +z.
- Everything faces +z by default.
- Colours are hex numbers; shared materials come from `Palette`/`CropKit` caches.
- Dispose nothing that came from a cache. Per-frame allocations (new `Vector3`, new `Color`) in `update` loops are a smell; reuse scratch objects.

## Farm lights (`render/lights-view.ts`)

No real lights: bulbs are one `InstancedMesh`, glows one additive `PointPool`, ground pools one instanced additive mesh and the wire one `LineSegments`. Fairy lights follow the fence, with lamp posts at the corners and by the path and lanterns at the gate, barn and windmill doors. Brightness eases toward `on ? smoothstep(night) : 0`, so switching never pops. The set is rebuilt when the plot grows. Tests: `tests/lights-view.test.ts`.
