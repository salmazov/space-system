import type { CombatView, MapPosition, NpcShip, PlayerShip, PoliceMovementView } from "../domain/types.js";
import { clonePosition, distanceOnMap } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import {
  COMBAT,
  POLICE,
  isPirateStation
} from "../world/constants.js";
import { createNpcShip } from "./factory.js";

export function updatePoliceMovement(world: PoliceMovementView): void {
  for (const police of world.policeShips) {
    if (police.destinationPosition) {
      continue;
    }

    const target = choosePoliceBehavior(world, police);

    if (target) {
      police.departedAtMs = Date.now();
      police.destinationPosition = clonePosition(target.position);
      police.destinationPlanetId = target.planetId;
      police.locationPlanetId = null;
    }
  }

  refuelDockedPolice(world);
}

function choosePoliceBehavior(world: PoliceMovementView, police: NpcShip): { position: MapPosition; planetId: string | null } | null {
  const fuelRatio = police.fuelCapacity > 0 ? police.fuel / police.fuelCapacity : 0;

  if (fuelRatio <= POLICE.RETURN_FUEL_RATIO) {
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

    if (dist > POLICE.PURSUIT_RANGE) {
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

    return distanceOnMap(police.position, p.position) <= POLICE.PATROL_RANGE;
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

export function spawnPoliceShips(world: CombatView): void {
  for (const planet of world.planets) {
    if (isPirateStation(planet)) {
      continue;
    }

    const recentIncidents = planet.incidents.length;

    if (recentIncidents < COMBAT.POLICE_SPAWN_INCIDENT_THRESHOLD) {
      continue;
    }

    const existingPolice = world.policeShips.filter(
      (p) => p.homePlanetId === planet.id
    );

    if (existingPolice.length >= 2) {
      continue;
    }

    const store = planet.stores[0];

    if (!store || store.credits < COMBAT.POLICE_SPAWN_COST) {
      continue;
    }

    store.credits = roundCredits(store.credits - COMBAT.POLICE_SPAWN_COST);

    const police = createNpcShip(
      world,
      `police-${planet.id}-${world.tick}`,
      `${planet.name} Police ${existingPolice.length + 1}`,
      planet.id,
      "police_ship",
      "police"
    );

    police.faction = planet.faction;
    world.policeShips.push(police);

    world.recentEvents.push({
      type: "police_spawned",
      message: `${planet.name} deployed ${police.name} to patrol against pirates! (${COMBAT.POLICE_SPAWN_COST} credits)`
    });
  }
}
