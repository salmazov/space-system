import { CARGO_CAPACITY, STARTING_CREDITS } from "./constants.js";
import { roundCredits } from "./math.js";
import { calculatePrices } from "./pricing.js";
import { cargoUsed, emptyCargo, planetName, storeAtPlanet, travelTime } from "./selectors.js";
import type { AppliedActionResult, ClientAction, World } from "./types.js";

export function applyAction(world: World, action: ClientAction): AppliedActionResult {
  switch (action.action) {
    case "spawn":
      return spawnPlayerShip(world, action.target, action.name);
    case "travel":
      return startTravel(world, action.target);
    case "buy":
      return buyGood(world, action.item, action.qty);
    case "sell":
      return sellGood(world, action.item, action.qty);
    case "wait":
      return wait(world);
  }
}

function spawnPlayerShip(world: World, target: string, name: string): AppliedActionResult {
  if (world.player) {
    return { accepted: false, message: "Spawn failed: a player ship already exists." };
  }

  world.player = {
    id: "player-ship-1",
    name,
    type: "trade_ship",
    locationPlanetId: target,
    destinationPlanetId: null,
    travelRemainingTicks: 0,
    travelTotalTicks: 0,
    credits: STARTING_CREDITS,
    cargoCapacity: CARGO_CAPACITY,
    cargo: emptyCargo(world)
  };

  return {
    accepted: true,
    message: `${world.player.name} spawned at ${planetName(world, target)}.`
  };
}

function startTravel(world: World, target: string): AppliedActionResult {
  if (!world.player) {
    return { accepted: false, message: "Travel failed: no player ship exists." };
  }

  const distance = travelTime(world.player.locationPlanetId, target);

  world.player.destinationPlanetId = target;
  world.player.travelRemainingTicks = distance;
  world.player.travelTotalTicks = distance;

  return {
    accepted: true,
    message: `${world.player.name} started traveling to ${planetName(world, target)}.`
  };
}

function buyGood(world: World, item: string, qty: number): AppliedActionResult {
  const player = world.player;

  if (!player) {
    return { accepted: false, message: "Buy failed: no player ship exists." };
  }

  const store = storeAtPlanet(world, player.locationPlanetId);
  const price = store.prices[item] ?? calculatePrices(world, store)[item] ?? 0;
  const total = roundCredits(price * qty);
  const availableCargo = player.cargoCapacity - cargoUsed(player);

  if (player.destinationPlanetId) {
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
  player.cargo[item] = (player.cargo[item] ?? 0) + qty;
  player.credits = roundCredits(player.credits - total);

  return {
    accepted: true,
    message: `${player.name} bought ${qty} ${item} for ${total} credits.`
  };
}

function sellGood(world: World, item: string, qty: number): AppliedActionResult {
  const player = world.player;

  if (!player) {
    return { accepted: false, message: "Sell failed: no player ship exists." };
  }

  const store = storeAtPlanet(world, player.locationPlanetId);
  const price = store.prices[item] ?? calculatePrices(world, store)[item] ?? 0;
  const total = roundCredits(price * qty);

  if (player.destinationPlanetId) {
    return { accepted: false, message: "Sell failed: ship is in transit." };
  }

  if ((player.cargo[item] ?? 0) < qty) {
    return { accepted: false, message: `Sell failed: ship does not carry enough ${item}.` };
  }

  store.inventory[item] = (store.inventory[item] ?? 0) + qty;
  player.cargo[item] = (player.cargo[item] ?? 0) - qty;
  player.credits = roundCredits(player.credits + total);

  return {
    accepted: true,
    message: `${player.name} sold ${qty} ${item} for ${total} credits.`
  };
}

function wait(world: World): AppliedActionResult {
  return {
    accepted: true,
    message: `${world.player?.name ?? "Player ship"} waited for better market conditions.`
  };
}