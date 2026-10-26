/**
 * @module render/particles
 *
 * A fixed-size pool of camera-facing point sprites (one draw call) for every burst of the game: dirt, splashes, sparkles, confetti.
 * `Effects.burst(kind, ...)` has a recipe per action (`BurstKind`); `Fireflies` is a separate ambient pool that appears at night.
 * Purely cosmetic and not part of the game state.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
} from 'three';
import { mulberry32 } from '../core/noise';

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aShape;
  attribute vec4 aColor;
  uniform float uScale;
  varying vec4 vColor;
  varying float vShape;
  void main() {
    vColor = aColor;
    vShape = aShape;
    gl_PointSize = aSize * uScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec4 vColor;
  varying float vShape;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p);
    float alpha;
    if (vShape < 0.5) {
      alpha = smoothstep(0.5, 0.38, r);                       // crisp round bit
    } else if (vShape < 1.5) {
      float spike = max(1.0 - 14.0 * min(abs(p.x), abs(p.y)), 0.0) * smoothstep(0.5, 0.05, r);
      alpha = clamp(spike + smoothstep(0.22, 0.0, r), 0.0, 1.0); // four-point sparkle
    } else {
      alpha = exp(-r * r * 22.0);                              // soft glow
    }
    if (alpha * vColor.a < 0.01) discard;
    gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
    #include <colorspace_fragment>
  }
`;

export enum Shape {
  Round = 0,
  Sparkle = 1,
  Glow = 2,
}

/** Fixed-size pool of camera-facing point sprites with per-particle size, colour, alpha and shape. */
class PointPool {
  readonly points: Points;
  readonly position: Float32Array;
  readonly size: Float32Array;
  readonly shape: Float32Array;
  readonly color: Float32Array;
  private readonly material: ShaderMaterial;

  constructor(readonly capacity: number, additive: boolean) {
    this.position = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.shape = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 4);
    for (let i = 0; i < capacity; i++) this.position[i * 3 + 1] = -100; // parked below the world

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.position, 3).setUsage(35048));
    geometry.setAttribute('aSize', new BufferAttribute(this.size, 1).setUsage(35048));
    geometry.setAttribute('aShape', new BufferAttribute(this.shape, 1).setUsage(35048));
    geometry.setAttribute('aColor', new BufferAttribute(this.color, 4).setUsage(35048));

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 60 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
  }

  setScale(pixelsPerUnit: number): void {
    this.material.uniforms['uScale']!.value = pixelsPerUnit;
  }

  upload(): void {
    const g = this.points.geometry;
    for (const name of ['position', 'aSize', 'aShape', 'aColor']) g.getAttribute(name).needsUpdate = true;
  }
}

export interface EmitOptions {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Seconds. */
  life: number;
  /** World units; the particle shrinks to `sizeEnd` (default 0) over its life. */
  size: number;
  sizeEnd?: number;
  color: number;
  shape?: Shape;
  /** Downward acceleration in units/s^2 (negative floats upward). */
  gravity?: number;
  /** Velocity kept per second (1 = no drag). */
  drag?: number;
}

/** Short-lived bursts: dirt chips, splashes, sparkles, confetti. */
export class Particles {
  readonly object: Points;
  private readonly pool: PointPool;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly vel: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly rgb: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private cursor = 0;
  private readonly tmp = new Color();
  private readonly rand = mulberry32(4242);

  constructor(capacity = 900) {
    this.pool = new PointPool(capacity, false);
    this.object = this.pool.points;
    this.age = new Float32Array(capacity).fill(1);
    this.life = new Float32Array(capacity).fill(1);
    this.vel = new Float32Array(capacity * 3);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.rgb = new Float32Array(capacity * 3);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
  }

  setScale(pixelsPerUnit: number): void {
    this.pool.setScale(pixelsPerUnit);
  }

  random(): number {
    return this.rand();
  }

  emit(o: EmitOptions): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.pool.capacity;
    this.age[i] = 0;
    this.life[i] = o.life;
    this.pool.position.set([o.x, o.y, o.z], i * 3);
    this.vel.set([o.vx ?? 0, o.vy ?? 0, o.vz ?? 0], i * 3);
    this.size0[i] = o.size;
    this.size1[i] = o.sizeEnd ?? 0;
    this.pool.shape[i] = o.shape ?? Shape.Round;
    this.gravity[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 1;
    this.tmp.setHex(o.color);
    this.rgb.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
  }

  update(dt: number): void {
    const { position, size, color } = this.pool;
    for (let i = 0; i < this.pool.capacity; i++) {
      if (this.age[i]! >= this.life[i]!) {
        size[i] = 0;
        continue;
      }
      this.age[i] = this.age[i]! + dt;
      const t = Math.min(1, this.age[i]! / this.life[i]!);
      const i3 = i * 3;
      const keep = Math.pow(this.drag[i]!, dt);
      this.vel[i3] = this.vel[i3]! * keep;
      this.vel[i3 + 1] = this.vel[i3 + 1]! * keep - this.gravity[i]! * dt;
      this.vel[i3 + 2] = this.vel[i3 + 2]! * keep;
      position[i3] = position[i3]! + this.vel[i3]! * dt;
      position[i3 + 1] = Math.max(0.04, position[i3 + 1]! + this.vel[i3 + 1]! * dt);
      position[i3 + 2] = position[i3 + 2]! + this.vel[i3 + 2]! * dt;
      size[i] = this.size0[i]! + (this.size1[i]! - this.size0[i]!) * t;
      color[i * 4] = this.rgb[i3]!;
      color[i * 4 + 1] = this.rgb[i3 + 1]!;
      color[i * 4 + 2] = this.rgb[i3 + 2]!;
      color[i * 4 + 3] = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; // fade out over the last 30%
    }
    this.pool.upload();
  }
}

/** Drifting, blinking fireflies that appear after dark around the farm. */
export class Fireflies {
  readonly object: Points;
  private readonly pool: PointPool;
  private readonly base: Float32Array;
  private readonly seed: Float32Array;

  constructor(count = 40) {
    this.pool = new PointPool(count, true);
    this.object = this.pool.points;
    const rand = mulberry32(99);
    this.base = new Float32Array(count * 3);
    this.seed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 2.5 + rand() * 9;
      this.base.set([Math.cos(a) * r, 0.4 + rand() * 1.4, Math.sin(a) * r], i * 3);
      this.seed.set([rand() * 6.28, 0.4 + rand() * 0.8, 0.5 + rand()], i * 3);
      this.pool.shape[i] = Shape.Glow;
      this.pool.size[i] = 0.34;
    }
  }

  setScale(pixelsPerUnit: number): void {
    this.pool.setScale(pixelsPerUnit);
  }

  /** `night` is 0 in daylight and 1 at full dark. */
  update(time: number, night: number): void {
    const { position, color } = this.pool;
    const on = Math.max(0, (night - 0.35) / 0.65);
    this.object.visible = on > 0.01;
    if (!this.object.visible) return;
    for (let i = 0; i < this.pool.capacity; i++) {
      const i3 = i * 3;
      const phase = this.seed[i3]!;
      const speed = this.seed[i3 + 1]!;
      position[i3] = this.base[i3]! + Math.sin(time * 0.5 * speed + phase) * 0.9;
      position[i3 + 1] = this.base[i3 + 1]! + Math.sin(time * 0.9 * speed + phase * 2) * 0.25;
      position[i3 + 2] = this.base[i3 + 2]! + Math.cos(time * 0.4 * speed + phase) * 0.9;
      const blink = Math.pow(0.5 + 0.5 * Math.sin(time * this.seed[i3 + 2]! * 2.2 + phase * 3), 2.5);
      color[i * 4] = 1.0;
      color[i * 4 + 1] = 0.92;
      color[i * 4 + 2] = 0.35;
      color[i * 4 + 3] = (0.15 + 0.85 * blink) * on;
    }
    this.pool.upload();
  }
}

export type BurstKind = 'plow' | 'plant' | 'water' | 'care' | 'fertilize' | 'harvest' | 'levelup' | 'expand' | 'clear';

/** Ready-made bursts for every farm action. Positions are world coordinates on the ground. */
export class Effects {
  constructor(private readonly p: Particles) {}

  burst(kind: BurstKind, x: number, z: number): void {
    switch (kind) {
      case 'plow':
        return this.plow(x, z);
      case 'plant':
        return this.plant(x, z);
      case 'water':
        return this.water(x, z);
      case 'care':
        return this.care(x, z);
      case 'fertilize':
        return this.fertilize(x, z);
      case 'harvest':
        return this.harvest(x, z);
      case 'levelup':
        return this.levelUp(x, z);
      case 'expand':
        return this.expand(x, z);
      case 'clear':
        return this.dust(x, z, 8, 0xc9b48a);
    }
  }

  private spread(): number {
    return this.p.random() * 2 - 1;
  }

  private dust(x: number, z: number, count: number, color: number): void {
    const { p } = this;
    for (let n = 0; n < count; n++) {
      const a = p.random() * Math.PI * 2;
      const speed = 0.4 + p.random() * 0.7;
      p.emit({
        x: x + Math.cos(a) * 0.2,
        y: 0.14,
        z: z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * speed,
        vy: 0.3 + p.random() * 0.5,
        vz: Math.sin(a) * speed,
        life: 0.55 + p.random() * 0.3,
        size: 0.26,
        sizeEnd: 0.5,
        color,
        shape: Shape.Glow,
        drag: 0.04,
        gravity: -0.4,
      });
    }
  }

  private plow(x: number, z: number): void {
    const { p } = this;
    this.dust(x, z, 6, 0xb08a5a);
    for (let n = 0; n < 12; n++) {
      p.emit({
        x,
        y: 0.15,
        z,
        vx: this.spread() * 1.5,
        vy: 2 + p.random() * 1.8,
        vz: this.spread() * 1.5,
        life: 0.6,
        size: 0.1 + p.random() * 0.06,
        sizeEnd: 0.07,
        color: [0x6b4423, 0x7a4a26, 0x8f5c31][n % 3]!,
        gravity: 11,
      });
    }
  }

  private plant(x: number, z: number): void {
    const { p } = this;
    this.dust(x, z, 4, 0x9a7448);
    for (let n = 0; n < 6; n++) {
      p.emit({
        x,
        y: 0.25,
        z,
        vx: this.spread() * 0.8,
        vy: 1.2 + p.random() * 1.2,
        vz: this.spread() * 0.8,
        life: 0.8,
        size: 0.2,
        sizeEnd: 0.05,
        color: n % 2 ? 0x9be860 : 0xeaffc4,
        shape: Shape.Sparkle,
        gravity: 3,
      });
    }
  }

  private water(x: number, z: number): void {
    const { p } = this;
    for (let n = 0; n < 16; n++) {
      p.emit({
        x: x + this.spread() * 0.35,
        y: 1.1 + p.random() * 0.5,
        z: z + this.spread() * 0.35,
        vx: this.spread() * 0.3,
        vy: -0.5,
        vz: this.spread() * 0.3,
        life: 0.5,
        size: 0.13,
        sizeEnd: 0.1,
        color: n % 3 === 0 ? 0xe8f8ff : 0x4aa8ee,
        gravity: 9,
      });
    }
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * Math.PI * 2;
      p.emit({
        x,
        y: 0.14,
        z,
        vx: Math.cos(a) * 1.1,
        vy: 1.2,
        vz: Math.sin(a) * 1.1,
        life: 0.45,
        size: 0.1,
        sizeEnd: 0.04,
        color: 0xbfe8ff,
        gravity: 8,
      });
    }
  }

  private care(x: number, z: number): void {
    const { p } = this;
    this.dust(x, z, 5, 0xdff7c8);
    for (let n = 0; n < 12; n++) {
      p.emit({
        x: x + this.spread() * 0.3,
        y: 0.3,
        z: z + this.spread() * 0.3,
        vx: this.spread() * 0.7,
        vy: 1.1 + p.random() * 1.3,
        vz: this.spread() * 0.7,
        life: 0.9,
        size: 0.24,
        sizeEnd: 0.04,
        color: n % 2 ? 0xfff6a8 : 0xbaf27a,
        shape: Shape.Sparkle,
        gravity: -0.2,
      });
    }
  }

  /** Grain pattering onto the soil, then green sparkles drifting up as the plant jumps ahead. */
  private fertilize(x: number, z: number): void {
    const { p } = this;
    for (let n = 0; n < 10; n++) {
      p.emit({
        x: x + this.spread() * 0.25,
        y: 0.9 + p.random() * 0.4,
        z: z + this.spread() * 0.25,
        vx: this.spread() * 0.4,
        vy: 0,
        vz: this.spread() * 0.4,
        life: 0.5,
        size: 0.09 + p.random() * 0.04,
        sizeEnd: 0.07,
        color: [0x6b4423, 0x7a4a26, 0x5e7d2b][n % 3]!,
        gravity: 9,
      });
    }
    for (let n = 0; n < 14; n++) {
      p.emit({
        x: x + this.spread() * 0.35,
        y: 0.25,
        z: z + this.spread() * 0.35,
        vx: this.spread() * 0.5,
        vy: 1.2 + p.random() * 1.6,
        vz: this.spread() * 0.5,
        life: 1,
        size: 0.26,
        sizeEnd: 0.04,
        color: n % 3 === 0 ? 0xfff6a8 : n % 3 === 1 ? 0x9be860 : 0xeaffc4,
        shape: Shape.Sparkle,
        gravity: -0.3,
      });
    }
  }

  private harvest(x: number, z: number): void {
    const { p } = this;
    for (let n = 0; n < 16; n++) {
      p.emit({
        x,
        y: 0.5,
        z,
        vx: this.spread() * 1.4,
        vy: 2.4 + p.random() * 2,
        vz: this.spread() * 1.4,
        life: 0.95,
        size: 0.3,
        sizeEnd: 0.06,
        color: n % 3 === 0 ? 0xfff3a8 : 0xffcf33,
        shape: Shape.Sparkle,
        gravity: 7,
      });
    }
    for (let n = 0; n < 8; n++) {
      p.emit({
        x,
        y: 0.4,
        z,
        vx: this.spread() * 1.6,
        vy: 1.8 + p.random() * 1.4,
        vz: this.spread() * 1.6,
        life: 0.8,
        size: 0.14,
        sizeEnd: 0.1,
        color: n % 2 ? 0x5cbc3f : 0x8fe05a,
        gravity: 6,
      });
    }
  }

  private levelUp(x: number, z: number): void {
    const { p } = this;
    const palette = [0xff5a4a, 0xffd23a, 0x5cd05a, 0x4aa8ee, 0xc86bff, 0xffffff];
    for (let n = 0; n < 60; n++) {
      const a = p.random() * Math.PI * 2;
      const out = 1 + p.random() * 2.6;
      p.emit({
        x,
        y: 0.8,
        z,
        vx: Math.cos(a) * out,
        vy: 3.5 + p.random() * 3.5,
        vz: Math.sin(a) * out,
        life: 1.5 + p.random() * 0.5,
        size: 0.17,
        sizeEnd: 0.14,
        color: palette[n % palette.length]!,
        shape: n % 3 === 0 ? Shape.Sparkle : Shape.Round,
        gravity: 6.5,
        drag: 0.5,
      });
    }
  }

  private expand(x: number, z: number): void {
    const { p } = this;
    for (let n = 0; n < 64; n++) {
      const a = (n / 64) * Math.PI * 2;
      const radius = 2.5 + p.random() * 4;
      p.emit({
        x: x + Math.cos(a) * radius * 0.4,
        y: 0.2,
        z: z + Math.sin(a) * radius * 0.4,
        vx: Math.cos(a) * 1.6,
        vy: 0.6 + p.random() * 0.8,
        vz: Math.sin(a) * 1.6,
        life: 1.1,
        size: 0.4,
        sizeEnd: 0.9,
        color: n % 4 === 0 ? 0xfff3a8 : 0xe8f6d4,
        shape: n % 4 === 0 ? Shape.Sparkle : Shape.Glow,
        drag: 0.3,
        gravity: -0.5,
      });
    }
  }
}
