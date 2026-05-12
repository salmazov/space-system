import type { Inventory, NpcShip, Planet, PlayerShip, Store, World } from "../domain/types.js";

export function cargoUsed(player: PlayerShip): number {
  return Object.values(player.cargo).reduce((sum, amount) => sum + amount, 0);
}

export function emptyCargo(world: World): Inventory {
  return Object.fromEntries(Object.keys(world.goods).map((goodId) => [goodId, 0]));
}

export function planetName(world: { planets: Planet[] }, planetId: string): string {
  return world.planets.find((planet) => planet.id === planetId)?.name ?? planetId;
}

export function playerForClient(world: World, clientId: string): PlayerShip | null {
  return world.players.find((player) => player.ownerClientId === clientId) ?? null;
}

export function serializePlayers(players: PlayerShip[]): PlayerShip[] {
  return players.map((player) => ({
    ...player,
    cargo: { ...player.cargo },
    destinationPosition: player.destinationPosition ? { ...player.destinationPosition } : null,
    exploredAreas: player.exploredAreas.map((area) => ({
      ...area,
      center: { ...area.center }
    })),
    position: { ...player.position },
    weapon: player.weapon ? { ...player.weapon } : null
  }));
}

export function serializeNpcShips(ships: NpcShip[]): NpcShip[] {
  return ships.map((ship) => ({
    ...ship,
    destinationPosition: ship.destinationPosition ? { ...ship.destinationPosition } : null,
    position: { ...ship.position },
    weapon: ship.weapon ? { ...ship.weapon } : null
  }));
}

export function storeAtPlanet(world: World, planetId: string): Store {
  const store = world.planets.find((planet) => planet.id === planetId)?.stores[0];

  if (!store) {
    throw new Error(`Store not found for planet ${planetId}`);
  }

  return store;
}