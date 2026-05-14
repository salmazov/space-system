import type { AppliedActionResult, World } from "../domain/types.js";
import { playerForClient } from "../world/selectors.js";

export function acceptMission(world: World, clientId: string, missionId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);
  if (!player) {
    return { accepted: false, message: "No ship found." };
  }

  const mission = world.missions.find((m) => m.id === missionId);
  if (!mission) {
    return { accepted: false, message: "Mission not found." };
  }

  if (mission.acceptedByClientId) {
    return { accepted: false, message: "Mission already accepted by another player." };
  }

  mission.acceptedByClientId = clientId;
  mission.acceptedAtTick = world.tick;

  return {
    accepted: true,
    message: `${player.name} accepted mission: ${mission.title} (reward: ${mission.reward} credits).`
  };
}
