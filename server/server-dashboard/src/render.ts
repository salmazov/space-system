import type { DashboardElements } from "./dom.js";
import type { Good, MapPosition, Planet, PlayerShip, SosSignal, WorldSnapshot } from "./types.js";

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
  const visibleShips = observerShips(world);
  const activeClientIds = activeClientIdSet(world);
  const bounds = mapBounds(world, visibleShips);
  const projector = createProjector(bounds);
  const hiddenShips = world.players.length - visibleShips.length;
  const hiddenText = hiddenShips ? ` · ${hiddenShips} hidden` : "";

  summary.textContent = `${world.planets.length} planets · ${visibleShips.length}/${world.players.length} active ships · ${(world.sosSignals ?? []).length} SOS${hiddenText}`;
  container.replaceChildren(
    ...(world.sosSignals ?? []).map((signal) => renderSosRadius(signal, projector)),
    ...world.planets.map((planet) => renderPlanetMarker(planet, projector.project)),
    ...visibleShips.map((player) => renderShipMarker(player, projector.project, activeClientIds.has(player.ownerClientId)))
  );
}

function renderPlayerShips(world: WorldSnapshot): HTMLLIElement[] {
  if (!world.players.length) {
    return [listItem("No player ships spawned.")];
  }

  const players = observerShips(world).sort((left, right) => {
    const homeCompare = left.homePlanetId.localeCompare(right.homePlanetId);
    return homeCompare || left.name.localeCompare(right.name);
  });

  if (!players.length) {
    return [listItem(`${world.players.length} inactive ships hidden from observer.`)];
  }

  return [renderShipSummary(players, world.players.length), ...players.map((player) => renderShipCard(world, player))];
}

function renderShipSummary(players: PlayerShip[], totalPlayers: number): HTMLLIElement {
  const item = document.createElement("li");
  const cargoUsed = players.reduce((sum, player) => sum + usedCargo(player), 0);
  const cargoCapacity = players.reduce((sum, player) => sum + player.cargoCapacity, 0);
  const credits = players.reduce((sum, player) => sum + player.credits, 0);
  const fuel = players.reduce((sum, player) => sum + player.fuel, 0);
  const fuelCapacity = players.reduce((sum, player) => sum + player.fuelCapacity, 0);
  const factions = [...groupCounts(players.map((player) => player.faction)).entries()]
    .map(([faction, count]) => `${faction} ${count}`)
    .join(" · ");

  item.className = "ship-summary";
  item.append(
    shipStat("Active", `${players.length}/${totalPlayers}`),
    shipStat("Wallets", `${formatCredits(credits)} credits`),
    shipStat("Cargo", `${cargoUsed}/${cargoCapacity}`),
    shipStat("Fuel", `${formatCredits(fuel)}/${formatCredits(fuelCapacity)}`),
    shipStat("Factions", factions)
  );
  return item;
}

function renderShipCard(world: WorldSnapshot, player: PlayerShip): HTMLLIElement {
  const item = document.createElement("li");
  const header = document.createElement("div");
  const name = document.createElement("strong");
  const wallet = document.createElement("span");
  const meta = document.createElement("div");
  const stats = document.createElement("div");
  const location = player.locationPlanetId ? planetName(world, player.locationPlanetId) : formatPosition(player.position);
  const destination = player.destinationPlanetId ? planetName(world, player.destinationPlanetId) : null;
  const status = playerStatus(player, location, destination);

  item.className = "ship-card";
  item.style.setProperty("--ship-color", shipColor(player));
  header.className = "ship-card-header";
  name.textContent = player.name;
  wallet.className = "ship-wallet";
  wallet.textContent = `${formatCredits(player.credits)} credits`;
  header.append(name, wallet);

  meta.className = "ship-card-meta";
  meta.append(
    shipBadge(`${player.faction} · ${planetName(world, player.homePlanetId)}`),
    shipBadge(shortClientId(player.ownerClientId)),
    shipBadge(player.shipClassLabel)
  );

  stats.className = "ship-stats";
  stats.append(
    shipStat("Status", status),
    shipStat("Cargo", `${usedCargo(player)}/${player.cargoCapacity}`),
    shipStat("Fuel", `${formatCredits(player.fuel)}/${formatCredits(player.fuelCapacity)}`),
    shipStat("Explored", String(player.exploredAreas.length)),
    shipStat("Speed", `${player.speed} u/s`),
    shipStat("Value", `EUR ${formatCredits(player.priceEuro)}`)
  );

  item.append(header, meta, stats);
  return item;
}

function shipBadge(text: string): HTMLElement {
  const badge = document.createElement("span");

  badge.className = "ship-badge";
  badge.textContent = text;
  return badge;
}

function shipStat(label: string, value: string): HTMLElement {
  const stat = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  stat.className = "ship-stat";
  labelElement.textContent = label;
  valueElement.textContent = value;
  stat.append(labelElement, valueElement);
  return stat;
}

function groupCounts(values: string[]): Map<string, number> {
  return values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>());
}

function usedCargo(player: PlayerShip): number {
  return Object.values(player.cargo).reduce((sum, amount) => sum + amount, 0);
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
  marker.style.setProperty("--ship-color", shipColor(player));
  marker.style.left = `${point.x}%`;
  marker.style.top = `${point.y}%`;
  marker.title = `${player.name} ${formatPosition(player.position)}`;
  label.textContent = `${player.name} ${formatPosition(player.position)}`;
  marker.append(label);
  return marker;
}

function renderSosRadius(signal: SosSignal, projector: ReturnType<typeof createProjector>): HTMLElement {
  const point = projector.project(signal.position);
  const marker = document.createElement("div");

  marker.className = "sos-radius";
  marker.style.left = `${point.x}%`;
  marker.style.top = `${point.y}%`;
  marker.style.width = `${projector.radiusX(signal.radius) * 2}%`;
  marker.style.height = `${projector.radiusY(signal.radius) * 2}%`;
  marker.title = `SOS ${signal.shipName} needs ${signal.fuelNeeded} fuel`;
  return marker;
}

function shipColor(player: PlayerShip): string {
  switch (player.homePlanetId) {
    case "earth":
    case "luna":
      return "#2f9cf0";
    case "mars":
      return "#e0563c";
    case "jupiter":
      return "#d48642";
    case "saturn":
      return "#dfbd64";
    default:
      return "#55d7ff";
  }
}

function mapBounds(world: WorldSnapshot, players: PlayerShip[]): { maxX: number; maxZ: number; minX: number; minZ: number } {
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

  for (const player of players) {
    includePoint(player.position, player.explorationRadius);

    if (player.destinationPosition) {
      includePoint(player.destinationPosition, 2);
    }
  }

  for (const signal of world.sosSignals ?? []) {
    includePoint(signal.position, signal.radius);
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

  return {
    project: (position: MapPosition) => ({
      x: 8 + ((position.x - bounds.minX) / width) * 84,
      y: 8 + ((position.z - bounds.minZ) / height) * 84
    }),
    radiusX: (radius: number) => (radius / width) * 84,
    radiusY: (radius: number) => (radius / height) * 84
  };
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

function observerShips(world: WorldSnapshot): PlayerShip[] {
  const activeClientIds = activeClientIdSet(world);
  return world.players.filter((player) => activeClientIds.has(player.ownerClientId));
}

function activeClientIdSet(world: WorldSnapshot): Set<string> {
  return new Set([
    ...(world.activeClientIds ?? []),
    ...(world.connectedUsers ?? []).map((user) => user.clientId).filter((id): id is string => Boolean(id))
  ]);
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