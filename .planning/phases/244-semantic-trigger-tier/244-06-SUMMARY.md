---
phase: 244-semantic-trigger-tier
plan: 06
subsystem: infra
tags: [doctor, sqlite-fts5, release-gate, canon-part-9, false-success-mitigation]

# Dependency graph
requires:
  - phase: 244-02
    provides: "lib/core/eureka/fts-index-lifecycle.cjs::ftsIndexState, the classification function this module calls (never re-implemented)"
provides:
  - "lib/core/doctor/eureka-fts-health-module.cjs: check(ctx) -> per-registered-room eureka_fts presence/population/staleness census, read-only, no fix()"
  - "data/doctor-modules.json: eureka-fts-health module registration"
  - "scripts/doctor.cjs: the eureka-fts-index-visible --acceptance checklist point (blocker severity, fails only on index_stale)"
  - "DOCTOR_SKIP_EUREKA_FTS_HEALTH env seam (hermetic-CI opt-out)"
  - "tests/test-244-doctor-fts-health.cjs: 11 assertions, 5 mutation proofs re-confirmed"
affects: [244-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-surface doctor registration: data/doctor-modules.json (hand-maintained module array) and scripts/doctor.cjs's separate --acceptance checklist array are two different surfaces; a module entry does not automatically become an acceptance point"
    - "Visibility-not-gate acceptance point: severity blocker on the array entry, but the point's own logic (fail on stale, pass-with-full-census on absent/empty/ok) is what makes it visibility rather than a blanket release blocker"
    - "Isolated single-use fixture per mutation-fence assertion, so a wrong-door mutation cannot hide behind idempotent CREATE-TABLE-IF-NOT-EXISTS migration clauses already applied by an earlier scenario in the same test run"

key-files:
  created:
    - lib/core/doctor/eureka-fts-health-module.cjs
    - tests/test-244-doctor-fts-health.cjs
  modified:
    - data/doctor-modules.json
    - scripts/doctor.cjs

key-decisions:
  - "state for a room with no room.db yet is 'index_absent' (not 'unavailable'), matching the totals bucket a room with room.db-but-no-eureka_fts also falls into -- both are the same 'nothing built yet' fact from a release-gate perspective"
  - "readFailureCount reads <roomPath>/.mindrian/fts-index-failures.json (Plan 02's permanent-failure log) into a failure_count field on every room entry, so a room stuck in permanent build failure is visible in the same report without a second doctor pass"
  - "the acceptance point's comment in scripts/doctor.cjs avoided the literal substring 'openRoomDbForCaller' outside the ReadOnly variant, matching Task 1's own header wording fix, because the plan's own grep-based verify command is comment-blind and would false-positive on it otherwise"
  - "did NOT touch the two real rooms discovered with genuine orphan eureka_fts rows (jonathan-contractor-motj, aion-eureka-synergy): fixing pre-existing user room data is out of this plan's scope (SCOPE BOUNDARY rule) and the module's whole design intentionally never mutates what it measures"

requirements-completed: [TRIG-01]

# Metrics
duration: 70min
completed: 2026-07-30
---

# Phase 244 Plan 06: Doctor Visibility for eureka_fts Summary

**New `eureka-fts-index-visible` doctor module + `--acceptance` checklist point makes the FTS trigger index's presence/staleness visible per registered room, and in doing so caught two REAL pre-existing production defects (orphaned eureka_fts rows in two live rooms) that were previously invisible.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-07-30T21:05:00Z
- **Tasks:** 3/3
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- `lib/core/doctor/eureka-fts-health-module.cjs` classifies every registered room's `eureka_fts` state (`index_absent`, `index_empty`, `index_stale`, `ok`) through the read-only navigation door, calling Plan 02's `ftsIndexState` directly rather than re-implementing classification.
- `data/doctor-modules.json` and `scripts/doctor.cjs`'s `--acceptance` checklist were treated as the two separate surfaces the plan's own correction called out: one hand-maintained module registration, one separate acceptance checklist entry, no engine code change for the former.
- The new `eureka-fts-index-visible` acceptance point fails ONLY on a genuine defect (a stale index carrying rows for deleted nodes), never on absence, and reports the full per-room census in `detail` on the passing path too -- closing T-244-25 (false success: an absent index silently passing as healthy would otherwise hide the exact symptom this phase exists to prevent).
- Read-only proof executed live twice (Task 1's manual proof and Task 3's permanent test fence): a room's `sqlite_master`, mtime and file size are byte-identical before and after `check()`.
- 5 mutation proofs executed live and reverted (see below), each with observed red output transcribed.
- **Real finding, not a plan defect:** this dev machine's real `~/MindrianRooms` registry (45 rooms) already carries 6 rooms with a built `eureka_fts` index (from the separate, pre-existing Phase 219/226 semantic-search eureka feature, unrelated to this phase's TRIG-01) and 2 of those are genuinely stale (451 and 308 orphan rows respectively) -- the exact ghost-trigger defect this module exists to catch. See "Known residual" below.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the eureka-fts-health doctor module and register it** - `af8631f4` (feat)
2. **Task 2: Add the --acceptance visibility point** - `576ffc03` (feat)
3. **Task 3: Fence the classification and the red path** - `bfe99a27` (test)

_No separate plan-metadata commit: SUMMARY.md is committed as part of this worktree's final commit per the parallel-executor protocol (STATE.md/ROADMAP.md are excluded and owned by the orchestrator)._

## Files Created/Modified

- `lib/core/doctor/eureka-fts-health-module.cjs` - `check(ctx) -> { status, detail, rooms, totals }`, check-only (no `fix` export). Opens each registered room through `openRoomDbReadOnlyForCaller`, calls `ftsIndexState(db)`, and reads `<roomPath>/.mindrian/fts-index-failures.json` for a `failure_count`. `status` is `'warn'` only when any room is `index_stale`; `'ok'` otherwise (including all-absent). `resolveRoomPath` copied verbatim from `room-graph-density-module.cjs`.
- `data/doctor-modules.json` - one new entry: `id: "eureka-fts-health"`, `introduced_version: "1.15.3-beta.51"`, `cadence: "always"`, `flag: null`, `fix_supported: false`.
- `scripts/doctor.cjs` - one new `--acceptance` checklist entry `eureka-fts-index-visible` (severity `blocker`, `applies_to: ['pre-tag', 'full']`), placed immediately after Class S `eureka-smoke-stack-ready`. Calls the health module in-process (no spawn). Carries `DOCTOR_TEST_FAIL_POINT=eureka-fts-index-visible` and `DOCTOR_SKIP_EUREKA_FTS_HEALTH=1` seams.
- `tests/test-244-doctor-fts-health.cjs` - 11 assertions: the four-room classification sweep, the attributable warn-to-ok flip, hermeticity (env var + independent path scan), the permanent read-only fence, the self-DoS soft-fail guard, the no-registry skip case, and the acceptance point's pass/fail/synthesized-failure/skip legs.

## Decisions Made

- **`state` for a room with no room.db yet is `index_absent`, not a separate enum value.** Matches Task 1's own instruction that this case classifies the same as a room whose room.db exists but has no `eureka_fts` yet -- both are "nothing built" from a release-gate perspective, and `totals.absent` counts them together.
- **The acceptance point's header comment avoided the literal substring `openRoomDbForCaller`** (writing "the writable sibling door" instead), because the plan's own verify command (`grep`-equivalent via a Node regex) is comment-blind and would false-positive on the very sentence explaining why NOT to use that door -- discovered live when Task 1's first draft tripped its own verify command.
- **The permanent read-only fence test uses an isolated, single-use fixture room**, not one already touched by an earlier scenario in the same file. First draft shared `no-index-room` across scenarios; re-confirming MUTATION PROOF 2 against it produced a false negative (the room was already migrated to full schema by an earlier scenario's writable-door mutation call, so the "before" snapshot for the fence test already showed the post-migration schema and there was nothing left to change). Fixed before landing; see Deviations.
- **No fix to the two real stale rooms discovered on this machine.** SCOPE BOUNDARY: a pre-existing condition in real user room data, not caused by this task's changes, is out of scope to auto-fix, and the module's entire design point is to never mutate what it measures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Permanent read-only fence test gave a false negative under the writable-door mutation**
- **Found during:** Task 3, while re-confirming MUTATION PROOF 2 against the new test file
- **Issue:** The first draft of the "permanent fence" test took its before/after `sqlite_master` snapshot against `no-index-room`, a fixture already opened by two earlier scenarios in the same test run (the four-room sweep and the hermeticity check). Under the writable-door mutation, those earlier calls already triggered the full room-db migration (idempotent `CREATE-TABLE-IF-NOT-EXISTS` clauses), so by the time the fence test took its "before" snapshot, the room was already at head schema -- the mutation produced ZERO further change and the fence stayed green, a false negative that would have shipped a fence that does not actually fence anything.
- **Fix:** Rewrote the fence test to build and sweep a DEDICATED, single-use scratch room + registry that no other scenario in the file ever touches, guaranteeing the writable-door mutation is visible on its first (and only) open.
- **Files modified:** `tests/test-244-doctor-fts-health.cjs`
- **Verification:** Re-ran MUTATION PROOF 2 against the corrected fence: RED with the full observed table-list jump (`nodes`, `sqlite_autoindex_nodes_1` -> 40+ tables, 12288 -> 212992 bytes); restored, green.
- **Committed in:** `bfe99a27` (Task 3 commit; the fix landed in the same commit as the test file itself, never shipped broken)

---

**Total deviations:** 1 auto-fixed (1 bug, found and fixed during the plan's own mutation-proof verification, never landed broken)
**Impact on plan:** Necessary for the fence to actually be a fence. No scope creep; no plan file list, export surface, or behavior contract changed.

## Known Residual (real production finding, out of scope to fix here)

This dev machine's real `~/MindrianRooms/.rooms/registry.json` (45 rooms) already has 6 rooms carrying a built `eureka_fts` index -- built by the pre-existing Phase 219/226 semantic-search eureka feature (a different consumer of the same shared index; see 244-RESEARCH.md Assumption A4), not by this phase's TRIG-01 work, which has not shipped a live trigger yet. Of those 6, **2 are genuinely stale**:

| Room | fts_rows | node_rows | orphan_rows |
|------|----------|-----------|-------------|
| `jonathan-contractor-motj` | 611 | 690 | 451 |
| `aion-eureka-synergy` | 393 | 694 | 308 |

**Root cause (traced, not guessed):** `tests/test-244-fts-rebuild-reconcile.cjs` (Plan 03, already landed in this wave) proves a rebuild-time reconcile now exists in `lazygraph-ops.cjs::rebuildGraph` that deletes orphaned `eureka_fts` rows going forward. These two rooms predate that reconcile landing, or have not been rebuilt since -- the reconcile prevents NEW staleness on the next rebuild but does not retroactively clean rooms that went stale before it shipped or that have not been rebuilt since. This is 244-RESEARCH.md's own Open Question 2 / Assumption A7 territory ("Option A leaves a window where the index is stale between rebuilds if the reconcile is missed at a third call site"), now confirmed as a live, not hypothetical, gap.

**Why this is not a bug in this plan's code, and was not fixed here:** the doctor module's entire design point (T-244-25 mitigation) is to report, never mutate, the index it measures. Fixing these two rooms' data would mean writing to real user room.db files as a side effect of building a diagnostic -- exactly the anti-pattern this plan's threat model forbids (T-244-23). Per the executor's SCOPE BOUNDARY rule, a pre-existing condition unrelated to this task's own changes is logged here, not silently fixed.

**Operational consequence, stated plainly:** `node scripts/doctor.cjs --acceptance` on THIS machine now legitimately fails (15/16, failing only `eureka-fts-index-visible`, naming `jonathan-contractor-motj` first) where it previously passed 15/15, because two real pre-existing defects are now visible that were silently invisible before. This is the module doing exactly its designed job, not a regression introduced by this plan -- but it does mean `scripts/release.sh` will hard-block on this machine until one of the following happens: (a) a rebuild is run against the two affected rooms (which now reconciles cleanly per Plan 03's fix), or (b) `DOCTOR_SKIP_EUREKA_FTS_HEALTH=1` is used as a deliberate, logged bypass for a specific release.

**Recommended next step (not executed here, out of scope):** run a graph rebuild against `jonathan-contractor-motj` and `aion-eureka-synergy` (the existing, already-shipped mechanism) to clear the orphan rows via Plan 03's reconcile, then re-run `node scripts/doctor.cjs --acceptance` to confirm 16/16.

## Issues Encountered

- **`package-lock.json` and `.mindrian-npm-install.lock` regenerated as unrelated dirty diffs** during test runs, matching the known repo quirk for this wave. Discarded (`git checkout --` / `rm -f`) before every commit; neither was staged.
- **The SCHEMA DRIFT GUARD - PHASE 108 pre-commit hook false-positived on prose** in `tests/test-244-doctor-fts-health.cjs` where the migration-clause phrase was immediately followed by the word "is" (the guard parsed the token right after that clause as a new table name). Reworded to the hyphenated `CREATE-TABLE-IF-NOT-EXISTS` form already used elsewhere in this plan's own files (matching `eureka-fts-health-module.cjs`'s existing convention), never bypassed with `--no-verify`.
- **The plan's Task 1 acceptance criteria's literal grep check for the writable door is comment-blind:** it flags the substring `openRoomDbForCaller` anywhere in the file, including inside a comment explaining why NOT to use it (the exact phrasing the analog `room-graph-density-module.cjs`'s own header uses). Worked around by rephrasing the comment to reference "the writable sibling door" instead of the literal identifier, preserving the same information without tripping the check.

## Mutation Proofs (5 total, all executed live and reverted)

### MUTATION PROOF 1 -- add a `fix` export to the module

```
D-03 CONTRACT VIOLATIONS (1):
  FAIL - eureka-fts-health: rule 8 -- fix_supported:false but runner DOES export fix() (undeclared remediation)

FAIL: data/doctor-modules.json has declaration/contract gaps (D-03 hard block).
```
Restored byte-identical (`diff` clean); re-ran green (`node tests/test-doctor-module-contract-parity.cjs` -> `ALL PASS (2 assertions)`, 19 registry modules).

### MUTATION PROOF 2 -- swap `openRoomDbReadOnlyForCaller` for the writable door

Re-confirmed twice: once via a standalone manual proof script (Task 1) and once against the permanent test fence (Task 3, after fixing the false-negative described in Deviations above).

Manual proof observed table-list jump:
```
BEFORE: ["nodes","sqlite_autoindex_nodes_1"] mtime=1785442139346.221 size=12288
AFTER:  ["assumptions","decisions_index","edges","facts","fragments","held_contradictions",
         "identity","idx_assumptions_section", ... 40+ tables total ...]
        mtime=1785442211989.6938 size=212992
tablesIdentical: false mtimeIdentical: false sizeIdentical: false
Error: READ-ONLY PROOF FAILED: the module mutated what it measures
```
Permanent-fence re-confirmation produced the identical class of failure (`sqlite_master` diff showing the same table-list jump, `assert.deepEqual` FAIL). Restored byte-identical both times; re-ran green both times.

### MUTATION PROOF 3 -- make the acceptance point fail on `index_absent` too

Re-confirmed at TWO levels: live machine and hermetic test.

Live machine (`node scripts/doctor.cjs --acceptance`):
```
FAIL  eureka-fts-index-visible: ... -- eureka_fts stale in room "polygon" (0 orphan row(s) pointing at deleted nodes)
Acceptance full: 14/16 points passed; failed: verify-release-clean-tree, eureka-fts-index-visible.
```
(Note: `polygon` here is flagged because the mutated logic now also fails on `index_absent`, not because `polygon` is stale -- the 0 orphan rows in the finding confirms this.)

Hermetic test (`node tests/test-244-doctor-fts-health.cjs`):
```
FAIL: acceptance point: ok:true with a populated detail census when the only finding is absence
  -- must pass when every room is absent; got finding=eureka_fts stale in room "abs-room" (0 orphan row(s) pointing at deleted nodes)
Phase 244-06 doctor-fts-health: PASS=10 FAIL=1
```
Restored byte-identical; both re-ran green (live: back to 15/16 with only the real `eureka-fts-index-visible` finding on `jonathan-contractor-motj`; hermetic: `PASS=11 FAIL=0`).

### MUTATION PROOF 4 -- `ftsIndexState` reclassifies a stale index as `ok`

```
FAIL: four-room sweep: status is warn and each room classifies correctly -- 'ok' !== 'warn'
FAIL: four-room sweep: the stale room is named specifically in detail
  -- detail must name the stale room; got: 4 room(s) measured: 2 with a built index, 2 absent ..., 0 empty, 0 stale
FAIL: acceptance point: ok:false naming the first stale room -- true !== false
Phase 244-06 doctor-fts-health: PASS=8 FAIL=3
```
Restored byte-identical (`diff` clean); re-ran green (`PASS=11 FAIL=0`). Proves the doctor's verdict actually depends on Plan 02's lifecycle classification rather than an independent guess.

### MUTATION PROOF 5 -- remove the per-room try/catch

```
FAIL: a malformed registry entry soft-fails that one room; the sweep completes
  -- The "path" argument must be of type string. Received type number (5)
Phase 244-06 doctor-fts-health: PASS=10 FAIL=1
```
The raw `TypeError` from `path.isAbsolute(5)` escaped the sweep entirely, confirming the try/catch is load-bearing, not decorative. Restored byte-identical; re-ran green (`PASS=11 FAIL=0`).

## Verification Results

- `bash tests/run-all-244.sh`: `PASS=7 FAIL=0 SKIP=0` (all seven discovered test files pass, including the new one and the no-em-dash fence).
- `node scripts/doctor.cjs --acceptance` (BEFORE this plan's edit, clean tree): exit 0, `15/15 points passed`.
- `node scripts/doctor.cjs --acceptance` (AFTER this plan's edit, clean tree): exit 1, `15/16 points passed; failed: eureka-fts-index-visible`. The outcome DID change -- see "Known Residual" above for why this is a real finding, not a plan regression. `verify-release-clean-tree` (the other point that transiently failed mid-edit) passes again once the tree is clean.
- `node tests/test-doctor-acceptance.cjs`: `6 passed, 0 failed` (no change; this file exercises `--pre-tag` filtering and does not reach the new full-mode point).
- `node tests/test-doctor-acceptance-self-coverage.cjs`: `6 passed, 0 failed`, including Test 6 (the live-workspace no-regression guard, which asserts on the separate `doctor-all` point, not `eureka-fts-index-visible`).
- `node tests/test-doctor-module-contract-parity.cjs`: `ALL PASS (2 assertions)`, 19 registry modules (up from 18 before this plan).
- `node -e "JSON.parse(...doctor-modules.json...)"`: `json ok`.
- `node scripts/check-substrate.cjs --diff`: exit 0, no violations.
- `grep -lP '\x{2014}' <all 4 files>`: no em-dashes in any of the four files.
- `grep -v '^\s*[/*]' scripts/doctor.cjs | grep -c "spawn.*eureka-fts"`: `0` (no child process for the new point).
- `git diff --stat` across the 3 task commits (base `7f227c44` -> `HEAD`): exactly the 4 files declared in `files_modified` (`data/doctor-modules.json`, `lib/core/doctor/eureka-fts-health-module.cjs`, `scripts/doctor.cjs`, `tests/test-244-doctor-fts-health.cjs`), 721 insertions, 0 deletions.

## Next Phase Readiness

- Plan 08 can now record the acceptance-point count change (15 -> 16) in the phase gate and the residual register, along with the "Known Residual" finding above (2 real stale rooms discovered, root cause traced to Plan 03's reconcile predating those rooms' last rebuild).
- The doctor is a real, working release gate for TRIG-01's sleeper risk from this point forward: any room whose `eureka_fts` goes stale in the future will be caught by `--acceptance` before it ships, exactly per ROADMAP SC1.
- No blockers for THIS plan's own scope. The two real stale rooms are a genuine pre-existing defect surfaced by this work, tracked in "Known Residual" for the navigator/user to action (a rebuild against the two named rooms, or a deliberate `DOCTOR_SKIP_EUREKA_FTS_HEALTH=1` for the next release).

---
*Phase: 244-semantic-trigger-tier*
*Completed: 2026-07-30*

## Self-Check: PASSED
All 4 plan files + SUMMARY.md verified present on disk; all 3 commits (af8631f4, 576ffc03, bfe99a27) verified in git log.
