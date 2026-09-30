---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 13
subsystem: research-planner
tags: [deep-run, controller, stop-checks, counterevidence, constraint-interrogation, f3-card, d-03, d-18]

requires:
  - phase: 363-03
    provides: typed OpenAlex failures, envelope meta (count, cost, remaining)
  - phase: 363-04
    provides: fetchSourceCached with the openalex-v2 namespace
  - phase: 363-05
    provides: Plan and RunResult schemas, planHash, BUDGETS
  - phase: 363-06
    provides: rollUp, opportunityCandidates
  - phase: 363-07
    provides: perspective builder, classifyLimiter, rankByUnlock, nextVersion
  - phase: 363-08
    provides: query families and composeFamily
  - phase: 363-09
    provides: run grants, validateExecutedQuery, audit ledger
  - phase: 363-11
    provides: validateRows and hash-anchored evidence rows
  - phase: 363-12
    provides: quick run layout, verdict, escalateToDeep seed
provides:
  - lib/core/research-planner/deep.cjs - the deep research run controller (state machine)
  - tests/test-363-run-deep.cjs - 16 checks (E1-E13, module load, net guard, fetch restore)
affects: [363-14, 363-15, 363-16, 363-17, 363-18, 363-20]

tech-stack:
  added: []
  patterns:
    - "The controller decides every step; the model only proposes rows and typed follow-up slots"
    - "Plan hash checked on every step (tamper), atomic state writes, resumable across Bash calls"
    - "A search already run (by hash or by lowercased string) is never repeated inside a run"

key-files:
  created:
    - lib/core/research-planner/deep.cjs
  modified:
    - tests/test-363-run-deep.cjs

key-decisions:
  - "Step sequence on the happy path: fetch_round, dispatch_lanes, validate, reflect, fetch_round (round 2), dispatch_lanes, validate, counterevidence, synthesize, done. extend_card appears only when a follow-up or falsifier is outside the approved family, provider or remaining budget."
  - "A budget or time stop skips the counterevidence pass (step goes straight to synthesize) and the RunResult names 'counterevidence not run' as an unresolved branch; any other stop runs the pass first, and synthesize before it returns {ok:false, reason:'counterevidence_not_run'}."
  - "Counterevidence composition: goal falsifier (ci.derivation on the goal target) for the SR engine, one falsifier per supported key-line branch, and one ci.derivation per limiter classified assumed; queries already run are deduped, and anything over the remaining search cap becomes a named gap (over_cap), never silent."
  - "Budget numbers come only from plan.cjs BUDGETS (DEEP_MAX_SEARCHES, DEEP_TIME_BUDGET_MS, ...); lane count from orchestrator.resolveFanoutCap. deep.cjs holds no literal 16 or 1200000."

patterns-established:
  - "Test seam: the replay fetch is swapped into globalThis.fetch only inside the injected fetchEnvelopeFn, for one corpus call"

requirements-completed: [DRP363-08, DRP363-19, DRP363-20]

duration: ~2 sessions
completed: 2026-09-30
---

# Phase 363 Plan 13: Deep research run controller Summary

**A deep research run is now a resumable, deterministic state machine: it refuses to start without a reviewed per-run grant, fans out one lane per top limiter (or lens), halves breadth in round two, always runs a counterevidence pass or says why not, stops for a typed reason, and synthesizes the updated perspective and pyramid with every unresolved branch named.**

## PLAN_BASE

`c2f1121da0cf659a34ee32ac6ae6046a58bafd3c` (parent of the RED commit; the RED commit was made by an earlier session).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | 7b6081fa5 | tests/test-363-run-deep.cjs (failing E1-E13 before deep.cjs existed) |
| 2a test fix | a27fe3f14 | tests/test-363-run-deep.cjs (E3 count, E11 fixture record; see Deviations) |
| 2 GREEN | 533e64462 | lib/core/research-planner/deep.cjs |

All three are ancestors of HEAD (`git merge-base --is-ancestor`).

## What was built

### deep.cjs exports

`DEEP_STEPS` (frozen, 8), `initDeepState`, `nextDeepStep`, `fetchRound`, `lanePayload`, `recordLaneRows`, `proposeFollowups`, `applyExtendDecision`, `runCounterevidence`, `synthesize`, `extendCard`, plus two helpers `roundOneQueries` and `loadState`.

- `initDeepState(roomDir, plan, runGrant, {now, budgetMs, trigger})`: refuses `no_grant`, `multi_step` (a standing grant), and an ambient trigger. Lane count = `orchestrator.resolveFanoutCap({fanout: BUDGETS.DEEP_LANES_REQUESTED})`.
- `fetchRound`: refuses `hash_not_approved` (round one strings must match the grant's approved q_hash set, zero fetches, zero audit records), runs `validateExecutedQuery` before each fetch, reads cache-first through `fetchSourceCached('openalex-v2')`, appends one audit record per executed query, tracks remaining USD from envelope meta.
- `proposeFollowups(roomDir, runId, [{leaf_id, lens, slots}])`: composes through families.cjs; in-family and within budget queues for round two at ceil-half breadth with no card; otherwise the step becomes `extend_card` with an F.3 card (at most 3 options, remaining budget shown as a labeled cap).
- `applyExtendDecision(..., 'stop' | 'extend', {approved_via})`: stop goes to counterevidence (or straight to synthesize on a counterevidence card), extend adds the approved hashes and continues; extend needs an approved_via.
- `synthesize`: `rollUp` for leaf statuses and branch roll-up, `classifyLimiter` for every limiter (physics or assumed, with reasons re_tested / unclear_filed_as_assumed), S-curve from scurve rows (df:timing rows count when the diffusion lens is selected), `rankByUnlock`, next binding constraint, `opportunityCandidates` (constraint_attack for ranked assumed limiters), contradictions with row and leaf ids, `nextVersion` skeleton, and a RunResult that passes `validateRunResult`. Whitespace deep runs cannot mark the gap leaf supported before the synonym template ran (`plurality_required`).

### Run state layout (363-15 and 363-18 drive it)

Under `<room>/.mindrian/research-runs/<run_id>/`: `plan.json` (as approved), `state.json` (atomic), `lanes/<lane>.records.json`, `lanes/<lane>.rows.json` (lane `CE` for the counterevidence pass), and at synthesize `records.json`, `rows.json`, `run.json` (same shapes as the quick run so 363-14 reads either). Every step refuses with `plan_hash_mismatch` if plan.json no longer hashes to `state.plan_hash`.

### Typed stops

`cap` (rounds done), `saturation` (a round adds no new record ids and no new validated rows), `budget` (search cap reached or remaining USD below the next call's cost), `time`, `plurality_required`, plus `navigator_stop` from an F.3 stop.

## Verification

- `node tests/test-363-run-deep.cjs`: PASS 16, FAIL 0 (E1-E13, module load, net guard zero attempts, fetch restored), exit 0.
- Regression: every `tests/test-363-*.cjs` exits 0 (audit-ledger 5, cache 12, corpus-honesty 18, evidence-rows 31, families 11, grants 13, helpers 72, plan-schema 27, pyramid 21, run-quick 18, structure 14; baseline and perspective exit 0 with a different summary line).
- `grep -c resolveFanoutCap deep.cjs` = 1; `grep -cE '\b(16|1200000)\b' deep.cjs` = 0; `BUDGETS = planMod.BUDGETS`.
- No em-dash or en-dash literal in deep.cjs or the test (`grep -P` on U+2014/U+2013 returns nothing).
- `bash tests/run-all-363.sh` was started in the background and did not finish inside the executor's window; see the note at the bottom for its result if it landed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Test edit reviewed] E3 audit count 16 -> 15 (asserted as audit === replay calls)**
- **Found during:** resume review of the previous session's uncommitted test edit.
- **Judgment:** not a weakening. The plan contract (E3) is "one audit record per executed query"; the RED test guessed the literal 16 before any implementation, and 16 is coincidentally `BUDGETS.DEEP_MAX_SEARCHES` (the cap), not a derived count. Traced with a scratch copy of the test: round 1 = 8 queries (4 lanes x ci.derivation + ci.retest); round 2 = 4 (ceil-half = 2 lanes x ci.scurve + ci.prior_attack, only limiters still assumed); counterevidence = 3 (goal falsifier "energy density", plus ci.derivation for LM2 "Interface resistance at the anode" and LM3 "Volume swing of the host"; LM4 "Electrolyte cost floor" is assumed but its derivation string was already run in round one and is deduped by the never-repeat-a-search rule; LM1 is physics; no supported key-line branch, so no branch falsifier). 8 + 4 + 3 = 15, and 15 < 16 so the stop is `cap` (rounds done), as the leg asserts. The kept assertion is now strictly the contract: `audit.length === replay.calls.length`, plus the traced 15 pin. The failure message was also widened to print calls and RunResult validation errors.
- **Files modified:** tests/test-363-run-deep.cjs
- **Commit:** a27fe3f14

**2. [Test edit reviewed] E11 paraphrase fixture record**
- **Issue:** the RED fixture pointed the paraphrase row at `rec('prior_review_two', 0)`, a record only fetched by round-two prior-attack queries, which the LM4 lane never fetches in round one; the row would have been dropped as an unknown record, not as a paraphrase.
- **Fix:** it now cites `rec('derivation_hit', 0)`, which the LM4 round-one derivation query does fetch. The leg still asserts `dropped.unverified_quote === 1`, `kept === 0`, the lane `searched_not_found === true`, L11 not supported, and no row for L11, so the paraphrase-drop path is exercised for the right reason (a stronger check than before).
- **Commit:** a27fe3f14

**3. [Rule 1 - Bug] Literal dash characters in source**
- **Found during:** review (grep -P on U+2014/U+2013).
- **Issue:** the `noDash` helper in deep.cjs held literal em/en dash characters inside its regex class, violating the no-dash house rule.
- **Fix:** replaced with the `—` and `–` escape form (same behavior).
- **Commit:** 533e64462 (fixed before the GREEN commit).

No other deviations. Plan-level "never write STATE.md" was superseded by the orchestrator's explicit instruction to update STATE and ROADMAP with the resync-clobber hand-correction.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-363-04 (E2 hash_not_approved, E10 plan_hash_mismatch), T-363-06 (controller picks every step, follow-ups only as typed slots, rows validated), T-363-07 (no_grant / multi_step refused), T-363-10 (round cap, halving, search cap, budget and time stops, F.3 for anything outside the approval), T-363-36 (typed stop_reason, unresolved branches named) are mitigated as planned and covered by E1-E13.

## Downstream contract notes

- 363-14 (filing): read `<room>/.mindrian/research-runs/<run_id>/{plan,records,rows,run}.json`; contradictions and opportunity candidates are on `run.json`; `run.filed` is false until the F.8 yes.
- 363-15 (facade/CLI): step the machine across separate calls with `nextDeepStep` then the matching function; `fetchRound` and `runCounterevidence` are async and take `{fetchEnvelopeFn}` only in tests. `recordLaneRows(roomDir, runId, lane, rows)` for lane `CE` after `runCounterevidence` returns a `lane_payload`.
- 363-18 (/mos:research): the host hands each `dispatch_lanes` payload to the Read-only `research-lane-analyst`; on Desktop and Cowork the deep plan is composed, reviewed and saved and the run itself executes in Claude Code (D-14 honest degrade).
- Nothing in this plan blocks 363-14.

## Self-Check: PASSED

- FOUND: lib/core/research-planner/deep.cjs, tests/test-363-run-deep.cjs
- Commits 7b6081fa5, a27fe3f14, 533e64462 are ancestors of HEAD.
