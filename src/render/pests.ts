import {
  ConeGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
} from 'three';
import { mulberry32 } from '../core/noise';
import { addOutline } from './outline';

/** Models for the two infestations: tufts of weeds, and little beetles crawling around the crop. */
export class PestKit {
  private readonly materials = new Map<number, MeshToonMaterial>();
  private readonly blade = new ConeGeometry(0.05, 0.4, 5);
  private readonly bud = new SphereGeometry(0.07, 8, 6);
  private readonly body = new SphereGeometry(1, 14, 10);
  private readonly dot = new SphereGeometry(1, 6, 5);

  constructor(private readonly gradientMap: DataTexture) {}

  private toon(color: number): MeshToonMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap });
      this.materials.set(color, m);
    }
    return m;
  }

  /** Ragged clumps of dark grass with little purple thistle flowers, ringed around the plant. */
  weeds(seed: number): Group {
    const rand = mulberry32(seed * 7919 + 13);
    const group = new Group();
    group.userData['kind'] = 'weeds';
    const clumps = 8;
    for (let c = 0; c < clumps; c++) {
      const angle = (c / clumps) * Math.PI * 2 + rand() * 0.6;
      const radius = 0.2 + rand() * 0.22;
      const clump = new Group();
      clump.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      const blades = 4 + Math.floor(rand() * 3);
      for (let b = 0; b < blades; b++) {
        const tone = [0x2a7a2a, 0x4a9a2e, 0x1f6a24][b % 3]!;
        const blade = new Mesh(this.blade, this.toon(tone));
        const lean = 0.25 + rand() * 0.45;
        const around = (b / blades) * Math.PI * 2 + rand();
        const h = 0.7 + rand() * 0.8;
        blade.scale.set(1, h, 1);
        blade.position.set(Math.cos(around) * 0.05, 0.2 * h, Math.sin(around) * 0.045);
        blade.rotation.set(Math.sin(around) * lean, 0, -Math.cos(around) * lean);
        blade.castShadow = true;
        clump.add(blade);
      }
      if (c % 2 === 0) {
        const flower = new Mesh(this.bud, this.toon(c % 4 === 0 ? 0xb25fd9 : 0xf2e6ff));
        flower.position.set(0, 0.42 + rand() * 0.08, 0);
        addOutline(flower, 0.01);
        clump.add(flower);
      }
      group.add(clump);
    }
    return group;
  }

  /** Three ladybug-like beetles; `animateBugs` makes them scuttle around the plant. */
  bugs(seed: number): Group {
    const rand = mulberry32(seed * 104729 + 7);
    const group = new Group();
    group.userData['kind'] = 'bugs';
    for (let n = 0; n < 3; n++) {
      const bug = new Group();
      const shell = new Mesh(this.body, this.toon(0xd93a2b));
      shell.scale.set(0.085, 0.06, 0.115);
      shell.position.y = 0.06;
      shell.castShadow = true;
      addOutline(shell, 0.011);
      bug.add(shell);

      const head = new Mesh(this.body, this.toon(0x241612));
      head.scale.set(0.05, 0.04, 0.045);
      head.position.set(0, 0.058, 0.115);
      bug.add(head);

      for (const [x, z] of [
        [-0.035, -0.02],
        [0.035, -0.02],
        [-0.03, 0.04],
        [0.03, 0.04],
      ] as const) {
        const spot = new Mesh(this.dot, this.toon(0x241612));
        spot.scale.setScalar(0.017);
        spot.position.set(x, 0.113, z);
        bug.add(spot);
      }
      bug.userData['orbit'] = {
        radius: 0.24 + rand() * 0.18,
        speed: (0.7 + rand() * 0.7) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * Math.PI * 2,
        wobble: rand() * 6,
      };
      group.add(bug);
    }
    return group;
  }
}

/** Moves each beetle along its little circuit, facing the way it walks. */
export function animateBugs(group: Group, time: number): void {
  for (const bug of group.children) {
    const o = bug.userData['orbit'] as { radius: number; speed: number; phase: number; wobble: number };
    const a = o.phase + time * o.speed;
    const r = o.radius + Math.sin(time * 1.7 + o.wobble) * 0.05;
    bug.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    // Tangent of the circuit; the model's "forward" is +z.
    const dir = Math.sign(o.speed);
    bug.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
    bug.position.y = Math.abs(Math.sin(time * 14 + o.wobble)) * 0.012;
  }
}
