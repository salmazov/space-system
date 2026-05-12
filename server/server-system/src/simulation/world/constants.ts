import type { GoodsCatalog, Planet, PlanetTemplate } from "../domain/types.js";

export const TICK_MS = 10_000;
export const CLIENT_ACTIVITY_TIMEOUT_MS = TICK_MS * 3;
export const STARTING_CREDITS = 500;
export const DEFAULT_START_PLANET_ID = "earth";
export const FUEL_GOOD_ID = "fuel";
export const FOOD_GOOD_ID = "food";
export const URANUS_FACILITY_ID = "uranus";
export const EARTH_FOOD_PRODUCTION_PER_TICK = 6;
export const EARTH_FOOD_STOCK_LIMIT = 240;
export const URANUS_FOOD_CONSUMPTION_PER_TICK = 2;
export const URANUS_FUEL_PRODUCTION_PER_TICK = 8;
export const URANUS_FUEL_STOCK_LIMIT = 320;
export const SOS_FUEL_SHARE_DISTANCE = 1.8;
export const SOS_SIGNAL_RADIUS = 7.5;
export const SOS_FUEL_TARGET_LEVEL = 12;
export const SOS_SIGNAL_TTL_TICKS = 24;
export const SOS_AUTO_BROADCAST_FUEL_RATIO = 0.12;

export const HAPPINESS_INITIAL = 0.5;
export const HAPPINESS_TRADE_BOOST = 0.04;
export const HAPPINESS_ARRIVAL_BOOST = 0.02;
export const HAPPINESS_FUEL_SHARE_BOOST = 0.06;
export const HAPPINESS_SOS_PENALTY = 0.08;
export const HAPPINESS_OUT_OF_FUEL_PENALTY = 0.12;
export const HAPPINESS_IDLE_DECAY = 0.005;
export const HAPPINESS_LOW_FUEL_DECAY = 0.01;
export const HAPPINESS_PIRATE_THRESHOLD = 0.2;
export const HEALTH_INITIAL = 1.0;
export const HEALTH_DOCK_REGEN_PER_TICK = 0.04;
export const PIRATE_STATION_IDS = new Set(["pirate_station_alpha", "pirate_station_beta"]);
export function isPirateStation(planet: Planet): boolean {
  return planet.planetType === "pirate";
}
export const PIRATE_STATION_INITIAL_HEALTH = 1.0;
export const PIRATE_STATION_REGEN_PER_TICK = 0.002;
export const PIRATE_WEAPON_DAMAGE = 0.08;
export const PIRATE_ATTACK_RANGE = 2.5;
export const POLICE_SPAWN_INCIDENT_THRESHOLD = 3;
export const POLICE_SPAWN_COST = 2_000;
export const POLICE_STATION_ATTACK_UNHAPPINESS_THRESHOLD = 0.15;
export const PLANET_INCIDENT_TTL_TICKS = 60;
export const DRIFTING_CARGO_PICKUP_RANGE = 1.5;
export const DRIFTING_CARGO_TTL_TICKS = 120;
export const STATION_BUILD_COST = 15_000;
export const STATION_MIN_DISTANCE = 5.0;
export const STATION_BUILD_TICKS = 10;
export const POLICE_PATROL_RANGE = 15.0;
export const POLICE_PURSUIT_RANGE = 6.0;
export const POLICE_RETURN_FUEL_RATIO = 0.25;
export const STATION_OWNER_TRADE_CUT = 0.05;

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