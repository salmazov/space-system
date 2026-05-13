import type { PlayerShip, SosSignal, WorldSnapshot } from "../game/types.js";

const SHARE_FUEL_QTY = 5;
const FUEL_SHARE_DISTANCE = 1.8;

export function renderSosPanel(
  container: HTMLElement,
  world: WorldSnapshot,
  clientId: string,
  onShareFuel: (targetClientId: string, qty: number) => void
): void {
  const ship = world.players.find((p) => p.ownerClientId === clientId) ?? null;

  if (!ship || ship.locationPlanetId) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  const nearbySignals = world.sosSignals.filter((signal) => {
    if (signal.clientId === clientId) return false;
    const dx = signal.position.x - ship.position.x;
    const dz = signal.position.z - ship.position.z;
    return Math.hypot(dx, dz) <= FUEL_SHARE_DISTANCE;
  });

  if (nearbySignals.length === 0) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  container.hidden = false;

  const header = document.createElement("header");
  header.className = "dock-title";
  const title = document.createElement("strong");
  title.textContent = "Nearby Distress Signals";
  header.appendChild(title);

  const list = document.createElement("div");
  list.className = "market-list";

  for (const signal of nearbySignals) {
    const row = document.createElement("div");
    row.className = "market-row";

    const details = document.createElement("div");
    details.className = "market-details";

    const name = document.createElement("strong");
    name.textContent = signal.shipName;

    const meta = document.createElement("span");
    meta.textContent = `Needs ${signal.fuelNeeded} fuel`;

    details.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "trade-actions";

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "trade-command trade-buy";
    shareButton.textContent = `Share ${SHARE_FUEL_QTY} Fuel`;

    const reserve = Math.max(4, ship.fuelCapacity * 0.2);
    const shareable = ship.fuel - reserve;
    shareButton.disabled = shareable < SHARE_FUEL_QTY;

    shareButton.addEventListener("click", () => {
      onShareFuel(signal.clientId, SHARE_FUEL_QTY);
    });

    actions.appendChild(shareButton);
    row.append(details, actions);
    list.appendChild(row);
  }

  container.replaceChildren(header, list);
}
