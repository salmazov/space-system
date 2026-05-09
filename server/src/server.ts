import http from "node:http";
import { getAvailableActions, queueAction, toSnapshot } from "./simulation.js";
import type { ServerSnapshot, World } from "./simulation/types.js";
import { readJsonBody } from "./transport/request-body.js";
import { sendJson } from "./transport/responses.js";
import { serveStaticFile } from "./transport/static-files.js";
import { WebSocketHub } from "./transport/websocket-hub.js";

interface SimulationServerOptions {
  dashboardDir: string;
  port: number;
  userClientDir: string;
  webgpuClientDir: string;
  world: World;
}

export function createSimulationServer(options: SimulationServerOptions) {
  const webSockets = new WebSocketHub((): ServerSnapshot => snapshot());
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://localhost:${options.port}`);

      if (request.method === "OPTIONS") {
        sendJson(response, {}, 204);
        return;
      }

      if (request.method === "GET" && url.pathname === "/state") {
        sendJson(response, snapshot());
        return;
      }

      if (request.method === "GET" && url.pathname === "/actions") {
        sendJson(response, getAvailableActions(options.world));
        return;
      }

      if (request.method === "POST" && url.pathname === "/actions") {
        const result = queueAction(options.world, await readJsonBody(request));

        if (result.accepted) {
          webSockets.broadcast();
        }

        sendJson(response, result, result.accepted ? 202 : 400);
        return;
      }

      if (request.method === "GET") {
        await serveStaticFile(url, response, {
          dashboardDir: options.dashboardDir,
          userClientDir: options.userClientDir,
          webgpuClientDir: options.webgpuClientDir
        });
        return;
      }

      response.writeHead(405);
      response.end("Method not allowed");
    } catch (error) {
      console.error(error);
      sendJson(response, { error: "Internal server error" }, 500);
    }
  });

  webSockets.attach(server);

  function snapshot(): ServerSnapshot {
    return {
      ...toSnapshot(options.world),
      ...webSockets.connectionSummary()
    };
  }

  return {
    broadcast: () => webSockets.broadcast(),
    server,
    snapshot
  };
}