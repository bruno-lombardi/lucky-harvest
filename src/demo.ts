import { CROPS, CROP_ORDER, CropId } from './core/crops';
import { CropState, Farm, FarmSnapshot, LAND, TileState } from './core/farm';
import { tileKey } from './core/grid';
import { levelThreshold } from './core/levels';
import { mulberry32 } from './core/noise';

/**
 * A pre-populated farm for previews and screenshots (open the game with `?demo`).
 * The first six rows show every crop at every stage; the rest of the plot is filled at random.
 */
export function createDemoFarm(now: number): Farm {
  const tiles: Record<string, TileState> = {};
  const rand = mulberry32(2024);

  const grown = (cropId: CropId, progress: number): CropState => ({
    cropId,
    plantedAt: now - progress * CROPS[cropId].growthMs,
    watered: true,
    pausedMs: 0,
  });
  const thirsty = (cropId: CropId): CropState => ({
    cropId,
    plantedAt: now - 0.6 * CROPS[cropId].growthMs,
    watered: false,
    pausedMs: 0,
  });
  const withered = (cropId: CropId): CropState => ({
    cropId,
    plantedAt: now - (CROPS[cropId].growthMs + CROPS[cropId].witherMs + 5000),
    watered: true,
    pausedMs: 0,
  });

  const put = (i: number, j: number, crop: CropState | null): void => {
    tiles[tileKey(i, j)] = { kind: 'soil', crop };
  };

  CROP_ORDER.forEach((id, row) => {
    const j = LAND.min + row;
    const states: (CropState | null)[] = [
      grown(id, 0.05),
      grown(id, 0.3),
      grown(id, 0.7),
      thirsty(id),
      grown(id, 1),
      withered(id),
      null,
    ];
    states.forEach((crop, col) => put(LAND.min + col, j, crop));
  });

  for (let j = LAND.min; j <= LAND.max; j++) {
    for (let i = LAND.min + 7; i <= LAND.max; i++) {
      if (rand() < 0.15) continue; // leave a few bare grass tiles
      const id = CROP_ORDER[Math.floor(rand() * CROP_ORDER.length)]!;
      put(i, j, rand() < 0.8 ? grown(id, 0.2 + rand() * 0.9) : null);
    }
  }

  const snapshot: FarmSnapshot = { version: 1, coins: 1250, xp: levelThreshold(8) + 120, tiles };
  return Farm.fromSnapshot(snapshot);
}
