import type { Mission, MissionView } from "../domain/types.js";

const MAX_AVAILABLE_MISSIONS = 6;
const MISSION_TTL_TICKS = 60;
const MISSION_GOODS = ["food", "fuel", "medicine", "ore"];

const DELIVERY_TEMPLATES: Array<{ qty: [number, number]; rewardPerUnit: [number, number] }> = [
  { qty: [5, 15], rewardPerUnit: [1.6, 2.4] },
  { qty: [20, 40], rewardPerUnit: [1.3, 1.8] },
  { qty: [50, 80], rewardPerUnit: [1.1, 1.5] }
];

export function updateMissions(world: MissionView): void {
  world.missions = world.missions.filter((m) => m.expiresAtTick > world.tick);

  const available = world.missions.filter((m) => !m.acceptedByClientId);
  const needed = MAX_AVAILABLE_MISSIONS - available.length;

  for (let i = 0; i < needed; i++) {
    const mission = generateMission(world);
    if (mission) {
      world.missions.push(mission);
    }
  }
}

export function completeMissionsForPlayer(world: MissionView, clientId: string, planetId: string, cargo: Record<string, number>): { completed: Mission[]; totalReward: number } {
  const completed: Mission[] = [];
  let totalReward = 0;

  for (const mission of world.missions) {
    if (mission.acceptedByClientId !== clientId) continue;
    if (mission.toPlanetId !== planetId) continue;
    if ((cargo[mission.goodId] ?? 0) < mission.qty) continue;

    completed.push(mission);
    totalReward += mission.reward;
    cargo[mission.goodId] = (cargo[mission.goodId] ?? 0) - mission.qty;
  }

  world.missions = world.missions.filter((m) => !completed.includes(m));
  return { completed, totalReward };
}

function generateMission(world: MissionView): Mission | null {
  const corePlanets = world.planets.filter((p) => p.id !== "pirate_station_alpha" && p.id !== "pirate_station_beta");
  if (corePlanets.length < 2) return null;

  const fromIndex = Math.floor(Math.random() * corePlanets.length);
  let toIndex = Math.floor(Math.random() * (corePlanets.length - 1));
  if (toIndex >= fromIndex) toIndex++;

  const from = corePlanets[fromIndex]!;
  const to = corePlanets[toIndex]!;
  const goodId = MISSION_GOODS[Math.floor(Math.random() * MISSION_GOODS.length)]!;
  const good = world.goods[goodId];
  if (!good) return null;

  const templateIndex = Math.floor(Math.random() * DELIVERY_TEMPLATES.length);
  const template = DELIVERY_TEMPLATES[templateIndex]!;
  const qty = randomInt(template.qty[0], template.qty[1]);
  const rewardMultiplier = template.rewardPerUnit[0] + Math.random() * (template.rewardPerUnit[1] - template.rewardPerUnit[0]);
  const reward = Math.round(good.basePrice * qty * rewardMultiplier);

  const id = `mission-${world.nextMissionId}`;
  world.nextMissionId++;

  return {
    id,
    type: "delivery",
    title: `Deliver ${qty} ${good.label} to ${to.name}`,
    description: `Transport ${qty} ${good.label} from ${from.name} to ${to.name}.`,
    fromPlanetId: from.id,
    toPlanetId: to.id,
    goodId,
    qty,
    reward,
    expiresAtTick: world.tick + MISSION_TTL_TICKS,
    acceptedByClientId: null,
    acceptedAtTick: null
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
