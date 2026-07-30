---
phase: 240-memory
plan: 05
subsystem: testing
tags: [jtbd, memory-cortex, room-db, rebuild-graph, mutation-testing, canon-part-8]

# Dependency graph
requires:
  - phase: 240-03
    provides: "current.turn_count and current.manual_set persisted by jtbd-state.cjs::setCurrent, the real setCurrent -> getCurrent round trip this plan's promote leg drives through instead of a hand-fed literal"
  - phase: 236-memory (via tests/helpers/fixture-room-236.cjs and lib/core/lazygraph-ops.cjs)
    provides: "the INDEXER_OWNED_NODE_TYPES allowlist and rebuildGraph's scoped DELETE that already made memory_event survivable; this plan pins that survival for the specific jtbd_transitioned row rather than building new production code"
provides:
  - "tests/test-240-jtbd-event-survives-rebuild.cjs: the regression gate joining the promote/park/complete write path (tests/test-jtbd-transition-graph-wiring.cjs) to the rebuild-survival path (tests/test-236-rebuild-preserves-journal.cjs), which no existing test connected before this plan"
  - "A live-executed, in-file-recorded mutation proof distinguishing the correct mutation (widen INDEXER_OWNED_NODE_TYPES) from the tempting-but-wrong one (remove the transaction wrap)"
affects: [240-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MUTATIONS RUN header block (test-236-rebuild-preserves-journal.cjs precedent): both an executed-correct and an executed-wrong mutation outcome recorded inside the test file's own header, so a future reader inherits the finding without reading a SUMMARY"
    - "Fixture self-check that throws a labelled FIXTURE error (not a silent pass) when a registry-registration trap would otherwise let every scenario pass over zero rows"
    - "Exact-row-count assertions (not at-least-one) paired with an explicit dedupe-window scenario, so the exact counts are proven meaningful rather than an artifact of calling each writer once"

key-files:
  created:
    - tests/test-240-jtbd-event-survives-rebuild.cjs
  modified: []

key-decisions:
  - "This plan writes ZERO production code by design (locked navigator decision D-1). The RCA's fix already shipped in commit 3c9afa2e; this plan's entire job is the regression gate joining two already-covered paths, confirmed at the end via git diff --quiet lib/ scripts/."
  - "The mutation is worded as widening INDEXER_OWNED_NODE_TYPES to include 'memory_event', never as removing the BEGIN/COMMIT/ROLLBACK transaction wrap. Both were executed live in Task 2 specifically to prove this distinction empirically rather than assert it from the plan text alone."
  - "No drainer was built and no assertion checks that graph-edge-pending.log shrinks. Scenario 5 asserts only that the file is never re-created, explicitly labelled a weak signal in the test's own comments, deferring the load-bearing claims to scenarios 1 and 3."

requirements-completed: [MEM-02]

# Metrics
duration: ~55min
completed: 2026-07-30
---

# Phase 240 Plan 05: MEM-02 Rebuild-Survival Join Test Summary

**Built the one test that joins the already-shipped promote/park/complete write path to the already-shipped rebuild-survival path, closed the registry/dedupe/hand-fed-state traps as pinned assertions, and executed both mutations live with the findings recorded inside the test file's own header.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-30 (session start)
- **Completed:** 2026-07-30
- **Tasks:** 2/2
- **Files modified:** 1 (created then extended: tests/test-240-jtbd-event-survives-rebuild.cjs)

## Accomplishments

- `tests/test-240-jtbd-event-survives-rebuild.cjs` (527 lines) joins `tests/test-jtbd-transition-graph-wiring.cjs` (proves the write) to `tests/test-236-rebuild-preserves-journal.cjs` (proves generic survival), a connection 240-VALIDATION.md row `240-04-01` explicitly named as missing.
- Six scenarios against one shared fixture room: exact-one-row-per-kind, the 60 second dedupe window proven real, byte-identical survival of all three lifecycle rows plus the whole 236 fixture population across a real `rebuildGraph`, non-vacuity (`artifacts: 3 > 0`), the dead-letter file never re-created, and Canon Part 8 scalar-only payload discipline with a ROOM.md prose canary.
- Trap A (registry) proven to bite live: temporarily disabling the `.rooms/registry.json` write produced a labelled `FIXTURE ERROR (Trap A, T-240-32)`, not a silent pass; restored and re-confirmed green.
- Mutation A (correct: widen `INDEXER_OWNED_NODE_TYPES`) executed live, turned scenario 3 red, also reddened `test-236-rebuild-preserves-journal.cjs`'s own scenario 1, reverted, both re-confirmed green.
- Mutation B (wrong: remove the transaction wrap, run as a deliberate counter-demonstration) executed live, stayed fully GREEN, empirically confirming ROADMAP SC2's "riding Phase 236's transaction wrap" phrasing does not describe what protects these rows. Reverted.
- Both mutation outcomes recorded inside the test file's own `MUTATIONS RUN` header block, matching the `tests/test-236-rebuild-preserves-journal.cjs` precedent.
- Zero production code changed: `git diff --quiet lib/ scripts/` confirmed clean at the end of both tasks; `scripts/hsi-to-graph.cjs` (Phase 242 / MOAT-01 territory) has an empty diff.

## Task Commits

1. **Task 1: Join the promote path to the rebuild-survival path, reusing the Phase 236 fixture** - `dfc54cc6` (test)
2. **Task 2: Execute the correct mutation, and record the WRONG one staying green as a deliberate counter-demonstration** - `90107936` (test)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode excludes STATE.md/ROADMAP.md from this agent's commits).

## Files Created/Modified

- `tests/test-240-jtbd-event-survives-rebuild.cjs` - new file (527 lines). Header documents what it answers, why it exists alongside two passing suites, the mutation wording warning, what is deliberately absent (no drainer), the three traps closed, and (added by Task 2) the `MUTATIONS RUN` block recording both live mutation outcomes. Body: harness (`ok`/`fail`/`async scenario`), `makeScratchDir`/`rmrf`/`runRebuild`/`withOpenRoom` copied structurally from `tests/test-236-rebuild-preserves-journal.cjs`, `withJoinedFixture` (the registry-writing, self-checking, canary-seeding fixture wrapper), `readTransitions` reader, and six scenarios sharing one fixture room.

## Verification Transcripts

### Full test run (6/6, final state)

```
Phase 240-05: MEM-02 SC2 join test (promote/park/complete path -> rebuild-survival path)

  ok 1. promote, park and complete each write exactly one real jtbd_transitioned row
  ok 2. the 60 second dedupe window is real, converting Trap B into a pinned property
  ok 3. THE JOIN: all three rows and the whole irreplaceable population survive a real rebuildGraph
  ok 4. NON-VACUITY: the rebuild in scenario 3 did real work, so survival is not survival-by-doing-nothing
  ok 5. the retired graph-edge-pending.log dead-letter file is never re-created; jtbd-history.json IS written
  ok 6. Canon Part 8: the three payloads carry only scalars and enum handles, and the ROOM.md canary never leaks

  passed: 6  failed: 0
```

### Fixture self-check proven to bite (Trap A, T-240-32)

Registry write temporarily disabled:

```
FIXTURE ERROR (Trap A, T-240-32): resolveRoomDirForSlug('fixture-236') returned null,
expected "/tmp/mos-240-survive-7gSYz4/room". The .rooms/registry.json write is missing
or wrong, so every scenario below would silently pass over zero jtbd_transitioned rows
because logGraphTransition degrades to a graceful no-op on an unregistered room.
```

exit code 1, no silent pass. Restored; `diff` against the pre-edit backup confirmed byte-identical restoration; re-run confirmed 6/6 green again.

### Scenario 3 raw-comparison discipline

`readNodeRow` (raw `properties` string, never re-parsed) is used for every survival comparison in scenario 3; the only `JSON.parse` call in the file is inside scenario 6, which runs strictly after the byte comparisons in scenario 3 have already completed.

### Scenario 4 non-vacuity: observed artifacts count

Instrumented standalone run against a fresh fixture (`artifactCount: 3`):

```
rebuildGraph result: {"success":true,"artifacts":3,"sections":1,"subRooms":0}
```

`3 > 0`, matching the fixture's `artifactCount`.

### Scenario 6 canary: marker string, confirmed absent from all three blobs

```
CANARY-240-05-9F2E1C-ROOM-PROSE-MUST-NOT-EGRESS
```

Seeded into the fixture room's `ROOM.md` before any lifecycle call; scenario 6 asserts `row.properties.indexOf(CANARY) === -1` for all three raw blobs (promote, park, complete) and passed.

### `promoteIfEligible` call-site audit (acceptance criterion: state the audited count)

2 call sites in the file (scenario 1 and scenario 2), both passing `current: cur` where `cur = jtbdState.getCurrent(fx.roomDir)`. Zero hand-constructed literals.

```
grep -n "promoteIfEligible(" tests/test-240-jtbd-event-survives-rebuild.cjs
263:        const promoteResult = mem.promoteIfEligible('fixture-236', {
321:        const repeatResult = mem.promoteIfEligible('fixture-236', {
```

### Mutation A (correct): live execution

`lib/core/lazygraph-ops.cjs:81` changed to `Object.freeze(['Artifact', 'Section', 'memory_event'])`:

```
FAIL 3. THE JOIN: all three rows and the whole irreplaceable population survive a real rebuildGraph
    AssertionError [ERR_ASSERTION]: promote jtbd_transitioned row
    memory_event:jtbd_transitioned:1785425367860:8c1174b2 was DESTROYED by the rebuild
  passed: 5  failed: 1
```

`tests/test-236-rebuild-preserves-journal.cjs` under the same mutation:

```
FAIL 1. memory_event survives the rebuild with a byte-identical properties blob
    AssertionError [ERR_ASSERTION]: memory_event memory_event:node_created:1785425378469:c27c8a00
    was DESTROYED by the rebuild (the GRAPHDB-01 data-loss defect...)
  passed: 4  failed: 1
```

Both files guard the same allowlist from different rows, confirming Task 2's read_first expectation. Reverted; `git diff --quiet lib/core/lazygraph-ops.cjs` confirmed clean; both suites re-confirmed green (6/6 and 5/5 respectively).

### Mutation B (wrong, deliberate counter-demonstration): live execution

`rebuildGraph`'s `BEGIN` (line 668) and `COMMIT` (line 743) commented out, `ROLLBACK` left syntactically valid:

```
Phase 240-05: MEM-02 SC2 join test (promote/park/complete path -> rebuild-survival path)

  ok 1. promote, park and complete each write exactly one real jtbd_transitioned row
  ok 2. the 60 second dedupe window is real, converting Trap B into a pinned property
  ok 3. THE JOIN: all three rows and the whole irreplaceable population survive a real rebuildGraph
  ok 4. NON-VACUITY: the rebuild in scenario 3 did real work, so survival is not survival-by-doing-nothing
  ok 5. the retired graph-edge-pending.log dead-letter file is never re-created; jtbd-history.json IS written
  ok 6. Canon Part 8: the three payloads carry only scalars and enum handles, and the ROOM.md canary never leaks

  passed: 6  failed: 0
```

Stayed fully GREEN, matching the plan's expected finding: the transaction-wrap phrasing does not describe what protects these rows. Reverted; `git diff --quiet lib/core/lazygraph-ops.cjs` confirmed clean.

### Production tree byte-clean, Phase 242 disjoint

```
git diff --quiet lib/ scripts/           -> clean (exit 0)
git diff --stat scripts/hsi-to-graph.cjs -> (empty)
git status --short tests/helpers/        -> (empty; no new fixture helper)
grep -cP '\x{2014}' tests/test-240-jtbd-event-survives-rebuild.cjs -> 0
```

### MEM-02 regression set (all green)

```
bash tests/run-all-236.sh                        -> Phase 236: PASS=12 FAIL=0 SKIP=0
node tests/test-jtbd-transition-graph-wiring.cjs -> 14 passed, 0 failed
node tests/test-129-spine-substrate.cjs          -> 15 passed, 0 failed (of 15)
node tests/test-navigation-memory-events.cjs     -> test-navigation-memory-events: 10/10 passed
node tests/test-150-memory-nodes.cjs             -> all assertions passed
node tests/test-150-brain-egress.cjs             -> PASS (MEM-04: zero memory cortex prose in the Brain packet)
```

### `bash tests/run-all-240.sh` -- discovered set recorded exactly (240-04 not landed in this worktree)

Per the acceptance criteria: this parallel-execution worktree does not contain plan 240-04's files (`tests/test-240-jtbd-continuous-promotion.cjs`), which lands from a sibling worktree in the same wave. Recording the exact discovered set rather than rounding to green:

```
--- test-240-jtbd-event-survives-rebuild.cjs ---
>>> test-240-jtbd-event-survives-rebuild.cjs: PASSED
--- test-240-jtbd-manual-override-roundtrip.cjs ---
>>> test-240-jtbd-manual-override-roundtrip.cjs: PASSED
--- test-240-memory-store-hermetic-fence.sh ---
>>> test-240-memory-store-hermetic-fence.sh: PASSED
--- tri-polar parity self-test: the gate actually bites ---
>>> tri-polar parity self-test: the gate actually bites: PASSED
--- tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger ---
>>> tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger: PASSED
======================================
Phase 240: PASS=5 FAIL=0 SKIP=0
======================================
```

The orchestrator should re-run `bash tests/run-all-240.sh` after merge, once 240-04's files land, to confirm the file discovers 4 `tests/test-240-*` files total.

### Hermeticity: real `$HOME/MindrianRooms` `.memory` and `.rooms` byte-identical before/after

Measured around the full regression sweep (both mutations, the standalone artifacts-count probe, `run-all-236.sh`, `run-all-240.sh`, and all five additional regression suites):

```
diff /tmp/mem-final-before.txt /tmp/mem-final-after.txt   -> (empty diff) MEM UNCHANGED
diff /tmp/rooms-final-before.txt /tmp/rooms-final-after.txt -> (empty diff) ROOMS UNCHANGED
```

## Decisions Made

- This plan writes zero production code by design (locked navigator decision D-1, confirmed in the plan's own objective). Every source-touching step in this plan was a temporary, fully-reverted mutation probe, never a committed change to `lib/` or `scripts/`.
- The `MUTATIONS RUN` block was appended to the test file's header exactly once, in Task 2, per the plan's explicit instruction that this is the only edit Task 2 makes to the test file.
- Scenario 5's dead-letter-file-absence assertion is explicitly labelled a weak signal inside the test's own comments (mirroring `tests/test-jtbd-transition-graph-wiring.cjs` test 6's framing), so a future reader does not mistake it for the load-bearing claim; scenarios 1 and 3 carry that weight.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' actions, verification commands, and acceptance criteria were followed as specified; both mutation outcomes matched the plan's stated predictions (Mutation A reddens scenario 3 and also the 236 sibling; Mutation B stays green).

## Issues Encountered

None. The `bash tests/run-all-240.sh` PASS count (5, not the eventual 4-file wave total) is a wave-merge timing property of parallel execution across two worktrees, not a defect in this plan's work; it is documented above per the plan's own acceptance-criteria instruction to record the exact discovered set when a sibling plan has not yet landed.

## Known Stubs

None. This plan produces no UI, no data-rendering surface, and no placeholder values.

## Threat Flags

None beyond what this plan's own `<threat_model>` already declares (T-240-30 through T-240-40, T-240-SC). No new network endpoint, auth path, file-access pattern, or schema change was introduced outside that register; this plan is test-only and touches zero production files.

## User Setup Required

None - no external service configuration required.

## Mandatory Grounding

- **Context7 / langtalks-graph-expert:** not consulted. No claim requiring `node:sqlite` transaction-semantics grounding beyond what Phase 236's own research already established (`DatabaseSync` has no `transaction(fn)` helper; explicit `BEGIN`/`COMMIT`/`ROLLBACK` is the only mechanism) was needed to write or verify this test. All file:line claims in the plan were independently re-read from source during execution rather than taken on the plan's word (across-session-memory.cjs, jtbd-state.cjs, lazygraph-ops.cjs, spine-events.cjs, memory-events.cjs were all read directly).

## Next Phase Readiness

- MEM-02 SC2, as revised on 2026-07-30, is now closed: the promote/park/complete lifecycle reaches the Phase 150 memory cortex and those specific rows are proven, live and mutation-provably, to survive a real `rebuildGraph`.
- The `MUTATIONS RUN` block inside `tests/test-240-jtbd-event-survives-rebuild.cjs`'s own header means the phase's most easily-misworded finding (mutation = widen the allowlist, never remove the transaction wrap) is now self-documenting for any future reader or planner.
- No blockers for plan 240-06 or the phase wave merge. This worktree's `tests/run-all-240.sh` run recorded a partial discovered set (240-04 not yet merged); the orchestrator should re-run it post-merge to confirm the full 4-file total.

## Self-Check: PASSED

- FOUND: tests/test-240-jtbd-event-survives-rebuild.cjs
- FOUND: commit dfc54cc6 (Task 1)
- FOUND: commit 90107936 (Task 2)

---
*Phase: 240-memory*
*Completed: 2026-07-30*
