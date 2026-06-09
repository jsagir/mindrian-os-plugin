---
phase: 150-memory-cortex-as-graph-members
plan: 01
subsystem: database
tags: [sqlite, node:sqlite, navigation, graph, memory-cortex, part-9, part-8, cjs]

# Dependency graph
requires:
  - phase: 149-gsd-planning-artifacts-as-local-graph-members
    provides: planning-artifacts.cjs writer shape + run-all-149.sh tolerant aggregator + edges.cjs additive-type idiom (the mirror templates)
  - phase: 109-sql-context-memory-navigation-spine
    provides: navigation.cjs closed-surface chokepoint + the room.db nodes/edges schema
  - phase: 129.5-truth-machine-activation
    provides: confirmNode human-byUser truth-claim promotion path + the Part 9 audit-node carve-out
provides:
  - "lib/core/navigation/memory-artifacts.cjs: 5 cortex writers over a caller-owned db handle (writeMemoryArtifactNode / writeGoverningThoughtNode / writeNavigatorPersonaNode / writeDecisionNode / writeCortexLineageEdge) + 4 stable-id helpers + MEMORY_KINDS"
  - "edges.cjs STATES / SUPPORTS / DESCRIBES additive members (INFORMS reused)"
  - "navigation.cjs additive re-export of the 5 writers + id helpers"
  - "tests/run-all-150.sh phase-150 aggregator + 3 owned CJS suites (memory-nodes / lineage-edges / decision-projection)"
  - "The decision-node EXTEND-debt projector closing the type=decision silent-empty-set (MEM-07)"
affects: [150-02-brain-egress, 150-03-reconcile-trigger, 150-04-cortex-context-orphans, 150-05-spine-connector, 150-06-selector-graph-driven]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror-before-build: memory-artifacts.cjs clones planning-artifacts.cjs shape verbatim (caller-owned db, isPlainObject guard, ON CONFLICT(id) upsert, defensive {ok,node_id}|{ok:false,reason} returns)"
    - "Truth-claim vs system-bookkeeping split: 3 bookkeeping writers mint review_status=confirmed (Part 9 carve-out); writeDecisionNode mints proposed and the DO UPDATE clause excludes review_status (no-downgrade)"
    - "Subset-constraint edge writer: writeCortexLineageEdge narrows to {STATES,SUPPORTS,INFORMS,DESCRIBES}, edges.cjs ALLOWED_EDGE_TYPES stays the single taxonomy source"

key-files:
  created:
    - lib/core/navigation/memory-artifacts.cjs
    - tests/run-all-150.sh
    - tests/test-150-memory-nodes.cjs
    - tests/test-150-lineage-edges.cjs
    - tests/test-150-decision-projection.cjs
  modified:
    - lib/core/navigation/edges.cjs
    - lib/core/navigation.cjs

key-decisions:
  - "writeDecisionNode mints review_status=proposed only; the ON CONFLICT DO UPDATE SET clause deliberately excludes review_status so a human-confirmed decision survives re-projection (no downgrade) and a confirmed mint is structurally impossible on the projector path"
  - "memory_artifact / governing_thought / navigator_persona carry created_by=system review_status=confirmed under the Part 9 v1.5 audit-node carve-out (system-bookkeeping, not truth-claims)"
  - "Node properties carry only section/kind enums, sha256 hash handles, and role-blend/journey-stage enums -- never raw MINTO governing-thought or USER.md persona prose (Part 8 input contract for plan 02)"
  - "edges.cjs gains STATES/SUPPORTS/DESCRIBES additively at the END after VALIDATES; INFORMS (decision INFORMS section) reuses the shipped member"

patterns-established:
  - "Phase-150 aggregator clones the run-all-149.sh tolerant MISSING-runner with a full owning-plan map so the runner is complete from Wave 1"
  - "Per-suite no-dash codepoint guard references 0x2014/0x2013 via String.fromCharCode so the test file stays greppably clean"

requirements-completed: [MEM-01, MEM-02, MEM-07]

# Metrics
duration: ~25min
completed: 2026-06-09
---

# Phase 150 Plan 01: Memory-Cortex Node/Edge Writer Summary

**memory-artifacts.cjs ships the 5-writer cortex chokepoint (6 memory_artifact kinds + governing_thought + navigator_persona as system-bookkeeping nodes, plus the EXTEND-debt decision projector that mints proposed truth-claims), with STATES/SUPPORTS/DESCRIBES added to the edge taxonomy and the writers re-exported on the closed navigation surface.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-09T09:52Z (approx)
- **Completed:** 2026-06-09T10:18Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- New navigation submodule `lib/core/navigation/memory-artifacts.cjs` mirroring planning-artifacts.cjs verbatim in shape, repointed to the 6 user-memory MD files (ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER), requiring only ./edges.cjs (zero room.db open, substrate-guard floor preserved)
- The decision-node EXTEND-debt projector (MEM-07): collapses the triple-ledger (decisions_index / minto_decision_log / f_selector_decision) into one graph-authoritative `decision` node so type=decision reads (find_stale_decisions, room-home) stop returning a silent empty set
- Truth-claim discipline enforced structurally: writeDecisionNode mints review_status=proposed, never confirmed; the ON CONFLICT update excludes review_status so a human-confirmed decision is never downgraded
- edges.cjs carries STATES/SUPPORTS/DESCRIBES additively (floor 15 -> 18 types; INFORMS reused); navigation.cjs re-exports the 5 writers + 4 id helpers + MEMORY_KINDS
- run-all-150.sh phase aggregator + 3 RED-first CJS suites, all 3 now GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test scaffold + run-all-150.sh aggregator (RED-by-design)** - `e04a52f7` (test)
2. **Task 2: memory-artifacts.cjs writer + edges.cjs cortex types + navigation re-export** - `a8225e38` (feat)

**Plan metadata:** (this commit) docs(150-01): complete plan

_Note: this is a tdd=true plan; Task 1 is the RED gate (test commit), Task 2 is the GREEN gate (feat commit)._

## Files Created/Modified
- `lib/core/navigation/memory-artifacts.cjs` - The 5 cortex writers + 4 stable-id helpers + MEMORY_KINDS; system-bookkeeping vs truth-claim header doctrine
- `lib/core/navigation/edges.cjs` - Added STATES/SUPPORTS/DESCRIBES to ALLOWED_EDGE_TYPES additively after VALIDATES
- `lib/core/navigation.cjs` - Additive re-export block for the 5 writers + id helpers
- `tests/run-all-150.sh` - Phase 150 scoped aggregator (clone of run-all-149.sh tolerant runner) listing all 13 suites with the owning-plan map
- `tests/test-150-memory-nodes.cjs` - 6 kinds + governing_thought + persona system-bookkeeping; idempotent upsert; substrate-guard grep floor
- `tests/test-150-lineage-edges.cjs` - STATES/SUPPORTS/INFORMS/DESCRIBES write; non-taxonomy + real-but-non-cortex rejected; idempotent
- `tests/test-150-decision-projection.cjs` - decision mints proposed (never auto-confirmed); silent-empty-set fix; no-downgrade on re-projection

## Decisions Made
- Used the production-faithful applySchema with CHECK constraints (created_by IN (...), review_status IN (...)) from test-149-lineage-edges.cjs, adding the nullable source_section column to match the production node schema seen in test-149-brain-egress.cjs.
- Decision source enums taken from 150-LOOP-MAP.md: `decisions_index`, `minto_decision_log`, `f_selector_decision`.
- The no-downgrade test simulates the human confirmNode promotion via a direct UPDATE to review_status=confirmed, then re-projects to prove the projector cannot revert it (the constitutional T-150-02 mitigation).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED-by-design was confirmed before Task 2 (3 owned suites failed with MODULE_NOT_FOUND, 10 printed MISSING, runner ran to completion); all 3 went GREEN after the writer landed.

## User Setup Required
None - no external service configuration required. This plan installs zero packages (pure node:sqlite + existing navigation submodules).

## Next Phase Readiness
- The cortex writer interface is frozen for the downstream 150 waves: Plan 02 (brain-egress) consumes the hash-handle/enum-only node properties as its Part-8-safe input contract; Plan 03 (reconcile + trigger) projects the memory MD files through these writers; Plans 04/05/06 read the cortex graph these writers populate.
- run-all-150.sh will go progressively GREEN as plans 02-08 land their suites; it correctly exits non-zero today on the 10 MISSING suites (RED-by-design, mirroring run-all-149.sh).
- Frozen Phase-148 selector contracts (MAX_K=3, 0.70/0.15 gate, DIAL_REACH_K=6) were not touched.

## Canon Gate Check
- **Part 8 (Brain boundary):** zero network surface in the writer (requires only ./edges.cjs); node properties are enum/hash handles only, never user prose. PASS.
- **Part 9 (truth vs bookkeeping):** decision node minted proposed (truth-claim, human-confirm-only); bookkeeping nodes confirmed under the carve-out. PASS.
- **No em-dashes / en-dashes:** grep -P over all 7 touched files returns clean. PASS.
- **Reuse before build (Part 7):** memory-artifacts.cjs mirrors planning-artifacts.cjs; run-all-150.sh mirrors run-all-149.sh; writeCortexLineageEdge reuses edges.writeEdge. PASS.
- **Substrate guard:** memory-artifacts.cjs not flagged (covered by the /^lib\/core\/navigation\// allow-list). PASS.

## Self-Check: PASSED

- FOUND: lib/core/navigation/memory-artifacts.cjs
- FOUND: tests/run-all-150.sh, tests/test-150-memory-nodes.cjs, tests/test-150-lineage-edges.cjs, tests/test-150-decision-projection.cjs
- FOUND commit e04a52f7 (Task 1)
- FOUND commit a8225e38 (Task 2)

---
*Phase: 150-memory-cortex-as-graph-members*
*Completed: 2026-06-09*
