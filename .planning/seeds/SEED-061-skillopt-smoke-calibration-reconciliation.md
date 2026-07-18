---
kind: seed
status: open
severity: medium
created: 2026-07-18
canon_parts: [7, 11]
related: [Phase 230 (mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur) -- this seed is the direct follow-up to that phase's Plan 07 smoke calibration, not a new build]
proving_case: "Phase 230 Plan 07's live smoke run against the 13-record human-approved smoke set: funnel-vs-manual agreement 30.0% (3/10) against an 85% tolerance, D7 gate FAIL. Full breakdown in .planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/230-07-CALIBRATION.md."
source: "navigator decision 2026-07-18: accept Phase 230's current state as-is (mechanism proven -- detector fired correctly both directions on fresh live captures, WS2 independently re-discovered the real check-card-fire.cjs bug this same session fixed with zero false positive on the clean control, honest-degrade/no-silent-skip held, nothing wrote to a real file) and close the phase rather than block on the D7 number. This seed captures the disclosed, still-open reconciliation work rather than letting it silently drop."
---

# SEED-061: Skill-optimization smoke calibration reconciliation (fix labeling bug, re-run smoke, re-check D7)

## What's actually open

Phase 230's smoke run (13 skills, ~$23 subscription usage, not the full 124-skill fleet) surfaced one real, disclosed harness bug and confirmed the underlying mechanism works. The bug, not the mechanism, is this seed's scope:

**Query-generation label artifact.** Many `should_not_trigger` negative eval queries were generated with `expected_skill = null`, but some of them actually have a real correct target skill somewhere in the 124-skill roster. When the funnel judge correctly routes such a negative to that real target (a right answer), the flag-rule scoring counts it as a train miss on the skill under test (`scripts/skillopt-genqueries.cjs`, the negative-generation step) -- inflating the flag/mismatch count with false alarms that are actually the judge being correct.

Separately (informational, not a defect to fix): several of the 7 skill-level mismatches against the navigator's smoke pre-labels are the funnel correctly catching real full-roster collisions the pre-labels could not see, since the pre-labels were written judging each skill in isolation (deck -> `MOSDeckEngine`, jtbd -> `suggest-next`, explore-futures -> `scenario-plan`, explore-domains -> `macro-trends`). These are not a bug -- they are the roster-wide method doing its job. Re-labeling against the now-visible full roster (not just fixing the null-negative bug) is part of getting a clean D7 read, not optional cleanup.

## What this seed is NOT

- Not a re-open of Phase 230's build. The harness (`scripts/skillopt-*.cjs`, `lib/core/skillopt-schemas.cjs`, `tests/run-all-230.sh`) is built, committed, and phase-closed.
- Not the full 124-skill fleet run. That stays deferred behind the navigator's own explicit multi-agent-orchestration opt-in, untouched by this seed, per Phase 230's CONTEXT.md Execution mechanism decision.
- Not a reason to distrust the harness's core proofs (detector bidirectional correctness, WS2 finding a real bug with a clean control staying clean, honest-degrade discipline) -- those held and are not in question here.

## Concrete next steps (when picked up)

1. Fix the null-negative labeling in `scripts/skillopt-genqueries.cjs`'s negative-query generation step so a `should_not_trigger` query that genuinely has no correct target anywhere in the roster is distinguished from one that does (the latter should either get a real `expected_skill` or be excluded as a bad negative, not silently scored as a miss against an unrelated skill).
2. Re-label the 13-record smoke set (`smoke-labels.json`) with the navigator's expectations informed by the roster-wide collisions Plan 07 surfaced (deck/jtbd/explore-futures/explore-domains) -- a second, better-informed calibration pass, not a rubber-stamp of the first.
3. Re-run the smoke (13 skills only, ~$23-equivalent subscription usage, no fleet spend) and re-check the D7 gate (`checkSmokeAgreement`) against the corrected labels and fixed negative-generation.
4. Only then does the fleet-run go/no-go conversation become live again -- this seed's job stops at "is D7 green," not at "should we spend the ~$480-equivalent subscription usage on all 124 skills."

## Cost note (subscription usage, not billing -- confirmed 2026-07-18)

All harness spawns authenticate via `--plugin-dir` (keychain/OAuth), never `--bare` / `ANTHROPIC_API_KEY` (confirmed unset in this environment). The `total_cost_usd` figures in Plan 07's projection (~$23 smoke actual, ~$480 fleet projection) are Claude Code's internal token-cost estimate, not a separate bill -- the real constraint for a future fleet run is subscription rate-limit/quota consumption, not out-of-pocket spend. Carry this framing forward into any future fleet-run discussion; do not re-present it as a dollar cost.
