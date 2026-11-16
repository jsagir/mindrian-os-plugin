# 395-08 Summary: engine findings carried from the 395-06 cold check

Date: 2026-11-16. Branch `work/395-selection-by-job`. Base of this slice: `81bd70572`. Planning and review on Opus 5.5 (ruling 24), execution on Haiku 5.5.

## What changed (Part A of the plan; Part B, the act planner, not built by design)

* `lib/core/navigation-engine.cjs`: on a turn where a framework chain proposal is held, the rationale keeps `Framework chain: X FEEDS_INTO Y (Brain confidence n, held).` and a sentence that is true for each of 3 classes (chain command not a selector id; a selector alternative; a framework with no command). Constant `CHAIN_HOLDS_SELECTOR_ALTERNATIVE = true` keeps class 2 held (owner decision D1; set it to false to offer the chain command). New context field `tierCandidatesTheoAsked`.
* `lib/core/navigation-engine-offer.cjs`: flag `minimalHit` replaces `chosen === top`, so the pin never replaces a tier 0 minimal verb in the top row (closes 395-06 MA3); one helper `selectorIds` reads the switch `MINDRIAN_NAV_NO_PRIMARY_PIN`.
* `docs/ENV-TUNING.md`: entry for the switch. `data/harness-manifest.json`: 1 line by its generator.
* New `tests/test-395-engine-carried.cjs` (12 checks); `tests/run-all-395.sh` lists it.

## What ran

* Executor: new test 9 fail before, 12 of 12 after; `run-all-395.sh` 8 of 8; 52 single test files equal before and after; suite 36925 PASSED=54 FAILED=3 before and after, same legs; suite 3696 PASSED=126 FAILED=6 SKIPPED=2 KNOWN=17 before and after, same legs.
* Cold check (`docs/designs/selection-path/runs/395-08/cold-check.md`): COMMIT, 0 blockers, 0 majors, 4 minors. 648 `decide()` calls and 25 hook turns on its own fixtures: held text true in each class; no held text names a command (1 edge case: a chain target that is itself a command string); with the constant false only the 108 class 2 turns change; with the switch on, hook stdout byte-identical to HEAD and to `a0f421370` on 25 turns; 280 no-chain turns byte-identical; 34 nearest test files equal on both copies.

## Carried

* Minor 1: the new test labels class 2 and class 3 the other way round at lines 213 and 228. Minor 2: a raw chain target can be a command string. Minor 3: `docs/ENV-TUNING.md` rule 2 leaves out the no-command case. Minor 4: check A2 does not assert the selector source.
* Checks A1, A3, A4 depend on machine load (the hook skips the selector after 1,200 ms).
* Owner decision D1 (class 2 held).
