# Phase 224: Graph-derivation harness (SEED-034) — Specification

**Created:** 2026-07-15
**Ambiguity score:** 0.18 (gate: ≤ 0.20 — CLEARED)
**Requirements:** 7 locked

## Goal

On every debounced write into a room section, the newly-written artifact is automatically compared
against the room's existing artifacts and any INFORMS/CONTRADICTS/CONVERGES/ENABLES/REFINES
relationship found is written as a `proposed` typed edge via `navigation.cjs::writeEdge` — closing
the CRITICAL, twice-independently-reconfirmed gap where a room's typed-edge graph stays at 0 no
matter how much content gets filed (b2-journey: 35 artifact nodes, 35 BELONGS_TO edges, every typed
edge 0; independently reconfirmed on a second, unrelated room 2026-07-14). A backfill entry point
retroactively wires already-existing rooms, proven against the b2-journey fixture (0 → N typed
edges). This phase does NOT attempt sub-room sweep or non-.md (.docx/.html) readability — those are
real, SEED-034-documented gaps but were not part of either independently-reconfirmed incident, and
move to a fast-follow phase (navigator-directed 2026-07-15).

## Background

Verified this session, file:line, against the current tree (commit `824d2cfd`+):

- `scripts/post-write`'s freshness triple (MINTO regen enqueue, ROOM.md recompile, timestamp stamp)
  never calls `navigation.cjs` — confirmed via direct grep, zero hits.
- `scripts/post-write` ALSO invokes `bin/mindrian-tools.cjs cascade` → `lib/core/intelligence-cascade.cjs`,
  which DOES run `lib/core/graph-ops.cjs::indexArtifact` (delegating to `lazygraph-ops.cjs`) on every
  markdown write automatically — but this is STRUCTURAL indexing only (artifact node + BELONGS_TO
  edge). It is not, and was never intended to be, typed-edge derivation. This is why the structural
  graph is always populated (35 artifact nodes, 35 BELONGS_TO) while the typed-edge layer stays at
  zero — the two are genuinely separate pipes, and only one of them is wired.
- SEED-034's own "reuse existing derivers, do not fork" framing does not hold up under inspection:
  `lib/core/cross-room-detect.cjs` (one of the four cited derivers) does not exist anywhere in this
  repo. The other three (`scripts/brain-derive-command.cjs`, `lib/core/findings-wirer.cjs`,
  `lib/core/proactive-intelligence.cjs`) are each scoped to a specific pipeline (BRAIN.md
  regeneration, Phase-131 bono-findings-to-edge wiring, cross-room relationship JSON tracking) — none
  is a generic "compare two artifacts, classify their relationship" tool. The closest genuinely
  reusable primitive is `lib/core/rs-differential-scorer.cjs::scoreMeasured(a, b, opts)` — the same
  pairwise scoring function Phases 211/212/226 already depend on (`differential_score`,
  `semantic_similarity`, `lsa_similarity`) — but it returns a score, not an edge type; this phase adds
  a new, thin threshold-to-edge-type classification layer on top of it, not a fork of eureka's engine.
- `lib/core/resolve-active-room.cjs::resolveWriteRoom()` (Phase 194, COMPLETE 2026-07-01) already
  converged the write-guard path onto `lib/core/room-root.cjs::resolveRoomRoot()`. SEED-034's "two
  resolvers" root cause is mostly closed — the ONE residual gap is
  `scripts/gsd-artifact-graph-hook.cjs`'s fallback branch (fires only when no `.room-root` sentinel
  exists), which still duplicates registry-read logic instead of calling `resolveWriteRoom()`.
- `lib/core/migrations/phase-222-ranker-weights.cjs` is the freshest clean migration precedent in
  this repo (idempotent via a sentinel row, BEGIN/COMMIT/ROLLBACK-wrapped, creates its table empty,
  defers all writes to a separate accessor module) — reuse this pattern for any new schema/state this
  phase needs.
- `lib/core/navigation/edges.cjs::ALLOWED_EDGE_TYPES` already carries the full frozen cascade
  vocabulary (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES, REFINES, ROOT_CAUSES,
  REJECTED_BECAUSE, SUPERSEDES) — no new edge type is needed.

## Requirements

1. **Automatic typed-edge derivation on debounced write.**
   - Current: no code path ever calls `navigation.cjs::writeEdge` for a typed cross-artifact
     relationship from a normal conversational write. Structural indexing (BELONGS_TO) already runs
     automatically; typed-edge derivation does not run at all.
   - Target: on each debounced `post-write` fire for a room-section markdown artifact, a new
     derivation step (a) resolves the room's other existing artifacts, (b) scores each pair via
     `rs-differential-scorer.cjs::scoreMeasured()`, (c) maps the resulting score profile to an
     `ALLOWED_EDGE_TYPES` member via a new threshold/classification layer, and (d) writes each
     resulting edge through `navigation.cjs::writeEdge` with `review_status: 'proposed'`.
   - Acceptance: a fixture room with 2 semantically related artifacts produces at least 1 non-
     BELONGS_TO typed edge in room.db after a debounced write, `review_status: 'proposed'`; a
     fixture with 2 clearly unrelated artifacts produces zero typed edges (no false-positive floor).

2. **Backfill entry point wires an already-existing room.**
   - Current: no command retroactively derives typed edges for a room whose files were written before
     this phase shipped — the b2-journey and david-innovation-studio rooms stay permanently unwired
     without one.
   - Target: a navigator-triggered backfill runs the same derivation logic (Requirement 1's scoring +
     classification) across ALL existing artifact pairs in a target room, not scoped to a single new
     write. The exact command surface (extend `/mos:graph` with a `--derive` flag, or extend
     `reanalyze`) is a discuss-phase decision — SEED-034 names both as viable, neither is locked here.
   - Acceptance: run against a fixture reproducing the b2-journey shape (21 files, 35 artifact nodes,
     0 typed edges pre-backfill), typed-edge count goes from 0 to N > 0; re-running the backfill on
     the same, unchanged room is idempotent — edge count does not grow on a second run (the Ralph
     invariant, SEED-034 Required-capability item 7).

3. **Residual resolver-fallback gap closed.**
   - Current: `scripts/gsd-artifact-graph-hook.cjs`'s fallback branch (fires only when no `.room-root`
     sentinel exists on the write path) duplicates registry-read logic instead of calling
     `resolveWriteRoom()`/`resolveSessionScope()` from `lib/core/resolve-active-room.cjs`.
   - Target: the fallback branch calls `resolveWriteRoom()` (or `resolveSessionScope()`) instead of
     its own duplicated registry-read logic, so every resolution path (sentinel-present and
     sentinel-absent) agrees with the Phase-194 canonical resolver.
   - Acceptance: a fixture with no `.room-root` sentinel present resolves to the same room
     `resolveWriteRoom()` independently returns; a grep for duplicated registry-read logic in the
     fallback branch, post-fix, returns nothing.

4. **Derived edges are proposals only — Canon Part 9.**
   - Current: N/A (no derivation exists yet to test against).
   - Target: every edge written by the new derivation pass (per-write and backfill) carries
     `review_status: 'proposed'`; no code path in this phase calls a confirm/promote function without
     an explicit `byUser` argument.
   - Acceptance: a fixture asserts every edge written by this phase's derivation code has
     `review_status: 'proposed'`; a fixture asserts `navigation.confirmNode` (or equivalent) is never
     called by this phase's own code without an explicit `byUser` argument.

5. **Zero LOCAL-content egress to Brain — Canon Part 8.**
   - Current: N/A structurally guarded elsewhere in this repo, but this phase adds new code paths
     (scoring, classification, backfill) that must not introduce a new egress surface.
   - Target: the derivation pass and backfill command make zero network/Brain calls; all comparison
     happens over LOCAL room.db content via `rs-differential-scorer.cjs`'s local scoring path.
   - Acceptance: a Part 8 egress test (grep-gated, per this repo's existing pattern) passes against
     every new file this phase adds; a grep for network-call primitives (`fetch`, `https.`,
     network-capable `child_process` invocations) in the new derivation module returns nothing.

6. **Cost-bounded comparison scope.**
   - Current: N/A, no derivation pass exists.
   - Target: the per-write debounced derivation pass compares ONLY the newly-written/changed artifact
     against the room's existing artifacts (O(n) scorer calls per write, not O(n²)); a full pairwise
     scan across all existing artifacts is reserved for the explicit, navigator-triggered backfill
     path (Requirement 2) only.
   - Acceptance: a fixture with N existing artifacts plus 1 new write triggers exactly N
     `scoreMeasured()` calls (not N² and not `N choose 2`), verified via a call-count assertion.

7. **Born-wired and structural gates, if a new connector surface is added.**
   - Current: N/A — no new command/connector surface exists yet.
   - Target: IF the backfill entry point ships as a new `/mos:graph --derive` surface rather than an
     extension of the already-wired `reanalyze` command, it passes this repo's structural gates.
   - Acceptance: `node scripts/build-connector-registry.cjs --check` and
     `node scripts/check-shape-declaration.cjs` both pass post-implementation;
     `node scripts/doctor.cjs --acceptance` passes.

## Boundaries

**In scope:**
- Automatic typed-edge derivation wired into the existing debounced per-write pipe (Requirement 1).
- A backfill entry point for already-existing, already-written rooms (Requirement 2).
- Closing the one residual resolver-fallback gap in `gsd-artifact-graph-hook.cjs` (Requirement 3).
- Proposed-only edge writes; zero auto-confirmation (Requirement 4).
- Zero Brain egress from any new code this phase adds (Requirement 5).
- Cost-bounded, new-artifact-vs-existing comparison scope for the per-write path (Requirement 6).

**Out of scope (navigator-directed 2026-07-15, fast-follow candidates):**
- Sub-room sweep / parent rollup (SEED-034 pipe #2) — real gap, but not part of either
  independently-reconfirmed incident (b2-journey, david-innovation-studio); deferred.
- Non-.md content readability, i.e. .docx/.html indexing (SEED-034 pipe #3) — same reasoning,
  deferred; the dense b2-journey content that's invisible to the graph stays invisible after this
  phase ships, tracked as a known, documented limitation, not silently dropped.
- A Stop/SessionEnd sweep as a second trigger mechanism (navigator chose per-write debounced only) —
  can be added later if the per-write path proves insufficient in practice.
- Any change to `rs-differential-scorer.cjs`'s own scoring logic — this phase is a consumer, not a
  modifier, of that scorer.
- Phase 223's intel-pipeline / bono write path — this phase populates the substrate 223 reads; it
  does not touch 223's own code.

## Constraints

- The derivation pass reuses `rs-differential-scorer.cjs::scoreMeasured()` as-is; the new
  classification/threshold layer is additive, not a fork of the eureka engine (navigator-directed
  2026-07-15).
- Frozen edge vocabulary: only `lib/core/navigation/edges.cjs::ALLOWED_EDGE_TYPES` members may be
  written; no new edge type is introduced by this phase.
- Every write routes through `navigation.cjs::writeEdge` — no direct SQL write to room.db's edge
  table from this phase's new code (Part 9 chokepoint discipline).
- Migration/state pattern (if any new schema is needed) follows `lib/core/migrations/phase-222-ranker-weights.cjs`'s
  precedent: idempotent via a sentinel row, transaction-wrapped, table created empty.
- Zero new npm dependencies — `rs-differential-scorer.cjs` and `navigation.cjs` are both already
  shipped and require nothing new.
- Per-write derivation must stay within `scripts/post-write`'s existing latency contract (target
  <300ms user-visible foreground; hard ceiling 3000ms hook timeout) — the new derivation step should
  be spawned backgrounded the same way the existing recompile/stamp steps already are, not serialized
  on the write-lock.

## Acceptance Criteria

- [ ] A fixture room with 2 related artifacts produces ≥1 proposed, non-BELONGS_TO typed edge after
      a debounced write; a fixture with 2 unrelated artifacts produces zero (Req 1)
- [ ] Backfill run against a b2-journey-shaped fixture moves typed-edge count 0 → N > 0; a second
      backfill run on the same unchanged room is idempotent (Req 2)
- [ ] A no-`.room-root`-sentinel fixture resolves to the same room as `resolveWriteRoom()`; the
      fallback branch's duplicated registry-read logic is gone (Req 3)
- [ ] Every edge this phase's code writes carries `review_status: 'proposed'`; no confirm/promote
      call fires without an explicit `byUser` argument (Req 4)
- [ ] Part 8 egress test passes on every new file; no network-call primitive appears in the
      derivation module (Req 5)
- [ ] A fixture with N existing artifacts + 1 new write triggers exactly N `scoreMeasured()` calls
      (Req 6)
- [ ] `build-connector-registry.cjs --check`, `check-shape-declaration.cjs`, and
      `doctor.cjs --acceptance` all pass (Req 7, conditional on new connector surface)
- [ ] `bash tests/run-all-224.sh` exits PASS with 0 FAIL, 0 SKIP
- [ ] No emoji, no em-dashes, 12-glyph vocabulary, 3-line errors, `voice-dna.md` honored

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|---------------------|-------|------|--------|---------------------------------------------------------------|
| Goal Clarity        | 0.88  | 0.75 | OK     | Specific mechanism (scoreMeasured + classification layer), specific trigger (debounced per-write), specific fixture (b2-journey 0→N) |
| Boundary Clarity    | 0.85  | 0.70 | OK     | Explicit in/out-of-scope; sub-room sweep and non-.md readability explicitly deferred with reasoning |
| Constraint Clarity  | 0.75  | 0.65 | OK     | Reuse-not-fork, frozen edge vocab, chokepoint discipline, migration precedent, and a latency contract all pinned |
| Acceptance Criteria | 0.75  | 0.70 | OK     | 7 requirement-level + 2 phase-level pass/fail checks, each falsifiable |
| **Ambiguity**       | 0.18  | ≤0.20| CLEARED | All four dimensions cleared their minimums; no forced-clean flag needed |

Status: OK = met minimum.

## Interview Log

Conducted as a live Socratic interview (2 rounds, AskUserQuestion), grounded in this session's own
prior fan-out dependency research on Phases 210-222 plus fresh codebase scouting done at the start
of this spec-phase pass (confirming the exact post-write → intelligence-cascade → graph-ops.cjs
mechanism, and that `cross-room-detect.cjs` does not exist).

| Round | Perspective              | Question / check                                                                 | Decision locked |
|-------|---------------------------|-------------------------------------------------------------------------------------|-----------------|
| 1     | Boundary Keeper           | Which of SEED-034's 4 broken pipes does this phase actually close?                 | Core fix only — typed-edge derivation (pipe #4) + the residual resolver-fallback gap (last sliver of pipe #1) + a backfill command. Sub-room sweep (pipe #2) and non-.md readability (pipe #3) deferred to a fast-follow. |
| 1     | Researcher (SEED's own open question) | Per-write debounced vs Stop/SessionEnd sweep vs both, as the trigger mechanism?        | Per-write, debounced — reuses the existing MINTO-regen debouncer pattern already in `scripts/post-write`. |
| 2     | Failure Analyst           | SEED-034's "reuse existing derivers" claim doesn't hold (`cross-room-detect.cjs` doesn't exist; the other three are pipeline-specific) — what should the new derivation logic build on? | `rs-differential-scorer.cjs::scoreMeasured()` + a new thin threshold-to-edge-type classification layer, keeping this phase aligned with the eureka engine's shared machinery instead of inventing a second scoring system. |
| 2     | Failure Analyst           | O(n²) cost risk — how should the debounced pass scope its comparisons?             | New artifact vs. existing artifacts only (O(n) per write); a full pairwise scan is reserved for the explicit backfill path. |

---

*Phase: 224-graph-derivation-harness-seed-034-make-room-db-s-typed-node-*
*Spec created: 2026-07-15*
*Next step: /gsd-discuss-phase 224 — implementation decisions (exact classification thresholds for
scoreMeasured() output, the backfill command's exact surface — /mos:graph --derive vs extending
reanalyze, and where the derivation step spawns in scripts/post-write's existing backgrounding
pattern)*
