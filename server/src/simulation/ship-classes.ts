import type { ShipClass, ShipClassCatalog, ShipClassId } from "./types.js";

export const DEFAULT_SHIP_CLASS_ID: ShipClassId = "small_trade_ship";

export const SHIP_CLASSES: ShipClassCatalog = {
  small_trade_ship: {
    id: "small_trade_ship",
    label: "Small Trade Ship",
    cargoCapacity: 40,
    explorationRadius: 3.2,
    priceEuro: 120_000,
    speed: 3.2
  },
  freightliner: {
    id: "freightliner",
    label: "Freightliner",
    cargoCapacity: 120,
    explorationRadius: 2.8,
    priceEuro: 850_000,
    speed: 1.7
  },
  yacht: {
    id: "yacht",
    label: "Yacht",
    cargoCapacity: 12,
    explorationRadius: 4.2,
    priceEuro: 2_200_000,
    speed: 4.8
  }
};

export function shipClassById(shipClassId: ShipClassId): ShipClass {
  return SHIP_CLASSES[shipClassId];
}