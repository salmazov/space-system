import { PRODUCTION_RULES } from "../world/constants.js";
import type { ProductionView, Store } from "../domain/types.js";

export function updateProduction(world: ProductionView): void {
  for (const rule of PRODUCTION_RULES) {
    const store = firstStore(world, rule.planetId);
    if (!store) continue;

    if (rule.consumes && rule.consumesQty) {
      const available = store.inventory[rule.consumes] ?? 0;
      if (available < rule.consumesQty) continue;
      store.inventory[rule.consumes] = available - rule.consumesQty;
    }

    const current = store.inventory[rule.produces] ?? 0;
    store.inventory[rule.produces] = Math.min(rule.stockLimit, current + rule.producesQty);
  }
}

function firstStore(world: ProductionView, planetId: string): Store | null {
  return world.planets.find((planet) => planet.id === planetId)?.stores[0] ?? null;
}