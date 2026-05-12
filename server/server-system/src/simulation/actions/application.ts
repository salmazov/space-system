import type { AppliedActionResult, ClientAction, MapPosition, PlayerShip, ShipClassId, World } from "../domain/types.js";
import { calculatePrices } from "../economy/pricing.js";
import { distanceOnMap, planetPosition } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import { createPlayerShip } from "../ships/factory.js";
import { shipClassById } from "../ships/classes.js";
import { boostHappinessOnTrade, boostHappinessOnFuelShare, penalizeHappinessOnSos } from "../ships/happiness.js";
import { applyGoPirate } from "../ships/piracy.js";
import { fuelRequiredForRoute, setShipDestination } from "../ships/movement.js";
import { broadcastSos, canBroadcastSos, clearSosForClient } from "../ships/sos.js";
import { FUEL_GOOD_ID, SOS_FUEL_SHARE_DISTANCE, SOS_FUEL_TARGET_LEVEL, STATION_BUILD_COST, STATION_OWNER_TRADE_CUT, CLIENT_ACTIVITY_TIMEOUT_MS, GOODS } from "../world/constants.js";
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
    case "go_pirate":
      return applyGoPirate(world, action.clientId);
    case "pickup_cargo":
      return pickupCargo(world, action.clientId, action.cargoId);
    case "build_station":
      return buildStation(world, action.clientId, action.name);
    case "claim_station":
      return claimStation(world, action.clientId);
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
  const unitPrice = buyUnitPrice(player, price, qty);
  const total = roundCredits(unitPrice * qty);
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
  creditStationOwner(world, player.locationPlanetId!, total);
  boostHappinessOnTrade(player);

  return {
    accepted: true,
    message: `${player.name} bought ${qty} ${item} for ${total} credits.`
  };
}

function buyUnitPrice(player: PlayerShip, price: number, qty: number): number {
  const discount = shipClassById(player.shipClassId).bulkDiscount;

  if (!discount || qty < discount.minQty) {
    return price;
  }

  return roundCredits(price * (1 - discount.rate));
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
  creditStationOwner(world, player.locationPlanetId!, total);
  boostHappinessOnTrade(player);

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
  penalizeHappinessOnSos(player);

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

  boostHappinessOnFuelShare(donor);

  return {
    accepted: true,
    message: `${donor.name} shared ${amount} fuel with ${receiver.name}.`
  };
}

function pickupCargo(world: World, clientId: string, cargoId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Pickup failed: no player ship exists." };
  }

  const driftIndex = world.driftingCargo.findIndex((c) => c.id === cargoId);
  const drift = driftIndex >= 0 ? world.driftingCargo[driftIndex] : null;

  if (!drift) {
    return { accepted: false, message: "Pickup failed: drifting cargo not found." };
  }
  const usedCargo = cargoUsed(player);
  const freeSpace = player.cargoCapacity - usedCargo;
  let pickedUp = 0;

  for (const [item, qty] of Object.entries(drift.cargo)) {
    if (freeSpace - pickedUp <= 0) {
      break;
    }

    const take = Math.min(qty, freeSpace - pickedUp);
    player.cargo[item] = (player.cargo[item] ?? 0) + take;
    drift.cargo[item] = (drift.cargo[item] ?? 0) - take;
    pickedUp += take;
  }

  // Remove empty items from drift
  for (const [item, qty] of Object.entries(drift.cargo)) {
    if (qty <= 0) {
      delete drift.cargo[item];
    }
  }

  // Remove drift if fully picked up
  if (Object.keys(drift.cargo).length === 0) {
    world.driftingCargo.splice(driftIndex, 1);
  }

  if (pickedUp === 0) {
    return { accepted: false, message: "Pickup failed: cargo hold is full." };
  }

  return {
    accepted: true,
    message: `${player.name} picked up ${pickedUp} units of drifting cargo.`
  };
}

function formatPosition(position: MapPosition): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}

function creditStationOwner(world: World, planetId: string, tradeTotal: number): void {
  const planet = world.planets.find((p) => p.id === planetId);

  if (!planet?.ownerClientId) {
    return;
  }

  const owner = playerForClient(world, planet.ownerClientId);

  if (!owner) {
    return;
  }

  const cut = roundCredits(tradeTotal * STATION_OWNER_TRADE_CUT);

  if (cut <= 0) {
    return;
  }

  owner.credits = roundCredits(owner.credits + cut);
}

function buildStation(world: World, clientId: string, name: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Build failed: no player ship exists." };
  }

  if (player.credits < STATION_BUILD_COST) {
    return { accepted: false, message: "Build failed: not enough credits." };
  }

  player.credits = roundCredits(player.credits - STATION_BUILD_COST);

  const stationId = `station-${world.tick}-${clientId}`;
  const initialInventory: Record<string, number> = {};
  const priceMultipliers: Record<string, number> = {};

  for (const goodId of Object.keys(GOODS)) {
    initialInventory[goodId] = 0;
    priceMultipliers[goodId] = 1.0;
  }

  const station = {
    id: stationId,
    name,
    faction: "Neutral",
    health: 1.0,
    ownerClientId: clientId,
    planetType: "player_built" as const,
    position: { x: player.position.x, y: 0, z: player.position.z },
    blockade: false,
    incidents: [] as Array<{ attackerName: string; tick: number; type: "pirate_attack" }>,
    stores: [{
      id: `${stationId}-market`,
      name: `${name} Exchange`,
      credits: 1_000,
      inventory: initialInventory,
      priceMultipliers,
      prices: {} as Record<string, number>
    }]
  };

  world.planets.push(station);

  world.recentEvents.push({
    type: "station_built",
    message: `${player.name} built ${name} at ${formatPosition(player.position)}!`
  });

  player.locationPlanetId = stationId;

  return {
    accepted: true,
    message: `${player.name} built ${name} at ${formatPosition(player.position)} for ${STATION_BUILD_COST} credits.`
  };
}

function claimStation(world: World, clientId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Claim failed: no player ship exists." };
  }

  if (!player.locationPlanetId) {
    return { accepted: false, message: "Claim failed: must be docked at a station." };
  }

  const station = world.planets.find((p) => p.id === player.locationPlanetId);

  if (!station) {
    return { accepted: false, message: "Claim failed: station not found." };
  }

  if (station.ownerClientId) {
    const activity = world.clientActivity[station.ownerClientId];
    const isActive = activity && (Date.now() - activity.lastSeenAtMs) < CLIENT_ACTIVITY_TIMEOUT_MS * 3;

    if (isActive) {
      return { accepted: false, message: `Claim failed: ${station.name} already has an active owner.` };
    }
  }

  station.ownerClientId = clientId;
  station.faction = player.faction;

  world.recentEvents.push({
    type: "station_claimed",
    message: `${player.name} claimed ownership of ${station.name}!`
  });

  return {
    accepted: true,
    message: `${player.name} claimed ${station.name}.`
  };
}