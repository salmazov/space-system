import type { AppliedActionResult, MapPosition, PlayerShip, World } from "../domain/types.js";
import { planetPosition } from "../map/geometry.js";
import { fuelRequiredForRoute, setShipDestination } from "../ships/movement.js";
import { broadcastSos, canBroadcastSos } from "../ships/sos.js";
import { planetName, playerForClient } from "../world/selectors.js";

export function startFreeMove(world: World, clientId: string, target: MapPosition): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Move failed: no player ship exists." };
  }

  const fuelRequired = fuelRequiredForRoute(player, target);

  if (player.fuel < fuelRequired) {
    maybeBroadcastLowFuelSos(world, player);
    return { accepted: false, message: `Move failed: ${player.name} needs ${fuelRequired} fuel for that route.` };
  }

  setShipDestination(world, player, target, null);

  return {
    accepted: true,
    message: `${player.name} started moving to ${formatPosition(target)}.`
  };
}

export function startTravel(world: World, clientId: string, target: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "Travel failed: no player ship exists." };
  }

  const destination = planetPosition(world, target);

  if (!destination) {
    return { accepted: false, message: "Travel failed: target planet does not exist." };
  }

  const fuelRequired = fuelRequiredForRoute(player, destination);

  if (player.fuel < fuelRequired) {
    maybeBroadcastLowFuelSos(world, player);
    return { accepted: false, message: `Travel failed: ${player.name} needs ${fuelRequired} fuel to reach ${planetName(world, target)}.` };
  }

  setShipDestination(world, player, destination, target);

  return {
    accepted: true,
    message: `${player.name} started traveling to ${planetName(world, target)}.`
  };
}

export function maybeBroadcastLowFuelSos(world: World, player: PlayerShip): void {
  if (canBroadcastSos(player)) {
    broadcastSos(world, player);
  }
}

function formatPosition(position: MapPosition): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}
