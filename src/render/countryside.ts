import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshToonMaterial,
} from 'three';
import { fbm2D, hashUnit, mulberry32 } from '../core/noise';
import { addInstancedHullOutline } from './outline';
import { Palette, box, buildForest, instanced, matrix } from './props';

/**
 * Everything beyond the farm's own grid: a patchwork of fields and woods, hedgerows, hay bales, a gravel
 * road that circles the farm and runs off to the horizon with telephone poles beside it, and distant hills.
 * Fully procedural and fixed (it never changes with the game state).
 */

/** Centre line of the road that circles the farm (world units from the origin). */
export const ROAD_RING = 13.1;
export const ROAD_WIDTH = 1.5;
/** The road extends this far from the farm, then fades into the hills. */
const REACH = 66;
const GRID_HALF = 12;
const BLOCK = 10;

export type FieldKind = 'meadow' | 'wheat' | 'plowed' | 'woods' | 'pasture';

/** What grows at a world position outside the farm (blocks of BLOCK units, picked by hash). */
export function fieldAt(x: number, z: number): FieldKind {
  const bx = Math.floor(x / BLOCK);
  const bz = Math.floor(z / BLOCK);
  const u = hashUnit(bx, bz, 0xf1e1d);
  if (u < 0.3) return 'meadow';
  if (u < 0.5) return 'wheat';
  if (u < 0.65) return 'plowed';
  if (u < 0.82) return 'woods';
  return 'pasture';
}

/** True on the road ring, the road running off to the north and south, and a small margin around them. */
export function onRoad(x: number, z: number, margin = 0): boolean {
  const half = ROAD_WIDTH / 2 + margin;
  const inRing =
    Math.max(Math.abs(x), Math.abs(z)) <= ROAD_RING + half && Math.max(Math.abs(x), Math.abs(z)) >= ROAD_RING - half;
  const through = Math.abs(x + ROAD_RING) <= half;
  return inRing || through;
}

const insideGrid = (x: number, z: number): boolean => Math.abs(x) < GRID_HALF && Math.abs(z) < GRID_HALF;

function buildGround(gradientMap: DataTexture): Group {
  const group = new Group();

  // A deep slab so the ground has no visible edge from any angle.
  const slab = new Mesh(new BoxGeometry(REACH * 2.4, 3, REACH * 2.4), new MeshToonMaterial({ color: 0x6a8a45, gradientMap }));
  slab.position.y = -0.5 - 1.5;
  slab.receiveShadow = true;
  group.add(slab);

  const cells: { x: number; z: number; kind: FieldKind }[] = [];
  for (let i = -REACH; i < REACH; i++) {
    for (let j = -REACH; j < REACH; j++) {
      const x = i + 0.5;
      const z = j + 0.5;
      if (insideGrid(x, z)) continue;
      cells.push({ x, z, kind: fieldAt(x, z) });
    }
  }

  const mesh = new InstancedMesh(new BoxGeometry(1, 0.5, 1), new MeshToonMaterial({ color: 0xffffff, gradientMap }), cells.length);
  mesh.receiveShadow = true;
  const color = new Color();
  const m = new Matrix4();
  cells.forEach((c, n) => {
    const noise = fbm2D(c.x * 0.18, c.z * 0.18, 77);
    const fine = fbm2D(c.x * 0.7, c.z * 0.7, 5);
    const row = Math.floor(c.x) & 1;
    let top = 0;
    switch (c.kind) {
      case 'meadow':
        color.setHSL(0.265 + (noise - 0.5) * 0.04, 0.58, 0.46 + (noise - 0.5) * 0.12);
        break;
      case 'wheat':
        color.setHSL(0.13 + (noise - 0.5) * 0.02, 0.66, 0.58 + (row ? 0.035 : -0.02) + (fine - 0.5) * 0.04);
        break;
      case 'plowed':
        color.setHSL(0.075, 0.38, 0.3 + (row ? 0.045 : -0.01) + (fine - 0.5) * 0.03);
        top = row ? -0.015 : -0.07;
        break;
      case 'woods':
        color.setHSL(0.29 + (noise - 0.5) * 0.03, 0.5, 0.36 + (noise - 0.5) * 0.1);
        break;
      case 'pasture':
        color.setHSL(0.245 + (noise - 0.5) * 0.03, 0.62, 0.53 + (noise - 0.5) * 0.1);
        break;
    }
    // Cells are 0.5 tall with their top at `top`.
    m.makeTranslation(c.x, top - 0.25, c.z);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  return group;
}

function buildRoads(palette: Palette): Group {
  const group = new Group();
  const r = ROAD_RING;
  const w = ROAD_WIDTH;
  const span = r * 2 + w;

  const strip = (color: number, width: number, height: number, cx: number, cz: number, lx: number, lz: number): void => {
    const m = new Mesh(new BoxGeometry(lx, height, lz), palette.toon(color));
    m.position.set(cx, height / 2 - 0.01, cz);
    m.receiveShadow = true;
    group.add(m);
    void width;
  };

  // Layers from the widest (verge) to the narrowest (wheel ruts), each slightly taller than the last.
  const layers: ReadonlyArray<readonly [number, number, number]> = [
    [0xa88b5e, w + 0.5, 0.05],
    [0xc9ad82, w, 0.075],
  ];
  for (const [color, width, height] of layers) {
    // Ring: four sides, with the corners filled by overlap.
    strip(color, width, height, 0, -r, span - w + width, width);
    strip(color, width, height, 0, r, span - w + width, width);
    strip(color, width, height, r, 0, width, span - w + width);
    // West side is the through road, running all the way out.
    strip(color, width, height, -r, 0, width, REACH * 2);
  }
  // Wheel ruts along the through road and the ring, a touch darker.
  for (const off of [-0.34, 0.34]) {
    strip(0xb6996c, 0.18, 0.09, -r + off, 0, 0.18, REACH * 2);
    strip(0xb6996c, 0.18, 0.09, r + off, 0, 0.18, span - 0.4);
    strip(0xb6996c, 0.18, 0.09, 0, -r + off, span - 0.4, 0.18);
    strip(0xb6996c, 0.18, 0.09, 0, r + off, span - 0.4, 0.18);
  }

  // Pebbles and tufts along the verges.
  const rand = mulberry32(31);
  const pebbles: Matrix4[] = [];
  const colors: Color[] = [];
  const place = (x: number, z: number): void => {
    const s = 0.05 + rand() * 0.07;
    pebbles.push(matrix(x, s * 0.5, z, s * 1.3, s, s, rand() * 3));
    colors.push(new Color().setHSL(0.09, 0.1, 0.55 + rand() * 0.2));
  };
  for (let n = 0; n < 220; n++) {
    const side = rand() < 0.5 ? -1 : 1;
    const along = (rand() * 2 - 1) * (r + 1);
    const off = (w / 2 + 0.05 + rand() * 0.35) * side;
    if (rand() < 0.5) place(along, r + off);
    else place(r + off, along);
  }
  for (let n = 0; n < 160; n++) place(-r + ((rand() < 0.5 ? -1 : 1) * (w / 2 + 0.1 + rand() * 0.4)), (rand() * 2 - 1) * REACH * 0.95);
  const stones = instanced(new DodecahedronGeometry(1, 0), palette.toon(0xffffff), pebbles, colors);
  stones.castShadow = false;
  group.add(stones);
  return group;
}

/** Telephone poles beside the through road with three wires strung between them. */
function buildPoles(palette: Palette): Group {
  const group = new Group();
  const x = -ROAD_RING - ROAD_WIDTH / 2 - 0.9;
  const spacing = 9;
  const zs: number[] = [];
  for (let z = 17; z < REACH; z += spacing) zs.push(z, -z);
  zs.sort((a, b) => a - b);

  const top = 3.0;
  for (const z of zs) {
    group.add(box(palette, 0x7a5232, 0.14, top, 0.14, x, top / 2, z, 0.015));
    group.add(box(palette, 0x8b6039, 1.1, 0.07, 0.07, x, top - 0.15, z, 0.012));
    group.add(box(palette, 0x8b6039, 0.8, 0.07, 0.07, x, top - 0.6, z, 0.012));
    for (const dx of [-0.45, 0.45]) group.add(box(palette, 0xdfe6e0, 0.1, 0.1, 0.1, x + dx, top - 0.08, z, 0));
  }
  // Wires: thin straight boxes between neighbouring poles (only on the same side of the farm).
  for (let n = 0; n < zs.length - 1; n++) {
    const a = zs[n]!;
    const b = zs[n + 1]!;
    if (a < 0 && b > 0) continue;
    for (const dx of [-0.45, 0.45]) {
      const wire = box(palette, 0x2c2c33, 0.02, 0.02, b - a, x + dx, top - 0.1, (a + b) / 2, 0);
      wire.castShadow = false;
      group.add(wire);
    }
  }
  return group;
}

/** Low hedges along some of the borders between fields. */
function buildHedges(palette: Palette): Group {
  const rand = mulberry32(4242);
  const blobs: Matrix4[] = [];
  const colors: Color[] = [];
  const geometry = new IcosahedronGeometry(1, 1);
  geometry.computeVertexNormals();
  const add = (x: number, z: number): void => {
    if (insideGrid(x, z) || onRoad(x, z, 1.2)) return;
    const r = 0.38 + rand() * 0.14;
    blobs.push(matrix(x, r * 0.7, z, r * 1.1, r * 0.85, r * 1.1));
    colors.push(new Color().setHSL(0.27 + rand() * 0.04, 0.55, 0.32 + rand() * 0.07));
  };
  for (let bx = -7; bx < 7; bx++) {
    for (let bz = -7; bz < 7; bz++) {
      const x0 = bx * BLOCK;
      const z0 = bz * BLOCK;
      if (hashUnit(bx, bz, 61) < 0.55) for (let t = 0; t < BLOCK; t += 1.05) add(x0 + t, z0);
      if (hashUnit(bx, bz, 62) < 0.55) for (let t = 0; t < BLOCK; t += 1.05) add(x0, z0 + t);
    }
  }
  const hedges = instanced(geometry, palette.toon(0xffffff), blobs, colors);
  addInstancedHullOutline(hedges, 0.05);
  const group = new Group();
  group.add(hedges);
  return group;
}

/** Round hay bales on the wheat fields, and flowers on the pastures. */
function buildFieldDetail(palette: Palette): Group {
  const rand = mulberry32(555);
  const bales: Matrix4[] = [];
  const baleColors: Color[] = [];
  const flowers: Matrix4[] = [];
  const flowerColors: Color[] = [];
  const palette5 = [0xff7fa8, 0xffd84a, 0xffffff, 0xff9a3c, 0xb98cff];
  for (let bx = -7; bx < 7; bx++) {
    for (let bz = -7; bz < 7; bz++) {
      const x0 = bx * BLOCK;
      const z0 = bz * BLOCK;
      const kind = fieldAt(x0 + 1, z0 + 1);
      if (kind === 'wheat') {
        const count = 2 + Math.floor(rand() * 3);
        for (let n = 0; n < count; n++) {
          const x = x0 + 1.5 + rand() * (BLOCK - 3);
          const z = z0 + 1.5 + rand() * (BLOCK - 3);
          if (insideGrid(x, z) || onRoad(x, z, 1.5)) continue;
          bales.push(matrix(x, 0.5, z, 1, 1, 1, rand() < 0.5 ? 0 : Math.PI / 2));
          baleColors.push(new Color().setHSL(0.12, 0.6, 0.5 + rand() * 0.08));
        }
      } else if (kind === 'pasture') {
        for (let n = 0; n < 40; n++) {
          const x = x0 + rand() * BLOCK;
          const z = z0 + rand() * BLOCK;
          if (insideGrid(x, z) || onRoad(x, z, 0.8)) continue;
          flowers.push(matrix(x, 0.07, z));
          flowerColors.push(new Color(palette5[Math.floor(rand() * palette5.length)]!));
        }
      }
    }
  }
  const group = new Group();
  // Bales lie on their side: a cylinder turned so its axis runs along x (or z).
  const baleGeometry = new CylinderGeometry(0.5, 0.5, 0.9, 12);
  baleGeometry.rotateZ(Math.PI / 2);
  const baleMesh = instanced(baleGeometry, palette.toon(0xffffff), bales, baleColors);
  addInstancedHullOutline(baleMesh, 0.03);
  const flowerMesh = instanced(new IcosahedronGeometry(0.07, 0), palette.toon(0xffffff), flowers, flowerColors);
  flowerMesh.castShadow = false;
  group.add(baleMesh, flowerMesh);
  return group;
}

function buildWoods(palette: Palette): Group {
  const group = new Group();
  const free = (x: number, z: number): boolean => {
    if (Math.abs(x) < GRID_HALF + 1 && Math.abs(z) < GRID_HALF + 1) return false;
    if (onRoad(x, z, 1.4)) return false;
    const kind = fieldAt(x, z);
    if (kind === 'woods') return true;
    // A few strays in the open, so fields do not look clipped.
    return (kind === 'meadow' || kind === 'pasture') && hashUnit(Math.floor(x * 3), Math.floor(z * 3), 9) < 0.05;
  };
  group.add(buildForest(palette, { seed: 777, extent: REACH - 2, trees: 260, bushes: 120, rocks: 30, free }));
  return group;
}

/** Soft hills along the horizon. */
function buildHills(palette: Palette): Group {
  const rand = mulberry32(2718);
  const hills: Matrix4[] = [];
  const colors: Color[] = [];
  const geometry = new IcosahedronGeometry(1, 1);
  geometry.computeVertexNormals();
  const count = 34;
  for (let n = 0; n < count; n++) {
    const angle = (n / count) * Math.PI * 2 + rand() * 0.2;
    const dist = REACH + 4 + rand() * 7;
    const w = 9 + rand() * 8;
    const h = 3.5 + rand() * 4;
    hills.push(matrix(Math.cos(angle) * dist, -1, Math.sin(angle) * dist, w, h, w * (0.8 + rand() * 0.4), rand() * 3));
    colors.push(new Color().setHSL(0.31 + rand() * 0.05, 0.38, 0.4 + rand() * 0.08));
  }
  const mesh = instanced(geometry, palette.toon(0xffffff), hills, colors);
  mesh.castShadow = false;
  const group = new Group();
  group.add(mesh);
  return group;
}

/** The land around the farm. */
export class Countryside {
  readonly group = new Group();

  constructor(gradientMap: DataTexture) {
    const palette = new Palette(gradientMap);
    this.group.add(
      buildGround(gradientMap),
      buildRoads(palette),
      buildHedges(palette),
      buildFieldDetail(palette),
      buildWoods(palette),
      buildPoles(palette),
      buildHills(palette),
    );
  }
}
