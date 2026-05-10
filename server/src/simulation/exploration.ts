import { clonePosition, distanceOnMap } from "./map.js";
import type { MapPosition, PlayerShip } from "./types.js";

export function isExplored(player: PlayerShip, position: MapPosition, extraRadius = 0): boolean {
  return player.exploredAreas.some((area) => distanceOnMap(area.center, position) <= area.radius + extraRadius);
}

export function recordExploration(player: PlayerShip, tick: number): void {
  const lastArea = player.exploredAreas.at(-1);

  if (lastArea && distanceOnMap(lastArea.center, player.position) < player.explorationRadius * 0.45) {
    return;
  }

  player.exploredAreas.push({
    center: clonePosition(player.position),
    radius: player.explorationRadius,
    visitedAtTick: tick
  });
}