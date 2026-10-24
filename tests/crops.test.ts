import { describe, expect, it } from 'vitest';
import { CROPS, CROP_ORDER, RARITIES } from '../src/core/crops';
import { Farm } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';

const MIN = 60_000;
const profitPerMinute = (id: (typeof CROP_ORDER)[number]): number => {
  const c = CROPS[id];
  return (c.sellPrice - c.seedCost) / (c.growthMs / MIN);
};

describe('crop economy', () => {
  it('pays more per tile-minute the later a crop unlocks', () => {
    const sorted = [...CROP_ORDER].sort((a, b) => CROPS[a].unlockLevel - CROPS[b].unlockLevel);
    // Same-level crops (cenoura, trigo) may tie; every later unlock must beat the best earlier one.
    let best = 0;
    for (const id of sorted) {
      const p = profitPerMinute(id);
      if (CROPS[id].unlockLevel > 1) expect(p, id).toBeGreaterThan(best);
      best = Math.max(best, p);
    }
  });

  it('keeps rare and epic seeds expensive and unlocked late', () => {
    for (const id of CROP_ORDER) {
      const c = CROPS[id];
      if (c.rarity === 'rara') expect(c.unlockLevel).toBeGreaterThanOrEqual(15);
      if (c.rarity === 'rara' || c.rarity === 'epica') expect(c.seedCost).toBeGreaterThanOrEqual(1000);
    }
    expect(CROPS.pitaya.rarity).toBe('rara');
    expect(CROPS.pitaya.unlockLevel).toBe(15);
  });

  it('lets a rare crop beat the best ordinary crop unlocked before it by about its premium', () => {
    const ordinary = Math.max(...CROP_ORDER.filter((id) => CROPS[id].unlockLevel < 15).map(profitPerMinute));
    expect(profitPerMinute('pitaya')).toBeGreaterThan(ordinary * 1.2);
  });

  it('defines a premium and a truck weight for every rarity, rarer = lower weight', () => {
    expect(RARITIES.comum.truckWeight).toBeGreaterThan(RARITIES.incomum.truckWeight);
    expect(RARITIES.incomum.truckWeight).toBeGreaterThan(RARITIES.rara.truckWeight);
    expect(RARITIES.rara.truckWeight).toBeGreaterThan(RARITIES.epica.truckWeight);
  });
});

describe('golden harvest', () => {
  function harvestAll(cropId: 'cenoura' | 'pitaya', count: number, seed: number) {
    const farm = new Farm({ seed, pestChance: 0 });
    farm.xp = levelThreshold(30);
    farm.landSize = 10;
    let golden = 0;
    let total = 0;
    for (let n = 0; n < count; n++) {
      const i = 7 + (n % 10);
      const j = 7 + Math.floor(n / 10);
      farm.seeds[cropId] += 1;
      farm.plow(i, j);
      farm.plant(i, j, cropId, 0);
      farm.water(i, j, 0);
      const r = farm.harvest(i, j, CROPS[cropId].growthMs + 1);
      if (r.ok && r.gain.item) {
        total += r.gain.item.qty;
        if (r.gain.item.golden) golden++;
      }
    }
    return { golden, total, produce: farm.produce[cropId] };
  }

  it('never happens for common crops', () => {
    expect(harvestAll('cenoura', 100, 1).golden).toBe(0);
  });

  it('happens for rare crops about one time in ten, doubling the yield', () => {
    const { golden, total, produce } = harvestAll('pitaya', 100, 9);
    expect(golden).toBeGreaterThan(2);
    expect(golden).toBeLessThan(25);
    expect(total).toBe(100 + golden);
    expect(produce).toBe(total);
  });

  it('is deterministic for a given farm seed', () => {
    expect(harvestAll('pitaya', 100, 9)).toEqual(harvestAll('pitaya', 100, 9));
  });
});
