---
canon_parts: [Part 2, Part 3, Part 8, Part 9]
---

# Phase 141: Local Retrieval Spine + Capability Dial - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Milestone:** v1.13.1 "Larry Reaches" (beta.7) - Decision Gate Option A

<domain>
## Founding-intent anchor (why this phase is the core job, not a feature)

Per the founding JTBD paper (Sagir, March 2026, `docs/research/LIVE_DATA_ROOM_JTBD_PAPER.md`): the core job of MindrianOS is to "**reduce the time between insight and validated decision** across every dimension of the venture simultaneously" - the #1 underserved outcome (Opportunity Score 18). The founding vision promised a LOOP: insight enters -> surfaced against the venture graph (the Risk Sentinel "surface what's about to break") -> validated decision -> decision becomes graph data -> next surfacing is smarter ("becomes more valuable over time"). Until now the room CAPTURED but the loop never FIRED per turn: no `getRoomContext` (Larry could not walk the graph mid-conversation), `userText:null` (the per-turn loop stayed open, insight never seeded retrieval), ungrounded dials (Larry reacted to chat instead of navigating the nested Simon system), decisions not typed edges (no flywheel). Phase 141 + LARRY-04 CLOSE that founding loop: getRoomContext = walk the graph per turn; RETR-02 = insight seeds retrieval; the Hierarchical Navigator + graph-grounded dials = Larry as the hierarchical search navigator; FILEVAL = decision becomes graph data. This phase is where the Live Data Room becomes live. Treat the requirements as the core job, not features.

**Prof. Aronhime's design language (the evolution March -> now, authoritative).** Lawrence's own explanation site (scraped to `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/ARONHIME-EVOLUTION-EXPLANATION-scraped.md`) states this session's derived doctrine verbatim. The LARRY-04 / dial doctrine text SHOULD quote him:
- **"The insight belongs to you; the reach belongs to the tool."** = D-13 dial governance (user is captain; the Capability dial is the reach). Usher steps 1-2 (perceive + set the stage) are the tool's; steps 3-4 (insight + validation) stay the human's.
- **"Improving information retrieval produced four times more accuracy improvement than improving the reasoning model... reach matters more than raw intelligence."** = the justification for `getRoomContext` and the "Larry Reaches" milestone. Retrieval is the 4x lever. This phase builds the lever.
- **"Knowing when to stay quiet... a wrong suggestion is worse than no suggestion... restraint is the product working correctly."** = the `hold` posture (D-12) + honesty floor + expected-value-over-inaction.
- **The temporal search gradient** (Aronhime's original contribution: UDP->IDP->WDP as a directional gradient with matched toolsets) = LARRY-04's push_forward/pull_back across stages. The **bidirectional Ackoff DIKW descent** ("has your confidence earned its evidence?") = the pull_back diagnostic.
- **"One move, grounded in what your workspace actually contains"** = the Decision Gate offered MOVE + one-reach-per-beat. We are implementing Lawrence's stated design, not inventing doctrine.

## Phase Boundary

Phase 141 delivers four coherent things, in one PR train:

1. **`getRoomContext()`** - the local, in-process, three-leg fusion (Leg A `getRoomHomeView` RAW summaries + Leg B windowed `getSessionHistory` fragments + Leg C `getNeighborhood` graph-ranking), seeded by the last ~2 conversation turns. 100% local, zero Brain egress (Canon Part 8).
2. **The capability dial committed** - lift the "When to Reach -- The Capability Dial" `SKILL.md` section out of working-tree limbo into HEAD with `canon_parts` frontmatter, CHANGELOG entry, version bump, AND 5 stable machine-readable reach ids + a drift test (LARRY-03).
3. **The FILEVAL evidence-filing substrate** - a typed-evidence-node + provenance + read-back-validation helper, built test-first against a fixture (FILEVAL-02), ready for later producers to plug into. Graph-first (room.db is source of truth); the evidence-node schema reserves a provenance field for the deferred MD/fractal-artifact projection (D-09, D-10). Includes the **nested fractal artifact CONTRACT** (Decision 16 path shape + Decision 15 ROOM.md identity) that DRSCH conclusions will use, even though the producer defers.
4. **BUG-01** - the one-token line-53 `lazygraphPath -> roomDbPath` fix in `build-graph-from-sqlite.cjs` + a regression test.

**The deep-research reach (DRSCH) ships as DOCTRINE ONLY this phase** - the dial text is committed and tracked, exactly like the other four reaches stay prompt-layer. No executable deep-research plumbing in 141 (see Deferred).

5. **Larry as Hierarchical Navigator (LARRY-04, doctrine)** - a NET-NEW prompt-layer Larry-skill section that grounds BOTH dials (Ask-Tell pedagogy + Capability reach) in the ICM-hierarchical position (subsystem/level + journey-stage, Part 2a) + the FULL graph-SQL state `getRoomContext()` surfaces, mapping them to a pedagogical posture + offered move. Doctrine only in 141; the executable enforcement rides Phase 143 (SENS) + 144 (NAV).

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

### Larry as Hierarchical Navigator + dial governance (D-11, D-12, D-13)
> LARRY-04 doctrine. Net-new prompt-layer Larry-skill section. Doctrine in 141; executable enforcement rides 143 (SENS) + 144 (NAV).

- **D-11 (read depth = FULL graph state):** The Hierarchical Navigator doctrine has Larry read, every beat: ICM-hierarchical position (which near-decomposable subsystem/level) + journey-stage (Part 2a) + the FULL graph-SQL state `getRoomContext()` surfaces (confirmed vs proposed, contradictions, evidence tiers per Part 5, thin spots, convergence). It maps that to a pedagogical POSTURE + an offered MOVE (one of the 10 Decision-Gate verbs / framework / reach + how). Push forward on accumulating confirmed evidence + a well-defined subsystem ready to climb a level or advance a stage; pull back on unresolved contradictions, None-tier evidence near a commit, or circular/stuck/regression signals (Decision 14 bidirectional; Appendix E trigger 4).
- **D-12 (3 stable posture ids + drift test):** The doctrine encodes exactly 3 stable machine-readable posture ids `{push_forward, hold, pull_back}` + a drift test asserting exactly 3 (mirrors LARRY-03's exactly-5-reaches), so the Phase 143 SENS sensors + Phase 144 NAV engine key off them. Near-zero-cost prep, same pattern as the reach ids.
- **D-13 (DIAL ARBITRATION - one helm, the user; the dials are instruments, not captains):** The two dials must NOT become "two captains, one ship" - two controllers both emitting steering commands, which produces conflict and oscillation. Resolution: **neither dial is a captain. The USER is the captain and holds the only helm** (Part 1: the navigator decides; Part 2: the team proposes, never impersonates; Part 9 role 5: the human confirms). The ship metaphor maps onto canon: user = captain-navigator who steers; Larry's two dials = a SINGLE navigation instrument that plots routes but never touches the wheel.
  - **Internal arbitration = reach precedes push (NOT one dial ruling the other).** The Capability dial evaluates first (does the turn need a reach?); the reach RESULT sets the posture (push_forward/hold/pull_back, D-12); the Ask-Tell dial sets intensity WITHIN that posture. This collapses two readings into ONE coherent instrument reading - it is arbitration, not domination. There is no "winner dial."
  - **The reading is advisory; the captain steers.** The single reading surfaces to the user at the Decision Gate (Part 3). No dial steers; no bot steers; the helm is the user's alone.
  - Reach pending/failed -> `hold` -> "let me search" (honesty floor, Reach rule 3). Contradiction -> `pull_back` -> Decision Gate, never a verdict. Confirmed evidence -> `push_forward`. No reach (JUST_TALK) -> the instrument is quiet, conversation runs free.
  - **The captain overrides the instrument:** an explicit "just tell me / bottom line" delivers immediately, honestly flagged (grounded vs unverified). The instrument advises Larry's DEFAULTS, never the captain's command.
  - Surfaces in the dial as a new **Reach rule 7 (arbitration/precedence)** with the anti-pattern named explicitly (see grounding below).
  - **GROUNDED (deep-research pass complete, 2026-06-05; full study at `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/CONTEXT-MANAGEMENT-FRONTIER-online.md`):** the working model is confirmed by the frontier and sharpened:
    - **The dials are NOT two controllers - they are two dimensions of ONE decision cycle (CoALA, arXiv 2309.02427).** One decision procedure loops: PLANNING (propose -> evaluate -> select among an action space, using memory) then EXECUTION (run the selected action). The Capability dial = internal action-selection (which retrieval/reach to run in planning); the Ask-Tell dial = the external grounding action (the response, in execution). "Reach precedes push" IS the CoALA cycle (internal retrieval precedes external grounding). This is the precise dissolution of "two captains": there is only one decision procedure, never two.
    - **Helm model is named: HIC + AITL** (Red Hat human-AI loop taxonomy). The user is Human-in-Command (sole authority); Larry is AI-in-the-loop assistance. The Decision Gate is the authority-transfer protocol (Burstein and McDermott 1996, central authority manager).
    - **Reach trigger = expected value over inaction** (Horvitz mixed-initiative, CHI 1999): a reach fires only when its expected value to the navigator beats staying quiet. Sharpens Reach rule 1 (GUIDED).
    - **The anti-pattern has a literature name: Reasoning-Action Disconnect** (action contradicts the reasoning that preceded it) - cite it alongside "two captains, one ship". Mitigation = structural control of the reasoning-to-action seam = reach-precedes-push + honesty floor.
    - **Transparency is mandatory** to avoid mode-confusion / automation-surprise (Sarter and Woods; Parasuraman/Sheridan/Wickens): never change posture or filing silently; the decision_trace + Reading-the-Room trace + "let me search" are the documented countermeasure.
    - **THE USHER MODEL IS THE PRIMARY AUTHORITY BACKBONE (Jonathan, 2026-06-05).** Usher's cumulative-synthesis / eureka (1929) has 4 steps: (1) Perceive the problem, (2) Set the stage, (3) Act of insight, (4) Critical revision. Per Aronhime's own framing: "Mindrian accelerates steps 1-2 and keeps steps 3-4 with the human - the insight belongs to you; the reach belongs to the tool." This DIVIDES authority by step, which makes two-captains impossible BY CONSTRUCTION (the tool and the human never own the same step - no overlap, no contested helm):
      - **The Capability dial (the reach) operates in Usher steps 1-2** (perceive + set the stage): retrieve the Context Block, surface contradictions, set the evidentiary stage. The tool's lane. (Maps onto CoALA: the tool's internal reasoning/retrieval loop runs steps 1-2.)
      - **The human owns Usher steps 3-4** (the act of insight + critical revision/validation). The captain's lane. Larry NEVER crosses into step 3 (never claims the insight) and never burdens the human with steps 1-2 (the reach is the tool's).
      - **The posture is the BIDIRECTIONAL traversal of the Usher cycle ("both ways"):** validation holds (step 4 passes; insight earned its evidence = bidirectional Ackoff ascent) -> `push_forward`. Validation finds a gap or the evidence is thin (step 4 surfaces weakness) -> `pull_back` to steps 1-2 (the tool re-reaches, re-sets the stage). Nothing grounded yet (mid-step-2) -> `hold` (stay quiet).
      - This division-of-labor framing SUPERSEDES "internal arbitration" as the primary articulation of D-13: it is not two controllers arbitrating for one wheel, it is the tool owning Usher 1-2 and the human owning Usher 3-4, with the posture as the bidirectional movement between them. The LARRY-04 doctrine text should lead with the Usher division.

### ICM memory-graph coherence - Part 9 dual layer (D-08, D-09, D-10)
> The ICM system is dual: "Files preserve meaning. SQL remembers and navigates." A filing must land coherently across BOTH the graph (room.db) and the nested MD layer, never one side only (the dual-source-of-truth the canon forbids). These decisions make 141's coupling to the ICM memory-graph + nested fractal filing explicit.

- **D-08 (read side - already aligned):** `getRoomContext()` is **graph-native**. It reads `room.db` through the navigation.cjs Part 9 chokepoint and does NOT scan the nested fractal MD tree. This REINFORCES Part 9 (SQL navigates, not folder scans) and honors the Phase 109 zero-non-SQLite-read invariant. 141 also creates **no new room directories**, so it carries no new `ROOM.md`-per-folder obligation (Decision 15); the new code lives in `lib/`, not the room tree.
- **D-09 (write side - graph-first, MD deferred):** The FILEVAL helper writes **graph-first**: a typed evidence node + provenance + read-back assertion to `room.db` IS the source of truth. The human-readable **memory-MD projection** (rendered FROM the graph via the Phase 124 sentinel-bounded auto-section pattern, byte-preserving any human body) stays in **MEMDIAL / Phase 143** (REQUIREMENTS.md line 826 "both sides of Part 9" is mapped there). HARD CONSTRAINT: 141's evidence-node schema **must not preclude** that projection - design the node shape so 143's renderer can project it without a migration.
- **D-10 (nested fractal artifact contract - defined in 141, producer deferred):** 141 **defines the contract** (not the producer) for how DRSCH research conclusions become nested fractal artifacts per Decision 16: path template `<section>/<research-topic-slug>/<research-topic-slug>.md` + per-artifact `ROOM.md` identity (Decision 15). The 141 evidence-node schema (D-09) **carries a provenance field for this artifact path** so the graph node and the future MD artifact stay coherent (graph node <-> fractal artifact bidirectional linkage). The actual artifact WRITING rides with DRSCH execution (deferred, D-01); 141 ships only the locked contract + the schema field that reserves it. This is what makes the eventual filing land coherently on both ICM sides.

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

### ICM memory-graph + nested fractal filing (Part 9 dual layer - D-08/09/10)
- `.claude/includes/decisions.md` (Decision 15 ROOM.md-per-folder; Decision 16 nested fractal filing `section/artifact/artifact.md`) - the dual-layer filing contract the FILEVAL helper must honor.
- `docs/MINDRIAN-CANON.md` Part 9 - "Files preserve meaning / SQL remembers and navigates"; the five-role separation; truth-states + audit-node carve-out.
- `.planning/phases/124-feynman-temporal-awareness/124-CONTEXT.md` + `lib/core/feynman/timeline-renderer.cjs` - the render-FROM-graph sentinel-bounded pattern the deferred MD projection (143) reuses.
- `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md` + `tests/test-navigation-acceptance.cjs` - the zero-non-SQLite-read invariant getRoomContext must honor (D-08).
- `.planning/REQUIREMENTS.md` line ~826 + MEMDIAL-01..03 block - the "both sides of Part 9" obligation mapped to Phase 143.

### Context-management frontier (LARRY-04 / D-13 grounding)
- `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/CONTEXT-MANAGEMENT-FRONTIER-online.md` - the online study mapping the frontier onto our build; the keystone that dissolves two-captains. READ before finalizing the LARRY-04 doctrine text.
- CoALA (Cognitive Architectures for Language Agents, arXiv 2309.02427) - the decision-cycle model the dial doctrine adopts.
- Horvitz, Mixed-Initiative UIs (CHI 1999); Red Hat HITL/HOTL/AITL/HIC taxonomy; Sarter and Woods automation-surprise; MindStudio Reasoning-Action Disconnect - the control + failure-mode grounding.
- Zep/Graphiti (arXiv 2501.13956) - the SOTA bi-temporal graph memory our room.db maps onto (external validation + the SLICE-D bi-temporal-edges pointer).
- `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/ARONHIME-EVOLUTION-EXPLANATION-scraped.md` - Prof. Aronhime's authoritative product articulation (scraped from mindrian-explanation.vercel.app). The LARRY-04 / dial doctrine text MUST align with and quote his language ("the insight belongs to you; the reach belongs to the tool"; "reach matters more than raw intelligence"; "restraint is the product working correctly"; the temporal search gradient; bidirectional Ackoff descent). The evolution from the March-2026 JTBD paper to now.

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

- **DRSCH executable plumbing** - the framework-led plan builder, the Decision-Gate plan presentation, hat-scoped web fetch (reusing /mos:research + the deep-research skill + Phase 131 research-as-graph-aware-workflow), and filing real fetched conclusions. Later phase. 141 ships only the doctrine + the (fixture-tested) filing substrate. The PRODUCER that writes real research conclusions as nested fractal artifacts (Decision 16) rides here; 141 defines the contract it fills (D-10).
- **MEMDIAL MD projection (the MD side of Part 9)** - rendering filed evidence + dial/reach activity FROM the graph into a human-readable, sentinel-bounded memory-MD section (Phase 124 pattern, byte-preserving the human body). Phase 143 (MEMDIAL-01..03). 141 builds the graph side only and reserves the schema field for it (D-09).
- **Desktop/Cowork dual-path fix** - making `buildContext` (chat-context-builder.cjs / tool-router.cjs / serve-dashboard-live) route through navigation.cjs so the dial policy is cross-surface. The policy stays CLI-honored for v1.13.1.
- **A code dispatcher** that reads the dial trigger column and auto-fires a reach. The dial stays prompt-layer doctrine.
- **Local semantic/vector leg** - Pinecone is remote + Part-8-fenced; forbidden locally. Leg C is graph-ranking, not embeddings.
- **Bi-temporal edges Stage-2 PK-change migration** (SLICE-D) - separate edges-history concern.

</deferred>
