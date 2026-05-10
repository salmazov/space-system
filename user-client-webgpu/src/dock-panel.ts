import type { ClientAction, PlayerShip, WorldSnapshot } from "./types.js";

type TradeCommand = Extract<ClientAction, { action: "buy" | "sell" }>;

const TRADE_QTY = 1;

export function renderDockPanel(
  container: HTMLElement,
  world: WorldSnapshot,
  clientId: string,
  onTrade: (action: TradeCommand) => void
): void {
  const ship = world.players.find((player) => player.ownerClientId === clientId) ?? null;

  if (!ship?.locationPlanetId || ship.destinationPosition) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  const planet = world.planets.find((candidate) => candidate.id === ship.locationPlanetId) ?? null;
  const store = planet?.stores[0] ?? null;

  if (!planet || !store) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  const header = document.createElement("header");
  header.className = "dock-title";

  const title = document.createElement("strong");
  title.textContent = `Docked at ${planet.name}`;

  const summary = document.createElement("span");
  summary.textContent = `${ship.name} · ${ship.credits} credits · cargo ${cargoUsed(ship)}/${ship.cargoCapacity}`;

  header.append(title, summary);

  const market = document.createElement("div");
  market.className = "market-list";

  market.replaceChildren(
    ...Object.entries(world.goods).map(([goodId, good]) => {
      const price = store.prices[goodId] ?? 0;
      const stock = store.inventory[goodId] ?? 0;
      const carried = ship.cargo[goodId] ?? 0;
      const availableCargo = ship.cargoCapacity - cargoUsed(ship);

      const row = document.createElement("div");
      row.className = "market-row";

      const details = document.createElement("div");
      details.className = "market-details";

      const name = document.createElement("strong");
      name.textContent = good.label;

      const meta = document.createElement("span");
      meta.textContent = `${price} credits · stock ${stock} · hold ${carried}`;

      details.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "trade-actions";

      const buyButton = tradeButton("Buy", { action: "buy", item: goodId, qty: TRADE_QTY }, onTrade);
      buyButton.disabled = stock < TRADE_QTY || availableCargo < TRADE_QTY || ship.credits < price * TRADE_QTY;

      const sellButton = tradeButton("Sell", { action: "sell", item: goodId, qty: TRADE_QTY }, onTrade);
      sellButton.disabled = carried < TRADE_QTY;

      actions.append(buyButton, sellButton);
      row.append(details, actions);
      return row;
    })
  );

  container.hidden = false;
  container.replaceChildren(header, market);
}

function tradeButton(label: string, action: TradeCommand, onTrade: (action: TradeCommand) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => onTrade(action));
  return button;
}

function cargoUsed(ship: PlayerShip): number {
  return Object.values(ship.cargo).reduce((sum, amount) => sum + amount, 0);
}