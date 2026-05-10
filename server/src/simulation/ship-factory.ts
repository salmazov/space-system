import { STARTING_CREDITS } from "./constants.js";
import { recordExploration } from "./exploration.js";
import { clonePosition, planetPosition } from "./map.js";
import { emptyCargo } from "./selectors.js";
import { shipClassById } from "./ship-classes.js";
import type { PlayerShip, ShipClassId, World } from "./types.js";

export function createPlayerShip(
  world: World,
  ownerClientId: string,
  name: string,
  startPlanetId: string,
  shipClassId: ShipClassId
): PlayerShip {
  const shipClass = shipClassById(shipClassId);
  const startPosition = planetPosition(world, startPlanetId) ?? { x: 0, y: 0, z: 0 };
  const player: PlayerShip = {
    id: `player-ship-${world.players.length + 1}`,
    cargo: emptyCargo(world),
    cargoCapacity: shipClass.cargoCapacity,
    credits: STARTING_CREDITS,
    destinationPlanetId: null,
    destinationPosition: null,
    exploredAreas: [],
    explorationRadius: shipClass.explorationRadius,
    locationPlanetId: startPlanetId,
    name,
    ownerClientId,
    position: clonePosition(startPosition),
    priceEuro: shipClass.priceEuro,
    shipClassId,
    shipClassLabel: shipClass.label,
    speed: shipClass.speed,
    type: "player_ship"
  };

  recordExploration(player, world.tick);
  return player;
}