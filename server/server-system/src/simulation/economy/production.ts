import {
  ECONOMY,
  FOOD_GOOD_ID,
  FUEL_GOOD_ID,
  URANUS_FACILITY_ID
} from "../world/constants.js";
import type { ProductionView, Store } from "../domain/types.js";

export function updateProduction(world: ProductionView): void {
  growEarthFood(world);
  refineUranusFuel(world);
}

function growEarthFood(world: ProductionView): void {
  const store = firstStore(world, "earth");

  if (!store) {
    return;
  }

  store.inventory[FOOD_GOOD_ID] = Math.min(
    ECONOMY.EARTH_FOOD_STOCK_LIMIT,
    (store.inventory[FOOD_GOOD_ID] ?? 0) + ECONOMY.EARTH_FOOD_PRODUCTION_PER_TICK
  );
}

function refineUranusFuel(world: ProductionView): void {
  const store = firstStore(world, URANUS_FACILITY_ID);

  if (!store) {
    return;
  }

  const food = store.inventory[FOOD_GOOD_ID] ?? 0;
  const fuel = store.inventory[FUEL_GOOD_ID] ?? 0;
  const fuelSpace = ECONOMY.URANUS_FUEL_STOCK_LIMIT - fuel;

  if (food < ECONOMY.URANUS_FOOD_CONSUMPTION_PER_TICK || fuelSpace <= 0) {
    return;
  }

  store.inventory[FOOD_GOOD_ID] = food - ECONOMY.URANUS_FOOD_CONSUMPTION_PER_TICK;
  store.inventory[FUEL_GOOD_ID] = fuel + Math.min(ECONOMY.URANUS_FUEL_PRODUCTION_PER_TICK, fuelSpace);
}

function firstStore(world: ProductionView, planetId: string): Store | null {
  return world.planets.find((planet) => planet.id === planetId)?.stores[0] ?? null;
}