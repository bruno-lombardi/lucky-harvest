import { applyTool, Tool } from './actions';
import { ProductId, SpeciesId } from './animals';
import { CropId } from './crops';
import { TruckUpgradeId } from './delivery';
import { HelperId } from './helpers';
import { ActionResult, Farm } from './farm';

/**
 * Every way a player can change the farm, as plain serialisable data.
 * The client applies commands locally; a server can apply the very same list to the very same
 * starting snapshot and reach the very same state, because the rules only depend on the
 * command, the state and the `now` timestamp.
 */
export type Command =
  | { type: 'tool'; tool: Tool; i: number; j: number; crop: CropId }
  | { type: 'buySeeds'; crop: CropId; qty: number }
  | { type: 'sellCrop'; crop: CropId; qty: number }
  | { type: 'sellProduct'; product: ProductId; qty: number }
  | { type: 'sellAll' }
  | { type: 'expandLand' }
  | { type: 'buildPen'; species: SpeciesId }
  | { type: 'upgradePen'; species: SpeciesId }
  | { type: 'upgradeTruck'; upgrade: TruckUpgradeId }
  | { type: 'buyAnimal'; species: SpeciesId }
  | { type: 'buyFeed'; species: SpeciesId; qty: number }
  | { type: 'craftFeed'; species: SpeciesId; batches: number }
  | { type: 'feed'; species: SpeciesId; animalId: number }
  | { type: 'feedAll'; species: SpeciesId }
  | { type: 'collect'; species: SpeciesId; animalId: number }
  | { type: 'collectAll'; species: SpeciesId }
  | { type: 'hireHelper'; helper: HelperId }
  | { type: 'upgradeHelper'; helper: HelperId }
  | { type: 'payHelper'; helper: HelperId };

/** A command that succeeded, with the time it was applied: the unit of replay and sync. */
export interface LoggedCommand {
  command: Command;
  now: number;
}

export function applyCommand(farm: Farm, command: Command, now: number): ActionResult {
  // Helpers work in the background, so catch their routines up to this moment first.
  farm.runHelpers(now);
  switch (command.type) {
    case 'tool':
      return applyTool(farm, command.tool, command.i, command.j, now, command.crop);
    case 'buySeeds':
      return farm.buySeeds(command.crop, command.qty);
    case 'sellCrop':
      return farm.sell(command.crop, command.qty);
    case 'sellProduct':
      return farm.sellProduct(command.product, command.qty);
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
  }
}

/** Re-applies a log to a farm. Used by the server (and tests) to prove two sides agree. */
export function replay(farm: Farm, log: readonly LoggedCommand[]): void {
  for (const { command, now } of log) applyCommand(farm, command, now);
}
