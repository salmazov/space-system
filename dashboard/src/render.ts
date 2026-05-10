import type { DashboardElements } from "./dom.js";
import type { Good, MapPosition, Planet, PlayerShip, WorldSnapshot } from "./types.js";

export function renderWorld(world: WorldSnapshot, elements: DashboardElements): void {
  elements.tick.textContent = String(world.tick);
  elements.tickRate.textContent = `${world.tickMs / 1000}s`;
  elements.connectedUserCount.textContent = String(world.connectionCounts?.users ?? 0);

  elements.planets.replaceChildren(...world.planets.map((planet) => renderPlanet(planet, world.goods)));
  elements.connectedUsers.replaceChildren(...renderConnectedUsers(world));
  elements.playerShip.replaceChildren(...renderPlayerShips(world));
  elements.events.replaceChildren(...renderEvents(world.recentEvents));
  renderObserverMap(world, elements.observerMap, elements.mapSummary);
}

function renderConnectedUsers(world: WorldSnapshot): HTMLLIElement[] {
  const connectedUsers = world.connectedUsers ?? [];

  if (!connectedUsers.length) {
    return [listItem("No playable clients connected.")];
  }

  return connectedUsers.map((user) => {
    const connectedAt = new Date(user.connectedAt).toLocaleTimeString();
    const clientId = user.clientId ? ` (${shortClientId(user.clientId)})` : "";
    const ship = user.clientId ? playerForClient(world, user.clientId) : null;
    const coordinate = ship ? ` · ${formatPosition(ship.position)}` : " · awaiting ship";

    return listItem(`${user.name}${clientId} connected at ${connectedAt}${coordinate}`);
  });
}

function renderObserverMap(world: WorldSnapshot, container: HTMLElement, summary: HTMLElement): void {
  const connectedClientIds = new Set((world.connectedUsers ?? []).map((user) => user.clientId).filter((id): id is string => Boolean(id)));
  const bounds = mapBounds(world);
  const project = createProjector(bounds);
  const connectedShips = world.players.filter((player) => connectedClientIds.has(player.ownerClientId));

  summary.textContent = `${world.planets.length} planets · ${connectedShips.length}/${world.players.length} connected ships`;
  container.replaceChildren(
    ...world.planets.map((planet) => renderPlanetMarker(planet, project)),
    ...world.players.map((player) => renderShipMarker(player, project, connectedClientIds.has(player.ownerClientId)))
  );
}

function renderPlayerShips(world: WorldSnapshot): HTMLLIElement[] {
  if (!world.players.length) {
    return [listItem("No player ships spawned.")];
  }

  return world.players.map((player) => {
    const location = player.locationPlanetId ? planetName(world, player.locationPlanetId) : formatPosition(player.position);
    const destination = player.destinationPlanetId ? planetName(world, player.destinationPlanetId) : null;
    const cargoUsed = Object.values(player.cargo).reduce((sum, amount) => sum + amount, 0);
    const status = playerStatus(player, location, destination);

    return listItem(
      `${player.name} (${shortClientId(player.ownerClientId)}): ${player.shipClassLabel}, ${status}; EUR ${player.priceEuro}; ${player.speed} units/s; cargo ${cargoUsed}/${player.cargoCapacity}; explored ${player.exploredAreas.length}`
    );
  });
}

function renderEvents(events: WorldSnapshot["recentEvents"]): HTMLLIElement[] {
  const visibleEvents = events.length ? events : [{ message: "No major events this tick." }];
  return visibleEvents.map((entry) => listItem(entry.message));
}

function renderPlanet(planet: Planet, goods: Record<string, Good>): HTMLElement {
  const store = planet.stores[0];
  const article = document.createElement("article");

  article.className = "planet";
  article.append(renderPlanetHeader(planet));

  if (!store) {
    return article;
  }

  article.append(renderStoreSummary(store), renderGoods(store, goods));
  return article;
}

function renderPlanetHeader(planet: Planet): HTMLElement {
  const header = document.createElement("header");

  header.innerHTML = `
    <div>
      <h2>${planet.name}</h2>
      <div class="faction">${planet.faction}</div>
    </div>
    <div class="faction">${planet.blockade ? "Blockaded" : "Open"}</div>
  `;

  return header;
}

function renderStoreSummary(store: Planet["stores"][number]): HTMLElement {
  const storeName = document.createElement("div");
  storeName.className = "store-name";
  storeName.textContent = `${store.name} · treasury ${formatCredits(store.credits)} credits`;
  return storeName;
}

function renderGoods(store: Planet["stores"][number], goods: Record<string, Good>): HTMLElement {
  const goodsList = document.createElement("div");

  goodsList.className = "goods";

  for (const [goodId, good] of Object.entries(goods)) {
    const row = document.createElement("div");
    row.className = "good";
    row.innerHTML = `
      <div>
        <strong>${good.label}</strong>
        <span>Stock: ${store.inventory[goodId] ?? 0}</span>
      </div>
      <div class="price">
        <strong>${store.prices[goodId] ?? 0}</strong>
        <span>credits</span>
      </div>
    `;
    goodsList.append(row);
  }

  return goodsList;
}

function listItem(text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function renderPlanetMarker(planet: Planet, project: (position: MapPosition) => { x: number; y: number }): HTMLElement {
  const point = project(planet.position);
  const marker = document.createElement("div");
  const label = document.createElement("span");

  marker.className = `map-marker planet-marker planet-${planet.id}`;
  marker.classList.toggle("label-left", point.x > 68);
  marker.classList.toggle("label-up", point.y > 74);
  marker.style.left = `${point.x}%`;
  marker.style.top = `${point.y}%`;
  marker.title = `${planet.name} ${formatPosition(planet.position)}`;
  label.textContent = planet.name;
  marker.append(label);
  return marker;
}

function renderShipMarker(
  player: PlayerShip,
  project: (position: MapPosition) => { x: number; y: number },
  isConnected: boolean
): HTMLElement {
  const point = project(player.position);
  const marker = document.createElement("div");
  const label = document.createElement("span");

  marker.className = `map-marker ship-marker ${isConnected ? "connected-ship" : "stale-ship"}`;
  marker.classList.toggle("label-left", point.x > 68);
  marker.classList.toggle("label-up", point.y > 74);
  marker.style.left = `${point.x}%`;
  marker.style.top = `${point.y}%`;
  marker.title = `${player.name} ${formatPosition(player.position)}`;
  label.textContent = `${player.name} ${formatPosition(player.position)}`;
  marker.append(label);
  return marker;
}

function mapBounds(world: WorldSnapshot): { maxX: number; maxZ: number; minX: number; minZ: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  const includePoint = (position: MapPosition, radius = 0): void => {
    minX = Math.min(minX, position.x - radius);
    maxX = Math.max(maxX, position.x + radius);
    minZ = Math.min(minZ, position.z - radius);
    maxZ = Math.max(maxZ, position.z + radius);
  };

  for (const planet of world.planets) {
    includePoint(planet.position, 3);
  }

  for (const player of world.players) {
    includePoint(player.position, player.explorationRadius);

    if (player.destinationPosition) {
      includePoint(player.destinationPosition, 2);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = -10;
    maxX = 10;
    minZ = -8;
    maxZ = 8;
  }

  if (maxX - minX < 1) {
    minX -= 0.5;
    maxX += 0.5;
  }

  if (maxZ - minZ < 1) {
    minZ -= 0.5;
    maxZ += 0.5;
  }

  return { maxX, maxZ, minX, minZ };
}

function createProjector(bounds: { maxX: number; maxZ: number; minX: number; minZ: number }) {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxZ - bounds.minZ;

  return (position: MapPosition) => ({
    x: 8 + ((position.x - bounds.minX) / width) * 84,
    y: 8 + ((position.z - bounds.minZ) / height) * 84
  });
}

function planetName(world: WorldSnapshot, planetId: string): string {
  return world.planets.find((planet) => planet.id === planetId)?.name ?? planetId;
}

function formatCredits(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function playerForClient(world: WorldSnapshot, clientId: string): PlayerShip | null {
  return world.players.find((player) => player.ownerClientId === clientId) ?? null;
}

function playerStatus(player: WorldSnapshot["players"][number], location: string, destination: string | null): string {
  if (player.destinationPosition) {
    return `moving to ${destination ?? formatPosition(player.destinationPosition)}`;
  }

  return player.locationPlanetId ? `docked at ${location}` : `idle at ${location}`;
}

function formatPosition(position: { x: number; z: number }): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}

function shortClientId(clientId: string): string {
  return clientId.slice(-8);
}