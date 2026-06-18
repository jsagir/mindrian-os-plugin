---
kind: spec
phase: 168
slug: part4-edge-vocabulary-reconciliation
title: Reconcile the Part 9 frozen edge set with Canon Part 4 (CONVERGES / INVALIDATES / ENABLES)
milestone: v1.14.0
status: scoped
created: 2026-06-18
canon_parts: [4, 6, 8, 9]
sequence: "before Phase 164 (revised order ...167 -> 168 -> 164 -> 165), navigator-LOCKED 2026-06-18"
depends_on: []
source: "surfaced by the Phase 164 issue-tree research (164-RESEARCH.md E2); navigator chose split-out-first 2026-06-18"
---

# Phase 168: Part 4 edge-vocabulary reconciliation

## The drift (verified 2026-06-18)
Canon Part 4 prose declares the cascade edges `INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES`.
The Part 9 chokepoint frozen set (`lib/core/navigation/edges.cjs` `ALLOWED_EDGE_TYPES`, what `writeEdge`
validates) contains INFORMS + CONTRADICTS but is MISSING `CONVERGES`, `INVALIDATES`, `ENABLES`. A
separate OLDER path (`lib/core/lazygraph-ops.cjs:26` EDGE_TYPES) DOES carry them (the Phase 84 cascade
path). So the canon already BLESSES these three in prose; the Part 9 code simply never caught up. This
is code-vs-canon drift, and it blocks Phase 164's issue-tree (which must emit INVALIDATES/ENABLES via
the Part 9 chokepoint).

## Goal
Bring the Part 9 frozen edge set into line with what Canon Part 4 already declares: add `CONVERGES`,
`INVALIDATES`, `ENABLES` to `ALLOWED_EDGE_TYPES`. This is a RECONCILIATION (honor the prose in code),
navigator-gated as a frozen-constitutional-set move, landed as ONE atomic lockstep wave (mirror the
Phase 163-01 / 150.8 amendment procedure).

## Decision (navigator-LOCKED 2026-06-18)
- RECONCILE by ADDING the three Part-4-blessed cascade edges to the frozen code set (chosen over a
  lossy remap). Part 4 PROSE already lists them, so the canon TEXT for the three needs NO change; the
  amendment record (Appendix D entry) documents that the CODE was brought into line + the version bump.
- `BELONGS_TO` (used by the issue-tree branch->governing-problem in 164) is NOT in Part 4 prose; it is
  NOT added here. The issue-tree REMAPS `BELONGS_TO` -> `PART_OF` (the structural edge Phase 163 already
  froze). No genuinely-new edge type is minted in this phase.
- The broader two-vocabulary cleanup (the `lazygraph-ops.cjs` legacy array carries many extra types:
  HSI_CONNECTION, REVERSE_SALIENT, RESOLVES_VIA, etc.) is OUT of scope here. 168 reconciles ONLY the
  three Part-4-blessed cascade edges into the Part 9 chokepoint; the legacy-array unification is a
  deferred follow-on.

## Requirements
- **EDGE-01:** add `CONVERGES`, `INVALIDATES`, `ENABLES` to `lib/core/navigation/edges.cjs`
  `ALLOWED_EDGE_TYPES` via ONE additive block (mirror the Phase 150.8 / 163-01 additive idiom verbatim);
  `writeEdge` accepts them and still rejects a made-up type; the Set stays frozen.
- **EDGE-02:** a canonical floor test (`tests/test-edges-part4-cascade-floor.cjs`): the three new are
  members; every prior frozen type still present (FULL FLOOR); frozen-Set instance; made-up-type
  negative; NEVER asserts `.size`.
- **EDGE-03:** the canon lockstep: `docs/MINDRIAN-CANON.md` Appendix D entry recording the
  reconciliation (code brought into line with the already-blessed Part 4 prose; note the deferred
  lazygraph two-vocabulary cleanup) + header/footer version bump; `docs/CANON-PHASE-MAP.md` Phase 168
  row + a version-history row. Part 4 prose for the three is UNCHANGED (already correct).
- **EDGE-04 (navigator gate):** a `checkpoint:human-verify` blocking gate ratifying the frozen-set move
  before it is marked complete (mirror 163-01 Task 3).
- Register the floor test in a `tests/run-all-168.sh` aggregator with the em-dash sweep.

## Canon alignment
- Part 4: honors the already-declared cascade vocabulary in code. Part 6: the plugin honors its own
  canon (drift between prose and code is a self-CONTRADICTS this phase resolves). Part 8/9: edges are
  LOCAL graph data; props enum/scalar only; no Brain egress; writes via navigation.cjs.
- NO em-dashes (CLAUDE.md HARD RULE).

## Out of scope / deferred
- The `lazygraph-ops.cjs` legacy edge-array unification (the broader two-vocabulary cleanup).
- `BELONGS_TO` as a frozen type (remapped to PART_OF instead).
- Any issue-tree / 164 code (this phase only reconciles the vocabulary so 164 can proceed on a clean set).

## Acceptance
- `node tests/test-edges-part4-cascade-floor.cjs` passes (3 new + full FLOOR + frozen + negative).
- `writeEdge` accepts CONVERGES/INVALIDATES/ENABLES on an in-memory db.
- `docs/MINDRIAN-CANON.md` Appendix D entry + version bump; CANON-PHASE-MAP Phase 168 + version rows.
- `bash tests/run-all-168.sh` green; no em-dashes.
- navigator ratified the frozen-set move at the blocking checkpoint.
