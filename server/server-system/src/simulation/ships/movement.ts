import type { MapPosition, MovementView, NpcShip, PlayerShip, Ship, World } from "../domain/types.js";
import { clonePosition, distanceOnMap, formatPosition, nearestPlanetWithin } from "../map/geometry.js";
import { recordExploration } from "../map/exploration.js";
import { completeMissionsForPlayer } from "../economy/missions.js";
import { roundCredits } from "../shared/math.js";
import { planetName } from "../world/selectors.js";
import { broadcastSos } from "./sos.js";
import { boostHappinessOnArrival, penalizeHappinessOutOfFuel } from "./happiness.js";

export function setShipDestination(world: World, player: PlayerShip, destination: MapPosition, destinationPlanetId: string | null): void {
  player.departedAtMs = Date.now();
  player.destinationPosition = clonePosition(destination);
  player.destinationPlanetId = destinationPlanetId;
  player.locationPlanetId = null;
}

export function fuelRequiredForRoute(ship: Ship, destination: MapPosition): number {
  return roundCredits(distanceOnMap(ship.position, destination) * ship.fuelBurnPerUnit);
}

export function updateShipMovement(world: MovementView, nowMs = Date.now()): void {
  const elapsedSeconds = Math.max(0, (nowMs - world.lastMovementAtMs) / 1000);
  world.lastMovementAtMs = nowMs;

  if (elapsedSeconds <= 0) {
    return;
  }

  for (const player of world.players) {
    if (!player.destinationPosition) {
      continue;
    }

    advanceShip(world, player, elapsedSeconds, {
      onOutOfFuel: () => stopPlayerOutOfFuel(world, player),
      onArrive: () => arrivePlayer(world, player)
    });
    recordExploration(player, world.tick);
  }

  for (const police of world.policeShips) {
    if (!police.destinationPosition) {
      continue;
    }

    advanceShip(world, police, elapsedSeconds, {
      onOutOfFuel: () => stopNpcOutOfFuel(police),
      onArrive: () => arriveNpc(world, police)
    });
  }
}

function advanceShip(
  world: MovementView,
  ship: Ship,
  elapsedSeconds: number,
  handlers: { onOutOfFuel: () => void; onArrive: () => void }
): void {
  const destination = ship.destinationPosition;

  if (!destination) {
    return;
  }

  const distance = distanceOnMap(ship.position, destination);
  const fuelLimitedDistance = ship.fuelBurnPerUnit > 0 ? ship.fuel / ship.fuelBurnPerUnit : Number.POSITIVE_INFINITY;
  const travelDistance = Math.min(ship.speed * elapsedSeconds, fuelLimitedDistance);

  if (travelDistance <= 0) {
    handlers.onOutOfFuel();
    return;
  }

  ship.fuel = Math.max(0, ship.fuel - travelDistance * ship.fuelBurnPerUnit);

  if (distance <= travelDistance || distance < 0.001) {
    ship.position = clonePosition(destination);
    handlers.onArrive();
    return;
  }

  const amount = travelDistance / distance;
  ship.position = {
    x: ship.position.x + (destination.x - ship.position.x) * amount,
    y: 0,
    z: ship.position.z + (destination.z - ship.position.z) * amount
  };

  if (ship.fuel <= 0) {
    handlers.onOutOfFuel();
  }
}

function stopPlayerOutOfFuel(world: MovementView, player: PlayerShip): void {
  player.departedAtMs = null;
  player.destinationPosition = null;
  player.destinationPlanetId = null;
  player.locationPlanetId = null;
  broadcastSos(world, player);
  penalizeHappinessOutOfFuel(player);
  world.recentEvents.push({
    type: "ship_out_of_fuel",
    message: `${player.name} ran out of fuel at ${formatPosition(player.position)} and broadcast SOS.`
  });
}

function stopNpcOutOfFuel(ship: NpcShip): void {
  ship.departedAtMs = null;
  ship.destinationPosition = null;
  ship.destinationPlanetId = null;
  ship.locationPlanetId = null;
}

function arrivePlayer(world: MovementView, player: PlayerShip): void {
  const destinationPlanetId = player.destinationPlanetId;

  player.departedAtMs = null;
  player.destinationPosition = null;
  player.destinationPlanetId = null;
  boostHappinessOnArrival(player);

  if (destinationPlanetId) {
    player.locationPlanetId = destinationPlanetId;
    completeMissionsOnArrival(world, player, destinationPlanetId);
    world.recentEvents.push({
      type: "ship_arrival",
      message: `${player.name} arrived at ${planetName(world, destinationPlanetId)}.`
    });
    return;
  }

  const planet = nearestPlanetWithin(world, player.position);
  player.locationPlanetId = planet?.id ?? null;

  if (planet) {
    completeMissionsOnArrival(world, player, planet.id);
  }

  world.recentEvents.push({
    type: "ship_arrival",
    message: planet ? `${player.name} docked at ${planet.name}.` : `${player.name} arrived at map coordinates.`
  });
}

function arriveNpc(world: MovementView, ship: NpcShip): void {
  const destinationPlanetId = ship.destinationPlanetId;

  ship.departedAtMs = null;
  ship.destinationPosition = null;
  ship.destinationPlanetId = null;

  if (destinationPlanetId) {
    ship.locationPlanetId = destinationPlanetId;
  } else {
    const planet = nearestPlanetWithin(world, ship.position);
    ship.locationPlanetId = planet?.id ?? null;
  }
}

function completeMissionsOnArrival(world: MovementView, player: PlayerShip, planetId: string): void {
  const { completed, totalReward } = completeMissionsForPlayer(world, player.ownerClientId, planetId, player.cargo);

  if (completed.length > 0) {
    player.credits = roundCredits(player.credits + totalReward);
    for (const mission of completed) {
      world.recentEvents.push({
        type: "mission_complete",
        message: `${player.name} completed mission "${mission.title}" for ${mission.reward} credits.`
      });
    }
  }
}