import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { ConnectedClient, ServerSnapshot } from "../simulation/domain/types.js";

type SnapshotFactory = () => ServerSnapshot;

export class WebSocketHub {
  private readonly clients = new Map<WebSocket, ConnectedClient>();
  private nextConnectionId = 1;
  private server: WebSocketServer | null = null;

  constructor(private readonly createSnapshot: SnapshotFactory) {}

  attach(server: HttpServer): void {
    this.server = new WebSocketServer({ path: "/ws", server });

    this.server.on("connection", (socket, request) => {
      const url = new URL(request.url ?? "/ws", "http://localhost");

      this.clients.set(socket, this.createConnection(url));
      this.send(socket, this.createSnapshot());
      this.broadcast();

      socket.on("close", () => {
        this.clients.delete(socket);
        this.broadcast();
      });
    });
  }

  broadcast(payload = this.createSnapshot()): void {
    for (const socket of this.clients.keys()) {
      this.send(socket, payload);
    }
  }

  connectionSummary() {
    const connections = [...this.clients.values()];

    return {
      connectedUsers: connections
        .filter((connection) => connection.type === "user")
        .map((connection) => ({ ...connection })),
      connectionCounts: {
        dashboards: connections.filter((connection) => connection.type === "dashboard").length,
        users: connections.filter((connection) => connection.type === "user").length
      }
    };
  }

  private createConnection(url: URL): ConnectedClient {
    const type = url.searchParams.get("client") === "user" ? "user" : "dashboard";
    const fallbackName = type === "user" ? "User client" : "Dashboard";
    const clientId = sanitizeClientId(url.searchParams.get("clientId"));
    const connection: ConnectedClient = {
      id: `${type}-${this.nextConnectionId}`,
      type,
      name: sanitizeName(url.searchParams.get("name")) ?? fallbackName,
      connectedAt: new Date().toISOString()
    };

    if (clientId) {
      connection.clientId = clientId;
    }

    this.nextConnectionId += 1;
    return connection;
  }

  private send(socket: WebSocket, snapshot: ServerSnapshot): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "world", payload: snapshot }));
    }
  }
}

function sanitizeName(value: string | null): string | null {
  const name = String(value ?? "").trim().slice(0, 32);
  return name || null;
}

function sanitizeClientId(value: string | null): string | null {
  const clientId = String(value ?? "").trim().slice(0, 64);
  return /^[A-Za-z0-9_-]+$/.test(clientId) ? clientId : null;
}