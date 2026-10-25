/**
 * @module render/farm-view
 *
 * Draws the plowed soil and the crops from `Farm` state, and diffs every frame: one soil mesh per tile, one crop entry per planted tile,
 * rebuilt only when the crop's visible *signature* (crop, stage, thirst, withering, pest) changes. Read-only: it never mutates the farm.
 * Merged model templates are cached per signature (see `modelFor`), so a field of 100 carrots shares geometry and materials.
 */

import { BoxGeometry, BufferGeometry, Color, DataTexture, Float32BufferAttribute, Group, Mesh, MeshToonMaterial, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeStatic } from './merge';
import { getCrop } from '../core/crops';
import { CropStatus, Farm } from '../core/farm';
import { tileKey, tileToWorld } from '../core/grid';
import { CropKit, buildCropModel } from './crop-models';
import { createCoinIndicator, createDropIndicator, createPestIndicator } from './indicators';
import { PestKit, animateBugs } from './pests';

const SOIL_DRY = 0x7a4a26;
const SOIL_WET = 0x4a2d17;
const RIDGE_DRY = 0x8f5c31;
const RIDGE_WET = 0x5a3820;

/** Crops are modeled at tile scale; this fills the tile a little more generously. */
const BASE_SCALE = 1.3;

interface SoilEntry {
  mesh: Mesh;
  wet: boolean;
}

/** One tile of plowed soil (slab + three ridges) as a single vertex-coloured geometry. */
function soilGeometry(base: number, ridge: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const paint = (g: BufferGeometry, hex: number): BufferGeometry => {
    const c = new Color(hex);
    const n = g.attributes['position']!.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return g;
  };
  parts.push(paint(new BoxGeometry(0.94, 0.07, 0.94).translate(0, 0.035, 0), base));
  for (const rz of [-0.27, 0, 0.27]) parts.push(paint(new BoxGeometry(0.84, 0.045, 0.11).translate(0, 0.08, rz), ridge));
  return mergeGeometries(parts)!;
}

interface CropEntry {
  group: Group;
  model: Group | null;
  indicator: Group | null;
  pest: Group | null;
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
  private readonly pests: PestKit;
  private readonly soil = new Map<string, SoilEntry>();
  private readonly crops = new Map<string, CropEntry>();
  private time = 0;

  private readonly dryGeometry = soilGeometry(SOIL_DRY, RIDGE_DRY);
  private readonly wetGeometry = soilGeometry(SOIL_WET, RIDGE_WET);
  private readonly soilMaterial = new MeshToonMaterial({ color: 0xffffff, vertexColors: true });
  /** Finished crop models, shared by every tile that looks the same (one draw call per material). */
  private readonly templates = new Map<string, Object3D>();

  constructor(
    private readonly farm: Farm,
    private readonly gridSize: number,
    gradientMap: DataTexture,
  ) {
    this.kit = new CropKit(gradientMap);
    this.pests = new PestKit(gradientMap);
    this.soilMaterial.gradientMap = gradientMap;
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
      const mesh = new Mesh(this.dryGeometry, this.soilMaterial);
      const { x, z } = tileToWorld(i, j, this.gridSize);
      mesh.position.set(x, 0, z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      entry = { mesh, wet: false };
      this.soil.set(key, entry);
    }

    const wet = !!status && this.farm.tile(i, j).crop!.watered && !status.ripe && !status.withered;
    if (wet !== entry.wet) {
      entry.wet = wet;
      entry.mesh.geometry = wet ? this.wetGeometry : this.dryGeometry;
    }
  }

  private syncCrop(key: string, i: number, j: number, status: CropStatus | null): void {
    if (!status) return;
    const def = getCrop(status.cropId);
    const signature = `${status.cropId}|${status.stage}|${status.thirsty}|${status.withered}|${status.pest ?? ''}`;

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
        pest: null,
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
    entry.model = this.modelFor(def, status);
    entry.group.add(entry.model);

    if (entry.indicator) entry.group.remove(entry.indicator);
    entry.indicator = this.buildIndicator(status);
    if (entry.indicator) entry.group.add(entry.indicator);

    if (entry.pest) entry.group.remove(entry.pest);
    entry.pest = null;
    if (status.pest) {
      const seed = i * 31 + j * 17;
      entry.pest = status.pest === 'weed' ? this.pests.weeds(seed) : this.pests.bugs(seed);
      entry.group.add(entry.pest);
    }

    if (status.stage !== entry.stage || entry.signature === '') entry.age = 0; // pop
    entry.stage = status.stage;
    entry.signature = signature;
  }

  private modelFor(def: ReturnType<typeof getCrop>, status: CropStatus): Group {
    const key = `${status.cropId}|${status.stage}|${status.thirsty}|${status.withered}`;
    let template = this.templates.get(key);
    if (!template) {
      template = mergeStatic(buildCropModel(this.kit, def, status));
      this.templates.set(key, template);
    }
    return template.clone() as Group;
  }

  /** Red alert above infested crops, blue drop above thirsty ones, glowing gold coin above ripe ones. */
  private buildIndicator(status: CropStatus): Group | null {
    if (status.withered) return null;
    if (status.pest) return createPestIndicator();
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
      if (entry.pest?.userData['kind'] === 'bugs') animateBugs(entry.pest, this.time);
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
    if (entry) this.group.remove(entry.mesh);
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
