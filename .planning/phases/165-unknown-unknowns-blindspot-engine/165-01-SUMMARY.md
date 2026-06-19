---
phase: 165-unknown-unknowns-blindspot-engine
plan: 01
subsystem: testing
tags: [unknown-unknowns, harness-as-code, dsp, ucb-bandit, proxy-oracle, contracts-on-disk, red-stubs, fixture-room-db]

# Dependency graph
requires:
  - phase: 150.8
    provides: writeClaimNode (typed-claim.cjs) + the DIKW claim node substrate
  - phase: 131
    provides: writeEvidenceClaim (evidence-claim.cjs) + the Part-5 evidence_tier-on-EvidenceClaim fact
  - phase: 129.5
    provides: confirmNode (the human-byUser truth-machine gate, Part 9 role 5)
  - phase: 168
    provides: INVALIDATES / ENABLES frozen in the navigation writeEdge chokepoint
  - phase: 150.8
    provides: ROOT_CAUSES frozen
  - phase: 169
    provides: graph-derivation.cjs candidateToFinding pattern (the proposed-node writer 165 clones); FEEDS_INTO frozen
  - phase: 164
    provides: issue-tree.cjs writeIssueTreeEdges chokepoint + remap discipline (the edge-writer template); /mos:diagnose --issue-tree as the UU-quadrant consumer
provides:
  - The single shared instance/partition/checkpoint/config IFACE (lib/core/unknowns/iface.cjs) every downstream unknowns module imports
  - A seeded fixture room.db builder that seeds BOTH sides of the D-165-03 corpus filter (graded-confirmed Academic/Operational + the excluded mix)
  - 10 RED test stubs (contracts-on-disk) encoding the D-165-01..10 + interPartitionDistance + Part-8 + verdict contracts
  - tests/run-all-165.sh, the one-command phase gate (clone of run-all-164.sh)
affects: [165-02 corpus-adapter, 165-02 dsp, 165-03 bandit, 165-04 edge-writer, 165-05 orchestrator, 165-06 verdict]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Harness-as-code property 5: one shared IFACE (iface.cjs) as the single recast contract; downstream modules import signatures, never re-invent the instance shape"
    - "Harness-as-code property 3: contracts-on-disk as RED stubs that name their exact GREEN assertion before any engine code"
    - "Pure-contract module delegation: iface re-exports FROZEN_ENGINE_EDGES and delegates the live ALLOWED_EDGE_TYPES membership assertion to the engine modules that already require navigation/edges.cjs (iface stays I/O-free)"
    - "Fixture builds a real room.db through the navigation.cjs chokepoint (writeEvidenceClaim/writeClaimNode/writeEdge) + human-byUser confirmNode; never raw INSERT INTO nodes/edges"

key-files:
  created:
    - lib/core/unknowns/iface.cjs
    - tests/fixtures/unknowns/build-fixture-room.cjs
    - tests/run-all-165.sh
    - tests/test-unknowns-corpus-adapter.cjs
    - tests/test-unknowns-dsp.cjs
    - tests/test-unknowns-dsp-goodness.cjs
    - tests/test-unknowns-bandit.cjs
    - tests/test-unknowns-resume.cjs
    - tests/test-unknowns-proxy-oracle.cjs
    - tests/test-unknowns-frozen-edges.cjs
    - tests/test-unknowns-part8-boundary.cjs
    - tests/test-unknowns-rank-in.cjs
    - tests/test-unknowns-verdict.cjs
  modified: []

key-decisions:
  - "TIER_NUMERIC (Academic=4..None=1, DSP distance) and TIER_FLOOR (Academic=1.0..None=0.1, proxy mismatch) named distinctly in the IFACE so downstream modules never conflate the two maps (165-RESEARCH 1.4 vs 2.1b)"
  - "iface stays a pure contract module: the live frozen-edge-set assertion is delegated to the engine edge-writer that already requires navigation/edges.cjs (documented delegation, not a runtime require in iface)"
  - "Fixture promotes corpus rows to confirmed via confirmNode with a non-agent human byUser ('navigator-fixture') so the truth-machine guard is honored even in test data"
  - "Stale last_modified_at stamp is the one sanctioned direct UPDATE (an existing node, fixtures are substrate-allow-listed); node/edge creation stays on the navigation writers"

patterns-established:
  - "RED stub idiom: require the not-yet-existent engine module in try/catch, print 'RED: <module> not yet implemented (plan NN)', exit 1, header-comment the exact GREEN assertion from 165-VALIDATION.md"
  - "run-all-165.sh em-dash sweep written via the U+2014 codepoint escape so the runner carries no literal em-dash to trip its own sweep"

requirements-completed: [D-165-02, D-165-03, D-165-09, D-165-10]

# Metrics
duration: ~35min
completed: 2026-06-19
---

# Phase 165 Plan 01: Wave-1 Foundation Summary

**The harness-as-code Wave-0 foundation for the unknown-unknowns blind-spot engine: one shared recast IFACE, a seeded fixture room.db that seeds both sides of the D-165-03 corpus filter, 10 RED test stubs (contracts-on-disk), and the run-all-165.sh phase gate that executes them.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-06-19
- **Tasks:** 3
- **Files created:** 13

## Accomplishments
- `lib/core/unknowns/iface.cjs` -- the single recast contract every Plan 02-06 module imports: INSTANCE_FEATURES (frozen ordered NUMERIC/CATEGORICAL/identity schema), TIER_NUMERIC + TIER_FLOOR (two distinct maps), DEFAULT_CONFIG with the proxy block (w 0.5/0.3/0.2, threshold 0.5, humanConfirmBudget 3), CHECKPOINT_SHAPE + CHECKPOINT_ARM_SHAPE, FROZEN_ENGINE_EDGES (the 4 frozen types). Pure module: zero I/O, zero Brain, zero Math.random, zero Date.now.
- `tests/fixtures/unknowns/build-fixture-room.cjs` -- seeds 5 graded-confirmed Academic/Operational corpus claims PLUS the full excluded mix (None/Practitioner tiers, ungraded-confirmed, proposed) so the Wave-2 UNION corpus test has both sides. Proven: the D-165-03 UNION returns EXACTLY the 5 corpus rows (Academic,Academic,Operational,Operational,Operational); 2 CONTRADICTS+INVALIDATES edges on a corpus claim; deterministic stale last_modified_at via injected opts.now.
- 10 RED test stubs + `tests/run-all-165.sh` (cloned from run-all-164.sh). The aggregator EXECUTES every stub and reports the intended Wave-0 close state: 10 RED (the engine modules do not exist yet) + 3 floor PASS (iface load, fixture, em-dash sweep), exit 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the shared IFACE block** - `fa498bc9` (feat)
2. **Task 2: Build the seeded fixture room.db** - `4e61465c` (feat)
3. **Task 3: Write the RED test stubs + run-all-165.sh phase gate** - `7fee7742` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `lib/core/unknowns/iface.cjs` - The shared recast contract (INSTANCE_FEATURES, TIER maps, DEFAULT_CONFIG, CHECKPOINT_SHAPE, FROZEN_ENGINE_EDGES)
- `tests/fixtures/unknowns/build-fixture-room.cjs` - Seeded room.db builder (both sides of the D-165-03 filter)
- `tests/run-all-165.sh` - The one-command phase gate (per-suite tally + exit 1 + em-dash sweep)
- `tests/test-unknowns-corpus-adapter.cjs` - RED stub: UNION corpus filter returns exactly graded-confirmed Academic/Operational
- `tests/test-unknowns-dsp.cjs` - RED stub: partition() returns {pattern, instances, centroid, meanConfidence}
- `tests/test-unknowns-dsp-goodness.cjs` - RED stub: interPartition distances discriminate (NON-1.0) + lone partition returns 0.0
- `tests/test-unknowns-bandit.cjs` - RED stub: pull records + budget=floor(N*budget) + zero Math.random
- `tests/test-unknowns-resume.cjs` - RED stub: interrupted-then-resumed scan is byte-identical
- `tests/test-unknowns-proxy-oracle.cjs` - RED stub: 3-scalar blend (0.5/0.3/0.2, threshold 0.5) labels contradicted/stale=1, clean=0
- `tests/test-unknowns-frozen-edges.cjs` - RED stub: only the 4 frozen edges + live ALLOWED_EDGE_TYPES self-check
- `tests/test-unknowns-part8-boundary.cjs` - RED stub: forbidden-substring sweep over lib/core/unknowns/*
- `tests/test-unknowns-rank-in.cjs` - RED stub: engine output ranks into the F.1 set (f-selector-ranker)
- `tests/test-unknowns-verdict.cjs` - RED stub: adversarial {passed, findings[]} structured verdict

## Decisions Made
- TIER_NUMERIC (DSP feature distance) and TIER_FLOOR (proxy mismatch) are named distinctly in the IFACE to prevent downstream conflation; these are two different maps per 165-RESEARCH 1.4 vs 2.1b.
- iface delegates the live frozen-edge-set assertion (against the real ALLOWED_EDGE_TYPES) to the engine edge-writer rather than requiring navigation/edges.cjs from a pure contract module; the delegation is documented inline so the frozen-edges stub knows where the live check lives.
- The fixture confirms truth-claim corpus rows through `confirmNode` with a non-agent human byUser, honoring the Part 9 role-5 guard even in test data; the only direct SQL is the stale-timestamp UPDATE on an already-minted node (sanctioned: tests/fixtures is substrate-allow-listed, and node/edge creation routes through the navigation writers).

## Deviations from Plan

None - plan executed exactly as written. The 10 stubs are INTENTIONALLY RED at Wave-0 close (they encode the contracts Waves 2-6 turn green); run-all-165.sh executes them and reports 10 RED + 3 floor PASS, exactly as the plan and the red_stub_note specify.

## Issues Encountered
- A literal U+2014 em-dash slipped into the run-all-165.sh `EMDASH=` assignment on first write; corrected to the `$'—'` codepoint escape (matching run-all-164.sh) so the runner carries no literal em-dash to trip its own sweep. Verified: `grep -c U+2014` returns 0 on the script, `bash -n` clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The shared IFACE is frozen; Plans 02-06 import its signatures.
- The fixture room.db seeds both sides of the corpus filter; Plan 02's corpus-adapter test (test-unknowns-corpus-adapter.cjs + test-unknowns-proxy-oracle.cjs) has its data and turns green when corpus-adapter.cjs ships.
- run-all-165.sh is the phase gate; each later wave turns one or more stubs green and the gate goes GREEN only when the full engine (corpus-adapter, dsp, bandit, edge-writer, orchestrator, verdict) lands.
- 165 mints NO edge type and makes ZERO edges.cjs change (D-165-08 remap-only); all four target edges confirmed frozen.

## Self-Check: PASSED

- All 14 created files verified present on disk (iface, fixture, run-all-165.sh, 10 stubs, SUMMARY).
- All 3 task commit hashes verified in git log (fa498bc9, 4e61465c, 7fee7742).

---
*Phase: 165-unknown-unknowns-blindspot-engine*
*Completed: 2026-06-19*
