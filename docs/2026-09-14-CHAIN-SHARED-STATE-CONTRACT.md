# The chain shared-state contract (Phase 347)

Status: WORKING (five decisions below), the schema and requirement rows are the phase's own binding contract
Implementing phase: 347 (the shared-state contract for chains, graph-engineering learn 5)
Canon anchors: Part 7 (Reuse Before Build), Part 8 (Graph Boundary), Part 9 (Memory Locality), Part 11 (Invocation Constitution)
Grounding: `.planning/phases/347-.../347-RESEARCH.md` (the seven findings) and `347-LANGTALKS-CONSULT.md` (the corpus consult), cited inline below, never re-derived

`.planning/` is `.gitignore`d in this repo (`.gitignore:97`; `git check-ignore -v` confirms the 347 directory is ignored), so a contract recorded only in a PLAN.md evaporates at the next machine switch. Eleven later plans in this phase implement against one node shape, one edge contract and one kind-to-epistemic_type mapping. This file is that one tracked home; a reader should never need to open `.planning/` to understand the shape.

---

## Section 1: What flows between chain steps today

The measured facts, with citations, before any design:

- `previousOutput` is a closure-local variable, never persisted: `chain-executor.cjs:486` (sync loop), `:737` (async loop).
- It is set from `result.chain_output`: `:607` (sync), `:873` (async).
- It folds forward at the bottom of the loop: `:656` (sync), `:911` (async).
- It is handed to `onStep` as the second argument: `:571` (sync), `:826` (async).
- The production `onStep`, `chain-step-dispatcher.cjs::dispatchStep` at `:321`, declares the parameter and never reads it in its own body. A grep for `previousOutput` in that file returns only signature and pass-through lines.
- The only durable per-step graph write today is one `memory_event` node with zero edges (`chain-step-dispatcher.cjs:355-361`).
- The journal records the synthetic string `'chain-output:' + step.command` at `chain-executor.cjs:900`, never the real output body.

Verdict: nothing durable carries a step's real output into the room graph today. This contract exists to close that gap without inventing a second substrate.

## Section 2: The record is a node, the edge is a pointer

`edges.cjs:845-848` states the rule this contract inherits rather than reargues: edge `properties` are enum and scalar only, never prose, never a claim or artifact body. The consequence for this phase: the roadmap phrase "every chain edge carries a typed room-graph record" resolves, in this substrate, to a `chain_state` NODE plus typed pointer edges, never a body riding an edge's properties blob.

Two edge types carry the pointers. `SOURCED_FROM` (`edges.cjs:854`) is allow-listed, DESIGNED and FILED, but has shipped with no consumer until now (`edges.cjs:836-839`: "NO CONSUMER SHIPS IN THIS TASK"); Phase 347 is its first real writer. `FEEDS_INTO` (`edges.cjs:257`) is allow-listed and already carries the successor-pointer semantics this contract needs. Neither edge type is minted fresh by this phase; both already exist in `ALLOWED_EDGE_TYPES`.

## Section 3: The chain_state node shape

Node id is the string `chain:` followed by `run_id`, a colon, `step_index`, a colon, and `kind`.

Node type is the literal `chain_state`.

Properties carry exactly these keys:

- `run_id`: the stable identifier for one `runChain` invocation.
- `step_index`: the integer position in the resolved chain.
- `command`: the `/mos:` command handle, a generic methodology handle (Canon Part 8 clean).
- `kind`: one of `task`, `draft`, `notes`, `judgment`, `gate_decision` (Section 4).
- `body`: the record payload. LOCAL only, mirroring the way a claim's `text` rides the node `properties` blob (`typed-claim.cjs:141-171`). Never egresses.
- `quality`: reuses the existing enum `high` / `medium` / `low` / `null`.
- `tier`: reuses `TIER_EXECUTABLE` / `TIER_HOST_DISPATCH` from `chain-step-dispatcher.cjs`.
- `produced_by`: one of `worker`, `reviewer`, `navigator`.

`insertNode` overrides for every `chain_state` write:

- `source_path`: `'chain:' + run_id`.
- `created_by`: `'system'`.
- `review_status`: per WD-347-3 (Section 7).
- `epistemic_type`: per the mapping table in Section 4. `insertNode` REQUIRES this before any `prepare()` call (`node-insert.cjs:113`, `:211`); a caller that omits it or supplies a value outside `ALLOWED_EPISTEMIC_TYPES` throws before any row is written.

## Section 4: The five kinds and the kind-to-epistemic_type mapping

`epistemic_type` is a real fork, not a detail, because the enum is closed and validated before any other work runs (`node-insert.cjs:211`). Phase 276-12 already solved the sibling problem for claims: `typed-claim.cjs`'s `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE` table replaced a hardcoded constant that "collapsed all 6 KNOWLEDGE_TYPES onto one epistemic_type" (`typed-claim.cjs:192-194`). This contract copies that shape rather than reinventing it.

| kind | epistemic_type | reasoning |
|---|---|---|
| task | observation | A task description records what was asked, not a derived position. |
| draft | model_derived_assertion | A draft is the model's own output standing on its own, not yet reviewed. |
| notes | derived_fact | Notes are extracted and restructured from a source the step already read. |
| judgment | interpretation | A judgment reads evidence and takes a position short of a decision. |
| gate_decision | decision | It records a navigator verdict, the closed enum's own `decision` member. |

A single hardcoded `epistemic_type` for all five kinds is forbidden: it would repeat the exact pre-276-12 defect (`typed-claim.cjs:192-194`) this phase's own grounding names as the precedent to avoid, and it would make a `task` bookkeeping row indistinguishable from a navigator's `gate_decision` verdict to any reader walking the graph by `epistemic_type` alone.

## Section 5: The two mandatory edges and the anchor rule

The anchor is one `SOURCED_FROM` edge from the record to the step's subject node, written through `edges.cjs::writeEdge`. A write with no resolvable subject node returns `{ok:false, reason:'missing_structural_anchor'}` and mints NO node, so an unanchorable record cannot exist. This is the writer's own precondition, checked before `insertNode` is ever called; it is not a change to `writeEdge` itself, since `writeEdge` today never probes endpoint existence at all (`lib/core/navigation/CONTEXT.md`: "an edge whose endpoint has no node row is not a schema violation, it is a permitted state").

The successor is one `FEEDS_INTO` edge from record N to record N+1, written when record N+1 is minted.

Edge properties carry only `run_id` and `step_index` scalars, never a body.

The forbidden shape: serializing the draft or the notes into the edge properties would pass `writeEdge` validation, because `properties` is an opaque JSON blob with no shape check, and would silently breach the doctrine stated in Section 2. Nothing in `writeEdge` catches this; the discipline is the writer's own, not the chokepoint's.

The caller must read `written`, not only `ok` (`edges.cjs` D-01, Phase 273): an edge write can return `ok:true` with `written:false` when a `confirmed` row is already present and the write was suppressed (`edges.cjs:1119-1121`), and a caller that checks only `ok` would believe an edge landed when it did not.

## Section 6: The projection rule

WD-347-2 (OQ-2), verbatim: the `chain_state` graph records are a PROJECTION. `room/.mindrian/pipeline-state.json` remains the declared SOLE chain-state truth for resume position (D-166-02 / B1, `lib/mcp/pipeline-state.cjs:27-46`). On disagreement the file wins and the graph row is reported stale. Promotion of the graph to primary is a NAMED follow-on, not this phase. Reversal cost: amending the D-166-02 / B1 sole-truth header, rewriting `chain_run`'s resume to read the graph, and adding T-198-12 anti-spoofing for a graph-reconstructed gate (today's ledger entry carries live function references, `gate-ledger.cjs:29`, `chain.cjs:356`, `:406`); estimated two plans plus its own threat register.

The precedence sentence a reader can act on: `pipeline-state.json` wins on disagreement, the graph row is reported stale, and no code path treats the graph as the resume cursor in this phase.

This copies an existing precedent rather than inventing a new reconciliation rule: `commands/pipeline.md:113` already states, for the frontmatter-scan secondary index, "the scan never overrides the store" when the two disagree. The `chain_state` graph projection inherits the same shape: it is a second, richer mirror, never a second vote.

## Section 7: Requirements SHARED-01 through SHARED-13, and the working-decision ledger

### The requirement table

| SHARED-01 | A `chain_state` node kind is written exclusively through `lib/core/navigation/chain-state.cjs`, which calls `node-insert.cjs::insertNode` and writes its anchor through `edges.cjs::writeEdge`; a record with no resolvable subject node returns `{ok:false, reason:'missing_structural_anchor'}` and mints no node, and the module issues no raw SQL against `nodes` or `edges`. |
| SHARED-02 | A test reconstructs each chain step's input from `room.db` alone, with no trace object and no closure, and deep-equals it against the trace `runChain` returned; a deleted mid-chain record makes reconstruction report `unreconstructible` with the missing step index, never an empty success. |
| SHARED-03 | Every `runChain` step's `chain_output` is persisted as a `chain_state` record on both the synchronous and the asynchronous path before it folds into the next step's `previousOutput`, as a PROJECTION of `pipeline-state.json`, which remains the declared sole chain-state truth for resume position. |
| SHARED-04 | On the live MCP path `dispatchStep` reads the predecessor step's `chain_state` record through `navigation.cjs` and carries it into its returned `chain_output`, so step N+1 receives step N's typed record rather than conversation prose. |
| SHARED-05 | `getRoomContext` accepts `options.focusNodeId` and `context_assemble` exposes it as `focus_node_id`; when supplied, `_meta.seedNodeId` echoes it and `resolveSeedNode` is not called, and a call omitting it returns a byte-identical body to the pre-change path. |
| SHARED-06 | The resolved chain step object accepts optional `on_pass`, `on_fail`, `fan_out`, `fan_in`, `reviewer` and `context` keys, `runChain` resolves its successor through one named `resolveSuccessor` function rather than the `i + 1` literal, and a step carrying none of the keys produces a trace byte-identical to today's. |
| SHARED-07 | `chain_run`'s resume path resolves the remainder by step id through the same `resolveSuccessor`, never through `list.slice(idx + 1)`, and a halt inside a non-linear route resumes on the declared successor. |
| SHARED-08 | Fan-out and fan-in are DECLARED by the chain executor and EXECUTED by `lib/core/bono/cell-fanout.cjs` through a lazy require, so D-164-S2 stays unreversed and exactly one fan-out engine ships; a conditional back-edge is bounded by the EXEC-06 `maxSteps` brake and the module header states that a bounded back-edge is not a re-litigation of decision 166 B3. |
| SHARED-09 | `visualize-chain` renders the real resolved chain and the real recorded run, including halt nodes, conditional arrows, the fan-out subgraph and the reviewer node; the hardcoded six-step literal is deleted from `lib/mcp/tool-router.cjs`, and a room with no recorded run gets an honest empty statement rather than a fabricated pending list. |
| SHARED-10 | The reviewer is never the worker. A material step is reviewed by the navigator at the gate on all three surfaces; an `autonomous_safe` step may declare an independent reviewer subagent, dispatched host-side on the Claude Code CLI only, and on Claude Desktop and Cowork the same request returns an honest `requires_host_dispatch` directive with `quality: null`, never a fabricated verdict. |
| SHARED-11 | The five-perspective meeting fan-out writes each worker's returned rows as `chain_state` records of kind `notes` before consolidation, and the orchestrator reads them back through `navigation.cjs` rather than from its own context window, with each extractor still receiving the FULL transcript. |
| SHARED-12 | Every surface Phase 347 authors or modifies that carries frontmatter declares `layer: graph` from the Phase 344 closed vocabulary, proven by `tests/test-347-layer-graph-declaration.cjs`. |
| SHARED-13 | `bash tests/run-all-347.sh` runs green with zero FAIL, `node scripts/doctor.cjs --acceptance` and `node scripts/run-harness.cjs --check` are unregressed, every SHARED id is registered in `.planning/REQUIREMENTS.md` with measured proof, and the phase record lands in `docs/OPEN-HANDOFFS.md` and in the rethinking-mindrianos research room. |

### The working-decision ledger

| id | decision | status | date | reversal cost |
|---|---|---|---|---|
| WD-347-1 (OQ-1) | D-164-S2 is NOT reversed. The chain executor DECLARES `fan_out` and `fan_in`; it DELEGATES their execution to `lib/core/bono/cell-fanout.cjs::runCellFanout` through a lazy require inside the fan-out branch only. `cell-fanout.cjs` is not modified and never requires the chain executor (`cell-fanout.cjs:24-28`). One fan-out engine, not two. | WORKING | 2026-09-14 | Reversing means the executor grows its own dispatch loop, its own clamp authority and its own per-cell critique: a second fan-out engine plus a second cap authority beside `resolveFanoutCap` / `FUTURES_FANOUT_CAP` (`cell-fanout.cjs:20-22`), and D-164-S2 itself is re-litigated. Estimated one full plan plus a re-ruling. |
| WD-347-2 (OQ-2) | The `chain_state` graph records are a PROJECTION. `room/.mindrian/pipeline-state.json` remains the declared SOLE chain-state truth for resume position (D-166-02 / B1, `lib/mcp/pipeline-state.cjs:27-46`). On disagreement the file wins and the graph row is reported stale. Promotion of the graph to primary is a NAMED follow-on, not this phase. | WORKING | 2026-09-14 | Reversing means amending the D-166-02 / B1 sole-truth header, rewriting `chain_run`'s resume to read the graph, and adding T-198-12 anti-spoofing for a graph-reconstructed gate (today's ledger entry carries live function references, `gate-ledger.cjs:29`, `chain.cjs:356`, `:406`). Estimated two plans plus its own threat register. |
| WD-347-3 | `review_status` is `'confirmed'` for kinds `task` / `draft` / `notes` / `judgment` (bookkeeping, following the `memory_event` carve-out at `343-ICM-CONSULT.md:89`), and for kind `gate_decision` it is `'confirmed'` ONLY when the writer receives a non-empty `byUser` handle, else `'proposed'`. | WORKING | 2026-09-14 | Mirrors the `writeEdge` `confirmed_requires_by_user` discipline (`edges.cjs:1083-1088`) at the writer's own contract, since `insertNode` does not enforce it for nodes. Reversing means the writer's `gate_decision` branch stops requiring `byUser` and a background process could mint a human-trust `chain_state` row. |
| WD-347-4 | `chain_state` is EXCLUDED from Leg C's ranked neighborhood result by default and reachable only by an explicit `focusNodeId`. | WORKING | 2026-09-14 | The dogfood room is already 65 percent bookkeeping (5,535 `memory_event` of 8,467 nodes, measured). Ranked-query dilution, not write volume, is the named risk (Research risk (a), assumption A4). Reversing means every `context_assemble` ranked call in every room starts competing with chain bookkeeping rows for its top-k slots. |
| WD-347-5 | A NEW fixture helper `tests/helpers/fixture-room-347.cjs` is minted rather than extending `tests/helpers/fixture-room-219.cjs`. | WORKING | 2026-09-14 | 219's fixture models hub skew and its own `run-all-219` gate forbids raw node and edge inserts inside it; the 347 fixture must create a LEGACY 3-column `nodes` table, which is only reachable by direct DDL. Extending 219 would break its gate. Recorded as a deliberate departure from the research recommendation. |

### Named follow-ons, deliberately out of scope

1. **The edge-chokepoint bypass** at `graph-ops.cjs:196`, `:250`, `:262` and the five raw-insert sites in `scripts/build-ecosystem-graph.cjs` (OQ-5). Phase 343's own precedent is to measure what a prior phase guards, not to re-scope it; this phase scopes every assertion to `chain_state` records instead of widening the fix.
2. **Restart-survivable resume** (OQ-6). The reconstructibility proof (SHARED-02) enables it, but rebuilding the resume path itself touches the T-198-12 anti-spoofing surface and deserves its own threat register, not a rider on this phase.
3. **Promotion of the graph to primary chain-state truth** (WD-347-2). Named above with its own reversal cost; not attempted here.
4. **The langtalks re-extraction request** (OQ-7). The consult found that the note's four advantages (clean independent context, true self-review, parallel acquisition, readable control flow) did not land as corpus nodes under those labels, citing the note's `2801:2971` span. Filing the re-extraction request with langtalks-graph-expert is a phase deliverable so this vocabulary becomes queryable, not a research footnote left behind.

---

Hyphens only throughout this document, no em-dashes, no emoji.
