import type { UserClientElements } from "./dom.js";
import type { Planet, PlayerShip, WorldSnapshot } from "./types.js";

export function renderWorld(world: WorldSnapshot, elements: UserClientElements, clientId: string): void {
  syncOptions(elements.startPlanetSelect, world.planets.map((planet) => [planet.id, planet.name]));
  syncOptions(elements.travelPlanetSelect, world.planets.map((planet) => [planet.id, planet.name]));
  syncOptions(elements.goodSelect, Object.entries(world.goods).map(([goodId, good]) => [goodId, good.label]));
  syncOptions(
    elements.shipClassSelect,
    Object.values(world.shipClasses).map((shipClass) => [shipClass.id, `${shipClass.label} - EUR ${shipClass.priceEuro}`])
  );

  const player = playerForClient(world, clientId);
  const currentPlanetId = currentPlanet(world, elements, player);
  const currentPlanetState = world.planets.find((planet) => planet.id === currentPlanetId) ?? world.planets[0];

  updateControls(world, elements, currentPlanetId, clientId, player);
  renderShip(world, elements, player);

  if (currentPlanetState) {
    renderMarket(world, currentPlanetState, elements);
  }
}

export function addLog(message: string, elements: UserClientElements): void {
  const item = document.createElement("li");
  item.textContent = message;
  elements.actionLog.prepend(item);

  while (elements.actionLog.children.length > 8) {
    elements.actionLog.lastElementChild?.remove();
  }
}

function updateControls(
  world: WorldSnapshot,
  elements: UserClientElements,
  currentPlanetId: string,
  clientId: string,
  player: PlayerShip | null
): void {
  const isSpawnPending = world.pendingActions.some(
    (queuedAction) => queuedAction.action.action === "spawn" && queuedAction.action.clientId === clientId
  );
  const canSpawn = !player && !isSpawnPending;
  const canMove = Boolean(player);
  const canTrade = Boolean(player?.locationPlanetId && !player.destinationPosition);

  elements.spawnButton.disabled = !canSpawn;
  elements.startPlanetSelect.disabled = !canSpawn;
  elements.shipClassSelect.disabled = !canSpawn;
  elements.travelButton.disabled = !canMove || (!player?.destinationPosition && elements.travelPlanetSelect.value === currentPlanetId);
  elements.travelPlanetSelect.disabled = !canMove;
  elements.buyButton.disabled = !canTrade;
  elements.sellButton.disabled = !canTrade;
  elements.goodSelect.disabled = !canTrade;
  elements.qtyInput.disabled = !canTrade;
  elements.tickLabel.textContent = `Tick ${world.tick}`;
}

function renderShip(world: WorldSnapshot, elements: UserClientElements, player: PlayerShip | null): void {
  if (!player) {
    elements.shipStats.replaceChildren(statRow("Status", "No ship spawned"));
    return;
  }

  const location = player.locationPlanetId ? planetName(world, player.locationPlanetId) : "Deep space";
  const destination = player.destinationPlanetId ? planetName(world, player.destinationPlanetId) : null;
  const cargoUsed = Object.values(player.cargo).reduce((sum, amount) => sum + amount, 0);
  const cargo = Object.entries(player.cargo)
    .filter(([, amount]) => amount > 0)
    .map(([item, amount]) => `${item}: ${amount}`)
    .join(", ") || "Empty";

  elements.shipStats.replaceChildren(
    statRow("Status", movementStatus(player, location, destination)),
    statRow("Class", `${player.shipClassLabel} (EUR ${player.priceEuro})`),
    statRow("Speed", `${player.speed} map units/s`),
    statRow("Credits", String(player.credits)),
    statRow("Cargo", `${cargoUsed}/${player.cargoCapacity}`),
    statRow("Hold", cargo),
    statRow("Explored", `${player.exploredAreas.length} map sectors`)
  );
}

function renderMarket(world: WorldSnapshot, planet: Planet, elements: UserClientElements): void {
  const store = planet.stores[0];

  elements.marketTitle.textContent = `${planet.name} Market`;

  if (!store) {
    elements.marketGoods.replaceChildren();
    return;
  }

  elements.marketGoods.replaceChildren(
    ...Object.entries(world.goods).map(([goodId, good]) => {
      const row = document.createElement("div");
      row.className = "good";

      const title = document.createElement("strong");
      title.textContent = good.label;

      const price = document.createElement("span");
      price.textContent = `${store.prices[goodId] ?? 0} credits`;

      const stock = document.createElement("span");
      stock.textContent = `Stock ${store.inventory[goodId] ?? 0}`;

      const treasury = document.createElement("span");
      treasury.textContent = `Market treasury ${store.credits} credits`;

      row.append(title, price, stock, treasury);
      return row;
    })
  );
}

function syncOptions(select: HTMLSelectElement, entries: Array<[string, string]>): void {
  const selectedValue = select.value;

  select.replaceChildren(
    ...entries.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    })
  );

  if (entries.some(([value]) => value === selectedValue)) {
    select.value = selectedValue;
  }
}

function currentPlanet(world: WorldSnapshot, elements: UserClientElements, player: PlayerShip | null): string {
  const currentPlanetId = player?.locationPlanetId ?? elements.startPlanetSelect.value ?? world.planets[0]?.id ?? "";

  if (player && elements.travelPlanetSelect.value === currentPlanetId) {
    elements.travelPlanetSelect.value = world.planets.find((planet) => planet.id !== currentPlanetId)?.id ?? currentPlanetId;
  }

  return currentPlanetId;
}

function movementStatus(player: PlayerShip, location: string, destination: string | null): string {
  if (player.destinationPosition) {
    return destination ? `Moving to ${destination}` : `Moving to x ${player.destinationPosition.x.toFixed(1)}, z ${player.destinationPosition.z.toFixed(1)}`;
  }

  return player.locationPlanetId ? `Docked at ${location}` : `Idle near x ${player.position.x.toFixed(1)}, z ${player.position.z.toFixed(1)}`;
}

function playerForClient(world: WorldSnapshot, clientId: string): PlayerShip | null {
  return world.players.find((player) => player.ownerClientId === clientId) ?? null;
}

function statRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  return row;
}

function planetName(world: WorldSnapshot, planetId: string): string {
  return world.planets.find((planet) => planet.id === planetId)?.name ?? planetId;
}