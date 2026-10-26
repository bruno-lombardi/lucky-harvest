/**
 * @module core/actions
 *
 * The seven player tools (`colher arar semear regar cuidar limpar adubar`) mapped onto `Farm` methods. `applyTool` is the one place that
 * knows the orchard answers to the same tools as crops (it routes orchard tiles to the tree rules).
 * The neutral "olhar" (look) tool is UI-only and has no entry here, because it never changes state.
 */

import { CropId } from './crops';
import { ActionResult, Farm } from './farm';
import { FertilizerId } from './fertilizer';
import { TreeId, isOrchardTile } from './trees';

export type Tool = 'colher' | 'arar' | 'semear' | 'regar' | 'cuidar' | 'limpar' | 'adubar';

export const TOOLS: readonly Tool[] = ['colher', 'arar', 'semear', 'regar', 'cuidar', 'limpar', 'adubar'];

/** Applies the active tool to a tile. This is the single entry point for player actions. */
export function applyTool(
  farm: Farm,
  tool: Tool,
  i: number,
  j: number,
  now: number,
  cropId: CropId,
  treeId?: TreeId,
  fertilizerId: FertilizerId = 'esterco',
): ActionResult {
  if (isOrchardTile(i, j)) return applyTreeTool(farm, tool, i, j, now, treeId);
  switch (tool) {
    case 'colher':
      return farm.harvest(i, j, now);
    case 'arar':
      return farm.plow(i, j);
    case 'semear':
      return farm.plant(i, j, cropId, now);
    case 'regar':
      return farm.water(i, j, now);
    case 'cuidar':
      return farm.care(i, j, now);
    case 'limpar':
      return farm.clear(i, j);
    case 'adubar':
      return farm.fertilize(i, j, fertilizerId, now);
  }
}

/** The orchard answers to the same tools, but its tiles hold trees instead of crops. */
function applyTreeTool(farm: Farm, tool: Tool, i: number, j: number, now: number, treeId?: TreeId): ActionResult {
  switch (tool) {
    case 'colher':
      return farm.harvestTree(i, j, now);
    case 'arar':
      return { ok: false, reason: 'not-grass' };
    case 'semear':
      return treeId ? farm.plantTree(treeId, i, j, now) : { ok: false, reason: 'no-sapling' };
    case 'regar':
      return farm.waterTree(i, j, now);
    case 'cuidar':
      return farm.careTree(i, j, now);
    case 'limpar':
      return farm.clearTree(i, j);
    case 'adubar':
      // NEXT(content): trees share the anchor model, so fertilizing them is a small addition to trees.ts.
      return { ok: false, reason: 'no-crop' };
  }
}
