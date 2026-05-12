import { TICK_MS, GOODS, PLANET_TEMPLATES } from "./constants.js";
import { playerForClient, serializePlayers } from "./selectors.js";
import { processPendingActions } from "../actions/queue.js";
import type { BotSnapshot, Planet, QueuedAction, Store, World, WorldSnapshot } from "../domain/types.js";
import { calculatePrices } from "../economy/pricing.js";
import { updateProduction } from "../economy/production.js";
import { clonePosition, distanceOnMap } from "../map/geometry.js";
import { SHIP_CLASSES } from "../ships/classes.js";
import { updateShipMovement } from "../ships/movement.js";
import { pruneSosSignals } from "../ships/sos.js";

export function createWorld(): World {
  return {
    tick: 0,
    tickMs: TICK_MS,
    actionLog: [],
    clientActivity: {},
    goods: GOODS,
    lastMovementAtMs: Date.now(),
    players: [],
    pendingActions: [],
    nextActionId: 1,
    planets: PLANET_TEMPLATES.map(createPlanet),
    recentEvents: [],
    sosSignals: []
  };
}

export function tickWorld(world: World): WorldSnapshot {
  world.tick += 1;
  world.recentEvents = [];

  updateShipMovement(world);
  processPendingActions(world);
  updateProduction(world);
  pruneSosSignals(world);
  updateMarketPrices(world);

  return toSnapshot(world);
}

export function toSnapshot(world: World, viewerClientId?: string): WorldSnapshot {
  updateShipMovement(world);

  return {
    tick: world.tick,
    tickMs: world.tickMs,
    goods: world.goods,
    shipClasses: SHIP_CLASSES,
    players: serializePlayers(world.players),
    actionLog: serializeActionLog(world.actionLog),
    pendingActions: world.pendingActions.map(serializeQueuedAction),
    planets: serializePlanets(world),
    recentEvents: [...world.recentEvents],
    sosSignals: serializeSosSignals(world, viewerClientId)
  };
}

export function toBotSnapshot(world: World, clientId: string): BotSnapshot {
  updateShipMovement(world);

  const player = playerForClient(world, clientId);

  return {
    tick: world.tick,
    tickMs: world.tickMs,
    goods: world.goods,
    players: player ? serializePlayers([player]) : [],
    pendingActions: world.pendingActions
      .filter((queuedAction) => queuedAction.action.clientId === clientId)
      .map(serializeQueuedAction),
    planets: serializePlanets(world),
    sosSignals: serializeSosSignals(world, clientId)
  };
}

function serializeSosSignals(world: World, viewerClientId?: string): WorldSnapshot["sosSignals"] {
  const viewer = viewerClientId ? playerForClient(world, viewerClientId) : null;

  return world.sosSignals.filter((signal) => isSosVisibleToViewer(signal, viewer, viewerClientId)).map((signal) => ({
    ...signal,
    position: clonePosition(signal.position)
  }));
}

function isSosVisibleToViewer(signal: World["sosSignals"][number], viewer: ReturnType<typeof playerForClient>, viewerClientId?: string): boolean {
  if (!viewerClientId) {
    return true;
  }

  if (signal.clientId === viewerClientId) {
    return true;
  }

  return Boolean(viewer && distanceOnMap(viewer.position, signal.position) <= signal.radius);
}

function serializeQueuedAction(queuedAction: QueuedAction): QueuedAction {
  return {
    ...queuedAction,
    action: { ...queuedAction.action }
  };
}

function serializeActionLog(actionLog: WorldSnapshot["actionLog"]): WorldSnapshot["actionLog"] {
  return actionLog.map((entry) => {
    const serialized = { ...entry, action: { ...entry.action } };

    if (entry.decision) {
      serialized.decision = { ...entry.decision };
    }

    return serialized;
  });
}

function serializePlanets(world: World): WorldSnapshot["planets"] {
  return world.planets.map((planet) => ({
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
      priceMultipliers: { ...store.priceMultipliers },
      prices: { ...store.prices }
    }))
  }));
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
    priceMultipliers: { ...template.priceMultipliers },
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