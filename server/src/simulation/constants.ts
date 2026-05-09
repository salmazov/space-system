import type { GoodsCatalog, PlanetTemplate } from "./types.js";

export const TICK_MS = 1000;
export const STARTING_CREDITS = 500;
export const CARGO_CAPACITY = 40;
export const DEFAULT_START_PLANET_ID = "earth";

export const GOODS: GoodsCatalog = {
  food: { label: "Food", basePrice: 12, targetStock: 120 },
  medicine: { label: "Medicine", basePrice: 65, targetStock: 35 },
  ore: { label: "Ore", basePrice: 28, targetStock: 80 }
};

export const PLANET_TEMPLATES: PlanetTemplate[] = [
  {
    id: "earth",
    name: "Earth",
    faction: "Union",
    inventory: { food: 160, medicine: 25, ore: 50 }
  },
  {
    id: "mars",
    name: "Mars",
    faction: "Guild",
    inventory: { food: 70, medicine: 18, ore: 160 }
  },
  {
    id: "saturn",
    name: "Saturn",
    faction: "Compact",
    inventory: { food: 55, medicine: 70, ore: 80 }
  }
];

export const ROUTE_TRAVEL_TIMES: Record<string, number> = {
  "earth:mars": 5,
  "earth:saturn": 9,
  "mars:saturn": 7
};