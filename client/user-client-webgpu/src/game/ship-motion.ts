import type { PlayerShip, Vec3, WorldSnapshot } from "./types.js";

interface ShipMotionState {
  durationMs: number;
  from: Vec3;
  startedAtMs: number;
  target: Vec3;
}

const DEFAULT_SNAPSHOT_MS = 1000;
const MIN_SMOOTH_MS = 120;
const MAX_SMOOTH_MS = 750;
const SNAPSHOT_DURATION_SCALE = 1.15;

export class ShipMotionSmoother {
  private readonly ships = new Map<string, ShipMotionState>();

  updateTargets(world: WorldSnapshot, nowMs: number): void {
    const liveShipIds = new Set(world.players.map((player) => player.id));

    for (const shipId of this.ships.keys()) {
      if (!liveShipIds.has(shipId)) {
        this.ships.delete(shipId);
      }
    }

    for (const player of world.players) {
      const existing = this.ships.get(player.id) ?? null;
      const target = clonePosition(player.position);
      const currentVisualPosition = existing ? this.visualPosition(existing, nowMs) : target;
      const previousSnapshotMs = existing ? nowMs - existing.startedAtMs : DEFAULT_SNAPSHOT_MS;
      const durationMs = clamp(previousSnapshotMs * SNAPSHOT_DURATION_SCALE, MIN_SMOOTH_MS, MAX_SMOOTH_MS);

      this.ships.set(player.id, {
        durationMs: existing ? durationMs : 0,
        from: existing ? currentVisualPosition : target,
        startedAtMs: nowMs,
        target
      });
    }
  }

  worldForRender(world: WorldSnapshot, nowMs: number): WorldSnapshot {
    return {
      ...world,
      players: world.players.map((player) => ({
        ...player,
        position: this.positionFor(player, nowMs)
      }))
    };
  }

  private positionFor(player: PlayerShip, nowMs: number): Vec3 {
    const state = this.ships.get(player.id);
    return state ? this.visualPosition(state, nowMs) : clonePosition(player.position);
  }

  private visualPosition(state: ShipMotionState, nowMs: number): Vec3 {
    if (state.durationMs <= 0) {
      return clonePosition(state.target);
    }

    const rawAmount = (nowMs - state.startedAtMs) / state.durationMs;
    const amount = clamp(rawAmount, 0, 1);
    const easedAmount = amount * amount * (3 - 2 * amount);

    return {
      x: lerp(state.from.x, state.target.x, easedAmount),
      y: lerp(state.from.y, state.target.y, easedAmount),
      z: lerp(state.from.z, state.target.z, easedAmount)
    };
  }
}

function clonePosition(position: Vec3): Vec3 {
  return { x: position.x, y: position.y, z: position.z };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}