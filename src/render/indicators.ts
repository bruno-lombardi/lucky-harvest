import { AdditiveBlending, CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

/**
 * Billboard icons floating above crops: a gold coin when ripe, a water drop when thirsty.
 * Drawn once onto small canvases, so they always face the camera and stay crisp.
 * (Without a DOM, e.g. in unit tests, they fall back to plain coloured sprites.)
 */

function paint(draw: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(size / 2, size / 2);
  draw(ctx, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function star(ctx: CanvasRenderingContext2D, outer: number, inner: number): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

const coinTexture = (): CanvasTexture | null =>
  paint((ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fillStyle = '#5e3600';
    ctx.fill();

    const body = ctx.createRadialGradient(-16, -22, 4, 0, 0, 56);
    body.addColorStop(0, '#fff6b8');
    body.addColorStop(0.5, '#ffd23a');
    body.addColorStop(1, '#e8990c');
    ctx.beginPath();
    ctx.arc(0, 0, 51, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.strokeStyle = '#c98300';
    ctx.lineWidth = 5;
    ctx.stroke();

    star(ctx, 23, 10);
    ctx.fillStyle = '#fff3a8';
    ctx.strokeStyle = '#c98300';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 44, Math.PI * 1.1, Math.PI * 1.45);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
  });

const dropTexture = (): CanvasTexture | null =>
  paint((ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.bezierCurveTo(8, -34, 40, -10, 40, 16);
    ctx.arc(0, 16, 40, 0, Math.PI, false);
    ctx.bezierCurveTo(-40, -10, -8, -34, 0, -58);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0c3a86';
    ctx.lineWidth = 9;
    ctx.stroke();
    const fill = ctx.createLinearGradient(0, -58, 0, 56);
    fill.addColorStop(0, '#a6e8ff');
    fill.addColorStop(0.55, '#38a3ff');
    fill.addColorStop(1, '#1c6fd6');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-15, 14, 7, 15, 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  });

const pestTexture = (): CanvasTexture | null =>
  paint((ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#5a130c';
    ctx.fill();
    const body = ctx.createRadialGradient(-14, -20, 4, 0, 0, 50);
    body.addColorStop(0, '#ff9a86');
    body.addColorStop(0.55, '#ee4630');
    body.addColorStop(1, '#c42a18');
    ctx.beginPath();
    ctx.arc(0, 0, 47, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#5a130c';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, -34);
    ctx.lineTo(9, -34);
    ctx.lineTo(6, 8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 26, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

/** Round badge used for animal needs: dark rim, pale face, then the icon drawn by `icon`. */
const badge = (rim: string, icon: (ctx: CanvasRenderingContext2D) => void): CanvasTexture | null =>
  paint((ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fillStyle = rim;
    ctx.fill();
    const face = ctx.createRadialGradient(-14, -18, 4, 0, 0, 48);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(1, '#f1e6c6');
    ctx.beginPath();
    ctx.arc(0, 0, 47, 0, Math.PI * 2);
    ctx.fillStyle = face;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    icon(ctx);
  });

const ink = '#4a2b0f';

function eggIcon(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(22, -34, 30, 6, 28, 16);
  ctx.bezierCurveTo(26, 34, -26, 34, -28, 16);
  ctx.bezierCurveTo(-30, 6, -22, -34, 0, -34);
  ctx.fillStyle = '#fff8ea';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-10, -8, 5, 10, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

function milkIcon(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-10, -36);
  ctx.lineTo(10, -36);
  ctx.lineTo(10, -22);
  ctx.lineTo(22, -6);
  ctx.lineTo(22, 30);
  ctx.quadraticCurveTo(22, 36, 16, 36);
  ctx.lineTo(-16, 36);
  ctx.quadraticCurveTo(-22, 36, -22, 30);
  ctx.lineTo(-22, -6);
  ctx.lineTo(-10, -22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6fb6ea';
  ctx.fillRect(-18, 2, 36, 18);
  ctx.fillStyle = '#e5372b';
  ctx.fillRect(-11, -38, 22, 8);
}

function truffleIcon(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-26, 10);
  ctx.bezierCurveTo(-34, -14, -8, -34, 8, -28);
  ctx.bezierCurveTo(30, -26, 36, 4, 26, 20);
  ctx.bezierCurveTo(14, 34, -18, 34, -26, 10);
  ctx.fillStyle = '#5b4030';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a6a50';
  for (const [x, y] of [[-8, -10], [10, -4], [-4, 12], [14, 14], [-16, 4]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bowlIcon(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#e6a23c';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  for (const [x, y] of [[-12, -4], [2, -14], [14, -2], [-2, 0]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-32, 6);
  ctx.lineTo(32, 6);
  ctx.quadraticCurveTo(28, 34, 0, 34);
  ctx.quadraticCurveTo(-28, 34, -32, 6);
  ctx.closePath();
  ctx.fillStyle = '#c0623a';
  ctx.fill();
  ctx.stroke();
}

function unpaidIcon(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#ffc928';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 2, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 2, 15, 0, Math.PI * 2);
  ctx.strokeStyle = '#c98300';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#e23c28';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-30, -26);
  ctx.lineTo(30, 30);
  ctx.stroke();
}

const productDraw: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  ovo: eggIcon,
  leite: milkIcon,
  trufa: truffleIcon,
};

const glowTexture = (): CanvasTexture | null =>
  paint((ctx) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 62);
    g.addColorStop(0, 'rgba(255,236,120,0.9)');
    g.addColorStop(0.45, 'rgba(255,214,70,0.35)');
    g.addColorStop(1, 'rgba(255,200,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-64, -64, 128, 128);
  });

let coinMaterial: SpriteMaterial | null = null;
let dropMaterial: SpriteMaterial | null = null;
let glowMaterial: SpriteMaterial | null = null;
let pestMaterial: SpriteMaterial | null = null;

function material(
  cache: SpriteMaterial | null,
  texture: () => CanvasTexture | null,
  fallbackColor: number,
  additive = false,
): SpriteMaterial {
  if (cache) return cache;
  const map = texture();
  return new SpriteMaterial({
    ...(map ? { map } : {}),
    color: map ? 0xffffff : fallbackColor,
    transparent: true,
    depthWrite: false,
    ...(additive ? { blending: AdditiveBlending } : {}),
  });
}

/** A gold coin with a soft glow behind it. userData.kind = 'coin'. */
export function createCoinIndicator(): Group {
  coinMaterial = material(coinMaterial, coinTexture, 0xffc928);
  glowMaterial = material(glowMaterial, glowTexture, 0xffe066, true);

  const group = new Group();
  const glow = new Sprite(glowMaterial);
  glow.scale.set(0.85, 0.85, 1);
  glow.renderOrder = 10;
  const coin = new Sprite(coinMaterial);
  coin.scale.set(0.38, 0.38, 1);
  coin.renderOrder = 11;
  group.add(glow, coin);
  group.userData['kind'] = 'coin';
  return group;
}

/** A water drop. userData.kind = 'drop'. */
export function createDropIndicator(): Group {
  dropMaterial = material(dropMaterial, dropTexture, 0x3aa0ff);
  const group = new Group();
  const drop = new Sprite(dropMaterial);
  drop.scale.set(0.33, 0.33, 1);
  drop.renderOrder = 11;
  group.add(drop);
  group.userData['kind'] = 'drop';
  return group;
}

/** A red alert bubble for weeds and bugs. userData.kind = 'pest'. */
export function createPestIndicator(): Group {
  pestMaterial = material(pestMaterial, pestTexture, 0xe23c28);
  const group = new Group();
  const bubble = new Sprite(pestMaterial);
  bubble.scale.set(0.32, 0.32, 1);
  bubble.renderOrder = 11;
  group.add(bubble);
  group.userData['kind'] = 'pest';
  return group;
}

const bubbleMaterials = new Map<string, SpriteMaterial>();

function bubbleSprite(key: string, rim: string, icon: (ctx: CanvasRenderingContext2D) => void, size: number): Sprite {
  let material = bubbleMaterials.get(key);
  if (!material) {
    const map = badge(rim, icon);
    material = new SpriteMaterial({ ...(map ? { map } : {}), color: map ? 0xffffff : 0xffffff, transparent: true, depthWrite: false });
    bubbleMaterials.set(key, material);
  }
  const sprite = new Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 11;
  return sprite;
}

/** A bowl bubble over a hungry animal. userData.kind = 'hungry'. */
export function createHungryIndicator(): Group {
  const group = new Group();
  group.add(bubbleSprite('hungry', '#a64b1e', bowlIcon, 0.42));
  group.userData['kind'] = 'hungry';
  return group;
}

/** The finished product (egg, milk, truffle) in a glowing bubble. userData.kind = 'product'. */
export function createProductIndicator(product: string): Group {
  glowMaterial = material(glowMaterial, glowTexture, 0xffe066, true);
  const group = new Group();
  const glow = new Sprite(glowMaterial);
  glow.scale.set(0.95, 0.95, 1);
  glow.renderOrder = 10;
  group.add(glow, bubbleSprite(`product:${product}`, '#c98300', productDraw[product] ?? eggIcon, 0.44));
  group.userData['kind'] = 'product';
  return group;
}

/** A coin crossed out over a helper whose wage could not be paid. userData.kind = 'unpaid'. */
export function createUnpaidIndicator(): Group {
  const group = new Group();
  group.add(bubbleSprite('unpaid', '#a42a21', unpaidIcon, 0.46));
  group.userData['kind'] = 'unpaid';
  return group;
}
