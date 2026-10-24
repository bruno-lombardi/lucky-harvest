import {
  CylinderGeometry,
  ConeGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { SpeciesId } from '../core/animals';
import { addOutline } from './outline';

/** A built animal: the root to place in the world, plus the parts the animation moves. */
export interface AnimalModel {
  root: Group;
  body: Group;
  head: Group;
  /** World-units per second at a walk. */
  speed: number;
  /** Rough height, for placing indicators above it. */
  height: number;
}

/** Procedural farm animals. Everything faces +z; scale roughly matches the crop tiles. */
export class AnimalKit {
  private readonly materials = new Map<number, MeshToonMaterial>();
  private readonly sphere = new SphereGeometry(1, 18, 14);
  private readonly cone = new ConeGeometry(1, 1, 8);
  private readonly leg = new CylinderGeometry(1, 1, 1, 8);
  private readonly ring = new TorusGeometry(1, 0.28, 8, 14);

  constructor(private readonly gradientMap: DataTexture) {}

  private toon(color: number): MeshToonMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap });
      this.materials.set(color, m);
    }
    return m;
  }

  /** A shaded ellipsoid, optionally outlined. */
  private blob(color: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, outline = 0.012): Mesh {
    const m = new Mesh(this.sphere, this.toon(color));
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (outline > 0) addOutline(m, outline);
    return m;
  }

  private stick(color: number, r: number, h: number, x: number, y: number, z: number): Mesh {
    const m = new Mesh(this.leg, this.toon(color));
    m.scale.set(r, h, r);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  private tip(color: number, r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0): Mesh {
    const m = new Mesh(this.cone, this.toon(color));
    m.scale.set(r, h, r);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    return m;
  }

  private eyes(head: Group, y: number, z: number, spread: number, size: number): void {
    for (const side of [-1, 1]) {
      const eye = this.blob(0x1c1410, size, size, size, side * spread, y, z, 0);
      head.add(eye);
      const shine = this.blob(0xffffff, size * 0.35, size * 0.35, size * 0.35, side * spread + size * 0.25, y + size * 0.3, z + size * 0.6, 0);
      head.add(shine);
    }
  }

  build(species: SpeciesId, variant: number): AnimalModel {
    switch (species) {
      case 'galinha':
        return this.chicken(variant);
      case 'vaca':
        return this.cow(variant);
      case 'porco':
        return this.pig(variant);
    }
  }

  private chicken(variant: number): AnimalModel {
    const root = new Group();
    const body = new Group();
    const head = new Group();
    const plumage = [0xfff6e6, 0xd49a5a, 0xf2e0b8][variant % 3]!;
    const wing = [0xeadfc6, 0xb87a3c, 0xdcc48e][variant % 3]!;

    body.add(this.blob(plumage, 0.17, 0.15, 0.2, 0, 0.26, 0));
    for (const side of [-1, 1]) body.add(this.blob(wing, 0.04, 0.1, 0.14, side * 0.16, 0.27, -0.01, 0.008));
    for (const [rx, tx] of [[-0.5, -0.05], [-0.7, 0], [-0.5, 0.05]] as const) {
      body.add(this.tip(plumage, 0.05, 0.2, tx, 0.34, -0.2, rx, 0));
    }
    head.position.set(0, 0.4, 0.14);
    head.add(this.blob(plumage, 0.08, 0.08, 0.08, 0, 0, 0));
    head.add(this.tip(0xf0a030, 0.03, 0.08, 0, -0.01, 0.1, Math.PI / 2, 0));
    for (const [x, y, s] of [[0, 0.085, 0.03], [0.025, 0.075, 0.025], [-0.025, 0.075, 0.025]] as const) {
      head.add(this.blob(0xd8342b, s, s, s, x, y, 0.01, 0.006));
    }
    head.add(this.blob(0xd8342b, 0.018, 0.03, 0.018, 0, -0.07, 0.07, 0));
    this.eyes(head, 0.015, 0.06, 0.055, 0.014);
    body.add(head);
    for (const side of [-1, 1]) {
      root.add(this.stick(0xe08a2a, 0.011, 0.14, side * 0.05, 0.07, 0.01));
      root.add(this.blob(0xe08a2a, 0.03, 0.01, 0.04, side * 0.05, 0.01, 0.03, 0));
    }
    root.add(body);
    return { root, body, head, speed: 0.55, height: 0.55 };
  }

  private cow(variant: number): AnimalModel {
    const root = new Group();
    const body = new Group();
    const head = new Group();
    const hide = 0xfdfdfb;
    const patch = variant % 2 === 0 ? 0x2d2926 : 0x7a4a2a;

    body.add(this.blob(hide, 0.27, 0.25, 0.45, 0, 0.6, 0));
    for (const [x, y, z, sx, sy, sz] of [
      [0.2, 0.68, 0.08, 0.09, 0.13, 0.15],
      [-0.2, 0.62, -0.18, 0.09, 0.14, 0.14],
      [0.03, 0.83, 0.2, 0.15, 0.06, 0.12],
      [-0.12, 0.8, -0.1, 0.12, 0.07, 0.1],
    ] as const) {
      body.add(this.blob(patch, sx, sy, sz, x, y, z, 0));
    }
    body.add(this.blob(0xf4a6b0, 0.1, 0.07, 0.09, 0, 0.4, -0.2, 0.008)); // udder

    head.position.set(0, 0.74, 0.46);
    head.add(this.blob(hide, 0.17, 0.16, 0.18, 0, 0, 0));
    head.add(this.blob(0xf4a6b0, 0.12, 0.09, 0.08, 0, -0.07, 0.15, 0.01));
    for (const side of [-1, 1]) {
      head.add(this.blob(0x7a2f3a, 0.014, 0.014, 0.014, side * 0.045, -0.06, 0.225, 0));
      head.add(this.blob(hide, 0.05, 0.035, 0.07, side * 0.2, 0.05, -0.02, 0.008));
      head.add(this.tip(0xf2e6c0, 0.03, 0.12, side * 0.12, 0.17, -0.02, 0, -side * 0.5));
    }
    head.add(this.blob(patch, 0.1, 0.07, 0.06, 0.07, 0.1, 0.06, 0));
    this.eyes(head, 0.04, 0.15, 0.1, 0.022);
    body.add(head);

    for (const [x, z] of [[-0.14, 0.28], [0.14, 0.28], [-0.14, -0.26], [0.14, -0.26]] as const) {
      root.add(this.stick(hide, 0.055, 0.4, x, 0.2, z));
      root.add(this.stick(0x3a2a22, 0.062, 0.07, x, 0.035, z));
    }
    const tail = this.stick(hide, 0.015, 0.34, 0, 0.62, -0.46);
    tail.rotation.x = 0.35;
    body.add(tail);
    body.add(this.blob(patch, 0.04, 0.06, 0.04, 0, 0.44, -0.52, 0));
    root.add(body);
    return { root, body, head, speed: 0.22, height: 1.15 };
  }

  private pig(variant: number): AnimalModel {
    const root = new Group();
    const body = new Group();
    const head = new Group();
    const skin = variant % 2 === 0 ? 0xf4a7b6 : 0xf0b8a0;
    const dark = variant % 2 === 0 ? 0xe58a9c : 0xe29a80;

    body.add(this.blob(skin, 0.25, 0.22, 0.36, 0, 0.34, 0));
    head.position.set(0, 0.38, 0.34);
    head.add(this.blob(skin, 0.17, 0.16, 0.16, 0, 0, 0));
    const snout = this.stick(dark, 0.08, 0.07, 0, -0.03, 0.15);
    snout.rotation.x = Math.PI / 2;
    addOutline(snout, 0.008);
    head.add(snout);
    for (const side of [-1, 1]) {
      head.add(this.blob(0x7a3446, 0.012, 0.018, 0.012, side * 0.03, -0.03, 0.19, 0));
      head.add(this.tip(dark, 0.06, 0.1, side * 0.1, 0.14, 0.0, 0.4, -side * 0.6));
    }
    this.eyes(head, 0.04, 0.13, 0.075, 0.018);
    body.add(head);
    for (const [x, z] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]] as const) {
      root.add(this.stick(dark, 0.045, 0.2, x, 0.1, z));
      root.add(this.stick(0x5a3a30, 0.05, 0.04, x, 0.02, z));
    }
    const curl = new Mesh(this.ring, this.toon(dark));
    curl.scale.set(0.05, 0.05, 0.05);
    curl.position.set(0, 0.4, -0.37);
    body.add(curl);
    root.add(body);
    return { root, body, head, speed: 0.4, height: 0.7 };
  }
}
