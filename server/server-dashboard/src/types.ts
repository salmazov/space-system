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

export interface SosSignal {
  clientId: string;
  createdAtTick: number;
  fuelNeeded: number;
  id: string;
  position: MapPosition;
  radius: number;
  shipName: string;
}

export type ShipClassId = "small_trade_ship" | "freightliner" | "yacht";

export interface Store {
  credits: number;
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
  faction: string;
  fuel: number;
  fuelBurnPerUnit: number;
  fuelCapacity: number;
  homePlanetId: string;
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
  activeClientIds?: string[];
  activityTimeoutMs?: number;
  connectedUsers: ConnectedUser[];
  connectionCounts?: {
    users: number;
  };
  goods: Record<string, Good>;
  planets: Planet[];
  players: PlayerShip[];
  recentEvents: Array<{ message: string }>;
  sosSignals: SosSignal[];
  tick: number;
  tickMs: number;
}