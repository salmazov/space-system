import type { NpcShip, NpcShipRole, Planet, PlayerShip, ShipClassId, World } from "../domain/types.js";
import { clonePosition, planetPosition } from "../map/geometry.js";
import { recordExploration } from "../map/exploration.js";
import { ECONOMY, HAPPINESS } from "../world/constants.js";
import { emptyCargo } from "../world/selectors.js";
import { shipClassById } from "./classes.js";

export function createPlayerShip(
  world: World,
  ownerClientId: string,
  name: string,
  startPlanetId: string,
  shipClassId: ShipClassId
): PlayerShip {
  const shipClass = shipClassById(shipClassId);
  const startPlanet = world.planets.find((planet) => planet.id === startPlanetId);
  const startPosition = planetPosition(world, startPlanetId) ?? { x: 0, y: 0, z: 0 };
  const player: PlayerShip = {
    id: `player-ship-${world.players.length + 1}`,
    cargo: emptyCargo(world),
    cargoCapacity: shipClass.cargoCapacity,
    credits: shipClass.startingCredits ?? ECONOMY.STARTING_CREDITS,
    departedAtMs: null,
    destinationPlanetId: null,
    destinationPosition: null,
    exploredAreas: [],
    explorationRadius: shipClass.explorationRadius,
    faction: startPlanet?.faction ?? "Independent",
    fuel: shipClass.startingFuel,
    fuelBurnPerUnit: shipClass.fuelBurnPerUnit,
    fuelCapacity: shipClass.fuelCapacity,
    happiness: HAPPINESS.INITIAL,
    health: HAPPINESS.HEALTH_INITIAL,
    homePlanetId: startPlanetId,
    isPirate: false,
    locationPlanetId: startPlanetId,
    name,
    ownerClientId,
    position: clonePosition(startPosition),
    priceEuro: shipClass.priceEuro,
    shipClassId,
    shipClassLabel: shipClass.label,
    speed: shipClass.speed,
    type: "player_ship",
    weapon: shipClass.weapon ?? null
  };

  recordExploration(player, world.tick);
  return player;
}

export function createNpcShip(
  world: { planets: Planet[] },
  id: string,
  name: string,
  startPlanetId: string,
  shipClassId: ShipClassId,
  role: NpcShipRole
): NpcShip {
  const shipClass = shipClassById(shipClassId);
  const startPlanet = world.planets.find((planet) => planet.id === startPlanetId);
  const startPosition = planetPosition(world, startPlanetId) ?? { x: 0, y: 0, z: 0 };

  return {
    id,
    departedAtMs: null,
    destinationPlanetId: null,
    destinationPosition: null,
    faction: startPlanet?.faction ?? "Independent",
    fuel: shipClass.startingFuel,
    fuelBurnPerUnit: shipClass.fuelBurnPerUnit,
    fuelCapacity: shipClass.fuelCapacity,
    health: HAPPINESS.HEALTH_INITIAL,
    homePlanetId: startPlanetId,
    locationPlanetId: startPlanetId,
    name,
    position: clonePosition(startPosition),
    speed: shipClass.speed,
    weapon: shipClass.weapon ?? null,
    role
  };
}