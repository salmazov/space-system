# AGENTS.md

## Overview

This repository implements a tick-based interplanetary economy simulation with:

- 3+ planets
- local markets with stable per-planet prices and finite inventory
- trade and war systems, including blockades and conflict zones
- ships as autonomous agents
- optional LLM-controlled agents such as GPT or Claude

The system runs as a deterministic server-side simulation loop. Clients such as a browser UI, Unreal Engine, bots, or LLM agents only observe state and send actions.

## Current Slice

Start simple. The repository is grouped by runtime role:

- `client/user-client/`: simple playable browser client that sends player ship actions to the server
- `client/user-client-webgpu/`: experimental playable WebGPU browser client served at `/webgpu`
- `server/server-system/`: authoritative tick simulation, HTTP action API, and WebSocket state transport
- `server/server-dashboard/`: read-only browser observer panel served by the server for local backend visualization
- `bot-system/bot-player/`: one autonomous bot process that sends actions through the public server API
- `bot-system/bot-fleet/`: launcher for multiple bot-player processes, defaulting to 10 bots per faction

Do not add a database, queue, broker, or distributed architecture until the in-memory loop is interesting and easy to reason about.

## Core Architecture

### Simulation Model

- The world advances in discrete ticks.
- All meaningful changes happen on tick boundaries.
- The server owns the truth.
- Clients never simulate economy, prices, or combat authority.

Each tick may update:

- prices
- ship movement snapshots based on backend-tracked elapsed time, not tick countdowns
- AI decisions
- war and blockade effects

### Tick Loop

1. Collect events from players, bots, LLM agents, and system processes.
2. Validate actions against current world state.
3. Recompute local market prices from configured planet price multipliers.
4. Update logistics and ship movement.
5. Apply war effects such as blockades and interception.
6. Update backend-tracked ship positions and explored map memory.
7. Compute world snapshot or diff.
8. Broadcast updates to connected clients.

## Key Principles

### 1. Server Is Authoritative

- All truth lives in the backend.
- Clients send intents, not state mutations.
- The server validates every action before applying it.
- The bundled browser client is an observer/debug panel only. It should not become a gameplay client or mutate simulation state.
- The playable user clients are also thin: they render state and submit actions, but the backend owns each session's player ship, cargo, credits, travel, and market mutations.

### 2. Tick-Based Determinism

- Ticks are the unit of simulation time.
- State should be reproducible from initial state plus ordered events.
- Ship free movement is the current exception: it is tracked by backend elapsed time so speed can be continuous and class-based.
- Avoid hidden randomness. Use seeded deterministic logic when randomness is needed.

### 3. Event-Driven Actions

- Clients and agents submit actions.
- Actions are queued, validated, and applied on tick boundaries.
- Invalid actions are rejected without mutating world state.

## Entities

### Planet

- Has a local economy.
- Owns stores.
- Can enter war or blockade state later.
- Production and consumption rules should stay explicit and easy to audit. Current intentional rules: Earth renews Food over time; Uranus Fuel Mine consumes Food and produces Fuel.

### Store

- Holds inventory.
- Has local prices.
- Prices are stable per planet for the current slice; inventory affects availability, not price.

### Ship

Initial playable ship classes:

- Small trade ship: balanced first trading ship.
- Freightliner: high cargo capacity, slower speed.
- Yacht: low cargo capacity, high speed and luxury price.

Ships have backend-owned map positions, movement targets, speed, cargo capacity, exploration radius, and a price in euro.
Ships also have backend-owned Fuel tanks. Movement and planet travel require enough Fuel for the route and burn Fuel continuously as the ship moves.
Playable ships can move freely to map coordinates. Movement is tracked by backend elapsed time and must not depend on travel tick countdowns.
Each playable session stores explored map areas in memory on the backend. Clients render discovered areas and should not own exploration truth.

### Market

- Uses stable local prices per planet and good.
- Keep the first version simple: current stock should not move prices until the economic model is explicitly redesigned.
- Stock changes through validated buy/sell actions and explicit production rules such as Earth Food renewal and Uranus Fuel refining.
- Do not add inflation until the basic trading loop is understandable and fun.

## AI and LLM Agents

LLM-controlled ships operate as slow strategic agents, not per-frame controllers.

### Decision Cycle

- Receive a compact world snapshot every N ticks.
- Return a structured JSON action.
- Let the server validate and execute the action.

### Example Action

```json
{
  "action": "buy",
  "target": "planet_id",
  "item": "food",
  "qty": 10
}
```

Allowed first actions:

- `spawn`
- `move`
- `buy`
- `sell`
- `travel`
- `wait`

## Future Unreal Visualization

No Unreal client is planned for the current slice. Keep the web dashboard and web user client working first.

Unreal Engine should be treated as a client.

- It connects to the server.
- It receives snapshots or diffs.
- It renders planets, stores, ships, routes, blockades, and battles.
- It sends player intents back to the server.
- It must not become the source of truth for economy state.

## Local Development

Run the first version locally:

```bash
npm run dev
```

Run bot clients against a running server:

```bash
npm run dev:bot
npm run dev:fleet
```

Then open:

```text
http://localhost:3000       # dashboard
http://localhost:3000/play  # playable user client
http://localhost:3000/webgpu # playable WebGPU client
```

## Near-Term Goal

Build a first playable vertical slice before adding infrastructure:

- planets: Earth, Luna, Mars, Jupiter, Saturn, and Uranus Fuel Mine
- a few goods, including Food and Fuel
- local inventories
- stable local prices
- one visible simulation tick stream
- simple browser client
- one player ship per playable browser client session
- later: one rule-based trade ship
- later: one LLM-controlled ship that emits validated JSON actions
