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

Logged by plan 06 (Wave 3) on 2026-10-21.

| Item | Finding (as printed) | Mark |
|------|----------------------|------|
| Live large room leg, drain child RSS | `node scripts/real-room-run.cjs --large-room-only --json` (full leg, real encoder, 2,105 artifacts) gave status `breach`, `first_not_ok` `drain.max_rss_mb`: drain clock 36,807 ms, CPU 61,876 ms, peak RSS 1,837 MB against the 1,024 MB limit, outcome `bounded_progress`. Scout: 125 ms, 164 ms CPU, 74 MB, `artifact_cap_exceeded`. Scope: 5 and 5 artifacts, 2,100 excluded. Clock and CPU are far inside their limits; only the drain peak RSS breaches. | PROVEN (one live run); cause not measured. Hypothesis, UNVERIFIED: the ONNX session and its memory arena at batch size 32 (`MINDRIAN_EMBED_BATCH`), not the 2,105 x 384 vector array (about 3 MB). Next: measure peak RSS at `MINDRIAN_EMBED_BATCH` 8 and 16, then either lower the default batch or raise `MINDRIAN_LARGE_ROOM_RSS_MB` with a written reason. The gate refuses a receipt cut on this HEAD until the leg passes. |
| tests/test-379.1-pair-cursor.cjs scenario 8 | failed in 1 of 4 runs before plan 06: the 1 ms budget was not spent when 12 texts embedded in under 1 ms. Fixed in plan 06 (embedFn holds 5 ms); 5 of 5 runs green after. | PROVEN |
| Live large room leg, drain child RSS (resolved by plan 09) | Decision a-batch (batch 8, tests/fixtures/379.1/rss-decision.json). Before: 1,837 MB peak against 1,024 MB. After, two consecutive full live runs (not smoke, code 6c00d9cc4): status ok both; drain peak RSS 776.9 MB and 780.2 MB; drain clock 44,896 and 43,911 ms; drain CPU 57,023 and 53,780 ms; scout artifact_cap_exceeded; scope ok. Limits in force: RSS 1,024 MB, clock 300,000 ms, CPU 600,000 ms (unchanged). Headroom of the highest drain peak under the RSS limit: 23.8 percent. Also: tests/test-379.1-pair-cursor.cjs scenario 8 now pins MINDRIAN_EMBED_BATCH to 32 because the budget is checked between batches and 12 texts no longer fit one batch at the new default. | PROVEN (measured on this machine; Windows not measured) |
