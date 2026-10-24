import { Color, MathUtils } from 'three';

/** Everything the time of day changes. Colours are hex so keyframes read like a palette. */
interface Keyframe {
  hour: number;
  skyTop: number;
  skyMid: number;
  skyBottom: number;
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  waterDeep: number;
  waterShallow: number;
  /** Multiplies cloud colours. */
  cloud: number;
  /** 0 in daylight, 1 in the dead of night: drives lit windows and fireflies. */
  night: number;
}

const KEYFRAMES: readonly Keyframe[] = [
  { hour: 0, skyTop: 0x0a1330, skyMid: 0x18274f, skyBottom: 0x2b3b70, sun: 0x7f9ae0, sunIntensity: 0.55, hemiSky: 0x5f78c0, hemiGround: 0x2a3a66, hemiIntensity: 0.8, waterDeep: 0x10285a, waterShallow: 0x23527f, cloud: 0x55648f, night: 1 },
  { hour: 5, skyTop: 0x16224f, skyMid: 0x3a3f7c, skyBottom: 0x6a5d92, sun: 0x8da6e8, sunIntensity: 0.6, hemiSky: 0x6a82c8, hemiGround: 0x344470, hemiIntensity: 0.85, waterDeep: 0x16336a, waterShallow: 0x2c628f, cloud: 0x6d729f, night: 0.9 },
  { hour: 6.5, skyTop: 0x4f7fd0, skyMid: 0xf29a8a, skyBottom: 0xffd0a0, sun: 0xffa874, sunIntensity: 1.25, hemiSky: 0xd8c4d8, hemiGround: 0x7f9a60, hemiIntensity: 0.95, waterDeep: 0x2a6fb8, waterShallow: 0x6bb8cc, cloud: 0xffcfb8, night: 0.25 },
  { hour: 8.5, skyTop: 0x5db7f2, skyMid: 0xa6dcfb, skyBottom: 0xe4f6ff, sun: 0xfff0d0, sunIntensity: 1.9, hemiSky: 0xdaf0ff, hemiGround: 0x7fae5c, hemiIntensity: 1.12, waterDeep: 0x2a8fd8, waterShallow: 0x5fd4ee, cloud: 0xffffff, night: 0 },
  { hour: 16, skyTop: 0x5db7f2, skyMid: 0xa6dcfb, skyBottom: 0xe4f6ff, sun: 0xfff3d8, sunIntensity: 2.0, hemiSky: 0xdaf0ff, hemiGround: 0x7fae5c, hemiIntensity: 1.15, waterDeep: 0x2a8fd8, waterShallow: 0x5fd4ee, cloud: 0xffffff, night: 0 },
  { hour: 18, skyTop: 0x5a78d6, skyMid: 0xffa27a, skyBottom: 0xffd890, sun: 0xff9a55, sunIntensity: 1.45, hemiSky: 0xf0c8b8, hemiGround: 0x6f8a58, hemiIntensity: 0.95, waterDeep: 0x2f6ec0, waterShallow: 0x7ab4c8, cloud: 0xffc0a0, night: 0.15 },
  { hour: 19.5, skyTop: 0x27327a, skyMid: 0x8a4f86, skyBottom: 0xe2735f, sun: 0xff7a50, sunIntensity: 0.8, hemiSky: 0x9a8ac8, hemiGround: 0x44507a, hemiIntensity: 0.8, waterDeep: 0x1d3f82, waterShallow: 0x44709a, cloud: 0xb0708c, night: 0.65 },
  { hour: 21, skyTop: 0x0f1b45, skyMid: 0x1d2d5c, skyBottom: 0x33447a, sun: 0x7f9ae0, sunIntensity: 0.55, hemiSky: 0x5f78c0, hemiGround: 0x2a3a66, hemiIntensity: 0.8, waterDeep: 0x112c60, waterShallow: 0x25557f, cloud: 0x5a6a95, night: 1 },
  { hour: 24, skyTop: 0x0a1330, skyMid: 0x18274f, skyBottom: 0x2b3b70, sun: 0x7f9ae0, sunIntensity: 0.55, hemiSky: 0x5f78c0, hemiGround: 0x2a3a66, hemiIntensity: 0.8, waterDeep: 0x10285a, waterShallow: 0x23527f, cloud: 0x55648f, night: 1 },
];

const COLOR_KEYS = ['skyTop', 'skyMid', 'skyBottom', 'sun', 'hemiSky', 'hemiGround', 'waterDeep', 'waterShallow', 'cloud'] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

export interface Atmosphere {
  skyTop: Color;
  skyMid: Color;
  skyBottom: Color;
  sun: Color;
  hemiSky: Color;
  hemiGround: Color;
  waterDeep: Color;
  waterShallow: Color;
  cloud: Color;
  sunIntensity: number;
  hemiIntensity: number;
  night: number;
}

export function createAtmosphere(): Atmosphere {
  return {
    skyTop: new Color(),
    skyMid: new Color(),
    skyBottom: new Color(),
    sun: new Color(),
    hemiSky: new Color(),
    hemiGround: new Color(),
    waterDeep: new Color(),
    waterShallow: new Color(),
    cloud: new Color(),
    sunIntensity: 0,
    hemiIntensity: 0,
    night: 0,
  };
}

const scratch = new Color();

/** Blends the keyframes around `hour` (0..24, wraps) into `out`. */
export function atmosphereAt(hour: number, out: Atmosphere = createAtmosphere()): Atmosphere {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYFRAMES.length - 2 && h >= KEYFRAMES[i + 1]!.hour) i++;
  const a = KEYFRAMES[i]!;
  const b = KEYFRAMES[i + 1]!;
  const t = MathUtils.smoothstep(h, a.hour, b.hour);

  for (const key of COLOR_KEYS) {
    out[key as ColorKey].set(a[key]).lerp(scratch.set(b[key]), t);
  }
  out.sunIntensity = MathUtils.lerp(a.sunIntensity, b.sunIntensity, t);
  out.hemiIntensity = MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t);
  out.night = MathUtils.lerp(a.night, b.night, t);
  return out;
}

/** Where the light comes from: the sun arcs over the farm by day, a fixed moon takes over at night. */
export function lightPosition(hour: number, out: { x: number; y: number; z: number }): void {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 20.5) {
    const a = ((h - 5) / 15.5) * Math.PI;
    out.x = 16 - Math.cos(a) * 24;
    out.y = 6 + Math.sin(a) * 20;
    out.z = 10;
  } else {
    out.x = -9;
    out.y = 22;
    out.z = 9;
  }
}

/** The clock: a full day lasts `dayLengthSec` real seconds. */
export class DayNight {
  hour: number;
  frozen: boolean;

  constructor(
    startHour = 9,
    private readonly dayLengthSec = 480,
    frozen = false,
  ) {
    this.hour = startHour;
    this.frozen = frozen;
  }

  update(dt: number): void {
    if (this.frozen) return;
    this.hour = (this.hour + (dt * 24) / this.dayLengthSec) % 24;
  }

  /** "HH:MM" for the HUD. */
  label(): string {
    const total = Math.floor(this.hour * 60);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}
