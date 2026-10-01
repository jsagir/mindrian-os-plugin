---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 09
subsystem: chain-run
tags: [b3, chain-run, add-only-halt, shape-f]
requires: [365-06, 365-07]
provides:
  - add-only never-do halt inside makeGateFn (reasons constraint_named, constraints_malformed)
  - Shape F halt card notice for a constraint halt
  - never_do_proposal on every other chain_run halt
affects: [365-10, 365-13, 365-16]
tech-stack:
  added: []
  patterns: [add-only gate check after the irreversible check, WeakMap verdict side channel so gateFn keeps its run/halt return, fresh read per step]
key-files:
  created:
    - tests/test-365-never-do-chain.cjs
  modified:
    - lib/core/chain-executor.cjs
    - lib/core/eureka/explore-chain.cjs
    - lib/mcp/tools/chain.cjs
key-decisions:
  - "The constraint verdict travels from gateFn to the two haltedAt sites in a module-level WeakMap keyed by the step object, so gateFn still returns only 'run' or 'halt' and custom gateFns are untouched"
  - "The notice trims the why (never the floor sentence) to stay inside the 400 character card notice cap"
  - "A constraint halt (named or malformed) carries no never_do_proposal; every other halt with a step does"
requirements-completed: [V365-11, V365-13]
duration: ~35 min
completed: 2026-10-01
---

# Phase 365 Plan 09: chain_run honors the room's never-do list Summary

chain_run now stops at any step the room has named, the same way it stops at irreversible steps: add-only, recorded, shown on the Shape F card with the entry, its why, and the floor sentence.

PLAN_BASE: ac137411efe083ba7677d209bc10bfece8579904

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 8c0004f3f | gate check (1b) after the irreversible check, halt reasons on both loop paths, explore-chain roomDir pass-through, E1..E9 |
| 2 | 25e586292 | constraint halt card notice, never_do_proposal on other halts, targetSection and runId into runChain, K1..K6 |

Both verified as ancestors of HEAD.

## What changed

- `lib/core/chain-executor.cjs`: statement (1) `if (isIrreversibleStep(step)) return 'halt';` is still the first statement of gateFn (pinned by tests/test-365-baseline.cjs and E1). New (1b) directly after it calls `checkStep(roomDir, declaredFieldsOfChainStep(step, {targetSection}))` when `opts.roomDir` is a non-empty string; on halt it records the verdict in a WeakMap, appends one trip line via `recordTrip`, returns `'halt'`. Statements (2), (3), (4) are byte-identical (the diff removes only the two default-gate lines and the two reason lines). Both haltedAt sites now use `_haltReasonFor(step)` (forced_material first, then constraint reason, else gate_halt) and attach `constraint: {kind, value, why}`. Both default `makeGateFn({postureFn ...})` calls now also pass `roomDir`, `targetSection`, `runId`.
- `lib/core/eureka/explore-chain.cjs`: `makeGateFn({ roomDir: roomDir })`.
- `lib/mcp/tools/chain.cjs`: `_buildMaterialStepCard(step, nodeCtx, haltInfo)` sets `card.notice` for constraint_named and constraints_malformed; the START call passes `targetSection` into runChain (runId was already passed); `halted_at.constraint {kind, value}` (no why) on the response; `never_do_proposal` on halts the room did not cause. chain_run registration untouched (K5 compares title, description and a structural dump of the input schema against `git show PLAN_BASE`).

## Out-of-scope callers (reason recorded)

- `lib/core/bono/debate-composition.cjs`: left untouched. Debate halts at its two material gates anyway, so a named step cannot run unattended there.
- `scripts/act-command.cjs`: left untouched. It only plans and executes nothing.

## Sync-path note

`runChain` routes to the resilient (async) loop whenever `opts.roomDir !== undefined`, so the sync loop never sees a roomDir from the defaults. Its default gate therefore stays unenforced unless the caller builds `makeGateFn({roomDir, ...})` and injects it (E3 proves the sync loop reports constraint_named that way). Every production chain with a room goes through the resilient loop and is enforced.

## Hand-offs

- 365-16 (Theo sync): chain_run's description still says it halts "at the first material step" and now also halts at a room-named step. The description (and schema) were left unchanged on purpose under the Theo parity constraint; it is a candidate description refresh for the Theo sync. Response-only additions: `halted_at.reason` values `constraint_named` / `constraints_malformed`, `halted_at.constraint`, `never_do_proposal`; card data: `notice`.
- 365-13 (approval door): `never_do_proposal` is `{kind, value, why, alternatives}` as built by `proposalFromFields` with surface `chain_run`; the door mints the decision node first, then `writeNeverDoEntry`.
- Resume tail: `_executeResumedEntry` does not forward `targetSection` into the continuation chainRun (pre-existing: only the START call carried it). A later halt in the resumed remainder is still enforced by command and path; a section-kind entry keyed on the declared targetSection would not match there. Candidate follow-up, not fixed here (outside this plan's files-of-record scope).
- Registry fact: the only command whose registry `produces` resolves to a path today (`/mos:snapshot`, `exports/hub.html`) is irreversible and halts first as forced_material. E9 therefore stubs `resolveExecutable` for one fixture command to prove the path join live, and asserts the real registry join separately.

## Verification

- `node tests/test-365-never-do-chain.cjs` PASS (E1..E9, K1..K6, 420 lines).
- Neighbors green: test-198-chain-run-halt, test-347-resume-nonlinear, test-347-review-cr01-cr02-live-path, test-276-theo-description-parity, test-365-baseline (first-statement pin).
- test-237-approve-executes exits 1 on check 7 ("MUTATION ... dispatcher-call needle not found"); this is the known pre-existing red listed in the aggregator KNOWN set, not caused by this plan (chain.cjs dispatcher-call line untouched).
- `bash tests/run-all-365.sh` at HEAD 25e586292: PASSED=52 FAILED=0 SKIPPED=1 KNOWN=8 (was 51/0/1/8; the +1 is the new test leg).
- No dash characters in any touched file (grep -nP clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Notice cap would have truncated the floor sentence**
- **Found during:** Task 2 design (normalizeCard caps notice at 400 characters; a why can be 300 and a value 200)
- **Issue:** a long why would push the floor sentence past the cap and cut it, violating D-15
- **Fix:** `_constraintNotice` trims the why with an ellipsis so the floor sentence is always whole; K1 covers a 300 character why
- **Commit:** 25e586292

**2. [Test scope note] E9 stubs the dispatcher join**
- The plan's E9 assumed a registry command with a produced path that is not irreversible; none exists today. The test restores the real `resolveExecutable` in a finally block.

No other deviations.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, no room.db access; T-365-04, T-365-06, T-365-08, T-365-11, T-365-15 mitigations are implemented and tested as planned (trips carry no why, E8; schema and description unchanged, K5).

## Self-Check: PASSED

Files exist; commits 8c0004f3f and 25e586292 are ancestors of HEAD; STATE.md and ROADMAP.md untouched; peer's uncommitted files left alone.
