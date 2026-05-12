import type { PiracyView, PlayerShip, World } from "../domain/types.js";
import { clonePosition, distanceOnMap, nearestPlanetWithin } from "../map/geometry.js";
import {
  HAPPINESS_PIRATE_THRESHOLD,
  isPirateStation,
  PIRATE_WEAPON_DAMAGE
} from "../world/constants.js";

function isDockedAtPirateStation(world: PiracyView, player: PlayerShip): boolean {
  if (!player.locationPlanetId) {
    return false;
  }

  const planet = world.planets.find((p) => p.id === player.locationPlanetId);
  return planet ? isPirateStation(planet) : false;
}

export function updatePiracy(world: PiracyView): void {
  for (const player of world.players) {
    if (player.isPirate) {
      continue;
    }

    if (player.happiness >= HAPPINESS_PIRATE_THRESHOLD) {
      continue;
    }

    if (!isDockedAtPirateStation(world, player)) {
      continue;
    }

    convertToPirate(world, player);
  }
}

function convertToPirate(world: PiracyView, player: PlayerShip): void {
  player.isPirate = true;
  player.faction = "Outlaw";
  player.weapon = { damage: PIRATE_WEAPON_DAMAGE };
  player.happiness = 0.5;

  world.recentEvents.push({
    type: "pirate_conversion",
    message: `${player.name} turned pirate at the Pirate Station!`
  });
}

export function applyGoPirate(world: World, clientId: string): { accepted: boolean; message: string } {
  const player = world.players.find((p) => p.ownerClientId === clientId);

  if (!player) {
    return { accepted: false, message: "Go pirate failed: no player ship exists." };
  }

  if (player.isPirate) {
    return { accepted: false, message: "Go pirate failed: already a pirate." };
  }

  if (!isDockedAtPirateStation(world, player)) {
    return { accepted: false, message: "Go pirate failed: must be docked at a Pirate Station." };
  }

  convertToPirate(world, player);

  return {
    accepted: true,
    message: `${player.name} voluntarily turned pirate!`
  };
}
