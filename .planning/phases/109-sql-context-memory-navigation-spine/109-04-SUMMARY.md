---
phase: 109-sql-context-memory-navigation-spine
plan: "04"
subsystem: navigation
tags: [sqlite, recursive-cte, navigation-api, truth-states, graph-memory]

requires:
  - phase: 108-graph-memory-schema-reconciliation
    provides: TRUTH-STATES taxonomy (8-transition closed enum); RECONCILIATION schema (12-column nodes table)
  - phase: 109-sql-context-memory-navigation-spine/01-nodes-provenance
    provides: idempotent migration with source_path / created_by / confidence / review_status / created_at / last_seen_at / source_section / confirmed_by / confirmed_at columns + 6 new indices
  - phase: 109-sql-context-memory-navigation-spine/02-session-focus
    provides: focus.cjs (getActiveFocus, setFocus, computeAutoFocus); session_focus migration; lib/core/navigation/ROOM.md Layer 0
  - phase: 109-sql-context-memory-navigation-spine/03-memory-events
    provides: memory-events.cjs (EVENT_TYPES enum, logEvent, findRecentChanges)

provides:
  - lib/core/navigation/neighborhood.cjs - getNeighborhood(db, focusNodeId, opts) recursive CTE returning ranked typed neighbors
  - lib/core/navigation/transitions.cjs - promoteNodeStatus(db, nodeId, fromStatus, toStatus, byUser, reason) chokepoint enforcing 8 documented Phase 108 truth-state transitions
  - lib/core/navigation.cjs - closed 13-function navigation API per CONTEXT D-05 L182-208; 4 LIVE re-exports + 9 stubs awaiting Plans 109-05/07/08/09
  - tests/test-navigation-neighborhood.cjs - 8 GREEN correctness assertions
  - tests/test-navigation-perf-10k.cjs - cold/warm/RSS budget assertions on 10K-node room

affects:
  - 109-05 (insight queries replace 6 stubs - findContradictions, findUnsupportedClaims, findBlockingAssumptions, findStaleDecisions, findOpenQuestions, findRelevantOpportunities)
  - 109-06 (pre-commit hook will reject direct room-db.cjs imports outside the navigation chokepoint allow-list)
  - 109-07 (buildBrainPacket replaces stub; consumes getNeighborhood + findRecentChanges)
  - 109-08 (storeBrainSuggestions replaces stub)
  - 109-09 (getRoomHomeView replaces stub; composes from navigation primitives)
  - 109-10 (acceptance test exercises the full closed surface; latency budget asserted via fs proxy instrumentation)
  - Phase 110 (Brain Context Packets - Plan 110 wraps buildBrainPacket with schema validation)
  - Phase 112 (GraphRAG Retrieval + Room Budding - consumes the navigation API)

tech-stack:
  added: []
  patterns:
    - "Recursive CTE with json_array + json_insert('$[#]', ...) idiom for typed-edge graph walks"
    - "Cycle guard via json_array_length(edge_path) < (max_depth + 1) plus self-loop guard"
    - "Composite ranking score in SQL: edge_type_weight * 0.4 + recency * 0.2 + confidence * 0.2 + section_relevance * 0.2"
    - "Closed-enum chokepoint pattern (TRANSITIONS Set) returning {ok, reason} discriminated unions instead of throwing"
    - "Notation in chokepoint module: live re-exports for shipped surface + notImplementedYet(name, plan) factories for forward-declared closed-surface stubs"
    - "Named-parameter binding in node:sqlite (verified working for repeated :param references)"

key-files:
  created:
    - lib/core/navigation/neighborhood.cjs
    - lib/core/navigation/transitions.cjs
    - lib/core/navigation.cjs
  modified:
    - tests/test-navigation-neighborhood.cjs (Wave 0 stub replaced with 8 GREEN sub-tests)
    - tests/test-navigation-perf-10k.cjs (Wave 0 stub replaced with cold + warm-p95 + RSS assertions)

key-decisions:
  - "Used node:sqlite named-parameter binding ({ focus_node_id, max_depth, top_k }) instead of positional + dropped the planner's positional-fallback path; smoke-tested that repeated :param references resolve correctly so the planner-suggested fallback is unnecessary code"
  - "Stubs throw not_implemented_yet:<name>:Plan 109-XX so callers see the forward-declaration intent in the error message; the chokepoint surface is closed at 14 keys (13 documented functions; the closed surface admits no 14th by canon)"
  - "promoteNodeStatus rolls back the BEGIN transaction if logEvent fails so a successful UPDATE never lands without its audit memory_event"
  - "Empty-case behavior for getNeighborhood: returns [] (not throw) for unknown focus + isolated focus alike; caller treats both as no-op"

patterns-established:
  - "lib/core/navigation/<helper>.cjs siblings + lib/core/navigation.cjs chokepoint re-export: future plans (109-05, 109-07, 109-08, 109-09) ship insights.cjs, packet-builder.cjs, etc. and replace stubs in navigation.cjs"
  - "Tests under tests/test-navigation-<feature>.cjs follow the makeRoom() / cleanup(tmp) / tests=[] / per-sub-test-pass-tally CJS pattern shipped in Plan 109-02 test-navigation-focus.cjs"
  - "RED-then-GREEN TDD with explicit RED commit (test/Task 1) preceding feat commit (Task 2); both committed atomically with --no-verify per the wave-merge contract"

requirements-completed: [NAV-109-02, NAV-109-05]

duration: 15min
completed: 2026-05-05
---

# Phase 109 Plan 04: Neighborhood Retrieval + Navigation API Chokepoint Summary

**Recursive CTE neighborhood retrieval (frozen edge weights, json-array path tracking, cycle-guarded) plus the closed 13-function navigation chokepoint module that supersedes folder scanning and that Plan 109-06 pre-commit hook will protect.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-05T07:32:22Z
- **Completed:** 2026-05-05T07:47:38Z
- **Tasks:** 2
- **Files created:** 3 (lib/core/navigation/neighborhood.cjs, lib/core/navigation/transitions.cjs, lib/core/navigation.cjs)
- **Files modified:** 2 (tests/test-navigation-neighborhood.cjs, tests/test-navigation-perf-10k.cjs)
- **Tests GREEN:** 8 neighborhood correctness sub-tests + 1 perf test (cold + warm + RSS)

## Accomplishments

- **getNeighborhood load-bearing CTE shipped** - the recursive CTE per RESEARCH section 2.1 verbatim: walks edges from focus up to maxDepth, ranks by composite score (edge weight * 0.4 + recency * 0.2 + confidence * 0.2 + section relevance * 0.2), returns typed neighbors with edgePath as parsed JS arrays plus full provenance (sourcePath, reviewStatus, createdBy, confidence, lastSeenAt).
- **Frozen edge weights enforced** - CONTRADICTS / INVALIDATES = 1.0, DEPENDS_ON / ASSUMES = 0.9, SUPPORTS / EVIDENCES = 0.8, INFORMS / ENABLES = 0.6, CONVERGES / MENTIONS_ENTITY = 0.4, all others = 0.3 (per CONTEXT D-02 L113-118; deviation fails Test 4).
- **Cycle guard hardened** - json_array_length(edge_path) < (max_depth + 1) plus nh.id != next_n.id self-loop guard; the 2-cycle fixture produces bounded re-walks (Test 5 asserts cycleCount <= 6 at maxDepth=5).
- **promoteNodeStatus chokepoint shipped** - validates against 8-element closed Set; rejects out-of-set transitions with invalid_transition; rejects state mismatches with state_mismatch + currentStatus; rejects unknown nodes with unknown_node; populates confirmed_by / confirmed_at on transitions to confirmed / validated; writes status_promoted / status_rejected / status_superseded / status_stale memory_event via logEvent inside the BEGIN/COMMIT transaction (rolled back if event log fails).
- **Closed 13-function navigation surface shipped** - lib/core/navigation.cjs re-exports 4 live (getActiveFocus, setFocus, getNeighborhood, findRecentChanges, promoteNodeStatus) + 9 stubs throwing not_implemented_yet:<name>:<plan>; total 14 keys per Object.keys (the closed surface count documented in plan verification line 736).
- **Perf budgets crushed on 10K-node room** - cold = 0.79ms (budget 200ms), warm p95 = 1.35ms (budget 50ms), RSS = 59MB (budget 200MB). The "<50ms warm on 10K-node room" load-bearing claim from RESEARCH section 2.1 line 312 is validated by 37x.

## Task Commits

1. **Task 1: RED tests** - `bd3a895` (test) - 8 neighborhood sub-tests + perf budget assertions; both files RED until Task 2 ships navigation.cjs
2. **Task 2: ship neighborhood + transitions + chokepoint** - `4e43590` (feat) - all 3 lib files plus 8/8 GREEN neighborhood tests plus perf 0.79/1.35/59 MB

_Note: this is a TDD plan with RED preceding GREEN; per the wave-merge contract on this branch the per-task commits use --no-verify so no pre-commit gate runs against intermediate RED state._

## Files Created/Modified

- `lib/core/navigation/neighborhood.cjs` - getNeighborhood recursive CTE; 73 LOC; the load-bearing primitive consumed by Plans 109-05 / 109-07 / 109-09 / 109-10
- `lib/core/navigation/transitions.cjs` - promoteNodeStatus + TRANSITIONS Set + EVENT_FOR_TRANSITION map; 86 LOC
- `lib/core/navigation.cjs` - the closed 13-function chokepoint module (4 live + 9 stubs); 56 LOC; the single import point for Plan 109-06 pre-commit hook to protect
- `tests/test-navigation-neighborhood.cjs` - 8 GREEN correctness sub-tests; replaces Wave 0 stub
- `tests/test-navigation-perf-10k.cjs` - cold + warm p95 + RSS budget assertions; SKIP_PERF=1 honored; replaces Wave 0 stub

## Decisions Made

- **Named parameters over positional binds.** Smoke-tested that node:sqlite supports `{ focus_node_id, max_depth, top_k }` named binding with repeated :param references. Plan included a positional-fallback try/catch path; this turned out to be unnecessary so I dropped it (cleaner code, one less branch). Documented as plan-vs-implementation deviation below.
- **Stubs throw on call, not on require.** notImplementedYet returns a function; the throw fires only when a caller invokes the stub. This keeps Object.keys(navigation).length stable at 14 immediately after require, which is what the verification grep checks.
- **transitions.cjs rollback robustness.** If logEvent returns ok:false (e.g. invalid event_type bug, db disk-full, etc.) inside the transaction, the catch path explicitly rolls back AND the outer try-around-ROLLBACK swallows secondary rollback failures so the function always returns a discriminated-union result instead of throwing.

## Deviations from Plan

**1. [Rule 1 - simplification] Dropped the positional-binding fallback in getNeighborhood.**
- **Found during:** Task 2 (writing neighborhood.cjs)
- **Issue:** Plan action included a try/catch around named-parameter binding with a positional fallback that string-replaces :max_depth and :top_k as literals and binds :focus_node_id positionally twice. Smoke test (`node -e "db.prepare('SELECT :a, :a').get({a:1})"`) confirmed node:sqlite handles repeated named parameters correctly, so the fallback path was dead code.
- **Fix:** Implemented the named-parameter binding directly without the try/catch fallback. The plan's recommended SQL is preserved verbatim; only the binding ceremony is simplified.
- **Files modified:** lib/core/navigation/neighborhood.cjs
- **Verification:** All 8 neighborhood tests GREEN; perf test GREEN within 1.4ms p95.
- **Committed in:** 4e43590 (Task 2 commit)

---

**Total deviations:** 1 simplification.
**Impact on plan:** Cleaner code path; no behavior change. The frozen edge weights, the recursive CTE shape, the cycle guard, and the closed 13-function surface all match the plan exactly.

## Issues Encountered

None. The plan was crisp; the recursive CTE pattern was thoroughly specified in RESEARCH section 2.1; the test fixture hand-tunes edge types to exercise each ranking band (CONTRADICTS > SUPPORTS > INFORMS at depth 1).

## Next Phase Readiness

- **Plan 109-05** can immediately replace 6 stubs (findContradictions, findUnsupportedClaims, findBlockingAssumptions, findStaleDecisions, findOpenQuestions, findRelevantOpportunities) by adding a `lib/core/navigation/insights.cjs` sibling and re-exporting from navigation.cjs.
- **Plan 109-06** can extend its pre-commit hook to enforce: any new file under `lib/` (excluding the allow-list: `lib/core/navigation/*`, `lib/core/navigation.cjs`, `lib/core/room-db.cjs`, `lib/core/lazygraph-ops.cjs`, `lib/core/memory-ops.cjs`, `lib/core/migrations/*`, `tests/*`, `scripts/migrate-*`) that imports from `lib/core/room-db.cjs` directly is rejected. The chokepoint surface is now stable.
- **Plan 109-07** can build the Brain Packet by composing getNeighborhood + findRecentChanges + the (yet-to-ship) findContradictions + findUnsupportedClaims; Canon Part 8 honored via `constraints: { privacy: 'no_raw_artifact_text' }` per CONTEXT D-06 sample shape.
- **Plan 109-09** can ship Room Home by wrapping getActiveFocus + getNeighborhood + (yet-to-ship) findContradictions + findOpenQuestions + findRecentChanges + findRelevantOpportunities.
- **Plan 109-10 acceptance test** can wire the fs proxy from tests/helpers/fs-instrument.cjs around the full navigation flow and assert ZERO non-SQLite filesystem reads.

## Self-Check: PASSED

Verifications performed:
- `[ -f lib/core/navigation/neighborhood.cjs ] && echo FOUND` -> FOUND
- `[ -f lib/core/navigation/transitions.cjs ] && echo FOUND` -> FOUND
- `[ -f lib/core/navigation.cjs ] && echo FOUND` -> FOUND
- `git log --oneline | grep bd3a895` -> FOUND (Task 1 RED tests)
- `git log --oneline | grep 4e43590` -> FOUND (Task 2 ship)
- `node tests/test-navigation-neighborhood.cjs` -> 8/8 PASS
- `node tests/test-navigation-perf-10k.cjs` -> cold 0.79ms / warm-p95 1.35ms / rss 59MB PASS
- `grep -lP "[\x{2014}\x{2013}]" <all-files>` -> exit 1 (no matches)
- Wave 1 sibling tests (focus 8/8, memory-events 9/9, migration backfill / coexistence / idempotent) -> all PASS

---
*Phase: 109-sql-context-memory-navigation-spine*
*Plan: 04*
*Completed: 2026-05-05*
