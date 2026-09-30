---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 15
subsystem: research-planner
tags: [planner-facade, cli-door, json-inputs, approvals, decision-nodes, pending-cards, next-framework, d-02a, d-04, d-05, d-14]

requires:
  - phase: 363-05
    provides: Plan and RunResult schemas, validatePlan, planHash, applyEdit, planReviewCard
  - phase: 363-06
    provides: buildPyramid, checkPyramid, applyLogicTreeSteps, weakestBranch
  - phase: 363-07
    provides: buildPerspective, loadSettled
  - phase: 363-08
    provides: composeForLeaf and the audit fence
  - phase: 363-09
    provides: grants, run ledger
  - phase: 363-10
    provides: detectScientific, structureFor, lensSelection, nextFramework, refreshLive
  - phase: 363-12
    provides: runQuick, escalateToDeep
  - phase: 363-13
    provides: the deep run state machine
  - phase: 363-14
    provides: buildBasket, basketCard, fileRun
provides:
  - lib/core/research-planner/planner.cjs - buildPlan, buildPlanLive, cardFor, approveStandingGrant, approvePlanReview, pendingCards, markSurfaced, queuePendingCard, status, nextMove and the state helpers the CLI needs
  - scripts/research-planner.cjs - the JSON-only CLI door (23 subcommands)
  - quick.coverFor - the runQuick grant pre-pass without fetching
  - tests/test-363-cli.cjs - 17 checks (C1-C12, X1-X3, dash guard, net guard)
affects: [363-16, 363-17, 363-18, 363-19, 363-20]

tech-stack:
  added: []
  patterns:
    - "One facade assembles every plan; a refusal from the audit fence keeps that leaf in the room and the string is scrubbed from the plan and the result"
    - "An approval writes the grant first with a pre-chosen decision node id, then the node; if the node fails the grant is revoked, so there is never a grant without a trace or a node without a grant"
    - "CLI argv validator runs before dispatch: known flags, existing .json files, run ids, grant ids, lane ids, enum values and slugs only; a bad token is refused without being echoed"

key-files:
  created:
    - lib/core/research-planner/planner.cjs
    - scripts/research-planner.cjs
    - tests/test-363-cli.cjs
  modified:
    - lib/core/research-planner/quick.cjs

key-decisions:
  - "buildPlan is synchronous and deterministic (ledger structure). refreshLive is async, so the live read lives in buildPlanLive(roomDir, qs, {liveStructure:true, brainClient}) which awaits it and hands the result to buildPlan as opts.live. Without liveStructure nothing is read live."
  - "Plan status mapping: checkPyramid's 'wish' (D-00, every leaf only restates the navigator) becomes plan status 'incomplete' with 'd00_failed' named (the plan's C2 leg); plan status 'wish' is reserved for the Scientific Roadmapping template whose perspective has no nameable limiter. Perspective errors gate only the scientific-roadmapping template; for other templates they come back as perspective_errors and warnings without blocking."
  - "cardFor never offers a run for incomplete, wish, needs_lens_leaves or local_only plans (a F.6-shaped card with revise and stop). A ready quick plan is 'run_quick' with no card when quick.coverFor says the grant covers every search, else the F.0 grant card with the first re-ask reason and any new terms. A ready deep plan is 'review' with the F.6 Plan Review card, or 'deep_run' once a run grant exists. A plan with no search text at all answers 'revise' with reason no_search_terms."
  - "Approvals: approveStandingGrant reuses/extends the active standing grant (version bump, D-10) or writes a new one; approvePlanReview writes the run grant from the plan's round-one q_hashes. Both mint a proposed decision node (nodeType decision) whose text names only the grant id, the run id and the surface. approved_via is {surface, decision_node_id}. Nothing is fetched or filed by an approval."
  - "pending_cards entry shape for 363-16: {run_id, kind, queued_at, surfaced:false} written by planner.queuePendingCard(roomDir, {run_id, kind, now}); pendingCards returns unsurfaced entries whose run is not filed, each with card.json attached; markSurfaced flips surfaced. The CLI pending subcommand marks what it returns."
  - "Deep round-one queries are attached the way deep.roundOneQueries composes them (queries_per_round per lane) so the run grant approves exactly what the run will send; quick queries are composed per leaf with the 3-search cap (extra distinct strings are trimmed and counted in quick_trimmed)."
  - "revisePlan refuses once the run has started (state.json or run.json exists), recomposes through the same attachQueries, revokes any active run grant for the old plan, re-hashes and re-saves; a raw query in an edit is refused by applyEdit with no echo."
  - "Exit codes: 0 for ok and for a quick 'reask' card, 2 for any {ok:false} or run-quick status refused, 1 for an internal error (stderr carries only internal_error). process.removeAllListeners('warning') runs first so node:sqlite's ExperimentalWarning does not put text on stderr."

patterns-established:
  - "Facade functions return plain JSON-safe objects with a typed reason; the CLI prints them unchanged and only maps ok:false to exit 2"

requirements-completed: [DRP363-12]
requirements-progressed: [DRP363-14, DRP363-04]

duration: ~90min
completed: 2026-09-30
---

# Phase 363 Plan 15: Planner facade and the JSON-only CLI door Summary

**One facade now assembles every research plan the same way for every door, picks the next honest card, persists grant approvals as decision nodes and reads run state; one JSON-only CLI script drives plan, grant, review, quick, deep, basket and file-run steps without a word of room text on argv.**

## PLAN_BASE

`6c68075c22279635ece4e65dc0e62c5090e6f5d3` (HEAD when the first edit was made).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | 3a72664b4 | tests/test-363-cli.cjs (12 legs failing, module missing) |
| 2 GREEN (facade) | 879044aef | lib/core/research-planner/planner.cjs, lib/core/research-planner/quick.cjs (coverFor), tests/test-363-cli.cjs (facade legs may pass before the CLI exists) |
| 3 GREEN (CLI) | 2cde66c0d | scripts/research-planner.cjs, tests/test-363-cli.cjs (X1-X3 legs) |

All three are ancestors of HEAD (`git merge-base --is-ancestor`).

## Tests

`node tests/test-363-cli.cjs`: PASS 17, FAIL 0 (C1-C12, X1 revise, X2 CLI escalate/validate-rows/grant propose and revoke, X3 live structure with a stub client, dash guard, net guard with zero attempts). Regression: test-363-run-quick 18, run-deep 16, filing 51, plan-schema 27, pyramid 21, perspective 17, families 11, grants 13, audit-ledger 5, structure 14, evidence-rows 31, corpus-honesty 18, cache 12, helpers 72, baseline 7: all green. Generator gates (connector registry, command registry, render coverage, layer declaration, shape declaration) exit 0.

## CLI usage lines (363-18 and 363-19 paste these into command bodies)

Every path is a file or directory; run ids look like `rp-2026-09-30-1a2b3c4d`; `<room>` is the room directory. Exit 0 ok, 2 refused (typed reason in the JSON), 1 internal.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" plan <question-set.json> --room <room> [--mode quick|deep] [--scientific] [--diffusion] [--live-structure] [--section <slug>]
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" planners --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" grant propose --room <room> [--terms <terms.json>]
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" grant approve <proposal.json> --room <room> --approved-via cli [--terms <terms.json>]
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" grant status --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" grant revoke <grant_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" review approve <run_id> --room <room> --approved-via cli
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" revise <run_id> <edit.json> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" run-quick <run_id> --room <room> [--rows <rows.json>]
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" validate-rows <run_id> <rows.json> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" escalate <run_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-next <run_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-fetch <run_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-record <run_id> <lane> <rows.json> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-followups <run_id> <followups.json> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-extend <run_id> <decision.json> --room <room> [--approved-via cli]
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-counterevidence <run_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-synthesize <run_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" basket <run_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" file-run <run_id> <selection.json> --room <room> --approved-via cli
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" pending --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" status <run_id> --room <room>
node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" next-framework <run_id> --room <room>
```

JSON shapes the command bodies read:

- `plan` prints `{ok, run_id, status, mode, next, reason, card, proposal, new_terms, errors, warnings, lenses_selected, local_only_leaves, structure_source, saved}`. `next` is one of `grant` (fire the F.0 `card`, write `proposal` to a scratch JSON, then `grant approve`), `run_quick`, `review` (fire the F.6 `card`, then `review approve`), `deep_run`, `revise` (the card lists what to add; no run is offered), `local_only`.
- `run-quick` prints `{ok, status:'done', run_id, verdict, answer_line, escalation_offer, card, state_dir}` or `{ok:true, status:'reask', reason, card, proposal, new_terms}` or exit 2 `{ok:false, status:'refused', reason}`.
- `deep-next` prints `{ok, step, round, stop_reason, payload}`; steps are fetch_round, dispatch_lanes (payload.lanes), validate (internal: ask again), reflect, extend_card, counterevidence, synthesize, done. The first `deep-next` after `review approve` initialises the run state.
- `deep-extend` reads `{decision:'extend'|'stop'}`; `extend` needs `--approved-via cli` and mints a decision node; `stop` does not.
- `basket` prints `{ok, items, card}` (`card.payload.defaults` are the pre-selected item ids, `card.payload.item_ids` all of them); `file-run` prints fileRun's result unchanged (surface `report` as is). A selection file is `{approved:true, items:[...]}`; one carrying `grant_id` or any grant key is refused.
- `pending` prints `{ok, cards:[{run_id, kind, queued_at, card}]}` and marks those cards surfaced.
- `status` prints `{ok, run_id, mode, plan_status, stage, next, filed}`; stage is planned, approved, running, done or filed. `next-framework` prints `{ok, none:true, reason}` or `{ok, none:false, framework, command, branch, lens_framework}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Additive `coverFor` export in quick.cjs**
- **Found during:** Task 2
- **Issue:** cardFor must say "ready to run with no card" exactly when runQuick's grant pre-pass would pass. The pre-pass lives in a closure inside runQuick and its re-ask card builder is module-private, so the facade could not reuse them without duplicating about 40 lines (Part 7).
- **Fix:** added `coverFor(roomDir, plan, opts)` to quick.cjs (same checks, no fetch, no write) and exported it. runQuick is unchanged; test-363-run-quick still 18/18.
- **Files modified:** lib/core/research-planner/quick.cjs
- **Commit:** 879044aef

**2. [Interpretation] restated-only is `incomplete`, not `wish`**
- **Found during:** Task 1 (C2 vs checkPyramid)
- **Issue:** checkPyramid labels a D-00 failure "wish", but the plan's C2 leg and the must-have text say an incomplete plan lists the questions not yet asked and a wish plan says there is no nameable limiter.
- **Fix:** D-00 failure maps to plan status `incomplete` with `d00_failed` in `errors`; `wish` is used for the Scientific Roadmapping perspective with no nameable limiter.

**3. [Design] buildPlan is synchronous; the live read is a separate async function**
- The plan lists `liveStructure` as a buildPlan option, but `structure.refreshLive` is async. To keep buildPlan usable by sync callers (363-16 ambient) it accepts an already-fetched `opts.live`, and `buildPlanLive` performs the read. The CLI uses buildPlanLive for `--live-structure`.

**4. [Rule 2 - Missing critical] deep-extend needs an approval trail**
- deep.applyExtendDecision requires `approved_via {surface, decision_node_id}` for an extension. The plan's subcommand list did not name a flag, so `deep-extend` takes `--approved-via cli` for `extend` (refused with `approved_via_required` otherwise) and mints a decision node through the facade; `stop` needs no approval.

**5. Test change after the RED commit**
- The RED test first gated every leg on the CLI file existing; the facade legs C1-C8 must pass at Task 2 (before the CLI exists), so the gate moved to the CLI legs only. Same file, committed with the facade.

No other deviations. No auth gates.

## Notes for 363-16, 363-17, 363-18, 363-19

- A run grant expires `time_budget_ms` after approval (quick 60 s, deep 20 min, from grants.writeGrant). A deep run driven step by step must call `review approve` and then move promptly; an expired grant answers `no_grant` from deep-next/deep-fetch.
- Ambient (363-16): use `planner.queuePendingCard(roomDir, {run_id, kind:'evidence'|'plan_card_no_grant', now})`; never write pending_cards by hand. `buildPlan` and `cardFor` are synchronous.
- MCP (363-17): call the same facade functions; the F.0/F.6/F.8 cards come back as plain objects with `shape`, `options`, `body_md`, `payload`. `approveStandingGrant` and `approvePlanReview` take `{approvedVia:'mcp'}`; pass `db` in opts to reuse an open room.db handle.
- The CLI never accepts a raw query, room text or a grant as a selection.

## Requirements

- DRP363-12 (structure from the graph): the facade reads structure, scientific detection and lens selection on every plan and the CLI exposes `planners`, `--live-structure` and `next-framework`; already ticked in REQUIREMENTS.md.
- DRP363-14 (one governed runner) and DRP363-04 (grants): this plan delivers the facade, the CLI door and persisted approvals with decision nodes. Neither is fully satisfied until 363-17 (the research_run MCP tool) and 363-18 (the /mos:research runner) land, so they stay unticked in REQUIREMENTS.md.

## Deferred Issues

- `bash tests/run-all-363.sh` ended `PASSED=36 FAILED=1 SKIPPED=8 KNOWN=9`. The one FAILED leg is `existing run-all-219` (recorded signature `Phase 219: PASS=9 FAIL=4 SKIP=0` no longer matches because Phase 363.1-03 repaired the R17-02 fixture drift in the 219 tests); the run_known wrapper in tests/run-all-363.sh needs its signature retired, and no plan in 363 may edit that aggregator, so it belongs to phase close. The 8 SKIPPED legs are the 363-16..20 test files that do not exist yet. `check-floor-ledger --check` was red for a while mid-plan (`candidate-exclusion.cjs:79` from Phase 363.1-05) and is green again at the end of this plan; this plan adds no unlisted numeric floor.

## Known Stubs

None. Every subcommand calls live engine code.

## Threat Flags

None new. The CLI adds no network surface of its own (fetches happen only inside runQuick and deep.fetchRound under grant checks); argv, stdout and stderr were audited by C11 for the planted marker.

## Self-Check: PASSED

Found: lib/core/research-planner/planner.cjs, scripts/research-planner.cjs, tests/test-363-cli.cjs, lib/core/research-planner/quick.cjs. Commits 3a72664b4, 879044aef, 2cde66c0d are ancestors of HEAD. The 363 aggregator's `363: CLI (363-15)` and both em-dash guard legs PASSED.
