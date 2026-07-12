# Phase 218: Eureka Entity Extraction — Specification

**Created:** 2026-07-12
**Ambiguity score:** 0.14
**Requirements:** 5 locked

## Goal

Room artifact markdown prose gets parsed into named domain-entity nodes (companies, technologies, markets) and typed relationship edges (COMPETES_WITH, USES_COMPONENT, SUPPLIES_TO, etc.), written into room.db through the existing `lib/core/navigation.cjs` chokepoint, so the shipped Eureka engine (Phases 211-216) and every other room.db reader (whitespace_scan, contradiction_check, graph_query) reason over real domain content instead of one-node-per-file structural scaffolding.

## Background

Phases 211-216 (all COMPLETE) shipped a fully working Eureka portfolio engine: tri-modal retrieval (FTS5 + sqlite-vec + `@huggingface/transformers` embeddings), a Grounding Guard critic, AHP scoring, a weak-signal tail classifier, and a user-facing `/mos:eureka` command. Live-tested 2026-07-12 against three real rooms on two machines:

| Room | Nodes / Edges | Result |
|---|---|---|
| corepower-isolation | 1 / 0 | Empty graph — only a `memory_event` migration marker |
| aion-eureka-synergy | 646 / 92 | Populated, but every node is `memory_artifact:<section>:<doctype>` (one node per MINTO/ROOM/FEYNMAN/STATE/BRAIN file). Top 25 ranked eureka pairs are 100% template-vs-template noise; the engine self-flagged `tail_suspect_noise: true`. |
| aion-labs-eir | 0 / 0 | Fresh room, auto-provisioned empty room.db, honest empty report |

Root cause: no pipeline stage exists that reads the prose *inside* an artifact and extracts named entities or domain-typed relationships. `lib/core/lazygraph-ops.cjs::rebuildGraph()` (the writer behind these numbers) only walks the filesystem and writes one scaffold node per section+doctype file — confirmed by a same-day research fork of `rethinking-mindrianos/research/2026-07-07-fable-max-pack/p212-5-graph-whitespace-bridge/`, which independently found the identical pattern on 3 different rooms in a separate session (jhtv: 2,372 nodes / 1 edge; motj: 1,096 nodes / 116 edges, all containment/attribution scaffolding). Two unrelated investigations, same conclusion: "the typed-edge layer is scaffolding, not semantics."

Two adjacent efforts already exist and were confirmed NOT to cover this gap:
- **SEED-037** (`lib/core/graph-candidate-producer.cjs`, status `investigating`, root cause a dead Anthropic API account silently clearing its retry queue) derives semantic edges, but only ever at artifact-to-artifact grain ("file X CONTRADICTS file Y"), never sub-artifact entities.
- **Phase 212.5** (`eureka-graph-substrate`, registered 2026-07-06, still 0 plans) does structural-hole/whitespace-zone detection on top of Phase 211's existing artifact-pair enumeration — also artifact grain, and its own research states outright it is "not a substitute for SEED-037" (and, by the same logic, not a substitute for entity extraction).

A second fork confirmed (file:line) that `whitespace_scan`, `contradiction_check`, and `graph_query` all read the identical `{roomDir}/.mindrian/room.db` file and `nodes`/`edges` tables that Eureka reads (`lib/core/navigation/insights.cjs:43-73,186-192`, `lib/core/graph-ops.cjs::queryGraph`, `lib/core/eureka/tri-modal-index.cjs`) — one extraction fix reaches all four automatically, no separate wiring. The same fork confirmed `/mos:find-connections` and `/mos:find-analogies` (TRIZ/SAPPhIRE) bypass room.db entirely (Tier 0 = LLM reasoning over `STATE.md` text; `--brain` mode = remote Neo4j Cypher) — rewiring those is explicitly a separate follow-on phase, navigator-decided 2026-07-12.

Technical grounding confirmed via source read + external research (2026-07-12): room.db uses Node's built-in `node:sqlite` `DatabaseSync` (`lib/core/room-db.cjs`), pinned Node floor `>=22.5.0` (`package.json`), running live on Node v22.22.2 in this repo. `lib/core/eureka/vector-store.cjs` already loads the `sqlite-vec` extension (pinned `>=0.1.9`) via the manual `enableLoadExtension(true)` + `loadExtension(sqliteVec.getLoadablePath())` path and already uses the correct `Buffer.from(Float32Array.from(vec).buffer)` binding pattern — confirmed working live in this session's aion-eureka-synergy scan (`vec_backend: "sqlite-vec"` in provenance). External docs (alexgarcia.xyz/sqlite-vec, nodejs.org/api/sqlite.html) suggest `sqlite-vec`'s own `sqliteVec.load(db)` convenience wrapper needs Node `>=23.5.0`; MindrianOS never uses that wrapper, so this is a non-issue, not a gap — noted here so the executing plan doesn't "fix" a problem that doesn't exist. `DatabaseSync` is documented as fully synchronous/single-threaded with no built-in multi-process write safety — the extraction pipeline must follow the existing open-work-close-per-invocation pattern (`eureka-command.cjs`'s detached-spawn shape), never a persistent long-lived writer. `@huggingface/transformers` v4.2.0 (already a pinned dependency) supports a `token-classification` pipeline usable for a future tier-2 NER pass, confirmed via Hugging Face's own docs — no new dependency needed if a later tier wants it.

## Requirements

1. **Domain-entity node extraction**: A pipeline stage reads artifact markdown text and writes new graph nodes typed as domain entities (not `memory_artifact`/`memory_event`).
   - Current: room.db in every tested room contains zero nodes of any type other than `memory_artifact` and `memory_event`.
   - Target: running the extraction pipeline against a room with N artifacts produces at least one domain-entity node (type e.g. `company`, `technology`, `market`) per artifact that names a capitalized proper-noun entity, each written with `review_status='proposed'` (never auto-confirmed) and linked back to its source artifact node via a typed edge.
   - Acceptance: running the pipeline against `aion-eureka-synergy` (or a smaller fixture room) produces ≥1 row in `nodes` with `type NOT IN ('memory_artifact','memory_event')`; every such row has `review_status='proposed'`; every such row has at least one edge (in `ALLOWED_EDGE_TYPES`) linking it to a `memory_artifact` node.

2. **Domain-typed relationship edges**: New edge types for domain relationships are added additively to the existing edge vocabulary and are writable only through the existing chokepoint.
   - Current: `lib/core/navigation/edges.cjs`'s `ALLOWED_EDGE_TYPES` has 37 entries, none domain-relationship-specific (no COMPETES_WITH/USES_COMPONENT/SUPPLIES_TO).
   - Target: at least 3 new edge types are added to `ALLOWED_EDGE_TYPES` (additive only — the existing 37 are untouched), and all entity-relationship writes route through `writeEdge()`.
   - Acceptance: `ALLOWED_EDGE_TYPES` has ≥40 entries after this phase; a test asserts `writeEdge()` accepts each new type and still rejects an arbitrary unlisted type; `grep` confirms no direct SQL `INSERT INTO edges` outside `edges.cjs` in the new code.

3. **Reuse the existing embedding infrastructure**: New entity nodes get embedded through the same store Eureka already uses, not a second embedding path.
   - Current: `lib/core/eureka/vector-store.cjs`'s `ensureStore`/`insertVector` embed `memory_artifact` nodes only.
   - Target: entity nodes are embedded via the same public functions, no new embedding call path or model.
   - Acceptance: after extraction, `graph_nodes` in a subsequent `/mos:eureka run`'s provenance output includes the new entity nodes; `vector-store.cjs`'s public function signatures are unchanged (confirmed via `git diff`).

4. **Zero-touch propagation to existing room.db readers**: `whitespace_scan`, `contradiction_check`, and `graph_query` see the richer graph without their own code changing.
   - Current: these three tools already read the identical room.db `nodes`/`edges` tables Eureka reads (confirmed 2026-07-12 fork, file:line citations above).
   - Target: after extraction runs, all three tools return different (richer) output on the same room, with zero lines changed in `lib/core/navigation/insights.cjs` or `lib/core/graph-ops.cjs`.
   - Acceptance: `git diff` shows no changes to those two files; before/after runs of `whitespace_scan` and `contradiction_check` on the same test room produce different result sets after extraction.

5. **Measurable reduction in structural-noise pairing**: A subsequent Eureka scan on an extraction-processed room produces fewer purely-structural (`memory_artifact`-vs-`memory_artifact`) top-ranked pairs than the pre-extraction baseline.
   - Current baseline (this session, `aion-eureka-synergy`): 25/25 (100%) of top-ranked pairs are `memory_artifact`-vs-`memory_artifact`.
   - Target: after extraction, the same room's top-25 ranked pairs include a materially lower share of pure structural-vs-structural pairs (directional proof, not a claim of zero noise — some structural pairs may remain legitimately ranked).
   - Acceptance: numeric before/after comparison is logged in the phase's verification artifact; post-extraction structural-vs-structural share in the top 25 is below 50%.

## Boundaries

**In scope:**
- Tier-1 extraction: regex/heading/capitalization-based named-entity detection (companies, technologies, markets) from artifact markdown — zero network calls, zero LLM calls, by construction (Canon Part 8).
- Writing extracted entities and relationships into room.db exclusively through `lib/core/navigation/edges.cjs`'s `writeEdge()` and the existing node-write path, with `review_status='proposed'`.
- Additive extension of `ALLOWED_EDGE_TYPES` with domain-relationship edge types.
- Reuse of `lib/core/eureka/vector-store.cjs` for entity-node embedding.
- A runnable entry point (script or command, mirroring `eureka-command.cjs`'s start/status/report shape) that can be invoked standalone or ahead of an `/mos:eureka run`.
- Verification against at least one populated test room (`aion-eureka-synergy` or an equivalent fixture) showing the before/after numbers in Requirement 5.

**Out of scope:**
- Tier-2/tier-3 extraction (embedding-similarity clustering or LLM-based extraction) — deferred as a stretch goal only if tier-1 proves insufficient at verification time; not required for this phase's acceptance criteria.
- Rewiring `/mos:find-connections` and `/mos:find-analogies` (TRIZ/SAPPhIRE) to read room.db — confirmed via code read that both currently bypass room.db entirely (LLM-reasoning / Brain-Cypher); tracked as a separate follow-on phase (navigator-decided 2026-07-12).
- Retroactive backfill of every existing room in `~/MindrianRooms/` — this phase proves the pipeline works on 1-2 test rooms; a fleet-wide backfill sweep is a separate follow-on.
- Multi-room / portfolio-level entity resolution (e.g. deduplicating "Prodrive" across two different ventures' rooms) — Phase 215's (portfolio-scale) territory, not this phase's.
- Any new command/skill surface beyond the minimum needed to invoke and observe the pipeline (Canon Part 7 — reuse `eureka-command.cjs`'s shape, do not mint a new UI).
- SEED-037's fix (the dead-API-account bug in `graph-candidate-producer.cjs`) — separate, already-tracked issue at a different grain (artifact-to-artifact), not blocking or blocked by this phase.

## Constraints

- Node engine floor stays `>=22.5.0` (`package.json` unchanged). Confirmed live: `sqlite-vec`'s manual `enableLoadExtension`/`loadExtension` path (already used by `vector-store.cjs`) works on Node v22.22.2 despite `sqlite-vec`'s own docs suggesting a `>=23.5.0` floor for their `sqliteVec.load(db)` convenience wrapper — do not switch to that wrapper; keep the proven manual pattern.
- All room.db access goes through `lib/core/room-db.cjs`'s `openRoomDb({ allowExtension: true })` and `navigation/edges.cjs`'s `writeEdge()` — no second DB handle, no raw SQL `INSERT`/`UPDATE` on `nodes`/`edges` from new code (Canon Part 7 + Part 9).
- `DatabaseSync` is fully synchronous and single-threaded with no built-in multi-process write safety (confirmed via Node's own docs). The extraction pipeline must open, do its work, and close within one invocation — matching `eureka-command.cjs`'s detached-spawn-then-exit shape — never a persistent daemon holding a long-lived write handle.
- Canon Part 8 (zero egress): tier-1 extraction has no network calls by construction. Any future tier-2 pass must reuse the already-vendored `@huggingface/transformers` local models (zero network after first-model-download, matching Phase 211's existing "first-run honesty note" pattern) — never a live API call.
- New nodes/edges must never be auto-confirmed. Every extracted entity lands with `review_status='proposed'`, following the existing HITL pattern in `graph-derivation.cjs` — a navigator confirms before a proposed node becomes trusted graph data.
- **SQLite write safety (added 2026-07-12, Perplexity research + code verification):** `lib/core/room-db.cjs`'s `openRoomDb()` sets `journal_mode=WAL` and `foreign_keys=ON` today but has no `busy_timeout` and no `synchronous` pragma, and no code path in this repo wraps batch writes in an explicit transaction (`node:sqlite`'s `DatabaseSync` has no `.transaction()` helper, unlike `better-sqlite3`). `openRoomDb()` MUST additionally set `PRAGMA busy_timeout=5000` and `PRAGMA synchronous=NORMAL` on every connection open. The extraction pipeline's batch node+edge inserts MUST be wrapped in a single explicit `BEGIN` / `COMMIT` (with `ROLLBACK` on error), not per-row autocommit. Rationale: without `busy_timeout`, a concurrent write from the extraction worker while a live conversation holds a write lock throws immediate `SQLITE_BUSY` with zero retry window.

## Acceptance Criteria

- [ ] Extraction pipeline run against a populated test room produces ≥1 non-scaffold domain-entity node type in `nodes`
- [ ] Every new entity node has `review_status='proposed'`
- [ ] `openRoomDb()` sets `busy_timeout=5000` and `synchronous=NORMAL` in addition to existing WAL/FK pragmas; extraction batch writes are wrapped in one explicit BEGIN/COMMIT/ROLLBACK
- [ ] Every new entity node links to its source artifact via a valid `ALLOWED_EDGE_TYPES` edge
- [ ] `ALLOWED_EDGE_TYPES` grows by ≥3 domain-relationship types, additively (37 existing entries untouched)
- [ ] `writeEdge()` test proves the new types are accepted and an arbitrary unlisted type is still rejected
- [ ] New entity nodes are embedded via the existing `vector-store.cjs` functions with no signature changes
- [ ] `whitespace_scan` and `contradiction_check` return different (richer) results before vs. after extraction, with zero code changes to `insights.cjs`/`graph-ops.cjs`
- [ ] Post-extraction `/mos:eureka` top-25 structural-vs-structural pair share on the test room drops below 50% (from a 100% pre-extraction baseline)
- [ ] Zero network calls made by the tier-1 extraction path (verified by code inspection / no fetch/http import)

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                 |
|--------------------|-------|------|--------|------------------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Specific, measurable, grounded in live-tested numbers                 |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | Explicit in/out-of-scope list, each with a reason and phase pointer    |
| Constraint Clarity | 0.82  | 0.65 | ✓      | Node/sqlite-vec/transformers.js versions and gotchas confirmed live    |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 9 pass/fail checkboxes, all falsifiable against a real test room       |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      |                                                                        |

## Interview Log

Conducted as a live investigation rather than a formal round-by-round interview (navigator was actively directing the research in real time):

| Round | Perspective     | Question summary                                                                 | Decision locked                                                                                     |
|-------|-----------------|------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| 1     | Researcher      | Does the shipped Eureka engine (211-216) actually work, and on what data?         | Engine works correctly; data is 100% structural scaffold, confirmed live on 3 rooms / 2 machines      |
| 1     | Researcher      | Is there prior art on this exact gap?                                              | SEED-037 + Phase 212.5 exist, both adjacent (artifact-grain), neither covers sub-artifact entities    |
| 2     | Researcher      | Do whitespace/contradiction/graph_query/find-analogies all share the same fix?    | whitespace_scan/contradiction_check/graph_query: yes (same room.db, file:line confirmed). find-connections/find-analogies: no (bypass room.db entirely) |
| 3     | Boundary Keeper | Fold find-analogies rewiring into this phase, or split it off?                    | Split off as a separate follow-on phase (navigator gate, 2026-07-12) — this phase stays entity-extraction only |
| 4     | Failure Analyst | What's the real technical risk (driver/extension compatibility)?                 | Confirmed via WebFetch: `sqlite-vec` + `node:sqlite` combination already works on the pinned Node floor; no gap, existing pattern is sound and should be reused as-is |
| 5     | Seed Closer     | Is tier-1 (regex) extraction sufficient to lock the SPEC, or does it need tier-3 (LLM) now? | Tier-1 only is in scope; tier-2/3 explicitly deferred pending tier-1's verification result             |

---

*Phase: 218-entity-extraction-pipeline-eureka-entity-extraction-extract-*
*Spec created: 2026-07-12*
*Next step: /gsd-discuss-phase 218 — implementation decisions (extraction heuristics, entity type taxonomy, edge-type naming, script vs. command surface)*
