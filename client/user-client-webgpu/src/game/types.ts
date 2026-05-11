export interface Good {
  basePrice: number;
  label: string;
  targetStock: number;
}

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
  position: Vec3;
  stores: Store[];
}

export interface ExploredArea {
  center: Vec3;
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

export interface PlayerShip {
  cargo: Record<string, number>;
  cargoCapacity: number;
  credits: number;
  destinationPosition: Vec3 | null;
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
  position: Vec3;
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
  tickMs: number;
}

export type ClientAction =
  | { action: "spawn"; name: string; shipClassId: ShipClassId; target: string }
  | { action: "move"; target: Vec3 }
  | { action: "travel"; target: string }
  | { action: "buy" | "sell"; item: string; qty: number };

export type ActionResponse =
  | { accepted: true; queuedForTick: number }
  | { accepted: false; reason?: string };

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}