import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImmediateActionResult, QueuedActionResult, Store, World } from "../simulation/domain/types.js";

interface SessionLoggerOptions {
  logsRootDir: string;
  port: number;
  world: World;
}

export interface SessionLogger {
  readonly sessionDir: string;
  logAction(rawAction: unknown, result: QueuedActionResult | ImmediateActionResult, world: World): void;
  logTick(world: World, reason: "startup" | "tick"): void;
}

export async function createSessionLogger(options: SessionLoggerOptions): Promise<SessionLogger> {
  const startedAt = new Date();
  const sessionDir = path.join(options.logsRootDir, `session-${formatTimestamp(startedAt)}`);
  const logger = new JsonlSessionLogger(sessionDir);

  await mkdir(sessionDir, { recursive: true });
  await writeFile(
    path.join(sessionDir, "session.json"),
    `${JSON.stringify(
      {
        startedAt: startedAt.toISOString(),
        pid: process.pid,
        port: options.port,
        tickMs: options.world.tickMs,
        planets: options.world.planets.map((planet) => ({
          id: planet.id,
          name: planet.name,
          faction: planet.faction,
          stores: planet.stores.map(summarizeStore)
        })),
        goods: options.world.goods
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return logger;
}

class JsonlSessionLogger implements SessionLogger {
  constructor(readonly sessionDir: string) {}

  logAction(rawAction: unknown, result: QueuedActionResult | ImmediateActionResult, world: World): void {
    void this.writeJsonl("actions.jsonl", {
      at: new Date().toISOString(),
      tick: world.tick,
      rawAction,
      result,
      context: actionContext(world, rawAction, result),
      totals: economyTotals(world)
    });
  }

  logTick(world: World, reason: "startup" | "tick"): void {
    void this.writeJsonl("ticks.jsonl", {
      at: new Date().toISOString(),
      reason,
      tick: world.tick,
      tickMs: world.tickMs,
      totals: economyTotals(world),
      clientActivity: Object.values(world.clientActivity),
      markets: world.planets.map((planet) => ({
        planetId: planet.id,
        planetName: planet.name,
        faction: planet.faction,
        stores: planet.stores.map(summarizeStore)
      })),
      ships: world.players.map((player) => ({
        id: player.id,
        name: player.name,
        ownerClientId: player.ownerClientId,
        faction: player.faction,
        homePlanetId: player.homePlanetId,
        shipClassId: player.shipClassId,
        credits: player.credits,
        cargo: player.cargo,
        cargoUsed: Object.values(player.cargo).reduce((sum, amount) => sum + amount, 0),
        cargoCapacity: player.cargoCapacity,
        fuel: player.fuel,
        fuelBurnPerUnit: player.fuelBurnPerUnit,
        fuelCapacity: player.fuelCapacity,
        locationPlanetId: player.locationPlanetId,
        destinationPlanetId: player.destinationPlanetId,
        destinationPosition: player.destinationPosition,
        position: player.position,
        speed: player.speed,
        exploredAreaCount: player.exploredAreas.length
      })),
      pendingActions: world.pendingActions.map((queuedAction) => ({
        id: queuedAction.id,
        submittedTick: queuedAction.submittedTick,
        executeAtTick: queuedAction.executeAtTick,
        action: queuedAction.action
      })),
      recentEvents: world.recentEvents,
      sosSignals: world.sosSignals
    });
  }

  private async writeJsonl(fileName: string, entry: unknown): Promise<void> {
    try {
      await appendFile(path.join(this.sessionDir, fileName), `${JSON.stringify(entry)}\n`, "utf8");
    } catch (error) {
      console.error(`Failed to write server log ${fileName}:`, error);
    }
  }
}

function summarizeStore(store: Store) {
  return {
    id: store.id,
    name: store.name,
    credits: store.credits,
    inventory: store.inventory,
    prices: store.prices,
    priceMultipliers: store.priceMultipliers
  };
}

function actionContext(world: World, rawAction: unknown, result: QueuedActionResult | ImmediateActionResult) {
  const action = result.accepted && "action" in result ? result.action : actionLike(rawAction);
  const clientId = action?.clientId;
  const player = clientId ? world.players.find((candidate) => candidate.ownerClientId === clientId) : undefined;
  const location = player?.locationPlanetId ? world.planets.find((planet) => planet.id === player.locationPlanetId) : undefined;
  const store = location?.stores[0];
  const targetPlanetId = action && "target" in action && typeof action.target === "string" ? action.target : undefined;
  const targetPlanet = targetPlanetId ? world.planets.find((planet) => planet.id === targetPlanetId) : undefined;

  return {
    clientId,
    shipId: player?.id,
    shipName: player?.name,
    action: action?.action,
    item: action && "item" in action ? action.item : undefined,
    qty: action && "qty" in action ? action.qty : undefined,
    locationPlanetId: location?.id,
    locationPlanetName: location?.name,
    storeId: store?.id,
    storeName: store?.name,
    targetPlanetId: targetPlanet?.id,
    targetPlanetName: targetPlanet?.name,
    targetClientId: action && "targetClientId" in action ? action.targetClientId : undefined
  };
}

function actionLike(rawAction: unknown): Record<string, unknown> | undefined {
  return rawAction && typeof rawAction === "object" ? (rawAction as Record<string, unknown>) : undefined;
}

function economyTotals(world: World) {
  const marketCredits = world.planets.reduce(
    (sum, planet) => sum + planet.stores.reduce((storeSum, store) => storeSum + store.credits, 0),
    0
  );
  const shipCredits = world.players.reduce((sum, player) => sum + player.credits, 0);
  const inventoryByGood = Object.fromEntries(Object.keys(world.goods).map((goodId) => [goodId, totalInventory(world, goodId)]));

  return {
    marketCredits,
    shipCredits,
    totalCredits: marketCredits + shipCredits,
    knownClientCount: Object.keys(world.clientActivity).length,
    shipCount: world.players.length,
    pendingActionCount: world.pendingActions.length,
    inventoryByGood
  };
}

function totalInventory(world: World, goodId: string): number {
  const marketStock = world.planets.reduce(
    (sum, planet) => sum + planet.stores.reduce((storeSum, store) => storeSum + (store.inventory[goodId] ?? 0), 0),
    0
  );
  const shipStock = world.players.reduce((sum, player) => sum + (player.cargo[goodId] ?? 0), 0);

  return marketStock + shipStock;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}