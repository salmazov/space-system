import type { DashboardElements } from "./dom.js";
import type { Good, Planet, WorldSnapshot } from "./types.js";

export function renderWorld(world: WorldSnapshot, elements: DashboardElements): void {
  elements.tick.textContent = String(world.tick);
  elements.tickRate.textContent = `${world.tickMs / 1000}s`;
  elements.connectedUserCount.textContent = String(world.connectionCounts?.users ?? 0);

  elements.planets.replaceChildren(...world.planets.map((planet) => renderPlanet(planet, world.goods)));
  elements.connectedUsers.replaceChildren(...renderConnectedUsers(world.connectedUsers ?? []));
  elements.playerShip.replaceChildren(...renderPlayerShip(world));
  elements.events.replaceChildren(...renderEvents(world.recentEvents));
}

function renderConnectedUsers(connectedUsers: WorldSnapshot["connectedUsers"]): HTMLLIElement[] {
  if (!connectedUsers.length) {
    return [listItem("No playable clients connected.")];
  }

  return connectedUsers.map((user) => {
    const connectedAt = new Date(user.connectedAt).toLocaleTimeString();
    return listItem(`${user.name} connected at ${connectedAt}`);
  });
}

function renderPlayerShip(world: WorldSnapshot): HTMLLIElement[] {
  if (!world.player) {
    return [listItem("No player ship spawned.")];
  }

  const location = planetName(world, world.player.locationPlanetId);
  const destination = world.player.destinationPlanetId ? planetName(world, world.player.destinationPlanetId) : null;
  const cargoUsed = Object.values(world.player.cargo).reduce((sum, amount) => sum + amount, 0);
  const status = destination
    ? `Traveling from ${location} to ${destination}, ${world.player.travelRemainingTicks} ticks left`
    : `Docked at ${location}`;

  return [
    listItem(`${world.player.name}: ${status}`),
    listItem(`Credits: ${world.player.credits}`),
    listItem(`Cargo: ${cargoUsed}/${world.player.cargoCapacity}`)
  ];
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