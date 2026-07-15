# Phase 224: Graph-derivation harness (SEED-034) - Research

**Researched:** 2026-07-15
**Domain:** Local CJS graph-derivation wiring (room.db typed-edge layer, intelligence cascade, semantic scoring)
**Confidence:** HIGH (all findings verified against the current tree by file:line; zero external deps)

## Summary

This is NOT a greenfield phase. Phase 169 already shipped almost the entire graph-derivation
harness this SPEC describes: `lib/core/graph-derivation.cjs::runDerivation` (the proposed-node +
typed-edge composer with an idempotence guard), `lib/core/graph-backfill.cjs::runDeriveBackfill`
(the heal-first `/mos:graph --derive` backfill), the `/mos:graph --derive` command surface
(`commands/graph.md` lines 162-204), a Stop-sweep (`scripts/gsd-graph-derive-sweep.cjs`, wired at
`hooks/hooks.json:198`) that enqueues, and a SessionStart-drain
(`scripts/gsd-graph-derive-drain.cjs`, wired at `hooks/hooks.json:113`) that runs `runDerivation`.
The SPEC's Background did not surface this existing machinery.

So why does b2-journey still show 35 artifact nodes and 0 typed edges despite a wired sweep+drain?
Because the DEFAULT deriver, `graph-backfill.cjs::_localCueDeriveFn`, is a KEYWORD-REGEX scan
(`CUE_MAP` at lines 60-66: it only fires when artifact prose literally contains "contradict",
"converge", "invalidate", "enable", or "inform"). Normal room prose almost never contains those
exact cascade verbs, so the producer emits ZERO candidates and no edges land. The sweep/drain are
running; they have nothing to write. That is the real, mechanical root cause of the twice-reconfirmed
0-edge gap.

**Primary recommendation:** Do NOT rebuild the harness. Phase 224 is two surgical deltas on the
Phase 169 substrate: (1) supply a NEW score-based `deriveFn` (consuming
`rs-differential-scorer.cjs::scoreMeasured()`, mapping bands to CONVERGES + INFORMS only) that
replaces the keyword-cue producer as the derivation FUEL; and (2) add a per-write trigger by
enqueuing to the existing `graph-derive-queue.json` from inside `intelligence-cascade.cjs` and
spawning a DETACHED background worker to drain it, so derivation fires on every conversational write
instead of only on Stop/SessionStart. Requirements 3 (resolver-fallback), 5 (egress), and 7
(structural gates) are independent, small, and mechanical. Honor Part 7 reuse-before-build: this
phase is a producer swap plus a trigger, not a new engine.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Score-based derivation claims CONVERGES and INFORMS ONLY.** High-semantic band maps to
  CONVERGES; moderate band maps to INFORMS with direction older-artifact-INFORMS-newer.
  CONTRADICTS, INVALIDATES, REFINES, ROOT_CAUSES are EXCLUDED from score-only derivation (similarity
  is symmetric; a false CONTRADICTS is the noisiest possible navigator alert). Stance-requiring edge
  types are reserved for a future LLM-critiqued (fable-mode) pass. Precision over recall. Exact
  numeric thresholds are planner/executor territory - derive them against the b2-journey-shaped
  fixture, do NOT hardcode from intuition. The threshold layer is a NEW thin module consuming
  `scoreMeasured()` output; it does not modify the scorer.

- **D-02: The derivation step lives in `lib/core/intelligence-cascade.cjs`** as a new per-artifact
  step after the existing graph-index step - NOT a standalone post-write-only script (the cascade is
  shared by CLI hooks AND MCP tools; a post-write-only wiring would make MCP writes silently skip
  derivation = tri-polar violation). Debounce rides the existing minto-debouncer enqueue pattern; the
  derivation work is spawned BACKGROUNDED per the SPEC latency constraint (<300ms foreground target,
  3000ms hook ceiling) - never serialized on the write-lock.

- **D-03: `/mos:graph --derive`** - a new flag on the already-wired graph command, NOT an extension
  of `reanalyze`. No new connector tuple is minted (flag on an existing wired surface), but Req 7's
  structural gates still run post-implementation.

- **D-04: Skip + disclose.** When the embedding encoder is unavailable (`scoreMeasured()`'s semantic
  leg returns null), the derivation pass SKIPS entirely and writes a structural, test-pinned
  disclosure marker per SEED-059's convention (the quick-260715-cu8
  `framework_terms_low_confidence` precedent: mark at the point of occurrence, additive, non-blocking,
  checkable) - never a silent no-op. NO lexical-only degrade path. Soft-fail/advisory per the Phase
  210 caution - the skip never blocks the write or the hook.

### Claude's Discretion

- Exact threshold values and band boundaries for D-01's mapping layer (derive from fixture).
- The disclosure marker's exact field name/location for D-04 (follow the SEED-059 worked-example shape).
- Internal module naming and file placement for the new threshold/classification layer.
- How the backfill batches its O(n^2) pairwise scan (chunking, progress reporting).

### Deferred Ideas (OUT OF SCOPE)

- Sub-room sweep / parent rollup (SEED-034 pipe #2) - fast-follow phase. NOTE: `rollupSubRooms` and
  the heal-first sub-room path ALREADY exist in graph-derivation.cjs / graph-backfill.cjs; do not
  extend them here.
- Non-.md (.docx/.html) readability (SEED-034 pipe #3) - fast-follow phase.
- Stop/SessionEnd sweep as a second trigger mechanism (per-write debounced only was chosen). NOTE:
  a Stop-sweep + SessionStart-drain ALREADY exist from Phase 169 - see Open Question 2.
- LLM-critiqued (fable-mode) derivation pass for stance-requiring edge types - the natural next layer
  on top of D-01's score-only subset. The scaffolding (`graph-candidate-producer.cjs`,
  `runDerivation`'s `selfCritiqueFn`) already exists; leave it.
- SEED-013 Python-elimination coordination.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Req 1 | Automatic typed-edge derivation on debounced write | Insertion seam = `_runCascadeSteps` per-artifact loop (intelligence-cascade.cjs ~L330); enqueue + detached-spawn drain; new score-based `deriveFn` fed into existing `runDerivation` |
| Req 2 | Backfill entry point wires an existing room, idempotent | `graph-backfill.cjs::runDeriveBackfill` + `/mos:graph --derive` ALREADY EXIST; swap `deriveFn`. Idempotency is automatic (edges PRIMARY KEY(source,target,type) + runDerivation pre-propose guard GDH-07) |
| Req 3 | Residual resolver-fallback gap closed | `gsd-artifact-graph-hook.cjs::resolveRoomDir` (L92-120) duplicates registry read (L101-119); replace with `resolveWriteRoom({filePath}).abs_path` |
| Req 4 | Derived edges are proposals only (Part 9) | `runDerivation` mints a PROPOSED truth-claim NODE per edge (review_status on NODE); edge properties enum-only. See Open Question 1 re SPEC's "edge carries review_status" wording |
| Req 5 | Zero LOCAL-content egress to Brain (Part 8) | scoreMeasured, embedding-spine, navigation, graph-derivation are all LOCAL; grep-gated egress test per repo pattern |
| Req 6 | Cost-bounded comparison scope (O(n) per write) | New-artifact-vs-existing only; drive `runDerivation` with N artifactPairs = [{a:new, b:existing_i}]; exactly N scoreMeasured calls |
| Req 7 | Born-wired + structural gates if new connector surface | `--derive` flag on the wired graph command; run build-connector-registry --check, check-shape-declaration, doctor --acceptance |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- CJS only, no TypeScript. CLI routers parse `process.argv` switch-case (no Commander/yargs).
- NO em-dashes anywhere; hyphens only. Feynman-simplified, JTBD prose.
- Tri-Polar rule: every feature works on CLI + Desktop + Cowork with no surface-specific code
  (this is exactly why D-02 places the step in the shared cascade).
- Part 8: user data NEVER egresses to Brain; grep-gated egress test mandatory on new files.
- Part 9: room.db typed edges written ONLY through `navigation.cjs::writeEdge`; only a human
  confirms a truth-claim node.
- Part 7: reuse before build; justify any net-new surface. (Phase 169 gives you the harness.)
- Part 11 (CIRS): a new invocable surface is born WIRED or EXCLUDED with a HITL shape declaration.
- Part 6: dog-fooding; the plugin honors its own canon.
- Verification: `bash tests/run-all-224.sh`; `node scripts/doctor.cjs --acceptance`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-write derivation trigger | Shared core (`intelligence-cascade.cjs`) | CLI hook + MCP tool-router | Both surfaces call `runCascade`; one insertion covers all three surfaces (tri-polar) |
| Semantic pair scoring | Shared core (`rs-differential-scorer.cjs`) | embedding-spine (LOCAL encoder) | Consumed as-is; zero network |
| Threshold -> edge-type mapping | NEW thin module (Claude's discretion) | - | The only genuinely net-new logic in the phase |
| Typed-edge write + proposed status | `navigation.cjs::writeEdge` + `graph-derivation.cjs::runDerivation` | room.db (edges/nodes tables) | Part 9 chokepoint; idempotent upsert |
| Background execution | Detached worker (drain) | `graph-derive-queue.json` | Keeps foreground under 300ms |
| Backfill | `graph-backfill.cjs` + `/mos:graph --derive` | - | Already shipped; swap deriveFn |
| Room resolution | `resolve-active-room.cjs::resolveWriteRoom` | `room-root.cjs` | Phase-194 canonical resolver |

## Standard Stack

### Core (all already shipped in-repo; zero new deps)

| Module | Purpose | Why standard |
|--------|---------|--------------|
| `lib/core/rs-differential-scorer.cjs::scoreMeasured(a,b,opts)` | Pairwise LOCAL semantic+lexical scorer | The consume-as-is primitive (D-01); same one Phases 211/212/226 ride |
| `lib/core/graph-derivation.cjs::runDerivation` | Proposed-node + typed-edge composer, idempotent | The Part-7 reuse target; takes an injectable `deriveFn` |
| `lib/core/graph-backfill.cjs::runDeriveBackfill` | Heal-first `/mos:graph --derive` backfill | Req 2 is already built here; swap `deriveFn` |
| `lib/core/navigation/edges.cjs::writeEdge` | The Part-9 edge-write chokepoint | Frozen `ALLOWED_EDGE_TYPES`; idempotent upsert |
| `lib/core/intelligence-cascade.cjs::_runCascadeSteps` | Shared per-artifact cascade loop | D-02 insertion seam; shared by CLI + MCP |
| `lib/core/eureka/embedding-spine.cjs::embedTexts` | LOCAL encoder (semantic leg) | Degrades to `encoder_unavailable`, never throws |
| `lib/core/eureka/vector-store.cjs` | Persisted per-node vectors in room.db | Enables the cheap `opts.vectors` scoring path |
| `lib/core/resolve-active-room.cjs::resolveWriteRoom` | Canonical Phase-194 write-room resolver | Req 3 drop-in |
| `scripts/gsd-graph-derive-sweep.cjs::enqueueDerive` | Fast queue write to `graph-derive-queue.json` | The debounce enqueue Req 1 reuses |
| `scripts/async-artifact-auto-commit.cjs::spawnDetachedWorker` | `spawn(detached:true).unref()` precedent | The backgrounding pattern D-02 needs |

### Supporting

| Module | Purpose | When to use |
|--------|---------|-------------|
| `lib/core/migrations/phase-222-ranker-weights.cjs` | Idempotent migration template | ONLY if a new table is truly needed (it is not - see Open Question 3) |
| `lib/core/navigation/memory-events.cjs` (EVENT_TYPES) | Additive `*_skipped` telemetry enum | Home for the D-04 `derivation_skipped` disclosure marker |
| `tests/helpers/fixture-room-219.cjs` | Shared fixture-room builder | Base for the b2-journey fixture (Req 1/2/6) |
| `scripts/build-skill-mirrors.cjs` | Regenerate skill mirror after frontmatter change | If `graph.md` frontmatter changes (Req 7) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `runDerivation` (mints proposed NODE + edge) | Writing edges directly with `review_status` in properties | Direct write matches the SPEC's literal "edge carries review_status" wording BUT violates the Part-9 Pitfall-1 convention enforced across the repo (review_status on node, never edge). Reuse is canon-correct - Open Question 1 |
| Detached-spawn drain from the cascade | Rely on the existing Stop-sweep + SessionStart-drain | The existing sweep/drain already run and still leave 0 edges (weak deriveFn); per-write is more reliable and is what D-02 locks |
| New score-based `deriveFn` | Keep `_localCueDeriveFn` keyword regex | Keyword regex is the ROOT CAUSE of the 0-edge gap; it cannot produce edges from normal prose |

**Installation:** none. Zero new npm dependencies (constraint locked).

**Version verification:** N/A - no external packages. `scoreMeasured`, `writeEdge`, `runDerivation`,
`runDeriveBackfill`, and the sweep/drain are all present in the current tree (commit `cfa48e3f9`+).

## Package Legitimacy Audit

Not applicable. This phase installs ZERO external packages (constraint: "Zero new npm dependencies").
Every module consumed is already in-repo. No slopcheck/registry verification needed.

## Architecture Patterns

### System Architecture Diagram (the write path, after Phase 224)

```
  Write/Edit/MultiEdit tool fires
        |
        +-- CLI surface: hooks/run-hook.cmd -> scripts/post-write (bash)
        |        |
        |        +-- freshness triple (minto enqueue, ROOM.md recompile, stamp)  [existing]
        |        +-- CASCADE_OUTPUT=$(node bin/mindrian-tools.cjs cascade ...)    [FOREGROUND, L247]
        |                 -> runCascade -> _runCascadeSteps
        |
        +-- MCP / Desktop / Cowork surface: lib/mcp/tool-router.cjs:499
                 -> await runCascade({trigger:'mcp-tool', ...}) -> _runCascadeSteps

  _runCascadeSteps  (lib/core/intelligence-cascade.cjs, the ONE shared body)
    per-artifact loop (for art of artifacts):
      Step 1  classify-insight
      Step 2  graph-index (structural: Artifact node + BELONGS_TO)   [existing]
   >> Step 2b DERIVE-TYPED-EDGES (NEW):                              [Phase 224, Req 1]
   >>    a. resolve encoder availability (probe scoreMeasured/embedding-spine)
   >>    b. IF unavailable -> logMemoryEvent('derivation_skipped', reason)   [D-04]
   >>    c. ELSE -> enqueueDerive(roomDir)  (fast JSON write, foreground)     [debounce]
   >>          -> spawnDetachedWorker(drain)  (detached, unref, background)   [D-02 latency]
      Step 7  inject artifact id
      Step 7b git commit
    shared steps 3-11 (HSI, presentation, state, ...)               [existing]

  DETACHED DRAIN WORKER  (background, off the write-lock)
    reads graph-derive-queue.json -> for the new artifact:
      artifactPairs = [{a:new, b:existing_i} for each existing artifact]  (O(n), Req 6)
      runDerivation({ roomDir, deriveFn: SCORE_BASED, artifactPairs })
        deriveFn: scoreMeasured(aText, bText, {vectors:[vecA, vecB]})
          -> band -> {CONVERGES | INFORMS | (drop)}                  [D-01]
        -> proposed truth-claim NODE + navigation.writeEdge (idempotent upsert)
```

### Pattern 1: The score-based deriveFn (the phase's core new logic)

**What:** A function matching the `runDerivation` producer contract
`deriveFn({roomDir, artifactPair, llm}) -> [{source, target, edge_type, reason}]`, but powered by
`scoreMeasured` bands instead of keyword regex or an LLM.

**When to use:** Fed into `runDerivation` for both the per-write path (via the detached drain) and
the backfill (`runDeriveBackfill({deriveFn: SCORE_BASED})`).

```javascript
// Source: contract from lib/core/graph-derivation.cjs (deriveFn) +
//         lib/core/rs-differential-scorer.cjs::scoreMeasured
async function scoreBasedDeriveFn(step) {
  const pair = step && step.artifactPair;      // { a:{id,text,vector?}, b:{id,text,vector?} }
  if (!pair || !pair.a || !pair.b) return [];
  const opts = (pair.a.vector && pair.b.vector)
    ? { vectors: [pair.a.vector, pair.b.vector] }   // CHEAP: pure cosine, no embed spawn
    : {};                                           // falls back to embedding-spine (heavier)
  const s = await scoreMeasured(pair.a.text, pair.b.text, opts);
  if (!s || s.semantic === null) return [];          // encoder unavailable -> D-04 handled upstream
  // D-01 band mapping (thresholds derived against the b2-journey fixture, NOT hardcoded here):
  if (s.semantic > HIGH_BAND)  return [{ source: pair.a.id, target: pair.b.id, edge_type: 'CONVERGES', reason: 'high semantic similarity' }];
  if (s.semantic > MOD_BAND)   return [{ source: olderId(pair), target: newerId(pair), edge_type: 'INFORMS', reason: 'moderate semantic similarity' }];
  return [];                                          // stay silent (precision over recall)
}
```

Note: D-01 bands are over the SEMANTIC leg (topical similarity), not `abs_diff`. `abs_diff` is the
signed semantic-minus-lexical differential that `bandFor()` uses for breakthrough detection - a
DIFFERENT question. For "are these two artifacts about the same thing" (CONVERGES/INFORMS), the
`semantic` cosine is the right signal. Validate this against the fixture.

### Pattern 2: Backgrounding from a foreground process

**What:** The cascade runs foreground (post-write L247; tool-router awaits runCascade). Step 2b must
not run scoreMeasured inline. It enqueues (fast) then spawns a detached child that drains.

```javascript
// Source: scripts/async-artifact-auto-commit.cjs::spawnDetachedWorker
const { spawn } = require('node:child_process');
const proc = spawn(process.execPath, [drainScript, '--room', roomDir, '--file', filePath],
  { detached: true, stdio: 'ignore' });
proc.unref();   // parent does not wait; foreground returns immediately
```

### Anti-Patterns to Avoid

- **Rebuilding runDerivation / the backfill / the command.** They exist (Phase 169). Part 7 violation.
- **Running scoreMeasured inside the foreground cascade loop.** O(n) embeds on the write-lock blows
  the 300ms target. Always background it.
- **Putting `review_status` in edge properties.** The repo convention (graph-derivation.cjs L266-267,
  L113) is review_status on the NODE, never the edge. See Open Question 1 before deviating.
- **Emitting CONTRADICTS/INVALIDATES/REFINES/ROOT_CAUSES from the score path.** D-01 forbids it.
- **Re-embedding both texts on every pair.** Use `opts.vectors` with stored vectors when present.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compare two artifacts semantically | A new cosine/TF-IDF path | `scoreMeasured(a,b,opts)` | Part-8 audited, provenance-stamped, degradation-safe |
| Write a typed edge | Raw `INSERT INTO edges` | `navigation.writeEdge(db, params)` | Part-9 chokepoint; frozen vocab; idempotent upsert |
| Proposed-node + edge + idempotence | A new writer | `graph-derivation.runDerivation` | GDH-07 pre-propose guard already handles re-runs |
| Backfill an existing room | A new command | `graph-backfill.runDeriveBackfill` + `/mos:graph --derive` | Heal-first sequence + before/after delta already shipped |
| Background a worker | Ad-hoc `&` in JS | `spawn(detached:true).unref()` | The vetted non-blocking pattern |
| Debounce enqueue | A new queue | `gsd-graph-derive-sweep.enqueueDerive` / `graph-derive-queue.json` | Room-local, deduped, Part-8 clean |
| Room resolution fallback | Registry re-read | `resolveWriteRoom({filePath})` | The Phase-194 canonical resolver (Req 3 IS this) |

**Key insight:** Nearly every capability this phase needs is already a shipped, tested primitive.
The genuinely new code is: the threshold-to-edge-type mapping (a thin pure function), the Step-2b
enqueue/spawn wiring, the D-04 skip marker, and the Req-3 one-function swap.

## Runtime State Inventory

This is a wiring/refactor phase touching room.db; the inventory matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | room.db `edges` table (source,target,type,properties; PRIMARY KEY(source,target,type)); `nodes` (Artifact rows + proposed claim nodes); `eureka_vec`/`eureka_vec_fallback` per-node vectors (vector-store.cjs) | Code writes NEW proposed edges/nodes via the chokepoint. No migration of existing rows. Backfill is additive + idempotent |
| Live service config | `graph-derive-queue.json` under each room's `.mindrian/` (written by the Stop sweep today; Req 1 adds a per-write enqueue) | Reuse the existing queue file shape `{entries:[{roomDir,enqueued_at}]}` |
| OS-registered state | Stop-sweep + SessionStart-drain registered in `hooks/hooks.json` (L198, L113) | None required for Req 1 (per-write is a NEW trigger inside the cascade). Decide whether to leave the existing Stop/SessionStart triggers in place (recommend: leave, they are a harmless second net) |
| Secrets/env vars | None referenced by derivation. Encoder model id resolved inside embedding-spine; `EUREKA_DIFF_FLOOR`, `RS_SEMANTIC_FLOOR` are optional env tunables | None |
| Build artifacts | Skill mirror for `graph.md` (regenerated by `build-skill-mirrors.cjs`); connector registry (`build-connector-registry.cjs`) | Regenerate IF graph.md frontmatter changes (Req 7). A `--derive` body-only change may not touch frontmatter - verify |

**Canonical question answered:** After every file is updated, the runtime systems still carrying
state are (a) room.db edges/nodes/vectors - handled additively and idempotently; (b) the
`graph-derive-queue.json` per room - reused; (c) the hooks.json Stop/SessionStart registrations -
left intact. Nothing requires a destructive data migration.

## Common Pitfalls

### Pitfall 1: Assuming this is greenfield
**What goes wrong:** Building a second derivation engine, duplicating runDerivation/backfill/command.
**Why:** The SPEC Background verified the cascade only does structural indexing (true) but did not
enumerate the Phase-169 `graph-derivation.cjs` / `graph-backfill.cjs` / `/mos:graph --derive` /
sweep+drain machinery, which all exist.
**Avoid:** Read `lib/core/graph-derivation.cjs`, `lib/core/graph-backfill.cjs`, `commands/graph.md`
L162-204 FIRST. Plan as a producer swap + trigger, not an engine.
**Warning signs:** A plan that creates a new "derive" command or a new writeEdge caller.

### Pitfall 2: review_status semantics on the edge vs the node
**What goes wrong:** Putting `review_status: 'proposed'` in edge properties to satisfy Req 4's literal
wording, contradicting the enforced convention.
**Why:** The `edges` table has NO `review_status` column (schema:
`edges(source,target,type,properties)`, PRIMARY KEY(source,target,type)). The repo convention
(graph-derivation.cjs L113, L266-267) is: review_status lands on the NODE via `writeClaimNode`; the
edge carries enum/scalar properties ONLY.
**Avoid:** Reuse `runDerivation` so "proposed" lives on the claim node (canon-correct). Reinterpret
Req 4's acceptance accordingly. See Open Question 1.
**Warning signs:** A test asserting `json_extract(edge.properties,'$.review_status')='proposed'`.

### Pitfall 3: Foreground scoring blows the latency budget
**What goes wrong:** scoreMeasured runs inside the awaited cascade; N pairs x embedding cost lands on
the write-lock; hook approaches the 3000ms ceiling.
**Why:** The cascade is foreground (post-write L247, tool-router awaits). Encoder first-call loads a
model (seconds); even the cheap cosine path is O(n).
**Avoid:** Enqueue + detached-spawn (Pattern 2). Foreground cost = one JSON write + one unref'd spawn.
**Warning signs:** run-all-224 latency check failing; a synchronous `await scoreMeasured` in
`_runCascadeSteps`.

### Pitfall 4: The cheap-vector path is not guaranteed
**What goes wrong:** Assuming stored vectors always exist so `opts.vectors` is always cheap.
**Why:** The cascade's Step 2 is `lazygraph` STRUCTURAL indexing, NOT `tri-modal-index.indexNodes`
(which writes `eureka_vec`). A room may have Artifact nodes but no stored vectors, forcing
scoreMeasured to re-embed.
**Avoid:** In the deriveFn, use `opts.vectors` when a stored vector exists (SELECT embedding FROM
eureka_vec WHERE node_id=? then `vector-store.blobToVec`), else fall back to text embedding. Because
the work is backgrounded, the fallback cost is tolerable. Consider embedding the NEW artifact once
and reusing it across all N pairs.
**Warning signs:** N model loads per write; the Req-6 call-count test passing but wall-time high.

### Pitfall 5: False CONVERGES/INFORMS flooding the navigator
**What goes wrong:** Loose bands emit edges on weakly related pairs; the proposal surface loses trust.
**Why:** Semantic cosine on same-domain artifacts is high across the board.
**Avoid:** Derive bands from the b2-journey fixture (2 related -> >=1 edge; 2 unrelated -> 0). Bias
toward silence (D-01, "precision over recall").
**Warning signs:** The "2 unrelated artifacts -> zero edges" acceptance failing.

## Code Examples

### scoreMeasured contract (verified)
```javascript
// Source: lib/core/rs-differential-scorer.cjs L483-589
// scoreMeasured(a, b, opts) -> Promise<result>
//   a, b        : TEXT STRINGS (the artifact bodies)
//   opts.vectors: [vecA, vecB]  -> skips embedding entirely, pure cosineSimilarity (CHEAP)
//   opts.encodeFn / opts.lexicalFn / opts._forceUnavailable : test seams
// Happy-path output:
//   { semantic, lexical, signed_diff, abs_diff, direction, passes, band, provenance }
//   semantic in [0,1] cosine; band from bandFor(abs_diff): low|moderate|opportunity|high|breakthrough
// Encoder-unavailable output (D-04 trigger):
//   { semantic: null, lexical, signed_diff: null, abs_diff: null, direction: null,
//     passes: false, band: null, warning: 'encoder_unavailable', provenance:{...} }
// NEVER throws on encoder failure; the only throw is a Part-8 ExternalEgressViolation.
```

### writeEdge idempotency (verified - the Ralph invariant is automatic)
```javascript
// Source: lib/core/navigation/edges.cjs L694-725
// writeEdge(db, { source_id, target_id, edge_type, properties })
//   edge_type MUST be in ALLOWED_EDGE_TYPES (CONVERGES + INFORMS both present)
//   INSERT INTO edges (source,target,type,properties) VALUES (?,?,?,?)
//     ON CONFLICT(source,target,type) DO UPDATE SET properties = excluded.properties
//   -> re-running the backfill on an unchanged room does NOT grow the edge count.
//   Returns { ok:true, edge_id, ... } or { ok:false, reason }. Never throws on caller input.
```

### Req 3 fix (resolver-fallback drop-in)
```javascript
// scripts/gsd-artifact-graph-hook.cjs::resolveRoomDir (L92-120) does:
//   1. resolveRoomRoot(filePath)                      [keep - file-rooted first]
//   2. env vars CLAUDE_ROOM_DIR/... then registry.json direct read (L101-119)  [DUPLICATED -> remove]
// Replace legs 2 with the canonical resolver:
const { resolveWriteRoom } = require('.../lib/core/resolve-active-room.cjs');
function resolveRoomDir(filePath) {
  const r = resolveWriteRoom({ filePath });     // leg1 room-root + leg2 session.primary + leg3 reg.active
  return (r && fs.existsSync(r.abs_path)) ? r.abs_path : '';
}
// Signature note: resolveRoomDir(filePath)->string vs resolveWriteRoom({filePath})->{abs_path,...}.
// Adapt by extracting .abs_path. This SUBSUMES the current file-rooted leg AND replaces the
// duplicated registry read, and adds session awareness for free.
```

## State of the Art

| Old Approach (Phase 169) | Current target (Phase 224) | Why |
|--------------------------|----------------------------|-----|
| Keyword-regex `_localCueDeriveFn` | Score-based `deriveFn` via `scoreMeasured` | Regex produces zero edges on normal prose (the actual bug) |
| Derivation only on Stop-sweep + SessionStart-drain | Per-write trigger inside the shared cascade | Reliable, tri-polar, fires on every conversational write |
| LLM producer (`graph-candidate-producer.cjs`) | Deferred (fable-mode next layer) | Score-only for CONVERGES/INFORMS now; stance types later |

**Deprecated/outdated:** none removed. The keyword-cue deriveFn and LLM producer stay in the tree as
the backfill fallback and the future fable-mode fuel respectively; Phase 224 adds a third, default
producer.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-01 bands should be read over `scoreMeasured.semantic` (topical cosine), not `abs_diff` | Pattern 1 | Wrong signal -> derives on differential (structural-transfer) not topical similarity; fixture calibration would surface it |
| A2 | The disclosure marker (D-04) is best homed as a new `memory-events.cjs` EVENT_TYPES member (`derivation_skipped`) via logMemoryEvent | Pitfall / Sources | If the SEED-059 quick precedent used a different shape (a marker file), the field name/location differ; low risk (checkable either way) |
| A3 | No new room.db table is needed; debounce state rides `graph-derive-queue.json` | Open Question 3 | If a persistent watermark is required, add a phase-222-shaped migration |
| A4 | Leaving the Phase-169 Stop-sweep + SessionStart-drain registered is harmless alongside the new per-write trigger | Runtime Inventory | If double-derivation causes contention, gate one off (idempotent upsert makes duplicates safe) |
| A5 | Stored per-artifact vectors may be ABSENT (Step 2 does structural, not tri-modal, indexing) | Pitfall 4 | If assumed present, the cheap path silently falls back to re-embedding; backgrounding absorbs the cost |

## Open Questions (ALL RESOLVED — see resolution notes per item; do not re-litigate at execution)

> RESOLUTION SUMMARY (2026-07-15, post-plan-check): OQ-1 resolved by an explicit navigator ruling
> recorded as D-05 in 224-CONTEXT.md — review_status lands LITERALLY ON THE EDGES TABLE via a
> phase-222-pattern migration (ALTER TABLE edges ADD COLUMN review_status TEXT DEFAULT NULL;
> NULL = not-a-proposal; legacy rows never demoted or promoted). The recommendation below
> (node-status model) was considered and OVERRIDDEN at an AskUserQuestion gate — the same
> navigator-decides pattern as Phase 222's OQ-1. OQ-2 and OQ-3 resolved by 224-02-PLAN.md's
> must_haves: the Phase-169 Stop-sweep and SessionStart-drain stay registered and now ride the
> same score-based deriveFn.

1. **(RESOLVED — D-05 navigator ruling, edge column) review_status on the NODE vs the EDGE (the one design fork the plan must resolve).**
   - What we know: `edges` has no review_status column; the repo convention (graph-derivation.cjs)
     puts review_status on a proposed claim NODE, edge properties enum-only. The SPEC Req 1/4 says
     "writes each resulting edge ... with review_status: 'proposed'".
   - What's unclear: whether Req 4's acceptance test should assert the NODE's review_status (reuse
     runDerivation, canon-correct) or literally the edge properties (deviation from convention).
   - Recommendation: reuse `runDerivation` (proposed NODE per edge), and read Req 4's acceptance as
     "the proposed status lives on the derivation's truth-claim node; no confirm/promote fires
     without byUser". Flag this to discuss-phase if the SPEC author intended a literal edge field.

2. **The existing Phase-169 Stop-sweep + SessionStart-drain.** Deferred-ideas treats a Stop/SessionEnd
   sweep as not-yet-existing, but it IS wired (hooks.json L198/L113). Recommendation: leave it in
   place (a harmless second net, now fed by the same score-based deriveFn once the drain default is
   swapped), and scope Phase 224's NEW work to the per-write trigger. Confirm with the navigator that
   the intent is "add per-write", not "replace the sweep".

3. **Does the drain default deriveFn change globally?** If Phase 224 swaps
   `graph-backfill`'s and `runDerivation`'s effective default to the score-based producer, the
   existing Stop/SessionStart drain immediately benefits. Recommendation: make the score-based
   deriveFn the default the drain and backfill both inject, so all three triggers (per-write, sweep,
   backfill) share one producer.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node:sqlite` (DatabaseSync) | room.db reads/writes | Assumed (used repo-wide) | Node >=22.5 | Tier-0 no-op if absent (existing pattern) |
| LOCAL embedding encoder (`@huggingface/transformers` via embedding-spine) | scoreMeasured semantic leg | Runtime-dependent | model resolved in spine | D-04: skip + disclose (encoder_unavailable) |
| `python3` | NOT needed by scoreMeasured (measured path is pure CJS) | n/a | n/a | n/a - the legacy `score()` LSA leg is unused here |

**Missing dependencies with fallback:** encoder absence is the D-04 path (skip + disclosure marker),
already a first-class, tested branch of scoreMeasured.
**Missing with no fallback:** none block the phase.

## Validation Architecture

Nyquist validation is enabled. Test framework is bespoke Node CJS assert scripts aggregated by a
`bash tests/run-all-<phase>.sh` gate (no jest/mocha).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `assert` in standalone `tests/test-224-*.cjs` files |
| Config file | none - `tests/run-all-224.sh` is the aggregator (mirror `tests/run-all-222.sh`) |
| Quick run command | `node tests/test-224-<leg>.cjs` |
| Full suite command | `bash tests/run-all-224.sh` |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| Req 1 | 2 related -> >=1 proposed non-BELONGS_TO edge; 2 unrelated -> 0 | integration | `node tests/test-224-per-write-derive.cjs` | Wave 0 |
| Req 2 | b2-shaped fixture 0 -> N; second run idempotent | integration | `node tests/test-224-backfill-idempotent.cjs` | Wave 0 |
| Req 3 | no-sentinel fixture resolves == resolveWriteRoom; duplicated-registry grep empty | unit + grep | `node tests/test-224-resolver-fallback.cjs` | Wave 0 |
| Req 4 | every derived edge is proposed; no confirm without byUser | unit | `node tests/test-224-proposed-only.cjs` | Wave 0 |
| Req 5 | grep-gated egress sweep over new files returns nothing | grep | leg inside run-all-224.sh (mirror run-all-222 Part-8 sweep) | Wave 0 |
| Req 6 | N existing + 1 write -> exactly N scoreMeasured calls | unit (call-count spy) | `node tests/test-224-cost-bound.cjs` | Wave 0 |
| Req 7 | connector/shape/doctor gates pass | structural | `node scripts/build-connector-registry.cjs --check && node scripts/check-shape-declaration.cjs && node scripts/doctor.cjs --acceptance` | exists |
| D-04 | encoder-unavailable -> skip + disclosure marker present | unit | `node tests/test-224-encoder-skip.cjs` (use `_forceUnavailable`) | Wave 0 |

### Sampling Rate
- **Per task commit:** the single affected `node tests/test-224-<leg>.cjs`.
- **Per wave merge:** `bash tests/run-all-224.sh`.
- **Phase gate:** `bash tests/run-all-224.sh` PASS + `node scripts/doctor.cjs --acceptance`.

### Wave 0 Gaps
- [ ] `tests/run-all-224.sh` - aggregator (clone `tests/run-all-222.sh`, incl. Part-8/Part-9 sweeps)
- [ ] `tests/test-224-*.cjs` - the eight legs above
- [ ] b2-journey fixture builder - extend `tests/helpers/fixture-room-219.cjs` (room dir + `.room-root`
      + `.mindrian/room.db` with N Artifact nodes + BELONGS_TO, 0 typed edges). Precedents:
      `tests/run-all-169.sh` (derivation aggregate), `tests/test-222-degrade.cjs` (encoder-degrade),
      `tests/test-218-write-safety.cjs` (busy_timeout concurrency)
- [ ] Framework install: none

## Security Domain

`security_enforcement` is effectively the Canon Part 8/9 regime for this repo.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | scoreMeasured `auditQueryString` on both inputs (Part-8 Layer 1); writeEdge validates edge_type against frozen set |
| V6 Cryptography | no | no secrets/crypto beyond edge-id randomBytes (non-security) |
| V1 Data Egress (repo-specific, Part 8) | yes | grep-gated egress test on every new file (Req 5); no fetch/https/network child_process |
| V4 Access Control | partial | Part-9: edge writes only via `navigation.writeEdge`; only human confirms nodes (Req 4) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LOCAL artifact bytes egress to Brain | Information disclosure | scoreMeasured `auditQueryString`/`auditQueryObject` dual-layer; grep-gate on new files (Req 5) |
| Auto-confirming a truth claim | Elevation of privilege | Proposed-only writes; no confirm/promote without `byUser` (Req 4) |
| Background worker vs live-write contention on room.db | Denial of service | Phase 218 D-05 write-safety (busy_timeout 5000, synchronous NORMAL) already protects this; the detached drain inherits it |
| Hook failure blocking the user's write | Denial of service | Soft-fail everywhere; post-write `exit 0`; drain exits 0 on any path (Phase 210 caution) |

## Sources

### Primary (HIGH confidence - read this session, file:line)
- `lib/core/intelligence-cascade.cjs` - `_runCascadeSteps` per-artifact loop (Step 2 graph-index at
  L330-337), runCascade/queueCascade, foreground contract
- `lib/core/rs-differential-scorer.cjs` L483-616 - scoreMeasured signature, output shape, `opts.vectors`
  cheap path, encoder-unavailable envelope
- `lib/core/navigation/edges.cjs` L32-727 - ALLOWED_EDGE_TYPES (CONVERGES/INFORMS present), writeEdge
  idempotent upsert, PRIMARY KEY(source,target,type), no review_status column
- `lib/core/graph-derivation.cjs` (full) - runDerivation composer, proposed-node + edge, GDH-07
  idempotence, CASCADE_SUBSET, "review_status on NODE never edge"
- `lib/core/graph-backfill.cjs` (full) - runDeriveBackfill heal-first backfill, `_localCueDeriveFn`
  keyword regex (the 0-edge root cause), injectable deriveFn
- `commands/graph.md` L162-204 - the shipped `/mos:graph --derive` surface + connector frontmatter
- `scripts/post-write` L240-268 - foreground cascade invocation (L247), backgrounding precedents
- `scripts/gsd-artifact-graph-hook.cjs` L92-120 - resolveRoomDir duplicated registry read (Req 3)
- `lib/core/resolve-active-room.cjs` L201-243 - resolveWriteRoom precedence (Req 3 drop-in)
- `lib/mcp/tool-router.cjs` L497-499 - MCP surface calls runCascade (tri-polar confirmation)
- `scripts/gsd-graph-derive-sweep.cjs` / `gsd-graph-derive-drain.cjs` + `hooks/hooks.json` L113/L198 -
  existing queue + Stop-sweep/SessionStart-drain wiring
- `scripts/async-artifact-auto-commit.cjs` L370-390 - spawnDetachedWorker (backgrounding pattern)
- `lib/core/eureka/vector-store.cjs` / `tri-modal-index.cjs` - persisted per-node vectors (eureka_vec)
- `lib/core/migrations/phase-222-ranker-weights.cjs` - idempotent migration template
- `lib/core/navigation/memory-events.cjs` - EVENT_TYPES `*_skipped` enum (D-04 marker home)
- `224-SPEC.md`, `224-CONTEXT.md` - locked requirements + decisions

### Secondary (MEDIUM confidence)
- `tests/run-all-222.sh`, `tests/helpers/fixture-room-219.cjs`, `tests/run-all-169.sh` - test/fixture
  precedents (patterns confirmed; exact fixture reuse to be validated by the executor)

### Tertiary (LOW confidence - flagged)
- The exact SEED-059 `framework_terms_low_confidence` worked example lives in a room
  (quick-260715-cu8), not in this repo; only the CONVENTION was confirmed, not the byte-shape (A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - every module read file:line this session; zero external deps
- Architecture (insertion seam, foreground/background, tri-polar): HIGH - cascade + MCP call sites + hook
  foreground invocation all verified
- review_status convention conflict: HIGH on the facts (no edge column; node-status convention), the
  RESOLUTION is an Open Question for the planner/navigator
- Pitfalls: HIGH - each grounded in a verified file:line mechanism

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (stable internal codebase; re-verify if Phase 169 modules move)
