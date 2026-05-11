import type { Planet, Vec3 } from "./types.js";

export function layoutPlanets(planets: Planet[]): Map<string, Vec3> {
  const positions = new Map<string, Vec3>();

  for (const planet of planets) {
    positions.set(planet.id, { ...planet.position });
  }

  return positions;
}

export function planetColor(planetId: string): [number, number, number, number] {
  if (planetId === "earth") return [0.18, 0.55, 0.92, 1];
  if (planetId === "mars") return [0.86, 0.31, 0.2, 1];
  if (planetId === "jupiter") return [0.82, 0.52, 0.26, 1];
  if (planetId === "saturn") return [0.88, 0.72, 0.38, 1];
  return [0.42, 0.7, 0.82, 1];
}