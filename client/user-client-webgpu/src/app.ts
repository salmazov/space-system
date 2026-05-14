import { AudioEngine } from "./engine/audio/audio-engine.js";
import { StrategyCamera } from "./engine/camera.js";
import { WebGpuRenderer } from "./engine/renderer.js";
import { buildScene, type SceneState } from "./game/scene.js";
import { ShipMotionSmoother } from "./game/ship-motion.js";
import type { ClientAction, Vec3, WorldSnapshot } from "./game/types.js";
import { connectWorldSocket, getClientSession, postAction } from "./network/api.js";
import { renderDockPanel } from "./ui/dock-panel.js";
import { getElements } from "./ui/dom.js";
import { renderLabels } from "./ui/labels.js";
import { renderMiniMap } from "./ui/minimap.js";
import { renderResourceBar } from "./ui/resource-bar.js";
import { renderSosPanel } from "./ui/sos-panel.js";

const elements = getElements();
const session = getClientSession();
const camera = new StrategyCamera(elements.canvas);
const audio = new AudioEngine({ uiClick: "/webgpu/assets/audio/ui/menu-click.mp3" });
const shipMotion = new ShipMotionSmoother();

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
  bindUiAudio();
  bindPlanetClicks();
  requestAnimationFrame(frame);
}

function onWorld(world: WorldSnapshot): void {
  const now = performance.now();

  latestWorld = world;
  shipMotion.updateTargets(world, now);

  const authoritativeScene = buildScene(world, session.clientId);
  latestScene = buildScene(shipMotion.worldForRender(world, now), session.clientId);
  elements.shipStatus.textContent = authoritativeScene.shipStatus;
  renderDockPanel(elements.dockPanel, world, session.clientId, {
    onTrade: sendTradeAction,
    onBuyShip: sendBuyShipAction,
    onAcceptMission: sendAcceptMissionAction
  });
  renderResourceBar(elements.resourceBar, world, session.clientId, sendSos);
  renderSosPanel(elements.sosPanel, world, session.clientId, sendShareFuel);

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

  if (latestWorld) {
    const visualWorld = shipMotion.worldForRender(latestWorld, now);

    latestScene = buildScene(visualWorld, session.clientId);
    renderMiniMap(elements.miniMap, visualWorld, session.clientId);
  }

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

function bindUiAudio(): void {
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("button");

    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      return;
    }

    audio.play("uiClick", { volume: 0.52 });
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

  if (!result.accepted) {
    elements.hint.textContent = result.reason ?? "Trade rejected";
  } else if ("message" in result) {
    elements.hint.textContent = result.message;
  } else {
    elements.hint.textContent = `${action.action} ${action.item} queued for tick ${result.queuedForTick}`;
  }
}

async function sendSos(): Promise<void> {
  const result = await postAction(session, { action: "sos" });

  if (!result.accepted) {
    elements.hint.textContent = result.reason ?? "SOS failed";
  } else if ("message" in result) {
    elements.hint.textContent = result.message;
  }
}

async function sendShareFuel(targetClientId: string, qty: number): Promise<void> {
  const result = await postAction(session, { action: "share_fuel", targetClientId, qty });

  if (!result.accepted) {
    elements.hint.textContent = result.reason ?? "Share fuel failed";
  } else if ("message" in result) {
    elements.hint.textContent = result.message;
  }
}

async function sendBuyShipAction(action: Extract<ClientAction, { action: "buy_ship" }>): Promise<void> {
  const result = await postAction(session, action);

  if (!result.accepted) {
    elements.hint.textContent = result.reason ?? "Ship purchase failed";
  } else if ("message" in result) {
    elements.hint.textContent = result.message;
  }
}

async function sendAcceptMissionAction(action: Extract<ClientAction, { action: "accept_mission" }>): Promise<void> {
  const result = await postAction(session, action);

  if (!result.accepted) {
    elements.hint.textContent = result.reason ?? "Mission accept failed";
  } else if ("message" in result) {
    elements.hint.textContent = result.message;
  }
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