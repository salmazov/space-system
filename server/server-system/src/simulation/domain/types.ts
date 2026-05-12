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

export type ShipClassId = "small_trade_ship" | "freightliner" | "yacht" | "government_freighter" | "police_ship" | "builder_ship";

export interface ShipBulkDiscount {
  minQty: number;
  rate: number;
}

export interface ShipWeapon {
  damage: number;
}

export interface PlanetIncident {
  attackerName: string;
  tick: number;
  type: "pirate_attack";
}

export interface DriftingCargo {
  cargo: Inventory;
  createdAtTick: number;
  id: string;
  position: MapPosition;
}

export interface ShipClass {
  bulkDiscount?: ShipBulkDiscount;
  cargoCapacity: number;
  explorationRadius: number;
  fuelBurnPerUnit: number;
  fuelCapacity: number;
  id: ShipClassId;
  label: string;
  priceEuro: number;
  speed: number;
  startingCredits?: number;
  startingFuel: number;
  weapon?: ShipWeapon;
}

export type ShipClassCatalog = Record<ShipClassId, ShipClass>;

export type PlanetType = "core" | "pirate" | "player_built";

export interface PlanetTemplate {
  credits: number;
  faction: string;
  id: string;
  inventory: Inventory;
  name: string;
  planetType: PlanetType;
  priceMultipliers: Inventory;
  position: MapPosition;
}

export interface Store {
  credits: number;
  id: string;
  inventory: Inventory;
  name: string;
  priceMultipliers: Inventory;
  prices: Inventory;
}

export interface Planet {
  blockade: boolean;
  faction: string;
  health: number;
  id: string;
  incidents: PlanetIncident[];
  name: string;
  ownerClientId: string | null;
  planetType: PlanetType;
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
  faction: string;
  fuel: number;
  fuelBurnPerUnit: number;
  fuelCapacity: number;
  happiness: number;
  health: number;
  homePlanetId: string;
  id: string;
  isPirate: boolean;
  locationPlanetId: string | null;
  name: string;
  ownerClientId: string;
  position: MapPosition;
  priceEuro: number;
  shipClassId: ShipClassId;
  shipClassLabel: string;
  speed: number;
  type: "player_ship";
  weapon: ShipWeapon | null;
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

export interface SosAction {
  action: "sos";
  clientId: string;
}

export interface ShareFuelAction {
  action: "share_fuel";
  clientId: string;
  qty: number;
  targetClientId: string;
}

export interface GoPirateAction {
  action: "go_pirate";
  clientId: string;
}

export interface PickupCargoAction {
  action: "pickup_cargo";
  cargoId: string;
  clientId: string;
}

export interface BuildStationAction {
  action: "build_station";
  clientId: string;
  name: string;
}

export interface ClaimStationAction {
  action: "claim_station";
  clientId: string;
}

export type ClientAction = SpawnAction | MoveAction | TravelAction | TradeAction | WaitAction | SosAction | ShareFuelAction | GoPirateAction | PickupCargoAction | BuildStationAction | ClaimStationAction;

export interface QueuedAction {
  action: ClientAction;
  executeAtTick: number;
  id: string;
  submittedTick: number;
}

export type ObserverActionValue = string | number | boolean | null | ObserverActionValue[] | { [key: string]: ObserverActionValue };

export interface ObserverLoggedAction {
  action?: string;
  clientId?: string;
  item?: string;
  name?: string;
  qty?: number;
  shipClassId?: ShipClassId;
  target?: string | MapPosition;
  targetClientId?: string;
}

export interface ObserverActionLogEntry {
  action: ObserverLoggedAction;
  actionId?: string;
  accepted: boolean;
  at: string;
  clientId?: string;
  decision?: Record<string, ObserverActionValue>;
  id: string;
  queuedForTick?: number;
  reason?: string;
  shipId?: string;
  shipName?: string;
  tick: number;
}

export interface WorldEvent {
  message: string;
  type: string;
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

export type ClientActivitySource = "http" | "websocket";

export interface ClientActivity {
  clientId: string;
  lastSeenAt: string;
  lastSeenAtMs: number;
  lastSeenTick: number;
  source: ClientActivitySource;
}

export interface World {
  actionLog: ObserverActionLogEntry[];
  clientActivity: Record<string, ClientActivity>;
  driftingCargo: DriftingCargo[];
  goods: GoodsCatalog;
  lastMovementAtMs: number;
  nextActionId: number;
  pendingActions: QueuedAction[];
  planets: Planet[];
  players: PlayerShip[];
  policeShips: PlayerShip[];
  recentEvents: WorldEvent[];
  sosSignals: SosSignal[];
  tick: number;
  tickMs: number;
}

export interface WorldSnapshot {
  actionLog: ObserverActionLogEntry[];
  goods: GoodsCatalog;
  pendingActions: QueuedAction[];
  driftingCargo: DriftingCargo[];
  planets: Array<Pick<Planet, "blockade" | "faction" | "health" | "id" | "incidents" | "name" | "ownerClientId" | "planetType" | "position"> & { stores: Store[] }>;
  players: PlayerShip[];
  policeShips: PlayerShip[];
  recentEvents: WorldEvent[];
  shipClasses: ShipClassCatalog;
  sosSignals: SosSignal[];
  tick: number;
  tickMs: number;
}

export interface BotSnapshot {
  driftingCargo: DriftingCargo[];
  goods: GoodsCatalog;
  pendingActions: QueuedAction[];
  planets: WorldSnapshot["planets"];
  players: PlayerShip[];
  policeShips: PlayerShip[];
  sosSignals: SosSignal[];
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
  activeClientIds: string[];
  activityTimeoutMs: number;
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