import type { MapPosition, PlayerShip, World } from "../domain/types.js";
import { clonePosition, distanceOnMap, nearestPlanetWithin } from "../map/geometry.js";
import { recordExploration } from "../map/exploration.js";
import { planetName } from "../world/selectors.js";

export function setShipDestination(world: World, player: PlayerShip, destination: MapPosition, destinationPlanetId: string | null): void {
  player.destinationPosition = clonePosition(destination);
  player.destinationPlanetId = destinationPlanetId;
  player.locationPlanetId = null;
}

export function updateShipMovement(world: World, nowMs = Date.now()): void {
  const elapsedSeconds = Math.max(0, (nowMs - world.lastMovementAtMs) / 1000);
  world.lastMovementAtMs = nowMs;

  if (elapsedSeconds <= 0) {
    return;
  }

  for (const player of world.players) {
    if (!player.destinationPosition) {
      continue;
    }

    advancePlayer(world, player, elapsedSeconds);
    recordExploration(player, world.tick);
  }
}

function advancePlayer(world: World, player: PlayerShip, elapsedSeconds: number): void {
  const destination = player.destinationPosition;

  if (!destination) {
    return;
  }

  const distance = distanceOnMap(player.position, destination);
  const travelDistance = player.speed * elapsedSeconds;

  if (distance <= travelDistance || distance < 0.001) {
    player.position = clonePosition(destination);
    arrive(world, player);
    return;
  }

  const amount = travelDistance / distance;
  player.position = {
    x: player.position.x + (destination.x - player.position.x) * amount,
    y: 0,
    z: player.position.z + (destination.z - player.position.z) * amount
  };
}

function arrive(world: World, player: PlayerShip): void {
  const destinationPlanetId = player.destinationPlanetId;

  player.destinationPosition = null;
  player.destinationPlanetId = null;

  if (destinationPlanetId) {
    player.locationPlanetId = destinationPlanetId;
    world.recentEvents.push({
      type: "ship_arrival",
      message: `${player.name} arrived at ${planetName(world, destinationPlanetId)}.`
    });
    return;
  }

  const planet = nearestPlanetWithin(world, player.position);
  player.locationPlanetId = planet?.id ?? null;

  world.recentEvents.push({
    type: "ship_arrival",
    message: planet ? `${player.name} docked at ${planet.name}.` : `${player.name} arrived at map coordinates.`
  });
}