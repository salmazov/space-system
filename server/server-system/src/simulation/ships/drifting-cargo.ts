import type { CombatView, DriftingCargo, PlayerShip } from "../domain/types.js";
import { COMBAT } from "../world/constants.js";

export function dropPlayerCargo(world: CombatView, ship: PlayerShip): void {
  const items: Record<string, number> = {};

  for (const [item, qty] of Object.entries(ship.cargo)) {
    if (qty > 0) {
      items[item] = qty;
    }
  }

  if (Object.keys(items).length === 0) {
    return;
  }

  const drift: DriftingCargo = {
    cargo: items,
    createdAtTick: world.tick,
    id: `drift-${ship.id}-${world.tick}`,
    position: { ...ship.position }
  };

  world.driftingCargo.push(drift);

  const summary = Object.entries(items).map(([k, v]) => `${v} ${k}`).join(", ");
  world.recentEvents.push({
    type: "cargo_dropped",
    message: `${ship.name}'s cargo drifting in space: ${summary}.`
  });
}

export function pruneDriftingCargo(world: CombatView): void {
  world.driftingCargo = world.driftingCargo.filter(
    (c) => world.tick - c.createdAtTick <= COMBAT.DRIFTING_CARGO_TTL_TICKS
  );
}
