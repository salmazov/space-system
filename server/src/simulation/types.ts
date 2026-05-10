export interface Good {
  basePrice: number;
  label: string;
  targetStock: number;
}

export type GoodsCatalog = Record<string, Good>;
export type Inventory = Record<string, number>;

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
  id: ShipClassId;
  label: string;
  priceEuro: number;
  speed: number;
}

export type ShipClassCatalog = Record<ShipClassId, ShipClass>;

export interface PlanetTemplate {
  faction: string;
  id: string;
  inventory: Inventory;
  name: string;
  position: MapPosition;
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
  position: MapPosition;
  stores: Store[];
}

export interface PlayerShip {
  cargo: Inventory;
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
  type: "player_ship";
}

export interface SpawnAction {
  action: "spawn";
  clientId: string;
  name: string;
  shipClassId: ShipClassId;
  target: string;
}

export interface MoveAction {
  action: "move";
  clientId: string;
  target: MapPosition;
}

export interface TravelAction {
  action: "travel";
  clientId: string;
  target: string;
}

export interface TradeAction {
  action: "buy" | "sell";
  clientId: string;
  item: string;
  qty: number;
}

export interface WaitAction {
  action: "wait";
  clientId: string;
}

export type ClientAction = SpawnAction | MoveAction | TravelAction | TradeAction | WaitAction;

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
  lastMovementAtMs: number;
  nextActionId: number;
  pendingActions: QueuedAction[];
  planets: Planet[];
  players: PlayerShip[];
  recentEvents: WorldEvent[];
  tick: number;
  tickMs: number;
}

export interface WorldSnapshot {
  goods: GoodsCatalog;
  pendingActions: QueuedAction[];
  planets: Array<Pick<Planet, "blockade" | "faction" | "id" | "name" | "position"> & { stores: Store[] }>;
  players: PlayerShip[];
  recentEvents: WorldEvent[];
  shipClasses: ShipClassCatalog;
  tick: number;
  tickMs: number;
}

export interface ConnectedClient {
  clientId?: string;
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