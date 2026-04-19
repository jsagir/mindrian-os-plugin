# MindrianOS-Plugin Backend Map

> Generated: 2026-04-18
> Method: Filename + targeted grep classification per file
> Rule: Every script and lib module is classified by graph-owner per the two-graph architecture

## The Architecture Rule

MindrianOS has **TWO graphs**. Every file in this repo is classified by which graph(s) it touches:

| Graph | Access | Owner | Content |
|-------|--------|-------|---------|
| **Brain** (remote Neo4j Aura) | READ-ONLY from plugin | Jonathan (curator) | 21K framework/problem/case nodes, teaching intelligence |
| **Room** (local SQLite `room.db`) | READ-WRITE | Plugin (autonomous + user) | User's venture artifacts, INFORMS/CONTRADICTS/CONVERGES edges, embeddings, meeting intel |

**The choke point:** Only `lib/core/brain-client.cjs` and `lib/mcp/brain-router.cjs` talk directly to the Brain. If the READ-ONLY invariant is ever questioned, audit those two files.

## Classification Taxonomy

- **READ** -- Queries Brain (Neo4j MCP), returns framework/problem/agent metadata
- **WRITE** -- Writes to Room (`room.db`, `STATE.md`, artifacts, wikilinks, exports)
- **BRIDGE** -- Reads Brain AND writes Room (cascade, metadata injection, analogical bridge writer)
- **INFRA** -- Workspace/session/plugin mechanics; touches neither graph
- **CURATION** -- Files that belong to the Brain-side project, not this plugin (migration artifacts mixed in)

---

## scripts/ (127 files)

### Brain READ scripts (4)

| Script | Purpose |
|--------|---------|
| `fetch-brain-baseline.cjs` | Pulls framework baselines from Brain MCP into room cache |
| `fetch-brain-baseline.py` | Embeds Brain frameworks into `brain-baseline.json` |
| `seed-brain-commands.cjs` | Seeds command->framework mapping from Brain |
| `research-speaker` | Brain lookup for speaker identity enrichment |

### Room WRITE scripts (60)

| Script | Purpose |
|--------|---------|
| `analyze-room` | Scans room dir, writes analysis to STATE.md |
| `build-graph` | Wrapper -> `build-graph-from-sqlite.cjs` |
| `build-graph-from-sqlite.cjs` | Builds graph JSON from room.db |
| `build-ecosystem-graph.cjs` | Builds cross-room ecosystem graph artifact |
| `build-jtbd-nudges` | Writes JTBD nudge cards into room |
| `causal-to-graph.cjs` | Extracts causal relations -> room graph |
| `classify-insight` | Classifies filed insights into room sections |
| `compute-state` | Recomputes STATE.md snapshot |
| `compute-team` | Computes team profile in room.db |
| `compute-opportunity-state` | Opportunity scoring -> room artifact |
| `compute-meetings-intelligence` | Re-analyzes filed meetings -> artifacts |
| `compute_topic_forest.py` | Ward-linkage topic tree from room + cached brain-baseline |
| `compute-element-novelty.py` | Novelty scoring vs brain-baseline cache |
| `compute-blindspot-mass.py` | Blindspot mass calc |
| `compute-bayesian-surprise.py` | Bayesian surprise per artifact |
| `compute-disruption-index.py` | Disruption index calc |
| `compute-external-whitespace.py` | External whitespace scoring |
| `compute-whitespace-embeddings.py` | Embeds room sections for whitespace |
| `compute-whitespace-gaps.py` | Gap signal vs brain embeddings |
| `compute-hsi.py` | HSI cross-domain scoring |
| `consolidate-pinecone.py` | Pinecone index consolidation (writes vectors) |
| `create-speaker-profile` | Creates speaker profile artifact |
| `cross-room-detect.cjs` | Detects cross-room links, writes to registry |
| `detect-reverse-salients.py` | Reverse salient detection |
| `discover-analogy-whitespace.py` | Analogy-based gap discovery |
| `discover-hsi-whitespace.py` | HSI gap discovery |
| `discover-rs-whitespace.py` | Reverse-salient gap discovery |
| `discovery-cycle.cjs` | Orchestrates discovery artifacts into room |
| `extract-room-intelligence.cjs` | Pulls structured intel from room.md files |
| `file-asset` | Files an asset into the room |
| `generate-chat-embed.cjs` | Chat embed bundle for exports |
| `generate-deck.cjs` | Generates slide deck export |
| `generate-export.cjs` | Export package generator |
| `generate-hub.cjs` | Snapshot hub generator |
| `generate-lobby.cjs` | 3-door lobby generator |
| `generate-presentation.cjs` | 6-view presentation generator |
| `generate-snapshot.cjs` | Room snapshot export |
| `generate-standalone` | Standalone HTML export |
| `hsi-to-graph.cjs` | HSI results -> room graph |
| `intent-classifier` | Routes intents; writes to session/room |
| `intent-classifier.cjs` | Node variant of intent-classifier |
| `memory-lifecycle.cjs` | AAAK memory compaction in room |
| `migrate-lazygraph.cjs` | LazyGraph schema migration |
| `migrate-rooms` | Room schema migrator |
| `query-semantic-scholar.cjs` | External research -> room artifact |
| `reapply-modifications` | Reapplies user patches after update |
| `render-pdf` | PDF renderer of room export |
| `render-viz` | Visualization renderer |
| `resolve-room` | Resolves current room context (touches registry) |
| `sealed-walker.py` | GUARDRAIL.md parser for sealed rooms |
| `sentinel-deadline-monitor` | Writes deadline alerts to STATE.md |
| `sentinel-health-check` | Writes health snapshot to STATE.md |
| `sentinel-snapshot` | Snapshot for sentinel timeline |
| `serve-dashboard` | Launches dashboard server over room.db |
| `serve-presentation` | Launches presentation server |
| `serve-wiki` | Launches localhost wiki over room |
| `sync-rooms-graph` | Syncs rooms registry graph |
| `transcribe-audio` | Velma transcribe -> files into room |
| `update-icm-index` | Updates importance-satisfaction index |
| `vault-content-reformatter.cjs` | Reformats vault content |
| `vault-export-orchestrator.cjs` | Orchestrates Obsidian vault export |
| `vault-footer-injector.cjs` | Injects footers into vault pages |
| `vault-import.cjs` | Imports Obsidian vault -> room |
| `vault-regenerate-all.cjs` | Regenerates full vault |
| `vault-rules-generator.cjs` | Generates vault frontmatter rules |
| `vault-section-minto-generator.cjs` | Minto reasoning per section |
| `vault-section-state-generator.cjs` | Per-section STATE generator |
| `vault-welcome-generator.cjs` | Welcome page generator |
| `vault-wikilink-injector.cjs` | Injects wikilinks into vault |
| `whitespace-command.cjs` | Orchestrates whitespace pipeline |
| `whitespace-to-graph.cjs` | Whitespace results -> room graph |
| `wikilink-batch.cjs` | Batch wikilink resolver |
| `wikilink-file.cjs` | Single-file wikilink resolver |
| `write-scope-check` | Guardrail for write scope |
| `write-scope-check.cjs` | Node variant |
| `write-whitespace-sections.cjs` | Writes whitespace section pages |

### BRIDGE (Brain read + Room write) (3)

| Script | Purpose |
|--------|---------|
| `interpret-whitespace.cjs` | Reads Brain frameworks, writes interpretations into room |
| `whitespace-to-brain.cjs` | ⚠ Misleading name -- reads Brain, writes to room. Rename to `whitespace-from-brain.cjs` |
| `sync-rooms-brain` | Reads Brain framework registry, writes to room registry cache |

### INFRA (no graph touch) (32)

| Script | Purpose |
|--------|---------|
| `backup-modifications` | Backs up user patches before update |
| `banner` | Renders Mondrian banner |
| `check-hsi-deps` | Python/ML dep check |
| `check-onboard` | Onboarding state check |
| `check-update` | Update version check |
| `context-monitor` | Context window monitoring |
| `git-ops` | Git helper shell wrapper |
| `learn-from-usage` | Analytics aggregation (local .mindrian file) |
| `on-agent-complete` | Hook |
| `on-cwd-changed` | Hook |
| `on-file-changed` | Hook |
| `on-stop` | Hook |
| `on-task-complete` | Hook |
| `post-compact` | Hook |
| `post-write` | Hook |
| `pre-compact` | Hook |
| `publish-ops` | Vercel publish helpers |
| `release.sh` | Release packaging |
| `room-registry` | Rooms registry CLI (local JSON, not room.db) |
| `self-update` | Plugin self-update |
| `session-start` | Session-start hook |
| `statusline-mos` | Statusline renderer |
| `track-analytics` | Local analytics counter |
| `validate-model-profiles` | Model profile validation |
| `verify-release` | Release verification |
| `ensure_ml_deps.py` | Python dep bootstrap |
| Tests (7): `83-scope-injection.test.cjs`, `generate-presentation.test.cjs`, `vault-integration-test.cjs`, `vault-regenerate-all.test.cjs`, `vault-section-minto-generator.test.cjs`, `vault-section-minto-generator.integration.test.cjs`, `test-fresh-install.md` | |
| Doc: `PYTHON_GATES.md` | Python installation gate documentation |

### CURATION -- must relocate (8)

> These are Neo4j migrations for the remote Brain Aura DB. They do not belong in a plugin users install.
> **Action: Move to the Brain curation repo (separate project).**

| File | Note |
|------|------|
| `brain-normalize.cypher` | Base Neo4j normalization |
| `brain-normalize-books.cypher` | Books collection migration |
| `brain-normalize-final.cypher` | Final consolidation migration |
| `brain-normalize-problemtype.cypher` | ProblemType taxonomy migration |
| `brain-normalize-supplement.cypher` | Supplementary edges migration |
| `brain-normalize-targeted.cypher` | Targeted fixes migration |
| `brain-normalize-v194.cypher` | v1.9.4-pinned migration (stale) |
| `v182-brain-optimize.cypher` | v1.8.2-pinned optimization (stale) |

---

## lib/core/ (38 files)

| Module | Owner | Purpose |
|--------|-------|---------|
| `artifact-id.cjs` | INFRA | ID generator |
| `asset-ops.cjs` | WRITE | Room asset CRUD |
| `brain-client.cjs` | **READ** | **The** Brain MCP client (only one in repo) |
| `daily-briefing.cjs` | BRIDGE | Reads Brain context, writes briefing to room |
| `deep-links.cjs` | INFRA | URL helpers |
| `dispatch-optimizer.cjs` | BRIDGE | Framework routing using Brain |
| `exports-log.cjs` | WRITE | Export ledger in room.db |
| `git-ops.cjs` | INFRA | Git wrappers |
| `graph-ops.cjs` | WRITE | Room graph CRUD |
| `hat-persistence.cjs` | WRITE | De Bono hat memory |
| `index.cjs` | INFRA | Core exports index |
| `integration-registry.cjs` | INFRA | MCP integration registry |
| `intelligence-cascade.cjs` | **BRIDGE** | Canonical cascade: Brain -> Room writes (the "nervous system") |
| `lazygraph-ops.cjs` | WRITE | LazyGraph on room.db |
| `mcp-profiles.cjs` | INFRA | MCP profile config |
| `meeting-ops.cjs` | WRITE | Meeting filing into room |
| `memory-ops.cjs` | WRITE | Memory CRUD on room |
| `model-profiles.cjs` | INFRA | Model routing profiles |
| `mullins-scaffold.cjs` | BRIDGE | Mullins framework scaffold (Brain + room) |
| `nl-graph-queries.cjs` | WRITE | NL->Cypher against room graph |
| `opportunity-extractor.cjs` | WRITE | Extracts opportunities |
| `opportunity-ops.cjs` | WRITE | Opportunity CRUD |
| `persona-ops.cjs` | WRITE | Persona artifact CRUD |
| `platform-gates.cjs` | INFRA | Platform detection gates |
| `platform.cjs` | INFRA | Platform/surface detect |
| `proactive-intelligence.cjs` | BRIDGE | Proactive scan: reads Brain + writes room alerts |
| `reasoning-ops.cjs` | WRITE | REASONING.md writes |
| `room-db.cjs` | **WRITE** | **The** SQLite room.db client |
| `room-ops.cjs` | WRITE | Room lifecycle |
| `room-type-detector.cjs` | WRITE | Classifies room type |
| `scheduled-scanner.cjs` | WRITE | Cowork scheduled scanner |
| `scratchpad-ops.cjs` | WRITE | Scratchpad CRUD |
| `section-registry.cjs` | WRITE | Section registry in room |
| `session-state.cjs` | INFRA | Session state (ephemeral) |
| `state-ops.cjs` | WRITE | STATE.md writes |
| `user-archetype.cjs` | WRITE | User archetype classification |
| `visual-ops.cjs` | WRITE | Visual artifact CRUD |
| `write-lock.cjs` | WRITE | Write-lock primitive |

---

## lib/ subdirectories

### lib/chat/ (4)
- `chat-context.js` -- INFRA
- `chat-panel.js` -- INFRA
- `fabric-chat.cjs` -- BRIDGE (Brain-enriched chat)
- `generative-tools.js` -- INFRA

### lib/graph/ (3)
- `canvas-graph.js` -- WRITE
- `constellation-config.cjs` -- INFRA
- `graph-detail-panel.js` -- WRITE

### lib/import/ (20 + fixtures)
**WRITE:** `branding.cjs`, `manifest.cjs`, `meeting-detector.cjs`, `person-detector.cjs`, `report.cjs`, `room-md-scaffolder.cjs`, `router.cjs`, `vault-scanner.cjs`
**BRIDGE:** `classifications-sync.cjs`, `enricher.cjs` (Brain lookups)
**INFRA:** tests, fixtures, schemas

### lib/mcp/ (12)
- `app-views.cjs` -- WRITE
- `brain-router.cjs` -- **READ** (Brain MCP router)
- `capability-registry.cjs` -- INFRA
- `larry-context.cjs` -- BRIDGE
- `larry-server-instructions.md` -- INFRA (doc)
- `pipeline-state.cjs` -- WRITE
- `prompts.cjs` -- INFRA
- `resources.cjs` -- WRITE
- `session-catchup.cjs` -- BRIDGE
- `surface-detect.cjs` -- INFRA
- `tool-router.cjs` -- BRIDGE
- `app-html/` -- WRITE (templates)

### lib/memory/ (8)
**WRITE:** `aaak-compress.cjs`, `feynman-prompts.cjs`, `narrative-schema.cjs`
**INFRA:** `run-feynman-tests.cjs` + 4 test files

### lib/parity/ (1)
- `check-parity.cjs` -- INFRA

### lib/presentation/ (2)
- `presentation-server.cjs` -- WRITE
- `presentation-watcher.cjs` -- WRITE

### lib/quickview/ (2)
- `hub-server.cjs` -- WRITE
- `server.cjs` -- WRITE

### lib/vault/ (4)
- `frontmatter-schema.cjs` -- INFRA
- `room-scanner.cjs` -- WRITE
- `wikilink-builder.cjs` -- WRITE
- `wikilink-builder.test.cjs` -- INFRA

### lib/wiki/ (7)
- `graph-links.cjs` -- WRITE
- `page-renderer.cjs` -- WRITE
- `wiki-chat.cjs` -- BRIDGE
- `wiki-layout.cjs` -- INFRA
- `wiki-search.cjs` -- WRITE
- `wiki-server.cjs` -- WRITE
- `wiki-watcher.cjs` -- WRITE

---

## Summary Counts

### scripts/
| Category | Count |
|----------|-------|
| READ | 4 |
| WRITE | 60 |
| BRIDGE | 3 |
| INFRA | 32 |
| CURATION (must relocate) | 8 |
| Tests/Docs (INFRA subset) | 8 |

### lib/ (~110 files including tests/HTML/fixtures)
| Category | Count |
|----------|-------|
| READ | 2 |
| WRITE | ~55 |
| BRIDGE | ~10 |
| INFRA | ~45 |
| CURATION | 0 |

---

## Action Items (from audit)

### Immediate (Phase 89 scope)
1. **Relocate 8 Cypher files** to the Brain curation repo
2. **Rename `whitespace-to-brain.cjs` -> `whitespace-from-brain.cjs`** to match the two-graph rule (it reads Brain, writes room)

### Phase 103 (dead-weight cleanup)
1. **Resolve 3 duplicate shell+CJS pairs** -- pick one per:
   - `intent-classifier` / `intent-classifier.cjs`
   - `write-scope-check` / `write-scope-check.cjs`
   - `fetch-brain-baseline.cjs` / `fetch-brain-baseline.py` (different contracts -- rename py to `embed-brain-baseline.py`)
2. **Audit versioned Cypher files** -- `brain-normalize-v194.cypher`, `v182-brain-optimize.cypher` are version-pinned in main branch (bit-rot bait)
3. **Consolidate whitespace pipeline** -- 11 files in one pipeline (`discover-*whitespace*.py`, `compute-*whitespace*`, `whitespace-*.cjs`); audit for dead code
4. **Audit vault generators** -- `vault-regenerate-all.cjs` + 7 individual generators; verify each is still called
5. **Normalize Python naming** -- `compute_topic_forest.py` uses snake_case vs kebab-case elsewhere
6. **Gitignore `scripts/__pycache__/`**

### Phase 107 scope (Researcher wedge product)
1. **Gate Python dependencies behind opt-in** -- 16 Python scripts are user install footguns. `check-hsi-deps` already exists; require explicit user activation.
2. **Rewrite `sealed-walker.py` in Node** -- only Python script that is not ML/embedding (just GUARDRAIL.md parsing). Drops one Python dep.

### Strategic (future)
1. **Consider `lib/read/` vs `lib/write/` split** -- make two-graph boundary visible in filesystem structure, not just docs
2. **Single `lib/intelligence/` Python worker** -- stdio JSON worker so Node code never has to know Python is underneath

---

## The Invariant

**Only two files in the entire repo talk to Brain Neo4j directly:**
- `lib/core/brain-client.cjs`
- `lib/mcp/brain-router.cjs`

Everything else classified as READ / BRIDGE imports one of those two. That is the choke point to audit if the READ-ONLY invariant is ever questioned.
