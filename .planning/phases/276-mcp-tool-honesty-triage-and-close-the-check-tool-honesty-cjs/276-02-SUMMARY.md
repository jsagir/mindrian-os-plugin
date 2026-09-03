---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 02
subsystem: testing
tags: [room-db, busy-timeout, typed-errors, node-sqlite, wal, tdd-red, node-assert]

# Dependency graph
requires:
  - phase: 236-03
    provides: "tests/helpers/room-db-lock-holder-236.cjs, the shared held-write-lock test helper (fork + IPC ready/release protocol, distinct exit codes)"
  - phase: 276-01
    provides: "tests/run-all-276.sh glob-discovery aggregator that auto-registers any tests/test-276-* file"
provides:
  - "tests/test-276-busy-timeout-propagation.cjs, the RED elapsed-time-floor proof for TOOLHON-09 (C4), covering census sites A1-A6 and B1-B3 (behavioral where a genuine fixture can force contention, source-level pin where it cannot) plus the excluded Groups C/D"
  - "tests/test-276-spine-events-typed-reason.cjs, the RED typed-reason misreport proof for TOOLHON-10/TOOLHON-11 (C5), against the real spine-events.cjs module under a genuinely held lock, plus a run-time no_room_db producer census and the A10 safety-argument re-verification"
  - "RESEARCH assumption A11 resolved as a measured fact: getCurrentJTBD/getCurrentOperator do NOT share the {ok:false, reason:'no_room_db'} swallow; they silently degrade to the JSON cache fallback regardless of failure cause"
affects: ["276-09 (must make the C4 test's A1-A5 assertions pass without breaking the A6/B1-B3/C/D source-level pins)", "276-10 (must make the C5 test's room_db_busy/room_db_broken assertions pass, and should consider the two out-of-scope sibling sites this plan's census discovered)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Elapsed-time-floor assertion (process.hrtime.bigint() before/after) instead of a return-value-only check, so a silently-ignored timeout option (Node <22.16.0) cannot pass vacuously"
    - "Two-fixture-room design for busy-contention tests: a bare identity-only room forces genuine new-table write work (a schema-defining statement contends), a fully-migrated room forces genuine fresh-row INSERT contention (a schema-init statement on an already-existing table is a documented no-op under WAL and proves nothing)"
    - "Source-level pin as the disjunctive fallback when a genuine behavioral proof is structurally unreachable within the plan's declared file scope (a different db file than room.db, or a read-only access pattern WAL makes non-contending by design), always paired with an empirically-verified reason in the assertion label"
    - "Run-time tree census with comment-stripping (never a frozen list or frozen count), classified via an automatable catch-after-openRoomDb heuristic, with a small named allowlist for the sites the heuristic flags -- so a newly-introduced unclassified site fails the test instead of silently regrowing the propagation gap"

key-files:
  created:
    - tests/test-276-busy-timeout-propagation.cjs
    - tests/test-276-spine-events-typed-reason.cjs
  modified: []

key-decisions:
  - "A1's fixture must be a BARE identity-only room, not a fully-migrated one -- empirically verified live before writing the assertion that a schema-init statement (create-table-if-not-exists) on an already-existing table does NOT request the write lock under WAL (succeeds in ~0.1ms even while a foreign BEGIN IMMEDIATE is held), so a fully-migrated fixture would make A1 pass vacuously today, which is the exact false-success shape this phase exists to close."
  - "A6 (venture-shape-nudge.cjs) and B1-B3 (cross-room-store.cjs, cross-room-umbilical-closer.cjs, review-queue.cjs) are source-level pins, not behavioral elapsed-floor assertions -- A6 because it is empirically a pure read (WAL readers never block writers, verified live: a plain open+SELECT succeeds in <1ms under contention, so an elapsed-floor assertion there would pass vacuously both before and after any timeout fix), and B1-B3 because each opens a DIFFERENT sqlite file than room.db (under <roomsHome>/.rooms/) that the shipped room-db-lock-holder-236.cjs cannot target without being extended, which this plan's declared file scope (two test files only) forbids."
  - "The C5 busy fixture must delete the Phase 109 migration sentinel (matching test-236-open-busy-detected.cjs's own makeMigrationPending pattern) rather than use a fully-migrated room -- empirically verified live that on an already-migrated room, spine-events.cjs's own _emit catch block (the actual documented C5 defect site) never fires under contention at all; the busy error instead surfaces one call deeper, inside memory-events.cjs's logEvent own internal catch, returning the raw SQLite message ('database is locked') rather than any no_room_db/room_db_busy value. Only the pending-migration fixture exercises the DESCRIBED defect precisely."
  - "TOOLHON-11's run-time census measured 35 no_room_db producer sites, not the 27 276-RESEARCH.md's own prose cites -- itself the argument for why the census must run at execution time rather than be trusted from a document."
  - "The run-time census's catch-after-openRoomDb heuristic (does a reason:'no_room_db' return sit inside a catch block within 6 lines of an openRoomDb( call) surfaced two sibling defect sites beyond spine-events.cjs's own two: lib/core/breakthrough/scanner.cjs:124 and lib/core/navigation/lens-nodes.cjs:254 (whose own header comment literally says 'mirrors spine-events'). Both are recorded in the test's allowlist with a stated reason and flagged as a finding for a future plan; NEITHER was touched, since this plan's files_modified declares only the two test files and spine-events.cjs is the sole C5 target."

requirements-completed: [TOOLHON-09, TOOLHON-10, TOOLHON-11]

# Metrics
duration: 30min
completed: 2026-09-03
---

# Phase 276 Plan 02: Layer 2 RED Tests (Busy-Timeout Propagation + Typed-Reason Misreport) Summary

**Two RED integration tests proving, against real production modules under a genuinely held foreign write lock, that (1) none of the census-A/B room.db openers actually wait on a busy timeout today, and (2) spine-events.cjs mislabels a busy-or-broken room as `no_room_db` even after independently confirming the file exists.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-03T19:58:00Z (approx, first file read)
- **Completed:** 2026-09-03T20:16:44Z
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- `tests/test-276-busy-timeout-propagation.cjs`: 20 assertions across census groups A1-A6, B1-B3, C, D, and the runtime-floor check. A1-A5 are genuine behavioral elapsed-time-floor proofs (measured 0.29-1.37ms today, far under the 250ms floor); A6 and B1-B3 are documented source-level pins; C and D are the exclusion census with the codebase's own stated reason ("WAL readers never block writers"). Observed failing: exit 1, 15 passed / 5 failed.
- `tests/test-276-spine-events-typed-reason.cjs`: proves the busy misreport (actual `no_room_db`, expected `room_db_busy`) and the broken misreport (actual `no_room_db`, expected `room_db_broken`) against the REAL spine-events.cjs module, exercises both `_emit` and `_emitWithOperatorEdge`, resolves RESEARCH assumption A11 by reading AND behaviorally proving the two getters' catch bodies degrade under a genuinely contended open (getCurrentJTBD reports bare `null`; getCurrentOperator reports a synthesized cold-start default indistinguishable in value from real history), runs the TOOLHON-11 run-time producer census (35 sites, comment-stripped, never a frozen list), and re-verifies the A10 safety argument (zero `=== 'no_room_db'` consumers) live. Observed failing: exit 1, 12 passed / 6 failed.
- Both tests reuse the shipped Phase 236-03 `room-db-lock-holder-236.cjs` exclusively; `tests/helpers/held-write-lock.cjs` was never authored (`test -f` on it fails, confirmed).
- `node tests/test-236-open-busy-detected.cjs` still exits 0 (14/14), confirming the shipped helper was reused, not mutated.
- Zero production files under `lib/`, `scripts/`, or `bin/` were modified by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: tests/test-276-busy-timeout-propagation.cjs** - `1c665f20` (test)
2. **Task 2: tests/test-276-spine-events-typed-reason.cjs** - `75911b34` (test)
3. **Self-caught fix: Group D fixture corrected to genuinely exercise the getter catch path** - `4fd8b065` (test), see Deviation 5 below

**Plan metadata:** committed alongside this SUMMARY, STATE.md, and ROADMAP.md updates (see below).

_Note: the plan's own Task 2 acceptance criteria asked for both test files to land in a SINGLE combined commit. This executor follows the standard atomic-per-task commit protocol (task_commit_protocol) by default, and had already committed Task 1's file in its own commit before reaching Task 2's acceptance criteria text. Rewriting history to combine them would require amending a prior commit, which the git safety protocol forbids ("always create NEW commits rather than amending"). Documented here as a reconciled conflict between the plan's literal instruction and the standing executor protocol -- both files exist, both are RED, both are on this branch, which is the substantive intent of the criterion; only the single-commit mechanics differ. Matches the identical resolution 276-01-SUMMARY.md recorded for its own Task 2+3 combination, just in the opposite direction (there the plan asked to combine and the default is to separate; here the plan asked to combine and two commits already existed)._

## Files Created/Modified

- `tests/test-276-busy-timeout-propagation.cjs` - the C4 RED proof. Two fixture rooms (bare identity-only for A1's genuine-new-table contention, fully-migrated for A2-A5's genuine fresh-row-INSERT contention), an elapsed-time floor of 250ms, a runtime-floor check (`process.version >= v22.16.0`), and 10 source-level pins (A6, B1-B3, 6x Group C/D) each carrying an empirically-verified reason.
- `tests/test-276-spine-events-typed-reason.cjs` - the C5 RED proof. A pending-migration fixture (deleting the Phase 109 sentinel, matching test-236's own pattern) so `_emit`'s actual catch block fires under contention; a garbage-bytes broken-room fixture; a history-seeded room with a deliberately absent JSON cache for the getter contract assertions; a run-time `no_room_db` producer walk with a catch-after-openRoomDb classifier and a 4-entry allowlist; a live re-verification that zero call sites branch on `=== 'no_room_db'`.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: two fixture-shape decisions (bare-vs-full room for A1; pending-migration-vs-full room for the C5 busy path) were each corrected AFTER an initial draft produced a vacuously-passing or wrongly-targeted assertion, verified live with a throwaway probe script before the final fixture was written into the test. A6 and B1-B3 were redesigned from the plan's literal "behavioral, elapsed-floor" instruction to a source-level pin, using the plan's own stated escape valve, backed by a live probe in each case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's literal assumption] A6 (venture-shape-nudge.cjs) cannot demonstrate contention via an elapsed-floor assertion**
- **Found during:** Task 1, while drafting the Group A assertions
- **Issue:** The plan lists A6 as one of the "Openers under test" for a per-census-site elapsed-floor assertion. Live verification showed `shouldSurfaceNudge` only ever reads (via `findRecentChanges`, a SELECT) and never writes; under WAL, a plain open+SELECT succeeds in under 1ms even while a foreign connection holds an uncommitted `BEGIN IMMEDIATE` write. An elapsed-floor assertion here would pass with ~0ms elapsed both before and after any `timeout:5000` fix is added, because the option is never exercised by a read -- itself the plan's own census entry (276-RESEARCH.md:940) names this exact tension ("propagate the option, or switch to the read-only door").
- **Fix:** Converted A6 to a source-level pin (constructor line does not yet carry `timeout:5000`), matching the plan's own stated fallback for "a module [whose exercised path] has no exported entry that reaches its opener" under genuine contention, with the WAL-reader finding quoted in the assertion label.
- **Files modified:** `tests/test-276-busy-timeout-propagation.cjs`
- **Verification:** Live probe (`node -e ...`) confirmed a plain read under contention completes in 0.25ms.
- **Committed in:** `1c665f20`

**2. [Rule 1 - Bug in plan's literal assumption] B1-B3 target a different sqlite file than room.db and cannot use the shared lock helper**
- **Found during:** Task 1, while drafting the Group A/B assertions
- **Issue:** The plan's own action text already flags B1 as "against a temp roomsHome, NOT a room.db" but still lists it (and B2, B3) under the per-site elapsed-floor bullet list. Reading each opener confirmed all three (`cross-room-store.cjs`, `cross-room-umbilical-closer.cjs`, `review-queue.cjs`) open a sibling file under `<roomsHome>/.rooms/`, and the shipped `room-db-lock-holder-236.cjs` hardcodes the `<roomDir>/.mindrian/room.db` path plus an `identity`-table INSERT that would not match those sibling schemas.
- **Fix:** Converted B1-B3 to source-level pins with the reasoning stated in each assertion label, per the plan's own disjunctive fallback and the phase's absolute prohibition on authoring a second lock helper.
- **Files modified:** `tests/test-276-busy-timeout-propagation.cjs`
- **Verification:** Read of all three openers' source confirmed the different db paths.
- **Committed in:** `1c665f20`

**3. [Rule 1 - Bug] Schema-drift pre-commit guard false-positived on doc-comment prose mentioning the DDL keyword pair for defining a table**
- **Found during:** Task 1's first commit attempt
- **Issue:** `scripts/check-schema-aliases.cjs`'s table-creation regex backtracks past an optional `IF NOT EXISTS` group when the literal table-name position isn't a bare word (e.g. a doc comment quoting the SQL keywords immediately followed by a non-word placeholder), capturing the word `IF` itself as a fake "new table name"; a separate innocent sentence describing a value "surfacing as a rejected promise" was captured as table name `surfaces` because the two DDL keywords happened to sit adjacent in that sentence too. Both are pre-existing regex false positives in a shared production hook, not a real schema violation.
- **Fix:** Reworded the offending comment/string sentences (in both the test files and this SUMMARY) to avoid ever placing the two DDL keywords adjacent with a following word, without touching `scripts/check-schema-aliases.cjs` itself (out of this plan's file scope and shared with a concurrent session).
- **Files modified:** `tests/test-276-busy-timeout-propagation.cjs`
- **Verification:** `node scripts/check-schema-aliases.cjs --file tests/test-276-busy-timeout-propagation.cjs` exits 0 after the reword.
- **Committed in:** `1c665f20`

**4. [Rule 1 - Bug in plan's literal assumption] The C5 busy fixture must force a pending migration, not use a fully-migrated room**
- **Found during:** Task 2, while drafting the busy-path assertions
- **Issue:** Using a fully-migrated room (the same fixture shape used for A2-A5 in Task 1) made `spine-events.cjs`'s own `_emit` catch block never fire under contention -- `openRoomDb()` succeeds cleanly (its migration chain is entirely idempotent no-ops on an already-migrated schema, none of which need the write lock), so the busy error instead surfaces one call deeper, inside `memory-events.cjs`'s `logEvent` own internal catch, returning the raw SQLite message (`"database is locked"`) rather than any `no_room_db`/`room_db_busy` value at all. This does not match the documented C5 defect (`_emit`'s own catch mislabeling a busy/broken open as `no_room_db`).
- **Fix:** Rebuilt the busy fixture to delete the Phase 109 migration sentinel (`phase_109_session_focus_v1` from the `identity` table) after full migration, matching `tests/test-236-open-busy-detected.cjs`'s own `makeMigrationPending` pattern, so the NEXT `openRoomDb()` call has genuine write work and throws from inside `_emit`'s own catch under contention. Verified live before finalizing: this fixture makes `logSpineRead` return exactly `{ok:false, reason:'no_room_db'}` today.
- **Files modified:** `tests/test-276-spine-events-typed-reason.cjs`
- **Verification:** Live probe and the final test run both show `logSpineRead` returning `reason:'no_room_db'` under this fixture, matching the acceptance criterion's expected output shape verbatim.
- **Committed in:** `75911b34`

**5. [Rule 1 - Bug, self-caught post-commit] Group D fixture did not genuinely exercise the getter catch path**
- **Found during:** Task 2, immediately after the Task 2 commit, while drafting this SUMMARY's "RED Test Output" section and re-reading the actual test log rather than restating an assumption
- **Issue:** The committed Group D fixture used a fully-migrated room (matching the A2-A5 shape from Task 1). On a fully-migrated room, `getCurrentJTBD`/`getCurrentOperator`'s own `openRoomDb()` call succeeds cleanly under contention (idempotent no-op migrations need no write lock -- the same finding that shaped the busy-path fixture), and the subsequent `findRecentChanges` SELECT also succeeds under WAL (readers never block writers). The result: both CONTRACT assertions PASSED, but for the wrong reason -- the getters genuinely read the real event-log data and never touched their catch-and-fallback path at all, so the assertions proved nothing about the A11 concern they exist to test.
- **Fix:** Rebuilt the fixture on the pending-migration shape (same sentinel-deletion technique as the C5 busy fixture), so `openRoomDb()` itself throws under contention, forcing the getters through their real catch body. Replaced the loose `!== null` assertions with precise real-value checks (`jtbd === 'reduce-churn'`, `current === 'strategist'`) rather than a bare non-null check, because `operator.getCurrent()` SYNTHESIZES a default (`'JUST_TALK'`) when no cache exists -- a value that happens to be non-null and therefore would have passed a `!== null` check even while silently discarding the room's real history. This asymmetry (JTBD's cache fallback has no default and degrades to `null`; operator's cache fallback synthesizes a value indistinguishable from a genuine cold start) is itself a finding, now recorded in the RESEARCH A11 resolution below.
- **Files modified:** `tests/test-276-spine-events-typed-reason.cjs`
- **Verification:** Live probe confirmed `getCurrentJTBD` returns bare `null` and `getCurrentOperator` returns the synthesized `'JUST_TALK'` default under this corrected fixture; the full test run shows both CONTRACT assertions correctly RED.
- **Committed in:** `4fd8b065`

---

**Total deviations:** 5 auto-fixed (all Rule 1, all corrected via a live probe before or immediately after being finalized, none reached a *final* commit in a broken or vacuously-passing state -- item 5 was caught and corrected in the very next commit before this SUMMARY was written).
**Impact on plan:** No scope creep; every fix kept the test honest (never vacuously green) and stayed within the plan's own disjunctive design (behavioral assertion where genuinely reachable, source-level pin with a stated, verified reason otherwise). None touched a production file.

## Issues Encountered

None beyond the five auto-fixed items above. Item 5 (Group D) is a reminder that even a live-probe-verified fixture needs re-checking against the FULL test's actual printed output, not just an isolated probe of the specific function under test -- the isolated probe would have caught it too, but the SUMMARY-writing step of re-reading the real log is what surfaced it here.

## RED Test Output (recorded verbatim per acceptance criteria)

### `node tests/test-276-busy-timeout-propagation.cjs` -- exits **1**, `15 passed, 5 failed`

```
- A1 lazygraph-ops.cjs::openGraph(roomDir) ... :: threw=database is locked (measured 0.40ms, floor 250ms)
- A2 lib/hmi/selector-telemetry.cjs::recordSelectorMirror ... :: result={"ok":false,"reason":"database is locked"} ms=1.26
- A3 lib/hmi/shape-f0-renderer.cjs::buildRejectedBecauseEdge ... :: result={"ok":false,"reason":"database is locked"} ms=0.32
- A4 lib/hmi/shape-f6-plan-review-renderer.cjs::buildReviewedEdge ... :: result={"ok":false,"reason":"database is locked"} ms=0.29
- A5 lib/hmi/shape-f6-plan-review-renderer.cjs::emitRoundCompleted ... :: result={"ok":false,"reason":"database is locked"} ms=0.29
```
A6, B1-B3, and all 10 Group C/D exclusion pins pass today (they assert the CURRENT absence of `timeout:5000`, which is correct pre-fix state).

### `node tests/test-276-spine-events-typed-reason.cjs` -- exits **1**, `12 passed, 6 failed` (after the Deviation 5 fix)

```
- logSpineRead under a held lock :: ACTUAL reason="no_room_db" EXPECTED=room_db_busy
- companion (reason !== 'no_room_db') :: ACTUAL reason="no_room_db"
- logOperatorTransition(write_transition_edge:true) under a held lock :: ACTUAL reason="no_room_db" EXPECTED=room_db_busy
- logSpineRead against a garbage-bytes room.db :: ACTUAL reason="no_room_db" EXPECTED=room_db_broken
- getCurrentJTBD under contention must report 'reduce-churn' :: ACTUAL=null (degrades to jtbdState.getCurrent(), no on-disk cache, byte-identical to a genuine cold start)
- getCurrentOperator under contention must report 'strategist' :: ACTUAL current="JUST_TALK" (operator.getCurrent() SYNTHESIZES this default when no cache file exists -- the exact value a genuinely brand-new room would also show)
```
Group E (census) and Group F (safety argument) pass today: the census allowlist covers all 4 flagged catch-after-openRoomDb sites, and zero consumers branch on `=== 'no_room_db'`.

## RESEARCH Assumption A11 Resolution (measured fact, required by this plan)

`getCurrentJTBD` (spine-events.cjs:283) and `getCurrentOperator` (spine-events.cjs:315) do **NOT** share the `{ok:false, reason:'no_room_db'}` swallow that `_emit`/`_emitWithOperatorEdge` use. Read verbatim: both wrap `openRoomDb` plus a `findRecentChanges` query in a bare `try { ... } catch (_e) { /* fall through to cache fallback */ }` with NO reason discrimination whatsoever, then unconditionally call the JSON cache reader (`jtbdState.getCurrent(roomDir)` / `operator.getCurrent(roomDir)`) and return its result. This is a strictly worse shape than `_emit`'s: it never even produces the string `no_room_db` (confirmed absent from the TOOLHON-11 census below).

**Behaviorally proven, not just read** (against a genuinely contended `openRoomDb()`, via the same pending-migration fixture used for the C5 busy path, with a room carrying REAL `jtbd_transitioned`/`operator_transitioned` history and a deliberately absent JSON cache):
- `getCurrentJTBD` degrades to bare `null` (its cache reader, `jtbdState.getCurrent`, has no synthesized default) -- byte-identical to a genuine cold start.
- `getCurrentOperator` degrades to `{current: 'JUST_TALK', ..., source: 'cache_fallback'}` -- its cache reader, `operator.getCurrent`, SYNTHESIZES a default cold-start operator state when no cache file exists. This value is non-null (so a naive `!== null` check would miss the defect) and its `.current` field is the EXACT value a genuinely brand-new room with zero history would also show, even though this specific room has a real `operator_transitioned` event on record showing the operator is `'strategist'`. The `source: 'cache_fallback'` field IS technically present and would let a caller who checks it distinguish the two cases -- but the `.current` value alone, which is what most callers read, is indistinguishable from a cold start.

## Measured `=== 'no_room_db'` Consumer Count (required by this plan)

**0** (zero). Re-verified live via a run-time tree walk of `lib/`, `scripts/`, `bin/`, `hooks/` with comments stripped, matching the shell-level `grep -rn "=== 'no_room_db'"` re-run at the start of this plan's execution (also 0 matches). This is the safety argument (RESEARCH assumption A10) that makes minting `room_db_busy`/`room_db_broken` in 276-10 an additive, non-breaking change.

## Known Findings for a Future Plan (not fixed here, out of file scope)

- **`lib/core/breakthrough/scanner.cjs:124`** and **`lib/core/navigation/lens-nodes.cjs:254`** share the identical "catch a thrown `openRoomDb()` error and return `reason:'no_room_db'` without inspecting why" defect shape as spine-events.cjs's own C5 target, discovered by this plan's run-time census. `lens-nodes.cjs`'s own header comment literally says "mirrors spine-events". Neither file is in this plan's `files_modified`; both are recorded in `tests/test-276-spine-events-typed-reason.cjs`'s allowlist with a stated reason so the census does not silently drop them, and flagged here for 276-10 or a follow-up plan's consideration.
- **TOOLHON-11's measured producer count is 35, not 27.** 276-RESEARCH.md's prose cites 27; this is exactly why the plan mandates a run-time census rather than a frozen list -- the document was already stale relative to the live tree at the time this plan executed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 276-09 has an executable, unambiguous target: `node tests/test-276-busy-timeout-propagation.cjs` must flip A1-A5 from FAIL to PASS (each opener must genuinely wait on the busy timeout, not merely carry the option) without breaking the A6/B1-B3/C/D source-level pins (which assert the CURRENT absence of `timeout:5000` at 10 specific sites -- 276-09 will need to either update those pins to assert PRESENCE once fixed, or leave them as documented exclusions per the plan's own Group C/D disposition).
- Plan 276-10 has an executable, unambiguous target: `node tests/test-276-spine-events-typed-reason.cjs` must flip all 6 currently-failing assertions (4 direct `no_room_db` -> `room_db_busy`/`room_db_broken` misreports, plus the 2 Group D getter CONTRACT assertions), and should weigh the two out-of-scope sibling sites found above.
- No blockers. This plan wrote no production code and touched nothing under `scripts/`, `lib/`, or `bin/`, matching the plan's own success criteria.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*

## Self-Check: PASSED

Both created test files verified present on disk (`tests/test-276-busy-timeout-propagation.cjs`, `tests/test-276-spine-events-typed-reason.cjs`), this SUMMARY.md verified present on disk, and all three task commits (`1c665f20`, `75911b34`, `4fd8b065`) verified present in `git log --oneline --all`.
