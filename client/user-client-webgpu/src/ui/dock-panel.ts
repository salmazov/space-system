import type { ClientAction, Mission, PlayerShip, ShipClass, WorldSnapshot } from "../game/types.js";

type TradeCommand = Extract<ClientAction, { action: "buy" | "sell" }>;
type BuyShipCommand = Extract<ClientAction, { action: "buy_ship" }>;
type AcceptMissionCommand = Extract<ClientAction, { action: "accept_mission" }>;

const TRADE_QTY = 1;
const TRADE_EFFECT_MS = 460;
const FUEL_GOOD_ID = "fuel";

const activeTradeEffects = new Map<string, number>();

const SHIP_PURCHASE_CREDIT_RATE = 0.004;
const PURCHASABLE_CLASSES = ["freightliner", "yacht", "fighter"] as const;

export interface DockPanelCallbacks {
  onTrade: (action: TradeCommand) => void;
  onBuyShip: (action: BuyShipCommand) => void;
  onAcceptMission: (action: AcceptMissionCommand) => void;
}

export function renderDockPanel(
  container: HTMLElement,
  world: WorldSnapshot,
  clientId: string,
  callbacks: DockPanelCallbacks
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

      const buyButton = tradeButton("Buy", { action: "buy", item: goodId, qty: TRADE_QTY }, callbacks.onTrade);
      buyButton.disabled = stock < TRADE_QTY || availableCapacity < TRADE_QTY || ship.credits < price * TRADE_QTY;

      const sellButton = tradeButton("Sell", { action: "sell", item: goodId, qty: TRADE_QTY }, callbacks.onTrade);
      sellButton.disabled = carried < TRADE_QTY || store.credits < price * TRADE_QTY;

      actions.append(buyButton, sellButton);
      row.append(details, actions);
      return row;
    })
  );

  const shipDealer = buildShipDealerSection(world, ship, callbacks.onBuyShip);
  const missionBoard = buildMissionBoardSection(world, ship, clientId, callbacks.onAcceptMission);

  container.hidden = false;
  container.replaceChildren(header, market, shipDealer, missionBoard);
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

function buildShipDealerSection(
  world: WorldSnapshot,
  ship: PlayerShip,
  onBuyShip: (action: BuyShipCommand) => void
): HTMLElement {
  const section = document.createElement("div");
  section.className = "dock-section ship-dealer";

  const heading = document.createElement("h3");
  heading.textContent = "Ship Dealer";
  section.appendChild(heading);

  const currentLabel = document.createElement("div");
  currentLabel.className = "ship-dealer-current";
  currentLabel.textContent = `Current ship: ${ship.shipClassLabel}`;
  section.appendChild(currentLabel);

  for (const classId of PURCHASABLE_CLASSES) {
    const shipClass = world.shipClasses[classId] as ShipClass | undefined;
    if (!shipClass) continue;
    if (classId === ship.shipClassId) continue;

    const price = Math.round(shipClass.priceEuro * SHIP_PURCHASE_CREDIT_RATE);

    const row = document.createElement("div");
    row.className = "market-row";

    const details = document.createElement("div");
    details.className = "market-details";

    const name = document.createElement("strong");
    name.textContent = shipClass.label;

    const meta = document.createElement("span");
    const specs = [
      `${price} credits`,
      `cargo ${shipClass.cargoCapacity}`,
      `speed ${shipClass.speed}`,
      `fuel ${shipClass.fuelCapacity}`
    ];
    meta.textContent = specs.join(" · ");

    details.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "trade-actions";

    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "trade-command trade-buy";
    buyBtn.textContent = "Buy";
    buyBtn.disabled = ship.credits < price;
    buyBtn.addEventListener("click", () => {
      onBuyShip({ action: "buy_ship", shipClassId: classId });
    });

    actions.appendChild(buyBtn);
    row.append(details, actions);
    section.appendChild(row);
  }

  return section;
}

function buildMissionBoardSection(
  world: WorldSnapshot,
  ship: PlayerShip,
  clientId: string,
  onAcceptMission: (action: AcceptMissionCommand) => void
): HTMLElement {
  const section = document.createElement("div");
  section.className = "dock-section mission-board";

  const heading = document.createElement("h3");
  heading.textContent = "Mission Board";
  section.appendChild(heading);

  const myMissions = world.missions.filter((m) => m.acceptedByClientId === clientId);
  const availableMissions = world.missions.filter((m) => !m.acceptedByClientId);

  if (myMissions.length > 0) {
    const activeHeading = document.createElement("div");
    activeHeading.className = "mission-subheading";
    activeHeading.textContent = "Active Missions";
    section.appendChild(activeHeading);

    for (const mission of myMissions) {
      section.appendChild(buildMissionRow(world, ship, mission, null));
    }
  }

  if (availableMissions.length > 0) {
    const availHeading = document.createElement("div");
    availHeading.className = "mission-subheading";
    availHeading.textContent = "Available";
    section.appendChild(availHeading);

    for (const mission of availableMissions) {
      section.appendChild(buildMissionRow(world, ship, mission, onAcceptMission));
    }
  }

  if (myMissions.length === 0 && availableMissions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mission-empty";
    empty.textContent = "No missions available.";
    section.appendChild(empty);
  }

  return section;
}

function buildMissionRow(
  world: WorldSnapshot,
  _ship: PlayerShip,
  mission: Mission,
  onAccept: ((action: AcceptMissionCommand) => void) | null
): HTMLElement {
  const row = document.createElement("div");
  row.className = "market-row mission-row";

  const details = document.createElement("div");
  details.className = "market-details";

  const name = document.createElement("strong");
  name.textContent = mission.title;

  const toPlanet = world.planets.find((p) => p.id === mission.toPlanetId)?.name ?? mission.toPlanetId;
  const meta = document.createElement("span");
  meta.textContent = `${mission.reward} credits · ${mission.qty} ${mission.goodId} → ${toPlanet} · expires tick ${mission.expiresAtTick}`;

  details.append(name, meta);

  const actions = document.createElement("div");
  actions.className = "trade-actions";

  if (onAccept) {
    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "trade-command trade-buy";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", () => {
      onAccept({ action: "accept_mission", missionId: mission.id });
    });
    actions.appendChild(acceptBtn);
  } else {
    const badge = document.createElement("span");
    badge.className = "mission-active-badge";
    badge.textContent = "Active";
    actions.appendChild(badge);
  }

  row.append(details, actions);
  return row;
}