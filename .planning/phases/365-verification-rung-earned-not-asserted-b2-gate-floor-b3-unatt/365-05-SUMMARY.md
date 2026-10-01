---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 05
subsystem: truth-state-transitions
tags: [b2, transitions, truth-states, navigator-checkpoint, part-9]
requires: [365-01, 365-02, 365-03, 365-04]
provides:
  - needs_evidence->confirmed, the ninth TRANSITIONS member (event status_promoted), human-only through the existing setsConfirmed guard
  - holdForEvidence(db, id, byUser, reason) in confirm-node.cjs (proposed -> needs_evidence only), live through the 365-04 navigation.cjs re-export
  - 365-D20-AUDIT.md (the pre-edit audit the navigator ruled on)
  - TRUTH-STATES.md row for the new transition
affects: [365-08, 365-11, 365-15]
requirements: [V365-06]
key-files:
  created:
    - .planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-D20-AUDIT.md
    - tests/test-365-transitions.cjs
  modified:
    - lib/core/navigation/transitions.cjs
    - lib/core/navigation/confirm-node.cjs
    - .planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md
decisions:
  - "D-20 ruled by the navigator: proceed (additive needs_evidence->confirmed)"
  - "holdForEvidence refuses any non-proposed from-status with {ok:false, reason:'not_proposed', from}; an unknown id returns unknown_node"
metrics:
  tasks: 3
  files: 5
  commits: 3
---

# Phase 365 Plan 05: needs_evidence -> confirmed (D-20) and holdForEvidence Summary

A claim held below the room's verification floor now has one honest exit: a person approving it moves `needs_evidence -> confirmed` (not `validated`, which would assert evidence that may not exist), and `holdForEvidence` is the floor's way to put a claim there.

PLAN_BASE = `65a4c6d494ebc840332bdc6adf99498535861652`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `7fb5465d7` | docs(365-05): D-20 transition audit |
| 2 | (checkpoint, no commit) | navigator ruling |
| 3 | `494407297` | feat(365-05): needs_evidence->confirmed transition (D-20) and holdForEvidence |

Both code commits used `git commit --only -- <exact paths>` and pass `git merge-base --is-ancestor <sha> HEAD`. STATE.md and ROADMAP.md were not touched; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` ran. navigation.cjs was not edited (365-04 had already added the `holdForEvidence` re-export). The peer's uncommitted 353-FLEET-REPORT.json was left alone.

## Navigator ruling (Task 2, verbatim)

Relayed by the coordinator, recorded verbatim from the AskUserQuestion card: **"proceed (Recommended)"**.

## Audit section 1 answer

NO canon rule requires an Appendix D entry. Canon Part 9 (docs/MINDRIAN-CANON.md:350) enumerates statuses only and names no transition set as frozen; Appendix D entries 24 and 41 changed a type set and a human-only target, not a transition. Two non-canon doc rules touch the set: the Phase 108 TRUTH-STATES.md line 24 ("Any transition not in this table is a violation"), which this plan satisfies by adding the row, and docs/SUPERSESSION-CONTRACT.md Ruling 3 ("eight members"), which is Phase 348 scoped and only becomes historical wording (follow-up 2 below).

## What changed

- transitions.cjs: `'needs_evidence->confirmed'` in TRANSITIONS and `'needs_evidence->confirmed': 'status_promoted'` in EVENT_FOR_TRANSITION, placed after the needs_evidence->validated lines; header comment now says 9-transition and names Phase 365 D-20 and why. `git diff 65a4c6d49 -- transitions.cjs` shows the two members and the comment only; the three UPDATE statements are byte-unchanged (test-348 pin and T1).
- confirm-node.cjs: `holdForEvidence` added and exported; `confirmNode`'s body is byte-unchanged (digest equals `365-pre-phase.json` confirm_node_body_sha256, T4 and test-365-baseline leg 3).
- TRUTH-STATES.md: the transition row plus one note line saying the floor hold uses the existing proposed -> needs_evidence row.
- tests/test-365-transitions.cjs (254 lines, 13 assertions, T1 to T5). It is auto-discovered by run-all-365.sh. The human-attribution test iterates AGENT_IDENTITIES and TRUTH_CLAIM_TYPES live, so a future additive member is covered automatically.

## Widened confirmNode reach (from the audit, now live)

A non-agent byUser calling `confirmNode` on a needs_evidence node previously got `invalid_transition` and now succeeds. No live code path writes needs_evidence today, so the reach is dormant until 365-08 holds claims or a legacy room already has held nodes. Callers taking an arbitrary node id with no status filter: selector-decisions.cjs (approve), futures/orchestrator.cjs (APPROVE), sensor-expert-skill.cjs, and qualify-opportunity.cjs / goal-gate.cjs if they meet a held anchor. gate.cjs `_promoteCardSubject` is unchanged because it returns `subject_not_proposed` first (365-08 changes that on purpose). Agents are still refused on every truth-claim type (T2, T4).

## Follow-ups logged (for the orchestrator)

1. **Side-door floor bypass.** Because D-06 keeps the floor out of `confirmNode`, the non-gate human approve paths (selector-decisions, futures orchestrator, sensor-expert-skill, and qualify-opportunity / goal-gate on a held anchor) can release a held claim with no floor check. Part 9 role 5 is intact (a non-agent byUser is required), but D-04's "no confirm anyway" promise does not reach those doors. Either route them through the floor notice (`composeFloorNotice`) or accept the bypass in writing. Nothing in this plan changes those files.
2. **Dated note on docs/SUPERSESSION-CONTRACT.md Ruling 3.** Its "eight members" and the `transitions.cjs:60-69` reference become historical after this plan; add a dated one-line note in a later docs touch. The Phase 348 ruling itself (no `proposed->superseded`) still holds and is still pinned by test-348.

## Test results

| Run | HEAD | Result |
|-----|------|--------|
| `bash tests/run-all-164.sh` at base (before edits; HEAD `7fb5465d7`, code identical to PLAN_BASE) | `7fb5465d7` | exit 1, one failure: `canon-version assertion` (not about transitions) |
| `bash tests/run-all-164.sh` after the change | `494407297` (working tree == commit) | identical output to the base run (same single `canon-version assertion` failure, only process ids differ); its frozen truth-claim block stays green |
| test-348-agent-supersede-refused, test-348-proposed-not-supersedable, test-348-supersession-e2e, test-365-baseline, test-365-ladder-fence, test-365-transitions | `494407297` | all exit 0 |
| `bash tests/run-all-365.sh` | `494407297671fdab4630207c77e6c5bd591e0a4e` | exit 0, `PASSED=51 FAILED=0 SKIPPED=1 KNOWN=8` (was 50/0/1/8 at 65a4c6d49; +1 is the new test) |

## Deviations from Plan

**1. [Process note] TDD ordering.** The plan marks Task 3 `tdd="true"` as one commit. I wrote the implementation and then the test in the same task and committed once, so there is no separate RED commit. The test asserts the absence of the old behavior only implicitly (T4 would have failed on `invalid_transition` at base). No behavior deviation.

No other deviations. No auth gates. The Task 2 checkpoint was handled as planned.

## Known Stubs

None. The `holdForEvidence` slot 365-04 left undefined in navigation.cjs now resolves to the real function (T5 asserts identity). Nothing renders it yet; 365-08 is the consumer.

## Threat Flags

None new. T-365-14 (agent promotes a held claim) is mitigated and tested (T2: every agent identity and every truth-claim type refused, no write, no event). T-365-14b (transition added by coercion) is mitigated: one named additive member, UPDATE statements byte-unchanged, navigator checkpoint taken first. T-365-11 (peer drift) mitigated by `--only` commits and ancestor checks.

## Hand-offs

- **365-08** can call `navigation.holdForEvidence(db, id, byUser, reason)` for a below-floor approve and `navigation.confirmNode` for the release leg (needs_evidence -> confirmed, human only). It must edit `_promoteCardSubject`'s `subject_not_proposed` guard deliberately to let a held subject through. It should also decide follow-up 1.
- `holdForEvidence` returns promoteNodeStatus's result verbatim on the proposed path, plus `{ok:false, reason:'not_proposed', from}` and `unknown_node` of its own.

## Self-Check: PASSED

- FOUND: 365-D20-AUDIT.md, tests/test-365-transitions.cjs, transitions.cjs and confirm-node.cjs edits, TRUTH-STATES.md row
- FOUND commits: 7fb5465d7, 494407297 (both ancestors of HEAD)
- `grep -nP '[\x{2013}\x{2014}]'` over every file this plan touched: no hits
