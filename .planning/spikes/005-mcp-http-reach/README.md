---
spike: 005
name: mcp-http-reach
type: standard
validates: "Given the mindrian-os MCP server on Streamable HTTP over a throwaway room, when a plain client calls room_state, graph_query and gate_render -> gate_answer, then each answers and a gate is approved over HTTP"
verdict: VALIDATED
related: [006, 007]
tags: [mcp, http, gate, seed-105, ui]
---

# Spike 005: MCP over HTTP can drive the UI's decision gates

## What This Validates
Given the mindrian-os MCP server on Streamable HTTP over a throwaway copy of a room, when an external
client (the future UI) calls room tools and mints then answers a gate, then the gate is ratified over
HTTP, the room written is the copy, and the real room is untouched.

## How to Run
`node .planning/spikes/005-mcp-http-reach/run.cjs` (needs port 3847 free; copies
`~/MindrianRooms/egain-des-liquid-conductor` to a temp dir; writes `results.json`).

## Investigation Trail
1. First run hung: the port check sent a GET to `/mcp`, which Streamable HTTP can hold open as a stream.
   Switched to a TCP connect check.
2. A leftover server from the killed run kept 3847, so later arms silently talked to the wrong server
   (old temp room). Lesson for the real build: the UI must check which room the server it reached is
   bound to (the server log names it), never assume.
3. SIGTERM did not stop the HTTP server; SIGKILL did. The runner now force-kills.

## Results
- **Default HTTP mode (no sessions, legacy shared transport): FAILED for the SDK client** with an empty
  "Error POSTing to endpoint". A raw `initialize` POST works (200, SSE response), so the failure is in the
  follow-up requests on the single shared transport (see the Phase 198-08 note in
  `bin/mindrian-mcp-server.cjs`). Do not build the UI on this mode.
- **Per-connection session mode (`MINDRIAN_MCP_FIRST=cowork`): VALIDATED.**
  - Connect about 26 ms; 45 tools listed, including room_state, graph_query, gate_render, gate_answer,
    room_bind.
  - `room_bind` bound the throwaway room (`resolved_dir` under /tmp).
  - `gate_render` returned a gate id with `renderer: askuserquestion` and structured zones (header, body,
    footer). The UI can render real buttons from these zones; no MCP elicitation dialog is involved.
  - `gate_answer` on the same connection: `ratified: true`, a memory_event and a decision node written to
    the throwaway room.
  - **Cross-connection answer refused:** a gate minted on connection A and answered on connection B returns
    `session_mismatch`. Good for safety; design consequence: a gate belongs to the session that minted it.
    A Cowork view where person B approves person A's gate needs an explicit hand-off action, not a shared
    button (the 2026-10-02 Cowork mockup assumed otherwise).
  - `room_state status` latency over HTTP: p50 4 ms, p90 5 ms, max 6 ms (10 calls, local loopback).
  - Real room mtime unchanged.
- Minor: `graph_query` with no focus returns an empty list and asks for a node id; the UI should pass
  `node_id` or set focus first.

**Verdict: VALIDATED** (MCP-first per-connection mode). The kill condition (cannot reach the server
without duplicating room state) did not trigger: every read and write went through the server.
