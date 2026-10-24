import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
} from 'three';
import { CropDef } from '../core/crops';
import { CropStage } from '../core/farm';

/** Shared geometries and cached toon materials for every procedural crop. */
export class CropKit {
  readonly sphere = new SphereGeometry(1, 12, 8);
  readonly cone = new ConeGeometry(1, 1, 8);
  readonly stalk = new CylinderGeometry(0.7, 1, 1, 6);
  private readonly materials = new Map<number, MeshToonMaterial>();

  constructor(private readonly gradientMap: DataTexture) {}

  material(color: number): MeshToonMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new MeshToonMaterial({ color, gradientMap: this.gradientMap });
      this.materials.set(color, m);
    }
    return m;
  }
}

const SOIL_MOUND = 0x5a3a20;
const DRY_LEAF = 0x9b7b3a;
const THIRSTY_TINT = 0xd8d05a;

function blob(kit: CropKit, color: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(kit.sphere, kit.material(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A leaf is a flattened ellipsoid whose base sits at the plant's center. */
function leaf(kit: CropKit, color: number, length: number, width: number, tilt: number, yaw: number, y = 0): Group {
  const g = new Group();
  g.rotation.y = yaw;
  g.position.y = y;
  const m = blob(kit, color, width, 0.025, length);
  m.position.set(0, Math.sin(tilt) * length, Math.cos(tilt) * length);
  m.rotation.x = -tilt;
  g.add(m);
  return g;
}

function stalk(kit: CropKit, color: number, height: number, radius: number, x = 0, z = 0): Mesh {
  const m = new Mesh(kit.stalk, kit.material(color));
  m.scale.set(radius, height, radius);
  m.position.set(x, height / 2, z);
  m.castShadow = true;
  return m;
}

function leafRing(kit: CropKit, color: number, count: number, length: number, width: number, tilt: number, y = 0): Group {
  const ring = new Group();
  for (let n = 0; n < count; n++) {
    ring.add(leaf(kit, color, length, width, tilt, (n / count) * Math.PI * 2 + n * 0.3, y));
  }
  return ring;
}

export interface CropAppearance {
  stage: CropStage;
  thirsty: boolean;
  withered: boolean;
}

/** Builds the crop model for one growth stage. Origin is the tile center on the soil. */
export function buildCropModel(kit: CropKit, def: CropDef, look: CropAppearance): Group {
  const g = new Group();
  const { stage, withered } = look;
  const droop = withered ? 0.4 : 1;

  let leafColor = withered ? DRY_LEAF : def.colors.leaf;
  if (look.thirsty && !withered) {
    leafColor = new Color(def.colors.leaf).lerp(new Color(THIRSTY_TINT), 0.5).getHex();
  }

  if (stage === 0) {
    g.add(blob(kit, SOIL_MOUND, 0.14, 0.07, 0.14, 0, 0.02, 0));
    return g;
  }

  if (stage === 1) {
    g.add(blob(kit, SOIL_MOUND, 0.12, 0.05, 0.12, 0, 0.015, 0));
    g.add(stalk(kit, leafColor, 0.07, 0.012));
    g.add(leafRing(kit, leafColor, 2, 0.1, 0.045, 0.6 * droop, 0.06));
    return g;
  }

  switch (def.shape) {
    case 'root':
      g.add(leafRing(kit, leafColor, 7, 0.22, 0.05, 0.85 * droop, 0.05));
      if (stage === 3) {
        for (const [x, z, s] of [[0, 0, 1], [0.1, 0.04, 0.8], [-0.09, -0.05, 0.85]] as const) {
          const carrot = new Mesh(kit.cone, kit.material(def.colors.fruit));
          carrot.scale.set(0.075 * s, 0.2 * s, 0.075 * s);
          carrot.rotation.x = Math.PI;
          carrot.position.set(x, 0.06, z);
          carrot.castShadow = true;
          g.add(carrot);
        }
      }
      break;

    case 'grain': {
      const color = stage === 3 && !withered ? def.colors.fruit : leafColor;
      for (let n = 0; n < 9; n++) {
        const a = n * 2.4;
        const r = 0.05 + (n % 3) * 0.06;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const h = (stage === 2 ? 0.34 : 0.48) * droop;
        g.add(stalk(kit, color, h, 0.012, x, z));
        if (stage === 3 && !withered) g.add(blob(kit, color, 0.02, 0.07, 0.02, x, h + 0.04, z));
      }
      g.add(leafRing(kit, leafColor, 4, 0.18, 0.025, 0.7 * droop, 0.05));
      break;
    }

    case 'tall': {
      const h = (stage === 2 ? 0.5 : 0.72) * droop;
      g.add(stalk(kit, leafColor, h, 0.035));
      for (let n = 0; n < 5; n++) {
        g.add(leaf(kit, leafColor, 0.26, 0.04, 0.55 * droop + 0.1, n * 2.1, 0.12 + (n / 5) * h * 0.8));
      }
      if (stage === 3 && !withered) {
        for (const side of [-1, 1]) {
          const cob = blob(kit, def.colors.fruit, 0.05, 0.05, 0.12, side * 0.07, h * 0.6, 0.02);
          cob.rotation.x = -0.35;
          g.add(cob);
        }
        g.add(blob(kit, 0xe8d28a, 0.04, 0.08, 0.04, 0, h + 0.03, 0));
      }
      break;
    }

    case 'bush':
      g.add(stalk(kit, leafColor, 0.2 * droop, 0.025));
      g.add(leafRing(kit, leafColor, 7, 0.2, 0.06, 0.65 * droop, 0.1));
      g.add(leafRing(kit, leafColor, 5, 0.14, 0.05, 1.0 * droop, 0.2));
      if (stage === 3 && !withered) {
        for (let n = 0; n < 5; n++) {
          const a = n * 1.3 + 0.4;
          g.add(blob(kit, def.colors.fruit, 0.06, 0.06, 0.06, Math.cos(a) * 0.13, 0.12 + (n % 2) * 0.06, Math.sin(a) * 0.13));
        }
      }
      break;

    case 'berry':
      g.add(leafRing(kit, leafColor, 8, 0.18, 0.06, 0.45 * droop, 0.05));
      if (stage === 3 && !withered) {
        for (let n = 0; n < 7; n++) {
          const a = n * 0.9;
          const berry = new Mesh(kit.cone, kit.material(def.colors.fruit));
          berry.scale.set(0.05, 0.09, 0.05);
          berry.rotation.x = Math.PI;
          berry.position.set(Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14);
          berry.castShadow = true;
          g.add(berry);
        }
      }
      break;

    case 'gourd':
      g.add(leafRing(kit, leafColor, 6, 0.3, 0.1, 0.4 * droop, 0.05));
      if (stage === 3 && !withered) {
        g.add(blob(kit, def.colors.fruit, 0.22, 0.17, 0.22, 0, 0.17, 0));
        g.add(blob(kit, 0xffa63d, 0.12, 0.17, 0.2, 0.0, 0.17, 0.02));
        g.add(stalk(kit, 0x5c7a2a, 0.09, 0.025, 0, 0).translateY(0.3));
      } else if (stage === 2) {
        g.add(blob(kit, def.colors.leaf, 0.09, 0.07, 0.09, 0.1, 0.07, 0.05));
      }
      break;
  }

  return g;
}
