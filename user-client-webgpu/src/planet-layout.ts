import type { Planet, Vec2 } from "./types.js";

const KNOWN_PLANET_POSITIONS: Record<string, Vec2> = {
  earth: { x: -7, y: 0 },
  mars: { x: 1.5, y: -1.8 },
  saturn: { x: 10, y: 2.4 }
};

export function layoutPlanets(planets: Planet[]): Map<string, Vec2> {
  const positions = new Map<string, Vec2>();
  const unknownPlanets = planets.filter((planet) => !KNOWN_PLANET_POSITIONS[planet.id]);

  for (const planet of planets) {
    const knownPosition = KNOWN_PLANET_POSITIONS[planet.id];

    if (knownPosition) {
      positions.set(planet.id, knownPosition);
    }
  }

  unknownPlanets.forEach((planet, index) => {
    const angle = (index / Math.max(1, unknownPlanets.length)) * Math.PI * 2;
    const radius = Math.max(7, planets.length * 2.5);
    positions.set(planet.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  });

  return positions;
}

export function planetColor(planetId: string): [number, number, number, number] {
  if (planetId === "earth") return [0.18, 0.55, 0.92, 1];
  if (planetId === "mars") return [0.86, 0.31, 0.2, 1];
  if (planetId === "saturn") return [0.88, 0.72, 0.38, 1];
  return [0.42, 0.7, 0.82, 1];
}