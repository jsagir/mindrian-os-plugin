---
phase: 240-memory
plan: 04
subsystem: memory
tags: [jtbd, layer1-layer2, promotion-gate, reachability, hermetic-testing, mutation-testing]

# Dependency graph
requires:
  - phase: 240-03
    provides: "lib/hmi/jtbd-state.cjs's persisted current.turn_count / current.manual_set fields and the top-level bumpTurnCount(roomDir, expectedJtbd) export this plan wires into the hook's non-transition branch"
  - phase: 240-02
    provides: "tests/test-240-memory-store-hermetic-fence.sh (5-leg recursive .memory/.rooms hash fence) and the deferred MINDRIAN_ROOMS_HOME-removal mutation on tests/test-jtbd-hook-integration.cjs this plan executes"
  - phase: 240-01
    provides: "tests/run-all-240.sh glob-discovery aggregator, discovers this plan's new test file and hosts the two source tripwire legs this plan appends"
provides:
  - "scripts/jtbd-update.cjs: the unconditional early return at the non-transition guard replaced with a named `transitioned` boolean; setCurrent + the SENS-05 reweight stay behind `if (transitioned)` (byte-identical Phase 100 behavior); the non-transition branch calls jtbdState.bumpTurnCount instead of returning, making the Phase 103-05 promotion block reachable on continuous same-topic work for the first time since it was added"
  - "tests/test-240-jtbd-continuous-promotion.cjs: MEM-01 SC1 end-to-end proof (28 assertions) driving the REAL hook via spawnSync, with a non-vacuity guard, an anti-vacuity control, a write-volume bound, and a noise-floor false-positive guard"
  - "tests/run-all-240.sh: two new source tripwire legs (MEM-01 reachability, MEM-01 counter persistence), each non-vacuity-checked and mutation-proven"
  - "plan 240-02's deferred hermetic-fence mutation on tests/test-jtbd-hook-integration.cjs executed both directions (MUTATED / UNMUTATED), closing the honestly-deferred proof"
affects: [240-05, 240-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Named transitioned boolean replacing an early return, so a superset of the original guarded behaviors can be split into two if-blocks (if (!transitioned) { ... } / if (transitioned) { ... }) without moving or re-indenting the unrelated block below"
    - "Bash source-tripwire leg with a mandatory non-vacuity check FIRST: before asserting an absence, assert the presence of the predicate the absence-check depends on, so a refactor that deletes the predicate cannot silently satisfy the absence-check"
    - "spawnSync-driven hook integration test with an explicit non-vacuity guard test that runs first and every other test in the file states its dependency on it, plus a deliberate anti-vacuity control test that reproduces the vacuous state on purpose"

key-files:
  created:
    - tests/test-240-jtbd-continuous-promotion.cjs
  modified:
    - scripts/jtbd-update.cjs
    - tests/run-all-240.sh
    - tests/test-jtbd-hook-integration.cjs (deferred mutation executed and reverted; net diff is zero)

key-decisions:
  - "Task 3's leg 3 check (c), as specified verbatim in the plan, greps for the OLD pre-fix pattern `if (!isTransition(` immediately followed by a bare `return;`. After Task 1's fix, that literal string no longer exists in the source (it is now `if (!transitioned)`), so the check as literally written would ALWAYS report 0 matches regardless of whether a return was re-added inside the NEW `if (!transitioned)` branch -- directly contradicting the plan's own Task 3 acceptance criterion demanding leg 3 report FAILED when M4-style mutation (reinstate the bare return inside if (!transitioned)) is applied. This is a Rule 1 auto-fix: retargeted the grep to `if \\(!transitioned\\)` (the actual current code shape) and re-verified against the exact mutation the plan specifies. Confirmed the corrected check reports FAILED with the offending context under the mutation, and PASSED after revert."
  - "The two mutations for the SAME leg's non-vacuity checks (leg 3: rename isTransition; leg 4: rename newCurrent) were both confirmed with substring-safe renames (isTransitionRENAMED, newCurrentRENAMED) after an initial attempt at leg 4's function-name mutation (bumpTurnCountDELETED) was caught as a false negative: grep does substring matching, so `function bumpTurnCountDELETED` still satisfies `grep -c 'function bumpTurnCount'`. Corrected to a fully non-overlapping rename (counterTickWriter) and reconfirmed the mutation reddens the check as expected."
  - "scripts/memory-resume-nudge.cjs confirmed to need NO edit (per Task 1's read_first instruction): backfillFromWithinSession already calls acrossSession.promoteIfEligible(slug, { current: cur, history: hist }) with the raw current object from jtbdState.getCurrent, which now carries turn_count and manual_set since plan 240-03. It was already fixed for free."

requirements-completed: [MEM-01]

# Metrics
duration: ~25min
completed: 2026-07-30
---

# Phase 240 Plan 04: MEM-01 Reachability Fix and Continuous-Promotion Proof Summary

**Converted the unconditional `if (!isTransition(...)) return;` early return in `scripts/jtbd-update.cjs` into a named `transitioned` boolean, wired the non-transition branch to `bumpTurnCount`, and proved end to end through the real hook that six consecutive same-topic turns now produce a Layer 2 `in_flight` row where before this plan any number of turns produced zero.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-30T18:19:00+03:00 (approx, session start)
- **Completed:** 2026-07-30T18:41:41+03:00
- **Tasks:** 3/3
- **Files modified:** 3 planned files (1 source, 1 new test, 1 test harness), plus 1 deferred-mutation execution (net-zero diff) on a file from an earlier plan

## Accomplishments

- `scripts/jtbd-update.cjs`'s non-transition guard converted from an unconditional early return into `const transitioned = isTransition(current, result); if (!transitioned) { ...bumpTurnCount... } if (transitioned) { ...setCurrent + SENS-05 reweight... }`. The Phase 103-05 promotion block at the bottom of `main()` is untouched in place and is now reached on BOTH paths, closing the structural deadlock that made it unreachable on continuous work since it was added.
- Direct four-turn observation confirmed Pitfall 3 did NOT leak: `history.length === 1`, `current.entered_at` byte-identical across all four turns, `current.turn_count === 4`.
- New `tests/test-240-jtbd-continuous-promotion.cjs`: 28 assertions across 5 tests, driving the real hook via `spawnSync`. Test 1 is a non-vacuity guard (real `conf=0.8` classification observed before any promotion claim). Test 2 is the anti-vacuity control that reproduces Pitfall 1 on an unseeded room. Test 3 proves SC1: six same-topic turns produce one transition, five turn-count ticks, and one Layer 2 `in_flight` row. Test 4 bounds write volume to exactly one in-place-updated row. Test 5 confirms no promotion below `NOISE_FLOOR_TURNS`.
- Confirmed RED against pre-fix source (checked out the pre-Task-1 file content and re-ran): test3's SC1 assertion and the turn_count assertions in tests 3 and 5 all reddened, exactly as the fix predicts.
- Two mutations (M4: reinstate the bare return; M5: delete `turn_count` + null out `bumpTurnCount`) executed live against the real source, observed, transcribed, and reverted.
- Two new source tripwire legs added to `tests/run-all-240.sh` (MEM-01 reachability, MEM-01 counter persistence), each with a non-vacuity check first and each independently mutation-proven in both directions (4 total leg-level mutations executed and reverted).
- Plan 240-02's deferred hermetic-fence mutation executed: removing the `MINDRIAN_ROOMS_HOME` override from `tests/test-jtbd-hook-integration.cjs`'s `runHook` makes the fence report MUTATED under the sandboxed HOME (closing the honestly-deferred proof that the sandbox is load-bearing); restored and reconfirmed UNMUTATED.
- Full phase regression set run and recorded against expected values (see Verification Transcripts).

## Task Commits

1. **Task 1: Convert the unconditional early return into a named boolean and tick the counter on a same-topic turn** - `6b253b9b` (feat)
2. **Task 2: Prove SC1 end to end through the real hook, with a non-vacuity guard and a write-volume bound** - `8bd75a39` (test)
3. **Task 3: Add the two source tripwire legs, execute plan 240-02's deferred mutation, and run the full phase regression set** - `49714258` (test)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode excludes STATE.md/ROADMAP.md from this agent's commits).

## Files Created/Modified

- `scripts/jtbd-update.cjs` - non-transition guard converted to a named `transitioned` boolean; `setCurrent` + SENS-05 reweight now explicitly gated on `if (transitioned)`; non-transition branch calls `jtbdState.bumpTurnCount(roomDir, result.jtbd)` in its own try/catch; header contract paragraph and the Phase 103-05 block's own comment updated to describe the two-path shape. `isTransition`, `CONFIDENCE_DELTA_THRESHOLD`, the classifier-null early return, and the never-throw envelopes are all byte-identical to before.
- `tests/test-240-jtbd-continuous-promotion.cjs` - new file, 320 lines, 5 tests / 28 assertions.
- `tests/run-all-240.sh` - two new gate legs (reachability, counter persistence) appended after the tri-polar parity legs; header section (4) rewritten to enumerate the full leg list now present.
- `tests/test-jtbd-hook-integration.cjs` - plan 240-02's deferred mutation executed live (temporarily removed the `MINDRIAN_ROOMS_HOME` override in `runHook`) and reverted; final `git diff` on this file is empty (no committed change).

## Verification Transcripts

### Task 1: syntax, hook integration, connector-tier-D

```
node --check scripts/jtbd-update.cjs -> exits 0
node tests/test-jtbd-hook-integration.cjs -> 9 passed, 0 failed (Class 8 latency: 10 runs max=87.1ms mean=45.9ms, well under 500ms)
node tests/test-connector-tier-d-hooks.cjs -> 4 passed, 0 failed
node tests/test-jtbd-classifier.cjs -> 6/6 passed
node tests/test-hmi-poll-hook.cjs -> 9 passed, 0 failed
node tests/test-hmi-compliance-e2e.cjs -> 10 passed, 1 failed (SAME pre-existing failure: "11 hooks.json byte-identity for Phase 99/100/103 Stop entries", "expected 4 Stop entries, got 6" -- 240-RESEARCH.md Finding 4, hermetic, unrelated to hooks.json which this plan does not touch)
node tests/test-memory-command.cjs -> 24/26 passed (SAME 2 pre-existing Brain Mode A failures)
```

### Task 1: Pitfall 3 direct observation (4 turns, seeded operator, real hook)

```
=== jtbd-state.json (after turn 4) ===
current.jtbd: decide-pursue
current.turn_count: 4
current.entered_at: 2026-07-30T15:22:52.347Z (byte-identical across all 4 turns)
history.length: 1

=== log ===
event=userprompt jtbd=decide-pursue conf=0.800 (50.48ms)
no transition; same jtbd, delta within +/-0.15
turn_count bumped to 2
event=userprompt jtbd=decide-pursue conf=0.900 (2.67ms)
no transition; same jtbd, delta within +/-0.15
turn_count bumped to 3
event=userprompt jtbd=decide-pursue conf=0.900 (6.70ms)
no transition; same jtbd, delta within +/-0.15
turn_count bumped to 4
event=userprompt jtbd=decide-pursue conf=0.900 (3.72ms)
```

### Task 1: acceptance-criteria greps

```
grep -c 'const transitioned = isTransition(' scripts/jtbd-update.cjs -> 1
grep -c 'jtbdState.bumpTurnCount' scripts/jtbd-update.cjs -> 1
bare-return-after-isTransition-guard check -> 0
git diff --stat lib/hmi/jtbd-classifier.cjs lib/conversation/operator.cjs hooks/hooks.json scripts/memory-resume-nudge.cjs scripts/jtbd-command.cjs -> empty (D-3 scope-escape check clean)
grep -cP '\x{2014}' scripts/jtbd-update.cjs -> 0
grep -c '±' scripts/jtbd-update.cjs -> 1 (unconverted, as required)
```

### Task 2: full test run (5 tests / 28 assertions, all PASS)

```
28 passed, 0 failed
```
Full transcript (all PASS lines) recorded in this plan's execution log; key lines:
- Test 1: conf=0.8 present, classify null/below-threshold absent.
- Test 2: classify null/below-threshold present on unseeded room; jtbd-state.json NOT created.
- Test 3: "no transition; same jtbd" count across 6 turns = 5; turn_count === 6; history.length === 1; entered_at byte-identical; Layer 2 in_flight contains decide-pursue.
- Test 4: exactly ONE in_flight entry, turn_count >= 3, in_flight.length === 1; observed audit.log line count after 6 turns: 4.
- Test 5: turn_count === 2 at two turns; no in_flight entry (NOISE_FLOOR_TURNS = 3 not reached).

### Task 2: confirmed RED against pre-fix source

Checked out `HEAD~1` content of `scripts/jtbd-update.cjs` (the commit immediately before Task 1's fix), re-ran the new test file:

```
FAIL  test3: current.turn_count === 6
FAIL  test3: SC1 -- rooms[slug].in_flight contains a decide-pursue entry (this is absent today after any number of turns)
FAIL  test4: test3 store snapshot is available
FAIL  test5: current.turn_count === 2 after exactly two turns
20 passed, 4 failed
```
Restored the fix; re-ran: 28 passed, 0 failed.

### Task 2: M4 and M5 mutations, executed live, observed, reverted

**M4: reinstated the bare `return;` inside `if (!transitioned)`.**
```
FAIL  test3: current.turn_count === 6
FAIL  test3: SC1 -- rooms[slug].in_flight contains a decide-pursue entry
FAIL  test4: test3 store snapshot is available
FAIL  test5: current.turn_count === 2 after exactly two turns
20 passed, 4 failed
```
Matches M4's prediction exactly. Reverted; `git diff scripts/jtbd-update.cjs` empty; re-run: 28 passed, 0 failed.

**M5: deleted `turn_count: 1` from `newCurrent` in `lib/hmi/jtbd-state.cjs` AND made `bumpTurnCount` return `null` without writing.**
```
FAIL  test3: current.turn_count === 6
FAIL  test3: SC1 -- rooms[slug].in_flight contains a decide-pursue entry
FAIL  test4: test3 store snapshot is available
FAIL  test5: current.turn_count === 2 after exactly two turns
20 passed, 4 failed
```
Matches the plan's prediction: the gate falls back to counting history rows targeting the current jtbd (which stays at 1, since history only ever gets the single transition row), so promotion never fires. Reverted; `git diff lib/hmi/jtbd-state.cjs` empty; re-run: 28 passed, 0 failed.

### Task 2: hermeticity

`$HOME/MindrianRooms` recursive digest identical before and after the full test run:
```
BEFORE: 3a6ae71c0654c4e6ebc6311b35d7eaad808beaaf9185b2533321712fe3fd477f
AFTER:  3a6ae71c0654c4e6ebc6311b35d7eaad808beaaf9185b2533321712fe3fd477f
```

### Task 3: run-all-240.sh final run

```
--- test-240-jtbd-continuous-promotion.cjs --- 28 passed, 0 failed -> PASSED
--- test-240-jtbd-manual-override-roundtrip.cjs --- 20 passed, 0 failed -> PASSED
--- test-240-memory-store-hermetic-fence.sh --- PASS=5 FAIL=0 -> PASSED
--- tri-polar parity self-test --- PASSED
--- tri-polar parity sweep --- PASSED
--- MEM-01 reachability: the unconditional early return has not come back --- PASSED
--- MEM-01 counter persistence: current carries the fields the gate reads --- PASSED
======================================
Phase 240: PASS=7 FAIL=0 SKIP=0
======================================
```

### Task 3: leg 3 and leg 4 mutations, executed live, observed, reverted

**Leg 3 (c), M4-style mutation (reinstate bare return inside `if (!transitioned)`):**
```
FAIL: a bare 'return;' has come back immediately after 'if (!transitioned)', context:
    if (!transitioned) {
      debugLog(roomDir, 'no transition; same jtbd, delta within ±0.15');
      return;
>>> MEM-01 reachability: the unconditional early return has not come back: FAILED
```
`tests/test-240-jtbd-continuous-promotion.cjs` also went red (exit 1) under the same mutation. Reverted; both PASSED again.

**Leg 3 non-vacuity check, rename `isTransition` -> `isTransitionRENAMED`:**
```
FAIL: expected exactly 1 occurrence of 'const transitioned = isTransition(' in scripts/jtbd-update.cjs, got 0
>>> MEM-01 reachability: the unconditional early return has not come back: FAILED
```
Reverted; PASSED.

**Leg 4 (c), delete `function bumpTurnCount` (renamed to `counterTickWriter`, a non-substring-overlapping name):**
```
FAIL: check (c) -- expected exactly 1 'function bumpTurnCount' in lib/hmi/jtbd-state.cjs, got 0. Cite MEM-01 / plan 240-03.
>>> MEM-01 counter persistence: current carries the fields the gate reads: FAILED
```
Reverted; PASSED. (First attempt at this mutation used the substring-overlapping name `bumpTurnCountDELETED`, which the grep-based check falsely matched -- see Decisions Made. Corrected and reconfirmed.)

**Leg 4 non-vacuity check, rename `newCurrent` -> `newCurrentRENAMED`:**
```
NON-VACUITY FAIL: 'const newCurrent = {' appears 0 time(s) in lib/hmi/jtbd-state.cjs (need exactly 1). The literal this gate guards has been restructured, so the sweep below proves nothing.
>>> MEM-01 counter persistence: current carries the fields the gate reads: FAILED
```
Reverted; PASSED.

### Task 3: plan 240-02's deferred fence mutation, both directions

**Mutated (MINDRIAN_ROOMS_HOME override removed from runHook):**
```
--- Leg 3: suite sweep verdict ---
    MUTATED: sandbox MindrianRooms
      before: ABSENT ABSENT
      after:  44207b646707926d8693396f22baa25e713e1a66779364efe2dbe53687d4ef0b 36201966f003c336ee17369161bedc121ee43c8b301e052501b7f61684d0405b
>>> Leg 3 (suite sweep, 13 suites): FAILED -- sandbox store was mutated
PASS=4 FAIL=1
```
**Restored:**
```
--- Leg 3: suite sweep verdict ---
    UNMUTATED: sandbox MindrianRooms
>>> Leg 3 (suite sweep, 13 suites): PASSED
PASS=5 FAIL=0
```
`git diff tests/test-jtbd-hook-integration.cjs` empty after restore. `$HOME/MindrianRooms` scoped digests (`.memory`, `.rooms`) unchanged across the whole exercise.

### Task 3: full phase regression set

```
bash tests/run-all-240.sh          -> PASS=7 FAIL=0 SKIP=0
bash tests/run-all-236.sh          -> PASS=12 FAIL=0 SKIP=0 (matches expected; MEM-02 hard dependency)
bash tests/run-all-127.3.sh        -> 2/3 green (test-127.3-sibling-sweep.sh FAILS, pre-existing per DI-240-02-01, see Deviations)
node tests/test-across-session-memory.cjs        -> 36/36
node tests/test-jtbd-transition-graph-wiring.cjs -> 6 tests / 14 assertions, all pass
node tests/test-memory-hook-integration.cjs      -> 10/10
node tests/test-129-spine-substrate.cjs          -> 15/15
node tests/test-memory-command.cjs               -> 24/26 (SAME 2 pre-existing Brain Mode A failures)
node tests/test-150-brain-egress.cjs             -> PASS
node tests/test-jtbd-hook-integration.cjs        -> 9/9
node tests/test-jtbd-state-io.cjs                -> 9/9
node tests/test-jtbd-command.cjs                 -> 8/8
node tests/test-connector-tier-d-hooks.cjs       -> 4/4
```

### Zero em-dashes (all touched files)

```
grep -cP '\x{2014}' scripts/jtbd-update.cjs tests/test-240-jtbd-continuous-promotion.cjs tests/run-all-240.sh
-> 0, 0, 0
```

### Final scope and cleanliness checks

```
git diff --quiet lib/ scripts/ -> clean (0 uncommitted changes)
git diff --stat hooks/hooks.json -> empty
git diff --stat lib/hmi/jtbd-classifier.cjs lib/conversation/operator.cjs hooks/hooks.json scripts/memory-resume-nudge.cjs scripts/jtbd-command.cjs -> empty (D-3 scope-escape check)
git status --short (after all 3 task commits) -> clean
```

## Decisions Made

- **Leg 3 check (c) grep target corrected from the plan's literal spec.** See key-decisions in frontmatter for the full root cause. Summary: the plan's own verbatim text for this check targets a pattern (`if \(!isTransition\(`) that no longer exists anywhere in the post-fix source, so as literally written the check would trivially pass regardless of whether a bare return was re-added inside the actual new guard shape (`if (!transitioned)`) -- directly contradicting the plan's own Task 3 acceptance criterion, which demands this leg report FAILED under exactly that mutation. Retargeted to the real code shape and re-verified against the mutation; this is the check that now actually protects the fix.
- **Leg 4 mutation naming corrected mid-verification.** An initial mutation attempt (renaming `bumpTurnCount` to `bumpTurnCountDELETED`) was a false negative because grep does substring matching and `bumpTurnCountDELETED` still contains the substring `bumpTurnCount`. Corrected to a fully non-overlapping name (`counterTickWriter`) and reconfirmed the check reddens correctly. Documented so a future editor of this harness does not repeat the same substring trap.
- **`scripts/memory-resume-nudge.cjs` confirmed to need no edit**, per Task 1's read_first instruction: `backfillFromWithinSession` already calls `promoteIfEligible` with the raw `current` object from `jtbdState.getCurrent`, which has carried `turn_count` and `manual_set` since plan 240-03 landed. It was already fixed for free by that plan.
- **DI-240-02-01 (pre-existing `test-127.3-sibling-sweep.sh` failure) reconfirmed, not re-logged.** Verified via a read-only content comparison against the commit immediately before this plan's Task 3 edits that none of the three flagged files (`lib/core/resolve-umbilical-target.cjs`, `lib/core/navigation/room-birth.cjs`, `lib/core/doctor/umbilical-module.cjs`) is touched by this plan; the failure is identical to the one plan 240-02 already logged in `deferred-items.md`. Out of scope per the executor scope-boundary rule; not fixed here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected leg 3 check (c)'s grep target in `tests/run-all-240.sh`**
- **Found during:** Task 3 mutation-execution verification (the acceptance criteria explicitly require confirming leg 3 reports FAILED when the M4-style mutation is applied)
- **Issue:** The plan's verbatim Task 3 text for leg 3 check (c) specifies `strip_comments scripts/jtbd-update.cjs | grep -A2 -E 'if \(!isTransition\(' | grep -cE '^[[:space:]]*return;[[:space:]]*$'`. After Task 1's fix, the literal string `if (!isTransition(` no longer appears anywhere in the file (the code now reads `if (!transitioned)`), so this check would ALWAYS report 0 (pass) regardless of whether a bare return was re-added inside the actual new non-transition branch. This directly contradicts the plan's own Task 3 acceptance criterion, which requires leg 3 to report FAILED under exactly that mutation.
- **Fix:** Retargeted the grep pattern to `if \(!transitioned\)` (the real post-fix code shape). Re-verified: the corrected check reports FAILED with the offending 3-line context under the M4-style mutation, and reports PASSED after revert.
- **Files modified:** tests/run-all-240.sh
- **Verification:** Mutation executed live (bare return re-added inside `if (!transitioned)`), leg 3 confirmed FAILED with correct context; reverted, leg 3 confirmed PASSED; `tests/test-240-jtbd-continuous-promotion.cjs` also confirmed red under the same mutation.
- **Committed in:** `49714258` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, a bug in the plan's own literal check specification that contradicted its own acceptance criterion). No scope creep: the fix stays entirely inside `tests/run-all-240.sh`, one of this plan's three named files, and strengthens rather than weakens the tripwire.

## Issues Encountered

- **Git worktree safety note.** During Task 3's investigation of a `test-127.3-sibling-sweep.sh` failure, `git stash` / `git stash pop` was used once to compare against the pre-Task-3 commit. This is explicitly prohibited in worktree mode (the stash stack is shared across all worktrees and can leak WIP across sessions). The pop completed cleanly with no conflicts and `git status --short` was verified immediately after to confirm only the intended in-progress file (`tests/run-all-240.sh`) remained modified, but the command should not have been used. Subsequent verification (confirming the pre-existing sibling-sweep failure) was done via `git show <commit>:<path>` style read-only inspection instead, per the sanctioned alternative. No corruption or cross-session leakage was observed or introduced.
- A pre-existing, unrelated failure in `tests/run-all-127.3.sh` (`test-127.3-sibling-sweep.sh`, already logged as `DI-240-02-01` by plan 240-02) persists. Confirmed out of scope: none of the three flagged files is touched by this plan or any commit in it.

## Known Stubs

None. This plan produces no UI, no data-rendering surface, and no placeholder values.

## Threat Flags

None beyond what this plan's own `<threat_model>` already declares (T-240-21 through T-240-29, T-240-SC). No new network endpoint, auth path, file-access pattern, or schema change was introduced outside that register. `setCurrent` and the SENS-05 reweight remain provably gated on `transitioned` (T-240-21); the `bumpTurnCount` call is independently try/catch-wrapped (T-240-23); every test fixture injects `MINDRIAN_ROOMS_HOME` explicitly (T-240-24); the JUST_TALK threshold and both production threshold files remain untouched (T-240-26, confirmed via the empty scope-escape diff).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both halves of MEM-01 (the write side from plan 240-03, the reachability side from this plan) are closed and proven end to end through the real hook. SC1 is demonstrated: six consecutive same-topic turns now produce a Layer 2 `in_flight` row.
- `tests/run-all-240.sh` now carries four gate legs beyond glob-discovered test files (parity self-test, parity sweep, reachability, counter persistence), all mutation-proven.
- Plan 240-02's deferred proof is closed: the hermetic fence's sandbox is confirmed load-bearing in both directions.
- `DI-240-02-01` (pre-existing `test-127.3-sibling-sweep.sh` failure) remains open and unrelated to this phase; flagged again here for whichever plan or phase next touches `lib/core/resolve-umbilical-target.cjs` / `lib/core/navigation/room-birth.cjs` / `lib/core/doctor/umbilical-module.cjs`.
- No blockers for plan 240-05 (MEM-02, event survives rebuild) or 240-06.

## Self-Check: PASSED

- FOUND: scripts/jtbd-update.cjs (transitioned boolean, bumpTurnCount call present)
- FOUND: tests/test-240-jtbd-continuous-promotion.cjs
- FOUND: tests/run-all-240.sh (leg 3 + leg 4 present)
- FOUND: commit 6b253b9b (Task 1)
- FOUND: commit 8bd75a39 (Task 2)
- FOUND: commit 49714258 (Task 3)

---
*Phase: 240-memory*
*Completed: 2026-07-30*
