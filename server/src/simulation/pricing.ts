import { roundCredits } from "./math.js";
import type { Inventory, Store, World } from "./types.js";

export function calculatePrices(world: World, store: Store): Inventory {
  const prices: Inventory = {};

  for (const [goodId, good] of Object.entries(world.goods)) {
    const stock = store.inventory[goodId] ?? 0;
    const scarcity = stock > 0 ? good.targetStock / stock : good.targetStock;

    prices[goodId] = roundCredits(good.basePrice * scarcity);
  }

  return prices;
}