import {
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshToonMaterial,
  OrthographicCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { CROPS, CROP_ORDER, CropId } from '../core/crops';
import { CropKit, buildCropModel } from './crop-models';
import { addHullOutline } from './outline';

const ELEVATION = Math.atan(1 / Math.SQRT2);
const AZIMUTH = Math.PI / 4;

/**
 * Renders each crop's ripe 3D model into a small transparent PNG (as a data URL),
 * so the seed tray shows exactly the same art as the farm instead of emoji.
 */
export function renderCropIcons(
  renderer: WebGLRenderer,
  gradientMap: DataTexture,
  size = 160,
): Record<CropId, string> {
  const kit = new CropKit(gradientMap);
  const scene = new Scene();
  scene.add(new HemisphereLight(0xdaf0ff, 0x8a7a50, 1.35));
  const sun = new DirectionalLight(0xfff3d8, 2.0);
  sun.position.set(4, 8, 5);
  scene.add(sun);

  const half = 0.68;
  const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 60);
  const distance = 20;
  camera.position.set(
    Math.sin(AZIMUTH) * Math.cos(ELEVATION) * distance,
    Math.sin(ELEVATION) * distance + 0.35,
    Math.cos(AZIMUTH) * Math.cos(ELEVATION) * distance,
  );
  camera.lookAt(0, 0.3, 0);

  // A little patch of tilled soil for the plant to stand on.
  const patch = new Mesh(new CylinderGeometry(0.5, 0.56, 0.12, 24), new MeshToonMaterial({ color: 0x7a4a26, gradientMap }));
  patch.position.y = -0.04;
  addHullOutline(patch, 0.02);
  scene.add(patch);

  const target = new WebGLRenderTarget(size, size, { samples: 4 });
  target.texture.colorSpace = SRGBColorSpace;

  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new Color());
  const previousAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);

  const pixels = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const icons = {} as Record<CropId, string>;

  for (const id of CROP_ORDER) {
    const model = buildCropModel(kit, CROPS[id], { stage: 3, thirsty: false, withered: false });
    const holder = new Group();
    holder.position.y = 0.02;
    holder.scale.setScalar(1.15);
    holder.add(model);
    scene.add(holder);

    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    scene.remove(holder);

    if (!ctx) {
      icons[id] = '';
      continue;
    }
    // Rows come back bottom-up, and edge pixels are premultiplied by coverage: fix both.
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const from = ((size - 1 - y) * size + x) * 4;
        const to = (y * size + x) * 4;
        const a = pixels[from + 3]!;
        const k = a > 0 && a < 255 ? 255 / a : 1;
        image.data[to] = Math.min(255, pixels[from]! * k);
        image.data[to + 1] = Math.min(255, pixels[from + 1]! * k);
        image.data[to + 2] = Math.min(255, pixels[from + 2]! * k);
        image.data[to + 3] = a;
      }
    }
    ctx.putImageData(image, 0, 0);
    icons[id] = canvas.toDataURL('image/png');
  }

  renderer.setRenderTarget(previousTarget);
  renderer.setClearColor(previousColor, previousAlpha);
  target.dispose();
  return icons;
}
