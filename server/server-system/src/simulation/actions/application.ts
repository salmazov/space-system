import type { AppliedActionResult, ClientAction, MapPosition, PlayerShip, ShipClassId, World } from "../domain/types.js";
import { calculatePrices } from "../economy/pricing.js";
import { distanceOnMap, planetPosition } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import { createPlayerShip } from "../ships/factory.js";
import { fuelRequiredForRoute, setShipDestination } from "../ships/movement.js";
import { broadcastSos, canBroadcastSos, clearSosForClient } from "../ships/sos.js";
import { FUEL_GOOD_ID, SOS_FUEL_SHARE_DISTANCE, SOS_FUEL_TARGET_LEVEL } from "../world/constants.js";
import { cargoUsed, planetName, playerForClient, storeAtPlanet } from "../world/selectors.js";

export function applyAction(world: World, action: ClientAction): AppliedActionResult {
  switch (action.action) {
    case "spawn":
      return spawnPlayerShip(world, action.clientId, action.target, action.name, action.shipClassId);
    case "move":
      return startFreeMove(world, action.clientId, action.target);
    case "travel":
      return startTravel(world, action.clientId, action.target);
    case "buy":
      return buyGood(world, action.clientId, action.item, action.qty);
    case "sell":
      return sellGood(world, action.clientId, action.item, action.qty);
    case "wait":
      return wait(world, action.clientId);
    case "sos":
      return sendSos(world, action.clientId);
    case "share_fuel":
      return shareFuel(world, action.clientId, action.targetClientId, action.qty);
  }
}

function spawnPlayerShip(
  world: World,
  clientId: string,
  target: string,
  name: string,
  shipClassId: ShipClassId
): AppliedActionResult {
  if (playerForClient(world, clientId)) {
    return { accepted: false, message: "Spawn failed: this client already has a player ship." };
  }

  const player = createPlayerShip(world, clientId, name, target, shipClassId);
  world.players.push(player);

  return {
    accepted: true,
    message: `${player.name} spawned a ${player.shipClassLabel} at ${planetName(world, target)}.`
  };
}

function startFreeMove(world: World, clientId: string, target: MapPosition): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Move failed: no player ship exists." };
  }

  const fuelRequired = fuelRequiredForRoute(player, target);

  if (player.fuel < fuelRequired) {
    maybeBroadcastLowFuelSos(world, player);
    return { accepted: false, message: `Move failed: ${player.name} needs ${fuelRequired} fuel for that route.` };
  }

  setShipDestination(world, player, target, null);

  return {
    accepted: true,
    message: `${player.name} started moving to ${formatPosition(target)}.`
  };
}

function startTravel(world: World, clientId: string, target: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Travel failed: no player ship exists." };
  }

  const destination = planetPosition(world, target);

  if (!destination) {
    return { accepted: false, message: "Travel failed: target planet does not exist." };
  }

  const fuelRequired = fuelRequiredForRoute(player, destination);

  if (player.fuel < fuelRequired) {
    maybeBroadcastLowFuelSos(world, player);
    return { accepted: false, message: `Travel failed: ${player.name} needs ${fuelRequired} fuel to reach ${planetName(world, target)}.` };
  }

  setShipDestination(world, player, destination, target);

  return {
    accepted: true,
    message: `${player.name} started traveling to ${planetName(world, target)}.`
  };
}

function buyGood(world: World, clientId: string, item: string, qty: number): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Buy failed: no player ship exists." };
  }

  if (!player.locationPlanetId) {
    return { accepted: false, message: "Buy failed: ship is not docked at a planet." };
  }

  const store = storeAtPlanet(world, player.locationPlanetId);
  const price = store.prices[item] ?? calculatePrices(world, store)[item] ?? 0;
  const total = roundCredits(price * qty);
  const availableCapacity = item === FUEL_GOOD_ID ? player.fuelCapacity - player.fuel : player.cargoCapacity - cargoUsed(player);

  if (player.destinationPosition) {
    return { accepted: false, message: "Buy failed: ship is in transit." };
  }

  if ((store.inventory[item] ?? 0) < qty) {
    return { accepted: false, message: `Buy failed: ${store.name} does not have enough ${item}.` };
  }

  if (availableCapacity < qty) {
    return { accepted: false, message: item === FUEL_GOOD_ID ? "Buy failed: fuel tank is full." : "Buy failed: cargo hold is full." };
  }

  if (player.credits < total) {
    return { accepted: false, message: "Buy failed: not enough credits." };
  }

  store.inventory[item] = (store.inventory[item] ?? 0) - qty;
  store.credits = roundCredits(store.credits + total);
  if (item === FUEL_GOOD_ID) {
    player.fuel = roundCredits(player.fuel + qty);
    if (player.fuel >= SOS_FUEL_TARGET_LEVEL) {
      clearSosForClient(world, player.ownerClientId);
    }
  } else {
    player.cargo[item] = (player.cargo[item] ?? 0) + qty;
  }
  player.credits = roundCredits(player.credits - total);

  return {
    accepted: true,
    message: `${player.name} bought ${qty} ${item} for ${total} credits.`
  };
}

function sellGood(world: World, clientId: string, item: string, qty: number): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Sell failed: no player ship exists." };
  }

  if (!player.locationPlanetId) {
    return { accepted: false, message: "Sell failed: ship is not docked at a planet." };
  }

  const store = storeAtPlanet(world, player.locationPlanetId);
  const price = store.prices[item] ?? calculatePrices(world, store)[item] ?? 0;
  const total = roundCredits(price * qty);

  if (player.destinationPosition) {
    return { accepted: false, message: "Sell failed: ship is in transit." };
  }

  const carried = item === FUEL_GOOD_ID ? player.fuel : player.cargo[item] ?? 0;

  if (carried < qty) {
    return { accepted: false, message: `Sell failed: ship does not carry enough ${item}.` };
  }

  if (store.credits < total) {
    return { accepted: false, message: `Sell failed: ${store.name} does not have enough credits.` };
  }

  store.inventory[item] = (store.inventory[item] ?? 0) + qty;
  store.credits = roundCredits(store.credits - total);
  if (item === FUEL_GOOD_ID) {
    player.fuel = roundCredits(player.fuel - qty);
  } else {
    player.cargo[item] = (player.cargo[item] ?? 0) - qty;
  }
  player.credits = roundCredits(player.credits + total);

  return {
    accepted: true,
    message: `${player.name} sold ${qty} ${item} for ${total} credits.`
  };
}

function wait(world: World, clientId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  return {
    accepted: true,
    message: `${player?.name ?? "Player ship"} waited for better market conditions.`
  };
}

function sendSos(world: World, clientId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "SOS failed: no player ship exists." };
  }

  if (player.locationPlanetId) {
    return { accepted: false, message: `SOS failed: ${player.name} is docked at ${planetName(world, player.locationPlanetId)}.` };
  }

  if (!canBroadcastSos(player)) {
    return { accepted: false, message: `SOS failed: ${player.name} still has enough fuel for normal operations.` };
  }

  const signal = broadcastSos(world, player);

  return {
    accepted: true,
    message: `${player.name} broadcast SOS for ${signal.fuelNeeded} fuel near ${formatPosition(player.position)}.`
  };
}

function maybeBroadcastLowFuelSos(world: World, player: PlayerShip): void {
  if (canBroadcastSos(player)) {
    broadcastSos(world, player);
  }
}

function shareFuel(world: World, clientId: string, targetClientId: string, qty: number): AppliedActionResult {
  const donor = playerForClient(world, clientId);
  const receiver = playerForClient(world, targetClientId);

  if (!donor || !receiver) {
    return { accepted: false, message: "Fuel share failed: donor or receiver ship does not exist." };
  }

  const distance = distanceOnMap(donor.position, receiver.position);

  if (distance > SOS_FUEL_SHARE_DISTANCE) {
    return { accepted: false, message: `Fuel share failed: ${receiver.name} is too far away.` };
  }

  const donorReserve = Math.max(4, donor.fuelCapacity * 0.2);
  const shareable = Math.max(0, Math.floor(donor.fuel - donorReserve));
  const receiverSpace = Math.max(0, Math.floor(receiver.fuelCapacity - receiver.fuel));
  const amount = Math.min(qty, shareable, receiverSpace);

  if (amount <= 0) {
    return { accepted: false, message: `Fuel share failed: ${donor.name} cannot spare fuel.` };
  }

  donor.fuel = roundCredits(donor.fuel - amount);
  receiver.fuel = roundCredits(receiver.fuel + amount);

  if (receiver.fuel >= SOS_FUEL_TARGET_LEVEL) {
    clearSosForClient(world, receiver.ownerClientId);
  }

  return {
    accepted: true,
    message: `${donor.name} shared ${amount} fuel with ${receiver.name}.`
  };
}

function formatPosition(position: MapPosition): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}