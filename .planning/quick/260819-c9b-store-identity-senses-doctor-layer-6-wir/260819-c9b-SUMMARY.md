---
phase: quick-260819-c9b
plan: 01
subsystem: doctor-brain-smoke, dual-graph-health-gate
tags: [brain-boundary, doctor, class-m, dual-graph-gate, stale-replica-detection]
dependency_graph:
  requires: [lib/core/brain-client.cjs, lib/core/doctor/class-m-brain-smoke.cjs, scripts/check-dual-graph-health.cjs]
  provides: [store_identity-layer-6, getBrainUrl-accessor, readLiveMetrics-live-reader, dual-graph-health-baseline]
  affects: [scripts/doctor.cjs, tests/test-127-02-doctor-class-m.sh, tests/test-127-03-acceptance-gates.sh, lib/memory/dual-graph-health.test.cjs]
tech_stack:
  added: []
  patterns: [opts-injection-seam-hermeticity, fail-closed-on-inconclusive-read, named-signature-before-generic-floor]
key_files:
  created:
    - data/dual-graph-health-baseline.json
  modified:
    - lib/core/brain-client.cjs
    - lib/core/doctor/class-m-brain-smoke.cjs
    - lib/core/doctor/class-m-brain-smoke.test.cjs
    - tests/test-127-02-doctor-class-m.sh
    - tests/test-127-03-acceptance-gates.sh
    - scripts/doctor.cjs
    - scripts/check-dual-graph-health.cjs
    - lib/memory/dual-graph-health.test.cjs
decisions:
  - "getBrainUrl() added as an independent top-level function anchored immediately after stats() in brain-client.cjs, per hard_constraints item 5, so the concurrent 260819-c8j diff to the same file composes cleanly (only a trivial module.exports conflict expected)."
  - "STALE_REPLICA_NODE_COUNT doctrine comments were reworded twice to avoid literal forbidden-pattern hits: the retired hostname string (Canon Part 8 adversarial sweep, tests/test-127-03-canon-part-8-adversarial.sh) and the old M4 pattern-comprehension Cypher literal (the new regression-pin test in dual-graph-health.test.cjs). Both comments now describe the fact without spelling out the literal string the greps key on."
  - "A 4th LAYERS consumer not named in the plan (tests/test-127-03-acceptance-gates.sh gate-5) also hard-coded the layer count at 5; re-pinned to 6 under Rule 3 (blocking issue caused directly by the Task 2 change) so run-all-127.sh stays green."
metrics:
  duration: "~35 minutes (2026-08-19T09:06 to 2026-08-19T09:16 UTC commit span, plus verification/SUMMARY time)"
  tasks_completed: 3
  files_changed: 8
  completed_date: "2026-08-19"
---

# Quick Task 260819-c9b: Store-identity sense (doctor L6) + dual-graph gate live reader Summary

Doctor gained a 6th Class-M layer (store_identity) that catches a session pointed at the retired stale-replica Brain store by its frozen 28325-node signature, and the dual-graph health gate's fail-closed stub reader was replaced with a live four-Cypher reader that recorded a real baseline for the first time.

## What Was Built

**Task 1 -- store_identity sense (layer 6) + endpoint accessor.**
`lib/core/brain-client.cjs` gained `getBrainUrl()`, a one-line accessor over the existing `BRAIN_URL` module const, added immediately after `stats()` and exported alongside it (per hard_constraints item 5, so the concurrent quick task 260819-c8j's edit to the same file composes without collision -- only the `module.exports` block carries a trivial expected diff overlap).

`lib/core/doctor/class-m-brain-smoke.cjs` gained a sixth frozen `LAYERS` entry (`id: 'store_identity'`) and `_layer6(opts)`, which:
1. Resolves the endpoint via `getBrainUrl()` (mockable via `opts.mockBrainUrl`), computes `override` (is `MINDRIAN_BRAIN_URL` set) and `canon` (does the endpoint match the canon default); an endpoint that is neither canon nor an explicit override is a FAIL.
2. Reads `stats()` (mockable via `opts.mockStats`); a null/non-object result or a missing/non-finite `totalRecordCount` fails closed with a named reason -- never a fabricated count.
3. Checks the exact stale-replica signature (28325) FIRST, before the generic 29000 floor, so a FAIL always carries the literal token `stale_replica_signature` when the wire is pointed at the retired copy. A count merely below the floor (but not the exact signature) gets a distinct FAIL reason without that token.
4. Best-effort reads the GraphRagMeta stamp (`schema_version`, `last_reconciled`, `refreshed_at`) through the existing `query()` chokepoint; the stamp never affects the verdict and any failure degrades silently to "no stamp".

`_runLayer`/`checkBrainSmoke` were extended to thread an optional `payload` through a row without changing the shape of layers 1-5.

**Task 2 -- moved the LAYERS wire-lock to 6 across all consumers.** Updated `class-m-brain-smoke.test.cjs` (all-mocks bags in tests 2/7/8/10 gained `mockBrainUrl`/`mockStats`/`mockQuery` so the suite stays hermetic; cascade tests 3-6 extended to L6; new Test 11 covers the store-identity contract), `tests/test-127-02-doctor-class-m.sh` (T2/T4 re-pinned to 6), and `scripts/doctor.cjs` (help text, the human renderer now prints endpoint/node_count/canon/stamp evidence when a layer carries a payload, and the `--acceptance` `activation-reached-the-wire` point gained a store-identity assertion after the existing L4 version comparison -- absent layer or a stale-signature FAIL blocks the release; any other store-identity failure is informational only, matching the same "don't brick the release train on ordinary churn" reasoning that keeps the dual-graph gate report-only).

A 4th LAYERS consumer not named in the plan's file list, `tests/test-127-03-acceptance-gates.sh` (gate-5), also hard-coded the layer count at 5 and would have broken `run-all-127.sh`. Fixed under deviation Rule 3 (see below).

**Task 3 -- the dual-graph gate's live reader, baseline recorded.** In `scripts/check-dual-graph-health.cjs`: `M4_CYPHER`'s orphan predicate was swapped from the pattern-comprehension `size((n)--()) = 0` form (measured live at 5031ms, exceeds the server's 5000ms `cypherReadOnly` budget and returns a text error) to the built-in `degree(n) = 0` form (measured live at 688ms, identical meaning). Added `REVIEW_MARKER` constant, `_firstRowValue(res, key)` (the fail-closed row-reading seam), and `readLiveMetrics(brainClient)` (runs the four live Cypher reads through `brainClient.query`, computes M3's no-fork contract locally with no Brain touch, returns null if any single metric is unreadable or the client is unavailable, never throws). `makeBrainReader` gained an optional `prefetched` second arg (the no-arg default behavior is unchanged -- a regression-pin test asserts this). `main()` is now async and drains `readLiveMetrics` before calling the still-synchronous `runCheck`.

`lib/memory/dual-graph-health.test.cjs` gained hermetic coverage (a fake `brainClient`, never touches the network): the conclusive four-read case, the exact live M4 budget-overrun response shape, `isAvailable()`-false and thrown-error paths, the M2 bound `review_marker` param, both `makeBrainReader` arities, and a regression pin asserting the old slow Cypher idiom does not return.

## Live Results (measured, not targeted)

- **doctor L6 live run:** `node scripts/doctor.cjs --brain-smoke` -> L6 **PASS**, `node_count=29055`, `canon=true`, `endpoint=https://pws-brain-mcp.onrender.com`.
- **GraphRagMeta stamp:** present, carrying only `refreshed_at=2026-08-11T04:45:14.431468`. `schema_version` and `last_reconciled` were absent, which is expected per the plan's measured_facts (not yet introduced Brain-side) -- the layer did not fail and did not fabricate the missing fields.
- **Dual-graph gate live run:** `node scripts/check-dual-graph-health.cjs` -> outcome `baseline_recorded`, exit 0. `data/dual-graph-health-baseline.json` committed with the five measured values: `m1_min_cohort=1`, `m2_review_required=23`, `m3_no_fork=true`, `m3_raw_cross_label_dups=103`, `m4_max_orphan_rate=1`.
- `--flip-blocking` was NOT used. `DEFAULT_MODE` remains `'baseline'` and the gate was NOT added to `scripts/verify-release`. The flip to blocking mode is a deliberate post-release decision, deferred until the baseline has proven stable across multiple runs (mirrors the existing 130.7 doctrine: an absolute gate today would brick the release train on ordinary pre-existing debt Phase 132 is scoped to clean up).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] A 4th LAYERS consumer not named in the plan (`tests/test-127-03-acceptance-gates.sh` gate-5) also hard-coded the layer count at 5**
- **Found during:** Task 2 verification (`bash tests/run-all-127.sh`)
- **Issue:** The plan's Task 2 named three LAYERS consumers (the class-m suite, the 127-02 shell harness, `scripts/doctor.cjs`), but a fourth file independently asserted `j.layers.length !== 5` and per-index skipped-cascade reasons up to index 4. Adding L6 broke this gate.
- **Fix:** Re-pinned `tests/test-127-03-acceptance-gates.sh` gate-5 to 6 layers and added the L6 skipped-cascade assertion (exit code 18), mirroring the pattern already applied to the three named consumers.
- **Files modified:** `tests/test-127-03-acceptance-gates.sh`
- **Commit:** ba2fbaae

**2. [Rule 1 - bug] STALE_REPLICA_NODE_COUNT doctrine comment tripped the file's own Canon Part 8 adversarial forbidden-pattern sweep**
- **Found during:** Task 2 verification (`bash tests/run-all-127.sh` -> `test-127-03-canon-part-8-adversarial.sh` FAIL)
- **Issue:** The first doctrine comment for `STALE_REPLICA_NODE_COUNT` in `class-m-brain-smoke.cjs` spelled out the literal retired hostname (`mindrian-brain.onrender.com`), which the file's own adversarial sweep forbids anywhere in the source, comments included.
- **Fix:** Reworded the comment to describe the retired replica without the literal hostname string.
- **Files modified:** `lib/core/doctor/class-m-brain-smoke.cjs`
- **Commit:** ba2fbaae

**3. [Rule 1 - bug] The new M4 doctrine comment's literal old-Cypher quote defeated its own regression-pin test**
- **Found during:** Task 3 verification (`node lib/memory/dual-graph-health.test.cjs` -> Test 14 FAIL)
- **Issue:** The doctrine comment explaining the M4 predicate swap quoted the exact old pattern-comprehension string (`size((n)--()) = 0`) for context. The new regression-pin test (added per the plan's Task 3 spec) greps the source for that exact literal to prove the slow idiom does not return -- so the comment itself tripped its own tripwire.
- **Fix:** Reworded the comment to describe the old idiom without spelling out its literal syntax, so the grep now only matches a genuine regression, not documentation.
- **Files modified:** `scripts/check-dual-graph-health.cjs`
- **Commit:** 93fe3c04

No other deviations. Tasks 1-3 executed as specified otherwise.

## Known Stubs

None. Every payload field either carries a live-measured value or is omitted per the fail-closed / no-fabrication contract (e.g. an absent GraphRagMeta field, a null-on-inconclusive gate read).

## Threat Flags

None. All new surface (the L6 store-identity probe, the GraphRagMeta stamp read, the gate's four live Cypher reads) was already covered by the plan's own threat register (T-c9b-01 through T-c9b-06) and no additional network surface, auth path, or schema change was introduced beyond what the plan specified.

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 3 task commit hashes (c1dacd53, ba2fbaae, 93fe3c04) confirmed present in git log.
