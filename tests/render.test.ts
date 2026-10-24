import { describe, expect, it } from 'vitest';
import { CROPS, CROP_ORDER } from '../src/core/crops';
import { CropStage, Farm, LAND } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { CropKit, buildCropModel } from '../src/render/crop-models';
import { FarmView } from '../src/render/farm-view';
import { Terrain } from '../src/render/terrain';
import { createToonGradient } from '../src/render/toon';

// three.js builds geometry and scene graphs fine without a GL context, so these
// are cheap smoke tests that catch runtime errors in the procedural models.

const I = LAND.min;
const J = LAND.min;

describe('procedural crop models', () => {
  const kit = new CropKit(createToonGradient());

  it('builds a non-empty model for every crop, stage and condition', () => {
    for (const id of CROP_ORDER) {
      for (const stage of [0, 1, 2, 3] as CropStage[]) {
        for (const [thirsty, withered] of [[false, false], [true, false], [false, true]] as const) {
          const model = buildCropModel(kit, CROPS[id], { stage, thirsty, withered });
          expect(model.children.length, `${id} stage ${stage}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('ripe crops carry more geometry than growing ones', () => {
    const count = (id: (typeof CROP_ORDER)[number], stage: CropStage): number => {
      let meshes = 0;
      buildCropModel(kit, CROPS[id], { stage, thirsty: false, withered: false }).traverse((o) => {
        if ((o as { isMesh?: boolean }).isMesh) meshes++;
      });
      return meshes;
    };
    for (const id of ['cenoura', 'milho', 'tomate', 'morango', 'abobora'] as const) {
      expect(count(id, 3), id).toBeGreaterThan(count(id, 2));
    }
  });
});

describe('terrain', () => {
  it('builds with a locked-land predicate', () => {
    const terrain = new Terrain(24, createToonGradient(), 1337, (i, j) => i > 6 && j > 6);
    expect(terrain.group.children.length).toBeGreaterThan(3);
  });
});

describe('FarmView', () => {
  it('follows the farm through plow, plant, grow, harvest and clear', () => {
    const farm = new Farm();
    const view = new FarmView(farm, 24, createToonGradient());
    const carrot = CROPS.cenoura;
    let now = 0;
    const tick = (): void => view.update(0.016, now);

    tick();
    expect(view.group.children).toHaveLength(0);

    farm.plow(I, J);
    tick();
    expect(view.group.children).toHaveLength(1); // soil only

    farm.plant(I, J, 'cenoura', now);
    tick();
    expect(view.group.children).toHaveLength(2); // soil + crop

    farm.water(I, J, now);
    now = carrot.growthMs;
    tick(); // becomes ripe: model and coin indicator rebuilt without throwing
    tick();
    expect(view.group.children).toHaveLength(2);

    farm.harvest(I, J, now);
    tick();
    expect(view.group.children).toHaveLength(1); // crop gone, soil stays

    farm.clear(I, J);
    tick();
    expect(view.group.children).toHaveLength(0);
  });

  it('handles thirsty and withered crops', () => {
    // Abóbora unlocks at level 8, so start with enough XP and coins.
    const farm = Farm.fromSnapshot({ version: 1, coins: 1000, xp: levelThreshold(8), tiles: {} });
    const view = new FarmView(farm, 24, createToonGradient());
    expect(farm.plow(I, J).ok).toBe(true);
    expect(farm.plant(I, J, 'abobora', 0).ok).toBe(true);

    view.update(0.016, CROPS.abobora.growthMs); // thirsty: droplet indicator
    view.update(0.016, CROPS.abobora.growthMs / 2 + CROPS.abobora.witherMs + 1000); // withered
    expect(view.group.children).toHaveLength(2);
  });
});
