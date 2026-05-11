import type { PlayerShip, SosSignal, World } from "../domain/types.js";
import { clonePosition } from "../map/geometry.js";
import { SOS_SIGNAL_TTL_TICKS } from "../world/constants.js";

export function broadcastSos(world: World, player: PlayerShip): SosSignal {
  const existing = world.sosSignals.find((signal) => signal.clientId === player.ownerClientId);
  const signal: SosSignal = {
    clientId: player.ownerClientId,
    createdAtTick: world.tick,
    fuelNeeded: Math.max(1, Math.round((player.fuelCapacity * 0.25 - player.fuel) * 100) / 100),
    id: `sos-${player.ownerClientId}`,
    position: clonePosition(player.position),
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

export function pruneSosSignals(world: World): void {
  world.sosSignals = world.sosSignals.filter((signal) => {
    const player = world.players.find((candidate) => candidate.ownerClientId === signal.clientId);
    return Boolean(player && player.fuel <= player.fuelCapacity * 0.25 && world.tick - signal.createdAtTick <= SOS_SIGNAL_TTL_TICKS);
  });
}