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
