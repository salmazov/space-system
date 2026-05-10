import { connectWorldStream, getClientSession, postAction } from "./api.js";
import { getUserClientElements } from "./dom.js";
import { addLog, renderWorld } from "./render.js";
import type { ClientAction, ShipClassId } from "./types.js";

const elements = getUserClientElements();
const session = getClientSession();

elements.pilotName.textContent = session.pilotName;

connectWorldStream(
  session,
  (world) => renderWorld(world, elements, session.clientId),
  (connected) => {
    elements.status.textContent = connected ? "Connected" : "Reconnecting";
    elements.status.className = connected ? "status connected" : "status disconnected";
  }
);

elements.spawnButton.addEventListener("click", () => {
  sendAction({
    action: "spawn",
    shipClassId: elements.shipClassSelect.value as ShipClassId,
    target: elements.startPlanetSelect.value,
    name: session.pilotName
  });
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

async function sendAction(action: ClientAction): Promise<void> {
  try {
    const result = await postAction(session, action);
    const message = result.accepted ? `${action.action} queued for tick ${result.queuedForTick}` : result.reason ?? "Action rejected";
    addLog(message, elements);
  } catch {
    addLog("Action failed: server unavailable", elements);
  }
}