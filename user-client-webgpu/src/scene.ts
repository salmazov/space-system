import type { SceneInstance } from "./renderer.js";
import { layoutPlanets, planetColor } from "./planet-layout.js";
import type { Vec2, WorldSnapshot } from "./types.js";

export interface SceneState {
  labels: Array<{ faction: string; name: string; position: Vec2 }>;
  planetPositions: Map<string, Vec2>;
  renderables: SceneInstance[];
  shipStatus: string;
}

export function buildScene(world: WorldSnapshot): SceneState {
  const planetPositions = layoutPlanets(world.planets);
  const planetRenderables = world.planets.map((planet) => ({
    color: planetColor(planet.id),
    position: planetPositions.get(planet.id) ?? { x: 0, y: 0 },
    shape: "circle" as const,
    size: { x: 1.25, y: 1.25 }
  }));
  const ship = shipInstance(world, planetPositions);

  return {
    labels: world.planets.map((planet) => ({
      faction: planet.faction,
      name: planet.name,
      position: planetPositions.get(planet.id) ?? { x: 0, y: 0 }
    })),
    planetPositions,
    renderables: ship ? [...planetRenderables, ship.instance] : planetRenderables,
    shipStatus: ship?.status ?? "Ship waiting for server spawn"
  };
}

export function nearestPlanet(world: Vec2, positions: Map<string, Vec2>): string | null {
  let nearest: { distance: number; id: string } | null = null;

  for (const [id, position] of positions) {
    const distance = Math.hypot(world.x - position.x, world.y - position.y);

    if (distance <= 1.75 && (!nearest || distance < nearest.distance)) {
      nearest = { distance, id };
    }
  }

  return nearest?.id ?? null;
}

function shipInstance(world: WorldSnapshot, positions: Map<string, Vec2>): { instance: SceneInstance; status: string } | null {
  const fallbackPlanet = world.planets[0]?.id;
  const ship = world.player;
  const fallbackPosition = fallbackPlanet ? offsetFromPlanet(positions.get(fallbackPlanet)) : null;
  const position = ship ? shipPosition(world, positions) : fallbackPosition;

  if (!position) {
    return null;
  }

  return {
    instance: {
      color: [1, 0.12, 0.1, 1],
      position,
      shape: "box",
      size: { x: 0.42, y: 0.42 }
    },
    status: shipStatus(world)
  };
}

function shipPosition(world: WorldSnapshot, positions: Map<string, Vec2>): Vec2 | null {
  const ship = world.player;

  if (!ship) {
    return null;
  }

  const from = positions.get(ship.locationPlanetId);

  if (!ship.destinationPlanetId) {
    return offsetFromPlanet(from);
  }

  const to = positions.get(ship.destinationPlanetId);

  if (!from || !to || ship.travelTotalTicks <= 0) {
    return offsetFromPlanet(from ?? to);
  }

  const progress = 1 - ship.travelRemainingTicks / ship.travelTotalTicks;
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress
  };
}

function offsetFromPlanet(position: Vec2 | undefined): Vec2 | null {
  return position ? { x: position.x, y: position.y - 1.9 } : null;
}

function shipStatus(world: WorldSnapshot): string {
  const ship = world.player;

  if (!ship) {
    return "Red box preview: ship will spawn when server accepts the action";
  }

  if (ship.destinationPlanetId) {
    return `${ship.name} traveling to ${planetName(world, ship.destinationPlanetId)}, ${ship.travelRemainingTicks} ticks left`;
  }

  return `${ship.name} docked at ${planetName(world, ship.locationPlanetId)}`;
}

function planetName(world: WorldSnapshot, planetId: string): string {
  return world.planets.find((planet) => planet.id === planetId)?.name ?? planetId;
}