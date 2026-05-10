import { connectWorldSocket, getClientSession, postAction } from "./api.js";
import { StrategyCamera } from "./camera.js";
import { renderDockPanel } from "./dock-panel.js";
import { getElements } from "./dom.js";
import { renderLabels } from "./labels.js";
import { renderMiniMap } from "./minimap.js";
import { WebGpuRenderer } from "./renderer.js";
import { buildScene, type SceneState } from "./scene.js";
import type { ClientAction, Vec3, WorldSnapshot } from "./types.js";

const elements = getElements();
const session = getClientSession();
const camera = new StrategyCamera(elements.canvas);

let renderer: WebGpuRenderer | null = null;
let latestWorld: WorldSnapshot | null = null;
let latestScene: SceneState | null = null;
let spawnRequested = false;
let previousFrame = performance.now();

elements.pilotName.textContent = session.pilotName;

await start();

async function start(): Promise<void> {
  try {
    renderer = await WebGpuRenderer.create(elements.canvas);
  } catch (error) {
    showError(error instanceof Error ? error.message : "WebGPU initialization failed.");
    return;
  }

  connectWorldSocket(session, onWorld, updateConnectionStatus);
  bindPlanetClicks();
  requestAnimationFrame(frame);
}

function onWorld(world: WorldSnapshot): void {
  latestWorld = world;
  latestScene = buildScene(world, session.clientId);
  elements.shipStatus.textContent = latestScene.shipStatus;
  renderDockPanel(elements.dockPanel, world, session.clientId, sendTradeAction);
  renderMiniMap(elements.miniMap, world, session.clientId);

  const ownedShip = playerForCurrentClient(world);
  const hasPendingSpawn = world.pendingActions.some(
    (queuedAction) => queuedAction.action.action === "spawn" && queuedAction.action.clientId === session.clientId
  );

  if (!ownedShip && !spawnRequested && !hasPendingSpawn && world.planets[0]) {
    spawnRequested = true;
    void postAction(session, { action: "spawn", shipClassId: "small_trade_ship", target: world.planets[0].id, name: session.pilotName });
  }
}

function frame(now: number): void {
  const deltaSeconds = (now - previousFrame) / 1000;
  previousFrame = now;
  camera.update(deltaSeconds);

  if (renderer && latestScene) {
    renderer.render(latestScene.renderables, camera);
    renderLabels(elements.labels, latestScene, camera);
  }

  requestAnimationFrame(frame);
}

function bindPlanetClicks(): void {
  let pointerDown: { x: number; y: number } | null = null;

  elements.canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      pointerDown = { x: event.clientX, y: event.clientY };
    }
  });

  elements.canvas.addEventListener("pointerup", (event) => {
    if (event.button !== 0 || !pointerDown || !latestWorld || !latestScene) {
      pointerDown = null;
      return;
    }

    const dragDistance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;

    if (dragDistance > 6) {
      return;
    }

    void moveShipTo(camera.screenToWorld(event.clientX, event.clientY));
  });
}

async function moveShipTo(target: Vec3): Promise<void> {
  const player = latestWorld ? playerForCurrentClient(latestWorld) : null;

  if (!player) {
    return;
  }

  const result = await postAction(session, { action: "move", target: { x: target.x, y: 0, z: target.z } });

  if (!result.accepted && result.reason) {
    elements.hint.textContent = result.reason;
  }
}

async function sendTradeAction(action: Extract<ClientAction, { action: "buy" | "sell" }>): Promise<void> {
  const result = await postAction(session, action);

  elements.hint.textContent = result.accepted
    ? `${action.action} ${action.item} queued for tick ${result.queuedForTick}`
    : result.reason ?? "Trade rejected";
}

function updateConnectionStatus(connected: boolean): void {
  elements.connectionStatus.textContent = connected ? "Connected" : "Reconnecting";
  elements.connectionStatus.className = `hud top-right ${connected ? "connected" : "disconnected"}`;
}

function showError(message: string): void {
  elements.error.hidden = false;
  elements.error.textContent = message;
}

function playerForCurrentClient(world: WorldSnapshot) {
  return world.players.find((player) => player.ownerClientId === session.clientId) ?? null;
}