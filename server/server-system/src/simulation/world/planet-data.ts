import type { PlanetTemplate } from "../domain/types.js";
import { URANUS_FACILITY_ID } from "./constants.js";

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
