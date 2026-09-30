---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 16
subsystem: research-planner
tags: [ambient, standing-grant, room-started-run, 355.1, throttle, d-03, d-05, d-10, d-11]

requires:
  - phase: 363-09
    provides: standing grants, research run ledger, throttleState, recordRun
  - phase: 363-12
    provides: runQuick (trigger ambient) and the evidence card
  - phase: 363-15
    provides: planner facade (buildPlan, queuePendingCard, pendingCards) and quick.coverFor
  - phase: 355.1
    provides: the ambient child (runAmbientInChild), its lock and AMBIENT_TOTAL_BUDGET_MS
provides:
  - lib/core/research-planner/ambient.cjs - maybeQuick, whitespaceQuestionSet, AMBIENT_OUTCOMES, COHORT_MIN_SECTIONS
  - one guarded, additive call in lib/core/ambient-run.cjs runAmbientInChild
  - tests/test-363-ambient.cjs - 18 checks (M0-M11 with M8/M9 split, dash guard, net guard)
affects: [363-18, 363-20, 363-22]

tech-stack:
  added: []
  patterns:
    - "The room-started run is a branch inside the existing 355.1 child: same lock, same budget, separate ledger; its outcome is never written to the strict ambient ledger or delta state"
    - "The throttle slot is recorded before the first fetch (grants.recordRun trigger ambient) and runQuick runs with recordInLedger:false, so a run is never counted twice and a failed run still uses its slot"
    - "Plan-only cards are one-at-a-time: an unsurfaced plan_card_no_grant already pending means a new delta drops its own freshly built run dir instead of stacking cards"

key-files:
  created:
    - lib/core/research-planner/ambient.cjs
    - tests/test-363-ambient.cjs
  modified:
    - lib/core/ambient-run.cjs
    - tests/run-all-363.sh

key-decisions:
  - "Surfacing decision: the unfiled card is queued in .mindrian/research-run-ledger.json pending_cards and surfaced at the next research touchpoint by planner.pendingCards (the /mos:research runner section, every first-wave command's research-planner section, and every research_run MCP response). No sensor was added, SENS-13 is unchanged, and the strict ambient ledger and delta-state keys are untouched. Proactive sensor surfacing of research cards is a follow-on for phase close."
  - "compResult carries producer outcomes only, no findings. The whitespace candidate is therefore: the composition's whitespace producer ran (outcome no_candidate or filed) AND the frozen whitespace-results.json (the file the ambient whitespace adapter itself reads) holds a qualifying gap. Sparsest gap first (density ascending)."
  - "A gap qualifies only with at least 2 sections (an explicit sections array, else the first path segment of nearest_room_artifacts ids) AND a zone_term. Fewer sections or no term is context_insufficient with reason fewer_than_2_sections or no_zone_term. The term is the only string that becomes a search, so it must be a term a human can see and approve into the grant (D-10); nothing is derived from room text."
  - "Outcome order: skipped_no_whitespace, context_insufficient, budget_exhausted, already_run_for_delta, throttled, then plan-only or run. budget_exhausted uses BUDGETS.QUICK_TIME_BUDGET_MS as the required remaining budget (no new numeric floor; check-floor-ledger stays 0 unresolved)."
  - "Throttle is checked up front only when a standing grant is active (nothing can egress without one). A plan-only card is not a run and does not consume the hourly slot."
  - "Every plan-only outcome writes card.json (the F.0 card with payload.ambient, plan_only, run_id, reask_reason) and proposal.json next to plan.json and queues kind plan_card_no_grant; a completed run queues kind evidence."
  - "ambient-run.cjs edit is additive only (17 lines added, 0 removed): a wall-clock start capture, and a try/catch call that lazily requires ambient.cjs. deps.researchPlanner is the test seam; its maybeQuick override lets tests prove call order and throw isolation."

patterns-established:
  - "One guarded call into a foreign phase's lifecycle file: lazy require inside the try, result ignored, budget derived from that file's own constant"

requirements-completed: [DRP363-15]

duration: ~70min
completed: 2026-09-30
---

# Phase 363 Plan 16: Room-started quick research under a standing grant Summary

**The 355.1 ambient child now runs one quick research pass on its own for a whitespace gap that spans two sections, but only inside a standing grant that already covers every search term; with no grant or any re-ask it records a local plan-only card and nothing leaves the room.**

## PLAN_BASE

`e72eea033101e821c3a0a60c3afcc3ae70f7bd2d` (HEAD when the first action ran).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| Extra (phase-level deviation fix) | 74a48e7d4 | tests/run-all-363.sh |
| 1 RED | 0e52ef8a8 | tests/test-363-ambient.cjs (12 legs failing, module missing) |
| 2 GREEN | 2fe171c60 | lib/core/research-planner/ambient.cjs, lib/core/ambient-run.cjs, tests/test-363-ambient.cjs |

All three are ancestors of HEAD (`git merge-base --is-ancestor`).

## Tests

`node tests/test-363-ambient.cjs`: PASS 18, FAIL 0 (M0 exports; M1 no whitespace; M2 one-section gap; M3 no grant; M4 new term; M5 ran; M6 throttle, once per delta, later hour; M7 budget; M8a/M8b isolation; M9a order, M9b throw isolation, M9c real branch, M9d source pin; M10 deep never; M11 Part 8 marker; dash guard; net guard with zero attempts).
Regression: test-363-cli 17/17, test-363-run-quick 18/18, `check-floor-ledger --check` 0 unresolved, `build-connector-registry --check` OK, render-coverage OK.

`bash tests/run-all-3551.sh`: `Phase 355.1: PASS=62 FAIL=6` versus the documented PASS=63 FAIL=5. The delta is one transient `build-connector-registry --check` STALE reading taken while sibling plan 363-17 was regenerating registries; the same check is OK right after, and none of the other reds touches this plan (dependency-diff package drift, test-355-direction-agreement H rule, 272-cache-probe, part8-egress-guard self-test, test-auto-explore-fingerprint hooks.json, test-connector-tier-d-hooks brain-derivation-drain, test-198-adapter-budget). Every 355.1 ambient leg (child, ambient-run, one-spawner, double-card, Part 9 sweeps of ambient-stop, auto-explore-fire and scout-cadence-guard) is green.

## The exact ambient-run.cjs hunk (17 lines added, 0 removed)

```diff
@@ -766,6 +766,7 @@ async function runAmbientInChild(roomDir, opts) {
       const compositionFn = ...;
+      const runWallStart = Date.now();
       let compResult;
@@ -777,6 +778,22 @@
         compResult = { producers: {}, ... };
       }
 
+      // Phase 363-16 (D-03): ... (comment)
+      try {
+        const rpDeps = (o.deps && o.deps.researchPlanner && typeof o.deps.researchPlanner === 'object') ? o.deps.researchPlanner : {};
+        const maybeQuick = (typeof rpDeps.maybeQuick === 'function') ? rpDeps.maybeQuick : require('./research-planner/ambient.cjs').maybeQuick;
+        await maybeQuick(roomDir, compResult, {
+          budgetMs: AMBIENT_TOTAL_BUDGET_MS - (Date.now() - runWallStart),
+          deps: rpDeps,
+          now: nowMs,
+          deltaHash: deltaHash,
+        });
+      } catch (_e) { /* the research branch never blocks ambient completion */ }
+
       const producers = (compResult && compResult.producers ...
```

The call sits after the composition result is computed and before `recordAmbientRun`, `writeRoomDeltaState` and the lock release in `finally`. Its return value is ignored. No key, producer id, return value or line of the 355.1 machinery changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Interpretation] compResult has no findings, so the whitespace gap is read from the frozen results file**
- **Found during:** Task 2
- **Issue:** the plan says "pick whitespace findings from compResult (or the frozen whitespace-results.json the ambient whitespace adapter reads)". `runAmbientComposition` returns producer outcomes only.
- **Fix:** gate on the whitespace producer's outcome, read the gap from `.mindrian/whitespace-results.json` (the adapter's own source). See key-decisions.

**2. [Rule 2 - Missing critical] one plan-only card at a time**
- **Found during:** Task 2 design
- **Issue:** every ambient delta mints a new run id, so a room with no grant would queue a new F.0 card per delta and bury the navigator.
- **Fix:** if an unsurfaced `plan_card_no_grant` is already pending, the new plan's own just-created run directory is removed and the outcome returns `deduped: true` with the existing run id. Only directories this call created (run id shape checked) are ever removed.

**3. [Design] throttle slot recorded before the first fetch**
- **Issue:** the 363-09 contract says an ambient caller records at start; runQuick is called with `recordInLedger:false` so nothing is counted twice. A run that later fails on an OpenAlex outage keeps its slot (the hourly cap bounds unattended egress).

**4. [Test change after the RED commit]** M10 originally built a deep plan from an incomplete question set and M6 required a replay call on the later-hour run; both were corrected in the GREEN commit (the later run is a cache hit, so zero network calls is correct). Same file.

**5. [Extra task, phase-level deviation fix]** `tests/run-all-363.sh` wrapped `run-all-219` with the stale signature `Phase 219: PASS=9 FAIL=4 SKIP=0` after Phase 363.1-03 repaired the 219 fixtures. `bash tests/run-all-219.sh` was run: summary `Phase 219: PASS=12 FAIL=1 SKIP=0`, and the only FAILED leg is `218 substrate no-regression` whose failing check is `test-218-eureka-auto-extract` (T-218-VD-5, `degrade_cause: encoder_unavailable`). Signature and label updated; no other leg touched. Commit 74a48e7d4.

No auth gates.

## Aggregator result

`bash tests/run-all-363.sh` (background, about 13 minutes) ended `PASSED=38 FAILED=0 SKIPPED=6 KNOWN=10`. The 6 SKIPPED legs are the not-yet-written 363-18, 363-19 and 363-20 test files plus the opt-in live smoke (MOS_363_LIVE unset); the 219 leg reports `KNOWN (signature matched)` on the new signature and the new `363: ambient quick runs, D-05 (363-16)` leg is PASSED. No FAILED leg.

## Notes for 363-18 and later

- Production gap: a real `whitespace-results.json` written by `scripts/compute-whitespace-gaps.py` carries `brain_framework`, `nearest_room_artifacts`, `hypothesis` but no `zone_term`. Until a `zone_term` is populated (the fixture room carries it as an additive field), the ambient branch answers `context_insufficient` (reason `no_zone_term`) on real rooms and never invents a search term. Populating `zone_term` (a navigator-approved gap term, for example when a zone is analyzed with `/mos:whitespace` research ZONE_ID in 363-19) is the follow-on that turns this branch on in production. No search term is ever derived from artifact titles or text.
- 363-18 runner section: call `planner.pendingCards(roomDir)` at the top of `/mos:research`; entries are `{run_id, kind: 'evidence' | 'plan_card_no_grant', queued_at, card}`. A `plan_card_no_grant` card is an F.0 grant card with `payload.reask_reason` (no_grant, new_term, ...) and a sibling `proposal.json` in the run directory; approving goes through `grant approve <proposal.json>`. Mark each handled card with `markSurfaced`.
- 363-18 docs: `commands/scout.md:359` and `commands/scheduled-tasks.md:269` get the pointer "grant-covered quick research runs execute in the 355.1 ambient child, never in this runner" (Pitfall 17). The cadence runner stays zero-egress.
- Unattended egress is bounded three ways: the standing grant (approved terms only, whitespace-gap/v1 only, OpenAlex only), 3 searches per run, 1 run per room per hour.

## Known Stubs

None.

## Threat Flags

None new. The only new outbound path is the existing corpus dispatch, reached only through `runQuick` after `validateExecutedQuery` passes for every search (T-363-07, T-363-01). M11 audits replay URLs, the audit ledger, every run-state file and argv for the planted marker.

## Requirements

- DRP363-15 (ambient quick research runs under a standing grant): delivered and proven by test-363-ambient. Ticked in REQUIREMENTS.md.

## Self-Check: PASSED

Found: lib/core/research-planner/ambient.cjs, tests/test-363-ambient.cjs, lib/core/ambient-run.cjs, tests/run-all-363.sh. Commits 74a48e7d4, 0e52ef8a8, 2fe171c60 are ancestors of HEAD. `grep -P '[\x{2013}\x{2014}]'` over every written file: no hits.
