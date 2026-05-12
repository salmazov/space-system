import {
  EARTH_FOOD_PRODUCTION_PER_TICK,
  EARTH_FOOD_STOCK_LIMIT,
  FOOD_GOOD_ID,
  FUEL_GOOD_ID,
  URANUS_FACILITY_ID,
  URANUS_FOOD_CONSUMPTION_PER_TICK,
  URANUS_FUEL_PRODUCTION_PER_TICK,
  URANUS_FUEL_STOCK_LIMIT
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
    EARTH_FOOD_STOCK_LIMIT,
    (store.inventory[FOOD_GOOD_ID] ?? 0) + EARTH_FOOD_PRODUCTION_PER_TICK
  );
}

function refineUranusFuel(world: ProductionView): void {
  const store = firstStore(world, URANUS_FACILITY_ID);

  if (!store) {
    return;
  }

  const food = store.inventory[FOOD_GOOD_ID] ?? 0;
  const fuel = store.inventory[FUEL_GOOD_ID] ?? 0;
  const fuelSpace = URANUS_FUEL_STOCK_LIMIT - fuel;

  if (food < URANUS_FOOD_CONSUMPTION_PER_TICK || fuelSpace <= 0) {
    return;
  }

  store.inventory[FOOD_GOOD_ID] = food - URANUS_FOOD_CONSUMPTION_PER_TICK;
  store.inventory[FUEL_GOOD_ID] = fuel + Math.min(URANUS_FUEL_PRODUCTION_PER_TICK, fuelSpace);
}

function firstStore(world: ProductionView, planetId: string): Store | null {
  return world.planets.find((planet) => planet.id === planetId)?.stores[0] ?? null;
}