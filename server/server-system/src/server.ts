import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SessionLogger } from "./logging/session-logger.js";
import {
  CLIENT_ACTIVITY_TIMEOUT_MS,
  activeClientIds,
  getAvailableActions,
  markClientActivity,
  queueAction,
  toBotSnapshot,
  toSnapshot
} from "./simulation.js";
import type { ServerSnapshot, World } from "./simulation/domain/types.js";
import { readJsonBody } from "./transport/request-body.js";
import { sendJson } from "./transport/responses.js";
import { serveStaticFile } from "./transport/static-files.js";
import { WebSocketHub } from "./transport/websocket-hub.js";

interface SimulationServerOptions {
  dashboardDir: string;
  logger?: SessionLogger;
  port: number;
  webgpuClientDir: string;
  world: World;
}

export function createSimulationServer(options: SimulationServerOptions) {
  const webSockets = new WebSocketHub(
    (): ServerSnapshot => snapshot(),
    (clientId) => markClientActivity(options.world, clientId, "websocket")
  );
  const server = http.createServer((request, response) => {
    void handleRequest(options, webSockets, request, response, snapshot);
  });

  webSockets.attach(server);

  function snapshot(): ServerSnapshot {
    const connectionSummary = webSockets.connectionSummary();

    return {
      ...toSnapshot(options.world),
      ...connectionSummary,
      activeClientIds: activeClientIds(options.world, connectionSummary.connectedUsers),
      activityTimeoutMs: CLIENT_ACTIVITY_TIMEOUT_MS
    };
  }

  return {
    broadcast: () => webSockets.broadcast(),
    server,
    snapshot
  };
}

async function handleRequest(
  options: SimulationServerOptions,
  webSockets: WebSocketHub,
  request: IncomingMessage,
  response: ServerResponse,
  snapshot: () => ServerSnapshot
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", `http://localhost:${options.port}`);

    if (request.method === "OPTIONS") {
      sendJson(response, {}, 204);
      return;
    }

    if (request.method === "GET") {
      await handleGet(options, response, url, snapshot);
      return;
    }

    if (request.method === "POST" && url.pathname === "/actions") {
      await handlePostAction(options, webSockets, request, response);
      return;
    }

    response.writeHead(405);
    response.end("Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(response, { error: "Internal server error" }, 500);
  }
}

async function handleGet(
  options: SimulationServerOptions,
  response: ServerResponse,
  url: URL,
  snapshot: () => ServerSnapshot
): Promise<void> {
  if (url.pathname === "/state") {
    sendJson(response, snapshot());
    return;
  }

  if (url.pathname === "/bot-state") {
    sendBotState(options, response, url);
    return;
  }

  if (url.pathname === "/actions") {
    sendJson(response, getAvailableActions(options.world, url.searchParams.get("clientId") ?? undefined));
    return;
  }

  await serveStaticFile(url, response, {
    dashboardDir: options.dashboardDir,
    webgpuClientDir: options.webgpuClientDir
  });
}

function sendBotState(options: SimulationServerOptions, response: ServerResponse, url: URL): void {
  const clientId = url.searchParams.get("clientId");

  if (!clientId) {
    sendJson(response, { error: "clientId is required" }, 400);
    return;
  }

  markClientActivity(options.world, clientId, "http");
  sendJson(response, toBotSnapshot(options.world, clientId));
}

async function handlePostAction(
  options: SimulationServerOptions,
  webSockets: WebSocketHub,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const rawAction = await readJsonBody(request);
  const clientId = clientIdFromRawAction(rawAction);

  if (clientId) {
    markClientActivity(options.world, clientId, "http");
  }

  const result = queueAction(options.world, rawAction);

  options.logger?.logAction(rawAction, result, options.world);

  if (result.accepted) {
    webSockets.broadcast();
  }

  sendJson(response, result, result.accepted ? 202 : 400);
}

function clientIdFromRawAction(rawAction: unknown): string | null {
  if (!rawAction || typeof rawAction !== "object") {
    return null;
  }

  const clientId = (rawAction as { clientId?: unknown }).clientId;

  return typeof clientId === "string" && /^[A-Za-z0-9_-]+$/.test(clientId) ? clientId : null;
}