import type {
  ActionValidationResult,
  ObserverActionLogEntry,
  ObserverLoggedAction,
  ObserverActionValue,
  QueuedAction,
  World
} from "../domain/types.js";
import { playerForClient } from "../world/selectors.js";

const ACTION_LOG_LIMIT = 240;

export function appendActionLog(
  world: World,
  rawAction: unknown,
  validation: ActionValidationResult,
  queuedAction?: QueuedAction
): void {
  const raw = rawActionLike(rawAction);
  const action = validation.accepted ? validation.action : compactRawAction(raw);
  const clientId = validation.accepted ? validation.action.clientId : safeString(raw?.clientId, 64);
  const player = clientId ? playerForClient(world, clientId) : null;
  const entry: ObserverActionLogEntry = {
    id: `observer-action-${Date.now()}-${world.actionLog.length}`,
    at: new Date().toISOString(),
    tick: world.tick,
    accepted: validation.accepted,
    action
  };

  const decision = compactDecision(raw?.botDecision);

  if (queuedAction) {
    entry.actionId = queuedAction.id;
    entry.queuedForTick = queuedAction.executeAtTick;
  }

  if (clientId) {
    entry.clientId = clientId;
  }

  if (decision) {
    entry.decision = decision;
  }

  if (!validation.accepted) {
    entry.reason = validation.reason;
  }

  if (player) {
    entry.shipId = player.id;
    entry.shipName = player.name;
  }

  world.actionLog = [entry, ...world.actionLog].slice(0, ACTION_LOG_LIMIT);
}

function compactRawAction(raw: Record<string, unknown> | null): ObserverLoggedAction {
  if (!raw) {
    return {};
  }

  const action: ObserverLoggedAction = { action: safeString(raw.action, 32) ?? "unknown" };
  const clientId = safeString(raw.clientId, 64);
  const item = safeString(raw.item, 32);
  const name = safeString(raw.name, 32);
  const qty = safeNumber(raw.qty);
  const target = compactTarget(raw.target);
  const targetClientId = safeString(raw.targetClientId, 64);

  if (clientId) {
    action.clientId = clientId;
  }

  if (item) {
    action.item = item;
  }

  if (name) {
    action.name = name;
  }

  if (qty !== undefined) {
    action.qty = qty;
  }

  if (target) {
    action.target = target;
  }

  if (targetClientId) {
    action.targetClientId = targetClientId;
  }

  return action;
}

function compactDecision(value: unknown): Record<string, ObserverActionValue> | undefined {
  const compact = compactValue(value, 0);
  return compact && typeof compact === "object" && !Array.isArray(compact) ? compact : undefined;
}

function compactValue(value: unknown, depth: number): ObserverActionValue | undefined {
  if (depth > 4) {
    return "...";
  }

  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, 180);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => compactValue(item, depth + 1) ?? null);
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 24)
      .map(([key, entryValue]) => [key, compactValue(entryValue, depth + 1) ?? null])
  );
}

function compactTarget(value: unknown): ObserverLoggedAction["target"] | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const target = value as Record<string, unknown>;
  const x = safeNumber(target.x);
  const z = safeNumber(target.z);

  if (x === undefined || z === undefined) {
    return undefined;
  }

  return { x, y: safeNumber(target.y) ?? 0, z };
}

function rawActionLike(rawAction: unknown): Record<string, unknown> | null {
  return rawAction && typeof rawAction === "object" ? (rawAction as Record<string, unknown>) : null;
}

function safeString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
