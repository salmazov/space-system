import type { PlayerShip, Vec3, WorldSnapshot } from "./types.js";

interface ShipMotionState {
  /** Position to ease FROM when a new snapshot arrives. */
  from: Vec3;
  /** Server-reported position at snapshot time (ease target). */
  anchor: Vec3;
  /** Destination the ship is heading toward, or null if stationary. */
  destination: Vec3 | null;
  /** Ship speed in units/second for dead reckoning. */
  speed: number;
  /** Server wall-clock ms when movement started (from server's departedAtMs). */
  departedAtMs: number | null;
  /** Server wall-clock ms when this snapshot was created. */
  snapshotAtMs: number;
  /** Client wall-clock ms when this snapshot arrived. */
  receivedAtMs: number;
  /** Duration of the ease-in correction in ms. */
  easeDurationMs: number;
}

const DEFAULT_SNAPSHOT_MS = 1000;
const MIN_SMOOTH_MS = 120;
const MAX_SMOOTH_MS = 750;
const SNAPSHOT_DURATION_SCALE = 1.15;

export class ShipMotionSmoother {
  private readonly ships = new Map<string, ShipMotionState>();
  /** Estimated offset: serverTime - clientTime. Updated on each snapshot. */
  private clockOffsetMs = 0;

  updateTargets(world: WorldSnapshot, nowMs: number): void {
    // Estimate clock offset from the latest snapshot.
    // A rolling average would be smoother but a single sample is good enough
    // for a local-network game (latency < 5 ms).
    this.clockOffsetMs = world.snapshotAtMs - nowMs;

    const liveShipIds = new Set(world.players.map((player) => player.id));

    for (const shipId of this.ships.keys()) {
      if (!liveShipIds.has(shipId)) {
        this.ships.delete(shipId);
      }
    }

    for (const player of world.players) {
      const existing = this.ships.get(player.id) ?? null;
      const anchor = clonePosition(player.position);
      const currentVisualPosition = existing ? this.computePosition(existing, nowMs) : anchor;
      const previousSnapshotMs = existing ? nowMs - existing.receivedAtMs : DEFAULT_SNAPSHOT_MS;
      const easeDurationMs = clamp(previousSnapshotMs * SNAPSHOT_DURATION_SCALE, MIN_SMOOTH_MS, MAX_SMOOTH_MS);

      this.ships.set(player.id, {
        from: existing ? currentVisualPosition : anchor,
        anchor,
        destination: player.destinationPosition ? clonePosition(player.destinationPosition) : null,
        speed: player.speed,
        departedAtMs: player.departedAtMs,
        snapshotAtMs: world.snapshotAtMs,
        receivedAtMs: nowMs,
        easeDurationMs: existing ? easeDurationMs : 0
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
    return state ? this.computePosition(state, nowMs) : clonePosition(player.position);
  }

  /**
   * Two-phase position computation:
   * 1. Ease: smoothly correct from the old visual position toward dead-reckoned pos.
   * 2. Dead reckon: advance from the server-authoritative anchor using the same
   *    formula and time base as the server (departedAtMs + speed).
   */
  private computePosition(state: ShipMotionState, nowMs: number): Vec3 {
    const elapsedMs = nowMs - state.receivedAtMs;

    // Phase 1 — ease correction (first few hundred ms after a snapshot)
    if (state.easeDurationMs > 0 && elapsedMs < state.easeDurationMs) {
      const rawAmount = elapsedMs / state.easeDurationMs;
      const amount = clamp(rawAmount, 0, 1);
      const eased = amount * amount * (3 - 2 * amount);

      const deadReckoned = this.deadReckon(state, nowMs);
      return {
        x: lerp(state.from.x, deadReckoned.x, eased),
        y: lerp(state.from.y, deadReckoned.y, eased),
        z: lerp(state.from.z, deadReckoned.z, eased)
      };
    }

    // Phase 2 — pure dead reckoning
    return this.deadReckon(state, nowMs);
  }

  /**
   * Advance from anchor toward destination using the server's time base.
   *
   * The server computed `anchor` at `snapshotAtMs`. We know how much time
   * has passed since then in server-time: `serverNowMs - snapshotAtMs`.
   * Convert client `nowMs` to server time via the clock offset.
   */
  private deadReckon(state: ShipMotionState, nowMs: number): Vec3 {
    if (!state.destination || state.speed <= 0) {
      return clonePosition(state.anchor);
    }

    // Convert client time to server time, then measure elapsed since snapshot
    const serverNowMs = nowMs + this.clockOffsetMs;
    const elapsedSinceSnapshotMs = Math.max(0, serverNowMs - state.snapshotAtMs);
    const elapsedSeconds = elapsedSinceSnapshotMs / 1000;

    const travelDistance = state.speed * elapsedSeconds;
    const dx = state.destination.x - state.anchor.x;
    const dz = state.destination.z - state.anchor.z;
    const totalDistance = Math.sqrt(dx * dx + dz * dz);

    if (totalDistance < 0.001) {
      return clonePosition(state.destination);
    }

    const amount = Math.min(travelDistance / totalDistance, 1);
    return {
      x: state.anchor.x + dx * amount,
      y: 0,
      z: state.anchor.z + dz * amount
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