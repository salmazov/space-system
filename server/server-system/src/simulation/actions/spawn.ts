import type { AppliedActionResult, ShipClassId, World } from "../domain/types.js";
import { createPlayerShip } from "../ships/factory.js";
import { planetName, playerForClient } from "../world/selectors.js";

export function spawnPlayerShip(
  world: World,
  clientId: string,
  target: string,
  name: string,
  shipClassId: ShipClassId
): AppliedActionResult {
  if (playerForClient(world, clientId)) {
    return { accepted: false, message: "Spawn failed: this client already has a player ship." };
  }

  const player = createPlayerShip(world, clientId, name, target, shipClassId);
  world.players.push(player);

  return {
    accepted: true,
    message: `${player.name} spawned a ${player.shipClassLabel} at ${planetName(world, target)}.`
  };
}
