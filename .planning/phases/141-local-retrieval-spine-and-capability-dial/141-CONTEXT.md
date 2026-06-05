---
canon_parts: [Part 2, Part 3, Part 8, Part 9]
---

# Phase 141: Local Retrieval Spine + Capability Dial - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Milestone:** v1.13.1 "Larry Reaches" (beta.7) - Decision Gate Option A

<domain>
## Phase Boundary

Phase 141 delivers four coherent things, in one PR train:

1. **`getRoomContext()`** - the local, in-process, three-leg fusion (Leg A `getRoomHomeView` RAW summaries + Leg B windowed `getSessionHistory` fragments + Leg C `getNeighborhood` graph-ranking), seeded by the last ~2 conversation turns. 100% local, zero Brain egress (Canon Part 8).
2. **The capability dial committed** - lift the "When to Reach -- The Capability Dial" `SKILL.md` section out of working-tree limbo into HEAD with `canon_parts` frontmatter, CHANGELOG entry, version bump, AND 5 stable machine-readable reach ids + a drift test (LARRY-03).
3. **The FILEVAL evidence-filing substrate** - a typed-evidence-node + provenance + read-back-validation helper, built test-first against a fixture (FILEVAL-02), ready for later producers to plug into.
4. **BUG-01** - the one-token line-53 `lazygraphPath -> roomDbPath` fix in `build-graph-from-sqlite.cjs` + a regression test.

**The deep-research reach (DRSCH) ships as DOCTRINE ONLY this phase** - the dial text is committed and tracked, exactly like the other four reaches stay prompt-layer. No executable deep-research plumbing in 141 (see Deferred).

New capabilities (the dial-TUI selector, insight sensors, the navigation-engine flip, DRSCH execution) belong to Phases 142-146 and are out of scope here.

</domain>

<decisions>
## Implementation Decisions

### DRSCH scope (D-01)
- **D-01:** DRSCH is **doctrine-only** in 141. Commit the deep-research dial row (already in the working tree) + reach rule 6. Do NOT build the executable framework-led research path (plan builder, plan-gated fetch, hat-scoped web execution, evidence filing from real fetches) in this phase. This keeps 141 consistent with the other four prompt-layer reaches and bounded. DRSCH-01..04 are satisfied at the DOCTRINE level (the dial articulates the when/what/how-gated); their EXECUTION defers.

### FILEVAL-02 timing (D-02)
- **D-02:** Build the **typed-evidence-filing + read-back-validation path in 141** (overrides the "defer" default). Stand up the helper that writes a research/decision conclusion to `room.db` as a typed evidence node with provenance AND asserts the write landed (read-back), surfacing a failed filing rather than swallowing it (the FILEVAL honesty rule).
- **D-02a (constraint):** Because DRSCH is doctrine-only (D-01), 141 has **no live producer** of real research conclusions. Therefore the filing/validation helper MUST be built **test-first against a fixture evidence node**. Its first real producers are deferred DRSCH execution and Phase 143 FILEVAL-01 (Decision-Gate selections). The planner must treat "unused-consumer" as expected, not a smell - the value is a ready, tested substrate that 142/143 plug into without rework.

### RETR-02 hot-path wiring (D-03)
- **D-03:** 141 lands `getRoomContext()` **and flips the live per-turn seed** - un-null `userText` in the hot path (intent-classifier.cjs:1081) so retrieval seeds from the last ~2 turns, not venture-state only. This is what RETR-02 literally names; it closes the conversation-to-retrieval loop now.
- **D-03a (fence):** The un-nulled `userText` flows to the **LOCAL seed lane only**. It MUST NOT reach `buildBrainPacket`/brain-client. A test asserts the Brain still receives generic handles only (Part 8). RETR-02 unblocks LOCAL retrieval, never Brain egress.

### Structural defaults accepted (D-04)
- **D-04a:** `getRoomContext()` lives in a NET-NEW `lib/core/navigation/room-context.cjs`, re-exported through `navigation.cjs` (the Part 9 chokepoint). `getRoomContext` becomes the first real consumer of `getSessionHistory` - add it to the chokepoint rather than calling memory-ops directly.
- **D-04b:** Leg C is **graph-ranking-first**. NO speculative FTS5. A local FTS5 virtual table is built ONLY if a benchmark on a populated room.db shows graph-ranking misses the 1200ms budget (RETR-04). FTS5 stays a documented contingency, not a default.
- **D-04c:** `canon_parts: [Part 2, Part 3, Part 8, Part 9]` on the committed `SKILL.md`. (Part 2 covers the EXTERNAL WEB affordance the deep-research reach articulates.)
- **D-04d:** BUG-01 = one-token `roomDbPath` fix at line 53 + a regression test that runs the script against a no-room-db dir and asserts exit 0.

### LARRY-03 reach-id contract (D-05)
- **D-05:** The committed dial encodes exactly **5 stable machine-readable reach ids**: `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`. A drift test asserts the reach bank covers EXACTLY these 5 (no more, no fewer) so the downstream Phase-143 dial-TUI label composer + orchestrator key off them. Near-zero-cost prep for DIALTUI.

### What is present vs net-new in the working-tree dial (D-07 - executor precision)
- **D-07:** Verified against `skills/larry-personality/SKILL.md` working tree (` M`, uncommitted):
  - **PRESENT as prose doctrine** (just needs committing): all 5 reach ROWS including the deep-research 5th row (framework-led plan, hat-scoped angles, plan-gated fetch, /mos:research reuse) AND reach rule 6 (deep research plan-gated, may chain).
  - **NET-NEW at execution** (must be ADDED, not just `git add`-ed): (1) the `canon_parts: [Part 2, Part 3, Part 8, Part 9]` frontmatter line - frontmatter is currently only `name` + `description` (LARRY-01); (2) the 5 machine-readable reach ids `context_block/contradiction/cross_room/brain_consult/deep_research` - the dial today carries only prose, no machine tokens (LARRY-03); (3) the drift test asserting exactly 5 ids (LARRY-03); (4) the CHANGELOG entry + version bump (LARRY-01/02).
  - **EXPLICITLY NOT in 141:** any executable invocation that fires the deep-research reach. The reach is articulated as doctrine; nothing in code invokes it (D-01). The HOW/execution defers (see Deferred).

### Execution ordering (D-06)
- **D-06:** **Commit the dial FIRST**, as execution step 1, before any branch/stash/worktree operation. The `SKILL.md` edit is currently ` M` (uncommitted, in no commit per `git log -S`); a stash or checkout would lose it. This is a hard ordering constraint on the executor, not a suggestion.

### Claude's Discretion (planner decides)
- Window size N for Leg B and topK/maxDepth for Leg C (research suggests last 1 session + ~6 fragments, topK 10-20, maxDepth 2; tune via the RETR-04 benchmark).
- Whether `getRoomContext()` logs a `context_assembled` memory_event (and whether that needs an additive EVENT_TYPES bump). If logged, treat as a Part 9 audit-node carve-out (`created_by=system review_status=confirmed`).
- The exact typed evidence-node shape + provenance fields for the FILEVAL helper (must be Part 4 / Part 9 consistent; align with the cascade-edge schema).
- The fragment-to-focus-node seed resolver strategy (section_context match + cheap lexical pick; FTS5 fallback shares D-04b's benchmark gate).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase research + scope (read first)
- `.planning/phases/141-local-retrieval-spine-and-capability-dial/141-RESEARCH.md` - the getRoomContext + capability-dial research (HIGH confidence, file:line verified). NOTE: predates DRSCH/LARRY-03/FILEVAL-02.
- `.planning/REQUIREMENTS.md` (LARRYREACH section, lines ~715-743) - the authoritative RETR/LARRY/DRSCH/FILEVAL/BUG requirement text. Fuller than 141-RESEARCH.md.
- `.planning/v1.13.1-EXECUTION-PLAN.md` - the HARD-RULE contract (FOLD-IN AMENDMENT governs phases 140-146).
- `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/LARRY-REACHES-CONTEXT-INDEX.md` - master context index (one read = full milestone context).

### DRSCH plan-time fold (MANDATORY at plan time)
- `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/DEEP-RESEARCH-PARADIGM-online.md` - the deep-research paradigm study (plan-and-execute + framework-shaped Brain planner + hat-scoped Tavily). **The planner/phase-researcher MUST fold this into 141 research so the DRSCH doctrine is GSD-researched, not assumed** - even though DRSCH is doctrine-only, the committed dial text must reflect this study.

### Canon (the dial's constitutional basis)
- `docs/MINDRIAN-CANON.md` - Part 2 (Team affordances + EXTERNAL WEB hat-scoping), Part 3 (Tri-Context Decision Gate), Part 8 (Graph Boundary - the local-only floor), Part 9 (Memory Locality - SQL is the local mind).
- `docs/CANON-PHASE-MAP.md` - Part 9 + Part 10 rows; the phase-to-canon contract.

### Reuse precedents (Part 7)
- `skills/larry-personality/SKILL.md` (lines ~31-60) - the uncommitted Capability Dial section (LARRY-01 input).
- `skills/mva-pipeline/SKILL.md:7` - `canon_parts` frontmatter precedent.
- `lib/core/navigation/room-home.cjs:29-43,102-141` - Leg A (`getRoomHomeView` + `safeShape` raw path - reuse as-is).
- `lib/core/memory-ops.cjs:314-333,592` - Leg B (`getSessionHistory` + fragments - window it).
- `lib/core/navigation/neighborhood.cjs:14-79` - Leg C (`getNeighborhood` + frozen score - reuse).
- `lib/core/navigation/packet.cjs:130-159` - the egress ANTIPATTERN: `projectText`/`shortText`/`hashText`. DO NOT import (RETR-03).
- `scripts/intent-classifier.cjs:635,1075-1083,1196` - the `userText:null` hot-path seed + `NAV_HARD_TIMEOUT_MS=1200`.
- `scripts/build-graph-from-sqlite.cjs:50,53` - BUG-01 site.
- `lib/core/feynman/timeline-renderer.cjs` + Phase 124 sentinel pattern - the render-from-graph precedent for the DEFERRED MEMDIAL memory-MD projection (not built in 141).

### Forward-coupling (read so 141 doesn't paint 142/143 into a corner)
- `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/DIAL-TUI-DESIGN-BRIEF.md` + `DIAL-TUI-DECISION-GATE.md` - Phase 143 consumes the 5 reach ids (D-05). Keep ids stable.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (~90% of 141 is wiring, Canon Part 7)
- `getRoomHomeView` (Leg A), `getSessionHistory` (Leg B), `getNeighborhood` (Leg C) - all live, tested functions. Net-new code = the fusion module + the fragment-seed resolver + the Leg B windowing + the FILEVAL helper + the drift test.
- `safeShape` raw-prose truncation (room-home.cjs:29) - reuse instead of any new truncator; never hash.

### Established Patterns
- `navigation.cjs` is the single Part 9 chokepoint - re-export `getRoomContext` (and `getSessionHistory`) through it.
- Typed-evidence + provenance follows the Part 4 cascade-edge schema (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES) + Part 9 truth-states + audit-node carve-out.
- Adversarial forbidden-substring invariant tests (Phase 90 5-tripwire, Phase 124 canon-invariant, Phase 110-05 seed) - mirror for the RETR-03 / Part 8 sweeps.
- Per-phase test runner pattern (`tests/run-all-126.sh`) - mirror as `tests/run-all-141.sh`.

### Integration Points
- The per-turn hot path (intent-classifier.cjs) - D-03 flips the seed here, inside the 1200ms Promise.race envelope.
- The FILEVAL helper writes through the navigation.cjs chokepoint to room.db (the frozen-since-May-31 local graph; 141 is a first writer toward closing the FILEVAL gap).

</code_context>

<specifics>
## Specific Ideas

- The dial's "Context Block" row IS the `getRoomContext()` output - policy and substrate must read coherently (Option A). Reviewer should be able to trace the dial row to the function.
- BUG-01 regression test must prove the guard reaches its graceful exit-0 path (the ReferenceError currently makes the export path effectively dead).

</specifics>

<deferred>
## Deferred Ideas

- **DRSCH executable plumbing** - the framework-led plan builder, the Decision-Gate plan presentation, hat-scoped web fetch (reusing /mos:research + the deep-research skill + Phase 131 research-as-graph-aware-workflow), and filing real fetched conclusions. Later phase. 141 ships only the doctrine + the (fixture-tested) filing substrate.
- **Desktop/Cowork dual-path fix** - making `buildContext` (chat-context-builder.cjs / tool-router.cjs / serve-dashboard-live) route through navigation.cjs so the dial policy is cross-surface. The policy stays CLI-honored for v1.13.1.
- **A code dispatcher** that reads the dial trigger column and auto-fires a reach. The dial stays prompt-layer doctrine.
- **MEMDIAL memory-MD projection** - rendering dial/reach activity FROM the graph into a FEYNMAN-style sentinel-bounded memory section. Phase 143 (MEMDIAL-01..03).
- **Local semantic/vector leg** - Pinecone is remote + Part-8-fenced; forbidden locally. Leg C is graph-ranking, not embeddings.
- **Bi-temporal edges Stage-2 PK-change migration** (SLICE-D) - separate edges-history concern.

</deferred>
