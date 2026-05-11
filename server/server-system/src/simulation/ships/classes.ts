import type { ShipClass, ShipClassCatalog, ShipClassId } from "../domain/types.js";

export const DEFAULT_SHIP_CLASS_ID: ShipClassId = "small_trade_ship";

export const SHIP_CLASSES: ShipClassCatalog = {
  small_trade_ship: {
    id: "small_trade_ship",
    label: "Small Trade Ship",
    cargoCapacity: 40,
    explorationRadius: 3.2,
    fuelBurnPerUnit: 0.42,
    fuelCapacity: 60,
    priceEuro: 120_000,
    speed: 0.32,
    startingFuel: 30
  },
  freightliner: {
    id: "freightliner",
    label: "Freightliner",
    cargoCapacity: 120,
    explorationRadius: 2.8,
    fuelBurnPerUnit: 0.78,
    fuelCapacity: 140,
    priceEuro: 850_000,
    speed: 0.17,
    startingFuel: 70
  },
  yacht: {
    id: "yacht",
    label: "Yacht",
    cargoCapacity: 12,
    explorationRadius: 4.2,
    fuelBurnPerUnit: 0.32,
    fuelCapacity: 42,
    priceEuro: 2_200_000,
    speed: 0.48,
    startingFuel: 24
  }
};

export function shipClassById(shipClassId: ShipClassId): ShipClass {
  return SHIP_CLASSES[shipClassId];
}