import { BoxGeometry, DataTexture, Group, Mesh, MeshToonMaterial } from 'three';
import { getCrop } from '../core/crops';
import { CropStatus, Farm } from '../core/farm';
import { tileKey, tileToWorld } from '../core/grid';
import { CropKit, buildCropModel } from './crop-models';
import { createCoinIndicator, createDropIndicator } from './indicators';

const SOIL_DRY = 0x7a4a26;
const SOIL_WET = 0x4a2d17;
const RIDGE_DRY = 0x8f5c31;
const RIDGE_WET = 0x5a3820;

/** Crops are modeled at tile scale; this fills the tile a little more generously. */
const BASE_SCALE = 1.3;

interface SoilEntry {
  group: Group;
  base: Mesh;
  ridges: Mesh[];
  wet: boolean;
}

interface CropEntry {
  group: Group;
  model: Group | null;
  indicator: Group | null;
  signature: string;
  stage: number;
  grow: number; // 0.8..1 within-stage growth, so plants swell gradually instead of snapping
  age: number; // seconds since the last model change, drives the pop animation
  phase: number;
}

/** Smooth size within a growth stage: starts at 80% and reaches 100% as the next stage nears. */
function growthFactor(status: CropStatus): number {
  if (status.ripe || status.withered) return 1;
  const [from, to] = status.stage === 0 ? [0, 0.15] : status.stage === 1 ? [0.15, 0.45] : [0.45, 1];
  const fraction = Math.min(1, Math.max(0, (status.progress - from) / (to - from)));
  return 0.8 + 0.2 * fraction;
}

/** Renders plowed soil and growing crops from Farm state. Read-only: it never mutates the farm. */
export class FarmView {
  readonly group = new Group();

  private readonly kit: CropKit;
  private readonly soil = new Map<string, SoilEntry>();
  private readonly crops = new Map<string, CropEntry>();
  private time = 0;

  private readonly soilGeometry = new BoxGeometry(0.94, 0.07, 0.94);
  private readonly ridgeGeometry = new BoxGeometry(0.84, 0.045, 0.11);
  private readonly materials = {
    soilDry: new MeshToonMaterial({ color: SOIL_DRY }),
    soilWet: new MeshToonMaterial({ color: SOIL_WET }),
    ridgeDry: new MeshToonMaterial({ color: RIDGE_DRY }),
    ridgeWet: new MeshToonMaterial({ color: RIDGE_WET }),
  };

  constructor(
    private readonly farm: Farm,
    private readonly gridSize: number,
    gradientMap: DataTexture,
  ) {
    this.kit = new CropKit(gradientMap);
    for (const m of Object.values(this.materials)) m.gradientMap = gradientMap;
  }

  update(dt: number, now: number): void {
    this.time += dt;
    const seen = new Set<string>();

    for (const { i, j, tile } of this.farm.entries()) {
      const key = tileKey(i, j);
      seen.add(key);
      const status = tile.crop ? this.farm.status(i, j, now) : null;
      this.syncSoil(key, i, j, status);
      this.syncCrop(key, i, j, status);
    }

    for (const key of [...this.soil.keys()]) {
      if (!seen.has(key)) this.removeSoil(key);
    }
    for (const key of [...this.crops.keys()]) {
      const [i, j] = parseKey(key);
      if (!seen.has(key) || this.farm.tile(i, j).crop === null) this.removeCrop(key);
    }

    this.animate(dt);
  }

  private syncSoil(key: string, i: number, j: number, status: CropStatus | null): void {
    let entry = this.soil.get(key);
    if (!entry) {
      const group = new Group();
      const { x, z } = tileToWorld(i, j, this.gridSize);
      group.position.set(x, 0, z);

      const base = new Mesh(this.soilGeometry, this.materials.soilDry);
      base.position.y = 0.035;
      base.receiveShadow = true;
      group.add(base);

      const ridges: Mesh[] = [];
      for (const rz of [-0.27, 0, 0.27]) {
        const ridge = new Mesh(this.ridgeGeometry, this.materials.ridgeDry);
        ridge.position.set(0, 0.08, rz);
        ridge.receiveShadow = true;
        group.add(ridge);
        ridges.push(ridge);
      }
      this.group.add(group);
      entry = { group, base, ridges, wet: false };
      this.soil.set(key, entry);
    }

    const wet = !!status && this.farm.tile(i, j).crop!.watered && !status.ripe && !status.withered;
    if (wet !== entry.wet) {
      entry.wet = wet;
      entry.base.material = wet ? this.materials.soilWet : this.materials.soilDry;
      for (const r of entry.ridges) r.material = wet ? this.materials.ridgeWet : this.materials.ridgeDry;
    }
  }

  private syncCrop(key: string, i: number, j: number, status: CropStatus | null): void {
    if (!status) return;
    const def = getCrop(status.cropId);
    const signature = `${status.cropId}|${status.stage}|${status.thirsty}|${status.withered}`;

    let entry = this.crops.get(key);
    if (!entry) {
      const group = new Group();
      const { x, z } = tileToWorld(i, j, this.gridSize);
      group.position.set(x, 0.08, z);
      this.group.add(group);
      entry = {
        group,
        model: null,
        indicator: null,
        signature: '',
        stage: -1,
        grow: 1,
        age: 0,
        phase: (i * 7 + j * 13) % 6,
      };
      this.crops.set(key, entry);
    }
    entry.grow = growthFactor(status);
    if (entry.signature === signature) return;

    if (entry.model) entry.group.remove(entry.model);
    entry.model = buildCropModel(this.kit, def, status);
    entry.group.add(entry.model);

    if (entry.indicator) entry.group.remove(entry.indicator);
    entry.indicator = this.buildIndicator(status);
    if (entry.indicator) entry.group.add(entry.indicator);

    if (status.stage !== entry.stage || entry.signature === '') entry.age = 0; // pop
    entry.stage = status.stage;
    entry.signature = signature;
  }

  /** Blue drop above thirsty crops, glowing gold coin above ripe ones. */
  private buildIndicator(status: CropStatus): Group | null {
    if (status.withered) return null;
    if (status.thirsty) return createDropIndicator();
    if (status.ripe) return createCoinIndicator();
    return null;
  }

  private animate(dt: number): void {
    for (const entry of this.crops.values()) {
      entry.age += dt;
      const model = entry.model;
      if (model) {
        // Springy pop when something changes, then a gentle sway.
        const popT = entry.age / 0.45;
        const pop = popT < 1 ? 1 + Math.sin(popT * Math.PI) * 0.32 * (1 - popT * 0.4) : 1;
        const s = BASE_SCALE * entry.grow * pop;
        model.scale.set(s, s, s);
        model.rotation.z = Math.sin(this.time * 1.6 + entry.phase) * 0.025;
        model.rotation.x = Math.cos(this.time * 1.3 + entry.phase) * 0.015;
      }
      const indicator = entry.indicator;
      if (indicator) {
        const bob = Math.sin(this.time * 3 + entry.phase);
        indicator.position.y = 1.02 + bob * 0.05;
        const pulse = 1 + (indicator.userData['kind'] === 'coin' ? 0.08 : 0.05) * Math.sin(this.time * 4 + entry.phase);
        indicator.scale.setScalar(pulse);
      }
    }
  }

  private removeSoil(key: string): void {
    const entry = this.soil.get(key);
    if (entry) this.group.remove(entry.group);
    this.soil.delete(key);
  }

  private removeCrop(key: string): void {
    const entry = this.crops.get(key);
    if (entry) this.group.remove(entry.group);
    this.crops.delete(key);
  }
}

function parseKey(key: string): [number, number] {
  const [i, j] = key.split(',').map(Number) as [number, number];
  return [i, j];
}
