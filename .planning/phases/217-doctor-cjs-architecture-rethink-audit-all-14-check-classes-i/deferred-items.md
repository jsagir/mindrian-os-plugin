
## Deferred (Plan 03 execution, 2026-07-11)

- **test-hmi-compliance-e2e.cjs test #11 "hooks.json byte-identity for Phase 99/100/103 Stop entries" FAILS** -- pre-existing, out of scope. This asserts byte-identity of `hooks.json` Stop entries; Plan 03 touches only `scripts/doctor.cjs`, `data/doctor-modules.json`, and two doctor tests, never `hooks.json`. Tests 1-10 (the `--ui-compliance` doctor path this plan migrates) all PASS. Not a regression from the F/K/L/N migration.
