import { CropId } from './crops';
import { ActionResult, Farm } from './farm';

export type Tool = 'colher' | 'arar' | 'semear' | 'regar' | 'limpar';

export const TOOLS: readonly Tool[] = ['colher', 'arar', 'semear', 'regar', 'limpar'];

/** Applies the active tool to a tile. This is the single entry point for player actions. */
export function applyTool(
  farm: Farm,
  tool: Tool,
  i: number,
  j: number,
  now: number,
  cropId: CropId,
): ActionResult {
  switch (tool) {
    case 'colher':
      return farm.harvest(i, j, now);
    case 'arar':
      return farm.plow(i, j);
    case 'semear':
      return farm.plant(i, j, cropId, now);
    case 'regar':
      return farm.water(i, j, now);
    case 'limpar':
      return farm.clear(i, j);
  }
}
