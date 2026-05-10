import type { AppliedActionResult, ClientAction, MapPosition, ShipClassId, World } from "../domain/types.js";
import { calculatePrices } from "../economy/pricing.js";
import { planetPosition } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import { createPlayerShip } from "../ships/factory.js";
import { setShipDestination } from "../ships/movement.js";
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
  const availableCargo = player.cargoCapacity - cargoUsed(player);

  if (player.destinationPosition) {
    return { accepted: false, message: "Buy failed: ship is in transit." };
  }

  if ((store.inventory[item] ?? 0) < qty) {
    return { accepted: false, message: `Buy failed: ${store.name} does not have enough ${item}.` };
  }

  if (availableCargo < qty) {
    return { accepted: false, message: "Buy failed: cargo hold is full." };
  }

  if (player.credits < total) {
    return { accepted: false, message: "Buy failed: not enough credits." };
  }

  store.inventory[item] = (store.inventory[item] ?? 0) - qty;
  store.credits = roundCredits(store.credits + total);
  player.cargo[item] = (player.cargo[item] ?? 0) + qty;
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

  if ((player.cargo[item] ?? 0) < qty) {
    return { accepted: false, message: `Sell failed: ship does not carry enough ${item}.` };
  }

  if (store.credits < total) {
    return { accepted: false, message: `Sell failed: ${store.name} does not have enough credits.` };
  }

  store.inventory[item] = (store.inventory[item] ?? 0) + qty;
  store.credits = roundCredits(store.credits - total);
  player.cargo[item] = (player.cargo[item] ?? 0) - qty;
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

function formatPosition(position: MapPosition): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}