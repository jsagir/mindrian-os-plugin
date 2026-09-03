# Phase 296: SEED-030: RS Pipeline Spine-Wiring + Expert-Graph Reconciliation - Research

**Researched:** 2026-09-03
**Domain:** Reverse-salient discovery pipeline; local vector persistence (node:sqlite + sqlite-vec); cross-language (CJS writer / Python reader) data handoff; Brain-unreachable refusal rail
**Confidence:** HIGH on codebase facts (every load-bearing claim read from source or executed live), MEDIUM on scope recommendation (it contradicts two CONTEXT.md premises and needs navigator ratification)

---

## Summary

Three of this phase's five research questions came back with answers that **contradict the premises in `296-CONTEXT.md`**. None of the contradictions are fatal, but all three change what the plan should contain, so they are stated first and in full.

**First contradiction (D-01/D-02's target).** `lib/core/eureka/embedding-spine.cjs` writes **nothing** to room.db. It is an encoder only (`embedTexts` -> `number[][]`). The module that owns vector persistence is `lib/core/eureka/vector-store.cjs`, and it writes to one of **two** tables depending on a runtime capability probe: `eureka_vec` (a `vec0` virtual table, when the `sqlite-vec` extension loads) or `eureka_vec_fallback` (a plain `BLOB` table, when it does not). A plain Python `sqlite3` connection can read the second and **cannot** read the first - live-verified this session, `OperationalError: no such module: vec0`. Since `sqlite-vec` is a hard `dependencies` entry in `package.json` (installed on every real user machine, absent from this dev checkout), a naive "Python reads room.db vectors" implementation would pass in dev and silently fail for every actual user. This is the single highest-risk finding in this document.

**Second contradiction (D-01's Pinecone premise).** `scripts/rs-engine.py`'s **internal and cross-room modes call zero Pinecone** already. They embed locally via `sentence-transformers` MiniLM and cache to a `.rs-engine-cache.json` sidecar; the Pinecone inference entry point on that path is a `NotImplementedError` stub. Pinecone lives **only** in Mode B (external) and Mode C (hybrid), through `lib/core/rs_cache.py`. Separately, Phase 272 already shipped `lib/core/rs-engine.cjs`, a full CJS port of Mode A internal that consumes `embedding-spine.cjs` directly, dispatched through `lib/core/rs-backend-dispatch.cjs` with CJS as the default. So the acceptance criterion "RS internal mode runs with zero Pinecone" is **already satisfied twice over**. The genuine open remainder is the external/hybrid corpus - and Phase 272's own `pinecone-inference.cjs` header names that surface as **"explicitly descoped to a follow-up phase."** Phase 296 is that follow-up.

**Third contradiction (D-03's premise).** `rs-experts` does **not** make a remote Brain-Cypher call and has not since 2026-05-22 (`2f0e4e79`, "BUG 2 fix"). The `mcp__mindrian-brain__read_neo4j_cypher` tool was deliberately removed from its frontmatter; `scripts/rs-experts-command.cjs` never loads `brainClient` at all. There is also **no live Tier-1 Aura query path shipping today** - every invocation already returns a Tier-0 guidance message. The optional additive Brain leg that does exist (`rs-expert-brain-projection.cjs`) reads generic framework handles only and already returns `[]` on every failure path. So D-03's "keep it remote" decision describes a coupling that was removed sixteen months of commits ago, and the "does not crash" half of the test is already green. The real, plannable gap is narrower and better: the existing Tier-0 message **conflates three different causes under one string** ("Aura not connected"), which is exactly the failure the codebase's own canonical refusal rail (`lib/core/refusal-messaging.cjs`) exists to prevent.

**Primary recommendation:** Re-scope this phase to the two gaps that actually exist - (1) replace `rs_cache.py`'s Pinecone rs-external corpus cache with a local embed-and-cache path (the SEED-029 "SIGNAL corpus" leg), reading the room's local vectors **through a CJS-side export step, never a direct Python `SELECT`**; and (2) route `rs-experts`' degrade through `refusal-messaging.cjs`'s existing `'unreachable'` kind so the three distinct causes stop collapsing into one string. Both are pure wiring against machinery that already exists, which is exactly what SEED-030's own Part-7 framing promised.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**RS vector repoint (D-01, D-02)**

- **D-01:** Do NOT port `scripts/rs-engine.py` / `lib/core/rs_corpus.py` to CJS in this phase. They stay Python. Repoint them to read the SAME local vector data `lib/core/eureka/embedding-spine.cjs` already writes to room.db, instead of calling Pinecone (`rs-external` mode). No new cross-language bridge, no new dependency - swap the data source Python reads from, keep the language as-is.
- **D-02:** The CJS-to-Python data handoff mechanism (how Python reads what CJS's embedding-spine wrote to room.db - direct SQLite read via a Python sqlite3 connection is the obvious default, given `lib/core/rs_corpus_exclude.py` already exists alongside the CJS RS files) is a research-time decision, not locked here. Researcher should confirm room.db's vector table schema is readable from Python without going through a CJS intermediary process.

**rs-experts / R-expert scope (D-03)**

- **D-03 (was LOCKED-pending in SEED-030, now CONFIRMED):** `rs-experts` stays on remote-Brain Mode-A (Neo4j Aura / Brain-Cypher). It is people + teaching-graph data - real Brain IP per Canon Part 8 - correct to keep remote. This phase's job for `rs-experts` specifically is the graceful-degrade path: when Brain is unreachable, return a clear, labeled "Brain unreachable" response instead of crashing or silently returning nothing. Do not descope the expert-network capability.

**Sequencing relative to SEED-013 (Python elimination, Phase 283)**

- **D-04:** This phase's Python files (`rs-engine.py`, `rs_corpus.py`) are explicitly left in Python here. Phase 283 (SEED-013, eliminate Python from the user-machine surface) is the correct future home for actually removing the Python runtime dependency. Planner should note this phase's changes will need re-verification once 283 lands, not treat 283 as this phase's blocker - the two can proceed independently since D-01 only changes the DATA SOURCE Python reads, not the language.

### Claude's Discretion

- Exact wording of the "Brain unreachable" degrade message for `rs-experts`.
- Whether the local-vector read from Python uses a direct sqlite3 connection or a thin CJS-side export step, so long as it introduces no new remote dependency and no new third-party package.

### Deferred Ideas (OUT OF SCOPE)

- Porting `rs-engine.py`/`rs_corpus.py` to CJS - belongs to Phase 283 (SEED-013), not this phase (D-04).
- SEED-057's synthesis-trigger expert (Phase 316) - a downstream consumer of a healthy RS pipeline, explicitly out of this phase's scope. Worth flagging to whoever plans 316 next: SEED-057's own trigger conditions (Phase 222 shipped, SEED-034/SEED-058 shipped) are now ALL satisfied as of this session (2026-09-03) - it is unblocked and ready for its own discuss-phase pass, separate from this one.

### Researcher note on constraint conflicts

D-02 explicitly delegates the handoff mechanism to research, and the Discretion section explicitly permits "a thin CJS-side export step." Finding F-2 below exercises that permission: **the direct-sqlite3 default named in D-02 is unsafe** and the CJS-side export step is the correct call. This is within the discretion granted, not a departure from a lock.

D-01's factual premise ("embedding-spine.cjs already writes to room.db") and D-03's factual premise ("rs-experts is on remote-Brain Mode-A") are both **incorrect as stated** (F-1, F-6). The planner must surface both to the navigator before writing tasks; a plan that executes them literally would target a module that writes nothing and remove a coupling that does not exist.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

No requirement IDs were supplied by the orchestrator, and `.planning/ROADMAP.md`'s Phase 296 entry is a stub (`**Goal:** [To be planned]`, `**Requirements**: TBD`). The acceptance criteria below are lifted from SEED-030's own `## Required (acceptance)` and `## Tests` sections, which `296-CONTEXT.md` names as the primary source ("do not re-derive").

| Seed item | Description | Research verdict |
|-----------|-------------|------------------|
| Acceptance 1 | Spine-wire the 4 `rs-*` commands; all appear in `data/connector-registry.json` | **ALREADY DONE.** Verified this session (F-9). Out of scope. |
| Acceptance 2 | RS internal/cross-room/external/hybrid read local vectors, not Pinecone `rs-external` | **PARTIALLY DONE.** internal + cross-room already zero-Pinecone (F-3); external + hybrid are the real gap (F-4). |
| Acceptance 3 | R-expert Aura/Brain-Cypher decision (Option A: keep remote, degrade gracefully) | **PREMISE STALE.** Coupling already removed 2026-05-22 (F-6). Real gap is cause-conflation in the degrade message (F-7). |
| Test 1 | Assert all four `rs-*` appear in `data/connector-registry.json` | Trivially green today; keep as a regression fence. |
| Test 2 | Assert RS internal mode runs with zero Pinecone | Green today via two independent paths; keep as a regression fence, extend to external/hybrid. |
| Test 3 | Assert `rs-experts` degrades gracefully with a clear "Brain unreachable" message rather than crashing | "Does not crash" is green. "Clear, labeled, cause-distinguishing" is the actual deliverable. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Text -> vector (local encode) | CJS core (`embedding-spine.cjs`) | - | Single local ONNX encoder for the whole repo; Part 8 zero-egress boundary is enforced here. Never duplicate it in Python. |
| Vector persistence (room nodes) | CJS core (`vector-store.cjs`) | room.db (`eureka_vec` / `eureka_vec_fallback`) | Backend selection is a runtime probe, so only CJS knows which table is live. A reader that guesses is wrong 50% of the time. |
| Room-artifact corpus discovery | Split: Python (`rs-engine.py`) + CJS (`rs-engine.cjs`) | filesystem walk | Both walk `.md` files on disk, NOT room.db `nodes`. Different identity space from the vector store (F-5). |
| External/signal corpus fetch | Python (`rs_corpus.py`) | OpenAlex / arXiv / Tavily HTTP | Pure fetcher, zero Pinecone. Correct as-is; do not touch. |
| External/signal corpus **cache + embed** | Python (`rs_cache.py`) -> **Pinecone (remote)** | - | **THE GAP.** SEED-029 rules this belongs local (fetch-on-demand, cache in room.db). |
| Expert (Author/Paper/Institution) resolution | LOCAL room.db only | - | Canon Part 8: people data never egresses. Already correct; no Tier-1 transport ships yet. |
| Expert methodology-handle enrichment | Remote Brain (optional, additive) | `rs-expert-brain-projection.cjs` | Generic framework/enum handles only. Already Part-8-clean and already degrades to `[]`. |
| Brain-failure user messaging | CJS core (`refusal-messaging.cjs`) | - | The one canonical refusal rail. `rs-experts` currently bypasses it (F-7). |

---

## Findings

### F-1 (HIGH): `embedding-spine.cjs` writes nothing; `vector-store.cjs` owns persistence

`lib/core/eureka/embedding-spine.cjs` (543 lines, Phase 211-01, first landed `a9aa9ea3` 2026-07-05, current default model set by `e87f61f6` 2026-07-06) exports exactly:

```
getEncoder(opts)          -> Promise<{success, encoder} | {success:false, error:'encoder_unavailable'}>
embedTexts(texts, opts)   -> Promise<{success, vectors:number[][], provenance:{model,dtype,dim}} | {success:false,...}>
encoderProvenance()       -> {model, dtype, dim, method}
resolveDim()              -> number
cosineSimilarity(a,b)     -> number   // re-export from rs-pinecone-bridge.cjs
```

There is no `db` parameter anywhere in the module and no SQL. It is a pure encoder. Default model is `MongoDB/mdbr-leaf-ir`, **384-dim**, dtype `q8`, run locally via `@huggingface/transformers` (ONNX). The only network touch is a one-time model-weights download by model ID.
[VERIFIED: direct read of `lib/core/eureka/embedding-spine.cjs`]

Persistence lives in `lib/core/eureka/vector-store.cjs` (414 lines, `5d190a8b` 2026-07-06, "the D1 vector-store adapter seam"). Its exports:

```
ensureStore(db, dim, opts) -> {backend:'sqlite-vec'|'cjs-fallback', dim}
readMeta(db)  / writeMeta(db, {embedding_model, embedding_dim})
insertVector(db, nodeId, vec) / deleteVector(db, nodeId)
knnQuery(db, queryVec, k)  -> [{node_id, score}]   // higher is better, both backends
```

Every function takes a **caller-owned** `db` handle; the module never opens room.db and never requires `room-db.cjs`.
[VERIFIED: direct read of `lib/core/eureka/vector-store.cjs`]

**Planner impact:** any task written as "read what embedding-spine wrote" targets the wrong module. The correct target is `vector-store.cjs::knnQuery` (or a new export beside it).

### F-2 (HIGH, highest-risk): two vector tables, and Python can only read one of them

`createVecTable` selects a backend from a **runtime capability probe**, not from table existence:

| Backend | Table | Schema | Python `sqlite3` readable? |
|---------|-------|--------|---------------------------|
| `sqlite-vec` | `eureka_vec` | `CREATE VIRTUAL TABLE eureka_vec USING vec0(node_id TEXT, embedding float[<dim>])` | **NO** |
| `cjs-fallback` | `eureka_vec_fallback` | `CREATE TABLE eureka_vec_fallback(node_id TEXT PRIMARY KEY, dim INTEGER, vector BLOB)` | **YES** |

Plus `eureka_meta(key TEXT PRIMARY KEY, value TEXT)` holding `embedding_model` and `embedding_dim`.
[VERIFIED: `lib/core/eureka/vector-store.cjs:258-321`]

Live-executed both directions this session:

```
# POSITIVE: plain python stdlib reads the fallback table off a WAL db, read-only URI
$ python3 -c "..."
meta: {'embedding_dim': '384', 'embedding_model': 'MongoDB/mdbr-leaf-ir'}
node_id=claim:abc dim=4 vector=[0.1, -0.25, 0.5, 0.75]
numpy path:
claim:abc [ 0.1  -0.25  0.5   0.75]

# NEGATIVE: the vec0 virtual table
sqlite_master row IS visible to plain python:
  [('eureka_vec', 'CREATE VIRTUAL TABLE eureka_vec USING vec0(node_id TEXT, embedding float[384])')]
  SELECT FROM eureka_vec -> OperationalError: no such module: vec0
```
[VERIFIED: executed live 2026-09-03, Python 3.12.3 / sqlite 3.45.1, Node v22.23.1]

The BLOB encoding is little-endian `Float32`, written by `Buffer.from(Float32Array.from(vec).buffer)`. `numpy.frombuffer(blob, dtype=np.float32)` round-trips it exactly, zero new dependency.
[VERIFIED: `vector-store.cjs:174-182` + live round-trip above]

**The dev/prod divergence trap.** `sqlite-vec` is declared in `package.json` **`dependencies`** (`^0.1.9`), not `optionalDependencies` - so it is installed on every real user machine. It is **absent** from `node_modules/` in this worktree. Consequence:

- In this dev checkout: probe fails -> `eureka_vec_fallback` -> a direct Python `SELECT` **works**.
- On a real install: probe passes -> `eureka_vec` -> a direct Python `SELECT` **throws `no such module: vec0`**.

A verification step run only in this repo would go green on code that is broken for every user. `python3 -c "import sqlite_vec"` also fails here; adding the PyPI `sqlite-vec` package would violate the Discretion clause's "no new third-party package."
[VERIFIED: `package.json` dependency class + `ls node_modules/sqlite-vec` (absent) + live import probe]

**Conclusion for D-02:** the direct-sqlite3 default named in D-02 is **not safe**. Use the CJS-side export step the Discretion clause already permits. Concretely: a small CJS entry point that opens the room with `openRoomDb(roomDir, {allowExtension:true})`, calls `vector-store.knnQuery` (or dumps `{node_id, vector}` pairs), and writes JSON to stdout or a temp file for Python to read. This is backend-agnostic by construction and adds no dependency. Precedent for exactly this shape already exists: `lib/core/rs-pinecone-bridge.cjs` shells `python3` from CJS today (the mirror-image handoff).

There is a secondary, lower-cost option: keep the Python read but **force the fallback backend** via `MINDRIAN_FORCE_NO_VEC0` (an env seam `vector-store.cjs:104` already honors). Do not take it - it degrades every other eureka consumer's search backend repo-wide to satisfy one reader.

**WAL / locking:** `openRoomDb` runs `PRAGMA journal_mode = WAL` and `synchronous = NORMAL`, and passes `timeout: 5000` to the `DatabaseSync` constructor (the Node `>=22.16.0` floor exists precisely because `timeout` is silently ignored below it). Under WAL, readers never block writers, so a Python read-only reader is safe concurrently with a CJS writer. Open the Python side with `sqlite3.connect('file:<path>?mode=ro', uri=True)` so a reader can never attempt a write and never create `-wal`/`-shm` files it does not own.
[VERIFIED: `lib/core/room-db.cjs:235-266`; CLAUDE.md Technology Stack table for the version-floor rationale]

### F-3 (HIGH): `rs-engine.py` internal and cross-room modes already call zero Pinecone

`compute_embeddings()` resolves to `_embed_local_minilm` (local `sentence-transformers` `all-MiniLM-L6-v2`) for the internal path, caching to `.rs-engine-cache.json` keyed by `sha256(text)[:16]`. The Pinecone entry point on that path, `_embed_via_pinecone_inference`, is a **stub that raises `NotImplementedError`** and has been since Plan 89-01.
[VERIFIED: `scripts/rs-engine.py:268-299`, `:302-388`]

`run_mode_internal` and `run_mode_cross_room` never reference `_rs_cache_*` or `PINECONE_API_KEY`. Pinecone enters only at `run_mode_external` (`:1195`) and transitively at `run_mode_hybrid` (`:1467`), both gated on `_pinecone_path_available()` which requires `PINECONE_API_KEY` **and** `RS_EMBEDDING_MODEL != minilm`.
[VERIFIED: `scripts/rs-engine.py:975-985`, `:1221-1289`]

SEED-030's acceptance item 2 lists all four modes as needing repoint. Two of the four were already compliant when the seed was written.

### F-4 (HIGH): the real Pinecone surface is `rs_cache.py`, and Phase 272 explicitly deferred it here

`lib/core/rs_cache.py` (479 lines) is the whole remaining coupling: `ensure_index` (`create_index_for_model`), `get_namespace_freshness`, `upsert_corpus`, `fetch_all_from_namespace`, `is_fresh`, 30-day lazy TTL, `multilingual-e5-large` **1024-dim** server-side embedding, namespace-per-topic. `lib/core/rs_hybrid.py` consumes it for Mode C. `requirements-hsi.txt` declares `pinecone>=5.0.0`.
[VERIFIED: `lib/core/rs_cache.py`, `lib/core/rs_hybrid.py:176-250`, `requirements-hsi.txt`]

`lib/core/pinecone-inference.cjs`'s own header states the boundary verbatim:

> "This is the ENTIRE in-scope Pinecone surface for this phase (D-10): the external corpus control/data-plane SDK surface in `lib/core/rs_cache.py` (create_index_for_model, has_index, describe_index, upsert_records, list(), query) is **explicitly descoped to a follow-up phase**. Do not extend this module toward that surface."

[CITED: `lib/core/pinecone-inference.cjs:3-11`]

**Phase 296 is that follow-up phase.** This is the cleanest available scope statement for the plan.

Two design constraints the planner must carry into it:

1. **Dimensional invariant.** External Pinecone vectors are 1024-dim e5-large; local vectors are 384-dim mdbr-leaf-ir. Both `rs-engine.py:1454-1464` and `rs-engine.cjs:20-30` document that mixing them in one cosine is a silent dimensional bug, and that Mode C's current safe path is to re-embed the **entire** unified corpus in the single local 384-dim space. Localizing the external cache **removes** this hazard rather than creating it - the whole corpus becomes one space. Say so in the plan; it is a benefit, not a risk.
2. **`fetch_corpus` stays.** `lib/core/rs_corpus.py` is a pure OpenAlex/arXiv/Tavily fetcher with **zero Pinecone calls** (its only two Pinecone mentions, `:470` and `:527`, are comments). Do not touch it. Only the cache/embed layer moves.
   [VERIFIED: grep of `lib/core/rs_corpus.py`]

`lib/core/rs_corpus_exclude.py` (62 lines) is likewise just shared `SKIP_DIRS` / `SKIP_FILES` / `MIN_BODY_CHARS` constants - it is a de-duplication module, and CONTEXT.md's reading of it as "precedent for Python/CJS coexistence" is fine but it carries no logic this phase changes.
[VERIFIED: direct read]

### F-5 (HIGH): identity-space mismatch - RS artifacts are files, eureka vectors are graph nodes

`rs-engine.py::discover_artifacts` walks `room_dir` for `.md` files and mints ids of the form `"<section>/<file-stem>"`. Its own docstring is explicit about why:

> "Plan 89-01 said to read room.db artifacts directly; that table does not exist. We walk the filesystem instead (same pattern as compute-hsi.py) so the port works against real rooms."

[CITED: `scripts/rs-engine.py:183-193`]

Meanwhile `tri-modal-index.cjs::indexNodes` populates the vector store from `SELECT id, type, properties FROM nodes` - graph node ids, from room.db.
[VERIFIED: `lib/core/eureka/tri-modal-index.cjs:401-440`]

These are **two different corpora keyed in two different id spaces**. `eureka_vec` contains no row for `"01_Discovery/interview-notes"`. A task phrased as "point RS at the vectors that already exist" will produce zero joins.

The CJS port made the same call: `rs-engine.cjs` also walks the filesystem and keeps its own `.rs-engine-cache.json`, calling `embedTexts` directly rather than reading the vector store.
[VERIFIED: `lib/core/rs-engine.cjs:181, 197-305`]

**Planner impact:** "repoint RS onto the local embedding layer" means *reuse the local encoder* (`embedTexts`), not *read the eureka vector tables*. That reuse is already done for Mode A in CJS; the work is extending it to the external corpus. If the navigator genuinely wants RS reading `nodes`-keyed vectors, that is a corpus-unification decision an order of magnitude larger than this phase and belongs in its own seed.

### F-6 (HIGH): `rs-experts` has no remote Brain call and no live Aura path

The command frontmatter carries an explicit removal comment:

```yaml
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
  # mcp__mindrian-brain__read_neo4j_cypher intentionally removed (BUG 2 fix):
  # Author/Paper/Institution nodes are LOCAL-only (populated by /mos:rs-fetch).
  # The remote Brain must never be called from this command.
```
[CITED: `commands/rs-experts.md:18-24`]

`scripts/rs-experts-command.cjs:43-46`: "brainClient is intentionally NOT loaded here." The BUG 2 fix landed `2f0e4e79`, 2026-05-22 - which **predates** SEED-030's own 2026-06-17 evidence date, so the seed's claim that "`rs-experts` resolves the expert network via Brain Cypher MATCH" was already stale when written. SEED-030's `staleness_note` corrected item 1 but explicitly left items 2-3 un-re-verified; this is the item-3 correction.
[VERIFIED: `git log --format="%h %ad" -- scripts/rs-experts-command.cjs`]

Further, `commands/rs-experts.md:68`: "**No live Tier 1 Aura query path ships in the current command.** Every invocation surfaces the Tier 0 guidance message." The script confirms it - `main()` unconditionally reaches the Tier-0 branch and `process.exit(0)`.
[VERIFIED: `scripts/rs-experts-command.cjs:140-155`]

The optional Brain leg that does exist, `lib/core/rs-expert-brain-projection.cjs`, already satisfies the "never crashes" half of the seed's test on **every** failure path:

| Failure | Behavior |
|---------|----------|
| Brain absent (no key / no MCP) | `return []` (`:227`) |
| Part-8 guard verdict not `allow`, or guard throws | `return []` (`:253-256`) |
| Brain read throws | `return []` (`:263-264`) |
| Person-byte detected in outbound payload | `return []` (`:238`) |

[VERIFIED: direct read of `lib/core/rs-expert-brain-projection.cjs`]

**So the D-03 deliverable as literally written ("stop it crashing") is already green.** The plannable gap is F-7.

### F-7 (HIGH): the real `rs-experts` gap is cause-conflation, and the fix module already exists

Today `rs-experts` emits one hand-rolled 3-line block for **three distinct causes**:

```
x Aura not connected
  Why: rs-experts requires a local Aura mirror; remote Brain is not used for Author/Paper data
  Fix: /mos:rs-fetch <topic> first to populate the local SQLite mirror, then retry
```
plus a JSON shape `{tier:'tier0', authors:[], degraded_note:'local_aura_transport_not_yet_available'}`.
[VERIFIED: `scripts/rs-experts-command.cjs:147-155`]

The three causes it collapses: (a) no Tier-1 transport ships at all, (b) the transport ships but the instance is unreachable, (c) the transport works and the topic genuinely has zero experts. Cause (c) is a **correct answer**; dressing it as a fault tells the user the tool is broken when it worked perfectly. This is the same conflation Theo names as `CONN-05`'s empty-versus-broken discipline (see Theo section below) and that `rs-explain-command.cjs` already handles correctly on this side of the fence.

**The reuse target (Canon Part 7).** `lib/core/refusal-messaging.cjs` is the shipped canonical refusal rail:

```js
const REFUSAL_KINDS = Object.freeze([
  'no_key', 'unreachable', 'tier_denied', 'not_ready', 'rate_limited', 'egress_blocked'
]);
// KIND_STATUS.unreachable === 'BRAIN_UNREACHABLE'
// NEXT_MOVES.unreachable === ['retry', 'continue_without']
```

Exports: `refusalResponse(kind, ctx)` -> `{status, kind, reason, command_context, next_moves}`; `renderRefusal(kind, ctx)` -> multi-line Larry copy block; `larryRefusalLine(kind, detail)` -> one line, statusline-safe.

The shipped copy for `unreachable`:

- reason: `"The methodology graph is unreachable right now for <tool> (after the bounded retry budget). Larry will not fake what it would say."`
- one-liner: `"Brain unreachable right now. I will not fake it."`

[VERIFIED: `lib/core/refusal-messaging.cjs:202, 221, 259-260, 307, 341-357, 425-475, 515-525`]

**The in-family precedent to copy.** `scripts/rs-explain-command.cjs` - the sibling `rs-*` command - already does this:

```js
} catch (err) {
  if (err && /unreachable|connect|ECONNREFUSED/i.test(err.message || '')) {
    out._brain_degraded = 'brain_unreachable';
  } else {
    out._brain_error = err && err.message ? err.message : String(err);
  }
}
```
and at the render site:
```js
const brainNote = brainDegraded === 'brain_unreachable'
  ? ' (Brain refused: unreachable)'
  : (brainDegraded ? ' (Brain offline: Mode B)' : '');
const auraNote = queryResults._cypher_degraded ? ' (Aura offline: Tier 0)' : '';
```
[VERIFIED: `scripts/rs-explain-command.cjs:182-201, 296-308`]

Note the two **separate** notes: `_brain_degraded` and `_cypher_degraded` render independently, so Brain-offline and Aura-offline never collapse. That separation is the exact property `rs-experts` lacks. Also note the byte-lock warning at `:192-199`: the literal `'brain_unreachable'` is asserted verbatim by `lib/memory/test-rs-explain-command.cjs` Test 2, so Phase 252-01 aligned only the **visible copy**, not the marker value. Any new marker `rs-experts` introduces should follow the same rule - align display copy to the rail's vocabulary, keep machine markers stable and separately named.

CONTEXT.md's Discretion clause grants "exact wording" freedom. **Do not exercise it.** Use `refusal-messaging.cjs`'s shipped copy; inventing a seventh phrasing is precisely the duplication Part 7 forbids.

### F-8 (MEDIUM): a live Python Mode-C caller exists and would be affected

`scripts/auto-explore-fire.cjs:184-205` spawns `python3 scripts/rs-engine.py --mode hybrid --room <roomDir> --topk 5` directly, in parallel with `discovery-cycle.cjs`, under a pipeline timeout. It does **not** route through `rs-backend-dispatch.cjs`.
[VERIFIED: `scripts/auto-explore-fire.cjs:175-215`]

`rs-backend-dispatch.cjs`'s own header flags this: "no caller requires it yet - that wiring lands in a later wave (272-10) ... `tests/272-dispatch-chokepoint.sh` and `tests/272-rule6-amended.sh` stay RED until that wiring lands."
[CITED: `lib/core/rs-backend-dispatch.cjs:38-44`]

Two callers **do** require it (`lib/core/intelligence-cascade.cjs:52`, `lib/core/futures/orchestrator.cjs:31`), so the wiring is partial. `auto-explore-fire.cjs` is a hybrid-mode caller and hybrid is exactly the mode this phase touches - **the planner must include it in the blast radius.** Whether to also route it through the chokepoint is a scope call for the navigator; noting it is not optional.

### F-9 (VERIFIED, sanity check): connector-registry rs-* entries confirmed

All four `rs-*` surfaces appear in `data/connector-registry.json`, in both the `/mos:` and `skill:` families, plus two index blocks:

```
1073: "surface": "/mos:rs-experts"      2444: "surface": "skill:rs-experts"
1090: "surface": "/mos:rs-explain"      2459: "surface": "skill:rs-explain"
1107: "surface": "/mos:rs-fetch"        2474: "surface": "skill:rs-fetch"
1124: "surface": "/mos:rs-thesis"       2489: "surface": "skill:rs-thesis"
3426-3429, 3550-3559: index blocks
```
SEED-030's `staleness_note` (2026-07-15) holds. Acceptance item 1 is done; keep only a regression fence.
[VERIFIED: grep of `data/connector-registry.json`]

### F-10 (HIGH): Phase 295 / SEED-029 is a stub, and its core already shipped elsewhere

`.planning/ROADMAP.md:1054-1059`:
```
### Phase 295: SEED-029: Local-Embedding Vector Spine in room.db, Retire Pinecone for Room + Signal
**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 294
**Plans:** 0 plans
```
No `.planning/phases/295-*/` directory exists. Phase 295 has never been planned or executed.
[VERIFIED: ROADMAP read + `ls .planning/phases/`]

But SEED-029's technical shape shipped anyway, under Phase 211 + quick `260706-13z` (SEED-049 D1), with **deliberate, documented improvements** over what the seed specified:

| SEED-029 asked for | What actually shipped | Where |
|---|---|---|
| `transformers.js` (xenova) `all-MiniLM-L6-v2`, 384-dim | `@huggingface/transformers`, `MongoDB/mdbr-leaf-ir`, 384-dim, q8 (MiniLM retained in `KNOWN_MODEL_DIMS` as rollback) | `embedding-spine.cjs:105-127` |
| BLOB column on `nodes`, or a sidecar `embeddings` table | sidecar `eureka_vec` (vec0) / `eureka_vec_fallback` + `eureka_meta` | `vector-store.cjs:258-321` |
| Written through the `navigation.cjs` chokepoint | **Deliberately NOT** - documented as Part-9-compliant because these are rebuildable derived projections (zero typed edges, zero `memory_event` rows, zero node mutations) | `vector-store.cjs:32-45` |
| Brute-force cosine in JS; add `sqlite-vec` only past ~50k vectors | `sqlite-vec` primary + brute-force CJS cosine fallback, behind an adapter seam | `vector-store.cjs:14-31` |
| No API key for any room-local surface (F7 gone) | Holds - local ONNX, no key | `embedding-spine.cjs:36-45` |
| Per-room vectors, no cross-room bleed (F8 gone) | Holds for the **room** corpus. **Does NOT hold for the signal corpus** - `rs_cache.py`'s Pinecone namespaces are the original F8 site and are still live. | F-4 |

**Verdict on the orchestrator's critical open question:** the existing `embedding-spine.cjs` / `vector-store.cjs` **is** the local embedding layer SEED-029 asked for, shipped under Phases 211/272 rather than 295, and it satisfies SEED-029 acceptance items 1, 2, 3, and 5 for the **ROOM** corpus. Phase 295 is therefore substantially redundant. What it does **not** cover is SEED-029's **SIGNAL corpus** leg - "retire the pre-built `rs-external` Pinecone index (kills F8)" - which is the same gap F-4 identifies as this phase's real work, and SEED-029 acceptance item 4 (the moat decision on the METHODOLOGY corpus), which is a navigator ruling, not code.

**Recommendation:** Phase 296 does **not** need to wait on Phase 295. Phase 295 should be closed as substantially-shipped-elsewhere with its residual SIGNAL-corpus scope folded into 296, or narrowed to the unshipped remainder. That is a navigator call, but planning 296 behind a 295 that will never usefully execute would stall this indefinitely. The `**Depends on:** Phase 295` heading is `phase.add` boilerplate (this repo's CLAUDE.md and the 2026-08-27 handoff both name the `phase.add` heading bug); the *coincidental* real dependency it might have named is satisfied.

---

## Runtime State Inventory

Not a rename/refactor/migration phase in the string-replacement sense, but it retires a **remote cache**, so the same "what still holds state after the code changes" discipline applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (remote) | **Pinecone `rs-external` index**, one namespace per topic slug (`rs_cache.namespace_slug`), 30-day lazy TTL, 1024-dim e5-large vectors. SEED-029 F8 recorded it holding a *prior project's* corpus (`nv-diamond-magnetometry`) and silently serving it cross-room. | Retiring the code path does **not** delete the remote index. An operator step (delete index / revoke key) is a separate task; name it explicitly rather than assuming code removal is retirement. |
| Stored data (local) | `<room>/.rs-engine-cache.json` (Mode A embedding sidecar, keyed `sha256(text)[:16]` + model name). Written by **both** `rs-engine.py` and `rs-engine.cjs`. `<room>/research/<slug>/_corpus.jsonl` + `.rs-engine-results.json`. `<room>/.rs-engine-cross-room-cache/`. | Cache entries carry a `model` field and invalidate on model change - self-healing, no migration. But a **local signal cache** is net-new state this phase introduces; decide its location and invalidation up front. |
| Stored data (room.db) | `eureka_vec` / `eureka_vec_fallback` / `eureka_meta`. Rebuildable projections; `ensureStore` already handles the dim-mismatch drop-and-rebuild. `REVERSE_SALIENT` edges written with `properties.source='rs-engine'`. | No migration. If a new signal-corpus table lands in room.db, it must follow the same "derived, rebuildable, documented Part-9 exception" framing `vector-store.cjs:32-45` established, or go through `navigation.cjs`. |
| Live service config | Pinecone index/namespace config is code-resident (`rs_cache.py` constants), not in a remote UI. No n8n/Datadog/Cloudflare surface involved. | None. |
| Secrets / env vars | `PINECONE_API_KEY` (gates `_pinecone_path_available`, `rs_hybrid`, `compute-hsi.py` Tier 2, `rs-pinecone-bridge.cjs`, `pinecone-inference.cjs`). `RS_EMBEDDING_MODEL` (`minilm` opts out of Pinecone). `MINDRIAN_RS_BACKEND` (`python`\|`cjs`, default `cjs`). `MINDRIAN_EMBED_MODEL` / `_DIM` / `_DTYPE` / `_BATCH` / `MINDRIAN_MODEL_CACHE`. `MINDRIAN_FORCE_NO_VEC0`, `MINDRIAN_FORCE_FTS_ABSENT` (test seams). | **`PINECONE_API_KEY` is still load-bearing for `compute-hsi.py` Tier 2 and `pinecone-inference.cjs` after this phase.** Do NOT plan a blanket removal. Scope removal to the `rs_cache.py` surface only. |
| Build artifacts / installed packages | `pinecone>=5.0.0` in `requirements-hsi.txt`. `sqlite-vec ^0.1.9` and `@huggingface/transformers ^4.2.0` in `package.json` `dependencies`. `~/.mindrian/model-cache/` (ONNX weights, `resolveCacheDir`). `dist/generic-claude-dir/` + `dist/zed/` carry generated copies of all four `rs-*` skills. | If `rs_cache.py` is retired, `pinecone` may leave `requirements-hsi.txt` **only if** `compute-hsi.py` Tier 2 is also handled - check before editing. `dist/` is generated by `scripts/build-dist-bundles.cjs`; never hand-edit. |

---

## Standard Stack

No new libraries. Everything this phase needs already ships.

### Core (all already installed and load-bearing)

| Module | Version / Source | Purpose | Why Standard |
|--------|------------------|---------|--------------|
| `lib/core/eureka/embedding-spine.cjs` | in-repo, Phase 211-01 | The ONE local encoder. `embedTexts(texts, opts)` | Every semantic surface in the repo already routes through it; a second encoder instance is an explicit anti-pattern (`rs-engine.cjs:31-35`) |
| `lib/core/eureka/vector-store.cjs` | in-repo, quick 260706-13z | Vector persistence + `knnQuery`, backend-agnostic | The documented single seam for a backend swap |
| `lib/core/refusal-messaging.cjs` | in-repo, Phase 250/252 | `refusalResponse` / `renderRefusal` / `larryRefusalLine`, `REFUSAL_KINDS` | The canonical refusal rail; `rs-experts` currently bypasses it |
| `lib/core/room-db.cjs` | in-repo | `openRoomDb(roomDir, {allowExtension})` - the single door to room.db | WAL + `timeout:5000` + migration chain live here; never open room.db by hand |
| `lib/core/rs-backend-dispatch.cjs` | in-repo, Phase 272 | `resolveBackend()` -> `'cjs'\|'python'` | The ONE place backend selection may happen |
| `@huggingface/transformers` | `^4.2.0` (`dependencies`) | ONNX feature-extraction runtime | Already installed; lazy-required inside `getEncoder` |
| `sqlite-vec` | `^0.1.9` (`dependencies`) | vec0 KNN | **Present on user machines, absent in this checkout** - see F-2 |
| `node:sqlite` `DatabaseSync` | Node `>=22.16.0` | room.db driver | Floor is 22.16.0 because `timeout` is silently ignored below it |
| Python `sqlite3` (stdlib) | 3.12.3 / sqlite 3.45.1 | Python-side read, IF the CJS-export route is rejected | stdlib, zero new dependency - but see F-2's vec0 limitation |
| `numpy` | already in `requirements-hsi.txt` | `np.frombuffer(blob, dtype=np.float32)` | Already a hard RS dependency |

### To be retired (not added)

| Module | Disposition |
|--------|-------------|
| `lib/core/rs_cache.py` (479 lines) | The retirement target. Replace with a local embed-and-cache path. |
| `pinecone>=5.0.0` in `requirements-hsi.txt` | Removable ONLY after checking `compute-hsi.py` Tier 2 (`scripts/compute-hsi.py:364-376`) and `lib/core/rs-pinecone-bridge.cjs` |
| `lib/core/pinecone-inference.cjs` | **KEEP.** Phase 272 shipped it deliberately as the topic-gate embedder; out of scope here. |

**Installation:** none. Zero new packages.

**Version verification:**
```bash
node --version    # v22.23.1 (>= 22.16.0 floor) [VERIFIED live]
python3 --version # Python 3.12.3               [VERIFIED live]
```

---

## Package Legitimacy Audit

**Not applicable - this phase installs zero external packages.** Every module it consumes is either in-repo (`lib/core/**`) or an already-declared `package.json` / `requirements-hsi.txt` dependency that predates this phase. The `slopcheck` gate is skipped on the "no new packages" branch, not on a tooling failure.

If the planner deviates and introduces a package (for example the PyPI `sqlite-vec`, which F-2 recommends **against**), the full Package Legitimacy Gate must run first and the Discretion clause's "no new third-party package" constraint must be re-opened with the navigator.

---

## Architecture Patterns

### System Architecture Diagram

```
                        /mos:find-bottlenecks        /mos:rs-experts
                        /mos:futures  auto-explore          |
                                |                           |
                                v                           v
              +---------------------------------+   +---------------------------+
              | rs-backend-dispatch.resolveBackend|  | rs-experts-command.cjs    |
              |   env MINDRIAN_RS_BACKEND         |  |  (never loads brainClient)|
              |   default -> 'cjs'                |  +---------------------------+
              +---------------------------------+                 |
                     |                    |                       | Tier-0 ONLY today
            'cjs'    |                    | 'python'              | (no Tier-1 transport)
                     v                    v                       v
        +---------------------+   +--------------------+   +--------------------------+
        | rs-engine.cjs       |   | rs-engine.py       |   | hand-rolled 3-line block |
        | Mode A internal ONLY|   | Modes A/B/C        |   | "Aura not connected"     |
        +---------------------+   +--------------------+   | 3 causes -> 1 string     |
                     |               |        |        |   +--------------------------+
        walk *.md    |               | Mode A | Mode B/C          ^
        discoverArtifacts            | local  | EXTERNAL          | GAP (F-7): should route
                     |               | MiniLM |                   | through refusal-messaging
                     v               v        v                   |
        +----------------------+  +--------+  +---------------+   |
        | embedding-spine      |  | .rs-   |  | rs_corpus.py  |   |
        |   embedTexts()       |  | engine-|  | OpenAlex/arXiv|   |
        |   384-dim, local ONNX|  | cache. |  | /Tavily fetch |   |
        |   ZERO egress        |  | json   |  | (no Pinecone) |   |
        +----------------------+  +--------+  +---------------+   |
                     |                              |             |
                     |                              v             |
                     |                       +----------------+   |
                     |                       | rs_cache.py    |   |
                     |                       | PINECONE       |<--+-- THE GAP (F-4)
                     |                       | rs-external ns |       SEED-029 SIGNAL leg
                     |                       | 1024-dim e5    |       Phase 272 D-10 deferred
                     |                       | 30d TTL, REMOTE|       it explicitly to here
                     |                       +----------------+
                     |
   (SEPARATE corpus, SEPARATE id space -- see F-5)
                     |
        +------------v-----------------------------------------+
        | tri-modal-index.indexNodes                            |
        |   SELECT id,type,properties FROM nodes                |
        +-------------------------+-----------------------------+
                                  v
                    +---------------------------+
                    | vector-store.cjs          |
                    |   ensureStore(db, dim)    |
                    |   PROBE: vec0 loadable?   |
                    +------+-------------+------+
                      yes  |             |  no
                           v             v
              +----------------+   +--------------------------+
              | eureka_vec     |   | eureka_vec_fallback      |
              | vec0 VIRTUAL   |   | node_id / dim / BLOB     |
              | Python: BLOCKED|   | Python: READABLE         |
              +----------------+   +--------------------------+
                    (real installs)      (this dev checkout)
                           \             /
                            v           v
                        room.db (WAL, timeout:5000)
                        + eureka_meta{embedding_model, embedding_dim}
```

### Pattern 1: Caller-owned db handle (the navigation pattern)

**What:** Every vector/index module takes a `db` handle the caller opened. The module never opens room.db and never requires `room-db.cjs`.
**When to use:** any new module this phase adds under `lib/core/eureka/` or touching room.db.
**Why:** the pre-commit navigation allow-list checks for it, and `room-db.cjs`'s `auditBypassIfNeeded` soft-defense fires on direct opens.

```js
// Source: lib/core/eureka/vector-store.cjs:40-44 (verbatim contract)
// CALLER-OWNED HANDLES: every function takes a db handle the CALLER opened.
// This file NEVER opens room.db and NEVER requires room-db.cjs, so the
// pre-commit navigation allow-list stays intact. The sqlite-vec primary leg
// needs a handle built with allowExtension:true; on any plain handle it
// silently degrades to the CJS cosine fallback.
```

The caller side, for a handle that must support vec0:
```js
// Source: scripts/entity-extract.cjs:976 / lib/core/eureka/research-filing.cjs:331
const db = openRoomDb(roomDir, { allowExtension: true });
```

### Pattern 2: Structured degrade envelope, never a throw

**What:** every failure returns `{success:false, error:'<stable_tag>', detail}`; nothing throws across a module boundary.
**Example tags in use:** `encoder_unavailable`, `embed_failed`, `pinecone_api_key_missing`, `network_error`, `shape_mismatch`, `brain_unreachable`.

```js
// Source: lib/core/eureka/embedding-spine.cjs:479-482
const enc = await getEncoder(options);
if (!enc.success) {
  return { success: false, error: 'encoder_unavailable', detail: enc.detail };
}
```

### Pattern 3: Process-latched capability probe with a forced test seam

**What:** compute a capability verdict at most once per process; expose an env + opts seam to force the negative branch offline.
**Why it matters here:** it is the ONLY way to test the vec0-present path in a checkout where `sqlite-vec` is not installed.

```js
// Source: lib/core/eureka/vector-store.cjs:104-111
const forcedEnv = process.env.MINDRIAN_FORCE_NO_VEC0;
if (options._forceVec0Unavailable || (typeof forcedEnv === 'string' && forcedEnv !== '')) {
  if (_vecVerdict === null) { _vecVerdict = { ok:false, detail:'forced_unavailable' }; _vecProbeComputations += 1; }
  return { ok: false, detail: 'forced_unavailable' };
}
```

### Pattern 4: Refusal rail (the F-7 fix shape)

```js
// Source: lib/core/refusal-messaging.cjs:341-357, 515-525
const { refusalResponse, renderRefusal, larryRefusalLine } = require('../lib/core/refusal-messaging.cjs');

const env = refusalResponse('unreachable', { tool: 'rs-experts' });
// -> { status:'BRAIN_UNREACHABLE', kind:'unreachable',
//      reason:'The methodology graph is unreachable right now for rs-experts
//              (after the bounded retry budget). Larry will not fake what it would say.',
//      command_context:'rs-experts', next_moves:['retry','continue_without'] }

process.stdout.write(renderRefusal('unreachable', { tool: 'rs-experts' }));  // CLI block
larryRefusalLine('unreachable');  // 'Brain unreachable right now. I will not fake it.'
```

### Pattern 5: Independent degrade markers (never collapse two causes)

```js
// Source: scripts/rs-explain-command.cjs:302-307
const brainNote = brainDegraded === 'brain_unreachable'
  ? ' (Brain refused: unreachable)'
  : (brainDegraded ? ' (Brain offline: Mode B)' : '');
const auraNote = queryResults._cypher_degraded ? ' (Aura offline: Tier 0)' : '';
```
Two markers, two independent render sites. `rs-experts` needs the same shape for its three causes.

### Anti-Patterns to Avoid

- **A second ONNX encoder instance.** `rs-engine.cjs:31-35` calls out `embedTexts` as "the ONLY local encoder call site in this file - never instantiates a second ONNX feature-extraction instance." A model load is tens of MB and seconds; two is an OOM class bug.
- **Mixing 384-dim local vectors with 1024-dim Pinecone e5 vectors in one cosine.** Documented as a silent dimensional bug in `rs-engine.py:1454-1464` and `rs-engine.cjs:20-30`. There is none today; do not create one.
- **A direct Python `SELECT` against `eureka_vec`.** F-2. Passes in dev, throws for every user.
- **Inventing a seventh "Brain unreachable" phrasing.** Six exist in `REFUSAL_KINDS`. Part 7.
- **Setting `MINDRIAN_FORCE_NO_VEC0` in production to make Python reads work.** Degrades every eureka consumer's search backend repo-wide to satisfy one reader.
- **A blanket `PINECONE_API_KEY` / `pinecone` package removal.** Still load-bearing for `compute-hsi.py` Tier 2 and `pinecone-inference.cjs`.
- **Hand-editing `dist/`.** Generated by `scripts/build-dist-bundles.cjs`.
- **Deciding the backend outside `rs-backend-dispatch.cjs`.** One selection brain, mirroring the connector-spine rule.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Brain is unreachable" user message | A new 3-line error block | `refusal-messaging.cjs::refusalResponse('unreachable', {tool})` | Six kinds already curated with Larry-voice copy, statuses, and `next_moves`. Part 7. |
| Reading vectors out of room.db | A Python `SELECT ... FROM eureka_vec` | `vector-store.cjs::knnQuery` behind a thin CJS export step | Only CJS knows which of two tables is live (F-2) |
| Text -> vector | A second `pipeline('feature-extraction', ...)` | `embedding-spine.cjs::embedTexts` | Model-load singleton, batching OOM guard, cache-dir resolution, first-run notice, Part 8 boundary - all solved |
| Opening room.db | `new DatabaseSync(path)` | `room-db.cjs::openRoomDb(roomDir, opts)` | WAL, `timeout:5000`, `foreign_keys=ON`, migration chain, corruption classification, bypass audit |
| Float32 BLOB pack/unpack | Manual `struct` / DataView | `vector-store.cjs::_test.vecToBlob` / `blobToVec`; Python `np.frombuffer(b, dtype=np.float32)` | Endianness and stride already settled and round-trip-verified |
| Cosine similarity | A fresh implementation | `require('./rs-pinecone-bridge.cjs').cosineSimilarity` (re-exported by `embedding-spine.cjs`) | Same function object across the repo, deliberately not forked |
| Backend selection (CJS vs Python) | Per-caller env reads | `rs-backend-dispatch.cjs::resolveBackend()` | Explicit "no second selection brain" rule |
| Room-walker skip lists | New `SKIP_DIRS` literals | `lib/core/rs_corpus_exclude.py` | Three walkers drifted before this module existed |
| Node upsert / edge write from RS | Raw `INSERT INTO nodes` | `node-insert.cjs::insertNode` + `lazygraph-ops::upsertEdge` | R17 made `node-insert.cjs` the single node-write chokepoint with fail-closed `epistemic_type` validation |

**Key insight:** SEED-030's Part-7 framing ("this is WIRING, not new machinery; net-new is near-zero") is *more* true than the seed knew. Every capability this phase needs already exists and is battle-tested; the deliverable is connecting existing seams and deleting a remote one.

---

## Common Pitfalls

### Pitfall 1: The dev/prod vector-backend divergence (HIGHEST RISK)

**What goes wrong:** Python reads vectors fine in this repo, throws `no such module: vec0` on every real user install.
**Why:** `sqlite-vec` is a hard `dependencies` entry (installed for users) but absent from `node_modules/` here, and `vector-store.cjs` picks its table from a live probe.
**How to avoid:** route the read through CJS. If any direct-SQL read ships anyway, its test must run **both** branches - once with `sqlite-vec` present and once with `MINDRIAN_FORCE_NO_VEC0=1`.
**Warning signs:** a verification step that only runs `python3 -c "...SELECT...eureka_vec..."` in this checkout and reports PASS.

### Pitfall 2: Planning against CONTEXT.md's stale premises

**What goes wrong:** tasks target `embedding-spine.cjs`'s (nonexistent) writes, or "remove the rs-experts Brain-Cypher call" that was removed in May.
**Why:** SEED-030's evidence is dated 2026-06-17 and its `staleness_note` explicitly did not re-verify items 2-3. CONTEXT.md inherited both.
**How to avoid:** surface F-1, F-3, F-6 to the navigator **before** writing tasks. Get D-01's and D-03's factual premises amended.
**Warning signs:** a task that says "swap the Pinecone call in `rs-engine.py` internal mode" - there is none.

### Pitfall 3: Assuming the two corpora share an id space

**What goes wrong:** a join between RS artifacts (`"01_Discovery/notes"`) and `eureka_vec` rows (`nodes.id`) returns zero rows, silently.
**Why:** F-5 - filesystem walk vs `SELECT ... FROM nodes`.
**How to avoid:** "reuse the local *encoder*", not "read the eureka *vectors*". Verify any join is non-empty on a real room before building on it.
**Warning signs:** a result set that is empty but reports success.

### Pitfall 4: Breaking `compute-hsi.py` while retiring Pinecone

**What goes wrong:** `pinecone` leaves `requirements-hsi.txt`; `compute-hsi.py --tier 2` breaks; the failure is **silent** because the import is try/except-guarded and the feature just returns a degraded result.
**Why:** `.planning/debug/python-requirements-orphan-deps-audit.md` F-AUDIT-02 documented this exact silent-degrade class for the whitespace pipeline.
**How to avoid:** grep every `PINECONE_API_KEY` and `import pinecone` site before touching `requirements-hsi.txt`. Known sites: `rs_cache.py`, `compute-hsi.py:364-376`, `consolidate-pinecone.py`, `rs-pinecone-bridge.cjs`, `pinecone-inference.cjs`.
**Warning signs:** HSI scores that look plausible but changed after the edit.

### Pitfall 5: Missing `auto-explore-fire.cjs` in the blast radius

**What goes wrong:** hybrid-mode behavior changes; `auto-explore-fire.cjs` spawns `python3 rs-engine.py --mode hybrid` directly, outside the dispatch chokepoint, and its failure is swallowed into a `markFailed(..., 'all_pipelines_empty')` telemetry tag.
**How to avoid:** include `scripts/auto-explore-fire.cjs:184` in the change inventory and add an explicit end-to-end check.
**Warning signs:** `auto_explore_skipped` telemetry rising after the change with no other symptom.

### Pitfall 6: Regressing the Part-8 dual-layer egress audit

**What goes wrong:** replacing `rs_cache.py` drops the `auditQueryString` (pre-egress) / `auditQueryObject` (post-receive) audit contract.
**Why:** `pinecone-inference.cjs:20-28` flags this exact risk for its own clean-slate rewrite.
**How to avoid:** if the replacement still makes any network call (the `rs_corpus.py` fetch does), keep the audit layers. If the replacement is fully local, state explicitly in the plan that no egress class remains and therefore no audit layer is needed - do not leave it ambiguous.

### Pitfall 7: Breaking a byte-locked test marker

**What goes wrong:** renaming `'brain_unreachable'` breaks `lib/memory/test-rs-explain-command.cjs` Test 2, which asserts the literal verbatim.
**How to avoid:** follow the Phase 252-01 precedent - align **visible copy** to the rail's vocabulary, leave machine marker values alone (`rs-explain-command.cjs:192-199`).

### Pitfall 8: Holding a write transaction across an `await`

**What goes wrong:** room.db locks for the duration of a model forward pass.
**Why:** `tri-modal-index.cjs:397-400` - "Deliberately NOT wrapped in BEGIN/COMMIT: this function awaits `embedTexts` mid-body, and holding a write transaction across that await would lock room.db."
**How to avoid:** embed first, then write. Never `BEGIN` around an `await` on the encoder.

---

## Code Examples

### Recommended: CJS-side vector export (the D-02 answer)

```js
// Backend-agnostic by construction: only CJS knows which table is live.
// Source pattern: scripts/entity-extract.cjs:976 (handle) +
//                 lib/core/eureka/vector-store.cjs:366-392 (knnQuery)
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const vec = require('../lib/core/eureka/vector-store.cjs');

let db = null;
try {
  db = openRoomDb(roomDir, { allowExtension: true });   // allowExtension is REQUIRED for vec0
  const meta = vec.readMeta(db);                        // {embedding_model, embedding_dim}
  const hits = vec.knnQuery(db, queryVector, k);        // [{node_id, score}] score DESC, both backends
  process.stdout.write(JSON.stringify({ meta, hits }) + '\n');
} finally {
  if (db) closeRoomDb(db);
}
```

### Reference only: direct Python read (works ONLY on the cjs-fallback backend)

```python
# VERIFIED live 2026-09-03 against a WAL db written by node:sqlite.
# DO NOT SHIP without the vec0 guard below -- see Pitfall 1.
import sqlite3, numpy as np

con = sqlite3.connect(f'file:{room_dir}/.mindrian/room.db?mode=ro', uri=True)

# GUARD: refuse honestly rather than throw an opaque OperationalError.
row = con.execute(
    "SELECT name FROM sqlite_master WHERE name='eureka_vec'"
).fetchone()
if row is not None:
    raise RuntimeError(
        'room.db uses the sqlite-vec backend; read vectors via the CJS export step'
    )

meta = dict(con.execute('SELECT key, value FROM eureka_meta').fetchall())
for node_id, dim, blob in con.execute(
    'SELECT node_id, dim, vector FROM eureka_vec_fallback'
):
    v = np.frombuffer(blob, dtype=np.float32)   # little-endian Float32, exact round-trip
```

### The `rs-experts` degrade fix (F-7)

```js
// scripts/rs-experts-command.cjs -- replace the single hand-rolled block
// with three DISTINCT, honest outcomes. Source: lib/core/refusal-messaging.cjs
const { refusalResponse, renderRefusal } = require('../lib/core/refusal-messaging.cjs');

// (a) no Tier-1 transport ships at all -> a capability statement, not a fault
//     keep the existing marker 'local_aura_transport_not_yet_available' (stable)
// (b) transport exists but the instance is unreachable -> the rail
const env = refusalResponse('unreachable', { tool: 'rs-experts' });
// (c) transport works, zero experts matched -> a SUCCESS with an empty result.
//     Emit {tier:'tier1', authors: [], matched: 0} -- never dress it as an error.
```

Note (c): "no experts for this topic" is a **correct answer**. Theo's `CONN-05` names collapsing it with "unreachable" as the load-bearing mistake (see below).

---

## Theo Cutover Analog

Consulted per this repo's CLAUDE.md standing rule (navigator ruling 2026-09-02). Read: `/home/jsagi/Theo/notes/graph-rulebook.md`, `/home/jsagi/Theo/notes/knowledge-graph.md`, `.book-graph/resolver-config.yaml`, `.planning/REQUIREMENTS.md`, the per-phase `*-MOS-LEARNING.md` set, and the relevant `src/mcp/content/*.ts` handlers.

### 1. Expert / people-graph analog: NONE. Honest negative.

Theo's declared vocabulary is 17 node labels and 25 relationship types, enumerated in `.book-graph/resolver-config.yaml::graph_vocabulary.node_labels`:

```
Root, Phase, ToolType, DomainConcept, Chapter, Concept, Chunk, Mention,
MindrianCommand, Framework, Stage, ProcessStep, Technique, Reach,
BrainRecord, TaxonomyRecord, Sensor
```
[VERIFIED: `/home/jsagi/Theo/.book-graph/resolver-config.yaml:123-270`]

There is **no `Author`, `Person`, `Institution`, or `Expert` label**, and no `AUTHORED_BY` / `AFFILIATED_WITH` relationship type. Theo has no expert-network query pattern to align with, and none is planned in any of the 17 `*-MOS-LEARNING.md` files.

This is the **architecturally correct** state, and it independently corroborates F-6 and Canon Part 8. Theo's own `chokepoint-audit` rule 14(b) makes it structural:

> "Theo cannot read the room graph at all - `chokepoint-audit` rule 14(b) makes that structural - so `local_type`, `local_kind` and `local_edge_types` are things Larry TOLD Theo, not things Theo counted."
> [CITED: `/home/jsagi/Theo/src/mcp/content/schema-mapping-fit.ts:101-107`]

Author/Paper/Institution data is room-local user data. Theo, like the current Brain, must never see it. **Cutover implication: keeping `rs-experts` LOCAL-only is not merely compatible with the Theo cutover, it is required by it.** A D-03 implementation that restored a remote expert-graph MATCH would be a cutover-day breakage as well as a Part-8 breach. The only thing Theo knows about `rs-experts` is that it is a `MindrianCommand` node with a `USES_FRAMEWORK` edge to the `Reverse Salient Analysis` `Framework` - visible in the Phase 09 parity ledger's `recommend_chain` output.
[VERIFIED: `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/parity/20260901/ledger.md:423`]

### 2. Degrade convention analog: YES, and it is stronger than ours. Point D-03 at it.

Theo has a **named, requirement-backed** convention: **`CONN-05`, the empty-versus-broken discipline.**

> **CONN-05**: Every executor response surfaces the driver's `notifications` field as a diagnostics field on the response - a query against a mistyped label or other query-shape problem returns its `01N50`/`01N51`/`01N52`-class warning explicitly, so it can never be silently indistinguishable from a genuine, correct "not covered" empty result.
> [CITED: `/home/jsagi/Theo/.planning/REQUIREMENTS.md:36-42`, status Complete, Phase 1]

Applied consistently across Theo's content handlers, in this exact shape:

> "A resolution refusal rides INSIDE the success response and never sets the transport's error flag. Two reasons... First, CLAUDE.md rule 6 - an empty answer is a legitimate answer, and dressing it as a fault tells Larry the tool is broken when the tool worked perfectly. Second, CONN-05's empty-versus-broken discipline runs the other way too: **if 'not found' and 'the instance is unreachable' both arrive error-flagged, Larry cannot tell them apart, and those two need completely different responses.**"
> [CITED: `/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts:41-52`; same paragraph in `schema-mapping-fit.ts:87-94` and `orchestration-readiness.ts:88`]

Two further sub-rules worth importing verbatim into this phase's design:

- **Omit, never null.** "The not-found payload omits `canonical` and `matched_via` ENTIRELY rather than carrying them as null. An absent key says nothing; a null key asserts that the canonical is null, which is a claim about a node that does not exist." Same reasoning at `schema-mapping-fit.ts:96-99`: "`score: 0` is a CLAIM ... about a target that does not exist."
- **The refusal code rides along, and distinct causes get distinct codes.** `FRAMEWORK_NOT_FOUND` vs `ALIAS_CYCLE` / `ALIAS_FORK` are "DIFFERENT facts with different next moves ... A payload carrying only `coverage: empty` would collapse them."
  [CITED: `normalize-framework-name.ts:52-66`]

**This is exactly F-7.** `rs-experts` currently emits one string for three causes and returns `authors: []` on all of them - the `coverage: empty` collapse Theo names by name.

**Concrete cutover-shrinking recommendation for D-03:** implement the degrade as `{tier, authors?, refusal_code?}` where

- cause (a) no transport -> `refusal_code: 'AURA_TRANSPORT_ABSENT'`, `authors` **omitted**
- cause (b) unreachable -> `refusal_code: 'BRAIN_UNREACHABLE'` (already `refusal-messaging.cjs`'s `KIND_STATUS.unreachable`), `authors` **omitted**
- cause (c) genuinely zero experts -> **no** `refusal_code`, `authors: []` present, `matched: 0` - a success

Our `refusal-messaging.cjs` and Theo's `CONN-05` already agree on the vocabulary at the `BRAIN_UNREACHABLE` point; adopting the omit-never-null rule closes the remaining gap and makes the eventual cutover a no-op for this command instead of a rediscovery.

### 3. Vector / embedding analog: NONE relevant

Theo's Phase 9 `09-MOS-LEARNING.md` "Schema and contract changes for the local room graph" section covers `brain_query` normalization, `mode_signals`, and the `probe-brain-contract.cjs` parity legs - nothing touching vector storage, `eureka_vec`, or an external-signal corpus. Theo's own retrieval work (`notes/retrieval-eval-baseline.md`, `notes/llm-judge-eval-methodology-tavily.md`) is chunk-retrieval over the teaching corpus, a different problem from RS's room+signal differential. **No analog; nothing to align.**
[VERIFIED: read of `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md` and the notes index]

### 4. Cutover-relevant caveats the planner should carry

- Theo is **NOT deployable**: `09-MOS-LEARNING.md:202` records "**The verdict. NOT READY.**"; Phase 08.4 (remote hosting) is not started. Plan and ship against the **current** Brain, as the CLAUDE.md rule directs.
- `docs/2026-09-01-HANDOFF-...` names a verified high-risk bug: `lib/core/brain-client.cjs`'s `brain_query` normalization silently returns `{records: []}` for Theo's response shape after the flip, with zero error signal. This phase does not touch `brain_query`, but it is the same disease family as F-7 (a silent empty that should be a distinguishable refusal) - worth citing in the plan's rationale.
- Theo's refusals are **typed codes**, not the incumbent's prose markers (`09-MOS-LEARNING.md:162`, leg c: "`BoundedReadRefusal` marker is incumbent-authored text; Theo's refusals are typed codes"). Another reason to carry a `refusal_code` field rather than string-matching prose.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on this phase |
|---|---|---|---|
| Pinecone as the Brain's vector substrate | Memgraph + locally-embedded e5 (1024-dim, no egress). "Pinecone is RETIRED" | 2026-07-22 cutover | Only the **RS external corpus** still uses Pinecone. The org-level direction is already local; this phase finishes it. |
| Neo4j Aura remote Brain | `pws-brain-mcp.onrender.com` (Memgraph, Streamable HTTP), `brain-client.cjs:24` is the single URL source | 2026-07-22 (`7459706f`) | SEED-030's "Neo4j Aura / Brain Cypher" language is stale terminology. |
| `Xenova/all-MiniLM-L6-v2` 384-dim local encoder | `MongoDB/mdbr-leaf-ir` 384-dim q8 (MTEB BEIR/RTEB #1 at <=100M params); MiniLM kept as env rollback | 2026-07-06 (`e87f61f6`) | SEED-029's named model is superseded. Same dim, so no schema impact. |
| Brute-force JS cosine only | `sqlite-vec` vec0 primary + CJS cosine fallback behind an adapter seam | 2026-07-06 (`5d190a8b`) | **The source of Pitfall 1.** SEED-029 explicitly said "no `sqlite-vec` needed"; the codebase went the other way. |
| RS Mode A in Python only | `rs-engine.cjs` CJS port, default via `rs-backend-dispatch.cjs` | 2026-08-31 (`73398c39`) | Acceptance item 2's internal-mode half is already satisfied in the default path. |
| Ad-hoc per-command Brain error strings | `refusal-messaging.cjs`, six curated `REFUSAL_KINDS` | Phase 250/252 | The Part-7 target for F-7. |
| `RELATED_TO` edges | `SOURCED_FROM` (`RELATED_TO` soft-deprecated on write, still allowlisted, warns once) | 2026-09-03 (`27109d3a`) | Only if this phase writes typed edges - `REVERSE_SALIENT` is unaffected. |
| Scattered node writes | `lib/core/node-insert.cjs` single chokepoint, fail-closed `epistemic_type` | 2026-09-03 (R17) | Two named coverage gaps by design: `memory-events.cjs` and **`rs-sqlite-mirror.cjs`** - relevant if this phase touches the RS mirror. |

**Deprecated / stale in this phase's own inputs:**
- SEED-030's evidence that the four `rs-*` commands lack connector frontmatter - corrected 2026-07-15, re-verified today (F-9).
- SEED-030's claim that `rs-experts` "resolves the expert network via Brain Cypher MATCH" - false since 2026-05-22 (F-6).
- CONTEXT.md D-01's claim that `embedding-spine.cjs` "already writes to room.db" - it writes nothing (F-1).
- CONTEXT.md's framing of `rs-engine.py` internal mode as a Pinecone caller - it is not (F-3).
- STATE.md's "Phase 228 = SEED-030" - SEED-030 was registered as Phase 228 on 2026-07-15 and re-promoted as 296. **Check with the navigator whether Phase 228 should be retired to avoid a duplicate.**

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies here as |
|---|---|
| **Workspace guard** | All work runs from `/home/jsagi/dev/MindrianOS-Plugin/` (this session: its `discovery-engine-healing` worktree). Never `~/.claude/plugins/mindrian-os/`. |
| **GSD workflow enforcement** | No direct Edit/Write outside a GSD command. Personal-memory HARD RULE (2026-08-19) reinforces: ALL MindrianOS-Plugin dev work runs through GSD. |
| **Canon Part 8 (Graph Boundary)** | LOCAL -> BRAIN: NO. `rs-experts` people data stays local (F-6, already correct). Any surviving network call keeps the `auditQueryString`/`auditQueryObject` dual-layer audit. |
| **Canon Part 9 (Memory Locality)** | SQL room.db is the local mind; typed edges and `memory_event` rows only via `navigation.cjs`. Derived, rebuildable projections are the documented exception (`vector-store.cjs:32-45`) - a new signal-corpus table must justify itself under that same framing or route through the chokepoint. |
| **Canon Part 7 (Reuse Before Build)** | The organizing principle of this whole phase. Search the 25 methodology commands first; net-new should be near-zero. |
| **Canon Part 11 (CIRS)** | Every invocable surface born WIRED or EXCLUDED, with a declared `hitl_shape`. The four `rs-*` already comply; a new surface must too. `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs`. |
| **Canon Part 6 (Dog-Fooding)** | Honor our own canon here. |
| **Tri-Polar rule** | Evaluate across CLI / Desktop / Cowork. A skip is a stated call, not an oversight. `rs-experts` renders its refusal via `renderRefusal` on CLI and via the SKILL.md instruction layer on the Larry-direct MCP path - same shape, different seam. |
| **No em-dashes** | Hyphens only, anywhere. Feynman-simplified, JTBD-oriented prose. |
| **Code conventions** | CJS only, no TypeScript. `process.argv` switch-case routers, no Commander/yargs. Bash in `scripts/` stays authoritative; CJS wraps it. |
| **Grounding-source consults (MANDATORY)** | Context7 for library/API claims; langtalks for agent/LLM concepts; claude-code-guide for Claude-Code internals; icm-architect for room/ICM/local-graph work; **Theo as a standing consult for Brain-graph work** (done - see Theo Cutover Analog). |
| **Dev-research compositing** | Every phase touching MindrianOS's own architecture files in BOTH the phase `.planning/` dir AND `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked, mirrored to `mindrianOS/research/`. **This RESEARCH.md satisfies only the first home** - the room entry is still owed. |
| **Verification suites** | `bash tests/run-all-296.sh`; `node scripts/build-connector-registry.cjs --check`; `node scripts/build-orchestration-projection.cjs --check`; `node scripts/check-render-coverage.cjs`; `node scripts/doctor.cjs --acceptance`; `scripts/verify-release`. |
| **QA/RCA standard** | Defects to `.planning/debug/<slug>.md` per `docs/RCA-TEMPLATE.md` (`.planning/` is gitignored - `git add -f`). |
| **Never trust an MCP tool's own success claim** | 2026-09-03 discipline: verify writes against room.db mtime independently. Directly applicable to any task claiming it wrote vectors. |
| **icm-architect standing consult** | Bound to room-structure / local-graph / `room-db.cjs` / `navigation.cjs` work. **Not exercised in this research pass** (see Open Questions) - if a plan task adds a room.db table, run it before shipping. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all CJS | YES | v22.23.1 (floor 22.16.0) | none needed |
| `node:sqlite` `DatabaseSync` | room.db | YES | built-in (experimental warning emitted) | none |
| Python 3 | `rs-engine.py`, `rs_corpus.py` | YES | 3.12.3 | none (D-04 keeps Python) |
| Python `sqlite3` stdlib | direct-read option | YES | sqlite 3.45.1, `enable_load_extension` present | CJS export step (recommended) |
| `sqlite-vec` (npm) | vec0 KNN | **NO in this checkout** | declared `^0.1.9` in `dependencies` | `eureka_vec_fallback` auto-degrade - **this is Pitfall 1** |
| `sqlite_vec` (PyPI) | a Python vec0 read | **NO** | - | none permitted (Discretion forbids new packages) |
| `@huggingface/transformers` | local encoder | declared `^4.2.0`; not import-probed this session | `^4.2.0` | `encoder_unavailable` graceful degrade |
| ONNX model weights | first real embed | unknown (`~/.mindrian/model-cache/`) | `MongoDB/mdbr-leaf-ir` q8 | one-time download with a stderr notice |
| `sentence-transformers` / `numpy` / `scikit-learn` | Python RS | not probed; `requirements-hsi.txt` declares them; `ensure_ml_deps` auto-installs | - | `ensure(["numpy","requests"])` self-install |
| `PINECONE_API_KEY` | current Mode B/C | assume UNSET | - | `_pinecone_path_available()` -> local MiniLM bypass |
| Remote Brain | optional expert projection | not probed | - | `projectExpertHandles` -> `[]` |
| `ctx7` CLI | Context7 fallback | **NO** | - | none - see Open Questions |
| `mcp__langtalks-graph-expert__*` | mandated consult | **NO** (skill dir exists at `~/.claude/skills/langtalks-graph-expert`; MCP tools absent from this agent's surface) | - | none - see Open Questions |

**Missing with no fallback:** none blocking. **Missing with fallback:** `sqlite-vec` (auto-degrade, but it is the source of Pitfall 1 - treat as a verification hazard, not a convenience).

---

## Validation Architecture

`.planning/config.json` sets `workflow.nyquist_validation: true`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Plain Node scripts. `node:assert` + `node:test` in `*.test.cjs`; bash harnesses for shape/grep gates. **No jest, no vitest, no mocha.** |
| Config file | none (no test runner config; `package.json` has no `test` script) |
| Quick run command | `node tests/<file>.test.cjs` or `node lib/memory/<file>.test.cjs` |
| Full suite command | `bash tests/run-all-296.sh` (**does not exist yet - Wave 0**) |
| Nearest precedent | `tests/run-all-272.sh` + the 14-file `tests/272-*` set - same subsystem, same shape |
| Acceptance roll-up | `node scripts/doctor.cjs --acceptance` |

### Phase Requirements -> Test Map

| Seed item | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| Acceptance 1 / Test 1 | All four `rs-*` in `data/connector-registry.json` | integration | `node scripts/build-connector-registry.cjs --check` | YES (green today) |
| Acceptance 2 / Test 2 | RS **internal** mode: zero Pinecone | unit | `node tests/296-no-pinecone-internal.test.cjs` (assert no `PINECONE`/`rs_cache` token reachable on the internal path, both backends) | NO - Wave 0 |
| Acceptance 2 (real gap) | RS **external/hybrid**: zero Pinecone; local signal cache serves the corpus | integration | `node tests/296-signal-corpus-local.test.cjs` | NO - Wave 0 |
| Acceptance 2 (safety) | Vector read works on **both** vector backends | unit | `node tests/296-vector-read-both-backends.test.cjs` (run once plain, once with `MINDRIAN_FORCE_NO_VEC0=1`) | NO - Wave 0. **Highest-value test in the phase (Pitfall 1).** |
| Acceptance 2 (invariant) | No 384-dim / 1024-dim cosine mixing anywhere | unit (source grep) | `bash tests/296-dim-invariant.sh` | NO - Wave 0 |
| Acceptance 3 / Test 3 | `rs-experts` never crashes on any Brain/Aura failure | unit | `node tests/296-rs-experts-degrade.test.cjs` | NO - Wave 0 (behavior already green; lock it) |
| Acceptance 3 (real gap) | The three causes produce three **distinguishable** outputs; "zero experts" is a success, not a refusal | unit | same file, cases (a)/(b)/(c) | NO - Wave 0 |
| Part 8 regression | `rs-experts` loads no `brainClient`; no `mcp__mindrian-brain__` in its frontmatter | unit (source grep) | extend `lib/memory/brain-server-resolution.test.cjs` (`t3_no_pinecone_brain_anywhere` idiom) | PARTIAL |
| Regression fence | Phase 272 contract unbroken | integration | `node tests/272-rs-engine-contract.test.cjs`; `bash tests/run-all-272.sh` | YES |
| Regression fence | `rs-explain` byte-locked markers intact | unit | `node lib/memory/test-rs-explain-command.cjs` | YES |
| Regression fence | HSI Tier 2 not broken by Pinecone removal | integration | `python3 scripts/compute-hsi.py --help` + a Tier-2 smoke | manual |

### Sampling Rate

- **Per task commit:** the single `node tests/296-<area>.test.cjs` for the area touched (< 5s).
- **Per wave merge:** `bash tests/run-all-296.sh` + `bash tests/run-all-272.sh` (adjacent-subsystem fence).
- **Phase gate:** `node scripts/doctor.cjs --acceptance` + all four born-wired/projection/render/shape gates green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/run-all-296.sh` - aggregator (model on `tests/run-all-272.sh`)
- [ ] `tests/296-vector-read-both-backends.test.cjs` - **the Pitfall-1 guard; write this first**
- [ ] `tests/296-rs-experts-degrade.test.cjs` - three distinguishable causes
- [ ] `tests/296-signal-corpus-local.test.cjs` - external/hybrid zero-Pinecone
- [ ] `tests/296-no-pinecone-internal.test.cjs` - internal-mode regression fence
- [ ] `tests/296-dim-invariant.sh` - 384/1024 non-mixing source grep
- [ ] Test-room fixture: a room.db with a populated vector store on **each** backend. `lib/memory/selector-miss.test.cjs`'s `fs.mkdtempSync` + `openRoomDb` idiom is the precedent.
- [ ] Framework install: **none needed.**

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json`; absent means enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | No user auth surface. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | **yes** | Canon Part 8 boundary is the access-control plane. `part8-egress-guard.classify()` on every Brain call; `auditQueryString` pre-egress + `auditQueryObject` post-receive on every external call. |
| V5 Input Validation | **yes** | `auditQueryString` on the `rs-experts` topic before binding (throws `ExternalEgressViolation`). Cypher params bound as `$topic`, never concatenated. `resolveDim`/`resolveBatchSize`/`resolveBackend` all positive-int / closed-set validate env input. |
| V6 Cryptography | no | Only `sha256` content hashing for cache keys - not a security control. Never hand-roll. |
| V7 Error Handling & Logging | **yes** | `pinecone-inference.cjs::scrubSecret` removes the live `PINECONE_API_KEY` from any forwarded `detail` and bounds it to 500 chars. Any new error path touching an API key must do the same (T-272-11). |
| V12 Files & Resources | **yes** | `sqlite-vec` extension loads **only** from `require('sqlite-vec').getLoadablePath()`, **never** an env-supplied path (T-211-03). Do not add an env override. |
| V13 API / Web Service | **yes** | `BRAIN_MAX_TOPK` / `BRAIN_CYPHER_MAX_ROWS` moat caps; bounded retry budget before an `unreachable` refusal. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Cypher injection via topic string | Tampering | Parameterized `$topic` + `auditQueryString` before bind. Already in place; preserve. |
| SQL injection into room.db | Tampering | `db.prepare(...).run(...)` bound params only, everywhere. Never string-build SQL. |
| Room content egressing to Brain/Pinecone (Part 8 breach) | Information Disclosure | Dual-layer audit + `part8-egress-guard.classify()`; person-byte token scan in `rs-expert-brain-projection.cjs`. **Retiring `rs_cache.py` strictly reduces this surface.** |
| Cross-room corpus bleed (SEED-029 F8) | Information Disclosure | Per-room local cache. The remote Pinecone namespace was the original bleed site; local storage removes the class. |
| API key leaking into an error envelope | Information Disclosure | `scrubSecret` + 500-char bound (T-272-11). |
| Arbitrary native-extension load via env path | Elevation of Privilege | `getLoadablePath()` only (T-211-03). **Do not "fix" Pitfall 1 by adding an extension-path env var.** |
| Untrusted external-doc content reaching the encoder | Tampering | `semantic_gate` / `SEMANTIC_FLOOR` topic gate + `rs_corpus_exclude` walker limits. Preserve when the cache moves local. |
| Silent-empty masking a real failure | Repudiation | The whole F-7 / `CONN-05` finding. A refusal must be distinguishable from a correct empty result. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `@huggingface/transformers` actually loads and the ONNX weights are fetchable in the target environment | Environment Availability | Not import-probed this session (heavy dep, network). If it fails, `embedTexts` returns `encoder_unavailable` and the local signal corpus silently falls back to identity matrices. **Probe in Wave 0.** |
| A2 | `PINECONE_API_KEY` is unset in the target environment, so Mode B/C already runs the local-MiniLM bypass | Environment Availability | If set, current behavior differs from what a dev sees, and the "before" baseline for the repoint is wrong. |
| A3 | The recommended replacement for `rs_cache.py` is "fetch on demand + embed locally + cache in room.db (or a local sidecar)" per SEED-029's 3-corpus split | F-4, Summary | SEED-029 states the direction; the **exact** storage shape for the SIGNAL corpus was never ratified. Needs a navigator decision before task-writing. |
| A4 | Phase 295 can be closed or narrowed rather than executed before 296 | F-10 | If the navigator insists 295 executes first, 296 stalls indefinitely on a phase whose core already shipped. |
| A5 | Retiring `rs_cache.py` does not break an unexamined consumer | F-4, Pitfall 4 | Only `rs-engine.py` and `rs_hybrid.py` import it (grep-confirmed), but a runtime-dynamic consumer would not show in a grep. |
| A6 | `rs-experts`' `--json` consumers tolerate a changed envelope shape | F-7 | The MCP wrapper and any Cowork consumer read the JSON. Adding `refusal_code` is additive; **omitting** `authors` on refusal branches (Theo's omit-never-null rule) is a **breaking** shape change. Grep consumers before adopting. |
| A7 | No live Neo4j Aura instance is expected for `rs-experts` in any current user environment | F-6 | The command has shipped Tier-0-only for months, so this is near-certain, but it is inferred from code, not from telemetry. |
| A8 | `sentence-transformers`, `scikit-learn`, `numpy` install cleanly via `ensure_ml_deps` on the target machine | Environment Availability | Not probed. `.planning/debug/windows-build-brain-python-qa.md` records `umap-learn`/`hdbscan` failing on aarch64 - a precedent for platform-specific Python install failure. |

---

## Open Questions

1. **Does the navigator accept the re-scope?**
   - Known: acceptance items 1 and 2-internal are already done; the real gaps are the `rs_cache.py` Pinecone signal corpus and the `rs-experts` cause-conflation.
   - Unclear: whether the navigator wants this phase to close those two, or to be re-cut entirely.
   - Recommendation: **surface F-1, F-3, F-6, F-10 before task-writing.** Three CONTEXT.md premises are factually wrong; a plan that executes them literally produces no-op tasks.

2. **CJS export step vs direct Python read (D-02 tiebreak).**
   - Known: direct read works on `eureka_vec_fallback`, fails on `eureka_vec`; `sqlite-vec` ships to all users; the PyPI `sqlite-vec` package is forbidden by the Discretion clause.
   - Unclear: whether the added process-spawn latency in the RS hot path is acceptable.
   - Recommendation: **CJS export step.** The Discretion clause already permits it. If latency proves unacceptable, cache the export per run rather than reverting to direct SQL.

3. **Where does the local SIGNAL corpus live?**
   - Known: SEED-029 says "cache in room.db"; `vector-store.cjs` established the derived-projection Part-9 exception for exactly this kind of table.
   - Unclear: a new room.db table vs a `<room>/research/<slug>/` sidecar (which is where `_corpus.jsonl` already lives).
   - Recommendation: **sidecar first** - it matches where the corpus provenance already lives, sidesteps the Part-9 question, and keeps room.db free of a potentially large external-doc table. **Run icm-architect on this before deciding** if room.db wins.

4. **Is Phase 228 a live duplicate of 296?**
   - Known: STATE.md records "Phase 228 = SEED-030 (RS pipeline vector-repoint + expert-graph reconciliation)" registered 2026-07-15. `.planning/ROADMAP.md` has no `### Phase 228` heading.
   - Unclear: whether 228 was retired or is orphaned.
   - Recommendation: confirm and retire one of the two before planning.

5. **Should `auto-explore-fire.cjs` move onto the dispatch chokepoint?**
   - Known: it spawns `python3 rs-engine.py --mode hybrid` directly; `rs-backend-dispatch.cjs` documents the wiring as an unfinished 272-10 wave with two tests RED by design.
   - Unclear: whether that belongs here or stays a Phase 272 leftover.
   - Recommendation: **at minimum include it in the blast radius.** Completing the 272-10 wiring is a scope-expansion call for the navigator.

6. **Grounding-source gap: langtalks and Context7 were unreachable from this agent.**
   - Known: `mcp__langtalks-graph-expert__*` tools are absent from this agent's tool surface (the skill directory exists at `~/.claude/skills/langtalks-graph-expert`), and `ctx7` is not installed. This is the documented upstream MCP-stripping limitation for agents with restricted tool sets.
   - What would have been asked: langtalks - "local vs remote vector store for room-scale RAG corpora" and "distinguishing empty results from failures in agent tool contracts"; Context7 - `node:sqlite` extension-loading semantics and `sqlite-vec` virtual-table portability.
   - Mitigation applied: the two claims those consults would have grounded were instead **settled by direct live execution** (F-2's both-directions test), which is a stronger form of evidence than either source. The architectural direction question (local vs remote) is already settled by SEED-029's own filed diligence and Phase 211's shipped decision.
   - Recommendation: if the planner needs the concept-level grounding for the CONTEXT/room-research trail, run those two consults from a session with full MCP access. **Do not treat this as blocking** - no load-bearing claim in this document rests on an unverified library behavior.

7. **Dev-research compositing is incomplete.**
   - Known: CLAUDE.md requires findings in BOTH the phase `.planning/` dir AND `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, mirrored to `mindrianOS/research/`, cross-linked.
   - Done: this file (the phase home).
   - Owed: the room entry. F-1/F-2/F-6/F-10 are durable architectural findings that outlive this phase and belong in the reasoning trail.
   - Recommendation: file `~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-rs-pipeline-vector-repoint-and-expert-degrade/` citing this file, before phase close.

---

## Sources

### Primary (HIGH confidence - direct source reads and live execution in this session)

- `lib/core/eureka/embedding-spine.cjs` (543 lines, full read) - encoder contract, model, dim resolution, Part 8 boundary
- `lib/core/eureka/vector-store.cjs` (414 lines, full read) - both vector tables, probe-based backend selection, `eureka_meta`, BLOB helpers
- `lib/core/eureka/tri-modal-index.cjs` (targeted) - `indexNodes` node scope, no-transaction-across-await rule
- `scripts/rs-engine.py` (2045 lines, targeted: 1-400, 975-1010, 1190-1520, `main`) - mode dispatch, embedding precedence, Pinecone gating, artifact discovery
- `lib/core/rs-engine.cjs` (597 lines, header + export map) - Phase 272 CJS port scope and dim invariant
- `lib/core/rs-backend-dispatch.cjs` (full) - `resolveBackend`, incomplete-wiring note
- `lib/core/pinecone-inference.cjs` (targeted) - **the D-10 descope-to-follow-up statement**
- `lib/core/rs_cache.py`, `rs_corpus.py`, `rs_corpus_exclude.py`, `rs_hybrid.py` (targeted) - the actual Pinecone surface
- `commands/rs-experts.md` (144 lines, full) - frontmatter tool removal, Tier-0-only status
- `scripts/rs-experts-command.cjs` (targeted) - no `brainClient`, the hand-rolled degrade block
- `scripts/rs-explain-command.cjs` (targeted) - the in-family independent-marker precedent
- `lib/core/refusal-messaging.cjs` (targeted) - `REFUSAL_KINDS`, `BRAIN_UNREACHABLE`, exact copy, signatures
- `lib/core/rs-expert-brain-projection.cjs` (targeted) - four `return []` degrade paths
- `lib/core/room-db.cjs` (targeted) - WAL, `timeout:5000`, `allowExtension`, `.mindrian/room.db`
- `scripts/auto-explore-fire.cjs` (targeted) - the live Python hybrid caller
- `data/connector-registry.json` (grep) - F-9 sanity check
- `package.json` - dependency classes
- **Live execution:** Node/Python versions; `sqlite-vec` presence probes; Node-writes-then-Python-reads Float32 round-trip; `no such module: vec0` negative
- `git log` on `embedding-spine.cjs`, `vector-store.cjs`, `rs-engine.cjs`, `rs-experts-command.cjs`

### Primary - Theo (HIGH confidence, per the standing consult rule)

- `/home/jsagi/Theo/.book-graph/resolver-config.yaml` - the 17-label / 25-type vocabulary (no people-graph label)
- `/home/jsagi/Theo/.planning/REQUIREMENTS.md:36-42, 1470-1485` - `CONN-05` text and its "refusal surfaces rather than dropping a node" application
- `/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts:35-75` - the empty-vs-broken paragraph, omit-never-null, distinct refusal codes
- `/home/jsagi/Theo/src/mcp/content/schema-mapping-fit.ts:80-110` - same convention + `chokepoint-audit` rule 14(b) (Theo cannot read the room graph)
- `/home/jsagi/Theo/src/mcp/content/search.ts:245-265` - "would tell Larry to rephrase while the instance is actually unreachable"
- `/home/jsagi/Theo/notes/graph-rulebook.md`, `notes/knowledge-graph.md` - label vocabulary, Rule 1
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md` - NOT READY verdict, parity-leg inversions, typed-codes-not-prose
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/parity/20260901/ledger.md:423` - `/mos:rs-experts` as a `MindrianCommand` under `Reverse Salient Analysis`

### Secondary (MEDIUM confidence - project docs cross-checked against code)

- `./CLAUDE.md` - workspace guard, canon core, stack table, conventions, grounding rules, handoff ledger
- `.planning/seeds/SEED-030-*.md`, `SEED-029-*.md` - primary sources per CONTEXT.md
- `.planning/phases/296-.../296-CONTEXT.md` - locked decisions
- `.planning/STATE.md:5100-5120` - the Phase 228 registration record
- `.planning/REQUIREMENTS.md:686-780` - PYPORT-01/02, the Phase 272 scope statement
- `.planning/ROADMAP.md:1054-1059` - Phase 295 stub
- `CHANGELOG.md` (Phases 89, 127.1, 186, 211, 272)
- `.planning/debug/python-requirements-orphan-deps-audit.md` - the silent-degrade dependency class (Pitfall 4)
- `.planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md` - the Pinecone narrative-drift record

### Tertiary (LOW confidence / not obtained)

- `mcp__langtalks-graph-expert__*` - **NOT CONSULTED**, tools absent from this agent's surface (Open Question 6)
- Context7 / `ctx7` - **NOT CONSULTED**, CLI absent. The API claims it would have grounded were settled by live execution instead.
- `icm-architect` skill - **NOT RUN**. Becomes required if a plan task adds a room.db table (Open Question 3).

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Vector table schema + Python readability (F-2) | **HIGH** | Read from source AND executed live in both directions. The strongest evidence in this document. |
| `embedding-spine` writes nothing (F-1) | **HIGH** | Full read of a 543-line module; no `db` param, no SQL. |
| Internal mode is already Pinecone-free (F-3) | **HIGH** | Read of the embedding precedence chain plus the `NotImplementedError` stub. |
| `rs_cache.py` is the real gap (F-4) | **HIGH** | Confirmed by code AND by `pinecone-inference.cjs`'s own explicit descope-to-follow-up statement. |
| Corpus id-space mismatch (F-5) | **HIGH** | Both sides read; `rs-engine.py`'s own docstring states the divergence and why. |
| `rs-experts` has no Brain-Cypher call (F-6) | **HIGH** | Frontmatter comment + script comment + absence of the require + git-dated commit. |
| Degrade-pattern reuse target (F-7) | **HIGH** | `refusal-messaging.cjs` read directly; `rs-explain` in-family precedent read directly. |
| Connector registry (F-9) | **HIGH** | Direct grep. |
| Phase 295 redundancy (F-10) | **MEDIUM-HIGH** | Code facts are HIGH; "295 can be closed" is a navigator judgment (A4). |
| Theo analog | **HIGH** | Declared vocabulary read from the config that generates it; `CONN-05` read from the requirement text and three independent handler comments. |
| Scope recommendation | **MEDIUM** | Follows from HIGH-confidence findings but contradicts two CONTEXT.md premises - needs ratification, not just acceptance. |
| Environment (encoder, Python ML deps) | **LOW-MEDIUM** | A1, A8 not probed - heavy/network. Wave 0 should probe. |

**Research date:** 2026-09-03
**Valid until:** 2026-10-03 for codebase facts (this subsystem changed in Phases 211, 272, 273, 274 within the last 60 days - re-verify F-2's backend probe if `sqlite-vec` or the eureka stack moves). **7 days** for the Phase 295 / Phase 228 roadmap state, which is actively being reorganized.

---

## RESEARCH COMPLETE

Enough is known to plan confidently, with one required precondition.

**Ready to plan:** the technical picture is fully resolved. Every module is read, both vector backends are characterized and live-tested, the exact reuse targets are named with file and line, the blast radius is enumerated, the test gaps are listed, and the Theo cutover analog is answered in both directions (no people-graph analog; a stronger degrade convention worth adopting).

**Required precondition before task-writing:** three of `296-CONTEXT.md`'s factual premises are wrong (F-1: `embedding-spine.cjs` writes nothing; F-3: internal mode already calls zero Pinecone; F-6: `rs-experts`' Brain-Cypher call was removed 2026-05-22). A plan that executes D-01 and D-03 as literally written would produce no-op tasks against a module that persists nothing and a coupling that does not exist. The planner must surface these to the navigator and get the premises amended. The **intent** behind both decisions survives intact and is plannable today:

- **D-01's intent** -> retire `lib/core/rs_cache.py`'s Pinecone signal corpus in favor of local fetch-and-embed, reusing `embedding-spine.cjs`'s encoder, reading room vectors through a **CJS export step** (not direct Python SQL - F-2).
- **D-03's intent** -> route `rs-experts`' degrade through `refusal-messaging.cjs`'s `'unreachable'` kind and split its three collapsed causes into three distinguishable outcomes, adopting Theo's `CONN-05` omit-never-null discipline so the eventual cutover is a no-op.

Both are pure wiring against shipped machinery, which is exactly what SEED-030's Part-7 framing promised.
