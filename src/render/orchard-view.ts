import { CircleGeometry, DataTexture, Group, Mesh, MeshToonMaterial } from 'three';
import { Farm } from '../core/farm';
import { tileKey, tileToWorld } from '../core/grid';
import { POMAR, TREES, TreeStatus, orchardTiles } from '../core/trees';
import { CropKit } from './crop-models';
import { createCoinIndicator, createDropIndicator, createPestIndicator } from './indicators';
import { PestKit, animateBugs } from './pests';
import { Palette, box } from './props';
import { buildTreeModel, treeScale } from './tree-models';

const BASE_SCALE = 0.78;
const GRID = 24;

interface TreeEntry {
  group: Group;
  model: Group | null;
  indicator: Group | null;
  pest: Group | null;
  signature: string;
  scale: number;
  age: number;
  phase: number;
}

/** The Pomar next to the windmill: an unbought plot of stakes, then a fenced orchard with the player's fruit trees. */
export class OrchardView {
  readonly group = new Group();

  private readonly kit: CropKit;
  private readonly pests: PestKit;
  private readonly palette: Palette;
  private readonly entries = new Map<string, TreeEntry>();
  private readonly built = new Group();
  private builtFor: boolean | null = null;
  private time = 0;

  constructor(private readonly farm: Farm, gradientMap: DataTexture) {
    this.kit = new CropKit(gradientMap);
    this.pests = new PestKit(gradientMap);
    this.palette = new Palette(gradientMap);
    this.group.add(this.built);
  }

  update(dt: number, now: number): void {
    this.time += dt;
    if (this.builtFor !== this.farm.pomar) this.buildGround(this.farm.pomar);

    const seen = new Set<string>();
    for (const { i, j, tree } of this.farm.treeEntries()) {
      const key = tileKey(i, j);
      seen.add(key);
      this.sync(key, i, j, this.farm.treeStatus(i, j, now)!, tree.species);
    }
    for (const key of [...this.entries.keys()]) {
      if (seen.has(key)) continue;
      this.group.remove(this.entries.get(key)!.group);
      this.entries.delete(key);
    }
    this.animate(dt);
  }

  private bounds(): { x0: number; x1: number; z0: number; z1: number } {
    const a = tileToWorld(POMAR.i0, POMAR.j0, GRID);
    const b = tileToWorld(POMAR.i1, POMAR.j1, GRID);
    return { x0: a.x - 0.5, x1: b.x + 0.5, z0: a.z - 0.5, z1: b.z + 0.5 };
  }

  private buildGround(bought: boolean): void {
    this.builtFor = bought;
    for (const child of [...this.built.children]) this.built.remove(child);
    const { x0, x1, z0, z1 } = this.bounds();
    const p = this.palette;
    const margin = 0.22;
    const ax = x0 - margin;
    const bx = x1 + margin;
    const az = z0 - margin;
    const bz = z1 + margin;

    if (!bought) {
      // Just stakes and a rope at the corners: land that is waiting for an owner.
      for (const [x, z] of [[ax, az], [bx, az], [ax, bz], [bx, bz]] as const) {
        this.built.add(box(p, 0x8a6a42, 0.12, 0.55, 0.12, x, 0.275, z, 0.012));
        this.built.add(box(p, 0xe8d8b0, 0.2, 0.12, 0.02, x, 0.5, z, 0));
      }
      return;
    }

    // Orchard grass, a little richer than the fields around it.
    const lawn = box(p, 0x76b34f, bx - ax, 0.05, bz - az, (ax + bx) / 2, 0.025, (az + bz) / 2, 0);
    lawn.castShadow = false;
    this.built.add(lawn);
    const spotGeo = new CircleGeometry(0.34, 18);
    const spotMat = new MeshToonMaterial({ color: 0x8a6a42 });
    spotMat.gradientMap = p.toon(0).gradientMap;
    for (const { i, j } of orchardTiles()) {
      const { x, z } = tileToWorld(i, j, GRID);
      const spot = new Mesh(spotGeo, spotMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(x, 0.056, z);
      spot.receiveShadow = true;
      this.built.add(spot);
    }

    // Low wooden fence, open at the south side where the path comes in.
    const gate = (ax + bx) / 2;
    const rail = (w: number, d: number, x: number, z: number): void => {
      this.built.add(box(p, 0xa07a4a, w, 0.07, d, x, 0.32, z, 0.01));
      this.built.add(box(p, 0xa07a4a, w, 0.07, d, x, 0.16, z, 0.01));
    };
    const post = (x: number, z: number): void => {
      this.built.add(box(p, 0x7a5a38, 0.1, 0.48, 0.1, x, 0.24, z, 0.012));
    };
    for (let x = ax; x <= bx + 0.01; x += (bx - ax) / 6) {
      post(x, az);
      if (Math.abs(x - gate) > 1.0 || true) post(x, bz);
    }
    for (let z = az; z <= bz + 0.01; z += (bz - az) / 2) {
      post(ax, z);
      post(bx, z);
    }
    rail(bx - ax, 0.04, (ax + bx) / 2, az);
    rail(0.04, bz - az, ax, (az + bz) / 2);
    rail(0.04, bz - az, bx, (az + bz) / 2);
    const half = (bx - ax) / 2 - 0.9;
    rail(half, 0.04, ax + half / 2, bz);
    rail(half, 0.04, bx - half / 2, bz);
    // A small sign by the gate.
    this.built.add(box(p, 0x6a4a2c, 0.07, 0.7, 0.07, gate + 0.75, 0.35, bz + 0.15, 0.01));
    this.built.add(box(p, 0xd9b16a, 0.5, 0.26, 0.05, gate + 0.75, 0.68, bz + 0.15, 0.012));
    this.built.add(box(p, 0xc23b2a, 0.1, 0.1, 0.055, gate + 0.75, 0.68, bz + 0.15, 0));
  }

  private sync(key: string, i: number, j: number, status: TreeStatus, species: keyof typeof TREES): void {
    const def = TREES[species];
    const look = { stage: status.stage, progress: status.progress, thirsty: status.thirsty };
    const signature = `${species}|${status.stage}|${status.thirsty}|${status.pest ?? ''}|${status.stage === 1 ? Math.floor(status.progress * 6) : 0}`;
    let entry = this.entries.get(key);
    if (!entry) {
      const group = new Group();
      const { x, z } = tileToWorld(i, j, GRID);
      group.position.set(x, 0.05, z);
      this.group.add(group);
      entry = { group, model: null, indicator: null, pest: null, signature: '', scale: 1, age: 0, phase: (i * 5 + j * 11) % 7 };
      this.entries.set(key, entry);
    }
    entry.scale = treeScale(look);
    if (entry.signature === signature) return;

    if (entry.model) entry.group.remove(entry.model);
    entry.model = buildTreeModel(this.kit, def, look);
    entry.group.add(entry.model);

    if (entry.indicator) entry.group.remove(entry.indicator);
    entry.indicator = status.pest ? createPestIndicator() : status.thirsty ? createDropIndicator() : status.ripe ? createCoinIndicator() : null;
    if (entry.indicator) entry.group.add(entry.indicator);

    if (entry.pest) entry.group.remove(entry.pest);
    entry.pest = null;
    if (status.pest) {
      const seed = i * 31 + j * 17;
      entry.pest = status.pest === 'weed' ? this.pests.weeds(seed) : this.pests.bugs(seed);
      entry.group.add(entry.pest);
    }
    if (!entry.signature.startsWith(`${species}|${status.stage}|`)) entry.age = 0;
    entry.signature = signature;
  }

  private animate(dt: number): void {
    for (const entry of this.entries.values()) {
      entry.age += dt;
      const model = entry.model;
      if (model) {
        const t = entry.age / 0.5;
        const pop = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.18 * (1 - t * 0.4) : 1;
        const s = BASE_SCALE * entry.scale * pop;
        model.scale.set(s, s, s);
        model.rotation.z = Math.sin(this.time * 1.1 + entry.phase) * 0.02;
        model.rotation.x = Math.cos(this.time * 0.9 + entry.phase) * 0.012;
      }
      if (entry.pest?.userData['kind'] === 'bugs') animateBugs(entry.pest, this.time);
      const indicator = entry.indicator;
      if (indicator) {
        const lift = 0.35 + 1.15 * (entry.scale > 0.55 ? 1 : entry.scale + 0.3);
        indicator.position.y = lift + Math.sin(this.time * 3 + entry.phase) * 0.05;
        indicator.scale.setScalar(1 + 0.06 * Math.sin(this.time * 4 + entry.phase));
      }
    }
  }
}
