import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSimulationServer } from "./server.js";
import { createWorld, TICK_MS, tickWorld } from "./simulation.js";

const PORT = Number(process.env.PORT ?? 3000);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const world = createWorld();

tickWorld(world);

const app = createSimulationServer({
  dashboardDir: path.resolve(dirname, "../../dashboard"),
  port: PORT,
  userClientDir: path.resolve(dirname, "../../user-client"),
  webgpuClientDir: path.resolve(dirname, "../../user-client-webgpu"),
  world
});

setInterval(() => {
  tickWorld(world);
  app.broadcast();
}, TICK_MS);

app.server.listen(PORT, () => {
  console.log(`Space System server running at http://localhost:${PORT}`);
});