# Deferred Items - Phase 251 Plan 01

Out-of-scope pre-existing failures discovered during the Task 2 regression
sweep (`bash tests/run-all-209.sh`, `bash tests/run-all-210.sh`), confirmed
present BEFORE any 251-01 edit (checked against the tree at the 251-01 Task 1
commit, before Task 2's skeleton-split changes). None reference
`scripts/intent-classifier.cjs`, `renderEngineDecisionWithDial`, the
FIRE-IF-FORK imperative, or the NAV_UNCHANGED_MARKER. Logged, not fixed, per
the SCOPE BOUNDARY rule (only auto-fix issues directly caused by this plan's
own changes).

## tests/test-209-room-pick-sensor.cjs

Fails via a chained `execFileSync` call to `node tests/test-203-reach-sensor.cjs`,
which itself errors. `lib/core/sensors/sensor-room-pick.cjs` requires
`lib/core/room-chooser.cjs`, never `scripts/intent-classifier.cjs`. Unrelated
surface.

## tests/test-209-declared-implies-wired.cjs

Fails on a `declared-implies-wired` registry drift assertion (a hardcoded
list of skills/*.md contradiction-predicate exemptions no longer matches
what's on disk). The test's own failure message: "if this list changed:
either a surface was fixed (remove it here) or a NEW contradiction appeared
(investigate before updating this list -- do not blindly add)." This is a
registry-content drift check, unrelated to the CACHE-02 hygiene pass.

## tests/run-all-210.sh: 210-E1 card-fire relevance gate (two-directional)

Self-labeled in its own output: "softened-direction RED legs are EXPECTED
until plan 210-05 lands" (5 of 11 assertions fail by design, pending a
different, not-yet-executed plan). Pre-existing, documented, unrelated to
251-01.

## tests/run-all-210.sh: 210-D fusion-router suite

Failing before any 251-01 edit; unrelated to the FIRE-IF-FORK skeleton move
or the suppression gate.

## tests/run-all-210.sh: 210-E3 stamp sweep clean (--check)

`node scripts/stamp-firing-block.cjs --check` reports 3 pending files
(eureka.md, find-analogies.md, qualify-opportunity.md) needing a stamp
re-run. A content-maintenance task unrelated to this plan's touched files
(scripts/intent-classifier.cjs, scripts/session-start, scripts/post-compact,
tests/test-251-*, tests/test-209-engine-arm-contract.cjs).
