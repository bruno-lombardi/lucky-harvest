import { Camera, Object3D, Raycaster, Vector2 } from 'three';

/** Raycasts against tagged groups (`userData.pickId`) so buildings can be tapped before the ground. */
export class ObjectPicker {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();

  constructor(
    private readonly camera: Camera,
    private readonly dom: HTMLElement,
    private readonly roots: () => Object3D[],
  ) {}

  /** The pick id of the nearest tagged object under the point, or null. */
  pick(clientX: number, clientY: number): string | null {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.roots(), true);
    for (const hit of hits) {
      let o: Object3D | null = hit.object;
      while (o) {
        const id = o.userData['pickId'];
        if (typeof id === 'string') return id;
        o = o.parent;
      }
    }
    return null;
  }
}
