# Phase 224: Graph-derivation harness (SEED-034) - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

On every debounced write into a room section, the newly-written artifact is automatically compared
against the room's existing artifacts and qualifying typed edges are written as `proposed` via
`navigation.cjs::writeEdge` - closing the CRITICAL, twice-independently-reconfirmed gap where a
room's typed-edge graph stays at 0 no matter how much content gets filed. Plus a backfill entry
point for already-existing rooms and the one residual resolver-fallback gap in
`gsd-artifact-graph-hook.cjs`. Sub-room sweep and non-.md readability are OUT (fast-follow phase).

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `224-SPEC.md` for full requirements, boundaries, and acceptance
criteria.

Downstream agents MUST read `224-SPEC.md` before planning or implementing. Requirements are not
duplicated here.

**In scope (from SPEC.md):** automatic typed-edge derivation wired into the existing debounced
per-write pipe; a backfill entry point for already-existing rooms; closing the residual
resolver-fallback gap in `gsd-artifact-graph-hook.cjs`; proposed-only edge writes; zero Brain
egress from new code; cost-bounded new-artifact-vs-existing comparison scope.

**Out of scope (from SPEC.md):** sub-room sweep / parent rollup (SEED-034 pipe #2, deferred with
reasoning); non-.md (.docx/.html) readability (pipe #3, deferred, documented limitation);
Stop/SessionEnd sweep as a second trigger; any change to `rs-differential-scorer.cjs`'s own
scoring logic; Phase 223's intel-pipeline / bono write path.

</spec_lock>

<decisions>
## Implementation Decisions

All four decisions below were made at an explicit navigator AskUserQuestion gate 2026-07-15
(recommended option selected in each case, after in-session verification research).

### Edge-type mapping layer (Req 1)
- **D-01: Score-based derivation claims CONVERGES and INFORMS ONLY.** High-semantic band maps to
  CONVERGES; moderate band maps to INFORMS with direction older-artifact-INFORMS-newer.
  CONTRADICTS, INVALIDATES, REFINES, ROOT_CAUSES are EXCLUDED from score-only derivation:
  similarity is symmetric, so "X" and "not-X" artifacts look near-identical topically, and a false
  CONTRADICTS is the noisiest possible alert to a navigator (it drives the "you said X here and
  not-X there" surface). Stance-requiring edge types are reserved for a future LLM-critiqued
  derivation pass (SEED-034's fable-mode idea), not this phase. Precision over recall, always -
  these edges land as proposals a human ratifies, and a flood of wrong proposals kills trust in
  the whole surface.
- Exact numeric thresholds for the two bands are planner/executor territory - derive them against
  the b2-journey-shaped fixture, do not hardcode from intuition. The threshold layer is a NEW thin
  module consuming `scoreMeasured()` output; it does not modify the scorer.

### Derivation wiring point (Req 1, Req 6)
- **D-02: The derivation step lives in `lib/core/intelligence-cascade.cjs`** as a new per-artifact
  step after the existing graph-index step - NOT a standalone post-write-only script. The cascade
  module's own header states its purpose: CLI hooks and MCP tools share identical intelligence
  logic. A post-write-only wiring would make MCP-surface writes silently skip derivation
  (tri-polar violation). Debounce rides the existing minto-debouncer enqueue pattern; the
  derivation work is spawned BACKGROUNDED per the SPEC's latency constraint (<300ms foreground
  target, 3000ms hook ceiling) - never serialized on the write-lock.

### Backfill surface (Req 2, Req 7)
- **D-03: `/mos:graph --derive`** - a new flag on the already-wired graph command, NOT an
  extension of `reanalyze`. Graph derivation is semantically a graph operation; `reanalyze`'s
  shipped contract is meeting-scoped ("re-analyze filed meetings") and backfilling ALL artifacts
  would stretch it past its declared semantics. No new connector tuple is minted (flag on an
  existing wired surface), but Req 7's structural gates still run post-implementation.

### Encoder-unavailable behavior (Req 1, Req 5)
- **D-04: Skip + disclose.** When the embedding encoder is unavailable (`scoreMeasured()`'s
  semantic leg returns null), the derivation pass SKIPS entirely and writes a structural,
  test-pinned disclosure marker per SEED-059's convention (the quick-260715-cu8
  `framework_terms_low_confidence` precedent: mark at the point of occurrence, additive,
  non-blocking, checkable) - never a silent no-op. NO lexical-only degrade path: lsa-only scoring
  cannot honestly distinguish edge types, and the labeled lower-confidence path is Phase 226's
  design problem (its Grounding Guard chicken-and-egg finding), not this phase's. Soft-fail /
  advisory per the Phase 210 caution - the skip never blocks the write or the hook.

### Claude's Discretion
- Exact threshold values and band boundaries for D-01's mapping layer (derive from fixture).
- The disclosure marker's exact field name/location for D-04 (follow the SEED-059 worked-example
  shape).
- Internal module naming and file placement for the new threshold/classification layer.
- How the backfill batches its O(n^2) pairwise scan (chunking, progress reporting).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements and seed
- `.planning/phases/224-graph-derivation-harness-seed-034-make-room-db-s-typed-node-/224-SPEC.md` - Locked requirements - MUST read before planning
- `.planning/seeds/SEED-034-graph-derivation-harness.md` - The source seed: 4 broken pipes, proving cases, required capabilities. NOTE its "reuse existing derivers" framing is corrected by 224-SPEC.md's Background (cross-room-detect.cjs does not exist; the other three cited derivers are pipeline-specific)
- `.planning/GOAL-223-228-DEPENDENCY-SYNTHESIS-2026-07-15.md` - Cross-phase composition constraints (224 before 223; 225/226 independent)

### The write pipe this phase extends
- `scripts/post-write` - The PostToolUse hook; detect_room_section() resolves by .room-root sentinel only; existing backgrounding + debouncer patterns to imitate; latency contract in its own comments
- `lib/core/intelligence-cascade.cjs` - The shared cascade module where D-02 places the derivation step (per-artifact loop, graph-index step at ~line 330)
- `lib/core/graph-ops.cjs` + `lib/core/lazygraph-ops.cjs` - The existing STRUCTURAL indexing path (artifact node + BELONGS_TO) - what already works, and what this phase must not duplicate or break
- `scripts/minto-debouncer.cjs` - The debounce-enqueue pattern D-02 reuses

### Scoring and edge-writing machinery
- `lib/core/rs-differential-scorer.cjs` - `scoreMeasured(a, b, opts)`, the pairwise scorer this phase consumes AS-IS (differential_score / semantic_similarity / lsa_similarity; semantic leg null when encoder unavailable)
- `lib/core/eureka/embedding-spine.cjs` - The local encoder the scorer's semantic leg rides
- `lib/core/navigation.cjs` + `lib/core/navigation/edges.cjs` - writeEdge chokepoint + ALLOWED_EDGE_TYPES frozen vocabulary (Part 9 discipline)

### Resolver gap (Req 3)
- `scripts/gsd-artifact-graph-hook.cjs` - The fallback branch to fix (registry-read duplication when no .room-root sentinel exists)
- `lib/core/resolve-active-room.cjs` - resolveWriteRoom()/resolveSessionScope(), the Phase-194 canonical resolver the fallback must call
- `lib/core/room-root.cjs` - resolveRoomRoot(), the converged primary resolution function

### Precedents and conventions
- `lib/core/migrations/phase-222-ranker-weights.cjs` - The migration pattern to copy if new schema/state is needed (sentinel-idempotent, transaction-wrapped, table created empty)
- `.planning/seeds/SEED-059-fallback-disclosure-convention.md` - The disclosure convention D-04 follows; read the "Worked example: Site 4 closed" entry (quick 260715-cu8) as the live precedent
- `.planning/phases/210-revert-persona-enforcement-over-reach-selectively-undo-the-m/` - The over-enforcement caution: every new check/gate in this phase ships advisory/soft-fail, never a new hard-fail
- `.planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-CONTEXT.md` - The adjacent layer (sub-artifact entities); this phase must not overlap or contradict its writeEdge() usage; also its D-05 write-safety work (busy_timeout) protects the same concurrency scenario this phase's background derivation adds to

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rs-differential-scorer.cjs::scoreMeasured()`: the tested pairwise scoring primitive (same one
  Phases 211/212 ride) - consumed as-is, new thin threshold layer on top
- `minto-debouncer.cjs` enqueue CLI: the debounce pattern for per-write triggering
- `intelligence-cascade.cjs` per-artifact loop: the exact insertion point with error-enveloped
  step pattern (`{status:'ok'|'error'}` entries) to imitate
- `phase-222-ranker-weights.cjs`: migration precedent if schema is needed
- Phase 218's `openRoomDb` D-05 write-safety (busy_timeout 5000, synchronous NORMAL): already
  protects background-worker-vs-live-conversation contention on room.db

### Established Patterns
- Part 9 chokepoint: every edge write via `navigation.cjs::writeEdge`, ALLOWED_EDGE_TYPES only,
  `review_status: 'proposed'`, human-only confirmation
- Part 8: zero network calls in derivation code, grep-gated egress test per repo convention
- Backgrounding: post-write spawns `( node ... || true ) &` - soft-fail, never serialized on the
  write-lock
- SEED-059 disclosure: fallbacks marked structurally at point of occurrence, test-pinned

### Integration Points
- `intelligence-cascade.cjs` per-artifact loop (after graph-index step) - D-02's insertion point
- `commands/graph.md` (+ its skill mirror) - D-03's `--derive` flag lands here; run
  `scripts/build-skill-mirrors.cjs` if frontmatter changes
- `scripts/gsd-artifact-graph-hook.cjs` fallback branch - Req 3's single-function change
- `tests/run-all-224.sh` - new phase aggregate harness, mirror run-all-222.sh's shape

</code_context>

<specifics>
## Specific Ideas

- The b2-journey room shape (21 files, 35 artifact nodes, 0 typed edges) is THE acceptance
  fixture - the backfill proves 0 -> N on it, and idempotent re-run proves no growth on second
  pass (the Ralph invariant).
- False CONTRADICTS proposals are the failure mode the navigator explicitly designed against -
  when in doubt between claiming an edge and staying silent, stay silent. The graph earning trust
  slowly beats the graph shouting wrongly.

</specifics>

<deferred>
## Deferred Ideas

- Sub-room sweep / parent rollup (SEED-034 pipe #2) - fast-follow phase
- Non-.md (.docx/.html) readability (SEED-034 pipe #3) - fast-follow phase
- Stop/SessionEnd sweep as a second trigger mechanism - add only if per-write proves insufficient
- LLM-critiqued (fable-mode) derivation pass for stance-requiring edge types (CONTRADICTS,
  INVALIDATES, REFINES, ROOT_CAUSES) - the natural next layer on top of D-01's score-only subset
- SEED-013 Python-elimination coordination - only relevant if 228 is picked back up

### Reviewed Todos (not folded)
- "ignite persona card under-shows frozen role_blend vocabulary" - keyword match only; belongs
  with Phase 227's ignite scope, not graph derivation
- "Registry-drift gate - prevent silent command disappearance keyed to F-shape" - tooling concern,
  unrelated to this phase's scope
- "F7 rescope: re-plan Phases 212/213 against registerCapability" - already-shipped phases;
  planning hygiene item, not 224 scope

</deferred>

---

*Phase: 224-graph-derivation-harness-seed-034-make-room-db-s-typed-node-*
*Context gathered: 2026-07-15*
