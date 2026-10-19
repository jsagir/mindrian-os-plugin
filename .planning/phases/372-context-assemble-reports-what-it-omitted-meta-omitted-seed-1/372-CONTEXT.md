# Phase 372: context_assemble reports what it omitted - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning (hold: do not execute before the beta.73 cut)
**Mode:** discuss, navigator approval "yes" on the nine decisions below. Method lens: Theo, well-defined rung (Scientific Roadmapping used only to rank decisions by blocking risk). No book claims are made here.

<domain>
## Phase Boundary

SEED-134 Plan 01. `context_assemble` returns `_meta.omitted[]` and reports a thrown leg as `leg_failed`. WHAT is locked in `372-SPEC.md`. This file locks HOW. Bounded focus, outer ring and cross-boundary discovery are out of scope (see the SEED-134 ruling log).
</domain>

<decisions>
## Implementation Decisions

### D1. top_k truncation detection (the blocker)
- Ask `getNeighborhood` for `topK + 1` rows, keep the first `topK`, and emit `top_k_cap` with `count: null` when the extra row exists. No second query.
- Risk: on tied scores `LIMIT topK+1` may not return the same first `topK` as `LIMIT topK`, which would break byte-stability (SPEC requirement 2).
- Gate: the before/after golden snapshot test decides. If ties break it, DROP the `top_k_cap` entry from v1 and amend the SPEC again. Do not add an ordering tiebreak (it changes existing output).
- The probe row is used only for detection; `filterRankedExclusions` still runs on the first `topK` rows exactly as today.

### D2. Collector design
- Thread a small collector object through the legs. Every leg keeps its existing return type. `getRoomContext` assembles `_meta.omitted` from the collector at the end.
- One entry per (leg, reason), never per node.

### D3. Tool description and schema-budget pins
- Add one sentence to the `context_assemble` description (mentions `_meta.omitted`).
- Before editing, check whether the 267/276 pins and the schema-budget gate count description length (quick 261019-k22 re-baselined it). If they do, re-baseline in the same plan, not later.

### D4. max_depth cap is NOT reported in v1
- Knowing that depth cut nodes off needs an extra traversal; a heuristic would be false comfort.
- `depth_cap` leaves the closed reason set. Closed set is: `leg_failed`, `type_excluded`, `top_k_cap`, `char_cap`, `window_cap`, `estimate_only`.
- SPEC amended in the same change (header note, requirement 1, requirement 5, boundaries, acceptance).

### D5. Free counts
- `window_cap`: fragments dropped (total minus windowed; known in `legB`).
- `char_cap`: number of fragments truncated (known at slice time). The duplicate `seedFragments` path (getRoomContext lines ~308-310) gets the same treatment.
- `type_excluded`: rows before minus rows after `filterRankedExclusions`.
- `estimate_only`: no count (`null`).
- `top_k_cap`: `null` (see D1).

### D6. leg_failed detail
- Error class name only (for example `TypeError`), never the message.
- Audit EVERY leg's `try/catch` during planning, not only Leg C (`legC` swallows to `[]`). Any leg that swallows an exception reports `leg_failed`.

### D7. Shape
- `_meta.omitted` is always present (empty array when nothing omitted). Stable shape; cost is negligible; entries are bounded by (leg, reason) pairs.

### D8. SessionStart envelope
- Not coupled in this phase. Export the reason enum as a shared constant from `room-context.cjs` so the envelope can adopt it later.

### D9. Test order
- FIRST capture a golden snapshot of every pre-existing result field on a fixture room, before changing any code. Then implement, then compare. Without the golden, requirement 2 is untestable.
- New test file for requirements 1 to 7; keep `test-get-room-context.cjs`, `test-room-context-latency.cjs`, `test-room-context-part8-invariant.cjs` passing unchanged.

### Claude's Discretion
- Exact collector API names; fixture room contents; test file naming.
</decisions>

<specifics>
## Verified code facts (2026-10-19)

- `lib/mcp/tools/context.cjs`: the response is `textResponse(Object.assign({ ok, room_dir, ...readinessFields, ...briefFields }, result))`, so `result._meta` passes through to every surface with no tool-side change.
- `lib/core/navigation/room-context.cjs`: `legC` returns `[]` on any exception; `filterRankedExclusions` drops `chain_state`; `legB` slices the fragment window and cap-truncates content; `getNeighborhood` applies `LIMIT :top_k` in SQL (`neighborhood.cjs`).
- The file cites a 1200 ms NAV budget and promises additive `_meta` changes with byte-stable existing fields.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/phases/372-.../372-SPEC.md` (requirements, boundaries, acceptance)
- `.planning/seeds/SEED-134-holonic-focus-and-discovery-architecture.md` (scope cut ruling, deferral gates, kill criteria)
- `lib/core/navigation/room-context.cjs`, `lib/core/navigation/neighborhood.cjs`, `lib/mcp/tools/context.cjs`
- `tests/test-get-room-context.cjs`, `tests/test-room-context-latency.cjs`, `tests/test-room-context-part8-invariant.cjs`
- Canon Part 8 (no room content out), Part 9 (memory locality)
</canonical_refs>
