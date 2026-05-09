import type { ActionResponse, ClientAction, WorldSnapshot } from "./types.js";

export function connectWorldSocket(
  pilotName: string,
  onWorld: (world: WorldSnapshot) => void,
  onStatus: (connected: boolean) => void
): void {
  connect();

  function connect(): void {
    const socket = new WebSocket(webSocketUrl(`/ws?client=user&name=${encodeURIComponent(pilotName)}`));

    socket.addEventListener("open", () => onStatus(true));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data as string) as { type: string; payload: WorldSnapshot };

      if (message.type === "world") {
        onWorld(message.payload);
      }
    });
    socket.addEventListener("close", () => reconnect(connect, onStatus));
    socket.addEventListener("error", () => {
      onStatus(false);
      socket.close();
    });
  }
}

export async function postAction(action: ClientAction): Promise<ActionResponse> {
  const response = await fetch("/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action)
  });

  return (await response.json()) as ActionResponse;
}

export function getPilotName(): string {
  const existingName = localStorage.getItem("space-system-webgpu-pilot-name");

  if (existingName) {
    return existingName;
  }

  const name = `WebGPU Pilot ${Math.floor(100 + Math.random() * 900)}`;
  localStorage.setItem("space-system-webgpu-pilot-name", name);
  return name;
}

function reconnect(connect: () => void, onStatus: (connected: boolean) => void): void {
  onStatus(false);
  globalThis.setTimeout(connect, 1000);
}

function webSocketUrl(path: string): string {
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${globalThis.location.host}${path}`;
}