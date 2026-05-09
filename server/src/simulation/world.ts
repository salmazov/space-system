import { TICK_MS, GOODS, PLANET_TEMPLATES } from "./constants.js";
import { processPendingActions } from "./action-queue.js";
import { updatePlayerTravel } from "./movement.js";
import { calculatePrices } from "./pricing.js";
import { serializePlayer } from "./selectors.js";
import type { Planet, Store, World, WorldSnapshot } from "./types.js";

export function createWorld(): World {
  return {
    tick: 0,
    tickMs: TICK_MS,
    goods: GOODS,
    player: null,
    pendingActions: [],
    nextActionId: 1,
    planets: PLANET_TEMPLATES.map(createPlanet),
    recentEvents: []
  };
}

export function tickWorld(world: World): WorldSnapshot {
  world.tick += 1;
  world.recentEvents = [];

  processPendingActions(world);
  updateMarketPrices(world);
  updatePlayerTravel(world);

  return toSnapshot(world);
}

export function toSnapshot(world: World): WorldSnapshot {
  return {
    tick: world.tick,
    tickMs: world.tickMs,
    goods: world.goods,
    player: serializePlayer(world.player),
    pendingActions: world.pendingActions.map((queuedAction) => ({
      ...queuedAction,
      action: { ...queuedAction.action }
    })),
    planets: world.planets.map((planet) => ({
      id: planet.id,
      name: planet.name,
      faction: planet.faction,
      blockade: planet.blockade,
      stores: planet.stores.map((store) => ({
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
    blockade: false,
    stores: [createStore(template)]
  };
}

function createStore(template: (typeof PLANET_TEMPLATES)[number]): Store {
  return {
    id: `${template.id}-market`,
    name: `${template.name} Exchange`,
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