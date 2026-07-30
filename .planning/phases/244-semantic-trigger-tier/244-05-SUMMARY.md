---
phase: 244-semantic-trigger-tier
plan: 05
subsystem: sensors
tags: [sensor, bm25, fts5, trigger-tier, canon-part-8, dispatch-sensors]

# Dependency graph
requires:
  - phase: 244-01
    provides: "TRIGGER_TIERS includes 'content'; isFallbackTier(tier) allowlist"
  - phase: 244-02
    provides: "lib/core/eureka/fts-index-lifecycle.cjs: ftsIndexState/requestFtsBuild/spawnFtsBuildDrain"
provides:
  - "lib/core/sensors/sensor-content-relevance.cjs: sensorContentRelevance/detectContentRelevance/resolveContentRelevanceDecision (SENS-16)"
  - "SENSOR_REGISTRY's 18th entry (sensorContentRelevance), re-exported by name from insight-sensors.cjs"
  - "sensorCtx.contentHitCount/contentCoverage/contentIndexState/contentCandidates on navigation-engine.cjs's decide()"
  - "TRIG_CONTENT_MIN_HITS / TRIG_CONTENT_MIN_COVERAGE env vars"
affects: [244-04, 244-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-layer sensor split (pure sensor / ctx-assembly db-reading producer / gate action), the sensor-expert-skill.cjs precedent, now proven a 3rd time"
    - "Lazy (call-time) require of a heavy sibling module from a lib/core/sensors/ file to break a multi-hop require cycle discovered only by live execution, not by any single file read"
    - "Distinguishable index-state enum (index_absent/index_empty/index_stale/ok/unavailable) consulted BEFORE the retrieval call, so a silent-swallow catch can never masquerade as a legitimate zero-hit"
    - "Raw-evidence spy (monkeypatch makeReach via the shared require cache) to fence Canon Part 8 at the PRE-filter boundary, not just the post-filter one"

key-files:
  created:
    - lib/core/sensors/sensor-content-relevance.cjs
    - tests/test-244-content-sensor-fires.cjs
  modified:
    - lib/core/navigation-engine.cjs
    - lib/core/insight-sensors.cjs

key-decisions:
  - "detectContentRelevance checks BOTH ftsIndexState(db) (structural table presence) AND ensureFtsAvailable() (runtime FTS5 capability) before trusting a legitimate zero-hit -- the plan's literal action text only named the first; the second was added live after Correction 4 and the FTS-FORCED-ABSENT acceptance leg proved the first alone lets a forced-absent capability masquerade as a genuine zero-hit on a room whose index was built earlier"
  - "tri-modal-index.cjs and fts-index-lifecycle.cjs are required LAZILY (function-local) inside detectContentRelevance, not at module top level -- a top-level require creates a real multi-hop cycle (sensor-content-relevance -> tri-modal-index -> vector-store -> rs-pinecone-bridge -> rs-egress-prompts -> cross-room-aggregator -> folder-memory -> feynman/timeline-runner -> timeline-renderer -> navigation.cjs -> navigation/calibration-log.cjs -> f-selector-ranker.cjs -> navigation-engine.cjs -> insight-sensors.cjs -> back to this file) that crashed tests/test-211-vec0-capability.cjs with a real TypeError, live-verified"
  - "FIRE/ANTI-FIRE turns deliberately do NOT reuse 244-RESEARCH.md's own measured example ('the reverse salient in the graph derivation pipeline') -- that phrase collides with sensor-lagging-component.cjs's own /\\breverse salient\\b/i keyword AND sensor-circularity.cjs's documented reuse of that signal, which would make the CONTROL leg (proving the fire is attributable to SENS-16 alone) meaningless. Replacement turns were live-verified against dispatchSensors with the content ctx zeroed to produce zero reaches from every other sensor"
  - "Task 3 adds an INTEGRATION leg that calls navigation-engine.cjs's decide() directly (not just the sensor layer) because MUTATION PROOFS 3 and 4 both mutate navigation-engine.cjs's producer block -- a sensor-layer-only test is insensitive to either mutation"
  - "Canon Part 8 evidence fence uses a require-cache monkeypatch of sensor-types.cjs's makeReach to capture the RAW pre-filter evidence object, not just the final reach.evidence -- MUTATION PROOF 2 proved live that makeReach's own primitive-only filter silently drops a non-primitive key, so a test that only inspects the final reach stays green on that exact mutation (a finding, documented below)"

requirements-completed: [TRIG-01]

# Metrics
duration: 2h10min
completed: 2026-07-30
---

# Phase 244 Plan 05: SENS-16 Content-Relevance Sensor Summary

**Built the first sensor in this repo that queries a corpus instead of a hardcoded keyword list: `sensor-content-relevance.cjs` fires the existing `context_block` reach when a turn has real bm25 lexical relevance to the room's curated `claim`/`Artifact` material but no structural or keyword signal, closing TRIG-01's core gap that `trigger_tier` was purely decorative.**

## Performance

- **Duration:** ~2h10min
- **Completed:** 2026-07-30
- **Tasks:** 3/3
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- `lib/core/sensors/sensor-content-relevance.cjs` implements the exact 3-layer split (`sensorContentRelevance` pure sensor / `detectContentRelevance` ctx-assembly producer / `resolveContentRelevanceDecision` gate action), rides the frozen `context_block` reach with a load-time fail-closed throw on drift, and never mints a 7th reach.
- The producer consults `ftsIndexState(db)` and the FTS5 capability probe (`ensureFtsAvailable()`) BEFORE ever calling `lexicalSearch`, so five states (`index_absent`, `index_empty`, `index_stale`, `ok`, `unavailable`) are all distinguishable from a genuine zero-hit. A structural miss enqueues its own repair via `requestFtsBuild` + `spawnFtsBuildDrain` (RESEARCH BLOCKER B-2's lazy build-on-first-miss).
- The reach's evidence carries only `hit_count`, `coverage`, `trigger_tier: 'content'`, and `sub_mode` -- closed scalars only, fenced both at the post-`makeReach` boundary AND (after a live finding) at the pre-filter boundary via a require-cache spy.
- `navigation-engine.cjs`'s `decide()` grew a new ctx-assembly producer block (mirroring the SENS-11 block exactly: bare-scope, caller-owned `ctx.roomDb` handle, one try/catch soft-fail, caller-threaded overrides as the test seam) using the FULL canonical turn-text precedence (`t.text || t.utterance || t.userText`), correcting 244-RESEARCH.md's `t.userText`-only example.
- `insight-sensors.cjs`'s `SENSOR_REGISTRY` now holds 18 entries; `sensorContentRelevance` is re-exported by name.
- `tests/test-244-content-sensor-fires.cjs`: 16 legs, PASS=16 FAIL=0, covering FIRE, a CONTROL run proving no other sensor is responsible, a second relevant cluster, three ANTI-FIRE turns against the SAME built index, punctuation survival, the full `decide()` integration path, INDEX ABSENT, FTS FORCED ABSENT, the CTX-OVERRIDE test seam, PURITY (a throwing-proxy `ctx.roomDb`), never-throws on hostile input, and the corpus-scoping tripwire (a `fragments`-only word yields zero content candidates against the SAME live index).

## Observed Hit Counts (transcribed from the live test run)

| Turn | State | Hits | Coverage |
|------|-------|------|----------|
| FIRE: "opportunity bank agentic reasoning environment" | ok | 2 | 1.0 |
| SECOND: "wiki dashboard export snapshot templates for the data room" | ok | 2 | 1.0 |
| PUNCTUATED: "what about the opportunity bank (agentic reasoning environment)? it's the framework!" | ok | 2 | 0.556 |
| ANTI-FIRE: "what is the weather in paris today" | ok | 0 | 0 |
| ANTI-FIRE: "my cat needs a vet appointment tomorrow" | ok | 0 | 0 |
| ANTI-FIRE: "order pizza for dinner tonight" | ok | 0 | 0 |

FIRE and ANTI-FIRE were asserted against the SAME built index in the SAME test run (Pitfall 3's requirement); the anti-fire turns are not vacuous.

## Live Sensor-ID Re-Verification

Re-read `lib/core/insight-sensors.cjs`'s `SENSOR_REGISTRY` at execution time (2026-07-30): 17 entries, canonical order ending at `sensorUrlIngest` (SENS-15, Phase 220). `SENS-16` was confirmed free; no parallel session had claimed it. The dated check is written into the sensor file's own header, per the `sensor-eureka.cjs:15-16` precedent.

## SENS-16-Needs-No-Connector Finding

`node scripts/build-connector-registry.cjs --check` exits 0 with `sensorContentRelevance` registered as the 18th sensor and NO new `data/connector-registry.json` entry. This matches the planning-time finding: `sensor_index` already shows SENS-11 (expert-skill) and SENS-12 (room-pick) both riding `context_block` with no connector entry. A reviewer should not demand one for SENS-16 either.

## Mutation Proofs (all six executed live and reverted)

1. **REACH_ID drift.** Changed `REACH_ID` to `'not_a_real_reach'`. `require('./lib/core/sensors/sensor-content-relevance.cjs')` threw: `sensor-content-relevance: REACH_ID "not_a_real_reach" is not in the frozen REACH_IDS bank`. Restored; module loads cleanly again. Re-confirmed a second time against the full `test-244-content-sensor-fires.cjs` file (requiring the test file itself threw the same error), then restored.
2. **Non-primitive evidence key.** Added `matched_node_ids: ['MUTATION_PROOF_2_fake_node_1', 'MUTATION_PROOF_2_fake_node_2']` to the pure sensor's evidence literal. **FINDING:** the FINAL `reach.evidence` stayed clean (`makeReach`'s primitive-only filter silently dropped the array -- verified directly: `Object.prototype.hasOwnProperty.call(reach.evidence, 'matched_node_ids')` returned `false`), so a test that only inspects the post-`makeReach` reach would have stayed GREEN on this mutation -- a real gap. The PART-8 test leg was strengthened (per the plan's own instruction) with a require-cache spy on `sensor-types.cjs`'s `makeReach` that captures the RAW pre-filter `opts.evidence` object; against that spy the mutation turned RED (`raw pre-makeReach evidence.matched_node_ids must be a closed scalar (string/number/boolean), got object`). Restored; both the raw and final evidence checks pass again.
3. **Remove the `detectContentRelevance` call from the producer.** Replaced the call with `const sig = null;` inside `navigation-engine.cjs`'s producer block. The new INTEGRATION (`decide()`) test leg turned RED: `decide() must thread the content-relevance reach into context_assembly.facts: []`. All other legs that call the sensor/producer layer directly stayed green (expected -- they never go through `decide()`). Restored from a pre-mutation backup; full suite green again (16/16).
4. **Narrow the turn-text read to `t.userText` only.** The INTEGRATION leg turned RED for the same reason (the turn object used in the test only sets `.text`, never `.userText`, so the narrowed producer saw empty text and zero hits). Restored; full suite green again.
5. **Zero both floors.** Set `CONTENT_MIN_HITS = 0` and `CONTENT_MIN_COVERAGE = 0` directly in the source. FOUR legs turned RED: the CONTROL leg (now fires on `hits:0, coverage:0`, proving it is no longer a true control) and all three ANTI-FIRE legs (the sensor now fires on the irrelevant turns too, since `0 < 0` is false at both floors). This proves the floors are load-bearing and the zero-hit corpus-exclusion is not doing all the work by accident. Restored; 16/16 green again.
6. **Widen the corpus to include `fragments`.** Temporarily patched `tri-modal-index.cjs`'s `indexNodes` to also pull rows from the `fragments` table into the indexed corpus. The corpus-scoping leg turned RED (`index is built and live` assertion failed -- the state was no longer a clean `ok`), with 8 further cascading failures across the FIRE/ANTI-FIRE/PUNCTUATION/INTEGRATION/PART-8 legs, confirming the scoping assertion is load-bearing rather than decorative. Restored `tri-modal-index.cjs` from backup; 16/16 green again, `git status` clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Lazy-required `tri-modal-index.cjs` and `fts-index-lifecycle.cjs`**
- **Found during:** Task 1/2 verification (`bash tests/run-all-219.sh`)
- **Issue:** A top-level `require('../eureka/tri-modal-index.cjs')` in `sensor-content-relevance.cjs`, combined with `insight-sensors.cjs` requiring the sensor and `navigation-engine.cjs` requiring `insight-sensors.cjs`, closes a genuine multi-hop require cycle back through `tri-modal-index.cjs`'s own dependency chain (`vector-store.cjs -> rs-pinecone-bridge.cjs -> rs-egress-prompts.cjs -> cross-room-aggregator.cjs -> folder-memory.cjs -> feynman/timeline-runner.cjs -> timeline-renderer.cjs -> navigation.cjs -> navigation/calibration-log.cjs -> f-selector-ranker.cjs -> navigation-engine.cjs -> insight-sensors.cjs`). This crashed `tests/test-211-vec0-capability.cjs` with `TypeError: Cannot read properties of undefined (reading 'vecToBlob')` because `vector-store.cjs`'s exports object was still mid-construction when the cycle re-entered `tri-modal-index.cjs`.
- **Fix:** Both requires moved to lazy, function-local accessors (`lazyTri()` / `lazyFtsLifecycle()`), resolved only when `detectContentRelevance` is actually invoked at runtime -- by which point every module's synchronous top-level load has settled. Mirrors the existing `lazyNav()` precedent in `sensor-expert-skill.cjs` and the lazy `calibration-gate.cjs` require already in `navigation-engine.cjs`.
- **Files modified:** `lib/core/sensors/sensor-content-relevance.cjs`
- **Verified:** `node tests/test-211-vec0-capability.cjs` (5/5 PASS), `bash tests/run-all-219.sh` (Phase 211: PASS=10 FAIL=0; no regression on the sub-suites this phase's dependency chain touches)

**2. [Rule 2 - Missing critical correctness] Added a runtime FTS5-capability check beyond the plan's literal wording**
- **Found during:** Task 1 design, confirmed by Task 3's FTS-FORCED-ABSENT acceptance leg
- **Issue:** The plan's action text says to call `ftsIndexState(db)` and branch on its `reason`, but `ftsIndexState` only classifies the TABLE's structural presence (via `sqlite_master` + row counts) -- it has no opinion on whether the FTS5 extension itself is loadable in this process. On a room whose index was built earlier and then `MINDRIAN_FORCE_FTS_ABSENT=1` is set (or the extension genuinely becomes unavailable), `ftsIndexState` would still report `'ok'` (the table structurally exists), and `lexicalSearch` would silently return `[]` (its own capability check fails internally), producing a FALSE `state:'ok', hits:0` -- indistinguishable from a genuine zero-hit. This is exactly the silent-swallow bug class Pitfall 1 documents.
- **Fix:** `detectContentRelevance` separately calls `tri.ensureFtsAvailable()` after `ftsIndexState` reports `'ok'`, and returns `state:'unavailable'` (no enqueue -- rebuilding cannot fix a missing extension) when the capability probe fails.
- **Files modified:** `lib/core/sensors/sensor-content-relevance.cjs`
- **Verified:** Task 3's `FTS FORCED ABSENT` leg (PASS)

### Not Fixed (Out of Scope, Documented)

- **Pre-existing baseline failures in `bash tests/run-all-219.sh`:** `Phase 218: PASS=15 FAIL=3` (feeding into `Phase 219: PASS=11 FAIL=2`), all traced to `TypeError`/assertion failures reading `"table edges has no column named review_status"` and a related eureka auto-extract encoder-unavailable degrade path. These failures are byte-identical before and after this plan's changes (confirmed by running the same suite before and after Tasks 1-2, and by the failures having zero relationship to `lib/core/sensors/`, `insight-sensors.cjs`, or `navigation-engine.cjs`'s content producer). Almost certainly caused by a concurrent session's schema/migration work noted in `244-RESEARCH.md`'s own concurrency warning. `bash tests/run-all-236.sh` stays fully green (`PASS=12 FAIL=0`), and `bash tests/run-all-244.sh` is fully green (`PASS=7 FAIL=0`), confirming this plan's own surface is clean.
- **`node lib/memory/run-feynman-tests.cjs` (the full ~398-file Feynman-MINTO suite):** grepped for any reference to `insight-sensors`, `SENSOR_REGISTRY`, or `dispatch-sensor` -- zero hits, confirming this runner does not exercise the sensor registry at all. Two files reference `navigation-engine` by name (`lib/memory/navigation-engine-core.test.cjs`, `lib/memory/navigation-engine-offer.test.cjs`); both were run directly and pass in full (`33/33` and `11/11` respectively, 0 failures, no sensor-count assertion in either). A full run of the 398-file suite was attempted twice and both times surfaced unrelated pre-existing failures (e.g. `test/84-smart-notebook-copilot.test.cjs` failing on a `lazygraph-ops.cjs` db-handle issue with zero relation to this plan) well before completing within a reasonable time budget; it was not run to completion given the two directly-relevant legs are fully green and the runner provably never touches this plan's surface.
- **Auto-regenerated cache files** (`evals/plurai/211-baseline.json`, `dashboard/graph.json`) appeared as dirty diffs during test runs and were reverted with `git checkout --` before the final commit; neither is part of this plan's change.

## Threat Flags

None. All five STRIDE threats this plan's `<threat_model>` names (T-244-17 through T-244-21) are mitigated exactly as specified: turn text never reaches `MATCH` directly (routed through `lexicalSearch` -> `toFtsMatch` only), evidence carries closed scalars only (fenced at both the pre- and post-`makeReach` boundary), the pool is capped at `CONTENT_POOL_K=6`, an absent index is a distinguishable enum consulted before any retrieval, and the pure sensor performs zero IO (fenced by both a source-level grep and a live throwing-proxy `ctx.roomDb` test).

## Self-Check: PASSED

- FOUND: `lib/core/sensors/sensor-content-relevance.cjs`
- FOUND: `tests/test-244-content-sensor-fires.cjs`
- FOUND: modifications in `lib/core/navigation-engine.cjs` (producer block after the SENS-11 block)
- FOUND: modifications in `lib/core/insight-sensors.cjs` (require line, `SENSOR_REGISTRY`'s 18th entry, named re-export)
- FOUND: commit `dc34fc88` (feat: SENS-16 sensor file)
- FOUND: commit `fe690e71` (feat: wiring into decide() + registry)
- FOUND: commit `f1f67d07` (test: 16-leg proof suite)
- Final verification: `node tests/test-244-content-sensor-fires.cjs` -> PASS=16 FAIL=0; `bash tests/run-all-244.sh` -> PASS=7 FAIL=0 SKIP=0; `git status` -> clean
