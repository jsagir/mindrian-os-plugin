---
phase: 237-reach-mechanism
plan: 03
subsystem: infra
tags: [chain-executor, decide, decision-gate, dead-code-removal, mutation-testing]

# Dependency graph
requires:
  - phase: 237-reach-mechanism
    provides: "237-02's collapse of chain_run onto the one posture authority (recipe-maps.postureForCommand), which this plan's fixture assumed was settled so the decide() defect could be isolated cleanly"
provides:
  - "lib/core/chain-executor.cjs with the decorative decide() default removed from both the sync runChain and async _runChainResilient paths, while the opts.decideFn injection seam (used by scripts/act-command.cjs) is byte-for-byte preserved"
  - "tests/test-237-decide-census.cjs: a 6-leg source-fence + behavioral + mutation-proven census that will catch any future reintroduction of a default that computes a decision without an injected seam"
affects: [237-04, 237-05, 237-06, 237-07, 237-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Default-fallback source scan (regex over comment-stripped code) rather than call-site literal grep, when the call site itself must survive unchanged and only its default needs fencing"
    - "require-cache identity assertion before installing a spy on a lazily-required module, so an interception failure fails loudly instead of silently passing a spy nobody observes"
    - "__dirname global-token-replace pinning for a tmp-copy mutation harness, when the source module resolves ALL of its own requires via path.join(__dirname, ...) rather than literal relative require strings"

key-files:
  created:
    - tests/test-237-decide-census.cjs
  modified:
    - lib/core/chain-executor.cjs

key-decisions:
  - "Leg 1's source fence was implemented against the decideFn default-fallback ternary's resolved value (must be exactly `null`) rather than against the literal call-site text `decideFn({ step:`, because the plan's own Task 2 explicitly requires that call-site text to survive unchanged at both sites (it is the seam scripts/act-command.cjs's adapted injection depends on). Grepping for it would have made the census permanently unsatisfiable. Documented in the test file's header comment and here per the plan's own transparency instruction."
  - "test-237-decide-census.cjs's __dirname-occurrence floor for the Leg 6 mutation-harness pin was set to 4 (not the pre-fix 5), because deleting _loadDecide() correctly removed one of its five require(path.join(__dirname, ...)) call sites. This is an expected, correct consequence of Task 2's own change, not a weakened check -- verified by re-running the full mutation cycle (RED with the default restored, GREEN after byte-identical restore)."
  - "tests/test-act-on-runchain.cjs's pre-existing failure (stale FIRE-IF-FORK render baseline, unrelated to decide()) was NOT fixed -- it is out of this plan's files_modified scope and was already tracked in deferred-items.md by 237-01. Re-confirmed byte-identical failure before and after this plan's changes to prove it is not a regression."

requirements-completed: [REACH-01]

# Metrics
duration: ~35min
completed: 2026-07-28
---

# Phase 237 Plan 03: decide() Call-Site Census Summary

**Deleted `_loadDecide()` and nulled both `chain-executor.cjs` decideFn defaults (sync + async), so a chain run with no injected seam never touches the real `decide()`, while `scripts/act-command.cjs`'s adapted CIRS R4 injection keeps reaching it unchanged.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 2 (`lib/core/chain-executor.cjs`, `tests/test-237-decide-census.cjs`)

## Accomplishments

- Authored a 6-leg census (`tests/test-237-decide-census.cjs`) proving, behaviorally and via mutation, that the decorative `decide()` default is gone from both the sync and async chain-executor paths while the `opts.decideFn` seam still fires exactly once per executed step on both paths.
- Removed `_loadDecide()` and nulled both `const decideFn = ... ? o.decideFn : ...` defaults in `lib/core/chain-executor.cjs`, leaving the call sites, try/catch bodies, and `decision_trace` trace-entry writes untouched.
- Live-verified the mutation re-check on the actual working tree (not just the tmp-copy harness): restored the decorative default, captured RED, restored byte-identically (md5-verified), reconfirmed GREEN.

## Task Commits

1. **Task 1: Author the decide() call-site census and prove the seam contract both ways** - `80b8e133` (test)
2. **Task 2: Delete the default decide() load and both unadapted call arguments, keeping opts.decideFn honored** - `e1ba1dd0` (fix)

## Files Created/Modified

- `tests/test-237-decide-census.cjs` - New. 6-leg census: source fence, default-is-gone (sync), seam-survives (sync), async-path parity (both legs repeated), fault-tolerance on a throwing injected decideFn, and a tmp-copy mutation proof.
- `lib/core/chain-executor.cjs` - `_loadDecide()` deleted; both `decideFn` defaults changed from `_loadDecide()` to `null`; call sites, try/catch bodies, and `decision_trace` trace writes left in place; module header, `opts` contract JSDoc, and both call-site comments updated to document why the default was removed while the seam was kept.

## Decisions Made

See `key-decisions` in frontmatter above (Leg 1 reinterpretation, `__dirname` floor correction, and the pre-existing `test-act-on-runchain.cjs` failure left untouched).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Leg 1's source-fence assertion, as literally described in the plan prose, would have been permanently unsatisfiable**
- **Found during:** Task 1 (authoring the census)
- **Issue:** The plan's Leg 1 description says the census must find "zero occurrences of a `decideFn(` call whose first argument literal is `{ step:`". That literal text is exactly `decideFn({ step: step, index: i }, ...)`, the call-site itself Task 2 explicitly requires to survive unchanged at both sites (it is the seam `scripts/act-command.cjs`'s adapted injection depends on). A grep for that pattern would fail forever, before AND after the fix.
- **Fix:** Implemented Leg 1's second check against the decideFn default-fallback ternary's resolved value instead (must be exactly `null`), which correctly distinguishes "the DEFAULT computes a real decision" (the actual defect) from "the SEAM call site exists" (required, not a defect). Documented the substitution explicitly in the test file's header comment, per the plan's own instruction not to quietly weaken a leg.
- **Files modified:** tests/test-237-decide-census.cjs
- **Verification:** Leg 1 correctly fails pre-fix (found `_loadDecide` present, 3 occurrences) and correctly passes post-fix (0 occurrences, both defaults exactly `null`).
- **Committed in:** `80b8e133` (Task 1), refined for accuracy in `e1ba1dd0` (Task 2, see item 2 below).

**2. [Rule 1 - Bug] Leg 6's `__dirname`-occurrence floor was authored against the pre-fix count and needed correction**
- **Found during:** Task 2, first post-fix census run
- **Issue:** Task 1's Leg 6 mutation-pin helper asserted `__dirname` appears at least 5 times in `chain-executor.cjs` (the pre-fix count, including `_loadDecide`'s own `require(path.join(__dirname, 'navigation-engine.cjs'))`). Task 2 correctly deletes that one occurrence as part of removing `_loadDecide()`, dropping the true count to 4.
- **Fix:** Updated the floor assertion to `>= 4` with a comment explaining the expected count change is a consequence of the real fix, not source drift.
- **Files modified:** tests/test-237-decide-census.cjs
- **Verification:** Full 6-leg census re-run GREEN after the correction; the mutation harness still correctly restores the decorative default and shows the spy going non-zero.
- **Committed in:** `e1ba1dd0` (Task 2, same commit as the chain-executor.cjs fix, since the two changes are directly coupled)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - test-authoring bugs found and corrected before the census was trusted). Neither deviation touched `scripts/act-command.cjs` or weakened any of the six legs' actual guarantees; both make the census MORE precise, not less.
**Impact on plan:** No scope creep. Both fixes were necessary for the census to be a real, non-vacuous gate rather than a permanently-red or permanently-misconfigured one.

## Issues Encountered

`tests/test-act-on-runchain.cjs` fails both before and after this plan's changes (confirmed by running it against the untouched baseline prior to any edit, then again after Task 2). The failure is a stale hardcoded render-baseline string that predates the `FIRE-IF-FORK` block `lib/hmi/selector-dispatcher.cjs` now injects into every gated-halt card (a Phase 210-era addition, SEED-021). This file is not in 237-03-PLAN.md's `files_modified` list and the failure is unrelated to `decide()`; it was already logged in `.planning/phases/237-reach-mechanism/deferred-items.md` by Plan 237-01. Not fixed here, per the SCOPE BOUNDARY rule. As a direct consequence, `bash tests/run-all-237.sh` reports `Passed: 8  Failed: 1  Skipped: 6` rather than `Failed: 0` -- the single failure is this pre-existing, unrelated regression leg. `REACH-01 decide() call-site census + seam preservation: PASSED` is present in the aggregator's stdout as required.

## Mutation-Proof Captures (required by the plan)

**Pre-fix RED (Task 1, before Task 2 landed)** -- `node tests/test-237-decide-census.cjs`, exit 1:
```
test-237-decide-census
  FAIL - Leg 1 SOURCE FENCE: _loadDecide symbol gone; every decideFn default fallback is exactly null
    expected zero occurrences of _loadDecide in comment-stripped source; got 3
  FAIL - Leg 2 DEFAULT IS GONE: no decideFn injected -> decision_trace null, zero decide() calls (sync path)
    expected decision_trace === null on every trace entry when no decideFn is injected
    (actual: a full populated decision object from the real decide(), not null)
  ok - Leg 3 SEAM SURVIVES: an injected decideFn fires once per executed step and lands its own trace value (sync path)
  FAIL - Leg 4 ASYNC PATH PARITY: legs 2 and 3 repeated against _runChainResilient (roomDir forces the async path)
    async path: expected decision_trace === null on every trace entry when no decideFn is injected
  ok - Leg 5 FAULT TOLERANCE: a throwing injected decideFn leaves decision_trace null and does not abort the chain
  FAIL - Leg 6 MUTATION: restoring the decorative default in a tmp copy makes the spy record non-zero invocations
    expected the decideFn default-fallback needle to appear at least twice (sync + async sites); found 0
    (this leg targets the POST-Task-2 source shape -- expected to fail this way pre-fix)

FAIL: test-237-decide-census (4 failed, 2 passed, of 6 legs)
```

**Post-fix GREEN (Task 2, after the change landed)** -- `node tests/test-237-decide-census.cjs`, exit 0:
```
test-237-decide-census
  ok - Leg 1 SOURCE FENCE: _loadDecide symbol gone; every decideFn default fallback is exactly null
  ok - Leg 2 DEFAULT IS GONE: no decideFn injected -> decision_trace null, zero decide() calls (sync path)
  ok - Leg 3 SEAM SURVIVES: an injected decideFn fires once per executed step and lands its own trace value (sync path)
  ok - Leg 4 ASYNC PATH PARITY: legs 2 and 3 repeated against _runChainResilient (roomDir forces the async path)
  ok - Leg 5 FAULT TOLERANCE: a throwing injected decideFn leaves decision_trace null and does not abort the chain
  ok - Leg 6 MUTATION: restoring the decorative default in a tmp copy makes the spy record non-zero invocations

PASS: test-237-decide-census (6/6 legs)
```

**Live working-tree mutation re-check (Task 2's own acceptance criterion, performed on the real file, not just the tmp-copy harness):**

1. Copied `lib/core/chain-executor.cjs` to a scratchpad backup (md5 `2719cbcd0548720aa64d0ed51c5738ce`).
2. Textually restored the decorative default in the working tree (both `: null` fallbacks replaced with `: require(path.join(__dirname, 'navigation-engine.cjs')).decide`).
3. Ran the census: exit 1, Leg 1 FAIL ("found `require(path.join(__dirname, 'navigation-engine.cjs')).decide`" instead of `null`), Leg 2 FAIL (full populated decision object instead of `null`), Leg 4 FAIL (same on async path), Leg 6 FAIL (needle already present -- irrelevant while the file itself carries the mutation). Leg 3 and Leg 5 still PASS (the seam itself was untouched by this mutation).
4. Restored the file from the scratchpad backup; `md5sum` matched the pre-mutation hash exactly (`2719cbcd0548720aa64d0ed51c5738ce`).
5. Re-ran the census: exit 0, 6/6 GREEN.
6. `git status --porcelain lib/core/chain-executor.cjs` was clean relative to the Task 2 commit both before and after the live re-check (the mutation and restore never left a diff against the committed state).

## Leg 2 Require-Cache Spy: Worked As Designed (No Fallback Needed)

The plan's Task 1 action anticipated a possible failure mode where the lazy `require(path.join(__dirname, 'navigation-engine.cjs'))` inside `chain-executor.cjs` might resolve to a different module-cache entry than the one this test spies on, requiring a documented fallback (source-fence-only assertion). This did not occur: `require.resolve()` from both the test's own path and from `chain-executor.cjs`'s `__dirname`-relative path resolved to the identical absolute file, and the spy installed on `navEngine.decide` was observed correctly by the module under test in every leg (2, 4, and the Leg 6 mutation). No fallback was needed.

## Observation Recorded Per Plan Instruction (Not Fixed Here)

`scripts/act-command.cjs:262` feeds the real `decide()` a synthetic `sessionId: 'act-chain-' + idx` rather than a real session id. This is out of REACH-01's scope (and out of REACH-03's stated scope, which targets the sensor-marker session-bleed leg, not `decide()`'s own turn construction). Recorded here per the plan's explicit instruction; not touched by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/core/chain-executor.cjs`'s decide() call sites are now honest: no chain run computes a decision unless a caller injects an adapted `decideFn`, proven on both the sync and async paths.
- `scripts/act-command.cjs`'s CIRS R4 adapted injection is unmodified and its three named regression suites (`test-act-on-runchain.cjs` pre-existing failure aside) remain green.
- REACH-01's remaining half (the real dispatcher replacing `makeDefaultOnStep`'s fabricated `quality: 'high'`) is scoped to later 237 plans (per 237-RESEARCH.md's Recommended Implementation Order) and is untouched by this plan.
- No blockers for 237-04 through 237-08. The `tests/test-act-on-runchain.cjs` staleness remains open in `deferred-items.md` for a future `/gsd-quick` fix outside this milestone's declared scope.

---
*Phase: 237-reach-mechanism*
*Completed: 2026-07-28*

## Self-Check: PASSED
- FOUND: tests/test-237-decide-census.cjs
- FOUND: lib/core/chain-executor.cjs
- FOUND: .planning/phases/237-reach-mechanism/237-03-SUMMARY.md
- FOUND commit: 80b8e133 (test(237-03))
- FOUND commit: e1ba1dd0 (fix(237-03))
