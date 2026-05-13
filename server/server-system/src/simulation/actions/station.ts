import type { AppliedActionResult, World } from "../domain/types.js";
import { formatPosition } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import { GOODS, STATION } from "../world/constants.js";
import { isOwnerActive } from "../world/presence.js";
import { playerForClient } from "../world/selectors.js";

export function buildStation(world: World, clientId: string, name: string): AppliedActionResult {
  const player = playerForClient(world, clientId)!;

  if (player.credits < STATION.BUILD_COST) {
    return { accepted: false, message: "Build failed: not enough credits." };
  }

  player.credits = roundCredits(player.credits - STATION.BUILD_COST);

  const stationId = `station-${world.tick}-${clientId}`;
  const initialInventory: Record<string, number> = {};
  const priceMultipliers: Record<string, number> = {};

  for (const goodId of Object.keys(GOODS)) {
    initialInventory[goodId] = 0;
    priceMultipliers[goodId] = 1.0;
  }

  const station = {
    id: stationId,
    name,
    faction: "Neutral",
    health: 1.0,
    ownerClientId: clientId,
    planetType: "player_built" as const,
    position: { x: player.position.x, y: 0, z: player.position.z },
    blockade: false,
    incidents: [] as Array<{ attackerName: string; tick: number; type: "pirate_attack" }>,
    stores: [{
      id: `${stationId}-market`,
      name: `${name} Exchange`,
      credits: 1_000,
      inventory: initialInventory,
      priceMultipliers,
      prices: {} as Record<string, number>
    }]
  };

  world.planets.push(station);

  world.recentEvents.push({
    type: "station_built",
    message: `${player.name} built ${name} at ${formatPosition(player.position)}!`
  });

  player.locationPlanetId = stationId;

  return {
    accepted: true,
    message: `${player.name} built ${name} at ${formatPosition(player.position)} for ${STATION.BUILD_COST} credits.`
  };
}

export function claimStation(world: World, clientId: string): AppliedActionResult {
  const player = playerForClient(world, clientId)!;

  if (!player.locationPlanetId) {
    return { accepted: false, message: "Claim failed: must be docked at a station." };
  }

  const station = world.planets.find((p) => p.id === player.locationPlanetId);

  if (!station) {
    return { accepted: false, message: "Claim failed: station not found." };
  }

  if (station.ownerClientId) {
    if (isOwnerActive(world, station.ownerClientId)) {
      return { accepted: false, message: `Claim failed: ${station.name} already has an active owner.` };
    }
  }

  station.ownerClientId = clientId;
  station.faction = player.faction;

  world.recentEvents.push({
    type: "station_claimed",
    message: `${player.name} claimed ownership of ${station.name}!`
  });

  return {
    accepted: true,
    message: `${player.name} claimed ${station.name}.`
  };
}
