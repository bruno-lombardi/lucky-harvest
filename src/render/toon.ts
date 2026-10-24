import { DataTexture, NearestFilter, RedFormat } from 'three';

/** A hard-stepped gradient map gives MeshToonMaterial its cartoon banding. */
export function createToonGradient(steps = 4): DataTexture {
  const data = new Uint8Array(steps);
  for (let n = 0; n < steps; n++) {
    data[n] = Math.round(90 + (165 * n) / (steps - 1));
  }
  const texture = new DataTexture(data, steps, 1, RedFormat);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
