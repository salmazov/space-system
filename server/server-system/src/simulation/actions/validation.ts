import type { ActionValidationResult, ClientAction, MapPosition, PlayerShip, ShipClassId, World } from "../domain/types.js";
import { distanceOnMap } from "../map/geometry.js";
import { DEFAULT_SHIP_CLASS_ID, SHIP_CLASSES } from "../ships/classes.js";
import { DEFAULT_START_PLANET_ID, CLIENT_ACTIVITY_TIMEOUT_MS, COMBAT, ECONOMY, isPirateStation, STATION } from "../world/constants.js";
import { isOwnerActive } from "../world/presence.js";
import { playerForClient } from "../world/selectors.js";
import { getPurchasableClasses, getShipPrice } from "./ship-purchase.js";

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
    case "sos":
      return validateSosAction(world, clientId);
    case "share_fuel":
      return validateShareFuelAction(world, action, clientId);
    case "go_pirate":
      return validateGoPirateAction(world, clientId);
    case "pickup_cargo":
      return validatePickupCargoAction(world, action, clientId);
    case "build_station":
      return validateBuildStationAction(world, action, clientId);
    case "claim_station":
      return validateClaimStationAction(world, clientId);
    case "buy_ship":
      return validateBuyShipAction(world, action, clientId);
    case "accept_mission":
      return validateAcceptMissionAction(world, action, clientId);
    default:
      return rejectAction("Action must be one of: spawn, move, travel, buy, sell, wait, sos, share_fuel, go_pirate, pickup_cargo, build_station, claim_station, buy_ship, accept_mission.");
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

function validateSosAction(world: World, clientId: string): ActionValidationResult {
  if (!playerForClient(world, clientId)) {
    return rejectAction("Spawn a ship before broadcasting SOS.");
  }

  return acceptAction({ action: "sos", clientId });
}

function validateShareFuelAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const playerExists = validatePlayerExists(world, clientId);

  if (!playerExists.accepted) {
    return rejectAction(playerExists.reason);
  }

  const targetClientId = normalizeClientId(action.targetClientId);
  const qty = normalizeQty(action.qty);

  if (!targetClientId || !playerForClient(world, targetClientId)) {
    return rejectAction("Fuel share target must be an existing ship client id.");
  }

  if (targetClientId === clientId) {
    return rejectAction("Fuel share target must be another ship.");
  }

  if (!qty) {
    return rejectAction("Fuel share quantity must be a positive whole number.");
  }

  return acceptAction({ action: "share_fuel", clientId, targetClientId, qty });
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

  const dockedPlanet = world.planets.find((p) => p.id === player.locationPlanetId);

  if (dockedPlanet && dockedPlanet.health <= 0) {
    return { accepted: false, reason: "Trading failed: this station is destroyed." };
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

function validateGoPirateAction(world: World, clientId: string): ActionValidationResult {
  const result = validatePlayerExists(world, clientId);

  if (!result.accepted) {
    return rejectAction(result.reason);
  }

  const player = result.player;

  if (player.isPirate) {
    return rejectAction("Go pirate failed: ship is already a pirate.");
  }

  const station = player.locationPlanetId ? world.planets.find((p) => p.id === player.locationPlanetId) : null;

  if (!station || !isPirateStation(station)) {
    return rejectAction("Go pirate failed: ship must be docked at a Pirate Station.");
  }

  if (station.health <= 0) {
    return rejectAction("Go pirate failed: Pirate Station is destroyed.");
  }

  return {
    accepted: true,
    action: { action: "go_pirate", clientId }
  };
}

function validatePickupCargoAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const result = validatePlayerExists(world, clientId);

  if (!result.accepted) {
    return rejectAction(result.reason);
  }

  const cargoId = normalizeString(action.cargoId).trim();
  const drift = world.driftingCargo.find((c) => c.id === cargoId);

  if (!drift) {
    return rejectAction("Pickup failed: drifting cargo not found.");
  }

  if (distanceOnMap(result.player.position, drift.position) > COMBAT.DRIFTING_CARGO_PICKUP_RANGE) {
    return rejectAction("Pickup failed: cargo is too far away.");
  }

  return {
    accepted: true,
    action: { action: "pickup_cargo", clientId, cargoId }
  };
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

function validateBuildStationAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const result = validatePlayerExists(world, clientId);

  if (!result.accepted) {
    return rejectAction(result.reason);
  }

  const player = result.player;

  if (player.destinationPosition) {
    return rejectAction("Build failed: ship is in transit.");
  }

  if (player.locationPlanetId) {
    return rejectAction("Build failed: undock from planet before building.");
  }

  if (player.credits < STATION.BUILD_COST) {
    return rejectAction(`Build failed: need ${STATION.BUILD_COST} credits (have ${Math.floor(player.credits)}).`);
  }

  for (const planet of world.planets) {
    if (distanceOnMap(player.position, planet.position) < STATION.MIN_DISTANCE) {
      return rejectAction(`Build failed: too close to ${planet.name}. Minimum distance is ${STATION.MIN_DISTANCE}.`);
    }
  }

  const name = normalizeName(action.name);

  return {
    accepted: true,
    action: { action: "build_station", clientId, name }
  };
}

function validateClaimStationAction(world: World, clientId: string): ActionValidationResult {
  const result = validatePlayerExists(world, clientId);

  if (!result.accepted) {
    return rejectAction(result.reason);
  }

  const player = result.player;

  if (!player.locationPlanetId) {
    return rejectAction("Claim failed: must be docked at a station.");
  }

  const station = world.planets.find((p) => p.id === player.locationPlanetId);

  if (!station) {
    return rejectAction("Claim failed: station not found.");
  }

  if (station.ownerClientId) {
    if (isOwnerActive(world, station.ownerClientId)) {
      return rejectAction(`Claim failed: ${station.name} already has an active owner.`);
    }
  }

  return {
    accepted: true,
    action: { action: "claim_station", clientId }
  };
}

function validateBuyShipAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const result = validatePlayerExists(world, clientId);
  if (!result.accepted) return rejectAction(result.reason);

  const player = result.player;
  if (!player.locationPlanetId) {
    return rejectAction("Buy ship failed: must be docked at a planet.");
  }

  const shipClassId = normalizeString(action.shipClassId).trim();
  if (!getPurchasableClasses().includes(shipClassId as ShipClassId)) {
    return rejectAction(`Buy ship failed: ${shipClassId} is not available for purchase.`);
  }

  const price = getShipPrice(shipClassId as ShipClassId);
  if (player.credits < price) {
    return rejectAction(`Buy ship failed: need ${price} credits (have ${Math.floor(player.credits)}).`);
  }

  return acceptAction({ action: "buy_ship", clientId, shipClassId: shipClassId as ShipClassId });
}

function validateAcceptMissionAction(world: World, action: Record<string, unknown>, clientId: string): ActionValidationResult {
  const result = validatePlayerExists(world, clientId);
  if (!result.accepted) return rejectAction(result.reason);

  const missionId = normalizeString(action.missionId).trim();
  const mission = world.missions.find((m) => m.id === missionId);

  if (!mission) {
    return rejectAction("Accept mission failed: mission not found.");
  }

  if (mission.acceptedByClientId) {
    return rejectAction("Accept mission failed: mission already accepted.");
  }

  return acceptAction({ action: "accept_mission", clientId, missionId });
}