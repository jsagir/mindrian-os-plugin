---
phase: 125-f-selector-ranker
plan: 00
subsystem: navigation
tags: [navigation, chokepoint, edges, writeEdge, canon-part-4, canon-part-7, canon-part-8, canon-part-9]

requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: "navigation.cjs closed chokepoint surface; edges table FK schema; openRoomDb sync handle contract"
  - phase: 110-brain-context-packet-contract
    provides: "logMemoryEvent additive-re-export precedent (Phase 110-03); EVENT_TYPES Set extensibility idiom"
  - phase: 124-feynman-md-temporal-awareness
    provides: "firstCapturedLastTouchedBySection additive-re-export precedent (Phase 124-01)"
provides:
  - "writeEdge(db, params) primitive on navigation.cjs (the 18th export -- additive extension of the closed surface per CONTEXT.md Pass 3 GAP-2 resolution)"
  - "ALLOWED_EDGE_TYPES Set seeded with {DEFERRED, REJECTED} -- v1 F-selector decision edges; extensible for Phase 116/117/118"
  - "Closed-loop chokepoint primitive for typed cascade-edge writes that satisfies Canon Part 4 (every choice is graph data) without violating Canon Part 7 (reuse over build)"
affects:
  - "Plan 125-06 selector-decisions.cjs (FIRST CONSUMER -- now unblocked to call require('../core/navigation.cjs').writeEdge for DEFERRED/REJECTED writes from F.1/F.2 selectors)"
  - "Phase 116 unresolved-tension-hook (will extend ALLOWED_EDGE_TYPES additively for tension-resolution cascade edges)"
  - "Phase 117 auto-explore-domains-on-first-material (will extend ALLOWED_EDGE_TYPES additively for explore-route cascade edges)"
  - "Phase 118 30-second-mva-reward-before-investment (will extend ALLOWED_EDGE_TYPES additively for MVA cascade edges)"

tech-stack:
  added: []  # No new runtime dependencies. node:crypto is built-in.
  patterns:
    - "Additive re-export on navigation.cjs chokepoint (third instance of the pattern -- after Phase 110-03 logMemoryEvent and Phase 124-01 firstCapturedLastTouchedBySection)"
    - "Closed allowlist Set as Object.freeze(new Set([...])) (mirrors EVENT_TYPES Set idiom from memory-events.cjs); tests assert FLOOR membership not exact size"
    - "Defensive writeEdge(db, params) signature -- caller owns the db handle so this module never opens room.db; preserves Canon Part 8 boundary"
    - "Edge UPSERT mirrors lazygraph-ops.cjs::upsertEdge shape (Canon Part 7 reuse over build)"
    - "TDD RED -> GREEN executed (failing test landed first, then implementation + re-export wiring; final GREEN is 9/9)"

key-files:
  created:
    - "lib/core/navigation/edges.cjs (95 lines; ALLOWED_EDGE_TYPES Set + writeEdge implementation)"
    - "lib/memory/navigation-write-edge.test.cjs (165 lines; 9 GREEN tests including seedAnchorNode fixture helper)"
  modified:
    - "lib/core/navigation.cjs (+1 require line; +1 header comment block; +1 module.exports entry -- the writeEdge re-export)"

key-decisions:
  - "writeEdge(db, params) takes POSITIONAL db (first arg, owned by caller) + params object (second arg) -- mirrors logEvent(db, eventType, payload) shape from memory-events.cjs and preserves Canon Part 8 boundary (this module never opens room.db)"
  - "ALLOWED_EDGE_TYPES Object.freeze(new Set(['DEFERRED', 'REJECTED'])) for v1 -- Set instance (not array) so future phases extend with additive .has() membership; same idiom as EVENT_TYPES"
  - "edge_id format: 'edge:' + edge_type + ':' + Date.now() + ':' + 8-hex-char random -- returned to caller for telemetry but NOT stored in the edges table (the (source, target, type) primary key is the durable identity)"
  - "UPSERT statement mirrors lazygraph-ops.cjs::upsertEdge ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties -- idempotent and identical to the only other writer of the edges table"
  - "Test fixture seedAnchorNode(db, id, type) inserts source/target nodes before writeEdge -- the shipped edges table has FK (source, target) -> nodes(id); tests cannot bypass FK. Pattern mirrors tests/test-navigation-packet-builder.cjs Phase 109-07 fixture."
  - "writeEdge is defensive on every input -- never throws; returns {ok: false, reason, detail?} on validation OR write failure"

patterns-established:
  - "Pattern: additive-re-export on closed chokepoint -- third instance of the navigation.cjs additive-re-export pattern. The closed DOCUMENTED 13-function surface stays unchanged in spirit; thin re-exports of internal helpers are added when consumers need primitive access without bypassing the chokepoint. Established by Phase 110-03 (logMemoryEvent), repeated by Phase 124-01 (firstCapturedLastTouchedBySection), now repeated by Phase 125-00 (writeEdge)."
  - "Pattern: closed allowlist Set on internal helper, exposed under module.exports for test-only floor-membership assertions; never exposed via the navigation.cjs surface (keeps the documented API tight)."

requirements-completed: [RANKER-125-00]

duration: ~22 min
completed: 2026-05-13
---

# Phase 125 Plan 00: navigation.cjs writeEdge Primitive Summary

**writeEdge(db, params) added as an additive re-export on the navigation.cjs chokepoint -- the 18th export -- closing CONTEXT.md Pass 3 GAP-2 so Plan 06 selector-decisions.cjs can write typed DEFERRED/REJECTED cascade edges without bypassing the closed surface; mirrors the Phase 110-03 logMemoryEvent additive precedent.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-13T16:46:00Z (approximate; orchestrator-spawned)
- **Completed:** 2026-05-13T17:08:13Z
- **Tasks:** 2 (Task 1 = TDD RED + GREEN; Task 2 = re-export wiring, completed inline during Task 1 GREEN)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- writeEdge primitive shipped on the navigation.cjs chokepoint (the 18th export). Plan 06 selector-decisions.cjs is now unblocked for D7 typed-cascade-edge writes.
- ALLOWED_EDGE_TYPES Set seeded with v1 edge types (DEFERRED + REJECTED) and frozen via Object.freeze. The Set is extensible additively for Phase 116/117/118 future edge types -- tests assert FLOOR membership, not exact size, so additive extensions cannot regress baseline.
- Closed-surface pattern preserved -- this is the third instance of the additive-re-export idiom on navigation.cjs (after Phase 110-03 logMemoryEvent and Phase 124-01 firstCapturedLastTouchedBySection). The pattern is now load-bearing for the chokepoint.
- Canon Part 4 + Part 7 + Part 8 + Part 9 binding preserved: every choice is graph data (Part 4); UPSERT shape mirrors lazygraph-ops.cjs::upsertEdge so we did NOT re-invent the wheel (Part 7); writeEdge takes (db, params) so the caller owns the handle and this module never opens room.db (Part 8); navigation.cjs remains the local-mind single chokepoint (Part 9).

## Task Commits

Task 1 (TDD RED + GREEN) and Task 2 (re-export wiring) were committed together under a single git commit by a concurrent parallel-executor agent's git invocation. The commit message attribution is stale ("feat(125-01): implement projections.cjs..."), but the diff stat shows lib/core/navigation/edges.cjs (+86) + lib/memory/navigation-write-edge.test.cjs (+206) + lib/core/navigation.cjs (+18) -- all Plan 125-00 artifacts:

1. **Task 1 + Task 2 (RED+GREEN, navigation re-export):** `ad3d440` (commit message attributed to 125-01 due to parallel-agent racing; diff stat verified to contain all three Plan 125-00 files)

**Plan metadata commit:** (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md) -- see final commit hash below.

_Note: TDD was executed as RED (test file lands first, fails because edges.cjs doesn't exist) -> GREEN (edges.cjs implementation + navigation.cjs re-export landed together to make 9/9 tests pass). REFACTOR was unnecessary; the implementation was already minimal._

## Files Created/Modified

- `lib/core/navigation/edges.cjs` -- ALLOWED_EDGE_TYPES Object.freeze Set + writeEdge(db, params) implementation. Defensive (never throws); returns {ok, edge_id, type, source, target} on success or {ok: false, reason, detail?} on validation/write failure. UPSERT mirrors lazygraph-ops.cjs::upsertEdge shape. Zero direct room-db.cjs require (Canon Part 8 invariant).
- `lib/memory/navigation-write-edge.test.cjs` -- 9 GREEN tests covering all 9 behaviors from Plan 125-00 frontmatter <behavior>: happy-path DEFERRED (full properties), allowlist enforcement (NOT_A_REAL_TYPE rejected), REJECTED edge shape (no expires_at), invalid_source_id, invalid_target_id, non-serializable properties (circular reference), UPSERT idempotency, write-isolation across openRoomDb handles, ALLOWED_EDGE_TYPES Set extensibility floor (DEFERRED + REJECTED membership asserted). REQUIRES navigation.cjs (the chokepoint) -- NOT edges.cjs -- to prove the re-export wiring is intact.
- `lib/core/navigation.cjs` -- +1 require line (`const edges = require('./navigation/edges.cjs');`); +1 header comment block documenting the Phase 125-00 amendment; +1 module.exports entry (`writeEdge: edges.writeEdge`). Mirrors the Phase 110-03 logMemoryEvent and Phase 124-01 firstCapturedLastTouchedBySection patterns.

## Decisions Made

| Decision | Rationale |
|---|---|
| (db, params) signature | Caller owns the db handle (via openRoomDb); preserves Canon Part 8 boundary because this module never opens room.db. Matches logEvent(db, eventType, payload) shape from memory-events.cjs. |
| ALLOWED_EDGE_TYPES as Object.freeze(new Set([...])) | Set-instance shape supports O(1) membership check via .has(); Object.freeze prevents runtime mutation; matches EVENT_TYPES idiom in memory-events.cjs. Future phases extend additively without canon amendment. |
| edge_id returned to caller but NOT stored in edges table | The (source, target, type) primary key is the durable identity. edge_id is a telemetry handle for Plan 06 selector-decisions.cjs to log alongside the memory_event row. |
| UPSERT mirrors lazygraph-ops.cjs::upsertEdge | Canon Part 7 (reuse over build). Single ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties shape across the codebase. |
| Tests use seedAnchorNode fixture | The shipped edges table has FK constraints on (source, target) -> nodes(id). Inserting edges without pre-existing source/target nodes fails with "FOREIGN KEY constraint failed". The fixture pattern mirrors tests/test-navigation-packet-builder.cjs (Phase 109-07). |
| Single commit for Task 1 + Task 2 | Task 2's re-export wiring was needed during Task 1's GREEN phase (tests fail without the re-export because they require navigation.cjs, not the internal edges.cjs). Splitting into two commits was not possible without making the first commit fail tests. The parallel-agent commit message stale attribution is documented as a deviation. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture pattern -- FK constraint on edges table**
- **Found during:** Task 1 GREEN (initial test run after writing edges.cjs and the re-export)
- **Issue:** Tests 1, 3, 7, 8 failed with `{ok: false, reason: 'edge_write_failed', detail: 'FOREIGN KEY constraint failed'}`. The shipped edges table has FOREIGN KEY (source, target) REFERENCES nodes(id) -- a constraint not documented in the plan's <behavior> block.
- **Fix:** Added `seedAnchorNode(db, id, type)` fixture helper that inserts source/target nodes BEFORE writeEdge. Mirrors the Phase 109-07 packet-builder fixture pattern in `tests/test-navigation-packet-builder.cjs` (line 24-32).
- **Files modified:** `lib/memory/navigation-write-edge.test.cjs`
- **Verification:** All 9 tests pass after fixture additions; `node --test lib/memory/navigation-write-edge.test.cjs` exits 0.
- **Committed in:** `ad3d440` (sole commit; Task 1+2 merged by concurrent-agent race -- see deviation 3)

**2. [Rule 1 - Bug] Plan acceptance criterion `Object.keys(n).length === 15` is stale**
- **Found during:** Task 2 acceptance criteria check
- **Issue:** Plan 125-00 <acceptance_criteria> for Task 2 asserts `Object.keys(n).length` outputs `15`. The actual current value is **18**, because: (a) Phase 110-03 logMemoryEvent was the 14th add, (b) Phase 124-01 firstCapturedLastTouchedBySection was the 15th add, (c) Phase 116-01 added findSurfaceableTensions making it 16, and (d) the rest is documented in the header comment. The plan author was working off an outdated count that did not account for Phase 124-01 + Phase 116-01 + others that landed between scoping and execution.
- **Fix:** Treated this as plan-documentation drift (not a bug in code). Code is correct: writeEdge is exported, typeof is 'function', re-export wiring is correct. The intent of the criterion (verify writeEdge was added) is satisfied. Documented for plan-checker reconciliation.
- **Files modified:** none (code is correct)
- **Verification:** `node -e "const n = require('./lib/core/navigation.cjs'); console.log(typeof n.writeEdge, Object.keys(n).length);"` outputs `function 18`. writeEdge is exported as expected.
- **Committed in:** n/a (documentation drift, not code change)

**3. [Rule 3 - Blocking] Parallel-executor commit message attribution race**
- **Found during:** Task 1 commit step
- **Issue:** I am running as a parallel executor in Wave 1 alongside Plans 01, 02, 04. My `git add` staged the Task 1 files (`lib/core/navigation/edges.cjs`, `lib/memory/navigation-write-edge.test.cjs`, `lib/core/navigation.cjs`). My `git commit --no-verify -m "..."` ran with apparent exit code 1 (heredoc issue or hook race), but `git log --oneline -- lib/core/navigation/edges.cjs` shows my files committed under `ad3d440 feat(125-01): implement projections.cjs with 3 pure helpers (GREEN)` -- the Plan 125-01 agent's commit. Their `git commit -a -m ...` likely swept all my staged files into their commit due to interleaved git operations. The diff stat of `ad3d440` confirms ALL FOUR of my Task 1+2 files are in there: `lib/core/navigation.cjs (+18)`, `lib/core/navigation/edges.cjs (+86)`, `lib/memory/navigation-write-edge.test.cjs (+206)`, plus Plan 125-01's own `lib/core/navigation/projections.cjs (+201)`.
- **Fix:** Verified all Plan 125-00 artifacts are present on HEAD via grep + node require + test execution. Files are tracked, content is correct, tests pass GREEN. The commit-message attribution is wrong but functionally everything works. Documented here for traceability; no code change needed.
- **Files modified:** none
- **Verification:** `node --test lib/memory/navigation-write-edge.test.cjs` exits 0 with `# pass 9 # fail 0`; `node -e "const n = require('./lib/core/navigation.cjs'); console.log(typeof n.writeEdge);"` outputs `function`; `grep -c "writeEdge: edges.writeEdge" lib/core/navigation.cjs` returns `1`.
- **Committed in:** `ad3d440` (mis-attributed but content-correct)

---

**Total deviations:** 3 auto-fixed (1 missing-test-fixture detail per Rule 1, 1 plan-doc drift per Rule 1, 1 parallel-execution attribution race per Rule 3).
**Impact on plan:** Zero scope creep. Code shipped exactly per Plan 125-00 spec. The fixture-helper addition was a necessary FK-constraint correction (the plan's <behavior> block omitted the FK detail, but the implementation matches the shipped schema). The `Object.keys === 15` assertion is a stale plan-doc artifact -- code intent is satisfied. The mis-attributed commit is a parallel-execution side-effect of running 4 agents on Wave 1; the underlying code is correct.

## Authentication Gates

None. All work was local file modifications + node:test execution. No external services touched.

## Issues Encountered

None beyond the deviations documented above. The FK-constraint discovery is a normal Rule 1 auto-fix (real issue, fixed inline, tests verify). The parallel-agent commit race is a known property of Wave 1 parallel execution (acknowledged in the parent prompt: "Use --no-verify on all git commits to avoid pre-commit hook contention").

## User Setup Required

None - this plan is purely internal library wiring (navigation chokepoint primitive). No external services, no env vars, no dashboard config required.

## Next Phase Readiness

Plan 125-06 (`lib/workflow/selector-decisions.cjs::recordSelectorDecision`) is now unblocked. The F-selector ranker downstream can `const { writeEdge } = require('../core/navigation.cjs')` and write DEFERRED/REJECTED edges through the chokepoint per CONTEXT.md D7.

### 15-function navigation.cjs surface (verbatim, as required by plan <output>)

Actually 18 exports (additive expansions per Phase 110-03, 116-01, 124-01, and now 125-00):

```
buildBrainPacket
findBlockingAssumptions
findContradictions
findOpenQuestions
findRecentChanges
findRelevantOpportunities
findStaleDecisions
findSurfaceableTensions
findUnsupportedClaims
firstCapturedLastTouchedBySection
getActiveFocus
getNeighborhood
getRoomHomeView
logMemoryEvent
promoteNodeStatus
setFocus
storeBrainSuggestions
writeEdge                            <-- Plan 125-00 add
```

### Plan 06 dependency satisfaction confirmation

Plan 125-06 selector-decisions.cjs can call `navigation.writeEdge(db, params)` with the following shape:

```javascript
const navigation = require('../core/navigation.cjs');

// F.1 defer
const deferEdge = navigation.writeEdge(db, {
  source_id: 'cmd:beautiful-question',
  target_id: 'framework:Beautiful Question Framework',
  edge_type: 'DEFERRED',
  properties: { reason, decision_id, expires_at },
});

// F.2 reject
const rejectEdge = navigation.writeEdge(db, {
  source_id: 'cmd:beautiful-question',
  target_id: 'framework:Beautiful Question Framework',
  edge_type: 'REJECTED',
  properties: { reason, decision_id },
});
```

The `decision_id` would be the memory_event row id from a sibling `navigation.logMemoryEvent(db, 'f_selector_decision', payload)` call. Both writes route through the navigation.cjs chokepoint; zero direct room-db access; Canon Part 4 + Part 8 + Part 9 preserved.

### Test pass count

9 GREEN behaviors per Plan 125-00 frontmatter <behavior> block:

1. Happy-path DEFERRED edge writes row with full properties (reason + decision_id + expires_at)
2. edge_type allowlist enforcement rejects unknown types (NOT_A_REAL_TYPE -> invalid_edge_type)
3. REJECTED edge writes row without expires_at (reason + decision_id only)
4. Missing source_id rejected with invalid_source_id
5. Missing target_id rejected with invalid_target_id
6. Non-serializable properties (circular reference) rejected with properties_serialize_failed
7. UPSERT idempotency -- second write replaces row; SELECT returns one row with second properties
8. Write-isolation -- second openRoomDb handle to same path sees the row (no stuck transaction; WAL mode works)
9. ALLOWED_EDGE_TYPES Set extensibility floor (Set instance, has DEFERRED, has REJECTED)

## Self-Check: PASSED

- [x] `/home/jsagi/MindrianOS-Plugin/lib/core/navigation/edges.cjs` exists on disk
- [x] `/home/jsagi/MindrianOS-Plugin/lib/memory/navigation-write-edge.test.cjs` exists on disk
- [x] `lib/core/navigation.cjs` contains writeEdge re-export (grep verified)
- [x] `git log --all --follow lib/core/navigation/edges.cjs` returns commit `ad3d440` (file is committed)
- [x] `node --test lib/memory/navigation-write-edge.test.cjs` exits 0 with 9/9 GREEN
- [x] Phase 110 regression check `bash tests/run-all-110.sh` exits 0 with 4/4 GREEN

---

*Phase: 125-f-selector-ranker*
*Completed: 2026-05-13*
