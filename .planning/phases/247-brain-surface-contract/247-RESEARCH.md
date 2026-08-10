# Phase 247: Brain Surface Contract - Research

**Researched:** 2026-08-10
**Domain:** Cross-repo MCP tool-surface contract (plugin client + brain server + Render deployment)
**Confidence:** HIGH (nearly all findings verified against live code, git history, and a live server probe this session)

## Summary

The deployed Brain surface is bigger and looser than anyone downstream assumes: 23 public read tools are registered in `buildBrainServer()` on origin/main, and the deployed tier gate is a DENYLIST (only the 5 admin tools 403) - so every read key can reach `text2cypher` and `brain_ask_anything` today, both of which fail with Ollama ECONNREFUSED because Render has no LLM sidecar by design. Meanwhile the plugin's production client reaches exactly 4 tools on a read key (`brain_ask`, `brain_search`, `brain_schema`, `brain_stats`); `brain_query` is admin-gated at the edge and silently returns null through the client, and NO production plugin code calls the 5 loop-contract tools yet - only `scripts/build-brain-census.cjs` does, through its own raw HTTP path. The contract this phase declares is therefore mostly aspirational on the client side and mostly over-broad on the server side, which is exactly why a conformance test matters.

The single most important operational finding: **the local brain checkout at `/home/jsagi/dev/ProblemsWorthSolving-Brain` is 15 commits BEHIND origin/main, and carries 4 files of UNCOMMITTED hardening work** (a deny-by-default `READ_TOOLS` allowlist in auth.mjs, a `sanitizeFields` source_file strip in brain_search, rate-limit and ingest-allowlist changes) written against the stale base. The deployed Render service builds from origin/main, which has neither. Half of CONTRACT-02 and CONTRACT-03 already exists as unshipped local drafts that must be reconciled with 15 newer commits before anything else in this phase proceeds. Separately, good news on CONTRACT-04: the e5-dimension guard at QUERY time already shipped (`a3612fb`/`0e79704`, `src/contracts/e5-identity.mjs`, live-verified this session via `brain_stats` returning `e5Queryable` per index) - only the guard at INDEX CREATION time (the migrate/build scripts that faithfully recreate all 9 indexes) remains.

**Primary recommendation:** Task 0 of this phase is a brain-repo state reconciliation (pull 15 commits, land or discard the 4 dirty files as reviewed commits); then declare the contract as one machine-readable JSON vendored in both repos with a three-legged conformance test (server self-test, client fixture, live drift probe); retire the two server-side-LLM tools from the remote surface via the deny-by-default allowlist rather than deregistration; strip source_file at the `scopedVectorSearch` seam; and drop the 6 reader-less 384-dim indexes with grep proof while wiring the existing e5-identity guards into the CREATE VECTOR INDEX paths.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONTRACT-01 | Loop-serving tool set declared as THE Brain contract in both repos, with a conformance test | Full surface census (server 23+5 tools, client 4 live entry points) below; conformance test design with three legs; contract-JSON pattern |
| CONTRACT-02 | brain_ask_anything + text2cypher retired from remote surface OR shipped with working sidecar; decision recorded | Both tools' failure mode traced (llm-provider Ollama, local-only by design); retirement touch-list enumerated; sidecar cost assessed; RETIRE recommended with reasons |
| CONTRACT-03 | search stops leaking source_file local paths; framework metadata populated or removed | Leak path traced end to end (ingest metadata JSON -> scopedVectorSearch -> raw passthrough in `search` on deployed HEAD); cheapest strip point identified; framework-field populate path via existing MENTIONS expansion |
| CONTRACT-04 | 8 foreign-space vector indexes get recorded dispositions per the never-re-embed rule; e5-dimension guard at index creation | All 9 indexes enumerated by name (live probe this session); per-index reader census with grep proof; query-time guard confirmed shipped; creation-time gap located in 2 scripts |
</phase_requirements>

## Project Constraints (from CLAUDE.md, both repos, and REQUIREMENTS.md)

- **Canon Part 8 untouchable:** this phase changes WHEN the Brain is reached and how loudly failure surfaces, never WHAT crosses the wire. Stripping source_file is provenance hygiene on the way OUT (removes leakage, adds nothing) - Part 8 clean. No LOCAL user data egresses, ever.
- **Part 7 reuse-before-build:** extend `brain-connector`; never mint a fourth brain skill (three exist: brain-connector, brain-derive, pws-brain). New client wrappers for contract tools go in `lib/core/brain-client.cjs`, not a new module.
- **Cross-repo definition of done:** "a requirement is not done until the surface a user reaches is fixed" - for every server-side change that means committed AND pushed AND Render redeployed AND re-probed live. The standing memory rule (`feedback_dev_repo_fix_not_live_until_released`) applies with force: the brain repo currently demonstrates the exact failure (fixes sitting uncommitted in a stale working tree).
- **Eval honesty:** a test that cannot fail is not evidence. The conformance test must go red on injected drift, proven.
- **langtalks scoping (navigator 2026-08-10):** mandatory for harness/context-engineering CONCEPTS; NOT the authority for stateless-MCP protocol mechanics (those go to claude-code-guide/Context7). See Grounding section.
- **No em-dashes anywhere** (test fence). CJS only in the plugin; the brain repo is ESM (.mjs) - respect each repo's convention.
- **Tri-Polar:** the contract is transport-level, surface-agnostic; the conformance probe must run from CLI at minimum, and nothing in the contract may be CLI-only in behavior.
- **GSD models directive:** planning/research on Fable, execution on Sonnet (config.json `_models_note`).
- **Plugin workspace guard:** all plugin work from `/home/jsagi/dev/MindrianOS-Plugin/`, never the install cache.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contract declaration (the JSON) | Shared artifact, vendored in BOTH repos | - | Drift between copies is itself a conformance failure; each repo tests against its own vendored copy plus the live surface |
| Tool registration + retirement | Brain server (`src/server.mjs`, `src/http/auth.mjs`) | Render deploy | Registration is code; reachability is the tier gate; the user-reached surface is the deployment |
| Tier gating (read vs admin, 403) | Brain HTTP edge (`src/http/auth.mjs` tierGate) | - | 403 fires BEFORE dispatch; deny-by-default is an edge property |
| 403-vs-unreachable distinction | Plugin client (`lib/core/brain-client.cjs` callTool) | - | Only the client sees HTTP status; the server already emits a typed MoatViolation body |
| source_file strip / framework populate | Brain server seam (`src/graph-client.mjs` scopedVectorSearch + `search` tool) | Ingest pipeline (write-side hygiene) | One seam covers all three consumers (search, brain_search, arm2-expansion); ingest fix alone leaves 12,401 stored chunks leaky |
| Vector index disposition + creation guard | Brain repo scripts (`scripts/build-vector-index.mjs`, `scripts/migrate-*.mjs`) + `src/contracts/e5-identity.mjs` | Memgraph on Render (the disk state) | Guards exist as pure functions; wiring them at CREATE call sites is script work; dropping indexes is a live-graph operation |
| Conformance test execution | Brain repo tests (self-test) + plugin tests (fixture) + either repo (live probe) | CI/release gates | Three legs, three failure classes: code drift, client drift, deploy drift |

## The Current Surface, Censused (CONTRACT-01 baseline)

### Server side - deployed (origin/main `0e79704`, live service pws-brain-mcp.onrender.com)

**23 public read tools registered in `buildBrainServer()`** (verified by enumerating `server.registerTool` on origin/main):

| Group | Tools |
|---|---|
| Loop contract (proposed) | `normalize_framework_name`, `search`, `discover_structure`, `orchestration_readiness`, `feeds_into_chains`, `brain_stats` |
| Orchestrator arm-1 (rest) | `load_framework`, `intra_framework_flow`, `framework_techniques`, `commands_for_problem_type` |
| Aura-era arm-1 | `classify_problem_type`, `find_frameworks_for_problem_type`, `find_commands_for_problem_type` |
| Graph analysis | `find_connections`, `find_bottlenecks`, `rank_influence`, `find_whitespace`, `structural_neighbours` |
| Drop-in plugin shapes | `brain_ask`, `brain_search`, `brain_schema` |
| Server-side LLM (CONTRACT-02) | `text2cypher`, `brain_ask_anything` |

**5 admin tools** (registered only on admin ctx via `registerAdminTools`; edge-gated by `WRITE_TOOLS`): `ingest_framework`, `raw_cypher`, `create_snapshot`, `brain_query`, `brain_write`.

**Deployed tier gate is a DENYLIST** (origin/main tierGate: only `WRITE_TOOLS` members 403 for non-admin; everything else passes). Consequence: read keys reach all 23 tools today, including the two broken LLM tools. A deny-by-default `READ_TOOLS` allowlist exists ONLY as uncommitted local work (see Repo-State Hazard).

### Client side - plugin (`lib/core/brain-client.cjs`, 83 importing files)

| Client entry point | Brain tool | Live status on a read key |
|---|---|---|
| `query(cypher, params)` | `brain_query` | **403 at the edge (admin-gated)** -> client returns null, indistinguishable from outage (the carried defect) |
| `search` / `smartSearch` | `brain_search` | Works |
| `schema()` | `brain_schema` | Works (30-min memo) |
| `stats()` | `brain_stats` | Works |
| `ask(q)` / `askOp(op, params)` | `brain_ask` | Works (NL + curated-op modes) |
| `write(cypher)` | `brain_write` | 403 (admin-gated) -> null |
| `sendPacket()` | `brain_packet` | PARKED (Phase 239); tool absent server-side |

**The 5 loop-contract tools have NO client wrapper and NO production caller in the plugin.** The only consumer is `scripts/build-brain-census.cjs`, which uses its own raw-HTTP `brainCall()` that DOES surface `httpStatus` verbatim (the precedent for the 403 fix). CONTRACT-01 therefore includes adding thin read-tier wrappers to brain-client (Part 7: extend, do not fork) so Phase 249 has a contracted path to write through.

### Conformance test design (the "what a conformance test looks like" answer)

One machine-readable contract document, vendored identically in both repos (recommend `docs/BRAIN-SURFACE-CONTRACT.md` prose + `data/brain-surface-contract.json` machine half in each repo, or plugin `data/` + brain `contracts/`):

```json
{
  "contract_version": 1,
  "loop_tools": {
    "normalize_framework_name": { "tier": "read", "args": { "raw": "string" } },
    "search":                   { "tier": "read", "args": { "query": "string", "topK": "int<=20" } },
    "discover_structure":       { "tier": "read", "args": { "framework_name": "string" } },
    "orchestration_readiness":  { "tier": "read", "args": { "framework_name": "string" } },
    "feeds_into_chains":        { "tier": "read", "args": { "seeds": "string[]", "max_hops": "int<=3" } },
    "brain_stats":              { "tier": "read", "args": {} }
  },
  "retired_remote": ["text2cypher", "brain_ask_anything"],
  "error_semantics": { "tier_denied": "HTTP 403 + MoatViolation body", "invalid_key": "HTTP 401" }
}
```

Three legs, each catching a different drift class:

1. **Server self-test (brain repo, hermetic):** build `buildBrainServer()` in-process, list its tools, assert every contract tool is registered with a matching input-schema shape, and assert every `retired_remote` tool is absent from the read-reachable set (registration conditional or allowlist - see CONTRACT-02). Follows the existing `tests/*.test.mjs` node --test pattern (`tool-description-honesty.test.mjs` is the precedent for asserting registered surface properties).
2. **Client fixture test (plugin, hermetic):** assert brain-client's contract wrappers emit exactly the contracted tool names and argument shapes (inject a fake transport via the existing `__transport`/callTool seam; `tests/` has many precedents). Assert the vendored contract JSON in the plugin byte-matches the expected version.
3. **Live drift probe (either repo, networked, release-gate not commit-gate):** `tools/list` against the deployed URL with a read key (tools/list is in the protocol-methods pass-through, so a read key suffices) and diff names against the contract. A retired tool appearing, a contract tool missing, or a schema drift turns it red. This is the leg that catches "fixed in git, stale on Render" - the failure mode this project has hit four times.

Eval-honesty proof: each leg ships with one deliberate-drift red proof (e.g. a test asserting the self-test FAILS when a tool is renamed in a sabotage seam - the brain repo's `red-proof.mjs` pattern already exists for exactly this).

## Repo-State Hazard (blocks everything; Task 0)

| Fact | Evidence |
|---|---|
| Local brain checkout HEAD is `6244be4` (2026-07-22) | `git log -1` this session |
| origin/main is `0e79704`, **15 commits ahead** | `git fetch` + `rev-list --count` this session |
| The deployed Render service builds from origin/main | render.yaml + consumption handoff ("`pws-brain-db` went live... on commit `3e057e2`"; live brain_stats matches 0e79704's `e5Queryable` output, not local HEAD's) |
| 4 files carry UNCOMMITTED changes on the stale base | `git status`: `src/http/auth.mjs` (+79: READ_TOOLS deny-by-default allowlist, Supabase-plan tiering comments), `src/server.mjs` (+25: sanitizeFields source_file strip in brain_search), `src/http/rate-limit.mjs` (+36), `src/ingest/allowlist.mjs` (+40) |

The uncommitted auth.mjs already withholds `text2cypher` from READ_TOOLS ("registered but withheld pending the D7 eval") and the uncommitted server.mjs already strips absolute paths in `brain_search` - i.e. drafts of CONTRACT-02 and CONTRACT-03 exist but are invisible to the deployed surface and were written without knowledge of the 15 newer commits (which include the dimension guard, the tool-description honesty test, ingest fixes, and a router lowercase fix). **First plan of this phase: `git stash`/branch the dirty files, pull to 0e79704, re-apply and reconcile as reviewed commits.** Do not write new contract code against the stale base.

Also on origin/main and relevant: the brain repo has its OWN open GSD work packet (`docs/2026-08-09-GSD-TAKEOVER-nl-answer-quality.md`) about the brain_ask NL path. It is orthogonal to this phase (it targets answer quality, not surface shape) but its "WHAT ALREADY SHIPPED - do not redo" and "EXPLICITLY NOT IMPROVEMENTS" lists bind; the contract work must not collide with its Wave 1.

## CONTRACT-02: the two server-side-LLM tools

**Failure mode, traced:** both route through `src/llm-provider.mjs`; the default provider is local Ollama (free, on-box, no egress by design). Render has no Ollama, so remote calls die ECONNREFUSED - confirmed by the 2026-08-10 probe. `text2cypher` additionally carries its own probation record (measured 1/22 on Brain-shaped questions; G3 wrapper exists) and is already deliberately absent from the drafted READ_TOOLS allowlist.

**Retirement touch-list (RETIRE option):**

| Touch | Where | Note |
|---|---|---|
| Tier gate: adopt deny-by-default READ_TOOLS allowlist, with `text2cypher` AND `brain_ask_anything` absent | brain `src/http/auth.mjs` (uncommitted draft exists; currently includes brain_ask_anything - remove it) | Cheapest lever; the tools stay registered but a read key gets a crisp 403 MoatViolation instead of an ECONNREFUSED-shaped error |
| Registration: keep both registered on the stdio/local ctx (where Ollama exists), or gate registration on transport like admin tools | brain `src/server.mjs` | Preserves local dev capability; the remote surface is what retires |
| Tool-description honesty | brain `tests/tool-description-honesty.test.mjs` (exists on origin/main) | Descriptions must not promise a remote capability the gate refuses |
| Conformance contract: list both under `retired_remote` | both repos | The live probe then permanently enforces the retirement |
| Plugin code | NONE - zero code references (grep: only `docs/` mentions) | No plugin release needed for this leg |
| Docs | brain CLAUDE.md, consumption handoff addendum; plugin build-the-loop handoff already records the intent | Record the decision + reasoning per the requirement text |

**Sidecar option, costed:** Render has no sidecar concept inside one web service; an Ollama deployment means a separate private service. A usable model (e.g. 7-8B class) needs several GB RAM beyond the current Standard 2GB Memgraph instance, on CPU-only inference where a single synthesis answer takes tens of seconds to minutes [ASSUMED: exact Render plan pricing and CPU inference latency not verified this session - no WebSearch performed per the MCP-stack-awareness rule]. Even at best-case latency it collides with the plugin's 20s client timeout (`BRAIN_REQUEST_TIMEOUT_MS`) and adds a monthly bill for a capability the architecture of record explicitly assigns elsewhere.

**Recommendation: RETIRE from the remote surface.** The decisive argument is not cost but the architecture of record (navigator, 2026-08-10): "reasoning belongs to Larry, not the Brain." The loop's synthesizer is the client-side model operating the join; a server-side LLM is a second reasoning brain the design forbids. Cost and latency merely confirm it. Record the decision with this reasoning; keep local-stdio capability so the brain repo's own dev/eval work (text2cypher eval gate) is untouched.

## CONTRACT-03: source_file leak + framework field

**Leak path, end to end:** ingest writes chunk metadata as a JSON string on `MethodologyChunk.metadata` carrying the AUTHOR'S absolute paths (live example from the working tree comment: `"source_file":"/home/jsagi/MindrianV2/prompts/jtbd.py"`). Backend `vectorSearch` returns it; `scopedVectorSearch` (src/graph-client.mjs) normalizes to `{id, score, rawCosine, metadata}` and passes metadata through untouched; the `search` tool (a LOOP CONTRACT tool) serves `{...h, downstream}` raw - this is the deployed leak. `brain_search` on origin/main also serves it raw (the sanitizeFields fix is uncommitted-local-only). `arm2-expansion.mjs` reads `parsed.source_file` for ask-anything source attribution.

**Cheapest strip point: `scopedVectorSearch` in `src/graph-client.mjs`.** One seam, three consumers covered (search, brain_search, arm2-expansion), zero data migration, reversible. Hoist the uncommitted `sanitizeFields` pattern (regex `^(?:[/~]|[A-Za-z]:[\\/]|\\\\)` -> keep only the path leaf) from brain_search into the seam; the leaf preserves "which file taught this" for arm2's `source` attribution and the id remains the durable provenance handle. Do NOT fix per-tool (the uncommitted approach) - that leaves `search` leaking, which is the tool the probe actually caught. Optional second belt: relativize at ingest (`src/ingest/` pipeline) so NEW chunks never store absolute paths; the stored-data migration of 12,401 existing chunks is NOT needed once the read seam covers every exit (verify by grepping for other `vectorSearch`/metadata consumers - this session found exactly three).

**Test:** a served `search` and `brain_search` response for a known query asserts no value matches the ABS_PATH regex. Hermetic version via a fixture hit with a poisoned metadata field through the seam function directly.

**framework field: POPULATE, from the graph, at the same seam the tool already queries.** The `search` tool already runs a MENTIONS-based expansion Cypher (`chunk-[:MENTIONS]->(x)-[:FEEDS_INTO*1..3]->(m)`). Add a direct leg collecting `chunk-[:MENTIONS]->(f:Framework) | f.name` in the same round trip and emit it as the `framework` field (array or first-hit). This is one extra collect on a query already paid for. Precondition to verify in-plan (one Cypher, Lane A read tier): what fraction of curated chunks have at least one MENTIONS edge to a Framework node - if coverage is thin (below roughly half), DROP the field from the payload instead; the requirement allows either, and forbids only "silently empty." The ingest-time alternative (backfill metadata.framework on 12,401 chunks) is a data migration with no consumer advantage over the query-time join - not recommended.

## CONTRACT-04: the 9 vector indexes

Live-enumerated this session via a read-key `brain_stats` call to pws-brain-mcp.onrender.com (the deployed server already classifies them - `e5Queryable` per row + a `vectorIndexSpaces.foreignSpace` summary, shipped in `a3612fb`):

| # | Index | Dim | e5-queryable | Readers found (grep of src/ + scripts/, both checkout states) | Disposition (recommended) |
|---|---|---|---|---|---|
| 1 | `mindrian_methodology_vec` | 1024 | YES | Entire search path (E5_INDEX; publicSearchIndexSchema; brain_search; stats) | KEEP - the corpus index, the contract's substrate |
| 2 | `mindrian_methodology_vec_openai` | 1536 | no | `embedForIndex` secondary path (egress-guarded, schema-retired); `scripts/capture-overlap-baseline.mjs` (diagnostic eval baseline) | DECIDE: drop after the overlap baseline is declared historical or re-captured; until then KEEP-RETIRED (unreachable from the public schema already) |
| 3 | `framework_embeddings` | 384 | no | `scripts/compare-backends.mjs:247` only (historical parity diagnostic) | DROP with proof: neutralize/annotate the diagnostic, then drop |
| 4-9 | `concept_embeddings`, `creativework_embeddings`, `entity_embeddings`, `person_embeddings`, `product_embeddings`, `vector` | 384 | no | **ZERO readers** in src/ or scripts/ (this session's grep; they are GraphRAG-era entity embeddings the 2026-07-22 migration faithfully recreated, "dead ones included" per the consumption handoff) | DROP with grep proof filed |

Per the brain repo's own rule (README/handoff: "never re-embed; vectors are copied verbatim; if you rebuild an index, use the model that built it"): none of the 8 warrants a rebuild - the models that built the 384-dim entity embeddings serve no live retrieval path, so the rule's other branch applies: drop with proof nothing reads them. Dropping also reclaims RAM on a 2GB in-memory Memgraph instance. The consumption handoff's own caution ("Do not drop indexes before establishing what still reads the 384-dim ones") is now satisfied by the reader census above - file it as the proof artifact.

**e5-dimension guard at index creation - the remaining gap:** the guard FUNCTIONS shipped (`src/contracts/e5-identity.mjs`: `assertE5Identity`, `isE5Queryable`, `assertSearchIndexRegistered`, `assertVectorMatchesIndex`; wired into the QUERY path and into ingest via `embed-or-quarantine.mjs`). But the CREATE paths do not consult them: `scripts/build-vector-index.mjs` hard-codes DIM=1024 without the shared constant/guard, and `scripts/migrate-neo4j-to-memgraph.mjs` (and the memgraph-to-memgraph sync) generically recreate EVERY source index - which is exactly how the 8 foreign ones got to Render. Wire-up: creation call sites import E5_DIM/assertions from e5-identity.mjs, and the migrate scripts refuse to recreate a non-1024 index unless an explicit `--include-foreign` flag is passed (fail closed, matching the repo's own doctrine). Test: hermetic red-proof that a 384-dim recreate without the flag throws.

## The 403 Fix Boundary (research question 5)

**Recommendation: the transport-level distinction lands in THIS phase (247); the user-visible refusal lands in Phase 250.**

The defect (verified live in 246 research): `brain-client.callTool` returns null on ANY non-OK status, so a read-tier 403 (MoatViolation on `brain_query`) is indistinguishable from an unreachable Brain or a missing key. Why 247, not 250:

1. **Error semantics ARE the contract.** CONTRACT-01's conformance test must specify what a client observes on tier denial vs outage (`error_semantics` in the contract JSON above); a client that cannot observe the difference cannot be conformance-tested. Leaving the conflation in place makes leg 2 of the test unwritable.
2. **Phase 249 depends on it.** Enrichment reads readiness "through the contracted surface" (roadmap); a tier-denied write path mistaken for an outage would silently drop queue entries. 247 runs in Wave 2, 249 in Wave 3 - the fix must precede 249, and 250 runs after 249.
3. **The precedent already exists in the same function family.** `_ensureSession` already returns a typed `{error: 'invalid_key'}` sentinel for 401 instead of null. Extending `callTool` to parse a 403 body (the server's MoatViolation shape is stable and pinned by tests) into `{error: 'tier_denied', tool, message}` is the same pattern, roughly 15 lines, and every existing caller that checks `result == null` keeps working (sentinels are objects, but callers that today treat any non-record shape as degraded already pass them through - mirror the invalid_key handling).

**What stays in 250:** making the sentinel LOUD. 247 makes the client honest to CODE (callers can distinguish); 250's honesty rail makes it honest to the USER (visible refusal, provenance). Do not let 247 grow user-facing messaging - that is HONEST-01's scope and it needs the enrichment queue live to refuse INTO.

## Standard Stack

No new packages in either repo. This phase is code + tests + one JSON artifact on existing infrastructure.

### Core (all already installed/vendored)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` (plugin) / `@modelcontextprotocol/server` (brain) | vendored | MCP surface both sides | Existing; contract work reads tools/list, registers nothing new |
| `zod` | ^3 (both repos) | Tool input schemas; contract-shape assertions | Already the schema layer server-side |
| `node --test` | Node >=22.16.0 | Test runner both repos (`.test.cjs` plugin, `.test.mjs` brain) | Existing convention; no framework install |
| Node global `fetch` | built-in | Live drift probe + census brainCall pattern | Existing pattern in build-brain-census.cjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vendored contract JSON in both repos | Single shared npm package or git submodule | Cross-repo dependency machinery for a <2KB file; vendored copies + byte-match assertion is simpler and drift IS the signal being tested |
| Allowlist retirement (tier gate) for CONTRACT-02 | Deregistration on HTTP ctx | Deregistration loses local-stdio capability and complicates the shared factory; the allowlist is one set-membership and already drafted |
| Query-time framework populate | Ingest backfill migration | Migration touches 12,401 stored chunks for zero consumer benefit; query-time join rides an already-paid round trip |

**Installation:** none.

## Package Legitimacy Audit

No new packages are installed by this phase. All work uses dependencies already vendored in both repos. slopcheck not run - nothing to check.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path detection/stripping | A new path regex | The uncommitted `sanitizeFields` ABS_PATH regex + leaf-keep, hoisted to the seam | Already handles POSIX, Windows drive, UNC, `~`; already reviewed |
| Index-space guards | New dimension checks in scripts | `src/contracts/e5-identity.mjs` exports (E5_DIM, assertVectorMatchesIndex, assertSearchIndexRegistered) | Shipped, red-proof-tested; duplicating constants recreates the drift class the module exists to kill |
| Red-proof of the conformance test | Ad-hoc "trust me it can fail" | brain repo `tests/helpers/red-proof.mjs` sabotage-seam pattern | Existing, and prod boot refuses when the opt-in is armed (H4) |
| Raw HTTP tool calls for the live probe | A new HTTP client | `scripts/build-brain-census.cjs` `brainCall()` pattern (surfaces httpStatus verbatim) | Already the plugin's precedent for status-honest Brain calls |
| Typed error sentinels in brain-client | A new error taxonomy | The existing `{error: 'invalid_key'}` sentinel pattern in `_ensureSession` | Callers already understand sentinel-object passthrough |

**Key insight:** almost every primitive this phase needs already exists in one of the two repos - the phase's real work is reconciliation, wiring, declaration, and proof, not invention.

## Common Pitfalls

### Pitfall 1: Fixing the working tree, shipping nothing
**What goes wrong:** contract code lands in the stale local brain checkout (or even in origin/main) and the deployed surface never changes; the conformance probe would catch it, but only if it runs against the LIVE URL.
**Why it happens:** 15-commit drift + 4 dirty files today; Render redeploy is a separate manual act; four prior occurrences of "fixed but not live" in three weeks.
**How to avoid:** Task 0 reconciliation; the live drift probe is a required release gate; every server-side success criterion re-probed against pws-brain-mcp.onrender.com.
**Warning signs:** a plan step that ends at "commit" for any brain-repo change.

### Pitfall 2: Retiring the LLM tools by deregistration and breaking local dev
**What goes wrong:** removing `registerTool('text2cypher'...)` kills the brain repo's own eval gate (`compare-text2cypher.mjs`, the nlAnswerAccuracy baseline) and local stdio usage.
**How to avoid:** retire at the TIER GATE (remote read surface) and/or condition registration on ctx/transport like admin tools; the stdio ctx keeps them.
**Warning signs:** brain repo tests failing on tool absence after the change.

### Pitfall 3: Declaring the contract against the local code instead of the deployed truth
**What goes wrong:** the contract JSON is written from the working tree (which today has a different auth surface than production) and the conformance test is born green against code and red against reality, or vice versa.
**How to avoid:** the contract's first committed version must match what the phase intends to DEPLOY, and the phase does not close until the live probe is green against it.

### Pitfall 4: The 403 sentinel breaking null-checking callers
**What goes wrong:** 83 files import brain-client; changing callTool's non-OK return from null to a sentinel object could surprise callers that do `if (result)`.
**How to avoid:** mirror the invalid_key precedent exactly (it already returns through the same path and callers survive); audit the small set of `callTool` direct callers (query/search/schema/stats/ask/askOp/write and sendPacket transport) - `query()` already passes through `{error:...}` shapes unchanged. Add a regression test per public wrapper.
**Warning signs:** degradation tests (82 of them, Phase 252's inventory) flipping unexpectedly - touch only the transport layer, not `isAvailable()` semantics.

### Pitfall 5: Dropping an index something still reads
**What goes wrong:** an unfound reader (an ad-hoc notebook, an Aura-era agent config) queries a dropped 384-dim index.
**How to avoid:** the disposition matrix files the grep proof; `assertIndexReady`/`assertSearchIndexRegistered` already fail CLOSED on unknown indexes, so a stale reader gets a loud E5IdentityViolation, not silence. Snapshot before dropping (`create_snapshot` admin tool exists).

### Pitfall 6: Contract scope creep into the other 17 read tools
**What goes wrong:** the phase tries to adjudicate all 23 tools (retire the Aura-era trio, the analysis tools, etc.).
**How to avoid:** CONTRACT-01 declares the 6 loop tools as THE contract and 2 tools as retired; the other 15 are explicitly NON-CONTRACT (neither promised nor removed) - record that as a one-line status in the contract doc and move on. The consumption-surface handoff's atomic-primitives design debate is real but out of this phase's scope.

## Runtime State Inventory

(Included because index disposition is a live-service state change, not a code edit.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 8 foreign-space vector indexes on the Render Memgraph disk (live-enumerated this session); 12,401 chunk metadata JSON strings carrying absolute paths | Index drops are a live-graph operation (admin tier, snapshot first); metadata strings stay as-is (read-seam strip covers all exits) |
| Live service config | Render env (BRAIN_HTTP_STRICT_TOOL_GATE not currently set; allowlist rollout may need it); deployed commit tracks origin/main | Redeploy after push; verify env var posture for the new tierGate |
| OS-registered state | None found | None |
| Secrets/env vars | Read key in `~/.mindrian.env` (valid, verified live); admin key NOT present locally (Lane B pending per census) | Index drops + any brain_query verification need the admin key - operator checkpoint, same as census Lane B |
| Build artifacts | None - no compiled artifacts in either repo | None |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node --test (both repos); bash phase runners in plugin (`tests/run-all-<phase>.sh`) |
| Config file | none needed (convention-based) |
| Quick run command | plugin: `node --test tests/<file>.test.cjs`; brain: `node --test tests/<file>.test.mjs` |
| Full suite command | plugin: `bash tests/run-all-247.sh` (to be created); brain: `node --test tests/` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONTRACT-01 | Server registers exactly the contract set; retired tools unreachable on read tier | unit (hermetic, brain) | `node --test tests/surface-contract.test.mjs` | Wave 0 (brain repo) |
| CONTRACT-01 | Client wrappers emit contracted names/args; vendored JSONs byte-match | unit (plugin) | `node --test tests/247-contract-client.test.cjs` | Wave 0 |
| CONTRACT-01 | Live deployed surface matches contract (drift -> red) | integration (networked, release gate) | `node scripts/probe-brain-contract.cjs` (new; brainCall pattern) | Wave 0 |
| CONTRACT-02 | Read key calling text2cypher / brain_ask_anything gets 403 MoatViolation | unit (brain tierGate) + live probe leg | part of surface-contract tests | Wave 0 |
| CONTRACT-03 | No served search/brain_search value matches ABS_PATH; framework field non-empty or absent | unit (seam fn) + integration | `node --test tests/search-provenance-hygiene.test.mjs` | Wave 0 (brain) |
| CONTRACT-04 | Foreign-index recreate without flag throws; disposition matrix filed with reader proof | unit (red-proof) + artifact | `node --test tests/index-creation-guard.test.mjs` | Wave 0 (brain) |
| 403 fix | callTool returns tier_denied sentinel on 403, null only on transport failure | unit (plugin, fake transport) | `node --test tests/247-brain-client-403.test.cjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** the touched repo's targeted test file
- **Per wave merge:** both repos' full node --test suites
- **Phase gate:** full suites green + LIVE drift probe green against pws-brain-mcp.onrender.com

### Wave 0 Gaps
- [ ] `data/brain-surface-contract.json` + prose doc, vendored both repos
- [ ] brain `tests/surface-contract.test.mjs` (self-test + tier-gate assertions + red proof)
- [ ] plugin `tests/247-contract-client.test.cjs`, `tests/247-brain-client-403.test.cjs`
- [ ] brain `tests/search-provenance-hygiene.test.mjs`, `tests/index-creation-guard.test.mjs`
- [ ] plugin `scripts/probe-brain-contract.cjs` (live leg) + `tests/run-all-247.sh`

## Grounding (research question 6: langtalks + sources per the scoping rule)

The langtalks-graph-expert MCP tools were **not exposed to this researcher subagent's environment** (no `mcp__langtalks-graph-expert__*` tools available; no CLI fallback exists). However, the mandated concepts were consulted against the corpus in the same week by first-party sessions, and the results are filed in tracked documents - cited here with dates rather than re-derived:

- **Tool-count context cost:** consulted 2026-08-07/09 (brain repo `docs/2026-08-07-brain-for-harness-design.md` + consumption handoff section 5). Corpus position: MCP loads every tool schema eagerly. CORRECTED for this host: Claude Code lists tool NAMES and defers full schemas via tool search - so the 23->6 narrowing argument is architectural (judgement visibility, drift surface), not primarily context cost. The contract's value claim should cite the architectural argument. [CITED: ProblemsWorthSolving-Brain docs, origin/main]
- **Progressive disclosure:** typed-edge finding on record 2026-08-10 (build-the-loop handoff section 3): "Skills load via Metadata - progressive disclosure" ("Agent Skills, Explained", Memgraph episode). Supports declaring a SMALL contract surface and keeping the other 15 tools non-contract rather than exposing everything. [CITED: docs/2026-08-10-HANDOFF-build-the-loop-milestone.md]
- **Contract testing between agent and tool layer:** confirmed CORPUS WHITESPACE. The 2026-08-09 consumption handoff section 3 records the corpus as having NOTHING on graph/tool-surface versioning, groundedness scoring, QA pairs, or staleness - with the explicit instruction "Do not go looking again." The conformance-test design above is therefore first-party doctrine, owned as our own decision, with the shadow-run pattern (ep65) as the nearest sourced adjacent for "measure against live traffic." "Not in corpus" is the valid, recorded answer for this concept. [CITED: docs/2026-08-09-HANDOFF-brain-consumption-surface.md, origin/main]
- **Stateless-MCP/protocol mechanics** (tools/list semantics, tierGate behavior, JSON-RPC shapes): grounded in direct code reading + a live server probe this session, per the navigator's scoping rule (these do NOT go to langtalks). No Context7 lookup was needed - no external library API claims are load-bearing in this research beyond code already in the repos.

If the planner wants a fresh langtalks pass for the contract-design leg, run it from the main session (`relationship_path` point-to-point, e.g. "contract" -> "tool"); expect the recorded whitespace answer.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Render plan pricing / CPU-Ollama latency figures ("several GB RAM", "tens of seconds to minutes", monthly cost) | CONTRACT-02 sidecar costing | LOW - the RETIRE recommendation rests on the architecture of record, not the cost figures; if a sidecar were somehow cheap and fast the architectural argument still decides |
| A2 | Render auto-deploys from origin/main pushes (vs manual deploy trigger) | Repo-State Hazard, Pitfall 1 | If manual, the live probe still catches it; a plan step should verify the Render deploy trigger setting at execution time |
| A3 | The 6x384 entity indexes have no reader outside these two repos (e.g. an old Aura agent config or notebook) | CONTRACT-04 | Fail-closed guards mean a stale reader errors loudly rather than silently; snapshot-before-drop bounds the damage |
| A4 | MENTIONS-to-Framework coverage is sufficient to populate the framework field | CONTRACT-03 | Explicit in-plan verification Cypher specified; DROP branch defined if thin |

## Open Questions

1. **Who reconciles the 4 dirty brain-repo files - this phase or a brain-repo-side session?**
   - What we know: they draft CONTRACT-02/03 work; they conflict-risk with 15 newer commits; the brain repo has its own open GSD packet.
   - Recommendation: this phase owns it (Task 0), because the contract cannot be declared over an unreconciled surface; coordinate with the brain packet's "do not redo" list.
2. **mindrian_methodology_vec_openai final fate** (the one genuinely open disposition).
   - What we know: schema-retired, egress-guarded, but it backs `capture-overlap-baseline.mjs` (a filed eval baseline).
   - Recommendation: keep-retired this phase with the decision recorded; drop in a later phase if the overlap baseline is declared historical. Requirement is satisfied either way (a recorded disposition, not necessarily a drop).
3. **Does the contract JSON pin full input schemas or names + arg keys only?**
   - What we know: zod schemas exist server-side; full JSON-schema export adds fidelity but also brittle churn.
   - Recommendation: v1 pins names, tier, and required arg names/types (the table above); schema-hash pinning is a v2 option once the surface is stable.
4. **Admin key availability for index drops** (Lane B operator checkpoint, same blocker as census Lane B).
   - Recommendation: plan the drops as a checkpoint:human-verify task with the operator supplying the admin key, mirroring the census pattern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Brain repo checkout | all server-side work | YES (stale: 15 behind + 4 dirty) | HEAD 6244be4 | git fetch verified working this session |
| Live Render service + read key | live probes, conformance leg 3 | YES (probed this session, ~1s) | commit tracks origin/main 0e79704 | none needed |
| Admin key | index drops, brain_query verification | NO (not on this machine) | - | operator checkpoint (census Lane B precedent) |
| Ollama on Render | sidecar option | NO (by design) | - | RETIRE recommendation |
| node --test | all tests | YES (Node >=22.16.0 floor, plugin CLAUDE.md) | - | - |
| langtalks MCP | grounding | NO (not exposed to this subagent) | - | same-week filed consultations cited; main-session re-consult optional |

**Missing dependencies with no fallback:** none blocking. Admin-key tasks become operator checkpoints, not blockers.

## Sources

### Primary (HIGH confidence)
- Live probe of `pws-brain-mcp.onrender.com` `brain_stats` this session (9 index names, dimensions, e5Queryable classification, node/rel counts matching census)
- `jsagir/ProblemsWorthSolving-Brain` origin/main `0e79704`: src/server.mjs (23 registrations), src/http/auth.mjs (denylist tierGate), src/contracts/e5-identity.mjs (guards), src/graph-client.mjs (scopedVectorSearch seam), docs/2026-08-09-HANDOFF-brain-consumption-surface.md, docs/2026-08-09-GSD-TAKEOVER-nl-answer-quality.md, CLAUDE.md
- Local brain working tree (git status/diff: 15-behind + 4 dirty files; uncommitted READ_TOOLS + sanitizeFields drafts)
- Plugin repo: lib/core/brain-client.cjs (full read), scripts/build-brain-census.cjs (brainCall httpStatus pattern), docs/BRAIN-GRAPH-CENSUS.generated.md (Lane A census), .planning/phases/246-live-verification-graph-census/246-RESEARCH.md (403 conflation, verified live 2026-08-10)
- docs/2026-08-10-HANDOFF-build-the-loop-milestone.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md

### Secondary (MEDIUM confidence)
- render.yaml + docs/2026-07-22-DEPLOY-STATE-AND-DECISION.md (deploy topology; the auto-deploy trigger itself is A2)

### Tertiary (LOW confidence)
- Render pricing / CPU Ollama latency (A1, [ASSUMED], flagged; not decision-load-bearing)

## Metadata

**Confidence breakdown:**
- Surface census + repo-state hazard: HIGH - direct code enumeration + live probe + git evidence
- CONTRACT-02 retirement recommendation: HIGH on the decision (architecture of record + traced failure mode), LOW on sidecar dollar figures (irrelevant to the outcome)
- CONTRACT-03 seam choice: HIGH - all three metadata consumers found and read
- CONTRACT-04 dispositions: HIGH for readers-in-repo proof; MEDIUM for out-of-repo readers (A3, fail-closed guards bound the risk)
- 403 boundary recommendation: HIGH - grounded in wave ordering, existing sentinel precedent, and 249's dependency

**Research date:** 2026-08-10
**Valid until:** ~2026-08-24 (the brain repo is actively moving - re-verify the origin/main drift count and the dirty-file state at plan time)
