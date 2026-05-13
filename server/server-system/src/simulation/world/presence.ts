import { CLIENT_ACTIVITY_TIMEOUT_MS } from "./constants.js";
import type { ClientActivitySource, ConnectedClient, World } from "../domain/types.js";

export function markClientActivity(world: World, clientId: string, source: ClientActivitySource): void {
  const now = Date.now();

  world.clientActivity[clientId] = {
    clientId,
    lastSeenAt: new Date(now).toISOString(),
    lastSeenAtMs: now,
    lastSeenTick: world.tick,
    source
  };
}

export function isOwnerActive(world: World, ownerClientId: string): boolean {
  const activity = world.clientActivity[ownerClientId];

  if (!activity) {
    return false;
  }

  const elapsed = Date.now() - activity.lastSeenAtMs;
  return elapsed < CLIENT_ACTIVITY_TIMEOUT_MS * 3;
}

export function activeClientIds(world: World, connectedUsers: ConnectedClient[], now = Date.now()): string[] {
  const activeIds = new Set<string>();

  for (const user of connectedUsers) {
    if (user.clientId) {
      activeIds.add(user.clientId);
    }
  }

  for (const activity of Object.values(world.clientActivity)) {
    if (now - activity.lastSeenAtMs <= CLIENT_ACTIVITY_TIMEOUT_MS) {
      activeIds.add(activity.clientId);
    }
  }

  return [...activeIds].sort((left, right) => left.localeCompare(right));
}