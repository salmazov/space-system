import { applyAction } from "./action-application.js";
import { hasPendingSpawn, validateAction } from "./action-validation.js";
import type { QueuedAction, QueuedActionResult, World } from "./types.js";

export function queueAction(world: World, action: unknown): QueuedActionResult {
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

export function getAvailableActions(world: World) {
  return {
    actions: ["spawn", "travel", "buy", "sell", "wait"],
    spawnAllowed: !world.player && !hasPendingSpawn(world),
    goods: Object.keys(world.goods),
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