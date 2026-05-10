import type { DashboardElements } from "./dom.js";
import type { Good, Planet, WorldSnapshot } from "./types.js";

export function renderWorld(world: WorldSnapshot, elements: DashboardElements): void {
  elements.tick.textContent = String(world.tick);
  elements.tickRate.textContent = `${world.tickMs / 1000}s`;
  elements.connectedUserCount.textContent = String(world.connectionCounts?.users ?? 0);

  elements.planets.replaceChildren(...world.planets.map((planet) => renderPlanet(planet, world.goods)));
  elements.connectedUsers.replaceChildren(...renderConnectedUsers(world.connectedUsers ?? []));
  elements.playerShip.replaceChildren(...renderPlayerShips(world));
  elements.events.replaceChildren(...renderEvents(world.recentEvents));
}

function renderConnectedUsers(connectedUsers: WorldSnapshot["connectedUsers"]): HTMLLIElement[] {
  if (!connectedUsers.length) {
    return [listItem("No playable clients connected.")];
  }

  return connectedUsers.map((user) => {
    const connectedAt = new Date(user.connectedAt).toLocaleTimeString();
    const clientId = user.clientId ? ` (${shortClientId(user.clientId)})` : "";
    return listItem(`${user.name}${clientId} connected at ${connectedAt}`);
  });
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

  article.append(renderStoreName(store.name), renderGoods(store, goods));
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

function renderStoreName(name: string): HTMLElement {
  const storeName = document.createElement("div");
  storeName.className = "store-name";
  storeName.textContent = name;
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

function planetName(world: WorldSnapshot, planetId: string): string {
  return world.planets.find((planet) => planet.id === planetId)?.name ?? planetId;
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