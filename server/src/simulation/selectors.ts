import { ROUTE_TRAVEL_TIMES } from "./constants.js";
import type { Inventory, PlayerShip, Store, World } from "./types.js";

export function cargoUsed(player: PlayerShip): number {
  return Object.values(player.cargo).reduce((sum, amount) => sum + amount, 0);
}

export function emptyCargo(world: World): Inventory {
  return Object.fromEntries(Object.keys(world.goods).map((goodId) => [goodId, 0]));
}

export function planetName(world: World, planetId: string): string {
  return world.planets.find((planet) => planet.id === planetId)?.name ?? planetId;
}

export function serializePlayer(player: PlayerShip | null): PlayerShip | null {
  return player ? { ...player, cargo: { ...player.cargo } } : null;
}

export function storeAtPlanet(world: World, planetId: string): Store {
  const store = world.planets.find((planet) => planet.id === planetId)?.stores[0];

  if (!store) {
    throw new Error(`Store not found for planet ${planetId}`);
  }

  return store;
}

export function travelTime(fromPlanetId: string, toPlanetId: string): number {
  const route = [fromPlanetId, toPlanetId].sort((left, right) => left.localeCompare(right)).join(":");
  return ROUTE_TRAVEL_TIMES[route] ?? 6;
}