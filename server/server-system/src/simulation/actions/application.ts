import type { AppliedActionResult, ClientAction, World } from "../domain/types.js";
import { pickupCargo } from "./cargo.js";
import { applyGoPirate } from "../ships/piracy.js";
import { buyShip } from "./ship-purchase.js";
import { sendSos, shareFuel, wait } from "./social.js";
import { spawnPlayerShip } from "./spawn.js";
import { buildStation, claimStation } from "./station.js";
import { buyGood, sellGood } from "./trade.js";
import { startFreeMove, startTravel } from "./travel.js";
import { acceptMission } from "./mission-actions.js";

export function applyAction(world: World, action: ClientAction): AppliedActionResult {
  switch (action.action) {
    case "spawn":
      return spawnPlayerShip(world, action.clientId, action.target, action.name, action.shipClassId);
    case "move":
      return startFreeMove(world, action.clientId, action.target);
    case "travel":
      return startTravel(world, action.clientId, action.target);
    case "buy":
      return buyGood(world, action.clientId, action.item, action.qty);
    case "sell":
      return sellGood(world, action.clientId, action.item, action.qty);
    case "wait":
      return wait(world, action.clientId);
    case "sos":
      return sendSos(world, action.clientId);
    case "share_fuel":
      return shareFuel(world, action.clientId, action.targetClientId, action.qty);
    case "go_pirate":
      return applyGoPirate(world, action.clientId);
    case "pickup_cargo":
      return pickupCargo(world, action.clientId, action.cargoId);
    case "build_station":
      return buildStation(world, action.clientId, action.name);
    case "claim_station":
      return claimStation(world, action.clientId);
    case "buy_ship":
      return buyShip(world, action.clientId, action.shipClassId);
    case "accept_mission":
      return acceptMission(world, action.clientId, action.missionId);
  }
}