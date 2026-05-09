export interface Good {
  basePrice: number;
  label: string;
  targetStock: number;
}

export type GoodsCatalog = Record<string, Good>;
export type Inventory = Record<string, number>;

export interface PlanetTemplate {
  faction: string;
  id: string;
  inventory: Inventory;
  name: string;
}

export interface Store {
  id: string;
  inventory: Inventory;
  name: string;
  prices: Inventory;
}

export interface Planet {
  blockade: boolean;
  faction: string;
  id: string;
  name: string;
  stores: Store[];
}

export interface PlayerShip {
  cargo: Inventory;
  cargoCapacity: number;
  credits: number;
  destinationPlanetId: string | null;
  id: string;
  locationPlanetId: string;
  name: string;
  travelRemainingTicks: number;
  travelTotalTicks: number;
  type: "trade_ship";
}

export interface SpawnAction {
  action: "spawn";
  name: string;
  target: string;
}

export interface TravelAction {
  action: "travel";
  target: string;
}

export interface TradeAction {
  action: "buy" | "sell";
  item: string;
  qty: number;
}

export interface WaitAction {
  action: "wait";
}

export type ClientAction = SpawnAction | TravelAction | TradeAction | WaitAction;

export interface QueuedAction {
  action: ClientAction;
  executeAtTick: number;
  id: string;
  submittedTick: number;
}

export interface WorldEvent {
  message: string;
  type: string;
}

export interface World {
  goods: GoodsCatalog;
  nextActionId: number;
  pendingActions: QueuedAction[];
  planets: Planet[];
  player: PlayerShip | null;
  recentEvents: WorldEvent[];
  tick: number;
  tickMs: number;
}

export interface WorldSnapshot {
  goods: GoodsCatalog;
  pendingActions: QueuedAction[];
  planets: Array<Pick<Planet, "blockade" | "faction" | "id" | "name"> & { stores: Store[] }>;
  player: PlayerShip | null;
  recentEvents: WorldEvent[];
  tick: number;
  tickMs: number;
}

export interface ConnectedClient {
  connectedAt: string;
  id: string;
  name: string;
  type: "dashboard" | "user";
}

export interface ServerSnapshot extends WorldSnapshot {
  connectedUsers: ConnectedClient[];
  connectionCounts: {
    dashboards: number;
    users: number;
  };
}

export type ActionValidationResult =
  | { accepted: true; action: ClientAction }
  | { accepted: false; reason: string };

export type QueuedActionResult =
  | { accepted: true; action: ClientAction; actionId: string; queuedForTick: number }
  | { accepted: false; reason: string };

export interface AppliedActionResult {
  accepted: boolean;
  message: string;
}