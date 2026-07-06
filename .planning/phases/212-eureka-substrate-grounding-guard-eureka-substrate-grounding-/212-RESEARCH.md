# Phase 212: Eureka Substrate + Grounding Guard (Critic) - Research

**Researched:** 2026-07-06
**Domain:** LLM-as-judge reliability for cross-domain insight verification; stateless feature-vector critic MCP boundary (Canon Part 8); local two-stage rubric judging; Plurai eval reuse; generator infra hardening (batched embedding + sqlite-vec load)
**Confidence:** HIGH on architecture, stack, and the two named pre-212 infra blockers (root-caused in code + fresh web research); MEDIUM on calibration acceptance (hand-labeled gold LABELS depend on pending Phase 211 human checkpoints); LOW on the ROADMAP-vs-CONTEXT scope discrepancy (needs navigator).

**Citation contract (per navigator addendum):** every finding below carries an inline source. Links: web = clickable URL; room = absolute path to the `rethinking-mindrianos` entry (with section); repo = path + line/section; code/disk inspection this session = `[disk]`. Unsourced claims are labelled `[my inference]`.

## Source-of-Record: which source answered each major question (ask-the-room-first audit trail)

| Major question | Resolved by | Source |
|----------------|-------------|--------|
| Has Phase 211 shipped? (CONTEXT says no) | **Code/disk inspection** | `[disk]` package.json, `lib/core/eureka/`, 5 SUMMARYs, `node_modules/` |
| Is the critic a features-only MCP judge or a two-stage local critic? | **Room research** | `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-eureka-critic-brain-mcp-plan/agent-04-llm-judge-reliability.md` §4; `.../2026-07-05-eureka-technical-diligence.md` §C1 |
| Is the abstracted-scalar payload privacy-safe? | **Room research** | `.../agent-05-stateless-critic-mcp-pattern.md` §2-3 |
| Where is the moat / why critic-MCP not generator-MCP? | **Room research** | `.../2026-07-05-rebuild-vs-surgery/02-moat-embedding-audit.md` §3a-3b |
| The D5 stale-roomDir bug | **Room research** | `.../2026-07-05-mcp-first-and-graph-indexer-addendum/2026-07-05-mcp-first-and-graph-indexer-addendum.md` §1 |
| Can the generator complete a real-room run today? (NO - two new bugs) | **Room research** + **code inspection** | `.../2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula/2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula.md` §2, confirmed in code `[disk]` |
| HOW to fix the unbatched-embedding OOM | **Code inspection** (seam exists) + **fresh web research** (room gave no HOW) | `[disk]` `embedding-spine.cjs:357`; [transformers.js #1164](https://github.com/huggingface/transformers.js/issues/1164), [Optimizing Transformers.js](https://www.sitepoint.com/optimizing-transformers-js-production/) |
| HOW to fix the offline `no such module: vec0` | **Code inspection** (root cause found) + **fresh web research** | `[disk]` `vector-store.cjs:160`; [sqlite-vec JS docs](https://alexgarcia.xyz/sqlite-vec/js.html), [Node SQLite docs](https://nodejs.org/api/sqlite.html) |
| Rubric > Likert, 2 votes max, calibration-confidence | **Room research** (cites 20+ papers) | `.../agent-04-llm-judge-reliability.md` §2 |
| Scope: is the whitespace/bridge substrate in 212? | **UNRESOLVED - needs navigator** | ROADMAP vs 212-CONTEXT contradiction `[my inference]` |

## Summary

Phase 212 builds the **Grounding Guard** - the critic deciding whether a high differential from the Phase 211 generator is a REAL transferable salient or confident noise - and exposes the *calibration verdict* (not the whole judge) as a Mindrian-own MCP tool. The generator it critiques is REAL and shipped: `lib/core/eureka/` (embedding-spine, tri-modal-index, vector-store, lexical-overlap, hybrid-retrieve), `scoreMeasured()` on `rs-differential-scorer.cjs`, `scripts/eureka-room-report.cjs`, and `tests/run-all-211.sh` (PASS=6) all exist on disk, with `@huggingface/transformers@4.2.0` + `sqlite-vec@0.1.9` installed and navigator-approved `[disk]` `211-01-SUMMARY.md §Task 1`. The 212-CONTEXT.md's opening claim that Phase 211 has "zero executed code" is **STALE and wrong** `[disk]`.

**But there is a live, load-bearing caveat the newest room entry establishes:** the generator cannot yet complete an end-to-end run at production scale. Two infra bugs surfaced running against the real 2117-node `jhtv-oliver-kuntz` room `[room]` `.../2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula.md §2`: (a) an unbatched embedding forward pass tried to allocate ~26.7GB (`input_ids [2128,512]`); (b) offline mode fails with `no such module: vec0`. The room recommends fixing both **before** Phase 212 proceeds. This research treats them as **named pre-212 prerequisite tasks** (Wave-0 or a pre-212 gap) and roots-causes each in code with fix guidance below.

The central architectural finding, from the mandated dev-research room: **a features-only LLM judge cannot verify novelty, and novelty judging is the single weakest-documented LLM-judge task** `[room]` `.../agent-04-llm-judge-reliability.md §1.4`; [arXiv 2606.12071](https://arxiv.org/abs/2606.12071). A naive "rate this 1-10" call fails exactly where Eureka already failed (tahini x blockchain 0.825) `[room]` SEED-050. The evidence-backed design CONTEXT D2 locks: (1) deterministic gates BEFORE any LLM, (2) a binary/ternary RUBRIC not Likert with the verdict computed BY CODE, (3) exactly 2 judge calls (neutral + adversarial), (4) confidence from measured gold-set buckets. The content-touching parts run **LOCALLY**; only the abstracted feature vector crosses the MCP boundary to a remote CALIBRATOR.

**Primary recommendation:** First, close the two pre-212 generator blockers (batched embedding wiring + the vec0 load root-cause). Then build the Grounding Guard as a local two-stage critic (`lib/core/eureka-critic.cjs`, pure function) - Stage A deterministic gates + Stage B two-pass rubric, verdict computed by code, confidence from the SEED-050 calibration curve - and expose ONLY the abstracted-feature ruling call as a thin MCP tool on the existing `lib/mcp/tool-router.cjs`, quantizing every float before egress and reusing `auditQueryString` at payload assembly. Do NOT put the rubric LLM call behind the MCP boundary.

<user_constraints>
## User Constraints (from 212-CONTEXT.md)

### Locked Decisions

**D1 - Critic input contract (Part 8 boundary).** The critic MCP tool receives ONLY: `differential_score` (float), `lsa_similarity` (float), `semantic_similarity` (float), `surprise_type` (enum: structural_transfer | semantic_implementation), `source_domain_tag` (generic enum, never an artifact ID or content string), `target_domain_tag` (same). NEVER room text, artifact IDs, or user-content strings. Reuse the `auditQueryString` precedent at the payload assembly site. `[repo]` 212-CONTEXT.md §D1

**D2 - Critic output contract + internal judge design (UPDATED 2026-07-05 per web-researched diligence).** Returns `verdict` (transferable | restatement | pseudoscience | general_shallow), `confidence` (calibration-derived), `reasoning_tag` (closed versioned enum in `data/eureka-critic-tags.json`). NOT a single "rate 1-10" call. Required: (1) two-stage - programmatic gates before any LLM (domain-swap invariance, nearest-neighbor novelty delta, entity-specificity, fabricated-quantity flag); (2) rubric not Likert, verdict computed BY CODE; (3) exactly 2 judge calls (neutral + adversarial), disagreement -> general_shallow/uncertain; (4) confidence calibration-derived, unseen pattern -> human review; (5) never expose the candidate's persuasive framing. `[repo]` 212-CONTEXT.md §D2

**D3 - Calibration data: the SEED-050 gold-set, not a new corpus.** Use the 6 cards at `evals/eureka/cases/` (`archimedes-uq/-sterling/-darkmatter`, `davinci-salient`, `nichefoods-null`, `lovelace-lean`). `archimedes-sterling` is `critic_available: lean_checkable` - the objective ground truth. `[repo]` 212-CONTEXT.md §D3; `[disk]` `evals/eureka/cases/`

**D3b - Payload hardening.** (1) Quantize every float to 2 decimals / 8-bit buckets before egress (non-negotiable); (2) no stable content identifiers, aggregate server-side; (3) return coarse confidence; (4) rate-limit per key + dedupe near-identical vectors. `[repo]` 212-CONTEXT.md §D3b

**D4 - Deployment: plugin-local MCP tool first, architected for the SEED-014 lift.** Build on the EXISTING `bin/mindrian-mcp-server.cjs` / `lib/mcp/tool-router.cjs`. Module-boundary the critic logic in `lib/core/eureka-critic.cjs` (pure function, no MCP-framework imports) so SEED-014 can lift it into the Brain repo without an interface rewrite. `[repo]` 212-CONTEXT.md §D4

**D5 - Mandatory per-call room/session resolution.** NEW MCP tool surface. Existing tools bind `roomDir` once at registration (stale-room reads). This tool must take ZERO implicit dependency on a registration-time `roomDir` closure (pure function of the payload per D1). Verify in plan-checker. `[repo]` 212-CONTEXT.md §D5

**D6 - Negative-test corpus.** "tahini x blockchain 0.825", "wind turbines as living weather algorithms 0.985", "Molecular Casino... $2-5B exit" MUST classify as pseudoscience/general_shallow. Explicit acceptance test. `[repo]` 212-CONTEXT.md §D6

**D7 - Gate criteria.** A `run-all-212` aggregator: (a) 6-card fixture suite vs expected verdicts, (b) D6 negative corpus rejected, (c) Canon Part 8 boundary scan reusing `test-connector-part8-boundary.cjs`, (d) D5 per-call-resolution check. `[repo]` 212-CONTEXT.md §D7

### Claude's Discretion
- Critic module file layout (follow `lib/core/eureka/` + `rs-differential-scorer.cjs`).
- Rubric item wording (5-8 items; expert-grounded from SEED-050, not model-invented).
- Neutral + adversarial passes = two calls to the same model, different framing (Claude-only, no provider diversity).
- `data/eureka-critic-tags.json` schema (follow `dispatch-framework-map.json` / `hitl-shape-declaration-schema.json`; `schema_version` from day one).

### Deferred Ideas (OUT OF SCOPE)
- Arrival grader, status-quo judge, question-type judge, COMPRESSION meter (SEED-050 step 5) - Phase 213.
- eureka-reach/SENS-13 wiring, Shape-F offer, LarryReacts - Phase 213 (BLOCKED pending curing-sequence debug track).
- find-analogies online leg - Phase 214.
- Portfolio-scale fusion - Phase 215.
- IntellAgent synthetic-dialog harness - deferred until the guard passes calibration.
</user_constraints>

<phase_requirements>
## Phase Requirements

ROADMAP declares Phase 212 requirements **TBD** (no REQ-IDs). `[repo]` `.planning/ROADMAP.md` §Phase 212. The CONTEXT D1-D7 are the de-facto requirement set. Support mapping:

| De-facto Req | Research Support | Source |
|--------------|------------------|--------|
| D1 abstracted input | scalars+enums (~20-60 bits) not invertible; `auditQueryString` reusable | `[room]` `.../agent-05-stateless-critic-mcp-pattern.md §2a`; `[repo]` `lib/core/rs-egress-prompts.cjs` |
| D2 two-stage rubric | rubrics +28% over Likert; 2 effective votes max; calibration-confidence | `[room]` `.../agent-04-llm-judge-reliability.md §2`; [arXiv 2507.17746](https://arxiv.org/abs/2507.17746), [arXiv 2605.29800](https://arxiv.org/html/2605.29800) |
| D3 gold-set | 6 cards on disk; README freezes label set + COMPRESSION formula | `[disk]` `evals/eureka/cases/`, `evals/eureka/README.md` |
| D3b hardening | each safeguard mapped to an attack class | `[room]` `.../agent-05-stateless-critic-mcp-pattern.md §2c-3` |
| D4 local-MCP-first | existing surface; SEED-014 lift | `[repo]` `bin/mindrian-mcp-server.cjs:88`, `lib/mcp/tool-router.cjs:343` |
| D5 per-call resolution | the exact stale-`roomDir` closure bug | `[room]` `.../2026-07-05-mcp-first-and-graph-indexer-addendum.md §1` |
| D6 negative corpus | confirmed-junk on record; darkmatter card carries restatement + pseudoscience distractors | `[room]` SEED-050; `[disk]` `evals/eureka/cases/archimedes-darkmatter.md` |
| D7 gate | run-all-211.sh structure precedent | `[disk]` `tests/run-all-211.sh` |

**Scope discrepancy for the planner:** the ROADMAP goal names "Graph-framed substrate + whitespace/bridge signal detection over room.db (SEED-049), PLUS the cheapest critic judge" `[repo]` `.planning/ROADMAP.md §Phase 212`, but the 212-CONTEXT boundary narrows 212 to the critic + MCP and says "does NOT build a second differential engine" `[repo]` 212-CONTEXT.md §domain. See Open Question Q1. `[my inference]` that CONTEXT (more recent, locked) governs, but the navigator must confirm.
</phase_requirements>

## Pre-212 Blockers: the Generator Cannot Complete a Real-Room Run (the "D16" gap)

> Source-of-record: the blockers themselves are **room research** `[room]` `.../2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula.md §2` (direct SQL inspection of the real 2117-node jhtv-oliver-kuntz room.db + live/offline runs of `scripts/eureka-room-report.cjs`). The room names the bugs but gives **no HOW**; the fixes below are **code inspection this session** + **fresh web research** (the room-first rule: room was insufficient, so I did fresh web research and say so per fix).

The D15 content-loss bug (`writeClaimNode` discarding claim text) is fixed and pushed `[room]` §1 (commits `3d1b27a4` write-side, `af24b697` read-side), verified against 2117 real JHU claim nodes carrying 1800-2300+ char descriptions. But running the generator end-to-end at that scale surfaced two NEW infra failures. The critic (212) consumes the generator's differentials, so **an engine that cannot produce differentials at real-room scale starves 212's real-world acceptance workload.** Treat both as pre-212 prerequisite tasks.

### Blocker 1: Unbatched embedding forward pass -> ~26.7GB OOM

**Symptom** `[room]` §2: live mode hands all 2117+ nodes to the model in one call; ONNX tried ~26.7GB in one `Expand` node, `input_ids` dims `[2128, 512]`.

**Current code state (this session, `[disk]`):** a batching seam **already exists** - `embedding-spine.cjs:350-363` defines `batchSlices(list, size)` and there is a `resolveBatchSize` referenced in the header. This was added after the room entry was written (the room entry pre-dates it). **The planner must VERIFY, not assume:** confirm (1) the real-model path in `embedTexts` (the `enc.encoder(list, ...)` call near line 366) actually loops over `batchSlices(list, resolveBatchSize())` rather than passing the whole `list`, and (2) the `tri-modal-index.cjs` call site does not itself hand the whole room in one call. If either is still whole-list, that is the fix.

**Fix guidance (fresh web research - room gave no HOW):**
- Break the corpus into fixed-size batches, process sequentially, accumulate vectors; do not load all at once. [Optimizing Transformers.js for Production](https://www.sitepoint.com/optimizing-transformers-js-production/); [Zilliz: chunked embedding for large datasets](https://zilliz.com/ai-faq/how-can-i-handle-very-large-datasets-for-embedding-or-training-that-dont-fit-entirely-into-memory-and-does-the-sentence-transformers-library-support-streaming-or-processing-data-in-chunks-to-address-this).
- Set batch size explicitly and tune per model; over-large batches inflate memory with no throughput gain. [Correctly set batch size in Sentence Transformers](https://medium.com/@vici0549/it-is-crucial-to-properly-set-the-batch-size-when-using-sentence-transformers-for-embedding-models-3d41a3f8b649). A batch of 16-64 is a safe start for a 384-dim MiniLM-class model on CPU `[my inference]` from that guidance.
- Enforce truncation so a long JHU description (1800-2300 chars ≈ 450-600 tokens) cannot balloon `input_ids`: pass `{ pooling: 'mean', normalize: true, truncation: true, max_length: 256 }` (all-MiniLM-L6-v2's effective ceiling is ~128-256 tokens; beyond that quality degrades anyway). [Building Semantic Search with Transformers.js](https://machinelearningmastery.com/building-semantic-search-with-transformers-js-and-sentence-embeddings/) - "all-MiniLM-L6-v2 does not provide good results for more than 128 tokens ... split into chunks." The `[2128, 512]` dims show current truncation at 512; combined with no batching, that is the 26.7GB. Batching alone fixes the OOM; lowering `max_length` to the model's real ceiling reduces it further.
- onnxruntime-node's memory footprint is a known Transformers.js production concern. [transformers.js #1164](https://github.com/huggingface/transformers.js/issues/1164).

### Blocker 2: Offline mode fails with `no such module: vec0`

**Symptom** `[room]` §2: offline (stub-encoder) mode fails outright with `no such module: vec0` - the sqlite-vec extension does not load in that code path in this environment. The room hypothesizes "an `allowExtension` or build-path issue specific to this environment."

**Root cause found in code (this session, `[disk]`):** `vector-store.cjs:160` short-circuits:
```javascript
if (tableExists(db, 'eureka_vec')) return 'sqlite-vec';   // <-- returns WITHOUT loading the extension
```
If a PRIOR (live) run created the `eureka_vec` virtual table (a `vec0` table), a later run detects it exists, returns backend `'sqlite-vec'`, and **never calls `db.loadExtension(...)` in the current process**. Any subsequent query against `eureka_vec` then throws `no such module: vec0`, because the vec0 module is not registered in this process. This is the SAME persisted-derived-table disease as the 211-05 stale-vector mode bleed (Pitfall 6), in a new form: the offline path assumes the backend from the table's mere existence instead of from a live capability probe. `[disk]` `vector-store.cjs:160-181`

**Compounding environmental cause (fresh web research):** the runtime here is **Node v22.22.2** `[disk]` `node --version`, and CLAUDE.md pins only `Node >=22.5.0` `[repo]` `CLAUDE.md:117`. The official sqlite-vec Node guidance requires **Node 23.5.0 or above** for the `node:sqlite` `DatabaseSync` extension path. [sqlite-vec JS docs, Alex Garcia](https://alexgarcia.xyz/sqlite-vec/js.html). `node:sqlite` is still experimental in Node 22.x and its `allowExtension` / `loadExtension` support is version-sensitive. [Node.js SQLite docs](https://nodejs.org/api/sqlite.html). "no such module: vec0" appears in other Windows/WSL sqlite-vec setups as a build/load path issue. [basic-memory #735](https://github.com/basicmachines-co/basic-memory/issues/735); [node:sqlite compiled with OMIT_LOAD_EXTENSION](https://github.com/openclaw/openclaw/issues/66977). The user is on WSL2 `[env]`, so a Windows/WSL binary-path mismatch is also in play.

**Fix guidance:**
- **Primary (code):** in `createVecTable`, do not infer the backend from `tableExists('eureka_vec')` alone; when a vec0 table is present, still ensure the extension is loaded this process (call `sqliteVec.load(db)` / `db.loadExtension(getLoadablePath())`) and probe `SELECT vec_version()` before returning `'sqlite-vec'`; on any failure fall through to the `cjs-fallback` BLOB+brute-force path (which already exists). This makes offline mode degrade instead of dying. `[disk]` `vector-store.cjs:160-181`
- **Canonical load call (web):** the officially documented `node:sqlite` load is `sqliteVec.load(db)` after constructing with `{ allowExtension: true }`; the `sqlite-vec` package exports both `getLoadablePath` and `load` `[disk]`. [sqlite-vec JS docs](https://alexgarcia.xyz/sqlite-vec/js.html). `room-db.cjs:106` already constructs the handle with `{ allowExtension: true }` (via `node:sqlite` `DatabaseSync`) `[disk]`, so the constructor half is correct.
- **Environmental (verify):** run a standalone `node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(':memory:',{allowExtension:true}); require('sqlite-vec').load(db); console.log(db.prepare('select vec_version()').get())"` on this exact runtime. If it fails on Node 22.22.2, the fix is to raise the runtime floor to Node >=23.5.0 (a CLAUDE.md stack bump) OR accept the cjs-fallback path on this platform. [sqlite-vec JS docs](https://alexgarcia.xyz/sqlite-vec/js.html).

**Impact on 212:** the critic's Stage A nearest-neighbor novelty-delta gate reads the user's graph via the same vector store. If vec0 cannot load, Stage A must run on the cjs-fallback cosine path - which is fine at room scale (brute force over low-thousands of vectors is single-digit ms `[room]` `.../2026-07-05-eureka-technical-diligence.md §D1`) but must be wired to degrade, not throw.

### The Opportunity Statement: the critic's first real acceptance workload

The same room entry formalized the **Opportunity Statement formula** (SEED-048 addendum, commit `360e4826`, GSD quick `260706-4cb`) `[room]` §3 and produced **two real draft Opportunity Statements** from real JHU technology pairs (arrhythmias C16796xC03552; cerebral-aneurysm C16742xC05004) `[room]` §4. Both are explicitly flagged **"not yet run through SEED-050's actual ranking / critic - treat as unverified Eurekas, not yet bankable"** `[room]` §4 + Cross-references. **These two drafts are the Grounding Guard's first real-world acceptance input** once 212 exists: the critic must classify each as `transferable` (or route to `restatement`/`general_shallow`/`pseudoscience`) with a calibrated confidence, replacing the manual "not yet critic-verified" stopgap. The planner should add both as named acceptance fixtures alongside the 6 SEED-050 cards (they are real, pending, and exactly the workload the phase exists to serve). `[my inference]` from `[room]` §4.

## Critical Correction: Phase 211 HAS Shipped (verified 2026-07-06)

The 212-CONTEXT.md "Correction on entry" claims Phase 211 has "zero executed code." **Every clause is false** `[disk]`:

| Claim in CONTEXT | Reality `[disk]` |
|------------------|------------------|
| No `sqlite-vec` / `@huggingface/transformers` in package.json | Both present (`^0.1.9`, `^4.2.0`) |
| No `lib/`/`scripts/` eureka files | `lib/core/eureka/{embedding-spine,tri-modal-index,vector-store,lexical-overlap,hybrid-retrieve}.cjs` + `scripts/eureka-room-report.cjs` exist |
| No `211-*-SUMMARY.md` | All 5 present |
| No working differential engine | `scoreMeasured()` shipped; `run-all-211.sh` PASS=6 `[disk]` `211-05-SUMMARY.md §Verification` |
| deps not installed | `node_modules/@huggingface/transformers` + `node_modules/sqlite-vec` present |

**Consequence:** the Path A/B fork in CONTEXT is moot. Plan against the REAL generator. The critic consumes the per-pair record `scoreMeasured` emits (`semantic`, `lexical`, `signed_diff`, `abs_diff`, `direction`, `passes`, `band`, `provenance`) `[disk]` `211-03-SUMMARY.md §Notes for Downstream Plans`. Keep the SEED-050 gold cards as calibration/acceptance (D3/D6). The two are complementary, not a fork.

**Embedder in flux:** the JHU live attempt used `MongoDB/mdbr-leaf-ir` + `EUREKA_RRF_K=25` (the technical-diligence D3/D5 recommendations, applied via env), while `embedding-spine.cjs` still defaults to `Xenova/all-MiniLM-L6-v2` `[disk]` `evals/eureka/211-room-report-jhtv-oliver-kuntz.md §Provenance` + `211-01-SUMMARY.md §Notes`. The diligence recommends swapping the default to `mdbr-leaf-ir` (8-10 NDCG points, spike ONNX-load first) or `bge-small-en-v1.5`, and making `embedding_dim` per-room `[room]` `.../2026-07-05-eureka-technical-diligence.md §D3`. This matters for the critic: differential magnitudes - and thus Stage A thresholds - are embedder-dependent (Pitfall 8).

## Architectural Responsibility Map

The reliability literature ("the judge must examine content" `[room]` `.../agent-04-llm-judge-reliability.md §3`) and Canon Part 8 ("content never egresses" `[repo]` `CLAUDE.md` Part 8) pull opposite ways; the two-stage split reconciles them.

| Capability | Primary Tier | Rationale | Source |
|------------|-------------|-----------|--------|
| Stage A deterministic gates (domain-swap re-embed, novelty delta, entity-specificity, fabricated-quantity flag) | **Local** | Needs raw text + local embedder + user graph; Part 8 forbids egress; no LLM = immune to sycophancy | `[room]` agent-04 §3.1, §4 item 1 |
| Stage B rubric LLM judgment (2 passes) | **Local (Claude Code session)** | The judge must examine content; the session has model access + raw passages | `[room]` `.../2026-07-05-eureka-technical-diligence.md §C1` |
| Verdict from rubric item pattern | **Local (pure code)** | Deterministic mapping in `eureka-critic.cjs` | `[room]` agent-04 §4 item 3 |
| Confidence calibration + cross-user ruling | **Remote MCP (Brain)** | Calibrated from pooled labels = "Grading Intelligence" moat class; only abstracted features cross | `[room]` `02-moat-embedding-audit.md §3b` |
| MCP tool wrapper | **Remote MCP surface** | Thin adapter; carries only D1 scalars+enums | `[repo]` 212-CONTEXT §D4 |
| Gold cards + negative corpus | **Lab-side** | Never ships to user; synthetic/pseudonymous | `[disk]` `evals/eureka/` |

**Load-bearing rule for the planner:** the rubric LLM call is LOCAL; do NOT place it behind the MCP boundary. What crosses is the *output* of local judgment (abstracted feature vector + rubric boolean pattern) for calibration - never the text, never an embedding (a Vec2Text-invertible embedding is ~equivalent to the text; 2 quantized scalars + 6 booleans carry 20-60 bits and cannot be inverted) `[room]` `.../agent-05-stateless-critic-mcp-pattern.md §2a`; [Vec2Text, arXiv 2310.06816](https://www.emergentmind.com/papers/2310.06816).

## Standard Stack

Phase 212 adds **no new heavy runtime dependencies** - overwhelmingly Part 7 reuse of the shipped generator, the Plurai eval harness, and the Part 8 audit spine. Correct posture per the moat audit (the substrate is built; 212 adds a lens + a ruling boundary) `[room]` `02-moat-embedding-audit.md §3c`.

### Core (already installed / shipped)
| Library / Module | Version | Purpose | Source |
|------------------|---------|---------|--------|
| `@huggingface/transformers` | 4.2.0 | Local embedder for Stage A re-embed + novelty delta (reuse `embedding-spine.cjs`) | `[disk]` node_modules |
| `sqlite-vec` | 0.1.9 | Nearest-neighbor kNN vs the user's graph (reuse `vector-store.cjs`) | `[disk]` node_modules |
| `zod` | ^3.25.76 | MCP tool schema validation | `[repo]` CLAUDE.md stack |
| `@modelcontextprotocol/sdk` | ^1.29.0 | The MCP tool surface | `[repo]` CLAUDE.md stack |
| `gray-matter` | installed | Parse the 6 gold cards' frontmatter | `[disk]` `211-04-SUMMARY.md` |

### Supporting (reuse, do not rebuild)
| Module | Purpose | Source |
|--------|---------|--------|
| `lib/core/rs-egress-prompts.cjs` (`auditQueryString`, `auditQueryObject`) | Part 8 dual-layer egress audit at the payload site (D1) | `[disk]` `rs-differential-scorer.cjs:487-488` precedent |
| `lib/core/rs-egress-violations.cjs` (`ExternalEgressViolation`) | Throw type on forbidden pattern | `[disk]` |
| `lab/eval/report-from-transcript.cjs` (`callJudge`, `endpointUrl`, `JUDGES`, `parseJudgeResponse`) | Plurai REST client for a deployed classifier leg (optional; currently 404s) | `[disk]` `lab/eval/report-from-transcript.cjs:60-570` |
| `lab/plurai-suite/{judges,golden-loader,suite-manifest}.cjs` | Plurai judge specs + `upload_data` staging | `[disk]` `lab/plurai-suite/judges.cjs` |
| `lib/core/eureka/embedding-spine.cjs` (`embedTexts`, `cosineSimilarity`, `batchSlices`) | The ONE local embedder | `[disk]` |
| `lib/core/eureka/vector-store.cjs` (`ensureStore`) | kNN backend (sqlite-vec or cjs-fallback) | `[disk]` `vector-store.cjs:48` |
| `rs-differential-scorer.cjs` (`scoreMeasured`) | The per-pair record the critic consumes | `[disk]` `211-03-SUMMARY.md` |
| `tests/test-connector-part8-boundary.cjs` | The grep-based 4-threat-path boundary-scan idiom (D7c) | `[disk]` `tests/test-connector-part8-boundary.cjs:76-238` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Source |
|------------|-----------|----------|--------|
| Local two-stage rubric critic | Single Plurai "cross-topic-connection" classifier (SEED-050 step 4's literal "cheapest judge first") | Rejected as CORE: a features-only classifier cannot verify novelty; also 404s today. Keep as one optional signal. | `[room]` `.../2026-07-05-eureka-technical-diligence.md §C1`; `[disk]` `evals/plurai/211-baseline.json` |
| 2 judge calls | 9-judge panel | 9 judges gave 2.18 effective votes; unanimity still 9.1% error | `[room]` agent-04 §2.2; [arXiv 2605.29800](https://arxiv.org/html/2605.29800) |
| Rubric + code-verdict | Likert "rate 1-10" | Rubrics +28% over Likert; Likert confidence uncalibrated | `[room]` agent-04 §2.1; [arXiv 2507.17746](https://arxiv.org/abs/2507.17746) |
| Calibration-derived confidence | Model self-reported confidence | Self-report uncalibrated on this task ("$2-5B exit" straight-faced) | `[room]` agent-04 §2.3 |

**Installation:** none required. Verify:
```bash
node -e "require('@huggingface/transformers'); require('sqlite-vec'); require('gray-matter'); console.log('ok')"
npm view @huggingface/transformers version    # confirm 4.x
npm view sqlite-vec version                    # confirm >=0.1.9
```

## Package Legitimacy Audit

> Phase 212 installs **no new external packages** - Part 7 reuse. The two eureka packages were installed + navigator-approved by name in Phase 211 `[disk]` `211-01-SUMMARY.md §Task 1`.

| Package | Registry | Source Repo | slopcheck | Disposition |
|---------|----------|-------------|-----------|-------------|
| `@huggingface/transformers` | npm | github.com/huggingface/transformers.js | not-run (reuse) | Approved 211-01 (navigator by name; maintainers `xenova`+HF core) |
| `sqlite-vec` | npm | github.com/asg017/sqlite-vec | not-run (reuse) | Approved 211-01 (navigator by name; maintainer `alex.garcia`) |
| `zod`, `@modelcontextprotocol/sdk`, `gray-matter` | npm | official | not-run (reuse) | Already in stack |

**Removed [SLOP]:** none. **Flagged [SUS]:** none. slopcheck not run - zero new packages. Standing watch (inherited from 211, not new): `sqlite-vec` single-maintainer, 2025 maintenance scare, contingency fork `vlasky/sqlite-vec` `[room]` `.../2026-07-05-eureka-technical-diligence.md §D1`.

## Architecture Patterns

### System Architecture Diagram

```
       ┌──────────────── LOCAL (user machine, Part 8: zero content egress) ────────────────┐
       │  room.db ──▶ 211 generator ──▶ scoreMeasured() per cross-boundary pair             │
       │  (2117 nodes)  (batched embed →  { semantic, lexical, signed_diff, direction, ... } │
       │                 vec0/cjs kNN)              │                                        │
       │                                            ▼                                        │
       │            ┌─────────────── eureka-critic.cjs (pure fn) ───────────────┐            │
       │            │ STAGE A (deterministic, NO LLM)                           │            │
       │            │   swap-invariance re-embed · novelty-delta kNN ·          │            │
       │            │   entity-specificity · fabricated-quantity flag           │            │
       │            │        fail ──▶ pseudoscience|general_shallow (skip LLM)  │            │
       │            │        pass                                               │            │
       │            │ STAGE B (Claude, LOCAL, 2 calls)                          │            │
       │            │   neutral rubric pass · adversarial pass                  │            │
       │            │        disagree ──▶ general_shallow/uncertain             │            │
       │            │   verdict = f(rubric item pattern)  ← BY CODE             │            │
       │            └───────────────────────────┬───────────────────────────────┘            │
       │        assemble ABSTRACTED vector (D1) │ auditQueryString + quantize floats (D3b)   │
       └────────────────────────────────────────┼────────────────────────────────────────────┘
                        ═══════ MCP boundary (only 20-60 bits cross) ═══════
                                                 ▼
       ┌──────── REMOTE (Mindrian Brain MCP, stateless ruling) ────────┐
       │  rubric-pattern → accuracy bucket · coarse confidence ·       │
       │  rate-limit per key · aggregate buckets, no per-query row     │
       └───────────────────────────┬───────────────────────────────────┘
                                    ▼   { verdict, confidence(coarse), reasoning_tag(enum) }
```
Sources: two-stage design `[room]` agent-04 §4; payload safety `[room]` agent-05 §3; moat split `[room]` 02-moat-embedding-audit §3b.

### Recommended Project Structure
```
lib/core/
├── eureka-critic.cjs          # NEW: pure Stage A + Stage B + verdict-by-code; NO mcp imports (D4)
├── eureka/embedding-spine.cjs  # reuse (verify batched loop wired - Blocker 1)
├── eureka/vector-store.cjs     # reuse (fix vec0 early-return - Blocker 2)
lib/mcp/tool-router.cjs         # EXTEND: thin critic tool, per-call resolution (D5)
data/eureka-critic-tags.json    # NEW: closed versioned reasoning_tag enum (schema_version)
evals/eureka/
├── cases/*.md                  # existing 6 gold cards
├── 212-critic-baseline.json    # NEW: calibration buckets (may ship baseline_deferred)
├── opportunity-drafts/         # NEW: the 2 JHU Opportunity Statements as acceptance fixtures
tests/
├── test-212-critic-stage-a.cjs      # NEW (offline)
├── test-212-critic-rubric.cjs       # NEW (offline, stubbed judge)
├── test-212-part8-boundary.cjs      # NEW (reuse the connector-part8 idiom)
├── test-212-negative-corpus.cjs     # NEW (D6)
└── run-all-212.sh                   # NEW (model on run-all-211.sh)
```

### Pattern 1: Two-stage critic - programmatic gates before any LLM
Deterministic checks first; only survivors reach the rubric. Perturbation/invariance testing is the one method family immune to judge sycophancy (no judge in the loop). `[room]` agent-04 §3.1; [SCAR arXiv 2305.12660](https://arxiv.org/pdf/2305.12660v1).
```javascript
// Stage A fabricated-quantity flag reuses the SAME regex scoreMeasured's Part 8 guard uses
// (211-05 found real-room nodes carrying K/M/B figures trip /\b\d+(?:\.\d+)?[KMB]\b/)  [disk] 211-05-SUMMARY §Auto-fixed 1
function stageA(candidate, localEmbedder, userGraphIndex) {
  if (/\b\d+(?:\.\d+)?[KMB]\b/.test(candidate.text))
    return { pass:false, route:'pseudoscience', tag:'unsourced_quantity' };   // kills "$2-5B exit" class
  const shift = embeddingShift(localEmbedder, nounSwap(candidate.mechanismText, K));
  if (shift < SWAP_INVARIANCE_FLOOR)
    return { pass:false, route:'general_shallow', tag:'domain_swap_invariant' };
  // ... entity-specificity, nearestNeighborDelta(userGraphIndex, candidate) -> restatement route
  return { pass:true, features:{ shift, /* ... */ } };
}
```

### Pattern 2: Rubric, verdict computed by code
LLM answers 5-8 binary items with one sentence of evidence each; code maps the pattern to the enum. Forcing structural abduction ("name the shared schema with no domain nouns; map each element one-to-one; any orphans?") is the SCAR-derived check separating real transfer from mood-board resemblance. `[room]` agent-04 §3.2; [arXiv 2507.17746](https://arxiv.org/abs/2507.17746).
```javascript
function verdictFromRubric(items) {           // the LLM NEVER picks the class
  if (!items.f || !items.c) return 'pseudoscience';
  if (!items.e) return 'restatement';         // #1 job: same idea, vocab swapped
  if (!items.d) return 'general_shallow';
  if (items.a && items.b && items.c) return 'transferable';
  return 'general_shallow';                    // bias to reject on ambiguity
}
```

### Pattern 3: Thin MCP wrapper, portable pure logic (D4)
`eureka-critic.cjs` is a pure function, zero MCP-framework imports; the tool-router wrapper validates the zod schema, calls it, returns. SEED-014 lifts it into the Brain repo as a move, not a rewrite. Mirrors `scoreMeasured` staying framework-free. `[repo]` 212-CONTEXT §D4; `[disk]` `rs-differential-scorer.cjs`.

### Pattern 4: Per-call resolution, no closure capture (D5)
The critic tool must not read a registration-time `roomDir` closure; it is a pure function of its payload. The documented bug: `registerRouterTools(server, roomDir, ...)` binds `roomDir` ONCE, so `room_graph graph-stats` returned a stale room mid-session. `[room]` `.../2026-07-05-mcp-first-and-graph-indexer-addendum.md §1`; `[disk]` `tool-router.cjs:343`.

### Anti-Patterns to Avoid
- Single "rate 1-10 with reasoning" call - profundity bias + Likert unreliability + uncalibrated confidence at once. `[room]` agent-04 §"What NOT to do".
- Large same-family ensemble - 2.2 effective votes. [arXiv 2605.29800](https://arxiv.org/html/2605.29800).
- Trusting unanimity - 9.1% error. `[room]` agent-04 §2.2.
- Letting the judge see raw candidate prose / the differential's excitement - reopens sycophancy. [arXiv 2310.13548](https://arxiv.org/abs/2310.13548).
- Rubric LLM behind the MCP boundary - it needs content; egress breaches Part 8. `[room]` `.../2026-07-05-eureka-technical-diligence.md §C1`.
- Raw float32 similarity on the wire - a near-unique document-pair fingerprint; quantize. `[room]` agent-05 §2c.
- Model self-reported confidence. `[room]` agent-04 §2.3.

## Don't Hand-Roll

| Problem | Use Instead | Source |
|---------|-------------|--------|
| Part 8 egress audit on the payload | `rs-egress-prompts.cjs::auditQueryString`/`auditQueryObject` (D1 says reuse) | `[disk]` `rs-differential-scorer.cjs:487` |
| Local embedding for Stage A | `lib/core/eureka/embedding-spine.cjs` (one embedding space is the precondition for calibration) | `[room]` `02-moat-embedding-audit.md §3c` |
| Nearest-neighbor vs the user's graph | `lib/core/eureka/vector-store.cjs` | `[disk]` |
| Plurai REST call | `lab/eval/report-from-transcript.cjs::callJudge` | `[disk]` |
| Part 8 boundary scan (D7c) | `test-connector-part8-boundary.cjs`'s grep 4-threat idiom | `[disk]` |
| Novelty judgment | The rubric + gold-set calibration (do not invent a heuristic) | `[room]` agent-04 §1.4 |
| The gate aggregator | `run-all-211.sh` structure (`set -uo pipefail`, `run_if`, PASS/FAIL/SKIP) | `[disk]` `tests/run-all-211.sh` |
| Closed reasoning-tag enum | `data/eureka-critic-tags.json` following `dispatch-framework-map.json` | `[disk]` `data/dispatch-framework-map.json` |
| Batched embedding | the `batchSlices` seam already in `embedding-spine.cjs:357` (verify wiring) | `[disk]` |

**Key insight:** 212 is a *lens + a boundary*, not an engine. "Building the tenth lens deepens nothing; building the one substrate the lenses sit on deepens everything" `[room]` `02-moat-embedding-audit.md §3c`. Any net-new heavy machinery is a smell.

## Runtime State Inventory

> Greenfield-additive (new critic module + MCP tool + tags file), but it inherits live-state hazards from the shipped generator.

| Category | Items Found | Action | Source |
|----------|-------------|--------|--------|
| Stored data | Generator persists derived `eureka_*`/`eureka_vec*` tables in `room.db` across runs; a persisted `eureka_vec` table causes the offline `vec0` failure (Blocker 2) | Code edit: probe capability, don't infer backend from table existence; gate reads on freshly-computed vectors (the `idx.embedded===true` lesson) | `[disk]` `vector-store.cjs:160`; `211-05-SUMMARY.md §Auto-fixed 2` |
| Live service config | Deployed Plurai `cross-topic-connection` is NOT live (HTTP 404); Larry-family judge threads parked at the Optimize gate | Manual/API: create + Optimize + deploy the Grounding Guard evaluator if the deployed leg is in scope; else `baseline_deferred`+SKIP | `[disk]` `evals/plurai/211-baseline.json`, `lab/plurai-suite/judges.cjs` |
| OS-registered state | None - stateless pure function + thin MCP tool | None (verified) | `[disk]` |
| Secrets/env vars | `PLURAI_API_KEY`/`PLURAI_RUN_BASE` (deployed leg); `MINDRIAN_EMBED_MODEL`/`EUREKA_RRF_K`/`EUREKA_DIFF_FLOOR` shape the generator | New Stage A thresholds (`SWAP_INVARIANCE_FLOOR`) should be env-tunable per the `RS_SEMANTIC_FLOOR` precedent | `[disk]` `report-from-transcript.cjs:60,493`; `211-03-SUMMARY.md §Notes` |
| Build artifacts / data deps | Pending 211 human checkpoints: 211-04 Task 3 hand-scored baseline + 211-05 Task 3 real-room spot-check; 6 cards ship `validated: candidate` | Data dependency: the >=0.85 calibration needs those labels (Open Q2) | `[disk]` `211-04-SUMMARY.md §Next Phase Readiness`, `211-05-SUMMARY.md §Task 3` |
| Runtime version | Node **v22.22.2**; sqlite-vec node:sqlite path wants **>=23.5.0** | Verify vec_version() standalone; raise the floor or accept cjs-fallback (Blocker 2) | `[disk]` `node --version`; [sqlite-vec JS docs](https://alexgarcia.xyz/sqlite-vec/js.html) |

## Common Pitfalls

### Pitfall 1: The novelty mirage
LLM judges rate model-generated pairings as highly novel; experts disagree - how "tahini x blockchain 0.825" gets blessed. Both generator and unaided judge run on the same surface-similarity substrate. Avoid: Stage A gates + forced structural abduction; bias to precision, default `general_shallow`. `[room]` agent-04 §1.4, §3.2; [arXiv 2606.12071](https://arxiv.org/abs/2606.12071), [SCAR arXiv 2305.12660](https://arxiv.org/pdf/2305.12660v1).

### Pitfall 2: Restatement is the #1 job and invisible without a graph baseline
A live MiniLM run's HIGHEST differential (0.49) was a straight paraphrase - `differential = semantic - lexical` spikes on any synonym swap; high differential is NECESSARY not SUFFICIENT. Avoid: nearest-neighbor novelty-delta gate (rubric item e "adds over the nearest edge"). `[room]` SEED-050 §"two failure modes"; agent-04 §3.3; `[disk]` `evals/eureka/211-room-report.md §Caveat`.

### Pitfall 3: A features-only Plurai judge cannot verify novelty
Given only `(similarity=0.73, transfer_type=structural)` an LLM has no signal a logistic regression lacks; it pattern-matches. Avoid: local content-grounded rubric + remote statistical calibrator; Plurai as one optional signal. `[room]` `.../2026-07-05-eureka-technical-diligence.md §C1`.

### Pitfall 4: Float precision as an accidental content fingerprint
A full-precision cosine between two specific embeddings is ~unique to that document pair; shipped raw the server can linkage-match across sessions/users. Avoid: D3b quantize to 2 decimals / 8-bit before egress. `[room]` agent-05 §2c; [de Montjoye, Unique in the Crowd](https://www.nature.com/articles/srep01376).

### Pitfall 5: The MCP tool captures a stale roomDir closure (D5)
Binding `roomDir` at registration returns a stale room mid-session. Avoid: pure function of the payload; assert structurally in D7(d). `[room]` `.../2026-07-05-mcp-first-and-graph-indexer-addendum.md §1`.

### Pitfall 6: Stale-vector mode bleed / infer-backend-from-table-existence
211-05 hit persisted stub vectors read as LIVE; Blocker 2 is the same disease (backend inferred from `tableExists('eureka_vec')` without loading vec0). Avoid: capability probe (`vec_version()`) + gate on freshly-computed vectors. `[disk]` `211-05-SUMMARY.md §Auto-fixed 2`, `vector-store.cjs:160`.

### Pitfall 7: Criteria drift - the rubric will change after seeing outputs
You cannot fully fix criteria before seeing outputs (EvalGen). Version the rubric + tags enum; recalibrate on every change; score only on human-agreed gold cases, treat contested ones as "uncertain." `[room]` agent-04 §2.3; [EvalGen, UIST 2024](https://dl.acm.org/doi/10.1145/3654777.3676450); [arXiv 2503.05965](https://arxiv.org/pdf/2503.05965).

### Pitfall 8: Thresholds are embedder-dependent and the embedder is in flux
Stage A thresholds depend on which embedder the generator ships (MiniLM in code, mdbr-leaf-ir in the JHU run). Calibrate against the SHIPPED embedder; keep thresholds env-tunable; confirm the embedder with the navigator before locking. `[room]` `.../2026-07-05-eureka-technical-diligence.md §D3`; `[disk]` `evals/eureka/211-room-report-jhtv-oliver-kuntz.md §Provenance`.

### Pitfall 9: Assuming the generator can produce differentials at real-room scale
It cannot today (Blocker 1 OOM, Blocker 2 vec0). Close both before wiring 212 to real generator output, or the critic has no real workload to grade. `[room]` `.../2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula.md §2`.

## Code Examples

### Reusing the Part 8 audit at the payload assembly site (D1)
```javascript
// Source [disk]: lib/core/rs-differential-scorer.cjs:487-488 (the scoreMeasured precedent)
const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');
function assembleCriticPayload(features) {
  const payload = {
    differential_score: quantize(features.signed_diff),        // D3b(1): quantize first
    semantic_similarity: quantize(features.semantic),
    lsa_similarity: quantize(features.lexical),
    surprise_type: features.direction,                          // enum
    source_domain_tag: genericDomainTag(features.sourceDomain), // generic enum, never an artifact id
    target_domain_tag: genericDomainTag(features.targetDomain),
  };
  auditQueryObject(payload, 'eureka-critic-mcp');               // throws on a smuggled string
  return payload;
}
```

### Canonical sqlite-vec load for node:sqlite (Blocker 2 fix)
```javascript
// Source (web): https://alexgarcia.xyz/sqlite-vec/js.html  (requires Node >=23.5.0)
const { DatabaseSync } = require('node:sqlite');
const sqliteVec = require('sqlite-vec');
const db = new DatabaseSync(dbPath, { allowExtension: true }); // room-db.cjs:106 already does this
sqliteVec.load(db);                                            // preferred over db.loadExtension(getLoadablePath())
db.prepare('SELECT vec_version()').get();                      // capability probe BEFORE trusting the backend
```

### Plurai deployed-classifier call (optional leg, currently 404s)
```javascript
// Source [disk]: lab/eval/report-from-transcript.cjs (callJudge, JUDGES). Synthetic gold-card text ONLY.
const { callJudge, JUDGES } = require('../../lab/eval/report-from-transcript.cjs');
const res = await callJudge(JUDGES.crossTopic.slug, apiKey, syntheticConnectionStatement, opts);
// missing key OR endpoint error -> baseline_deferred + SKIP, never red-fail CI (the 211-05 pattern)
```

## State of the Art

| Old | Current | Source |
|-----|---------|--------|
| Single "rate 1-10" judge | Two-stage: gates + rubric + 2 calls + gold-set calibration | `[room]` agent-04 §4 |
| Likert | Binary/ternary rubric, verdict by code | [arXiv 2507.17746](https://arxiv.org/abs/2507.17746) |
| Large panels | 2-3 diverse calls | [arXiv 2605.29800](https://arxiv.org/html/2605.29800) |
| Self-reported confidence | Calibration-curve confidence | [EvalGen](https://dl.acm.org/doi/10.1145/3654777.3676450), [arXiv 2503.05965](https://arxiv.org/pdf/2503.05965) |
| FlashRank (211 D4, Python-only) | ONNX cross-encoder via transformers.js (upstream 211/214 note, not 212) | `[room]` `.../2026-07-05-eureka-technical-diligence.md §D4` |
| `all-MiniLM-L6-v2` default | `mdbr-leaf-ir` (spike) / `bge-small-en-v1.5`; per-room `embedding_dim` | `[room]` §D3 |
| RRF k=60 | k=25 room-scale, no auto-tune (JHU run used k=25) | `[room]` §D5; `[disk]` JHU report |
| Unbatched embedding | Fixed-size batches, truncation to model ceiling | [transformers.js #1164](https://github.com/huggingface/transformers.js/issues/1164), [MLM semantic search](https://machinelearningmastery.com/building-semantic-search-with-transformers-js-and-sentence-embeddings/) |

**Deprecated/outdated:**
- The CONTEXT "Path A vs Path B" fork + "211 has zero executed code" - factually wrong `[disk]`.
- SEED-050's "start_evaluator for the Grounding Guard FIRST (cheapest)" as the guard's CORE - superseded by CONTEXT D2's two-stage design; Plurai remains optional. `[room]` `.../2026-07-05-eureka-technical-diligence.md §C1`.

## Validation Architecture

> nyquist_validation is `true` `[disk]` `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in (`node tests/test-*.cjs`, plain assert) + bash aggregators; no jest/vitest (house convention `[disk]`) |
| Config file | none - standalone CJS files exiting 0/non-0 (`run-all-2xx.sh` pattern) |
| Quick run | `node tests/test-212-critic-stage-a.cjs` (offline, network-free) |
| Full suite | `bash tests/run-all-212.sh` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command | Exists? |
|-----|----------|------|---------|---------|
| D2 Stage A | gates route correctly | unit | `node tests/test-212-critic-stage-a.cjs` | ❌ Wave 0 |
| D2 rubric | item pattern → verdict (stubbed judge) | unit | `node tests/test-212-critic-rubric.cjs` | ❌ Wave 0 |
| D3 gold-set | 6 cards vs expected verdicts; sterling lean-checkable first | integration | (leg in run-all-212) | ❌ Wave 0 |
| D6 negative | tahini/turbines/casino reject | unit | `node tests/test-212-negative-corpus.cjs` | ❌ Wave 0 |
| D1/D3b Part 8 | scalars+enums, floats quantized, no content | unit | `node tests/test-212-part8-boundary.cjs` | ❌ Wave 0 |
| D5 resolution | no registration-time roomDir closure | unit (grep) | (leg in run-all-212) | ❌ Wave 0 |
| Pre-212 B1 | batched embed completes at scale | integration | re-run `scripts/eureka-room-report.cjs --db jhtv-oliver-kuntz` | ❌ prerequisite |
| Pre-212 B2 | offline mode degrades not dies | integration | `scripts/eureka-room-report.cjs --offline` | ❌ prerequisite |

### Sampling Rate
- Per task commit: the relevant offline `node tests/test-212-*.cjs` (<5s, no model/network).
- Per wave merge: `bash tests/run-all-212.sh` + `bash tests/run-all-211.sh` (no-regression on the generator it consumes).
- Phase gate: full `run-all-212` green + `node scripts/doctor.cjs --acceptance` before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] **Pre-212 Blocker 1** - verify/wire batched embedding (`embedding-spine.cjs` / `tri-modal-index.cjs`); re-run against jhtv-oliver-kuntz to confirm no OOM.
- [ ] **Pre-212 Blocker 2** - fix the `vec0` infer-backend-from-table bug + verify `vec_version()` on this Node runtime; ensure offline degrades to cjs-fallback.
- [ ] `tests/test-212-critic-stage-a.cjs`, `test-212-critic-rubric.cjs`, `test-212-negative-corpus.cjs`, `test-212-part8-boundary.cjs`
- [ ] `tests/run-all-212.sh` (model on run-all-211.sh)
- [ ] `evals/eureka/212-critic-baseline.json` (may ship `baseline_deferred`)
- [ ] Stub-judge injection seam in `eureka-critic.cjs` (the 211 `encodeFn`/`_forceUnavailable` pattern)
- [ ] `evals/eureka/opportunity-drafts/` - the 2 JHU Opportunity Statements as acceptance fixtures

## Security Domain

> `security_enforcement` absent = enabled. **Highest-stakes constraint** (the phase designs a Brain MCP tool boundary - Canon Part 8) `[repo]` `CLAUDE.md` Part 8.

### Applicable ASVS Categories
| Category | Applies | Control | Source |
|----------|---------|---------|--------|
| V5 Input Validation | yes | zod schema; reject any non-scalar/non-enum field | `[disk]` tool-router pattern |
| V8 Data Protection/Privacy | yes | D1/D3b: scalars+enums, quantize, coarse confidence, no content IDs, aggregate | `[room]` agent-05 §3 |
| V13 API/Web Service | yes | rate-limit per key + dedupe consecutive vectors | `[room]` agent-05 §3(4) |
| V6 Cryptography | no | `PLURAI_API_KEY` read never minted; don't log it | `[disk]` |
| V4 Access Control | no | stateless ruling; no per-user resource access | `[repo]` 212-CONTEXT §D4 |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation | Source |
|---------|--------|-----------|--------|
| Content egress via a smuggled text field (schema drift) | Info disclosure | `auditQueryObject`; frozen scalars-and-enums schema; D7c scan | `[room]` agent-05 §3 |
| Embedding inversion (Vec2Text ~92%) | Info disclosure | never transmit an embedding; only quantized scalars (20-60 bits, not invertible) | [arXiv 2310.06816](https://www.emergentmind.com/papers/2310.06816) |
| Float-precision fingerprint / cross-session linkage | Linkability | quantize before egress (D3b1) | `[room]` agent-05 §2c |
| Query-stream behavioral fingerprint | Linkability | server-side aggregate into buckets, no per-query rows; rate-limit | [de Montjoye](https://www.nature.com/articles/srep01376) |
| Membership inference from returned confidence | Info disclosure | coarse confidence not a raw float (D3b3) | `[room]` agent-05 §2b |
| Stale roomDir closure | Tampering | stateless pure fn; D5 check | `[room]` mcp-first-addendum §1 |
| Sycophancy (blesses fluent framing) | Spoofing | abstracted-feature input hides framing; adversarial pass; bias to reject | [arXiv 2310.13548](https://arxiv.org/abs/2310.13548) |

**One-line Part 8 verdict:** the wire format is safe by construction; the risk is precision + accumulation. Quantize floats, aggregate before calibrating, coarsen returned confidence, rate-limit - textbook federated analytics, not a fingerprinting service. `[room]` `.../agent-05-stateless-critic-mcp-pattern.md §3`; [Google Federated Analytics](https://research.google/blog/federated-analytics-collaborative-data-science-without-data-collection/).

## Environment Availability

| Dependency | Available | Detail | Fallback | Source |
|------------|-----------|--------|----------|--------|
| `@huggingface/transformers` 4.2.0 | ✓ | node_modules | CJS-cosine + `encoder_unavailable` degrade | `[disk]` |
| `sqlite-vec` 0.1.9 | ⚠ | installed BUT `vec0` fails to load on Node 22.22.2 offline path (Blocker 2) | cjs-fallback BLOB+brute-force | `[disk]`; [sqlite-vec JS docs](https://alexgarcia.xyz/sqlite-vec/js.html) |
| Node runtime | ⚠ | v22.22.2; sqlite-vec node:sqlite wants >=23.5.0 | raise floor or accept cjs-fallback | `[disk]`; [docs](https://alexgarcia.xyz/sqlite-vec/js.html) |
| 211 generator end-to-end at scale | ✗ | Blocker 1 (OOM) + Blocker 2 (vec0) | fix both pre-212 | `[room]` `.../2026-07-06-jhtv...formula.md §2` |
| SEED-050 gold cards | ✓ | 6 cards, `validated: candidate` | — | `[disk]` `evals/eureka/cases/` |
| Plurai deployed classifier | ✗ | 404 at run.plurai.ai | `baseline_deferred`+SKIP; local critic is the real path | `[disk]` `evals/plurai/211-baseline.json` |
| Hand-labeled gold LABELS (>=0.85 calibration) | ✗ | pending 211-04/211-05 human checkpoints | ship structurally-tested + `baseline_deferred` | `[disk]` `211-04-SUMMARY.md`, `211-05-SUMMARY.md` |

**Missing with no fallback:** finalized human gold LABELS for the >=0.85 calibration acceptance. Build + structurally verify the critic without them; plan the calibration NUMBER as a `checkpoint:human-verify` leg. **Blocking at execution time:** the two pre-212 generator infra bugs (no fallback for a real-room run other than fixing them).

**Missing with fallback:** deployed Plurai classifier -> local two-stage critic; sqlite-vec vec0 -> cjs-fallback cosine.

## Dev-Research Compositing: New Trail to File Back

Per CLAUDE.md's "Dev-Research Compositing (Rethinking Room)" rule, this research composited with all mandated `rethinking-mindrianos` entries (read in full: `02-moat-embedding-audit.md`, `mcp-first-and-graph-indexer-addendum.md`, all 6 files of `2026-07-05-eureka-critic-brain-mcp-plan/`, and the newest `2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula.md`). NEW trail to file back (the researcher flags; does not write into the room):

1. `2026-07-06-phase-211-shipped-212-context-stale-correction/` - record that the 212-CONTEXT Path A/B premise is stale (211 shipped; run-all-211 PASS=6), so 212 plans against the real generator. `[disk]` evidence.
2. `2026-07-06-pre-212-generator-infra-blockers-root-caused/` - the D16 gap with root causes this session found: Blocker 1 OOM (batching seam `batchSlices` now exists - verify wiring), Blocker 2 vec0 (infer-backend-from-table-existence in `vector-store.cjs:160` + Node 22.22.2 < 23.5.0). Cross-link to the jhtv D15 entry §2 which named but did not root-cause them.
3. `2026-07-06-embedder-in-flux-affects-critic-calibration/` - JHU run used mdbr-leaf-ir+k=25 (diligence D3/D5 applied via env) while code defaults to MiniLM; this in-flux decision gates the critic's Stage A thresholds. The diligence "Upstream note" is still un-applied to 211's locked CONTEXT.
4. Amend `2026-07-05-eureka-critic-brain-mcp-plan/` with a ratification note: the two-stage local-rubric + remote-calibrator split (diligence C1) is now the load-bearing 212 architecture, superseding SEED-050's "cheapest Plurai judge first" as the guard's core.

## Assumptions Log

| # | Claim | Section | Risk if Wrong | Source basis |
|---|-------|---------|---------------|--------------|
| A1 | The rubric LLM call runs in the local Claude Code session (has model access) | Arch Map / Pattern 2 | If the surface lacks local model access, re-examine the split. LOW - CLI/Desktop/Cowork all have Claude. | `[room]` diligence C1 |
| A2 | The 6 cards + D6 junk suffice to structurally verify the critic before hand-labeled gold exists | Validation | If card destinations shift at the human checkpoint, fixtures update. MEDIUM. | `[disk]` cards `validated:candidate` |
| A3 | Graph-framed whitespace substrate (ROADMAP) is 211-covered or out of 212 scope | Phase Reqs / Q1 | If the navigator wants net-new structural-hole detection, scope expands. HIGH - real ROADMAP-vs-CONTEXT contradiction. | `[my inference]` |
| A4 | The remote MCP calibrator is Mindrian's Brain, reachable, holds pooled buckets | Arch Map / D4 | If SEED-014 isn't stood up, calibrator is local-only initially; degrades gracefully (D4 is local-first). MEDIUM. | `[repo]` D4; `[room]` 02-moat §3b |
| A5 | `PLURAI_API_KEY` + `lab/eval` client are the right reuse for a deployed leg | Stack | If Plurai retired, the leg is dead; local critic unaffected. LOW. | `[disk]` |
| A6 | The generator's SHIPPED embedder (for threshold calibration) is unsettled (MiniLM vs mdbr-leaf-ir) | Pitfall 8 | If already locked, calibrate against that one. MEDIUM. | `[disk]` JHU report vs 211-01 |
| A7 | Blocker 1's `batchSlices` seam is not yet wired end-to-end (room entry predates it) | Pre-212 Blockers | If already wired + verified, Blocker 1 is closed and only Blocker 2 remains. MEDIUM - must verify, not assume. | `[disk]` `embedding-spine.cjs:357` vs `[room]` §2 |
| A8 | A batch size of 16-64 + max_length 256 is a safe starting point for MiniLM-class CPU embedding | Pre-212 Blocker 1 | Wrong size just needs tuning, not a redesign. LOW. | [web] Sentence-Transformers batch-size guidance |

## Open Questions

1. **Scope: is "graph-framed substrate + whitespace/bridge signal detection" in Phase 212 or deferred?** Known: ROADMAP goal names it `[repo]`; CONTEXT boundary narrows 212 to the critic + MCP and says "does NOT build a second differential engine" `[repo]`; 211 already ships cross-boundary pair enumeration `[disk]` `211-05-SUMMARY.md §What Was Built`. Unclear: net-new structural-hole/betweenness detection vs 211-covered. **Resolved by:** unresolved - needs the navigator. Recommendation: default to CONTEXT (critic-first).

2. **Calibration certification depends on pending human checkpoints - how to gate?** Known: the >=0.85 + high-pseudoscience-recall bar needs hand-labeled ~25 insight-turns; 211-04/211-05 Task 3 checkpoints are pending; cards ship `validated: candidate` `[disk]`. **Resolved by:** code/disk inspection. Recommendation: build + structurally verify autonomously; make >=0.85 a `checkpoint:human-verify` leg (the honest-deferral pattern 211 used).

3. **Is the deployed Plurai classifier leg in 212 scope given it 404s?** Known: 404 today `[disk]`; SEED-050 step 4 says "start_evaluator FIRST"; diligence says features-only Plurai cannot do novelty `[room]`. **Resolved by:** room research + disk. Recommendation: local two-stage critic is the core; Plurai is an optional separately-gated leg that degrades to SKIP.

4. **Which embedder does the generator ship, and against which are Stage A thresholds calibrated?** Known: MiniLM in code, mdbr-leaf-ir in the JHU run `[disk]`; diligence recommends the swap `[room]`. **Resolved by:** needs a navigator decision; thresholds cannot lock until settled.

5. **Should the Node runtime floor be raised to >=23.5.0 to make sqlite-vec's node:sqlite vec0 path work, or should the plugin standardize on the cjs-fallback on Node 22?** Known: runtime is 22.22.2, sqlite-vec node:sqlite wants 23.5.0+ `[disk]` + [web]. **Resolved by:** code inspection + fresh web research. Recommendation: fix the infer-backend bug so offline degrades gracefully regardless; separately raise the CLAUDE.md Node floor only if the navigator wants vec0 performance on this platform (cjs-fallback is fine at room scale).

## Sources

### Primary (HIGH confidence)
- Direct disk/code inspection this session `[disk]`: `package.json`, `node_modules/`, `lib/core/eureka/{embedding-spine,vector-store,tri-modal-index}.cjs`, `lib/core/room-db.cjs`, `lib/core/rs-egress-prompts.cjs`, `lib/mcp/tool-router.cjs`, `bin/mindrian-mcp-server.cjs`, `lab/eval/report-from-transcript.cjs`, `lab/plurai-suite/judges.cjs`, all 5 `211-0{1..5}-SUMMARY.md`, `evals/eureka/`, `.planning/config.json`, `.planning/ROADMAP.md`, `node --version` (v22.22.2).
- Room `[room]`: `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-eureka-critic-brain-mcp-plan/agent-04-llm-judge-reliability.md`, `.../agent-05-stateless-critic-mcp-pattern.md`, `.../2026-07-05-eureka-technical-diligence.md`, `.../2026-07-05-rebuild-vs-surgery/02-moat-embedding-audit.md`, `.../2026-07-05-mcp-first-and-graph-indexer-addendum/2026-07-05-mcp-first-and-graph-indexer-addendum.md`, `.../2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula/2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula.md`.
- Web (fresh this session, HIGH for the fixes): [sqlite-vec JS docs](https://alexgarcia.xyz/sqlite-vec/js.html), [Node.js SQLite docs](https://nodejs.org/api/sqlite.html).

### Secondary (MEDIUM)
- 211-CONTEXT.md (D1-D8), 212-CONTEXT.md (D1-D7), SEED-049/050.
- `evals/eureka/211-room-report*.md`, `211-manual-baseline.md`.
- Web: [transformers.js #1164](https://github.com/huggingface/transformers.js/issues/1164), [Optimizing Transformers.js](https://www.sitepoint.com/optimizing-transformers-js-production/), [MLM semantic search](https://machinelearningmastery.com/building-semantic-search-with-transformers-js-and-sentence-embeddings/), [Sentence-Transformers batch size](https://medium.com/@vici0549/it-is-crucial-to-properly-set-the-batch-size-when-using-sentence-transformers-for-embedding-models-3d41a3f8b649), [Zilliz chunked embedding](https://zilliz.com/ai-faq/how-can-i-handle-very-large-datasets-for-embedding-or-training-that-dont-fit-entirely-into-memory-and-does-the-sentence-transformers-library-support-streaming-or-processing-data-in-chunks-to-address-this), [basic-memory #735 vec0 Windows](https://github.com/basicmachines-co/basic-memory/issues/735).

### Tertiary (LOW - needs validation)
- The arXiv IDs inside the room agent passes are the room's 2026-07-05 web-research pass, internally cross-referenced across three agents but not independently re-verified this session. The clickable arXiv links above resolve to the cited abstracts; treat specific 2026-dated IDs as CITED-from-room. Key ones: [2606.12071](https://arxiv.org/abs/2606.12071), [2605.29800](https://arxiv.org/html/2605.29800), [2507.17746](https://arxiv.org/abs/2507.17746), [2305.12660](https://arxiv.org/pdf/2305.12660v1), [2310.13548](https://arxiv.org/abs/2310.13548), [2310.06816](https://www.emergentmind.com/papers/2310.06816), [2503.05965](https://arxiv.org/pdf/2503.05965).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - every dependency shipped + navigator-approved in 211; 212 adds none `[disk]`.
- Architecture (two-stage local critic + thin MCP boundary): HIGH - triangulated across agent-04, agent-05, the diligence, and the moat audit, all consistent, matching CONTEXT D1/D2/D4 `[room]`.
- Pre-212 blockers + fixes: HIGH - root-caused in code this session + corroborated by fresh web research; Blocker 1 wiring needs one verification step (A7).
- Judge design/pitfalls: HIGH on design (cited), MEDIUM on the arXiv IDs (room-sourced).
- Calibration acceptance: MEDIUM - design clear, gold LABELS pending human checkpoints.
- Scope (substrate/whitespace half): LOW - genuine ROADMAP-vs-CONTEXT discrepancy for the navigator.

**Research date:** 2026-07-06
**Valid until:** ~2026-08-05 for architecture/pitfalls (stable); ~2026-07-13 for the blockers/embedder/Plurai-endpoint/pending-checkpoint state (fast-moving live decisions).

## RESEARCH COMPLETE
