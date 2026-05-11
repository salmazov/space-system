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

export interface ShipClass {
  cargoCapacity: number;
  explorationRadius: number;
  fuelBurnPerUnit: number;
  fuelCapacity: number;
  id: ShipClassId;
  label: string;
  priceEuro: number;
  speed: number;
  startingFuel: number;
}

export interface Store {
  credits: number;
  inventory: Record<string, number>;
  prices: Record<string, number>;
}

export interface Planet {
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

export interface QueuedAction {
  action: {
    action: string;
    clientId: string;
  };
}

export interface WorldSnapshot {
  goods: Record<string, Good>;
  pendingActions: QueuedAction[];
  planets: Planet[];
  players: PlayerShip[];
  shipClasses: Record<ShipClassId, ShipClass>;
  tick: number;
}

export type ClientAction =
  | { action: "spawn"; name: string; shipClassId: ShipClassId; target: string }
  | { action: "move"; target: MapPosition }
  | { action: "travel"; target: string }
  | { action: "buy" | "sell"; item: string; qty: number };

export type ActionResponse =
  | { accepted: true; queuedForTick: number }
  | { accepted: false; reason?: string };