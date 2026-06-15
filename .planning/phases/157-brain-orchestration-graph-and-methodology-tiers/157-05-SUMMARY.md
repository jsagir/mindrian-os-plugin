---
phase: 157-brain-orchestration-graph-and-methodology-tiers
plan: 05
subsystem: testing
tags: [part8-boundary-scan, methodology_tier, brain-derived-local-cache, orchestration-projection, cjs, feynman-runner]

# Dependency graph
requires:
  - phase: 157-04
    provides: validateProjection + loadUnwiredAllowlist exports, the --check 3-mode taxonomy, the 207-node projection, the orchestration-unwired-allowlist.json surface
  - phase: 157-03
    provides: the closed typed-edge set + the ranking-input exposure (chain_provenance keys) the node-field allowlist documents
  - phase: 157-02
    provides: the generator + projection artifact + cross-domain-analogues.json seed
  - phase: 157-01
    provides: the Canon Part 8 dual-role amendment + methodology_tier boundary-keeper (Appendix D entry 19) this plan proves by construction
provides:
  - The cache-contract schema section (the deferred nav-engine consumer target; Tier-0 resilient; consumable shape; deferred fast-follows)
  - NODE_FIELD_ALLOWLIST + EDGE_FIELD_ALLOWLIST exported as frozen arrays (single source of truth for the boundary scan)
  - The adversarial Part 8 boundary scan over the projection + generator + analogue seed + unwired-allowlist (BOG-09/BOG-10)
  - The boundary-scan invariants mirrored into the bash suite + registered in the Feynman runner
affects: [Phase 137 brain-mindrianos-sync-compat, the deferred nav-engine consumer of the cache]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adversarial planted-secret tripwire (Phase 90/110 idiom): the scan PROVES locality by catching a planted user-content value (RED) before asserting the real artifact is clean (GREEN); the scan is the proof, not an assertion"
    - "Field-allowlist sweep: a node/edge key outside the generator's exported frozen allowlist is a Part 8 breach, caught before the artifact lands"
    - "Forbidden-value heuristic scoped to per-surface data (nodes[]+edges[]); top-level legibility notes scanned for room/+email only, exempt from the over-cap heuristic"

key-files:
  created:
    - tests/test-orchestration-projection-part8-boundary.cjs
  modified:
    - docs/ORCHESTRATION-PROJECTION-CONTRACT.md
    - scripts/build-orchestration-projection.cjs
    - lib/memory/orchestration-projection.test.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "FREE_TEXT_CAP = 120 chars: generous above the longest legitimate generic handle (a command-id + framework name) but far below any artifact body / transcript"
  - "The forbidden-value sweep is scoped to nodes[] + edges[]; the three documented top-level legibility notes (ontology_ref / generated_note / chain_layer_note) are bounded machinery prose ABOUT the build, scanned for room/+email only"
  - "hats stays an OPEN RESEARCH Q6 navigator-gated item; this plan did NOT close it as an engineer decision"

patterns-established:
  - "Pattern: generator exports the boundary-scan allowlists so the doc and the scan assert against the same source of truth"
  - "Pattern: the boundary scan sweeps four surfaces (artifact + generator + analogue seed + unwired-allowlist), not just the artifact"

requirements-completed: [BOG-09, BOG-10]

# Metrics
duration: 6min
completed: 2026-06-15
---

# Phase 157 Plan 05: Cache-Contract Schema + Part 8 Boundary Scan Summary

**The FINAL sealing wave: documents the projection as a Brain-derived LOCAL cache (Tier-0 resilient, the deferred nav-engine consumer target) and ships an adversarial Part 8 boundary scan that PROVES (catches a planted secret RED, then real artifact GREEN) the projection carries zero user-content fields, methodology_tier on every node, and zero live Brain I/O.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-15T20:30:50Z
- **Completed:** 2026-06-15T20:36:37Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Added the cache-contract section (4c) to the projection contract: the artifact IS the Brain-derived LOCAL cache the deferred nav engine reads, regenerated deterministically from LOCAL sources so it survives a Brain outage (Tier-0 resilient); the exact consumable shape; the three deferred fast-follows (live Brain write + Phase 137 continuous sync + nav-engine consumption all OUT of 157).
- Exported NODE_FIELD_ALLOWLIST + EDGE_FIELD_ALLOWLIST as frozen arrays so the doc and the scan assert against ONE source of truth.
- Shipped the adversarial Part 8 boundary scan (6 checks) over FOUR surfaces. CHECK 3 is the planted-secret tripwire: it plants a room/ path, an email, and an over-cap body, proves the heuristic catches each (RED), then proves the real per-surface data is clean (GREEN). Demonstrated at artifact level too: poisoning a node name with a room/ path makes the scan exit non-zero.
- Mirrored the boundary invariants as a 4-test group in the bash suite (33 -> 37 tests) and registered the standalone scan in the Feynman runner TEST_FILES (the BOG-11 gate surface).

## Task Commits

1. **Task 1: Document the local cache-contract schema + export the field allowlists** - `b24fe175` (feat)
2. **Task 2: The adversarial Part 8 boundary scan** - `7005d724` (test)

_Note: Task 2 is tdd="true". The RED/GREEN cycle is internal to the scan (CHECK 3 proves the planted secret is caught before asserting the real artifact is clean) and was additionally demonstrated at the artifact level (poison -> exit 1, restore -> exit 0). It landed as one feature/test commit because the test file IS the deliverable; the generator emit logic was NOT changed (this wave PROVES, it does not change behavior)._

## Files Created/Modified
- `tests/test-orchestration-projection-part8-boundary.cjs` - NEW. The adversarial 6-check Part 8 boundary scan over the projection + generator + analogue seed + unwired-allowlist.
- `docs/ORCHESTRATION-PROJECTION-CONTRACT.md` - Added section 4c (cache contract) + 4d (boundary scan); updated section 5 to mark Plan 05 LANDED.
- `scripts/build-orchestration-projection.cjs` - Exported NODE_FIELD_ALLOWLIST + EDGE_FIELD_ALLOWLIST frozen arrays. NO change to emit logic.
- `lib/memory/orchestration-projection.test.cjs` - Added the 4-test boundary-scan group (field allowlist, tier, planted-secret, zero-live-Brain).
- `lib/memory/run-feynman-tests.cjs` - Registered the standalone boundary scan in TEST_FILES.

## Decisions Made
- FREE_TEXT_CAP = 120 chars (generous above the longest legitimate generic handle, far below any artifact body).
- Forbidden-value sweep scoped to nodes[]+edges[]; the three top-level legibility notes (ontology_ref / generated_note / chain_layer_note) are bounded machinery prose ABOUT the build and are scanned for room/+email only, not the over-cap heuristic. This was driven by a genuine RED finding (the source-empty chain_layer_note legitimately exceeds the cap), confirming the heuristic is live.
- hats stays an OPEN RESEARCH Q6 navigator-gated item; not closed here.

## Deviations from Plan

None - plan executed exactly as written. The one course-correction (scoping the forbidden-value heuristic to per-surface data after the RED finding on chain_layer_note) was an in-task refinement of the test the plan asked for, not an out-of-scope change: the plan's behavior spec explicitly says "no node or edge value matches a forbidden user-content heuristic", which is precisely the per-surface scoping applied. No production logic was changed.

## Issues Encountered
- Initial CHECK 3 walked the entire projection including the top-level legible-note fields, flagging the intentionally-long source-empty `chain_layer_note` (machinery prose). Resolved by scoping the over-cap heuristic to nodes[]+edges[] per the plan's behavior spec, while still scanning the notes for room/ paths + emails. This was the heuristic working correctly (a true RED), then refined to the documented surface.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BOG-09 and BOG-10 are satisfied: the projection is a committed local file with a documented cache-contract schema and zero runtime Brain dependency; the boundary scan over the projection + generator + analogue seed + allowlist returns zero user-content fields; methodology_tier is on every node; zero live Brain read/write is proven by the grep gate.
- The deferred nav-engine consumer now has a stable cache-contract target (section 4c).
- Phase 137 (brain-mindrianos-sync-compat) remains the home for continuous remote sync; the live Brain write stays a fast-follow. Both are explicitly OUT of Phase 157.

---
*Phase: 157-brain-orchestration-graph-and-methodology-tiers*
*Completed: 2026-06-15*

## Self-Check: PASSED

- All 6 created/modified files exist on disk.
- Both task commits (b24fe175, 7005d724) exist in git history.
- Boundary scan 6/6 GREEN; bash suite 37/37; projection byte-stable at 207 nodes; --check OK; zero em-dashes across all touched files.
