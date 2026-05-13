import { applyAction } from "./application.js";
import { appendActionLog } from "./action-log.js";
import { hasPendingSpawn, validateAction } from "./validation.js";
import type {
  ImmediateActionResult,
  QueuedAction,
  QueuedActionResult,
  World
} from "../domain/types.js";
import { SHIP_CLASSES } from "../ships/classes.js";
import { updateShipMovement } from "../ships/movement.js";
import { playerForClient } from "../world/selectors.js";

export function queueAction(world: World, action: unknown): QueuedActionResult {
  updateShipMovement(world);
  const validation = validateAction(world, action);

  if (!validation.accepted) {
    appendActionLog(world, action, validation);
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
  appendActionLog(world, action, validation, queuedAction);

  return {
    accepted: true,
    actionId: queuedAction.id,
    queuedForTick: queuedAction.executeAtTick,
    action: queuedAction.action
  };
}

// Executes buy/sell/pickup/share actions immediately during the HTTP request,
// skipping the pending queue entirely. This avoids the up-to-10s wait for the
// next tick. Safe because these actions are simple inventory/credit mutations
// that don't interact with tick-pipeline phases (movement, fuel burn, production).
export function executeImmediateAction(world: World, action: unknown): ImmediateActionResult {
  // Sync ship positions to real elapsed time so validation checks
  // (e.g. "is the ship docked?") use accurate locations.
  updateShipMovement(world);

  // Same validation as queued actions — no shortcuts, no special treatment.
  const validation = validateAction(world, action);

  if (!validation.accepted) {
    appendActionLog(world, action, validation);
    return validation;
  }

  // Key difference from queueAction: we call applyAction RIGHT HERE
  // instead of storing in world.pendingActions for the next tick.
  const result = applyAction(world, validation.action);

  // Record in the observer action log (dashboard visibility).
  appendActionLog(world, action, validation);

  // Push to recentEvents so the next tick snapshot includes it
  // in the event feed for all connected clients.
  world.recentEvents.push({
    type: result.accepted ? "player_action" : "action_rejected",
    message: result.message
  });

  if (!result.accepted) {
    return { accepted: false, reason: result.message };
  }

  // Return the result message directly — the HTTP handler sends this
  // back to the client and triggers a WebSocket broadcast so every
  // connected client sees the updated world state immediately.
  return { accepted: true, message: result.message, executedAtTick: world.tick };
}

export function getAvailableActions(world: World, clientId?: string) {
  const player = clientId ? playerForClient(world, clientId) : null;

  return {
    actions: ["spawn", "move", "travel", "buy", "sell", "wait", "sos", "share_fuel"],
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