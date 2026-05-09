export interface DashboardElements {
  connectedUserCount: HTMLElement;
  connectedUsers: HTMLUListElement;
  events: HTMLUListElement;
  planets: HTMLElement;
  playerShip: HTMLUListElement;
  status: HTMLElement;
  tick: HTMLElement;
  tickRate: HTMLElement;
}

export function getDashboardElements(): DashboardElements {
  return {
    connectedUserCount: byId("connectedUserCount"),
    connectedUsers: byId("connectedUsers"),
    events: byId("events"),
    planets: byId("planets"),
    playerShip: byId("playerShip"),
    status: byId("connectionStatus"),
    tick: byId("tick"),
    tickRate: byId("tickRate")
  };
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`#${id}`);

  if (!element) {
    throw new Error(`Missing element #${id}`);
  }

  return element;
}