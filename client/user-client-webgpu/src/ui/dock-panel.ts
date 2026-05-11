import type { ClientAction, PlayerShip, WorldSnapshot } from "../game/types.js";

type TradeCommand = Extract<ClientAction, { action: "buy" | "sell" }>;

const TRADE_QTY = 1;
const TRADE_EFFECT_MS = 460;
const FUEL_GOOD_ID = "fuel";

const activeTradeEffects = new Map<string, number>();

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

  const ledgers = document.createElement("div");
  ledgers.className = "dock-ledgers";
  ledgers.append(
    ledgerItem("Ship wallet", `${formatCredits(ship.credits)} credits`),
    ledgerItem(`${planet.name} market`, `${formatCredits(store.credits)} credits`),
    ledgerItem("Cargo", `${cargoUsed(ship)}/${ship.cargoCapacity}`),
    ledgerItem("Fuel", `${formatCredits(ship.fuel)}/${formatCredits(ship.fuelCapacity)}`)
  );

  header.append(title, ledgers);

  const market = document.createElement("div");
  market.className = "market-list";

  market.replaceChildren(
    ...Object.entries(world.goods).map(([goodId, good]) => {
      const price = store.prices[goodId] ?? 0;
      const stock = store.inventory[goodId] ?? 0;
      const isFuel = goodId === FUEL_GOOD_ID;
      const carried = isFuel ? ship.fuel : ship.cargo[goodId] ?? 0;
      const availableCapacity = isFuel ? ship.fuelCapacity - ship.fuel : ship.cargoCapacity - cargoUsed(ship);

      const row = document.createElement("div");
      row.className = "market-row";

      const details = document.createElement("div");
      details.className = "market-details";

      const name = document.createElement("strong");
      name.textContent = good.label;

      const meta = document.createElement("span");
      meta.textContent = isFuel
        ? `${price} credits · stock ${stock} · tank ${formatCredits(carried)}/${formatCredits(ship.fuelCapacity)}`
        : `${price} credits · stock ${stock} · hold ${carried}`;

      details.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "trade-actions";

      const buyButton = tradeButton("Buy", { action: "buy", item: goodId, qty: TRADE_QTY }, onTrade);
      buyButton.disabled = stock < TRADE_QTY || availableCapacity < TRADE_QTY || ship.credits < price * TRADE_QTY;

      const sellButton = tradeButton("Sell", { action: "sell", item: goodId, qty: TRADE_QTY }, onTrade);
      sellButton.disabled = carried < TRADE_QTY || store.credits < price * TRADE_QTY;

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
  const effectKey = tradeEffectKey(action);

  button.type = "button";
  button.className = `trade-command trade-${action.action}`;
  if (isTradeEffectActive(effectKey)) {
    button.classList.add("is-activating");
    scheduleTradeEffectRemoval(effectKey, button);
  }
  button.textContent = label;
  button.addEventListener("click", () => {
    triggerTradeEffect(effectKey, button);
    onTrade(action);
  });
  return button;
}

function ledgerItem(label: string, value: string): HTMLElement {
  const item = document.createElement("span");
  item.innerHTML = `<b>${label}</b>${value}`;
  return item;
}

function formatCredits(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function triggerTradeEffect(effectKey: string, button: HTMLButtonElement): void {
  const activeUntil = performance.now() + TRADE_EFFECT_MS;

  activeTradeEffects.set(effectKey, activeUntil);
  button.classList.remove("is-activating");
  button.getBoundingClientRect();
  button.classList.add("is-activating");
  scheduleTradeEffectRemoval(effectKey, button);
}

function scheduleTradeEffectRemoval(effectKey: string, button: HTMLButtonElement): void {
  const delay = Math.max(0, (activeTradeEffects.get(effectKey) ?? 0) - performance.now());

  globalThis.setTimeout(() => {
    if ((activeTradeEffects.get(effectKey) ?? 0) <= performance.now()) {
      activeTradeEffects.delete(effectKey);
      button.classList.remove("is-activating");
    }
  }, delay);
}

function isTradeEffectActive(effectKey: string): boolean {
  const activeUntil = activeTradeEffects.get(effectKey) ?? 0;

  if (activeUntil <= performance.now()) {
    activeTradeEffects.delete(effectKey);
    return false;
  }

  return true;
}

function tradeEffectKey(action: TradeCommand): string {
  return `${action.action}:${action.item}`;
}

function cargoUsed(ship: PlayerShip): number {
  return Object.values(ship.cargo).reduce((sum, amount) => sum + amount, 0);
}