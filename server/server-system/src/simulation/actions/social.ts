import type { AppliedActionResult, MapPosition, World } from "../domain/types.js";
import { distanceOnMap } from "../map/geometry.js";
import { roundCredits } from "../shared/math.js";
import { boostHappinessOnFuelShare, penalizeHappinessOnSos } from "../ships/happiness.js";
import { broadcastSos, canBroadcastSos, clearSosForClient } from "../ships/sos.js";
import { SOS_FUEL_SHARE_DISTANCE, SOS_FUEL_TARGET_LEVEL } from "../world/constants.js";
import { planetName, playerForClient } from "../world/selectors.js";

export function wait(world: World, clientId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  return {
    accepted: true,
    message: `${player?.name ?? "Player ship"} waited for better market conditions.`
  };
}

export function sendSos(world: World, clientId: string): AppliedActionResult {
  const player = playerForClient(world, clientId);

  if (!player) {
    return { accepted: false, message: "SOS failed: no player ship exists." };
  }

  if (player.locationPlanetId) {
    return { accepted: false, message: `SOS failed: ${player.name} is docked at ${planetName(world, player.locationPlanetId)}.` };
  }

  if (!canBroadcastSos(player)) {
    return { accepted: false, message: `SOS failed: ${player.name} still has enough fuel for normal operations.` };
  }

  const signal = broadcastSos(world, player);
  penalizeHappinessOnSos(player);

  return {
    accepted: true,
    message: `${player.name} broadcast SOS for ${signal.fuelNeeded} fuel near ${formatPosition(player.position)}.`
  };
}

export function shareFuel(world: World, clientId: string, targetClientId: string, qty: number): AppliedActionResult {
  const donor = playerForClient(world, clientId);
  const receiver = playerForClient(world, targetClientId);

  if (!donor || !receiver) {
    return { accepted: false, message: "Fuel share failed: donor or receiver ship does not exist." };
  }

  const distance = distanceOnMap(donor.position, receiver.position);

  if (distance > SOS_FUEL_SHARE_DISTANCE) {
    return { accepted: false, message: `Fuel share failed: ${receiver.name} is too far away.` };
  }

  const donorReserve = Math.max(4, donor.fuelCapacity * 0.2);
  const shareable = Math.max(0, Math.floor(donor.fuel - donorReserve));
  const receiverSpace = Math.max(0, Math.floor(receiver.fuelCapacity - receiver.fuel));
  const amount = Math.min(qty, shareable, receiverSpace);

  if (amount <= 0) {
    return { accepted: false, message: `Fuel share failed: ${donor.name} cannot spare fuel.` };
  }

  donor.fuel = roundCredits(donor.fuel - amount);
  receiver.fuel = roundCredits(receiver.fuel + amount);

  if (receiver.fuel >= SOS_FUEL_TARGET_LEVEL) {
    clearSosForClient(world, receiver.ownerClientId);
  }

  boostHappinessOnFuelShare(donor);

  return {
    accepted: true,
    message: `${donor.name} shared ${amount} fuel with ${receiver.name}.`
  };
}

function formatPosition(position: MapPosition): string {
  return `x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}`;
}
