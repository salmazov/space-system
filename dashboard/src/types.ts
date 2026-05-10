export interface Good {
  label: string;
}

export interface MapPosition {
  x: number;
  y: number;
  z: number;
}

export interface ExploredArea {
  center: MapPosition;
  radius: number;
  visitedAtTick: number;
}

export type ShipClassId = "small_trade_ship" | "freightliner" | "yacht";

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
  position: MapPosition;
  stores: Store[];
}

export interface PlayerShip {
  cargo: Record<string, number>;
  cargoCapacity: number;
  credits: number;
  destinationPosition: MapPosition | null;
  destinationPlanetId: string | null;
  exploredAreas: ExploredArea[];
  explorationRadius: number;
  id: string;
  locationPlanetId: string | null;
  name: string;
  ownerClientId: string;
  position: MapPosition;
  priceEuro: number;
  shipClassId: ShipClassId;
  shipClassLabel: string;
  speed: number;
}

export interface ConnectedUser {
  clientId?: string;
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
  players: PlayerShip[];
  recentEvents: Array<{ message: string }>;
  tick: number;
  tickMs: number;
}