import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';
import { DECOR, DECOR_ORDER, DecorId } from '../core/decor';
import { Farm } from '../core/farm';
import { mulberry32 } from '../core/noise';
import { addHullOutline } from './outline';
import { Palette, box } from './props';

const solid = (palette: Palette, color: number, geometry: BufferGeometry, x: number, y: number, z: number, outline = 0.016): Mesh => {
  const m = new Mesh(geometry, palette.toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline > 0) addHullOutline(m, outline);
  return m;
};

const WOOD = 0xb07a40;
const DARK_WOOD = 0x8a5a34;
const STONE = 0xb9b4a6;

function bench(p: Palette): Group {
  const g = new Group();
  g.add(box(p, WOOD, 1.2, 0.08, 0.42, 0, 0.42, 0));
  g.add(box(p, WOOD, 1.2, 0.34, 0.07, 0, 0.72, -0.2));
  for (const x of [-0.5, 0.5]) for (const z of [-0.15, 0.15]) g.add(box(p, DARK_WOOD, 0.08, 0.4, 0.08, x, 0.2, z, 0.01));
  return g;
}

function flowerBed(p: Palette): Group {
  const g = new Group();
  g.add(box(p, 0x6b4a2a, 1.5, 0.05, 1.0, 0, 0.03, 0, 0));
  for (const [w, d, x, z] of [[1.6, 0.1, 0, 0.52], [1.6, 0.1, 0, -0.52], [0.1, 1.1, 0.77, 0], [0.1, 1.1, -0.77, 0]] as const) {
    g.add(box(p, WOOD, w, 0.16, d, x, 0.08, z, 0.01));
  }
  const rand = mulberry32(77);
  const colors = [0xf2a0c0, 0xffd447, 0xffffff, 0xc58be8, 0xf4684f];
  for (let n = 0; n < 11; n++) {
    const x = -0.6 + rand() * 1.2;
    const z = -0.34 + rand() * 0.68;
    g.add(solid(p, 0x4f9a3a, new CylinderGeometry(0.014, 0.014, 0.22, 5), x, 0.16, z, 0));
    g.add(solid(p, colors[n % colors.length]!, new SphereGeometry(0.07, 8, 6), x, 0.3, z, 0.008));
    g.add(solid(p, 0xffe27a, new SphereGeometry(0.03, 6, 5), x, 0.34, z, 0));
  }
  return g;
}

function lanterns(p: Palette): { group: Group; glows: MeshBasicMaterial[] } {
  const g = new Group();
  const glows: MeshBasicMaterial[] = [];
  const colors = [0xff6a4a, 0xffb347, 0xff6a4a];
  const xs = [-1.2, 0, 1.2];
  for (const x of xs) g.add(box(p, DARK_WOOD, 0.09, 1.5, 0.09, x, 0.75, 0, 0.01));
  g.add(box(p, DARK_WOOD, 2.6, 0.04, 0.04, 0, 1.45, 0, 0.005));
  xs.forEach((x, n) => {
    const m = new MeshBasicMaterial({ color: colors[n]! });
    glows.push(m);
    const lantern = new Mesh(new SphereGeometry(0.2, 10, 8), m);
    lantern.scale.set(1, 1.25, 1);
    lantern.position.set(x + 0.6, 1.15, 0);
    addHullOutline(lantern, 0.014);
    g.add(lantern);
    g.add(solid(p, 0x4a2b0f, new CylinderGeometry(0.06, 0.06, 0.04, 8), x + 0.6, 1.42, 0, 0));
  });
  return { group: g, glows };
}

function swing(p: Palette): { group: Group; seat: Group } {
  const g = new Group();
  for (const x of [-0.8, 0.8]) {
    const a = box(p, DARK_WOOD, 0.1, 1.9, 0.1, x, 0.95, 0.18, 0.01);
    a.rotation.x = -0.12;
    const b = box(p, DARK_WOOD, 0.1, 1.9, 0.1, x, 0.95, -0.18, 0.01);
    b.rotation.x = 0.12;
    g.add(a, b);
  }
  g.add(box(p, DARK_WOOD, 1.9, 0.1, 0.1, 0, 1.88, 0, 0.01));
  const seat = new Group();
  seat.position.y = 1.85;
  for (const x of [-0.3, 0.3]) seat.add(solid(p, 0xd8c7a0, new CylinderGeometry(0.012, 0.012, 1.4, 4), x, -0.7, 0, 0));
  seat.add(box(p, 0xe0a050, 0.8, 0.07, 0.3, 0, -1.4, 0, 0.01));
  g.add(seat);
  return { group: g, seat };
}

function fountain(p: Palette): { group: Group; jets: Mesh[] } {
  const g = new Group();
  g.add(solid(p, STONE, new CylinderGeometry(1.0, 1.1, 0.4, 14), 0, 0.2, 0));
  const water = new Mesh(new CylinderGeometry(0.88, 0.88, 0.03, 14), new MeshBasicMaterial({ color: 0x6fc4ee }));
  water.position.y = 0.4;
  g.add(water);
  g.add(solid(p, STONE, new CylinderGeometry(0.16, 0.22, 0.75, 8), 0, 0.7, 0));
  g.add(solid(p, STONE, new CylinderGeometry(0.5, 0.2, 0.18, 12), 0, 1.1, 0));
  const jets: Mesh[] = [];
  for (let n = 0; n < 6; n++) {
    const jet = new Mesh(new SphereGeometry(0.05, 6, 5), new MeshBasicMaterial({ color: 0xbfe8ff }));
    g.add(jet);
    jets.push(jet);
  }
  return { group: g, jets };
}

function gazebo(p: Palette): Group {
  const g = new Group();
  g.add(solid(p, 0xe8dcc0, new CylinderGeometry(1.7, 1.8, 0.25, 6), 0, 0.125, 0));
  const post = (a: number): Mesh => solid(p, 0xfff4e0, new CylinderGeometry(0.07, 0.07, 1.8, 6), Math.cos(a) * 1.5, 1.15, Math.sin(a) * 1.5, 0.01);
  for (let n = 0; n < 6; n++) g.add(post((n / 6) * Math.PI * 2));
  const roof = solid(p, 0xd6372b, new ConeGeometry(2.1, 1.1, 6), 0, 2.6, 0, 0.02);
  g.add(roof);
  g.add(solid(p, 0xffd447, new SphereGeometry(0.1, 8, 6), 0, 3.2, 0, 0.01));
  // Bunting between the posts.
  const colors = [0xf4684f, 0xffd447, 0x4aa8f0, 0x7fd04e];
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2;
    const b = ((n + 1) / 6) * Math.PI * 2;
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const x = Math.cos(a) * 1.5 * (1 - t) + Math.cos(b) * 1.5 * t;
      const z = Math.sin(a) * 1.5 * (1 - t) + Math.sin(b) * 1.5 * t;
      const flag = solid(p, colors[(n + k) % colors.length]!, new ConeGeometry(0.1, 0.2, 3), x * 0.98, 1.95 - Math.sin(t * Math.PI) * 0.1, z * 0.98, 0);
      flag.rotation.x = Math.PI;
      g.add(flag);
    }
  }
  return g;
}

/** Shows the decorations the player bought, each in its own corner of the farm. */
export class DecorView {
  readonly group = new Group();
  private readonly palette: Palette;
  private readonly shown = new Map<DecorId, Group>();
  private swings: Group[] = [];
  private jets: Mesh[] = [];
  private glows: MeshBasicMaterial[] = [];
  private time = 0;

  constructor(
    private readonly farm: Farm,
    gradientMap: DataTexture,
  ) {
    this.palette = new Palette(gradientMap);
  }

  private build(id: DecorId): Group {
    const p = this.palette;
    switch (id) {
      case 'banco':
        return bench(p);
      case 'flores':
        return flowerBed(p);
      case 'lanterna': {
        const l = lanterns(p);
        this.glows.push(...l.glows);
        return l.group;
      }
      case 'balanco': {
        const s = swing(p);
        this.swings.push(s.seat);
        return s.group;
      }
      case 'fonte': {
        const f = fountain(p);
        this.jets.push(...f.jets);
        return f.group;
      }
      case 'coreto':
        return gazebo(p);
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const id of DECOR_ORDER) {
      const owned = !!this.farm.decor[id];
      const have = this.shown.get(id);
      if (owned && !have) {
        const g = this.build(id);
        const def = DECOR[id];
        g.position.set(def.x, 0, def.z);
        g.rotation.y = id === 'coreto' ? 0 : Math.PI / 4;
        this.group.add(g);
        this.shown.set(id, g);
      } else if (!owned && have) {
        this.group.remove(have);
        this.shown.delete(id);
      }
    }
    for (const seat of this.swings) seat.rotation.x = Math.sin(this.time * 1.6) * 0.18;
    this.jets.forEach((jet, n) => {
      const a = (n / this.jets.length) * Math.PI * 2;
      const t = (this.time * 0.9 + n / this.jets.length) % 1;
      const r = 0.1 + t * 0.5;
      jet.position.set(Math.cos(a) * r, 1.2 + Math.sin(t * Math.PI) * 0.45, Math.sin(a) * r);
    });
  }
}
