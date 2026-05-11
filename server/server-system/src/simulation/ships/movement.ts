import type { MapPosition, PlayerShip, World } from "../domain/types.js";
import { clonePosition, distanceOnMap, nearestPlanetWithin } from "../map/geometry.js";
import { recordExploration } from "../map/exploration.js";
import { roundCredits } from "../shared/math.js";
import { planetName } from "../world/selectors.js";
import { broadcastSos } from "./sos.js";

export function setShipDestination(world: World, player: PlayerShip, destination: MapPosition, destinationPlanetId: string | null): void {
  player.destinationPosition = clonePosition(destination);
  player.destinationPlanetId = destinationPlanetId;
  player.locationPlanetId = null;
}

export function fuelRequiredForRoute(player: PlayerShip, destination: MapPosition): number {
  return roundCredits(distanceOnMap(player.position, destination) * player.fuelBurnPerUnit);
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
  const fuelLimitedDistance = player.fuelBurnPerUnit > 0 ? player.fuel / player.fuelBurnPerUnit : Number.POSITIVE_INFINITY;
  const travelDistance = Math.min(player.speed * elapsedSeconds, fuelLimitedDistance);

  if (travelDistance <= 0) {
    stopOutOfFuel(world, player);
    return;
  }

  player.fuel = Math.max(0, roundCredits(player.fuel - travelDistance * player.fuelBurnPerUnit));

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

  if (player.fuel <= 0) {
    stopOutOfFuel(world, player);
  }
}

function stopOutOfFuel(world: World, player: PlayerShip): void {
  player.destinationPosition = null;
  player.destinationPlanetId = null;
  player.locationPlanetId = null;
  broadcastSos(world, player);
  world.recentEvents.push({
    type: "ship_out_of_fuel",
    message: `${player.name} ran out of fuel at ${formatPosition(player.position)} and broadcast SOS.`
  });
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

function formatPosition(position: MapPosition): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}