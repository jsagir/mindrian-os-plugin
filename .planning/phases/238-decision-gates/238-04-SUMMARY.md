---
phase: 238-decision-gates
plan: 04
subsystem: mcp
tags: [mcp, chain-run, gate-ledger, session-scoping, decision-gates]

requires: ["238-02"]
provides:
  - "lib/mcp/tools/chain.cjs: resume ledger re-pointed onto lib/mcp/gate-ledger.cjs, mint payload carries the rendered card and kind:material_step, resume path validates chosen and session before executing"
affects: [238-06]

tech-stack:
  added: []
  patterns:
    - "chain.cjs's resume-path failure ladder: missing gate_id -> consume(gate_id, sessionId) null/session_mismatch -> validateChosenAgainstCard (fail-closed on missing card) -> non-approve verdict -> onStepFn, in that exact source order"
    - "sessionId threaded as an explicit parameter into _resumeFromGateAnswer from chainRun's own opts.sessionId, never read off the consumed ledger entry (avoids comparing the entry to itself)"

key-files:
  created:
    - tests/test-238-chain-chosen-validation.cjs
  modified:
    - lib/mcp/tools/chain.cjs

key-decisions:
  - "_mintResumeLedger/_consumeResumeLedger kept as named thin wrappers over gateLedger.mintGate/consumeGate rather than deleted, so existing tests and this file's own _internal export keep resolving without a rename"
  - "the mint payload carries the NORMALIZED card from gateRender.renderGate (rendered.card), not the pre-render card from _buildMaterialStepCard, because the normalized card's option ids are canonical and its gate_id is the id actually being minted"
  - "a ledger entry with no card (a pre-238-04 mint still inside the TTL during a rolling restart) fails closed with chosen_not_in_card_options rather than skipping the check"

patterns-established: []

requirements-completed: [GATE-01, GATE-03]

duration: ~50min
completed: 2026-07-29
---

# Phase 238 Plan 04: Chain Resume onto the Shared Gate Ledger Summary

**`chain_run`'s halt/resume path re-pointed onto the shared session-keyed `gate-ledger.cjs`, with the rendered card carried in the mint payload so the resume path can validate `chosen` against it and reject a foreign session, instead of a private `_resumeLedger` Map that gate_answer could never reach and a resume path that never read `chosen` at all.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `lib/mcp/tools/chain.cjs`'s private `_resumeLedger` Map and `RESUME_TTL_MS` constant are deleted. `_mintResumeLedger`/`_consumeResumeLedger` are now thin named wrappers over `lib/mcp/gate-ledger.cjs`'s `mintGate`/`consumeGate` -- the SAME ledger `gate_answer` (`gate.cjs`) consumes from. Identity proven live: `chain.cjs`'s `_internal._resumeLedger` is the SAME object as `gate-ledger.cjs`'s `_internal._ledger`.
- The halt-branch mint payload now carries the NORMALIZED card (`rendered.card` from `gateRender.renderGate`, not the pre-render `_buildMaterialStepCard` output) under `card`, and `kind: 'material_step'`. Every existing payload key (`haltedStep`, `restSteps`, `previousOutput`, `roomDir`, `onStepFn`, `postureFn`, `maxSteps`, `gateRenderCtx`) is unchanged.
- `_resumeFromGateAnswer` now threads the CALLER's session id (from `chainRun`'s `opts.sessionId`, populated by the registered `chain_run` handler's `resolveEffectiveSessionId` call) into `consumeGate`, and rejects in this exact source order: missing gate_id -> `unknown_or_expired_gate` / `session_mismatch` -> `chosen_not_in_card_options` (via `validateChosenAgainstCard`, fail-closed on a missing card) -> non-approve verdict -> only then `entry.onStepFn` runs. Line numbers: `validateChosenAgainstCard` call at 428, non-approve verdict branch at 438, `onStepFn` invocation at 454 (428 < 438 < 454).
- `chain_run`'s tool description and `gate_answer` parameter description corrected (D-10): no longer instruct calling `chain_run` again with a `gate_answer` payload (a flow that returned `unknown_or_expired_gate`); now state the gate id resumes through `gate_answer`, `chosen` must match the card's own options, and only the halting session can resume.
- `tests/test-238-chain-chosen-validation.cjs`: 6 assertions, every reject case (2, 4, 6) asserts an unchanged `onStep` invocation COUNTER, not just the returned `reason`. Both mutation proofs performed live and reverted.

## Task Commits

1. **Task 1: Re-point chain.cjs's resume ledger onto the shared module and carry the card** - `8d683a8b` (feat)
2. **Task 2: Make the resume path read chosen, reject out-of-card values, and enforce the session** - `44078f01` (fix)
3. **Task 3: Prove the halted step does not run on reject, and demonstrate the mutation red** - `e1ff9177` (test)

_No plan-metadata commit for STATE.md/ROADMAP.md -- the orchestrator owns those writes centrally after all 8 plans in this phase complete, per this plan's own objective statement._

## Files Created/Modified

- `lib/mcp/tools/chain.cjs` - ledger block re-pointed onto `../gate-ledger.cjs`; mint payload gains `card`/`kind`; `_resumeFromGateAnswer` gains a `sessionId` parameter and the `validateChosenAgainstCard`/session-mismatch reject legs above the verdict branch; tool description and `gate_answer` param description corrected
- `tests/test-238-chain-chosen-validation.cjs` - new test, 6 assertions, plain-Node harness

## Decisions Made

- **`_mintResumeLedger`/`_consumeResumeLedger` kept as named wrappers, not deleted.** `_consumeResumeLedger` gained a second `sessionId` parameter; its one internal call site (inside `_resumeFromGateAnswer`) was updated accordingly. This keeps the `_internal` export surface stable for any existing caller.
- **The mint payload carries the NORMALIZED card (`rendered.card`), not the pre-render card.** The pre-render card from `_buildMaterialStepCard` has snake_case `select_mode`; the normalized card returned by `gateRender.renderGate` has the canonical `selectMode` and de-duplicated option ids -- the resume-side `validateChosenAgainstCard` call needs the SAME shape the renderer actually rendered, not an earlier draft of it.
- **`sessionId` is threaded as an explicit parameter, never read off the consumed entry.** Reading it off the entry would compare the entry to itself and pass vacuously -- the plan explicitly named this as the anti-pattern to avoid, matching the source-presence-grep lesson already in this repo's history.
- **A missing card fails closed with `chosen_not_in_card_options`, not a silent skip.** A ledger entry minted before this change (or by a future minter that forgets to carry the card) has no `card` key; the resume path treats that the same as an out-of-card `chosen` rather than executing unconditionally. This is the conservative direction and matches the verdict-cannot-be-overridden doctrine already applied to `consumeGate`'s own two-positional-parameter, no-bypass contract.
- **Reused the `chosen_not_in_card_options` slug 238-03 introduced for `gate.cjs`, rather than minting a second one.** Both `gate_answer`'s and `chain_run`'s resume paths now report the same reason string for the same defect class.

## Deviations from Plan

**Concurrent-worktree commit race, caught and self-corrected (not a code defect):** this worktree runs three sibling plans (238-03, 238-04, 238-05) concurrently in the SAME shared git index/working tree (worktree isolation disabled per this plan's own `<sequential_execution>` section). After `git add`-ing `lib/mcp/tools/chain.cjs` for Task 2 but before this executor's own `git commit` ran, a sibling agent's `git commit` (for its own 238-03 `gate.cjs` change) landed BOTH files in one commit (`e9d0815b`), because `git commit` with no pathspec commits the whole index, and my staged `chain.cjs` was sitting in that shared index at the time. This was caught immediately by inspecting `git show <hash> -- lib/mcp/tools/chain.cjs` and comparing content; before this executor took any corrective action, the sibling agent itself detected the same over-broad commit and self-corrected via a replacement commit (`63e3b11e`, same message, `gate.cjs` only) -- git history shows the original `e9d0815b` was superseded, `git log -- lib/mcp/tools/chain.cjs` no longer lists it, and `chain.cjs`'s Task 2 diff was left sitting correctly staged-but-uncommitted in the working tree, byte-identical to what this executor had written. This executor then re-staged and committed it normally as `44078f01` under the correct `238-04` plan prefix. No content was lost, duplicated, or reverted; verified live by diffing `git show <sibling-commit> -- chain.cjs` against the working tree both before and after, and by re-running the full test suite (`test-198-chain-run-halt.test.cjs`, 18/18) after the correction to confirm no regression. No manual recovery action (no reset, no revert, no force-push) was needed or taken.

**Second concurrent-worktree race, same root cause, this docs commit itself:** the same shared-index race recurred one level up. This executor ran `git add -f .planning/phases/238-decision-gates/238-04-SUMMARY.md` and then `git commit -m "docs(238-04): complete chain resume ledger plan" -- .planning/phases/238-decision-gates/238-04-SUMMARY.md`, but by the time that commit ran, a sibling agent's own `git commit` (for its own `238-03-SUMMARY.md`) had already run WITHOUT a restricting pathspec and picked up this file's staged content, landing it inside `8de980e9 docs(238-03): add plan 03 execution summary` alongside `238-03-SUMMARY.md`. This executor's own `git commit -- <pathspec>` afterward correctly reported "nothing to commit" (the file already matched HEAD, byte for byte -- verified via `git diff --stat` returning empty). No content was lost or altered: `git show 8de980e9 -- .planning/phases/238-decision-gates/238-04-SUMMARY.md` matches this file's on-disk content exactly at every line up to this note. This addendum paragraph and the "Self-Check" section below it are what actually lands under a correctly-prefixed `238-04` commit. Same lesson as the Task 2 episode above: in a shared-index concurrent-worktree setup, ANY commit run by ANY sibling agent without a restricting pathspec can sweep up another agent's already-staged files, regardless of file ownership boundaries. No destructive recovery (no reset, no revert, no amend of the sibling's commit) was taken; the content is correct where it landed.

No other deviations. All three tasks executed as written; no Rule 1-3 auto-fixes were needed beyond the two self-correcting concurrency episodes documented above.

## Mutation-Probe Transcript (Task 3, verbatim)

**1. Confirm clean baseline before mutating:**
```
$ git diff --stat lib/mcp/tools/chain.cjs
(empty)
```

**2a. Mutation leg (a): comment out the `validateChosenAgainstCard` reject** (`lib/mcp/tools/chain.cjs`, inside `_resumeFromGateAnswer`):
```js
  // MUTATION-PROBE (238-04 Task 3 mutation gate, leg a): the
  // validateChosenAgainstCard reject is disabled to demonstrate Case 2
  // turns red without it.
  // const validChosen = entry.card ? gateRender.validateChosenAgainstCard(entry.card, ga.chosen) : null;
  // if (!validChosen) {
  //   return {
  //     ok: false,
  //     reason: 'chosen_not_in_card_options',
  //     gate_id: ga.gate_id,
  //     valid_option_ids: (entry.card && Array.isArray(entry.card.options)) ? entry.card.options.map((o) => o.id) : [],
  //   };
  // }
```

**Run against the mutated file:**
```
$ node tests/test-238-chain-chosen-validation.cjs
test-238-chain-chosen-validation
  ok   Case 1 (anti-vacuity control): a valid chosen + approve executes the step
FAIL: test-238-chain-chosen-validation -- AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

true !== false

    at tests/test-238-chain-chosen-validation.cjs:126:12
    at ok (tests/test-238-chain-chosen-validation.cjs:46:25)
MUTATED exit=1
```
Line 126 is Case 2's `assert.equal(resume2.ok, false)` -- with the reject disabled, the fabricated `chosen` falls through to the verdict branch and `resume2.ok` reads `true` instead of `false`. Exactly the predicted case failed (Case 1's control still passed since it was already valid before this point; Cases 3-6 never ran -- the harness throws on first failed assertion).

**Restore byte-identically:**
```
$ cp <scratchpad>/chain-backup.cjs lib/mcp/tools/chain.cjs
$ git diff --stat lib/mcp/tools/chain.cjs
(empty)
```

**Re-run to green:**
```
$ node tests/test-238-chain-chosen-validation.cjs
test-238-chain-chosen-validation
  ok   Case 1 (anti-vacuity control): a valid chosen + approve executes the step
  ok   Case 2: a fabricated chosen is rejected (chosen_not_in_card_options) and the step does NOT run
  ok   Case 3: resuming with the option LABEL instead of the id is accepted
  ok   Case 4: a cross-session resume is rejected (session_mismatch) and the step does NOT run
  ok   Case 5: a follow-up resume of an already-rejected gate id is unknown_or_expired_gate (single-use)
  ok   Case 6: a ledger entry with no card fails closed (chosen_not_in_card_options), step does NOT run

PASS test-238-chain-chosen-validation (6 assertions)
RESTORED exit=0
```

**2b. Mutation leg (b): comment out the session-mismatch comparison** (`lib/mcp/tools/chain.cjs`, inside `_resumeFromGateAnswer`):
```js
  // MUTATION-PROBE (238-04 Task 3 mutation gate, leg b): the session
  // comparison is disabled to demonstrate Case 4 turns red without it.
  // if (entry.ok === false && entry.reason === 'session_mismatch') {
  //   return { ok: false, reason: 'session_mismatch', gate_id: ga.gate_id };
  // }
```

**Run against the mutated file:**
```
$ node tests/test-238-chain-chosen-validation.cjs
test-238-chain-chosen-validation
  ok   Case 1 (anti-vacuity control): a valid chosen + approve executes the step
  ok   Case 2: a fabricated chosen is rejected (chosen_not_in_card_options) and the step does NOT run
  ok   Case 3: resuming with the option LABEL instead of the id is accepted
FAIL: test-238-chain-chosen-validation -- AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'chosen_not_in_card_options'
- 'session_mismatch'

    at tests/test-238-chain-chosen-validation.cjs:166:12
    at ok (tests/test-238-chain-chosen-validation.cjs:46:25)
MUTATED exit=1
```
Line 166 is Case 4's `assert.equal(resume4.reason, 'session_mismatch')`. With the comparison disabled, `entry` on a cross-session consume is the raw `{ok:false, reason:'session_mismatch'}` rejection object `consumeGate` itself returned (it has no `.card`), so the code falls through to the `validateChosenAgainstCard` leg, which sees `entry.card` is falsy and reports `chosen_not_in_card_options` instead -- the wrong reason, not an execution. Exactly the predicted case failed with the predicted mismatch (the counter-safety held either way, since `entry.onStepFn`/`entry.roomDir` were never real values to begin with -- this mutation demonstrates the REASON string breaks, which is what Case 4 actually asserts).

**Restore byte-identically:**
```
$ cp <scratchpad>/chain-backup.cjs lib/mcp/tools/chain.cjs
$ git diff --stat lib/mcp/tools/chain.cjs
(empty)
```

**Re-run to green:**
```
$ node tests/test-238-chain-chosen-validation.cjs
test-238-chain-chosen-validation
  ok   Case 1 (anti-vacuity control): a valid chosen + approve executes the step
  ok   Case 2: a fabricated chosen is rejected (chosen_not_in_card_options) and the step does NOT run
  ok   Case 3: resuming with the option LABEL instead of the id is accepted
  ok   Case 4: a cross-session resume is rejected (session_mismatch) and the step does NOT run
  ok   Case 5: a follow-up resume of an already-rejected gate id is unknown_or_expired_gate (single-use)
  ok   Case 6: a ledger entry with no card fails closed (chosen_not_in_card_options), step does NOT run

PASS test-238-chain-chosen-validation (6 assertions)
RESTORED exit=0
```

## Test Suite Results (honest report)

- `node tests/test-238-chain-chosen-validation.cjs` -- **PASS, 6/6 assertions, exit 0.**
- `node tests/test-198-chain-run-halt.test.cjs` -- **PASS, 18/18 assertions, exit 0.** Phase 237's own two-tier dispatcher and single-autonomy-authority regression (this file exercises `chain_run` end to end, including the halt/resume/replay/forgery legs) still passes unchanged after this plan's edits.
- `bash tests/run-all-198.sh` -- **exit 1, 12 passed, 1 FAILED.** The one failure is `SPEC-5 hooks/ adapter-only budget` (`scripts/on-stop` line-budget), the SAME pre-existing Phase 241-origin failure already documented in `238-02-SUMMARY.md`'s `deferred-items.md` -- confirmed unrelated: `scripts/on-stop` was last touched by Phase 241, and neither of this plan's diffs touch that file. `tests/test-198-chain-run-halt.test.cjs` specifically PASSED (12/12 non-SPEC-5 legs green, including the SPEC-3 chain-run leg).
- `bash tests/run-all-238.sh` -- **PASS=5 FAIL=2 SKIP=2.** This plan's own leg, `238-04 chain resume chosen validation (GATE-01 G-2)`, reports **PASSED**. `regression: 198 chain run halt` and `regression: 209 backstop tuning` both PASSED. The two FAILs are out of this plan's scope and reflect sibling-plan in-flight/expected state at the time this suite ran: `238-05 retry counter fence` (sibling plan, running concurrently in this same worktree) and `238-07/08 card-fire corpus` (this leg is EXPECTED to FAIL until 238-08 lands, per `run-all-238.sh`'s own header comment). The two SKIPs (`238-06` legs) are expected -- that plan has not landed yet.
- Phase 237 scope fence: `git diff -U0 lib/mcp/tools/chain.cjs | grep -E "postureForCommand|_loadPostureIndex|makeDefaultOnStep|postureFn" | grep -c "^[+-]"` -- **0**, both after Task 1 and after Task 2. Phase 237's four identifiers are provably untouched.
- `node scripts/build-connector-registry.cjs --check` -- **exit 0, `connector-registry: OK`.**
- `git diff --stat lib/mcp/tools/gate.cjs` for this plan's own commits -- **empty.** `gate.cjs` was never touched by this plan (it is owned by 238-03, edited concurrently by the sibling agent in this same worktree, but never staged or committed by this executor -- confirmed at every commit boundary via `git status --short` before staging).
- No em-dashes: `git diff -U0 lib/mcp/tools/chain.cjs | grep '^+' | grep -cP '\x{2014}'` is 0 for both Task 1 and Task 2; `grep -cP '\x{2014}' tests/test-238-chain-chosen-validation.cjs` is 0.

## Cross-Module Identity and Behavioral Probes (live, verbatim results)

- **Identity probe:** `chain.cjs`'s `_internal._resumeLedger === gate-ledger.cjs`'s `_internal._ledger` -- **true**.
- **Cross-module probe (real halting chainRun):** halted gate's ledger entry carries a truthy `card` with `options.length === 3` (approve/reject/defer) and `kind === 'material_step'`.
- **Fabricated-chosen probe:** `verdict:approve` + `chosen:['bogus-not-a-real-option']` -> `reason: chosen_not_in_card_options`, onStep counter unchanged.
- **Missing-card probe:** a hand-inserted ledger entry with no `card` -> `reason: chosen_not_in_card_options`, onStep counter unchanged.
- **Session-mismatch probe:** halt under session `sessB`, resume under `sessC` -> `reason: session_mismatch`, onStep counter unchanged.

## Issues Encountered

- **Concurrent-worktree commit race** (see Deviations above) -- caught, self-corrected by the sibling agent before this executor took any action, verified with no content loss.
- No auth gates, no other blocking issues, no architectural decisions required.

## Next Phase Readiness

- **Ready for 238-06** (`GATE-01 G-1`, end-to-end one-ledger proof): `chain.cjs` now mints into and consumes from the exact same `gate-ledger.cjs` module `gate.cjs` (238-03) does, with `mintedGateKinds()`/`ratifiableGateKinds()` already covering `material_step` (declared in `gate-ledger.cjs`'s `RATIFIABLE_GATE_KINDS`). No further chain-side wiring is expected to be needed for the mint-ratifier seam-liveness check.
- **STATE.md/ROADMAP.md NOT updated** -- per this plan's own objective statement, the orchestrator owns those writes centrally after all 8 plans in this phase complete.

---
*Phase: 238-decision-gates*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: lib/mcp/tools/chain.cjs
- FOUND: tests/test-238-chain-chosen-validation.cjs
- FOUND: .planning/phases/238-decision-gates/238-04-SUMMARY.md
- FOUND commit: 8d683a8b (Task 1)
- FOUND commit: 44078f01 (Task 2)
- FOUND commit: e1ff9177 (Task 3)
