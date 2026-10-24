import { BoxGeometry, ConeGeometry, CylinderGeometry, DataTexture, Group, Mesh, SphereGeometry } from 'three';
import { addHullOutline } from './outline';
import { Palette, box } from './props';

/** Wheel radius, for rolling the wheels as the truck moves. */
export const WHEEL_RADIUS = 0.27;

export interface TruckModel {
  /** The whole truck, facing +z. */
  group: Group;
  /** Everything that sits on the springs (body, cab, load) so it can bob and pitch. */
  body: Group;
  wheels: Group[];
  /** Hinged at the bottom rear edge of the bed; rotate.x < 0 swings it down. */
  tailgate: Group;
  /** The seed sacks in the bed, in the order they are unloaded. */
  sacks: Group[];
  /** Where each sack rests, in the truck's own frame. */
  sackHome: Array<{ x: number; y: number; z: number }>;
}

const GREEN = 0x3c9a5f;
const CREAM = 0xf3e7c6;
const WOOD = 0xb98a52;
const DARK = 0x2b2b33;

function sack(palette: Palette): Group {
  const g = new Group();
  const body = new Mesh(new BoxGeometry(0.34, 0.24, 0.26), palette.toon(0xd9c08a));
  body.castShadow = true;
  addHullOutline(body, 0.015);
  g.add(body);
  // A tied neck and a little green label.
  const neck = new Mesh(new ConeGeometry(0.09, 0.1, 6), palette.toon(0xd9c08a));
  neck.position.y = 0.17;
  g.add(neck);
  const tie = new Mesh(new CylinderGeometry(0.05, 0.05, 0.025, 6), palette.toon(0x9b3a2a));
  tie.position.y = 0.13;
  g.add(tie);
  const label = new Mesh(new BoxGeometry(0.2, 0.12, 0.012), palette.toon(GREEN));
  label.position.set(0, 0, 0.134);
  g.add(label);
  return g;
}

/** A little green farm pickup with an open bed full of seed sacks. Faces +z. */
export function buildTruck(gradientMap: DataTexture): TruckModel {
  const palette = new Palette(gradientMap);
  const group = new Group();
  const body = new Group();
  group.add(body);

  // Chassis and bumpers.
  body.add(box(palette, DARK, 0.9, 0.16, 2.3, 0, 0.34, 0.0, 0.015));
  body.add(box(palette, 0xc9ccd2, 1.12, 0.1, 0.12, 0, 0.32, 1.52, 0.012));
  body.add(box(palette, 0xc9ccd2, 1.12, 0.1, 0.1, 0, 0.32, -1.18, 0.012));

  // Bed: wooden floor and side boards.
  body.add(box(palette, WOOD, 1.04, 0.07, 1.2, 0, 0.44, -0.55, 0.012));
  for (const sx of [-1, 1]) body.add(box(palette, GREEN, 0.06, 0.34, 1.2, sx * 0.5, 0.62, -0.55, 0.014));
  body.add(box(palette, GREEN, 1.04, 0.34, 0.06, 0, 0.62, 0.02, 0.014));
  // Wheel arches over the rear wheels.
  for (const sx of [-1, 1]) body.add(box(palette, 0x2e7d4a, 0.1, 0.1, 0.62, sx * 0.55, 0.52, -0.62, 0.01));

  // Tailgate on a hinge.
  const tailgate = new Group();
  tailgate.position.set(0, 0.44, -1.15);
  tailgate.add(box(palette, GREEN, 1.04, 0.32, 0.05, 0, 0.16, 0, 0.012));
  tailgate.add(box(palette, CREAM, 0.5, 0.06, 0.055, 0, 0.18, 0, 0));
  body.add(tailgate);

  // Cab: cream roof, green body, glass.
  body.add(box(palette, GREEN, 1.04, 0.52, 0.8, 0, 0.75, 0.6, 0.016));
  body.add(box(palette, CREAM, 1.1, 0.07, 0.88, 0, 1.04, 0.6, 0.014));
  body.add(box(palette, -1, 0.82, 0.3, 0.03, 0, 0.84, 1.0, 0));
  body.add(box(palette, -1, 0.82, 0.26, 0.03, 0, 0.84, 0.2, 0));
  for (const sx of [-1, 1]) body.add(box(palette, -1, 0.03, 0.28, 0.5, sx * 0.525, 0.84, 0.6, 0));
  // Hood, grille and lights.
  body.add(box(palette, GREEN, 1.02, 0.34, 0.6, 0, 0.6, 1.2, 0.016));
  body.add(box(palette, CREAM, 0.7, 0.2, 0.03, 0, 0.56, 1.51, 0));
  for (let n = -2; n <= 2; n++) body.add(box(palette, DARK, 0.03, 0.16, 0.035, n * 0.12, 0.56, 1.52, 0));
  for (const sx of [-1, 1]) {
    const lamp = new Mesh(new SphereGeometry(0.09, 10, 8), palette.toon(0xfff2a8));
    lamp.position.set(sx * 0.36, 0.64, 1.49);
    lamp.scale.z = 0.6;
    body.add(lamp);
    // Mudguards.
    body.add(box(palette, 0x2e7d4a, 0.12, 0.08, 0.66, sx * 0.55, 0.56, 1.0, 0.01));
  }

  // A farmer at the wheel with a straw hat.
  const head = new Mesh(new SphereGeometry(0.15, 12, 10), palette.toon(0xf0c49c));
  head.position.set(0.2, 0.94, 0.55);
  body.add(head);
  const brim = new Mesh(new CylinderGeometry(0.25, 0.25, 0.025, 14), palette.toon(0xe3c26a));
  brim.position.set(0.2, 1.06, 0.55);
  body.add(brim);
  const crown = new Mesh(new CylinderGeometry(0.12, 0.14, 0.1, 12), palette.toon(0xe3c26a));
  crown.position.set(0.2, 1.12, 0.55);
  body.add(crown);
  const band = new Mesh(new CylinderGeometry(0.143, 0.143, 0.03, 12), palette.toon(0xc4372c));
  band.position.set(0.2, 1.09, 0.55);
  body.add(band);

  // Wheels roll on their own, outside the sprung body.
  const wheels: Group[] = [];
  const tire = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.2, 14);
  tire.rotateZ(Math.PI / 2);
  const hub = new CylinderGeometry(0.12, 0.12, 0.215, 8);
  hub.rotateZ(Math.PI / 2);
  for (const [sx, z] of [
    [-1, 1.0],
    [1, 1.0],
    [-1, -0.6],
    [1, -0.6],
  ] as const) {
    const spin = new Group();
    const t = new Mesh(tire, palette.toon(0x26262c));
    t.castShadow = true;
    addHullOutline(t, 0.018);
    spin.add(t, new Mesh(hub, palette.toon(0xd6d9de)));
    // One bright spoke so the rolling reads.
    spin.add(box(palette, 0x8b8f98, 0.22, 0.05, 0.3, 0, 0, 0, 0));
    const holder = new Group();
    holder.position.set(sx * 0.52, WHEEL_RADIUS, z);
    holder.add(spin);
    group.add(holder);
    wheels.push(spin);
  }

  // The load.
  const sackHome = [
    { x: -0.26, y: 0.6, z: -0.3 },
    { x: 0.26, y: 0.6, z: -0.3 },
    { x: -0.26, y: 0.6, z: -0.7 },
    { x: 0.26, y: 0.6, z: -0.7 },
    { x: -0.26, y: 0.6, z: -1.0 },
    { x: 0.0, y: 0.82, z: -0.5 },
  ];
  const sacks = sackHome.map((p, n) => {
    const s = sack(palette);
    s.position.set(p.x, p.y, p.z);
    s.rotation.y = (n % 2 === 0 ? 1 : -1) * 0.12;
    body.add(s);
    return s;
  });

  return { group, body, wheels, tailgate, sacks, sackHome };
}
