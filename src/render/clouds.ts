import { DataTexture, Group, Mesh, MeshToonMaterial, SphereGeometry } from 'three';
import { mulberry32 } from '../core/noise';

const WRAP = 48;

/** Puffy procedural clouds that drift slowly across the sky. */
export class Clouds {
  readonly group = new Group();
  private readonly clouds: Group[] = [];

  constructor(gradientMap: DataTexture, count = 5, seed = 7) {
    const rand = mulberry32(seed);
    const material = new MeshToonMaterial({
      color: 0xffffff,
      gradientMap,
      transparent: true,
      opacity: 0.92,
    });
    const puff = new SphereGeometry(1, 14, 10);

    for (let c = 0; c < count; c++) {
      const cloud = new Group();
      const puffs = 4 + Math.floor(rand() * 3);
      for (let p = 0; p < puffs; p++) {
        const m = new Mesh(puff, material);
        const r = 0.9 + rand() * 0.9;
        m.scale.set(r * 1.2, r * 0.8, r);
        m.position.set((p - puffs / 2) * 1.3 + rand() * 0.4, rand() * 0.5, (rand() - 0.5) * 1.1);
        cloud.add(m);
      }
      cloud.position.set((rand() * 2 - 1) * WRAP, 13 + rand() * 4, (rand() * 2 - 1) * WRAP);
      cloud.userData['speed'] = 0.25 + rand() * 0.35;
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }

  update(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.position.x += (cloud.userData['speed'] as number) * dt;
      if (cloud.position.x > WRAP) cloud.position.x = -WRAP;
    }
  }
}
