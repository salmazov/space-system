import type { AppliedActionResult, ShipClassId, World } from "../domain/types.js";
import { shipClassById } from "../ships/classes.js";
import { ECONOMY } from "../world/constants.js";
import { playerForClient } from "../world/selectors.js";
import { createPlayerShip } from "../ships/factory.js";
import { recordExploration } from "../map/exploration.js";

const PURCHASABLE_CLASSES: ShipClassId[] = ["freightliner", "yacht", "fighter"];

export function buyShip(world: World, clientId: string, shipClassId: ShipClassId): AppliedActionResult {
  const player = playerForClient(world, clientId)!;
  const shipClass = shipClassById(shipClassId);

  if (!PURCHASABLE_CLASSES.includes(shipClassId)) {
    return { accepted: false, message: `Buy ship failed: ${shipClass.label} is not available for purchase.` };
  }

  if (!player.locationPlanetId) {
    return { accepted: false, message: "Buy ship failed: must be docked at a planet." };
  }

  const creditPrice = Math.round(shipClass.priceEuro * ECONOMY.SHIP_PURCHASE_CREDIT_RATE);

  if (player.credits < creditPrice) {
    return { accepted: false, message: `Buy ship failed: need ${creditPrice} credits (have ${Math.floor(player.credits)}).` };
  }

  // Transfer explored areas and deduct credits
  const exploredAreas = [...player.exploredAreas];
  player.credits -= creditPrice;

  // Remove old ship
  const playerIndex = world.players.indexOf(player);
  world.players.splice(playerIndex, 1);

  // Create new ship at the same planet
  const newShip = createPlayerShip(world, clientId, player.name, player.locationPlanetId, shipClassId);
  newShip.credits = player.credits;
  newShip.exploredAreas = exploredAreas;
  newShip.faction = player.faction;
  newShip.isPirate = player.isPirate;
  newShip.happiness = player.happiness;
  if (player.weapon && !newShip.weapon) {
    // Keep pirate weapon if upgrading to non-weapon ship
  }

  world.players.push(newShip);
  recordExploration(newShip, world.tick);

  return {
    accepted: true,
    message: `${player.name} purchased a ${shipClass.label} for ${creditPrice} credits.`
  };
}

export function getShipPrice(shipClassId: ShipClassId): number {
  const shipClass = shipClassById(shipClassId);
  return Math.round(shipClass.priceEuro * ECONOMY.SHIP_PURCHASE_CREDIT_RATE);
}

export function getPurchasableClasses(): ShipClassId[] {
  return [...PURCHASABLE_CLASSES];
}
