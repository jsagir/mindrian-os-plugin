---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 07
subsystem: research-planner
tags: [eureka, ambient, offer-only, d-03, d-04, sens-13, plan-only-card]
requires:
  - 366-02 (research-planner/filing-stamped.cjs, the one stamped filer)
  - 366-01 (tests/helpers/fixture-366.cjs, tests/run-all-366.sh)
provides:
  - ambient _eurekaAdapter on eureka-recall buildSubstrate + recallCandidates, read-only, offer_only findings, outcome 'offered'
  - 'offered' as the last member of the frozen AMBIENT_PRODUCER_OUTCOMES (scripts/scout-cadence-guard.cjs)
  - research-planner/ambient.cjs eureka offer branch ending at recordPlanOnly (outcome plan_card_eureka_offer), EUREKA_OFFER_PAIRS = 3
  - quick.cjs exports reaskCard
  - tests/test-366-ambient-offer.cjs (O1-O12)
affects: [366-08 (buildSubstrate reads opts.roomDir for the canon resolver), 366-16 (floor ledger: EUREKA_OFFER_PAIRS), 366-24 (closes the F7 todo with the SENS-13 finding below)]
tech-stack:
  added: []
  patterns:
    - offer rides compResult to the planner step only; the strict ambient ledger keeps {outcome, posture} (_ledgerProducers)
    - titles re-hydrated from room.db inside the planner step, never carried in the offer
key-files:
  created: []
  modified:
    - lib/core/ambient-run.cjs
    - scripts/scout-cadence-guard.cjs
    - lib/core/research-planner/ambient.cjs
    - lib/core/research-planner/quick.cjs
    - tests/test-3551-ambient-run.cjs
    - tests/test-366-ambient-offer.cjs
decisions:
  - "EUREKA_OFFER_PAIRS = 3: one card, a few pairs the navigator can read at a glance (listed for the 366-16 floor ledger)"
  - "The offer is recorded only after a whitespace pass that produced no card (skipped_no_whitespace, context_insufficient, throttled); a queued, deduped, ran or halted whitespace pass keeps its own outcome, and already_run_for_delta / budget_exhausted / error do not offer"
  - "The offer card reuses the planner's plan-only machinery (kind plan_card_no_grant, hasPendingPlanOnly dedupe), so a room delta never stacks cards (Open Question 5 kept as planned)"
  - "A standing grant can never cover an eureka plan (standing scope is the whitespace family only, so coverFor answers outside_family); the branch still never reaches runQuick, and a forced covered:true is tested too"
  - "ambient-run.cjs strips the offer from the ledger record through _ledgerProducers because the strict ambient ledger admits exactly {outcome, posture} per producer"
metrics:
  duration: ~75min
  completed: 2026-10-01
  tasks: 2
  files: 6
---

# Phase 366 Plan 07: Ambient eureka offer Summary

The ambient Eureka producer is now the perspective's own recall, read-only on room.db, and it only offers. The planner's ambient step turns the offer into one plan-only card and never runs a quick fetch for it, even when a grant could cover one. The title-only scorer is gone from ambient-run.cjs, and the other producers file through the planner's relocated stamped filer.

## What was built

- **ambient-run.cjs**
  - `_eurekaAdapter` opens room.db through `openRoomDbReadOnlyForCaller`, calls `eurekaRecall.buildSubstrate(db, { roomDir })` and `recallCandidates(substrate, roomDir, { max_candidates: AMBIENT_TOP_N })`, and returns `{ outcome: 'offered', findings, offer }`. Each finding is `{ producer: 'eureka', a: {handle, text: ''}, b: {handle, text: ''}, rank, offer_only: true }` with no stamp key. The offer rows are `{ a, b, section_a, section_b }` and nothing else.
  - `selectCardFinding` skips `offer_only`, so the eureka offer is never guarded, filed or written to `last-eureka.json`.
  - The filer is `require('./research-planner/filing-stamped.cjs').fileStampedOpportunity`. The requires of room-native-substrate, rs-differential-scorer and scripts/eureka-portfolio-report.cjs are gone.
  - `_ledgerProducers` keeps the ambient ledger record at `{ outcome, posture }` per producer, so the offer never enters the strict ledger.
- **scout-cadence-guard.cjs**: `'offered'` appended last to the frozen `AMBIENT_PRODUCER_OUTCOMES`; the record validator checks membership through the same constant and needed no change.
- **research-planner/ambient.cjs**: the old `maybeQuickInner` body is now `whitespaceInner`. A new `eurekaOfferInner` runs when whitespace produced no card. It dedupes on `hasPendingPlanOnly` before any work, re-hydrates titles from room.db by id (dropping and counting rows whose endpoint is no longer a substrate thing), builds the question set with `questionSetFor`, builds the plan with `planner.buildPlan`, and always ends at `recordPlanOnly`. `plan_card_eureka_offer` is in `AMBIENT_OUTCOMES`; `EUREKA_OFFER_PAIRS = 3`.
- **quick.cjs**: `reaskCard` is exported so the offer card can be rendered when `coverFor` reports covered (no card of its own in that case).
- **tests**: `tests/test-366-ambient-offer.cjs` legs O1-O12; tests/test-3551-ambient-run.cjs moved from the old eureka scoring shape to the offer shape and now also pins the filer export.

## SENS-13 finding (for plan 366-24, verbatim)

Folded todo F7 (SENS-13) finding to record in the SUMMARY: SENS-13 reads
`<room>/.mindrian/last-eureka.json`, written by `writeStampedSideChannel` in ambient-run.cjs after a
producer's finding is filed. After this plan the eureka producer never files, so it never writes
that side channel; rs, hsi, whitespace and find-connections still file through the relocated
`fileStampedOpportunity` and still feed SENS-13. The 212/213 re-plan against registerCapability is
therefore moot for the eureka producer; plan 366-24 closes the todo with this finding.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | ce035fc2d | test(366-07): add failing test for the ambient eureka offer (O1-O6) |
| 1 (GREEN) | 0c42f5d39 | feat(366-07): ambient eureka producer is the perspective recall, offer only |
| 2 | 46c0b70b9 | feat(366-07): planner ambient step records the eureka offer as a plan-only card, never a fetch |

The RED commit and an uncommitted GREEN-in-progress diff were left by a prior session; the diff was reviewed against the plan, kept (it matched the plan, including the strip of the offer from the ledger record that the plan did not spell out), and committed as the GREEN commit.

## Verification

- `node tests/test-366-ambient-offer.cjs`: PASS 13 FAIL 0 (O1-O12 plus the whole-test zero-network check)
- `node tests/test-3551-ambient-run.cjs`: PASS (18 checks)
- `LC_ALL=C bash tests/run-all-366.sh`: PASSED=43 FAILED=0 SKIPPED=22 KNOWN=1
- `node scripts/build-harness-manifest.cjs --check`: OK
- Acceptance greps: `eureka-portfolio-report` in ambient-run.cjs 0; `offer_only` 4; `'deps_missing', 'offered']` 1; `plan_card_eureka_offer` in ambient.cjs at least 2; no `runQuick(` call in the eureka branch; no em or en dash in any touched file.
- `bash tests/run-all-3551.sh`: PASS=62 FAIL=6 (see Deviations: every red is outside this plan).
- `bash tests/run-all-363.sh`: PASSED=44 FAILED=1 KNOWN=8; the one FAILED is the nested run-all-3551 signature check (see Deviations). The 363 ambient legs themselves (test-363-ambient.cjs) are green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] quick.cjs exports reaskCard**
- **Found during:** Task 2
- **Issue:** the offer card must exist even when `coverFor` returns `covered: true` (which carries no card), and `reaskCard` was module-private.
- **Fix:** one-line export; no behavior change.
- **Files modified:** lib/core/research-planner/quick.cjs
- **Commit:** 46c0b70b9

**2. [Rule 2 - Missing critical] ledger record strips the offer**
- **Found during:** Task 1 review of the adopted diff
- **Issue:** the strict ambient ledger admits exactly `{ outcome, posture }` per producer; passing the offer through would fail the validator.
- **Fix:** `_ledgerProducers` in ambient-run.cjs (leg O3 proves the ledger validates).
- **Commit:** 0c42f5d39

**3. [Plan note] standing grants cannot cover an eureka plan**
- The plan's O8 assumed a standing grant could "cover a quick run". The standing scope is the whitespace family only, so `coverFor` answers `outside_family` for an eureka plan. O8 therefore tests a real standing grant (zero fetches) and a forced `covered: true` (zero `runQuick` calls, zero fetches, zero ledger runs).

### Pre-existing reds (not caused by this plan, not fixed)

- `run-all-3551.sh` ends PASS=62 FAIL=6. The reds are the documented ones in its header (nested run-all-355 with direction-agreement, 272-cache-probe, part8-egress-guard; test-auto-explore-fingerprint; test-connector-tier-d-hooks; test-198-adapter-budget), plus `dependency-diff` and the `doctor --acceptance` leg. The doctor leg's reported new regression is `capability-ledger-fresh`: the installed Claude CLI (2.1.287) is 41 patch versions past the ledger's `ledger_covers.to` (2.1.246) against a threshold of 40 (`node -e "...capability-ledger-module.cjs').check({})"` returns status warn). That is an environment drift, not this plan's files; the ledger was last touched in August. It is also why `run-all-363.sh` shows `FAILED=1`: its recorded signature for the nested run-all-3551 is `PASS=63 FAIL=5` and the leg now ends `PASS=62 FAIL=6`. The signature in tests/run-all-363.sh was not edited (out of scope; refresh it when the capability ledger is refreshed with `/mos:radar --fetch`).
- A parallel fixer owns lib/mcp/tools/chain.cjs, lib/core/chain-executor.cjs and the 365 tests and review; none was touched. `.planning/phases/353-.../353-FLEET-REPORT.json` is left dirty as instructed.

## Hand-edited planning ticks

REQUIREMENTS.md EPV366-14 checkbox, ROADMAP.md 366-07 checkbox and the "7/27 plans executed" count only. STATE.md was not touched (no state writers run, a parallel session may be writing it).

## Known Stubs

None. The offered finding text is intentionally empty (nothing room-shaped rides the finding); the planner step re-hydrates titles locally.

## Threat Flags

None. The new surface is the read-only substrate pass inside the planner's ambient step; it opens room.db read-only and returns ids and slugs only.

## Self-Check: PASSED
