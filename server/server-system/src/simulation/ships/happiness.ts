import type { HappinessView, PlayerShip } from "../domain/types.js";
import {
  HAPPINESS_IDLE_DECAY,
  HAPPINESS_LOW_FUEL_DECAY,
  HAPPINESS_OUT_OF_FUEL_PENALTY,
  HAPPINESS_SOS_PENALTY,
  HAPPINESS_TRADE_BOOST,
  HAPPINESS_ARRIVAL_BOOST,
  HAPPINESS_FUEL_SHARE_BOOST,
  HEALTH_DOCK_REGEN_PER_TICK,
  SOS_AUTO_BROADCAST_FUEL_RATIO
} from "../world/constants.js";

function clampHappiness(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampHealth(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function boostHappinessOnTrade(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness + HAPPINESS_TRADE_BOOST);
}

export function boostHappinessOnArrival(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness + HAPPINESS_ARRIVAL_BOOST);
}

export function boostHappinessOnFuelShare(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness + HAPPINESS_FUEL_SHARE_BOOST);
}

export function penalizeHappinessOnSos(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness - HAPPINESS_SOS_PENALTY);
}

export function penalizeHappinessOutOfFuel(player: PlayerShip): void {
  player.happiness = clampHappiness(player.happiness - HAPPINESS_OUT_OF_FUEL_PENALTY);
}

export function updateHappinessAndHealth(world: HappinessView): void {
  for (const player of world.players) {
    if (player.isPirate) {
      continue;
    }

    const fuelRatio = player.fuelCapacity > 0 ? player.fuel / player.fuelCapacity : 0;

    if (fuelRatio <= SOS_AUTO_BROADCAST_FUEL_RATIO) {
      player.happiness = clampHappiness(player.happiness - HAPPINESS_LOW_FUEL_DECAY);
    }

    if (!player.destinationPosition && !player.locationPlanetId) {
      player.happiness = clampHappiness(player.happiness - HAPPINESS_IDLE_DECAY);
    }

    if (player.locationPlanetId && player.health < 1) {
      player.health = clampHealth(player.health + HEALTH_DOCK_REGEN_PER_TICK);
    }
  }
}
