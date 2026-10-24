import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { mulberry32 } from '../core/noise';

const ELEVATION = Math.atan(1 / Math.SQRT2);
const AZIMUTH = Math.PI / 4;
const FORWARD = new Vector3(-Math.sin(AZIMUTH), 0, -Math.cos(AZIMUTH));
const RIGHT = new Vector3(Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH));

const WRAP = 46; // clouds drift along the screen-horizontal axis between -WRAP and +WRAP
// Apparent screen-vertical offsets (ground units). Both sides of the island, so clouds show in the corners.
const SKY_LANES = [-15, 10, -11, 14, -8.5, 17];
// Clouds dissolve over the island: fully gone inside FADE_NEAR, fully visible beyond FADE_FAR.
const FADE_NEAR = 21; // island edge is at |u|+|s| = 17; leave room for the cloud's own radius
const FADE_FAR = 26;

interface Cloud {
  group: Group;
  materials: MeshBasicMaterial[];
  lane: number;
  height: number;
  u: number;
  speed: number;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Puffy clouds that drift across the sky beside the farm and dissolve before they can cover it.
 *
 * A cloud at height h is drawn where a ground point shifted by h / tan(elevation)
 * along the view direction would be. We pick the apparent position first, then back out
 * the world position, so the fade works in screen-space terms whatever the camera does.
 */
export class Clouds {
  readonly group = new Group();
  private readonly clouds: Cloud[] = [];

  constructor(count = 6, seed = 11) {
    const rand = mulberry32(seed);
    const puff = new SphereGeometry(1, 16, 12);

    for (let c = 0; c < count; c++) {
      // Three tints give a flat-bottomed cartoon cloud without any lighting.
      const materials = [0xcfe2f6, 0xeaf4ff, 0xffffff].map(
        (color) => new MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
      );
      const [base, mid, top] = materials as [MeshBasicMaterial, MeshBasicMaterial, MeshBasicMaterial];

      const cloud = new Group();
      const puffs = 5 + Math.floor(rand() * 3);
      const span = 1.1 + rand() * 0.5;
      for (let p = 0; p < puffs; p++) {
        const t = p / (puffs - 1) - 0.5; // -0.5..0.5 along the cloud
        const r = (0.55 + (1 - Math.abs(t) * 1.6) * 0.65) * (0.85 + rand() * 0.3);
        const x = t * 4.4 * span;
        const lower = new Mesh(puff, base);
        lower.scale.set(r * 1.05, r * 0.7, r * 0.95);
        lower.position.set(x, -r * 0.18, 0);
        const middle = new Mesh(puff, mid);
        middle.scale.set(r, r * 0.8, r * 0.92);
        middle.position.set(x, 0, 0.04);
        const upper = new Mesh(puff, top);
        upper.scale.set(r * 0.86, r * 0.62, r * 0.8);
        upper.position.set(x - 0.05, r * 0.28, 0.08);
        cloud.add(lower, middle, upper);
      }
      cloud.scale.setScalar(0.7 + rand() * 0.5);
      cloud.renderOrder = 5;

      const entry: Cloud = {
        group: cloud,
        materials,
        lane: (SKY_LANES[c % SKY_LANES.length] ?? 12) + (rand() - 0.5) * 2,
        height: 16 + rand() * 6,
        u: (rand() * 2 - 1) * WRAP,
        speed: 0.45 + rand() * 0.4,
      };
      this.clouds.push(entry);
      this.group.add(cloud);
      this.place(entry);
    }
  }

  update(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.u += cloud.speed * dt;
      if (cloud.u > WRAP) cloud.u = -WRAP;
      this.place(cloud);
    }
  }

  private place(cloud: Cloud): void {
    // Back out the world position that *appears* at (u, lane) on the ground plane.
    const shift = cloud.height / Math.tan(ELEVATION);
    cloud.group.position
      .copy(RIGHT)
      .multiplyScalar(cloud.u)
      .addScaledVector(FORWARD, cloud.lane - shift);
    cloud.group.position.y = cloud.height;

    // Diamond distance from the island's centre in apparent ground space.
    const opacity = 0.92 * smoothstep(FADE_NEAR, FADE_FAR, Math.abs(cloud.u) + Math.abs(cloud.lane));
    for (const m of cloud.materials) m.opacity = opacity;
    cloud.group.visible = opacity > 0.01;
  }
}
