---
phase: 314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command
plan: 03
subsystem: eureka
tags: [sens-13, evidence-shape-b, portfolio-movement, offer-composer, plain-words, no-new-sensor]

requires:
  - phase: 314-01
    provides: movement files per scope, seen set, closed envelope schema, validateEnvelope
  - phase: 213-eureka-reach-wiring
    provides: SENS-13, the deep_research reach, composeEurekaOffer pattern, the born-wired proof 213-03
provides:
  - "SENS-13 reads a second evidence shape (stored portfolio movement) and returns signal eureka_portfolio_movement"
  - "lib/core/eureka/portfolio-offer.cjs: composePortfolioOffer and composeMovementSummary"
  - "a render-only plain-word dial label for the new signal, held in lockstep with the offer text"
affects: [314-04, 314-05, 314-06, 314-08]

tech-stack:
  added: []
  patterns:
    - "one sensor, two evidence shapes: the old body moved unchanged into readBridgeShape, the bridge wins a tie"
    - "sensor replicates producer constants and pins them equal in a drift test (B9) instead of requiring the producer"
    - "render-only label variant in the pattern of the 355-22 stamped line; lockstep test instead of a require"

key-files:
  created:
    - lib/core/eureka/portfolio-offer.cjs
    - tests/fixtures/314/movement-live.json
    - tests/test-314-sensor-shape-b.cjs
    - tests/test-314-offer.cjs
    - tests/test-314-label-lockstep.cjs
  modified:
    - lib/core/sensors/sensor-eureka.cjs
    - lib/hmi/dial-label-composer.cjs
    - lib/hmi/dial-presenter.cjs

key-decisions:
  - "Shape B freshness is 24 hours (PORTFOLIO_FRESHNESS_MS), not 30 minutes: the movement is made at run time, so it must stay offerable after the run."
  - "Shape B dedupes by the 24-hour window plus the seen list. The fire-once mark that decide() writes is keyed to signal eureka_bridge only, so decide() is not edited."
  - "The sensor validates the envelope with its own copy of the closed schema (it may not require the producer). It adds three sensor-only rules: encoder_kind live, counts sum above 0, scope_id equals the file name."
  - "A corrupt seen file silences shape B entirely (fail closed). A missing seen file means nothing is seen."
  - "The offer carries counts and scope only. It carries no movement_id, no handle and no label. The offer shape is { text, scope, counts, command, next: { command } }."
  - "The offer has no Brain leg and no chain. The only next step is the command /mos:eureka-portfolio."

requirements-completed: [PM314-03, PM314-04, PM314-08]

completed: 2026-10-28
---

# Phase 314 Plan 03: SENS-13 Shape B, Portfolio Offer, Plain-Word Label Summary

**SENS-13 now notices a stored portfolio movement (second evidence shape, no new sensor), a sibling composer turns it into one fixed-template offer, and the dial shows it in plain words.**

## Accomplishments

- `sensor-eureka.cjs`: `sensorEureka` tries `readBridgeShape` (the old body, logic unchanged) and then `readPortfolioShape`. Shape B scans `.mindrian/eureka-portfolio/`, reads at most 8 newest movement files by mtime, checks freshness before the parse, validates the closed schema, skips a seen id, and fires for the unseen movement with the newest `detected_at` (ties: file name ascending). The reach is `deep_research`, posture `hold`, signal `eureka_portfolio_movement`, flat evidence of counts, scope, movement id and the first event only.
- `portfolio-offer.cjs`: `composePortfolioOffer` gates on `validateEnvelope`, `encoder_kind` live and counts above 0. The text is `Your opportunity portfolio moved since the last run: <summary>. Want to look at the full read?` with digits and fixed words only. It abstains on any bad payload. It requires nothing but the envelope validator.
- `dial-label-composer.cjs` and `dial-presenter.cjs`: a render-only `deep_research` variant, so the new signal does not fall back to the outside-research sentence. The presenter threads three counts only when the signal is `eureka_portfolio_movement`.

## Task Commits

| Task | Commit | Type |
|------|--------|------|
| 1 RED | 0fb6d5a88 | test(314-03): SENS-13 shape B legs and fixture |
| 1 GREEN | 79a67661f | feat(314-03): SENS-13 evidence shape B |
| 2 RED | fb5754d41 | test(314-03): composePortfolioOffer |
| 2 GREEN | e599e8768 | feat(314-03): composePortfolioOffer |
| 3 RED | 1c7029864 | test(314-03): portfolio movement dial label |
| 3 GREEN | 53174c289 | feat(314-03): dial label variant and presenter threading |

## Verification (PROVEN: run with temp HOME, USERPROFILE, MINDRIAN_ROOMS_HOME, UV_OFFLINE=1)

- Each RED test failed before its code: shape B 7 of 13 failed, the offer test threw "Cannot find module", the label test failed L1, L2, L5.
- `test-314-sensor-shape-b.cjs` 13 passed (B1 to B12, plus B1b). `test-314-offer.cjs` 10 passed (O8 registry leg SKIP). `test-314-label-lockstep.cjs` 6 passed.
- Exit 0 and unchanged: test-213-sensor-eureka, test-213-reach-wired, test-213-part8-boundary, test-213-eureka-offer, test-213-no-force, test-sensors-part8-sweep, test-sensors-routing-fence, test-dial-label-bank-drift, test-3551-surfacing, and the three plan 314-01 tests.
- 24 other tests that require dial-presenter or dial-label-composer: 23 exit 0.
- `git diff --name-only 7699ebdb4 HEAD -- lib/core/insight-sensors.cjs lib/core/navigation-engine.cjs lib/mcp/tools/sensors.cjs` printed nothing.
- Dash scan (`grep -cP '\x{2014}|\x{2013}'`) on every changed file: 0 hits.
- `build-connector-registry.cjs --check` OK. `check-render-coverage.cjs`: 0 gap.
- B8 pins `SENSOR_REGISTRY_IDS` at 23 ids, SENS-13 once, no SENS-22, and no file named portfolio in `lib/core/sensors`.
- B10 proves the recognition arm only: `dispatchSensors` emits the shape B reach and the real `decide()` returns the `deep_research` family. The 213-03 file stays the proof of record.

## Deviations from Plan

**1. [Rule 1 - Bug, in my test] B8 held a nonsense assertion line**
- First draft had a self-referencing `indexOf('SENS-13')` assertion. Removed before the RED commit. No effect on production code.

**2. [Rule 3 - Blocking] First attempt to commit Task 2 GREEN hit a git index.lock**
- A parallel executor held the index. The commit failed with no change made. I waited, then committed again. Commit e599e8768.

## Known Stubs

None.

## Threat Flags

None new. T-314-11 to T-314-15 mitigated: 24-hour window with future-mtime guard (B3), stub never fires (B2), corrupt seen fails closed (B5), at most 8 files read (B12), text is digits and fixed words (O4), composer never executes (O9), shape A wins and the seen set stops repeats (B7, B5).

## Issues Encountered

- `tests/test-check-render-coverage.cjs` fails: it expects 15 render entries and the live repo has 17. UNRELATED and pre-existing: no file under `commands/`, `skills/` or `agents/` changed since the phase base 7699ebdb4 (PROVEN by `git log 7699ebdb4..HEAD -- commands skills agents`, empty), so the count comes from the base. Not fixed here (out of scope).
- `Accessing non-existent property 'RECOMMENDED_CONFIDENCE_FLOOR' ... circular dependency` warning prints in two 213 tests. It comes from `decision-axes.cjs` and `navigation-engine.cjs`, not from this plan. Tests exit 0.
- `lib/core/fork-declaration.cjs` changed since the base in a commit by another plan. Not touched here.

## Next Phase Readiness

- Plan 314-04 (the run command) must call `markSeen` after it shows a movement, so shape B stops offering it. It must write the movement through `writeMovement` so the file name equals the scope id (the sensor checks this).
- Plan 314-05 adds `commands/eureka-portfolio.md`. The O8 registry leg in `tests/test-314-offer.cjs` then runs instead of SKIP.
- `composePortfolioOffer` has no runtime consumer in lib, the same as `composeEurekaOffer`. The dial label is what makes shape B visible at runtime. The card still shows no command name; a consumer that wants `offer.next.command` must call the composer.
- Plan 314-08 owns CHANGELOG.md and docs/CANON-PHASE-MAP.md. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Self-Check: PASSED

- Files exist: portfolio-offer.cjs, movement-live.json, three test files (PROVEN by the runs above).
- Commits 0fb6d5a88, 79a67661f, fb5754d41, e599e8768, 1c7029864, 53174c289 are in `git log` of feat/eureka-adapter-rebased.
