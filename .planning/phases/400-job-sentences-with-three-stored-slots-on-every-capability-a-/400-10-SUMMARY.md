---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 10
subsystem: decision-advisor
tags: [cynefin, decision-advisor, next-move, command-resolver, selection-log, cy-05, cy-07, part-8, part-9]

requires:
  - phase: 400-08
    provides: lib/core/navigation/cause-effect.cjs (readCauseEffect, readCauseEffectForRoom, writeCauseEffect)
  - phase: 400-09
    provides: lookupShortlist and strongOrder with causeEffect; publicShortlist domain and domain_note
provides:
  - composeNextMove accepts causeEffect; nextMoveForSection reads the room domain on the advisor-on path only
  - composeWorkflow accepts opts.causeEffect (chaotic abstains, a reordered domain orders by strongOrder)
  - advisorOptsForRoom adds causeEffect only when the room has a stored domain
  - selection_observations.cause_effect_domain (new tables and an additive race-safe migration)
  - recordSelectionOutcome writes the domain (explicit closed arg, else the stored domain, else null)
  - aliases.yml entry selection_observations_cause_effect_domain (EXTEND, source_phase 400)
affects: [400-11, 400-12, 400-14]

tech-stack:
  added: []
  patterns:
    - "A 399 reference consumer loaded from git at the plan base, with relative requires pointed at the real folder, to prove exact 399 output"
    - "A stale-view proxy over a real db to prove that a lost migration race is not an error"

key-files:
  created:
    - tests/test-400-advisor-consumers.cjs
    - tests/test-400-selection-domain.cjs
  modified:
    - lib/core/feyminto/next-move.cjs
    - lib/workflow/command-resolver.cjs
    - lib/core/navigation/selection-log.cjs
    - lib/core/memory-ops.cjs
    - .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml
    - tests/run-all-400.sh

key-decisions:
  - "advisorOptsForRoom returns the 399 object shape when the room has no domain, and adds causeEffect only when one is stored, so test-399-workflow-advisor W6b (deep-equal on the options and the source regex) stays green."
  - "recordSelectionOutcome passes the domain into the recomputed shortlist key, so advisor_top and advisor_rank match what the domain-aware consumers showed; with no domain the key and the rows are the 399 ones."
  - "An explicit args.causeEffect outside the closed set writes null and does not fall back to the stored domain (the jobId idiom: a given arg is final)."
  - "The new column is the last column of the table definition, so a migrated 399 table and a new table share the column order."

patterns-established:
  - "Consumers read the domain through cause-effect.cjs readCauseEffectForRoom, called at call time inside the advisor-on branch (a spy can count the reads)."

requirements-completed: [CY-05, CY-07]

duration: 10min
completed: 2026-11-24
---

# Phase 400 Plan 10: Domain in the advisor consumers and the selection log Summary

The room's cause and effect domain now reaches the one advisor lookup from both consumers (the next-move selector and composeWorkflow), and every selection row records the domain beside the deprecated cynefin_rating. With the advisor off, no stored domain, or an unknown domain, both consumers give exactly the 399 output.

## Performance

- **Duration:** about 10 min
- **Started:** 2026-11-24T10:58:00Z
- **Completed:** 2026-11-24T11:08:00Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- next-move.cjs: nextMoveForSection reads the domain with readCauseEffectForRoom(nest.roomDir) inside the advisorEnabled() branch, beside definitionLevel, and passes it as causeEffect. composeNextMove passes causeEffect to lookupShortlist. When shortlist.domain.effect is reordered, each strong option gets the value (strong count minus its index), so the sort keeps the domain order; else the 399 calibrated values.
- command-resolver.cjs: _advisorContext adds causeEffect to the query, abstains also for chaotic, and keeps domainOrder = sl.strongOrder(query) when the shortlist domain effect is reordered. _rankCommands orders the strong commands by their index in domainOrder; strong commands absent from it follow in value order.
- memory-ops.cjs: initSelectionSchema adds the cause_effect_domain TEXT column for new tables and migrates a 399 table with the ground_truth_label precedent (column check, add, look again after a failure).
- selection-log.cjs: readFeatures(db, args) adds the domain (explicit closed arg, else readCauseEffect(db), else null); the insert writes the new column; cynefin_rating is unchanged.

## Task Commits

1. **Task 1: next-move and composeWorkflow pass the domain (CY-05)** - `3b637bdf2` (test, RED), `913f2b6fc` (feat, GREEN)
2. **Task 2: The selection log records the domain (CY-07)** - `b701fcaf7` (test, RED), `3def1e0be` (feat, GREEN)

## Files Created/Modified

- `tests/test-400-advisor-consumers.cjs` - legs X1 to X6 and X5b (8 checks)
- `tests/test-400-selection-domain.cjs` - legs L1, L1b, L2 to L5 (6 checks)
- `lib/core/feyminto/next-move.cjs` - causeEffect input and the nest-path domain read
- `lib/workflow/command-resolver.cjs` - causeEffect in the advisor context, the chaotic abstain, the domain order, advisorOptsForRoom
- `lib/core/navigation/selection-log.cjs` - readDomain, readFeatures(db, args), the new insert column
- `lib/core/memory-ops.cjs` - the new column and its migration
- `.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml` - the EXTEND entry, the section header count 1 to 2
- `tests/run-all-400.sh` - runs the 2 new tests

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The selection log recomputed the shortlist without the domain**
- **Found during:** Task 2
- **Issue:** The writer recomputes the shown shortlist at the decision seam "with the same key" as the consumers. After Task 1 the consumers use the domain, so a key without it would log an advisor_top that the navigator did not see (for example a strong top under chaotic, where the consumers show no strong pick).
- **Fix:** The recompute query carries causeEffect: f.domain. No domain gives the 399 query. Leg L3 and test-399-selection-log (all legs) prove the 399 rows are unchanged.
- **Files modified:** lib/core/navigation/selection-log.cjs
- **Commit:** 3def1e0be

**2. [Rule 3 - Blocking] advisorOptsForRoom kept the 399 shape**
- **Found during:** Task 1
- **Issue:** test-399-workflow-advisor W6b deep-equals the options to {jobId, definitionLevel} and matches a source regex. A causeEffect key that is always present (null) breaks W6b.
- **Fix:** The key is added only when the room has a stored domain.
- **Files modified:** lib/workflow/command-resolver.cjs
- **Commit:** 913f2b6fc

**3. [Rule 3 - Blocking] X3 fixture rows**
- **Found during:** Task 1
- **Issue:** The plan 09 fixture row for validate-idea names /mos:explain-decision, which does not serve validate-idea, so the selector job key (not the advisor) decides its order. No framework holds a utility analyze command, so composeWorkflow cannot rank one.
- **Fix:** The test writes a run-time table with the plan 09 key order. next-move: job explore, /mos:opportunities (utility analyze, strong top) and /mos:beautiful-question (methodology probe). composeWorkflow: Six Thinking Hats, /mos:bono (methodology analyze, strong top) and /mos:think-hats (methodology probe). The intent of X3 holds: the fit probe command goes ahead of a strong non-fit command.
- **Files modified:** tests/test-400-advisor-consumers.cjs
- **Commit:** 3b637bdf2

**4. [Rule 1 - Bug] Test replay dedupe in L2**
- **Found during:** Task 2
- **Issue:** Two identical CLI calls inside REPLAY_WINDOW_MS dedupe (WR-02), so the second L2 call wrote no row and the read bound undefined.
- **Fix:** The test helper passes a unique dedupe_key per call and asserts that each call wrote rows.
- **Files modified:** tests/test-400-selection-domain.cjs
- **Commit:** 3def1e0be

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking). No scope change.

## Base Exit Codes (recorded before the first edit)

- test-399-selector-advisor, test-399-workflow-advisor, test-399-one-selector-fence, test-399-selection-log, test-369-hook-require-graph, test-3696-one-next-move: 0 at base, 0 after.
- lib/workflow/command-resolver.test.cjs: 1 at base, 1 after, identical output without stack lines (the known failure).
- tests/test-36925-next-move.cjs: 1 at base (X5 footer leg), 1 after, the same failed leg.

## TDD Gate Compliance

test commits 3b637bdf2 and b701fcaf7 come before feat commits 913f2b6fc and 3def1e0be. RED was confirmed: X2 (read count 0), X3, X4, X5 failed; L1, L1b, L2, L3, L5 failed.

## Verification

- `node tests/test-400-advisor-consumers.cjs`: 8 passed, 0 failed.
- `node tests/test-400-selection-domain.cjs`: 6 passed, 0 failed.
- `bash tests/run-all-400.sh`: exit 0. `bash tests/run-all-399.sh`: exit 0.
- Every tests/test-399-*.cjs, test-159-closeoffer-reachid-forward, test-189-who-attribution, test-159-part8-secretreason-sweep, test-159-consume-f1-pick, test-c8j-suggest-next-offer, test-sensors-part8-sweep, test-sensors-routing-fence: exit 0.
- test-237-one-authority-fence, test-248-resolver-census, test-346-no-second-brain, test-posture-ids-drift, test-recipe-maps-authority, test-399-one-selector-fence, test-369-hook-require-graph: exit 0.
- `node scripts/check-schema-aliases.cjs` on the staged diff of Task 2: exit 0. `node scripts/check-substrate.cjs`: exit 0.
- `node scripts/build-skill-mirrors.cjs --check`: OK (112 mirrors).
- No U+2013 or U+2014 in the changed files.

## Known Stubs

None.

## Threat Flags

None. T-400-25 is mitigated by X1, X2, X5b and X6; T-400-26 by L2 (closed label only; the packet builder reads nodes and identity only); T-400-27 by the X1 spy (0 domain reads with the advisor off).

## Next Phase Readiness

- Both consumers and the selection log carry the domain. A later calibration pass can condition on selection_observations.cause_effect_domain.
- cynefin_rating is still written; its removal is due one release later (Pitfall 5).

## Self-Check: PASSED

- FOUND: tests/test-400-advisor-consumers.cjs, tests/test-400-selection-domain.cjs
- FOUND commits: 3b637bdf2, 913f2b6fc, b701fcaf7, 3def1e0be
