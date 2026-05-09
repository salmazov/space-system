import { connectWorldSocket, getPilotName, postAction } from "./api.js";
import { StrategyCamera } from "./camera.js";
import { getElements } from "./dom.js";
import { renderLabels } from "./labels.js";
import { WebGpuRenderer } from "./renderer.js";
import { buildScene, nearestPlanet, type SceneState } from "./scene.js";
import type { WorldSnapshot } from "./types.js";

const elements = getElements();
const pilotName = getPilotName();
const camera = new StrategyCamera(elements.canvas);

let renderer: WebGpuRenderer | null = null;
let latestWorld: WorldSnapshot | null = null;
let latestScene: SceneState | null = null;
let spawnRequested = false;
let previousFrame = performance.now();

elements.pilotName.textContent = pilotName;

await start();

async function start(): Promise<void> {
  try {
    renderer = await WebGpuRenderer.create(elements.canvas);
  } catch (error) {
    showError(error instanceof Error ? error.message : "WebGPU initialization failed.");
    return;
  }

  connectWorldSocket(pilotName, onWorld, updateConnectionStatus);
  bindPlanetClicks();
  requestAnimationFrame(frame);
}

function onWorld(world: WorldSnapshot): void {
  latestWorld = world;
  latestScene = buildScene(world);
  elements.shipStatus.textContent = latestScene.shipStatus;

  const hasPendingSpawn = world.pendingActions.some((queuedAction) => queuedAction.action.action === "spawn");

  if (!world.player && !spawnRequested && !hasPendingSpawn && world.planets[0]) {
    spawnRequested = true;
    void postAction({ action: "spawn", target: world.planets[0].id, name: pilotName });
  }
}

function frame(now: number): void {
  const deltaSeconds = (now - previousFrame) / 1000;
  previousFrame = now;
  camera.update(deltaSeconds);

  if (renderer && latestScene) {
    renderer.render(latestScene.renderables, camera.state);
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

    const target = nearestPlanet(camera.screenToWorld(event.clientX, event.clientY), latestScene.planetPositions);

    if (target) {
      void moveShipTo(target);
    }
  });
}

async function moveShipTo(target: string): Promise<void> {
  if (!latestWorld?.player || latestWorld.player.destinationPlanetId || latestWorld.player.locationPlanetId === target) {
    return;
  }

  const result = await postAction({ action: "travel", target });

  if (!result.accepted && result.reason) {
    elements.hint.textContent = result.reason;
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