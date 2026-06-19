---
kind: research
phase: 169
slug: graph-derivation-harness
milestone: v1.14.0
created: 2026-06-19
canon_parts: [3, 4, 6, 8, 9]
confidence: HIGH
domain: "Local-graph self-wiring (room.db) -- runChain-driven typed-edge derivation, sub-room rollup, non-.md reach, debounced sweep"
---

# Phase 169: Graph Derivation Harness -- Research

**Researched:** 2026-06-19
**Domain:** Composition over already-shipped substrate (runChain 166, fable-mode seam 167, reconciled frozen edge set 168) to make the typed-edge moat self-wiring across rooms AND sub-rooms.
**Confidence:** HIGH (every anchor verified against current main; the .docx extractor PROVEN against the real b2-journey fixture)

## Summary

This phase is overwhelmingly COMPOSITION, exactly as scoped. Every substrate the SPEC and CONTEXT name was verified present and accurate on current main: `runChain` (chain-executor.cjs) ships the full six-callback contract including the `selfCritiqueFn` fable-mode seam; `navigation.cjs` re-exports `writeEdge` (the Part 9 chokepoint); the frozen `ALLOWED_EDGE_TYPES` set in `edges.cjs` now CONTAINS all seven phase-target edges (CONVERGES / INVALIDATES / ENABLES post-168, plus INFORMS / CONTRADICTS / REFINES / ROOT_CAUSES); the four shipped derivers exist; `lazygraph-ops.cjs` indexArtifact / rebuildGraph / .md-only filter are where the SPEC says (with minor line drift, corrected below).

The three `open_for_planner` items now have decisive recommendations grounded in tool-verified facts:
1. **The .docx extractor is pure-JS with Node built-ins ONLY** -- proven by extracting 216 Hebrew text runs from the real b2-journey dossier via `zlib.inflateRawSync` + a 40-line ZIP central-directory walk. No new dependency. cheerio (already a dep) handles .html.
2. **The parent rollup is a read-side aggregation across per-sub-room room.db files**, not a materialized table -- node:sqlite v22 supports `ATTACH DATABASE` (verified), so a read-only parent walk can UNION sub-room graphs without merging dbs, preserving Part 8 isolation.
3. **The sweep is a NEW Stop hook**, not an extension of the existing PostToolUse `gsd-artifact-graph-hook.cjs` (which fires per-write on the structural index path and must stay cheap).

**One load-bearing architectural finding the planner MUST resolve (see Open Questions Q1):** `review_status` is a column on the **nodes** table, NOT the **edges** table. The edges table is `(source, target, type, properties)` with `PRIMARY KEY(source, target, type)`. GDH-05's "each derived edge landing review_status: proposed" therefore cannot be a column write on the edge. The correct shipped pattern (findings-wirer.cjs) is: write a PROPOSED truth-claim/evidence NODE, then a typed EDGE from it; the node carries review_status='proposed', the edge carries enum scalars in `properties`. Plan against the node-proposed pattern, not an edge-status column.

**Primary recommendation:** Build a thin `lib/core/graph-derivation.cjs` composer that (a) unifies room resolution on a NEW `.room-root` sentinel walk-up shared by the hook and the rebuild path, (b) extends `lazygraph-ops` rebuild to recurse into sub-rooms and to read .docx/.html via a new pure-JS `lib/core/doc-text-extractor.cjs`, (c) wires the four existing derivers as `runChain` steps with the fable-mode `selfCritiqueFn` gating each proposed edge, writing through `navigation.writeEdge` with a proposed NODE per Part 9, and (d) exposes `/mos:graph --derive` as the backfill entry. Net-new code is small; the moat is the composition.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-169-01 .. D-169-05 -- navigator-LOCKED, do NOT re-litigate)

- **D-169-01 trigger = debounced Stop/SessionEnd sweep + explicit backfill.** Derivation fires as a DEBOUNCED sweep at Stop/SessionEnd (NOT per-keystroke) plus an explicit `/mos:graph --derive` backfill. Per-write-debounced derivation is DEFERRED. The structural index (indexArtifact) MAY still run per-write; the expensive TYPED derivation is the swept/backfilled part.
- **D-169-02 per-sub-room db keyed by .room-root + parent rollup.** Each room (incl. sub-rooms) owns its `.mindrian/room.db` keyed by its own `.room-root`; the parent gets a ROLLUP view aggregating sub-room graphs (read-side aggregation, not a merged db). Preserves Part 8 room-boundary isolation; parent still sees everything.
- **D-169-03 non-destructive .docx/.html reader/extractor.** Add a `.docx`/`.html` TEXT EXTRACTOR the indexer + derivation read from; the SOURCE FILE IS UNTOUCHED. No sidecar .md generated. Pure-JS extraction (no new heavy deps where avoidable).
- **D-169-04 reuse the existing derivers, wired into runChain.** Wire the SHIPPED derivers (brain-derive-command.cjs, findings-wirer.cjs, proactive-intelligence.cjs, cross-room-detect.cjs) into the runChain loop. Do NOT fork derivation logic.
- **D-169-05 GDH-01 resolver unify + canon guards.** Auto-graph hook resolves by `.room-root` (walk up to nearest sentinel), NOT registry active room. Unify with the rebuild tool. Part 9: all writes via navigation.cjs; derived edges land review_status: proposed; human confirms at a Decision Gate; "why-not" captured. Part 8: LOCAL only, Brain generic read-only, zero egress, boundary scan over any Brain-touching deriver. Edges only from the frozen set. fable-mode self-critiques each derived edge before it lands. Idempotent re-run. NO em-dashes.

### Claude's Discretion (the three open_for_planner items -- resolved below)
- The .docx extractor: pure-JS unzip+document.xml text pull vs a vetted lightweight dep (prefer built-ins).
- The parent rollup shape: read-side UNION view vs a materialized rollup table.
- Whether the Stop/SessionEnd sweep is a new hook or extends the existing graph hook.

### Deferred Ideas (OUT OF SCOPE -- ignore completely)
- Per-write debounced derivation (cost; sweep+backfill ships first).
- Cross-room typed edges (Part-8-gated, Phase 83 territory).
- The lazygraph two-vocabulary unification (SEED-034 note; HSI_CONNECTION / REVERSE_SALIENT / RESOLVES_VIA etc. in the legacy EDGE_TYPES array).
- Sidecar-.md conversion for .docx (rejected in favor of the non-destructive reader, D-169-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GDH-01 | One resolver: auto-graph hook resolves by file `.room-root` (walk to nearest sentinel), NOT registry active room; unify with rebuild tool | VERIFIED both `gsd-artifact-graph-hook.cjs::resolveRoomDir` AND `dashboard-helpers.cjs::detectActiveRoom` resolve by registry active room; NO `.room-root` walk-up resolver exists in lib/core today (must be built). The "rebuild tool" (`migrate-lazygraph.cjs`) resolves by explicit `process.argv` path, not `.room-root`. See Anchor 1 + Open Question Q4. |
| GDH-02 | Derivation in the loop: auto-graph pipe runs a typed-edge DERIVATION pass, not just structural indexArtifact | The structural index already runs per-write (gsd-artifact-graph-hook.cjs -> reconcile). The TYPED derivation rides D-169-01's Stop sweep, separate from the per-write index. See Pattern 3 + Recommendation 3. |
| GDH-03 | Sub-room rollup: rebuild + hook sweep sub-room artifacts (per-sub-room db + parent rollup; correct .room-root) | `rebuildGraph` (lazygraph-ops.cjs:462) walks SECTIONS-only with NO sub-room recursion. node:sqlite ATTACH verified available for read-side rollup. See Recommendation 2. |
| GDH-04 | Non-.md reach: .docx/.html content reachable to indexer + derivation (reader/extractor, non-destructive) | PROVEN pure-JS extraction against the real b2-journey .docx (216 text runs, Hebrew). cheerio (existing dep) for .html. See Recommendation 1 + Code Example 1. |
| GDH-05 | Typed-edge derivation: runChain pass derives + writes the 5 cascade edges (+REFINES/ROOT_CAUSES) via navigation.writeEdge, fable-mode-critiqued, each landing review_status: proposed | runChain six-callback contract + selfCritiqueFn seam VERIFIED. writeEdge VERIFIED. Frozen set CONTAINS all 7. CRITICAL: review_status is a NODE column, not an EDGE column -- plan the proposed-NODE pattern (findings-wirer.cjs precedent). See Open Question Q1. |
| GDH-06 | Backfill: `/mos:graph --derive` (or extend /mos:reanalyze) wires an EXISTING room incl. sub-rooms in one pass | `/mos:graph` is the right host (already graph-scoped, already invokes lazygraph-ops). `/mos:reanalyze` is meetings-scoped. See Recommendation 6. |
| GDH-07 | Idempotent: re-running is a no-op (proposed edges not re-proposed; confirmed untouched) | edges table `PRIMARY KEY(source, target, type)` + `ON CONFLICT DO UPDATE` makes edge writes idempotent by identity. Node-level dedupe needs the source-hash + a confirmed-status guard. See Recommendation 7 + Pitfall 3. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Room resolution (.room-root walk-up) | Plugin / lib-core | Hook (CLI) | One shared resolver consumed by the per-write hook AND the rebuild/sweep path (GDH-01 unify). |
| Structural index (indexArtifact) | Plugin / lib-core (lazygraph-ops) | Hook (PostToolUse) | Already per-write; cheap; unchanged by this phase except .docx/.html reach. |
| Typed-edge derivation (runChain) | Plugin / lib-core (new composer) | Hook (Stop sweep) + Command (/mos:graph --derive) | Expensive; debounced sweep + explicit backfill only (D-169-01). |
| .docx/.html text extraction | Plugin / lib-core (new doc-text-extractor) | -- | Pure-JS, LOCAL file read only; never mutates source (D-169-03). |
| Edge write (chokepoint) | Plugin / lib-core (navigation.writeEdge) | -- | Part 9: SQL is the local mind; the single door. |
| Sub-room rollup (read-side) | Plugin / lib-core | -- | ATTACH-based read across per-sub-room dbs; never a merged db (Part 8 isolation). |
| Brain methodology read (derivers) | Brain (remote, read-only) | -- | Part 8: generic methodology only; boundary scan over any Brain-touching deriver (brain-derive-command.cjs is the one). |

## Standard Stack

### Core (all already in-repo -- ZERO new dependencies)

| Module | Role | Why Standard |
|--------|------|--------------|
| `lib/core/chain-executor.cjs` | `runChain` six-callback loop + fable-mode `selfCritiqueFn` seam | The shipped Phase 166/167 spine; the derivation loop IS a runChain caller. |
| `lib/core/navigation.cjs` | `writeEdge` chokepoint + `confirmNode` + `getNeighborhood` + `promoteNodeStatus` | Part 9 single door; derived edges land here. |
| `lib/core/navigation/edges.cjs` | Frozen `ALLOWED_EDGE_TYPES` (writeEdge gate) | Complete post-168; all 7 phase edges present. |
| `lib/core/lazygraph-ops.cjs` | `indexArtifact` / `rebuildGraph` / `openGraph` / `queryGraph` / `upsertEdge` | The structural index + rebuild to extend for sub-rooms + non-.md. |
| `lib/core/room-db.cjs` | `openRoomDb` / `closeRoomDb` (the migration-composed room.db opener) | The Part 9 nodes-provenance + bitemporal db; same `room.db` file as lazygraph. |
| `lib/core/findings-wirer.cjs` | `wireAccept` / `wireReject` / `wireDefer` -- proposed-node + typed-edge writer | The cleanest deriver-to-graph reuse; already lands proposed via navigation.cjs. |
| `node:zlib` (`inflateRawSync`) | DEFLATE decompression of docx zip entries | Built-in; proven against the real fixture. |
| `node:sqlite` (`DatabaseSync`, `ATTACH DATABASE`) | room.db + read-side sub-room rollup | Built-in (node v22.22.2); ATTACH verified working. |
| `cheerio` (already a dependency, v1.2.0) | .html text extraction (and optionally docx XML tag-strip) | Pure JS, no native bindings; already vendored. |

### Supporting (new files this phase adds -- thin)

| File (new) | Purpose | When to Use |
|------------|---------|-------------|
| `lib/core/room-root.cjs` | The ONE `.room-root` sentinel walk-up resolver (GDH-01 unify) | Consumed by the hook + the rebuild/sweep + the backfill command. |
| `lib/core/doc-text-extractor.cjs` | Pure-JS `.docx`/`.html` -> plain text (GDH-04) | Called by indexArtifact / the derivation when a file is non-.md. |
| `lib/core/graph-derivation.cjs` | The runChain composer wiring the 4 derivers + writing proposed edges (GDH-05) | The sweep hook + the backfill command both call this one composer. |
| `scripts/gsd-graph-derive-sweep.cjs` | The NEW debounced Stop hook (GDH-02 trigger) | Stop event; debounced; calls graph-derivation.cjs. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure-JS docx unzip (built-ins) | `mammoth` / `docx` / `adm-zip` npm deps | REJECTED. CLAUDE.md no-new-heavy-deps posture + vendored-node_modules pure-JS rule. The built-in path is proven (Code Example 1). A dep adds transitive surface and a slopcheck gate for zero benefit. |
| Read-side ATTACH rollup | Materialized parent rollup table | REJECTED for v169. A materialized table is a second source of truth that drifts from sub-room dbs and risks Part 8 boundary blur (parent db holding sub-room user bytes). Read-side ATTACH keeps each sub-room db authoritative. |
| New Stop hook | Extend `gsd-artifact-graph-hook.cjs` (PostToolUse) | REJECTED. That hook is the per-write STRUCTURAL index (must stay cheap, fires on every Write/Edit). The expensive TYPED derivation belongs on Stop (D-169-01), a different event with different cost profile. |
| Host backfill on `/mos:graph` | Extend `/mos:reanalyze` | `/mos:reanalyze` is meetings-intelligence-scoped (compute-meetings-intelligence). `/mos:graph` is already graph-scoped and already opens lazygraph-ops. `--derive` is a natural verb there. |

**Installation:** None. Zero new packages. All built-ins + existing `cheerio`.

**Version verification:** `node --version` -> v22.22.2 (node:sqlite + node:zlib + ATTACH all verified present this session). `cheerio` -> v1.2.0 already in package.json/vendored (CLAUDE.md stack table).

## Package Legitimacy Audit

> No external packages are installed by this phase. Every module is a Node built-in or an already-vendored dependency.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `node:zlib` | (built-in) | n/a | n/a | nodejs/node | n/a | Approved (built-in) |
| `node:sqlite` | (built-in) | n/a | n/a | nodejs/node | n/a | Approved (built-in, experimental flag emits a warning -- already accepted repo-wide) |
| `cheerio` | npm | 19,873 dependents | high | github.com/cheeriojs/cheerio | n/a | Approved (ALREADY a dependency, v1.2.0; not newly added) |

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs).
**Packages flagged as suspicious [SUS]:** none.

## Anchor Verification (SECONDARY -- the SPEC's file:line anchors against current main)

> The SPEC was scoped 2026-06-19. Anchors verified this session. Where drift occurred it is minor and reported with the corrected location.

### Anchor 1 -- GDH-01 resolver (`gsd-artifact-graph-hook.cjs`)

**SPEC said:** `:77-95` resolves by REGISTRY ACTIVE room.
**Current truth:** the room-resolution block is `resolveRoomDir()` at **lines 80-100** (the function comment opens at :77). It prefers explicit env room, then FALLS BACK to the MindrianRooms `.rooms/registry.json` ACTIVE room. Verbatim current lines 87-96:

```javascript
  try {
    const roomsRoot = process.env.MINDRIAN_ROOMS_ROOT ||
                      process.env.MINDRIAN_ROOMS_HOME ||
                      path.join(os.homedir(), 'MindrianRooms');
    const regPath = path.join(roomsRoot, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return '';
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!reg || !reg.active || !reg.rooms || !reg.rooms[reg.active]) return '';
    const rd = path.resolve(roomsRoot, reg.rooms[reg.active].path || reg.active);
    return fs.existsSync(rd) ? rd : '';
```

**Diagnosis CONFIRMED, with a refinement:** the root cause is real -- this resolves the ACTIVE room, so a sub-room write while the parent is active lands in the parent db. The fix (D-169-05) is to resolve by the WRITTEN FILE's `.room-root` (walk up from `filePath` to the nearest `.room-root`/`.mindrian` sentinel). NOTE: the hook ALSO ignores the file path entirely for room resolution today (it gates the path via `isPlanningMarkdown` but resolves the room from env/registry, never from the file's location). The unify must thread `filePath` into the resolver.

A second registry-active-room resolver exists at `lib/core/navigation/dashboard-helpers.cjs::detectActiveRoom` (lines 49-73) and is re-exported as `navigation.detectActiveRoom`. The GDH-01 "ONE resolver" unify should make BOTH the hook and the rebuild/sweep path consume the new `.room-root` resolver; `detectActiveRoom` stays for genuine "what is the active room" callers (dashboard) but the WRITE-INDEX path must switch to file-rooted resolution.

### Anchor 2 -- `lazygraph-ops.cjs` indexArtifact / rebuild / .md-only

**SPEC said:** indexArtifact ~:420, rebuild walks sections-only ~:457, .md-only :488.
**Current truth (all verified, minor drift):**
- `async function indexArtifact(conn, roomDir, filePath)` at **line 420** (exact match). It is a thin BEGIN/COMMIT shell over `_indexArtifactBody` (line 341).
- `_indexArtifactBody` (line 341) reads the file: `const content = fs.readFileSync(filePath, 'utf-8')` (line 342). This is the .md-content reader; .docx/.html reach (GDH-04) plugs in HERE (branch on extension before the read, route non-.md through doc-text-extractor).
- `async function rebuildGraph(conn, roomDir)` at **line 462** (SPEC said :457 -- drift of 5 lines). It walks `discoverSections(resolved).all` (line 474-475) with NO sub-room recursion -- the SECTIONS-only walk is the GDH-03 gap. Verbatim sections loop at 483-499.
- The `.md`-only filter is at **lines 487-489** (SPEC said :488 -- accurate):
  ```javascript
  files = fs.readdirSync(sectionDir).filter(f =>
    f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md'
  );
  ```
  GDH-04 must widen this filter to include `.docx`/`.html`.

### Anchor 3 -- `navigation.cjs` writeEdge signature + properties param + proposed-status reality

**SPEC said:** confirm writeEdge signature + derived edges can land review_status:proposed + properties JSON param exists (enum/scalar only).
**Current truth:** `navigation.cjs` re-exports `writeEdge: edges.writeEdge` at **line 113**. Signature (edges.cjs:440):

```javascript
function writeEdge(db, params)
// params = { source_id, target_id, edge_type, properties }
// returns { ok:true, edge_id, type, source, target } | { ok:false, reason, detail? }
// gate: edge_type must be in ALLOWED_EDGE_TYPES (the frozen set)
// write: INSERT INTO edges (source, target, type, properties)
//        ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties
```

The `properties` param EXISTS and is JSON-serialized (edges.cjs:457). Part 8 discipline (enum/scalar only) is doctrinal, not code-enforced inside writeEdge -- the planner must keep edge `properties` to enum/scalar handles (the same constraint every prior additive edge type carries).

**CRITICAL CORRECTION on "edges land review_status: proposed":** `review_status` is a column on the **nodes** table (added by the Phase 109 nodes-provenance migration; queried throughout `navigation/insights.cjs`). The **edges** table is `(source, target, type, properties)` ONLY -- it has NO review_status column. Therefore a derived edge CANNOT carry review_status as a column. The shipped pattern that satisfies "lands proposed for human confirm" is the findings-wirer.cjs pattern: write a PROPOSED truth-claim/evidence NODE (review_status='proposed' on the node, via writeEvidenceClaim / writeClaimNode / writeDecisionNode), then the typed EDGE from it. Promotion to confirmed is `navigation.confirmNode` (human byUser). See Open Question Q1 -- this is the single most important planning decision.

### Anchor 4 -- `lib/core/navigation/edges.cjs` frozen ALLOWED_EDGE_TYPES

**SPEC said:** confirm the set now CONTAINS CONVERGES/INVALIDATES/ENABLES (post-168) + INFORMS/CONTRADICTS/REFINES/ROOT_CAUSES.
**Current truth:** ALL SEVEN present. The complete frozen set (edges.cjs:32-423), in source order:
`DEFERRED, REJECTED, DERIVED_FROM, FILED_AS_DECISION, FOLLOWS_FROM, OPERATOR_TRANSITION, INFORMS, REJECTED_BECAUSE, CONTRADICTS, SUPERSEDES, AFFILIATED_WITH, PIVOTED, SELECTED_REACH, FEEDS_INTO, VALIDATES, STATES, SUPPORTS, DESCRIBES, REFINES, ROOT_CAUSES, INSTANTIATES, DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO, CONVERGES, INVALIDATES, ENABLES`.

The seven phase-target edges are all members: INFORMS (line 127), CONTRADICTS (153), REFINES (319), ROOT_CAUSES (320), CONVERGES (420), INVALIDATES (421), ENABLES (422). writeEdge will accept all seven. No edge-vocabulary amendment is needed in Phase 169 -- 168 closed that. INSTANTIATES is also available if a deriver wants the example-evidences-abstract edge.

### Anchor 5 -- `chain-executor.cjs` runChain + fable-mode selfCritiqueFn seam

**SPEC said:** confirm runChain signature + how a caller passes per-step onStep/gateFn/selfCritiqueFn.
**Current truth:** `runChain(steps, opts)` at **line 295**; exported (line 723). The six-callback contract (verbatim from the doc comment, lines 32-41 + 266-294):

```
runChain(steps, {
  postureFn,       // (command) -> posture authority   (default recipe-maps.postureForCommand)
  gateFn,          // (step, posture, priorOutput) -> 'run'|'halt'   (default makeGateFn)
  onStep,          // (step, previousOutput) -> { chain_output, quality }   (REQUIRED -- the brick dispatcher)
  provenanceFn,    // optional (step, result) -> frontmatter
  maxSteps,        // hard cap (EXEC-06 budget brake; default 25)
  onHalt,          // (step, contexts) -> the user's verb at the Tri-Context gate
  decideFn,        // injectable decide() seam (default navigation-engine.cjs decide)
  selfCritiqueFn,  // (step, result) -> verdict   (fable-mode, OPTIONAL, default no-op)
}) -> { trace, completed, haltedAt }
```

The **fable-mode seam** (`_applySelfCritique`, lines 213-227) is POSTURE-SCOPED: it fires `selfCritiqueFn(step, result)` ONLY on MATERIAL steps (non-push_forward posture, OR irreversible, OR `step.material===true`), and if the verdict is `{quality:'low'}` OR `{passed:false}` it AUGMENTS the captured quality to LOW, which trips the existing `quality_early_stop` + next-hop gate halt. A thrown critic FAILS OPEN (no augmentation). It rides BOTH the sync `runChain` path (line 429) and the async `_runChainResilient` path (line 675) via the one shared helper, so they cannot drift.

**How the derivation loop wires it (GDH-05):** each derivation step is a runChain step. `onStep` invokes one deriver (or one section's derive pass) and returns `{ chain_output: <candidate edges>, quality }`. `selfCritiqueFn` is the fable-mode critic: it inspects a candidate CONTRADICTS/CONVERGES and returns `{passed:false}` if the edge is unjustified (so a bad CONTRADICTS does not land). Mark derivation steps `material:true` so the critic always fires (derivation is never "trivially safe"). The proposed-edge write happens in `onStep` AFTER a passing critique, through `navigation.writeEdge` + a proposed node.

## Architecture Patterns

### System Architecture Diagram

```
                    TWO TRIGGERS (D-169-01)
   per-write Write/Edit                Stop event (NEW hook)        explicit /mos:graph --derive
          |                                   |                              |
          v                                   v                              v
  gsd-artifact-graph-hook.cjs       gsd-graph-derive-sweep.cjs      graph.md (--derive branch)
  (STRUCTURAL index only,           (DEBOUNCED; calls composer)     (calls composer, one pass)
   stays cheap)                              |                              |
          |                                  +---------------+--------------+
          v                                                  |
   room-root.cjs  <----- GDH-01 unify: ONE .room-root walk-up resolver ----+
   (walk up from filePath to nearest sentinel)               |
          |                                                   v
          v                                    lib/core/graph-derivation.cjs  (the runChain composer)
  indexArtifact (lazygraph-ops)                              |
   - branch on extension:                    steps = [ section-1, section-2, ... sub-room-1, ... ]
     .md   -> fs.readFileSync                 runChain(steps, {
     .docx -> doc-text-extractor                onStep:        invoke deriver, build candidate edges
     .html -> doc-text-extractor                selfCritiqueFn: fable-mode critic (167) -> pass|fail
   - upsert Artifact + BELONGS_TO             })
          |                                                   |  per passing candidate:
          v                                                   v
   room.db (per-room/.mindrian/room.db)        navigation.writeEdge  +  proposed NODE
                                                  (Part 9 chokepoint; review_status='proposed' on the node;
                                                   edge props = enum/scalar; ON CONFLICT idempotent)
                                                              |
   PARENT ROLLUP (read-side, GDH-03):                         v
   parent opens its room.db, ATTACHes each            human Decision Gate (Part 3)
   sub-room's room.db read-only, UNION queries        APPROVE -> confirmNode (proposed -> confirmed)
   across them. NO merged db. Part 8 isolation.       REJECT  -> REJECTED_BECAUSE edge ("why-not", Part 4)
```

A reader traces the primary use case (`/mos:graph --derive` on b2-journey) thus: command -> composer -> resolve each sub-room by `.room-root` -> rebuild each sub-room db reading .md AND .docx -> runChain the 4 derivers per section -> fable-mode critique each candidate -> writeEdge proposed edges + proposed nodes -> typed-edge count 0 -> N -> parent rollup makes them visible to the parent.

### Recommended Project Structure (new files only)

```
lib/core/
  room-root.cjs            # GDH-01: the ONE .room-root sentinel walk-up resolver
  doc-text-extractor.cjs   # GDH-04: pure-JS .docx (zip+inflate+w:t) + .html (cheerio) -> text
  graph-derivation.cjs     # GDH-02/05: runChain composer wiring the 4 derivers; writes proposed edges
scripts/
  gsd-graph-derive-sweep.cjs  # GDH-02 trigger: NEW debounced Stop hook
commands/
  graph.md                 # GDH-06: add a --derive branch (existing file, edit)
hooks/hooks.json           # register the Stop sweep hook (existing file, edit)
```

### Pattern 1: Pure-JS docx text extraction (no dependency)

**What:** A .docx is a ZIP of XML; the body text lives in `word/document.xml` as `<w:t>...</w:t>` runs. Walk the ZIP central directory, locate `word/document.xml`, `zlib.inflateRawSync` the DEFLATE entry, regex-pull `<w:t>` runs, join.
**When to use:** GDH-04, every non-.md non-.html artifact with a .docx extension.
**Verified:** see Code Example 1 -- ran against the real `B2-Pavilions-as-Personas-Dossier-HE.docx`, got 216 Hebrew text runs.

### Pattern 2: Read-side sub-room rollup via ATTACH (no merged db)

**What:** The parent opens its OWN room.db, then `ATTACH DATABASE '<sub-room>/.mindrian/room.db' AS sub_<n>` (read-only) for each registered sub-room, runs UNION-ALL queries across the attached schemas, and DETACHes. The parent never writes sub-room rows into its own db.
**When to use:** GDH-03 parent rollup reads (the "parent sees everything" requirement).
**Part 8 note:** ATTACH for READ is boundary-safe (sub-room bytes stay in the sub-room file; the parent only reads them in-process, the same as a local filesystem read). Do NOT copy sub-room rows into the parent db -- that would create a second authority and blur the room boundary.

### Pattern 3: Two-trigger split (structural per-write, typed on sweep)

**What:** Keep the structural index (indexArtifact -> Artifact + BELONGS_TO) on the existing per-write PostToolUse hook. Run the expensive TYPED derivation only on the debounced Stop hook + the explicit backfill.
**When to use:** GDH-02 / D-169-01. This is why a NEW hook is correct, not an extension of the per-write hook.

### Anti-Patterns to Avoid

- **Writing review_status onto an edge.** The edges table has no such column; the write silently lands in `properties` JSON and no insights query reads it. Use a proposed NODE (findings-wirer pattern).
- **Merging sub-room dbs into the parent.** Breaks Part 8 isolation and creates a second source of truth. Use read-side ATTACH.
- **Putting typed derivation on the per-write hook.** Per-write token cost + gate-fatigue (the Ralph lesson, D-169-01). Sweep + backfill only.
- **Adding mammoth/docx/adm-zip.** No-new-heavy-deps (CLAUDE.md). The built-in path is proven.
- **Bypassing navigation.writeEdge with raw SQL.** Part 9 chokepoint; the pre-commit substrate guard will reject a new direct room-db require.
- **Mutating the source .docx.** D-169-03: non-destructive reader; never write a sidecar or edit the dossier.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typed-edge write | A raw `INSERT INTO edges` | `navigation.writeEdge(db, params)` | Part 9 chokepoint; frozen-set gate; idempotent ON CONFLICT; pre-commit guard. |
| Proposed claim + edge from a deriver decision | A new proposed-node writer | `lib/core/findings-wirer.cjs::wireAccept/wireReject/wireDefer` | Already writes proposed EvidenceClaim node + INFORMS/CONTRADICTS/SUPERSEDES edge + REJECTED_BECAUSE, all via navigation.cjs, all proposed. Caller-owned db handle. |
| proposed -> confirmed promotion | A status UPDATE | `navigation.confirmNode(db, params)` (human byUser) | Part 9 role 5; the only legal promotion door. |
| The chain loop | A new for-loop over derivers | `chain-executor.cjs::runChain` | Shipped Phase 166; gate + budget brake + fable-mode seam + trace already built. |
| Self-critique of a candidate edge | A new critic harness | runChain `selfCritiqueFn` (fable-mode, 167) | Posture-scoped, fail-open, shared sync/async seam already wired. |
| .docx unzip | adm-zip / a hand-rolled full ZIP parser with CRC | `zlib.inflateRawSync` + a ~40-line central-directory walk | Built-in; we only need to READ one entry; full ZIP semantics (CRC, encryption) are unnecessary. |
| .html text | A regex tag-stripper | `cheerio` (already a dep) `$('body').text()` | Handles entities, nested tags, scripts; pure JS. |
| Sub-room enumeration | A new registry format | The existing `.rooms/registry.json` + the new `.room-root` walk | Reuse the shipped registry + sentinel convention. |
| Edge idempotence | A "have I seen this edge" cache | edges `PRIMARY KEY(source,target,type)` + `ON CONFLICT DO UPDATE` | The schema already dedupes by edge identity. |

**Key insight:** Almost nothing in this phase is genuinely new code. The four hard problems (chain loop, edge write, proposed-node lifecycle, self-critique) are ALL shipped. The net-new is: one resolver, one extractor, one composer, one hook, one command branch.

## Runtime State Inventory

> This phase WRITES graph state but is not a rename/refactor. Included because the acceptance fixture (b2-journey) has live state that the planner must account for.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The b2-journey room.db (if present at `~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj/b2-journey/.mindrian/room.db`) currently sits at BELONGS_TO-only per SEED-034 (35 nodes, 35 BELONGS_TO, 0 typed). The derivation WRITES new proposed edges into it. | Acceptance test: typed-edge count 0 -> N. The fixture room.db may need a clean rebuild first (the .docx files are NOT yet indexed at all -- the .md-only filter excluded them). |
| Live service config | None -- this phase has no external service config. | None -- verified by absence of any service config in scope. |
| OS-registered state | The NEW Stop hook is registered in `hooks/hooks.json` (a git-tracked file, ships with the plugin). No OS task scheduler / launchd. | Register the hook in hooks.json; it ships to every install via the marketplace artifact. |
| Secrets/env vars | The derivers read `MINDRIAN_ROOMS_ROOT` / `CLAUDE_ROOM_DIR` (existing env, code-read only). The new resolver reads the same. brain-derive-command.cjs reads the Brain key via the existing brain-client. | None new. |
| Build artifacts | None -- pure CJS, no compiled artifacts; the vendored node_modules is unchanged (no new deps). | None. |

**The canonical question (after every file is updated, what runtime state still holds old shape?):** The fixture room.db carries the OLD BELONGS_TO-only graph until the backfill runs. That is the POINT of the acceptance test, not a migration debt.

## Common Pitfalls

### Pitfall 1: Treating review_status as an edge property

**What goes wrong:** A deriver calls `writeEdge(db, { ..., properties: { review_status: 'proposed' } })` and nothing downstream ever surfaces it for human confirm, because every "find proposed for confirm" query reads `nodes.review_status`, not edge properties.
**Why it happens:** The SPEC/CONTEXT prose says "each derived edge landing review_status: proposed", which reads as an edge attribute. The schema disagrees.
**How to avoid:** Land a proposed NODE (EvidenceClaim/claim/decision via the findings-wirer or the navigation typed-claim writers), then the edge from it. The Decision Gate confirms the NODE; the edge rides along.
**Warning signs:** A derived edge exists but `findUnsupportedClaims` / `findSurfaceableTensions` never surface it; the user is never prompted to confirm.

### Pitfall 2: The hook never sees the sub-room because it resolves the ACTIVE room

**What goes wrong:** A write into a sub-room file, while the parent is the active room, indexes into the PARENT db (root cause #1).
**Why it happens:** `resolveRoomDir` (and `detectActiveRoom`) read the registry active room, ignoring the written file's location.
**How to avoid:** GDH-01 -- thread `filePath` into the new `.room-root` resolver; walk up from the file to the nearest `.room-root`/`.mindrian` sentinel.
**Warning signs:** Sub-room artifacts appear in the parent's room.db; the sub-room db stays empty.

### Pitfall 3: Idempotence holds for edges but NOT for proposed nodes

**What goes wrong:** Re-running the backfill re-proposes the same claim node under a new id, so the user sees duplicate "confirm this?" prompts.
**Why it happens:** Edges dedupe on `(source,target,type)`, but a proposed node minted with a fresh `Date.now()`/random id every run is NOT deduped. A re-run must compute a STABLE node id (e.g. a content/source-hash) and an upsert, and must SKIP nodes already `confirmed`.
**How to avoid:** GDH-07 -- (a) derive a stable node id from the source artifact hash + edge semantics, (b) before proposing, check the node's existing `review_status`; if `confirmed` or already `proposed`, no-op. The `content_hash` already stored on the Artifact node (lazygraph `_indexArtifactBody` line 348-352) is the dedupe seed.
**Warning signs:** typed-edge count grows on every re-run; duplicate proposed nodes for the same finding.

### Pitfall 4: Brain boundary on the brain-derive deriver

**What goes wrong:** Wiring `brain-derive-command.cjs` into the loop could carry user content into a Brain query.
**Why it happens:** It is the ONE deriver of the four that calls the Brain (brain-client.query with Cypher; the curation Cyphers are read-only aggregates over methodology nodes).
**How to avoid:** Part 8 boundary scan task over `graph-derivation.cjs` + `brain-derive-command.cjs`. Confirm only generic framework handles / phase ids / enum scalars reach the Brain (the existing brain-derivation.cjs guards already enforce this; the new composer must not add a new Brain wire). The other three derivers (findings-wirer, proactive-intelligence, cross-room-detect) are LOCAL-only.
**Warning signs:** A Brain query payload containing artifact body text, a dossier name, or a Hebrew string from a .docx.

### Pitfall 5: .docx encoding / Hebrew RTL

**What goes wrong:** The extracted text is garbled or empty.
**Why it happens:** Wrong inflate variant (the entry is raw DEFLATE -> `inflateRawSync`, NOT `inflateSync`), or assuming method 0 (stored) when it is method 8 (deflate).
**How to avoid:** Branch on the ZIP entry's compression method (0 = stored, 8 = deflate); use `inflateRawSync` for method 8. UTF-8 decode (Hebrew is multi-byte UTF-8; `toString('utf8')` is correct -- verified, the Hebrew rendered correctly).
**Warning signs:** Empty `w:t` match array, or mojibake.

## Code Examples

### Code Example 1: Pure-JS .docx text extraction (VERIFIED against the real b2-journey fixture)

```javascript
// Source: ran this session against
//   ~/MindrianRooms/.../b2-journey/B2-Pavilions-as-Personas-Dossier-HE.docx
//   -> 18 zip entries, word/document.xml method=8, 216 <w:t> runs of Hebrew text.
// Built-ins only: node:fs + node:zlib. No dependency.
const fs = require('node:fs');
const zlib = require('node:zlib');

function extractDocxText(filePath) {
  const buf = fs.readFileSync(filePath);
  // 1. find End Of Central Directory (EOCD) signature 0x06054b50
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) return '';
  const cdCount = buf.readUInt16LE(i + 10);
  const cdOff = buf.readUInt32LE(i + 16);
  // 2. walk the central directory to locate word/document.xml
  let p = cdOff, entry = null;
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;        // central dir header sig
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);                 // local header offset
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === 'word/document.xml') { entry = { lho, method, compSize }; break; }
    p += 46 + nameLen + extraLen + commLen;
  }
  if (!entry) return '';
  // 3. read the local header to find the data start, then inflate
  const ln = buf.readUInt16LE(entry.lho + 26);
  const le = buf.readUInt16LE(entry.lho + 28);
  const dataStart = entry.lho + 30 + ln + le;
  const comp = buf.subarray(dataStart, dataStart + entry.compSize);
  const xml = entry.method === 8 ? zlib.inflateRawSync(comp).toString('utf8')
                                 : comp.toString('utf8');  // method 0 = stored
  // 4. pull the <w:t> runs (the document body text)
  const runs = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]);
  return runs.join(' ');
}
```

### Code Example 2: writeEdge contract (the Part 9 chokepoint)

```javascript
// Source: lib/core/navigation/edges.cjs:440 (re-exported at navigation.cjs:113)
const navigation = require('../core/navigation.cjs');
const roomDb = require('../core/room-db.cjs');

const db = roomDb.openRoomDb(roomDir);          // caller owns the handle
try {
  const res = navigation.writeEdge(db, {
    source_id: 'claim:<stable-hash>',           // a PROPOSED node id (see Pitfall 1)
    target_id: 'section:market-analysis',
    edge_type: 'CONTRADICTS',                    // must be in ALLOWED_EDGE_TYPES
    properties: { confidence: 'medium', reason: 'finding_kills_claim' }, // enum/scalar only
  });
  // res = { ok:true, edge_id, type, source, target } | { ok:false, reason }
} finally {
  roomDb.closeRoomDb(db);
}
```

### Code Example 3: runChain derivation loop with fable-mode critique (GDH-05 shape)

```javascript
// Source: chain-executor.cjs:295 runChain contract (six callbacks + selfCritiqueFn seam at :213).
const { runChain } = require('../core/chain-executor.cjs');

const steps = derivationSections.map(s => ({
  step: s.name, command: 'derive:' + s.name, material: true, // material -> critic always fires
}));

const result = runChain(steps, {
  // each step invokes a deriver (findings-wirer / proactive-intelligence / cross-room-detect /
  // brain-derive), builds candidate edges, and -- after a passing critique -- writes them.
  onStep: (step, prev) => {
    const candidates = deriveCandidatesForSection(step, prev); // LOCAL deriver call
    return { chain_output: candidates, quality: candidates.length ? 'medium' : 'low' };
  },
  // fable-mode (167): reject an unjustified edge before it lands.
  selfCritiqueFn: (step, res) => critiqueCandidates(res.chain_output), // -> { passed:bool }
  maxSteps: 50,
});
// Then write only critique-passed candidates as proposed node + writeEdge.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual derivation (brain-derive / findings-wirer / reanalyze run by hand) | runChain-driven sweep + backfill | This phase (169) | Rooms stop sitting at BELONGS_TO-only. |
| Part 9 chokepoint missing CONVERGES/INVALIDATES/ENABLES | Frozen set complete | Phase 168 (2026-06-18) | writeEdge accepts all 5 cascade edges; no amendment needed here. |
| No shared chain loop (act-command owned its own) | runChain single spine | Phase 166 (2026-06-18) | The derivation loop is a runChain caller, not a new loop. |
| No self-critique on derived edges | fable-mode selfCritiqueFn seam | Phase 167 (2026-06-18) | A bad CONTRADICTS can be caught before it lands. |

**Deprecated/outdated:**
- The lazygraph legacy `EDGE_TYPES` array (lazygraph-ops.cjs:26) carries a SECOND vocabulary (HSI_CONNECTION / REVERSE_SALIENT / RESOLVES_VIA etc.) distinct from the navigation frozen set. The two-vocabulary unification is explicitly OUT of scope (deferred, SEED-034). Phase 169 writes only through `navigation.writeEdge` (the frozen set), not the legacy lazygraph edge-creators.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The b2-journey fixture room.db (if it exists) is at BELONGS_TO-only as SEED-034 reported; its .docx files are currently UN-indexed (the .md-only filter excluded them). | Runtime State Inventory | LOW -- the acceptance test rebuilds anyway; verify count before/after. The 9 .docx files ARE confirmed present on disk this session. |
| A2 | The new `.room-root` sentinel is a `.room-root` file (or `.mindrian/` dir) at each room/sub-room root. SEED-034/D-169-05 name `.room-root` but no such resolver exists in code yet -- the sentinel convention must be defined by this phase. | GDH-01 / Open Q4 | MEDIUM -- if the existing rooms do NOT have a `.room-root` marker, the resolver must fall back to `.mindrian/` presence as the sentinel. Confirm the marker convention with the navigator (Open Q4). |
| A3 | Marking derivation steps `material:true` so the fable-mode critic always fires is the intended use of the posture-scoped seam. | GDH-05 / Code Example 3 | LOW -- consistent with the seam's design (material = uncertain = critique). |
| A4 | The parent rollup reads sub-rooms enumerated from `.rooms/registry.json` (the shipped registry), not from a filesystem scan. | GDH-03 / Pattern 2 | LOW -- the registry is the shipped source of room membership. |

**If this table is empty:** it is not -- A2 and A4 in particular want navigator/planner confirmation.

## Open Questions

1. **How does a derived edge "land review_status: proposed" given edges have no review_status column?** (THE load-bearing question.)
   - What we know: review_status is a NODE column (Phase 109 migration); the edges table is `(source,target,type,properties)` only; findings-wirer.cjs already solves this by writing a PROPOSED EvidenceClaim node + the typed edge, with confirmNode as the promotion door.
   - What's unclear: whether GDH-05 wants (a) a proposed claim/evidence NODE per derived relationship (the findings-wirer pattern -- RECOMMENDED), or (b) a lightweight edge whose `properties.review_status` is read by a NEW surfacing query the phase also builds.
   - Recommendation: adopt (a) -- reuse findings-wirer.cjs verbatim (D-169-04 reuse). It is the shipped, Part-9-correct, confirm-wired path. Surface the proposed nodes at the Decision Gate via the existing `findUnsupportedClaims`/`findSurfaceableTensions` queries.

2. **Which deriver maps to which edge type, and does each WRITE today or only PROPOSE?**
   - What we know (verified this session):
     - `findings-wirer.cjs` -- WRITES via navigation.cjs (proposed EvidenceClaim node + INFORMS/CONTRADICTS/SUPERSEDES/REJECTED_BECAUSE edges). Caller-owned db. LOCAL-only. THE cleanest runChain step. Brain: NO.
     - `proactive-intelligence.cjs` -- PARSES analyze-room output into structured insight objects (gap/convergence/contradiction); persists to a JSON file (`.proactive-intelligence.json`), does NOT write graph edges itself. Brain: NO. Needs an adapter to turn its insights into writeEdge calls.
     - `cross-room-detect.cjs` -- READS artifact titles across rooms (open-use-close lazygraph), finds shared keywords; records relationships in proactive-intelligence JSON. CROSS-ROOM -> Part 8 cross-room fence; its OUTPUT is cross-room which is DEFERRED (Phase 83). Use it only for WITHIN-room convergence signals in 169, or exclude it.
     - `brain-derive-command.cjs` -- the ONE Brain-touching deriver (brain-client.query read-only methodology aggregates). Brain: YES -> boundary-scan target.
   - Recommendation: Wire `findings-wirer.cjs` as the primary edge writer. Use `proactive-intelligence.cjs` parse output as a candidate SOURCE feeding findings-wirer. Defer/exclude `cross-room-detect.cjs` cross-room edges (Phase 83). Treat `brain-derive-command.cjs` as the Part 8 boundary-scan subject; keep its Brain reads generic-only.

3. **Is the `.room-root` sentinel a file or the `.mindrian/` directory?** See A2 / Open Q4 below.

4. **Sentinel convention for the unified resolver.** No `.room-root` resolver exists today. The two existing resolvers use the registry active room. The rebuild tool uses an explicit path arg.
   - Recommendation: define the sentinel as "the nearest ancestor directory containing a `.mindrian/` folder OR a `ROOM.md` (ICM Layer 0 contract, CLAUDE.md decision 15)". Both are guaranteed present at every room/sub-room root by the existing scaffold. A literal `.room-root` marker file is optional belt-and-suspenders. CONFIRM with the navigator which marker is canonical.

5. **Debounce mechanism for the Stop sweep.** The existing Stop hooks (operator-update, jtbd-update, hmi-compliance-poll) do NOT debounce; the brain-derivation pipeline debounces via a queue+drain (`brain-derivation-queue.json` + `brain-derivation-drain.cjs` on UserPromptSubmit).
   - Recommendation: mirror the brain-derivation enqueue-then-drain pattern -- the Stop hook ENQUEUES a derive request (cheap), and a drain (next session-start or a debounced timer) runs the expensive pass. This matches the shipped debounce idiom and keeps the Stop hook within its 3000ms timeout budget.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node:sqlite (DatabaseSync) | room.db open + ATTACH rollup | yes | node v22.22.2 | none needed (Tier 0 degrades to no-op when room.db absent, per the hook's existing pattern) |
| node:sqlite ATTACH DATABASE | sub-room read-side rollup (GDH-03) | yes (verified this session) | node v22.22.2 | per-sub-room sequential reads (open each, query, close) if ATTACH is undesirable |
| node:zlib inflateRawSync | .docx DEFLATE decompression (GDH-04) | yes (verified) | node v22.22.2 | none -- it is the only path; stored (method 0) entries need no inflate |
| cheerio | .html text extraction (GDH-04) | yes (already a dependency) | 1.2.0 | regex tag-strip (worse; avoid) |
| b2-journey fixture (.docx x9) | GDH-06 acceptance | yes (9 .docx confirmed on disk) | n/a | a synthetic .docx fixture in tests/ |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** ATTACH (fallback: sequential per-sub-room reads).

## Validation Architecture

> nyquist_validation is enabled by default (no config.json override found in scope). This section lets the validation-strategy step derive VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in (`node:test` / bare `assert` CJS test files); repo convention is `tests/run-all-<phase>.sh` aggregators + `tests/test-*.cjs` |
| Config file | none -- tests are self-contained CJS scripts run via `bash tests/run-all-169.sh` (to be created in Wave 0) |
| Quick run command | `node tests/test-doc-text-extractor.cjs` (single file) |
| Full suite command | `bash tests/run-all-169.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GDH-01 | `.room-root` resolver returns the SUB-ROOM db for a file inside a sub-room while parent is active | unit | `node tests/test-room-root-resolver.cjs` | Wave 0 |
| GDH-02 | Stop sweep enqueues a derive request; structural per-write index unaffected | unit | `node tests/test-graph-derive-sweep.cjs` | Wave 0 |
| GDH-03 | rebuildGraph recurses sub-rooms; parent rollup UNION sees sub-room edges via ATTACH | integration | `node tests/test-subroom-rollup.cjs` | Wave 0 |
| GDH-04 | extractDocxText returns >0 text runs for the b2 fixture; .html via cheerio; source byte-unchanged | unit | `node tests/test-doc-text-extractor.cjs` | Wave 0 |
| GDH-05 | runChain composer writes proposed NODE + typed edge via navigation.writeEdge; fable-mode rejects a bad CONTRADICTS | integration | `node tests/test-graph-derivation-loop.cjs` | Wave 0 |
| GDH-06 | `/mos:graph --derive` on the b2 fixture takes typed-edge count 0 -> N | acceptance | `node tests/test-derive-backfill-acceptance.cjs` | Wave 0 |
| GDH-07 | re-run is a no-op: no duplicate proposed nodes; confirmed edges untouched | integration | `node tests/test-derive-idempotence.cjs` | Wave 0 |
| Part 8 | boundary scan: no user bytes reach Brain in graph-derivation.cjs + brain-derive | adversarial | `node tests/test-169-brain-boundary.cjs` (forbidden-substring sweep, mirror Phase 90 5-tripwire pattern) | Wave 0 |
| Part 4/9 | every derived edge type is in ALLOWED_EDGE_TYPES (frozen-set floor) | unit | extend `tests/test-edges-part4-cascade-floor.cjs` (exists, Phase 168) | exists |

### Sampling Rate
- **Per task commit:** `node tests/test-<module>.cjs` for the module touched.
- **Per wave merge:** `bash tests/run-all-169.sh`.
- **Phase gate:** full 169 suite green + the carried 168 floor test green + a Part 8 boundary scan returning 0 forbidden matches, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-169.sh` -- the phase aggregator (none exists yet)
- [ ] `tests/test-doc-text-extractor.cjs` -- covers GDH-04 (use the b2 fixture + a tiny stored-method .docx)
- [ ] `tests/test-room-root-resolver.cjs` -- covers GDH-01
- [ ] `tests/test-subroom-rollup.cjs` -- covers GDH-03 (build two temp room.db files, ATTACH, UNION)
- [ ] `tests/test-graph-derivation-loop.cjs` -- covers GDH-05 (stub onStep/selfCritiqueFn)
- [ ] `tests/test-derive-idempotence.cjs` -- covers GDH-07
- [ ] `tests/test-derive-backfill-acceptance.cjs` -- covers GDH-06 (the b2 0 -> N count)
- [ ] `tests/test-169-brain-boundary.cjs` -- Part 8 adversarial sweep

## Security Domain

> security_enforcement enabled (absent = enabled). The dominant security constraint here is Canon Part 8 (the graph boundary), not ASVS web categories.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (local plugin). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | Local filesystem only. |
| V5 Input Validation | yes | The .docx/.html extractor parses attacker-influenceable file bytes -> bound the ZIP walk (cap entry count, cap inflated size), never `eval`/exec the content, treat extracted text as data only. |
| V6 Cryptography | no | content_hash uses node:crypto already; no new crypto. |

### Known Threat Patterns for this stack (Canon Part 8 + file parsing)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User .docx bytes leak to Brain via a deriver query | Information Disclosure (Part 8 breach) | Boundary scan over graph-derivation.cjs + brain-derive-command.cjs; Brain queries carry only generic framework handles/enums; the 3 LOCAL derivers never touch the wire. |
| A malformed/huge .docx causes DoS in the extractor | Denial of Service | Cap central-directory entry count, cap `inflateRawSync` output size, wrap in try/catch -> empty string on failure (the hook's existing exit-0-always pattern). |
| A zip-bomb .docx (tiny compressed, huge inflated) | DoS | Use `inflateRawSync` with a maxOutputLength option / size guard; abort over a sane cap (e.g. 10 MB of text). |
| Cross-room edge leaks one room's data into another's db | Information Disclosure (room boundary) | Read-side ATTACH only; NEVER copy sub-room rows into the parent db; cross-room TYPED edges stay deferred (Phase 83). |
| A bad CONTRADICTS edge lands and misleads the navigator | Tampering (data integrity) | fable-mode selfCritiqueFn rejects unjustified edges; every derived edge lands PROPOSED (node), human confirms (Part 3/9). |
| A new code path bypasses navigation.writeEdge with raw SQL | Tampering (chokepoint bypass) | The Phase 109 pre-commit substrate guard rejects a new direct room-db require outside the allow-list; write only via navigation.writeEdge. |

## Sources

### Primary (HIGH confidence -- tool-verified this session)
- `lib/core/chain-executor.cjs` (read in full) -- runChain six-callback contract + fable-mode `_applySelfCritique` seam.
- `lib/core/navigation.cjs` (read in full) -- writeEdge re-export (:113), confirmNode, getNeighborhood, promoteNodeStatus.
- `lib/core/navigation/edges.cjs` (read in full) -- frozen ALLOWED_EDGE_TYPES (all 7 phase edges present), writeEdge signature + ON CONFLICT idempotence.
- `lib/core/lazygraph-ops.cjs` (read targeted) -- indexArtifact :420, _indexArtifactBody :341 (fs.readFileSync :342), rebuildGraph :462 (sections-only walk), .md-only filter :487-489, edges PRIMARY KEY(source,target,type) :44.
- `lib/core/room-db.cjs` (read targeted) -- openRoomDb composes lazygraph + Phase 109 nodes-provenance (review_status on NODES) + bitemporal; same room.db file.
- `scripts/gsd-artifact-graph-hook.cjs` (read in full) -- resolveRoomDir :80-100 (registry-active-room resolution; GDH-01 target).
- `lib/core/navigation/dashboard-helpers.cjs` (read in full) -- detectActiveRoom :49-73 (second registry-active resolver).
- `lib/core/findings-wirer.cjs` (read targeted) -- wireAccept/wireReject/wireDefer; proposed-node + typed-edge pattern; LOCAL-only.
- `scripts/brain-derive-command.cjs` + `lib/core/proactive-intelligence.cjs` + `scripts/cross-room-detect.cjs` (read targeted) -- deriver semantics + Brain-touch classification.
- `commands/graph.md` + `commands/reanalyze.md` (read in full) -- backfill host comparison.
- `hooks/hooks.json` (read in full) -- existing Stop / PostToolUse hooks + debounce idioms.
- LIVE TOOL PROOFS (Bash this session): `node --version` v22.22.2; ATTACH DATABASE works; `zlib.inflateRawSync` present; real b2 .docx extracted (18 entries, 216 Hebrew `<w:t>` runs); 9 .docx confirmed on disk in the fixture.

### Secondary (HIGH confidence -- canon)
- `docs/MINDRIAN-CANON.md` Part 4 (frozen edge vocabulary), Part 8 (graph boundary), Part 9 (memory locality; navigation chokepoint; proposed->confirmed; audit-node carve-out), Part 6 (dog-fooding).
- `docs/CANON-PHASE-MAP.md` -- Phase 166/167/168 shipped status; v1.14.0 execution order.
- `CLAUDE.md` + `.claude/includes/*` -- no-new-heavy-deps, CJS, three-surfaces, vendored-node_modules-pure-JS rule, no em-dashes.

### Tertiary (LOW confidence -- needs navigator confirmation)
- The `.room-root` sentinel marker convention (A2 / Open Q4) -- inferred from CLAUDE.md decision 15 (ROOM.md everywhere) + the `.mindrian/` presence; not a literal `.room-root` file found in code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every module read on current main; zero new deps; built-in extraction PROVEN against the real fixture.
- Architecture: HIGH -- runChain + writeEdge + findings-wirer + fable-mode all verified shipped; the composition shape is grounded.
- Pitfalls: HIGH -- the review_status-is-a-node-column finding and the idempotence-on-proposed-nodes finding are schema-verified, not assumed.
- Open Questions: the one load-bearing item (Q1) has a recommended resolution (findings-wirer reuse); Q4 (sentinel marker) needs a quick navigator confirm.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable substrate; the only fast-moving risk is further lazygraph/navigation edits before Phase 169 executes -- re-verify anchors if main advances materially).

## Project Constraints (from CLAUDE.md)

- NO new heavy dependencies; prefer Node built-ins / existing deps. (Honored: zero new deps; built-in docx path proven.)
- CJS modules only (no ESM, no TypeScript). (All new files CJS.)
- NO em-dashes anywhere -- hyphens only. (This document uses hyphens throughout.)
- Three-surface rule (CLI / Desktop / Cowork): the derivation must work across all three. The sweep is CLI-hook-driven; Desktop/Cowork (no PostToolUse/Stop hooks) rely on the `/mos:graph --derive` backfill + a session-start drain -- the planner must ensure the backfill command is the universal net for the hook-less surfaces (mirrors the Phase 149 session-start-reconcile-as-universal-net pattern).
- Vendored node_modules must stay pure-JS (no native addons) -- reinforces the no-docx-dep decision.
- All graph writes via navigation.cjs (Part 9 chokepoint); pre-commit substrate guard enforces it.
- GSD workflow: edits only through a GSD command.

---

## Orchestrator note (post-research, 2026-06-19) -- Q4 sentinel resolved by shipped convention + Part 7 consolidation

The research correctly found NO `.room-root` walk-up resolver exists in `lib/core` and recommends building `lib/core/room-root.cjs`. One refinement for the planner, verified by grep on current main: the `.room-root` sentinel is NOT an undefined convention -- it is shipped and the walk-up is ALREADY implemented in at least three production scripts:

- `scripts/query-efficiency-telemetry.cjs:205` -- `if (fs.existsSync(path.join(dir, '.room-root'))) return dir;`
- `scripts/auto-explore-fingerprint.cjs:82` -- same walk-up idiom.
- `scripts/async-artifact-auto-commit.cjs:130` -- same walk-up idiom (commits only files inside a `.room-root` subtree).
- `scripts/heal-command.cjs:890` -- treats `['.room-root', 'STATE.md', 'ROOM.md']` as the sentinel set; `:921` detects a sub-rooms container by each child carrying `.room-root`.
- WRITERS: `lib/core/navigation/room-birth.cjs:357` + `lib/core/room-auto-create.cjs:198` write the `.room-root` sentinel at room birth (so every sub-room already has one).

**Implication for GDH-01:** `lib/core/room-root.cjs` should be a Part-7 CONSOLIDATION (extract the existing 3x-duplicated walk-up into one canonical resolver, then repoint the 3 scripts + the hook + the rebuild/sweep + the backfill at it), NOT a net-new invention. This removes drift instead of adding surface, and the sub-rooms-container detection in `heal-command.cjs:909-921` is the existing precedent for GDH-03's sub-room rollup walk. Sentinel marker = the `.room-root` FILE (confirmed); no navigator decision needed. Q4 is closed.
