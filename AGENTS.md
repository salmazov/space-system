# AGENTS.md

## Overview

This repository implements a tick-based interplanetary economy simulation with:

- 3+ planets
- dynamic markets based on supply and demand
- trade and war systems, including blockades and conflict zones
- ships as autonomous agents
- optional LLM-controlled agents such as GPT or Claude

The system runs as a deterministic server-side simulation loop. Clients such as a browser UI, Unreal Engine, bots, or LLM agents only observe state and send actions.

## Current Slice

Start simple. The repository is split into two top-level folders:

- `server/`: authoritative tick simulation, HTTP action API, and WebSocket state transport
- `dashboard/`: read-only browser observer panel served by the server for local backend visualization
- `user-client/`: simple playable browser client that sends player ship actions to the server
- `user-client-webgpu/`: experimental playable WebGPU browser client served at `/webgpu`

Do not add a database, queue, broker, or distributed architecture until the in-memory loop is interesting and easy to reason about.

## Core Architecture

### Simulation Model

- The world advances in discrete ticks.
- All meaningful changes happen on tick boundaries.
- The server owns the truth.
- Clients never simulate economy, prices, or combat authority.

Each tick may update:

- prices
- ship movement
- AI decisions
- war and blockade effects

### Tick Loop

1. Collect events from players, bots, LLM agents, and system processes.
2. Validate actions against current world state.
3. Recompute market prices from current stock.
4. Update logistics and ship movement.
5. Apply war effects such as blockades and interception.
6. Compute world snapshot or diff.
7. Broadcast updates to connected clients.

## Key Principles

### 1. Server Is Authoritative

- All truth lives in the backend.
- Clients send intents, not state mutations.
- The server validates every action before applying it.
- The bundled browser client is an observer/debug panel only. It should not become a gameplay client or mutate simulation state.
- The playable user client is also thin: it renders state and submits actions, but the backend owns the player ship, cargo, credits, travel, and market mutations.

### 2. Tick-Based Determinism

- Ticks are the unit of simulation time.
- State should be reproducible from initial state plus ordered events.
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
- Does not have production or consumption rules until those are explicitly designed.

### Store

- Holds inventory.
- Has dynamic prices.
- Prices are supply and demand driven.

### Ship

Two initial types:

- Trade ship: moves goods between planets.
- War ship: intercepts, patrols, or blocks trade routes.

### Market

- Uses local prices per planet and good.
- Keep the first version simple: current stock should move prices before complex macroeconomics is added.
- For now, stock only changes through validated buy and sell actions.
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

Then open:

```text
http://localhost:3000       # dashboard
http://localhost:3000/play  # playable user client
http://localhost:3000/webgpu # playable WebGPU client
```

## Near-Term Goal

Build a first playable vertical slice before adding infrastructure:

- 3 planets: Earth, Mars, and Saturn
- a few goods
- local inventories
- supply/demand prices
- one visible simulation tick stream
- simple browser client
- one playable browser user client with one allowed player ship
- later: one rule-based trade ship
- later: one LLM-controlled ship that emits validated JSON actions
