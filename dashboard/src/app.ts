import { getDashboardElements } from "./dom.js";
import { renderWorld } from "./render.js";
import type { WorldSnapshot } from "./types.js";

const elements = getDashboardElements();
connectDashboardSocket();

function connectDashboardSocket(): void {
  const socket = new WebSocket(webSocketUrl("/ws?client=dashboard"));

  socket.addEventListener("open", () => updateStatus(true));
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as { type: string; payload: WorldSnapshot };

    if (message.type === "world") {
      renderWorld(message.payload, elements);
    }
  });
  socket.addEventListener("close", () => reconnect());
  socket.addEventListener("error", () => {
    updateStatus(false);
    socket.close();
  });
}

function reconnect(): void {
  updateStatus(false);
  globalThis.setTimeout(connectDashboardSocket, 1000);
}

function updateStatus(connected: boolean): void {
  elements.status.textContent = connected ? "Connected" : "Reconnecting";
  elements.status.className = connected ? "status connected" : "status disconnected";
}

function webSocketUrl(path: string): string {
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${globalThis.location.host}${path}`;
}