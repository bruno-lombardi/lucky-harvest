/**
 * @module render/lights-view
 *
 * The farm lights (luzes da fazenda): fairy lights strung along the fence, lamp posts at the corners and by the path, lanterns at
 * the gate, the barn and the windmill door, each with a soft glow and (for the posts) a pool of light on the grass. They fade in
 * at dusk, follow the player's switch and colour (`farm.lights`, see core/lights.ts) and are purely cosmetic.
 *
 * Cheap on purpose: no real lights, so no per-light shading cost. Bulbs are one instanced mesh, every glow is one additive point
 * pool (shared with the fireflies' shader), the ground pools are one instanced mesh and the wire is one line set. The static set
 * is rebuilt only when the plot grows, because the fence moves with it.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
} from 'three';
import { Farm } from '../core/farm';
import { LIGHT_COLORS } from '../core/lights';
import { BARN, GATE_Z, WINDMILL, Palette, box, fenceHalf } from './props';
import { addHullOutline } from './outline';
import { PointPool, Shape } from './particles';

/** One source of light, whatever it is drawn as. */
interface Source {
  x: number;
  y: number;
  z: number;
  /** World size of the glow sprite. */
  glow: number;
  /** Radius of the pool of light on the ground (0 for none). */
  pool: number;
  /** Which of the colour's bulbs this one takes (colours with several hand them out in turn). */
  slot: number;
  /** Where in its twinkle it starts. */
  phase: number;
  /** Bulb size relative to a fairy light (the door lanterns are bigger). */
  bulb: number;
  /** A lamp-post lantern has its own mesh, so it gets no bulb instance. */
  post: boolean;
}

const WIRE = 0x4a3a2a;
const UNLIT = new Color(0x4a4036);
/** The light's intensity eases toward its target, so switching never pops. */
const FADE_PER_SECOND = 4;

function poolTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Everything the plot's size decides: fairy lights on the fence, the corner posts and the lantern at each gate post. */
function plotSources(size: number): { sources: Source[]; wire: number[] } {
  const H = fenceHalf(size);
  const sources: Source[] = [];
  const wire: number[] = [];
  let slot = 0;

  const corners: ReadonlyArray<readonly [number, number]> = [
    [-H, -H],
    [H, -H],
    [H, H],
    [-H, H],
  ];
  const segments = Math.round(H * 2);
  const BULBS = 3;
  const OUT = 0.07; // hang the string just outside the rails
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side]!;
    const [bx, bz] = corners[(side + 1) % 4]!;
    const nx = side === 1 ? 1 : side === 3 ? -1 : 0;
    const nz = side === 2 ? 1 : side === 0 ? -1 : 0;
    for (let k = 0; k < segments; k++) {
      const point = (t: number): Vector3 => {
        const x = ax + ((bx - ax) * (k + t)) / segments + nx * OUT;
        const z = az + ((bz - az) * (k + t)) / segments + nz * OUT;
        return new Vector3(x, 0.86 - 0.2 * Math.sin(Math.PI * t), z);
      };
      // The gate side has no fence across the opening (the gate is on side 3, around GATE_Z).
      const mid = point(0.5);
      if (side === 3 && Math.abs(mid.z - GATE_Z) < 1.1) continue;
      let prev = point(0);
      for (let s = 1; s <= 6; s++) {
        const next = point(s / 6);
        wire.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
        prev = next;
      }
      for (let n = 0; n < BULBS; n++) {
        const p = point((n + 0.5) / BULBS);
        sources.push({ x: p.x, y: p.y - 0.05, z: p.z, glow: 0.5, pool: 0, slot: slot++, phase: (slot * 2.399) % 6.283, bulb: 1, post: false });
      }
    }
  }

  // Lamp posts just outside the corners (the north-east one would stand in the windmill, so it steps back along the fence).
  for (const [cx, cz] of corners) {
    let x = cx + Math.sign(cx) * 0.4;
    const z = cz + Math.sign(cz) * 0.4;
    if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 1.9) x -= 1.2;
    sources.push({ x, y: 1.55, z, glow: 1.7, pool: 1.5, slot: slot++, phase: 0, bulb: 1, post: true });
  }

  // A lantern on each gate post.
  for (const z of [GATE_Z - 1.05, GATE_Z + 1.05]) {
    sources.push({ x: -H, y: 1.12, z, glow: 0.9, pool: 0.9, slot: slot++, phase: 1.3, bulb: 1.7, post: false });
  }
  return { sources, wire };
}

/** Lights that stay where they are however big the plot is: the path, the barn door and the windmill door. */
function fixedSources(size: number): Source[] {
  const H = fenceHalf(size);
  const out: Source[] = [];
  let slot = 100;
  // A post across the path from the old lamp, between the gate and the barn.
  out.push({ x: -(H + 1.2), y: 1.55, z: GATE_Z + 1.5, glow: 1.7, pool: 1.5, slot: slot++, phase: 0, bulb: 1, post: true });
  // The barn faces +x (see Props); its doors are 1.9 wide and 1.58 high.
  for (const dz of [-1.2, 1.2]) {
    out.push({ x: BARN.x + 1.5, y: 1.55, z: BARN.z + dz, glow: 1.1, pool: 1.0, slot: slot++, phase: 2.1, bulb: 1.7, post: false });
  }
  // The windmill's door looks toward the camera (45 degrees).
  out.push({ x: WINDMILL.x + 0.78, y: 1.2, z: WINDMILL.z + 0.78, glow: 1.0, pool: 1.0, slot: slot++, phase: 0.7, bulb: 1.7, post: false });
  return out;
}

export class LightsView {
  readonly group = new Group();

  private size = 0;
  private sources: Source[] = [];
  private pool: PointPool | null = null;
  private bulbs: InstancedMesh | null = null;
  private pools: InstancedMesh | null = null;
  private wire: LineSegments | null = null;
  private posts: Group | null = null;
  private readonly lanternGlass: MeshBasicMaterial[] = [];

  private readonly bulbGeometry = new SphereGeometry(0.06, 7, 5);
  private readonly poolGeometry = new CircleGeometry(1, 28).rotateX(-Math.PI / 2);
  private readonly poolMap = poolTexture();
  private readonly palette: Palette;
  private readonly scratch = new Color();
  private readonly lit = new Color();
  private scale = 60;
  private level = 0;
  private time = 0;
  private styleKey = '';

  constructor(
    private readonly farm: Farm,
    gradientMap: DataTexture,
  ) {
    this.palette = new Palette(gradientMap);
  }

  /** Pixels per world unit, like the particles (the glow sprites are sized in screen pixels). */
  setScale(pixelsPerUnit: number): void {
    this.scale = pixelsPerUnit;
    this.pool?.setScale(pixelsPerUnit);
  }

  /** The 0..1 brightness right now (for tests and for the UI to know whether the lights are glowing). */
  get intensity(): number {
    return this.level;
  }

  /** `night` is 0 in daylight and 1 in the dead of night, as in `atmosphereAt`. */
  update(dt: number, night: number): void {
    this.time += dt;
    if (this.farm.landSize !== this.size) this.rebuild(this.farm.landSize);

    const { on, color } = this.farm.lights;
    const target = on ? smooth((night - 0.12) / 0.5) : 0;
    this.level += (target - this.level) * Math.min(1, dt * FADE_PER_SECOND);
    if (Math.abs(target - this.level) < 0.003) this.level = target;

    const visible = this.level > 0.01;
    // By day the fixtures stay (dull glass on a wire), only the glow goes.
    if (this.pool) this.pool.points.visible = visible;
    if (this.pools) this.pools.visible = visible;
    if (!this.pool) return;

    const bulbColors = LIGHT_COLORS[color].bulbs;
    const key = `${color}|${this.level.toFixed(3)}`;
    const colorsChanged = key !== this.styleKey;
    this.styleKey = key;

    const { position, size, color: rgba } = this.pool;
    for (let i = 0; i < this.sources.length; i++) {
      const s = this.sources[i]!;
      this.lit.setHex(bulbColors[s.slot % bulbColors.length]!);
      // A slow twinkle, never dark: it just keeps the strings alive.
      const twinkle = s.pool > 0 ? 1 : 0.82 + 0.18 * Math.sin(this.time * 1.7 + s.phase * 3);
      position[i * 3] = s.x;
      position[i * 3 + 1] = s.y;
      position[i * 3 + 2] = s.z;
      size[i] = s.glow;
      rgba[i * 4] = this.lit.r;
      rgba[i * 4 + 1] = this.lit.g;
      rgba[i * 4 + 2] = this.lit.b;
      rgba[i * 4 + 3] = visible ? this.level * 0.8 * twinkle : 0;
    }
    this.pool.upload();

    if (colorsChanged) this.paintFixtures(bulbColors);
  }

  /** Colours the bulbs, the lantern glass and the ground pools for the current colour and brightness. */
  private paintFixtures(bulbColors: readonly number[]): void {
    let bulb = 0;
    let post = 0;
    let ground = 0;
    for (const s of this.sources) {
      this.lit.setHex(bulbColors[s.slot % bulbColors.length]!);
      this.scratch.copy(UNLIT).lerp(this.lit, this.level);
      if (!s.post && this.bulbs) this.bulbs.setColorAt(bulb++, this.scratch);
      if (s.post) this.lanternGlass[post++]?.color.copy(this.scratch);
      if (s.pool > 0 && this.pools) this.pools.setColorAt(ground++, this.lit);
    }
    if (this.bulbs?.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
    if (this.pools?.instanceColor) this.pools.instanceColor.needsUpdate = true;
    if (this.pools) (this.pools.material as MeshBasicMaterial).opacity = this.level * 0.5;
  }

  private clear(): void {
    for (const child of [...this.group.children]) this.group.remove(child);
    this.pool?.dispose();
    this.pool = null;
    this.bulbs?.dispose();
    this.pools?.dispose();
    this.wire?.geometry.dispose();
    this.posts?.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    this.bulbs = this.pools = null;
    this.wire = null;
    this.posts = null;
    this.lanternGlass.length = 0;
  }

  private rebuild(size: number): void {
    this.clear();
    this.size = size;
    const plot = plotSources(size);
    this.sources = [...plot.sources, ...fixedSources(size)];
    this.styleKey = '';

    // Wire: one line set along the fence.
    const wireGeometry = new BufferGeometry();
    wireGeometry.setAttribute('position', new Float32BufferAttribute(plot.wire, 3));
    this.wire = new LineSegments(wireGeometry, new LineBasicMaterial({ color: WIRE }));
    this.wire.frustumCulled = false;
    this.group.add(this.wire);

    // Bulbs: every source that is not a lamp-post lantern.
    const bulbSources = this.sources.filter((s) => !s.post);
    const bulbMaterial = new MeshBasicMaterial({ color: 0xffffff });
    this.bulbs = new InstancedMesh(this.bulbGeometry, bulbMaterial, Math.max(1, bulbSources.length));
    this.bulbs.count = bulbSources.length;
    const m = new Matrix4();
    bulbSources.forEach((s, i) => {
      m.makeScale(s.bulb, s.bulb, s.bulb).setPosition(s.x, s.y, s.z);
      this.bulbs!.setMatrixAt(i, m);
      this.bulbs!.setColorAt(i, UNLIT);
    });
    this.bulbs.instanceMatrix.needsUpdate = true;
    this.bulbs.frustumCulled = false;
    this.group.add(this.bulbs);

    // Lamp posts: wood, an arm, and a lantern whose glass is lit by the colour.
    this.posts = new Group();
    for (const s of this.sources.filter((src) => src.post)) {
      const post = new Group();
      post.position.set(s.x, 0, s.z);
      post.add(box(this.palette, 0x6b4423, 0.12, 1.45, 0.12, 0, 0.725, 0, 0.014));
      post.add(box(this.palette, 0x6b4423, 0.22, 0.06, 0.22, 0, 0.04, 0, 0.01));
      const glass = new MeshBasicMaterial({ color: UNLIT });
      this.lanternGlass.push(glass);
      const lantern = new Mesh(new SphereGeometry(0.15, 10, 8), glass);
      lantern.scale.set(1, 1.25, 1);
      lantern.position.set(0, 1.55 - 0.0, 0);
      addHullOutline(lantern, 0.014);
      post.add(lantern);
      const cap = new Mesh(new ConeGeometry(0.2, 0.15, 4), this.palette.toon(0x3b2a20));
      cap.position.set(0, 1.84, 0);
      cap.rotation.y = Math.PI / 4;
      cap.castShadow = true;
      post.add(cap);
      this.posts.add(post);
    }
    this.group.add(this.posts);

    // Pools of light on the ground (additive, tinted per instance, opacity follows the brightness).
    const pooled = this.sources.filter((s) => s.pool > 0);
    const poolMaterial = new MeshBasicMaterial({
      ...(this.poolMap ? { map: this.poolMap } : {}),
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    this.pools = new InstancedMesh(this.poolGeometry, poolMaterial, Math.max(1, pooled.length));
    this.pools.count = pooled.length;
    pooled.forEach((s, i) => {
      m.makeScale(s.pool, 1, s.pool).setPosition(s.x, 0.06, s.z);
      this.pools!.setMatrixAt(i, m);
      this.pools!.setColorAt(i, UNLIT);
    });
    this.pools.instanceMatrix.needsUpdate = true;
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 7;
    this.pools.visible = false;
    this.group.add(this.pools);

    // Glows: one additive point pool for every source.
    this.pool = new PointPool(this.sources.length, true);
    this.pool.setScale(this.scale);
    for (let i = 0; i < this.sources.length; i++) this.pool.shape[i] = Shape.Glow;
    this.pool.points.visible = false;
    this.group.add(this.pool.points);
  }

  /** How many sources the lights have right now (tests and tuning). */
  get count(): number {
    return this.sources.length;
  }
}
