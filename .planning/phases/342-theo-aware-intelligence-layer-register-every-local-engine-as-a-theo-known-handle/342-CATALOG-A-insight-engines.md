# Phase 342 - Catalog A: Insight Engines

Scope: the six engine families named in this catalog's brief - Eureka (portfolio engine + Grounding Guard critic), the RS engine (Reverse Salient), HSI (Semantic Surprise), the local vector/FTS spine, the entity/embedding/graph-derive classifiers, and analogy-fitness.cjs. Read against this tree through 2026-09-09 (v2.0.0-beta.30-ish; see this phase's own 342-FINDINGS.md for the wider Theo-project frame). No room content, no real names, no em-dashes below.

## Summary table

| Engine | Command(s) | MCP tool | Model needed? | Brain/Theo touch? | Declared frameworks | Proposed Theo name | Phases |
|---|---|---|---|---|---|---|---|
| Eureka (+ eureka_critic) | /mos:eureka | `intelligence` (eureka-run/status/report, REAL exec) + `eureka_critic` (REAL, local-only ruling) | yes (@huggingface/transformers, sqlite-vec) | none | none (`frameworks: []`) | Cross-Domain Opportunity Portfolio Scoring (NEW) | 211-216, 218, 226, 231, 268 (blocked) |
| RS engine / Reverse Salient | find-bottlenecks, rs-fetch, rs-explain, rs-experts, rs-thesis | `analysis` (find-bottlenecks, REFERENCE-ONLY); none for the other four | yes (embedding leg) | yes, live - rs-fetch/rs-explain call brain-client.cjs (now theo-mcp.onrender.com); rs-thesis/rs-experts deliberately do not | Reverse Salient Analysis (existing) | reuse existing | 27.1, 89, 94, 200, 161 (deferred), 272, 268 (blocked), 242 |
| HSI (Semantic Surprise) | score-innovation, whitespace, scout hsi | `methodology` + `intelligence` (REFERENCE-ONLY); `orchestration` scout-hsi (REFERENCE-ONLY) | yes (TF-IDF/SVD, no neural model) | none live (reads a cached local Brain-baseline snapshot only) | HSI Semantic Surprise Analysis Assistant (existing) | reuse existing | 27.1, 60, 242, 272 |
| Local vector/FTS spine | none (substrate) | none | yes (transformers + sqlite-vec) | none | n/a | Local Hybrid Retrieval Substrate (NEW, infra tag) | 211, 161 (deferred) |
| Entity/embedding/graph-derive classifiers | none (substrate) | none | mixed - embedding-classifier yes; entity-classifier calls Anthropic LLM transport, not a local model | none (Brain/Theo); entity-classifier.cjs egresses room text to the raw Anthropic API, a distinct non-Brain boundary | n/a | none proposed (infra) | 218, 231, 233, 60 |
| analogy-fitness.cjs | none (feeds Catalog B's find-analogies) | none | yes (text leg only) | none found | n/a | none proposed (infra) | 214 |

---

## 1. Eureka (portfolio engine + eureka_critic Grounding Guard)

**1. What it does.** The room's cross-domain matchmaker. It reads everything filed in the room, encodes it into vectors, and hunts for pairs of ideas from DIFFERENT domains that "rhyme" - where an insight in one section could unblock a stuck problem in another. It ranks the pairs, surfaces the weak-signal tail a plain top-N sort would bury, and drafts an Opportunity Statement per keeper. `eureka_critic` (the "Grounding Guard") is a second, independent local check that catches matches which only look novel from shallow word overlap, before a candidate reaches the navigator.

**2. Surfaces.** Command: `commands/eureka.md` (`argument-hint: [run|status|report|html]`). MCP: `mcp__...__intelligence`, extended with `EUREKA_COMPUTE_COMMANDS = ['eureka-run','eureka-status','eureka-report']` (`tool-router.cjs:255`); this branch really executes - `scripts/eureka-command.cjs`'s `main()` runs in-process (`tool-router.cjs:1362`). `mcp__...__eureka_critic` is its own tool (`tool-router.cjs:1987`), calling `eureka-critic.cjs`'s `criticRule` in-process (`tool-router.cjs:2051`). Agent: none dedicated. Scripts: `scripts/eureka-command.cjs` (the shared CLI+MCP dispatcher), `eureka-critic-run.cjs`, `eureka-portfolio-report.cjs`, `eureka-room-report.cjs`.

**3. Core modules + entry functions.** `scripts/eureka-command.cjs`: `main(argv)` L602, `cmdRun(opts)` L329. `lib/core/eureka-critic.cjs`: `stageA(candidate, opts)` L232, `assembleCriticPayload` L115. `lib/core/eureka/eureka-reach-runner.cjs`: `runEurekaScan(opts)` L344, `runGuardGate` L170. `eureka-offer.cjs`: `composeEurekaOffer(args)` L186. `ahp-weights.cjs`: `computeAhpWeights(matrix)` L126. `opportunity-statement.cjs`: `assembleText(fields)` L207. `reasoning-mode.cjs`: `proposeCandidatePairs` L167 (no-model LLM fallback). Shared substrate (tri-modal index, entity classifiers) is reported once in Entries 4-5.

**4. Phases.** 211-eureka-generator-mvp (2026-07-05/06, shipped) - tri-modal MVP. 212-eureka-substrate-grounding-guard (2026-07-06/10, shipped) - `eureka-critic.cjs`. 213-eureka-reach-wiring (2026-07-06/10, shipped) - SENS-13 sensor + reach wiring. 214-eureka-pattern-transfer-find-analogies (2026-07-06, shipped) - see Entry 6. 215-eureka-portfolio-scale-fusion (2026-07-06/10, `215-05-SUMMARY.md` status COMPLETE) - AHP+fusion. 216-eureka-user-facing-command (2026-07-10/11, `216-05` completed 07-11) - the command itself. 218-entity-extraction-pipeline (2026-07-12/15, shipped) - see Entry 5. 226-eureka-reasoning-mode-fallback (2026-07-15, `226-04` COMPLETE, human checkpoint approved). 231-eureka-entity-noise-fix (2026-07-19, shipped). 268-transition-rs-engine-and-eureka-to-real-mcp-tools (filed 2026-08-27, only `.gitkeep`, 0 plans) - BLOCKED INDEFINITELY. Navigator ruling 2026-09-01 (`ROADMAP.md:619`): promoting `eureka-run` onto the MCP Tasks extension is blocked on `@modelcontextprotocol/ext-apps` shipping a v2-compatible release, "no target date."

**5. Inputs -> outputs.** Reads: every markdown artifact under `room/**`, room.db graph nodes (`room-native-substrate.cjs`), any prior `idea-graph.json`. Writes: `room/.mindrian/eureka/{status.json,portfolio-report.{md,json,html}}`, `room/.mindrian/idea-graph.json`, Opportunity Statement artifacts filed to `room/opportunity-bank/**` on approval, plus the shared `eureka_fts` / `eureka_vec(_fallback)` / `eureka_meta` room.db tables (Entry 4).

**6. Registry facts.** `/mos:eureka`: kind `utility`, surface `navigator`, `autonomous_safe: false`, `frameworks: []`, `body_shape: "E (Action Report)"`, `jtbd_label: "Connect Domains"`. Projection: `reach_id: "context_block"`, `sub_mode: "eureka-portfolio"`, `posture: "hold"`, `hierarchy_rank: 3`, `sensor_triggers: ["SENS-13"]`.

**7. Brain/Theo touchpoints today.** None. `lib/core/eureka/` and `scripts/eureka*.cjs` contain zero `brain-client.cjs` requires - `entity-classifier.cjs:35` states "no Brain host string and no brain-client require anywhere in this file"; `embedding-spine.cjs:8` says "NO Python, NO PyTorch, NO GPU, NO Brain." `eureka_critic` is a pure local ruling function, not an outbound Brain/Theo call - quantized scalars in, a verdict out; "no room content ever crosses this boundary" (its own tool description). `eureka-offer.cjs:119` requires `../../brain/chain-recommender.cjs`, but despite the directory name that module is entirely LOCAL (registry-only, Part 7 reuse, no network call). Because `/mos:eureka` declares `frameworks: []` and `autonomous_safe: false`, it is invisible to Theo's `recommend_chain` today - a live `normalize_framework_name("Eureka")` returns `FRAMEWORK_NOT_FOUND` (cited in this phase's own 342-FINDINGS.md).

**8. Local dependencies.** `@huggingface/transformers ^4.2.0` (`package.json:22`), `sqlite-vec ^0.1.9` (`package.json:35`). Degrade: `vector-store.cjs`'s `ensureVecLoaded` (L99) probes the sqlite-vec extension once; on failure it silently falls back to `eureka_vec_fallback` + CJS cosine similarity (`vector-store.cjs:140-155`), sticky until the next reindex (`:259-262`). `embedding-spine.cjs` degrades the same way if the model is absent/fails (docblock ~L50); `reasoning-mode.cjs` (Phase 226) is the last resort when no embedding model is installed at all.

**9. Proposed Theo Framework name.** None of the 105 names in `data/framework-names.json` fits, and a live query confirms `FRAMEWORK_NOT_FOUND`. Propose new: **"Cross-Domain Opportunity Portfolio Scoring"** - matches the command's own teaching line.

**10. Problem-type routing.** Ill-Defined ("what's the next big thing at this intersection"). Chain neighbors: parallel with `find-analogies` (Catalog B; shares the Phase 214 substrate) and `explore-domains`; downstream into `build-thesis` or `lean-canvas` once a pair is picked.

---

## 2. RS engine (Reverse Salient)

**1. What it does.** Named for Thomas Hughes' 1983 history-of-technology idea: in any system that grows unevenly, one lagging subsystem holds the whole system back. The RS engine finds that lagging component inside the navigator's own room - the section or claim trailing the rest - by measuring cross-artifact semantic similarity and surfacing the single weakest link as one F.0 finding, not a laundry list.

**2. Surfaces.** Commands: `find-bottlenecks.md` (agent-first), `rs-fetch.md`, `rs-explain.md`, `rs-experts.md`, `rs-thesis.md`. MCP: `find-bottlenecks` is nominally reachable via `mcp__...__analysis` (`ANALYSIS_COMMANDS`, `tool-router.cjs:234`), but that branch calls `buildContext()` (`tool-router.cjs:489`, invoked at `:1234`) - a static reference doc plus room STATE.md. It does NOT invoke `rs-engine.cjs` or `reverse-salient-agent.cjs`. `rs-fetch`/`rs-explain`/`rs-experts`/`rs-thesis` have no MCP tool surface at all - absent from every command enum in `tool-router.cjs` - CLI-only. Agent: `agents/reverse-salient-agent.md` ("Sibling to larry-extended; not a replacement"). Scripts: `rs-engine.py`, `rs-fetch-command.cjs`, `rs-explain-command.cjs`, `rs-experts-command.cjs`, `rs-thesis-command.cjs`, `rs-vector-bridge.cjs`, `detect-reverse-salients.py`.

**3. Core modules + entry functions.** `lib/core/rs-engine.cjs`: `runModeInternal` L472, `writeReverseSalientEdges` L391. `lib/agents/reverse-salient-agent.cjs`: `detectAndSurface` L383, `runRsEngine` L194. `lib/core/rs-differential-scorer.cjs`: `score` L326, `scoreMeasured` L496. `lib/core/rs-egress-prompts.cjs`: `auditQueryObject` L79 - the Part 8 pre-send scan. `lib/core/rs-pinecone-bridge.cjs`: `queryPineconeWithVectors` L182. `lib/core/rs-thesis-generator.cjs`: `generateThesis` L110. `lib/core/rs-backend-dispatch.cjs`: `resolveBackend()` L55 - the one CJS-vs-Python chokepoint.

**4. Phases.** 27.1-hsi-reverse-salient-python-pipeline (2026-03-31/04-05, shipped) - original Python `rs-engine.py` + `compute-hsi.py`, shared build with HSI. 89-reverse-salient-engine (2026-04-20/05-06, shipped) - Engine 1 Act 1, agent-first F.0 pattern. 94-v1-11-2-tester-driven-fixer/94-02 - `rs-fetch`/`rs-thesis` merge-contract fix. 200-rs-engine-spine-corpus (2026-07-01, shipped) - corpus discovery spine. 161-embedding-layer-and-rs-reconciliation (created 2026-06-17, `status: context-gathering`, never advanced past a CONTEXT.md) - superseded before execution by Phase 211 three weeks later. 272-phase-134-real-remediation-cjs-python-elimination-port (272-04/10/11, shipped) - CJS port + `rs-backend-dispatch.cjs`, wired into 3 real callers at plan 272-10 (`ROADMAP.md:2095`). 242-the-moat/242-01 (shipped) - fixed a data-loss bug: `hsi-to-graph.cjs` used to delete every `HSI_CONNECTION`/`REVERSE_SALIENT` edge before rewriting, no transaction; a mid-run kill left the room at zero scoring edges ("the scoring layer IS the moat," `242-01-SUMMARY.md:49`). 268-transition-rs-engine-and-eureka-to-real-mcp-tools (filed 2026-08-27, 0 plans) - BLOCKED INDEFINITELY, same navigator ruling as Eureka.

**5. Inputs -> outputs.** Reads room artifacts plus, optionally, the Brain/Theo methodology substrate (`rs-brain-substrate.cjs`, cached to `.mindrian/brain-substrate-cache.json`) and an external Pinecone corpus (`rs-pinecone-bridge.cjs`, needs `PINECONE_API_KEY`). Writes `REVERSE_SALIENT` edges into room.db's `edges` table (source tag `rs-engine`, `rs-engine.cjs:391-420`), `rs-fetch`/`rs-explain`/`rs-experts`/`rs-thesis` artifacts under `room/**/rs-*/`, and cascade memory events.

**6. Registry facts.** `/mos:find-bottlenecks`: kind `methodology`, `frameworks: ["Reverse Salient Analysis"]`, `autonomous_safe: true`, produces `"room/**/reverse-salients/*"`; projection `sub_mode: "reverse-salient"`, `posture: "pull_back"`, `hierarchy_rank: 2`, `sensor_triggers: ["SENS-02"]`. `rs-fetch`/`rs-explain`/`rs-experts`/`rs-thesis` share the same framework and sensor, all `posture: "pull_back"`; `autonomous_safe` true for all except `rs-explain` (false); `hierarchy_rank` 2/3/4/5 respectively.

**7. Brain/Theo touchpoints today.** Real and live, but partial. `rs-fetch` (via `rs-domain-analyzer.cjs` -> `rs-brain-substrate.cjs` -> `lib/core/brain-client.cjs`) and `rs-explain` (via `rs-nl-to-query.cjs`'s `brain_ask_template`, executed at `scripts/rs-explain-command.cjs:143-190`) both call OUT to `brain-client.cjs`, whose default host is now `theo-mcp.onrender.com` since the Phase 339 cutover (`brain-client.cjs:40`) - live Theo touchpoints today, via the ungated `brain_ask` tool (never the admin-gated `brain_query`, a deliberate "BUG 2 fix" swap). `rs-brain-substrate.cjs` enforces Canon Part 8 at three layers before any send (allow-listed keys, slug-safe scalars, a `FORBIDDEN_PATTERNS` pre-send audit, `rs-brain-substrate.cjs:1-25`). `rs-thesis`/`rs-experts` deliberately do NOT call Brain/Theo - both commands' frontmatter removed `brain_query` citing Part 8 ("RSDiscovery is USER DATA... The remote Brain must never be called from this command," `commands/rs-thesis.md`); they read only the local room-mirror `rs-fetch` populates.

**8. Local dependencies.** The CJS path reuses `embedding-spine.cjs` (Entry 4) and `hsi-lsa.cjs`/`hsi-spectral.cjs` (Entry 3); the Python fallback needs `requirements-hsi.txt` (scikit-learn etc.), auto-installing missing deps via `scripts/lib/ensure_ml_deps.py`. Degrade: `rs-backend-dispatch.cjs:55` `resolveBackend()` reads `MINDRIAN_RS_BACKEND` (unset/`'cjs'` -> CJS default, D-04; `'python'` -> explicit rollback). Note: `commands/scout.md`'s own `/mos:scout hsi` step (`scout.md:268`) still shells directly to `python3 scripts/compute-hsi.py`, bypassing this dispatch chokepoint entirely - a live inconsistency with the "no module outside the chokepoint spawns Python directly" rule in `rs-backend-dispatch.cjs`'s own docblock.

**9. Proposed Theo Framework name.** Already exists, reuse: **"Reverse Salient Analysis"** (`framework-names.json`; already declared on all five RS commands). Two Theo-side siblings sit unused by any command - "Algorithmic Generation of Reverse Salient Solutions" and "Reverse Salients identification" - worth checking whether either maps to an `rs-fetch` sub-step.

**10. Problem-type routing.** Well-Defined-leaning ("where specifically is this venture lagging"), with an Ill-Defined on-ramp (`rs-fetch` can run cold on any topic). Chain neighbors: feeds `root-cause` and `systems-thinking`; `rs-fetch` is the natural upstream of `rs-explain`/`rs-experts`/`rs-thesis` (all four read the same local room-mirror `rs-fetch` populates).

---

## 3. HSI (Semantic Surprise / Hughes Salient Index)

**1. What it does.** Scores how "surprising" a pairing of two ideas is - not just similar, but similar in an unexpected way - combining LSA topic overlap with a spectral "mode transition" analysis of the writing itself (`omhmm`, a hidden-Markov surprise homage). A high score marks a cross-domain connection worth a second look; the same math doubles as the whitespace detector (gaps where the room says little near a topic it clearly cares about).

**2. Surfaces.** Commands: `score-innovation.md` (its own frontmatter says today it is a NO-COMPUTE conversational pass: "No computation, no algorithms"), `whitespace.md`, and `scout.md`'s `/mos:scout hsi` subcommand (the actual compute trigger, `scout.md:245-274`). MCP: `score-innovation` via `mcp__...__methodology` (`METHODOLOGY_COMMANDS`, `tool-router.cjs:225-229`) - reference-only (`buildContext`, `:489`). `whitespace` via `mcp__...__intelligence` - also reference-only per the tool's own comment ("a reasoning-only doc+state echo," `tool-router.cjs:1391-1392`). `scout hsi` via `mcp__...__orchestration`, whose description says scout variants "only return the scout reference plus current room context, not gathered intelligence." No MCP branch executes `hsi-engine.cjs` / `compute-hsi.py`. Agent: none. Scripts: `compute-hsi.py`, `detect-reverse-salients.py`, `hsi-to-graph.cjs`, `discover-hsi-whitespace.py`, `check-hsi-deps`.

**3. Core modules + entry functions.** `lib/core/hsi-engine.cjs`: `runTier1` L316, `computeHsiMatrix` L253. `lib/core/hsi-lsa.cjs`: `computeLsaSimilarity` L191. `lib/core/hsi-spectral.cjs`: `computeOmhmmScore` L497, `computeSpectralGap` L322, `computeStationaryDistribution` L358 - the Markov-chain surprise math. `scripts/compute-hsi.py`: `compute_omhmm_score` L535 (Python original). `scripts/hsi-to-graph.cjs`: edge writer, transaction-wrapped since Phase 242.

**4. Phases.** 27.1-hsi-reverse-salient-python-pipeline (2026-03-31/04-05, shipped) - original Python HSI pipeline, shared build with the RS engine. 60-embedding-infrastructure (2026-04-08/09, shipped) - the Brain-baseline embedding cache HSI's whitespace leg reads. 242-the-moat (shipped) - fixed the untransacted `HSI_CONNECTION`/`REVERSE_SALIENT` rewrite bug (see Entry 2, Phase 4). 272-phase-134-real-remediation-cjs-python-elimination-port (shipped) - CJS port of `hsi-lsa.cjs`/`hsi-spectral.cjs`, now the `MINDRIAN_RS_BACKEND` default, though `scout hsi`'s own script still calls the Python original directly (Entry 2, field 8).

**5. Inputs -> outputs.** Reads room artifacts (LSA + spectral text analysis) and a locally cached Brain/Theo baseline snapshot (`.mindrian/brain-baseline.json`, built in Phase 60, read at `discover-hsi-whitespace.py:80-86`) - a cached snapshot, not a live call. Writes `room/.hsi-results.json`, `room/.hsi-cache.json`, and (via `hsi-to-graph.cjs`) `HSI_CONNECTION` + `REVERSE_SALIENT` edges into room.db's `edges` table; `score-innovation`'s conversational path additionally files `room/opportunity-bank/hsi-scores/*`.

**6. Registry facts.** `/mos:score-innovation`: kind `methodology`, `frameworks: ["HSI Semantic Surprise Analysis Assistant"]`, `autonomous_safe: true`, produces `"room/opportunity-bank/hsi-scores/*"`; projection `sub_mode: "hsi"`, `posture: "hold"`, `hierarchy_rank: 3`, `sensor_triggers: ["SENS-06"]`. `/mos:whitespace` shares the same framework, `autonomous_safe: true`, produces `"room/opportunity-bank/whitespace/*"`, `sub_mode: "whitespace"`, `posture: "hold"`, `sensor_triggers: ["SENS-06"]`.

**7. Brain/Theo touchpoints today.** No live wire call anywhere in the HSI math path - `hsi-engine.cjs`, `hsi-lsa.cjs`, `hsi-spectral.cjs`, `compute-hsi.py` contain no `brain-client` require. The one Brain-adjacent artifact is `scripts/discover-hsi-whitespace.py`, which loads a locally cached, previously fetched Brain baseline embedding file (`:80-86`) to test "is the room sparse where Brain's framework corpus is dense" - a stale local snapshot read, not a runtime Theo call. Nothing crosses the wire at compute time.

**8. Local dependencies.** LSA needs a TF-IDF+SVD pass (`lib/core/numeric/tfidf.cjs`, `svd.cjs` for the CJS path; scikit-learn for the Python path, checked by `scripts/check-hsi-deps` - if sklearn is missing, `scout.md`'s own instructions say to skip with a "pip install scikit-learn" notice rather than fail hard). No local neural model download is required - LSA/spectral are closed-form math, lighter-weight than Eureka/RS's embedding leg.

**9. Proposed Theo Framework name.** Already exists: **"HSI Semantic Surprise Analysis Assistant"** (`framework-names.json`), already declared on both `score-innovation` and `whitespace`. No new name needed.

**10. Problem-type routing.** Ill-Defined ("is this cross-domain pairing actually novel, and where is the room thin"). Chain neighbors: `whitespace` recommends running "after the room has 20+ entries"; `score-innovation` suggests `/mos:explore-domains` on a high-scoring pair. HSI math is also reused inside `rs-engine.cjs`/`intelligence-cascade.cjs` (Entry 2) - RS and HSI share one numeric substrate even though they surface as separate commands.

---

## 4. Local vector/FTS spine

**1. What it does.** The room's own private search engine - a small hybrid retrieval system living inside room.db. It keeps two parallel indexes of every artifact (keyword + meaning) and blends their rankings, so Eureka (and anything needing "what in this room is like X") gets both literal keyword hits and semantic near-misses in one ranked list, entirely offline.

**2. Surfaces.** No dedicated `/mos:` command or MCP tool - pure substrate, consumed by Eureka (Entry 1) and, transitively, by RS's CJS embedding leg (Entry 2). No agent, no standalone script - invoked in-process by `scripts/eureka-command.cjs`.

**3. Core modules + entry functions.** `lib/core/eureka/tri-modal-index.cjs`: `openIndex` L304, `indexNodes` L401, `lexicalSearch` L501, `vectorSearch` L524, `reconcileFtsOrphans` L369 (health repair). `hybrid-retrieve.cjs`: `hybridRetrieve` L128, `rrfFuse` L90 (Reciprocal Rank Fusion), `rerank` L194 (cross-encoder). `vector-store.cjs`: `ensureStore` L304, `ensureVecLoaded` L99. `embedding-spine.cjs`: `embedTexts` L456, `getEncoder` L336. `fts-index-lifecycle.cjs`: index freshness/rebuild gating.

**4. Phases.** 211-eureka-generator-mvp (`211-01`,`211-02-SUMMARY.md`, 2026-07-05/06, shipped) - built the spine: `embedding-spine.cjs` in 211-01, `tri-modal-index.cjs`+`hybrid-retrieve.cjs` in 211-02. 161-embedding-layer-and-rs-reconciliation (created 2026-06-17, `status: context-gathering`, never built past a CONTEXT.md) - superseded before execution by Phase 211 (see Entry 2, Phase 4).

**5. Inputs -> outputs.** Reads room.db node/artifact rows (`readArtifactBody`, `tri-modal-index.cjs:110`). Writes and maintains three room.db tables: `eureka_fts` (FTS5, porter+bm25), `eureka_vec` (sqlite-vec `vec0`) or `eureka_vec_fallback` (plain Float32 BLOB), and `eureka_meta` (model name, dim, backend). No user-facing artifact output of its own.

**6. Registry facts.** Not applicable - not a `/mos:` command, no registry/projection entry.

**7. Brain/Theo touchpoints today.** None. `embedding-spine.cjs:8`: "NO Python, NO PyTorch, NO GPU, NO Brain" for its transformers.js/ONNX local encoder.

**8. Local dependencies.** `@huggingface/transformers ^4.2.0`, `sqlite-vec ^0.1.9` (`package.json:22,35`). Two independent, graceful degrades: (a) sqlite-vec extension fails to load -> `vector-store.cjs:99-155` falls back to `eureka_vec_fallback` + CJS cosine, sticky until the next full reindex (`:259-262`); (b) the embedding model is absent/uncached -> `embedding-spine.cjs` degrades per its own docblock (~L50), and Eureka's `reasoning-mode.cjs` (Phase 226) substitutes an LLM-reasoning pass when no model is present at all.

**9. Proposed Theo Framework name.** None exists, and arguably none should - infrastructure, not a navigator-facing methodology. If Theo needs a chain-planning handle, propose **"Local Hybrid Retrieval Substrate"** as an infrastructure tag, not a pickable framework.

**10. Problem-type routing.** Not applicable (substrate). Chain neighbors: everything upstream of Eureka's ranking pass (Entry 1) and, transitively, RS's CJS path (Entry 2).

---

## 5. Entity / embedding / graph-derive classifiers

**1. What it does.** Three small local classifiers that turn raw room prose into structured signal: one pulls named entities and relationships out of markdown (structural, zero-egress); one decides whether a surviving term is a real-world entity or the room's own methodology vocabulary; and one scores whether two artifacts are similar enough that the room graph should auto-derive an edge between them.

**2. Surfaces.** No dedicated `/mos:` command or MCP tool. Consumed inside Eureka's entity-extraction step (`scripts/eureka-command.cjs`'s `maybeExtractFirst`, L215) and by the room-graph auto-derivation sweep (`gsd-graph-derive-drain.cjs`, `gsd-graph-derive-sweep.cjs`, `check-graph-derive-health.cjs`). Doctor: `lib/core/doctor/graph-derive-health-module.cjs` + `graph-derive-heal-retrofit-module.cjs` (health-check + repair, not a navigator command).

**3. Core modules + entry functions.** `lib/core/eureka/entity-extractor.cjs`: `extractEntities` L243 - tier-1 structural regex, zero egress. `entity-classifier.cjs`: `classifyArtifactCandidates` L158, `_fallback` L113 - tier-2 WHAT/WHY/NOISE semantic pass. `embedding-classifier.cjs`: `classifyByEmbedding` L179, `buildRefVectors` L128 - few-shot reference-vector classification, fully local. `lib/core/graph-derive-classifier.cjs`: `scoreBasedDeriveFn` L154, `buildAllPairs` L321.

**4. Phases.** 218-entity-extraction-pipeline (2026-07-12/15, shipped) - `entity-extractor.cjs` + `entity-classifier.cjs`. 231-eureka-entity-noise-fix (2026-07-19, shipped) - threads a low-confidence signal through so noisy entities are flagged rather than silently kept. 233-graph-derive-drain-residual-seed-037 (2026-07-27/28, shipped) - `graph-derive-classifier.cjs` health/heal retrofit, SEED-037. 60-embedding-infrastructure (2026-04-08/09, shipped) - shared baseline `embedding-classifier.cjs` reuses.

**5. Inputs -> outputs.** `entity-extractor`/`entity-classifier` read room markdown bodies and produce extracted entity/relation candidates (consumed by Eureka's `opportunity-harvest.cjs`, not written to room.db directly). `graph-derive-classifier.cjs` reads artifact pairs (`buildAllPairs`/`buildNewArtifactPairs`) and queues candidate auto-derived edges via `room/.mindrian/graph-derive-queue.json` for the drain/sweep scripts to commit.

**6. Registry facts.** Not applicable - library-internal classifiers, no command/MCP tool.

**7. Brain/Theo touchpoints today.** None call `brain-client.cjs` or a `brain_*`/`theo` tool; `entity-classifier.cjs:35` and `embedding-classifier.cjs:44` both assert "no Brain host string... anywhere in this file" (a grep-gated test tripwire); `graph-derive-classifier.cjs:52` "requires ONLY node built-ins + rs-differential-scorer.cjs." **Surprise worth flagging separately:** `entity-classifier.cjs` is not local-only the way its siblings are - its tier-2 pass calls the raw **Anthropic LLM transport directly** (`resolveAnthropicKey`, reused from `mva-classifier.cjs` per Part 7; `entity-classifier.cjs:1-33`), sending each candidate entity name plus a short room-text excerpt. Its own docblock is explicit this is a different boundary from Part 8: "The Part 8 graph boundary governs LOCAL -> BRAIN... NOT LOCAL -> the stateless Anthropic LLM transport" (`:24-27`). So the strict answer (brain-client/theo tool) is no - but real room content does leave the machine through this module, to a boundary this catalog's brief does not ask about. `embedding-classifier.cjs`, by contrast, is fully local (delegates all embedding to `embedding-spine.cjs`, `:39`, no transport of its own).

**8. Local dependencies.** `embedding-classifier.cjs` reuses `embedding-spine.cjs` (Entry 4) and inherits its degrade path. `entity-classifier.cjs` needs a resolvable Anthropic API key and network reachability, not a local model; its degrade-to-passthrough never throws: "with no resolvable key, no available transport, a non-2xx response, a timeout, an unparseable body, or any other failure, this module returns the fallback - every candidate labeled 'what'" (`:33-35`). `graph-derive-classifier.cjs` composes `rs-differential-scorer.cjs`'s LSA/BERT-cosine scoring (Entries 2/3), so its degrade path IS that scorer's.

**9. Proposed Theo Framework name.** None exists, none is proposed - infrastructure feeding other engines' scoring, not a methodology a navigator invokes.

**10. Problem-type routing.** Not applicable. Chain neighbors: feeds Eureka's entity-tagging step directly (Entry 1); `graph-derive-classifier.cjs` feeds the room's auto-derived-edge pipeline, a signal Eureka's `room-native-substrate.cjs` reads back in.

---

## 6. analogy-fitness.cjs

**1. What it does.** Given a source idea and a candidate analogy from another domain, scores how good a "fit" the analogy is - both in plain-language similarity and in structural similarity (do the underlying mechanisms map onto each other, a lightweight SAPPhIRE-style check) - so Eureka's pattern-transfer step can rank candidates instead of accepting the first superficial match.

**2. Surfaces.** No dedicated `/mos:` command - feeds `/mos:find-analogies` (Catalog B) - and no MCP tool. Script: `scripts/analogy-fitness-report.cjs` (a standalone CLI report over a room, named explicitly in Phase 268's W2 candidate list as a code-shell-out worth an MCP schema someday, `ROADMAP.md:2029`).

**3. Core modules + entry functions.** `lib/core/eureka/analogy-fitness.cjs`: `scoreAnalogyFitness(source, candidate, opts)` L223 (entry point), `textFitness` L127, `structuralFitness` L146, `rankCandidates` L274, `toRefineProposal` L292.

**4. Phases.** 214-eureka-pattern-transfer-find-analogies (2026-07-06, shipped; `214-01`..`214-04-SUMMARY.md` all list `requirements-completed`) - built `analogy-fitness.cjs` as Eureka's pattern-transfer leg, sharing groundwork with the separate `/mos:find-analogies` command (Catalog B).

**5. Inputs -> outputs.** Reads a source text/structural encoding and one or more candidate texts/encodings, passed in by the caller (e.g. Eureka's `explore-chain.cjs`). Returns a fitness-score object (text/structural sub-scores, combined score, ranked candidates); writes nothing itself - the caller decides what to file.

**6. Registry facts.** Not applicable - no registry/projection entry of its own (`find-analogies`, which it feeds, is Catalog B's to report).

**7. Brain/Theo touchpoints today.** None found - no `brain-client` require, no `fetch`. (`find-analogies` itself is out of this catalog's scope and may carry its own touchpoints in Catalog B.)

**8. Local dependencies.** `textFitness`/`structuralFitness` both run over the room's embedding encoder when available. Degrade is explicit in the module: on encoder unavailability either leg returns `{ success: false, degrade: 'qualitative-only', reason: 'encoder_unavailable' }` (`:131,172`), and `scoreAnalogyFitness` propagates that for the WHOLE call rather than partial scoring (`:219,230,235`) - it never returns a bare number on a degraded call.

**9. Proposed Theo Framework name.** None exists in `framework-names.json` for this specific scorer. It is a primitive underneath whatever framework `find-analogies` declares (Catalog B to confirm); no new Theo framework is proposed for `analogy-fitness.cjs` itself.

**10. Problem-type routing.** Not applicable on its own (a scoring primitive). Chain neighbor: upstream of `/mos:find-analogies` and inside Eureka's own `explore-chain.cjs` pattern-transfer path (Entry 1).
