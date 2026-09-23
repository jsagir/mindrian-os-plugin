---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 02
subsystem: testing
tags: [gate, canon-part-9, trust-integrity, tier-1, mcp, room-db]

# Dependency graph
requires:
  - phase: 354-01
    provides: "docs/reviews/phase-354-disposition-ledger.md (SYS-08 row), tests/run-all-354.sh, tests/helpers/fixture-room-354.cjs"
provides:
  - "tests/test-354-gate-subject-promotion.cjs: regression pinning the EXACT claim id gate_answer approve must promote (5 cases: approve/reject/defer/evidence-never-promoted/ineligible-subject)"
  - "lib/mcp/tools/gate.cjs::_promoteCardSubject(db, roomDir, live): the eligibility-checked promotion door for a gate card's subject claim, called from gate_answer's approve branch"
  - "gate_answer response fields: reasoning_node.subject_node_id, .subject_confirmed, .subject_skip_reason"
  - "skip-reason literals: no_subject, strategy_card_owned_by_goal_gate, kind_not_general, subject_not_found, subject_not_claim, subject_not_proposed"
affects: [354-16, 354-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive try/catch subject-promotion block inside gate_answer's approve branch, same idiom as the existing 260903-i2x decision-node block: a fault here can never flip response.ok or clobber reasoningNode"
    - "Eligibility-gate-with-named-skip-reason pattern for a second promotion inside an already-successful write branch"

key-files:
  created:
    - tests/test-354-gate-subject-promotion.cjs
    - .planning/phases/354-system-integrity-and-theo-integration-independent-research-a/deferred-items.md
  modified:
    - lib/mcp/tools/gate.cjs

key-decisions:
  - "Eligibility check order fixed exactly as the plan specified (subject present -> not strategy-owned -> kind general -> row exists -> row is claim -> row is proposed), each failure naming a distinct subject_skip_reason, so a skipped promotion is always visible on the response, never silent"
  - "test-345-gate-ratify.cjs's line-421 anchor_confirmed failure confirmed pre-existing and unrelated to this fix (byte-identical failure with gate.cjs reverted to its pre-354-02 state); logged to deferred-items.md rather than fixed, since it traces to goal-gate.cjs's own confirmNode call on the strategy-card path, which _promoteCardSubject explicitly never reaches (strategy_card_owned_by_goal_gate short-circuit)"

requirements-completed: [SYS-08]

# Metrics
duration: 15min
completed: 2026-09-23
---

# Phase 354 Plan 02: Gate Subject Promotion Summary

**Fixed the P1 seam where a human's gate approval confirmed the newly-minted `decision:gate:*` node instead of the card's actual subject claim -- gate_answer now promotes the exact claim id through the single `navigation.confirmNode` chokepoint, with a six-reason eligibility gate that keeps strategy-card and material-step approvals byte-identical.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-23T09:08:00Z (approx, session read start)
- **Completed:** 2026-09-23T09:23:06Z (Task 2 commit)
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Wrote `tests/test-354-gate-subject-promotion.cjs` (RED-first, commit `b7ebba171`): 5 cases against
  the real `meeting`/`gate_render`/`gate_answer` MCP handlers over a scratch room, each re-opening
  room.db through a fresh `openRoomDb` handle after the handler returns. Run against the unfixed
  `gate.cjs`: exit 1, cases A (approve) and D (evidence-card approve) failed exactly as the
  disposition ledger predicted -- the subject claim stayed `proposed` while an unrelated
  `decision:gate:*` node got confirmed.
- Added `_promoteCardSubject(db, roomDir, live)` to `lib/mcp/tools/gate.cjs` (GREEN, commit
  `b46aff3ab`): resolves `live.card.subjectNodeId`, then gates eligibility in order (non-empty
  subject -> not `goalGate.isStrategyCard` -> `kind === 'general'` -> subject row exists -> row
  type `claim` -> row `review_status` `proposed`), promoting only through
  `navigation.confirmNode` and never reading or promoting `evidenceNodeIds`. Wired into the
  existing approve branch, after the decision-node confirm, in its own try/catch so a promotion
  fault can never clobber `reasoningNode` or flip `response.ok`.
- Updated the `gate_render` tool's `subject_node_id` / `evidence_node_ids` `.describe()` text
  (removed the stale "Nothing consumes this yet") to state the real contract: an approve on a
  `general`-kind card with a proposed-claim subject promotes it; evidence nodes are provenance
  only and are never promoted.
- Re-ran `docs/reviews/phase-354-probes/persistence.cjs`: the `gate-subject-confirmation`
  observation now shows the original claim row `review_status: "confirmed"` (previously
  `proposed`), independently verified against room.db.
- All 27 regression cases GREEN; `tests/test-276-meeting-gate-wiring.cjs` (14/14) and
  `tests/test-345-gate-anchor.cjs` (29/29) unchanged/green; `build-connector-registry.cjs --check`,
  `check-substrate.cjs --diff`, and `check-tool-honesty.cjs --check` all clean.

## Task Commits

1. **Task 1: Failing regression - approve promotes the exact subject claim id** - `b7ebba171` (test)
2. **Task 2: Promote the card subject in gate_answer's approve branch** - `b46aff3ab` (feat)

**Plan metadata:** pending (this commit, docs: complete plan)

## Files Created/Modified

- `tests/test-354-gate-subject-promotion.cjs` - 5-case regression pinning the exact claim id
  gate_answer approve must confirm (approve, reject, defer, evidence-never-promoted, ineligible
  subject)
- `lib/mcp/tools/gate.cjs` - `_promoteCardSubject` + its call site in the approve branch; updated
  `subject_node_id`/`evidence_node_ids` tool-param descriptions
- `.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/deferred-items.md` -
  new file, records the pre-existing unrelated `test-345-gate-ratify.cjs` failure found during
  verification

## Decisions Made

- Followed the plan's exact eligibility order and skip-reason vocabulary (`no_subject`,
  `strategy_card_owned_by_goal_gate`, `kind_not_general`, `subject_not_found`,
  `subject_not_claim`, `subject_not_proposed`) so a skipped promotion is always traceable on the
  response rather than silently absorbed.
- Left `goalGate.ratifyGoalProposal`'s own strategy-card anchor-confirm call completely
  untouched; `_promoteCardSubject` short-circuits on `strategy_card_owned_by_goal_gate` before
  ever reaching a strategy card's subject, so the two promotion paths (meeting-claim subject via
  this fix, goal-anchor subject via 345-07's existing code) stay fully independent.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was authored and run RED before any fix code was
written; Task 2 implemented exactly the eligibility order, response fields, and description-text
update the plan specified.

## Issues Encountered

- `tests/test-345-gate-ratify.cjs` failed at line 421 (`strategy_ratification.anchor_confirmed`
  expected `true`, got `false`) during Task 2 verification, one of the plan's own required
  `<verify>` commands. Root-caused before treating it as a regression: temporarily reverted
  `lib/mcp/tools/gate.cjs` to its pre-Task-2 state via `git checkout -- lib/mcp/tools/gate.cjs`
  (the file this task modified, a sanctioned targeted-file discard, not a blanket reset), re-ran
  the same test, and got the byte-identical failure at the byte-identical line, deterministic
  across two runs. Confirmed this is a pre-existing failure in `lib/core/strategy/goal-gate.cjs`'s
  own `navigation.confirmNode` call on the goal-anchor node (Phase 345's own strategy-card path),
  unrelated to and untouched by this plan's `_promoteCardSubject` addition (which never reaches a
  strategy card's subject). Restored the Task 2 edit from a saved copy, confirmed
  `test-354-gate-subject-promotion.cjs` and `test-276-meeting-gate-wiring.cjs` still green, then
  logged the finding to `deferred-items.md` per the executor's scope-boundary discipline rather
  than fixing an out-of-scope file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SYS-08 fully closed: this is its sole owning plan per REQUIREMENTS.md's SYS-08 row ("Plan
  354-02"), so `requirements mark-complete SYS-08` is safe to run for this plan.
- Wave 2 siblings (354-03 chain resume identity, 354-04 write-lock ownership) are unaffected by
  this plan's changes; both remain independently startable.
- The pre-existing `test-345-gate-ratify.cjs` anchor-confirmation failure (see Issues Encountered
  and `deferred-items.md`) is NOT gating this plan's close, but should be picked up by whichever
  future session next touches `lib/core/strategy/goal-gate.cjs` or by a dedicated `/gsd-debug`
  session if it blocks a release gate before then.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files verified present on disk (tests/test-354-gate-subject-promotion.cjs, lib/mcp/tools/gate.cjs, deferred-items.md, this SUMMARY.md). Both task commits (`b7ebba171`, `b46aff3ab`) verified present in `git log --oneline --all`.
