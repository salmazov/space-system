export interface Good {
  label: string;
}

export interface Store {
  id: string;
  inventory: Record<string, number>;
  name: string;
  prices: Record<string, number>;
}

export interface Planet {
  blockade: boolean;
  faction: string;
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

export interface ConnectedUser {
  connectedAt: string;
  name: string;
}

export interface WorldSnapshot {
  connectedUsers: ConnectedUser[];
  connectionCounts?: {
    users: number;
  };
  goods: Record<string, Good>;
  planets: Planet[];
  player: PlayerShip | null;
  recentEvents: Array<{ message: string }>;
  tick: number;
  tickMs: number;
}