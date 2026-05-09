export interface Good {
  label: string;
}

export interface Store {
  inventory: Record<string, number>;
  prices: Record<string, number>;
}

export interface Planet {
  id: string;
  name: string;
  stores: Store[];
}

export interface PlayerShip {
  cargo: Record<string, number>;
  cargoCapacity: number;
  credits: number;
  destinationPlanetId: string | null;
  locationPlanetId: string;
  name: string;
  travelRemainingTicks: number;
}

export interface QueuedAction {
  action: {
    action: string;
  };
}

export interface WorldSnapshot {
  goods: Record<string, Good>;
  pendingActions: QueuedAction[];
  planets: Planet[];
  player: PlayerShip | null;
  tick: number;
}

export type ClientAction =
  | { action: "spawn"; name: string; target: string }
  | { action: "travel"; target: string }
  | { action: "buy" | "sell"; item: string; qty: number };

export type ActionResponse =
  | { accepted: true; queuedForTick: number }
  | { accepted: false; reason?: string };