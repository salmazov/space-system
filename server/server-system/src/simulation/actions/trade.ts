import type { AppliedActionResult, PlayerShip, World } from "../domain/types.js";
import { calculatePrices } from "../economy/pricing.js";
import { roundCredits } from "../shared/math.js";
import { shipClassById } from "../ships/classes.js";
import { boostHappinessOnTrade } from "../ships/happiness.js";
import { clearSosForClient } from "../ships/sos.js";
import { FUEL_GOOD_ID, ECONOMY, SOS } from "../world/constants.js";
import { cargoUsed, playerForClient, storeAtPlanet } from "../world/selectors.js";

export function buyGood(world: World, clientId: string, item: string, qty: number): AppliedActionResult {
  const player = playerForClient(world, clientId)!;
  const store = storeAtPlanet(world, player.locationPlanetId!);
  const price = store.prices[item] ?? calculatePrices(world, store)[item] ?? 0;
  const unitPrice = buyUnitPrice(player, price, qty);
  const total = roundCredits(unitPrice * qty);
  const availableCapacity = item === FUEL_GOOD_ID ? player.fuelCapacity - player.fuel : player.cargoCapacity - cargoUsed(player);

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
    if (player.fuel >= SOS.FUEL_TARGET_LEVEL) {
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

export function sellGood(world: World, clientId: string, item: string, qty: number): AppliedActionResult {
  const player = playerForClient(world, clientId)!;
  const store = storeAtPlanet(world, player.locationPlanetId!);
  const price = store.prices[item] ?? calculatePrices(world, store)[item] ?? 0;
  const total = roundCredits(price * qty);

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

function buyUnitPrice(player: PlayerShip, price: number, qty: number): number {
  const discount = shipClassById(player.shipClassId).bulkDiscount;

  if (!discount || qty < discount.minQty) {
    return price;
  }

  return roundCredits(price * (1 - discount.rate));
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

  const cut = roundCredits(tradeTotal * ECONOMY.STATION_OWNER_TRADE_CUT);

  if (cut <= 0) {
    return;
  }

  owner.credits = roundCredits(owner.credits + cut);
}
