import { DEFAULT_START_PLANET_ID } from "./constants.js";
import { playerForClient } from "./selectors.js";
import { DEFAULT_SHIP_CLASS_ID, SHIP_CLASSES } from "./ship-classes.js";
import type { ActionValidationResult, ClientAction, MapPosition, PlayerShip, ShipClassId, World } from "./types.js";

type PlayerExistsResult = { accepted: true; player: PlayerShip } | { accepted: false; reason: string };

export function validateAction(world: World, rawAction: unknown): ActionValidationResult {
  if (!rawAction || typeof rawAction !== "object") {
    return rejectAction("Action must be a JSON object.");
  }

  const action = rawAction as Record<string, unknown>;
  const clientId = normalizeClientId(action.clientId);

  if (!clientId) {
    return rejectAction("Client id is required.");
  }

  switch (action.action) {
    case "spawn":
      return validateSpawnAction(world, action, clientId);
    case "move":
      return validateMoveAction(world, action, clientId);
    case "travel":
      return validateTravelAction(world, action, clientId);
    case "buy":
    case "sell":
      return validateTradeAction(world, action, clientId);
    case "wait":
      return validateWaitAction(world, clientId);
    default:
      return rejectAction("Action must be one of: spawn, move, travel, buy, sell, wait.");
  }
}

export function hasPendingSpawn(world: World, clientId: string): boolean {
  return world.pendingActions.some(
    (queuedAction) => queuedAction.action.action === "spawn" && queuedAction.action.clientId === clientId
  );
}

function validateSpawnAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  if (playerForClient(world, clientId) || hasPendingSpawn(world, clientId)) {
    return rejectAction("This client already has a player ship.");
  }

  const startPlanetId = normalizePlanetId(world, action.target ?? DEFAULT_START_PLANET_ID);

  if (!startPlanetId) {
    return rejectAction("Spawn target must be an existing planet.");
  }

  return acceptAction({
    action: "spawn",
    clientId,
    shipClassId: normalizeShipClassId(action.shipClassId),
    target: startPlanetId,
    name: normalizeName(action.name)
  });
}

function validateMoveAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const playerExists = validatePlayerExists(world, clientId);

  if (!playerExists.accepted) {
    return rejectAction(playerExists.reason);
  }

  const target = normalizeMapPosition(action.target);

  if (!target) {
    return rejectAction("Move target must include finite x and z map coordinates.");
  }

  return acceptAction({ action: "move", clientId, target });
}

function validateTravelAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const playerExists = validatePlayerExists(world, clientId);

  if (!playerExists.accepted) {
    return rejectAction(playerExists.reason);
  }

  const targetPlanetId = normalizePlanetId(world, action.target);

  if (!targetPlanetId) {
    return rejectAction("Travel target must be an existing planet.");
  }

  if (!playerExists.player.destinationPosition && targetPlanetId === playerExists.player.locationPlanetId) {
    return rejectAction("Ship is already at that planet.");
  }

  return acceptAction({ action: "travel", clientId, target: targetPlanetId });
}

function validateTradeAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const playerReady = validatePlayerReadyForTrade(world, clientId);

  if (!playerReady.accepted) {
    return rejectAction(playerReady.reason);
  }

  const item = normalizeString(action.item).trim();
  const qty = normalizeQty(action.qty);

  if (!world.goods[item]) {
    return rejectAction("Item must be a known good.");
  }

  if (!qty) {
    return rejectAction("Quantity must be a positive whole number.");
  }

  return acceptAction({ action: action.action as "buy" | "sell", clientId, item, qty });
}

function validateWaitAction(world: World, clientId: string): ActionValidationResult {
  if (!playerForClient(world, clientId)) {
    return rejectAction("Spawn a ship before waiting.");
  }

  return acceptAction({ action: "wait", clientId });
}

function validatePlayerExists(world: World, clientId: string): PlayerExistsResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, reason: "Spawn a ship before using that action." };
  }

  return { accepted: true, player };
}

function validatePlayerReadyForTrade(world: World, clientId: string): PlayerExistsResult {
  const playerExists = validatePlayerExists(world, clientId);

  if (!playerExists.accepted) {
    return playerExists;
  }

  const { player } = playerExists;

  if (player.destinationPosition) {
    return { accepted: false, reason: "Ship is already in transit." };
  }

  if (!player.locationPlanetId) {
    return { accepted: false, reason: "Dock at a planet before trading." };
  }

  return { accepted: true, player };
}

function acceptAction(action: ClientAction): ActionValidationResult {
  return { accepted: true, action };
}

function rejectAction(reason: string): ActionValidationResult {
  return { accepted: false, reason };
}

function normalizePlanetId(world: World, planetId: unknown): string | null {
  const id = normalizeString(planetId).trim();
  return world.planets.some((planet) => planet.id === id) ? id : null;
}

function normalizeName(name: unknown): string {
  const trimmed = normalizeString(name, "Player Ship").trim().slice(0, 32);
  return trimmed || "Player Ship";
}

function normalizeClientId(value: unknown): string | null {
  const id = normalizeString(value).trim().slice(0, 64);
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

function normalizeMapPosition(value: unknown): MapPosition | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawPosition = value as Record<string, unknown>;
  const x = normalizeFiniteNumber(rawPosition.x);
  const z = normalizeFiniteNumber(rawPosition.z);
  const y = normalizeFiniteNumber(rawPosition.y) ?? 0;

  if (x === null || z === null) {
    return null;
  }

  return { x, y, z };
}

function normalizeShipClassId(value: unknown): ShipClassId {
  const id = normalizeString(value);
  return id in SHIP_CLASSES ? (id as ShipClassId) : DEFAULT_SHIP_CLASS_ID;
}

function normalizeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function normalizeQty(value: unknown): number | null {
  const qty = Number(value);

  if (!Number.isFinite(qty) || qty <= 0) {
    return null;
  }

  return Math.floor(qty);
}

function normalizeFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}