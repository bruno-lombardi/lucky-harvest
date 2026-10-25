import { BackSide, BufferGeometry, InstancedMesh, Mesh, MeshBasicMaterial, Vector3 } from 'three';

export const OUTLINE_COLOR = 0x2e1c10;

const materials = new Map<string, MeshBasicMaterial>();

/** Back-face material pushed outward along vertex normals: the classic inverted-hull toon outline. */
export function outlineMaterial(thickness: number, color: number): MeshBasicMaterial {
  const key = `${thickness.toFixed(5)}|${color}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshBasicMaterial({ color, side: BackSide });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = position + normal * ${thickness.toFixed(5)};`,
      );
    };
    material.customProgramCacheKey = () => key;
    material.userData['outline'] = { thickness, color };
    materials.set(key, material);
  }
  return material;
}

/**
 * Adds an outline of roughly `width` world units around a mesh.
 * Call after the mesh's scale is final: the extrusion happens in local space,
 * so it is divided by the largest scale component to keep the line width constant.
 * Only works for closed, volumetric geometry (not flat double-sided sheets like leaves).
 */
export function addOutline(mesh: Mesh, width = 0.012, color = OUTLINE_COLOR): Mesh {
  const largest = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z, 1e-4);
  const shell = new Mesh(mesh.geometry, outlineMaterial(width / largest, color));
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return mesh;
}

/** Outline for an InstancedMesh: shares the instance matrices, so it follows every instance. */
export function addInstancedOutline(
  mesh: InstancedMesh,
  localThickness: number,
  color = OUTLINE_COLOR,
): InstancedMesh {
  const shell = new InstancedMesh(mesh.geometry, outlineMaterial(localThickness, color), mesh.count);
  shell.instanceMatrix = mesh.instanceMatrix;
  shell.frustumCulled = false;
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return mesh;
}

// ---------------------------------------------------------------------------
// Scaled-hull outlines: for hard-edged shapes (boxes, cones, extrusions)
// ---------------------------------------------------------------------------

const hullMaterial = new MeshBasicMaterial({ color: OUTLINE_COLOR, side: BackSide });

function hullScale(geometry: BufferGeometry, width: number): { scale: Vector3; center: Vector3 } {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  return {
    center,
    scale: new Vector3(
      1 + (2 * width) / Math.max(size.x, 1e-3),
      1 + (2 * width) / Math.max(size.y, 1e-3),
      1 + (2 * width) / Math.max(size.z, 1e-3),
    ),
  };
}

/**
 * Outline made by scaling a copy of the mesh about its own centre. Unlike normal extrusion this
 * keeps corners closed on hard-edged geometry. `width` is in the mesh's local units.
 */
export function addHullOutline(mesh: Mesh, width = 0.02): Mesh {
  const { scale, center } = hullScale(mesh.geometry, width);
  const shell = new Mesh(mesh.geometry, hullMaterial);
  shell.scale.copy(scale);
  shell.position.set(center.x * (1 - scale.x), center.y * (1 - scale.y), center.z * (1 - scale.z));
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return mesh;
}

/** Instanced version: bakes the enlargement into a cloned geometry and shares the instance matrices. */
export function addInstancedHullOutline(mesh: InstancedMesh, width = 0.02): InstancedMesh {
  const geometry = mesh.geometry.clone();
  const { scale, center } = hullScale(geometry, width);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale.x, scale.y, scale.z);
  geometry.translate(center.x, center.y, center.z);
  const shell = new InstancedMesh(geometry, hullMaterial, mesh.count);
  shell.instanceMatrix = mesh.instanceMatrix;
  shell.frustumCulled = false;
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return mesh;
}
