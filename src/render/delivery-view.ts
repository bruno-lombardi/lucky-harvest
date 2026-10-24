import { DataTexture, Group, MathUtils } from 'three';
import { DELIVERY_INTERVAL_MS, slotOf, slotTime } from '../core/delivery';
import { ROAD_RING } from './countryside';
import { BARN } from './props';
import { WHEEL_RADIUS, buildTruck } from './truck';

/** Where the truck pulls up (beside the barn, on the road) and what it does there, in seconds. */
export const TRUCK_STOP = { x: -ROAD_RING, z: BARN.z + 1.1 };
const STOP_S = 4.6;
const TOP_SPEED = 5;
const BRAKE_S = 1;
/** Distance the truck covers on its way in and out of the picture. */
const APPROACH = 58;
const SACK_FIRST_S = 0.5;
const SACK_GAP_S = 0.46;
const SACK_FLIGHT_S = 0.9;

/** How far the truck is from its stop after `s` seconds of braking (reversed) or pulling away. */
function travelled(s: number): number {
  if (s <= 0) return 0;
  if (s < BRAKE_S) return ((TOP_SPEED / BRAKE_S) * s * s) / 2;
  return (TOP_SPEED * BRAKE_S) / 2 + TOP_SPEED * (s - BRAKE_S);
}

const WINDOW_S = BRAKE_S + (APPROACH - (TOP_SPEED * BRAKE_S) / 2) / TOP_SPEED;

export type TruckCue = 'honk' | 'unload';

/** Seconds from the nearest delivery slot (negative = still on its way). */
export function truckClock(now: number, interval = DELIVERY_INTERVAL_MS): { slot: number; t: number } {
  const slot = Math.round(now / interval);
  return { slot, t: (now - slot * interval) / 1000 };
}

/**
 * The seed truck. Its position is a pure function of the wall clock: it reaches the barn exactly when the
 * delivery lands in the farm, so reloading mid-trip, or opening the game on another device, shows the same scene.
 */
export class DeliveryView {
  readonly group = new Group();
  onCue: (cue: TruckCue) => void = () => {};
  /** Kicks up a puff of dust at a world position. */
  onDust: (x: number, z: number) => void = () => {};

  private readonly truck: ReturnType<typeof buildTruck>;
  private honkedFor = -1;
  private dustedFor = -1;
  private departedFor = -1;

  constructor(gradientMap: DataTexture) {
    this.truck = buildTruck(gradientMap);
    this.group.add(this.truck.group);
    this.truck.group.visible = false;
  }

  /** Seconds until the next truck pulls up (for hints). */
  static secondsToNext(now: number, interval = DELIVERY_INTERVAL_MS): number {
    const next = slotTime(slotOf(now, interval) + 1, interval);
    return Math.max(0, (next - now) / 1000);
  }

  update(now: number, interval = DELIVERY_INTERVAL_MS): void {
    const { slot, t } = truckClock(now, interval);
    const { truck } = this;
    const visible = t > -WINDOW_S && t < STOP_S + WINDOW_S;
    truck.group.visible = visible;
    if (!visible) return;

    let z: number;
    let pitch = 0;
    if (t < 0) {
      z = TRUCK_STOP.z - travelled(-t);
      if (-t < BRAKE_S) pitch = 0.04 * (1 - -t / BRAKE_S); // nose dips as it brakes
    } else if (t <= STOP_S) {
      z = TRUCK_STOP.z;
    } else {
      z = TRUCK_STOP.z + travelled(t - STOP_S);
      if (t - STOP_S < BRAKE_S) pitch = -0.03 * (1 - (t - STOP_S) / BRAKE_S); // and lifts as it pulls away
    }
    const moving = t < 0 || t > STOP_S;
    truck.group.position.set(TRUCK_STOP.x, 0, z);
    truck.body.rotation.x = pitch;
    truck.body.position.y = moving ? Math.sin(now / 55) * 0.012 : Math.sin(now / 90) * 0.004;
    for (const wheel of truck.wheels) wheel.rotation.x = z / WHEEL_RADIUS;

    // Tailgate drops while unloading.
    const open = MathUtils.clamp(Math.min(t - 0.1, STOP_S - 0.2 - t) / 0.35, 0, 1);
    truck.tailgate.rotation.x = -open * 1.45;

    // Sacks hop over the barn roof, one after another.
    truck.sacks.forEach((sack, n) => {
      const start = SACK_FIRST_S + n * SACK_GAP_S;
      const p = (t - start) / SACK_FLIGHT_S;
      const home = truck.sackHome[n]!;
      if (p <= 0) {
        sack.visible = true;
        sack.position.set(home.x, home.y, home.z);
        sack.scale.setScalar(1);
        sack.rotation.set(0, (n % 2 === 0 ? 1 : -1) * 0.12, 0);
        return;
      }
      if (p >= 1) {
        // Gone into the loft until the next truck: the bed stays empty on the way out.
        sack.visible = false;
        return;
      }
      sack.visible = true;
      // Straight line in the truck's frame, plus a parabola for the lob.
      const targetX = BARN.x - truck.group.position.x;
      const targetZ = BARN.z - truck.group.position.z;
      const targetY = 2.5;
      const x = MathUtils.lerp(home.x, targetX, p);
      const zz = MathUtils.lerp(home.z, targetZ, p);
      const y = MathUtils.lerp(home.y, targetY, p) + Math.sin(p * Math.PI) * 2.0;
      sack.position.set(x, y, zz);
      sack.rotation.set(p * 4.5, (n % 2 === 0 ? 1 : -1) * p * 3, 0);
      sack.scale.setScalar(p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1);
    });

    // Cues: a honk as it comes round the bend, and puffs of dust when it brakes and sets off.
    if (t > -3.6 && t < 0 && this.honkedFor !== slot) {
      this.honkedFor = slot;
      this.onCue('honk');
    }
    if (t > -0.4 && t < 1 && this.dustedFor !== slot) {
      this.dustedFor = slot;
      this.onDust(truck.group.position.x, truck.group.position.z - 1.3);
      this.onCue('unload');
    }
    if (t > STOP_S && t < STOP_S + 1 && this.departedFor !== slot) {
      this.departedFor = slot;
      this.onDust(truck.group.position.x, truck.group.position.z - 1.3);
    }
  }
}
