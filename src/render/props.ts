import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DodecahedronGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { mulberry32 } from '../core/noise';
import { addHullOutline, addInstancedHullOutline } from './outline';

/**
 * All the decoration around the farm. Everything is procedural and lives on the outer ring of the
 * island (and just outside the plot fence), so later land expansion has room to grow.
 * World axes: the camera looks from +x,+z, so -x,-z is "behind" the plot.
 */

/** The fence stands this far outside the plot's edge tiles. */
const FENCE_MARGIN = 0.45;
const GATE_Z = 1.0;

export const BARN = { x: -9.6, z: 1.0 };
const WINDMILL = { x: 7.8, z: -8.2 };
const POND = { x: -6.2, z: 8.2, radius: 2.0 };
const SCARECROW = { x: 6.5, z: 1.6 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Window glass: dark by day, glowing warm yellow at night (see Props.setNight). */
const GLASS_DAY = new Color(0x3e5470);
const GLASS_NIGHT = new Color(0xffd36a);

export class Palette {
  readonly glass = new MeshBasicMaterial({ color: GLASS_DAY });
  private readonly cache = new Map<string, MeshToonMaterial>();
  constructor(private readonly gradientMap: DataTexture) {}

  toon(color: number): MeshToonMaterial {
    const key = String(color);
    let m = this.cache.get(key);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap });
      this.cache.set(key, m);
    }
    return m;
  }
}

export function box(
  palette: Palette,
  color: number,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  outline = 0.018,
): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), color < 0 ? palette.glass : palette.toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline > 0) addHullOutline(m, outline);
  return m;
}

export function matrix(
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  ry = 0,
): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry),
    new Vector3(sx, sy, sz),
  );
}

export function instanced(
  geometry: BufferGeometry,
  material: MeshToonMaterial,
  matrices: Matrix4[],
  colors?: Color[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(matrices.length, 1));
  mesh.count = matrices.length;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  colors?.forEach((c, i) => mesh.setColorAt(i, c));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Fence and gate
// ---------------------------------------------------------------------------

function buildFence(palette: Palette, FENCE_HALF: number): Group {
  const group = new Group();
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-FENCE_HALF, -FENCE_HALF],
    [FENCE_HALF, -FENCE_HALF],
    [FENCE_HALF, FENCE_HALF],
    [-FENCE_HALF, FENCE_HALF],
  ];
  const segments = Math.round(FENCE_HALF * 2);
  const postMatrices: Matrix4[] = [];
  const capMatrices: Matrix4[] = [];
  const railMatrices: Matrix4[] = [];

  // The gate sits on the -x side (the side facing the barn), which runs from corner 3 to corner 0.
  const inGate = (side: number, x: number, z: number, margin: number): boolean =>
    side === 3 && x < 0 && Math.abs(z - GATE_Z) < margin;

  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side]!;
    const [bx, bz] = corners[(side + 1) % 4]!;
    for (let k = 0; k < segments; k++) {
      const x0 = ax + ((bx - ax) * k) / segments;
      const z0 = az + ((bz - az) * k) / segments;
      const x1 = ax + ((bx - ax) * (k + 1)) / segments;
      const z1 = az + ((bz - az) * (k + 1)) / segments;

      if (!inGate(side, x0, z0, 0.55)) {
        postMatrices.push(matrix(x0, 0.35, z0));
        capMatrices.push(matrix(x0, 0.76, z0));
      }
      if (inGate(side, (x0 + x1) / 2, (z0 + z1) / 2, 1.05)) continue;

      const len = Math.hypot(x1 - x0, z1 - z0);
      const angle = -Math.atan2(z1 - z0, x1 - x0);
      for (const y of [0.3, 0.55]) {
        railMatrices.push(matrix((x0 + x1) / 2, y, (z0 + z1) / 2, len, 1, 1, angle));
      }
    }
  }

  const posts = instanced(new BoxGeometry(0.13, 0.7, 0.13), palette.toon(0xc58e52), postMatrices);
  addInstancedHullOutline(posts, 0.016);
  const capGeometry = new ConeGeometry(0.11, 0.13, 4);
  capGeometry.rotateY(Math.PI / 4);
  const caps = instanced(capGeometry, palette.toon(0xd9a566), capMatrices);
  addInstancedHullOutline(caps, 0.014);
  const rails = instanced(new BoxGeometry(1, 0.075, 0.055), palette.toon(0xe0b070), railMatrices);
  addInstancedHullOutline(rails, 0.014);
  group.add(posts, caps, rails);

  // Gate: two taller posts and a leaf swung half open.
  const gatePostZ = [GATE_Z - 1.05, GATE_Z + 1.05];
  for (const z of gatePostZ) {
    group.add(box(palette, 0xb07a40, 0.17, 0.95, 0.17, -FENCE_HALF, 0.475, z));
    const knob = new Mesh(new SphereGeometry(0.1, 10, 8), palette.toon(0xd9a566));
    knob.position.set(-FENCE_HALF, 1.0, z);
    knob.castShadow = true;
    group.add(knob);
  }
  const leaf = new Group();
  leaf.position.set(-FENCE_HALF, 0, GATE_Z + 1.0);
  leaf.rotation.y = 0.9;
  for (const y of [0.25, 0.5, 0.75]) leaf.add(box(palette, 0xe0b070, 0.06, 0.08, 1.9, 0, y, -0.95, 0.012));
  leaf.add(box(palette, 0xc58e52, 0.06, 0.62, 0.09, 0, 0.5, -0.05, 0.012));
  leaf.add(box(palette, 0xc58e52, 0.06, 0.62, 0.09, 0, 0.5, -1.85, 0.012));
  group.add(leaf);
  return group;
}

function buildPath(palette: Palette, fenceHalf: number): Group {
  const rand = mulberry32(77);
  // Stepping stones run from the gate to the barn, then branch off toward the pond.
  const spots: Array<[number, number]> = [];
  for (let x = -(fenceHalf + 0.35), n = 0; x > -7.5; x -= 0.6, n++) {
    spots.push([x, GATE_Z + (n % 2 === 0 ? 0.08 : -0.1)]);
  }
  spots.push([-6.7, 3.3], [-6.45, 4.1], [-6.3, 5.0], [-6.4, 5.9]);
  const matrices = spots.map(([x, z]) => matrix(x, 0.035, z, 0.34 + rand() * 0.1, 1, 0.3 + rand() * 0.1, rand() * 3));
  const colors = spots.map(() => new Color().setHSL(0.1, 0.12, 0.7 + rand() * 0.1));
  const stones = instanced(new CylinderGeometry(1, 1.06, 0.07, 9), palette.toon(0xffffff), matrices, colors);
  stones.castShadow = false;
  addInstancedHullOutline(stones, 0.02);
  const group = new Group();
  group.add(stones);
  return group;
}

// ---------------------------------------------------------------------------
// Barn
// ---------------------------------------------------------------------------

function buildBarn(palette: Palette): Group {
  const barn = new Group();
  const red = 0xc4372c;
  const white = 0xf6efe0;

  const shape = new Shape();
  shape.moveTo(-1.6, 0);
  shape.lineTo(1.6, 0);
  shape.lineTo(1.6, 2.0);
  shape.lineTo(0, 3.05);
  shape.lineTo(-1.6, 2.0);
  shape.closePath();
  const bodyGeometry = new ExtrudeGeometry(shape, { depth: 2.8, bevelEnabled: false });
  bodyGeometry.translate(0, 0, -1.4);
  const body = new Mesh(bodyGeometry, palette.toon(red));
  body.castShadow = true;
  body.receiveShadow = true;
  addHullOutline(body, 0.03);
  barn.add(body);

  // Roof: two slabs meeting at the ridge, with a little overhang.
  const slope = Math.atan2(1.05, 1.6);
  const roofLength = Math.hypot(1.6, 1.05) + 0.3;
  for (const side of [-1, 1]) {
    const slab = box(palette, 0x6a4b42, roofLength, 0.14, 3.15, side * 0.83, 2.6, 0, 0.025);
    slab.rotation.z = -side * slope;
    barn.add(slab);
  }
  barn.add(box(palette, 0x8a6558, 0.16, 0.12, 3.2, 0, 3.12, 0, 0.02));

  // Front (+z) face: big doors with white braces, frame, and a hay-loft hatch.
  const z = 1.41;
  barn.add(box(palette, white, 1.9, 0.12, 0.08, 0, 1.58, z, 0.012)); // lintel
  barn.add(box(palette, white, 0.12, 1.58, 0.08, -0.95, 0.79, z, 0.012));
  barn.add(box(palette, white, 0.12, 1.58, 0.08, 0.95, 0.79, z, 0.012));
  for (const side of [-1, 1]) {
    barn.add(box(palette, 0xa42a21, 0.8, 1.46, 0.06, side * 0.43, 0.76, z - 0.02, 0.01));
    for (const dir of [-1, 1]) {
      const brace = box(palette, white, 0.07, 1.7, 0.05, side * 0.43, 0.76, z + 0.02, 0);
      brace.rotation.z = dir * 0.5;
      barn.add(brace);
    }
  }
  barn.add(box(palette, white, 0.78, 0.7, 0.08, 0, 2.25, z, 0.012));
  barn.add(box(palette, -1, 0.58, 0.5, 0.09, 0, 2.25, z + 0.01, 0));
  barn.add(box(palette, 0xe9c25a, 0.36, 0.12, 0.1, 0.04, 2.1, z + 0.04, 0));

  // Rake boards along the gable edge.
  for (const side of [-1, 1]) {
    const trim = box(palette, white, roofLength - 0.1, 0.09, 0.08, side * 0.8, 2.52, z + 0.03, 0.01);
    trim.rotation.z = -side * slope;
    barn.add(trim);
  }

  // Side windows on both long walls.
  for (const side of [-1, 1]) {
    for (const zz of [-0.55, 0.55]) {
      barn.add(box(palette, white, 0.08, 0.62, 0.62, side * 1.62, 1.15, zz, 0.01));
      barn.add(box(palette, -1, 0.09, 0.44, 0.44, side * 1.63, 1.15, zz, 0));
    }
  }
  // Corner boards.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      barn.add(box(palette, white, 0.12, 2.0, 0.12, sx * 1.6, 1.0, sz * 1.4, 0.01));
    }
  }
  return barn;
}

function glowTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,230,150,1)');
  g.addColorStop(0.35, 'rgba(255,200,90,0.45)');
  g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A lantern on a post beside the path to the barn. The glow sprite is switched on by setNight(). */
function glowMap(): { map?: CanvasTexture } {
  const map = glowTexture();
  return map ? { map } : {};
}

function buildLamp(palette: Palette): { group: Group; glow: Sprite } {
  const group = new Group();
  group.add(box(palette, 0x6b4423, 0.1, 1.5, 0.1, 0, 0.75, 0, 0.014));
  group.add(box(palette, 0x6b4423, 0.34, 0.05, 0.05, 0.1, 1.45, 0, 0.01));
  const lantern = new Group();
  lantern.position.set(0.24, 1.3, 0);
  lantern.add(box(palette, -1, 0.17, 0.22, 0.17, 0, 0, 0, 0.012));
  const roof = new Mesh(new ConeGeometry(0.17, 0.14, 4), palette.toon(0x3b2a20));
  roof.position.y = 0.17;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  lantern.add(roof);
  const glow = new Sprite(
    new SpriteMaterial({ ...glowMap(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
  );
  glow.scale.set(1.5, 1.5, 1);
  glow.visible = false;
  glow.renderOrder = 9;
  lantern.add(glow);
  group.add(lantern);
  return { group, glow };
}

function buildHay(palette: Palette): Group {
  const group = new Group();
  const spots: ReadonlyArray<readonly [number, number, number, number]> = [
    [-7.1, 0.28, 4.0, 0.3],
    [-7.9, 0.28, 4.4, -0.2],
    [-7.5, 0.82, 4.15, 0.1],
  ];
  const geometry = new CylinderGeometry(0.42, 0.42, 0.6, 14);
  geometry.rotateZ(Math.PI / 2);
  for (const [x, y, z, rot] of spots) {
    const bale = new Mesh(geometry, palette.toon(0xe3b84e));
    bale.position.set(x, y, z);
    bale.rotation.y = rot;
    bale.castShadow = true;
    bale.receiveShadow = true;
    addHullOutline(bale, 0.02);
    const band = new Mesh(new CylinderGeometry(0.435, 0.435, 0.06, 14), palette.toon(0x9b7a2c));
    band.rotation.z = Math.PI / 2;
    bale.add(band);
    const band2 = band.clone();
    band2.position.y = 0.0;
    band.position.x = -0.16;
    band2.position.x = 0.16;
    bale.add(band2);
    group.add(bale);
  }
  return group;
}

// ---------------------------------------------------------------------------
// Windmill
// ---------------------------------------------------------------------------

function buildWindmill(palette: Palette): { group: Group; blades: Group } {
  const group = new Group();
  const tower = new Mesh(new CylinderGeometry(0.62, 0.95, 3.2, 12), palette.toon(0xf2e6cc));
  tower.position.y = 1.6;
  tower.castShadow = true;
  tower.receiveShadow = true;
  addHullOutline(tower, 0.03);
  group.add(tower);

  const base = new Mesh(new CylinderGeometry(1.0, 1.08, 0.7, 12), palette.toon(0xb86a4a));
  base.position.y = 0.35;
  base.castShadow = true;
  addHullOutline(base, 0.03);
  group.add(base);

  const cap = new Mesh(new ConeGeometry(0.85, 1.0, 12), palette.toon(0xb23a2e));
  cap.position.y = 3.7;
  cap.castShadow = true;
  addHullOutline(cap, 0.03);
  group.add(cap);

  // Door and windows on the camera-facing side.
  const facing = new Group();
  facing.rotation.y = Math.PI / 4;
  facing.add(box(palette, 0x7a4a2a, 0.5, 0.9, 0.12, 0, 0.45, 0.93, 0.012));
  facing.add(box(palette, 0xf6efe0, 0.4, 0.4, 0.1, 0, 2.0, 0.66, 0.01));
  facing.add(box(palette, -1, 0.28, 0.28, 0.11, 0, 2.0, 0.67, 0));
  group.add(facing);

  // Sails: a hub on the camera-facing side with four lattice arms.
  const hub = new Group();
  hub.position.set(0, 3.2, 0);
  hub.rotation.y = Math.PI / 4;
  const spinner = new Group();
  spinner.position.z = 0.95;
  const hubCap = new Mesh(new SphereGeometry(0.2, 12, 10), palette.toon(0x7a4a2a));
  hubCap.castShadow = true;
  spinner.add(hubCap);
  for (let k = 0; k < 4; k++) {
    const arm = new Group();
    arm.rotation.z = (k * Math.PI) / 2;
    arm.add(box(palette, 0x8a5a34, 0.1, 2.5, 0.08, 0, 1.3, 0, 0.012));
    arm.add(box(palette, 0xf6efe0, 0.52, 1.5, 0.04, 0.3, 1.45, 0.02, 0.012));
    for (const y of [0.9, 1.45, 2.0]) arm.add(box(palette, 0x8a5a34, 0.56, 0.05, 0.05, 0.3, y, 0.03, 0));
    spinner.add(arm);
  }
  hub.add(spinner);
  group.add(hub);
  return { group, blades: spinner };
}

// ---------------------------------------------------------------------------
// Scarecrow, sign, pond
// ---------------------------------------------------------------------------

function buildScarecrow(palette: Palette): Group {
  const g = new Group();
  const post = new Mesh(new CylinderGeometry(0.04, 0.05, 1.5, 7), palette.toon(0x8a5a34));
  post.position.y = 0.75;
  post.castShadow = true;
  g.add(post);
  g.add(box(palette, 0x8a5a34, 1.15, 0.07, 0.07, 0, 1.0, 0, 0.012));
  const shirt = new Mesh(new CylinderGeometry(0.2, 0.27, 0.52, 10), palette.toon(0x3b7fc4));
  shirt.position.y = 0.88;
  shirt.castShadow = true;
  addHullOutline(shirt, 0.02);
  g.add(shirt);
  g.add(box(palette, 0xf2c84b, 0.14, 0.14, 0.04, 0.12, 0.92, 0.2, 0.01)); // patch
  const head = new Mesh(new SphereGeometry(0.19, 14, 12), palette.toon(0xe8d29a));
  head.position.y = 1.4;
  head.castShadow = true;
  addHullOutline(head, 0.016);
  g.add(head);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.025, 8, 6), palette.toon(0x2b1a10));
    eye.position.set(side * 0.07, 1.43, 0.17);
    g.add(eye);
  }
  const hatBrim = new Mesh(new CylinderGeometry(0.3, 0.3, 0.04, 14), palette.toon(0x7a5230));
  hatBrim.position.y = 1.55;
  addHullOutline(hatBrim, 0.014);
  g.add(hatBrim);
  const hatTop = new Mesh(new CylinderGeometry(0.14, 0.18, 0.2, 12), palette.toon(0x7a5230));
  hatTop.position.y = 1.67;
  addHullOutline(hatTop, 0.014);
  g.add(hatTop);
  for (const [x, y, rz] of [
    [-0.62, 1.0, 1.4],
    [0.62, 1.0, -1.4],
    [-0.1, 0.6, 3.1],
    [0.14, 0.62, 3.0],
  ] as const) {
    const straw = new Mesh(new ConeGeometry(0.07, 0.24, 6), palette.toon(0xf0cd5a));
    straw.position.set(x, y, 0);
    straw.rotation.z = rz;
    g.add(straw);
  }
  return g;
}

function paintSign(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, 512, 192);
  const wood = ctx.createLinearGradient(0, 0, 0, 192);
  wood.addColorStop(0, '#d9a566');
  wood.addColorStop(1, '#b57a3c');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = 'rgba(90,50,20,0.28)';
  ctx.lineWidth = 3;
  for (let y = 40; y < 192; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  let size = 84;
  const family = '"Fredoka Variable", "Fredoka", "Trebuchet MS", Verdana, sans-serif';
  ctx.font = `700 ${size}px ${family}`;
  while (ctx.measureText(text).width > 380 && size > 24) {
    size -= 4;
    ctx.font = `700 ${size}px ${family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#5b3517';
  ctx.strokeText(text, 256, 100);
  ctx.fillStyle = '#fff3d0';
  ctx.fillText(text, 256, 100);
}

function signTexture(text: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  if (!canvas.getContext('2d')) return null;
  paintSign(canvas, text);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Repaint once the web font is ready so the sign never keeps the fallback face.
  void document.fonts?.load('700 40px "Fredoka Variable"').then(() => {
    paintSign(canvas, text);
    texture.needsUpdate = true;
  });
  return texture;
}

function buildSign(palette: Palette): Group {
  const g = new Group();
  for (const x of [-0.62, 0.62]) g.add(box(palette, 0x8a5a34, 0.12, 1.05, 0.12, x, 0.52, 0, 0.012));
  const board = box(palette, 0xc58e52, 1.55, 0.58, 0.09, 0, 0.82, 0, 0.02);
  g.add(board);
  const texture = signTexture('Lucky Harvest');
  const face = new Mesh(
    new PlaneGeometry(1.45, 0.54),
    texture ? new MeshBasicMaterial({ map: texture }) : new MeshBasicMaterial({ color: 0xd9a566 }),
  );
  face.position.set(0, 0.82, 0.051);
  g.add(face);
  return g;
}

function buildPond(palette: Palette): Group {
  const g = new Group();
  const sand = new Mesh(new CylinderGeometry(POND.radius + 0.4, POND.radius + 0.45, 0.06, 28), palette.toon(0xe9d6a4));
  sand.position.y = 0.03;
  sand.receiveShadow = true;
  g.add(sand);

  const water = new Mesh(
    new CylinderGeometry(POND.radius, POND.radius, 0.05, 28),
    new MeshToonMaterial({ color: 0x4fc7e8, emissive: 0x0d4d66, gradientMap: palette.toon(0x4fc7e8).gradientMap }),
  );
  water.position.y = 0.065;
  g.add(water);
  const shine = new Mesh(new CylinderGeometry(POND.radius * 0.55, POND.radius * 0.55, 0.01, 24), new MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.35 }));
  shine.position.set(-0.35, 0.095, -0.25);
  shine.scale.set(1, 1, 0.55);
  g.add(shine);

  const rand = mulberry32(31);
  for (let n = 0; n < 5; n++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * (POND.radius - 0.55);
    const pad = new Mesh(new CylinderGeometry(0.24, 0.24, 0.03, 12), palette.toon(0x3f9a45));
    pad.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    g.add(pad);
    if (n === 1 || n === 3) {
      const flower = new Mesh(new SphereGeometry(0.1, 10, 8), palette.toon(n === 1 ? 0xff8fb8 : 0xffffff));
      flower.position.set(pad.position.x, 0.17, pad.position.z);
      flower.scale.y = 0.75;
      g.add(flower);
    }
  }
  // Reeds and cattails on the shore, and a few stones.
  for (let n = 0; n < 8; n++) {
    const a = 0.2 + n * 0.28;
    const r = POND.radius + 0.18 + rand() * 0.25;
    const reed = new Group();
    reed.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.6 + rand() * 0.45;
    const blade = new Mesh(new CylinderGeometry(0.018, 0.026, h, 5), palette.toon(0x5aa840));
    blade.position.y = h / 2;
    reed.add(blade);
    const head = new Mesh(new CylinderGeometry(0.045, 0.045, 0.2, 7), palette.toon(0x7a4a2a));
    head.position.y = h + 0.05;
    reed.add(head);
    reed.rotation.set((rand() - 0.5) * 0.25, 0, (rand() - 0.5) * 0.25);
    g.add(reed);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Trees, bushes and rocks
// ---------------------------------------------------------------------------

type Spot = { x: number; z: number; s: number; rot: number };

/** A low-poly ball with per-face normals, so toon shading shows crisp facets. */
function faceted(): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 1);
  geometry.computeVertexNormals(); // non-indexed, so this yields flat face normals
  return geometry;
}

function scatter(
  rand: () => number,
  count: number,
  minSpacing: number,
  taken: Spot[],
  allowed: (x: number, z: number) => boolean,
  extent: number,
): Spot[] {
  const out: Spot[] = [];
  let attempts = 0;
  while (out.length < count && attempts++ < count * 80) {
    const x = (rand() * 2 - 1) * extent;
    const z = (rand() * 2 - 1) * extent;
    if (!allowed(x, z)) continue;
    if ([...taken, ...out].some((p) => Math.hypot(p.x - x, p.z - z) < minSpacing)) continue;
    out.push({ x, z, s: 0.8 + rand() * 0.55, rot: rand() * Math.PI * 2 });
  }
  return out;
}

export interface ForestOptions {
  seed: number;
  /** Candidates are drawn from the square [-extent, extent]. */
  extent: number;
  trees: number;
  bushes: number;
  rocks: number;
  /** Where something may stand. */
  free: (x: number, z: number) => boolean;
}

/** The trees, bushes and rocks between the fence and the countryside road. */
function buildFarmEdge(palette: Palette): Group {
  const free = (x: number, z: number): boolean => {
    if (Math.max(Math.abs(x), Math.abs(z)) < 6.7) return false; // fence + path clearance
    if (Math.hypot(x - BARN.x, z - BARN.z) < 3.6) return false;
    if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 3.0) return false;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 1.3) return false;
    if (Math.hypot(x - SCARECROW.x, z - SCARECROW.z) < 1.6) return false;
    if (x < -6 && x > -8.6 && z > 2.5 && z < 6.6) return false; // hay + path to the pond
    if (x > 7.0 && z > -5.6 && z < 7.8) return false; // animal pens
    return true;
  };
  return buildForest(palette, { seed: 9001, extent: 11.2, trees: 30, bushes: 22, rocks: 10, free });
}

/** Scatters and models a patch of woodland. Used inside the farm edge and out in the countryside. */
export function buildForest(palette: Palette, options: ForestOptions): Group {
  const group = new Group();
  const rand = mulberry32(options.seed);
  const { free, extent } = options;

  const trees = scatter(rand, options.trees, 1.9, [], free, extent);
  const bushes = scatter(rand, options.bushes, 1.0, trees, free, extent);
  const rocks = scatter(rand, options.rocks, 1.2, [...trees, ...bushes], free, extent);

  const trunkM: Matrix4[] = [];
  const crownM: Matrix4[] = [];
  const crownC: Color[] = [];
  const pineM: Matrix4[] = [];
  const pineC: Color[] = [];
  const appleM: Matrix4[] = [];
  const bushM: Matrix4[] = [];
  const bushC: Color[] = [];
  const berryM: Matrix4[] = [];
  const rockM: Matrix4[] = [];
  const rockC: Color[] = [];

  const rot = (s: Spot, ox: number, oz: number): [number, number] => [
    s.x + (ox * Math.cos(s.rot) + oz * Math.sin(s.rot)) * s.s,
    s.z + (-ox * Math.sin(s.rot) + oz * Math.cos(s.rot)) * s.s,
  ];

  trees.forEach((t, n) => {
    const kind = n % 10 < 5 ? 'oak' : n % 10 < 7 ? 'apple' : 'pine';
    if (kind === 'pine') {
      trunkM.push(matrix(t.x, 0.3 * t.s, t.z, 0.14 * t.s, 0.6 * t.s, 0.14 * t.s));
      const layers: ReadonlyArray<readonly [number, number, number]> = [
        [0.62, 0.55, 0.78],
        [1.0, 0.45, 0.68],
        [1.36, 0.33, 0.6],
      ];
      for (const [y, r, h] of layers) {
        pineM.push(matrix(t.x, y * t.s + h * t.s * 0.45, t.z, r * t.s * 1.25, h * t.s, r * t.s * 1.25, t.rot));
        pineC.push(new Color().setHSL(0.37 + rand() * 0.03, 0.55, 0.26 + rand() * 0.06));
      }
      return;
    }
    trunkM.push(matrix(t.x, 0.4 * t.s, t.z, 0.17 * t.s, 0.8 * t.s, 0.17 * t.s));
    const crowns: ReadonlyArray<readonly [number, number, number, number]> = [
      [0, 1.15, 0, 0.66],
      [0.42, 0.95, 0.14, 0.48],
      [-0.36, 0.9, -0.22, 0.5],
      [0.04, 1.62, -0.04, 0.46],
    ];
    const hue = 0.27 + rand() * 0.04;
    for (const [ox, oy, oz, r] of crowns) {
      const [cx, cz] = rot(t, ox, oz);
      crownM.push(matrix(cx, oy * t.s, cz, r * t.s, r * t.s * 0.92, r * t.s));
      crownC.push(new Color().setHSL(hue, 0.58, 0.4 + rand() * 0.07));
    }
    if (kind === 'apple') {
      for (let a = 0; a < 6; a++) {
        const ang = rand() * Math.PI * 2;
        const [ax, az] = rot(t, Math.cos(ang) * 0.62, Math.sin(ang) * 0.62);
        appleM.push(matrix(ax, (0.95 + rand() * 0.5) * t.s, az, 0.09 * t.s, 0.09 * t.s, 0.09 * t.s));
      }
    }
  });

  bushes.forEach((b) => {
    const blobs = 2 + Math.floor(rand() * 2);
    const hue = 0.26 + rand() * 0.05;
    const berried = rand() < 0.4;
    for (let k = 0; k < blobs; k++) {
      const r = (0.26 + rand() * 0.12) * b.s;
      const x = b.x + (rand() - 0.5) * 0.5;
      const z = b.z + (rand() - 0.5) * 0.5;
      bushM.push(matrix(x, r * 0.75, z, r, r * 0.8, r));
      bushC.push(new Color().setHSL(hue, 0.6, 0.42 + rand() * 0.08));
      if (berried) {
        for (let q = 0; q < 3; q++) {
          berryM.push(matrix(x + (rand() - 0.5) * r, r * (0.8 + rand() * 0.6), z + (rand() - 0.5) * r, 0.05, 0.05, 0.05));
        }
      }
    }
  });

  rocks.forEach((r) => {
    const s = (0.3 + rand() * 0.25) * r.s;
    rockM.push(matrix(r.x, s * 0.45, r.z, s * 1.2, s * 0.8, s, r.rot));
    rockC.push(new Color().setHSL(0.6, 0.04, 0.55 + rand() * 0.15));
  });

  const trunks = instanced(new CylinderGeometry(0.75, 1, 1, 7), palette.toon(0x8a5a34), trunkM);
  addInstancedHullOutline(trunks, 0.02);
  const crowns = instanced(faceted(), palette.toon(0xffffff), crownM, crownC);
  addInstancedHullOutline(crowns, 0.04);
  const pines = instanced(new ConeGeometry(1, 1, 9), palette.toon(0xffffff), pineM, pineC);
  addInstancedHullOutline(pines, 0.03);
  const apples = instanced(new SphereGeometry(1, 10, 8), palette.toon(0xe0332a), appleM);
  const shrubs = instanced(faceted(), palette.toon(0xffffff), bushM, bushC);
  addInstancedHullOutline(shrubs, 0.06);
  const berries = instanced(new SphereGeometry(1, 8, 6), palette.toon(0xff4f7a), berryM);
  const stones = instanced(new DodecahedronGeometry(1, 0), palette.toon(0xffffff), rockM, rockC);
  addInstancedHullOutline(stones, 0.03);
  group.add(trunks, crowns, pines, apples, shrubs, berries, stones);
  return group;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export class Props {
  readonly group = new Group();
  private readonly blades: Group;
  private readonly land = new Group();
  private readonly scarecrow: Group;
  private landSize = 0;
  private readonly glass: MeshBasicMaterial;
  private readonly lampGlow: Sprite;
  /** The clickable barn (tagged with `userData.pickId = 'barn'`). */
  readonly barn: Group;

  constructor(private readonly gradientMap: DataTexture, landSize: number) {
    const palette = new Palette(gradientMap);
    this.glass = palette.glass;
    this.group.add(this.land, buildHay(palette), buildFarmEdge(palette));

    const lamp = buildLamp(palette);
    lamp.group.position.set(-6.5, 0, GATE_Z - 1.5);
    this.lampGlow = lamp.glow;
    this.group.add(lamp.group);

    const pond = buildPond(palette);
    pond.position.set(POND.x, 0, POND.z);
    this.group.add(pond);

    const barn = buildBarn(palette);
    barn.position.set(BARN.x, 0, BARN.z);
    barn.rotation.y = Math.PI / 2; // door faces +x, toward the gate
    barn.userData['pickId'] = 'barn';
    this.barn = barn;
    this.group.add(barn);

    const mill = buildWindmill(palette);
    mill.group.position.set(WINDMILL.x, 0, WINDMILL.z);
    this.blades = mill.blades;
    this.group.add(mill.group);

    this.scarecrow = buildScarecrow(palette);
    this.scarecrow.rotation.y = Math.PI / 4 + 0.2;
    this.group.add(this.scarecrow);

    const sign = buildSign(palette);
    sign.position.set(-6.3, 0, -2.3);
    sign.rotation.y = Math.PI / 4;
    this.group.add(sign);

    this.setLandSize(landSize);
  }

  /** Moves the fence, gate path and scarecrow to match the owned plot (tiles per side). */
  setLandSize(size: number): void {
    if (size === this.landSize) return;
    this.landSize = size;
    const half = size / 2 + FENCE_MARGIN;

    for (const child of [...this.land.children]) {
      this.land.remove(child);
      child.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    const palette = new Palette(this.gradientMap);
    this.land.add(buildFence(palette, half), buildPath(palette, half));
    this.scarecrow.position.set(half + 1.05, 0, 1.6);
  }

  /** 0 = day, 1 = night: lights up the windows and the lamp. */
  setNight(night: number): void {
    this.glass.color.copy(GLASS_DAY).lerp(GLASS_NIGHT, Math.min(1, Math.max(0, (night - 0.3) / 0.5)));
    const glow = Math.min(1, Math.max(0, (night - 0.25) / 0.5));
    this.lampGlow.material.opacity = glow * 0.85;
    this.lampGlow.visible = glow > 0.01;
  }

  update(dt: number): void {
    this.blades.rotation.z += dt * 0.55;
  }
}
