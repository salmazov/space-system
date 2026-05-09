import type { UserClientElements } from "./dom.js";
import type { Planet, WorldSnapshot } from "./types.js";

export function renderWorld(world: WorldSnapshot, elements: UserClientElements): void {
  syncOptions(elements.startPlanetSelect, world.planets.map((planet) => [planet.id, planet.name]));
  syncOptions(elements.travelPlanetSelect, world.planets.map((planet) => [planet.id, planet.name]));
  syncOptions(elements.goodSelect, Object.entries(world.goods).map(([goodId, good]) => [goodId, good.label]));

  const currentPlanetId = currentPlanet(world, elements);
  const currentPlanetState = world.planets.find((planet) => planet.id === currentPlanetId) ?? world.planets[0];

  updateControls(world, elements, currentPlanetId);
  renderShip(world, elements);

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

function updateControls(world: WorldSnapshot, elements: UserClientElements, currentPlanetId: string): void {
  const player = world.player;
  const isSpawnPending = world.pendingActions.some((queuedAction) => queuedAction.action.action === "spawn");
  const canSpawn = !player && !isSpawnPending;
  const canAct = Boolean(player && !player.destinationPlanetId);

  elements.spawnButton.disabled = !canSpawn;
  elements.startPlanetSelect.disabled = !canSpawn;
  elements.travelButton.disabled = !canAct || elements.travelPlanetSelect.value === currentPlanetId;
  elements.travelPlanetSelect.disabled = !canAct;
  elements.buyButton.disabled = !canAct;
  elements.sellButton.disabled = !canAct;
  elements.goodSelect.disabled = !player;
  elements.qtyInput.disabled = !player;
  elements.tickLabel.textContent = `Tick ${world.tick}`;
}

function renderShip(world: WorldSnapshot, elements: UserClientElements): void {
  const player = world.player;

  if (!player) {
    elements.shipStats.replaceChildren(statRow("Status", "No ship spawned"));
    return;
  }

  const location = planetName(world, player.locationPlanetId);
  const destination = player.destinationPlanetId ? planetName(world, player.destinationPlanetId) : null;
  const cargoUsed = Object.values(player.cargo).reduce((sum, amount) => sum + amount, 0);
  const cargo = Object.entries(player.cargo)
    .filter(([, amount]) => amount > 0)
    .map(([item, amount]) => `${item}: ${amount}`)
    .join(", ") || "Empty";

  elements.shipStats.replaceChildren(
    statRow("Status", destination ? `Traveling to ${destination}` : `Docked at ${location}`),
    statRow("Credits", String(player.credits)),
    statRow("Cargo", `${cargoUsed}/${player.cargoCapacity}`),
    statRow("Hold", cargo),
    statRow("Travel", destination ? `${player.travelRemainingTicks} ticks left` : "Ready")
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

      row.append(title, price, stock);
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

function currentPlanet(world: WorldSnapshot, elements: UserClientElements): string {
  const currentPlanetId = world.player?.locationPlanetId ?? elements.startPlanetSelect.value ?? world.planets[0]?.id ?? "";

  if (world.player && elements.travelPlanetSelect.value === currentPlanetId) {
    elements.travelPlanetSelect.value = world.planets.find((planet) => planet.id !== currentPlanetId)?.id ?? currentPlanetId;
  }

  return currentPlanetId;
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