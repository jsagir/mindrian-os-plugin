# Phase 141: Local Retrieval Spine + Capability Dial - Research

**Researched:** 2026-06-04
**Domain:** Local in-process context retrieval (SQLite graph + fragments) + Larry prompt-layer policy committal
**Confidence:** HIGH (all claims verified against live code at file:line this session)
**Milestone:** v1.13.1 "Larry Reaches" (Decision Gate Option A)
**House rule honored:** hyphens only, no em-dashes.

---

## Summary

Phase 141 builds `getRoomContext()` -- the local, in-process, three-leg fusion that finally closes the conversation-to-retrieval loop so "do you remember X" retrieves X-relevant nodes -- AND lifts the "When to Reach -- The Capability Dial" SKILL.md edit out of working-tree limbo into a tracked, version-bumped, canon-wired requirement. The line-53 ReferenceError in `build-graph-from-sqlite.cjs` rides along as a one-token fix.

Every fan-out finding the orchestrator handed me VALIDATES against live code. The three legs exist as live functions: `getRoomHomeView` returns RAW prose (Leg A), `getSessionHistory` returns verbatim fragments (Leg B), `getNeighborhood` is a real recursive-CTE graph-BFS with a frozen weighted score (Leg C). There is still NO FTS5 table anywhere (precise SQL-DDL grep returned exit 1). `packet.cjs::projectText` still HASHES under the default `local_summary_only` mode -- it is the egress path to NOT reuse. No `getRoomContext`/`assembleContext`/`smartContext` symbol exists yet (grep exit 1). The per-turn loop still forwards `userText: null` (intent-classifier.cjs:1081). The 1200ms NAV hard timeout is real (`NAV_HARD_TIMEOUT_MS = 1200`).

The Larry upgrade is a first-class requirement, not a commit chore. Validated: the "When to Reach -- The Capability Dial" section IS present and UNCOMMITTED (HEAD has 0 matches, working tree has 1, `git status` shows ` M`, `git log -S` finds no commit). NOTHING in lib/scripts/hooks enforces it (grep returns nothing). The dual-path gap is confirmed: `buildContext` (Desktop/Cowork MCP + live dashboard surface) requires only node builtins, never `navigation.cjs`, so the policy is honored ONLY on the CLI path that calls `navigation.cjs`. For v1.13.1, "wired properly" means committing the section to HEAD with `canon_parts` frontmatter + CHANGELOG + version bump, AND landing `getRoomContext()` as the local substrate the dial's "Context Block" row describes. Closing the Desktop/Cowork dual-path (making `buildContext` route through `navigation.cjs`) is explicitly DEFERRED.

**Primary recommendation:** Build `getRoomContext()` as `packet.cjs` WITHOUT the hashing and WITH a fragments leg -- compose `getRoomHomeView` (raw, reuse as-is) + windowed `getSessionHistory` fragments + `getNeighborhood` graph-ranking, seed the neighborhood focus from the last ~2 fragments, graph-rank first and only add a local FTS5/lexical leg if benchmarked latency demands it. Ship the capability-dial commit IN THE SAME PHASE per Decision Gate Option A so policy and substrate land coherently. Fix BUG-01 (`lazygraphPath` -> `roomDbPath`) as an independent one-token tag-along.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `getRoomContext()` 3-leg fusion | API/Backend (`lib/core/*.cjs` shared core) | Database (`room.db` SQLite) | Pure in-process Node read over room.db; called by CLI hook path; 100% local per Canon Part 8 |
| Leg A room-state summary | Database (navigation.cjs chokepoint) | - | `getRoomHomeView` is a pure composition over the Phase 109 chokepoint |
| Leg B recent-message recency | Database (`fragments` table) | - | `getSessionHistory` reads verbatim turn log locally |
| Leg C relevance ranking | Database (recursive CTE over `nodes`/`edges`) | - | `getNeighborhood` is graph-structural; no network, no Brain |
| Retrieval seed (last ~2 turns) | API/Backend (per-turn hook) | Database (fragments) | The seed source is the fragments leg; the focus-node derivation is the new wiring |
| Capability-dial policy | Prompt layer (SKILL.md) | - | Doctrine for Larry-the-model; no code enforces it (CLI-honored only) |
| BUG-01 graph-export guard | Backend script (`build-graph-from-sqlite.cjs`) | - | Standalone export script reached via `graph-ops.cjs` execSync |

---

## User Constraints (from milestone scope, no CONTEXT.md yet)

This phase has no CONTEXT.md at research time (`has_context: false`). The binding constraints come from REQUIREMENTS.md (LARRYREACH), the Mindrian Canon, and the orchestrator's critical instruction:

### Locked Decisions (milestone-level, Decision Gate Option A)
- `getRoomContext()` is 100% local. Raw prose stays local. ZERO Part-8 exposure. (RETR-03)
- The capability-dial policy and the `getRoomContext()` substrate MUST ship coherently in the SAME phase (Decision Gate Option A) -- the dial's "Context Block" reach is exactly what RETR-01 implements.
- Per-turn assembly stays under the 1200ms NAV hard timeout: graph-ranking first; FTS5 only if benchmarked to underperform on a populated room.db. (RETR-04)
- Larry policy stays CLI-honored for v1.13.1. Desktop/Cowork dual-path wiring (`buildContext` -> `navigation.cjs`) is DEFERRED.

### Claude's Discretion (planner to decide)
- Whether Leg C uses `getNeighborhood` graph-ranking alone (recommended) or adds a new local FTS5 virtual table over `fragments.content` + `nodes.properties` (only if latency demands).
- Where `getRoomContext()` lives (recommended: new `lib/core/navigation/room-context.cjs` re-exported through `navigation.cjs`, the Part 9 chokepoint).
- The windowing/trim budget for the fragments leg.
- Exact `canon_parts` value within the validated set (see Larry section).

### Deferred Ideas (OUT OF SCOPE for Phase 141)
- Making `buildContext` (Phase 87-09 MCP/dashboard path) route through `navigation.cjs` -- the Desktop/Cowork dual-path fix.
- Bi-temporal edges Stage-2 PK-change migration (SLICE-D; that is a separate edges-history concern, not Phase 141).
- A code dispatcher that reads the capability-dial trigger column and auto-fires a reach (the policy stays prompt-layer doctrine).
- Local semantic/vector index (Pinecone is remote + Part-8-fenced; forbidden locally).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RETR-01 | `getRoomContext()` fuses Leg A (`getRoomHomeView` RAW) + Leg B (`getSessionHistory` fragments, windowed) + Leg C (`getNeighborhood` graph-ranking), seeded by last ~2 turns | All three legs verified live: room-home.cjs:102-141, memory-ops.cjs:314-333, neighborhood.cjs:48-79. Fusion symbol absent (grep exit 1) -- net-new. `packet.cjs` proves the fusion shape works. |
| RETR-02 | `getRoomContext()` wired as retrieval seed; per-turn loop stops forwarding `userText:null` | Confirmed: intent-classifier.cjs:1081 `userText: null, // hot path does not forward prompt content`. The seed change is the wiring this requirement names. |
| RETR-03 | Raw prose stays local: does NOT reuse `packet.cjs` projectText/hashText egress path | Confirmed: packet.cjs:130-139 `projectText` returns `hashText(s)` under default `local_summary_only`. `getRoomHomeView::safeShape` (room-home.cjs:29-43) is the raw-prose path to reuse instead. |
| RETR-04 | Per-turn assembly under 1200ms NAV timeout (graph-ranking first; FTS5 only if needed, benchmarked) | Confirmed: `NAV_HARD_TIMEOUT_MS = 1200` (intent-classifier.cjs:635), Promise.race at :1196. NO FTS5 today (grep exit 1) so graph-ranking-first is the only zero-build path. |
| LARRY-01 | "When to Reach -- The Capability Dial" SKILL.md committed to HEAD with `canon_parts` frontmatter + CHANGELOG | Confirmed uncommitted (HEAD=0, WT=1, ` M`, no `git log -S` hit). `canon_parts` precedent: skills/mva-pipeline/SKILL.md:7 `canon_parts: [Part 2, Part 8, Part 10]`. |
| LARRY-02 | Version bumped (next beta) with dial as tracked, release-noted change | Current: 1.13.1-beta.5 (plugin.json + package.json in sync). CHANGELOG `[Unreleased] -- v1.13.1-beta.5 (in progress)` has an empty `### Added`. |
| BUG-01 | Fix `build-graph-from-sqlite.cjs:53` ReferenceError (`lazygraphPath` undefined) | Confirmed: :50 defines `roomDbPath`; :53 references undeclared `lazygraphPath`. One-token fix. |

---

## getRoomContext() Validation Verdict

**VERDICT: BUILDABLE. All three legs are live; the fusion is net-new; the antipattern is real and avoidable.**

### Leg-by-leg live-code confirmation

| Leg | Function | File:line | Returns | Local-safe? |
|-----|----------|-----------|---------|-------------|
| A (room/USER summary) | `getRoomHomeView(db, roomId, opts)` | `lib/core/navigation/room-home.cjs:102-141` | 9-field object {currentThesis, confirmedFacts, riskyAssumptions, evidence, contradictions, openQuestions, recentChanges, bankedOpportunities, nextMove} | YES -- `safeShape` (room-home.cjs:29-43) truncates to 120 chars, returns RAW `summary\|\|claim\|\|title`, does NOT hash |
| B (recent raw messages) | `getSessionHistory(db, limit=10)` | `lib/core/memory-ops.cjs:314-333` | Sessions DESC each with nested `fragments[]` (role/content/timestamp/section_context) | YES -- verbatim `fragments` table (schema memory-ops.cjs:55-62), never hashed |
| C (relevance ranking) | `getNeighborhood(db, focusNodeId, opts)` | `lib/core/navigation/neighborhood.cjs:48-79` | Top-K graph neighbors ranked by frozen score | YES -- recursive CTE over local nodes/edges, structural-only, no network |

### The frozen score (Leg C ranking, neighborhood.cjs:14-46)
```
score = edge_type_weight * 0.4          (CONTRADICTS/INVALIDATES=1.0 ... default 0.3)
      + recency_decay(last_seen_at) * 0.2  (90-day hardcoded window)
      + COALESCE(confidence, 0.5) * 0.2
      + same_source_section_bonus * 0.2
```
Purely structural. No lexical or vector term. This is the local relevance substitute for the missing semantic leg.

### NO FTS5 (confirmed)
`grep -rniE 'using fts5|using fts4|using fts3|create virtual table|virtual table'` across lib/scripts/bin returned **exit 1** (zero hits). `room-db.cjs` sets only WAL + foreign_keys; the nodes table is plain with a TEXT properties JSON blob. There is NO local searchable index. (RETR-04 implication: graph-ranking-first is the only zero-build latency path; FTS5 is a net-new table if benchmarks demand it.)

### packet.cjs is the egress antipattern to NOT reuse (confirmed)
`lib/core/navigation/packet.cjs:130-139` -- `projectText(text, privacyMode)` returns `hashText(s)` under the default `local_summary_only` mode (and under `allow_filenames`). `shortText` (packet.cjs:144-159) routes every prose candidate through `projectText`. Reusing any of these would silently SHA256-away the very prose Larry needs. A local `getRoomContext()` MUST NOT import: `projectText`, `shortText`, `hashText`, `safeNodeProjection`, `safeContradictionProjection`, `safeUnsupportedProjection`, `resolvePrivacyMode`, `PRIVACY_MODES`.

### Implementation-ready guidance

**Function signature (recommended):**
```javascript
// lib/core/navigation/room-context.cjs  (re-exported through navigation.cjs)
// Local in-process 3-leg fusion. 100% local. NEVER egresses. Canon Part 8 + Part 9.
async function getRoomContext(db, roomId, opts) {
  // opts: { seedFragments?: Array, topK?: number, fragmentWindow?: number, maxDepth?: number }
  // returns: { summary, recentMessages, relevantNodes, _meta }
}
module.exports = { getRoomContext };
```

**The 3-leg fusion:**
1. **Leg A** -- call `getRoomHomeView(db, roomId, opts)` AS-IS. Its raw 9-field object is the room-state summary. Reuse `safeShape`'s raw path. Do not re-derive.
2. **Leg B** -- call `getSessionHistory(db, limit)` and WINDOW it: take the most recent session's last N fragments (the "short-term memory" clock). Apply a trim budget (the planner picks N and the char/token cap). `getSessionHistory` returns FULL fragment bodies with no budgeting today, so the windowing/trim step is net-new in the fusion.
3. **Leg C** -- derive a focus node from the last ~2 fragments (the seed), then call `getNeighborhood(db, focusNodeId, {topK, maxDepth})` for graph-ranked relevant nodes.

**The seed source (last ~2 fragments) -- the load-bearing new wiring:**
- Today every retrieval re-seeds from VENTURE STATE only (`focus.cjs::computeAutoFocus`: active JTBD -> unconfirmed DECISION_GATE -> room root -> null), never from conversation text (focus.cjs:106-143). That is why "do you remember X" does not pull X.
- Phase 141 introduces a conversation-derived seed: take the last ~2 fragments from Leg B, resolve them to a focus node (e.g. by matching fragment `section_context` to a `section:` node id, or by a cheap lexical match against `nodes.properties` to pick the best-overlapping node, then feed that id to `getNeighborhood`).
- This is the half SLICE-B identified as missing: "no path that turns a user prompt into a focus seed or a candidate-node set."

**The latency strategy (RETR-04):**
- Graph-ranking FIRST. `getNeighborhood` is a single recursive-CTE query with `topK`/`maxDepth` caps -- bounded and fast on a populated room.db.
- Only if benchmarked under a populated room.db does graph-ranking underperform should a LOCAL FTS5 virtual table over `fragments.content` + `nodes.properties` be added. FTS5 is a net-new SQLite migration (template: phase-109-nodes-provenance.cjs additive ALTER pattern). Do NOT build it speculatively.
- Whatever the fusion's total cost, it must finish inside the existing 1200ms `NAV_HARD_TIMEOUT_MS` Promise.race envelope (intent-classifier.cjs:635, :1196) OR run on a lane that does not block the hot path.

**Chokepoint note (Canon Part 9):** `navigation.cjs` already exports `getNeighborhood` (:52) and `getRoomHomeView` (:73) but NOT `getSessionHistory` (it lives only in `memory-ops.cjs`, re-exported at memory-ops.cjs:592). The fusion either adds `getSessionHistory` to the `navigation.cjs` chokepoint or calls `memory-ops` directly. Routing through `navigation.cjs` is the canon-preferred path (Part 9: "SQL remembers and navigates" via the single chokepoint). `getRoomContext` would be the first real consumer of `getSessionHistory`.

### RETR-03 / Canon Part 8 confirmation: 100% local, no egress
`getRoomContext()` feeds Larry's IN-PROCESS reasoning, never the wire. It reuses raw-prose paths (`getRoomHomeView::safeShape`, verbatim fragments) and explicitly excludes the packet.cjs hashing/privacy machinery. Canon Part 9 framing: Leg A + C = "SQL remembers and navigates" (structured), Leg B = the raw fragment substrate, the fusion is the "Larry explains" input assembly. **Confirmed 100% local. Zero Part-8 exposure.**

---

## THE LARRY UPGRADE -- "When to Reach: The Capability Dial" (LARRY-01 / LARRY-02)

> This is a PRIORITY requirement, researched as first-class -- not a commit chore. The dial is the in-voice articulation of the same reach the `getRoomContext()` substrate implements. Policy and substrate must ship coherently in the SAME phase (Decision Gate Option A).

### Validation of SLICE-G's 3-part finding (all confirmed against live code)

**(a) The section IS present and UNCOMMITTED.**
- `git show HEAD:skills/larry-personality/SKILL.md | grep -c "Capability Dial"` = **0**
- working-tree `grep -c "Capability Dial"` = **1**
- `git status --short` = ` M skills/larry-personality/SKILL.md`
- `git log -S "When to Reach -- The Capability Dial"` = **no commit found**
- Location: `skills/larry-personality/SKILL.md:31-49`. Line 31 heading; line 33 GUIDED-default framing; lines 35-40 the 5-row trigger-to-action table (Context Block / contradiction surface / cross-room reach / Brain consult); lines 42-48 the 5 Reach rules. Modeled on the pre-existing "Causal Reasoning Suggestions (v1.7.0)" table shape.
- **Risk:** a `git stash` or `git checkout` would lose it. It must be committed.

**(b) NOTHING in lib/scripts/hooks enforces it -- policy is prompt-layer only.**
- `grep -rn "When to Reach"\|"Capability Dial"\|"Context Block"` across lib/, scripts/, hooks/ returns nothing. No hook, classifier, or router consumes the trigger column. Larry-the-model is the sole executor.
- The underlying CAPABILITIES are all live (in `navigation.cjs`): `getNeighborhood`+`getRoomHomeView` (Context Block), `findContradictions`+`findSurfaceableTensions` (contradiction surface), `buildBrainPacket`+`storeBrainSuggestions`+`brain-client.cjs` (Brain consult), `cross-room-aggregator.cjs` (cross-room reach, Phase-83 fenced). But there is ZERO code wiring from the policy text to any executor.

**(c) The dual-path gap is confirmed -- buildContext bypasses navigation.cjs, so the policy is CLI-only.**
- `lib/core/chat-context-builder.cjs::buildContext` requires ONLY `node:path`, `node:fs`, `node:sqlite` (chat-context-builder.cjs:33-35). It opens room.db directly and NEVER requires `navigation.cjs`. It is the Phase 87-09 raw-SQL chat path.
- `buildContext` consumers: `lib/mcp/tool-router.cjs` (the Desktop/Cowork MCP path) + `scripts/serve-dashboard-live` (the live dashboard) + the test. So the policy-blind `buildContext` path ships simultaneously with the policy-bearing `navigation.cjs` path on DIFFERENT surfaces.
- **The deepest finding:** the When-to-Reach policy is honored by whatever calls `navigation.cjs` (the CLI hook path), and silently ignored by the MCP chat panel + live dashboard that call `buildContext`. The policy is effectively CLI-only.

### The proper wiring for LARRY-01/02

**1. canon_parts frontmatter.** The dial touches Canon Parts 2, 3, 8, 9 (cross-checked against MINDRIAN-CANON.md + CANON-PHASE-MAP.md):

| Canon Part | Why the dial touches it |
|------------|--------------------------|
| **Part 2** (Team affordances + web hat-scoping) | The four reaches ARE the team's BRAIN QUERY / TOOL ACCESS (LOCAL GRAPH) affordances rendered as Larry-voice triggers. The Brain-consult row maps to the BRAIN QUERY affordance. |
| **Part 3** (Tri-Context Decision Gate) | The contradiction row's "ONE line then Decision Gate APPROVE/REJECT/DEFER" is Part 3 verbatim. GUIDED default = surface, never decide. |
| **Part 8** (Graph Boundary) | The Brain-consult row's "carry ONLY generic handles, NEVER user bytes" + Reach rule 5 "Part 8 is the floor" are Part 8 verbatim. |
| **Part 9** (Memory Locality) | The Context Block reach is the "Larry explains" face of SQL-as-local-mind; the dated-facts + summary block IS what `getRoomContext()` assembles from `room.db`. |

Precedent for the frontmatter line: `skills/mva-pipeline/SKILL.md:7` -> `canon_parts: [Part 2, Part 8, Part 10]`. Recommended for this skill: `canon_parts: [Part 2, Part 3, Part 8, Part 9]`. Note the current `larry-personality/SKILL.md` frontmatter (HEAD) carries only `name` + `description` -- the `canon_parts` key is net-new on this file.

**2. CHANGELOG entry.** Fill the empty `### Added` under `[Unreleased] -- v1.13.1-beta.5 (in progress)` (or the next beta the planner cuts). It should say (in substance): "Larry now carries a tracked 'When to Reach -- The Capability Dial' policy section -- a GUIDED-default 5-row trigger map (Context Block / contradiction surface / cross-room reach / Brain consult) plus 5 Reach rules (one reach per beat, honesty gates every reach, the HOW lives elsewhere, Part 8 is the floor). Backed by the new local `getRoomContext()` retrieval spine for the Context Block reach." Plus a `### Added` line for `getRoomContext()` and a `### Fixed` line for BUG-01.

**3. How LARRY-01 relates to the getRoomContext work.** The dial's "Context Block" row (SKILL.md:37) describes exactly: "long-term memory: dated facts + a short summary, seeded by the last ~2 turns. The raw recent messages stay as short-term memory; the block is the long clock." That IS the three-leg fusion: Leg A (dated facts + summary) + Leg B (recent raw messages = short-term) + Leg C (relevance), seeded by the last ~2 turns. RETR-01 is the substrate; LARRY-01 is the in-voice policy that tells Larry WHEN to reach for it. Shipping them together (Decision Gate Option A) means Larry's promised reach and the code that fulfills it land in the same commit train -- no dangling promise, no orphan substrate.

**4. What "wired properly for v1.13.1" MEANS (in-scope) vs DEFERRED:**

| In scope for v1.13.1 (LARRY-01/02) | DEFERRED (out of scope) |
|-------------------------------------|--------------------------|
| Commit the SKILL.md section to HEAD | A code dispatcher that reads the trigger column and auto-fires a reach |
| Add `canon_parts: [Part 2, Part 3, Part 8, Part 9]` frontmatter | Code-enforcement of "one reach per beat" / GUIDED-default (stays model-side behavior) |
| Add CHANGELOG entry + bump version (next beta) | Making `buildContext` (Desktop/Cowork MCP + dashboard) route through `navigation.cjs` -- the dual-path fix |
| Land `getRoomContext()` so the Context Block reach has a real local substrate | Reconciling `classifyIntent`'s 5 buckets with the dial's 4 reaches |
| Keep the policy CLI-honored (it already is, via navigation.cjs) | A full cross-surface reach guarantee |

"Wired properly" for v1.13.1 = **the policy is tracked, canon-declared, version-noted, AND its central Context Block reach has a working local substrate (`getRoomContext`)** -- honored on the CLI path. It does NOT mean the Desktop/Cowork `buildContext` path is fixed; that dual-path closure is explicitly DEFERRED to a later phase.

### Canon alignment (SLICE-G note 4, confirmed against MINDRIAN-CANON.md)
The doctrine is already canon-consistent: contradiction row = Part 3 verbatim; cross-room fencing = Phase-83 / Part 8; Brain row = Part 8 "generic handles only"; GUIDED default = `feedback_larry_pedagogical_guided_first` memory rule. The DOCTRINE is canon-consistent even though the WIRING (code enforcement) is absent -- and absence of code enforcement is fine, because the policy is intentionally prompt-layer doctrine for v1.13.1.

---

## BUG-01 Verdict

**VERDICT: CONFIRMED. One-token fix.**

`scripts/build-graph-from-sqlite.cjs`:
- Line 50: `const roomDbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');` -- declared, correct.
- Line 53: `if (!fs.existsSync(lazygraphPath)) {` -- `lazygraphPath` is NEVER declared. `grep` for the symbol returns ONLY :50 (`roomDbPath`) and :53 (the typo). Unconditional ReferenceError once line 53 is reached.
- The exit-0 try/catch opens at line 66, AFTER the throwing guard at line 53. So the ReferenceError is UNCAUGHT and crashes non-zero, DEFEATING the script's stated never-fail / graceful exit-0 contract.

**The fix:**
```javascript
// scripts/build-graph-from-sqlite.cjs:53
if (!fs.existsSync(roomDbPath)) {   // was: lazygraphPath (undeclared -> ReferenceError)
  process.exit(0);
}
```

**Reach / who invokes it:** `lib/core/graph-ops.cjs:138` resolves the script path and (per its comment at :130) shells out to it; `lib/graph/canvas-graph.js:4` documents that `graph.json` (Cytoscape format) is built from it. Because the ReferenceError throws unconditionally at line 53 before any room.db check, this path is effectively dead in prod (it always crashes when reached) -- which is why the bug has survived. Recommend the planner add a tiny regression test that runs the script against a no-room-db dir and asserts exit 0 (proving the guard now reaches its intended graceful path). Independent of RETR/LARRY work.

---

## Standard Stack

No new external packages. This phase is pure in-repo CJS + SQLite (node:sqlite `DatabaseSync`) + a Markdown/frontmatter edit. The existing stack rule holds: filesystem + SQLite room.db, CJS modules, no new dependencies.

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `node:sqlite` (`DatabaseSync`) | Node >=18 built-in | room.db reads for the 3 legs | Already the room.db driver across navigation.cjs / memory-ops.cjs / packet.cjs [VERIFIED: live code, room-db.cjs] |
| CJS modules (`lib/core/navigation/*.cjs`) | n/a | Where `getRoomContext` lives | Mirrors the Phase 109 chokepoint pattern [VERIFIED: navigation.cjs] |

**Installation:** none. No `npm install`. (Package Legitimacy Audit therefore N/A -- no external packages introduced.)

---

## Architecture Patterns

### System Architecture Diagram

```
  UserPromptSubmit (per turn)
        |
        v
  intent-classifier.cjs  --- TODAY: turn.userText = null (loop OPEN, RETR-02 target)
        |                         re-seeds from venture state only (focus.cjs)
        |
        v  [Phase 141 wiring: seed from last ~2 fragments]
  getRoomContext(db, roomId, {seedFragments})         <--- NET-NEW (RETR-01)
        |
        +--> Leg A: getRoomHomeView(db, roomId)        [room-home.cjs, RAW prose, reuse]
        |
        +--> Leg B: getSessionHistory(db, limit)       [memory-ops.cjs, verbatim fragments]
        |            -> window/trim to last N fragments (NET-NEW step)
        |
        +--> Leg C: focusNode = resolve(last ~2 fragments)   (NET-NEW seed)
        |            -> getNeighborhood(db, focusNode, {topK, maxDepth})  [neighborhood.cjs, graph-rank]
        |
        v
  { summary, recentMessages, relevantNodes }  --- 100% LOCAL (RETR-03, Part 8)
        |
        v
  Larry in-process reasoning   (NEVER the wire; NOT packet.cjs/hashText)
        |
        v
  Larry voice obeys "When to Reach" Capability Dial   <--- LARRY-01 policy (prompt-layer)
        Context Block reach == this getRoomContext() output

  [DEFERRED] buildContext (MCP tool-router + dashboard) still bypasses navigation.cjs
             -> policy CLI-honored only for v1.13.1
```

### Recommended Project Structure
```
lib/core/navigation/
├── room-context.cjs        # NET-NEW: getRoomContext 3-leg fusion (Phase 141)
├── room-home.cjs           # EXISTING Leg A (reuse getRoomHomeView as-is)
├── neighborhood.cjs        # EXISTING Leg C (reuse getNeighborhood)
└── packet.cjs              # DO NOT REUSE its projectText/hashText (egress only)
lib/core/
└── memory-ops.cjs          # EXISTING Leg B (getSessionHistory + fragments)
lib/core/navigation.cjs     # chokepoint: re-export getRoomContext (+ maybe getSessionHistory)
scripts/build-graph-from-sqlite.cjs   # BUG-01 one-token fix at :53
skills/larry-personality/SKILL.md     # LARRY-01: commit section + canon_parts frontmatter
```

### Pattern 1: Fusion = packet.cjs shape WITHOUT hashing, PLUS a fragments leg
**What:** `packet.cjs::buildBrainPacket` already composes neighborhood + claims + assumptions + contradictions + recent_changes + banked_opportunities (packet.cjs:319-331). A local `getRoomContext()` is essentially that composition with the hashing removed and a raw fragments/recent-message leg + a thesis/summary leg added.
**When to use:** Always, for RETR-01.
**Key rule:** copy the composition SHAPE, never the projection functions.

### Anti-Patterns to Avoid
- **Reusing packet.cjs projection (projectText/shortText/hashText):** silently SHA256-hashes the prose Larry needs. RETR-03 violation. Use `getRoomHomeView::safeShape` raw path.
- **Building a local Pinecone/vector leg:** Pinecone is remote + Part-8-fenced; forbidden for local user content. Leg C is `getNeighborhood`, not embeddings.
- **Speculative FTS5:** do not add the virtual table unless benchmarked to be needed (RETR-04).
- **Auto-firing reaches from code:** the capability dial is prompt-layer doctrine for v1.13.1; do not build a dispatcher.
- **Forwarding raw userText to the Brain:** RETR-02 unblocks the seed for LOCAL retrieval only; the Brain still receives generic handles only (Part 8).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room-state summary | A new SQL summary query | `getRoomHomeView` (room-home.cjs:102) | Already a 9-field raw-prose composition, 8 reads, zero new SQL |
| Recent-message recency | A new fragments reader | `getSessionHistory` (memory-ops.cjs:314) | Returns nested verbatim fragments; just window it |
| Relevance ranking | A new scoring function | `getNeighborhood` (neighborhood.cjs:48) | Frozen weighted recursive-CTE score already tuned |
| Local prose-truncation | A new truncator | `safeShape` raw path (room-home.cjs:29) | Already truncates without hashing |
| Graceful exit-0 in build-graph | A rewrite | One-token `roomDbPath` fix | The script is correct except the typo |

**Key insight:** every leg already exists as a live, tested function. Phase 141 is ~90% wiring (Canon Part 7 reuse-before-build); the only net-new code is the fusion module + the fragment-seed resolver + the windowing step.

---

## Common Pitfalls

### Pitfall 1: Reusing the egress projection in the local fusion
**What goes wrong:** import `projectText`/`shortText` from packet.cjs; Larry's context arrives as SHA256 hashes.
**Why it happens:** packet.cjs is the nearest existing fusion and looks reusable.
**How to avoid:** explicitly exclude all packet.cjs projection/privacy exports; reuse `getRoomHomeView::safeShape`.
**Warning signs:** any sha256/hash in the `getRoomContext` output; any `require` of packet.cjs in room-context.cjs.

### Pitfall 2: Blowing the 1200ms budget
**What goes wrong:** adding an unbounded fragments dump or a speculative FTS5 build pushes per-turn assembly past `NAV_HARD_TIMEOUT_MS`.
**Why it happens:** `getSessionHistory` returns FULL fragment bodies with no budget; FTS5 is tempting.
**How to avoid:** window Leg B to last N fragments; graph-rank first; benchmark on a populated room.db before adding FTS5.
**Warning signs:** Promise.race timeouts in the navigation trace; large `recentMessages` arrays.

### Pitfall 3: Losing the uncommitted SKILL.md section
**What goes wrong:** a stash/checkout during planning drops the working-tree-only Capability Dial edit.
**Why it happens:** it is ` M`, in no commit (`git log -S` empty).
**How to avoid:** commit it EARLY in the phase (LARRY-01) before any branch/stash operation.
**Warning signs:** `git status` still shows ` M skills/larry-personality/SKILL.md` mid-phase.

### Pitfall 4: Assuming the policy is cross-surface
**What goes wrong:** treating LARRY-01 as a full cross-surface reach guarantee.
**Why it happens:** the policy reads universal.
**How to avoid:** scope it CLI-honored for v1.13.1; document the `buildContext` dual-path as DEFERRED.
**Warning signs:** plan tasks that touch `chat-context-builder.cjs` / `tool-router.cjs` / `serve-dashboard-live` (those are out of scope).

---

## Code Examples

### Leg A reuse (raw, no hash) -- room-home.cjs:29-43 (VERIFIED live)
```javascript
function safeShape(row) {
  let summary = '';
  try {
    const props = JSON.parse(row.properties || '{}');
    summary = props.summary || props.claim || props.title || '';
  } catch (_) { /* ignore */ }
  return {
    id: row.id, type: row.type,
    summary: summary.length > 120 ? summary.slice(0, 117) + '...' : summary, // RAW, not hashed
    reviewStatus: row.review_status, confidence: row.confidence, lastSeenAt: row.last_seen_at,
  };
}
```

### The antipattern -- packet.cjs:130-139 (VERIFIED live, DO NOT reuse)
```javascript
function projectText(text, privacyMode) {
  const s = (typeof text === 'string') ? text : '';
  if (privacyMode === 'allow_excerpts') { /* truncated excerpt */ }
  // Default (local_summary_only) AND allow_filenames: hash, never prose.
  return hashText(s);   // <-- SHA256. Wrong for local context assembly.
}
```

### RETR-02 target -- intent-classifier.cjs:1075-1083 (VERIFIED live)
```javascript
const turn = {
  userText: null, // hot path does not forward prompt content   <-- RETR-02 changes this
  sectionPath: sectionPath,
  sessionId: sessionId,
};
```

### BUG-01 fix -- build-graph-from-sqlite.cjs:50-55 (VERIFIED live)
```javascript
const roomDbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db'); // :50
// Graceful degradation: no room.db means no graph data
if (!fs.existsSync(roomDbPath)) {  // :53 was lazygraphPath (undeclared -> ReferenceError)
  process.exit(0);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SessionStart full-room dump (budget-trimmed) | Per-turn `getRoomContext` relevance fusion | Phase 141 (this) | "Here is what is relevant to your question" instead of "here is the whole room trimmed to fit" |
| Retrieval seeded by venture state only | Retrieval seeded by last ~2 conversation turns | Phase 141 (RETR-02) | Closes the open conversation-to-retrieval loop |
| Capability dial in working-tree limbo | Tracked SKILL.md section, canon-declared, versioned | Phase 141 (LARRY-01/02) | Policy is durable, not loseable on a stash |

**Deprecated/outdated:**
- `notImplementedYet()` stub factory (navigation.cjs:40-44): DEAD CODE -- defined but unused; every export points at a real function. Harmless; do not depend on it.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `canon_parts: [Part 2, Part 3, Part 8, Part 9]` is the right set for the dial | Larry upgrade | LOW -- the planner/discuss-phase can adjust; all four are defensible from canon text. Confirm with user if a part is contested. |
| A2 | Graph-ranking alone meets the 1200ms budget on a populated room.db (no FTS5 needed) | RETR-04 | MEDIUM -- needs a benchmark on a real populated room.db; if it fails, an FTS5 leg is the documented fallback (still in scope as a contingency). |
| A3 | The fragment-to-focus-node seed resolver can be built without embeddings (section_context match + cheap lexical pick) | getRoomContext guidance | MEDIUM -- if structural matching proves too coarse, a local FTS5 lexical match is the fallback (A2 covers the build). |
| A4 | The next beta is the version target for LARRY-02 | RETR/Larry version | LOW -- current is 1.13.1-beta.5; planner picks beta.6 or per release ceremony. |

**Note:** No `[ASSUMED]` package claims (no external packages). All file:line claims are `[VERIFIED: live code]` this session.

---

## Open Questions

1. **Where does `getRoomContext()` write its telemetry / memory_event, if any?**
   - What we know: navigation.cjs is the chokepoint; focus.cjs writes `focus_changed` memory_events (carve-out blessed).
   - What's unclear: whether a conversation-seeded retrieval should log a memory_event (e.g. `context_assembled`) and whether that needs an EVENT_TYPES additive bump (Phase 124 added +2).
   - Recommendation: planner decides; if logged, treat it as a system-bookkeeping audit node (Part 9 carve-out), `created_by=system review_status=confirmed`.

2. **Exact window size N for Leg B and topK/maxDepth for Leg C.**
   - What we know: `getSessionHistory` default limit 10 sessions; `getNeighborhood` defaults topK=20, maxDepth=2.
   - What's unclear: the right per-turn budget under 1200ms.
   - Recommendation: start with last 1 session + last ~6 fragments windowed, topK 10-20, maxDepth 2; tune via the RETR-04 benchmark.

3. **Does RETR-02 forward userText only to the LOCAL seed, never further?**
   - What we know: Part 8 forbids userText reaching the Brain; the seed is local-only.
   - Recommendation: assert in a test that the un-nulled userText path never reaches `buildBrainPacket`/brain-client; keep the Brain on generic handles.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >=18 (node:sqlite) | all 3 legs + fusion | (assumed, project baseline) | - | - |
| Populated room.db | RETR-04 benchmark | depends on test fixture | - | Build a fixture room.db with fragments + nodes + edges |

No external services. Pinecone/Brain are NOT used by this phase (Part 8). Code/data-only changes.

---

## Validation Architecture

> nyquist_validation is enabled (config workflow.nyquist_validation = true).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node CJS test scripts (`tests/test-*.cjs`) + per-phase bash runner (`tests/run-all-<phase>.sh`) |
| Config file | none -- bash runner aggregates CJS suites (pattern: tests/run-all-126.sh) |
| Quick run command | `node tests/test-<suite>.cjs` |
| Full suite command | `bash tests/run-all-141.sh` (NET-NEW -- create in Wave 0, mirror run-all-126.sh) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RETR-01 | 3-leg fusion returns {summary, recentMessages, relevantNodes} from a fixture room.db | unit | `node tests/test-get-room-context.cjs` | Wave 0 |
| RETR-02 | per-turn path forwards conversation seed (not null) into local retrieval only | unit | `node tests/test-retrieval-seed.cjs` | Wave 0 |
| RETR-03 | `getRoomContext` output contains RAW prose, ZERO sha256/hash; no packet.cjs require | unit (adversarial) | `node tests/test-room-context-part8-invariant.cjs` | Wave 0 |
| RETR-04 | per-turn assembly under 1200ms on a populated fixture room.db | perf/bench | `node tests/test-room-context-latency.cjs` | Wave 0 |
| LARRY-01 | section in HEAD; canon_parts frontmatter present; CHANGELOG entry present | smoke | `node tests/test-capability-dial-committed.cjs` | Wave 0 |
| BUG-01 | build-graph exits 0 against a no-room-db dir (guard reaches graceful path) | regression | `node tests/test-build-graph-guard.cjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single suite for that task (e.g. `node tests/test-get-room-context.cjs`)
- **Per wave merge:** `bash tests/run-all-141.sh`
- **Phase gate:** full run-all-141 green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-141.sh` -- scoped runner (mirror tests/run-all-126.sh header + CJS_SUITES list)
- [ ] `tests/test-get-room-context.cjs` -- RETR-01 fusion shape + raw-prose assertion
- [ ] `tests/test-retrieval-seed.cjs` -- RETR-02 seed wiring
- [ ] `tests/test-room-context-part8-invariant.cjs` -- RETR-03 adversarial forbidden-substring sweep (mirror Phase 90 5-tripwire + Phase 124 canon-invariant pattern)
- [ ] `tests/test-room-context-latency.cjs` -- RETR-04 1200ms budget on a populated fixture
- [ ] `tests/test-capability-dial-committed.cjs` -- LARRY-01 HEAD + frontmatter + CHANGELOG
- [ ] `tests/test-build-graph-guard.cjs` -- BUG-01 exit-0 regression
- [ ] A populated fixture room.db (fragments + nodes + edges) under tests/fixtures/

---

## Security Domain

> security_enforcement absent in config = enabled. The dominant security concern here is Canon Part 8 (graph boundary), which is the system's own constitution.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local in-process reads; no auth surface |
| V3 Session Management | no | room.db is local |
| V4 Access Control | yes | Phase-83 room scope isolation (cross-room reach fenced) -- not touched here but adjacent |
| V5 Input Validation | partial | fragment/node text is local prose; the seed resolver must not inject into SQL (use prepared statements, as existing legs do) |
| V6 Cryptography | no (do NOT hand-roll) | `hashText` exists for egress only; the local fusion must NOT hash |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Canon Part 8 breach: local prose reaches the Brain | Information Disclosure | `getRoomContext` is in-process only; never feeds buildBrainPacket; adversarial forbidden-substring test (RETR-03) |
| SQL injection via fragment-derived seed | Tampering | Use `db.prepare(...)` bound params (the pattern all existing legs follow) |
| userText egress after RETR-02 un-nulls it | Information Disclosure | Assert userText stays on the LOCAL seed lane; Brain stays on generic handles only |
| Cross-room blend in Leg C | Information Disclosure | `getNeighborhood` reads the active room's nodes/edges only; do not widen scope |

---

## Sources

### Primary (HIGH confidence -- live code this session)
- `scripts/build-graph-from-sqlite.cjs:50,53` -- BUG-01 confirmed (roomDbPath vs lazygraphPath)
- `lib/core/navigation/room-home.cjs:29-43,102-141` -- Leg A getRoomHomeView + safeShape raw path
- `lib/core/memory-ops.cjs:55-62,314-333,592` -- Leg B getSessionHistory + fragments schema
- `lib/core/navigation/neighborhood.cjs:14-79` -- Leg C getNeighborhood + frozen score
- `lib/core/navigation/packet.cjs:130-159` -- projectText/shortText HASH under default mode (antipattern)
- `lib/core/navigation.cjs:40-44,52,73` -- chokepoint exports; notImplementedYet dead code
- `scripts/intent-classifier.cjs:635,1075-1083,1196` -- userText:null + NAV_HARD_TIMEOUT_MS=1200
- `lib/core/chat-context-builder.cjs:33-35` -- buildContext requires only node builtins (dual-path)
- buildContext consumers: lib/mcp/tool-router.cjs, scripts/serve-dashboard-live (CLI-only policy gap)
- git: HEAD=0 / WT=1 Capability Dial; ` M` status; no `git log -S` hit (uncommitted)
- `skills/larry-personality/SKILL.md:31-49` -- the Capability Dial section + Reach rules
- `skills/mva-pipeline/SKILL.md:7` -- canon_parts frontmatter precedent
- FTS5 grep across lib/scripts/bin -- exit 1 (NO virtual table)
- getRoomContext/assembleContext/smartContext grep -- exit 1 (absent)
- `.claude-plugin/plugin.json` + `package.json` -- version 1.13.1-beta.5
- `docs/MINDRIAN-CANON.md` (v1.5) Parts 2/3/8/9; `docs/CANON-PHASE-MAP.md`

### Secondary (MEDIUM confidence -- fan-out slices, cross-validated against live code)
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-B.md` (retrieval today)
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-E.md` (context-block design)
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-G.md` (capability dial)
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-D.md` (line-53 bug)
- `.planning/research/v1.13.1-larryreach-fanout/SLICE-PHASE-MAP.md` (Phase 141 row)

---

## Metadata

**Confidence breakdown:**
- getRoomContext legs: HIGH -- every leg verified at file:line; fusion symbol confirmed absent
- BUG-01: HIGH -- one-token typo verified, grep shows only two hits
- Larry upgrade: HIGH -- git state + grep + canon cross-check all confirmed
- Latency strategy (A2): MEDIUM -- needs a populated-room.db benchmark to lock FTS5-or-not

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable local codebase; re-verify if navigation.cjs/memory-ops.cjs change)
