import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSessionLogger } from "./logging/session-logger.js";
import { createSimulationServer } from "./server.js";
import { createWorld, TICK_MS, tickWorld } from "./simulation.js";

const PORT = Number(process.env.PORT ?? 3000);
const SNAPSHOT_BROADCAST_MS = Number(process.env.SNAPSHOT_BROADCAST_MS ?? 500);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const world = createWorld();

tickWorld(world);

const logger = await createSessionLogger({
  logsRootDir: path.resolve(dirname, "../../logs"),
  port: PORT,
  world
});
logger.logTick(world, "startup");

const app = createSimulationServer({
  dashboardDir: path.resolve(dirname, "../../server-dashboard"),
  logger,
  port: PORT,
  webgpuClientDir: path.resolve(dirname, "../../../client/user-client-webgpu"),
  world
});

setInterval(() => {
  tickWorld(world);
  logger.logTick(world, "tick");
  app.broadcast();
}, TICK_MS);

if (SNAPSHOT_BROADCAST_MS > 0 && SNAPSHOT_BROADCAST_MS < TICK_MS) {
  setInterval(() => {
    if (app.hasWebSocketClients()) {
      app.broadcast();
    }
  }, SNAPSHOT_BROADCAST_MS);
}

app.server.listen(PORT, () => {
  console.log(`Space System server running at http://localhost:${PORT}`);
  console.log(`Writing server session logs to ${logger.sessionDir}`);
  if (SNAPSHOT_BROADCAST_MS > 0 && SNAPSHOT_BROADCAST_MS < TICK_MS) {
    console.log(`Broadcasting visual snapshots every ${SNAPSHOT_BROADCAST_MS}ms while WebSocket clients are connected`);
  }
});