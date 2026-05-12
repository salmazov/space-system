import type { GoodsCatalog, Planet, PlanetTemplate } from "../domain/types.js";

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
  EARTH_FOOD_PRODUCTION_PER_TICK: 6,
  EARTH_FOOD_STOCK_LIMIT: 240,
  URANUS_FOOD_CONSUMPTION_PER_TICK: 2,
  URANUS_FUEL_PRODUCTION_PER_TICK: 8,
  URANUS_FUEL_STOCK_LIMIT: 320,
  STATION_OWNER_TRADE_CUT: 0.05
} as const;

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

// --- Backward-compatible flat re-exports ---

export const STARTING_CREDITS = ECONOMY.STARTING_CREDITS;
export const EARTH_FOOD_PRODUCTION_PER_TICK = ECONOMY.EARTH_FOOD_PRODUCTION_PER_TICK;
export const EARTH_FOOD_STOCK_LIMIT = ECONOMY.EARTH_FOOD_STOCK_LIMIT;
export const URANUS_FOOD_CONSUMPTION_PER_TICK = ECONOMY.URANUS_FOOD_CONSUMPTION_PER_TICK;
export const URANUS_FUEL_PRODUCTION_PER_TICK = ECONOMY.URANUS_FUEL_PRODUCTION_PER_TICK;
export const URANUS_FUEL_STOCK_LIMIT = ECONOMY.URANUS_FUEL_STOCK_LIMIT;
export const STATION_OWNER_TRADE_CUT = ECONOMY.STATION_OWNER_TRADE_CUT;
export const SOS_FUEL_SHARE_DISTANCE = SOS.FUEL_SHARE_DISTANCE;
export const SOS_SIGNAL_RADIUS = SOS.SIGNAL_RADIUS;
export const SOS_FUEL_TARGET_LEVEL = SOS.FUEL_TARGET_LEVEL;
export const SOS_SIGNAL_TTL_TICKS = SOS.SIGNAL_TTL_TICKS;
export const SOS_AUTO_BROADCAST_FUEL_RATIO = SOS.AUTO_BROADCAST_FUEL_RATIO;
export const HAPPINESS_INITIAL = HAPPINESS.INITIAL;
export const HAPPINESS_TRADE_BOOST = HAPPINESS.TRADE_BOOST;
export const HAPPINESS_ARRIVAL_BOOST = HAPPINESS.ARRIVAL_BOOST;
export const HAPPINESS_FUEL_SHARE_BOOST = HAPPINESS.FUEL_SHARE_BOOST;
export const HAPPINESS_SOS_PENALTY = HAPPINESS.SOS_PENALTY;
export const HAPPINESS_OUT_OF_FUEL_PENALTY = HAPPINESS.OUT_OF_FUEL_PENALTY;
export const HAPPINESS_IDLE_DECAY = HAPPINESS.IDLE_DECAY;
export const HAPPINESS_LOW_FUEL_DECAY = HAPPINESS.LOW_FUEL_DECAY;
export const HAPPINESS_PIRATE_THRESHOLD = HAPPINESS.PIRATE_THRESHOLD;
export const HEALTH_INITIAL = HAPPINESS.HEALTH_INITIAL;
export const HEALTH_DOCK_REGEN_PER_TICK = HAPPINESS.HEALTH_DOCK_REGEN_PER_TICK;
export const PIRATE_STATION_IDS = new Set(["pirate_station_alpha", "pirate_station_beta"]);
export const PIRATE_STATION_INITIAL_HEALTH = COMBAT.PIRATE_STATION_INITIAL_HEALTH;
export const PIRATE_STATION_REGEN_PER_TICK = COMBAT.PIRATE_STATION_REGEN_PER_TICK;
export const PIRATE_WEAPON_DAMAGE = COMBAT.PIRATE_WEAPON_DAMAGE;
export const PIRATE_ATTACK_RANGE = COMBAT.PIRATE_ATTACK_RANGE;
export const POLICE_SPAWN_INCIDENT_THRESHOLD = COMBAT.POLICE_SPAWN_INCIDENT_THRESHOLD;
export const POLICE_SPAWN_COST = COMBAT.POLICE_SPAWN_COST;
export const POLICE_STATION_ATTACK_UNHAPPINESS_THRESHOLD = COMBAT.POLICE_STATION_ATTACK_UNHAPPINESS_THRESHOLD;
export const PLANET_INCIDENT_TTL_TICKS = COMBAT.PLANET_INCIDENT_TTL_TICKS;
export const DRIFTING_CARGO_PICKUP_RANGE = COMBAT.DRIFTING_CARGO_PICKUP_RANGE;
export const DRIFTING_CARGO_TTL_TICKS = COMBAT.DRIFTING_CARGO_TTL_TICKS;
export const POLICE_PATROL_RANGE = POLICE.PATROL_RANGE;
export const POLICE_PURSUIT_RANGE = POLICE.PURSUIT_RANGE;
export const POLICE_RETURN_FUEL_RATIO = POLICE.RETURN_FUEL_RATIO;
export const STATION_BUILD_COST = STATION.BUILD_COST;
export const STATION_MIN_DISTANCE = STATION.MIN_DISTANCE;
export const STATION_BUILD_TICKS = STATION.BUILD_TICKS;

export const GOODS: GoodsCatalog = {
  food: { label: "Food", basePrice: 12, targetStock: 120 },
  fuel: { label: "Fuel", basePrice: 18, targetStock: 160 },
  medicine: { label: "Medicine", basePrice: 65, targetStock: 35 },
  ore: { label: "Ore", basePrice: 28, targetStock: 80 }
};

export const PLANET_TEMPLATES: PlanetTemplate[] = [
  {
    id: "earth",
    name: "Earth",
    faction: "Union",
    planetType: "core",
    credits: 5_200,
    inventory: { food: 160, fuel: 45, medicine: 25, ore: 50 },
    priceMultipliers: { food: 0.75, fuel: 1.55, medicine: 1.2, ore: 1.4 },
    position: { x: -10, y: 0, z: 0 }
  },
  {
    id: "luna",
    name: "Luna",
    faction: "Union",
    planetType: "core",
    credits: 1_600,
    inventory: { food: 40, fuel: 18, medicine: 12, ore: 95 },
    priceMultipliers: { food: 1.45, fuel: 1.75, medicine: 1.6, ore: 0.75 },
    position: { x: -8.7, y: 0, z: 0.9 }
  },
  {
    id: "mars",
    name: "Mars",
    faction: "Guild",
    planetType: "core",
    credits: 3_700,
    inventory: { food: 70, fuel: 22, medicine: 18, ore: 160 },
    priceMultipliers: { food: 1.35, fuel: 1.65, medicine: 1.35, ore: 0.7 },
    position: { x: 2.5, y: 0, z: -5.2 }
  },
  {
    id: "jupiter",
    name: "Jupiter",
    faction: "League",
    planetType: "core",
    credits: 6_400,
    inventory: { food: 95, fuel: 30, medicine: 42, ore: 125 },
    priceMultipliers: { food: 1.2, fuel: 1.35, medicine: 0.85, ore: 0.95 },
    position: { x: 13.2, y: 0, z: -1.4 }
  },
  {
    id: "saturn",
    name: "Saturn",
    faction: "Compact",
    planetType: "core",
    credits: 4_600,
    inventory: { food: 55, fuel: 14, medicine: 70, ore: 80 },
    priceMultipliers: { food: 1.55, fuel: 1.9, medicine: 0.6, ore: 1.15 },
    position: { x: 26, y: 0, z: 5.4 }
  },
  {
    id: URANUS_FACILITY_ID,
    name: "Uranus Fuel Mine",
    faction: "Frontier",
    planetType: "core",
    credits: 8_000,
    inventory: { food: 80, fuel: 240, medicine: 4, ore: 20 },
    priceMultipliers: { food: 2.2, fuel: 0.45, medicine: 1.8, ore: 1.1 },
    position: { x: 39, y: 0, z: -6.2 }
  },
  {
    id: "pirate_station_alpha",
    name: "Pirate Station Alpha",
    faction: "Outlaw",
    planetType: "pirate",
    credits: 3_000,
    inventory: { food: 30, fuel: 60, medicine: 10, ore: 15 },
    priceMultipliers: { food: 1.8, fuel: 0.7, medicine: 2.2, ore: 0.6 },
    position: { x: 48, y: 0, z: 2.0 }
  },
  {
    id: "pirate_station_beta",
    name: "Pirate Station Beta",
    faction: "Outlaw",
    planetType: "pirate",
    credits: 2_200,
    inventory: { food: 20, fuel: 40, medicine: 8, ore: 10 },
    priceMultipliers: { food: 1.6, fuel: 0.8, medicine: 2.0, ore: 0.7 },
    position: { x: -6, y: 0, z: -8.5 }
  }
];