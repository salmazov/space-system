import type { HappinessView, PlayerShip } from "../domain/types.js";
import {
  HAPPINESS,
  SOS
} from "../world/constants.js";

function clampHappiness(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampHealth(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function boostHappinessOnTrade(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness + HAPPINESS.TRADE_BOOST);
}

export function boostHappinessOnArrival(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness + HAPPINESS.ARRIVAL_BOOST);
}

export function boostHappinessOnFuelShare(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness + HAPPINESS.FUEL_SHARE_BOOST);
}

export function penalizeHappinessOnSos(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness - HAPPINESS.SOS_PENALTY);
}

export function penalizeHappinessOutOfFuel(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness - HAPPINESS.OUT_OF_FUEL_PENALTY);
}

export function updateHappinessAndHealth(world: HappinessView): void {
  for (const player of world.players) {
    if (player.isPirate) {
      continue;
    }

    const fuelRatio = player.fuelCapacity > 0 ? player.fuel / player.fuelCapacity : 0;

    if (fuelRatio <= SOS.AUTO_BROADCAST_FUEL_RATIO) {
      player.happiness = clampHappiness(player.happiness - HAPPINESS.LOW_FUEL_DECAY);
    }

    if (!player.destinationPosition && !player.locationPlanetId) {
      player.happiness = clampHappiness(player.happiness - HAPPINESS.IDLE_DECAY);
    }

    if (player.locationPlanetId && player.health < 1) {
      player.health = clampHealth(player.health + HAPPINESS.HEALTH_DOCK_REGEN_PER_TICK);
    }
  }
}
