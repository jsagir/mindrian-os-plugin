---
phase: 165-unknown-unknowns-blindspot-engine
plan: 02
subsystem: engine-core
tags: [unknown-unknowns, dsp, ucb-bandit, pattern-miner, rumsfeld-matrix, inter-partition-distance, deterministic, harness-as-code]

# Dependency graph
requires:
  - phase: 165-01
    provides: the shared IFACE (INSTANCE_FEATURES, TIER_NUMERIC, DEFAULT_CONFIG.dspWeights, CHECKPOINT_SHAPE, FROZEN_ENGINE_EDGES) + the RED stubs (dsp, dsp-goodness, bandit, resume) this plan turns green
  - phase: 164
    provides: lib/core/issue-tree.cjs deterministic single-build purity model (the math-core idiom cloned) + the edge-remap discipline
  - phase: 168
    provides: INVALIDATES / ENABLES frozen in the navigation chokepoint
  - phase: 150.8
    provides: ROOT_CAUSES frozen
provides:
  - PatternMiner (support-bounded descriptive patterns over the INSTANCE_FEATURES schema)
  - DSP Algorithm 1 partition WITH the REAL interPartitionFeatureDistance + interPartitionConfidenceDistance (closes the reference stub-leak; lone partition = 0.0)
  - the UCB-with-discount bandit (index-deterministic arm + instance selection, zero Math.random, per-pull resumable CHECKPOINT_SHAPE, byte-identical resume)
  - the Rumsfeld 2x2 router (categorize KK/KU/UK/UU + quadrant -> frozen FEEDS_INTO routing intent)
affects: [165-corpus-adapter, 165-orchestrator, 165-edge-writer, 165-verdict]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Math core cloned from issue-tree.cjs purity doctrine: pure, single-call, deterministic, zero Math.random / zero Date.now / zero Brain / zero I/O (the futures async shell was NOT cloned)"
    - "The REAL inter-partition distance (165-RESEARCH 1.4): normalized |a-b|/corpusRange numeric + Hamming categorical, unweighted mean over feature dims then mean over id-sorted siblings; a lone partition returns 0.0 (NOT the stub 1.0)"
    - "Index-deterministic bandit (D-165-09): arm order = injected priority desc / tie-break partition-id asc; within-arm pick = ascending-claimId cursor; resume = deterministic replay-then-continue with a divergence tripwire"
    - "Injected arm priority (port change #5): priorityFn is a caller arg (default = partition meanConfidence proxy); the orchestrator supplies the real HSI-or-LOCAL priority, never hardcoded in the bandit"

key-files:
  created:
    - lib/core/unknowns/pattern-miner.cjs
    - lib/core/unknowns/dsp.cjs
    - lib/core/unknowns/bandit.cjs
    - lib/core/unknowns/rumsfeld-matrix.cjs
  modified:
    - tests/test-unknowns-dsp.cjs
    - tests/test-unknowns-dsp-goodness.cjs
    - tests/test-unknowns-bandit.cjs
    - tests/test-unknowns-resume.cjs

key-decisions:
  - "The REAL interPartition distances replace the reference stub return 1.0; a lone partition returns 0.0 (the stub-leak regression guard, Pitfall 2); dsp-goodness asserts the metric discriminates (distinct, non-1.0) AND monotone separation (a farther sibling yields a larger distance)"
  - "Resume is implemented as deterministic replay-then-continue: a matching corpusHash proves the corpus is byte-identical, so resumeFrom rebuilds the state and replays pulls 0..checkpoint.pull (reconstructing the records the checkpoint does not carry), then continues to budget. A replay-cursor tripwire fails closed to a fresh scan on oracle non-determinism."
  - "Arm priority is an injected priorityFn (default partition.meanConfidence) per port-change #5; the bandit does NOT hardcode HSI -- the orchestrator (165-04) chooses HSI-or-LOCAL-fallback"
  - "rumsfeld-matrix returns routing INTENT only (quadrant + frozen FEEDS_INTO target handles); it does NOT invoke commands and does NOT write edges (the orchestrator writes them through the navigation chokepoint); KK carries no downstream route (it is the bandit hunting ground)"

requirements-completed: [D-165-02, D-165-08, D-165-09]

# Metrics
duration: ~40min
completed: 2026-06-19
---

# Phase 165 Plan 02: Deterministic Engine Core Summary

**The deterministic, LOCAL, zero-Brain engine core for the unknown-unknowns blind-spot hunter: a support-bounded PatternMiner, the DSP Algorithm-1 partitioner WITH the REAL inter-partition distance (closing the reference stub-leak so a lone partition returns 0.0 and well-separated regions discriminate), the index-deterministic UCB-with-discount bandit (zero Math.random, per-pull resumable checkpoint, byte-identical resume), and the Rumsfeld 2x2 router that emits frozen FEEDS_INTO routing intent.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-06-19
- **Tasks:** 3
- **Files created:** 4 (+ 4 RED stubs turned GREEN)

## Accomplishments

- `lib/core/unknowns/pattern-miner.cjs` -- `minePatterns(instances)` mines support-bounded descriptive patterns over the shared INSTANCE_FEATURES schema: NUMERIC dims yield quartile `<=`/`>=` conditions (over the corpus-quartile cuts; evidenceTier mapped via TIER_NUMERIC), CATEGORICAL dims yield `=` conditions per distinct value, AND-combined apriori-style up to `maxPatternLength`, kept only above `minSupport`. Pure, deterministic, stable iteration order.
- `lib/core/unknowns/dsp.cjs` -- DSP Algorithm 1 `partition()` greedy set-cover (maximize newCover/goodness, tie-break partition-id asc, until the space is covered) PLUS the REAL `interPartitionFeatureDistance` (normalized `|a-b|/corpusRange` numeric + Hamming categorical, mean over feature dims then mean over id-sorted siblings; corpusRanges computed ONCE for scale-free determinism) and `interPartitionConfidenceDistance` (mean `|meanConf_i - meanConf_j|`). A LONE partition returns `0.0`. `goodness()` wires the real g2/g4 into Eq.2 (`l1*g1 - l2*g2 + l3*g3 - l4*g4 + l5*g5`) using `DEFAULT_CONFIG.dspWeights`.
- `lib/core/unknowns/bandit.cjs` -- Algorithm 2 UCB-with-discount: `initialize` seeds one arm per partition (ascending-claimId unprobed cursor), `selectNextInstance` runs first-K try-each-arm-once in stable priority order then UCB-with-discount, emitting pull records `{time, arm, instance, utility, isUnknownUnknown, cumulativeUtility}`. Eq.1 utility, Eq.3 discount (`currentArmSize/sizeAtPull`), UCB bound `sqrt(2*ln(sumEff)/N_t)`. `budget = floor(N * config.budget)`. Per-pull CHECKPOINT_SHAPE; `scanId` from `(roomDir, corpusHash)` with no Date.now; `resumeFrom` validates corpusHash and deterministically replays-then-continues (byte-identical) or fails closed to a fresh scan. ZERO Math.random / Date.now in the code path.
- `lib/core/unknowns/rumsfeld-matrix.cjs` -- `categorizeItem(item, awareness, knowledge)` -> KK/KU/UK/UU + the quadrant->pipeline routing table emitting frozen `FEEDS_INTO` chain targets (KU -> whitespace/find-analogies/bono/deep-research; UK -> file-meeting/navigate-graph/analyze-room; UU -> challenge-assumptions/diagnose/validate; KK = the bandit hunting ground, no route). Returns routing INTENT only; no command invocation, no edge write. `getMatrixSummary`/`exportMatrix` for the analyze step.

## Task Commits

Each task was committed atomically:

1. **Task 1: PatternMiner + DSP with the REAL inter-partition distance** - `7c370f8e` (feat)
2. **Task 2: The UCB-with-discount bandit (index-deterministic, resumable)** - `9ecc0ff1` (feat)
3. **Task 3: The Rumsfeld 2x2 router** - `15ad7165` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `lib/core/unknowns/pattern-miner.cjs` - support-bounded descriptive pattern mining (quartile numeric, equality categorical, AND-combine, minSupport-gated)
- `lib/core/unknowns/dsp.cjs` - Algorithm 1 partition + the REAL interPartition{Feature,Confidence}Distance + goodness Eq.2
- `lib/core/unknowns/bandit.cjs` - Algorithm 2 UCB+discount, index-deterministic, per-pull resumable checkpoint
- `lib/core/unknowns/rumsfeld-matrix.cjs` - 2x2 categorize + quadrant->FEEDS_INTO routing table
- `tests/test-unknowns-dsp.cjs` - RED stub -> GREEN: partition shape + set-cover + centroid mean + determinism + confidenceScores override
- `tests/test-unknowns-dsp-goodness.cjs` - RED stub -> GREEN: lone=0.0 + discrimination (non-1.0) + monotone separation + goodness-uses-real-g2/g4 + determinism
- `tests/test-unknowns-bandit.cjs` - RED stub -> GREEN: arm seeding + pull-record shape + budget=floor(N*budget) + stable arm order + Eq.1 utility + determinism + zero-Math.random grep
- `tests/test-unknowns-resume.cjs` - RED stub -> GREEN: CHECKPOINT_SHAPE conformance + byte-identical interrupt-then-resume + dirty-corpus fresh-scan + deterministic scanId

## Decisions Made

- The REAL inter-partition distance closes the reference stub-leak: `interPartition{Feature,Confidence}Distance` return the computed sibling-centroid distance (NOT `return 1.0`), and a lone partition returns `0.0`. The dsp-goodness test asserts the metric DISCRIMINATES (distinct, non-1.0), is monotone (a farther-centroid sibling yields a larger distance), and that `goodness` differs from a stubbed-1.0 score.
- Resume = deterministic replay-then-continue. The checkpoint does not carry the historical pull records (only per-arm probed cursors), so `resumeFrom` rebuilds state and replays pulls `0..checkpoint.pull` (the scan is fully deterministic given a matching corpusHash), then continues. A replay-cursor tripwire fails closed to a fresh scan if the oracle was non-deterministic (Pitfall 4).
- Arm priority is an injected `priorityFn` arg (default `partition.meanConfidence`), honoring port-change #5: the orchestrator (165-04) supplies the real HSI-or-LOCAL priority; the bandit never hardcodes HSI.
- The router returns routing INTENT only (no invocation, no edge write); the orchestrator writes FEEDS_INTO through the navigation chokepoint. KK is the hunting ground with no downstream route.

## Deviations from Plan

None - plan executed exactly as written. The math core was cloned from the issue-tree.cjs deterministic single-call purity model (NOT the 56KB futures async shell), the four modules landed under `lib/core/unknowns/`, and this plan's four RED stubs (dsp, dsp-goodness, bandit, resume) were turned GREEN while the Wave-3/4/5/6 stubs (corpus-adapter, proxy-oracle, frozen-edges, part8-boundary, rank-in, verdict) remain RED-untouched per the harness-as-code contract.

## Constitutional Gates

- **D-165-09 (no Math.random):** `grep "Math.random"` over the code lines of all four modules = 0 (only doc-comment mentions of the banned API remain). No `Date.now` in any math path; `scanId` derives from `(roomDir, corpusHash)`; the bandit `time` field is the monotone pull counter.
- **D-165-08 (frozen edges, remap-only):** the only edge handle emitted is the frozen `FROZEN_ENGINE_EDGES.FEEDS_INTO`; ZERO `edges.cjs` change, ZERO canon amendment, ZERO new edge type.
- **D-165-10 / Part 8 (LOCAL-only):** zero Brain require across all four modules; the math core is pure over the instance set passed in; no egress path exists; no raw room.db open (these modules take in-memory data and return scalars/handles).
- **CLAUDE.md:** no em-dashes (swept clean), CJS, no new deps.

## Phase Gate State (intended)

`bash tests/run-all-165.sh`: 7 PASS / 6 FAIL. The 4 stubs this plan owns (dsp, dsp-goodness, bandit, resume) are GREEN, plus the 3 carried floors (iface load, fixture, em-dash sweep). The 6 remaining FAILs are the Wave-3/4/5/6 stubs (corpus-adapter, proxy-oracle, frozen-edges, part8-boundary, rank-in, verdict) that later plans turn green -- INTENTIONALLY still RED.

## Self-Check: PASSED

- All 4 created modules verified present on disk (pattern-miner, dsp, bandit, rumsfeld-matrix).
- All 3 task commit hashes verified in git log (7c370f8e, 9ecc0ff1, 15ad7165).
- This plan's 4 stubs GREEN; the no-Math.random grep over lib/core/unknowns/ code = 0; the Wave-3/4 stubs still RED.

---
*Phase: 165-unknown-unknowns-blindspot-engine*
*Completed: 2026-06-19*
