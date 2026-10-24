import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { WalkerPose } from '../core/helpers';
import { addOutline } from './outline';

/** What a character needs each frame besides its pose. */
export interface CharacterFrame {
  pose: WalkerPose;
  /** Seconds since the last frame. */
  dt: number;
  /** Total animation time in seconds. */
  time: number;
  /** Colour of the crop being picked, if any (the farmhand holds it while working). */
  carry: number | null;
  /** 0 = day, 1 = night. */
  night: number;
}

export interface Character {
  root: Group;
  height: number;
  update(frame: CharacterFrame): void;
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
/** 0 before `a`, 1 after `b`, smooth in between. */
const between = (t: number, a: number, b: number): number => ease(clamp01((t - a) / (b - a)));

/** Procedural characters in the same toon style as the rest of the farm. Everything faces +z. */
export class CharacterKit {
  private readonly materials = new Map<number, MeshToonMaterial>();
  private readonly sphere = new SphereGeometry(1, 18, 14);
  private readonly cone = new ConeGeometry(1, 1, 10);
  private readonly cyl = new CylinderGeometry(1, 1, 1, 12);
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly ring = new TorusGeometry(1, 0.2, 8, 18);

  constructor(private readonly gradientMap: DataTexture) {}

  private toon(color: number): MeshToonMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap });
      this.materials.set(color, m);
    }
    return m;
  }

  private blob(color: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, outline = 0.01): Mesh {
    const m = new Mesh(this.sphere, this.toon(color));
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (outline > 0) addOutline(m, outline);
    return m;
  }

  private tube(color: number, r: number, h: number, x = 0, y = 0, z = 0, outline = 0): Mesh {
    const m = new Mesh(this.cyl, this.toon(color));
    m.scale.set(r, h, r);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (outline > 0) addOutline(m, outline);
    return m;
  }

  private slab(color: number, w: number, h: number, d: number, x = 0, y = 0, z = 0): Mesh {
    const m = new Mesh(this.box, this.toon(color));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  private spike(color: number, r: number, h: number, x = 0, y = 0, z = 0): Mesh {
    const m = new Mesh(this.cone, this.toon(color));
    m.scale.set(r, h, r);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  // -------------------------------------------------------------------------
  // Tonico, the farmhand
  // -------------------------------------------------------------------------

  /** Tonico by default; with `keeper` the animal keeper: kerchief, teal blouse, apron and a feed sack. */
  farmhand(keeper = false): Character {
    const SKIN = keeper ? 0xe6ac82 : 0xf0bd93;
    const SHIRT = keeper ? 0x3f9a8a : 0xc8412f;
    const DENIM = keeper ? 0xe9dcc0 : 0x3f6fb0;
    const BOOT = 0x6b4423;
    const STRAW = 0xe8c75d;

    const root = new Group();
    const hips = new Group();
    hips.position.y = 0.4;
    root.add(hips);

    // Legs pivot at the hip; boots sit at the end.
    const legs: Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.075, 0, 0);
      leg.add(this.tube(DENIM, 0.058, 0.3, 0, -0.15, 0, 0.008));
      leg.add(this.blob(BOOT, 0.075, 0.055, 0.105, 0, -0.33, 0.03));
      hips.add(leg);
      legs.push(leg);
    }

    // Everything above the hips bends together.
    const upper = new Group();
    hips.add(upper);
    upper.add(this.blob(SHIRT, 0.175, 0.2, 0.15, 0, 0.17, 0, 0.012));
    upper.add(this.blob(DENIM, 0.18, 0.13, 0.155, 0, 0.07, 0.005, 0.012));
    upper.add(this.slab(DENIM, 0.15, 0.15, 0.03, 0, 0.2, 0.14));
    for (const side of [-1, 1]) {
      upper.add(this.slab(DENIM, 0.035, 0.2, 0.03, side * 0.075, 0.3, 0.1));
      upper.add(this.blob(0xf2c94a, 0.014, 0.014, 0.01, side * 0.075, 0.22, 0.157, 0));
    }
    upper.add(this.slab(0xa8452f, 0.05, 0.05, 0.015, -0.04, 0.12, 0.16)); // a patch on the overalls

    // Arms swing from the shoulders.
    const arms: Group[] = [];
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.2, 0.3, 0);
      arm.add(this.tube(SHIRT, 0.048, 0.2, 0, -0.1, 0, 0.008));
      arm.add(this.blob(SKIN, 0.052, 0.052, 0.052, 0, -0.215, 0.005));
      upper.add(arm);
      arms.push(arm);
    }
    const carried = this.blob(0xff8a1f, 0.06, 0.07, 0.06, 0, -0.27, 0.03);
    carried.visible = false;
    arms[1]!.add(carried);

    // Wicker basket on the back, with a bit of everything poking out.
    const basket = new Group();
    basket.position.set(0, 0.2, -0.19);
    const weave = new Mesh(new CylinderGeometry(0.13, 0.1, 0.2, 14), this.toon(0xc98a3e));
    weave.position.y = 0.02;
    weave.castShadow = true;
    addOutline(weave, 0.008);
    basket.add(weave);
    const rim = new Mesh(this.ring, this.toon(0xa8702a));
    rim.rotation.x = Math.PI / 2;
    rim.scale.setScalar(0.13);
    rim.position.y = 0.12;
    basket.add(rim);
    basket.add(this.spike(0xff8a1f, 0.03, 0.14, -0.05, 0.19, 0.0));
    basket.add(this.blob(0xe5372b, 0.05, 0.05, 0.05, 0.05, 0.15, 0.02));
    basket.add(this.blob(0xf0c542, 0.03, 0.09, 0.03, 0, 0.19, -0.04));
    basket.add(this.spike(0x5cbc3f, 0.03, 0.1, 0.03, 0.2, 0.03));
    if (keeper) {
      basket.clear();
      basket.add(this.blob(0xe8c75d, 0.15, 0.2, 0.1, 0, 0.02, 0, 0.01));
      basket.add(this.blob(0xc23b2c, 0.1, 0.03, 0.08, 0, 0.2, 0));
      basket.add(this.blob(0xfff6e4, 0.07, 0.07, 0.02, 0, 0.04, -0.1, 0));
    }
    upper.add(basket);
    for (const side of [-1, 1]) {
      const strap = this.slab(0x6b4423, 0.03, 0.34, 0.025, side * 0.085, 0.25, -0.1);
      strap.rotation.x = -0.35;
      upper.add(strap);
    }

    // Head: round face, bushy moustache, straw hat.
    const head = new Group();
    head.position.set(0, 0.5, 0.01);
    upper.add(head);
    head.add(this.blob(SKIN, 0.2, 0.19, 0.19, 0, 0, 0, 0.012));
    for (const side of [-1, 1]) {
      head.add(this.blob(SKIN, 0.04, 0.05, 0.03, side * 0.19, -0.01, 0, 0.006));
      head.add(this.blob(0x1c1410, 0.026, 0.034, 0.02, side * 0.075, 0.025, 0.175, 0));
      head.add(this.blob(0xffffff, 0.009, 0.011, 0.008, side * 0.068, 0.037, 0.19, 0));
      head.add(this.blob(0xf0968a, 0.04, 0.026, 0.02, side * 0.125, -0.035, 0.15, 0));
      const brow = this.slab(0xd9d4cb, 0.065, 0.014, 0.02, side * 0.075, 0.075, 0.17);
      brow.rotation.z = side * -0.15;
      head.add(brow);
      if (!keeper) {
        const whisker = this.blob(0xe8e4dc, 0.065, 0.034, 0.045, side * 0.045, -0.07, 0.17, 0.006);
        whisker.rotation.z = side * -0.3;
        head.add(whisker);
      }
    }
    head.add(this.blob(0xe39a74, 0.04, 0.036, 0.04, 0, -0.01, 0.19, 0.006));
    const hat = new Group();
    hat.position.y = 0.11;
    if (keeper) {
      hat.add(this.blob(0xc23b2c, 0.2, 0.12, 0.2, 0, 0.03, -0.01, 0.01));
      hat.add(this.blob(0xfff6e4, 0.04, 0.04, 0.03, 0.08, 0.1, 0.12, 0));
      hat.add(this.blob(0x5a3a22, 0.19, 0.09, 0.1, 0, -0.02, -0.12, 0.01)); // a bun
    } else {
      hat.add(this.tube(0xd9b24a, 0.34, 0.025, 0, 0, 0, 0.01));
      hat.add(this.blob(STRAW, 0.16, 0.13, 0.16, 0, 0.05, 0, 0.012));
      hat.add(this.tube(0xc23b2c, 0.165, 0.035, 0, 0.045, 0));
    }
    head.add(hat);

    let phase = 0;
    const model: Character = {
      root,
      height: 1.1,
      update: ({ pose, dt, time, carry }) => {
        let bend = 0;
        let crouch = 0;
        let legSwing = 0;
        let armLeft = 0;
        let armRight = 0;
        let armSpread = 0.12;
        let lookYaw = 0;
        let lookPitch = 0;
        let sway = 0;
        let hold = false;

        if (pose.mode === 'walking') {
          phase += dt * 9;
          legSwing = Math.sin(phase) * 0.75;
          armLeft = -legSwing * 0.8;
          armRight = legSwing * 0.8;
          bend = 0.1;
          crouch = Math.abs(Math.sin(phase)) * 0.035;
          sway = Math.sin(phase) * 0.05;
        } else if (pose.mode === 'working') {
          const p = pose.workProgress;
          bend = 0.15 + 0.85 * between(p, 0, 0.3) * (1 - between(p, 0.5, 0.75));
          crouch = 0.1 * between(p, 0, 0.3) * (1 - between(p, 0.6, 0.8));
          const reach = between(p, 0.05, 0.3) * (1 - between(p, 0.35, 0.5));
          armLeft = -1.5 * reach - 0.2;
          armRight = -1.6 * reach;
          // Pull the crop out (hold it up), then swing the arm back and drop it in the basket.
          const pulled = between(p, 0.35, 0.5);
          const toss = between(p, 0.6, 0.85);
          armRight = -1.6 * reach + pulled * -0.9 + toss * -1.6;
          armSpread = 0.12 + toss * 0.3;
          hold = p > 0.35 && p < 0.8 && carry !== null;
          lookPitch = 0.5 * between(p, 0, 0.3) * (1 - between(p, 0.5, 0.7));
          sway = Math.sin(p * 40) * 0.02 * (1 - between(p, 0.3, 0.4));
        } else {
          // Resting: breathe, glance around, and now and then wipe the brow.
          phase += dt * 2;
          const breathe = Math.sin(time * 2.2);
          crouch = -breathe * 0.004;
          lookYaw = Math.sin(time * 0.7) * 0.5;
          const wipe = clamp01((Math.sin(time * 0.45) - 0.85) / 0.15);
          armRight = -2.6 * ease(wipe) + Math.sin(time * 14) * 0.15 * wipe;
          armLeft = breathe * 0.02;
        }

        hips.position.y = 0.4 - crouch;
        legs[0]!.rotation.x = legSwing - (bend > 0.3 ? bend * 0.5 : 0);
        legs[1]!.rotation.x = -legSwing - (bend > 0.3 ? bend * 0.5 : 0);
        upper.rotation.x = bend;
        upper.rotation.z = sway;
        arms[0]!.rotation.set(armLeft, 0, armSpread);
        arms[1]!.rotation.set(armRight, 0, -armSpread);
        head.rotation.set(lookPitch, lookYaw, 0);
        hat.rotation.z = Math.sin(phase * 1.2) * (pose.mode === 'walking' ? 0.04 : 0.01);

        carried.visible = hold;
        if (hold && carry !== null) (carried.material as MeshToonMaterial).color.setHex(carry);
      },
    };
    return model;
  }

  // -------------------------------------------------------------------------
  // Mingau, the cat
  // -------------------------------------------------------------------------

  cat(): Character {
    const FUR = 0xe8903a;
    const STRIPE = 0xb8631f;
    const WHITE = 0xfff4e6;

    const root = new Group();
    const body = new Group();
    body.position.y = 0.17;
    root.add(body);

    body.add(this.blob(FUR, 0.1, 0.095, 0.175, 0, 0, 0, 0.01));
    body.add(this.blob(WHITE, 0.075, 0.05, 0.13, 0, -0.05, 0.02, 0));
    for (const z of [-0.08, 0, 0.08]) body.add(this.blob(STRIPE, 0.105, 0.016, 0.022, 0, 0.075, z, 0));

    const head = new Group();
    head.position.set(0, 0.07, 0.17);
    body.add(head);
    head.add(this.blob(FUR, 0.095, 0.088, 0.088, 0, 0, 0, 0.01));
    head.add(this.blob(WHITE, 0.05, 0.036, 0.04, 0, -0.03, 0.07, 0));
    head.add(this.blob(0xf08a9a, 0.016, 0.012, 0.012, 0, -0.01, 0.1, 0));
    const eyes: Mesh[] = [];
    for (const side of [-1, 1]) {
      const ear = this.spike(FUR, 0.034, 0.09, side * 0.058, 0.09, -0.005);
      ear.rotation.z = side * -0.25;
      addOutline(ear, 0.006);
      head.add(ear);
      const inner = this.spike(0xf4a3ab, 0.02, 0.055, side * 0.058, 0.085, 0.012);
      inner.rotation.z = side * -0.25;
      head.add(inner);
      const eye = this.blob(0x78d96b, 0.02, 0.026, 0.012, side * 0.04, 0.018, 0.08, 0);
      head.add(eye);
      eyes.push(eye);
      head.add(this.blob(0x1c1410, 0.008, 0.02, 0.01, side * 0.04, 0.018, 0.088, 0));
      for (const [dy, tilt] of [[-0.012, 0.18], [-0.024, 0], [-0.036, -0.18]] as const) {
        const w = this.tube(0xffffff, 0.003, 0.09, side * 0.085, dy, 0.07);
        w.rotation.z = Math.PI / 2 + side * tilt;
        head.add(w);
      }
    }
    // Forehead stripes.
    for (const x of [-0.02, 0, 0.02]) head.add(this.blob(STRIPE, 0.007, 0.022, 0.006, x, 0.07, 0.065, 0));

    const legs: Group[] = [];
    for (const [x, z] of [[-0.055, 0.1], [0.055, 0.1], [-0.055, -0.1], [0.055, -0.1]] as const) {
      const leg = new Group();
      leg.position.set(x, -0.05, z);
      leg.add(this.tube(FUR, 0.026, 0.13, 0, -0.06, 0, 0.005));
      leg.add(this.blob(WHITE, 0.034, 0.025, 0.045, 0, -0.125, 0.01, 0.005));
      body.add(leg);
      legs.push(leg);
    }

    // A tail made of a few segments so it can curl and sway.
    const tail: Group[] = [];
    let parent: Group = body;
    for (let n = 0; n < 4; n++) {
      const seg = new Group();
      seg.position.set(0, n === 0 ? 0.02 : 0.085, n === 0 ? -0.17 : 0);
      seg.add(this.tube(n === 3 ? WHITE : n % 2 ? STRIPE : FUR, 0.024, 0.1, 0, 0.04, 0, 0.005));
      if (n === 0) seg.rotation.x = -2.0;
      parent.add(seg);
      tail.push(seg);
      parent = seg;
    }

    let phase = 0;
    return {
      root,
      height: 0.4,
      update: ({ pose, dt, time }) => {
        let y = 0.17;
        let pitch = 0;
        let roll = 0;
        let stride = 0;
        let front = 0;
        let rear = 0;
        let stretch = 1;
        let curl = 0;
        let eyeOpen = 1;
        let headPitch = 0;
        let headYaw = 0;

        if (pose.mode === 'walking') {
          phase += dt * 13;
          stride = Math.sin(phase) * 0.9;
          y += Math.abs(Math.sin(phase)) * 0.012;
          roll = Math.sin(phase) * 0.03;
          curl = 0.5;
          headPitch = Math.sin(phase * 2) * 0.05;
        } else if (pose.mode === 'working') {
          const p = pose.workProgress;
          if (p < 0.55) {
            // Stalk: lower the chest, wiggle the rear.
            const down = between(p, 0, 0.2);
            y -= 0.07 * down;
            pitch = 0.35 * down;
            front = -0.9 * down;
            rear = 0.5 * down;
            roll = Math.sin(p * 90) * 0.1 * down;
            headPitch = 0.2 * down;
            curl = 0.3 + Math.sin(p * 50) * 0.3;
          } else {
            // Pounce: spring up and forward, land with paws out.
            const q = (p - 0.55) / 0.45;
            y += Math.sin(q * Math.PI) * 0.2 - 0.05 * (1 - q);
            pitch = -0.5 * Math.sin(q * Math.PI);
            front = -1.2 * Math.sin(q * Math.PI);
            rear = 0.8 * (1 - q);
            stretch = 1 + 0.18 * Math.sin(q * Math.PI);
            headPitch = 0.3 * q;
            curl = 0.1;
          }
        } else {
          // Sit and blink; the tail flicks lazily.
          y -= 0.045;
          pitch = -0.45;
          front = 0.3;
          rear = -1.1;
          curl = 0.8 + Math.sin(time * 1.3) * 0.25;
          headPitch = 0.45;
          headYaw = Math.sin(time * 0.6) * 0.35;
          eyeOpen = Math.sin(time * 1.1 + 1) > 0.94 ? 0.1 : 1;
        }

        body.position.y = y;
        body.rotation.set(pitch, 0, roll);
        body.scale.set(1, 1, stretch);
        head.rotation.set(headPitch - pitch * 0.6, headYaw, 0);
        legs[0]!.rotation.x = front + stride;
        legs[1]!.rotation.x = front - stride;
        legs[2]!.rotation.x = rear - stride;
        legs[3]!.rotation.x = rear + stride;
        tail.forEach((seg, n) => {
          const wave = Math.sin(time * (pose.mode === 'walking' ? 6 : 2.5) - n * 0.9) * 0.22 * (n + 1) * 0.5;
          if (n === 0) seg.rotation.set(-2.0 + (1 - curl) * 0.9, 0, wave * 0.5);
          else seg.rotation.set(-curl * 0.18, 0, wave);
        });
        for (const eye of eyes) eye.scale.y = 0.026 * eyeOpen;
      },
    };
  }

  // -------------------------------------------------------------------------
  // Rex, the dog
  // -------------------------------------------------------------------------

  dog(): Character {
    const FUR = 0xd9a35f;
    const DARK = 0x8a5a2a;
    const CREAM = 0xfff0d6;

    const root = new Group();
    const body = new Group();
    body.position.y = 0.23;
    root.add(body);

    body.add(this.blob(FUR, 0.11, 0.105, 0.22, 0, 0, 0, 0.01));
    body.add(this.blob(CREAM, 0.085, 0.055, 0.15, 0, -0.06, 0.03, 0));
    body.add(this.blob(DARK, 0.112, 0.05, 0.1, 0, 0.055, -0.05, 0));

    const head = new Group();
    head.position.set(0, 0.1, 0.2);
    body.add(head);
    head.add(this.blob(FUR, 0.1, 0.092, 0.095, 0, 0, 0, 0.01));
    head.add(this.blob(CREAM, 0.06, 0.05, 0.065, 0, -0.035, 0.075, 0));
    head.add(this.blob(0x2b1b12, 0.028, 0.02, 0.02, 0, -0.01, 0.135, 0));
    const ears: Group[] = [];
    for (const side of [-1, 1]) {
      const ear = new Group();
      ear.position.set(side * 0.085, 0.05, -0.005);
      ear.add(this.blob(DARK, 0.03, 0.085, 0.05, side * 0.012, -0.045, 0, 0.006));
      head.add(ear);
      ears.push(ear);
      head.add(this.blob(0xffffff, 0.02, 0.02, 0.012, side * 0.045, 0.025, 0.085, 0));
      head.add(this.blob(0x1c1410, 0.011, 0.014, 0.012, side * 0.045, 0.025, 0.093, 0));
    }
    const tongue = this.blob(0xf08a9a, 0.022, 0.012, 0.04, 0, -0.065, 0.11, 0);
    head.add(tongue);

    const legs: Group[] = [];
    for (const [x, z] of [[-0.06, 0.13], [0.06, 0.13], [-0.06, -0.13], [0.06, -0.13]] as const) {
      const leg = new Group();
      leg.position.set(x, -0.06, z);
      leg.add(this.tube(FUR, 0.032, 0.17, 0, -0.08, 0, 0.005));
      leg.add(this.blob(CREAM, 0.04, 0.03, 0.055, 0, -0.165, 0.012, 0.005));
      body.add(leg);
      legs.push(leg);
    }

    const tail = new Group();
    tail.position.set(0, 0.04, -0.21);
    tail.add(this.tube(FUR, 0.03, 0.2, 0, 0.09, 0, 0.006));
    tail.add(this.blob(CREAM, 0.034, 0.04, 0.034, 0, 0.2, 0, 0.004));
    body.add(tail);

    let phase = 0;
    return {
      root,
      height: 0.55,
      update: ({ pose, dt, time }) => {
        let y = 0.23;
        let pitch = 0;
        let stride = 0;
        let front = 0;
        let rear = 0;
        let headPitch = 0;
        let wag = 0.25;
        let wagSpeed = 5;
        let tonguePut = 0;

        if (pose.mode === 'walking') {
          phase += dt * 12;
          stride = Math.sin(phase) * 0.8;
          y += Math.abs(Math.sin(phase)) * 0.018;
          pitch = Math.sin(phase * 2) * 0.03;
          wag = 0.45;
          wagSpeed = 12;
          tonguePut = 1;
        } else if (pose.mode === 'working') {
          // Nose down, sniffing and nudging the basket; the tail goes wild.
          const p = pose.workProgress;
          const down = between(p, 0, 0.25);
          y -= 0.045 * down;
          pitch = 0.3 * down;
          front = -0.7 * down;
          headPitch = 0.35 * down + Math.sin(p * 60) * 0.1 * down;
          wag = 0.7;
          wagSpeed = 18;
          tonguePut = 1;
        } else {
          // Sits with a lazy wag and the occasional pant.
          y -= 0.075;
          pitch = -0.5;
          front = 0.2;
          rear = -1.25;
          headPitch = 0.5 + Math.sin(time * 0.7) * 0.06;
          wag = 0.3;
          wagSpeed = 4;
          tonguePut = Math.sin(time * 0.9) > 0.5 ? 1 : 0;
        }

        body.position.y = y;
        body.rotation.set(pitch, 0, 0);
        head.rotation.set(headPitch - pitch * 0.6, 0, 0);
        legs[0]!.rotation.x = front + stride;
        legs[1]!.rotation.x = front - stride;
        legs[2]!.rotation.x = rear - stride;
        legs[3]!.rotation.x = rear + stride;
        tail.rotation.set(-0.6 + pitch * 0.5, Math.sin(time * wagSpeed) * wag, 0);
        tongue.visible = tonguePut > 0;
        for (const [n, ear] of ears.entries()) ear.rotation.z = (n === 0 ? 1 : -1) * (0.1 + Math.abs(stride) * 0.25);
      },
    };
  }

  // -------------------------------------------------------------------------
  // Sprinkler head
  // -------------------------------------------------------------------------

  sprinkler(): { root: Group; rotor: Group; nozzle: Group } {
    const root = new Group();
    root.add(this.tube(0xd9a441, 0.085, 0.07, 0, 0.035, 0, 0.008));
    root.add(this.tube(0x3a8fd0, 0.09, 0.025, 0, 0.075, 0));
    root.add(this.tube(0x9aa7b5, 0.028, 0.26, 0, 0.2, 0, 0.006));
    const rotor = new Group();
    rotor.position.y = 0.34;
    rotor.add(this.tube(0xd9a441, 0.055, 0.06, 0, 0, 0, 0.006));
    const arm = this.slab(0xd9a441, 0.26, 0.025, 0.03, 0, 0.035, 0);
    rotor.add(arm);
    const nozzle = new Group();
    nozzle.position.set(0.13, 0.035, 0);
    rotor.add(nozzle);
    root.add(rotor);
    return { root, rotor, nozzle };
  }
}

