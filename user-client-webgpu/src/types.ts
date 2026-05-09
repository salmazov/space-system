export interface Planet {
  blockade: boolean;
  faction: string;
  id: string;
  name: string;
}

export interface PlayerShip {
  destinationPlanetId: string | null;
  locationPlanetId: string;
  name: string;
  travelRemainingTicks: number;
  travelTotalTicks: number;
}

export interface QueuedAction {
  action: {
    action: string;
  };
}

export interface WorldSnapshot {
  pendingActions: QueuedAction[];
  planets: Planet[];
  player: PlayerShip | null;
  tick: number;
}

export type ClientAction =
  | { action: "spawn"; name: string; target: string }
  | { action: "travel"; target: string };

export type ActionResponse =
  | { accepted: true; queuedForTick: number }
  | { accepted: false; reason?: string };

export interface Vec2 {
  x: number;
  y: number;
}