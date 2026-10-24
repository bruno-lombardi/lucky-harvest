import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { Farm } from '../core/farm';
import { CharacterKit } from './characters';
import { createBakedIndicator } from './indicators';
import { addHullOutline } from './outline';
import { Palette, box } from './props';

/** Where the Confeitaria stands: the north corner of the island, between the barn and the Pomar. Its counter faces the plot. */
export const BAKERY_SPOT = { x: -8.6, z: -8.5, rotation: Math.PI / 4 };

const CREAM = 0xfff0d2;
const PINK = 0xe8618c;
const WOOD = 0x9a6a3a;
const TILE = 0xc9573a;
const BRICK = 0xb5502f;
const FLAGS = [0xe5372b, 0xf2c94a, 0x3f9a45, 0x3f7fe0, 0xff8a1f, 0xe8618c];

const W = 2.6;
const D = 2.5;
const WALL = 1.8;

function signTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const paint = (): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 160);
    const g = ctx.createLinearGradient(0, 0, 0, 160);
    g.addColorStop(0, '#f48fb1');
    g.addColorStop(1, '#e8618c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#fff6e4';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 140);
    ctx.fillStyle = '#fff6e4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const family = '"Fredoka Variable", "Fredoka", "Trebuchet MS", Verdana, sans-serif';
    ctx.font = `700 54px ${family}`;
    ctx.fillText('Confeitaria', 256, 62);
    ctx.font = `600 36px ${family}`;
    ctx.fillText('da Dona Zefa', 256, 112);
  };
  if (!canvas.getContext('2d')) return null;
  paint();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  void document.fonts?.load('700 40px "Fredoka Variable"').then(() => {
    paint();
    texture.needsUpdate = true;
  });
  return texture;
}

function puffTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface Built {
  root: Group;
  glow: Mesh;
}

/** A string of festa-junina pennants between two points, sagging in the middle. */
function bunting(palette: Palette, from: [number, number, number], to: [number, number, number], flags: number): Group {
  const g = new Group();
  const point = (t: number): [number, number, number] => [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t - Math.sin(Math.PI * t) * 0.22,
    from[2] + (to[2] - from[2]) * t,
  ];
  const segments = flags * 2;
  for (let n = 0; n < segments; n++) {
    const a = point(n / segments);
    const b = point((n + 1) / segments);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const piece = new Mesh(new BoxGeometry(0.02, 0.02, length), palette.toon(0x6b4423));
    piece.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    piece.lookAt(b[0], b[1], b[2]);
    g.add(piece);
  }
  const heading = Math.atan2(to[0] - from[0], to[2] - from[2]);
  for (let n = 0; n < flags; n++) {
    const p = point((n + 0.5) / flags);
    const flag = new Mesh(new CircleGeometry(0.11, 3), new MeshToonMaterial({ color: FLAGS[n % FLAGS.length]!, side: DoubleSide, gradientMap: palette.toon(0xffffff).gradientMap }));
    flag.rotation.set(0, heading + Math.PI / 2, Math.PI);
    flag.position.set(p[0], p[1] - 0.1, p[2]);
    g.add(flag);
  }
  return g;
}

function buildBakery(palette: Palette, level: number): Built {
  const root = new Group();

  // Foundation and walls.
  root.add(box(palette, 0xd9c7a0, W + 0.5, 0.1, D + 0.55, 0, 0.05, 0.05, 0.014));
  const wall = level >= 2 ? 0xffe7ec : CREAM;
  const wainscot = level >= 3 ? 0xd94a7a : PINK;
  root.add(box(palette, wall, 0.12, WALL, D, -W / 2 + 0.06, 0.1 + WALL / 2, 0, 0.014));
  root.add(box(palette, wall, 0.12, WALL, D, W / 2 - 0.06, 0.1 + WALL / 2, 0, 0.014));
  root.add(box(palette, wall, W, WALL, 0.12, 0, 0.1 + WALL / 2, -D / 2 + 0.06, 0.014));
  const front = D / 2 - 0.06;
  for (const side of [-1, 1]) root.add(box(palette, wall, 0.55, WALL, 0.12, side * (W / 2 - 0.275), 0.1 + WALL / 2, front, 0.014));
  root.add(box(palette, wall, W - 1.1, 0.1, 0.12, 0, 0.1 + WALL - 0.05, front, 0.012));
  root.add(box(palette, wall, W - 1.1, 0.5, 0.12, 0, 0.35, front, 0.014));
  // The painted band along the bottom.
  root.add(box(palette, wainscot, W + 0.02, 0.32, D + 0.02, 0, 0.27, 0, 0));
  // Dark inside.
  root.add(box(palette, 0x6b4a36, W - 0.3, WALL - 0.1, 0.05, 0, 0.1 + WALL / 2, -D / 2 + 0.16, 0));
  root.add(box(palette, 0xe9d3a6, W - 0.2, 0.04, D - 0.2, 0, 0.12, 0, 0));
  // Shelves of jars on the back wall.
  for (const y of [0.55, 0.95, 1.35]) {
    root.add(box(palette, WOOD, W - 0.7, 0.04, 0.2, 0, y, -D / 2 + 0.27, 0));
    FLAGS.forEach((c, n) => root.add(box(palette, c, 0.16, 0.2, 0.16, -0.85 + n * 0.34, y + 0.12, -D / 2 + 0.27, 0.006)));
  }

  // Counter with cakes.
  root.add(box(palette, WOOD, W - 1.0, 0.1, 0.5, 0, 0.64, front + 0.26, 0.012));
  root.add(box(palette, 0x7a5028, W - 1.1, 0.5, 0.06, 0, 0.38, front + 0.4, 0));
  const stand = (x: number, color: number, icing: number): void => {
    const plate = new Mesh(new CylinderGeometry(0.17, 0.12, 0.04, 14), palette.toon(0xfff6e4));
    plate.position.set(x, 0.72, front + 0.28);
    root.add(plate);
    const cake = new Mesh(new CylinderGeometry(0.13, 0.13, 0.12, 14), palette.toon(color));
    cake.position.set(x, 0.8, front + 0.28);
    cake.castShadow = true;
    addHullOutline(cake, 0.008);
    root.add(cake);
    const top = new Mesh(new CylinderGeometry(0.135, 0.135, 0.035, 14), palette.toon(icing));
    top.position.set(x, 0.875, front + 0.28);
    root.add(top);
    const cherry = new Mesh(new SphereGeometry(0.03, 8, 6), palette.toon(0xd6322b));
    cherry.position.set(x, 0.915, front + 0.28);
    root.add(cherry);
  };
  stand(-0.55, 0xe99a3a, 0x5a3320);
  stand(0.05, 0xf4d28a, 0xfff6e4);
  stand(0.62, 0xf08aa8, 0xfff1d6);

  // Roof: two slanted panels with the ridge along z, and a gable at the front and back.
  const rise = 0.75;
  const half = W / 2 + 0.25;
  const slope = Math.atan2(rise, half);
  const slopeLength = Math.hypot(half, rise) + 0.05;
  for (const side of [-1, 1]) {
    const panel = box(palette, TILE, slopeLength, 0.1, D + 0.55, side * (half / 2), 0.1 + WALL + rise / 2 + 0.04, 0, 0.016);
    panel.rotation.z = -side * slope;
    root.add(panel);
  }
  root.add(box(palette, 0xa8432c, 0.16, 0.1, D + 0.6, 0, 0.1 + WALL + rise + 0.07, 0, 0.012));
  const gable = new Shape();
  gable.moveTo(-W / 2, 0);
  gable.lineTo(W / 2, 0);
  gable.lineTo(0, rise - 0.02);
  gable.closePath();
  for (const z of [front, -D / 2 + 0.06]) {
    const geometry = new ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false });
    geometry.translate(0, 0, -0.06);
    const triangle = new Mesh(geometry, palette.toon(wall));
    triangle.position.set(0, 0.1 + WALL, z);
    triangle.castShadow = true;
    addHullOutline(triangle, 0.012);
    root.add(triangle);
  }

  // The sign stands above the roof ridge, facing the front.
  const texture = signTexture();
  const signY = 0.1 + WALL + rise + 0.62;
  const sign = new Mesh(
    new PlaneGeometry(1.3, 0.406),
    texture ? new MeshBasicMaterial({ map: texture }) : new MeshBasicMaterial({ color: 0xe8618c }),
  );
  sign.position.set(0, signY, front + 0.2);
  root.add(sign);
  root.add(box(palette, 0xfff6e4, 1.38, 0.48, 0.05, 0, signY, front + 0.16, 0.01));
  for (const x of [-0.5, 0.5]) root.add(box(palette, WOOD, 0.06, 0.42, 0.06, x, signY - 0.34, front + 0.14, 0.006));

  // A short striped valance along the top of the opening, so Dona Zefa stays in view.
  const stripes = 8;
  const stripeW = (W - 1.1) / stripes;
  for (let n = 0; n < stripes; n++) {
    const color = n % 2 ? 0xfff6e4 : PINK;
    const x = -((W - 1.1) / 2) + stripeW * (n + 0.5);
    root.add(box(palette, color, stripeW, 0.1, 0.08, x, 0.1 + WALL - 0.12, front + 0.08, 0.006));
    const scallop = new Mesh(new SphereGeometry(stripeW * 0.52, 8, 6), palette.toon(color));
    scallop.scale.set(1, 0.4, 0.35);
    scallop.position.set(x, 0.1 + WALL - 0.19, front + 0.1);
    root.add(scallop);
  }

  // Chimney.
  root.add(box(palette, BRICK, 0.34, 0.9, 0.34, -0.6, 0.1 + WALL + rise * 0.7, -0.55, 0.014));
  root.add(box(palette, 0x8a3a22, 0.42, 0.07, 0.42, -0.6, 0.1 + WALL + rise * 0.7 + 0.45, -0.55, 0.01));

  // The wood-fired oven on the right: a brick dome with a glowing mouth.
  const oven = new Group();
  oven.position.set(W / 2 + 0.75, 0.1, 0.1);
  oven.add(box(palette, 0xa8773e, 0.9, 0.35, 0.8, 0, 0.17, 0, 0.012));
  const dome = new Mesh(new SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), palette.toon(BRICK));
  dome.position.y = 0.35;
  dome.scale.set(1, 0.85, 0.95);
  dome.castShadow = true;
  addHullOutline(dome, 0.014);
  oven.add(dome);
  oven.add(box(palette, 0x2a1810, 0.34, 0.24, 0.06, 0, 0.5, 0.42, 0));
  const glow = new Mesh(new PlaneGeometry(0.28, 0.18), new MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.9 }));
  glow.position.set(0, 0.5, 0.455);
  oven.add(glow);
  oven.add(box(palette, 0xc98a3e, 0.22, 0.14, 0.2, 0.62, 0.17, 0.2, 0.008)); // a pile of firewood
  oven.add(box(palette, 0xa8773e, 0.22, 0.12, 0.2, 0.62, 0.3, 0.25, 0.008));
  root.add(oven);

  // Sacks of flour and a bundle of sugar cane by the door.
  for (const [x, z, color] of [[-W / 2 - 0.3, front + 0.2, 0xfff6e4], [-W / 2 - 0.62, front + 0.05, 0xe8c75d]] as const) {
    const sack = new Mesh(new SphereGeometry(0.2, 10, 8), palette.toon(color));
    sack.scale.set(1, 1.1, 0.8);
    sack.position.set(x, 0.3, z);
    sack.castShadow = true;
    addHullOutline(sack, 0.01);
    root.add(sack);
  }
  for (let n = 0; n < 4; n++) {
    const cane = new Mesh(new CylinderGeometry(0.03, 0.03, 1.1, 6), palette.toon(n % 2 ? 0x9a3f78 : 0x78b546));
    cane.position.set(-W / 2 - 0.2 + n * 0.05, 0.62, -0.5 + n * 0.06);
    cane.rotation.z = 0.12;
    root.add(cane);
  }

  // Flower boxes under the window and pots by the door.
  for (const [x, color] of [[-0.55, 0xf2c94a], [0, 0xe5372b], [0.55, 0xffffff]] as const) {
    const flowers = new Mesh(new SphereGeometry(0.1, 8, 6), palette.toon(color));
    flowers.position.set(x, 0.52, front + 0.12);
    flowers.scale.set(1, 0.8, 1);
    root.add(flowers);
  }

  if (level >= 2) {
    // A patio: a striped umbrella over a little table and two stools.
    const patio = new Group();
    patio.position.set(W / 2 + 0.25, 0.1, D / 2 + 0.75);
    patio.add(box(palette, 0xfff6e4, 0.6, 0.05, 0.6, 0, 0.5, 0, 0.01));
    patio.add(box(palette, WOOD, 0.06, 0.5, 0.06, 0, 0.25, 0, 0));
    patio.add(box(palette, WOOD, 0.3, 0.03, 0.3, 0, 0.02, 0, 0));
    const pole = box(palette, 0xe9d9b0, 0.04, 1.2, 0.04, 0, 0.6, 0, 0);
    patio.add(pole);
    const canopy = new Mesh(new CylinderGeometry(0.02, 0.62, 0.3, 8), palette.toon(PINK));
    canopy.position.y = 1.25;
    canopy.castShadow = true;
    addHullOutline(canopy, 0.012);
    patio.add(canopy);
    for (const x of [-0.5, 0.5]) {
      const stool = new Mesh(new CylinderGeometry(0.12, 0.1, 0.3, 10), palette.toon(0xf2c94a));
      stool.position.set(x, 0.2, 0.15);
      stool.castShadow = true;
      patio.add(stool);
    }
    patio.add(box(palette, 0xfff6e4, 0.1, 0.1, 0.1, 0.1, 0.58, 0.05, 0.006));
    root.add(patio);
    // Lanterns beside the door.
    for (const side of [-1, 1]) {
      const lantern = new Mesh(new SphereGeometry(0.1, 8, 6), new MeshBasicMaterial({ color: side < 0 ? 0xffd36a : 0xff9a8a }));
      lantern.position.set(side * (W / 2 - 0.05), 1.0, front + 0.14);
      root.add(lantern);
    }
  }

  if (level >= 3) {
    // An annex with its own door, and pennants from the festa junina strung across the front.
    const annex = new Group();
    annex.position.set(-W / 2 - 1.15, 0.1, 0.05);
    annex.add(box(palette, 0xffd9a0, 1.3, 1.0, 1.7, 0, 0.5, 0, 0.014));
    annex.add(box(palette, 0xd94a7a, 1.32, 0.28, 1.72, 0, 0.14, 0, 0));
    const roof = box(palette, TILE, 1.55, 0.1, 1.95, 0, 1.08, 0, 0.016);
    roof.rotation.z = 0.12;
    annex.add(roof);
    annex.add(box(palette, 0x6b4a36, 0.4, 0.62, 0.05, 0.12, 0.38, 0.87, 0));
    const round = new Mesh(new CylinderGeometry(0.17, 0.17, 0.05, 14), new MeshBasicMaterial({ color: 0x9fd8ff }));
    round.rotation.x = Math.PI / 2;
    round.position.set(-0.35, 0.65, 0.87);
    annex.add(round);
    annex.add(box(palette, BRICK, 0.28, 0.5, 0.28, -0.4, 1.4, -0.5, 0.012));
    root.add(annex);
    root.add(bunting(palette, [-W / 2 - 1.7, 2.0, front + 0.6], [W / 2 + 1.7, 2.0, front + 0.6], 12));
    root.add(bunting(palette, [-W / 2 - 1.7, 2.25, front + 0.6], [0, 2.7, front + 0.2], 7));
    for (const x of [-W / 2 - 1.7, W / 2 + 1.7]) root.add(box(palette, WOOD, 0.07, 2.4, 0.07, x, 1.2, front + 0.6, 0.008));
  } else if (level >= 2) {
    root.add(bunting(palette, [-W / 2 - 0.1, 2.0, front + 0.25], [W / 2 + 0.1, 2.0, front + 0.25], 8));
  }

  return { root, glow };
}

/** The Confeitaria and Dona Zefa. Hidden until the player builds it; read-only on the farm. */
export class BakeryView {
  readonly group = new Group();
  readonly root = new Group();
  private readonly palette: Palette;
  private readonly kit: CharacterKit;
  private readonly zefa: ReturnType<CharacterKit['confeiteira']>;
  private readonly baked = createBakedIndicator();
  private readonly puffs: Sprite[] = [];
  private built = 0;
  private body = new Group();
  private glow: Mesh | null = null;
  private time = 0;

  constructor(
    private readonly farm: Farm,
    gradientMap: DataTexture,
  ) {
    this.palette = new Palette(gradientMap);
    this.kit = new CharacterKit(gradientMap);
    this.root.position.set(BAKERY_SPOT.x, 0, BAKERY_SPOT.z);
    this.root.rotation.y = BAKERY_SPOT.rotation;
    this.root.userData['pickId'] = 'bakery';
    this.root.visible = false;
    this.group.add(this.root);
    this.root.add(this.body);

    this.zefa = this.kit.confeiteira();
    this.zefa.root.position.set(0, 0.12, 0.98);
    this.zefa.root.scale.setScalar(1.15);
    this.root.add(this.zefa.root);

    const map = puffTexture();
    for (let n = 0; n < 5; n++) {
      const puff = new Sprite(new SpriteMaterial({ ...(map ? { map } : {}), color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
      puff.renderOrder = 9;
      this.puffs.push(puff);
      this.root.add(puff);
    }
    this.baked.position.set(0, 3.7, 0.4);
    this.baked.visible = false;
    this.root.add(this.baked);
  }

  update(dt: number, now: number): void {
    const bakery = this.farm.bakery;
    this.root.visible = bakery !== null;
    if (!bakery) return;
    this.time += dt;

    if (bakery.level !== this.built) {
      this.built = bakery.level;
      this.root.remove(this.body);
      const built = buildBakery(this.palette, bakery.level);
      this.body = built.root;
      this.glow = built.glow;
      this.root.add(this.body);
    }

    const busy = bakery.jobs.some((j) => j.readyAt > now);
    const ready = this.farm.bakeryReady(now) > 0;
    this.zefa.update(dt, this.time, busy);

    if (this.glow) {
      const flicker = 0.75 + 0.25 * Math.sin(this.time * 9) * Math.sin(this.time * 5.3);
      (this.glow.material as MeshBasicMaterial).opacity = busy ? flicker : 0.35;
    }

    // Smoke curls out of the chimney while the ovens work.
    const top = 0.1 + WALL + 0.75 * 0.7 + 0.5;
    this.puffs.forEach((puff, n) => {
      const t = (this.time * 0.35 + n / this.puffs.length) % 1;
      puff.position.set(-0.6 + t * 0.5 + Math.sin(t * 6 + n) * 0.06, top + t * 1.4, -0.55);
      const size = 0.3 + t * 0.7;
      puff.scale.set(size, size, 1);
      (puff.material as SpriteMaterial).opacity = (busy ? 0.75 : 0.18) * Math.sin(Math.PI * t);
    });

    this.baked.visible = ready;
    if (ready) this.baked.position.y = 3.7 + Math.sin(this.time * 3) * 0.08;
  }
}
