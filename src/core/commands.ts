import { applyTool, Tool } from './actions';
import { ProductId, SpeciesId } from './animals';
import { CropId } from './crops';
import { FertilizerId } from './fertilizer';
import { TreeId } from './trees';
import { achievementKey, findAchievement, findGoal, goalDone, goalKey, stepDone } from './progress';
import { DecorId } from './decor';
import { TruckUpgradeId } from './delivery';
import { HelperId } from './helpers';
import { GoodId } from './goods';
import { AutoPlant } from './autoplant';
import { ActionResult, Farm } from './farm';

/**
 * Every way a player can change the farm, as plain serialisable data.
 * The client applies commands locally; a server can apply the very same list to the very same
 * starting snapshot and reach the very same state, because the rules only depend on the
 * command, the state and the `now` timestamp.
 */
export type Command =
  | { type: 'tool'; tool: Tool; i: number; j: number; crop: CropId; tree?: TreeId; fertilizer?: FertilizerId }
  | { type: 'buySeeds'; crop: CropId; qty: number }
  | { type: 'sellCrop'; crop: CropId; qty: number }
  | { type: 'sellProduct'; product: ProductId; qty: number }
  | { type: 'sellFruit'; tree: TreeId; qty: number }
  | { type: 'buyPomar' }
  | { type: 'buySapling'; tree: TreeId; qty: number }
  | { type: 'sellAll' }
  | { type: 'expandLand' }
  | { type: 'buildPen'; species: SpeciesId }
  | { type: 'upgradePen'; species: SpeciesId }
  | { type: 'upgradeTruck'; upgrade: TruckUpgradeId }
  | { type: 'buyDecor'; decor: DecorId }
  | { type: 'upgradeBarn' }
  | { type: 'claimGoal'; goal: number }
  | { type: 'claimAchievement'; achievement: string; step: number }
  | { type: 'buyAnimal'; species: SpeciesId }
  | { type: 'buyFeed'; species: SpeciesId; qty: number }
  | { type: 'craftFeed'; species: SpeciesId; batches: number }
  | { type: 'feed'; species: SpeciesId; animalId: number }
  | { type: 'feedAll'; species: SpeciesId }
  | { type: 'collect'; species: SpeciesId; animalId: number }
  | { type: 'collectAll'; species: SpeciesId }
  | { type: 'hireHelper'; helper: HelperId }
  | { type: 'upgradeHelper'; helper: HelperId }
  | { type: 'payHelper'; helper: HelperId }
  | { type: 'setAutoPlant'; settings: AutoPlant }
  | { type: 'buyBakery' }
  | { type: 'upgradeBakery' }
  | { type: 'bake'; good: GoodId; batches: number }
  | { type: 'collectBakery' }
  | { type: 'sellGood'; good: GoodId; qty: number };

/**
 * A command that succeeded, with the time it was applied: the unit of replay and sync.
 *
 * NEXT(backend): add `seq` (a per-farm counter) so the server can treat retries idempotently, and an `origin: 'client' | 'server'`
 *   marker. Server-origin entries (gift received, crop stolen) would be appended to a farm's log by the server and applied like any
 *   other command, which keeps one ordered, replayable log per farm. See "Cross-farm operations" in docs/Roadmap-Backend-Multiplayer-Social.md.
 */
export interface LoggedCommand {
  command: Command;
  now: number;
}

/**
 * The single entry point for changing a farm. `now` is the caller's clock.
 * NEXT(backend): on a server `now` must come from the server's clock (or be a client value checked against it: non-decreasing and not
 *   ahead of server time plus a small skew), never trusted blindly.
 */
export function applyCommand(farm: Farm, command: Command, now: number): ActionResult {
  // Helpers work in the background, so catch their routines up to this moment first.
  farm.runHelpers(now);
  switch (command.type) {
    case 'tool':
      return applyTool(farm, command.tool, command.i, command.j, now, command.crop, command.tree, command.fertilizer);
    case 'buySeeds':
      return farm.buySeeds(command.crop, command.qty);
    case 'sellCrop':
      return farm.sell(command.crop, command.qty);
    case 'sellProduct':
      return farm.sellProduct(command.product, command.qty);
    case 'sellFruit':
      return farm.sellFruit(command.tree, command.qty);
    case 'buyPomar':
      return farm.buyPomar();
    case 'buySapling':
      return farm.buySapling(command.tree, command.qty);
    case 'sellAll':
      return farm.sellAll();
    case 'expandLand':
      return farm.expandLand();
    case 'buildPen':
      return farm.buildPen(command.species);
    case 'upgradePen':
      return farm.upgradePen(command.species);
    case 'upgradeTruck':
      return farm.upgradeTruck(command.upgrade, now);
    case 'buyDecor':
      return farm.buyDecor(command.decor);
    case 'upgradeBarn':
      return farm.upgradeBarn();
    case 'claimGoal': {
      const goal = findGoal(command.goal);
      if (!goal || !goalDone(goal, farm)) return { ok: false, reason: 'not-done' };
      return farm.claim(goalKey(goal.id), goal.reward);
    }
    case 'claimAchievement': {
      const a = findAchievement(command.achievement);
      if (!a || !Number.isInteger(command.step) || command.step < 0 || command.step >= a.steps.length || !stepDone(a, command.step, farm)) {
        return { ok: false, reason: 'not-done' };
      }
      return farm.claim(achievementKey(a.id, command.step), a.rewards[command.step]!, a.gifts?.[command.step]);
    }
    case 'buyAnimal':
      return farm.buyAnimal(command.species);
    case 'buyFeed':
      return farm.buyFeed(command.species, command.qty);
    case 'craftFeed':
      return farm.craftFeed(command.species, command.batches);
    case 'feed':
      return farm.feedAnimal(command.species, command.animalId, now);
    case 'feedAll':
      return farm.feedAll(command.species, now);
    case 'collect':
      return farm.collect(command.species, command.animalId, now);
    case 'collectAll':
      return farm.collectAll(command.species, now);
    case 'hireHelper':
      return farm.hireHelper(command.helper, now);
    case 'upgradeHelper':
      return farm.upgradeHelper(command.helper);
    case 'payHelper':
      return farm.payHelper(command.helper, now);
    case 'setAutoPlant':
      return farm.setAutoPlant(command.settings);
    case 'buyBakery':
      return farm.buyBakery();
    case 'upgradeBakery':
      return farm.upgradeBakery();
    case 'bake':
      return farm.bake(command.good, command.batches, now);
    case 'collectBakery':
      return farm.collectBakery(now);
    case 'sellGood':
      return farm.sellGood(command.good, command.qty);
  }
}

/** Re-applies a log to a farm. Used by the server (and tests) to prove two sides agree. */
export function replay(farm: Farm, log: readonly LoggedCommand[]): void {
  for (const { command, now } of log) applyCommand(farm, command, now);
}
