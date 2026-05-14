import type { GoodsCatalog, Planet } from "../domain/types.js";

export const TICK_MS = 10_000;
export const CLIENT_ACTIVITY_TIMEOUT_MS = TICK_MS * 3;
export const DEFAULT_START_PLANET_ID = "earth";
export const FUEL_GOOD_ID = "fuel";
export const FOOD_GOOD_ID = "food";
export const URANUS_FACILITY_ID = "uranus";

export function isPirateStation(planet: Planet): boolean {
  return planet.planetType === "pirate";
}

// --- Grouped constants by domain ---

export const ECONOMY = {
  STARTING_CREDITS: 500,
  STATION_OWNER_TRADE_CUT: 0.05,
  STOCK_LIMIT: 320,
  SHIP_PURCHASE_CREDIT_RATE: 0.004
} as const;

export interface ProductionRule {
  planetId: string;
  produces: string;
  producesQty: number;
  consumes?: string;
  consumesQty?: number;
  stockLimit: number;
}

export const PRODUCTION_RULES: ProductionRule[] = [
  { planetId: "earth", produces: "food", producesQty: 6, stockLimit: 240 },
  { planetId: "luna", produces: "ore", producesQty: 4, stockLimit: 200 },
  { planetId: "mars", produces: "ore", producesQty: 5, consumes: "fuel", consumesQty: 1, stockLimit: 260 },
  { planetId: "jupiter", produces: "medicine", producesQty: 3, consumes: "food", consumesQty: 2, stockLimit: 120 },
  { planetId: "saturn", produces: "medicine", producesQty: 2, consumes: "ore", consumesQty: 3, stockLimit: 100 },
  { planetId: "uranus", produces: "fuel", producesQty: 8, consumes: "food", consumesQty: 2, stockLimit: 320 }
];

export const SOS = {
  FUEL_SHARE_DISTANCE: 1.8,
  SIGNAL_RADIUS: 7.5,
  FUEL_TARGET_LEVEL: 12,
  SIGNAL_TTL_TICKS: 24,
  AUTO_BROADCAST_FUEL_RATIO: 0.12
} as const;

export const HAPPINESS = {
  INITIAL: 0.5,
  TRADE_BOOST: 0.04,
  ARRIVAL_BOOST: 0.02,
  FUEL_SHARE_BOOST: 0.06,
  SOS_PENALTY: 0.08,
  OUT_OF_FUEL_PENALTY: 0.12,
  IDLE_DECAY: 0.005,
  LOW_FUEL_DECAY: 0.01,
  PIRATE_THRESHOLD: 0.2,
  HEALTH_INITIAL: 1.0,
  HEALTH_DOCK_REGEN_PER_TICK: 0.04
} as const;

export const COMBAT = {
  PIRATE_STATION_INITIAL_HEALTH: 1.0,
  PIRATE_STATION_REGEN_PER_TICK: 0.002,
  PIRATE_WEAPON_DAMAGE: 0.08,
  PIRATE_ATTACK_RANGE: 2.5,
  POLICE_SPAWN_INCIDENT_THRESHOLD: 3,
  POLICE_SPAWN_COST: 2_000,
  POLICE_STATION_ATTACK_UNHAPPINESS_THRESHOLD: 0.15,
  PLANET_INCIDENT_TTL_TICKS: 60,
  DRIFTING_CARGO_PICKUP_RANGE: 1.5,
  DRIFTING_CARGO_TTL_TICKS: 120
} as const;

export const POLICE = {
  PATROL_RANGE: 15.0,
  PURSUIT_RANGE: 6.0,
  RETURN_FUEL_RATIO: 0.25
} as const;

export const STATION = {
  BUILD_COST: 15_000,
  MIN_DISTANCE: 5.0,
  BUILD_TICKS: 10
} as const;

export const GOODS: GoodsCatalog = {
  food: { label: "Food", basePrice: 12, targetStock: 120 },
  fuel: { label: "Fuel", basePrice: 18, targetStock: 160 },
  medicine: { label: "Medicine", basePrice: 65, targetStock: 35 },
  ore: { label: "Ore", basePrice: 28, targetStock: 80 }
};