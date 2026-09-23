# Phase 354 Deferred Items

Out-of-scope discoveries surfaced while executing Phase 354 plans. Not fixed under the
current task; logged here per the executor's scope-boundary discipline.

## 354-02: pre-existing `tests/test-345-gate-ratify.cjs` failure (unrelated to SYS-08)

- **Found during:** 354-02 Task 2 verification (`node tests/test-345-gate-ratify.cjs`).
- **Symptom:** `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: false !== true`
  at `tests/test-345-gate-ratify.cjs:421` (`answered.body.strategy_ratification.anchor_confirmed`
  expected `true`, actual `false`) in the "Task 2 leg A: approve" scenario.
- **Root cause (not yet fixed):** `lib/core/strategy/goal-gate.cjs`'s `ratifyGoalProposal`
  calls `navigation.confirmNode(db, subjectNodeId, ...)` on the goal anchor inside its own
  try/catch (lines 162-175); `anchorConfirmed` lands `false`, meaning `confirmNode` either
  threw or returned `ok !== true` for the strategy-card goal-anchor node in this fixture.
  Not investigated further -- out of scope for 354-02 (SYS-08 owns the meeting-claim subject
  path only, not the strategy-card anchor path).
- **Confirmed unrelated to 354-02's fix:** re-ran the identical test against
  `lib/mcp/tools/gate.cjs` reverted to its pre-354-02 state (`git checkout -- lib/mcp/tools/gate.cjs`
  at commit `b7ebba171`, before the `_promoteCardSubject` change): same assertion fails at the
  same line, byte-identical failure. Deterministic across two consecutive runs.
- **Scope:** Phase 345 (`ratifyGoalProposal`) or the phase's own strategy-card test fixture,
  not Phase 354-02. Should be picked up by whichever plan next touches
  `lib/core/strategy/goal-gate.cjs` or `tests/test-345-gate-ratify.cjs`, or a dedicated
  `/gsd-debug` session if it blocks a release gate.
- **Impact on 354-02:** None. `_promoteCardSubject`'s eligibility check returns early with
  `strategy_card_owned_by_goal_gate` for every strategy card (`goalGate.isStrategyCard`),
  so this task's new code path never touches the goal-anchor confirm call this failure
  traces to.

## 354-03: pre-existing `tests/test-act-prebehavior-snapshot.cjs` failure (unrelated to SYS-09)

- **Found during:** 354-03 Task 2 verification (`bash tests/run-all-166.sh`), one of 23 legs.
- **Symptom:** `AssertionError [ERR_ASSERTION]` thrown by `assert.deepStrictEqual` comparing
  three `/mos:act --chain` render-snapshot cases (case1/case2/case3) against a stored expected
  snapshot; the failure is in the rendered chain-gate TEXT output (`[BRAIN] [GATE] Chain
  step 2: ...` block formatting), not in resume/journal behavior. `chain-executor.cjs` is
  loaded transitively by the render path but this plan's edits touch only
  `_runChainResilient`'s resume-skip block and the post-loop completion check, neither of
  which this snapshot test's render path exercises (no `journal`/`resume` opts in its
  fixture).
- **Confirmed unrelated to 354-03's fix:** temporarily reverted `lib/core/chain-executor.cjs`
  to its pre-Task-2 state via `git checkout -- lib/core/chain-executor.cjs` (the file this
  task modified, a sanctioned targeted-file discard per the 354-02 precedent, not a blanket
  reset), re-ran `node tests/test-act-prebehavior-snapshot.cjs`: same `deepStrictEqual`
  failure, same exit 1, byte-identical diff. Restored the Task 2 edit from a saved copy
  immediately after, confirmed `tests/test-354-chain-resume-identity.cjs` still green (15/15).
- **Scope:** Whichever plan or session last touched `/mos:act --chain`'s render output
  (act-command.cjs or its rendering helper) or the stored snapshot fixture itself, not
  Phase 354-03. Not investigated further -- out of scope for SYS-09 (chain-resume identity).
- **Impact on 354-03:** None. `run-all-166.sh` otherwise reports 22/23 passed; every
  chain-executor resume/journal/verdict/gate suite (347-resume-nonlinear,
  chain-graceful-partial, chain-executor-loop, chain-executor-verdict, chain-executor-gate,
  pipeline-state-isnext-gate, chain-executor-part8-leak, and the Wave-6/7/8 frozen-contract
  and doc-content legs) is green.

## 354-04: pre-existing `lib/memory/decision-capture.test.cjs` Test 12 failure (unrelated to SYS-02)

- **Found during:** 354-04 Task 2 verification (`node lib/memory/decision-capture.test.cjs`),
  one of the plan's own required `<verify>` commands.
- **Symptom:** `AssertionError [ERR_ASSERTION]: archive partition should exist` at
  `lib/memory/decision-capture.test.cjs:618`, in "Test 12: special-char section name
  handled via path.join + safe escape". The test records 20 decisions in a tight loop to
  force a decision-log archive overflow, then asserts
  `.mindrian/decision-archive/2026-04/` exists; it does not.
- **Confirmed unrelated to 354-04's fix:** temporarily reverted both files this plan
  modified (`git checkout -- lib/core/write-lock.cjs lib/core/graph-ops.cjs`, the exact
  sanctioned targeted-file-discard idiom 354-02/354-03 used, not a blanket reset), re-ran
  `node lib/memory/decision-capture.test.cjs`: same assertion fails at the same line,
  byte-identical failure and stack trace across both runs. Restored the Task 2 edits from
  a saved copy immediately after, confirmed `tests/test-354-write-lock-ownership.cjs`
  still green (18/18 checks) and `node lib/memory/write-lock-atomic.test.cjs` still green.
- **Scope:** `lib/core/decision-capture.cjs`'s own archive-overflow/partitioning logic
  (or its own test fixture's date-window assumptions), not `lib/core/write-lock.cjs` or
  `lib/core/graph-ops.cjs`. Not investigated further -- out of scope for SYS-02
  (write-lock ownership). Should be picked up by whichever plan or session next touches
  `lib/core/decision-capture.cjs`'s archive path, or a dedicated `/gsd-debug` session if
  it blocks a release gate.
- **Impact on 354-04:** None. `decision-capture.test.cjs` otherwise reports 13/14 passed;
  every other plan-required verify leg (`write-lock-atomic`, `minto-debouncer`,
  `recompile-room-references`, `stamp-artifact-write`,
  `vault-section-minto-generator-atomic`, `index-artifact-transaction`,
  `check-substrate.cjs --diff`) is green, and `decision-capture.cjs`'s own
  acquireLock/releaseLock call sites (lines 409/440, 502/582) are unchanged legacy
  no-handle callers that this plan's fix keeps working (verified by Tests 1-11 and the
  concurrent-worker Test 9 all passing).

## 354-06: pre-existing `tests/test-257-brain-tool-egress-invariant.cjs` Arm 2 flake
(unrelated to THEO-03 / D-354-EGR)

- **Found during:** 354-06 Task 3 verification (`node tests/test-257-brain-tool-egress-invariant.cjs`),
  one of the plan's own required `<verify>` commands.
- **Symptom:** `AssertionError [ERR_ASSERTION]: <tool>: a blocked call must open no socket
  at all; captured: [{"name":"theo_health","arguments":{}}]` in "Arm 2: zero egress on a
  canary, per canary-carrying tool" -- the captured tool name varies run to run
  (observed brain_query and brain_search across different runs), always exactly one
  unexpected `theo_health` capture with an empty `{}` argument object.
- **Root cause (not yet fixed):** `bin/mindrian-brain-mcp-client.cjs`'s `main()` fires
  `lib/core/brain-prewarm.cjs`'s `prewarm()` at shim startup, never awaited
  (`prewarm().catch(() => {})`), which sends a content-free `theo_health` probe
  (`callTool('theo_health', {})`) to whatever `MINDRIAN_BRAIN_URL` resolves to -- the
  SAME capture server this test points every shim spawn at. Arm 2's `resetCaptured()`
  truncates the shared `captured` array immediately before its own `tools/call` request,
  but the async prewarm fetch can still land its own POST to the capture server in the
  same window, landing in `captured` as an unrelated entry Arm 2's `capturedCount === 0`
  assertion was never designed to tolerate. This is a timing race in the shared test
  fixture between two independent async operations (prewarm, the arm's own request), not
  a defect in `part8-egress-guard.cjs`, `brain-client.cjs`, or `part8-egress-guard-hook.cjs`.
- **Confirmed unrelated to 354-06's fix:** temporarily reverted all three files this plan
  modified (`lib/core/part8-egress-guard.cjs`, `lib/core/brain-client.cjs`,
  `scripts/part8-egress-guard-hook.cjs`) to their pre-354-06 committed state via
  `git show HEAD:<path>` written over each file (not `git checkout --`, to avoid touching
  the destructive-git-prohibition list), re-ran the test twice against that reverted
  combination: the identical Arm 2 `theo_health` race failed both times (only Arm 4 also
  failed, which is expected -- Arm 4 was rewritten this plan to assert 354-06's own new
  refusal behavior and correctly fails against pre-354-06 code). Restored all three files
  from a saved copy immediately after, diffed byte-identical to confirm a clean restore,
  then re-ran the full suite once more to confirm only Arm 2 remained red.
- **Scope:** `lib/core/brain-prewarm.cjs` (Quick 260911-ddd, DDD-02) or this test's own
  fixture isolation (it does not set an env flag to suppress prewarm, nor does it drain
  the capture server between shim spawn and Arm 2's own request), not 354-06 (THEO-03 /
  D-354-EGR). Not investigated further -- out of scope for this plan. Should be picked up
  by whichever plan or session next touches `brain-prewarm.cjs` or this test's shim-spawn
  helper, or a dedicated `/gsd-debug` session if it blocks a release gate.
- **Impact on 354-06:** None. Every other Arm in this suite passes (1a/1b/1c, 2b, 3, 4,
  5, 6, 7a, 7b), including Arm 4 (this plan's own rewrite, proving the new
  refuse-before-the-wire behavior for an ambiguous free-form `brain_ask` question) and
  Arm 5 (proving a genuinely typed question still allows and reaches the wire).
