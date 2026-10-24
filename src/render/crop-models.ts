import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CropDef } from '../core/crops';
import { CropStage } from '../core/farm';
import { addOutline } from './outline';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

interface LeafOptions {
  segments?: number;
  /** How far the tip sags below the base (relative to length 1). */
  droop?: number;
  /** How far the edges fold below the midrib. */
  fold?: number;
  /** Half-width profile along the length, t in 0..1 -> 0..1. */
  shape?: (t: number) => number;
}

/**
 * A leaf blade lying along +Z from the origin (length 1, width 1): folded along the midrib,
 * sagging at the tip. Vertex colours darken toward the edges, which gives each leaf definition
 * without needing an outline (flat sheets can't be outlined with the inverted-hull trick).
 */
function makeLeafGeometry({
  segments = 6,
  droop = 0.25,
  fold = 0.2,
  shape = (t) => Math.sin(Math.PI * Math.pow(t, 0.75)),
}: LeafOptions = {}): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let k = 0; k <= segments; k++) {
    const t = k / segments;
    const half = shape(t) * 0.5;
    const sag = -droop * t * t;
    for (const side of [-1, 0, 1]) {
      const x = side * half;
      positions.push(x, sag - fold * Math.abs(x), t);
      const shade = side === 0 ? 1.0 : 0.7;
      colors.push(shade, shade, shade);
    }
  }
  for (let k = 0; k < segments; k++) {
    const a = k * 3;
    const b = (k + 1) * 3;
    indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A feathery compound leaf (carrot tops): a midrib with pairs of leaflets that shrink toward the tip. */
function makeFernGeometry(): BufferGeometry {
  const leaflet = makeLeafGeometry({ segments: 3, droop: 0.12, fold: 0.12 });
  const parts: BufferGeometry[] = [];
  for (let n = 0; n < 6; n++) {
    const along = 0.2 + n * 0.13;
    const size = 0.36 - n * 0.04;
    for (const side of [-1, 1]) {
      const g = leaflet.clone();
      g.scale(0.11, 1, size);
      g.rotateY(side * 1.05);
      g.translate(0, 0, along);
      parts.push(g);
    }
  }
  const tip = leaflet.clone();
  tip.scale(0.12, 1, 0.26);
  tip.translate(0, 0, 0.93);
  parts.push(tip);
  parts.push(makeLeafGeometry({ segments: 4, droop: 0.12, fold: 0, shape: () => 0.05 }));
  return mergeGeometries(parts)!;
}

/** Sphere with vertical ribs (pumpkin, tomato). Vertex colours darken the grooves. */
function makeRibbedSphere(ribs: number, depth: number): BufferGeometry {
  const geometry = new SphereGeometry(1, 28, 18);
  const position = geometry.attributes['position'] as BufferAttribute;
  const colors: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const wave = Math.cos(Math.atan2(z, x) * ribs); // +1 on a ridge, -1 in a groove
    const f = 1 + depth * wave;
    position.setX(i, x * f);
    position.setZ(i, z * f);
    const shade = 0.82 + 0.18 * (wave * 0.5 + 0.5);
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Sphere with dark vertical stripes (watermelon). Vertex colours carry the pattern. */
function makeStripedSphere(stripes: number): BufferGeometry {
  const geometry = new SphereGeometry(1, 30, 20);
  const position = geometry.attributes['position'] as BufferAttribute;
  const colors: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    // Stripes run pole to pole and wobble a little, like the real thing.
    const angle = Math.atan2(z, x) + 0.18 * Math.sin(y * 5);
    const dark = Math.cos(angle * stripes) > 0.35;
    const shade = dark ? 0.52 : 1;
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------
// Shared kit
// ---------------------------------------------------------------------------

/** Shared geometries and cached toon materials for every procedural crop. */
export class CropKit {
  readonly sphere = new SphereGeometry(1, 14, 10);
  readonly cone = new ConeGeometry(1, 1, 10);
  readonly stalk = new CylinderGeometry(0.75, 1, 1, 7);

  readonly leafBroad = makeLeafGeometry({ segments: 6, droop: 0.22, fold: 0.24, shape: (t) => Math.sin(Math.PI * Math.pow(t, 0.7)) });
  readonly leafBlade = makeLeafGeometry({ segments: 6, droop: 0.6, fold: 0.3, shape: (t) => Math.min(1, t * 5) * Math.pow(1 - t, 0.7) });
  readonly leafVine = makeLeafGeometry({ segments: 5, droop: 0.02, fold: 0, shape: () => 0.07 });
  readonly fern = makeFernGeometry();
  readonly ribbedPumpkin = makeRibbedSphere(10, 0.09);
  readonly ribbedTomato = makeRibbedSphere(6, 0.035);
  readonly striped = makeStripedSphere(6);
  readonly prism = new CylinderGeometry(1, 1, 1, 3);

  private readonly toon = new Map<number, MeshToonMaterial>();
  private readonly leaf = new Map<number, MeshToonMaterial>();
  private readonly ribbed = new Map<number, MeshToonMaterial>();

  constructor(private readonly gradientMap: DataTexture) {}

  material(color: number): MeshToonMaterial {
    let m = this.toon.get(color);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap });
      this.toon.set(color, m);
    }
    return m;
  }

  /** Double-sided and tinted per vertex, for flat leaf blades. */
  leafMaterial(color: number): MeshToonMaterial {
    let m = this.leaf.get(color);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap, side: DoubleSide, vertexColors: true });
      this.leaf.set(color, m);
    }
    return m;
  }

  ribbedMaterial(color: number): MeshToonMaterial {
    let m = this.ribbed.get(color);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap, vertexColors: true });
      this.ribbed.set(color, m);
    }
    return m;
  }
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const SOIL_MOUND = 0x5a3a20;
const DRY_LEAF = 0x9b7b3a;
const DRY_STEM = 0x8a6d34;
const THIRSTY_TINT = 0xd6cf55;
const OUTLINE = 0.011;

function blob(
  kit: CropKit,
  color: number,
  sx: number,
  sy: number,
  sz: number,
  x = 0,
  y = 0,
  z = 0,
  outlined = false,
): Mesh {
  const m = new Mesh(kit.sphere, kit.material(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (outlined) addOutline(m, OUTLINE);
  return m;
}

function ribbedFruit(
  kit: CropKit,
  geometry: BufferGeometry,
  color: number,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
): Mesh {
  const m = new Mesh(geometry, kit.ribbedMaterial(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  addOutline(m, OUTLINE);
  return m;
}

function stem(kit: CropKit, color: number, height: number, radius: number, x = 0, z = 0, y = 0): Mesh {
  const m = new Mesh(kit.stalk, kit.material(color));
  m.scale.set(radius, height, radius);
  m.position.set(x, y + height / 2, z);
  m.castShadow = true;
  return m;
}

/** A blade or compound leaf rooted at (x, y, z), pitched up by `tilt` and turned by `yaw`. */
function frond(
  kit: CropKit,
  geometry: BufferGeometry,
  color: number,
  length: number,
  aspect: number,
  tilt: number,
  yaw: number,
  y = 0,
  x = 0,
  z = 0,
): Group {
  const g = new Group();
  g.rotation.y = yaw;
  g.position.set(x, y, z);
  const m = new Mesh(geometry, kit.leafMaterial(color));
  m.scale.set(length * aspect, length, length);
  m.rotation.x = -tilt;
  m.castShadow = true;
  g.add(m);
  return g;
}

function mound(kit: CropKit, radius: number, height: number): Mesh {
  return blob(kit, SOIL_MOUND, radius, height, radius, 0, 0.015, 0);
}

function calyx(kit: CropKit, x: number, y: number, z: number, size: number): Mesh {
  const m = new Mesh(kit.cone, kit.material(0x3f9a3a));
  m.scale.set(size, size * 0.4, size);
  m.position.set(x, y, z);
  m.rotation.x = Math.PI;
  return m;
}

export interface CropAppearance {
  stage: CropStage;
  thirsty: boolean;
  withered: boolean;
}

interface Context {
  kit: CropKit;
  def: CropDef;
  stage: CropStage;
  ripe: boolean;
  withered: boolean;
  leaf: number;
  stemColor: number;
  /** Multiplies leaf pitch so withered plants sag. */
  droop: number;
}

// ---------------------------------------------------------------------------
// Crops
// ---------------------------------------------------------------------------

function buildSeedling(c: Context): Group {
  const g = new Group();
  if (c.stage === 0) {
    g.add(mound(c.kit, 0.16, 0.08));
    g.add(blob(c.kit, c.leaf, 0.03, 0.045, 0.03, 0.02, 0.09, 0));
    return g;
  }
  const narrow = c.def.shape === 'grain' || c.def.shape === 'tall' || c.def.shape === 'cane';
  g.add(mound(c.kit, 0.13, 0.05));
  g.add(stem(c.kit, c.stemColor, 0.07, 0.012));
  const count = narrow ? 3 : 2;
  for (let k = 0; k < count; k++) {
    g.add(
      frond(
        c.kit,
        narrow ? c.kit.leafBlade : c.kit.leafBroad,
        c.leaf,
        narrow ? 0.18 : 0.14,
        narrow ? 0.3 : 0.75,
        0.75 * c.droop,
        (k * Math.PI * 2) / count + 0.5,
        0.06,
      ),
    );
  }
  return g;
}

function buildRoot(c: Context): Group {
  const g = new Group();
  const count = c.stage === 2 ? 6 : 8;
  for (let n = 0; n < count; n++) {
    g.add(frond(c.kit, c.kit.fern, c.leaf, 0.36 + (n % 3) * 0.04, 0.8, (0.95 + (n % 2) * 0.22) * c.droop, n * 2.4, 0.07));
  }
  if (!c.ripe) {
    if (!c.withered) g.add(blob(c.kit, c.def.colors.fruit, 0.05, 0.026, 0.05, 0, 0.02, 0, true));
    return g;
  }
  const carrots: ReadonlyArray<readonly [number, number, number]> = [
    [0, 0, 0],
    [0.12, 0.05, 0.38],
    [-0.1, -0.05, -0.33],
  ];
  for (const [x, z, lean] of carrots) {
    const carrot = new Group();
    carrot.position.set(x, 0.12, z);
    carrot.rotation.z = lean;
    const body = new Mesh(c.kit.cone, c.kit.material(c.def.colors.fruit));
    body.scale.set(0.068, 0.28, 0.068);
    body.rotation.x = Math.PI;
    body.position.y = -0.14;
    body.castShadow = true;
    addOutline(body, OUTLINE);
    carrot.add(body, blob(c.kit, c.def.colors.fruit, 0.072, 0.045, 0.072, 0, 0.005, 0, true));
    g.add(carrot);
  }
  return g;
}

function buildGrain(c: Context): Group {
  const g = new Group();
  const count = 15;
  const ripeColor = c.def.colors.fruit;
  const base = c.stage === 2 ? 0.36 : 0.56;
  for (let n = 0; n < count; n++) {
    const angle = n * 2.399;
    const radius = 0.32 * Math.sqrt((n + 0.5) / count);
    const height = base * (0.85 + 0.3 * ((n * 37) % 10) / 10) * (c.withered ? 0.8 : 1);
    const lean = (0.08 + 0.06 * Math.sin(n * 3.1)) * (c.withered ? 2.2 : 1);

    const stalk = new Group();
    stalk.position.set(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius);
    stalk.rotation.set(Math.sin(angle) * lean, 0, -Math.cos(angle) * lean);
    const color = c.withered ? DRY_STEM : c.ripe ? 0xd9b84a : c.stemColor;
    stalk.add(stem(c.kit, color, height, 0.011));
    if (c.ripe) {
      stalk.add(blob(c.kit, ripeColor, 0.026, 0.09, 0.026, 0, height + 0.05, 0, true));
      for (const side of [-1, 1]) {
        const awn = new Mesh(c.kit.cone, c.kit.material(0xe8cf6a));
        awn.scale.set(0.005, 0.1, 0.005);
        awn.position.set(side * 0.012, height + 0.17, 0);
        awn.rotation.z = -side * 0.2;
        stalk.add(awn);
      }
    } else if (!c.withered) {
      stalk.add(blob(c.kit, c.leaf, 0.018, 0.05, 0.018, 0, height + 0.03, 0));
    }
    g.add(stalk);
  }
  for (let k = 0; k < 6; k++) {
    g.add(frond(c.kit, c.kit.leafBlade, c.withered ? DRY_LEAF : c.leaf, 0.32, 0.24, 0.6 * c.droop, k * 1.1, 0.05));
  }
  return g;
}

function buildCane(c: Context): Group {
  const g = new Group();
  const height = (c.stage === 2 ? 0.62 : 0.95) * (c.withered ? 0.85 : 1);
  const body = c.withered ? DRY_STEM : c.ripe ? c.def.colors.fruit : 0x78b546;
  const node = c.withered ? 0x6f5526 : c.ripe ? 0x6e2a57 : 0x4f8a35;
  for (let n = 0; n < 5; n++) {
    const angle = n * 1.9;
    const radius = n === 0 ? 0 : 0.12;
    const stalk = new Group();
    stalk.position.set(Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius);
    stalk.rotation.set(Math.sin(angle) * 0.07, 0, -Math.cos(angle) * 0.07);
    const h = height * (0.8 + 0.2 * ((n * 3) % 4) / 3);
    stalk.add(stem(c.kit, body, h, 0.03));
    for (let k = 1; k <= 5; k++) stalk.add(blob(c.kit, node, 0.04, 0.012, 0.04, 0, (h * k) / 6, 0));
    for (let k = 0; k < 3; k++) {
      stalk.add(frond(c.kit, c.kit.leafBlade, c.withered ? DRY_LEAF : c.leaf, 0.46 - 0.06 * k, 0.26, (0.5 + 0.12 * k) * c.droop, k * 2.1 + n, h * 0.72 + k * 0.06));
    }
    g.add(stalk);
  }
  return g;
}

function buildTall(c: Context): Group {
  const g = new Group();
  const height = (c.stage === 2 ? 0.55 : 0.82) * (c.withered ? 0.85 : 1);
  g.add(stem(c.kit, c.withered ? DRY_STEM : 0x6fae3a, height, 0.03));
  for (let k = 1; k <= 3; k++) {
    g.add(blob(c.kit, c.withered ? DRY_STEM : 0x8cc552, 0.042, 0.013, 0.042, 0, (height * k) / 4, 0));
  }
  for (let k = 0; k < 8; k++) {
    const t = k / 7;
    g.add(frond(c.kit, c.kit.leafBlade, c.leaf, 0.4 - 0.14 * t, 0.3, (0.55 - 0.2 * t) * c.droop, k * 2.4, 0.1 + t * height * 0.85));
  }
  if (c.ripe) {
    [0.46, 0.6].forEach((y, n) => {
      const cob = new Group();
      cob.position.y = y * (height / 0.82);
      cob.rotation.y = n * Math.PI + 0.6;
      const tilted = new Group();
      tilted.rotation.x = -0.6;
      tilted.add(blob(c.kit, 0x7cbc45, 0.05, 0.05, 0.16, 0, 0, 0.11, true));
      tilted.add(blob(c.kit, c.def.colors.fruit, 0.038, 0.038, 0.075, 0, 0, 0.23, true));
      cob.add(tilted);
      g.add(cob);
    });
    for (let k = 0; k < 6; k++) {
      const strand = new Group();
      strand.position.y = height;
      strand.rotation.y = k * 1.05;
      const spike = new Mesh(c.kit.cone, c.kit.material(0xcdbb5a));
      spike.scale.set(0.01, 0.17, 0.01);
      spike.position.set(0, 0.06, 0.03);
      spike.rotation.x = 0.7;
      strand.add(spike);
      g.add(strand);
    }
  }
  return g;
}

function buildBush(c: Context): Group {
  const g = new Group();
  g.add(stem(c.kit, 0xb98a4b, 0.68, 0.014, 0.0, 0.0)); // wooden stake
  g.add(stem(c.kit, c.withered ? DRY_STEM : c.stemColor, c.stage === 2 ? 0.3 : 0.42, 0.02, 0.012, 0));
  const leaves = 10;
  for (let n = 0; n < leaves; n++) {
    const t = n / (leaves - 1);
    g.add(frond(c.kit, c.kit.leafBroad, c.leaf, 0.24 - 0.05 * t, 0.85, (0.55 + 0.5 * (n % 3) * 0.5) * c.droop, n * 2.4, 0.08 + t * 0.34));
  }
  if (c.stage === 2 && !c.withered) {
    for (let n = 0; n < 3; n++) {
      const a = n * 2.1 + 0.4;
      g.add(blob(c.kit, 0xffe14a, 0.024, 0.024, 0.024, Math.cos(a) * 0.14, 0.2 + n * 0.06, Math.sin(a) * 0.14));
    }
  }
  if (c.ripe) {
    for (let n = 0; n < 5; n++) {
      const a = n * 1.26 + 0.3;
      const x = Math.cos(a) * 0.15;
      const z = Math.sin(a) * 0.15;
      const y = 0.15 + 0.065 * (n % 3);
      g.add(ribbedFruit(c.kit, c.kit.ribbedTomato, c.def.colors.fruit, 0.066, 0.058, 0.066, x, y, z));
      g.add(calyx(c.kit, x, y + 0.055, z, 0.042));
    }
  }
  return g;
}

function buildBerry(c: Context): Group {
  const g = new Group();
  for (let n = 0; n < 9; n++) {
    g.add(frond(c.kit, c.kit.leafBroad, c.leaf, 0.2 + (n % 3) * 0.02, 0.95, (0.38 + 0.12 * (n % 2)) * c.droop, n * 2.4 + 0.3, 0.05));
  }
  if (c.stage === 2 && !c.withered) {
    for (let n = 0; n < 3; n++) {
      const a = n * 2.1;
      const x = Math.cos(a) * 0.15;
      const z = Math.sin(a) * 0.15;
      g.add(blob(c.kit, 0xffffff, 0.045, 0.018, 0.045, x, 0.2, z));
      g.add(blob(c.kit, 0xffd23a, 0.017, 0.017, 0.017, x, 0.215, z));
    }
  }
  if (c.ripe) {
    for (let n = 0; n < 7; n++) {
      const a = n * 0.9 + 0.2;
      const r = 0.17 + (n % 2) * 0.05;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      g.add(blob(c.kit, c.def.colors.fruit, 0.052, 0.07, 0.052, x, 0.075, z, true));
      g.add(calyx(c.kit, x, 0.14, z, 0.04));
    }
  }
  return g;
}

function buildGourd(c: Context): Group {
  const g = new Group();
  for (let n = 0; n < 6; n++) {
    g.add(frond(c.kit, c.kit.leafBroad, c.leaf, 0.3, 1.15, (0.4 + 0.1 * (n % 2)) * c.droop, n * 1.05, 0.06));
  }
  for (const yaw of [0.9, 3.6]) {
    g.add(frond(c.kit, c.kit.leafVine, c.withered ? DRY_STEM : 0x4f9a35, 0.46, 1, 0.02, yaw, 0.04));
  }
  if (c.stage === 2 && !c.withered) {
    const flower = new Mesh(c.kit.cone, c.kit.material(0xffd02b));
    flower.scale.set(0.06, 0.11, 0.06);
    flower.position.set(0.16, 0.14, 0.08);
    flower.rotation.x = Math.PI;
    g.add(flower);
    g.add(ribbedFruit(c.kit, c.kit.ribbedPumpkin, 0x6a9b3a, 0.07, 0.055, 0.07, -0.13, 0.06, 0.1));
  }
  if (c.ripe) {
    g.add(ribbedFruit(c.kit, c.kit.ribbedPumpkin, c.def.colors.fruit, 0.21, 0.16, 0.21, 0, 0.17, 0));
    g.add(ribbedFruit(c.kit, c.kit.ribbedPumpkin, 0xff9a2e, 0.11, 0.085, 0.11, 0.24, 0.09, 0.14));
    const handle = stem(c.kit, 0x6b7a2c, 0.1, 0.03, 0, 0, 0.29);
    handle.rotation.z = 0.25;
    g.add(handle);
  }
  return g;
}

function buildSunflower(c: Context): Group {
  const g = new Group();
  const height = (c.stage === 2 ? 0.46 : 0.78) * (c.withered ? 0.9 : 1);
  g.add(stem(c.kit, c.withered ? DRY_STEM : 0x5fa032, height, 0.026));
  for (let n = 0; n < 6; n++) {
    const t = n / 5;
    g.add(frond(c.kit, c.kit.leafBroad, c.leaf, 0.26 - 0.07 * t, 0.9, (0.5 + 0.2 * (n % 2)) * c.droop, n * 2.4, 0.06 + t * height * 0.7));
  }
  const head = new Group();
  head.position.set(0, height + 0.02, 0.03);
  head.rotation.x = c.withered ? 1.2 : c.ripe ? -0.55 : -0.2;
  if (c.ripe) {
    for (let n = 0; n < 16; n++) {
      const a = (n / 16) * Math.PI * 2;
      const petal = new Mesh(c.kit.cone, c.kit.material(n % 2 === 0 ? c.def.colors.fruit : 0xffd84a));
      petal.scale.set(0.05, 0.13, 0.012);
      petal.position.set(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0);
      petal.rotation.z = a - Math.PI / 2;
      petal.castShadow = true;
      head.add(petal);
    }
    head.add(blob(c.kit, 0x5a3a1c, 0.15, 0.15, 0.06, 0, 0, 0.02, true));
    head.add(blob(c.kit, 0x7a5228, 0.09, 0.09, 0.03, 0, 0, 0.065));
  } else if (c.stage === 2 && !c.withered) {
    head.add(blob(c.kit, 0x5fa032, 0.09, 0.09, 0.07, 0, 0, 0, true));
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * Math.PI * 2;
      const sepal = new Mesh(c.kit.cone, c.kit.material(0x4a9a2e));
      sepal.scale.set(0.03, 0.07, 0.01);
      sepal.position.set(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.02);
      sepal.rotation.z = a - Math.PI / 2;
      head.add(sepal);
    }
  } else {
    head.add(blob(c.kit, DRY_STEM, 0.12, 0.12, 0.04, 0, 0, 0));
  }
  g.add(head);
  return g;
}

function buildMelon(c: Context): Group {
  const g = new Group();
  for (let n = 0; n < 7; n++) {
    g.add(frond(c.kit, c.kit.leafBroad, c.leaf, 0.3, 1.1, (0.38 + 0.1 * (n % 2)) * c.droop, n * 0.95, 0.06));
  }
  for (const yaw of [0.5, 2.7, 4.4]) {
    g.add(frond(c.kit, c.kit.leafVine, c.withered ? DRY_STEM : 0x4f9a35, 0.5, 1, 0.02, yaw, 0.04));
  }
  if (c.stage === 2 && !c.withered) {
    g.add(ribbedFruit(c.kit, c.kit.striped, 0x58b04a, 0.07, 0.06, 0.085, -0.16, 0.06, 0.1));
    const flower = new Mesh(c.kit.cone, c.kit.material(0xffe14a));
    flower.scale.set(0.05, 0.09, 0.05);
    flower.position.set(0.17, 0.12, 0.1);
    flower.rotation.x = Math.PI;
    g.add(flower);
  }
  if (c.ripe) {
    g.add(ribbedFruit(c.kit, c.kit.striped, c.def.colors.fruit, 0.2, 0.17, 0.27, 0, 0.17, 0));
    g.add(ribbedFruit(c.kit, c.kit.striped, c.def.colors.fruit, 0.1, 0.085, 0.13, 0.27, 0.085, 0.15));
    const curl = stem(c.kit, 0x6b7a2c, 0.08, 0.02, 0, 0.0, 0.31);
    curl.rotation.z = 0.35;
    g.add(curl);
  }
  return g;
}

function buildCactus(c: Context): Group {
  const g = new Group();
  const green = c.withered ? DRY_STEM : c.leaf;
  const arms: ReadonlyArray<readonly [number, number, number, number]> = [
    // x, z, lean, height
    [0, 0, 0, 0.62],
    [-0.15, 0.03, 0.55, 0.42],
    [0.14, -0.04, -0.5, 0.38],
  ];
  for (const [x, z, lean, h0] of arms) {
    const h = h0 * (c.stage === 2 ? 0.75 : 1) * (c.withered ? 0.85 : 1);
    const col = new Group();
    col.position.set(x, 0.02, z);
    col.rotation.z = lean * (c.withered ? 1.4 : 1);
    const body = new Mesh(c.kit.prism, c.kit.material(green));
    body.scale.set(0.07, h, 0.07);
    body.position.y = h / 2;
    body.castShadow = true;
    addOutline(body, OUTLINE);
    col.add(body);
    // Spines along the three ridges.
    for (let k = 0; k < 6; k++) {
      const a = (k % 3) * ((Math.PI * 2) / 3) + Math.PI / 6;
      const spine = new Mesh(c.kit.cone, c.kit.material(0xf6f1d8));
      spine.scale.set(0.008, 0.04, 0.008);
      spine.position.set(Math.cos(a) * 0.075, h * (0.2 + 0.14 * k), Math.sin(a) * 0.075);
      spine.rotation.z = -Math.cos(a) * 1.2;
      spine.rotation.x = Math.sin(a) * 1.2;
      col.add(spine);
    }
    g.add(col);
  }
  if (c.stage === 2 && !c.withered) {
    // A pale night-blooming flower on the tallest arm.
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * Math.PI * 2;
      const petal = new Mesh(c.kit.cone, c.kit.material(0xfff3f8));
      petal.scale.set(0.025, 0.09, 0.01);
      petal.position.set(Math.cos(a) * 0.05, 0.6, Math.sin(a) * 0.05);
      petal.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(petal);
    }
    g.add(blob(c.kit, 0xffd84a, 0.025, 0.025, 0.025, 0, 0.62, 0));
  }
  if (c.ripe) {
    const spots: ReadonlyArray<readonly [number, number, number]> = [
      [0.03, 0.66, 0.05],
      [-0.27, 0.38, 0.09],
      [0.25, 0.34, -0.08],
    ];
    for (const [x, y, z] of spots) {
      const fruit = new Group();
      fruit.position.set(x, y, z);
      fruit.add(blob(c.kit, c.def.colors.fruit, 0.075, 0.1, 0.075, 0, 0.02, 0, true));
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9;
        const scale = new Mesh(c.kit.cone, c.kit.material(0x5cc46a));
        scale.scale.set(0.022, 0.07, 0.01);
        scale.position.set(Math.cos(a) * 0.07, 0.02 + (k % 3) * 0.04, Math.sin(a) * 0.07);
        scale.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
        fruit.add(scale);
      }
      g.add(fruit);
    }
  }
  return g;
}

function grapeCluster(c: Context, x: number, y: number, z: number, scale: number, color: number): Group {
  const cluster = new Group();
  cluster.position.set(x, y, z);
  const rows = [1, 2, 3, 2, 1];
  rows.forEach((count, row) => {
    for (let k = 0; k < count; k++) {
      const offset = (k - (count - 1) / 2) * 0.05;
      cluster.add(blob(c.kit, color, 0.027 * scale, 0.027 * scale, 0.027 * scale, offset * scale, -row * 0.042 * scale, ((k + row) % 2) * 0.02 * scale, true));
    }
  });
  return cluster;
}

function buildVine(c: Context): Group {
  const g = new Group();
  // A wooden post and crossbar the vine climbs.
  const wood = 0xb98a4b;
  g.add(stem(c.kit, wood, 0.8, 0.022, -0.2, 0));
  g.add(stem(c.kit, wood, 0.8, 0.022, 0.2, 0));
  const bar = new Mesh(c.kit.stalk, c.kit.material(wood));
  bar.scale.set(0.016, 0.44, 0.016);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.74, 0);
  g.add(bar);
  const height = c.stage === 2 ? 0.55 : 0.78;
  g.add(stem(c.kit, c.withered ? DRY_STEM : 0x6b8a3a, height, 0.016, 0.02, 0));
  for (let n = 0; n < 9; n++) {
    const t = n / 8;
    const side = n % 2 === 0 ? 1 : -1;
    g.add(frond(c.kit, c.kit.leafBroad, c.leaf, 0.26 - 0.04 * t, 1, (0.55 + 0.25 * (n % 3) * 0.5) * c.droop, side * 1.2 + n * 0.5, 0.12 + t * height * 0.9));
  }
  if (c.stage === 2 && !c.withered) {
    g.add(grapeCluster(c, 0.05, 0.62, 0.06, 0.55, 0x9ac24a));
  }
  if (c.ripe) {
    g.add(grapeCluster(c, -0.12, 0.7, 0.07, 1.1, c.def.colors.fruit));
    g.add(grapeCluster(c, 0.12, 0.66, -0.06, 0.95, 0x8a4fc0));
    g.add(grapeCluster(c, 0.02, 0.6, 0.1, 0.8, 0x6a3a9f));
  }
  return g;
}

function buildMoon(c: Context): Group {
  const g = new Group();
  const height = (c.stage === 2 ? 0.4 : 0.6) * (c.withered ? 0.9 : 1);
  g.add(stem(c.kit, c.withered ? DRY_STEM : 0x3f8f7a, height, 0.022));
  for (let n = 0; n < 7; n++) {
    const t = n / 6;
    g.add(frond(c.kit, c.kit.leafBroad, c.leaf, 0.3 - 0.08 * t, 0.9, (0.5 + 0.2 * (n % 2)) * c.droop, n * 2.2, 0.05 + t * height * 0.8));
  }
  const bloom = new Group();
  bloom.position.set(0, height + 0.02, 0);
  if (c.ripe) {
    // Two rings of pale petals around a glowing heart, with motes floating above.
    for (const [count, size, tilt, color] of [
      [10, 0.22, 1.0, 0xcfe0ff],
      [8, 0.17, 0.6, 0xf2f7ff],
    ] as const) {
      for (let n = 0; n < count; n++) {
        const a = (n / count) * Math.PI * 2 + (count === 8 ? 0.3 : 0);
        const petal = new Mesh(c.kit.cone, c.kit.material(color));
        petal.scale.set(0.055, size, 0.012);
        petal.position.set(Math.cos(a) * 0.05, 0.04, Math.sin(a) * 0.05);
        petal.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
        petal.castShadow = true;
        bloom.add(petal);
      }
    }
    const heart = new Mesh(c.kit.sphere, new MeshBasicMaterial({ color: 0xfff2b0 }));
    heart.scale.set(0.045, 0.045, 0.045);
    heart.position.y = 0.06;
    bloom.add(heart);
    for (let n = 0; n < 5; n++) {
      const a = n * 1.3;
      const mote = new Mesh(c.kit.sphere, new MeshBasicMaterial({ color: 0xfff7cf }));
      mote.scale.set(0.014, 0.014, 0.014);
      mote.position.set(Math.cos(a) * 0.2, 0.2 + (n % 3) * 0.07, Math.sin(a) * 0.2);
      bloom.add(mote);
    }
  } else if (c.stage === 2 && !c.withered) {
    bloom.add(blob(c.kit, 0xcfe0ff, 0.05, 0.1, 0.05, 0, 0.06, 0, true));
    bloom.add(blob(c.kit, 0x3f8f7a, 0.04, 0.05, 0.04, 0, 0.0, 0));
  }
  g.add(bloom);
  return g;
}

/** A thin glowing ring under ripe rare and epic crops, so they stand out from the field. */
function rarityRing(def: CropDef): Mesh | null {
  const color = def.rarity === 'epica' ? 0xffd75a : def.rarity === 'rara' ? 0x6aa8ff : 0;
  if (color === 0) return null;
  const ring = new Mesh(new RingGeometry(0.34, 0.4, 28), new MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  return ring;
}

/** Builds the crop model for one growth stage. Origin is the tile center on the soil. */
export function buildCropModel(kit: CropKit, def: CropDef, look: CropAppearance): Group {
  const { stage, withered, thirsty } = look;
  let leaf = withered ? DRY_LEAF : def.colors.leaf;
  if (thirsty && !withered) leaf = new Color(def.colors.leaf).lerp(new Color(THIRSTY_TINT), 0.5).getHex();

  const context: Context = {
    kit,
    def,
    stage,
    ripe: stage === 3 && !withered,
    withered,
    leaf,
    stemColor: withered ? DRY_STEM : new Color(leaf).multiplyScalar(0.85).getHex(),
    droop: withered ? 0.35 : 1,
  };

  if (stage <= 1) return buildSeedling(context);
  const model = buildShape(context);
  if (context.ripe) {
    const ring = rarityRing(def);
    if (ring) model.add(ring);
  }
  return model;
}

function buildShape(context: Context): Group {
  switch (context.def.shape) {
    case 'cane':
      return buildCane(context);
    case 'root':
      return buildRoot(context);
    case 'grain':
      return buildGrain(context);
    case 'tall':
      return buildTall(context);
    case 'bush':
      return buildBush(context);
    case 'berry':
      return buildBerry(context);
    case 'gourd':
      return buildGourd(context);
    case 'sunflower':
      return buildSunflower(context);
    case 'melon':
      return buildMelon(context);
    case 'cactus':
      return buildCactus(context);
    case 'vine':
      return buildVine(context);
    case 'moon':
      return buildMoon(context);
  }
}
