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

## Follow-up fix applied same session: domain-agnostic noise filters (T-218-VD-2/3)

Navigator explicitly approved reopening the extraction-noise gap. Two filter layers added to `entity-extractor.cjs`, committed `7d98c9b8`:

1. **NOISE_TERMS + FILENAME_RX (T-218-VD-2):** a curated stoplist of this system's own constitutional vocabulary (Canon, ICM Layer, FEYNMAN, AAAK Record, TAM, SAM, GAP...) plus a filename-shape gate. Explicitly narrow-scope: only helps a MindrianOS dogfooding room, does not generalize to a real user venture room. Documented as such, not oversold.
2. **METADATA_FIELD_RX + markdown-table-row filter (T-218-VD-3):** the more important fix. Live re-verification kept surfacing status-dashboard field values ("Status: Seeded", table cells like "Well-developed") at the top of the ranking. This filter is SHAPE-based (`Label: Value` where every label word is Title-Case; markdown table syntax), not vocabulary-based -- it generalizes to any venture domain. Proven with a dedicated test using an INVENTED biotech venture (Helix Biosciences / Genomix) containing zero MindrianOS terms: real entities survive, metadata/table noise does not.

**Considered and explicitly rejected: wiring in a live classifier.** A Plurai-hosted "Venture Term Classifier" (labels `real_domain_entity`/`system_vocabulary`) was built and optimized in a parallel session (1.000 accuracy/precision/recall on a 16-sample SYNTHETIC set, unverified against real terms -- the invocation contract 404'd on every REST path tried). Even setting aside that unverified state, wiring a remote classifier into the tier-1 extraction path would send real room-derived content (company names, deal terms) to an external network judge -- the exact thing Canon Part 8 exists to prevent, stated verbatim elsewhere in this same pipeline ("Real-room content is verified by the HUMAN spot-check... never by a network judge"). Not wired in. Filed as a possible future opt-in tier-1.5 step (explicit per-run consent required), a separate design decision, not folded into this fix.

**Live re-verification, each iteration on the wiped-and-re-extracted real room:**

| Pass | Entity nodes | Top-25 structural share |
|------|-------------|--------------------------|
| Pre-extraction baseline | 0 | 100.0% |
| Post cohort-stratification fix only | 149 | 0.0% |
| + NOISE_TERMS/FILENAME_RX | 132 | 0.0% |
| + METADATA_FIELD_RX/table filter | 123 | 0.0% |

REQ-5's numeric criterion held at 0.0% throughout (was never at risk after the ranking fix; these later passes are precision improvements, not the REQ-5 acceptance number itself).

**Remaining gap, diagnosed not just observed:** the still-noisy top-ranked terms on THIS room ("Larry", "Governing Thought", "Pyramid Logic", "Seeded") are neither metadata- nor table-shaped -- they are standalone capitalized words inside this room's own FLOWING prose. `aion-eureka-synergy` is a meta-analysis room that narrates MindrianOS's own Eureka-experiment process, not a competitive-landscape venture room. This is a content-domain mismatch (this specific room has comparatively little real company/market prose to find), not a code defect the structural filter class can reach. Domain-first sequencing (running `typed-domain.cjs` before entity extraction, using the identified domain as context) was raised as a possible future direction; checked live and this room has zero `domain`/`subdomain`/`focus_area` nodes today, so it is unavailable without separate work, and would not have addressed this specific gap regardless (it is a content-mismatch issue, not an ambiguity-resolution issue).

## Disposition

Cohort-stratification fix: DONE, tested, committed (`912139c9`). Title-resolution fix: DONE, same commit. Domain-agnostic noise filters: DONE, tested, committed (`7d98c9b8`), proven to generalize via a non-MindrianOS synthetic fixture. Remaining noise on `aion-eureka-synergy` specifically: diagnosed as a content-domain mismatch particular to this dogfooding room, not a pending code fix. Live classifier option: evaluated, explicitly not wired (Canon Part 8), filed as a separate future design question.

---

## Tier-2 appendix: WHAT-vs-WHY classifier live re-verification (2026-07-15, quick tasks 260714-hzx + 260714-k44)

**Context.** The "Remaining gap" above named `Larry`, `Governing Thought`, `Pyramid Logic` as flowing-prose survivors the shape-based filters structurally cannot reach, and closed the file by calling them a content-domain mismatch rather than a code fix. Quick task `260714-hzx` built the tier-2 WHAT-vs-WHY semantic pass to close exactly that gap; quick task `260714-k44` then redesigned tier-2 into a two-tier flow (free local embedding tier-2a, LLM escalation tier-2b). This appendix records the live re-verification of the shipped two-tier pipeline against the real `aion-eureka-synergy` room. Dev-research trail cross-referenced at `~/MindrianRooms/rethinking-mindrianos/research/2026-07-14-eureka-ranking-bug-and-what-why-classifier/`.

**Run discipline.** Same wipe-and-re-extract discipline as the passes above, on a backed-up db. Backups taken before touching anything: `room.db.bak-hzx-task3-001024` (pre-wipe, 285 `entity:entity-extract:*` nodes + 553 edges, zero `framework_terms`) and `room.db.tier2-verified` (the post-run state). The 285 prior `entity:entity-extract:*` nodes and their 553 edges were deleted via a transaction on the backed-up db; the typed `governing_thought` (10) and `memory_artifact` (39) nodes were left untouched. Then `node scripts/entity-extract.cjs ~/MindrianRooms/aion-eureka-synergy run` (24s, tier-2a live encoder + tier-2b escalation attempted).

**status.json (real run):** `{"artifacts":65,"entities":35,"terms_why":688,"dropped_noise":0,"classifier_source":"embedding","framework_applied":35,"tier2_embedding":399,"tier2_escalated":206,"tier2_model":0,"tier2_low_confidence":206}`.

### (a) Three residual terms reroute WHY for free -- **PASS, zero API spend**

- `Larry`, `Governing Thought`, `Pyramid Logic`: **0 entity nodes** of type `company`/`technology`/`market` (was 3 `company` nodes before the run).
- All three now land in `framework_terms` on their source artifacts (each appears in the `framework_terms` of 9 artifacts; 35 artifacts carry `framework_terms` total, `framework_applied: 35`).
- `classifier_source: embedding` and `tier2_model: 0` -- the reroute was resolved entirely by the free local embedding tier-2a at **zero API spend**. This confirms k44's prediction: as reference-set members the three terms score cosine similarity 1.0 against themselves, clearing any margin, so they resolve WHY confidently without a funded key. The original hzx Task 3 acceptance (assert `classifier_source: 'model'`) is superseded: the core reroute no longer requires the LLM at all.
- `company` node count dropped 309 -> 46; the 688 WHY terms are captured as framework signal, never minted as entities and never silently discarded. `AION Labs` (the room's real subject) survives as an entity node (9 `AION*` entity nodes present).

### (b) framework_terms capture holds -- **PASS**; 0.0% structural share -- **REGRESSED to 72.0%**

- **framework_terms capture: PASS.** 35 artifacts carry `framework_terms` + `framework_term_count`; `terms_why: 688`, `framework_applied: 35`, `framework_skipped: 0`. `review_status` untouched (scalar-prop merge only, T-219-05 discipline).
- **Top-25 structural share: 0.0% -> 72.0% (18/25).** After the tier-2 re-extract, `node scripts/eureka-command.cjs ... run --no-extract` -> `portfolio-report.json`: 18 of the top-25 ranked pairs are `memory_artifact`-vs-`memory_artifact`. The 912139c9 fix's live result does NOT hold on the tier-2 substrate.

**Isolation test (definitive causation).** Same room, same code, same eureka command, only the substrate differs:

| Substrate | company nodes | entity edges | framework_terms | Top-25 structural share |
|-----------|--------------|-------------|-----------------|-------------------------|
| Pre-wipe backup (`room.db.bak-hzx-task3-001024`) | 309 | 553 | 0 | **0.0% (0/25)** |
| Post tier-2 (`room.db.tier2-verified`) | 46 | 35 | 688 terms / 35 artifacts | **72.0% (18/25)** |

The 912139c9 fix holds perfectly on the pre-wipe substrate (0.0%) and breaks on the tier-2 substrate (72.0%). Tier-2 is the cause, not room drift and not the verification procedure.

**Root cause (traced, not observed).** The dimension breakdown of the top-25 tier-2 pairs shows `strategic_fit` flat at 0.25 and `validated_demand` at 0.97-0.99 for both the entity and the scaffold pairs -- so `validated_demand` (the edge-count percentile) is the discriminator, not semantic fit. The mechanism: tier-2 correctly pulls 688 methodology-vocabulary terms OUT of the entity population, collapsing the entity cohort from a dense ~285-node / 553-edge population to a sparse 46-node / 35-edge one, while leaving the `memory_artifact` scaffold cohort's dense CONVERGES interconnection (147 converges pairs) untouched. The cohort-stratification fix equalizes the validated_demand CEILING between families (each family's top node reaches ~1.0 within its own cohort) but cannot SUPPRESS the denser family: with the entity family starved, the 39-node scaffold clique simply generates more top-percentile pairs, so the top-25 refills with scaffold-vs-scaffold pairs. This is NOT embedding contamination from the framework_terms merge (that would move `strategic_fit`, which stays flat); it is edge-starvation of the entity cohort feeding the `validated_demand` dimension.

**Honest reading.** Two things are simultaneously true. (1) Tier-2 did its job: it removed 688 false methodology-vocabulary entities, a real precision win, closing the exact `Larry`/`Governing Thought`/`Pyramid Logic` gap this file left open. (2) On this specific dogfooding room, doing so unmasks that the real external-entity substrate is genuinely thin (aion-eureka-synergy narrates MindrianOS's own process; it has few real company/market entities), so the eureka ranking refills the top with scaffold pairs. This is the same "the SPIRIT of REQ-5 is blocked on extraction precision, not ranking fairness" caveat this file already logged, now inverted: precision improved, and the thin-substrate reality surfaced in the ranking. The literal 0.0% acceptance number from the earlier passes does NOT survive tier-2 on this room.

### (c) Tier-2b escalation path -- honest zero-credit degrade confirmed (not a blocker)

The Anthropic key resolves, but the account has zero credits: a direct probe returns `HTTP 400 invalid_request_error "Your credit balance is too low to access the Anthropic API"`. The pipeline's honest-degrade contract handled this correctly and observably: tier-2b was attempted per escalated artifact (`tier2_escalated: 206`), every call failed the `source === 'model'` acceptance gate, so each escalated candidate fell to its embedding best-guess counted as low-confidence (`tier2_low_confidence: 206`, equal to `tier2_escalated`), `tier2_model: 0`, and `classifier_source` stayed `embedding` (never faked to `model`/`mixed`). The counts reconcile honestly with the path that actually ran. Per the k44-corrected acceptance criteria, exercising a successful tier-2b model path is NOT a blocker for this verification; it requires a funded key, which is unavailable, and the (a)/(b) acceptance is key-less by design.

### Disposition (tier-2 appendix)

- **(a) reroute:** DONE and verified key-less. The three named residual terms are closed -- they are `framework_terms`, not entity nodes, resolved by the free embedding tier.
- **(b) framework_terms capture:** DONE and verified. **0.0% structural share: NOT preserved (72.0%), caused by tier-2, root cause isolated and traced.** This is surfaced for a navigator decision, NOT auto-patched: it is a ranking-layer question (should eureka exclude or down-weight `memory_artifact`-vs-`memory_artifact` pairs, which are substrate and never real opportunities, so the top-25 reflects real entity pairs regardless of entity-cohort density?), which is an architectural change to the eureka scoring path, outside the scope of an entity-extraction verification task.
- **(c) tier-2b:** honest-degrade path verified against a live zero-credit account; a funded-key model-path exercise remains open, non-blocking.

## Scaffold-pair filter appendix: 72.0 percent -> 0.0 percent on the same substrate (2026-07-15, quick task 260715-0nj)

**The decision this closes.** The tier-2 appendix above escalated one open question to the navigator: should eureka exclude or down-weight `memory_artifact`-vs-`memory_artifact` pairs so the top-25 reflects real entity pairs regardless of entity-cohort density? The navigator decided: **exclude**. Quick task `260715-0nj` implements that decision. Dev-research trail cross-referenced at `~/MindrianRooms/rethinking-mindrianos/research/2026-07-14-eureka-ranking-bug-and-what-why-classifier/` (mirrored to `~/MindrianOS/research/`), which cross-references the `260714-hzx` finding above.

**The mechanism.** A both-scaffold candidate-pair exclusion at the pair-candidate GENERATION step in `scripts/eureka-portfolio-report.cjs` (main() step 4b, one post-enumeration pass covering all three pairs modes: graph, full, room). A pair is excluded when BOTH endpoints are members of `SCAFFOLD_NODE_TYPES` (`memory_artifact` / `Artifact`); the exclusion count is surfaced honestly in the JSON provenance (`scaffold_pairs_excluded`) and the markdown provenance table. This extends the established `lib/core/eureka/opportunity-harvest.cjs` lines 519-521 both-scaffold skip (the bridge + contradiction lanes, "a structural restatement of the room, not a signal") to the portfolio ranking candidate set. Deliberately NARROW: a pair with only ONE scaffold side is untouched (the entity-vs-artifact pairs are the real signal and must survive). The `portfolio-dimensions.cjs` cohort-stratification logic (912139c9) is byte-unchanged; this fix is at the candidate-generation layer, not the scoring math.

**Live re-verification (same substrate that produced 72.0 percent).** To prove the fix is density-independent, the re-run used the EXACT `room.db.tier2-verified` bytes the `260714-hzx` run measured (46 `company` nodes, 39 `memory_artifact` nodes, 35 domain entity edges), NOT a fresh re-densified substrate. Run discipline: `room.db.bak-260715-0nj` backed up first, then `room.db.tier2-verified` restored over `room.db` (md5-confirmed identical), then `node scripts/eureka-command.cjs ~/MindrianRooms/aion-eureka-synergy run --no-extract` (live local embedding spine, not offline). Structural share measured with the same `typeById` join over `room.db` the suite uses (`tests/test-218-noise-reduction.cjs`), not id-prefix string matching.

| Metric | Before (260714-hzx) | After (260715-0nj) |
|--------|---------------------|--------------------|
| Substrate | `room.db.tier2-verified` (46 company, 39 memory_artifact) | SAME `room.db.tier2-verified` (byte-identical) |
| Top-25 structural share | **72.0% (18/25)** | **0.0% (0/25)** |
| Ranked count | 25 | 25 (non-empty) |
| Pairs scored | (dense scaffold clique) | 2783 |
| `scaffold_pairs_excluded` (provenance) | n/a (no filter) | **741** |
| Run mode | live | live |

The top-5 ranked pairs after the fix are entity-involving (`Aion Research Gen` x `AION`, `AION Labs` x its source artifact, `AION Labs` x `Aion Research Gen`, `AION Labs` x `AION`, `Advantage` x `Aion Research Gen`); pair 2 is a one-side `company`-vs-`memory_artifact` pair, confirming the narrow filter leaves one-side pairs intact. The structural share is now 0.0 percent by CONSTRUCTION, independent of how sparse the real-entity cohort is, which is precisely the density-independence the exclude decision buys over the cohort-stratification approach.

### Disposition (scaffold-pair filter appendix)

- **The 72.0 percent regression is CLOSED.** The exact substrate that showed 72.0 percent now shows 0.0 percent, with 741 scaffold pairs excluded and the ranked list still non-empty and populated by real entity pairs. No `portfolio-dimensions.cjs` scoring-math change was needed; the fix lives at the candidate-generation layer, isolatable from the tier-2 extraction work. The full 218 suite (including the new `test-218-scaffold-pair-filter.cjs` leg and the adapted cohort-stratification + noise-reduction legs) is green offline; the five out-of-scope eureka modules are diff-clean.
