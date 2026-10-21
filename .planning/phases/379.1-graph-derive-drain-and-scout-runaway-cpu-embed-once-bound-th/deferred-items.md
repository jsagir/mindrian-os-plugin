# Phase 379.1 deferred items (out of scope, logged by the executor)

Logged by plan 01 (Wave 0) on 2026-10-21. These failures appeared inside the regression legs of
`tests/run-all-379.1.sh` on its first full run (HEAD 281760e50, 2,999 s wall clock). Plan 01 adds
only new files under `tests/` and touches no `lib/` or `scripts/` file, so none of them is caused
by this plan (scope boundary rule). Each needs its own `/gsd-debug` or quick task before Plan 06
can require "every leg PASSED".

| Leg | Inner failure (as printed) | Mark |
|-----|----------------------------|------|
| `tests/run-all-222.sh` (nested inside run-all-224 and run directly) | `test-222-readonly-rank.cjs`: AssertionError "VACUOUS-GREEN RISK: the scored order did not flip the input order; got [context_block, deep_research]" | PROVEN (log line 425) |
| `tests/run-all-224.sh` | 2 legs FAILED: the nested run-all-222 leg above and "Req 7 doctor --acceptance (no-new-regression vs documented baseline)" | PROVEN (log lines 293, 522) |
| `tests/run-all-233.sh` | `test-233-graph-heal-pipeline.cjs` G3 CONTROL assertion; `test-233-hsi-scope-to-nodes.sh` and `test-233-hsi-uri-path-encoding.sh` "could not build the fixture room.db" | PROVEN (log lines 631-652) |
| `tests/run-all-272.sh` | `272-cache-probe.test.cjs` FAILED | PROVEN (log line 732); cause not read |
| `tests/test-354-write-lock-ownership.cjs` | FAILED | PROVEN (log line 911); cause not read |

Notes:
- The eight `tests/test-379.1-*.cjs` scaffolds are RED by design (Wave 0); they are not deferred items.
- The runner's own legs (large-fixture, Part 8 sweep, em-dash sweep) PASSED.
- The full runner takes about 50 minutes because `run-all-224.sh` runs `doctor --acceptance`; a
  later wave may want a `--phase-only` switch, which is a change to the runner, not a defect.
