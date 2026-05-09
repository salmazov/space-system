import { DEFAULT_START_PLANET_ID } from "./constants.js";
import type { ActionValidationResult, ClientAction, World } from "./types.js";

export function validateAction(world: World, rawAction: unknown): ActionValidationResult {
  if (!rawAction || typeof rawAction !== "object") {
    return rejectAction("Action must be a JSON object.");
  }

  const action = rawAction as Record<string, unknown>;

  switch (action.action) {
    case "spawn":
      return validateSpawnAction(world, action);
    case "travel":
      return validateTravelAction(world, action);
    case "buy":
    case "sell":
      return validateTradeAction(world, action);
    case "wait":
      return validateWaitAction(world);
    default:
      return rejectAction("Action must be one of: spawn, travel, buy, sell, wait.");
  }
}

export function hasPendingSpawn(world: World): boolean {
  return world.pendingActions.some((queuedAction) => queuedAction.action.action === "spawn");
}

function validateSpawnAction(world: World, action: Record<string, unknown>): ActionValidationResult {
  if (world.player || hasPendingSpawn(world)) {
    return rejectAction("Only one player ship can be spawned.");
  }

  const startPlanetId = normalizePlanetId(world, action.target ?? DEFAULT_START_PLANET_ID);

  if (!startPlanetId) {
    return rejectAction("Spawn target must be an existing planet.");
  }

  return acceptAction({
    action: "spawn",
    target: startPlanetId,
    name: normalizeName(action.name)
  });
}

function validateTravelAction(world: World, action: Record<string, unknown>): ActionValidationResult {
  const playerReady = validatePlayerReady(world);

  if (!playerReady.accepted) {
    return playerReady;
  }

  const targetPlanetId = normalizePlanetId(world, action.target);

  if (!targetPlanetId) {
    return rejectAction("Travel target must be an existing planet.");
  }

  if (targetPlanetId === world.player?.locationPlanetId) {
    return rejectAction("Ship is already at that planet.");
  }

  return acceptAction({ action: "travel", target: targetPlanetId });
}

function validateTradeAction(world: World, action: Record<string, unknown>): ActionValidationResult {
  const playerReady = validatePlayerReady(world);

  if (!playerReady.accepted) {
    return playerReady;
  }

  const item = String(action.item ?? "").trim();
  const qty = normalizeQty(action.qty);

  if (!world.goods[item]) {
    return rejectAction("Item must be a known good.");
  }

  if (!qty) {
    return rejectAction("Quantity must be a positive whole number.");
  }

  return acceptAction({ action: action.action as "buy" | "sell", item, qty });
}

function validateWaitAction(world: World): ActionValidationResult {
  if (!world.player) {
    return rejectAction("Spawn a ship before waiting.");
  }

  return acceptAction({ action: "wait" });
}

function validatePlayerReady(world: World): ActionValidationResult {
  if (!world.player) {
    return rejectAction("Spawn a ship before using that action.");
  }

  if (world.player.destinationPlanetId) {
    return rejectAction("Ship is already in transit.");
  }

  return acceptAction({ action: "wait" });
}

function acceptAction(action: ClientAction): ActionValidationResult {
  return { accepted: true, action };
}

function rejectAction(reason: string): ActionValidationResult {
  return { accepted: false, reason };
}

function normalizePlanetId(world: World, planetId: unknown): string | null {
  const id = String(planetId ?? "").trim();
  return world.planets.some((planet) => planet.id === id) ? id : null;
}

function normalizeName(name: unknown): string {
  const trimmed = String(name ?? "Player Ship").trim().slice(0, 32);
  return trimmed || "Player Ship";
}

function normalizeQty(value: unknown): number | null {
  const qty = Number(value);

  if (!Number.isFinite(qty) || qty <= 0) {
    return null;
  }

  return Math.floor(qty);
}