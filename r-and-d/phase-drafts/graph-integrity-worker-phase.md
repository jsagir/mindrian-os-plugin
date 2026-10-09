# Phase draft: Graph integrity worker (DRAFT, not in ROADMAP.md)

Status: draft brief for GSD. Not planned, not executed, not released.

## Goal
Keep the local SQL graph (room.db) honest, and surface new connections, through a read-only worker that proposes and never writes.

## Scope (in)
1. Accurate counts: isolated nodes measured on the full edge set, not the chokepoint view that drops legal dangling edges. Prerequisite. Must be fixed first.
2. Connection finder: open triads and bridges, labelled ESTIMATED, queued as proposals.
3. Integrity watch: duplicate names and unmapped node types, reported as COMPUTED.
4. Gate: proposals go to the navigator gate queue. A human confirms each one. Confirmed writes use lib/core/navigation.cjs only.
5. Surfacing: the doctor reports the last worker run; a session-start line names the count of pending proposals.

## Scope (out)
- No writes to room.db by the worker.
- No Neo4j or Theo calls. Theo is withdrawn.
- No network calls except the explicit approved queries (not in this phase).
- No automatic confirmation.

## Constraints (plugin rules that apply)
- Part 8: local only. Part 9: writes only through navigation.cjs; only a human confirms a truth claim.
- Part 11: the worker is an invocable surface, so it must be born wired with a declared HITL shape (F.1 for each proposal). The born-wired gate fails the build without it.
- Doctor module: check-only, no fix export (already in place).
- Cadence: decision required (see below).
- Plugin change through GSD. Release only with the real-room receipt (RULE 10).

## Decisions needed (navigator)
D1. Cadence: on session start only, or on a timer while a room is open?
D2. Surfacing: a session line when proposals are pending, or silent until asked?
D3. Scope of "new connections": structural only (triads, bridges), or also semantic (Jev judgment, advice) at step 5?
D4. Cost cap: a fixed per-run budget, or no model calls at all in v1?

## Acceptance (draft)
- Isolated count matches a direct count on a fixture room with dangling edges (test).
- Worker never changes room.db (byte-identical test on a real room copy).
- Every proposal carries evidence, a method and a label; none is confirmed by the worker.
- Born-wired gate passes with a declared HITL shape.
- Doctor reports the last run; release receipt on a real room.

## Open risks
- The chokepoint drops 255 edges on motj. The isolated count is inflated until fixed.
- Some node types are unmapped and render as default.
- A constant worker adds cost on every session.
