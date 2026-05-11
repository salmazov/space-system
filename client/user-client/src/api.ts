import type { ActionResponse, ClientAction, WorldSnapshot } from "./types.js";

export interface ClientSession {
  clientId: string;
  pilotName: string;
}

export function connectWorldStream(
  session: ClientSession,
  onWorld: (world: WorldSnapshot) => void,
  onStatus: (connected: boolean) => void
): void {
  connect();

  function connect(): void {
    const params = new URLSearchParams({ client: "user", clientId: session.clientId, name: session.pilotName });
    const socket = new WebSocket(webSocketUrl(`/ws?${params.toString()}`));

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

export async function postAction(session: ClientSession, action: ClientAction): Promise<ActionResponse> {
  const response = await fetch("/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, clientId: session.clientId })
  });

  return (await response.json()) as ActionResponse;
}

export function getClientSession(): ClientSession {
  const existingClientId = sessionStorage.getItem("space-system-client-id");
  const existingName = sessionStorage.getItem("space-system-pilot-name");

  if (existingClientId && existingName && shouldReuseExistingSession()) {
    return { clientId: existingClientId, pilotName: existingName };
  }

  const session: ClientSession = {
    clientId: randomClientId(),
    pilotName: `Pilot ${Math.floor(100 + Math.random() * 900)}`
  };
  sessionStorage.setItem("space-system-client-id", session.clientId);
  sessionStorage.setItem("space-system-pilot-name", session.pilotName);
  return session;
}

function randomClientId(): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `client-${randomPart}`;
}

function shouldReuseExistingSession(): boolean {
  const [navigation] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return navigation?.type !== "navigate";
}

function reconnect(connect: () => void, onStatus: (connected: boolean) => void): void {
  onStatus(false);
  globalThis.setTimeout(connect, 1000);
}

function webSocketUrl(path: string): string {
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${globalThis.location.host}${path}`;
}