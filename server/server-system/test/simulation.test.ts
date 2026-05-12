import assert from "node:assert/strict";
import test from "node:test";
import { queueAction } from "../src/simulation/actions/queue.js";
import { createWorld, tickWorld } from "../src/simulation/world/world.js";
import type { PlayerShip, World } from "../src/simulation/domain/types.js";
import { setShipDestination, updateShipMovement } from "../src/simulation/ships/movement.js";

function accepted<T extends { accepted: boolean }>(result: T): asserts result is T & { accepted: true } {
  assert.equal(result.accepted, true);
}

function spawnShip(world: World, clientId = "test-client"): PlayerShip {
  const result = queueAction(world, {
    action: "spawn",
    clientId,
    name: "Test Ship",
    shipClassId: "small_trade_ship",
    target: "earth"
  });

  accepted(result);
  tickWorld(world);

  const player = world.players.find((candidate) => candidate.ownerClientId === clientId);
  assert.ok(player);
  return player;
}

test("queued spawn applies on the next tick", () => {
  const world = createWorld();
  const result = queueAction(world, {
    action: "spawn",
    clientId: "spawn-test",
    name: "Queue Tester",
    shipClassId: "small_trade_ship",
    target: "earth"
  });

  accepted(result);
  assert.equal(result.queuedForTick, 1);
  assert.equal(world.players.length, 0);
  assert.equal(world.pendingActions.length, 1);

  tickWorld(world);

  assert.equal(world.players.length, 1);
  assert.equal(world.players[0]?.ownerClientId, "spawn-test");
  assert.equal(world.players[0]?.locationPlanetId, "earth");
  assert.equal(world.pendingActions.length, 0);
});

test("government freighters spawn with bulk capacity and receive wholesale buy discounts", () => {
  const world = createWorld();
  const spawnResult = queueAction(world, {
    action: "spawn",
    clientId: "government-test",
    name: "Government Tester",
    shipClassId: "government_freighter",
    target: "earth"
  });

  accepted(spawnResult);
  tickWorld(world);

  const player = world.players.find((candidate) => candidate.ownerClientId === "government-test");
  const earthStore = world.planets.find((planet) => planet.id === "earth")?.stores[0];
  assert.ok(player);
  assert.ok(earthStore);
  assert.equal(player.shipClassId, "government_freighter");
  assert.equal(player.cargoCapacity, 420);
  assert.equal(player.credits, 12_000);

  const buyResult = queueAction(world, {
    action: "buy",
    clientId: "government-test",
    item: "food",
    qty: 40
  });

  accepted(buyResult);
  tickWorld(world);

  assert.equal(player.cargo.food, 40);
  assert.equal(player.credits, 11_683.2);
  assert.equal(earthStore.credits, 5_516.8);
});

test("movement burns fuel, records exploration, and docks near a planet", () => {
  const world = createWorld();
  const player = spawnShip(world);
  const startingFuel = player.fuel;
  const destination = { x: -9.8, y: 0, z: 0 };

  setShipDestination(world, player, destination, null);
  world.lastMovementAtMs = 1_000;
  updateShipMovement(world, 2_000);

  assert.equal(player.destinationPosition, null);
  assert.equal(player.locationPlanetId, "earth");
  assert.deepEqual(player.position, destination);
  assert.ok(player.fuel < startingFuel);
  assert.ok(player.exploredAreas.length > 0);
});

test("production grows Earth food and refines Uranus fuel", () => {
  const world = createWorld();
  const earthStore = world.planets.find((planet) => planet.id === "earth")?.stores[0];
  const uranusStore = world.planets.find((planet) => planet.id === "uranus")?.stores[0];

  assert.ok(earthStore);
  assert.ok(uranusStore);
  earthStore.inventory.food = 100;
  uranusStore.inventory.food = 10;
  uranusStore.inventory.fuel = 100;

  tickWorld(world);

  assert.equal(earthStore.inventory.food, 106);
  assert.equal(uranusStore.inventory.food, 8);
  assert.equal(uranusStore.inventory.fuel, 108);
});

test("observer action log captures accepted and rejected submissions safely", () => {
  const world = createWorld();
  const longSummary = "x".repeat(220);
  const acceptedResult = queueAction(world, {
    action: "spawn",
    botDecision: {
      summary: longSummary,
      attempts: Array.from({ length: 20 }, (_, index) => `attempt-${index}`),
      memory: { strategy: { riskTolerance: 0.5 } }
    },
    clientId: "log-test",
    name: "Logger",
    shipClassId: "small_trade_ship",
    target: "earth"
  });

  accepted(acceptedResult);
  assert.equal(world.actionLog.length, 1);
  assert.equal(world.actionLog[0]?.accepted, true);
  assert.equal(world.actionLog[0]?.queuedForTick, 1);
  assert.equal(typeof world.actionLog[0]?.decision?.summary, "string");
  assert.equal((world.actionLog[0]?.decision?.summary as string).length, 180);
  assert.equal((world.actionLog[0]?.decision?.attempts as unknown[]).length, 12);

  const rejectedResult = queueAction(world, {
    action: "buy",
    botDecision: { summary: "bad buy" },
    clientId: "invalid id with spaces",
    item: "food",
    qty: 2
  });

  assert.equal(rejectedResult.accepted, false);
  assert.equal(world.actionLog.length, 2);
  assert.equal(world.actionLog[0]?.accepted, false);
  assert.equal(world.actionLog[0]?.action.action, "buy");
  assert.equal(world.actionLog[0]?.decision?.summary, "bad buy");
});