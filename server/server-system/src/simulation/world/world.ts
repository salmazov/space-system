import { TICK_MS, GOODS, COMBAT } from "./constants.js";
import { PLANET_TEMPLATES } from "./planet-data.js";
import { playerForClient, serializeNpcShips, serializePlayers } from "./selectors.js";
import { processPendingActions } from "../actions/queue.js";
import type { BotSnapshot, Planet, QueuedAction, Store, World, WorldSnapshot } from "../domain/types.js";
import { calculatePrices } from "../economy/pricing.js";
import { updateProduction } from "../economy/production.js";
import { clonePosition, distanceOnMap } from "../map/geometry.js";
import { SHIP_CLASSES } from "../ships/classes.js";
import { updateCombat } from "../ships/combat.js";
import { updateHappinessAndHealth } from "../ships/happiness.js";
import { updateShipMovement } from "../ships/movement.js";
import { updatePoliceMovement } from "../ships/police.js";
import { updatePiracy } from "../ships/piracy.js";
import { pruneSosSignals } from "../ships/sos.js";

export function createWorld(): World {
  return {
    tick: 0,
    tickMs: TICK_MS,
    actionLog: [],
    clientActivity: {},
    driftingCargo: [],
    goods: GOODS,
    lastMovementAtMs: Date.now(),
    players: [],
    policeShips: [],
    pendingActions: [],
    nextActionId: 1,
    planets: PLANET_TEMPLATES.map(createPlanet),
    recentEvents: [],
    sosSignals: []
  };
}

const TICK_PHASES: readonly { name: string; run: (world: World) => void }[] = [
  { name: "movement", run: (w) => updateShipMovement(w) },
  { name: "police_movement", run: updatePoliceMovement },
  { name: "actions", run: processPendingActions },
  { name: "production", run: updateProduction },
  { name: "sos_prune", run: pruneSosSignals },
  { name: "happiness", run: updateHappinessAndHealth },
  { name: "piracy", run: updatePiracy },
  { name: "combat", run: updateCombat },
  { name: "prices", run: updateMarketPrices }
];

export function tickWorld(world: World): WorldSnapshot {
  world.tick += 1;
  world.recentEvents = [];

  for (const phase of TICK_PHASES) {
    phase.run(world);
  }

  return toSnapshot(world);
}

export function toSnapshot(world: World, viewerClientId?: string): WorldSnapshot {
  return {
    tick: world.tick,
    tickMs: world.tickMs,
    goods: world.goods,
    shipClasses: SHIP_CLASSES,
    players: serializePlayers(world.players),
    policeShips: serializeNpcShips(world.policeShips),
    actionLog: serializeActionLog(world.actionLog),
    pendingActions: world.pendingActions.map(serializeQueuedAction),
    planets: serializePlanets(world),
    recentEvents: [...world.recentEvents],
    driftingCargo: serializeDriftingCargo(world),
    snapshotAtMs: Date.now(),
    sosSignals: serializeSosSignals(world, viewerClientId)
  };
}

export function toBotSnapshot(world: World, clientId: string): BotSnapshot {
  const player = playerForClient(world, clientId);

  return {
    tick: world.tick,
    tickMs: world.tickMs,
    goods: world.goods,
    driftingCargo: serializeDriftingCargo(world),
    players: player ? serializePlayers([player]) : [],
    policeShips: serializeNpcShips(world.policeShips),
    pendingActions: world.pendingActions
      .filter((queuedAction) => queuedAction.action.clientId === clientId)
      .map(serializeQueuedAction),
    planets: serializePlanets(world),
    snapshotAtMs: Date.now(),
    sosSignals: serializeSosSignals(world, clientId, false)
  };
}

function serializeSosSignals(world: World, viewerClientId?: string, filterByDistance = true): WorldSnapshot["sosSignals"] {
  const viewer = viewerClientId ? playerForClient(world, viewerClientId) : null;

  return world.sosSignals.filter((signal) => isSosVisibleToViewer(signal, viewer, viewerClientId, filterByDistance)).map((signal) => ({
    ...signal,
    position: clonePosition(signal.position)
  }));
}

function isSosVisibleToViewer(signal: World["sosSignals"][number], viewer: ReturnType<typeof playerForClient>, viewerClientId?: string, filterByDistance = true): boolean {
  if (!viewerClientId) {
    return true;
  }

  if (signal.clientId === viewerClientId) {
    return true;
  }

  if (!filterByDistance) {
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
    health: planet.health,
    incidents: [...planet.incidents],
    ownerClientId: planet.ownerClientId,
    planetType: planet.planetType,
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
    health: template.planetType === "pirate" ? COMBAT.PIRATE_STATION_INITIAL_HEALTH : 1.0,
    ownerClientId: null,
    planetType: template.planetType,
    position: clonePosition(template.position),
    blockade: false,
    incidents: [],
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

function serializeDriftingCargo(world: World): WorldSnapshot["driftingCargo"] {
  return world.driftingCargo.map((c) => ({
    cargo: { ...c.cargo },
    createdAtTick: c.createdAtTick,
    id: c.id,
    position: clonePosition(c.position)
  }));
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