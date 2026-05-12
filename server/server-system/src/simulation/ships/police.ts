import type { MapPosition, NpcShip, PlayerShip, PoliceMovementView } from "../domain/types.js";
import { clonePosition, distanceOnMap } from "../map/geometry.js";
import {
  POLICE_PATROL_RANGE,
  POLICE_PURSUIT_RANGE,
  POLICE_RETURN_FUEL_RATIO,
  isPirateStation
} from "../world/constants.js";

export function updatePoliceMovement(world: PoliceMovementView): void {
  for (const police of world.policeShips) {
    if (police.destinationPosition) {
      continue;
    }

    const target = choosePoliceBehavior(world, police);

    if (target) {
      police.destinationPosition = clonePosition(target.position);
      police.destinationPlanetId = target.planetId;
      police.locationPlanetId = null;
    }
  }

  refuelDockedPolice(world);
}

function choosePoliceBehavior(world: PoliceMovementView, police: NpcShip): { position: MapPosition; planetId: string | null } | null {
  const fuelRatio = police.fuelCapacity > 0 ? police.fuel / police.fuelCapacity : 0;

  if (fuelRatio <= POLICE_RETURN_FUEL_RATIO) {
    return returnHome(world, police);
  }

  const pursuitTarget = findPursuitTarget(world, police);

  if (pursuitTarget) {
    return { position: pursuitTarget.position, planetId: null };
  }

  return pickPatrolTarget(world, police);
}

function findPursuitTarget(world: PoliceMovementView, police: NpcShip): PlayerShip | null {
  let closest: { distance: number; pirate: PlayerShip } | null = null;

  for (const player of world.players) {
    if (!player.isPirate) {
      continue;
    }

    const dist = distanceOnMap(police.position, player.position);

    if (dist > POLICE_PURSUIT_RANGE) {
      continue;
    }

    if (!closest || dist < closest.distance) {
      closest = { distance: dist, pirate: player };
    }
  }

  return closest?.pirate ?? null;
}

function returnHome(world: PoliceMovementView, police: NpcShip): { position: MapPosition; planetId: string | null } | null {
  const homePlanet = world.planets.find((p) => p.id === police.homePlanetId);

  if (!homePlanet) {
    return null;
  }

  if (police.locationPlanetId === police.homePlanetId) {
    return null;
  }

  return { position: homePlanet.position, planetId: homePlanet.id };
}

function pickPatrolTarget(world: PoliceMovementView, police: NpcShip): { position: MapPosition; planetId: string | null } | null {
  if (police.locationPlanetId === police.homePlanetId) {
    return patrolNearbyPlanet(world, police);
  }

  if (police.locationPlanetId) {
    return returnHome(world, police);
  }

  return patrolNearbyPlanet(world, police);
}

function patrolNearbyPlanet(world: PoliceMovementView, police: NpcShip): { position: MapPosition; planetId: string | null } | null {
  const candidates = world.planets.filter((p) => {
    if (p.id === police.locationPlanetId) {
      return false;
    }

    if (isPirateStation(p)) {
      return false;
    }

    return distanceOnMap(police.position, p.position) <= POLICE_PATROL_RANGE;
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.incidents.length - a.incidents.length);

  const bestTarget = candidates[0];

  if (!bestTarget) {
    return null;
  }

  return { position: bestTarget.position, planetId: bestTarget.id };
}

function refuelDockedPolice(world: PoliceMovementView): void {
  for (const police of world.policeShips) {
    if (!police.locationPlanetId) {
      continue;
    }

    if (police.fuel >= police.fuelCapacity) {
      continue;
    }

    police.fuel = police.fuelCapacity;
  }
}
