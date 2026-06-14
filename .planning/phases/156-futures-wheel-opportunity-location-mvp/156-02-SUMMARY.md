---
phase: 156-futures-wheel-opportunity-location-mvp
plan: 02
subsystem: futures-wheel
tags: [futures-wheel, generation-loop, cascade-edges, hsi-pipeline, artifact-registration, FW-02, FW-05, FW-06]
requires:
  - "lib/core/futures/orchestrator.cjs Wave 1 shell (caps, enums, validateConsequenceFrontmatter)"
  - "lib/core/futures/causal-cue.cjs flagCausalCue (annotates each consequence)"
  - "lib/core/navigation.cjs writeEdge (ROOT_CAUSES chokepoint)"
  - "lib/core/lazygraph-ops.cjs openGraph/indexArtifact/closeGraph (Artifact registration)"
  - "lib/core/node-insert.cjs insertNode (NOT-NULL-safe Artifact writer)"
  - "scripts/compute-hsi.py + scripts/hsi-to-graph.cjs (HSI scan + raw edge writer)"
provides:
  - "lib/core/futures/orchestrator.cjs: generateRing (cap-bounded), writeCascadeEdges (ROOT_CAUSES via chokepoint), registerConsequenceArtifacts (.md + Artifact node), assertArtifactCountMatchesFiled (landmine guard), runHsiScan (ordered FW-06 sequencer), slugify, consequenceArtifactId"
  - "tests/test-futures-generator.cjs, tests/test-futures-edges.cjs, tests/test-futures-hsi-integration.cjs"
  - "tests/fixtures/futures-seed-room/README.md (FW-06 cross-domain HSI fixture spec)"
affects:
  - "Wave 3 (FW-10 gate) consumes the proposed Artifact nodes + ROOT_CAUSES rings"
  - "Wave 4 (FW-07/08/12) consumes the HSI_CONNECTION bridges + banked provenance"
tech-stack:
  added: []
  patterns:
    - "id-parity: registered Artifact node id == compute-hsi path-derived id == hsi-to-graph endpoint id (consequenceArtifactId mirrors lazygraph getArtifactId)"
    - "ordered FW-06 sequencer OWNS register->assert->compute-hsi->hsi-to-graph->read-back; no hidden async"
    - "two edge paths kept separate: ROOT_CAUSES via navigation.writeEdge chokepoint; HSI_CONNECTION via hsi-to-graph raw SQL only"
    - "Tri-Polar: python3 detection degrades to Tier 0 cleanly, never crashes"
key-files:
  created:
    - tests/test-futures-generator.cjs
    - tests/test-futures-edges.cjs
    - tests/test-futures-hsi-integration.cjs
    - tests/fixtures/futures-seed-room/README.md
  modified:
    - lib/core/futures/orchestrator.cjs
decisions:
  - "ENABLES is NOT in the frozen ALLOWED_EDGE_TYPES (only ROOT_CAUSES is); plan/RESEARCH assumed it was. The chokepoint invariant is honored: an ENABLES request is reported as a failure, never silently raw-SQL'd. ROOT_CAUSES (the actual parent->child cascade this wave needs) is frozen and used."
  - "Consequences modeled as Artifacts (HSI-ready) via indexArtifact so the node id matches the compute-hsi path-derived id by construction (eliminates the false-success class at the source)."
  - "HSI fixture uses divergent-vocabulary cross-domain texts because hsi_score rewards |semantic - lsa| divergence, not raw similarity; >=5 sentences each to hit the spectral path."
metrics:
  duration: "~25 min"
  completed: "2026-06-14"
  tasks: 3
  files: 5
---

# Phase 156 Plan 02: Bounded generation loop + cascade edges + HSI sequencer Summary

Wave 2 extended the Wave-1 orchestrator SHELL (it did NOT rewrite it) with the four load-bearing functions: the bounded guided-by-ring generation loop (FW-02, depth 3 x fan-out 5 clamped before any HSI pairing), the ROOT_CAUSES cascade-edge writer through the navigation.writeEdge chokepoint (FW-05), the dual-registration Artifact registrar (.md on disk for compute-hsi discover_artifacts AND a type='Artifact' node in room.db for the hsi-to-graph endpoint gate), and the ordered register->assert->compute-hsi.py->hsi-to-graph.cjs->read-back sequencer (FW-06). This wave closes the phase's #1 landmine: the assertArtifactCountMatchesFiled precondition HARD-FAILS before compute-hsi runs, so the silent zero-edge false-success cannot occur.

## What shipped (per requirement)

- **FW-02** -- `generateRing(seed, ringNumber, parents, opts)` clamps `ringNumber` to `FUTURES_DEPTH_CAP` and per-parent children to `FUTURES_FANOUT_CAP` (caps clamp, never error), stamps `ring` and `parent_id` (null for ring 1), validates each child via `validateConsequenceFrontmatter` (invalid children skipped, never thrown), and annotates each with `flagCausalCue`. The clamp runs BEFORE any HSI O(n^2) pairing in Task 3.
- **FW-05** -- `writeCascadeEdges(db, consequences)` routes a `ROOT_CAUSES` edge (source=parent CAUSE, target=child EFFECT) for each non-null `parent_id` through `navigation.writeEdge` ONLY (Part 9 chokepoint). Properties are enum/scalar ONLY (`ring`, `confidence`) -- the consequence body NEVER lands on an edge (Part 8). Zero raw `INSERT INTO edges` in orchestrator.cjs; zero non-frozen type forced.
- **FW-06** -- `registerConsequenceArtifacts(roomDir, consequences, {seed})` files each consequence at `opportunity-bank/futures-<seed-slug>/<slug>/<slug>.md` (Obsidian nested, decision 16) with an ICM Layer 0 `ROOM.md` per folder (decision 15), then registers each as a type='Artifact' node via `lazygraph.indexArtifact` (id == path-derived id by construction). `assertArtifactCountMatchesFiled(db, ids)` returns `{ok, artifactCount, filedCount, missing}`. `runHsiScan(roomDir, ids, {pluginRoot})` enforces the deterministic order: (1) assert -- hard-fail `{ok:false, reason:'artifact_count_mismatch'}` and DO NOT call compute-hsi on a mismatch; (2) `python3 scripts/compute-hsi.py <room> --tier 1`; (3) `node scripts/hsi-to-graph.cjs <room>`; (4) read back `HSI_CONNECTION` edges, rank cross-domain bridges. Tri-Polar: python3 absence degrades cleanly to Tier 0 (`{degraded:true, tier:0}`).

## Tasks and commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Bounded generateRing + ROOT_CAUSES cascade writer (FW-02/FW-05) | 0e1e4d4a | lib/core/futures/orchestrator.cjs, tests/test-futures-generator.cjs, tests/test-futures-edges.cjs |
| 2 | Artifact registrar + count-match precondition (LANDMINE #1) | 0e1e4d4a | lib/core/futures/orchestrator.cjs (registerConsequenceArtifacts + assertArtifactCountMatchesFiled committed with Task 1, single-file write) |
| 3 | HSI file-then-scan sequencer + integration fixture (FW-06) | 1644c6ea | lib/core/futures/orchestrator.cjs (runHsiScan, Task 1 commit), tests/test-futures-hsi-integration.cjs, tests/fixtures/futures-seed-room/README.md |

Note: Tasks 1-3 all extend the single file `lib/core/futures/orchestrator.cjs`; the four functions were written together and landed in the Task 1 commit (0e1e4d4a). The Task 3 commit (1644c6ea) carries the integration fixture + test that exercises the Task 2 + Task 3 functions end-to-end.

## Verification

- `node tests/test-futures-generator.cjs` -- PASS (FW-02: ring-1 + ring-N>1 fan-out clamp to 5; ring 4 and 7 clamp to depth 3; ring-2 parent_id points at ring-1 id; invalid-domain/out-of-range children skipped)
- `node tests/test-futures-edges.cjs` -- PASS (FW-05: 2 ROOT_CAUSES rows source=parent target=child via chokepoint; enum/scalar properties only, no body text/SECRET BODY leak; non-frozen ENABLES reported as failure with NO raw bypass edge)
- `node tests/test-futures-hsi-integration.cjs` -- PASS (FW-06: 4 cross-domain Artifact nodes registered + ROOM.md per folder; guard ok:true before scan; NEGATIVE missing-node guard ok:false AND runHsiScan refuses without invoking compute-hsi; Tier 1 produced 5 HSI_CONNECTION edges in one run; Tier 0 degrade asserted)
- SOURCE gates on `lib/core/futures/orchestrator.cjs`: `grep -ciE "LEADS_TO|'CAUSES'"` = 0; `grep -c "INSERT INTO edges"` = 0; `grep -ciE "writeEdge.*HSI_CONNECTION|writeEdge.*REVERSE_SALIENT"` = 0
- Em-dash sweep (0x2014) across all 5 wave files -- 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ENABLES is not in the frozen ALLOWED_EDGE_TYPES**
- **Found during:** Task 1 (test-futures-edges first run)
- **Issue:** The plan behavior spec and 156-RESEARCH (section 3) both stated "ROOT_CAUSES is in the frozen set ... ENABLES is in it." A live membership check (`ALLOWED_EDGE_TYPES.has('ENABLES')`) returned false -- only ROOT_CAUSES (added by Phase 150.8) is frozen. `navigation.writeEdge` correctly rejects ENABLES with `{ok:false, reason:'invalid_edge_type'}`.
- **Fix:** `writeCascadeEdges` continues to route ROOT_CAUSES (the actual parent->child cascade relation this wave needs) through the chokepoint. An explicit ENABLES request is still routed through `writeEdge` and FAITHFULLY REPORTED as a failure -- it is NEVER silently raw-SQL'd, preserving the Part 9 chokepoint invariant and the "zero raw INSERT INTO edges in orchestrator.cjs" grep gate. The test asserts the ENABLES request is reported (not bypassed) and that no ENABLES edge lands. Routing it through raw SQL would have violated the threat model (T-156-02) and the grep gate.
- **Files modified:** lib/core/futures/orchestrator.cjs, tests/test-futures-edges.cjs
- **Commit:** 0e1e4d4a

**2. [Rule 1 - Bug] edges table FOREIGN KEY requires endpoints to exist as nodes**
- **Found during:** Task 1 (test-futures-edges first run)
- **Issue:** The `edges` table created by `lazygraph.initSchema` declares `FOREIGN KEY (source/target) REFERENCES nodes(id)` with `PRAGMA foreign_keys = ON`. The first edges test wrote edges between ids that were not yet registered nodes, so `writeEdge` returned `{ok:false, reason:'edge_write_failed'}` (FK violation). This is correct production behavior -- in the real FW-06 flow the consequences are registered as Artifact nodes BEFORE cascade edges are written.
- **Fix:** The edges unit test now registers the endpoints as Artifact nodes (via `insertNode`) before calling `writeCascadeEdges`, mirroring the production register-then-cascade order. No source change needed; the ordering is enforced by `runHsiScan` (register -> assert -> scan) in the integration path.
- **Files modified:** tests/test-futures-edges.cjs
- **Commit:** 0e1e4d4a

**3. [Rule 1 - Bug] HSI fixture needed divergent vocabulary, not overlapping vocabulary**
- **Found during:** Task 3 (integration test first run -- 0 HSI_CONNECTION edges)
- **Issue:** The first fixture used heavily-overlapping shared vocabulary across consequences, expecting similarity to produce HSI edges. compute-hsi.py scores `hsi_score = 0.6 * |semantic_sim - lsa_sim| + 0.4 * integrative_factor` -- it rewards DIVERGENCE between semantic (MiniLM) and structural (TF-IDF/LSA) similarity, not raw overlap. Uniform vocabulary produced `innovation_diff < 0.30` for every pair -> 0 pairs.
- **Fix:** Rewrote the fixture consequences to express the SAME underlying meaning with DISJOINT vocabulary across the four PESTEL domains (high semantic, low lexical), each >= 5 sentences so the spectral OM-HMM path engages. Now 5 cross-domain pairs clear the 0.30 threshold and 5 HSI_CONNECTION edges are written. The fixture README documents this scoring property so the seed shape is not accidentally regressed.
- **Files modified:** tests/test-futures-hsi-integration.cjs
- **Commit:** 1644c6ea

## Known Stubs

`runRingGate` remains an intentional, clearly-labeled throwing stub (`implemented in Wave 3, FW-10`). This is the planned wave boundary -- Wave 3 owns the proposed->confirmed Decision Gate. No stub flows to UI rendering; no hardcoded empty data path exists. The Wave 1 `fileAndScan` stub was removed (it was superseded by the real `registerConsequenceArtifacts` + `runHsiScan`); nothing references it (grep confirmed 0 references).

## Threat Flags

None. This wave has zero network surface: no `fetch`, no Brain write/query-with-content. The HSI scan and edge writes are LOCAL room.db + filesystem only. The SIGNAL/research egress is FW-13 (a later wave), not this one. T-156-01 (false-success) is mitigated by `assertArtifactCountMatchesFiled` hard-failing before compute-hsi (proven by the integration test's negative case). T-156-02 (cascade-edge tampering) is mitigated by routing ROOT_CAUSES through the frozen-set-guarded chokepoint and NEVER raw-SQL'ing a cascade edge. T-156-03 (info disclosure) is mitigated by enum/scalar-only edge properties (proven by the no-body-leak assertion). T-156-SC: zero new dependencies.

## Self-Check: PASSED

- Files: all 5 source/test/fixture files + 156-02-SUMMARY.md confirmed present on disk.
- Commits: 0e1e4d4a, 1644c6ea confirmed in `git log`.
- All three verification commands green; all SOURCE grep gates 0; zero em-dashes.
