---
phase: 201-harness-as-code-manifest
plan: 03
subsystem: graph-refine-loop
tags: [SEED-033-L2, D-201-2, CANON-Part8, CANON-Part9, part9-chokepoint-write, self-improving-graph]
requires:
  - lib/core/navigation.cjs (Phase 109 - the closed SQL navigation chokepoint: writeEdge, logMemoryEvent, getNeighborhood)
  - lib/core/navigation/edges.cjs (ALLOWED_EDGE_TYPES frozen set)
  - lib/core/room-db.cjs (openRoomDb / closeRoomDb, lazy-required)
provides:
  - runGraphRefine(roomDir, opts) -> { proposed, verified, written, rounds } - a Ralph-style propose -> fact-check -> refine loop over the LOCAL room.db
  - defaultFactCheck(proposal, neighborhood, focusNodeId) -> { verified, reason } - endpoints-exist + allowed-type + no-duplicate-edge guard
affects:
  - MindrianOS can now ITERATIVELY improve its own graph (the moat deepening itself) instead of only consuming it, human-gated and bounded
tech-stack:
  added: []
  patterns: [part9-chokepoint-write, dry-run-default-human-gated, bounded-plus-converge-stop, per-run-dedup, injectable-seams]
key-files:
  created:
    - lib/core/graph-refine-loop.cjs
    - tests/test-201-graph-refine-loop.cjs
  modified:
    - lib/core/navigation.cjs
decisions:
  - "D-201-2 honored: the loop runs over the LOCAL room.db (Part 8/9 clean), NOT the orchestration projection. The projection variant is a later phase."
  - "dryRun defaults TRUE (:101). A proposal is a CLAIM; a verified edge is written only on an explicit approve===true AND dryRun===false (:102-103). Only a human confirms a truth-claim node (Canon Part 9). autonomous:false - graph writes are material."
  - "Bounded twice over: MAX_ROUNDS_DEFAULT=3 (:38) AND a no-new-verified-edges early stop (:159); a nothing-fresh round also converges (:128). A rejected proposal is dedup-blocked for the run via the seen set (:132)."
  - "Part 8 property fence: written edge properties are enum/scalar handles only (origin + a rationale slice capped at 40 chars, :147), never prose - no room-content egress."
metrics:
  completed: 2026-07-01
  tasks: 3
  files_changed: 3
  reconstructed: "SUMMARY authored 2026-07-02 from shipped commit be05a77d; the earlier out-of-order pass that landed the code did not write a SUMMARY."
---

# Phase 201 Plan 03: Self-Improving Graph Loop (propose -> fact-check -> refine) Summary

Closed SEED-033 L2: MindrianOS consumed its local room graph but had no agent loop that ITERATIVELY IMPROVED it. `lib/core/graph-refine-loop.cjs` adds that loop as a Ralph-style propose -> fact-check -> refine cycle over the LOCAL room.db. An injected agent (`opts.proposeFn`) proposes typed edge enrichments the graph implies but does not yet carry (for example a SHARES_JOB edge between two nodes); a fact-check pass verifies each proposal against the existing neighborhood; and only verified proposals are written - through the `navigation.cjs` chokepoint (Canon Part 9), LOCAL only (Canon Part 8, zero Brain wire), human-gated and bounded.

## State on entry (important context)

The phase-201 cluster landed OUT OF ORDER in a prior session. The code for this plan was committed at `be05a77d` (`feat(201-03): self-improving graph loop, propose/fact-check/refine (SEED-033 L2)`), an ancestor of HEAD, but that pass did not write a SUMMARY. This SUMMARY is reconstructed from the shipped source and the live test run; no code was changed in the reconstruction.

## What shipped

- **`lib/core/graph-refine-loop.cjs`** (created) - `runGraphRefine(roomDir, opts)` orchestrates the bounded loop with three injectable seams (`getNeighborhoodFn` / `proposeFn` / `factCheckFn`) so the logic tests fully offline. `defaultFactCheck` verifies a proposal only when both endpoints exist in the neighborhood node set, the edge type is a member of the frozen `ALLOWED_EDGE_TYPES`, and no existing neighbor is already connected to focus by that same type (a duplication / contradiction guard). Writes go through `navigation.writeEdge` (:143) and each landed edge emits an `edge_added` memory_event via `navigation.logMemoryEvent` (:152).
- **`lib/core/navigation.cjs`** (modified) - the verified-edge write path exposed on the closed chokepoint surface (writes remain chokepoint-only; the loop never opens room.db directly).
- **`tests/test-201-graph-refine-loop.cjs`** (created) - 5 assertions covering the propose step, the fact-check step, dry-run-writes-nothing, approve-writes-through-navigation, and the bounded + dedup behavior.

## Test results (actual, live-verified)

```
$ node tests/test-201-graph-refine-loop.cjs   -> 5 assertions PASS, exit 0
$ bash tests/run-all-201.sh                    -> Phase 201: PASS=5 FAIL=0 SKIP=0
```

## Canon invariants (source-verified)

- **Part 9 chokepoint-only:** the only writes are `navigation.writeEdge` (:143) and `navigation.logMemoryEvent` (:152). `git grep -n "new Database(" lib/core/graph-refine-loop.cjs` is empty - the loop never opens room.db directly.
- **Part 8 LOCAL-only, zero Brain:** grep for `brain|fetch|http|axios` in the file hits only comment lines (11, 85); there is no networking code. Written edge properties are enum/scalar handles only (:147), never prose.
- **Human-gated:** `dryRun` defaults TRUE (:101); a verified proposal is written only on explicit `approve===true && dryRun===false` (:102-103). autonomous:false.
- **Bounded + converges:** `MAX_ROUNDS_DEFAULT=3`; the loop stops on a no-fresh-proposals round (:128) and on a no-new-verified-edges round (:159). A rejected proposal is dedup-blocked for the run (:132).

## Self-review

- Part 8: LOCAL only, no egress (asserted by the no-Brain-write test; property fence at :147).
- Part 9: chokepoint writes only, human-gated (asserted by the dry-run-writes-nothing test).
- Bounded + dedup: converges, never loops (asserted).
- No em-dashes in any shipped file (verified).

## Commits

- `be05a77d` feat(201-03): self-improving graph loop, propose/fact-check/refine (SEED-033 L2)
