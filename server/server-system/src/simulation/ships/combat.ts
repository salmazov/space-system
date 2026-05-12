import type { CombatView, DriftingCargo, NpcShip, PlanetIncident, PlayerShip, Ship, World } from "../domain/types.js";
import { distanceOnMap, nearestPlanetWithin } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import {
  DRIFTING_CARGO_TTL_TICKS,
  PIRATE_ATTACK_RANGE,
  isPirateStation,
  PIRATE_STATION_REGEN_PER_TICK,
  PLANET_INCIDENT_TTL_TICKS,
  POLICE_SPAWN_COST,
  POLICE_SPAWN_INCIDENT_THRESHOLD
} from "../world/constants.js";
import { shipClassById } from "./classes.js";
import { createNpcShip } from "./factory.js";

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
      (p) => !p.isPirate && p.ownerClientId !== pirate.ownerClientId && distanceOnMap(pirate.position, p.position) <= PIRATE_ATTACK_RANGE
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
      (p) => distanceOnMap(pirate.position, p.position) <= PIRATE_ATTACK_RANGE
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
      (p) => p.isPirate && distanceOnMap(police.position, p.position) <= PIRATE_ATTACK_RANGE
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

function dropPlayerCargo(world: CombatView, ship: PlayerShip): void {
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

function pruneIncidents(world: CombatView): void {
  for (const planet of world.planets) {
    planet.incidents = planet.incidents.filter(
      (incident) => world.tick - incident.tick <= PLANET_INCIDENT_TTL_TICKS
    );
  }
}

function spawnPoliceShips(world: CombatView): void {
  for (const planet of world.planets) {
    if (isPirateStation(planet)) {
      continue;
    }

    const recentIncidents = planet.incidents.length;

    if (recentIncidents < POLICE_SPAWN_INCIDENT_THRESHOLD) {
      continue;
    }

    const existingPolice = world.policeShips.filter(
      (p) => p.homePlanetId === planet.id
    );

    if (existingPolice.length >= 2) {
      continue;
    }

    const store = planet.stores[0];

    if (!store || store.credits < POLICE_SPAWN_COST) {
      continue;
    }

    store.credits = roundCredits(store.credits - POLICE_SPAWN_COST);

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
      message: `${planet.name} deployed ${police.name} to patrol against pirates! (${POLICE_SPAWN_COST} credits)`
    });
  }
}

function resolvePoliceVsStation(world: CombatView): void {
  const stations = world.planets.filter((p) => isPirateStation(p) && p.health > 0);

  for (const station of stations) {
    for (const police of world.policeShips) {
      if (!police.weapon) {
        continue;
      }

      if (distanceOnMap(police.position, station.position) > PIRATE_ATTACK_RANGE) {
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

    station.health = Math.min(1.0, roundCredits(station.health + PIRATE_STATION_REGEN_PER_TICK));
  }
}

function pruneDriftingCargo(world: CombatView): void {
  world.driftingCargo = world.driftingCargo.filter(
    (c) => world.tick - c.createdAtTick <= DRIFTING_CARGO_TTL_TICKS
  );
}
