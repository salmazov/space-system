import type { MapPosition, Planet, World } from "../domain/types.js";

export const DOCKING_RADIUS = 1.6;

export function clonePosition(position: MapPosition): MapPosition {
  return { x: position.x, y: position.y, z: position.z };
}

export function distanceOnMap(left: MapPosition, right: MapPosition): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

export function nearestPlanetWithin(world: World, position: MapPosition, radius = DOCKING_RADIUS): Planet | null {
  let nearest: { distance: number; planet: Planet } | null = null;

  for (const planet of world.planets) {
    const distance = distanceOnMap(position, planet.position);

    if (distance <= radius && (!nearest || distance < nearest.distance)) {
      nearest = { distance, planet };
    }
  }

  return nearest?.planet ?? null;
}

export function planetPosition(world: World, planetId: string): MapPosition | null {
  const planet = world.planets.find((candidate) => candidate.id === planetId);
  return planet ? clonePosition(planet.position) : null;
}