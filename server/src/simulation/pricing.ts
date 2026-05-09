import { clamp, roundCredits } from "./math.js";
import type { Inventory, Store, World } from "./types.js";

export function calculatePrices(world: World, store: Store): Inventory {
  const prices: Inventory = {};

  for (const [goodId, good] of Object.entries(world.goods)) {
    const stock = Math.max(1, store.inventory[goodId] ?? 0);
    const scarcity = good.targetStock / stock;
    const boundedScarcity = clamp(scarcity, 0.55, 2.75);

    prices[goodId] = roundCredits(good.basePrice * boundedScarcity);
  }

  return prices;
}