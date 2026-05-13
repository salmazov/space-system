import type { PlayerShip, SosSignal, SosView, World } from "../domain/types.js";
import { clonePosition } from "../map/geometry.js";
import { SOS } from "../world/constants.js";

export function canBroadcastSos(player: PlayerShip): boolean {
  return !player.locationPlanetId && fuelRatio(player) <= SOS.AUTO_BROADCAST_FUEL_RATIO;
}

export function broadcastSos(world: SosView, player: PlayerShip): SosSignal {
  const existing = world.sosSignals.find((signal) => signal.clientId === player.ownerClientId);
  const signal: SosSignal = {
    clientId: player.ownerClientId,
    createdAtTick: world.tick,
    fuelNeeded: Math.max(1, Math.round((player.fuelCapacity * 0.25 - player.fuel) * 100) / 100),
    id: `sos-${player.ownerClientId}`,
    position: clonePosition(player.position),
    radius: SOS.SIGNAL_RADIUS,
    shipName: player.name
  };

  if (existing) {
    Object.assign(existing, signal);
    return existing;
  }

  world.sosSignals.push(signal);
  return signal;
}

export function clearSosForClient(world: World, clientId: string): void {
  world.sosSignals = world.sosSignals.filter((signal) => signal.clientId !== clientId);
}

export function pruneSosSignals(world: SosView): void {
  world.sosSignals = world.sosSignals.filter((signal) => {
    const player = world.players.find((candidate) => candidate.ownerClientId === signal.clientId);
    return Boolean(player && canBroadcastSos(player) && world.tick - signal.createdAtTick <= SOS.SIGNAL_TTL_TICKS);
  });
}

function fuelRatio(player: PlayerShip): number {
  return player.fuelCapacity > 0 ? player.fuel / player.fuelCapacity : 0;
}
