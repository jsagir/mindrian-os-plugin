# Phase 296: SEED-030: RS Pipeline Spine-Wiring + Expert-Graph Reconciliation - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Finish localizing the reverse-salient (RS) discovery pipeline. The connector-spine-wiring
half of this seed is ALREADY DONE (verified 2026-07-15: `rs-fetch`, `rs-explain`,
`rs-experts`, `rs-thesis` all carry `connector:` frontmatter and appear in
`data/connector-registry.json`). What's left, and what this phase delivers:

1. Repoint the RS engine's vector search off Pinecone onto the local embedding layer
   (internal/cross-room/hybrid modes read local vectors, not `rs-external` Pinecone calls).
2. Lock and implement the `rs-experts` Aura/Brain-Cypher decision: keep it a remote-Brain
   enrichment that degrades gracefully (clear message) when Brain is unreachable, rather
   than crashing.

Explicitly OUT of scope: re-wiring connector frontmatter (already done), building a new
embedding layer from scratch (it already exists, this phase consumes it), porting
`scripts/rs-engine.py` to CJS (deferred to SEED-013/Phase 283 per the decision below),
and anything in the SEED-057 "synthesis as votable expert" proposal (Phase 316 - a
separate, much larger phase this one does NOT block or get blocked by, though 316's
research should note this phase's local-vector repoint once it lands).

</domain>

<decisions>
## Implementation Decisions

### RS vector repoint (D-01, D-02)
- **D-01:** Do NOT port `scripts/rs-engine.py` / `lib/core/rs_corpus.py` to CJS in this
  phase. They stay Python. Repoint them to read the SAME local vector data
  `lib/core/eureka/embedding-spine.cjs` already writes to room.db, instead of calling
  Pinecone (`rs-external` mode). No new cross-language bridge, no new dependency - swap
  the data source Python reads from, keep the language as-is.
- **D-02:** The CJS-to-Python data handoff mechanism (how Python reads what CJS's
  embedding-spine wrote to room.db - direct SQLite read via a Python sqlite3 connection
  is the obvious default, given `lib/core/rs_corpus_exclude.py` already exists alongside
  the CJS RS files) is a research-time decision, not locked here. Researcher should
  confirm room.db's vector table schema is readable from Python without going through a
  CJS intermediary process.

### rs-experts / R-expert scope (D-03)
- **D-03 (was LOCKED-pending in SEED-030, now CONFIRMED):** `rs-experts` stays on
  remote-Brain Mode-A (Neo4j Aura / Brain-Cypher). It is people + teaching-graph data -
  real Brain IP per Canon Part 8 - correct to keep remote. This phase's job for
  `rs-experts` specifically is the graceful-degrade path: when Brain is unreachable,
  return a clear, labeled "Brain unreachable" response instead of crashing or silently
  returning nothing. Do not descope the expert-network capability.

### Sequencing relative to SEED-013 (Python elimination, Phase 283)
- **D-04:** This phase's Python files (`rs-engine.py`, `rs_corpus.py`) are explicitly
  left in Python here. Phase 283 (SEED-013, eliminate Python from the user-machine
  surface) is the correct future home for actually removing the Python runtime
  dependency. Planner should note this phase's changes will need re-verification once
  283 lands, not treat 283 as this phase's blocker - the two can proceed independently
  since D-01 only changes the DATA SOURCE Python reads, not the language.

### Claude's Discretion
- Exact wording of the "Brain unreachable" degrade message for `rs-experts`.
- Whether the local-vector read from Python uses a direct sqlite3 connection or a thin
  CJS-side export step, so long as it introduces no new remote dependency and no new
  third-party package.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The seed itself (primary source, do not re-derive)
- `.planning/seeds/SEED-030-rs-pipeline-spine-and-expert-graph-reconciliation.md` -
  full acceptance criteria, tests, staleness note (item 1 already shipped 2026-07-15),
  and the reuse-before-build framing (Part 7: this is wiring, not new machinery).

### Adjacent seeds referenced during discussion
- `.planning/seeds/SEED-029-local-embeddings-room-db-vector-spine.md` - the embedding
  layer this phase consumes (Phase 295, already promoted, not yet built - if 295 hasn't
  shipped when this phase plans, the local vector table this phase depends on may not
  exist yet; researcher must verify 295's actual status before assuming the target
  exists).
- `.planning/seeds/SEED-013-eliminate-python-from-user-machine-cjs-port.md` (Phase 283) -
  the eventual full Python-elimination home; this phase does not block on it (D-04).
- `.planning/seeds/SEED-057-synthesis-as-votable-expert-graph-native-game-theory.md`
  (Phase 316) - downstream consumer of a healthy RS pipeline; not this phase's scope,
  named so planner doesn't accidentally fold it in.

### Canon
- Canon Part 8 (Graph Boundary) - grounds D-03: `rs-experts`' people/teaching-graph data
  staying a remote Brain leg is the correct, canon-compliant choice, not a compromise.
- Canon Part 7 (Reuse Before Build) - grounds D-01: the embedding layer and connector
  spine-wiring already exist; this phase applies them, it does not build new machinery.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/eureka/embedding-spine.cjs`, `lib/core/eureka/vector-store.cjs` - the local
  embedding layer this phase repoints RS onto. Confirmed present in the codebase via
  scout (2026-09-03).
- `data/connector-registry.json` - already carries `rs-fetch`/`rs-explain`/`rs-experts`/
  `rs-thesis` entries; nothing to regenerate here.

### Established Patterns
- `lib/core/rs_corpus_exclude.py` already exists as a Python file alongside the CJS RS
  stack - precedent for Python/CJS coexistence in this subsystem, supports D-01's
  "don't force a port" call.
- Graceful-degrade-on-Brain-unreachable is an established pattern elsewhere in this
  codebase (not unique to this phase) - researcher should find and reuse the existing
  degrade-message convention rather than inventing a new one.

### Integration Points
- `scripts/rs-engine.py` and `lib/core/rs_corpus.py` are the two files whose Pinecone
  calls get repointed (D-01/D-02).
- `commands/rs-experts.md` is where the graceful-degrade behavior surfaces to the user
  (D-03).
- `lib/core/rs-engine.cjs` (the CJS-side RS file) - researcher should confirm whether any
  of the repoint work belongs here instead of/in addition to the Python files.

</code_context>

<specifics>
## Specific Ideas

No UI/UX specifics - this is backend data-source plumbing plus one error-handling path.
The R-expert decision explicitly should NOT crash and should NOT silently return empty -
a labeled, honest "Brain unreachable" is the concrete behavioral spec from D-03.

</specifics>

<deferred>
## Deferred Ideas

- Porting `rs-engine.py`/`rs_corpus.py` to CJS - belongs to Phase 283 (SEED-013), not
  this phase (D-04).
- SEED-057's synthesis-trigger expert (Phase 316) - a downstream consumer of a healthy
  RS pipeline, explicitly out of this phase's scope. Worth flagging to whoever plans 316
  next: SEED-057's own trigger conditions (Phase 222 shipped, SEED-034/SEED-058 shipped)
  are now ALL satisfied as of this session (2026-09-03) - it is unblocked and ready for
  its own discuss-phase pass, separate from this one.

### Reviewed Todos (not folded)
None checked this session - `cross_reference_todos` step skipped for this express pass.

</deferred>

---

*Phase: 296-SEED-030: RS Pipeline Spine-Wiring + Expert-Graph Reconciliation*
*Context gathered: 2026-09-03*
