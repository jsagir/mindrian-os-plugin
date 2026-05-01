# lib/render/ -- Universal Renderer

> ICM Layer 0 identity for the renderer module.

## Purpose

The universal renderer translates a 4-zone payload + render mode + conversation operator + tier into the actual on-screen output. Owns the `render(zones, mode, operator, tier)` contract.

## Phase status

- **Phase 99-03 (shipped):** contract surface + no-op pass-through stub. Callers can import `{ render }` today; envelope returns `rendered: false` + `_stub: 'phase-99-03'` provenance tag. Operator validation against the 5 canonical values (JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE) ships now so Phase 102 inherits the fence.
- **Phase 102 (planned):** replaces the stub internals with real rendering logic per Phase 99 CONTEXT.md D-16. Same import surface; no caller changes.

## Files

| File | Role |
|------|------|
| render-v2.cjs | Contract surface. Phase 99-03 stub today, Phase 102 implementation later. Exports `{ render, OPERATORS }`. |
| render-v2.test.cjs | Contract tests: 8 IIFE scenarios (5-operator round-trip, JUST_TALK default for undefined and null, invalid-operator throw, envelope shape stable, mode passthrough, tier passthrough, OPERATORS frozen). Registered in lib/memory/run-feynman-tests.cjs. |
| ROOM.md | This file -- ICM Layer 0 identity per CLAUDE.md Decision #15. |

## Render contract (Phase 99 CONTEXT.md D-16)

```
render(zones, mode, operator, tier) -> envelope

operator == JUST_TALK        -> emit prose only                          (Phase 102)
operator == EXPLORE_CAPTURE  -> prose; Shape E only on crystallization   (Phase 102)
operator == BUILD_ROOM       -> full 4-zone anatomy                      (Phase 102)
operator == METHODOLOGY      -> no shape mid-session; Shape E at gate    (Phase 102)
operator == DECISION_GATE    -> Shape F.x; keyboard only                 (Phase 102)
```

Phase 99-03 stub returns `{ zones, mode, operator, tier, rendered: false, _stub: 'phase-99-03' }` with operator validated and defaulted to JUST_TALK when null/undefined.

## Canon refs

- **Part 3 (Tri-Context Decision Gate):** DECISION_GATE locks Shape F.x; the renderer enforces this at output time (Phase 102).
- **Part 4 (Every Choice Is Graph Data):** operator transitions written by Phase 99-01 are read by this renderer to pick shape (Phase 102).
- **Part 7 (Reuse Before Build):** Phase 99-03 ships the seam, not the muscle. Phase 102 replaces the stub internals without touching callers.

## Downstream consumers

- **Phase 99-04 (hooks):** imports `{ render }` for SessionStart restore behavior and PostToolUse rendering.
- **Phase 99-05 (`/mos:operator` command):** imports `{ render }` for Shape E inspection output.
- **Phase 102:** owns the actual rendering implementation; the import surface is byte-stable.

## Constraints

- Zero new runtime dependencies (Phase 87 invariant).
- CJS only (Phase 87 invariant).
- `render()` import surface MUST remain byte-stable across the Phase 102 swap.
- Operator vocabulary frozen at 5 canonical values; any 6th operator requires a Gate 1 review per Phase 99 CONTEXT.md D-03.

## See also

- `.planning/phases/99-conversation-operator-state-machine/99-CONTEXT.md` -- canonical context (operator taxonomy, transition table, renderer signature contract D-16, graceful degradation D-17).
- `.planning/phases/99-conversation-operator-state-machine/99-03-PLAN.md` -- this plan.
- `docs/MINDRIAN-CANON.md` -- North Star, Part 3 (Tri-Context Decision Gate), Part 4 (Every Choice Is Graph Data), Part 7 (Reuse Before Build).
