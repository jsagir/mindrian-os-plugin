# Phase 156: Futures Wheel opportunity-location MVP - Research

**Researched:** 2026-06-14 (inline by orchestrator; navigator declined the subagent spawn)
**Method:** direct read of the shipped engines (file:line cited). This is an ASSEMBLE-NOT-REBUILD phase; the research maps the exact assembly seams, not new architecture.
**Consumes:** 156-SPEC.md (FW-01..FW-13), 156-CONTEXT.md (D-01..D-05).

---

## Assembly seams (the load-bearing findings)

### 1. Artifact-node registration — the HSI precondition (FW-06)
- `scripts/hsi-to-graph.cjs:69-88` only writes edges between nodes already present as `type='Artifact'` (it calls `findArtifact.get(id)` and `continue`s if either endpoint is missing). So **consequences must be Artifact nodes in room.db BEFORE the HSI scan**.
- The Artifact-node writer is `lib/core/node-insert.cjs::insertNode(conn, id, type, properties, overrides)` (line 95; exported line 122). Header comment (line 17) confirms `lib/core/lazygraph-ops.cjs::_indexArtifactBody` does the **Artifact + Section upserts** through `insertNode`.
- **Implication for the plan:** filing a consequence `.md` is NOT automatically enough — the artifact body must run through the lazygraph indexing path (`_indexArtifactBody`) OR the command must call `insertNode` directly so the consequence registers as an `Artifact` node keyed by its artifact id. This is the single highest-risk seam; a plan task must explicitly verify Artifact-node presence before invoking compute-hsi.
- `compute-hsi.py:133-172` (`discover_artifacts`) independently walks `room_dir` for `*.md` and parses frontmatter — so the consequence `.md` files must live under the room dir AND be registered as Artifact nodes. The `.md` path (compute-hsi input) and the room.db Artifact node (hsi-to-graph edge endpoint) are two registrations of the same consequence; both required.

### 2. compute-hsi.py invocation contract (FW-06)
- CLI: `python3 scripts/compute-hsi.py /path/to/room [--tier 1|2] [--threshold 0.30] [--output path]` (docstring line 16).
- Reads `room/*.md` artifacts (`discover_artifacts`, line 133), computes TF-IDF/SVD structural + embedding semantic similarity, writes `.hsi-results.json` (the `hsi_pairs` schema `hsi-to-graph.cjs:79-100` consumes: `left_id`, `right_id`, `hsi_score`, `lsa_sim`, `semantic_sim`, `surprise_type`, `breakthrough_potential`). Has its own `.hsi-cache.json` (line 188, hash-keyed).
- Tier: Tier 0 keyword is the bash analyze-room path (NOT this script); Tier 1 (LSA+MiniLM) is the default; Tier 2 adds Pinecone/Neo4j. **MVP uses Tier 1** (no external infra).
- **Ordered pipeline /mos:futures must own (D-01 guided-by-ring):** generate ring consequences -> file as `.md` under `opportunity-bank/futures-<seed>/` -> register as Artifact nodes -> `compute-hsi.py <room> --tier 1` -> `hsi-to-graph.cjs <room>` -> read back HSI_CONNECTION edges -> surface bridges at the gate.

### 3. Two edge-write paths (FW-05 vs the HSI bridges)
- **Cascade edges (ROOT_CAUSES, ENABLES):** written via the chokepoint `navigation.writeEdge(db, {source_id, target_id, edge_type, properties})` (`lib/core/navigation.cjs:103` re-exports `edges.writeEdge`; impl `lib/core/navigation/edges.cjs:339-372`). It HARD-validates `edge_type` against the frozen `ALLOWED_EDGE_TYPES` (line 350) and returns `{ok:true, edge_id,...}` or `{ok:false, reason}` — never throws. `ROOT_CAUSES` is in the frozen set (`edges.cjs:320`, added by Phase 150.8); `ENABLES` is in it. Properties ride as a JSON blob (Part 8: enum/scalar only — never consequence body text).
- **HSI bridges (HSI_CONNECTION, REVERSE_SALIENT):** these are NOT in `ALLOWED_EDGE_TYPES` (confirmed). `hsi-to-graph.cjs:61-127` writes them via **raw prepared statements** on the `edges` table (same `ON CONFLICT(source,target,type)` upsert shape as writeEdge), deliberately bypassing the frozen guard. **The plan must NOT try to route HSI edges through writeEdge (it would reject them) — invoke hsi-to-graph.cjs as-is.**
- Net: cascade edges = navigation.writeEdge; HSI edges = hsi-to-graph raw path. Both legitimate, both local.

### 4. Proposed -> confirmed (FW-10, Part 9)
- `navigation.confirmNode` (re-exported from `navigation/confirm-node.cjs`) is the human-confirm chokepoint (Phase 129.5). Consequence/opportunity truth-claim nodes land `review_status='proposed'` and only reach `confirmed` via confirmNode with a human `byUser` attribution. The per-ring batch gate (D-02) calls confirmNode on approved nodes; REJECT writes a reason edge (Part 4).
- `navigation/typed-claim.cjs::writeClaimNode` (Phase 150.8) is the typed-claim writer if consequences are modeled as claims (knowledge_type / conditions / valid_from). Open for the planner: model consequences as Artifacts (simplest, HSI-ready) vs typed claims (richer). Recommendation: **Artifacts** for HSI compatibility; attach horizon/confidence/PESTEL as frontmatter + node properties.

### 5. Opportunity banking (FW-08/FW-09)
- `lib/core/opportunity-ops.cjs::bankOpportunity(roomDir, opportunity)` (line 1123): requires `opportunity.problem` (line 1128); supports `confidence`, `evidence`; dedups by `problem_hash` (8-char prefix), updates confidence if higher, appends evidence. Writes to `opportunity-bank/`. **Provenance:** add a frontmatter field naming the source edge (HSI_CONNECTION / REVERSE_SALIENT / ROOT_CAUSES pair) — the planner extends the opportunity object shape with a `provenance` field (additive; bankOpportunity passes frontmatter through).

### 6. SIGNAL research step (FW-13)
- `lib/core/research-corpus.cjs::fetchCorpus(args)` (line 294; exported 337) with adapters: academic (line 123), Tavily (136), Brain-cypher (207 — generic handles only, sanitized line 218), sciBot (274). `SOURCES` registry (line 65).
- `lib/core/research-cache.cjs` (exported line 165): `cacheKey(source,query)`, `cachePath(roomDir,source,query)`, `getCached(roomDir,source,query,opts)`, `putCached(...)`, `isFresh(fetchedAtIso,opts)` with a TTL (`resolveTtlMs`, line 90 — the 30-day cache).
- **SIGNAL pipeline:** `getCached` -> if `!isFresh` -> `fetchCorpus({source, query: <generic domain handle>, limit})` -> `putCached`. Seed grounding (once) + per-ring (D-05). **Part 8:** query is the generic domain/concept handle, never room artifact bodies — mirrors `commands/research.md` + Phase 131 `docs/RESEARCH-AS-WORKFLOW-STEP.md`. Findings wire as typed evidence via the navigation evidence-claim path (`navigation/evidence-claim.cjs`).

### 7. Chaining-web resolver (FW-12)
- `lib/workflow/command-resolver.cjs` (exported line 148): `commandsForFramework(name)` (85), `frameworksForCommand(cmd)` (97), `composeWorkflow(frameworkChain)` (110), `validateChainAutonomy(workflow)` (131). Degrades to empty results on missing registry (no throw).
- The 8 handoffs resolve through `commandsForFramework` / `composeWorkflow` against `data/command-registry.json` (NO hardcoded command strings — FW-12 acceptance). The top-N ranked surfacing (D-04) mirrors the 150.x dial: rank candidate handoffs, surface top-3-of-N at the F.1 gate. Read `lib/hmi/reach-component-map.json` + `commands/systems-thinking.md` connector frontmatter for the established surfacing pattern.

### 8. Command + render shape (FW-01, FW-07)
- Closest analogs: `commands/systems-thinking.md` (150.10 promote-in-place F-selector move-selector with connector frontmatter: `connects_to_spine`, `sensor_triggers`, `reach_id`) and `commands/whitespace.md` (wraps Python scripts). A new `/mos:futures` command = a markdown command file (frontmatter + body) + a `lib/core/futures/*.cjs` orchestrator + connector frontmatter (Part 7 chain-not-duplicate justification in the body).
- Render (FW-07 subsystem PESTEL map, D-03 default): reuse the `skills/ui-system` De Stijl 4-zone render + Shape F.1 selector — NOT hand-rolled HTML (CLAUDE.md Dashboard Export Integrity rule). The subsystem map groups consequence artifacts by their `domain:` frontmatter; the ring view is the on-demand alternate.

### 9. Causal-cue advisory pass (FW-03)
- No ML. A new `lib/core/futures/causal-cue.cjs` with a static causal-cue lexicon (regex over "leads to", "because", "enables", "results in", "causes", "drives", "forces"). Flags each consequence cue-supported/cue-thin, adjusts displayed confidence. Reuse the frontmatter parse helper from `opportunity-ops.cjs::parseFrontmatter` (line 24) / `lib/core/node-insert` patterns. Advisory only — never auto-drops (FW-03 acceptance).

---

## Per-requirement implementation map (for the planner)

| Req | Assembles | New code |
|-----|-----------|----------|
| FW-01 | command file pattern (systems-thinking.md analog) + command-resolver | `commands/futures.md` + connector frontmatter + `lib/core/futures/orchestrator.cjs` |
| FW-02 | guided-by-ring loop; depth=3 / fan-out=5 caps | consequence generator (Larry-driven) + ring artifact writer |
| FW-03 | parseFrontmatter reuse | `lib/core/futures/causal-cue.cjs` (lexicon + flag) |
| FW-04 | frontmatter schema | horizon/confidence/domain validators |
| FW-05 | `navigation.writeEdge` (ROOT_CAUSES/ENABLES) | edge-writer calls in orchestrator |
| FW-06 | `insertNode`/`_indexArtifactBody` + `compute-hsi.py` + `hsi-to-graph.cjs` | the file->register->scan->wire sequencer |
| FW-07 | ui-system De Stijl render | subsystem-map renderer (PESTEL group) + ring view |
| FW-08/09 | `bankOpportunity` | provenance field on opportunity object |
| FW-10 | `confirmNode` + per-ring batch gate (F.1) | gate orchestration |
| FW-11 | (local-only invariant) | Part 8 boundary test |
| FW-12 | `command-resolver` + reach-component-map pattern | top-N handoff surfacer |
| FW-13 | `fetchCorpus` + research-cache + evidence-claim | seed + per-ring SIGNAL passes |

---

## Reuse-before-build (Canon Part 7)

Net-new files (all thin orchestration over shipped engines): `commands/futures.md`, `lib/core/futures/orchestrator.cjs`, `lib/core/futures/causal-cue.cjs`, `lib/core/futures/subsystem-render.cjs`. Everything else is repointed: navigation.cjs (writeEdge/confirmNode/insertNode-via-lazygraph), compute-hsi.py + hsi-to-graph.cjs, opportunity-ops.bankOpportunity, research-corpus + research-cache, command-resolver, ui-system render. The 8 chained commands are invoked, never duplicated.

## Risks / landmines

1. **Artifact-node registration gap (HIGHEST).** If consequences are filed as `.md` but never registered as `Artifact` nodes, hsi-to-graph silently writes ZERO edges (it `continue`s past missing endpoints) — a false-success. A plan task MUST assert Artifact-node count == filed-consequence count before compute-hsi.
2. **Wrong edge path.** Routing HSI_CONNECTION through writeEdge returns `{ok:false, invalid_edge_type}`. Use hsi-to-graph for HSI; writeEdge only for ROOT_CAUSES/ENABLES.
3. **Graph explosion.** Enforce depth=3 × fan-out=5 caps in the generator (FW-02) before compute-hsi (its O(n^2) pairing).
4. **Part 8 in the SIGNAL step.** fetchCorpus query must be a generic domain handle; never pass a consequence body. Adversarial egress test required (FW-11/FW-13).
5. **compute-hsi.py is Python** — Tri-Polar: CLI has python3; Desktop/Cowork may not. Confirm the existing whitespace/HSI commands' degradation path (Tier 0 keyword fallback) applies.

## Validation Architecture (Nyquist -> VALIDATION.md)

- **FW-01/07:** command-exists + render-shape assertions (file presence + frontmatter + grep for PESTEL grouping).
- **FW-02/03/04:** unit test the generator caps (depth/fan-out bound) + cue-flag output + frontmatter validators (enum/range).
- **FW-05/06:** integration test on a fixture seed: assert N consequence Artifact nodes registered, ROOT_CAUSES edges ring N-1->N via writeEdge, >=1 HSI_CONNECTION edge after compute-hsi+hsi-to-graph.
- **FW-08/09/10:** banked candidate has provenance edge ref; confirmNode promotes proposed->confirmed with byUser; REJECT writes reason edge.
- **FW-11/13:** Part 8 boundary scan (grep for fetch/brain-write with room content) returns 0; SIGNAL query carries only generic handles.
- **FW-12:** handoffs resolve via command-resolver (not hardcoded); top-N ranking surfaces <=3.

## Tri-Polar notes
- CLI: full pipeline (python compute-hsi, scripts, hooks). Desktop/Cowork: Larry orchestrates conversationally; compute-hsi may degrade to Tier 0 keyword if python3 absent — confirm the existing fallback. Render: ui-system 4-zone works across all three; subsystem map is text/De Stijl, not web-only.

## Part 8 (zero egress)
All consequence artifacts, HSI scan, cascade + HSI edges, banking, and confirmNode are LOCAL room.db + filesystem. The only external calls are FW-13 SIGNAL fetches carrying generic domain handles (public sources) — never room content. Adversarial egress test is a phase gate.

## RESEARCH COMPLETE
