import type { AppliedActionResult, World } from "../domain/types.js";
import { cargoUsed, playerForClient } from "../world/selectors.js";

export function pickupCargo(world: World, clientId: string, cargoId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Pickup failed: no player ship exists." };
  }

  const driftIndex = world.driftingCargo.findIndex((c) => c.id === cargoId);
  const drift = driftIndex >= 0 ? world.driftingCargo[driftIndex] : null;

  if (!drift) {
    return { accepted: false, message: "Pickup failed: drifting cargo not found." };
  }
  const usedCargo = cargoUsed(player);
  const freeSpace = player.cargoCapacity - usedCargo;
  let pickedUp = 0;

  for (const [item, qty] of Object.entries(drift.cargo)) {
    if (freeSpace - pickedUp <= 0) {
      break;
    }

    const take = Math.min(qty, freeSpace - pickedUp);
    player.cargo[item] = (player.cargo[item] ?? 0) + take;
    drift.cargo[item] = (drift.cargo[item] ?? 0) - take;
    pickedUp += take;
  }

  // Remove empty items from drift
  for (const [item, qty] of Object.entries(drift.cargo)) {
    if (qty <= 0) {
      delete drift.cargo[item];
    }
  }

  // Remove drift if fully picked up
  if (Object.keys(drift.cargo).length === 0) {
    world.driftingCargo.splice(driftIndex, 1);
  }

  if (pickedUp === 0) {
    return { accepted: false, message: "Pickup failed: cargo hold is full." };
  }

  return {
    accepted: true,
    message: `${player.name} picked up ${pickedUp} units of drifting cargo.`
  };
}
