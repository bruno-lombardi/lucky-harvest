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
