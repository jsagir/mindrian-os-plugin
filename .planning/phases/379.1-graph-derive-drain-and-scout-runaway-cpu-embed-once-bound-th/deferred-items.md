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

Logged by plan 02 (Wave 1) on 2026-10-21. Plan 02 adds three lib/core modules, the thread cap in
embedding-spine.cjs, a stub package under tests/fixtures and four completed tests; it does not touch
package.json or any 341 gate file, so neither item below is caused by this plan.

| Gate | Finding (as printed) | Mark |
|------|----------------------|------|
| `tests/test-341-no-heavy-dep.cjs` | arm 3 FAIL: "devDependencies is present and non-empty ({"mindrian-design-system":"github:jsagir/mos-brand"})"; package.json was last changed by commit bb5f30ad8 (chore(brand): install and adopt mos-brand workflow), before this phase | PROVEN (run after Task 3; arms 1, 2 and 4 pass, so the stub package under tests/fixtures is not the cause) |
| `node scripts/check-require-integrity.cjs` | did not finish inside 180 s (timeout 124) | UNVERIFIED (not in the plan's verify list; no result read) |

Notes:
- The eight `tests/test-379.1-*.cjs` scaffolds are RED by design (Wave 0); they are not deferred items.
- After plan 02 four of them are GREEN (vector-cache, artifact-scope, queue-lock, worker-caps).
- The runner's own legs (large-fixture, Part 8 sweep, em-dash sweep) PASSED.
- The full runner takes about 50 minutes because `run-all-224.sh` runs `doctor --acceptance`; a
  later wave may want a `--phase-only` switch, which is a change to the runner, not a defect.
