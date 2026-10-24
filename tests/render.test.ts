import { describe, expect, it } from 'vitest';
import { CROPS, CROP_ORDER } from '../src/core/crops';
import { CropStage, Farm, START_LAND, landBounds } from '../src/core/farm';
import { levelThreshold } from '../src/core/levels';
import { CropKit, buildCropModel } from '../src/render/crop-models';
import { FarmView } from '../src/render/farm-view';
import { CharacterKit } from '../src/render/characters';
import { DecorView } from '../src/render/decor-view';
import { Terrain } from '../src/render/terrain';
import { createToonGradient } from '../src/render/toon';

// three.js builds geometry and scene graphs fine without a GL context, so these
// are cheap smoke tests that catch runtime errors in the procedural models.

const I = landBounds(START_LAND).min;
const J = I;

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
    expect(terrain.group.children.length).toBeGreaterThanOrEqual(3);
  });
});

describe('pest visuals', () => {
  it('shows weeds or bugs on infested crops and drops them once cared for', () => {
    for (const pestChance of [1, 0]) {
      // First run: always infested. Second run: never, and must stay clean.
      const farm = new Farm({ seed: 5, pestChance });
      const view = new FarmView(farm, 24, createToonGradient());
      farm.plow(I, J);
      farm.plant(I, J, 'cenoura', 0);
      const crop = farm.tile(I, J).crop!;
      farm.water(I, J, 0);
      const at = crop.pestAt === null ? 1000 : crop.pestAt + 1000;
      view.update(0.016, at);
      const cropGroup = view.group.children[1] as { children: Array<{ userData: Record<string, unknown> }> };
      const pests = cropGroup.children.filter((c) => c.userData['kind'] === 'weeds' || c.userData['kind'] === 'bugs');
      expect(pests).toHaveLength(crop.pestAt === null ? 0 : 1);
      view.update(0.5, at); // animates bugs without throwing

      if (crop.pestAt !== null) {
        expect(farm.care(I, J, at).ok).toBe(true);
        view.update(0.016, at);
        expect(cropGroup.children.some((c) => c.userData['kind'] === 'weeds' || c.userData['kind'] === 'bugs')).toBe(false);
      }
    }
  });
});

describe('FarmView', () => {
  it('follows the farm through plow, plant, grow, harvest and clear', () => {
    const farm = new Farm({ seed: 1, pestChance: 0 });
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
    const farm = new Farm({ seed: 1, pestChance: 0 });
    farm.xp = levelThreshold(8);
    farm.seeds.abobora = 1;
    const view = new FarmView(farm, 24, createToonGradient());
    expect(farm.plow(I, J).ok).toBe(true);
    expect(farm.plant(I, J, 'abobora', 0).ok).toBe(true);

    view.update(0.016, CROPS.abobora.growthMs); // thirsty: droplet indicator
    view.update(0.016, CROPS.abobora.growthMs / 2 + CROPS.abobora.witherMs + 1000); // withered
    expect(view.group.children).toHaveLength(2);
  });
});

describe('Rex and the decorations', () => {
  it('animates the dog in every mode', () => {
    const dog = new CharacterKit(createToonGradient()).dog();
    for (const mode of ['walking', 'working', 'resting'] as const) {
      dog.update({ pose: { at: { u: 0, v: 0 }, heading: 0, mode, workProgress: 0.5 }, dt: 0.016, time: 1, carry: null, night: 0 });
    }
    expect(dog.root.children.length).toBeGreaterThan(0);
  });

  it('shows only what was bought', () => {
    const farm = new Farm({ seed: 1 });
    farm.xp = levelThreshold(14);
    farm.coins = 50_000;
    const view = new DecorView(farm, createToonGradient());
    view.update(0.016);
    expect(view.group.children.length).toBe(0);
    for (const id of ['banco', 'flores', 'lanterna', 'balanco', 'fonte', 'coreto'] as const) farm.buyDecor(id);
    view.update(0.016);
    expect(view.group.children.length).toBe(6);
  });
});

describe('fruit trees', () => {
  it('builds every species, stage and condition, and the orchard view follows the farm', async () => {
    const { TREES, TREE_ORDER } = await import('../src/core/trees');
    const { buildTreeModel } = await import('../src/render/tree-models');
    const { OrchardView } = await import('../src/render/orchard-view');
    const kit = new CropKit(createToonGradient());
    for (const id of TREE_ORDER) {
      for (const stage of [0, 1, 2, 3] as const) {
        for (const thirsty of [false, true]) {
          const model = buildTreeModel(kit, TREES[id], { stage, progress: 0.5, thirsty });
          expect(model.children.length, `${id} ${stage}`).toBeGreaterThan(0);
        }
      }
    }
    const farm = new Farm({ seed: 1, pestChance: 1 });
    farm.xp = levelThreshold(30);
    farm.coins = 100_000;
    const view = new OrchardView(farm, createToonGradient());
    view.update(0.016, 0);
    const stakes = view.group.children[0]!.children.length;
    farm.buyPomar();
    farm.buySapling('mangueira', 1);
    farm.plantTree('mangueira', 12, 2, 0);
    view.update(0.016, 0);
    expect(view.group.children[0]!.children.length).toBeGreaterThan(stakes);
    expect(view.group.children.length).toBe(2); // ground + the tree
    farm.clearTree(12, 2);
    view.update(0.016, 1);
    expect(view.group.children.length).toBe(1);
  });
});
