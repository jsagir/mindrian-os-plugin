---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 06
subsystem: decision-advisor-table
tags: [calibrated-table, isotonic, shortlist, run-step-scope, labels-only, v0-job-only-data]
requires: [399-02, 399-03, 399-04, 399-05]
provides:
  - data/run-step-capabilities.json (schema mos.run-step-capabilities/1; 73 commands, D-05 scope)
  - scripts/refresh-run-step-capabilities.cjs (--source required, --out)
  - scripts/build-decision-advisor-table.cjs (fitIsotonic, applyCalibration, buildTable; default, --check, --print-calibration)
  - data/decision-advisor-table.json (schema mos.decision-advisor-table/1, table_version 399-v0, v0 job-only data)
  - lib/core/decision-advisor/shortlist.cjs (STATES, DEFINITION_LEVELS, advisorEnabled, tableMeta, lookupShortlist, scoreFor, bandFor)
  - tests/test-399-run-steps.cjs (R1-R4), tests/test-399-table.cjs (B1-B6, S1-S7)
affects: [399-07, 399-09, 399-10]
tech-stack:
  added: []
  patterns: [labels-only snapshot with source hash, isotonic PAV calibration over a recorded run, hash-based determinism with no wall clock, one cached local JSON read per turn]
key-files:
  created:
    - scripts/refresh-run-step-capabilities.cjs
    - data/run-step-capabilities.json
    - scripts/build-decision-advisor-table.cjs
    - data/decision-advisor-table.json
    - lib/core/decision-advisor/shortlist.cjs
    - tests/test-399-run-steps.cjs
    - tests/test-399-table.cjs
  modified:
    - tests/run-all-399.sh
decisions:
  - "v0 job-only data (checker warning W3). The recorded run conditions on neither definition level nor last command, so the table holds 13 rows keyed <job>|*|* and conditioned_rows is false. The key format and the fallback order (exact, job|level|*, job|*|last, job|*|*) are built and tested with a fixture table. Definition-level routing and last-command routing are NOT live with the shipped table. The table carries data_scope 'v0 job-only data' and says so in _note."
  - "The calibration label source is the registry serves_jtbd at build time. It includes the 26 labels accepted under D-07 from the same model run, so the calibration is not an independent measure. The table says so in calibration.label_source. No accuracy metric is stored (plan 10 measures)."
  - "Rows keep the top 12 scope commands per job (row_depth 12), sorted by calibrated value descending then command name. Ties at the top value are common (many commands calibrate to 1), so the order inside a tie is alphabetical, not a signal. scoreFor returns null for a command outside the stored depth."
  - "DEFINITION_LEVELS is a frozen 3-member copy inside shortlist.cjs, so the module requires only node:fs and node:path. Test leg S7 pins the copy to lib/core/problem-axes.cjs."
  - "Thresholds and shortlist_k are read at build from navigation-engine RECOMMENDED_CONFIDENCE_FLOOR (0.7), f-selector-ranker BEHAVIORAL_CHANNEL_FLOOR (0.5) and MAX_K (3) and written into the table. The runtime reads them from the table."
metrics:
  tasks: 3
  completed: 2026-11-24
---

# Phase 399 Plan 06: Calibrated shortlist table and per-turn lookup Summary

A v0 job-only table (13 rows, isotonic-calibrated values, no raw probabilities) over the 73 commands that have run steps, with a local-read lookup that returns at most 3 banded options or an explicit no-strong-pick state.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Run-step capability snapshot (D-05) | d62c0bcda |
| 2 | Offline table builder with isotonic calibration, and the v0 table (I-05, I-06) | e0f7cf814 |
| 3 | Per-turn shortlist lookup with band words and no-strong-pick (D-02, I-05, I-08) | 7599ecf57 |

## What was built

- D-05 scope: 116 inventory items have steps, 74 carry a routine id, 73 are registry commands; `/mos:mva-option` is the one that is not. The file holds names, counts, a source hash and a UTC snapshot date. No home path and no step text.
- Table builder: pool-adjacent-violators over all 1469 recorded pairs (label 1 when the registry serves_jtbd of the command holds the job). 14 breakpoints, rounded to 3 decimals. Rows apply the step function to scope commands only. The header holds built_from hashes (recorded, registry labels, scope command list) instead of a build time, so two builds are byte-identical. `--check` byte-compares and names the first differing path; exit 3 with "recorded input absent" when the fixture is missing.
- Lookup: one cached JSON read (cache keyed by path and file time). States ok, no_strong_pick, no_job, no_row, no_table, off; it never throws. lastCommand and every `exclude` name are removed before the top k is taken. k is clamped to the table shortlist_k. Bands: strong at 0.7 and above, possible at 0.5 and above, else weak.

## v0 job-only data (W3)

The shipped table has job-level rows only. Nothing here claims definition-level or last-command routing is live. A later recorded run with those conditions fills finer rows through the same builder. Until then the lookup always falls to `<job>|*|*` with the shipped table.

## Deviations from Plan

None that change behavior. Choices the plan left open:

- **Row depth.** The plan did not set how many commands a row stores. I stored the top 12 (`row_depth`), so the table is 15.6 KB and an exclude list cannot empty a shortlist.
- **Equal-y blocks merge.** PAV pools a block with the previous block when the previous mean is greater than or equal to the current mean. This gives a compact step function with the same values; B1 still matches the plan answer exactly.
- **Extra test leg S7** (frozen level copy equals problem-axes) and an extra env seam name in the refresh script (`MINDRIAN_COMMAND_REGISTRY`, same name the builder uses; the refresh script is outside the fenced lib directory).
- **Plan text stale:** `build-connector-registry --check` exits 0 with 0 GAP lines in this tree (the plan text says 20). Same as plans 02 and 03.
- The plan acceptance "10 PASSED lines" is met by counting the `>>> 399:` lines (10); the raw `PASSED` count is higher because inner tests also print it.
- TDD: RED was shown for Task 1 (test failed before the data file existed). For Tasks 2 and 3 the test file and the code were written in the same step, then run once; RED was not run separately. Not claimed.

No auto-fix rules were triggered.

## Verification

- `node tests/test-399-run-steps.cjs`: 4 passed, 0 failed.
- `node tests/test-399-table.cjs`: 13 passed, 0 failed (B1-B6, S1-S7). S6 printed 0.6 ms for a cold require plus one lookup (hook budget 200 ms).
- `node scripts/build-decision-advisor-table.cjs --check`: exit 0, "OK".
- `node tests/test-399-advisor-fence.cjs`: 9 passed, 0 failed (shortlist.cjs is inside the fenced directory; FN1 and FN2 pass).
- `bash tests/run-all-399.sh`: exit 0, 10 `>>> 399:` PASSED lines.
- `MINDRIAN_DECISION_ADVISOR=off` lookup returns state off (exit 0).
- `grep -cE '"(auc|brier|ece|recall|accuracy|raw|p)"\s*:' data/decision-advisor-table.json`: 0. `grep -c '/home/' scripts/refresh-run-step-capabilities.cjs`: 0.
- `node scripts/build-connector-registry.cjs --check`: OK. `node scripts/check-render-coverage.cjs`: OK.
- Pre-commit hooks ran on all 3 commits and passed. No schema guard entry was needed: no SQL table, index or column was added.

## Risks and open items

- Calibration is circular: the labels it fits to include the labels accepted from the same model run. The values show agreement with the registry, not accuracy. Plan 10 must measure on something independent before any public number.
- Many top options tie at calibrated 1.0 (validate-idea shows 5 or more). The shortlist order inside a tie is alphabetical. Plan 07 must not present the rank inside a tie as a model preference.
- Several jobs may show strong bands for commands the registry already lists for the job; the table adds ranking only where the recorded probability differs. This is as designed for v0.
- The scope file needs a hand refresh when the book inventory changes (private source, no default path).
- Pre-existing failures (not touched): lib/memory/problem-type-router.test.cjs tests 22-24; lib/workflow/command-resolver.test.cjs "Red Teaming must remain command-less"; test-395-job-orders C3; sync-assets --check on assets/framework-names.json; selection eval B1-B4.
- Gemini provider file and the gemini paths in data/egress-policy.json were not touched.

## Known Stubs

None. The table is real data; its v0 job-only scope is stated above, not hidden.

## Self-Check: PASSED

- Files found: scripts/refresh-run-step-capabilities.cjs, data/run-step-capabilities.json, scripts/build-decision-advisor-table.cjs, data/decision-advisor-table.json, lib/core/decision-advisor/shortlist.cjs, tests/test-399-run-steps.cjs, tests/test-399-table.cjs.
- Commits found: d62c0bcda, e0f7cf814, 7599ecf57.
