/**
 * @module game
 *
 * Owns the WebGLRenderer, the Scene and the frame loop, and builds one view object per feature (terrain, props, farm, pens, helpers,
 * bakery, ...). Game rules live in src/core; this file only draws them and reports pointer events through `GameEvents`.
 *
 * Per frame (`frame()`): camera and day/night → `farm.runHelpers(now)` (background work) → every view's `update` → HUD callback → render.
 * Also here: adaptive resolution, shader warm-up for the loading screen, occlusion test for helper silhouettes, and the `?demo` debug
 * helpers (`stats`, `breakdown`, `detail`).
 *
 * To add a visible feature: create `render/xxx-view.ts`, construct it below, add its `group` to the scene, call its `update` in `frame()`;
 * if it can be tapped add its root to the `ObjectPicker` list, and if it is a tall building add it to the occlusion list in `isOccluded`.
 *
 * NEXT(multiplayer): `Game` takes a single `Farm` and only reads it, which is what a visitor mode needs. A neighbor's farm could be shown
 *   by building a second `Game` (or swapping the farm) from a snapshot and the server's `now`, with tool input disabled.
 */

import {
  Clock,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  Raycaster,
  Scene,
  Vector3,
  Mesh,
  WebGLRenderer,
} from 'three';
import { CropId } from './core/crops';
import { TreeId } from './core/trees';
import { Farm } from './core/farm';
import { GRID_SIZE, TileCoord, tileToWorld } from './core/grid';
import { Clouds } from './render/clouds';
import { renderCropIcons, renderTreeIcons } from './render/icons';
import { Props } from './render/props';
import { DayNight, atmosphereAt, createAtmosphere, lightPosition } from './render/daynight';
import { BurstKind, Effects, Fireflies, Particles } from './render/particles';
import { FarmView } from './render/farm-view';
import { OrchardView } from './render/orchard-view';
import { TileHighlight } from './render/highlight';
import { IsoCameraController } from './render/iso-camera';
import { TilePicker } from './render/picking';
import { ObjectPicker } from './render/object-picker';
import { Pens } from './render/pens';
import { HelperView } from './render/helper-view';
import { Terrain } from './render/terrain';
import { Countryside } from './render/countryside';
import { deliveryInterval } from './core/delivery';
import { BakeryView } from './render/bakery-view';
import { DecorView } from './render/decor-view';
import { DeliveryView, TRUCK_STOP, TruckCue } from './render/delivery-view';
import { createToonGradient } from './render/toon';

export interface GameEvents {
  /** A tap landed on a tile (or on empty water, with null). */
  onTileTap?: (tile: TileCoord | null) => void;
  /** A tap landed on a building: 'barn' or 'pen:<species>'. */
  onObjectTap?: (id: string) => void;
  /** The pointer is over a tile and/or a building (null when it leaves the canvas). */
  onHover?: (hit: { tile: TileCoord | null; object: string | null; x: number; y: number } | null) => void;
  /** Called every frame with the current wall-clock time in ms. */
  onFrame?: (now: number) => void;
  /** The seed truck honks on its way in, and starts unloading. */
  onTruck?: (cue: TruckCue) => void;
}

/** Owns the renderer, scene and main loop. Game rules live in src/core. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly clock = new Clock();
  private readonly cameraController: IsoCameraController;
  private readonly picker: TilePicker;
  private readonly objectPicker: ObjectPicker;
  private readonly pens: Pens;
  private readonly helperView: HelperView;
  private readonly deliveryView: DeliveryView;
  private readonly decorView: DecorView;
  private readonly bakeryView: BakeryView;
  private readonly countryside: Countryside;
  private readonly highlight = new TileHighlight(GRID_SIZE);
  private readonly terrain: Terrain;
  private readonly clouds: Clouds;
  private readonly props: Props;
  private readonly farmView: FarmView;
  private readonly orchardView: OrchardView;
  private readonly gradient = createToonGradient(4);
  private readonly particles = new Particles();
  private readonly effects = new Effects(this.particles);
  private readonly fireflies = new Fireflies();
  readonly dayNight: DayNight;
  private readonly atmosphere = createAtmosphere();
  private sun!: DirectionalLight;
  private hemisphere!: HemisphereLight;
  private readonly lightPos = { x: 0, y: 0, z: 0 };
  private elapsed = 0;
  /** Debug only: shifts the game's wall clock (see `?truck=` in main.ts). */
  private clockOffset = 0;
  private frozenAt: number | null = null;
  private shownLand: number;
  private readonly resizeObserver: ResizeObserver;
  private readonly projected = new Vector3();

  private hovered: TileCoord | null = null;
  private toolCursor = '';
  private running = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly farm: Farm,
    private readonly events: GameEvents = {},
    startHour = 9,
    freezeTime = false,
  ) {
    this.dayNight = new DayNight(startHour, 480, freezeTime);
    // Transparent canvas: the CSS sky gradient shows through behind the island.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.shownLand = farm.landSize;
    const gradient = this.gradient;
    this.terrain = new Terrain(GRID_SIZE, gradient, 1337, (i, j) => farm.isUnlocked(i, j));
    this.scene.add(this.terrain.group);
    this.farmView = new FarmView(farm, GRID_SIZE, gradient);
    this.orchardView = new OrchardView(farm, gradient);
    this.props = new Props(gradient, farm.landSize);
    this.pens = new Pens(farm, gradient);
    this.helperView = new HelperView(farm, gradient);
    this.helperView.isHidden = (point) => this.isOccluded(point);
    this.decorView = new DecorView(farm, gradient);
    this.bakeryView = new BakeryView(farm, gradient);
    this.deliveryView = new DeliveryView(gradient);
    this.deliveryView.onCue = (cue) => this.events.onTruck?.(cue);
    this.deliveryView.onDust = (x, z) => this.effects.burst('clear', x, z);
    this.countryside = new Countryside(gradient);
    this.clouds = new Clouds();
    this.scene.add(
      this.countryside.group,
      this.props.group,
      this.pens.group,
      this.helperView.group,
      this.deliveryView.group,
      this.decorView.group,
      this.bakeryView.group,
      this.farmView.group,
      this.orchardView.group,
      this.clouds.group,
      this.highlight.group,
      this.particles.object,
      this.fireflies.object,
    );
    this.addLights();

    this.cameraController = new IsoCameraController(this.renderer.domElement, {
      panLimit: GRID_SIZE * 0.45,
    });
    this.picker = new TilePicker(this.cameraController.camera, this.renderer.domElement, GRID_SIZE);

    this.objectPicker = new ObjectPicker(this.cameraController.camera, this.renderer.domElement, () => [
      this.props.barn,
      this.bakeryView.root,
      ...this.pens.pickRoots(),
      ...this.helperView.pickRoots(),
    ]);

    this.cameraController.onHover = (x, y) => {
      const object = this.objectPicker.pick(x, y);
      const tile = object ? null : this.picker.pick(x, y);
      this.renderer.domElement.style.cursor = object ? 'pointer' : this.toolCursor;
      this.setHovered(tile);
      this.events.onHover?.({ tile, object, x, y });
    };
    this.cameraController.onHoverEnd = () => {
      this.renderer.domElement.style.cursor = this.toolCursor;
      this.setHovered(null);
      this.events.onHover?.(null);
    };
    this.cameraController.onTap = (x, y) => {
      const object = this.objectPicker.pick(x, y);
      if (object) {
        this.highlight.setSelected(null);
        this.events.onObjectTap?.(object);
      } else {
        this.handleTap(this.picker.pick(x, y));
      }
    };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Compiles every shader before the first frame, so the game does not freeze the first time things appear. */
  async warmUp(): Promise<void> {
    try {
      await this.renderer.compileAsync(this.scene, this.cameraController.camera);
    } catch {
      // Not fatal: the shaders then compile on first use.
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  /** Screen position (client px) of a point above a tile, for floating text. */
  screenPositionOf(tile: TileCoord, height = 0.6): { x: number; y: number } {
    const { x, z } = tileToWorld(tile.i, tile.j, GRID_SIZE);
    this.projected.set(x, height, z).project(this.cameraController.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((this.projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - this.projected.y) / 2) * rect.height,
    };
  }

  private readonly sight = new Raycaster();
  private readonly sightDir = new Vector3();

  /** True when a building, tree or fence post stands between the camera and a world point. */
  private isOccluded(point: Vector3): boolean {
    const camera = this.cameraController.camera;
    camera.getWorldDirection(this.sightDir);
    const far = 80;
    this.sight.camera = camera;
    this.sight.set(point.clone().addScaledVector(this.sightDir, -far), this.sightDir);
    this.sight.far = far - 0.45;
    const hits = this.sight.intersectObjects(
      [this.props.group, this.pens.group, this.orchardView.group, this.decorView.group, this.bakeryView.group],
      true,
    );
    return hits.some((h) => h.point.y > 0.65 && h.object.visible);
  }

  /** Seed-tray icons rendered from the real 3D crop models. */
  renderCropIcons(): Record<CropId, string> {
    return renderCropIcons(this.renderer, this.gradient);
  }

  /** Shop and tray icons rendered from the real tree models. */
  renderTreeIcons(): Record<TreeId, string> {
    return renderTreeIcons(this.renderer, this.gradient);
  }

  /** Plays a particle burst on a tile (plow dirt, water splash, harvest sparkles...). */
  burst(kind: BurstKind, tile: TileCoord): void {
    const { x, z } = tileToWorld(tile.i, tile.j, GRID_SIZE);
    this.effects.burst(kind, x, z);
  }

  /** Debug: renderer counters for profiling. */
  stats(): { calls: number; triangles: number; geometries: number; textures: number; frame: number; update: number } {
    const { render, memory } = this.renderer.info;
    return { calls: render.calls, triangles: render.triangles, geometries: memory.geometries, textures: memory.textures, frame: this.lastFrameMs, update: this.lastUpdateMs };
  }

  /** Debug: visible meshes and triangles per top-level group of the scene. */
  breakdown(): Array<{ group: string; meshes: number; instanced: number; triangles: number; shadowCasters: number }> {
    const out: Array<{ group: string; meshes: number; instanced: number; triangles: number; shadowCasters: number }> = [];
    this.scene.children.forEach((child, n) => {
      const row = { group: `${n}:${child.type}:${child.children.length}`, meshes: 0, instanced: 0, triangles: 0, shadowCasters: 0 };
      child.traverseVisible((o) => {
        const m = o as Mesh & { isInstancedMesh?: boolean; count?: number };
        if (!m.isMesh) return;
        const index = m.geometry.index;
        const tris = (index ? index.count : m.geometry.attributes['position']!.count) / 3;
        row.meshes++;
        if (m.isInstancedMesh) row.instanced++;
        row.triangles += tris * (m.isInstancedMesh ? (m.count ?? 1) : 1);
        if (m.castShadow) row.shadowCasters++;
      });
      out.push(row);
    });
    return out;
  }

  /** Debug: triangles per mesh inside one top-level group. */
  detail(n: number): Array<{ name: string; count: number; tris: number }> {
    const out: Array<{ name: string; count: number; tris: number }> = [];
    this.scene.children[n]?.traverseVisible((o) => {
      const m = o as Mesh & { isInstancedMesh?: boolean; count?: number };
      if (!m.isMesh) return;
      const g = m.geometry;
      const tris = (g.index ? g.index.count : g.attributes['position']!.count) / 3;
      const count = m.isInstancedMesh ? (m.count ?? 1) : 1;
      out.push({ name: o.parent?.type + '>' + g.type, count, tris: tris * count });
    });
    return out.sort((a, b) => b.tris - a.tris).slice(0, 12);
  }

  /** Debug: keep the sprinklers spraying (for screenshots). */
  forceSpray(on: boolean): void {
    this.helperView.alwaysSpray = on;
  }

  /** Plays a particle burst at a world position. */
  burstAt(kind: BurstKind, x: number, z: number): void {
    this.effects.burst(kind, x, z);
  }

  /** Screen position (client px) of a world point. */
  screenPositionOfWorld(x: number, y: number, z: number): { x: number; y: number } {
    this.projected.set(x, y, z).project(this.cameraController.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((this.projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - this.projected.y) / 2) * rect.height,
    };
  }

  /** Confetti and dust centred on the plot, for land expansion. */
  burstAtCenter(kind: BurstKind): void {
    this.effects.burst(kind, 0, 0);
  }

  /** Where the seed truck unloads (world position of the barn side), for floating text. */
  deliverySpot(): { x: number; z: number } {
    return { x: TRUCK_STOP.x + 2.4, z: TRUCK_STOP.z };
  }

  setClockOffset(ms: number): void {
    this.clockOffset = ms;
  }

  /** Debug only: stops the game's clock at a wall-clock time. */
  freezeClockAt(ms: number): void {
    this.frozenAt = ms;
  }

  /** The cursor shown over the world (the active tool's icon). */
  setToolCursor(css: string): void {
    this.toolCursor = css;
    this.renderer.domElement.style.cursor = css;
  }

  setView(x: number, z: number, zoom: number): void {
    this.cameraController.setView(x, z, zoom);
  }

  /** Marks the tile the player last acted on. */
  setSelected(tile: TileCoord | null): void {
    this.highlight.setSelected(tile);
  }

  private addLights(): void {
    // Sky above, green bounce light from the grass below: keeps shadows cool, not muddy.
    this.hemisphere = new HemisphereLight(0xdaf0ff, 0x7fae5c, 1.15);
    this.scene.add(this.hemisphere);

    const sun = new DirectionalLight(0xfff3d8, 2.0);
    this.sun = sun;
    sun.position.set(16, 26, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const extent = GRID_SIZE * 0.95;
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  /** Pushes the current time of day into lights, sky, water, clouds and the lit windows. */
  private applyAtmosphere(): void {
    const a = atmosphereAt(this.dayNight.hour, this.atmosphere);
    this.hemisphere.color.copy(a.hemiSky);
    this.hemisphere.groundColor.copy(a.hemiGround);
    this.hemisphere.intensity = a.hemiIntensity;
    this.sun.color.copy(a.sun);
    this.sun.intensity = a.sunIntensity;
    lightPosition(this.dayNight.hour, this.lightPos);
    this.sun.position.set(this.lightPos.x, this.lightPos.y, this.lightPos.z);

    this.clouds.setTone(a.cloud);
    this.props.setNight(a.night);
    this.helperView.setNight(a.night);

    const style = document.documentElement.style;
    style.setProperty('--sky-top', `#${a.skyTop.getHexString()}`);
    style.setProperty('--sky-mid', `#${a.skyMid.getHexString()}`);
    style.setProperty('--sky-bottom', `#${a.skyBottom.getHexString()}`);
  }

  private updateParticles(dt: number): void {
    const camera = this.cameraController.camera;
    const unitsHigh = (camera.top - camera.bottom) / camera.zoom;
    const scale = this.renderer.domElement.height / unitsHigh;
    this.particles.setScale(scale);
    this.fireflies.setScale(scale);
    this.particles.update(dt);
    this.fireflies.update(this.elapsed, this.atmosphere.night);
  }

  private setHovered(tile: TileCoord | null): void {
    if (tile?.i === this.hovered?.i && tile?.j === this.hovered?.j) return;
    this.hovered = tile;
    this.highlight.setHover(tile);
  }

  private handleTap(tile: TileCoord | null): void {
    this.highlight.setSelected(tile);
    this.events.onTileTap?.(tile);
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.cameraController.resize(w, h);
  }

  private lastFrameMs = 0;
  private lastUpdateMs = 0;

  // Adaptive resolution: if the device cannot keep up, trade pixels for smoothness (never back up, to avoid flapping).
  private pixelRatio = Math.min(window.devicePixelRatio, 2);
  private lastStamp = 0;
  private slowMs = 0;
  private slowFrames = 0;
  private warmup = 90;

  private adaptResolution(): void {
    const stamp = performance.now();
    const gap = stamp - this.lastStamp;
    this.lastStamp = stamp;
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    if (gap > 250 || document.hidden) return; // a pause, not slowness
    this.slowMs += gap;
    this.slowFrames++;
    if (this.slowFrames < 45) return;
    const average = this.slowMs / this.slowFrames;
    this.slowMs = 0;
    this.slowFrames = 0;
    if (average > 26 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
      this.warmup = 30;
    }
  }

  private frame(): void {
    const t0 = performance.now();
    this.adaptResolution();
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const now = this.frozenAt ?? Date.now() + this.clockOffset;
    this.elapsed += dt;
    this.cameraController.update(dt);
    this.dayNight.update(dt);
    this.applyAtmosphere();
    this.props.setBarnLevel(this.farm.barn);
    if (this.shownLand !== this.farm.landSize) {
      this.shownLand = this.farm.landSize;
      this.props.setLandSize(this.shownLand);
      this.terrain.refreshLand();
    }
    this.farm.runHelpers(now);
    this.farmView.update(dt, now);
    this.orchardView.update(dt, now);
    this.props.update(dt);
    this.pens.update(dt, now);
    this.helperView.update(dt, now);
    this.decorView.update(dt);
    this.bakeryView.update(dt, now);
    this.deliveryView.update(now, deliveryInterval(this.farm.truck));
    this.clouds.update(dt);
    this.updateParticles(dt);
    this.highlight.update(dt);
    this.events.onFrame?.(now);
    const t1 = performance.now();
    this.renderer.render(this.scene, this.cameraController.camera);
    this.lastUpdateMs = this.lastUpdateMs * 0.9 + (t1 - t0) * 0.1;
    this.lastFrameMs = this.lastFrameMs * 0.9 + (performance.now() - t0) * 0.1;
  }
}
