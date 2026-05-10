import { applyAction } from "./application.js";
import { hasPendingSpawn, validateAction } from "./validation.js";
import type { QueuedAction, QueuedActionResult, World } from "../domain/types.js";
import { SHIP_CLASSES } from "../ships/classes.js";
import { updateShipMovement } from "../ships/movement.js";
import { playerForClient } from "../world/selectors.js";

export function queueAction(world: World, action: unknown): QueuedActionResult {
  updateShipMovement(world);
  const validation = validateAction(world, action);

  if (!validation.accepted) {
    return validation;
  }

  const queuedAction: QueuedAction = {
    id: `action-${world.nextActionId}`,
    submittedTick: world.tick,
    executeAtTick: world.tick + 1,
    action: validation.action
  };

  world.nextActionId += 1;
  world.pendingActions.push(queuedAction);

  return {
    accepted: true,
    actionId: queuedAction.id,
    queuedForTick: queuedAction.executeAtTick,
    action: queuedAction.action
  };
}

export function getAvailableActions(world: World, clientId?: string) {
  const player = clientId ? playerForClient(world, clientId) : null;

  return {
    actions: ["spawn", "move", "travel", "buy", "sell", "wait"],
    spawnAllowed: clientId ? !player && !hasPendingSpawn(world, clientId) : true,
    goods: Object.keys(world.goods),
    shipClasses: SHIP_CLASSES,
    planets: world.planets.map((planet) => ({
      id: planet.id,
      name: planet.name
    }))
  };
}

export function processPendingActions(world: World): void {
  const dueActions = world.pendingActions.filter((queuedAction) => queuedAction.executeAtTick <= world.tick);

  world.pendingActions = world.pendingActions.filter((queuedAction) => queuedAction.executeAtTick > world.tick);

  for (const queuedAction of dueActions) {
    const result = applyAction(world, queuedAction.action);

    world.recentEvents.push({
      type: result.accepted ? "player_action" : "action_rejected",
      message: result.message
    });
  }
}