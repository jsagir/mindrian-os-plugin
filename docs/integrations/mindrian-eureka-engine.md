# MindrianOS ↔ Eureka local graph engine

MindrianOS owns the canonical room graph, authorization, source resolution, review, and persistence. Eureka engines receive only a MindrianOS-selected projection and return analysis; they do not open `room.db` or write accepted knowledge.

## System boundary

The local graph is part of MindrianOS. It is the authoritative, room-scoped knowledge substrate that the engines work against; it is not an Eureka-owned graph and is not a second graph that must be synchronized.

```text
MindrianOS local graph
  ├─ resolves room, node identity, evidence, permissions, and accepted state
  └─ creates a bounded, versioned projection
          ↓
Eureka engine(s)
  ├─ analyze the supplied snapshot using their specialized methods
  └─ return findings, uncertainty, and candidate relationships with lineage
          ↓
MindrianOS
  ├─ resolves cited references against the current graph
  ├─ applies its review and authorization rules
  └─ records only approved changes in the local graph
```

This keeps each engine useful without giving it independent authority over MindrianOS knowledge. A result is valid only for the projection's `scope_id` and `snapshot_id`; if MindrianOS cannot resolve its references or the underlying snapshot has changed, it must be rechecked before acceptance. The same contract applies whether an engine is called through MCP or run from the CLI: CLI output must retain the MindrianOS lineage envelope when it returns to the host.

| Responsibility | Owner |
| --- | --- |
| Canonical local graph, stable IDs, room isolation, and accepted knowledge | MindrianOS |
| Selecting and authorizing graph context | MindrianOS |
| Engine-specific analysis and candidate generation | Eureka engines |
| Evidence/reference resolution and human review | MindrianOS |
| Accepting and persisting graph changes | MindrianOS |

## Theo and Eureka interoperation

Theo and Mindrian Eureka are separate capability systems. They meet at MindrianOS's local graph and typed host contracts; neither is required to call the other, and there is no mandatory Theo-to-Eureka workflow. MindrianOS can invoke Theo methods or Eureka capabilities independently, or sequence them when a particular investigation benefits from it.

Theo provides methodological reasoning: it can help frame an investigation, distinguish Wicked, undefined, ill-defined, and well-defined problem types, select a method, and identify missing evidence or the next instrument. MindrianOS applies its own authorization rules when exposing method handles; room text, node IDs, and room names remain local.

Eureka engines provide specialized analysis. When an engine needs room knowledge, MindrianOS supplies a bounded authorized graph projection; Eureka returns candidate signals with capability identity, scope/snapshot lineage, limitations, and uncertainty. MindrianOS resolves references against the current graph and routes consequential changes through its human review gate. Theo and Eureka results retain their own provenance; a combined interpretation is optional and must not erase which system produced each result.

For a Wicked problem, Theo may help map the system, stakeholders, and competing frames; Eureka may independently examine bounded graph evidence for cross-domain leads or future-facing opportunity candidates. MindrianOS may combine these outputs if useful, but no fixed order is required. The outputs remain falsifiable candidates and possible research instruments, not claimed solutions.

Capability IDs and CLI command names remain stable protocol identifiers. Human-facing labels and JTBD descriptions should explain what each engine does and when it is useful, without implying that the engines must be run as one workflow or that an experimental engine validates discoveries or writes MindrianOS knowledge.

Engines may propose useful structure or relationships, but a proposal never becomes graph truth merely because an engine returned it. This is especially important for cross-domain or wicked-problem discovery: the engine can surface a connection outside the current focus, while MindrianOS remains responsible for checking access, provenance, contradictions, and review state.

## MCP operations

- `eureka_graph_project` reads explicit node IDs from the bound room through MindrianOS navigation. It returns the snapshot, stable graph references, scope/snapshot IDs, and omission metadata. It does not call an engine.
- `eureka_graph_analyze` performs the composed local path for `graph.explore_local_relationships`: project the explicit node-ID set, invoke Eureka's stdio MCP workflow, and return proposals bound to the same room scope and snapshot. Results are proposed and unevidenced, and must go through MindrianOS evidence resolution and review before filing.
- `eureka_graph_propose_relationships` exposes Eureka's stable `graph.propose_relationships` alias over the same authorized snapshot path, preserving that capability identity in its result.
- `eureka_graph_map_neighbourhoods` performs the composed local path for SME structural mapping. It requires distinct base and target node IDs that are both included in the explicit projection; returned correspondences remain proposed and unevidenced.
- `eureka_graph_prepare_artifacts` projects explicit node IDs and invokes Eureka's `graph.prepare_artifact_bundle` method. Its versioned result carries source-linked text artifacts, hashes, `scope_id`, and `snapshot_id` for downstream RS/HSI and other artifact-based engines. It prepares input but does not start those downstream analyses.
- `eureka_graph_opportunity_scout` is the compatibility convenience call that screens an explicit local graph selection for candidate pair leads using Eureka's RS+HSI scout. It waits for the local job, honors host cancellation, and does not claim comprehensive opportunity discovery or write accepted graph/portfolio state. Eureka persists the local job/result and may write derived vectors to its local embedding cache. For non-blocking use, call `eureka_graph_prepare_artifacts`, then `eureka_capability_start` with `opportunity.synthesize_discovery_signals`, and continue with the job lifecycle tools below.
- `eureka_graph_genesis_plan` composes the explicit graph projection, artifact preparation, and Eureka's local Genesis planner. It returns a source-manifest-bound plan for Theo/MindrianOS review; it does not search, call a model, persist an ICM run, or write the graph.
- `eureka_hsi_interpret_whitespace` accepts zones and 2D coordinates from the upstream HSI stage, requires every referenced framework/artifact to be selected in `node_ids`, and derives `ADDRESSES_PROBLEM_TYPE` plus `FEEDS_INTO` inputs from those selected MindrianOS graph edges. It preserves Wicked as its own problem type and returns a scope/snapshot-bound interpretation; it does not infer type from text or write the graph.
- `eureka_graph_backtest` evaluates relationship methods against dated edges in an explicit node selection. It passes only allowlisted edge timestamps and returns an evaluation bound to the MindrianOS scope/snapshot; missing dates remain an explicit `insufficient_data` result.
- `eureka_graph_score_surprise` reads untruncated claim text from selected MindrianOS nodes and combines it with caller-supplied prior/posterior probability vectors. It returns scope/snapshot-bound review triage; it does not generate probabilities or determine claim truth.
- `eureka_graph_compare_topics` constructs two non-overlapping corpora from selected graph-node text and returns index-to-node mappings with the Eureka topic comparison.
- `eureka_graph_rank_paths` verifies every supplied ordered node/edge path against the same selected MindrianOS snapshot, then ranks those verified paths using bounded edge confidence/evidence metadata. It does not search for paths.
- `eureka_graph_package_relationships` packages caller-proposed relationships only after endpoints and evidence resolve to selected graph nodes, including explicit Evidence nodes. It returns pending proposals for MindrianOS review and never accepts or writes them.
- `eureka_capability_run` is the catalog-driven entry point for the wider Eureka catalog. It checks the live readiness record and packaged schemas, then invokes the capability's advertised MCP route for entries marked `experimental` or `host_brokered`; planned/blocked entries and unknown MCP routes are refused. The caller supplies the request in the exact schema shape. This general entry point does not project room data: use the graph-scoped tools above for supported graph flows, or prepare and authorize structured input in MindrianOS before calling it. Async RS routes persist local Eureka job state even though the result is never accepted into MindrianOS knowledge.
- `eureka_capability_start` starts a catalogued asynchronous capability and retains the same Eureka MCP worker process in MindrianOS. Use `eureka_capability_job_status`, `eureka_capability_job_result`, and `eureka_capability_job_cancel` with its returned job ID. Eureka stores job metadata and results in `jobs.sqlite3` under `MINDRIAN_EUREKA_DATA_DIR`, or by default `~/.local/share/mindrian-eureka`; the data directory is mode 0700 and the job database is mode 0600 where supported. Job rows expire after 30 days, and the saved request is cleared on terminal completion. RS pair jobs may also write derived vectors, never raw text, to `embeddings.sqlite3` in that data directory; this LRU cache is size-capped at 1 GiB and can be cleared with Eureka's `scout_clear_embedding_cache` tool. Jobs are available only in the MindrianOS MCP process that started them and cannot resume after that process restarts; restart the job after reconnecting. Unknown job IDs return `job_session_not_found`. A process retains at most eight jobs; each session expires after 30 minutes and requests cancellation.

To enable the composed tools, set `MINDRIAN_EUREKA_ROOT` in the environment that launches the MindrianOS MCP server to the local `mindrian-eureka` checkout. `uv` must be available on `PATH`; synchronous calls start a local Eureka MCP process for each call, while asynchronous job lifecycle calls keep their worker-owning process open across status/result/cancel requests. If the variable is unset or invalid, the tool returns a clear configuration refusal. The bridge does not accept a command or path from tool arguments.

Synchronous graph-engine calls use `MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS` (default 2 minutes, capped at 30 minutes) and pass host cancellation through to the MCP request. The legacy composed RS+HSI call uses `MINDRIAN_EUREKA_SCOUT_TIMEOUT_MS` (default 15 minutes, capped at 30 minutes). The RS+HSI scout selects Eureka's configured encoder extra through `uv` (`modern-encoder` by default, or `reference-encoder` when configured). The first call may install that package extra; the model must already be available locally because the engine does not download models during a run. Missing runtime dependencies are returned as an explicit engine-unavailable outcome. The generic bridge adds the optional `hmm` extra for decision-sequence capabilities and the selected encoder extra for RS pair jobs. Eureka bridge processes receive a fixed allowlist of model paths, cache/data directories, logging controls, and Hugging Face cache/offline settings; model tokens and unrelated provider credentials are excluded. `eureka_capability_run` remains a synchronous convenience call for async routes and uses `MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS` (default 15 minutes for jobs, capped at 30 minutes); use the lifecycle tools to return immediately and poll instead.

Every composed graph response now includes `partial`, `projection_complete`, and `projection_omissions` at top level as well as the detailed projection metadata. An incomplete projection can still be analyzed, but the caller must treat the result as partial and resolve the listed omissions before drawing completeness-sensitive conclusions. Edge truncation is therefore visible to the caller; the adapter does not silently label such an analysis complete.

`review_required: true` is a uniform result contract: any engine output that is used to change accepted knowledge must pass the MindrianOS review gate. It does not mean the MCP invocation itself needs interactive approval. `accepted_knowledge_persistence: "none"` states that these tools do not write accepted MindrianOS knowledge. `engine_state_persistence` separately reports whether a durable local Eureka job store is used, and `derived_cache_persistence` discloses when the local embedding cache may be written. A job ID with no session owner reports `unknown` rather than claiming that its store or cache is empty. The legacy `persistence` field remains for compatibility; on graph adapters, `"none"` means no accepted MindrianOS knowledge is persisted.

The MCP tools declare behavior annotations and a shared output schema. Pure graph/catalog analysis uses read-only annotations; calls that start or synchronously run durable Eureka jobs use non-read-only annotations even though they cannot accept MindrianOS knowledge. Job status reads state; cancellation and terminal result retrieval can change or close job/session state. Full results are returned in `structuredContent`; the text block is a short summary with lineage, review state, collection counts, persistence, and omissions rather than a duplicate payload. Results at or above 256 KiB carry a size warning in both forms. Keep requests bounded because structured output can still be large.

Example local development launch:

```sh
MINDRIAN_EUREKA_ROOT=/absolute/path/to/mindrian-eureka node scripts/mindrian-mcp-server.cjs
```

For Windows PowerShell, set `$env:MINDRIAN_EUREKA_ROOT` before starting the MCP server.

## CLI handoff

The catalog CLI is the direct surface for caller-supplied requests. Use the compact catalog to browse job names, JTBDs, readiness, and route names; `--search` and `--status` narrow the list. Inspect the selected contract and schemas before writing a request. Bare `eureka capabilities` retains the full JSON catalog for machine consumers:

```sh
uv run --project "$MINDRIAN_EUREKA_ROOT" eureka capabilities --summary
uv run --project "$MINDRIAN_EUREKA_ROOT" eureka capabilities --summary --search wicked
uv run --project "$MINDRIAN_EUREKA_ROOT" eureka capability research.analyze_rs_domain_projection
uv run --project "$MINDRIAN_EUREKA_ROOT" eureka schema research.analyze_rs_domain_projection --direction input
uv run --project "$MINDRIAN_EUREKA_ROOT" eureka-workflow research.analyze_rs_domain_projection request.json --output result.json
```

Use the executable listed in each capability's `routes.cli` for the four dedicated routes (`eureka-rs`, `eureka-sme`, `eureka-omm`, `eureka-scout`). Preserve caller-provided `scope_id` and `snapshot_id` in the input and result handoff; the CLI does not discover or authorize MindrianOS room context itself.

For a CLI-only graph run, call `eureka_graph_project`, save only its `snapshot` object as JSON, then run:

```sh
uv run --project /absolute/path/to/mindrian-eureka eureka-graph --snapshot projection.json
```

For the RS+HSI opportunity scout, call `eureka_graph_prepare_artifacts`, save its complete `bundle` object as JSON, and run:

```sh
uv run --project /absolute/path/to/mindrian-eureka eureka-scout artifact-bundle.json --output scout-result.json
```

Keep the returned `scope_id` and `snapshot_id` with every CLI result and preserve the artifact IDs/source refs when returning it to MindrianOS. Engine output is a discovery signal, not validated evidence or an accepted graph relation.

## Readiness

The source catalog currently contains 66 capabilities: 58 are marked `experimental` or `host_brokered`, and 8 are `planned` or `blocked`. Each runnable entry publishes CLI and MCP routes and input/output contracts. Fifty-three use the shared `eureka-workflow` / `scout_run_workflow` routes. Five capability entries use dedicated MCP routes; four descriptive CLI executables cover them, with decision inference and fitting sharing `eureka-decision-sequences`. MindrianOS exposes catalog routes through `eureka_capability_run` or asynchronous job tools when a route starts a long-running job. The live audit checks that all 58 catalog MCP routes are advertised, retrieves all 58 input/output contracts, and verifies that all 53 shared-workflow IDs are accepted by the CLI. The 8 unavailable capabilities remain unrouted by Eureka. Their optional `host_handoff` records identify separately owned MindrianOS paths, partial alternatives, or the absence of any authorized route; these do not change readiness or make a blocked/planned Eureka capability runnable.

The live graph bridge was exercised against a temporary SQLite room graph and a real Eureka stdio MCP process. It now includes a real bound-session case using MindrianOS room birth, session-binding storage, the production resolver, and the live graph engine; Eureka returned the bound room and snapshot lineage, and the room database hash was unchanged. Separate checks refuse both an unbound session and a registry-fallback room. The live catalog audit verifies all 58 runnable MCP routes are advertised and all 58 input/output contracts are retrievable; direct live execution covers the generic workflow, structure mapping, decision comparison/fitting, the RS+HSI scout, and the graph composition path. Live adapter checks use the configured local Eureka checkout; a clean MindrianOS installation must resolve an Eureka revision that contains this 66-entry catalog. Dedicated graph adapters enforce MindrianOS room projection and lineage for graph-backed capabilities; the generic entry does not read the local graph or provide host graph authorization for arbitrary calls. Theo and Eureka remain independently callable; no mandatory combined workflow is claimed, and wider `/mos:eureka` orchestration remains unverified.
