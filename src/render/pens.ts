/**
 * @module render/pens
 *
 * The animal pens: empty plot, then building, yard, trough and animals, per species. The hungry/ready badges over animals come from `indicators.ts`. Layout is
 * `PEN_LAYOUT` (east side of the island). Animals and their little animations come from `animal-models.ts`. The biggest draw-call cost in
 * the scene after the crops; merge static parts per pen before adding more animals.
 */

import {
  CanvasTexture,
  CylinderGeometry,
  DataTexture,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
} from 'three';
import { AnimalPhase, AnimalState, SPECIES, SPECIES_ORDER, SpeciesId, animalStatus } from '../core/animals';
import { Farm } from '../core/farm';
import { mulberry32 } from '../core/noise';
import { AnimalKit, AnimalModel } from './animal-models';
import { createHungryIndicator, createProductIndicator } from './indicators';
import { addHullOutline } from './outline';
import { Palette, box } from './props';

/** Where each pen stands (world units). Pens line the east side of the island, away from the crop plot. */
export const PEN_LAYOUT: Readonly<Record<SpeciesId, { x: number; z: number; w: number; d: number; building: number }>> = {
  galinha: { x: 9.5, z: -3.3, w: 3.4, d: 3.0, building: 1.5 },
  porco: { x: 9.5, z: 0.9, w: 3.4, d: 3.0, building: 1.5 },
  vaca: { x: 9.6, z: 5.3, w: 3.8, d: 3.4, building: 1.7 },
};

/** Animals are modelled small; this brings each species to a readable size at default zoom. */
const ANIMAL_SCALE: Record<SpeciesId, number> = { galinha: 1.5, vaca: 1.05, porco: 1.3 };

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

interface HouseOptions {
  /** Size along x (depth, door side is +x) and z (width). */
  w: number;
  d: number;
  wallH: number;
  rise: number;
  wall: number;
  roof: number;
  trim?: number;
}

/** A gabled house with its ridge along z. The +x face and the +z gable face the camera. */
function house(palette: Palette, o: HouseOptions): Group {
  const g = new Group();
  g.add(box(palette, o.wall, o.w, o.wallH, o.d, 0, o.wallH / 2, 0, 0.016));

  const gable = new Shape();
  gable.moveTo(-o.w / 2, 0);
  gable.lineTo(o.w / 2, 0);
  gable.lineTo(0, o.rise);
  gable.closePath();
  const prismGeometry = new ExtrudeGeometry(gable, { depth: o.d, bevelEnabled: false });
  prismGeometry.translate(0, 0, -o.d / 2);
  const prism = new Mesh(prismGeometry, palette.toon(o.wall));
  prism.position.y = o.wallH;
  prism.castShadow = true;
  g.add(prism);

  const slope = Math.atan2(o.rise, o.w / 2);
  const length = Math.hypot(o.w / 2, o.rise) + 0.12;
  for (const side of [-1, 1]) {
    const slab = box(palette, o.roof, 0.07, length, o.d + 0.2, side * (o.w / 4 + 0.03), o.wallH + o.rise / 2 + 0.04, 0, 0.014);
    // The slab is tall along y; tilt it so its long side follows the roof slope.
    slab.rotation.z = side * (Math.PI / 2 - slope);
    g.add(slab);
  }
  if (o.trim !== undefined) {
    g.add(box(palette, o.trim, 0.06, o.wallH + 0.04, 0.12, o.w / 2, o.wallH / 2, o.d / 2, 0.008));
    g.add(box(palette, o.trim, 0.06, o.wallH + 0.04, 0.12, o.w / 2, o.wallH / 2, -o.d / 2, 0.008));
  }
  return g;
}

function coop(palette: Palette): Group {
  const g = new Group();
  const h = house(palette, { w: 1.2, d: 1.5, wallH: 0.75, rise: 0.5, wall: 0xf4ebd8, roof: 0xc23b2c, trim: 0xffffff });
  g.add(h);
  // Door, round window, and a ramp down to the yard.
  g.add(box(palette, 0x5a3a24, 0.05, 0.4, 0.34, 0.61, 0.28, 0.1, 0));
  g.add(box(palette, 0x3e5470, 0.05, 0.2, 0.2, 0.61, 0.62, -0.42, 0.006));
  const ramp = box(palette, 0xb98a52, 0.5, 0.05, 0.3, 0.88, 0.16, 0.1, 0.008);
  ramp.rotation.z = -0.5;
  g.add(ramp);
  // Nesting boxes along the camera-facing wall.
  g.add(box(palette, 0xe9c25a, 0.3, 0.26, 0.34, -0.1, 0.2, 0.9 + 0.17, 0.01));
  g.add(box(palette, 0x7a5a2a, 0.31, 0.04, 0.38, -0.1, 0.34, 0.9 + 0.17, 0.008));
  g.add(box(palette, 0xe8d28a, 0.3, 0.12, 0.2, 0.2, 0.06, 0.85, 0.008)); // straw
  return g;
}

function cowBarn(palette: Palette): Group {
  const g = new Group();
  const h = house(palette, { w: 1.5, d: 2.0, wallH: 0.95, rise: 0.6, wall: 0xb98150, roof: 0x4a7098, trim: 0xf4ebd8 });
  g.add(h);
  // Wide doorway with a lighter hay loft above.
  g.add(box(palette, 0x3a2418, 0.05, 0.72, 0.9, 0.76, 0.38, 0, 0));
  g.add(box(palette, 0xf4ebd8, 0.04, 0.08, 1.02, 0.77, 0.78, 0, 0.006));
  g.add(box(palette, 0xe9c25a, 0.04, 0.26, 0.4, 0.76, 1.12, 0, 0.008));
  g.add(box(palette, 0xf4ebd8, 0.04, 0.04, 0.3, 0.78, 1.12, 0, 0));
  // Milk cans beside the barn.
  const canGeometry = new CylinderGeometry(0.1, 0.1, 0.3, 12);
  for (const z of [0.95, 1.2]) {
    const can = new Mesh(canGeometry, palette.toon(0xcfd6dd));
    can.position.set(0.5, 0.15, z);
    can.castShadow = true;
    addHullOutline(can, 0.012);
    g.add(can);
  }
  return g;
}

function pigSty(palette: Palette): Group {
  const g = new Group();
  const h = house(palette, { w: 1.2, d: 1.4, wallH: 0.6, rise: 0.38, wall: 0xdba868, roof: 0xb5532f, trim: 0xf4ebd8 });
  g.add(h);
  g.add(box(palette, 0x3a2418, 0.05, 0.38, 0.5, 0.61, 0.2, 0, 0));
  g.add(box(palette, 0xf0c060, 0.04, 0.08, 0.6, 0.62, 0.42, 0, 0.006));
  return g;
}

/** Feed trough with a little fill. */
function trough(palette: Palette, fill: number): Group {
  const g = new Group();
  g.add(box(palette, 0x7a4f2a, 0.8, 0.16, 0.3, 0, 0.1, 0, 0.012));
  g.add(box(palette, fill, 0.7, 0.04, 0.2, 0, 0.18, 0, 0));
  return g;
}

function yardFloor(palette: Palette, w: number, d: number, color: number): Mesh {
  const m = box(palette, color, w, 0.05, d, 0, 0.025, 0, 0);
  m.castShadow = false;
  return m;
}

function yardFence(palette: Palette, w: number, d: number): Group {
  const g = new Group();
  const spacing = 0.85;
  const post = (x: number, z: number): void => {
    g.add(box(palette, 0xb98a52, 0.1, 0.5, 0.1, x, 0.25, z, 0.01));
  };
  const rail = (x: number, z: number, len: number, alongX: boolean): void => {
    for (const y of [0.2, 0.38]) g.add(box(palette, 0xe0b070, alongX ? len : 0.04, 0.05, alongX ? 0.04 : len, x, y, z, 0.008));
  };
  for (const sz of [-1, 1]) {
    const n = Math.max(2, Math.round(w / spacing));
    for (let k = 0; k <= n; k++) {
      const x = -w / 2 + (k / n) * w;
      post(x, (sz * d) / 2);
      if (k < n) rail(x + w / n / 2, (sz * d) / 2, w / n, true);
    }
  }
  for (const sx of [-1, 1]) {
    const n = Math.max(2, Math.round(d / spacing));
    for (let k = 1; k < n; k++) {
      const z = -d / 2 + (k / n) * d;
      post((sx * w) / 2, z);
    }
    for (let k = 0; k < n; k++) rail((sx * w) / 2, -d / 2 + ((k + 0.5) / n) * d, d / n, false);
  }
  return g;
}

function labelTexture(lines: string[]): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 192;
  if (!canvas.getContext('2d')) return null;
  const paint = (): void => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 384, 192);
    const wood = ctx.createLinearGradient(0, 0, 0, 192);
    wood.addColorStop(0, '#d9a566');
    wood.addColorStop(1, '#b57a3c');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, 384, 192);
    ctx.strokeStyle = 'rgba(90,50,20,0.28)';
    ctx.lineWidth = 3;
    for (let y = 48; y < 192; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(384, y);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    lines.forEach((line, n) => {
      const size = n === 0 ? 62 : 44;
      ctx.font = `700 ${size}px "Fredoka Variable", "Fredoka", "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 11;
      ctx.strokeStyle = '#5b3517';
      const y = n === 0 ? 62 : 138;
      ctx.strokeText(line, 192, y);
      ctx.fillStyle = n === 0 ? '#fff3d0' : '#ffe27a';
      ctx.fillText(line, 192, y);
    });
  };
  paint();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  void document.fonts?.load('700 40px "Fredoka Variable"').then(() => {
    paint();
    texture.needsUpdate = true;
  });
  return texture;
}

/** An empty building plot: bare ground, corner stakes and a sign saying what could be built here. */
function foundation(palette: Palette, species: SpeciesId): Group {
  const def = SPECIES[species];
  const { w, d } = PEN_LAYOUT[species];
  const g = new Group();
  g.add(yardFloor(palette, w, d, 0xcfb487));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(box(palette, 0xa8773e, 0.1, 0.55, 0.1, (sx * (w - 0.3)) / 2, 0.27, (sz * (d - 0.3)) / 2, 0.01));
    }
  }
  for (const sz of [-1, 1]) g.add(box(palette, 0xe9d9b0, w - 0.4, 0.03, 0.03, 0, 0.5, (sz * (d - 0.3)) / 2, 0));
  for (const sx of [-1, 1]) g.add(box(palette, 0xe9d9b0, 0.03, 0.03, d - 0.4, (sx * (w - 0.3)) / 2, 0.5, 0, 0));

  const sign = new Group();
  sign.position.set(0, 0, 0);
  for (const x of [-0.5, 0.5]) sign.add(box(palette, 0x8a5a34, 0.1, 0.9, 0.1, x, 0.45, 0, 0.01));
  sign.add(box(palette, 0xc58e52, 1.3, 0.55, 0.08, 0, 0.8, 0, 0.016));
  const texture = labelTexture([def.penName, `Nível ${def.unlockLevel}`]);
  const face = new Mesh(
    new PlaneGeometry(1.2, 0.5),
    new MeshBasicMaterial(texture ? { map: texture } : { color: 0xd9a566 }),
  );
  face.position.set(0, 0.8, 0.045);
  sign.add(face);
  // Visible from the camera side: turn the sign to face +x/+z.
  sign.rotation.y = Math.PI / 4;
  g.add(sign);
  return g;
}

// ---------------------------------------------------------------------------
// Animals in a pen
// ---------------------------------------------------------------------------

interface AnimalEntry {
  id: number;
  model: AnimalModel;
  rand: () => number;
  target: { x: number; z: number };
  pause: number;
  heading: number;
  phase: number;
  indicator: Group | null;
  indicatorKey: string;
  age: number;
}

interface PenEntry {
  species: SpeciesId;
  root: Group;
  content: Group | null;
  built: boolean;
  animals: Map<number, AnimalEntry>;
  /** Seconds since the building appeared, for the pop-in. */
  age: number;
}

/** Builds each pen from farm state: an empty plot until bought, then building, yard and animals. */
export class Pens {
  readonly group = new Group();
  private readonly entries = new Map<SpeciesId, PenEntry>();
  private readonly palette: Palette;
  private readonly kit: AnimalKit;
  private time = 0;

  constructor(
    private readonly farm: Farm,
    gradientMap: DataTexture,
  ) {
    this.palette = new Palette(gradientMap);
    this.kit = new AnimalKit(gradientMap);
    for (const species of SPECIES_ORDER) {
      const layout = PEN_LAYOUT[species];
      const root = new Group();
      root.position.set(layout.x, 0, layout.z);
      root.userData['pickId'] = `pen:${species}`;
      this.group.add(root);
      this.entries.set(species, { species, root, content: null, built: false, animals: new Map(), age: 1 });
    }
  }

  /** Objects the picker should test for taps (each carries `userData.pickId`). */
  pickRoots(): Object3D[] {
    return [...this.entries.values()].map((e) => e.root);
  }

  update(dt: number, now: number): void {
    this.time += dt;
    for (const entry of this.entries.values()) {
      const pen = this.farm.pens[entry.species];
      const built = !!pen;
      if (built !== entry.built || entry.content === null) this.rebuild(entry, built);
      entry.age += dt;
      const pop = entry.age < 0.5 ? 1 + Math.sin((entry.age / 0.5) * Math.PI) * 0.12 : 1;
      entry.root.scale.setScalar(pop);
      if (pen) this.syncAnimals(entry, pen.animals, now, dt);
    }
  }

  private rebuild(entry: PenEntry, built: boolean): void {
    if (entry.content) entry.root.remove(entry.content);
    const { w, d, building } = PEN_LAYOUT[entry.species];
    const content = new Group();
    if (built) {
      const floor = entry.species === 'porco' ? 0x8a6a45 : 0xd7bd84;
      content.add(yardFloor(this.palette, w, d, floor));
      content.add(yardFence(this.palette, w, d));
      const house =
        entry.species === 'galinha' ? coop(this.palette) : entry.species === 'vaca' ? cowBarn(this.palette) : pigSty(this.palette);
      house.position.x = -w / 2 + building / 2 + 0.15;
      content.add(house);

      const fill = entry.species === 'vaca' ? 0xe9c25a : entry.species === 'porco' ? 0xb8864a : 0xe8d28a;
      const feeder = trough(this.palette, entry.species === 'porco' ? 0x9a7a55 : fill);
      feeder.position.set(w / 2 - 0.9, 0.05, d / 2 - 0.5);
      feeder.rotation.y = 0.1;
      content.add(feeder);
      if (entry.species === 'porco') {
        const mud = box(this.palette, 0x5d4128, 1.1, 0.03, 0.8, 0.2, 0.06, -d / 2 + 0.7, 0);
        mud.castShadow = false;
        content.add(mud);
      }
    } else {
      content.add(foundation(this.palette, entry.species));
    }
    entry.root.add(content);
    entry.content = content;
    entry.built = built;
    entry.age = 0;
  }

  private bounds(species: SpeciesId): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const { w, d, building } = PEN_LAYOUT[species];
    return {
      minX: -w / 2 + building + 0.45,
      maxX: w / 2 - 0.4,
      minZ: -d / 2 + 0.4,
      maxZ: d / 2 - 0.4,
    };
  }

  private syncAnimals(entry: PenEntry, animals: readonly AnimalState[], now: number, dt: number): void {
    const species = entry.species;
    const ids = new Set(animals.map((a) => a.id));
    for (const [id, a] of entry.animals) {
      if (!ids.has(id)) {
        entry.root.remove(a.model.root);
        entry.animals.delete(id);
      }
    }
    const b = this.bounds(species);
    for (const state of animals) {
      let a = entry.animals.get(state.id);
      if (!a) {
        const rand = mulberry32(state.id * 7919 + 13);
        const model = this.kit.build(species, state.id);
        model.root.scale.setScalar(ANIMAL_SCALE[species]);
        const x = MathUtils.lerp(b.minX, b.maxX, rand());
        const z = MathUtils.lerp(b.minZ, b.maxZ, rand());
        model.root.position.set(x, 0.05, z);
        model.root.rotation.y = rand() * Math.PI * 2;
        entry.root.add(model.root);
        a = {
          id: state.id,
          model,
          rand,
          target: { x, z },
          pause: rand() * 2,
          heading: model.root.rotation.y,
          phase: rand() * 6,
          indicator: null,
          indicatorKey: '',
          age: 0,
        };
        entry.animals.set(state.id, a);
      }
      this.animate(a, species, animalStatus(species, state, now).phase, b, dt);
      this.syncIndicator(a, species, animalStatus(species, state, now).phase);
    }
  }

  private animate(
    a: AnimalEntry,
    species: SpeciesId,
    phase: AnimalPhase,
    b: { minX: number; maxX: number; minZ: number; maxZ: number },
    dt: number,
  ): void {
    const { root, body, head } = a.model;
    a.age += dt;
    const t = this.time + a.phase;
    // A small hop when the animal appears, so a new purchase is noticed.
    const appear = a.age < 0.5 ? Math.sin((a.age / 0.5) * Math.PI) * 0.25 : 0;

    if (a.pause > 0) {
      a.pause -= dt;
      body.position.y = 0;
      // Idle: chickens peck, cows graze slowly, pigs snuffle.
      if (species === 'galinha') head.rotation.x = Math.max(0, Math.sin(t * 7)) * 0.9;
      else if (species === 'vaca') head.rotation.x = 0.35 + Math.sin(t * 1.5) * 0.12;
      else head.rotation.x = Math.sin(t * 5) * 0.1;
      body.rotation.z = 0;
      for (const leg of a.model.legs) leg.rotation.x *= 0.8;
      if (a.model.tail) a.model.tail.rotation.z = Math.sin(t * (species === 'porco' ? 3 : 1.8)) * 0.25;
      if (a.pause <= 0) {
        a.target = { x: MathUtils.lerp(b.minX, b.maxX, a.rand()), z: MathUtils.lerp(b.minZ, b.maxZ, a.rand()) };
      }
    } else {
      const dx = a.target.x - root.position.x;
      const dz = a.target.z - root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.06) {
        a.pause = 1.2 + a.rand() * 3.2;
      } else {
        const want = Math.atan2(dx, dz);
        let delta = want - a.heading;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        a.heading += delta * Math.min(1, dt * 6);
        const speed = a.model.speed * (phase === 'hungry' ? 0.7 : 1);
        const step = Math.min(dist, speed * dt);
        root.position.x += Math.sin(a.heading) * step;
        root.position.z += Math.cos(a.heading) * step;
        root.position.x = MathUtils.clamp(root.position.x, b.minX, b.maxX);
        root.position.z = MathUtils.clamp(root.position.z, b.minZ, b.maxZ);
        const gait = species === 'galinha' ? 14 : species === 'vaca' ? 5 : 9;
        body.position.y = Math.abs(Math.sin(t * gait)) * (species === 'vaca' ? 0.015 : 0.03);
        body.rotation.z = Math.sin(t * gait) * 0.05;
        head.rotation.x = species === 'galinha' ? Math.sin(t * gait * 2) * 0.15 : 0;
        // Diagonal pairs of legs swing together.
        const swing = species === 'vaca' ? 0.5 : 0.65;
        a.model.legs.forEach((leg, n) => (leg.rotation.x = Math.sin(t * gait + (n === 0 || n === 3 ? 0 : Math.PI)) * swing));
      }
    }
    root.rotation.y = a.heading;
    root.position.y = 0.05 + appear;
  }

  private syncIndicator(a: AnimalEntry, species: SpeciesId, phase: AnimalPhase): void {
    const key = phase === 'hungry' ? 'hungry' : phase === 'ready' ? `product:${SPECIES[species].product}` : '';
    if (key !== a.indicatorKey) {
      if (a.indicator) a.model.root.remove(a.indicator);
      a.indicator = null;
      if (key === 'hungry') a.indicator = createHungryIndicator();
      else if (key) a.indicator = createProductIndicator(SPECIES[species].product);
      a.indicatorKey = key;
      if (a.indicator) a.model.root.add(a.indicator);
    }
    if (a.indicator) {
      // The indicator is a child of the (scaled) animal: keep it a constant size and just above the back.
      const s = 1 / ANIMAL_SCALE[species];
      a.indicator.scale.setScalar(s * (1 + 0.06 * Math.sin(this.time * 4 + a.phase)));
      a.indicator.position.y = a.model.height + (0.3 + 0.05 * Math.sin(this.time * 3 + a.phase)) * s;
      a.indicator.rotation.y = -a.heading; // billboards ignore it, but keeps the group upright
    }
  }
}
