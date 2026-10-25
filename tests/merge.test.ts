import { BoxGeometry, Group, Mesh, MeshToonMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { mergeStatic } from '../src/render/merge';

describe('mergeStatic', () => {
  it('collapses parts that share a material into one mesh and bakes the transforms', () => {
    const red = new MeshToonMaterial({ color: 0xff0000 });
    const blue = new MeshToonMaterial({ color: 0x0000ff });
    const root = new Group();
    for (let n = 0; n < 5; n++) {
      const part = new Mesh(new BoxGeometry(1, 1, 1), n % 2 ? red : blue);
      part.position.set(n * 2, 0, 0);
      root.add(part);
    }
    const merged = mergeStatic(root);
    expect(merged.children).toHaveLength(2);
    const box = merged.children[0] as Mesh;
    box.geometry.computeBoundingBox();
    expect(box.geometry.boundingBox!.max.x).toBeGreaterThan(1);
  });
});
