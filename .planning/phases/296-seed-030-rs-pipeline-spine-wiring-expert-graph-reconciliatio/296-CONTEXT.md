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

### REVISION — post-research correction (2026-09-03, per 296-RESEARCH.md)

Research (51 tool uses, live-executed cross-checks, full findings F-1 through F-10 in
296-RESEARCH.md) found that D-01 and D-03's factual premises below were **stale** — not
wrong in intent, wrong about what the current code actually does. Corrected here rather
than left to silently produce no-op tasks (the researcher's own explicit warning: "a plan
executing D-01/D-03 literally would target a module that writes nothing and remove a
coupling that does not exist"). Original D-01–D-04 kept below for audit trail; the
corrected decisions the planner must actually build against are these:

- **D-01 (CORRECTED):** `rs-engine.py`'s internal and cross-room modes already call ZERO
  Pinecone (F-3) — that acceptance criterion is already satisfied, twice over (also via
  Phase 272's `rs-engine.cjs`). The real, remaining Pinecone surface is narrower and
  different: `lib/core/rs_cache.py` (external/hybrid corpus cache, F-4), explicitly
  named in Phase 272's own `pinecone-inference.cjs` header as "descoped to a follow-up
  phase." **Phase 296 is that follow-up phase.** Retire `rs_cache.py`'s Pinecone
  index/namespace path; replace with a local embed-and-cache path through
  `embedding-spine.cjs::embedTexts` (the same local encoder everything else already
  uses — do not instantiate a second one). `rs_corpus.py` (the fetcher) is untouched —
  zero Pinecone calls already (F-4 item 2). Stays Python per original D-04 reasoning.
- **D-02 (CORRECTED, was open-discretion, now locked by F-2):** Do NOT read
  `eureka_vec`/`eureka_vec_fallback` via a direct Python `sqlite3 SELECT`. `sqlite-vec`
  is a hard `package.json` dependency on every real install — a direct read passes in
  this dev checkout (no sqlite-vec installed, fallback table active) and throws
  `OperationalError: no such module: vec0` for every actual user. Use a **CJS-side
  export/bridge step** instead (mirrors the existing `rs-pinecone-bridge.cjs` shape,
  which already shells `python3` from CJS in the opposite direction). This is not
  merely permitted by the old Discretion clause anymore — F-2 makes it required.
- **D-03 (CORRECTED — the premise was false, not just stale):** `rs-experts` has had NO
  remote Brain-Cypher coupling since 2026-05-22 (`2f0e4e79`, predates SEED-030's own
  2026-06-17 evidence date) — there is nothing to "keep remote." The seed's Option A
  vs. Option B framing does not apply; there is no live Tier-1 Aura path to choose
  between. The actual, plannable gap (F-7): the existing Tier-0 message conflates three
  distinct causes (no transport ships / transport unreachable / topic genuinely has
  zero experts) into one hand-rolled string — and cause (c) is a CORRECT answer being
  mis-dressed as a fault. Fix: route through the already-shipped
  `lib/core/refusal-messaging.cjs` (`REFUSAL_KINDS.unreachable` → `BRAIN_UNREACHABLE`),
  mirroring the in-family precedent `rs-explain-command.cjs` already uses (independent
  `_brain_degraded` / `_cypher_degraded` markers that never collapse into one string).
  **Theo cutover confirms both halves of this correction, not just permits it:** Theo
  has no Person/Author/Institution node type (17 declared labels, none of that shape) —
  keeping rs-experts LOCAL-only is *structurally required* by the eventual cutover, not
  a compromise. And Theo's own `CONN-05` "empty-versus-broken discipline" is the exact
  design precedent for the message fix — this repo's `refusal-messaging.cjs` already
  implements the CJS-side version of the same principle.
- **D-05 (NEW, from F-8):** `scripts/auto-explore-fire.cjs` spawns `rs-engine.py --mode
  hybrid` directly, bypassing `rs-backend-dispatch.cjs`. Hybrid is exactly the mode this
  phase touches — include it in the blast radius. Whether to also route it through the
  dispatch chokepoint is a navigator scope call, not optional to at least name.
- **D-06 (NEW, from Runtime State Inventory):** `PINECONE_API_KEY` and the `pinecone`
  package stay — still load-bearing for `compute-hsi.py` Tier 2 and
  `lib/core/pinecone-inference.cjs` (Phase 272, deliberately kept, out of scope here).
  Scope removal to `rs_cache.py`'s SDK calls only. No blanket key/package removal.
- **Discretion on exact degrade wording — REVOKED (F-7):** the old Discretion clause
  ("exact wording of the Brain unreachable message") is superseded. Use
  `refusal-messaging.cjs`'s shipped copy verbatim (`renderRefusal('unreachable', ...)` /
  `larryRefusalLine('unreachable')`). Inventing a seventh phrasing when six already
  exist in `REFUSAL_KINDS` is exactly the duplication Canon Part 7 forbids.
- **Phase 295 dependency — not a real blocker (F-10):** ROADMAP.md's "Depends on: Phase
  295" is `phase.add` heading boilerplate (a known pattern this repo's own CLAUDE.md
  names). The *coincidental* real dependency it might have named is already satisfied:
  SEED-029's technical shape shipped under Phase 211 + quick `260706-13z`, not under
  295 (which is an unplanned stub). Phase 296 does not wait on Phase 295. Whether to
  formally close/redirect the 295 stub is a separate navigator call, orthogonal to
  planning 296 now.

### Original decisions (kept for audit trail — see REVISION above for what to build)

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
