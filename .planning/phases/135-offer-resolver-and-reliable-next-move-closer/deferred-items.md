# Phase 135 Deferred Items

Out-of-scope discoveries logged during execution (not fixed; not caused by this phase).

## DI-135-01 -- offer-presenter.test.cjs Tests 16 + 17 pre-existing FAIL (integration)

- **Found during:** 135-03 Task 3 regression sweep.
- **Suite:** `lib/memory/offer-presenter.test.cjs` (15/17 passed).
- **Failing:** Test 16 (engine offer renders Offer line in additionalContext) and
  Test 17 (ignore-loop turn 1 shown / turn 2 ignored). Both are `classifierIntegrated()`
  integration tests that spawn the REAL `scripts/intent-classifier.cjs` as a subprocess
  with a stubbed offer (`MOS_NAV_TEST_OFFER_COMMAND`) and assert the hook creates
  `<roomDir>/.mindrian/offer-history.json`.
- **Symptom:** `turn 1 must create offer-history.json; missing at .../.mindrian/offer-history.json`.
  The spawned classifier does not write the offer-history ledger in the test fixture.
- **Pre-existing (NOT a 135-03 regression):** Proven by running the suite against the
  committed HEAD `scripts/intent-classifier.cjs` (via `git show HEAD:...`) with NONE of the
  Phase 135-03 edits applied -- Tests 16 + 17 fail identically (15/17). The count is
  byte-identical before and after the 135-03 closer wiring. The 14 presenter UNIT tests
  and the resolver/closer suites are all GREEN.
- **Likely root cause (not investigated to fix):** a test-fixture / spawn-env resolution
  issue (`MINDRIAN_ROOMS_ROOT` / room-dir resolution / a hook short-circuit on the
  fixture's empty stdin path), unrelated to the offer loop logic. The presenter ledger
  write path itself is exercised GREEN by the unit tests.
- **Disposition:** DEFERRED. Out of scope per the executor SCOPE BOUNDARY (only auto-fix
  issues DIRECTLY caused by the current task's changes). Recommend a `/gsd:debug` session
  on the offer-presenter integration fixture spawn path if these two tests are needed GREEN
  in CI. They are gated behind `classifierIntegrated()` and do not block the Phase 135
  scoped runner (`tests/run-all-135.sh` is 4/4 GREEN).
