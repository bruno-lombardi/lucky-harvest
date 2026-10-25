/**
 * @module render/helper-view
 *
 * Draws the helpers: sprinkler heads with their spray, and the walkers (Tonico, Mingau, Rex, Lúcia) placed each frame by `walkerPose`.
 * Each walker also gets a see-through "x-ray" silhouette material that only shows where they are hidden behind a building, so the
 * player can always follow them. Taps are routed through `userData.pickId = 'helper:<id>'`.
 */

import {
  DataTexture,
  DynamicDrawUsage,
  Group,
  GreaterDepth,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { CROPS } from '../core/crops';
import { Farm } from '../core/farm';
import { HOME, WalkerId, sprinklerSpots, walkerPose } from '../core/helpers';
import { Character, CharacterKit } from './characters';
import { Palette, box } from './props';
import { createUnpaidIndicator } from './indicators';

const DROPS_PER_HEAD = 18;
const MAX_HEADS = 16;
/** How long a sprinkler keeps spraying after a pulse (ms). */
const SPRAY_MS = 3200;
const SPRAY_RADIUS = 1.45;

/** What shows through when a walker is hidden behind a building: a soft warm silhouette. */
const XRAY = new MeshBasicMaterial({
  color: 0xffd68a,
  transparent: true,
  opacity: 0.38,
  depthFunc: GreaterDepth,
  depthWrite: false,
});

/** Adds a see-through silhouette to every solid mesh of a character, so helpers never disappear behind roofs and walls. */
function addSilhouette(root: Object3D): Mesh[] {
  const ghosts: Mesh[] = [];
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    const material = mesh.material as { side?: number } | undefined;
    if (mesh.isMesh && material?.side !== 1 && !mesh.userData['silhouette']) meshes.push(mesh);
  });
  for (const mesh of meshes) {
    const ghost = new Mesh(mesh.geometry, XRAY);
    ghost.renderOrder = 20;
    ghost.userData['silhouette'] = true;
    ghost.visible = false;
    mesh.add(ghost);
    ghosts.push(ghost);
  }
  return ghosts;
}

/** Rex's little doghouse, set by the pens where he rests. */
function buildKennel(palette: Palette): Group {
  const g = new Group();
  g.add(box(palette, 0xb8814a, 0.8, 0.5, 0.7, 0, 0.25, 0, 0.015));
  g.add(box(palette, 0x2a1a10, 0.3, 0.32, 0.04, 0, 0.17, 0.36, 0));
  for (const side of [-1, 1]) {
    const slab = box(palette, 0xa4382c, 0.62, 0.06, 0.82, side * 0.22, 0.64, 0, 0.012);
    slab.rotation.z = -side * 0.62;
    g.add(slab);
  }
  g.add(box(palette, 0xf6efe0, 0.2, 0.07, 0.03, 0, 0.42, 0.37, 0));
  return g;
}

interface WalkerEntry {
  id: WalkerId;
  character: Character;
  indicator: Group;
  heading: number;
  initialised: boolean;
  /** The see-through copies, shown only while something stands between the camera and the walker. */
  ghosts: Mesh[];
  nextCheck: number;
}

interface HeadEntry {
  root: Group;
  rotor: Group;
  nozzle: Group;
  spin: number;
}

/** Shows the hired helpers: Tonico, Mingau and Rex walking the farm, and the sprinkler heads. Read-only on the farm. */
export class HelperView {
  readonly group = new Group();

  private readonly kit: CharacterKit;
  private readonly walkers = new Map<WalkerId, WalkerEntry>();
  private readonly palette: Palette;
  private kennel: Group | null = null;
  private readonly heads: HeadEntry[] = [];
  private readonly sprinklers = new Group();
  private readonly drops: InstancedMesh;
  private readonly dummy = new Object3D();
  /** Debug: keep the sprinklers spraying. */
  alwaysSpray = false;
  /** Set by the game: true when something hides this world point from the camera. */
  isHidden: (point: Vector3) => boolean = () => false;
  private readonly probe = new Vector3();
  private headKey = '';
  private time = 0;
  private night = 0;

  constructor(
    private readonly farm: Farm,
    gradientMap: DataTexture,
  ) {
    this.kit = new CharacterKit(gradientMap);
    this.palette = new Palette(gradientMap);
    this.group.add(this.sprinklers);

    this.drops = new InstancedMesh(
      new SphereGeometry(0.05, 7, 6),
      new MeshBasicMaterial({ color: 0xa6e0ff, transparent: true, opacity: 0.9 }),
      MAX_HEADS * DROPS_PER_HEAD,
    );
    this.drops.instanceMatrix.setUsage(DynamicDrawUsage);
    this.drops.frustumCulled = false;
    this.drops.count = 0;
    this.group.add(this.drops);
  }

  /** Objects the picker should test (each carries `userData.pickId = 'helper:<id>'`). */
  pickRoots(): Object3D[] {
    const roots: Object3D[] = [this.sprinklers];
    for (const w of this.walkers.values()) roots.push(w.character.root);
    return roots;
  }

  setNight(night: number): void {
    this.night = night;
  }

  update(dt: number, now: number): void {
    this.time += dt;
    this.syncWalkers(dt, now);
    this.syncSprinklers(dt, now);
  }

  private syncKennel(): void {
    const has = !!this.farm.helpers.cao;
    if (has && !this.kennel) {
      this.kennel = buildKennel(this.palette);
      this.kennel.position.set(HOME.cao.u - 12 + 1.2, 0, HOME.cao.v - 12 + 0.2);
      this.kennel.rotation.y = Math.PI / 4;
      this.group.add(this.kennel);
    } else if (!has && this.kennel) {
      this.group.remove(this.kennel);
      this.kennel = null;
    }
  }

  private syncWalkers(dt: number, now: number): void {
    this.syncKennel();
    for (const id of ['ajudante', 'gato', 'cao', 'tratador'] as const) {
      const state = this.farm.helpers[id];
      let entry = this.walkers.get(id);
      if (!state) {
        if (entry) {
          this.group.remove(entry.character.root);
          this.walkers.delete(id);
        }
        continue;
      }
      if (!entry) {
        const character =
          id === 'ajudante' ? this.kit.farmhand() : id === 'tratador' ? this.kit.farmhand(true) : id === 'gato' ? this.kit.cat() : this.kit.dog();
        const ghosts = addSilhouette(character.root);
        character.root.userData['pickId'] = `helper:${id}`;
        const indicator = createUnpaidIndicator();
        indicator.visible = false;
        character.root.add(indicator);
        this.group.add(character.root);
        entry = { id, character, indicator, heading: 0, initialised: false, ghosts, nextCheck: 0 };
        this.walkers.set(id, entry);
      }

      const pose = walkerPose(id, state, this.farm.landSize, now);
      const root = entry.character.root;
      if (this.time >= entry.nextCheck) {
        entry.nextCheck = this.time + 0.2;
        const hidden = this.isHidden(this.probe.set(pose.at.u - 12, 0.55, pose.at.v - 12));
        for (const ghost of entry.ghosts) ghost.visible = hidden;
      }
      root.position.set(pose.at.u - 12, 0.04, pose.at.v - 12);
      if (!entry.initialised) {
        entry.heading = pose.heading;
        entry.initialised = true;
      } else {
        const delta = Math.atan2(Math.sin(pose.heading - entry.heading), Math.cos(pose.heading - entry.heading));
        entry.heading += delta * Math.min(1, dt * 10);
      }
      // Resting characters turn to face the camera (it looks from +x, +z).
      const facing = pose.mode === 'resting' && state.paid ? Math.PI / 4 : entry.heading;
      const current = root.rotation.y;
      const turn = Math.atan2(Math.sin(facing - current), Math.cos(facing - current));
      root.rotation.y = current + turn * Math.min(1, dt * 8);

      let carry: number | null = null;
      if (id === 'ajudante' && pose.mode === 'working') {
        const crop = this.farm.tile(Math.floor(state.target.u), Math.floor(state.target.v)).crop;
        carry = crop ? CROPS[crop.cropId].colors.fruit : null;
      }
      const resting: typeof pose = state.paid ? pose : { ...pose, mode: 'resting' };
      entry.character.update({ pose: resting, dt, time: this.time, carry, night: this.night });

      entry.indicator.visible = !state.paid;
      if (!state.paid) {
        entry.indicator.rotation.y = -root.rotation.y;
        entry.indicator.position.y = entry.character.height + 0.28 + Math.sin(this.time * 3) * 0.04;
      }
    }
  }

  private syncSprinklers(dt: number, now: number): void {
    const state = this.farm.helpers.regador;
    const spots = state ? sprinklerSpots(this.farm.landSize, state.level) : [];
    const key = spots.map((s) => `${s.i},${s.j}`).join('|');
    if (key !== this.headKey) {
      this.headKey = key;
      for (const head of this.heads) this.sprinklers.remove(head.root);
      this.heads.length = 0;
      for (const spot of spots) {
        const built = this.kit.sprinkler();
        built.root.position.set(spot.i + 0.5 - 12, 0.04, spot.j + 0.5 - 12);
        built.root.userData['pickId'] = 'helper:regador';
        this.sprinklers.add(built.root);
        this.heads.push({ ...built, spin: Math.random() * 6 });
      }
    }

    const spraying = !!state && state.paid && (this.alwaysSpray || now - state.lastAt < SPRAY_MS);
    let used = 0;
    for (const head of this.heads) {
      head.spin += dt * (spraying ? 9 : 0.4);
      head.rotor.rotation.y = head.spin;
      if (!spraying) continue;
      const fade = this.alwaysSpray ? 1 : Math.min(1, (SPRAY_MS - (now - state!.lastAt)) / 600);
      const origin = head.root.position;
      for (let k = 0; k < DROPS_PER_HEAD; k++) {
        const t = (this.time * 1.5 + k / DROPS_PER_HEAD) % 1;
        // Two jets leave the arm in opposite directions; each drop flies a little arc.
        const arm = (k % 2) * Math.PI + head.spin - t * 0.5;
        const reach = SPRAY_RADIUS * t * (0.7 + 0.3 * ((k * 7) % 5) / 4);
        const height = 0.38 + 1.0 * t - 1.4 * t * t;
        this.dummy.position.set(origin.x + Math.cos(arm) * reach, origin.y + Math.max(0.02, height), origin.z - Math.sin(arm) * reach);
        this.dummy.scale.setScalar(MathUtils.lerp(0.5, 1, fade) * (0.7 + 0.5 * t));
        this.dummy.updateMatrix();
        this.drops.setMatrixAt(used++, this.dummy.matrix);
      }
    }
    this.drops.count = used;
    this.drops.instanceMatrix.needsUpdate = true;
  }
}
