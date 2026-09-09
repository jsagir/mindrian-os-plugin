# Catalog B - Intelligence Commands

Read-only inventory of MindrianOS-Plugin's INTELLIGENCE LAYER, family B, for Theo to register as known generic handles. Repo state: 2.0.0-beta.30-era `main`, captured 2026-09-09. Every fact is sourced to a file in this tree; "none found" means a search was run and came up empty, not skipped.

**Central finding.** On the MCP surface, ten of these fifteen engines (find-connections, build-thesis, compare-ventures, grade, deep-grade, leadership, whitespace, find-analogies, score-innovation, explore-domains) resolve through one shared function, `buildContext()` (`lib/mcp/tool-router.cjs:489`), which reads `commands/<name>.md` off disk and echoes it back with room state - it runs none of the scripts or agents named below. Real computation (embedding spine, HSI Python, Brain queries, subagent fan-out) fires only on the CLI/Desktop surface, where Claude Code reads the command's markdown as instructions and executes the calls itself. Three engines - intel-pipeline, explore-opportunity, grade-grant - have **zero** MCP registration (no match anywhere in `lib/mcp/tool-router.cjs`); they exist only as `/mos:` slash commands.

## Summary Table

| Engine | Command(s) | MCP tool | Model needed? | Brain touch? | Declared framework | Proposed Theo name | Founding phase(s) |
|---|---|---|---|---|---|---|---|
| find-analogies | /mos:find-analogies | `methodology` (doc-echo) | yes, local transformers | `--brain` only; `--external` audits an outbound query, never Brain | Four Lenses of Innovation | cross-domain-analogy-sapphire | 44/45 (2026-03-31); 214 (2026-07-10); 265-21 (2026-08-27) |
| whitespace | /mos:whitespace | `intelligence` (doc-echo) + standalone `whitespace_scan` | yes, Python sentence-transformers + UMAP/HDBSCAN | yes, reads + writes anonymized aggregates | HSI Semantic Surprise Analysis Assistant | whitespace-gap-density | 27.1 (2026-03-30); 60-62 (2026-04-07/08); 66 (2026-04-08) |
| find-connections | /mos:find-connections | `intelligence` (doc-echo) | no | yes, brain_concept_connect/brain_cross_domain | Usher's Model of Cumulative Synthesis | cross-domain-connect | 04-03 (2026-03-22); 260906-fda (2026-09-06) |
| build-thesis | /mos:build-thesis | `intelligence` (doc-echo) | no | indirect, via dispatched /mos:research | PWS Value Proposition | ten-questions-investment-gate | 02-04 (2026-03-22) |
| compare-ventures | /mos:compare-ventures | `intelligence` (doc-echo) | no | yes, brain_find_patterns + brain_search_semantic | PWS Triple Validation Compass | venture-pattern-compare | 04-03 (2026-03-22) |
| grade / deep-grade | /mos:grade, /mos:deep-grade | `intelligence` (doc-echo); CLI dispatches agents/grading.md | no | yes, via grading.md | PWS Triple Validation Compass | calibrated-grading-compass | 02-04/04-03 (2026-03-22); fan-out 265-23 (2026-08-27) |
| leadership | /mos:leadership | `intelligence` (doc-echo) | no | optional, skips cleanly if absent | Adaptive Leadership | adaptive-leadership-diagnosis | 02-01 (2026-03-20) |
| score-innovation | /mos:score-innovation | `methodology` (doc-echo) | yes, Python sentence-transformers | none direct | HSI Semantic Surprise Analysis Assistant | hsi-cross-domain-score | 02-04 (2026-03-22); 27.1 (2026-03-30) |
| explore-domains | /mos:explore-domains | `methodology` (doc-echo) | no | none found | Domain Selection | ika-feynman-domain-map | 02-02 (2026-03-22) |
| research | /mos:research + agents/research.md | `intelligence` (real pipeline) | no local model; live Tavily/WebSearch | yes, via agent | Hypothesis-Driven Problem Solving | dual-source-evidence-research | 04-03 (2026-03-22); 131 (2026-05) |
| intel-pipeline | /mos:intel-pipeline | none | no | indirect, via research legs | none declared | jtbd-fan-research-pipeline | 223 (2026-07-15/16) |
| opportunities / explore-opportunity | /mos:opportunities, /mos:explore-opportunity + opportunity-scanner agent | `room_content` real logic; explore-opportunity has none | no | none in allowed-tools | none declared | opportunity-bank-lifecycle | 13 (2026-03-25); 219 (2026-07-13) |
| investor (agent) | none, proactive only | none | no | yes, brain_ask/brain_search + retired pinecone-brain | none declared | adversarial-pitch-review | 144.1 (2026-06-07, connector only) |
| grade-grant / grant-reviewer | /mos:grade-grant | none | no | recommend-never-trigger, generic handles only | none declared | grant-rubric-adversarial-review | quick 260805-tnufa (2026-08-05) |
| `intelligence` tool family | (router tool itself) | `intelligence` | no | research leg only | n/a | n/a | 11 (2026-03-24); 198-06/215-04/216-02 (2026-07-10) |

---

### 1. find-analogies

Runs SAPPhIRE + TRIZ pattern-transfer against the room's problem to surface candidate matches from other fields - borrows structure instead of inventing from scratch.

- **Surfaces:** `commands/find-analogies.md`. MCP: `methodology` router (`lib/mcp/tool-router.cjs:225-230`), doc-echo. Agent `agents/analogy-query-fetcher.md` (dispatched only inside `--external`'s per-query fan-out; never composes a query, never touches Brain). Script `scripts/analogy-fitness-report.cjs`.
- **Core modules:** `lib/core/eureka/analogy-fitness.cjs` (measured two-leg fitness: text cosine + SAPPhIRE-field cosine; pure, zero DB/network). `lib/core/eureka/online-pattern-query.cjs:101` `composePatternQueries` (Part-8-audited outbound composer). `scripts/analogy-fitness-report.cjs:133` `runScore`, `:243` `main`.
- **Phases:** 44/45 (`.planning/phases/44-design-by-analogy-foundation/44-01-SUMMARY.md`, `45-design-by-analogy-pipeline/45-01-SUMMARY.md`), completed 2026-03-31: TRIZ/SAPPhIRE encoding + the command itself, shipped. 214 (`214-eureka-pattern-transfer.../214-0{1-4}-SUMMARY.md`), completed 2026-07-10: retired fabricated-fitness score, shipped measured fusion, shipped. Quick 265-21, ratified 2026-08-27 (`data/subagent-dispatch-grants.json`): `--external` per-query Task fan-out, capped at 5, shipped.
- **I/O:** reads problem-definition context + `references/methodology/sapphire-encoding.md`. Default mode is LLM reasoning with an honest qualitative band label if the measured engine did not run (`commands/find-analogies.md:152`). Writes `room/**/analogies/*`.
- **Registry:** `kind: methodology`, `frameworks: ["Four Lenses of Innovation"]`, `autonomous_safe: true`, `body_shape: "D"`, `jtbd_label: "Connect Domains"`. Projection: `reach_id: context_block`, `sub_mode: cross-domain-analogy`, `hierarchy_rank: 1`, `posture: hold`; `sensor_triggers: [SENS-01]`, `web_scope: green`.
- **Brain/Theo:** no `brain-client.cjs` in the fitness path. `--brain` mode's allowed-tools still names the pre-Theo-cutover server id `mindrian-brain`, not `theo`. `--external`'s composer never calls Brain - only abstracted SAPPhIRE/TRIZ vocabulary crosses outbound, audited by `auditQueryString` (`lib/core/rs-egress-prompts.cjs`).
- **Local deps:** yes, local embedding spine `lib/core/eureka/embedding-spine.cjs` (`@huggingface/transformers`/ONNX, `MongoDB/mdbr-leaf-ir`, zero egress). Degrade: `embedTexts` (`:456`) returns `{success:false, error:'encoder_unavailable'}` (`:365`, `:394`) rather than throwing.
- **Theo name:** `"Four Lenses of Innovation"` already fits (`data/framework-names.json:31`). Add a technique-level handle `cross-domain-analogy-sapphire` for the measured-fitness move.
- **Routing:** not in `references/methodology/problem-types.md`. Inferred Ill-Defined x Complex from `hitl_shape: F.8`. `curated_chains`: Four Lenses -> S-Curve Analysis (0.66). Neighbor: `/mos:whitespace`.

### 2. whitespace

Scores every room artifact against every other to find under-explored zones. Three surfaces share the name: the CLI pipeline (Python HSI + UMAP/HDBSCAN, writes to Brain), the MCP `whitespace_scan` tool (pure local SQL gap query, unrelated mechanism), and the non-contract Brain tool `find_whitespace` (a MAGE algorithm this repo never calls directly).

- **Surfaces:** `commands/whitespace.md`, 7 subcommands. MCP: `intelligence` router, doc-echo - distinct from standalone `whitespace_scan` (`lib/mcp/tools/sensors.cjs:290-318`, reads `navigation.findOpenQuestions`/`findUnsupportedClaims` from local SQLite only). Scripts: `scripts/whitespace-command.cjs` + `compute-whitespace-{embeddings,gaps,external}.py`, `discover-{hsi,analogy,rs}-whitespace.py`, `interpret-whitespace.cjs`, `whitespace-to-{brain,graph}.cjs`, `write-whitespace-sections.cjs`, `query-semantic-scholar.cjs`.
- **Core modules:** `scripts/whitespace-command.cjs`: `cmdMap` (:125), `cmdAnalyze` (:208), `cmdHypothesis` (:298), `cmdTree` (:369), `cmdScore` (:483), `cmdExternal` (:530, also queries Semantic Scholar), `cmdDiscover` (:668), `main` (:765). `scripts/ensure-brain-baseline.cjs:53` `ensureBrainBaseline`, graceful `{ensured:false}`.
- **Phases:** 27.1 (`27.1-hsi-reverse-salient.../27.1-02-SUMMARY.md`, 2026-03-30): HSI Python pipeline, shipped. 60/61/62 (`60-embedding-infrastructure/60-02-SUMMARY.md`, `61-novelty-scoring.../61-02-SUMMARY.md`, `62-interpretation-layer/62-02-SUMMARY.md`, 2026-04-07/08): embeddings, gap detection, interpretation, shipped. 66 (`66-command-visualization.../66-03-SUMMARY.md`, 2026-04-08): the `/mos:whitespace` command itself, shipped. 198-06, 2026-07-10: `whitespace_scan` pulled onto MCP, shipped.
- **I/O:** reads `room/**/*.md`, `.mindrian/brain-baseline.json`. Writes `.mindrian/whitespace-{embeddings,results}.json`, `room/opportunity-bank/whitespace/*`. `whitespace_scan` reads room SQLite only, returns `{open_questions, unsupported_claims, gap_count}`, writes nothing.
- **Registry:** `kind: methodology`, `frameworks: ["HSI Semantic Surprise Analysis Assistant"]`, `autonomous_safe: true`, `jtbd_label: "Connect Domains"`. Projection: `sub_mode: whitespace`, `hierarchy_rank: 3`, `posture: hold`; `sensor_triggers: [SENS-06]`.
- **Brain/Theo:** genuine LOCAL -> BRAIN egress, unlike most of this catalog. `ensureBrainBaseline` reads a baseline, degrades to "Brain offline" logged. `scripts/whitespace-to-brain.cjs` (header) writes anonymized `WhitespaceZone` nodes + edges - never room name/path, only `problem_type`/`framework_chain`/`density_score`/`strategic_rank`/hypothesis text; fire-and-forget, never throws. `find_whitespace` is live, non-contract, in `data/brain-surface-contract.json` and the Theo tool list; no code here calls it by name.
- **Local deps:** yes, `requirements-whitespace.txt`: scikit-learn, numpy, sentence-transformers, umap-learn, hdbscan, scipy, auto-installed via `ensure_ml_deps`. No confirmed soft-fail branch found in `compute-whitespace-*.py` - "none found."
- **Theo name:** `"HSI Semantic Surprise Analysis Assistant"` already fits (`data/framework-names.json:36`), shared with `/mos:diagnostics`/`/mos:score-innovation` per `framework_index` - one handle, not three. Add `room-coverage-gap-scan` for the MCP-only tool.
- **Routing:** not in the shipped table; its own sample output spans all three definition levels in one run (`commands/whitespace.md:152-156`) - inherently cross-cutting. Neighbors: `/mos:score-innovation`, `/mos:diagnostics`.

### 3. find-connections

Traces cross-domain links through the Brain graph - the aha-moment command.

- **Surfaces:** `commands/find-connections.md`. MCP: `intelligence` router, doc-echo. No agent or script.
- **Core modules:** none - pure conversational. Reads `references/brain/query-patterns.md` for two named Cypher templates, `brain_concept_connect`/`brain_cross_domain` (`commands/find-connections.md:58-88`), calls them directly.
- **Phases:** 04-03 (`04-brain-mcp-toolbox/04-03-SUMMARY.md`, 2026-03-22): shipped with compare-ventures/deep-grade/research as "5 new Brain-powered commands." 143.3/144.1, both 2026-06-07: retrofitted the `connector:` block. Quick 260906-fda, 2026-09-06 (`.planning/STATE.md:6996`): fixed a live defect where Part 8's egress guard gated real `find_connections` calls `ambiguous`; added `known_tool_shape` (`lib/core/part8-egress-guard.cjs:420-427`), shipped, verified live.
- **I/O:** reads room state, a concept/domain pair. Calls `brain_concept_connect($concept)`, then `brain_cross_domain($domain_a,$domain_b)` for two domains. Writes `room/**/analogies/*`.
- **Registry:** `kind: methodology`, `frameworks: ["Usher's Model of Cumulative Synthesis"]`, `autonomous_safe: true`, `jtbd_label: "Connect Domains"`. Projection: `reach_id: brain_consult`, `sub_mode: cross-domain-connect`, `hierarchy_rank: 1`, `posture: hold`; `sensor_triggers: [SENS-01]`.
- **Brain/Theo:** direct - both calls carry only concept/domain labels, matching the Part 8 `known_tool_shape` recognizer (`{from,to}` pairs only). Allowed-tools still names the pre-cutover `mindrian-brain` server id (Theo cutover: Phase 339, 2026-09-03, `lib/core/brain-client.cjs:24`) - not yet re-pointed.
- **Local deps:** none found.
- **Theo name:** `"Usher's Model of Cumulative Synthesis"` already fits (`data/framework-names.json:105`), `framework_index` maps it 1:1.
- **Routing:** not in the shipped table; inferred Undefined-to-Ill-Defined x Complex. Neighbors (`commands/find-connections.md:97-103`): `/mos:structure-argument`, `/mos:explore-trends`, `/mos:root-cause`, `/mos:explore-domains`.

### 4. build-thesis

Runs the Ten-Questions binary gate (6/10 to proceed) plus a Deep Dive across six adversarial categories, ending in a GO/NO-GO/CONDITIONAL verdict.

- **Surfaces:** `commands/build-thesis.md`. MCP: `intelligence` router, doc-echo. No agent or script.
- **Core modules:** none - conversational. `requires_evidence: {tier: Academic, on: [financial-model, business-model], dispatch: /mos:research}` is the one wired escape hatch.
- **Phases:** 02-04 (`02-core-methodologies/02-04-SUMMARY.md`, 2026-03-22): "grade and build-thesis Tier 5 commands with P0 constraints," shipped.
- **I/O:** reads `references/methodology/build-thesis.md`, `room/STATE.md`, financial-model/business-model sections. Writes `room/**/thesis/*`.
- **Registry:** `kind: methodology`, `frameworks: ["PWS Value Proposition"]`, `autonomous_safe: true`, `jtbd_label: "Decide Pursue"`. Projection: `sub_mode: thesis-build`, `hierarchy_rank: 9`, `posture: hold`; `sensor_triggers: [SENS-07,SENS-06]`, `hitl_shape: F.9` (the one ordered-walk shape in this catalog).
- **Brain/Theo:** none direct - only indirect via a dispatched `/mos:research`.
- **Local deps:** none found.
- **Theo name:** `"PWS Value Proposition"` already fits; `framework_index` shares it with `/mos:validate-proposition`, one handle.
- **Routing:** not in the shipped table; `F.9` + `requires_evidence.tier: Academic` implies Well-Defined x Complicated. Neighbor: `pipelines/thesis/CHAIN.md` (structure-argument -> challenge-assumptions -> build-thesis).

### 5. compare-ventures

Lines the current venture up against ventures that tried something similar before, scored on the dimensions that matter.

- **Surfaces:** `commands/compare-ventures.md`. MCP: `intelligence` router, doc-echo. No agent or script.
- **Core modules:** none found. Calls `brain_find_patterns($current_frameworks)`, then `brain_search_semantic` via `brain_search` (falls back to `read_neo4j_cypher` on `RESOURCE_EXHAUSTED`) (`commands/compare-ventures.md:74-88`).
- **Phases:** 04-03, 2026-03-22: shipped in the same batch as find-connections/deep-grade/research; SUMMARY notes "aggregate patterns only, no individual student data."
- **I/O:** reads venture description + `$current_frameworks`. Writes `room/competitive-analysis/comparison/*`.
- **Registry:** `kind: methodology`, `frameworks: ["PWS Triple Validation Compass"]`, `autonomous_safe: true`, `jtbd_label: "Compare Options"`. Projection: `reach_id: brain_consult`, `sub_mode: venture-compare`, `hierarchy_rank: 19`, `posture: hold`; `sensor_triggers: [SENS-03]`, `filing: memory_event_only`.
- **Brain/Theo:** direct - both calls carry a venture description as free text, a genuine Part 8 edge case mitigated only by the command's own Privacy Rules step (presentation discipline, not a wire-level filter - "none found" for a code-level guard).
- **Local deps:** none found.
- **Theo name:** `"PWS Triple Validation Compass"` already fits, shared with grade/deep-grade.
- **Routing:** not in the shipped table; `hitl_shape: F.5` suggests Well-Defined x Complicated. Neighbors per `framework_index`: `/mos:deep-grade`, `/mos:grade`.

### 6. grade / deep-grade

`/mos:grade` scores problem-discovery on six components fast; `/mos:deep-grade` runs the same rubric Brain-enriched against 100+ calibrated projects, one subagent per component.

- **Surfaces:** `commands/grade.md`, `commands/deep-grade.md`. MCP: `intelligence` router, doc-echo on MCP only - CLI/Desktop additionally dispatches `agents/grading.md` via Agent/Task, which the MCP handler structurally cannot do. Script `scripts/compute-hsi.py` is grade's P0 mandatory HSI cross-check.
- **Core modules:** `agents/grading.md` (the calibrated-assessment engine both delegate to). `lib/core/model-profiles.cjs` (model resolution pre-dispatch).
- **Phases:** 02-04, 2026-03-22: `/mos:grade` shipped, 6-component weighted scoring. 04-03, 2026-03-22: `/mos:deep-grade` shipped, "thin command + agent delegation pattern." Fan-out ratified 2026-08-27 (`data/subagent-dispatch-grants.json`, `ratified_in: "265-23"`): grade `--full` grants one Task subagent per canonical section (cap 8); deep-grade grants one Agent subagent per rubric-category batch (cap 5).
- **I/O:** reads populated room sections (grade: 1+; deep-grade: 3+). Writes `room/**/grades/*` and `room/**/deep-grades/*`.
- **Registry:** both `kind: methodology`, `frameworks: ["PWS Triple Validation Compass"]`, `autonomous_safe: true`, `body_shape: "C"`, `jtbd_label: "Audit Room"`. Projection: grade `sub_mode: grade-compass` (rank 14); deep-grade `sub_mode: deep-grade-compass` (rank 8); both `posture: hold`, `sensor_triggers: [SENS-06,SENS-07]`.
- **Brain/Theo:** via `agents/grading.md` only (not the command bodies, not MCP): allowed-tools grants `brain_ask`/`brain_search`; `reach_id: brain_consult`, `sub_mode: grading-agent`, rank 46. No Brain-unreachable degrade text found - "none found."
- **Local deps:** `grade` calls `scripts/compute-hsi.py` (engine 8) as a P0 mandatory cross-check, not optional.
- **Theo name:** `"PWS Triple Validation Compass"` already fits, shared across compare-ventures/deep-grade/grade, one handle.
- **Routing:** not in the shipped table; `F.8` on both implies Well-Defined x Complicated. Chain: grade -> deep-grade -> room analyze.

### 7. leadership

Diagnoses which leadership pattern (Heifetz's Adaptive Leadership) a venture's stage needs.

- **Surfaces:** `commands/leadership.md`. MCP: `intelligence` router, doc-echo. No agent or script; turn-based conversational coaching.
- **Core modules:** none found - framework-file-driven only (`references/methodology/leadership.md`).
- **Phases:** 02-01 (`02-core-methodologies/02-01-SUMMARY.md`, 2026-03-20): shipped with beautiful-question/map-unknowns/challenge-assumptions/analyze-systems/lean-canvas/systems-thinking, shipped.
- **I/O:** reads team-execution data. Writes `room/team-execution/leadership/*`.
- **Registry:** `kind: methodology`, `frameworks: ["Adaptive Leadership"]`, `autonomous_safe: true`, `jtbd_label: "Explore"`. Projection: `sub_mode: adaptive-leadership`, `hierarchy_rank: 20`, `posture: hold`; `sensor_triggers: [SENS-05]`, `hitl_shape: F.1` (single next-move read).
- **Brain/Theo:** optional, clearly gated - "if Brain MCP tools are not available, skip this section entirely" (`commands/leadership.md:107-108`); queries the leadership FEEDS_INTO chain, surfaces CONTRADICTS-shaped tension across sections.
- **Local deps:** none found.
- **Theo name:** `"Adaptive Leadership"` already fits (`data/framework-names.json:2`), `framework_index` maps it 1:1.
- **Routing:** IS in the shipped table: Ill-Defined x Wicked ("think-hats, leadership") - one of only two Catalog B commands the canonical table places (the other is explore-domains). Neighbor: `/mos:challenge-assumptions`.

### 8. score-innovation

Runs HSI (Hybrid Similarity Index) scoring to rank cross-domain innovation candidates by semantic surprise - the math check on whether an idea is actually novel.

- **Surfaces:** `commands/score-innovation.md`. MCP: `methodology` router, doc-echo. Script `scripts/compute-hsi.py` (shared with grade's P0 check and `/mos:act`/`/mos:mos-reason`'s HSI recomputation cascade).
- **Core modules:** `scripts/compute-hsi.py` (947 lines): `compute_lsa_similarity` (:324), `compute_semantic_similarity_tier1` (:350, MiniLM, CPU default), `compute_semantic_similarity_tier2` (:363, Pinecone fallback), `compute_spectral_gap`/`compute_omhmm_score` (:458-650, spectral Markov-chain scoring, v1.6.0).
- **Phases:** 02-04, 2026-03-22 (git `84c2dcc1`): shipped conversational-only Tier 0, SUMMARY notes "HSI is conversational only for Tier 0." 27.1, 2026-03-30: the actual `compute-hsi.py` quantitative pipeline, shipped, closing the gap 02-04 flagged.
- **I/O:** reads `room/*.md` corpus. Writes `.hsi-results.json`, `room/opportunity-bank/hsi-scores/*`.
- **Registry:** `kind: methodology`, `frameworks: ["HSI Semantic Surprise Analysis Assistant"]`, `autonomous_safe: true`, `jtbd_label: "Compare Options"`. Projection: `sub_mode: hsi`, `hierarchy_rank: 3`, `posture: hold`; `sensor_triggers: [SENS-06]`.
- **Brain/Theo:** none found directly. Tier 2 can use Pinecone "if configured" (:363-375), and Pinecone is RETIRED at the stack level (project `CLAUDE.md`) - dead fallback.
- **Local deps:** yes, `sentence-transformers` (Tier 1, auto-installed via `ensure_ml_deps.ensure([...])`, `:38-44`). The file's own comment (:38-42) notes this hard-fails once the Tier 2 Pinecone fallback also misses - a real, unmitigated gap since Pinecone is retired.
- **Theo name:** `"HSI Semantic Surprise Analysis Assistant"` already fits (see engine 2).
- **Routing:** not in the shipped table; grouped with `/mos:whitespace`/`/mos:diagnostics` per `framework_index`. `serves_jtbd: ["compare-options","validate-idea"]` implies Well-Defined x Complicated.

### 9. explore-domains

Maps a problem's territory across candidate domains via IKA scoring and Feynman decomposition, surfacing intersectional collisions.

- **Surfaces:** `commands/explore-domains.md`. MCP: `methodology` router, doc-echo. No agent or script.
- **Core modules:** none found - conversational, framework-file-driven.
- **Phases:** 02-02 (`02-core-methodologies/02-02-SUMMARY.md`, 2026-03-22): shipped with structure-argument/think-hats/analyze-needs, shipped. Phase 117 "auto-explore-domains-on-first-material" (dir name confirms a later auto-fire wiring; not independently re-verified beyond the directory name).
- **I/O:** reads problem-definition context. Writes `room/problem-definition/domain-decomposition/*`.
- **Registry:** `kind: methodology`, `frameworks: ["Domain Selection"]`, `autonomous_safe: true`, `jtbd_label: "Find Problem"`. Projection: `sub_mode: domain-select`, `hierarchy_rank: 34`, `posture: hold`; `sensor_triggers: [SENS-01]`.
- **Brain/Theo:** none found.
- **Local deps:** none found.
- **Theo name:** `"Domain Selection"` already fits (`data/framework-names.json:20`), `framework_index` maps it 1:1.
- **Routing:** IS in the shipped table: Undefined x Complicated ("explore-domains, build-knowledge"). Neighbor per `curated_chains`: Domain Selection -> Scenario Planning (0.68).

### 10. research

Runs a dual-source research pass: fresh web evidence cross-referenced against the Brain graph, extracting room context first, match-scoring findings against existing claims, wiring accepted findings as typed `EvidenceClaim` nodes.

- **Surfaces:** `commands/research.md`. MCP: `intelligence` router - the ONE command here with a real pipeline instead of doc-echo (`runResearchPipeline`, `lib/mcp/tool-router.cjs:529-589`, wired because doc-echo was a documented bug, "intern-w1-research-reach-broken"). Agent `agents/research.md`.
- **Core modules:** `lib/core/research-context-extractor.cjs:253` `extractContext`. `lib/lens-engine/source-lens-driver.cjs` `runSourceLens`. `lib/core/research-filing-selector.cjs:82` `buildFilingSelector` (human-gated, filing never automatic). `lib/core/findings-wirer.cjs`: `wireAccept` (:133), `wireReject` (:261), `wireDefer` (:338).
- **Phases:** 04-03, 2026-03-22: original command + `agents/research.md`, "thin command + agent delegation pattern," shipped. 89.2 "external-research-fetching" (dir name only, not independently re-verified). 131 "research-as-graph-aware-workflow" (6 plans, dir appears across all research-module greps, dates not individually re-extracted): wired the context-extractor/source-lens/filing-selector/findings-wirer pipeline per the command's own reference list.
- **I/O:** reads room state, active JTBD, existing claim graph. Fetches Tavily/WebSearch. Writes (after human filing decision only): typed `EvidenceClaim` nodes, `room/**/research/*`.
- **Registry:** `kind: methodology`, `frameworks: ["Hypothesis-Driven Problem Solving"]`, `autonomous_safe: true`, `body_shape: "C"`, `emits_evidence_claims: true`. Projection: `reach_id: deep_research`, `sub_mode: hat-scoped-research`, `hierarchy_rank: 6`, `posture: hold`; `sensor_triggers: [SENS-04,SENS-15]`, `plan_gated: true`.
- **Brain/Theo:** not the command body directly. `agents/research.md` grants `brain_ask`/`brain_search` plus retired `mcp__pinecone-brain__search-records` (same stale tool as `investor.md`). `reach_id: deep_research`, `sub_mode: research-agent`, `posture: push_forward`, rank 49.
- **Local deps:** no local embedding model found in this command's own pipeline.
- **Theo name:** `"Hypothesis-Driven Problem Solving"` already fits (`data/framework-names.json:37`), `framework_index` maps it 1:1.
- **Routing:** not in the shipped table; `plan_gated: true` + `emits_evidence_claims` implies it feeds every definition level rather than owning one cell - `requires_evidence:` on build-thesis/find-analogies/explore-opportunity confirms it as a universal upstream neighbor.

### 11. intel-pipeline

Reads the room's active JTBD, breaks it into research dimensions, fans out evidence passes, scores them, closes the loop into the graph - three navigator-approved gates.

- **Surfaces:** `commands/intel-pipeline.md` only - **no MCP tool registration found anywhere** (zero matches for "intel-pipeline" in `lib/mcp/tool-router.cjs`). Invisible to Desktop/Cowork via any router tool.
- **Core modules:** `lib/core/intel-pipeline.cjs:285` `runIntelPipeline`, `:159` `defaultBankRollup`, `:169` `readCalibrateEvidence`, `:182` `dimensionsForJtbd`, `:231` `rosterToCells`. `lib/core/rs-differential-scorer.cjs` (evidence scoring, shared with reverse-salient). `scripts/eureka-room-report.cjs`.
- **Phases:** 223, 4+ plans, completed 2026-07-15/16 (`223-jtbd-driven.../223-0{1,2,3}-SUMMARY.md` 07-15; `223-04-SUMMARY.md` 07-16; git `b481dd5f`, "born-wire /mos:intel-pipeline meta surface"), shipped.
- **I/O:** reads active JTBD, existing evidence. Writes nothing without all three navigator gates (calibrate F.1, fan-approve F.1, synthesize F.5) approved.
- **Registry:** `kind: meta`, `frameworks: []`, `produces: null`, `autonomous_safe: false`, `jtbd_label: "Plan Execution"`. Projection: `reach_id: context_block` (shared with `/mos:act`, documented as deliberate, not a 7th reach), `sub_mode: intel-pipeline`, `hierarchy_rank: 55`, `posture: hold`.
- **Brain/Theo:** none direct in `lib/core/intel-pipeline.cjs` - allowed-tools grants `brain_ask`/`brain_search` at frontmatter level, no `brain-client.cjs` require inside the core module; contact is indirect, via whichever research legs the fan dispatches.
- **Local deps:** none found.
- **Theo name:** no declared framework. Propose `jtbd-fan-research-pipeline` - a meta-orchestrator over other frameworks' evidence, not itself a methodology.
- **Routing:** not in the shipped table, no framework to check. `serves_jtbd: ["plan-execution"]` + `autonomous_safe: false` implies Well-Defined x Complicated. Neighbor: `/mos:act` (shares `context_block`).

### 12. opportunities / explore-opportunity / opportunity-scanner

`/mos:opportunities` manages the Opportunity Bank as a live pipeline. `/mos:explore-opportunity` turns one qualified opportunity into a deep-researched, Minto-shaped artifact (4 legs: web evidence, timing, analogies, demand validation). `agents/opportunity-scanner.md` is a description-triggered proactive scanner.

- **Surfaces:** `commands/opportunities.md`, `commands/explore-opportunity.md`. MCP: `opportunities`'s verbs (`scan-opportunities`, `list-opportunities`, `file-opportunity`) are real, wired handlers on `room_content` (`lib/mcp/tool-router.cjs:818-828`) - `scan-opportunities` calls `lib/core/opportunity-ops.cjs:556` `scanOpportunities` for real. `explore-opportunity` has **no MCP registration found anywhere** - CLI-only, same pattern as intel-pipeline/grade-grant. Agent `agents/opportunity-scanner.md`.
- **Core modules:** `lib/core/opportunity-ops.cjs` (12 base exports: grant discovery, CLI+MCP commands). `lib/core/eureka/explore-chain.cjs:558` `exploreOpportunity`, `:392` `runAnalysisLegsParallel` (the four-leg fan). `lib/core/chain-executor.cjs` + `lib/workflow/command-resolver.cjs` (shared chain plumbing).
- **Phases:** 13, 3 plans, completed 2026-03-25 (`13-opportunity-bank.../13-0{1,2,3}-SUMMARY.md`; git `e4b5cc1a`, "add CLI commands, MCP tools, and opportunity-scanner agent"), shipped. Phases 71/72 (dir names only, later enrichment, not independently re-verified). 219, 5 plans, completed 2026-07-13 (`219-opportunity-follow-through.../219-0{2,3,5}-SUMMARY.md`; git `9d7b74a8`, "born-wired explore-opportunity F.1 surface"), shipped.
- **I/O:** `opportunities` reads live Grants.gov/Simpler Grants results matched against room domain/geography/stage; writes `room/opportunity-bank/*`, logs rejections to `opportunity-bank/STATE.md`. `explore-opportunity` reads a qualified opportunity node; writes a Minto-shaped artifact (no `produces:` path declared - `null`).
- **Registry:** `opportunities`: `kind: utility`, `frameworks: []`, `autonomous_safe: false`, `posture: push_forward`. `explore-opportunity`: `kind: utility`, `hitl_shape: F.1`. Both `jtbd_label: "Explore"`. Projection: `opportunities` `reach_id: context_block`, rank 13; `explore-opportunity` `reach_id: deep_research`, rank 5, `plan_gated: true`, `web_scope: green`.
- **Brain/Theo:** none found in either command's allowed-tools or in `opportunity-ops.cjs`/`explore-chain.cjs`. `opportunity-scanner.md` grants only `WebSearch`/`tavily-search`/`tavily-extract` - no Brain tool at all; this family is Brain-blind by design.
- **Local deps:** none found - live Grants.gov/Simpler Grants + Tavily, no local model.
- **Theo name:** no declared framework. Propose `opportunity-bank-lifecycle` (scan/qualify/file) and `explored-stage-evidence-chain` (the four-leg fan) as two distinct handles.
- **Routing:** not in the shipped table, no framework to check. Inferred: `opportunities` Undefined x Simple; `explore-opportunity` Ill-Defined x Complicated ("a connection without a defined problem" per its own teaching line). Chain: opportunities -> explore-opportunity -> build-thesis. `opportunities.md`'s own Agent grant records `fan_bound: "not established; no fan-out instruction exists to bound"` - a gap the ledger flags itself.

### 13. investor (agent)

An adversarial reviewer that "has seen 1000 pitches and most of them failed" - surfaces investor objections before a real investor does.

- **Surfaces:** no `/mos:` command - `agents/investor.md` only, description-triggered. No MCP tool. **No explicit dispatch site found anywhere**: zero matches for `agents/investor.md` or a matching `subagent_type` across `commands/*.md` and `pipelines/*/CHAIN.md`. Even `pipelines/thesis/CHAIN.md`, whose description mentions "investors," has only 3 stages (structure-argument -> challenge-assumptions -> build-thesis) and excludes this agent.
- **Core modules:** none - this IS the module, no separate `.cjs` engine.
- **Phases:** connector-registered at 144.1, completed 2026-06-07 (`144.1-connector-retrofit-sweep/144.1-02-SUMMARY.md` matched this agent's keyword), shipped as a connector-spine entry. No founding SUMMARY for when `agents/investor.md` was first authored - "none found."
- **I/O:** reads room state, pitch/thesis content. Writes nothing (`filing: none`).
- **Registry:** not a `/mos:` command, no `data/command-registry.json` entry - "none found." Frontmatter connector: `reach_id: contradiction`, `sub_mode: investor-agent`, `framework: null`, `posture: pull_back` (the only `pull_back` posture in this catalog), `hierarchy_rank: 47`, `hitl_shape: F.1`.
- **Brain/Theo:** yes - allowed-tools grants `brain_ask`/`brain_search` plus `mcp__pinecone-brain__search-records`. Pinecone is RETIRED at the stack level (project `CLAUDE.md`) - stale, same pattern as `agents/research.md`.
- **Local deps:** none found beyond the stale Pinecone reference above.
- **Theo name:** no declared framework. Propose `adversarial-pitch-review`.
- **Routing:** not in the shipped table, no framework to check. `pull_back` + `contradiction` implies Well-Defined x Complicated activation only. Neighbor: build-thesis/challenge-assumptions, though neither currently dispatches it.

### 14. grade-grant / grant-reviewer

Grades a grant application (Tnufa first, Israel Innovation Authority) against a real local rubric before submission. Optional Reviewer-panel mode runs seven category-specific adversarial reviewers via the BONO debate engine, then consolidates a ruling.

- **Surfaces:** `commands/grade-grant.md` only - **no MCP tool registration found anywhere**, same CLI-only pattern as intel-pipeline/explore-opportunity. Agent `agents/grant-reviewer.md`, dispatched per category cell from `commands/grade-grant.md:183`, batched at `FUTURES_FANOUT_CAP` (5+2 for 7 categories) - not present in the 11-entry `data/subagent-dispatch-grants.json` ledger.
- **Core modules:** `lib/core/eureka/grade-grant.cjs`: `listPrograms` (:118), `loadRubric` (:154), `scoreApplication` (:227), `gapCategories` (:282), `buildRoadmap` (:360), `writeGradingResult` (:478). `lib/core/eureka/grade-grant-examine.cjs`: `buildReviewerSlots` (:116), `runReviewerFanout` (:217), `consolidatePanel` (:410), `buildReviewerDebateOptions` (:434). `lib/core/bono/{cell-fanout,debate-composition,hat-governance,reviewer-governance}.cjs`.
- **Phases:** quick 260805-tnufa, shipped 2026-08-05 (git `e32b18ad`) - not a numbered GSD phase. 164 "bono-research-debate-engine", completed 2026-06-19 (`164-.../164-03-SUMMARY.md`): built the BONO machinery this command reuses, shipped prior. 275, completed 2026-09-04, touched `grade-grant.cjs` in a later sweep - cited because it matched, not independently verified as a ship event here.
- **I/O:** reads a populated room, a pasted draft, or a finished application. Writes `room/**/grades/*`. `askBrainForCoaching` (`:297-315`) is an explicit "recommend-never-trigger" stub - returns `brain_available: false` and generic handles only, "never applicant prose"; its comment states any real Brain consult fires from the host command.
- **Registry:** `kind: methodology`, `frameworks: []`, `autonomous_safe: true`, `jtbd_label: "Prepare Pitch"`. Projection: `reach_id: context_block`, `sub_mode: grade-grant`, `hierarchy_rank: 14`, `posture: hold`; 3 `hitl_stages`. `grant-reviewer.md` shares `reach_id: context_block` (a sibling dispatch target, not a 7th reach), `sub_mode: grant-reviewer`, rank 51, `web_scope: null` (local room/draft only).
- **Brain/Theo:** generic-handle-only, recommend-never-trigger - the cleanest Part 8 example in this catalog: it never composes the outbound call itself.
- **Local deps:** none found - rubric-matching + BONO debate simulation only.
- **Theo name:** no declared framework. Propose `grant-rubric-adversarial-review`, distinct from the BONO engine itself (reusable infra, not a framework name).
- **Routing:** not in the shipped table, no framework to check. Single-pass is Well-Defined x Complicated; panel mode adds a Wicked dimension. Neighbors: build-thesis, the BONO engine's Phase 164 lineage.

### 15. `intelligence` MCP tool family (as a whole)

One of 9 hierarchical MCP router tools (`lib/mcp/tool-router.cjs:1-26`) that collapses 8 CLI commands (find-connections, build-thesis, compare-ventures, research, deep-grade, grade, leadership, whitespace) plus 3 eureka portfolio-scan compute subcommands into one `z.enum`-dispatched tool, under a ~7000-token budget instead of 64 flat tools.

- **Surfaces:** MCP tool `intelligence` (`lib/mcp/tool-router.cjs:1268-1413`). No `/mos:` command of its own - pure plumbing over engines 2-7 and 10 above.
- **Core modules:** `buildContext` (`:489-500`, doc-echo shared by 7 of 8 routed commands). `runResearchPipeline` (`:529-589`, engine 10's real pipeline). The eureka branch (`:1285-1387`): `_eurekaScanInFlight` (`:92`), `eurekaPaths` (`:264-272`), lazy in-process require on HTTP transport or a detached spawn on stdio transport (protects the JSON-RPC channel).
- **Phases:** 11, 2026-03-24 (git `d42e5c2c`): the MCP server itself, predates the 9-tool split, shipped. 04-03, 2026-03-22: first Brain-powered routed commands, shipped. 198-06, 2026-07-10 (git `41c91565`): `whitespace_scan`/`contradiction_check`/`framework_run` landed as SEPARATE tools, not inside `intelligence`, shipped. 215-04 and 216-02, both 2026-07-10 (git `a5f9bd64`, `8a318b1d`): the eureka compute triple, shipped.
- **I/O:** per routed command, see engines 2-7 and 10. Every response appends a `## Suggested Next` block for LLM-chained pipelining ("MCP-05" per the file header).
- **Registry:** not itself a `/mos:` command - the 8 routed sub-commands each have their own registry entry, cataloged above.
- **Brain/Theo:** only through `research`'s real pipeline (engine 10) and, at the CLI-agent layer, `grading.md`/`research.md`. This tool's own dispatch code (`:1268-1413`) has no `brain-client.cjs` require.
- **Local deps:** the eureka branch requires `scripts/eureka-command.cjs` -> `eureka-portfolio-report.cjs` -> `lib/core/eureka/embedding-spine.cjs` (same spine as find-analogies) - consistent with this phase directory's own prelude (`342-FINDINGS.md`: "Eureka is 100 percent LOCAL... Zero brain-client requires under lib/core/eureka/ or scripts/eureka*.cjs").
- **Theo name:** not a framework - propose Theo carry this as a routing fact: the 8 `intelligence`-routed commands return their reference doc verbatim on MCP; real computation runs only on CLI/Desktop. A Theo chain assuming MCP-surface `deep-grade` dispatched `grading.md` would be wrong.
- **Routing:** N/A - plumbing, not a methodology. Route by the 8 routed commands' individual problem types (engines 2-7, 10), not this tool's.
