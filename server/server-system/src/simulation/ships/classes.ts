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
  },
  government_freighter: {
    id: "government_freighter",
    label: "Government Freighter",
    bulkDiscount: { minQty: 40, rate: 0.12 },
    cargoCapacity: 420,
    explorationRadius: 3.6,
    fuelBurnPerUnit: 0.92,
    fuelCapacity: 480,
    priceEuro: 5_500_000,
    speed: 0.13,
    startingCredits: 12_000,
    startingFuel: 220
  },
  police_ship: {
    id: "police_ship",
    label: "Police Ship",
    cargoCapacity: 8,
    explorationRadius: 4.0,
    fuelBurnPerUnit: 0.38,
    fuelCapacity: 80,
    priceEuro: 1_800_000,
    speed: 0.42,
    startingFuel: 60,
    weapon: { damage: 0.1 }
  },
  builder_ship: {
    id: "builder_ship",
    label: "Builder Ship",
    cargoCapacity: 60,
    explorationRadius: 3.5,
    fuelBurnPerUnit: 0.55,
    fuelCapacity: 100,
    priceEuro: 1_400_000,
    speed: 0.22,
    startingCredits: 2_000,
    startingFuel: 50
  }
};

export function shipClassById(shipClassId: ShipClassId): ShipClass {
  return SHIP_CLASSES[shipClassId];
}