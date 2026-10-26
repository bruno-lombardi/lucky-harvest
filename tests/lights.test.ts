import { describe, expect, it } from 'vitest';
import { applyCommand, replay, LoggedCommand } from '../src/core/commands';
import { DECOR_UNLOCK_LEVEL } from '../src/core/decor';
import { Farm, FarmSnapshot } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { LIGHT_COLORS, LIGHT_COLOR_ORDER, normalizeLightColors, normalizeLights } from '../src/core/lights';

const farmAt = (level: number, coins = 100_000): Farm => {
  const farm = new Farm({ seed: 1 });
  farm.xp = levelThreshold(level);
  farm.coins = coins;
  return farm;
};

describe('the free lights', () => {
  it('start on, amber, for everyone, even a brand new player', () => {
    const farm = new Farm({ seed: 1 });
    expect(farm.level).toBe(1);
    expect(farm.lights).toEqual({ on: true, color: 'ambar' });
    expect(farm.lightColors).toEqual({});
  });

  it('can be switched off and on at any level, for free', () => {
    const farm = new Farm({ seed: 1 });
    const coins = farm.coins;
    expect(farm.setLights({ on: false }).ok).toBe(true);
    expect(farm.lights.on).toBe(false);
    expect(farm.setLights({ on: true }).ok).toBe(true);
    expect(farm.lights.on).toBe(true);
    expect(farm.coins).toBe(coins);
  });

  it('refuse an empty or malformed request', () => {
    const farm = new Farm({ seed: 1 });
    expect(farm.setLights({})).toEqual({ ok: false, reason: 'bad-qty' });
    expect(farm.setLights({ on: 'yes' as never })).toEqual({ ok: false, reason: 'bad-qty' });
  });

  it('amber is the only free colour; the others cost coins', () => {
    expect(LIGHT_COLORS.ambar.cost).toBe(0);
    for (const id of LIGHT_COLOR_ORDER.filter((c) => c !== 'ambar')) expect(LIGHT_COLORS[id].cost).toBeGreaterThan(0);
  });
});

describe('buying colours', () => {
  it('unlocks at the decoration level', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL - 1);
    expect(farm.buyLightColor('rosa')).toEqual({ ok: false, reason: 'decor-locked' });
    expect(farm.coins).toBe(100_000);
  });

  it('needs the coins, then spends them and starts using the colour', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL, 299);
    expect(farm.buyLightColor('rosa')).toEqual({ ok: false, reason: 'no-coins' });
    farm.coins = 300;
    const result = farm.buyLightColor('rosa');
    expect(result.ok && result.gain.coins).toBe(-300);
    expect(farm.coins).toBe(0);
    expect(farm.lights).toEqual({ on: true, color: 'rosa' });
    expect(farm.lightColors).toEqual({ rosa: true });
  });

  it('turns the lights on if they were off, so the purchase is seen', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL);
    farm.setLights({ on: false });
    farm.buyLightColor('azul');
    expect(farm.lights).toEqual({ on: true, color: 'azul' });
  });

  it('cannot be bought twice, and amber cannot be bought at all', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL);
    farm.buyLightColor('verde');
    expect(farm.buyLightColor('verde')).toEqual({ ok: false, reason: 'max-level' });
    expect(farm.buyLightColor('ambar')).toEqual({ ok: false, reason: 'max-level' });
  });

  it('rejects unknown colours from a command log', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL);
    expect(farm.buyLightColor('neon' as never)).toEqual({ ok: false, reason: 'no-light-color' });
    expect(farm.setLights({ color: 'neon' as never })).toEqual({ ok: false, reason: 'no-light-color' });
  });
});

describe('picking a colour', () => {
  it('only among those owned, and any time after (also back to amber)', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL);
    expect(farm.setLights({ color: 'roxo' })).toEqual({ ok: false, reason: 'no-light-color' });
    farm.buyLightColor('roxo');
    farm.buyLightColor('festa');
    expect(farm.lights.color).toBe('festa');
    expect(farm.setLights({ color: 'ambar' }).ok).toBe(true);
    expect(farm.setLights({ color: 'roxo' }).ok).toBe(true);
    expect(farm.lights.color).toBe('roxo');
  });

  it('keeps the colour when only the switch changes, and the switch when only the colour changes', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL);
    farm.buyLightColor('azul');
    farm.setLights({ on: false });
    expect(farm.lights).toEqual({ on: false, color: 'azul' });
    farm.setLights({ color: 'ambar' });
    expect(farm.lights).toEqual({ on: false, color: 'ambar' });
  });
});

describe('saving', () => {
  it('round-trips the settings and the colours bought', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL);
    farm.buyLightColor('rosa');
    farm.buyLightColor('festa');
    farm.setLights({ on: false, color: 'rosa' });
    const back = Farm.fromSnapshot(farm.toSnapshot());
    expect(back.lights).toEqual({ on: false, color: 'rosa' });
    expect(back.lightColors).toEqual({ rosa: true, festa: true });
  });

  it('loads saves from before the lights as on and amber', () => {
    const farm = farmAt(DECOR_UNLOCK_LEVEL);
    const old = farm.toSnapshot() as Partial<FarmSnapshot>;
    delete old.lights;
    delete old.lightColors;
    const back = Farm.fromSnapshot(old as FarmSnapshot);
    expect(back.lights).toEqual({ on: true, color: 'ambar' });
  });

  it('does not let a hand-edited save use a colour that was never bought', () => {
    expect(normalizeLights({ on: false, color: 'festa' }, {})).toEqual({ on: false, color: 'ambar' });
    expect(normalizeLights({ on: false, color: 'festa' }, { festa: true })).toEqual({ on: false, color: 'festa' });
    expect(normalizeLights({ on: 'x', color: 7 }, {})).toEqual({ on: true, color: 'ambar' });
    expect(normalizeLights(undefined, {})).toEqual({ on: true, color: 'ambar' });
    expect(normalizeLightColors({ rosa: true, ambar: true, neon: true, azul: 'sim' })).toEqual({ rosa: true });
  });
});

describe('commands and replay', () => {
  it('go through applyCommand and replay to the same farm', () => {
    const log: LoggedCommand[] = [
      { now: 0, command: { type: 'buyLightColor', color: 'verde' } },
      { now: 1, command: { type: 'setLights', on: false } },
      { now: 2, command: { type: 'buyLightColor', color: 'festa' } },
      { now: 3, command: { type: 'setLights', color: 'verde' } },
    ];
    const make = (): Farm => farmAt(DECOR_UNLOCK_LEVEL);
    const a = make();
    const b = make();
    replay(a, log);
    replay(b, log);
    expect(JSON.stringify(a.toSnapshot())).toBe(JSON.stringify(b.toSnapshot()));
    expect(a.lights).toEqual({ on: true, color: 'verde' });
    expect(applyCommand(a, { type: 'setLights', on: false }, 9).ok).toBe(true);
  });
});
