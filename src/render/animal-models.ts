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
  /** Leg pivots at the hip (front left, front right, back left, back right), swung while walking. */
  legs: Group[];
  /** Tail pivot, if the animal has one that moves. */
  tail: Group | null;
}

/** Procedural farm animals. Everything faces +z; scale roughly matches the crop tiles. */
export class AnimalKit {
  private readonly materials = new Map<number, MeshToonMaterial>();
  private readonly sphere = new SphereGeometry(1, 18, 14);
  private readonly cone = new ConeGeometry(1, 1, 8);
  private readonly leg = new CylinderGeometry(1, 1, 1, 8);
  private readonly ring = new TorusGeometry(1, 0.28, 8, 14);
  /** A limb that is wider at the top than at the foot. */
  private readonly taper = new CylinderGeometry(1, 0.62, 1, 10);

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
    return { root, body, head, speed: 0.55, height: 0.55, legs: [], tail: null };
  }

  /** A leg hanging from a hip pivot at y = `hipY`: tapered limb, a pale sock (optional) and a hoof. */
  private limb(x: number, z: number, hipY: number, r: number, color: number, hoof: number, sock: number | null): Group {
    const g = new Group();
    g.position.set(x, hipY, z);
    const upper = new Mesh(this.taper, this.toon(color));
    upper.scale.set(r, hipY - 0.06, r);
    upper.position.y = -(hipY - 0.06) / 2;
    upper.castShadow = true;
    addOutline(upper, 0.008);
    g.add(upper);
    if (sock !== null) g.add(this.stick(sock, r * 0.66, 0.09, 0, -hipY + 0.1, 0));
    g.add(this.blob(hoof, r * 0.72, 0.045, r * 0.85, 0, -hipY + 0.035, r * 0.12, 0.006));
    return g;
  }

  private cow(variant: number): AnimalModel {
    const root = new Group();
    const body = new Group();
    const head = new Group();
    const hide = 0xfbfaf6;
    const shade = 0xe9e4d8;
    const patch = variant % 2 === 0 ? 0x2d2926 : 0x8a5230;
    const pink = 0xf4a6b0;
    const hoof = 0x3a2a22;

    // Barrel, chest, rump and belly: overlapping masses read as one body with shoulders and hips.
    body.add(this.blob(hide, 0.27, 0.25, 0.44, 0, 0.62, 0));
    body.add(this.blob(hide, 0.25, 0.24, 0.2, 0, 0.6, 0.27));
    body.add(this.blob(hide, 0.26, 0.24, 0.2, 0, 0.63, -0.26));
    body.add(this.blob(shade, 0.22, 0.09, 0.34, 0, 0.45, 0.02, 0));
    body.add(this.blob(hide, 0.13, 0.08, 0.16, 0, 0.83, 0.2, 0)); // withers
    // Coat patches that hug the body.
    for (const [x, y, z, sx, sy, sz] of [
      [0.21, 0.7, 0.04, 0.07, 0.15, 0.17],
      [-0.2, 0.66, -0.2, 0.08, 0.15, 0.15],
      [0.02, 0.86, -0.05, 0.14, 0.06, 0.2],
      [-0.22, 0.58, 0.3, 0.06, 0.1, 0.1],
      [0.22, 0.56, -0.3, 0.06, 0.09, 0.1],
    ] as const) {
      body.add(this.blob(patch, sx, sy, sz, x, y, z, 0));
    }
    // Udder and teats.
    body.add(this.blob(pink, 0.1, 0.07, 0.09, 0, 0.41, -0.2, 0.008));
    for (const [x, z] of [[-0.04, -0.17], [0.04, -0.17], [-0.04, -0.24], [0.04, -0.24]] as const) {
      body.add(this.stick(0xe58a9c, 0.014, 0.05, x, 0.36, z));
    }

    // Neck and head.
    body.add(this.blob(hide, 0.14, 0.15, 0.18, 0, 0.72, 0.42));
    body.add(this.blob(shade, 0.1, 0.1, 0.1, 0, 0.58, 0.46, 0)); // dewlap
    head.position.set(0, 0.72, 0.53);
    head.add(this.blob(hide, 0.14, 0.15, 0.16, 0, 0, 0));
    head.add(this.blob(patch, 0.08, 0.08, 0.05, 0.05, 0.06, 0.1, 0)); // face patch
    head.add(this.blob(pink, 0.11, 0.085, 0.09, 0, -0.07, 0.13, 0.01)); // muzzle
    head.add(this.blob(0xf7bcc4, 0.075, 0.03, 0.05, 0, -0.045, 0.19, 0));
    for (const side of [-1, 1]) {
      head.add(this.blob(0x7a2f3a, 0.014, 0.016, 0.012, side * 0.04, -0.06, 0.205, 0)); // nostrils
      const ear = this.blob(hide, 0.075, 0.03, 0.05, side * 0.19, 0.06, -0.03, 0.008);
      ear.rotation.z = side * 0.4;
      head.add(ear);
      const inner = this.blob(pink, 0.05, 0.02, 0.03, side * 0.19, 0.055, -0.01, 0);
      inner.rotation.z = side * 0.4;
      head.add(inner);
      // Short curved horns: a cream base and a lighter tip.
      const horn = this.tip(0xf2e6c0, 0.032, 0.12, side * 0.1, 0.17, -0.01, 0, -side * 0.55);
      addOutline(horn, 0.006);
      head.add(horn);
    }
    head.add(this.blob(shade, 0.09, 0.06, 0.06, 0, 0.13, 0.0, 0)); // forelock
    this.eyes(head, 0.045, 0.12, 0.09, 0.024);
    for (const side of [-1, 1]) head.add(this.blob(0x2d2926, 0.034, 0.008, 0.012, side * 0.09, 0.085, 0.125, 0)); // brows
    body.add(head);

    // Legs hang from the hips so they can swing.
    const legs = [
      this.limb(-0.14, 0.28, 0.5, 0.055, hide, hoof, null),
      this.limb(0.14, 0.28, 0.5, 0.055, hide, hoof, null),
      this.limb(-0.14, -0.27, 0.5, 0.06, hide, hoof, null),
      this.limb(0.14, -0.27, 0.5, 0.06, hide, hoof, null),
    ];
    for (const leg of legs) root.add(leg);

    const tail = new Group();
    tail.position.set(0, 0.74, -0.45);
    const rope = this.stick(hide, 0.014, 0.36, 0, -0.17, -0.03);
    rope.rotation.x = -0.12;
    tail.add(rope);
    tail.add(this.blob(patch, 0.04, 0.07, 0.04, 0, -0.38, -0.05, 0.004));
    body.add(tail);

    root.add(body);
    return { root, body, head, speed: 0.22, height: 1.15, legs, tail };
  }

  private pig(variant: number): AnimalModel {
    const root = new Group();
    const body = new Group();
    const head = new Group();
    const spotted = variant % 2 === 1;
    const skin = spotted ? 0xf6dcd0 : 0xf4a7b6;
    const dark = spotted ? 0xe8b8a8 : 0xe58a9c;
    const belly = spotted ? 0xfbece4 : 0xf9c3cd;
    const hoof = 0x5a3a30;

    body.add(this.blob(skin, 0.24, 0.22, 0.34, 0, 0.36, 0));
    body.add(this.blob(skin, 0.23, 0.22, 0.17, 0, 0.35, -0.2)); // hams
    body.add(this.blob(skin, 0.22, 0.21, 0.16, 0, 0.36, 0.2)); // shoulders
    body.add(this.blob(belly, 0.2, 0.09, 0.28, 0, 0.2, 0.0, 0));
    if (spotted) {
      for (const [x, y, z, sx, sy, sz] of [
        [0.18, 0.44, -0.12, 0.08, 0.08, 0.12],
        [-0.16, 0.42, 0.1, 0.07, 0.09, 0.1],
        [0.0, 0.55, -0.02, 0.1, 0.04, 0.12],
      ] as const) {
        body.add(this.blob(0x4a3a36, sx, sy, sz, x, y, z, 0));
      }
    }

    head.position.set(0, 0.4, 0.34);
    head.add(this.blob(skin, 0.165, 0.15, 0.15, 0, 0, 0));
    for (const side of [-1, 1]) head.add(this.blob(skin, 0.07, 0.08, 0.1, side * 0.12, -0.05, 0.03, 0.006)); // jowls
    // Snout: a short disc with a rim and two nostrils.
    const snout = this.stick(dark, 0.085, 0.07, 0, -0.035, 0.145);
    snout.rotation.x = Math.PI / 2;
    addOutline(snout, 0.008);
    head.add(snout);
    head.add(this.blob(0xf7b4c0, 0.07, 0.07, 0.012, 0, -0.035, 0.185, 0));
    for (const side of [-1, 1]) {
      head.add(this.blob(0x7a3446, 0.014, 0.022, 0.012, side * 0.03, -0.035, 0.196, 0));
      // Ears fold forward over the eyes.
      const ear = this.blob(dark, 0.075, 0.03, 0.075, side * 0.1, 0.14, 0.02, 0.008);
      ear.rotation.set(0.5, 0, side * 0.7);
      head.add(ear);
    }
    this.eyes(head, 0.04, 0.11, 0.075, 0.017);
    for (const side of [-1, 1]) head.add(this.blob(skin, 0.03, 0.012, 0.015, side * 0.075, 0.062, 0.11, 0)); // eyelids
    body.add(head);

    const legs = [
      this.limb(-0.12, 0.2, 0.2, 0.05, dark, hoof, null),
      this.limb(0.12, 0.2, 0.2, 0.05, dark, hoof, null),
      this.limb(-0.12, -0.2, 0.2, 0.052, dark, hoof, null),
      this.limb(0.12, -0.2, 0.2, 0.052, dark, hoof, null),
    ];
    for (const leg of legs) root.add(leg);

    // Curly tail made of a coil, pivoting at the rump.
    const tail = new Group();
    tail.position.set(0, 0.42, -0.36);
    const curl = new Mesh(this.ring, this.toon(dark));
    curl.scale.set(0.045, 0.045, 0.045);
    curl.rotation.y = Math.PI / 2;
    curl.position.set(0, 0.03, -0.02);
    addOutline(curl, 0.004);
    tail.add(curl);
    tail.add(this.stick(dark, 0.012, 0.05, 0, 0.0, -0.01));
    body.add(tail);

    root.add(body);
    return { root, body, head, speed: 0.4, height: 0.7, legs, tail };
  }
}
