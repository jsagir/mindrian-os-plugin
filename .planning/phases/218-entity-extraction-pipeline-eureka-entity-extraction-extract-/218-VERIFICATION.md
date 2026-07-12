# Phase 218: Live REQ-5 Verification (aion-eureka-synergy)

**Run date:** 2026-07-12
**Room:** `~/MindrianRooms/aion-eureka-synergy` (real, live, populated room)

## Pre-extraction baseline

- `room.db`: 647 nodes / 92 edges (unchanged from research baseline captured 2026-07-12; room had not drifted)
- Node types: memory_event 515, claim 83, memory_artifact 38, governing_thought 10, navigator_persona 1
- Zero `company`/`technology`/`market` nodes
- `node scripts/eureka-command.cjs ~/MindrianRooms/aion-eureka-synergy run` -> `portfolio-report.json`: 666 pairs scored, 25 ranked, **25/25 (100.0%) top-25 pairs are `memory_artifact`-vs-`memory_artifact`**. `tail_suspect_noise: true` self-flagged.

## Extraction run

`node scripts/entity-extract.cjs ~/MindrianRooms/aion-eureka-synergy start` -> completed in 17s.
`status.json`: `{"state":"done","artifacts":38,"entities":461,"edges":462,"embedded":true}`

## Post-extraction state

- `room.db`: 796 nodes / 552 edges
- New node types: `company` 147, `market` 2 (149 total entity nodes, all `review_status='proposed'` -- zero auto-confirmed, per D-01/REQ-1)
- New edges: +460 (mostly `DESCRIBES` entity->artifact, some `COMPETES_WITH`/`SUPPLIES_TO`)
- Re-embed: `embedded:true` (route-a `indexNodes` re-embed succeeded post-commit)
- `node scripts/eureka-command.cjs ~/MindrianRooms/aion-eureka-synergy run` -> `portfolio-report.json`: 17205 pairs scored (cohort grew 38 -> 187 techs, consistent with 38 artifacts + 149 entities), 25 ranked.
- **Top-25 result: 25/25 (100.0%) still `memory_artifact`-vs-`memory_artifact`.** `tail_suspect_noise: true` still self-flagged. Every ranked pair's `a`/`b` id is a `memory_artifact:*` id; zero entity nodes appear anywhere in the top 25 despite being scored across all 17205 pairs.

## REQ-5 acceptance verdict: **NOT MET on the live room**

Baseline 100.0% -> post-extraction 100.0%. No movement. This directly contradicts the automated `test-218-noise-reduction.cjs` leg, which passed (100%->40%) on a hermetic seeded fixture room.

## Root cause (traced, not just observed)

`lib/core/eureka/portfolio-dimensions.cjs:168` computes the `validated_demand` dimension as `percentileRank(pair_count, cohort)` -- a node's rank is its edge-count percentile within the cohort. `memory_artifact` nodes are structural hubs: each one accumulates dozens of inbound edges (from `claim`, `memory_event`, and now the new entity `DESCRIBES` edges) over the room's lifetime, so they sit at or near the 100th percentile by construction. The new `company`/`market` entity nodes each carry only 1-3 edges (one `DESCRIBES` back to their source artifact, occasionally one relationship edge), so their `pair_count` percentile is low, and `validated_demand` stays low for every entity-involving pair. Since `validated_demand` is one of three equally-weighted AHP dimensions (`ahp_weights`: 1/3 each), and the artifact-hub nodes score near-ceiling on it while entity nodes score near-floor, artifact-vs-artifact pairs win the ranking regardless of how semantically meaningful the entity pairs are.

This is **not a Phase 218 code defect** -- REQ-1 through REQ-4 all pass their acceptance criteria (verified: floor tests, chokepoint-only writes, `git diff --exit-code` clean on `vector-store.cjs`/`insights.cjs`/`graph-ops.cjs`, zero-egress grep gates, `review_status='proposed'` on every entity node). Phase 218 did exactly what it was scoped to do: it enriched the graph with real domain content through the correct chokepoints. The gap is in the **pre-existing (Phase 211-216) `validated_demand` scoring formula**, which is degree-centrality-based and structurally favors high-degree scaffold nodes over any newly-added low-degree node type -- a design property of the ranking algorithm that predates this phase and was never exercised against a graph with a low-degree node family before now.

## Why the hermetic fixture test passed but the live room didn't

The seeded fixture in `test-218-noise-reduction.cjs` was constructed without pre-existing high-degree hub nodes at the same skew as a real, months-old room -- so `validated_demand`'s percentile ranking didn't have an entrenched hub class to lose against. The live `aion-eureka-synergy` room has 38 artifact nodes that have accumulated edges since Phase 109/163/etc.; the fixture never modeled that accumulated skew. This is exactly the class of gap a synthetic-fixture unit test cannot catch and a live human-verify checkpoint exists to surface (D-04's own stated purpose: "a directional regression proof... not a precision/recall claim" -- confirmed directionally: it does NOT regress, but also does not improve, on live data).

## Fix applied (T-218-VD): cohort stratification

Root cause traced to `scripts/eureka-portfolio-report.cjs`'s cohort construction (not `portfolio-dimensions.cjs`, which is a correct pure classifier): every indexed node, regardless of type, was pooled into ONE cohort array before computing `validated_demand`'s percentile rank of `pair_count`/`degree`. Fix: stratify the cohort by node-type family (`ENTITY_NODE_TYPES` vs everything else) before scoring, so entity nodes rank against same-age peers instead of against long-accumulated `memory_artifact` hub degree. Zero-entity-node rooms are unaffected by construction (empty entity cohort -> every tech routes to the unchanged scaffold cohort). New regression test: `tests/test-218-cohort-stratification.cjs` (2/2 legs), wired into `run-all-218.sh`. Full suite re-run clean: Phase 218 12/12, Phase 215 8/8, Phase 211 10/10.

**Re-verified live on `aion-eureka-synergy` after the fix:** top-25 structural share **100.0% -> 0.0% (0/25)**. REQ-5's numeric acceptance criterion (< 50%) is met, and by a wide margin.

## Second finding, surfaced BY the fix (not caused by it): tier-1 extraction noise

The stratification fix also removed the masking effect the artifact-hub bias had been providing: before the fix, ALL entity nodes were floor-pinned regardless of quality, so a noisy extraction was invisible in the ranked output. After the fix, the top-25 is 100% entity-vs-entity pairs, and inspecting them (`a_title`/`b_title`, fixed to read `props.name` via a second small patch to `room-native-substrate.cjs`'s title resolution, which previously fell back to raw hashed node ids) shows most of the highest-degree, top-ranked "entities" are NOT real domain content: `ROOM.md`, `FEYNMAN`, `ICM Layer`, `Canon`, `BEGIN REFERENCES`, `END REFERENCES`, `AAAK Record`, `Section Completeness`, `Evidence Threshold`, `TAM`, `SAM`, `GAP`, `Map`, `Max`, `NOT`, `See`, `Last`, `Data`, `PAIR` -- MindrianOS's own internal meta-vocabulary and generic capitalized words, misclassified as `company`/`market` entities by the tier-1 regex/capitalization extractor. `AION` / `AION Labs` (the room's actual subject) IS present but diluted among the noise.

This is exactly the failure mode `218-RESEARCH.md` Pitfall 4 predicted ("a greedy capitalization regex tags every Title-Case token... as a company, flooding the graph with junk entity nodes -- re-creating the noise this phase exists to remove") and flagged as `Claude's Discretion... fit to real artifact prose in aion-eureka-synergy`. The 218-02 extractor's own test suite (8/8 green) used clean, unambiguous fixture prose ("Prodrive competes with Xtrac") and never validated against MindrianOS's own dense internal-jargon prose, so this gap shipped invisibly -- masked by the ranking bug until that bug was fixed.

**Net honest picture:** REQ-5's literal numeric acceptance criterion is met (0.0% < 50%). Whether the SPIRIT of REQ-5 (surface real, useful cross-domain pairs) is met is now blocked on tier-1 extraction precision against MindrianOS's own real prose, not on ranking fairness. This is layered on top of, not a regression from, the ranking fix.

## Disposition

Cohort-stratification fix: DONE, tested, committed pending navigator review. Title-resolution fix: DONE, same status. Tier-1 extraction noise: OPEN, surfaced this session, not yet fixed -- pending navigator decision on scope (documented in conversation).
