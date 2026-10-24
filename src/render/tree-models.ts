import { Color, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { TreeDef, TreeStage } from '../core/trees';
import { CropKit } from './crop-models';
import { addOutline } from './outline';

export interface TreeLook {
  stage: TreeStage;
  /** 0..1 within the current phase (youth or fruit cycle). */
  progress: number;
  thirsty: boolean;
}

const THIRSTY_TINT = 0xb8b04a;

/** Size of the whole tree for a look: saplings are tiny, adults fill most of the tile. */
export function treeScale(look: TreeLook): number {
  if (look.stage === 0) return 1;
  if (look.stage === 1) return 0.5 + 0.4 * look.progress;
  return 1;
}

function blob(kit: CropKit, color: number, rx: number, ry: number, x: number, y: number, z: number): Mesh {
  const m = new Mesh(kit.sphere, kit.material(color));
  m.scale.set(rx, ry, rx);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return addOutline(m, 0.02);
}

function fruitBall(kit: CropKit, color: number, r: number, x: number, y: number, z: number, stretch = 1): Mesh {
  const m = new Mesh(kit.sphere, kit.material(color));
  m.scale.set(r, r * stretch, r);
  m.position.set(x, y, z);
  m.castShadow = true;
  return addOutline(m, 0.008);
}

function trunk(kit: CropKit, color: number, r: number, h: number, x = 0, y = 0, z = 0, lean = 0, leanZ = 0): Mesh {
  const m = new Mesh(kit.stalk, kit.material(color));
  m.scale.set(r, h, r);
  m.position.set(x, y + h / 2, z);
  m.rotation.z = lean;
  m.rotation.x = leanZ;
  m.castShadow = true;
  return addOutline(m, 0.014);
}

/** Points on a sphere shell, used to hang fruit on the outside of a crown. */
function shell(count: number, radius: number, cx: number, cy: number, cz: number, seed: number, belowOnly = false): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let n = 0; n < count; n++) {
    const a = seed + n * 2.399963; // golden angle
    const t = (n + 0.5) / count;
    const polar = belowOnly ? Math.PI * (0.55 + 0.3 * t) : Math.acos(1 - 2 * t * 0.85 - 0.1);
    out.push([cx + Math.cos(a) * Math.sin(polar) * radius, cy + Math.cos(polar) * radius * 0.9, cz + Math.sin(a) * Math.sin(polar) * radius]);
  }
  return out;
}

function sapling(kit: CropKit, def: TreeDef, leaf: number): Group {
  const g = new Group();
  const mound = new Mesh(kit.sphere, kit.material(0x6b4423));
  mound.scale.set(0.2, 0.07, 0.2);
  mound.position.y = 0.04;
  g.add(addOutline(mound, 0.01));
  g.add(trunk(kit, def.colors.trunk, 0.025, 0.3, 0, 0.05));
  g.add(blob(kit, leaf, 0.1, 0.08, 0, 0.38, 0));
  g.add(blob(kit, def.colors.leaf2, 0.07, 0.06, 0.07, 0.3, 0.02));
  g.add(blob(kit, def.colors.leaf2, 0.07, 0.06, -0.06, 0.28, -0.03));
  return g;
}

function laranjeira(kit: CropKit, def: TreeDef, leaf: number, fruit: boolean): Group {
  const g = new Group();
  g.add(trunk(kit, def.colors.trunk, 0.075, 0.5));
  g.add(blob(kit, leaf, 0.46, 0.4, 0, 0.88, 0));
  g.add(blob(kit, def.colors.leaf2, 0.3, 0.26, 0.3, 0.78, 0.12));
  g.add(blob(kit, def.colors.leaf2, 0.28, 0.24, -0.26, 0.82, -0.14));
  g.add(blob(kit, leaf, 0.26, 0.22, 0.04, 1.12, -0.1));
  if (fruit) for (const [x, y, z] of shell(7, 0.5, 0, 0.88, 0, 0.4)) g.add(fruitBall(kit, def.colors.fruit, 0.085, x, y, z));
  return g;
}

function goiabeira(kit: CropKit, def: TreeDef, leaf: number, fruit: boolean): Group {
  const g = new Group();
  g.add(trunk(kit, def.colors.trunk, 0.06, 0.45, 0, 0, 0, 0.05));
  g.add(blob(kit, leaf, 0.6, 0.3, 0, 0.78, 0));
  g.add(blob(kit, def.colors.leaf2, 0.38, 0.22, 0.36, 0.72, 0.1));
  g.add(blob(kit, def.colors.leaf2, 0.36, 0.22, -0.34, 0.74, -0.1));
  g.add(blob(kit, leaf, 0.3, 0.2, 0.05, 0.98, 0.14));
  if (fruit) for (const [x, y, z] of shell(6, 0.55, 0, 0.74, 0, 1.3, true)) g.add(fruitBall(kit, def.colors.fruit, 0.075, x, y, z));
  return g;
}

function mangueira(kit: CropKit, def: TreeDef, leaf: number, fruit: boolean): Group {
  const g = new Group();
  g.add(trunk(kit, def.colors.trunk, 0.095, 0.75));
  g.add(blob(kit, leaf, 0.5, 0.42, 0, 1.2, 0));
  g.add(blob(kit, def.colors.leaf2, 0.34, 0.32, 0.3, 1.0, 0.1));
  g.add(blob(kit, def.colors.leaf2, 0.32, 0.3, -0.28, 1.05, -0.12));
  g.add(blob(kit, leaf, 0.36, 0.32, 0.02, 1.55, 0.02));
  if (fruit) {
    for (const [x, y, z] of shell(6, 0.5, 0, 1.12, 0, 2.1, true)) {
      g.add(trunk(kit, 0x4a6a2a, 0.008, 0.1, x, y, z));
      g.add(fruitBall(kit, def.colors.fruit, 0.075, x, y - 0.03, z, 1.35));
    }
  }
  return g;
}

function jabuticabeira(kit: CropKit, def: TreeDef, leaf: number, fruit: boolean): Group {
  const g = new Group();
  g.add(trunk(kit, def.colors.trunk, 0.09, 0.5));
  g.add(trunk(kit, def.colors.trunk, 0.045, 0.3, 0.02, 0.35, 0, -0.7));
  g.add(trunk(kit, def.colors.trunk, 0.045, 0.3, -0.02, 0.35, 0.02, 0.7));
  g.add(blob(kit, leaf, 0.46, 0.34, 0, 0.82, 0));
  g.add(blob(kit, def.colors.leaf2, 0.3, 0.24, 0.3, 0.7, 0.1));
  g.add(blob(kit, def.colors.leaf2, 0.3, 0.24, -0.3, 0.72, -0.1));
  if (fruit) {
    // Fruit sprouts straight from the trunk and the branches.
    const spots: Array<[number, number, number]> = [
      [0.09, 0.2, 0.03], [-0.08, 0.3, 0.05], [0.06, 0.42, -0.07], [-0.07, 0.17, -0.06], [0.1, 0.34, 0.04],
      [0.28, 0.5, 0.04], [-0.28, 0.52, 0.06], [0.2, 0.46, -0.04], [-0.2, 0.44, -0.05], [0.0, 0.5, 0.1],
    ];
    for (const [x, y, z] of spots) g.add(fruitBall(kit, def.colors.fruit, 0.055, x, y, z));
  }
  return g;
}

function coqueiro(kit: CropKit, def: TreeDef, leaf: number, fruit: boolean): Group {
  const g = new Group();
  // A gently curved trunk built from tilted segments.
  let x = 0;
  let y = 0;
  const segments = 5;
  for (let n = 0; n < segments; n++) {
    const h = 0.36;
    const lean = -0.1 - n * 0.025;
    const r = 0.075 - n * 0.008;
    g.add(trunk(kit, n % 2 === 0 ? def.colors.trunk : 0x846a48, r, h, x, y, 0, lean));
    x += Math.sin(-lean) * h;
    y += Math.cos(lean) * h * 0.98;
  }
  const crown = new Group();
  crown.position.set(x, y, 0);
  const frondMat = kit.leafMaterial(leaf);
  const frondMat2 = kit.leafMaterial(def.colors.leaf2);
  const fronds = 8;
  for (let n = 0; n < fronds; n++) {
    const arm = new Group();
    arm.rotation.y = (n / fronds) * Math.PI * 2 + 0.2;
    const f = new Mesh(kit.leafBroad, n % 2 ? frondMat : frondMat2);
    f.scale.set(0.36, 1, 0.78);
    f.rotation.x = -0.28 + (n % 3) * 0.12;
    f.castShadow = true;
    arm.add(f);
    crown.add(arm);
  }
  crown.add(blob(kit, 0x4a7a32, 0.1, 0.07, 0, 0.02, 0));
  if (fruit) {
    for (const [dx, dy, dz] of [[0.09, -0.1, 0.05], [-0.08, -0.1, 0.07], [0.02, -0.14, -0.09], [-0.06, -0.09, -0.06]] as const) {
      crown.add(fruitBall(kit, def.colors.fruit, 0.095, dx, dy, dz));
    }
  }
  g.add(crown);
  return g;
}

const BUILDERS: Record<TreeDef['id'], (kit: CropKit, def: TreeDef, leaf: number, fruit: boolean) => Group> = {
  laranjeira,
  goiabeira,
  mangueira,
  jabuticabeira,
  coqueiro,
};

/** A glowing ring under adult rare and epic trees, like the one under their crops. */
function rarityRing(def: TreeDef): Mesh | null {
  const color = def.rarity === 'epica' ? 0xffd75a : def.rarity === 'rara' ? 0x6aa8ff : 0;
  if (color === 0) return null;
  const ring = new Mesh(new RingGeometry(0.43, 0.5, 32), new MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  return ring;
}

/** Builds one tree look at its natural size; the view scales it. Origin is the tile centre on the ground. */
export function buildTreeModel(kit: CropKit, def: TreeDef, look: TreeLook): Group {
  let leaf = def.colors.leaf;
  if (look.thirsty) leaf = new Color(leaf).lerp(new Color(THIRSTY_TINT), 0.5).getHex();
  if (look.stage === 0) return sapling(kit, def, leaf);
  const model = BUILDERS[def.id](kit, def, leaf, look.stage === 3);
  if (look.stage >= 2) {
    const ring = rarityRing(def);
    if (ring) model.add(ring);
  }
  return model;
}
