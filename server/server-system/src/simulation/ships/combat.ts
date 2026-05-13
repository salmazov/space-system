import type { CombatView, PlanetIncident, PlayerShip } from "../domain/types.js";
import { distanceOnMap, nearestPlanetWithin } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import {
  COMBAT,
  isPirateStation
} from "../world/constants.js";
import { dropPlayerCargo, pruneDriftingCargo } from "./drifting-cargo.js";
import { spawnPoliceShips } from "./police.js";

export function updateCombat(world: CombatView): void {
  resolvePirateAttacks(world);
  resolvePoliceAttacks(world);
  resolvePoliceVsStation(world);
  regenPirateStation(world);
  pruneDestroyedShips(world);
  pruneDestroyedPolice(world);
  pruneIncidents(world);
  pruneDriftingCargo(world);
  spawnPoliceShips(world);
}

function resolvePirateAttacks(world: CombatView): void {
  const pirates = world.players.filter((p) => p.isPirate);

  for (const pirate of pirates) {
    if (!pirate.weapon) {
      continue;
    }

    const targets = world.players.filter(
      (p) => !p.isPirate && p.ownerClientId !== pirate.ownerClientId && distanceOnMap(pirate.position, p.position) <= COMBAT.PIRATE_ATTACK_RANGE
    );

    for (const target of targets) {
      target.health = Math.max(0, roundCredits(target.health - pirate.weapon.damage));
      recordPirateIncident(world, pirate, target);

      world.recentEvents.push({
        type: "pirate_attack",
        message: `Pirate ${pirate.name} attacked ${target.name}! Health: ${(target.health * 100).toFixed(0)}%`
      });
    }

    const policeTargets = world.policeShips.filter(
      (p) => distanceOnMap(pirate.position, p.position) <= COMBAT.PIRATE_ATTACK_RANGE
    );

    for (const police of policeTargets) {
      police.health = Math.max(0, roundCredits(police.health - pirate.weapon.damage));
    }
  }
}

function resolvePoliceAttacks(world: CombatView): void {
  for (const police of world.policeShips) {
    if (!police.weapon) {
      continue;
    }

    const pirates = world.players.filter(
      (p) => p.isPirate && distanceOnMap(police.position, p.position) <= COMBAT.PIRATE_ATTACK_RANGE
    );

    for (const pirate of pirates) {
      pirate.health = Math.max(0, roundCredits(pirate.health - police.weapon.damage));

      world.recentEvents.push({
        type: "police_attack",
        message: `Police ${police.name} engaged pirate ${pirate.name}! Health: ${(pirate.health * 100).toFixed(0)}%`
      });
    }
  }
}

function recordPirateIncident(world: CombatView, pirate: PlayerShip, target: PlayerShip): void {
  const nearPlanet = nearestPlanetWithin(world, target.position, 8);

  if (!nearPlanet) {
    return;
  }

  const incident: PlanetIncident = {
    attackerName: pirate.name,
    tick: world.tick,
    type: "pirate_attack"
  };

  nearPlanet.incidents.push(incident);
}

function pruneDestroyedShips(world: CombatView): void {
  const destroyed = world.players.filter((p) => p.health <= 0);

  for (const ship of destroyed) {
    dropPlayerCargo(world, ship);
    world.recentEvents.push({
      type: "ship_destroyed",
      message: `${ship.name} was destroyed${ship.isPirate ? " (pirate)" : ""}!`
    });
  }

  world.players = world.players.filter((p) => p.health > 0);
}

function pruneDestroyedPolice(world: CombatView): void {
  const destroyed = world.policeShips.filter((p) => p.health <= 0);

  for (const ship of destroyed) {
    world.recentEvents.push({
      type: "police_destroyed",
      message: `Police ${ship.name} was destroyed!`
    });
  }

  world.policeShips = world.policeShips.filter((p) => p.health > 0);
}

function pruneIncidents(world: CombatView): void {
  for (const planet of world.planets) {
    planet.incidents = planet.incidents.filter(
      (incident) => world.tick - incident.tick <= COMBAT.PLANET_INCIDENT_TTL_TICKS
    );
  }
}

function resolvePoliceVsStation(world: CombatView): void {
  const stations = world.planets.filter((p) => isPirateStation(p) && p.health > 0);

  for (const station of stations) {
    for (const police of world.policeShips) {
      if (!police.weapon) {
        continue;
      }

      if (distanceOnMap(police.position, station.position) > COMBAT.PIRATE_ATTACK_RANGE) {
        continue;
      }

      station.health = Math.max(0, roundCredits(station.health - police.weapon.damage));

      world.recentEvents.push({
        type: "station_attack",
        message: `Police ${police.name} attacked ${station.name}! Station health: ${(station.health * 100).toFixed(0)}%`
      });
    }

    if (station.health <= 0) {
      world.recentEvents.push({
        type: "station_destroyed",
        message: `${station.name} has been destroyed! It will slowly rebuild...`
      });
    }
  }
}

function regenPirateStation(world: CombatView): void {
  for (const station of world.planets) {
    if (!isPirateStation(station)) {
      continue;
    }

    if (station.health >= 1.0) {
      continue;
    }

    station.health = Math.min(1.0, roundCredits(station.health + COMBAT.PIRATE_STATION_REGEN_PER_TICK));
  }
}
