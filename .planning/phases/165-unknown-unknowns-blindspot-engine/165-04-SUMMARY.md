---
phase: 165-unknown-unknowns-blindspot-engine
plan: 04
subsystem: engine-core
tags: [unknown-unknowns, orchestrator, finding-writer, frozen-edges, rank-in, f-selector, decision-gate, harness-as-code, proposed-only, deterministic]

# Dependency graph
requires:
  - phase: 165-01
    provides: the shared IFACE (FROZEN_ENGINE_EDGES, DEFAULT_CONFIG.proxy/budget/gamma, CHECKPOINT_SHAPE) + the seeded fixture room.db + the frozen-edges / rank-in RED stubs this plan turns green
  - phase: 165-02
    provides: pattern-miner.minePatterns + dsp.partition + bandit.selectNextInstance/resumeFrom + rumsfeld-matrix.categorizeAndRoute (the deterministic engine core the orchestrator sequences)
  - phase: 165-03
    provides: corpus-adapter.findConfidentClaims (the D-165-03 graded-confirmed UNION) + proxyOracle (the 3-scalar LOCAL proxy label) the bandit pulls
  - phase: 169
    provides: graph-derivation.cjs candidateToFinding / _candidateHash (the proposed-node + frozen-edge writer the edge-writer CLONES, not forks) + FEEDS_INTO frozen
  - phase: 168
    provides: INVALIDATES / ENABLES brought into the navigation writeEdge chokepoint frozen set
  - phase: 150.8
    provides: ROOT_CAUSES frozen
  - phase: 125
    provides: lib/workflow/f-selector-ranker.cjs rankForSelector (MAX_K=3) the engine output ranks into
  - phase: 143
    provides: lib/core/sensors/sensor-types.cjs makeReach (the candidate-reach factory; the 6 frozen reach_ids + 3 postures)
  - phase: 109
    provides: navigation.cjs writeClaimNode / writeEdge / CLAIM_NODE_ID (the chokepoint)
provides:
  - lib/core/unknowns/edge-writer.cjs -- the proposed-finding writer (clone candidateToFinding + writeIssueTreeEdges) with the module-load frozen-edge self-check; writeFinding/writeFindings land PROPOSED nodes + frozen cascade edges via the navigation chokepoint, idempotent, never auto-confirms
  - lib/core/unknowns/orchestrator.cjs -- discoverUnknownUnknowns: the full pipeline (corpus -> mine -> DSP -> bandit -> categorize/route -> finding-writer -> F.1 rank-in) cloning the issue-tree single-build discipline; halts at the gate; rankIntoSelector builds the candidate-reach and scores into F.1
affects: [165-06 verdict, the /mos:map-unknowns front door, the F.1 Decision Gate consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clone-not-fork: edge-writer re-exports the SHIPPED graph-derivation candidateToFinding adapter (Part 7 reuse) and clones the issue-tree.cjs:67 module-load frozen-edge self-check + the writeIssueTreeEdges route-every-edge/count-written-rejected/never-swallow-a-rejection discipline"
    - "Single-build orchestration cloned from issue-tree.cjs: discoverUnknownUnknowns is a PURE single-call stage sequencer (NOT the 56KB futures async shell); each stage composes a shipped 165-02/03 module"
    - "Engine-in-loop HALT (harness property 9 / Part 9 role 5): the orchestrator writes review_status proposed only; it NEVER calls navigation.confirmNode and NEVER invokes a downstream command -- the human-confirm budget (3) is spent at the F.1 gate, not here"
    - "LOCAL proxy-score arm priority is the v1 default (open-question 1); HSI enrichment is an OPTIONAL cached read OUTSIDE the bandit tight loop, never a Brain/Pinecone call inside the loop"
    - "The per-pull bandit checkpoint persists to the LOCAL sidecar <roomDir>/.mindrian/uu-scan.json (the last-cascade.json side-channel idiom); a matching corpusHash continues byte-identically, a mismatch starts fresh (D-165-09)"
    - "The candidate-reach (makeReach context_block/hold) carries LOCAL scalars ONLY on its evidence (uu_count, surfaced_top_n, partition_count, corpus_size); makeReach drops any non-primitive so prose can never ride to the gate (Part 8)"

key-files:
  created:
    - lib/core/unknowns/edge-writer.cjs
    - lib/core/unknowns/orchestrator.cjs
  modified:
    - tests/test-unknowns-frozen-edges.cjs
    - tests/test-unknowns-rank-in.cjs

key-decisions:
  - "Created lib/core/unknowns/edge-writer.cjs as a NET-NEW module (the plan frontmatter listed only orchestrator.cjs in files_modified, but the frozen-edges RED stub hard-requires lib/core/unknowns/edge-writer.cjs and the plan Task 1 action mandates the module-load frozen-edge self-check live in the edge-writer). Splitting the finding-writer + the self-check into edge-writer.cjs (consumed by the orchestrator) satisfies the stub contract and keeps the orchestrator a pure stage-sequencer. Deviation Rule 3 (blocking: the test references a module that must exist)."
  - "The finding-writer CLONES the SHIPPED graph-derivation candidateToFinding (re-exported, not forked -- Part 7) + the issue-tree.cjs:67 self-check + the writeIssueTreeEdges count-discipline; zero raw SQL; writeClaimNode mints PROPOSED, writeEdge mints the frozen cascade edge, both via the navigation chokepoint."
  - "A UU instance produces an INVALIDATES blind-spot finding (the confirmed blind spot would kill the over-confident claim) PLUS its FEEDS_INTO route candidates (the frozen chain targets challenge/diagnose/validate as cmd:* handles -- intent, never invocation). Both candidate.edge_type values are frozen members; the candidate reason is a short enum/scalar (Part 8)."
  - "The bandit arm priority is the LOCAL default (the partition meanConfidence proxy, or a caller-supplied LOCAL priorityFn); HSI is left as a documented OPTIONAL cached enrichment outside the loop -- no Brain call rides the bandit (open-question 1 / Part 8 clean)."
  - "The rank-in scores the F.1 set via rankForSelector (k=humanConfirmBudget, clamped at MAX_K=3); the engine returns {ranked:{reach,items,corpusSize,topN}} and HALTS. corpusSize is surfaced both at the top level and on the reach evidence so a thin corpus is visible at the gate (open-question recommendation)."
  - "The rank-in GREEN test seeds heavy CONTRADICTS on the already-stale corpus claim through the navigation chokepoint so the REAL locked proxy math (0.5/0.3/0.2 thresholded 0.5) crosses (no single fixture scalar crosses 0.5 alone), mirroring how the Plan 03 proxy-oracle test built its controlled UU -- never tunes the threshold."

requirements-completed: [D-165-01, D-165-02, D-165-06, D-165-08, D-165-09, D-165-10]

# Metrics
duration: ~45min
completed: 2026-06-19
---

# Phase 165 Plan 04: The Orchestrator (Pipeline + Proposed-Finding Writer + F.1 Rank-In) Summary

**The orchestrator that wires the full unknown-unknowns pipeline (corpus -> mine -> DSP -> bandit -> categorize/route -> proposed-finding-writer -> F.1 rank-in), cloning the issue-tree single-build discipline and the shipped 169 candidateToFinding writer, and HALTING at the F.1 Decision Gate: it writes proxy-labeled blind spots as PROPOSED truth-claim nodes plus frozen cascade edges through the navigation chokepoint and ranks its top-N into the F.1 selector, but it NEVER calls confirmNode and NEVER auto-confirms a blind spot (orchestrator-in-loop, harness property 9).**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-06-19
- **Tasks:** 2
- **Files created:** 2 (+ 2 RED stubs turned GREEN)

## Accomplishments

- `lib/core/unknowns/edge-writer.cjs` -- the proposed-finding writer. CLONES the SHIPPED `graph-derivation.candidateToFinding` (re-exported, Part 7 reuse) + `_candidateHash` (the stable id so a re-run does not re-mint) and the `issue-tree.cjs:67` module-load frozen-edge self-check (asserts every emittable `FROZEN_ENGINE_EDGES` value is a frozen member of the LIVE `ALLOWED_EDGE_TYPES`, throws at require time on drift) + the `writeIssueTreeEdges` route-every-edge / count-written-rejected / never-swallow-a-rejection discipline. `writeFinding`/`writeFindings` write the PROPOSED truth-claim NODE via `navigation.writeClaimNode` and the frozen cascade EDGE via `navigation.writeEdge` (no raw SQL); a confirmed node is never downgraded; the engine writes PROPOSED only.
- `lib/core/unknowns/orchestrator.cjs` -- `discoverUnknownUnknowns({roomDir, db, config, now, priorityFn})` sequences the full stage set cloning the issue-tree single-build discipline (PURE single-call, NOT the futures async shell): `findConfidentClaims` (corpus) -> `minePatterns` -> `partition` (DSP) -> `selectNextInstance` (bandit, proxy-driven, `budget = floor(N*config.budget)`, LOCAL proxy-score arm priority, per-pull checkpoint to `<roomDir>/.mindrian/uu-scan.json`, corpusHash-guarded resume) -> `categorizeAndRoute` (rumsfeld UU quadrant -> frozen FEEDS_INTO route) -> `writeFindings` (PROPOSED INVALIDATES blind-spot finding + FEEDS_INTO route candidates) -> `rankIntoSelector` (the candidate-reach + the F.1 rank-in). Returns `{findings, recommendations, checkpoint, ranked, corpusSize, partitions, uuInstances, routed}` and HALTS at the gate.
- `rankIntoSelector` -- builds a `makeReach` candidate (`reach_id` context_block riding the map-unknowns front door, posture `hold`, evidence = LOCAL scalars only: uu_count + surfaced_top_n + partition_count + corpus_size) and scores the F.1 Next-Move set via `f-selector-ranker.rankForSelector` (k = humanConfirmBudget, clamped at MAX_K=3). It does NOT call `confirmNode` and does NOT invoke a downstream command.

## Task Commits

Each task was committed atomically:

1. **Task 1: The pipeline orchestrator + the proposed-finding writer** - `d5bc110b` (feat)
2. **Task 2: Rank engine output into the F.1 selector (the gate)** - `200cae8f` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `lib/core/unknowns/edge-writer.cjs` - the clone-not-fork proposed-finding writer + the module-load frozen-edge self-check
- `lib/core/unknowns/orchestrator.cjs` - discoverUnknownUnknowns (the full pipeline) + rankIntoSelector (the F.1 gate rank-in)
- `tests/test-unknowns-frozen-edges.cjs` - RED stub -> GREEN: 4 frozen edges + live ALLOWED_EDGE_TYPES self-check + drift-throws + writeEdge rejects a made-up type
- `tests/test-unknowns-rank-in.cjs` - RED stub -> GREEN: ranks into F.1 (clamped MAX_K), reach LOCAL-scalars-only, corpusSize surfaced, PROPOSED only, INVALIDATES blind-spot finding, halts at the gate, checkpoint persisted

## Decisions Made

- **edge-writer.cjs is a net-new module** (Deviation Rule 3, documented below): the frozen-edges RED stub hard-requires `lib/core/unknowns/edge-writer.cjs`, and the plan Task 1 action mandates the module-load frozen-edge self-check live in the edge-writer. Splitting the finding-writer + self-check into `edge-writer.cjs` satisfies the stub contract and keeps `orchestrator.cjs` a pure stage-sequencer.
- The finding-writer CLONES (does not fork) the shipped 169 `candidateToFinding`; the only edge handles emitted are the frozen `INVALIDATES` (blind-spot finding) and `FEEDS_INTO` (route intent). All writes route through the navigation chokepoint.
- The bandit arm priority is the LOCAL default (partition meanConfidence proxy, or a caller LOCAL priorityFn); HSI stays an OPTIONAL documented enrichment outside the loop (open-question 1; Part 8 clean -- no Brain call rides the bandit).
- The rank-in GREEN test seeds heavy CONTRADICTS on the already-stale corpus claim so the REAL locked proxy math crosses (no single scalar crosses 0.5 alone), mirroring the Plan 03 proxy-oracle test pattern -- it never tunes the locked threshold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created lib/core/unknowns/edge-writer.cjs (a net-new module not in files_modified)**
- **Found during:** Task 1 (the frozen-edges verify step).
- **Issue:** The plan frontmatter `files_modified` lists only `lib/core/unknowns/orchestrator.cjs`, but the frozen-edges RED stub (`tests/test-unknowns-frozen-edges.cjs`) hard-requires `../lib/core/unknowns/edge-writer.cjs`, and the plan Task 1 `<action>` mandates the module-load frozen-edge self-check (clone issue-tree.cjs:67) live in the engine edge-writer. Without the module the stub stays RED and Task 1 cannot complete.
- **Fix:** Created `lib/core/unknowns/edge-writer.cjs` carrying the proposed-finding writer (clone `candidateToFinding` + `writeIssueTreeEdges`) + the module-load self-check; the orchestrator consumes it via `writeFindings`. This matches the 165-RESEARCH recommended project structure intent (the finding-writer is the candidateToFinding clone) and the iface delegation note ("the live frozen-set assertion is DELEGATED to the engine edge-writer that already requires navigation/edges.cjs").
- **Files modified:** `lib/core/unknowns/edge-writer.cjs` (created).
- **Commit:** `d5bc110b`

## Constitutional Gates

- **D-165-08 (frozen edges, remap-only):** `edge-writer.cjs` runs the issue-tree.cjs:67-style module-load self-check over `FROZEN_ENGINE_EDGES` vs the LIVE `ALLOWED_EDGE_TYPES`; the only emittable types are the 4 frozen (INVALIDATES/ROOT_CAUSES/ENABLES/FEEDS_INTO). ZERO edges.cjs change, ZERO new edge type. The frozen-edges test asserts iface exports exactly the 4, the live membership holds, a drifted type throws, and `writeEdge` rejects a made-up type.
- **D-165-09 (deterministic + resumable):** `grep "Math.random"` over both new modules = 0 in code (one doc-comment mention only). The per-pull checkpoint persists to the LOCAL sidecar `<roomDir>/.mindrian/uu-scan.json`; resume continues byte-identically on a matching corpusHash, fresh on mismatch (the bandit `resumeFrom` does the replay). corpusHash derives from the id-sorted node ids; no Date.now in the scan key.
- **D-165-06 (rank into F.1, halts at the gate):** engine output becomes a candidate-reach scored into the F.1 set via `rankForSelector` (clamped at MAX_K=3); the engine returns the ranked set and HALTS -- no `confirmNode`, no downstream command invocation.
- **D-165-01 (proxy findings land proposed):** every finding node the engine writes is `review_status='proposed'`; no engine-written claim node is `confirmed` (asserted in the rank-in test).
- **D-165-10 / Part 8 (LOCAL-only):** ZERO Brain require / brain-client / mindrian-brain over both modules; ZERO raw INSERT INTO (one doc-comment mention only); all node/edge writes via the navigation chokepoint; the corpus + proxy reads are LOCAL room.db; the reach evidence is LOCAL scalars only (makeReach drops non-primitives).
- **CLAUDE.md:** no em-dashes (swept clean: 0 over both modules + both tests), CJS, no new deps, no Math.random.

## Phase Gate State

`bash tests/run-all-165.sh`: 11 PASS / 2 FAIL. This plan turned its 2 stubs GREEN (frozen-edges, rank-in) on top of the 165-02 (dsp, dsp-goodness, bandit, resume) + 165-03 (corpus-adapter, proxy-oracle) GREEN floors + the 3 carried floors (iface load, fixture, em-dash sweep). The 2 remaining FAILs are the Wave-4/6 stubs (`part8-boundary`, `verdict`) that Plan 06 finalizes -- INTENTIONALLY still RED.

## Known Stubs

None introduced. The `part8-boundary` and `verdict` RED stubs are pre-existing contracts-on-disk owned by Plan 06 (the part8-boundary sweep runs over the COMPLETE lib/core/unknowns/* tree the GREEN test asserts over, and the verdict is the adversarial structured `{passed, findings[]}` Plan 06 lands); this plan left them RED-untouched per the harness-as-code contract.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary surface was introduced. The threat register dispositions (T-165-09 auto-promote, T-165-10 edge/reach drift, T-165-11 venture prose on edge/reach, T-165-12 non-deterministic resume) are all mitigated: PROPOSED-only writes (no auto-promote), the frozen-edge self-check + makeReach reach_id validation (no drift), enum/scalar-only edge properties + reach evidence (no prose), the corpusHash-guarded byte-identical resume (deterministic).

## Self-Check: PASSED

- `lib/core/unknowns/edge-writer.cjs` + `lib/core/unknowns/orchestrator.cjs` verified present on disk.
- Both task commit hashes verified in git log (d5bc110b feat, 200cae8f test).
- This plan's 2 stubs GREEN (frozen-edges, rank-in); the carried 165-02/03 stubs still GREEN; the Wave-4/6 part8-boundary + verdict stubs still RED. grep Math.random (code) + brain require + raw INSERT INTO over both new modules = 0; em-dash sweep over both modules + both tests = 0.

---
*Phase: 165-unknown-unknowns-blindspot-engine*
*Completed: 2026-06-19*
