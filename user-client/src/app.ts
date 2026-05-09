import { connectWorldStream, getPilotName, postAction } from "./api.js";
import { getUserClientElements } from "./dom.js";
import { addLog, renderWorld } from "./render.js";

const elements = getUserClientElements();
const pilotName = getPilotName();

elements.pilotName.textContent = pilotName;

connectWorldStream(
  pilotName,
  (world) => renderWorld(world, elements),
  (connected) => {
    elements.status.textContent = connected ? "Connected" : "Reconnecting";
    elements.status.className = connected ? "status connected" : "status disconnected";
  }
);

elements.spawnButton.addEventListener("click", () => {
  sendAction({ action: "spawn", target: elements.startPlanetSelect.value, name: pilotName });
});

elements.travelButton.addEventListener("click", () => {
  sendAction({ action: "travel", target: elements.travelPlanetSelect.value });
});

elements.buyButton.addEventListener("click", () => {
  sendAction({ action: "buy", item: elements.goodSelect.value, qty: Number(elements.qtyInput.value) });
});

elements.sellButton.addEventListener("click", () => {
  sendAction({ action: "sell", item: elements.goodSelect.value, qty: Number(elements.qtyInput.value) });
});

async function sendAction(action: Parameters<typeof postAction>[0]): Promise<void> {
  try {
    const result = await postAction(action);
    const message = result.accepted ? `${action.action} queued for tick ${result.queuedForTick}` : result.reason ?? "Action rejected";
    addLog(message, elements);
  } catch {
    addLog("Action failed: server unavailable", elements);
  }
}