---
phase: 99-conversation-operator-state-machine
plan: "01"
subsystem: conversation-state
tags: [operator-state-machine, atomic-write, sqlite, canon-part-4, canon-part-7, canon-part-8]

# Dependency graph
requires:
  - phase: 95
    provides: scripts/post-write atomic write helper (mktemp + mv -f pattern reused in JS as mktemp + renameSync)
  - phase: 87
    provides: lib/core/lazygraph-ops.cjs node:sqlite DatabaseSync schema (nodes/edges tables)
  - phase: 88-10
    provides: lib/core/decision-capture.cjs typed-edge writer pattern (mirrored for OPERATOR_TRANSITION edges)
provides:
  - lib/conversation/operator.cjs (getCurrent / transition / validate API + 5 operators + 7 transition rules + atomic writes + OPERATOR_TRANSITION typed edges)
  - lib/conversation/ROOM.md (Decision #15 directory identity for the new conversation layer)
  - test/fixtures/conversation-operator/ (sibling fixture with cold-start + resume scenarios)
  - tests/test-operator-state.cjs (12-scenario validation suite registered in run-feynman-tests.cjs)
affects:
  - phase 99-02 (NL classifier consumes the OPERATORS / TRIGGERS / TRANSITION_RULES constants)
  - phase 99-03 (renderer integration contract reads operator state via getCurrent)
  - phase 99-04 (operator-aware hooks call transition() on PostToolUse / Stop)
  - phase 99-05 (/mos:operator command reads + writes via getCurrent / transition)
  - phase 100 jtbd-classifier (operator stratum-2 classifier input)
  - phase 102 render-v2 (render(zones, mode, operator, tier) signature)
  - phase 105 polling (drift class F operator-aware shape selection)

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies (Phase 87 invariant honored)
  patterns:
    - "Per-room state file at <roomDir>/.mindrian/<name>.json (extends Phase 95 last-cascade.json + Phase 100 jtbd-state.json convention)"
    - "Atomic JSON write via mktemp (crypto.randomBytes hex suffix) + fs.renameSync inside same dir for POSIX-atomic rename"
    - "Closed-vocabulary state machine: 5 operators + 7 rules + 8 triggers; rule.from === 'ANY' wildcard semantics; rule.to === 'previous' marker resolved post-validate"
    - "Typed graph edge mirror: every successful transition writes OPERATOR_TRANSITION edge to <roomDir>/.room-graph/room.db with idempotent INSERT OR IGNORE, graceful skip when DB absent (Decision #8)"
    - "schema_version-first key ordering on serialized JSON for forward-compatibility detection (D-06)"

key-files:
  created:
    - lib/conversation/operator.cjs (314 lines: 5 operators, 7 transition rules, 8 triggers, validate / getCurrent / transition + atomic write helper + OPERATOR_TRANSITION edge writer)
    - lib/conversation/ROOM.md (Decision #15 identity for new directory)
    - test/fixtures/conversation-operator/README.md (sibling fixture documentation)
    - test/fixtures/conversation-operator/seed-room/.room-root (cold-start sentinel)
    - test/fixtures/conversation-operator/seed-room/ROOM.md (cold-start identity)
    - test/fixtures/conversation-operator/seed-room/STATE.md (cold-start state stub)
    - test/fixtures/conversation-operator/seed-room/.mindrian/.gitkeep (empty directory marker)
    - test/fixtures/conversation-operator/seed-room-resume/.room-root (resume sentinel)
    - test/fixtures/conversation-operator/seed-room-resume/ROOM.md (resume identity)
    - test/fixtures/conversation-operator/seed-room-resume/STATE.md (resume state stub)
    - test/fixtures/conversation-operator/seed-room-resume/.mindrian/conversation-operator.json (current=BUILD_ROOM, previous=EXPLORE_CAPTURE, 3 history entries)
    - tests/test-operator-state.cjs (493 lines, 12 scenarios)
  modified:
    - lib/memory/run-feynman-tests.cjs (registered Phase 99-01 test entry)

key-decisions:
  - "Validate before resolve: validate() runs against the literal 'previous' marker (per D-08 rule table) before transition() resolves it to state.previous. Reverse order would prevent the rule from matching."
  - "Atomic write via mktemp + fs.renameSync in same directory: crypto.randomBytes hex suffix avoids exec(mktemp) call; same-dir rename guarantees POSIX-atomic semantics on the host filesystem."
  - "Graph edge graceful skip: if .room-graph/room.db is absent, the OPERATOR_TRANSITION write is silently skipped; the state file write still succeeds. Honors Decision #8 (Tier 0 fully functional)."
  - "Schema-version-first key ordering: every write serializes schema_version as the first top-level key so future format upgrades can detect old files via cheap line-prefix scan without full JSON parse."
  - "no-op rejection: same-operator transitions (e.g. JUST_TALK -> JUST_TALK) are rejected as wasted history slots. The 'ANY -> JUST_TALK' rule is for transitions FROM other operators, not self-transitions."

patterns-established:
  - "Operator state primitive: per-room JSON + atomic write + typed graph edge + graceful degradation. Phase 100 (jtbd-state.cjs scaffold) and Phase 103 (session-memory.json scaffold) MUST mirror this pattern."
  - "Sibling fixture for new abstraction layer: when a new fixture tests a different layer than an existing fixture, ship as a sibling under test/fixtures/. Phase 95.1-08 set this; Phase 99-01 confirms it."
  - "Internal _internal export for test access: production code uses the public API; tests reach _internal.statePath / defaultState / writeStateAtomic only when boundary behavior must be exercised directly."

requirements-completed:
  - OPERATOR-99-01-A
  - OPERATOR-99-01-B
  - OPERATOR-99-01-C
  - OPERATOR-99-01-D
  - OPERATOR-99-01-E
  - OPERATOR-99-01-F

# Metrics
duration: 6min
completed: 2026-05-01
---

# Phase 99 Plan 01: Operator State Schema + Storage Summary

**Per-room conversation operator state primitive with 5 canonical operators, 7 transition rules, atomic JSON writes, and OPERATOR_TRANSITION typed edges to the local graph -- the foundation every other Phase 99 / 100 / 102 / 105 plan reads against.**

## Performance

- **Duration:** ~6 minutes (333s wall clock from agent boot to final commit)
- **Started:** 2026-05-01T08:00:25Z
- **Completed:** 2026-05-01T08:05:58Z
- **Tasks:** 3 of 3 complete
- **Files created:** 12
- **Files modified:** 1
- **Test scenarios:** 12 of 12 GREEN

## Accomplishments

- Foundational state primitive shipped: every other Phase 99 plan, plus Phase 100 / 102 / 105 / Sprites Workspace v2.0, can now consume `lib/conversation/operator.cjs` as a stable read-against source of truth.
- Frame budget headroom is generous: getCurrent measured at ~0.007ms (vs 1ms target) and transition at ~0.18ms (vs 5ms target), leaving room for Phase 99-04 hook chaining and Phase 102 renderer composition.
- Canon Part 8 boundary preserved: zero Brain imports, zero Brain query strings, zero Brain side-channels. Local-only by construction, audited in-test (Scenario 10 grep).
- 12-scenario validation suite covers every dimension of 99-RESEARCH.md "Validation Architecture": Schema, Transitions, Atomic write, Cold-start, Frame budget, Canon Part 8, Graph edge, plus rollback and graceful-degradation paths the research document called out.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build lib/conversation/operator.cjs core module + ROOM.md** - `5370ade` (feat)
2. **Task 2: Create test/fixtures/conversation-operator/ sibling fixture** - `8021156` (test)
3. **Task 3: Write tests/test-operator-state.cjs and register in run-feynman-tests** - `c681698` (test)

The Task 3 commit also includes a Rule 1 bug fix in `lib/conversation/operator.cjs` (validate-vs-resolve order in `transition()`); see Deviations below.

## Files Created/Modified

### Production code

- `lib/conversation/operator.cjs` - state primitive with `getCurrent / transition / validate` public API, `OPERATORS / TRIGGERS / TRANSITION_RULES / SCHEMA_VERSION / HISTORY_MAX` constants, and an `_internal` namespace for test-only access to `statePath / defaultState / writeStateAtomic / writeOperatorTransitionEdge`.
- `lib/conversation/ROOM.md` - directory identity per Decision #15. Documents the 5-operator render contract table, the planned siblings (`classifier.cjs`, deferred `entity-signals.cjs`), and the Canon Part 8 LOCAL-ONLY boundary explicitly.

### Test infrastructure

- `tests/test-operator-state.cjs` - 12 IIFE-style scenarios with copy-fixture-to-tmpdir hygiene, fresh-require per test, and cleanup in `finally`. Frame-budget scenario uses `process.hrtime.bigint()` for nanosecond precision.
- `lib/memory/run-feynman-tests.cjs` - test registry extended with the new entry; long-form comment block documents the 12 scenario dimensions for future drift-detection sweeps.

### Fixtures

- `test/fixtures/conversation-operator/README.md` - documents the sibling-not-subdirectory pattern (Phase 95.1-08 precedent) and the cold-start + resume contract.
- `test/fixtures/conversation-operator/seed-room/` - cold-start fixture: `.mindrian/` exists with `.gitkeep` only; no operator state file.
- `test/fixtures/conversation-operator/seed-room-resume/` - resume fixture: pre-populated `.mindrian/conversation-operator.json` with `current=BUILD_ROOM, previous=EXPLORE_CAPTURE` and 3 history entries.

## Decisions Made

- **Validate before resolve.** The plan said to resolve `'previous'` and then validate. The rule table records `to: 'previous'` literally, so validating after resolution would prevent the `DECISION_GATE -> previous` rule from matching. Captured as a Rule 1 deviation (see below) and the operator now validates against the literal `to`, then resolves only if validation passes.
- **No auto-write on cold-start.** `getCurrent()` returns the JUST_TALK default purely in memory; the state file lands only on the first successful `transition()`. This matches the plan's explicit behavior block ("IN MEMORY ONLY. Cold-start MUST NOT auto-write the file") and Scenario 1 asserts the absence of the file after a cold-start read.
- **Schema-version-first key ordering** preserved across every `writeStateAtomic` call by serializing through a hand-ordered object (D-06).
- **node:sqlite over better-sqlite3.** Mirrors `lib/core/lazygraph-ops.cjs` and honors the Phase 87 zero-new-runtime-deps invariant. Node 22.22.2 confirms the experimental warning is benign here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Validate-vs-resolve order in transition()**

- **Found during:** Task 3 (Scenario 6 of the test suite -- DECISION_GATE -> previous)
- **Issue:** The plan's `transition()` step said to resolve `'previous'` to `state.previous` BEFORE calling `validate()`. The plan's `validate()` step says the rule table is checked literally, including `rule.to === 'previous'`. After resolution, validate received `to='BUILD_ROOM'` and the literal `'previous'` rule no longer matched -- so a legitimate DECISION_GATE -> previous transition was rejected.
- **Fix:** `transition()` now validates against the original (possibly literal `'previous'`) `to`, and resolves to `state.previous` only after validation passes. Scenario 6 of the test suite now passes; the change is byte-local to `transition()` and does not affect the `validate()` API contract.
- **Files modified:** `lib/conversation/operator.cjs` (transition function body)
- **Verification:** All 12 scenarios GREEN after the fix; Scenarios 4 (valid BUILD_ROOM -> METHODOLOGY) and 5 (invalid JUST_TALK -> METHODOLOGY) regression-checked to confirm no behavior change for non-`'previous'` transitions.
- **Committed in:** `c681698` (rolled into the Task 3 commit since the test that exposed the bug was authored in the same task)

**2. [Rule 3 - Blocking] .gitignore was silently dropping fixture state files**

- **Found during:** Self-Check after Task 3 (`git ls-files` showed only 7 of 11 fixture files committed).
- **Issue:** `.gitignore` line 18 (`.mindrian/`) is a repo-wide ignore that protects against committing room runtime data. It also silently dropped two deterministic fixture state files needed by the test suite: `test/fixtures/conversation-operator/seed-room/.mindrian/.gitkeep` and `test/fixtures/conversation-operator/seed-room-resume/.mindrian/conversation-operator.json`. On a fresh clone Scenario 2 (resume path) would fail because the operator JSON would be absent.
- **Fix:** Added 4 scoped negation rules to `.gitignore` so the two fixture paths are tracked while leaving the `.mindrian/` repo-wide ignore intact. Hook side-channel artifacts (auto-commit-throttle.json, last-cascade.json, pending-stamps/) emitted by the data-room post-write hook into the same fixture directories remain ignored, so the fixture stays deterministic.
- **Files modified:** `.gitignore` (added negation block + comment); `git add` of the two previously-ignored fixture files.
- **Verification:** `git ls-files test/fixtures/conversation-operator/` shows all 9 expected files; `node tests/test-operator-state.cjs` still 12/12 GREEN.
- **Committed in:** `a8c7019` (separate commit; this fix is structural and orthogonal to Task 3's content).

## Verification

All `<verification>` checks from the plan pass:

- `node -e "require('./lib/conversation/operator.cjs')"` exits 0
- `node tests/test-operator-state.cjs` exits 0 with `Phase 99-01 operator state: 12/12 GREEN`
- `grep -c "OPERATOR_TRANSITION" lib/conversation/operator.cjs` returns 3
- `grep -c "schema_version" lib/conversation/operator.cjs` returns 7
- Canon Part 8 grep audit: zero matches
- Both ROOM.md and fixture README exist
- Cold-start fixture has empty `.mindrian/`; resume fixture has 3 history entries
- Sibling layout confirmed: `test/fixtures/cascade-surface-e2e/` and `test/fixtures/conversation-operator/` both exist; neither nested under the other.

## Self-Check: PASSED

- `lib/conversation/operator.cjs` -- FOUND
- `lib/conversation/ROOM.md` -- FOUND
- `test/fixtures/conversation-operator/README.md` -- FOUND
- `test/fixtures/conversation-operator/seed-room/.room-root` -- FOUND
- `test/fixtures/conversation-operator/seed-room/ROOM.md` -- FOUND
- `test/fixtures/conversation-operator/seed-room/STATE.md` -- FOUND
- `test/fixtures/conversation-operator/seed-room/.mindrian/.gitkeep` -- FOUND
- `test/fixtures/conversation-operator/seed-room-resume/.room-root` -- FOUND
- `test/fixtures/conversation-operator/seed-room-resume/ROOM.md` -- FOUND
- `test/fixtures/conversation-operator/seed-room-resume/STATE.md` -- FOUND
- `test/fixtures/conversation-operator/seed-room-resume/.mindrian/conversation-operator.json` -- FOUND
- `tests/test-operator-state.cjs` -- FOUND
- Commit `5370ade` -- FOUND
- Commit `8021156` -- FOUND
- Commit `c681698` -- FOUND
