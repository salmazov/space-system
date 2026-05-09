import { planetName } from "./selectors.js";
import type { World } from "./types.js";

export function updatePlayerTravel(world: World): void {
  if (!world.player?.destinationPlanetId) {
    return;
  }

  world.player.travelRemainingTicks = Math.max(0, world.player.travelRemainingTicks - 1);

  if (world.player.travelRemainingTicks === 0) {
    world.player.locationPlanetId = world.player.destinationPlanetId;
    world.player.destinationPlanetId = null;
    world.player.travelTotalTicks = 0;
    world.recentEvents.push({
      type: "ship_arrival",
      message: `${world.player.name} arrived at ${planetName(world, world.player.locationPlanetId)}.`
    });
  }
}