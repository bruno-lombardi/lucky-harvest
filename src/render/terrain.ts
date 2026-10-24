import {
  BoxGeometry,
  Color,
  ConeGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { tileToWorld } from '../core/grid';
import { fbm2D, mulberry32 } from '../core/noise';
import { Water } from './water';

const TILE_HEIGHT = 0.5;
const WATER_Y = -1.15;

const FLOWER_COLORS = [0xff7fa8, 0xffd84a, 0xffffff, 0xff9a3c, 0xb98cff];

/**
 * The farm island: grass tiles on an earth block floating in water,
 * with procedurally scattered grass tufts and flowers.
 */
export class Terrain {
  readonly group = new Group();
  private water: Water | null = null;

  constructor(
    readonly size: number,
    gradientMap: DataTexture,
    seed = 1337,
    /** Locked (not yet farmable) tiles get a duller, wilder tint. */
    private readonly isUnlocked: (i: number, j: number) => boolean = () => true,
  ) {
    this.buildBase(gradientMap);
    this.buildWater();
    this.buildGrass(gradientMap, seed);
    this.buildDetails(gradientMap, seed);
  }

  private buildBase(gradientMap: DataTexture): void {
    const depth = 1.7;
    const base = new Mesh(
      new BoxGeometry(this.size, depth, this.size),
      new MeshToonMaterial({ color: 0x8a5a33, gradientMap }),
    );
    base.position.y = -TILE_HEIGHT - depth / 2;
    base.receiveShadow = true;
    this.group.add(base);

    // A slightly darker lower band reads as damp soil near the waterline.
    const band = new Mesh(
      new BoxGeometry(this.size + 0.02, 0.5, this.size + 0.02),
      new MeshToonMaterial({ color: 0x6d4325, gradientMap }),
    );
    band.position.y = WATER_Y - 0.15;
    this.group.add(band);
  }

  private buildWater(): void {
    this.water = new Water(this.size, WATER_Y);
    this.group.add(this.water.mesh);
  }

  private grass: InstancedMesh | null = null;
  private grassSeed = 0;

  update(time: number): void {
    this.water?.update(time);
  }

  private buildGrass(gradientMap: DataTexture, seed: number): void {
    const count = this.size * this.size;
    const mesh = new InstancedMesh(
      new BoxGeometry(1, TILE_HEIGHT, 1),
      new MeshToonMaterial({ color: 0xffffff, gradientMap }),
      count,
    );
    mesh.receiveShadow = true;

    const matrix = new Matrix4();
    const scale = new Vector3(0.985, 1, 0.985);
    const quat = new Quaternion();
    let n = 0;

    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const { x, z } = tileToWorld(i, j, this.size);
        matrix.compose(new Vector3(x, -TILE_HEIGHT / 2, z), quat, scale);
        mesh.setMatrixAt(n, matrix);
        n++;
      }
    }
    this.grass = mesh;
    this.grassSeed = seed;
    this.recolor();
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  /** Paints every tile: lush inside the owned plot, duller wild grass outside it. */
  private recolor(): void {
    const mesh = this.grass;
    if (!mesh) return;
    const color = new Color();
    let n = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const noise = fbm2D(i * 0.35, j * 0.35, this.grassSeed);
        const checker = (i + j) % 2 === 0 ? 0.018 : -0.012;
        const wild = this.isUnlocked(i, j) ? 0 : 1;
        color.setHSL(
          0.272 + (noise - 0.5) * 0.04 - wild * 0.01,
          0.7 - wild * 0.16,
          0.5 + (noise - 0.5) * 0.12 + checker - wild * 0.06,
        );
        mesh.setColorAt(n, color);
        n++;
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** Call after the owned plot changes (land expansion). */
  refreshLand(): void {
    this.recolor();
  }

  private buildDetails(gradientMap: DataTexture, seed: number): void {
    const rand = mulberry32(seed ^ 0x9e3779b9);
    const tufts: Matrix4[] = [];
    const flowers: { matrix: Matrix4; color: number }[] = [];
    const quat = new Quaternion();

    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const { x, z } = tileToWorld(i, j, this.size);

        if (rand() < 0.22) {
          const blades = 1 + Math.floor(rand() * 3);
          for (let b = 0; b < blades; b++) {
            const s = 0.7 + rand() * 0.7;
            tufts.push(
              new Matrix4().compose(
                new Vector3(x + (rand() - 0.5) * 0.8, 0.09 * s, z + (rand() - 0.5) * 0.8),
                quat,
                new Vector3(s, s, s),
              ),
            );
          }
        }

        if (rand() < 0.07) {
          flowers.push({
            matrix: new Matrix4().compose(
              new Vector3(x + (rand() - 0.5) * 0.7, 0.07, z + (rand() - 0.5) * 0.7),
              quat,
              new Vector3(1, 1, 1),
            ),
            color: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)] ?? 0xffffff,
          });
        }
      }
    }

    const tuftMesh = new InstancedMesh(
      new ConeGeometry(0.06, 0.22, 5),
      new MeshToonMaterial({ color: 0x3f9b2e, gradientMap }),
      tufts.length,
    );
    tufts.forEach((m, n) => tuftMesh.setMatrixAt(n, m));
    tuftMesh.instanceMatrix.needsUpdate = true;
    this.group.add(tuftMesh);

    const flowerMesh = new InstancedMesh(
      new SphereGeometry(0.06, 8, 6),
      new MeshToonMaterial({ color: 0xffffff, gradientMap }),
      flowers.length,
    );
    const c = new Color();
    flowers.forEach((f, n) => {
      flowerMesh.setMatrixAt(n, f.matrix);
      flowerMesh.setColorAt(n, c.setHex(f.color));
    });
    flowerMesh.instanceMatrix.needsUpdate = true;
    if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    this.group.add(flowerMesh);
  }
}
