import { layoutPlanets, planetColor } from "./planet-layout.js";
import type { SceneInstance } from "./renderer.js";
import type { ExploredArea, PlayerShip, Vec3, WorldSnapshot } from "./types.js";
import { isExplored } from "./visibility.js";

export interface SceneState {
  labels: Array<{ faction: string; name: string; position: Vec3 }>;
  planetPositions: Map<string, Vec3>;
  renderables: SceneInstance[];
  shipStatus: string;
}

export function buildScene(world: WorldSnapshot, clientId: string): SceneState {
  const ownedShip = world.players.find((player) => player.ownerClientId === clientId) ?? null;
  const exploredAreas = ownedShip?.exploredAreas ?? [];
  const planetPositions = layoutPlanets(world.planets);
  const visiblePlanets = ownedShip ? world.planets.filter((planet) => isExplored(exploredAreas, planet.position, 1.4)) : [];
  const exploredRenderables = exploredAreas.map((area) => ({
    color: [0.05, 0.13, 0.17, 1] as [number, number, number, number],
    kind: "explored" as const,
    position: { x: area.center.x, y: 0.02, z: area.center.z },
    scale: area.radius
  }));
  const planetRenderables = visiblePlanets.map((planet) => ({
    color: planetColor(planet.id),
    kind: "planet" as const,
    position: planet.position,
    scale: 1.25
  }));
  const shipRenderables = world.players
    .map((player, index) => shipInstance(player, exploredAreas, player.ownerClientId === clientId, index))
    .filter((instance): instance is SceneInstance => Boolean(instance));

  return {
    labels: visiblePlanets.map((planet) => ({
      faction: planet.faction,
      name: planet.name,
      position: abovePlanet(planet.position)
    })),
    planetPositions,
    renderables: [...exploredRenderables, ...planetRenderables, ...shipRenderables],
    shipStatus: ownedShip ? shipStatus(world, ownedShip) : "Red box preview: ship will spawn when server accepts the action"
  };
}

function shipInstance(player: PlayerShip, exploredAreas: ExploredArea[], isOwned: boolean, slot: number): SceneInstance | null {
  if (!isOwned && !isExplored(exploredAreas, player.position, 0.8)) {
    return null;
  }

  return {
    color: isOwned ? [1, 0.12, 0.1, 1] : [0.25, 0.65, 1, 1],
    kind: "ship",
    position: renderShipPosition(player, slot),
    scale: isOwned ? 0.42 : 0.34
  };
}

function renderShipPosition(player: PlayerShip, slot: number): Vec3 {
  if (player.destinationPosition) {
    return { x: player.position.x, y: 0.78, z: player.position.z };
  }

  const angle = -Math.PI / 2 + slot * 1.2;
  return {
    x: player.position.x + Math.cos(angle) * 0.75,
    y: 0.78,
    z: player.position.z + Math.sin(angle) * 0.75
  };
}

function abovePlanet(position: Vec3): Vec3 {
  return { x: position.x, y: 1.85, z: position.z };
}

function shipStatus(world: WorldSnapshot, ship: PlayerShip): string {
  const classSummary = `${ship.shipClassLabel}, ${ship.speed} units/s, EUR ${ship.priceEuro}`;

  if (ship.destinationPosition) {
    const destination = ship.destinationPlanetId ? planetName(world, ship.destinationPlanetId) : formatPosition(ship.destinationPosition);
    return `${ship.name} moving to ${destination} (${classSummary})`;
  }

  const location = ship.locationPlanetId ? planetName(world, ship.locationPlanetId) : formatPosition(ship.position);
  return `${ship.name} at ${location} (${classSummary}); explored ${ship.exploredAreas.length} sectors`;
}

function formatPosition(position: Vec3): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}

function planetName(world: WorldSnapshot, planetId: string): string {
  return world.planets.find((planet) => planet.id === planetId)?.name ?? planetId;
}