export interface UserClientElements {
  actionLog: HTMLUListElement;
  buyButton: HTMLButtonElement;
  goodSelect: HTMLSelectElement;
  marketGoods: HTMLElement;
  marketTitle: HTMLElement;
  pilotName: HTMLElement;
  qtyInput: HTMLInputElement;
  sellButton: HTMLButtonElement;
  shipClassSelect: HTMLSelectElement;
  shipStats: HTMLElement;
  spawnButton: HTMLButtonElement;
  startPlanetSelect: HTMLSelectElement;
  status: HTMLElement;
  tickLabel: HTMLElement;
  travelButton: HTMLButtonElement;
  travelPlanetSelect: HTMLSelectElement;
}

export function getUserClientElements(): UserClientElements {
  return {
    actionLog: byId("actionLog"),
    buyButton: byId("buyButton"),
    goodSelect: byId("goodSelect"),
    marketGoods: byId("marketGoods"),
    marketTitle: byId("marketTitle"),
    pilotName: byId("pilotName"),
    qtyInput: byId("qtyInput"),
    sellButton: byId("sellButton"),
    shipClassSelect: byId("shipClassSelect"),
    shipStats: byId("shipStats"),
    spawnButton: byId("spawnButton"),
    startPlanetSelect: byId("startPlanetSelect"),
    status: byId("connectionStatus"),
    tickLabel: byId("tickLabel"),
    travelButton: byId("travelButton"),
    travelPlanetSelect: byId("travelPlanetSelect")
  };
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`#${id}`);

  if (!element) {
    throw new Error(`Missing element #${id}`);
  }

  return element;
}