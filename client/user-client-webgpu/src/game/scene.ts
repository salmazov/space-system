import { layoutPlanets, planetColor, planetScale } from "./planet-layout.js";
import type { SceneInstance } from "../engine/renderer.js";
import type { ExploredArea, PlayerShip, Vec3, WorldSnapshot } from "./types.js";
import { isExplored } from "./visibility.js";

export interface SceneState {
  labels: Array<{ detail?: string; fuel?: { current: number; capacity: number }; kind: "planet" | "ship"; name: string; position: Vec3 }>;
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
  const sosRenderables = (world.sosSignals ?? []).map((signal) => ({
    color: [1, 0.42, 0.03, 0.23] as [number, number, number, number],
    kind: "sos" as const,
    position: { x: signal.position.x, y: 0.04, z: signal.position.z },
    scale: signal.radius
  }));
  const planetRenderables = visiblePlanets.map((planet) => ({
    color: planetColor(planet.id),
    kind: "planet" as const,
    position: planet.position,
    scale: planetScale(planet.id)
  }));
  const visibleShips = world.players
    .map((player, index) => visibleShip(player, exploredAreas, player.ownerClientId === clientId, index))
    .filter((ship): ship is VisibleShip => Boolean(ship));

  return {
    labels: [
      ...visiblePlanets.map((planet) => ({
        detail: planet.faction,
        kind: "planet" as const,
        name: planet.name,
        position: abovePlanet(planet.position)
      })),
      ...visibleShips.map(({ player, position }) => ({
        detail: player.faction,
        fuel: { current: player.fuel, capacity: player.fuelCapacity },
        kind: "ship" as const,
        name: player.name,
        position: aboveShip(position)
      }))
    ],
    planetPositions,
    renderables: [...exploredRenderables, ...sosRenderables, ...planetRenderables, ...visibleShips.map((ship) => ship.instance)],
    shipStatus: ownedShip ? shipStatus(world, ownedShip) : "Red box preview: ship will spawn when server accepts the action"
  };
}

interface VisibleShip {
  instance: SceneInstance;
  player: PlayerShip;
  position: Vec3;
}

function visibleShip(player: PlayerShip, exploredAreas: ExploredArea[], isOwned: boolean, slot: number): VisibleShip | null {
  if (!isOwned && !isExplored(exploredAreas, player.position, 0.8)) {
    return null;
  }

  const position = renderShipPosition(player, slot);

  return {
    instance: {
      color: isOwned ? [1, 0.12, 0.1, 1] : shipColor(player),
      kind: "ship",
      position,
      scale: isOwned ? 0.42 : 0.34
    },
    player,
    position
  };
}

function shipColor(player: PlayerShip): [number, number, number, number] {
  switch (player.homePlanetId) {
    case "earth":
    case "luna":
      return [0.25, 0.65, 1, 1];
    case "mars":
      return [0.95, 0.22, 0.16, 1];
    case "jupiter":
      return [1, 0.62, 0.22, 1];
    case "saturn":
      return [0.9, 0.78, 0.36, 1];
    default:
      return [0.75, 0.9, 1, 1];
  }
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

function aboveShip(position: Vec3): Vec3 {
  return { x: position.x, y: 1.35, z: position.z };
}

function shipStatus(world: WorldSnapshot, ship: PlayerShip): string {
  const classSummary = `${ship.shipClassLabel}, ${ship.speed} units/s, fuel ${formatNumber(ship.fuel)}/${ship.fuelCapacity}, EUR ${ship.priceEuro}`;

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

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}