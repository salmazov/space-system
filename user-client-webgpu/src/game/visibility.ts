import type { ExploredArea, Vec3 } from "./types.js";

export function isExplored(areas: ExploredArea[], position: Vec3, extraRadius = 0): boolean {
  return areas.some((area) => Math.hypot(area.center.x - position.x, area.center.z - position.z) <= area.radius + extraRadius);
}