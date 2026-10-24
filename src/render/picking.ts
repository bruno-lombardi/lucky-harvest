import { Camera, Plane, Ray, Raycaster, Vector2, Vector3 } from 'three';
import { TileCoord, worldToTile } from '../core/grid';

const GROUND = new Plane(new Vector3(0, 1, 0), 0); // y = 0, the tile tops

/** Casts a ray through a client-space point and returns the grid tile it hits, if any. */
export class TilePicker {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();

  constructor(
    private readonly camera: Camera,
    private readonly dom: HTMLElement,
    private readonly gridSize: number,
  ) {}

  pick(clientX: number, clientY: number): TileCoord | null {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray: Ray = this.raycaster.ray;
    if (!ray.intersectPlane(GROUND, this.hit)) return null;
    return worldToTile(this.hit.x, this.hit.z, this.gridSize);
  }
}
