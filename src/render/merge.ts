import { BufferGeometry, Group, Material, Mesh, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { outlineMaterial } from './outline';

/**
 * Flattens a static model into one mesh per material (and shadow flags), baking every child
 * transform into the vertices. Draw calls drop from "one per part" to "one per material".
 * The root's own transform is left alone, so it can still be scaled or swayed. Instanced meshes and
 * anything that is not a plain Mesh are carried over untouched.
 */
export function mergeStatic(root: Object3D): Group {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { material: Material | Material[]; cast: boolean; receive: boolean; parts: BufferGeometry[] }>();
  const keep: Object3D[] = [];

  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh || Array.isArray(mesh.material)) {
      if (mesh.isMesh) keep.push(mesh);
      return;
    }
    const geometry = mesh.geometry.clone();
    const relative = inverse.clone().multiply(mesh.matrixWorld);
    geometry.applyMatrix4(relative);
    let material = mesh.material;
    // Normal-extruded outlines are measured in the mesh's own units: once the scale is baked in, widen them to match.
    const outline = material.userData['outline'] as { thickness: number; color: number } | undefined;
    if (outline) {
      const s = relative.getMaxScaleOnAxis();
      material = outlineMaterial(Math.round(outline.thickness * s * 1000) / 1000, outline.color);
    }
    const key = `${material.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${Object.keys(geometry.attributes).sort().join()}|${geometry.index ? 'i' : 'n'}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, parts: [] };
      buckets.set(key, bucket);
    }
    bucket.parts.push(geometry);
  });

  const out = new Group();
  for (const bucket of buckets.values()) {
    const merged = bucket.parts.length === 1 ? bucket.parts[0]! : mergeGeometries(bucket.parts);
    if (!merged) continue;
    const mesh = new Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    out.add(mesh);
  }
  for (const mesh of keep) out.add(mesh.clone());
  return out;
}
