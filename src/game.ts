import {
  Clock,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  Scene,
  WebGLRenderer,
} from 'three';
import { GRID_SIZE, TileCoord, sameTile } from './core/grid';
import { Clouds } from './render/clouds';
import { TileHighlight } from './render/highlight';
import { IsoCameraController } from './render/iso-camera';
import { TilePicker } from './render/picking';
import { Terrain } from './render/terrain';
import { createToonGradient } from './render/toon';

export interface GameEvents {
  onSelect?: (tile: TileCoord | null) => void;
}

/** Owns the renderer, scene and main loop. Game rules live in src/core. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly clock = new Clock();
  private readonly cameraController: IsoCameraController;
  private readonly picker: TilePicker;
  private readonly highlight = new TileHighlight(GRID_SIZE);
  private readonly clouds: Clouds;
  private readonly resizeObserver: ResizeObserver;

  private hovered: TileCoord | null = null;
  private selected: TileCoord | null = null;
  private running = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly events: GameEvents = {},
  ) {
    // Transparent canvas: the CSS sky gradient shows through behind the island.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    const gradient = createToonGradient(4);
    this.scene.add(new Terrain(GRID_SIZE, gradient).group);
    this.clouds = new Clouds(gradient);
    this.scene.add(this.clouds.group, this.highlight.group);
    this.addLights();

    this.cameraController = new IsoCameraController(this.renderer.domElement, {
      panLimit: GRID_SIZE * 0.45,
    });
    this.picker = new TilePicker(this.cameraController.camera, this.renderer.domElement, GRID_SIZE);

    this.cameraController.onHover = (x, y) => this.setHovered(this.picker.pick(x, y));
    this.cameraController.onHoverEnd = () => this.setHovered(null);
    this.cameraController.onTap = (x, y) => this.setSelected(this.picker.pick(x, y));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
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

  private addLights(): void {
    this.scene.add(new HemisphereLight(0xcfe9ff, 0x9a7a45, 1.05));

    const sun = new DirectionalLight(0xfff0d0, 2.1);
    sun.position.set(16, 26, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const extent = GRID_SIZE * 0.8;
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private setHovered(tile: TileCoord | null): void {
    if (sameTile(tile, this.hovered)) return;
    this.hovered = tile;
    this.highlight.setHover(tile);
  }

  private setSelected(tile: TileCoord | null): void {
    // Tapping the selected tile again, or empty water, clears the selection.
    const next = sameTile(tile, this.selected) ? null : tile;
    this.selected = next;
    this.highlight.setSelected(next);
    this.events.onSelect?.(next);
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.cameraController.resize(w, h);
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.cameraController.update(dt);
    this.clouds.update(dt);
    this.highlight.update(dt);
    this.renderer.render(this.scene, this.cameraController.camera);
  }
}
