import type { PlayerShip, WorldSnapshot } from "../game/types.js";

export function renderResourceBar(
  container: HTMLElement,
  world: WorldSnapshot,
  clientId: string
): void {
  const ship = world.players.find((p) => p.ownerClientId === clientId) ?? null;

  if (!ship) {
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const cells: string[] = [];

  cells.push(cell("Credits", `${formatCredits(ship.credits)}`, "credits"));
  cells.push(fuelCell(ship));

  const cargoTotal = cargoUsed(ship);
  cells.push(cell("Cargo", `${cargoTotal}/${ship.cargoCapacity}`, "cargo"));

  for (const [goodId, good] of Object.entries(world.goods)) {
    if (goodId === "fuel") continue;
    const qty = ship.cargo[goodId] ?? 0;
    cells.push(cell(good.label, `${qty}`, qty > 0 ? "has-stock" : "empty"));
  }

  container.innerHTML = cells.join("");
}

function cell(label: string, value: string, modifier: string): string {
  return `<div class="res-cell res-${modifier}"><span class="res-label">${label}</span><span class="res-value">${value}</span></div>`;
}

function fuelCell(ship: PlayerShip): string {
  const ratio = ship.fuelCapacity > 0 ? ship.fuel / ship.fuelCapacity : 0;
  const pct = Math.round(ratio * 100);
  const tier = ratio > 0.35 ? "ok" : ratio > 0.12 ? "mid" : "low";

  return `<div class="res-cell res-fuel"><span class="res-label">Fuel</span><span class="res-value">${formatNum(ship.fuel)}/${formatNum(ship.fuelCapacity)}</span><div class="res-fuel-track"><div class="res-fuel-fill res-fuel-${tier}" style="width:${pct}%"></div></div></div>`;
}

function cargoUsed(ship: PlayerShip): number {
  return Object.values(ship.cargo).reduce((sum, qty) => sum + qty, 0);
}

function formatCredits(n: number): string {
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

function formatNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
