import { TICK_MS, GOODS, PLANET_TEMPLATES } from "./constants.js";
import { serializePlayers } from "./selectors.js";
import { processPendingActions } from "../actions/queue.js";
import type { Planet, Store, World, WorldSnapshot } from "../domain/types.js";
import { calculatePrices } from "../economy/pricing.js";
import { clonePosition } from "../map/geometry.js";
import { SHIP_CLASSES } from "../ships/classes.js";
import { updateShipMovement } from "../ships/movement.js";

export function createWorld(): World {
  return {
    tick: 0,
    tickMs: TICK_MS,
    goods: GOODS,
    lastMovementAtMs: Date.now(),
    players: [],
    pendingActions: [],
    nextActionId: 1,
    planets: PLANET_TEMPLATES.map(createPlanet),
    recentEvents: []
  };
}

export function tickWorld(world: World): WorldSnapshot {
  world.tick += 1;
  world.recentEvents = [];

  updateShipMovement(world);
  processPendingActions(world);
  updateMarketPrices(world);

  return toSnapshot(world);
}

export function toSnapshot(world: World): WorldSnapshot {
  updateShipMovement(world);

  return {
    tick: world.tick,
    tickMs: world.tickMs,
    goods: world.goods,
    shipClasses: SHIP_CLASSES,
    players: serializePlayers(world.players),
    pendingActions: world.pendingActions.map((queuedAction) => ({
      ...queuedAction,
      action: { ...queuedAction.action }
    })),
    planets: world.planets.map((planet) => ({
      id: planet.id,
      name: planet.name,
      faction: planet.faction,
      blockade: planet.blockade,
      position: clonePosition(planet.position),
      stores: planet.stores.map((store) => ({
        credits: store.credits,
        id: store.id,
        name: store.name,
        inventory: { ...store.inventory },
        prices: { ...store.prices }
      }))
    })),
    recentEvents: [...world.recentEvents]
  };
}

function createPlanet(template: (typeof PLANET_TEMPLATES)[number]): Planet {
  return {
    id: template.id,
    name: template.name,
    faction: template.faction,
    position: clonePosition(template.position),
    blockade: false,
    stores: [createStore(template)]
  };
}

function createStore(template: (typeof PLANET_TEMPLATES)[number]): Store {
  return {
    id: `${template.id}-market`,
    name: `${template.name} Exchange`,
    credits: template.credits,
    inventory: { ...template.inventory },
    prices: {}
  };
}

function updateMarketPrices(world: World): void {
  for (const planet of world.planets) {
    const store = planet.stores[0];

    if (!store) {
      continue;
    }

    store.prices = calculatePrices(world, store);
  }
}