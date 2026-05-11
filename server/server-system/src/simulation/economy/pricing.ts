import type { Inventory, Store, World } from "../domain/types.js";
import { roundCredits } from "../shared/math.js";

export function calculatePrices(world: World, store: Store): Inventory {
  const prices: Inventory = {};

  for (const [goodId, good] of Object.entries(world.goods)) {
    prices[goodId] = roundCredits(good.basePrice * (store.priceMultipliers[goodId] ?? 1));
  }

  return prices;
}