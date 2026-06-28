---
kind: context
phase: 185
slug: drift-runtime-reachability
milestone: v1.15.0
created: 2026-06-28
canon_parts: [11]
requirements: [DRIFT-01]
cirs_relationship:
  surfaces_added: []
  surfaces_modified: []
  surfaces_removed: []
  spine_consumed:
    - data/connector-registry.json
    - data/brain-orchestration-projection.json
    - lib/core/reader/decide-projection-reader.cjs
    - lib/core/navigation-engine.cjs (decide projection_offer)
  gate_impact: "Adds a runtime-reachability assertion (Class R) to doctor --drift -- the SCHEDULED reconciliation surface (CIRS R9). It FAILS NON-ZERO when a WIRED capability is unreachable by decide() at runtime. No new surface; it consumes the spine and extends the existing --drift gate."
  explanation: "This phase is USED BY CIRS as the runtime half of R9 enforcement. Until now doctor --drift did MERGE-TIME marking only (Class P prose-vs-code + Class Q gsd-record); neither asserts that a capability the connector registry calls WIRED is actually REACHABLE by the one governed path (dispatchSensors -> decide() -> resolver, R4). Phase 185 USES the spine: it reads the connector registry (the WIRED set / permission-to-be-reached, R1) and runs the Phase-184 decide()-time projection reader (the same loadProjection / validateProjection / rankCapabilities decide() uses) to compute what decide() can actually surface, then asserts every WIRED reader-eligible capability is in that set. A WIRED capability the reader can never produce is a dark-at-runtime capability -- exactly the hole-in-the-moat CIRS R7/R9 exist to catch. It mints no edge/node/reach, opens no Brain wire, and leaves every frozen Part 3 contract untouched."
---

# Phase 185: DRIFT Runtime Reachability -- Context

## What this phase builds

A **runtime-reachability assertion** added to `doctor --drift` as a new check
(Class R). Today `doctor --drift` marks drift at MERGE time only:

- Class P -- prose-vs-code drift (report-only)
- Class Q -- gsd-record drift (W007 ROADMAP gaps + I001 missing SUMMARYs)

Neither asks the runtime question the canon concedes is unanswered at CIRS R7
(Part 11) and Appendix-D entries 19/27: **is a WIRED capability actually
reachable by `decide()` at runtime?** Phase 185 answers it. When a capability is
WIRED in the connector registry but the Phase-184 decide()-time projection reader
can never surface it, `doctor --drift` now FAILS (non-zero, with a named drift
finding).

## The reachability predicate (deterministic, never an LLM-judge)

A capability is **unreachable by `decide()` at runtime** when it is:

1. WIRED in the connector registry (`connects_to_spine === true`), AND
2. of a reader-eligible kind (`command` or `agent` -- the kinds the orchestration
   projection grants a `ranking` block; skills are trigger-wired auto-activation
   surfaces, not Shape-F decision-gate options), BUT
3. the Phase-184 reader's deterministic ranker (`rankCapabilities`, the exact read
   `decide()` performs at the gate) does NOT emit a candidate for its projection
   node -- because the projection node is MISSING, carries NO `ranking` block, or
   the whole projection fails the reader's R2 correctness gate (so `decide()`
   skips the offer entirely).

This leans DIRECTLY on the Phase-184 reader (Part 7 reuse-before-build): the same
`loadProjection` / `validateProjection` / `rankCapabilities` that
`lib/core/navigation-engine.cjs` decide() calls to set `trace.projection_offer`.
"Reachable here" means "reachable by the real decide() read", not by a parallel
re-implementation.

## Dependency on Phase 184 (the reader)

Phase 184 added the decide()-time projection READER
(`lib/core/reader/decide-projection-reader.cjs`) and wired it into
`lib/core/navigation-engine.cjs` decide() (sets `trace.projection_offer`). Phase
185 is testable only because 184 landed: the reachability assertion is defined as
"what the 184 reader can surface", so it requires the reader to exist.

## HARD constraints honored

- **Part 8 LOCAL only.** Reads two committed LOCAL artifacts via the LOCAL-only
  184 reader. Zero Brain calls, zero network on this path.
- **Frozen Part 3 contracts UNCHANGED.** MAX_K=3, DIAL_REACH_K=6, 0.70/0.15, the
  6-reach bank, the dial glyphs are untouched. This adds a doctor check.
- **Additive.** Class P + Class Q merge-time marking still run under `--drift`;
  Class R is added alongside, not in place of them. The marketplace-cache-drift
  deadlock carve-out (Class A) is untouched; the new non-zero exit branch is
  narrowly scoped to the runtime-reachability check (populated only under
  `--drift`), so it never alters any other class-flag run's exit code.
- **Deterministic.** Reachability is computed in code, never by an LLM-judge.

## CIRS relationship

This phase CONSUMES the invocation spine (the connector registry, the
orchestration projection, the Phase-184 reader, the decide() path) and is the
runtime half of CIRS R9 (doctor --drift is the SCHEDULED reconciliation surface
beside the merge gate). It adds no invocable surface. The `cirs_relationship`
block above is the R12 forward-declaration.
