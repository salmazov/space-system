import type { PlayerShip, ShipClassId, World } from "../domain/types.js";
import { clonePosition, planetPosition } from "../map/geometry.js";
import { recordExploration } from "../map/exploration.js";
import { STARTING_CREDITS } from "../world/constants.js";
import { HAPPINESS_INITIAL, HEALTH_INITIAL } from "../world/constants.js";
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
    credits: shipClass.startingCredits ?? STARTING_CREDITS,
    destinationPlanetId: null,
    destinationPosition: null,
    exploredAreas: [],
    explorationRadius: shipClass.explorationRadius,
    faction: startPlanet?.faction ?? "Independent",
    fuel: shipClass.startingFuel,
    fuelBurnPerUnit: shipClass.fuelBurnPerUnit,
    fuelCapacity: shipClass.fuelCapacity,
    happiness: HAPPINESS_INITIAL,
    health: HEALTH_INITIAL,
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