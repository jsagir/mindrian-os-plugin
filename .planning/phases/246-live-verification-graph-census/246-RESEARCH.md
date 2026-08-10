# Phase 246: Live Verification + Graph Census - Research

**Researched:** 2026-08-10
**Domain:** Brain MCP verification path (plugin hooks + client) and Memgraph methodology-graph census
**Confidence:** HIGH (grounded in live probes run this session, repo source in both repos, and the 2026-08-09/2026-08-10 handoffs)

## Summary

Phase 246 has two legs. LOOP-01 proves the beta.13 Brain path live from a FRESH session (this
research session, like the 2026-08-10 session, cannot self-verify hook behavior; the fresh-session
test is a human checkpoint by construction). LOOP-02 files a Cypher census of the methodology
graph as a tracked artifact with a usage-ranked gap list.

Three live probes run during this research materially change the plan:

1. **beta.13 is installed and picked up on this machine.** The plugin cache at
   `~/.claude/plugins/cache/mindrian-marketplace/mos/1.16.0-beta.13/` exists, is the active
   user-scope install (per `installed_plugins.json`, lastUpdated 2026-08-10T07:43Z), and carries
   BOTH fixes (array-shaped `updatedToolOutput` in the sanitize hook; widened
   `BRAIN_TOOL_MATCHER`). A fresh session started now loads the fixed code. Only sessions started
   before the update run stale. [VERIFIED: cache inspection this session]
2. **The current MINDRIAN_BRAIN_KEY is READ-tier, not admin.** A live content-free
   `brain_query` probe returned HTTP 403 `MoatViolation: tool "brain_query" requires the admin
   tier`, while `brain_stats` succeeded (28,325 nodes / 23,014 rels, backend memgraph). The
   census as scoped ("brain_query via the plugin MCP") CANNOT run on the current key. The
   deployed server gates raw Cypher behind `BRAIN_HTTP_ADMIN_KEYS`
   (`ProblemsWorthSolving-Brain/src/http/auth.mjs`). [VERIFIED: live probe 2026-08-10]
3. **Most of the census does NOT need admin.** The per-framework gap map (readiness, structure,
   aliases) is answerable through the UNGATED read tools the deployed server registers
   (`normalize_framework_name`, `discover_structure`, `orchestration_readiness`,
   `feeds_into_chains`, `brain_stats`) - exactly the loop-serving contract set of Phase 247.
   Only the AGGREGATE counts (label census, edge-type counts, duplicate-name scan) need raw
   Cypher and therefore the admin key. [VERIFIED: server.mjs + auth.mjs source]

**Primary recommendation:** Split the census into two lanes. Lane A (read key, ungated tools):
per-framework readiness/structure/alias probes for every framework the methodology commands
invoke, confirming the 2026-08-10 findings on the record. Lane B (admin key, `brain_query`,
content-free aggregates): label census, HAS_* structure coverage, FEEDS_INTO/LEADS_TO counts,
duplicate-name scan. LOOP-01 runs first as a fresh-session human checkpoint using the exact
three-call spec below; the Lane B census rides the same verified plugin-scope `brain_query`
path once the operator supplies the admin key for that session.

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|------------------|
| LOOP-01 | Fresh session on beta.13+ passes the three-call Brain test; failures reported verbatim | Three-call spec with exact plugin-scope tool names, expected outputs, and the five-signature failure decode table below; cache-state evidence that beta.13 is picked up; human-checkpoint requirement grounded in the restart-to-apply lesson |
| LOOP-02 | Cypher census filed as a tracked artifact: Framework totals, HAS_* structure, FEEDS_INTO/LEADS_TO counts, top gaps by expected-use | Dialect-portable content-free query set; two-lane tool-surface design (read-tool lane + admin Cypher lane); admin-tier prerequisite discovered live; artifact location precedent (`build-corpus-stats.cjs` -> `docs/*.generated.md` + `data/*.generated.json`); concrete expected-use join method with the frequency table already computed |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Three-call live test | Claude Code host session (fresh) | Plugin hooks (Pre/PostToolUse) | Only a live session exercises matcher + envelope; scripts bypass hooks |
| Egress guard (Part 8) | Plugin PreToolUse hook + `query()` backstop | Server (moat gate) | Guard classifies before the wire; server moat caps are defense-in-depth |
| Response sanitize | Plugin PostToolUse hook | - | The fixed envelope is the thing under test |
| Census aggregates (Cypher) | Render HTTP edge (`brain_query`, admin-gated) | brain-client transport | Raw Cypher never runs ungated; 403 at the edge before dispatch |
| Census per-framework probes | Render ungated read tools | - | `orchestration_readiness` etc. carry no raw Cypher; read key suffices |
| Census artifact | Repo tracked file (`docs/` + `data/`) | - | `.planning/*` is gitignored (only `debug/` excepted); downstream phases cite the artifact |
| Expected-use ranking | Local repo (commands frontmatter) | - | `frameworks:` frontmatter on `kind: methodology` commands is on disk; no network needed |

## LOOP-01: The Fresh-Session Three-Call Test (exact spec)

**This MUST be a fresh-session human checkpoint.** The current session (and any session started
before 2026-08-10T07:43Z) may run on a pre-beta.13 loaded cache; hooks are read at session
start. The standing rule applies verbatim: a fix is not live until released AND picked up
(memory: `feedback_dev_repo_fix_not_live_until_released`). Release shipped (v1.16.0-beta.13,
2026-08-10, npm + tag + marketplace verified per CLAUDE.md); pickup verified on disk this
session; SESSION pickup requires restart. Plan this as `checkpoint:human-verify`.

### Pre-checks (fresh session, before any Brain call)

```bash
# 1. Installed cache is beta.13+ (verified true as of 2026-08-10T07:43Z):
python3 -c "import json;d=json.load(open('$HOME/.claude/plugins/installed_plugins.json'));print(d['plugins']['mos@mindrian-marketplace'])"
# expect: version 1.16.0-beta.13, installPath .../mos/1.16.0-beta.13

# 2. Key resolves (never print the key):
node -e "const r=require('/home/jsagi/dev/MindrianOS-Plugin/lib/core/resolve-brain-key.cjs').resolveBrainKey();console.log(r.available, r.source, r.reason||'')"
# verified this session: available=true source=env

# 3. Render deployment healthy:
curl -s https://pws-brain-mcp.onrender.com/health   # verified: {"status":"ok","graph":true}
```

### The three calls (plugin-scope tool names)

The plugin is named `mos`; the bundled Brain MCP server is `mindrian-brain` (`.mcp.json`). The
live plugin-scope tool names are therefore `mcp__plugin_mos_mindrian-brain__<tool>`. The hook
matcher `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*` covers these AND a bare
`mcp__mindrian-brain__*` project-scope registration. It does NOT cover
`mcp__pws-brain-mcp__*`. [VERIFIED: `lib/core/brain-response-sanitize.cjs:61`, `hooks/hooks.json:236,338`]

| # | Tool call | Expected output |
|---|-----------|-----------------|
| 1 | `mcp__plugin_mos_mindrian-brain__brain_stats` `{}` | JSON with `"backend":"memgraph"`, `totalRecordCount` ~28,325, `relationshipCount` ~23,014, 9 vector indexes (1 e5-queryable). Numbers may drift slightly; assert numeric presence, not exact equality |
| 2 | `mcp__plugin_mos_mindrian-brain__brain_search` `{"query":"jobs to be done framework"}` | Pinecone-shape `{result:{hits:[...]}}` with methodology content. Known non-fatal issues to RECORD, not fix: flat ~0.925 scores, empty `framework` metadata, `source_file` local-path leak (CONTRACT-03, Phase 247 scope) |
| 3 | `mcp__plugin_mos_mindrian-brain__brain_ask` `{"question":"which framework helps identify customer jobs and desired progress?"}` | DirectiveEnvelope with a synthesized methodology answer (server-side three-arm router). Question must stay generic methodology language (Part 8) |

Call 2 is deliberately the exact string PR #2's egress-guard reversal pinned as `allow`
(claim (c)/(d) in `tests/test-245-brain-envelope-shape.cjs`) and the deploy doc's own
verification query. Any failure is reported VERBATIM in-turn - never summarized, never silent.

### Failure signature decode table

| Signature | Meaning | Action |
|-----------|---------|--------|
| `e.reduce is not a function` | Host consumed a non-array `updatedToolOutput`: the RUNNING session loaded a pre-beta.13 cache | Restart the session; re-run pre-check 1. Do NOT diagnose network or server |
| PreToolUse egress-guard BLOCK on call 2 | Old guard (pre-PR #2) in the loaded cache; beta.13 carries the widened recognizer | Same as above: stale cache, restart |
| Tier-0 sentinel (DIRECTOR_NOT_AVAILABLE shape from `lib/core/tier0-messaging.cjs`) on ALL three calls | Key not loaded. Resolution order: `MINDRIAN_BRAIN_KEY` env -> `~/.mindrian.env` -> CWD `.env` (D-31); SEC-02 rejects group/world-readable files (needs 0600) and logs ONE stderr line `[mindrian-os] Brain key not loaded: <reason>` | Run pre-check 2; fix env/perms |
| `brain_stats` OK but `brain_query` returns tier-0 sentinel | NOT a key-loading failure: HTTP 403 admin gate (read-tier key). `brain-client.callTool` conflates 403 with unreachable (returns null on any non-OK status) | Expected on the current key; see LOOP-02 Lane B admin prerequisite. VERIFIED live 2026-08-10 |
| All calls null AND key reason clean | Network / Render outage | `curl /health`; check Render dashboard |

The fourth row is new knowledge from this research: the pre-beta.13 session's census calls
would ALSO have hit this 403, but the broken hook blanked the response before anyone could see
it. The fresh session should expect exactly this signature on any `brain_query` attempt with
the read key, and must report it as an admin-tier gate, not as "Brain down."

## LOOP-02: The Census

### Tool surface: two lanes

**Lane A - per-framework probes (READ key, works today).** The deployed server
(`jsagir/ProblemsWorthSolving-Brain`, local checkout `/home/jsagi/dev/ProblemsWorthSolving-Brain`,
deployed as `pws-brain-mcp.onrender.com`) registers 25 tools; everything except
`brain_query`/`brain_write`/ingest is an ungated read (auth.mjs: read tools are the inverse of
the write set). So `normalize_framework_name`, `discover_structure`, `orchestration_readiness`,
`feeds_into_chains`, `load_framework` are all callable with the current read key. These are NOT
on the plugin MCP surface (the plugin shim proxies only the 6 canonical tools: brain_ask,
brain_query, brain_schema, brain_search, brain_stats, brain_write), so Lane A runs either:
- via a small one-off script doing direct HTTP `tools/call` with the read key (recommended:
  status codes visible, failures verbatim), or
- via the `pws-brain-mcp` project-scope MCP tools - BUT that registration lives under project
  `/home/jsagi` in `~/.claude.json`, so it is NOT loaded in a dev-workspace session, and the
  plugin hooks do not match `mcp__pws-brain-mcp__*` anyway. Treat it as a control surface
  only. [VERIFIED: `~/.claude.json` inspection]

Lane A confirms/corrects the 2026-08-10 probe findings on the record (success criterion 3):
JTBD 0/4 with 4 aliases, TRIZ/SCAMPER/Five Whys absent as Framework nodes, empty
`discover_structure`, and runs `orchestration_readiness` for every framework in the
expected-use table below.

**Lane B - aggregates (ADMIN key required, raw Cypher).** `brain_query` is edge-gated: HTTP
403 before dispatch for any key not in the Render service's `BRAIN_HTTP_ADMIN_KEYS` env
(verified live this session). Read scopes never confer admin. The operator (Jonathan) must
export the admin key as `MINDRIAN_BRAIN_KEY` for the census session/script only - never
committed, tier recorded in the artifact. If the admin key is unavailable, the fallback is
running the same Cypher against the local twin (Memgraph Docker at `bolt://127.0.0.1:7690`
in the brain repo) with an explicit drift caveat in the artifact; prefer the live deployment
because a requirement is only done on the surface a user reaches (cross-cutting rule).

**NOT text2cypher:** it requires a local Ollama sidecar the Render deployment lacks by design;
it fails remotely and is CONTRACT-02's retire-or-sidecar decision, not a census tool.
[CITED: 2026-08-10 handoff section 2; brain repo README]

**Server caps that shape Lane B:** `brain_query` is READ-only (write clauses refused), has a
~5000ms default timeout, a result byte cap ("narrow the query"), and a trailing-LIMIT row-bound
check. Keep every census query an aggregate with a small explicit LIMIT on row-returning
queries. [VERIFIED: `src/http/admin-tools.mjs`]

### The census query set (content-free, dialect-portable)

Every query below carries zero user bytes - generic labels, edge types, and framework-name
handles only. The PR #2 precedent pins the class: claim (c) in
`tests/test-245-brain-envelope-shape.cjs` asserts `MATCH (n) RETURN labels(n) AS labels,
count(*) AS c` classifies `allow` (and not `freeform_unmatched`), and claim (d) pins that real
user content is still blocked. The `query()` backstop in brain-client blocks only proven
CONTENT-SET hits; `ambiguous` deliberately passes. [VERIFIED: test source + brain-client.cjs]

```cypher
-- C1 total Framework nodes
MATCH (f:Framework) RETURN count(f) AS frameworks

-- C2 structure coverage per edge type (also run the 4 single-type variants if
--    grouped alternation misbehaves on Memgraph)
MATCH (f:Framework)-[r:HAS_PHASE|HAS_STAGE|HAS_PROCESS_STEP|HAS_STEP]->()
RETURN type(r) AS t, count(r) AS edges, count(DISTINCT f) AS frameworks_with_t

-- C3 distinct frameworks with ANY structure
MATCH (f:Framework)-[:HAS_PHASE|HAS_STAGE|HAS_PROCESS_STEP|HAS_STEP]->()
RETURN count(DISTINCT f) AS structured_frameworks

-- C4 flow edge counts
MATCH ()-[r:FEEDS_INTO]->() RETURN count(r) AS feeds_into
MATCH ()-[r:LEADS_TO]->() RETURN count(r) AS leads_to
MATCH ()-[r:ALIAS_OF]->() RETURN count(r) AS alias_of

-- C5 label census (claim-c proven shape; UNWIND variant handles multi-label nodes)
MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS c ORDER BY c DESC LIMIT 50

-- C6 relationship-type census
MATCH ()-[r]->() RETURN type(r) AS t, count(*) AS c ORDER BY c DESC LIMIT 50

-- C7 duplicate-name scan (the JTBD-alias class, generalized)
MATCH (f:Framework) WITH trim(toLower(f.name)) AS k, collect(f.name) AS names, count(*) AS c
WHERE c > 1 RETURN k, names, c ORDER BY c DESC LIMIT 50

-- C8 named-absence probes (expect zero rows; confirms TRIZ/SCAMPER/Five Whys finding)
MATCH (f:Framework)
WHERE toLower(f.name) CONTAINS 'triz' OR toLower(f.name) CONTAINS 'scamper'
   OR toLower(f.name) CONTAINS 'five whys'
RETURN f.name LIMIT 20

-- C9 JTBD alias enumeration (expect the 4 aliases on the record)
MATCH (f:Framework)
WHERE toLower(f.name) CONTAINS 'jobs to be done' OR toLower(f.name) CONTAINS 'jtbd'
RETURN f.name LIMIT 20
```

### Cypher dialect notes (Memgraph, not Neo4j)

The Brain is Memgraph-backed (`brain_stats` self-reports `backend: memgraph`). The brain repo's
own code documents the divergences that matter here:

| Neo4j-only (avoid) | Memgraph analog / portable form | Evidence |
|--------------------|--------------------------------|----------|
| `CALL db.labels()` | `MATCH (n) UNWIND labels(n) AS l RETURN l, count(*)` (pure Cypher) | `scripts/migrate-aura-to-local.mjs:129` uses `db.labels()` only on the Aura side |
| `SHOW INDEXES YIELD ...` | `CALL vector_search.show_index_info()` for vector indexes; but `brain_stats` already reports them, so no raw index introspection is needed | `migrate-aura-to-local.mjs:137` (Neo4j side) vs `build-vector-index.mjs:35` (Memgraph side) |
| `CALL db.schema.nodeTypeProperties()` | Do not use, even though the egress guard allowlists it (claim (c) tests it as a guard-classification input, not as a Memgraph-runnable query) | claim (c) + Memgraph docs [ASSUMED: Memgraph lacks this procedure, consistent with the repo using pure-Cypher censuses on the Memgraph lane] |
| `elementId(n)` | `id(n)` if ever needed; the census needs neither | migration script uses `elementId` only against Aura |

Multi-label pitfall: nodes in this graph carry up to 6 labels; `labels(n)[0]` picks
allowlist-arbitrary labels (`src/graphrag-cache.mjs:156` documents this as Pitfall 3). The
UNWIND census counts label occurrences, which is the honest form; note in the artifact that
label counts sum to more than the node count.

All standard constructs used above (`labels()`, `UNWIND`, `count(DISTINCT ...)`,
`toLower`, `trim`, `collect`, type alternation `[:A|B]`) are core openCypher supported by both
backends. [VERIFIED for this graph: the repo's own Memgraph-lane scripts use these forms;
grouped `type(r)` over alternation is the one construct to smoke-test first, hence the C2
single-type fallback]

### Where the artifact files

`.planning/*` is gitignored with only `!.planning/debug/` excepted, and `debug/` is reserved
for RCA/QA per CLAUDE.md - not census artifacts. The repo's standing precedent for exactly
this shape of artifact is `scripts/build-corpus-stats.cjs` -> `docs/CORPUS-STATS.generated.md`
+ `data/corpus-stats.generated.json` (both tracked; `data/` verified not ignored). Recommend:

- `docs/BRAIN-GRAPH-CENSUS.generated.md` - human-readable census + gap table, header records
  census date, `brain_stats` totals, key tier used, and which lane produced each number
- `data/brain-census.generated.json` - machine-readable twin for Phases 247/249 to cite
- Builder: `scripts/build-brain-census.cjs` following the corpus-stats pattern BUT with NO
  `--check` release gate (the census needs network + admin key; a release gate must never
  depend on live network). Reuse-before-build satisfied: repointing an existing generator
  pattern, not new surface.

### Top gaps by expected-use: the concrete join

"Expected-use" = how often the methodology command surface invokes a framework. This is on
disk, no probing needed: every methodology command's frontmatter declares
`kind: methodology` and a `frameworks: [...]` list. Computed this session across
`commands/*.md`:

**Count discrepancy to record:** canon prose says "the 25 methodology commands"; disk has
**50** commands with `kind: methodology`. The census must state its enumeration source
(frontmatter scan, dated) so ENRICH-04's floor is measured against the same set. Flag to the
user in discuss-phase if the canonical 25 is a distinct list. [VERIFIED: frontmatter scan 2026-08-10]

Framework invocation frequency (the expected-use ranking, 28 distinct frameworks):

| Uses | Framework |
|------|-----------|
| 5 | Jobs to Be Done (JTBD) |
| 5 | Reverse Salient Analysis |
| 4 | Six Thinking Hats |
| 3 | PWS Triple Validation Compass |
| 3 | S-Curve Analysis |
| 3 | HSI Semantic Surprise Analysis Assistant |
| 2 | PWS Value Proposition, Systems Thinking, Adoption-Capacity Theory, Scenario Planning, The Pyramid Principle, Root Cause Analysis |
| 1 | PEST Analysis, Adaptive Leadership, Beautiful Question Framework, Four Lenses of Innovation, Domain Selection, MECE, Hypothesis-Driven Problem Solving, Futures Wheel, Usher's Model of Cumulative Synthesis, Mullins Model, Problem Definition Transformation Framework, Knowns and Unknowns Matrix Framework, Lean Canvas, Dominant Design, Red Teaming, Ackoff Pyramid |

**Join procedure:**
1. For each framework name above, Lane A: `normalize_framework_name` (does a canonical node
   exist?), then `orchestration_readiness` (0-4 score), then `discover_structure` (HAS_* rows).
2. Gap score = expected-use count, filtered to frameworks scoring 0-2/4 or absent entirely.
3. Sort descending: that ordered list IS "top gaps by expected-use" and IS Phase 249's
   enrichment queue seed. JTBD (5 uses, 0/4 readiness, 4 aliases) will predictably top it.
4. Record per-row provenance: which tool call produced the readiness number, dated.

## Grounding: langtalks-graph-expert (mandatory consult, executed)

**Method disclosure:** MCP tools are not exposed inside this researcher agent, so the consult
ran the SAME corpus through the SAME code path the MCP tool wraps:
`/home/jsagi/langtalks-graph-expert/scripts/graph_query.py` (`relationship_path`
point-to-point, per the standing directive; `query_relationship` BFS avoided per the
documented zero-edges failure mode) plus direct typed-edge extraction from the live graph
(equivalent of `get_entity`). Findings, episode-corpus typed edges:

| Finding | Typed edge(s) | Bearing on Phase 246 |
|---------|---------------|----------------------|
| A harness verifying its dependencies end-to-end is corpus-covered as closed feedback loops belonging to harness engineering | `closed_feedback_loops --part_of--> harness_engineering` | The three-call test IS the closed feedback loop for the Brain dependency; the census closes the loop for graph structure |
| Verification is structured as a hierarchy of small testable primitives that exists to catch bad outputs | `verification_hierarchy --part_of--> small_testable_primitives`; `verification_hierarchy --critiques--> bad_outputs` | Validates the three-call escalation design: stats (transport+auth) -> search (semantic+egress path) -> ask (synthesis), each call isolating one layer, mirroring the 2026-08-09 handoff's layer-by-layer proof table |
| Verification loops are a first-class Claude Code concept; loop creation builds on a built-in verify skill | `verification_loops --part_of--> claude_code`; `verification_loop_creation_process --builds_on--> built_in_verify_skill` | The fresh-session checkpoint is the loop's human leg, not a formality |
| Chained verification has a token-spend critique | `chained_verification_loops --critiques--> token_spend` | Keep verification calls few and content-free; the three-call test is deliberately minimal |
| End-to-end evaluation belongs to system design in multi-agent systems | `end_to_end_evaluation --part_of--> multi_agent_system`, `--part_of--> system_design` | LOOP-01's end-to-end framing (host -> hook -> client -> edge -> graph) is the corpus-sanctioned unit |
| **Shadow-run-style checks: NOT IN CORPUS** | No entity matches shadow-run/shadow-deploy concepts | Valid gap per the directive; do not invent external validation. Design shadow-style checks (if any) as first-party doctrine |
| Per-turn hook injection: corpus whitespace | (carried from the 2026-08-10 handoff's own consult) | Unchanged; binds Phase 251, noted here for continuity |

Stateless-MCP/protocol questions were deliberately NOT taken to langtalks (navigator scoping):
the `updatedToolOutput` contract is grounded in the Claude Code binary extraction recorded in
the 2026-08-09 handoff section 6, which is the authoritative host-behavior source for this
phase. No new host-behavior claims are introduced by this research.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Census artifact generation | A bespoke report writer | `scripts/build-corpus-stats.cjs` pattern (docs/*.generated.md + data/*.generated.json) | Existing tracked-artifact convention with staleness discipline; Part 7 reuse |
| Egress classification of census queries | New allow-list logic | `lib/core/part8-egress-guard.cjs` `classify()` + the claim (c) test pattern | The vocabulary and its regression fence already exist; extend the test, never fork the guard |
| Brain transport | New HTTP client | `lib/core/brain-client.cjs` (with the caveat: surface HTTP status verbatim in census scripting; the client conflates 403/timeout/no-key into null) | Single wire path, session cache, Part 8 backstop already inside |
| Framework name normalization for the join | Local fuzzy matching | Server-side `normalize_framework_name` (Lane A) | It is the contract tool Phase 247 declares; the census should exercise the surface downstream phases will trust |
| Key resolution | Reading env/.env directly | `lib/core/resolve-brain-key.cjs` | D-31 order + SEC-02 permission check + reason strings live there |

## Common Pitfalls

### Pitfall 1: Verifying from a stale session
**What goes wrong:** Any Brain check run in a session started before the plugin update reports
pre-beta.13 behavior; the 2026-08-10 session reproduced BOTH fixed defects this way.
**How to avoid:** LOOP-01 is a fresh-session human checkpoint. Pre-check the installed-cache
version first. Never mark LOOP-01 done from inside a planning/execution session.
**Warning signs:** `e.reduce is not a function`; egress block on the pinned allow query.

### Pitfall 2: Reading `brain_query` null as "Brain down"
**What goes wrong:** brain-client returns null for HTTP 403 (read-tier key), timeouts, AND
missing key. Through the MCP shim all three surface as the tier-0 sentinel. The admin gate is
the live cause TODAY (verified 403 this session).
**How to avoid:** Census scripting does direct fetch with status visible, or checks
`brain_stats` first (ungated): stats-OK + query-sentinel = admin gate, not outage. Report the
403 body verbatim (`MoatViolation: tool "brain_query" requires the admin tier`).

### Pitfall 3: Neo4j dialect leaking into the census
**What goes wrong:** `CALL db.labels()`, `SHOW INDEXES`, `db.schema.nodeTypeProperties()`,
`elementId()` are the Neo4j lane; the deployed backend is Memgraph.
**How to avoid:** Pure-Cypher census set above; smoke-test C2's grouped alternation first and
fall back to single-type queries.

### Pitfall 4: `labels(n)[0]` undercounting multi-label nodes
**What goes wrong:** Nodes carry up to 6 labels (repo-documented Pitfall 3 in graphrag-cache).
**How to avoid:** UNWIND label census; artifact notes that label counts exceed node count.

### Pitfall 5: Census queries tripping the egress guard after a vocabulary change
**What goes wrong:** A future guard-vocabulary regression could silently re-gate content-free
introspection (the exact defect class PR #2 fixed).
**How to avoid:** Extend the claim (c) pattern: a new test asserts every census query string
classifies `allow`. Framework-name handles ("jobs to be done", "triz") are Part-8-permitted
generic methodology language; the PR #2 precedent pins the class from both directions.

### Pitfall 6: Treating the pws-brain-mcp project scope as the verification surface
**What goes wrong:** It bypasses BOTH plugin hooks (matcher never covered it - this is exactly
how the outage stayed invisible) and is only registered under project `/home/jsagi`, so it is
absent in dev-workspace sessions anyway.
**How to avoid:** LOOP-01 runs plugin-scope only. pws-brain-mcp is at most a control/debug
surface, labeled as such.

### Pitfall 7: Blocking the whole census on the admin key
**What goes wrong:** Lane B needs an operator step (admin key from Render's
`BRAIN_HTTP_ADMIN_KEYS`); if that stalls, the whole phase stalls.
**How to avoid:** Lane A (per-framework gap map, read key) is independent and delivers the
usage-ranked gap list Phase 249 needs even if Lane B lags. Plan them as separate tasks.

## Environment Availability

| Dependency | Required By | Available | Version / status | Fallback |
|------------|------------|-----------|------------------|----------|
| Node.js >= 22.16 | brain-client, census script | Yes | v22.23.1 | - |
| Render Brain `/health` | All Brain calls | Yes | `{"status":"ok","graph":true}` (probed 2026-08-10) | Local twin Memgraph (drift caveat) |
| MINDRIAN_BRAIN_KEY (read tier) | LOOP-01, Lane A | Yes | resolves from env, reason none | - |
| Admin-tier key (`BRAIN_HTTP_ADMIN_KEYS`) | Lane B `brain_query` | **No** (current key 403s) | operator-supplied, Render dashboard | Local twin Cypher with drift caveat |
| beta.13 plugin cache | LOOP-01 | Yes | 1.16.0-beta.13 installed 2026-08-10T07:43Z, fixes verified present in cache files | - |
| langtalks-graph-expert corpus | Grounding | Yes | local graph, 7,177 entities | - |

**Missing with fallback:** admin key (fallback: local twin, explicitly caveated).
**Missing with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bespoke Node `.cjs` assert scripts + per-phase bash runner (repo convention) |
| Config file | none (convention: `tests/run-all-<phase>.sh` globs `tests/test-<phase>-*.cjs`) |
| Quick run command | `bash tests/run-all-246.sh` (Wave 0: create) |
| Full suite command | `node scripts/doctor.cjs --acceptance` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOOP-01 | Fresh-session three-call pass, verbatim failure reporting | manual-only (checkpoint:human-verify) - host-session hook behavior cannot be exercised from a script; the envelope/guard invariants ARE fenced by `bash tests/run-all-245.sh` (PASS=18) | `bash tests/run-all-245.sh` (adjunct fence) | Adjunct exists; checkpoint is manual by design |
| LOOP-02 | Census queries classify `allow`; artifact builder renders deterministically | unit | `node tests/test-246-census-guard.cjs` (guard classification of every census string, claim (c) pattern); `node tests/test-246-census-render.cjs` (builder against a fixture JSON, no network) | Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/run-all-246.sh`
- **Per wave merge:** `bash tests/run-all-246.sh && bash tests/run-all-245.sh`
- **Phase gate:** `node scripts/doctor.cjs --acceptance` green + LOOP-01 checkpoint signed off

### Wave 0 Gaps
- [ ] `tests/run-all-246.sh` - phase runner
- [ ] `tests/test-246-census-guard.cjs` - every census query string classifies `allow`, not `freeform_unmatched` (extends claim (c); a vocabulary regression turns it red - a test that CAN fail)
- [ ] `tests/test-246-census-render.cjs` - `scripts/build-brain-census.cjs` renders from fixture JSON; em-dash fence applies to the generated doc

## Security Domain

Part 8 is the governing security frame for this phase; no new auth surface is built.

| Concern | Applies | Control |
|---------|---------|---------|
| V4 Access control | yes | Admin-tier key handled operator-side only: env for the census session, never committed, never printed; tier recorded in the artifact. Server edge-gate (403 pre-dispatch) is the enforcement |
| V5 Input validation | yes | Census Cypher is static strings (no interpolated user input); egress guard classify + claim (c) fence; `sanitizeCypherInput` untouched |
| Secrets handling | yes | `resolve-brain-key.cjs` (SEC-02 0600 check); probes in this research printed availability/source only, never key bytes |
| Part 8 egress | yes | All census queries content-free / generic methodology handles; PR #2 precedent pins the class in both directions (allow content-free, still block user content) |

## Package Legitimacy Audit

This phase installs no external packages (census builder uses Node built-ins + existing repo
modules; ajv and the MCP SDK are already vendored). No audit table required.

## Project Constraints (from CLAUDE.md)

- Workspace guard: all work from `/home/jsagi/dev/MindrianOS-Plugin`, never the plugin cache.
- GSD workflow entry for all file changes; QA/RCA findings to `docs/RCA-TEMPLATE.md` standard in `.planning/debug/` (`git add -f`).
- Canon Part 8 untouchable: census changes WHEN/how-loudly, never WHAT crosses the wire.
- Part 7 reuse-before-build: census generator repoints the corpus-stats pattern; no new brain skill.
- Part 11: any net-new invocable surface needs a declared HITL shape; a census SCRIPT (not invocable surface) does not, but if a `/mos:` command is minted for it, it does - prefer no new command.
- Tri-Polar: LOOP-01's fresh-session test is CLI-surface; Desktop/Cowork verification is not demanded by the phase criteria - a deliberate, stated skip, revisited by Phase 250's three-surface requirements.
- No em-dashes anywhere (test fence exists).
- Dev-research compositing: this research should mirror to `~/MindrianRooms/rethinking-mindrianos/research/` with a cross-reference back to this file (session-level obligation for the orchestrator).
- Release train: Gates 0 and 1 gate RELEASE CUTS only, not this phase's planning/code work.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Memgraph lacks `db.schema.nodeTypeProperties()` and grouped `type(r)` over alternation may need the single-type fallback | Dialect notes | Low: fallback queries provided; smoke-test first |
| A2 | The canonical "25 methodology commands" has no separate authoritative list beyond the 50 `kind: methodology` frontmatter entries on disk | Expected-use join | Medium: ENRICH-04's floor would be measured against the wrong set; flagged for user confirmation in discuss-phase |
| A3 | The admin key exists in Render's `BRAIN_HTTP_ADMIN_KEYS` and the operator can retrieve it | Lane B | Medium: Lane B falls back to the local twin with a drift caveat |
| A4 | brain_stats totals (28,325 / 23,014) will not have drifted materially by census time | LOOP-01 expected outputs | Low: assert numeric presence, not exact values |

## Open Questions

1. **Admin key ceremony for Lane B.** Who holds the admin key, and is exporting it into a census
   session acceptable ahead of SEED-011's key ceremony (Phase 250)? Recommendation: operator-run
   one-shot script with the key in process env only; record tier in the artifact; treat the
   ceremony design as Phase 250 scope.
2. **The 25 vs 50 methodology-command count.** Recommendation: census records the frontmatter
   enumeration (50, dated) as its source and surfaces the discrepancy to the navigator; do not
   silently redefine the canonical phrase.
3. **Should brain-client stop conflating 403 with unreachable?** It is an honesty-rail concern
   (Phase 250 territory). Recommendation: do NOT patch brain-client in this phase; the census
   script surfaces status verbatim on its own, and the conflation is filed as evidence for
   HONEST-01.

## Sources

### Primary (HIGH confidence)
- Live probes this session (2026-08-10): `/health` OK; `brain_stats` via brain-client
  (memgraph, 28,325/23,014); `brain_query` 403 MoatViolation admin-tier; key resolution
  available/env; installed_plugins.json (beta.13 picked up 07:43Z); beta.13 cache files carry
  both fixes; langtalks `relationship_path` + typed-edge extraction (7,177-entity graph)
- Repo source: `lib/core/brain-client.cjs`, `lib/core/resolve-brain-key.cjs` (via brain-client
  docblocks), `scripts/brain-response-sanitize-hook.cjs`, `lib/core/brain-response-sanitize.cjs:61`,
  `hooks/hooks.json` (PreToolUse egress + PostToolUse sanitize on the same matcher),
  `bin/mindrian-brain-mcp-client.cjs` (6-tool shim), `tests/test-245-brain-envelope-shape.cjs`
  (claims c/d), `scripts/build-corpus-stats.cjs`, `.gitignore`, commands frontmatter scan
- Brain repo source (`/home/jsagi/dev/ProblemsWorthSolving-Brain`): `src/server.mjs` (25 tool
  registrations), `src/http/auth.mjs` (read/admin tiers, `BRAIN_HTTP_ADMIN_KEYS`, edge gate),
  `src/http/admin-tools.mjs` (brain_query caps/read-only), `scripts/migrate-aura-to-local.mjs`
  + `scripts/build-vector-index.mjs` (dialect lanes), `src/graphrag-cache.mjs` (multi-label pitfall)
- `docs/2026-08-09-HANDOFF-brain-envelope-and-egress-guard.md` (binary-extracted
  updatedToolOutput contract; three-call test origin; key-resolution order)
- `docs/2026-08-10-HANDOFF-build-the-loop-milestone.md` (probe table; live incident; plan of record)

### Secondary (MEDIUM confidence)
- Brain repo README (Memgraph-only lane, comparison seams, operator key lanes table)
- CLAUDE.md + `.claude/includes/*` (beta.13 release status, canon parts)

### Tertiary (LOW confidence)
- Memgraph procedure-surface specifics beyond what the repo's own scripts exercise (A1)

## Metadata

**Confidence breakdown:**
- LOOP-01 spec: HIGH - tool names, matcher, cache state, and failure signatures all verified on disk/live this session
- LOOP-02 tool surface: HIGH - the admin-gate 403 was reproduced live; the two-lane split follows directly
- Census Cypher dialect: MEDIUM-HIGH - portable forms chosen from the repo's own Memgraph-lane usage; one construct flagged for smoke-test
- Expected-use join: HIGH - computed from disk this session; count discrepancy flagged
- Grounding: HIGH for what the corpus contains; gaps ("shadow-run", per-turn hooks) reported as gaps

**Research date:** 2026-08-10
**Valid until:** ~2026-09-10 for repo facts; the live numbers (stats totals, key tier, cache version) are point-in-time and must be re-probed by the fresh session
