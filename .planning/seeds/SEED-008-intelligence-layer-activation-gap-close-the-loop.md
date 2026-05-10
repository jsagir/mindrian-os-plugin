---
id: SEED-008
status: dormant
planted: 2026-05-10
planted_during: v1.13.0 -- quick task 260510-or6 (docs/UI-UX-CONVERGENCE-2026-05-10 bundle) + Phase 117 (auto-explore-domains-on-first-material)
trigger_when: v1.13.0 "The Closed Loop" FINAL RELEASE GATE audit; OR any phase touching Phase 91 (navigation-engine), the UserPromptSubmit/SessionStart navigation hooks, Phase 109 (sql-context-memory-navigation-spine), Phase 95 (bash-hook-envelope-and-cascade-side-channel), Phase 117 (auto-explore-domains), or BRAIN.md derivation; OR /gsd:new-milestone when the theme is "navigation", "proactive intelligence", "closing the loop", "trigger design", or "memory"
scope: large
related_phases: [91, 95, 109, 117, 94 (94-03 acceptance criteria), 121.5, 90 (BRAIN.md derivation), 88.1-03 (room-proactive surfacing)]
canon_parts: [Part 2 Engine 1, Part 4, Part 9 (proposed), Part 10 (proposed)]
companion_artifacts:
  - docs/UI-UX-CONVERGENCE-2026-05-10/09-CRITICAL-FINDING-ACTIVATION-GAP.md  (the full finding + Brain consultation + usage analytics + tester/opportunity counterfactual)
  - docs/UI-UX-CONVERGENCE-2026-05-10/08-CONVERGENCE-MINTO-AND-DEV-PHASE-INSTRUCTIONS.md  (the dev-phase sequencing this seed gates)
  - docs/UI-UX-CONVERGENCE-2026-05-10/00b-BRAIN-MODE-A-FRAMEWORK-CHAIN.md  (the live-Brain edge paths that prove the argument)
---

# SEED-008: The MindrianOS intelligence layer (local graph + artifact-filing cascade + memory layers + Brain) runs in compute-and-store mode, not compute-store-and-act mode -- close the loop before v1.13.0 ships as "The Closed Loop"

## Why This Matters

**The moat is "the graph that knows WHEN to use WHICH tool, calibrated by REAL teaching data" (`docs/moat.md`, verbatim). If the trigger mechanism never fires, the "knows WHEN" half is unrealized -- the moat becomes a claim, not a capability. "Mindrian is not Mindrian."** And the evidence says it isn't firing:

- `mcp-server-brain/brain-admin.cjs usage` (2026-05-10): **64 external Brain calls, ever, across 9 people.** Jonathan's "Desktop Permanent" key alone is at 543 -- 8.5x the entire external base combined. The named tester cohort (Justin / Aryeh / Adam / Shmuel / Gary) is at near-zero. The Brain-enriched ("Full Loop", Mode A) experience is essentially untested by external users; they almost all run Tier 0 / Local-Only. Root cause is NOT "users won't adopt the Brain" -- it's "**the product never triggers the Brain for them.**"
- Every turn of a normal session emits `routing_source: legacy` / `tier_mode: tier_0` from the navigation engine. The engine exists; it runs in legacy file-state-presence mode, not graph/Brain mode.

**And it's bigger than the Brain.** The same shape of gap runs through every local intelligence system -- and the local ones have NO Canon Part 8 constitutional brake; they're just broken:

- **Local graph (`room/.room-graph/`, SQLite):** WRITTEN fine (the filing cascade writes decision edges + the typed cross-relationship edges INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES on every artifact -- Canon Part 4). NOT NAVIGATED -- the Navigation Engine that should read STATE + the graph + the methodology cache for Mode B routing isn't wired (`routing_source: legacy` is the proof). `/mos:graph`, `/mos:query`, `/mos:rs-explain` read it -- only on manual invoke. The roadmap's own fix is Phase 109 ("sql-context-memory-navigation-spine", tagged load-bearing) -- confirm it actually *navigates* before the gate.
- **Artifact-filing / cascade pipeline:** FILES artifacts fine; COMPUTES the cross-relationship scan fine; has NEVER DELIVERED. The room-proactive intelligence loop (Phase 88.1-03) has been silently broken since it shipped -- `skills/room-proactive/SKILL.md` reads cascade findings from `additionalContext`; the bash hook has always written them at JSON root; they never connected. *Mid-session intelligence injection has never functioned in production.* Phase 95 fixes the plumbing (side-channel). Phase 91 makes Larry *act* on it.
- **Memory layers (3):** within-session = fine, except post-compact re-injection is half-wired (`scripts/post-compact` writes `TRIPLE_CONTEXT` to a side-channel; the consumer is deferred -- memory degrades across an auto-compact boundary). Across-session = the Feynman-MINTO triple (MINTO.md governing thoughts) exists; the BRAIN.md per-folder quadruple is OFTEN ABSENT (which is exactly why every turn says `tier_mode: tier_0` / "BRAIN.md absent" -> the engine falls to its dumbest mode); the brain-derivation queue does NOT auto-drain (entries sit for days). Cross-room = the contradiction aggregator (Phase 90) exists but runs on the staleness scan / manual invoke, not proactively.

**Canon Part 9 (proposed) states the closed loop in one line: "Files preserve meaning. SQL remembers and navigates. Brain reasons over structured packets. Larry explains and acts. Human confirms truth."** Map the gaps onto it: Files OK; SQL broken (stores, doesn't navigate); Brain broken (not invoked); Larry-acts broken (cascade findings never reach him); Human-confirms impossible (can't confirm what was never surfaced). Every link except "files" is "compute but don't deliver." That is the v1.13.0 reverse salient -- and per the live Brain's own structure, `Reverse Salient Analysis --FEEDS_INTO--> PWS Value Proposition`, so this reverse salient is a direct input to the W ("Can We Win") dimension of the value-proposition score: not fired -> W starved -> W drops below its >=5.5 gate -> VPS fails its gate.

**The Brain's own teaching graph already named this**, verbatim as a `Question` node: *"How might we design 'insight sensors' that trigger the most appropriate methodology lens?"* -- domain `Dynamic Switching`, action `Create smart triggers`, `LEADS_TO` *"What if methodologies activated automatically based on the type of customer insight emerging?"*, `ENABLES_EXPERIMENT` *"Insight Sensor Prototype"*. The "Insight Sensor Prototype" is the Navigation Engine (Phase 91). The curriculum articulated both the diagnosis and the prescription before the plugin caught up.

## When to Surface

**Trigger:** the v1.13.0 "The Closed Loop" FINAL RELEASE GATE audit -- this seed is a *gate concern*, not a backlog idea. Also surface during `/gsd:new-milestone` or `/gsd:plan-phase` when:

- A phase touches Phase 91 (`navigation-engine`), the UserPromptSubmit / SessionStart navigation hooks, or the `## NAVIGATION DECISION (engine v1)` output block
- A phase touches Phase 109 (`sql-context-memory-navigation-spine`) or the local-graph read/navigate layer (`lib/core/room-db.cjs`, `lib/core/graph-ops.cjs`, the nl-graph query path)
- A phase touches Phase 95 (`bash-hook-envelope-and-cascade-side-channel`) or `skills/room-proactive/SKILL.md` (the cascade-surfacing path)
- A phase touches Phase 117 (`auto-explore-domains-on-first-material`) or the Act-1 algorithmic engine auto-invocation (`/mos:explore-domains`, `/mos:whitespace`, `/mos:find-bottlenecks`, the HSI scripts)
- A phase touches BRAIN.md derivation (`scripts/vault-section-minto-generator.cjs`, the brain-derivation queue, `lib/core/folder-memory.cjs`)
- A milestone-level theme is "navigation", "proactive intelligence", "closing the loop", "trigger design", "memory", or "Larry leads"

## Scope Estimate

**Large** -- a milestone-shaping concern. Broken into three sub-loops, ordered by cheapness-per-leverage:

1. **The local loop (cheapest; no Part-8 concerns; mostly already scoped).** Fix the cascade-surfacing plumbing (Phase 95 -- scoped) + wire BRAIN.md derivation so the engine stops falling to Tier 0 + drain the brain-derivation queue + land Phase 109's navigation spine + wire the post-compact re-injection consumer. Result: filing an artifact actually surfaces findings; session start actually reads the room's memory; the engine reads the graph. **Highest leverage-per-effort on the board; touches zero Brain code.**
2. **The Brain / web loop (medium; Part-8-constrained).** Heuristic "insight sensors" first (the Brain's own `action: Create smart triggers` -- plural, lightweight): first-material -> `explore-domains` + `brain_framework_chain($problem_type, $current_frameworks)`; methodology moment -> Brain `CHAINS_TO` query; external-fact reference -> WebSearch, hat-scoped per Canon Part 2; JTBD set -> re-weight selector menus + Brain queries (Phase 104). The `brain_framework_chain` / `brain_find_patterns` patterns already exist in `references/brain/query-patterns.md` -- nobody calls them automatically. Cheap v1.
3. **The unifier (Phase 91 full Navigation Engine).** Replaces the heuristic sensors with a calibrated classifier. The v2.

## Acceptance Contract -- Non-Negotiable: the loop must FIRE, not merely exist

The v1.13.0 FINAL RELEASE GATE must include a "loop fires" test (promote it from acceptance criterion to gate blocker). A scripted dogfood session in a real room (e.g. the `mindrianOS` plugin room, per Canon Part 6) must show ALL of:

1. A turn that should trigger a Brain call produces `routing_source: engine` (NOT `legacy`) in the decision trace. (This is *already* Phase 94-03's acceptance criterion -- "`routing_source: engine` in at least one trace per session when Brain reachable" -- and it has been emitting `legacy`. Enforce it.)
2. A turn referencing external facts triggers WebSearch (hat-scoped per Canon Part 2).
3. First material in a session triggers `/mos:explore-domains` automatically -> the room is non-empty (domain tree + whitespace map + candidate Opportunity Bank entries) by turn 2.
4. Filing an artifact surfaces the cross-relationship cascade findings to Larry mid-session (the Phase 88.1-03 loop, fixed via Phase 95).
5. BRAIN.md derives for the room's sections -> `tier_mode` rises above `tier_0` -> `brain_md_recommended_marker_rendered` can be `true`.

**If the loop does not fire by the gate, the milestone is renamed -- it does not ship as "The Closed Loop".** That is the call this seed forces.

## Breadcrumbs

Diagnosis & prescription:
- `docs/UI-UX-CONVERGENCE-2026-05-10/09-CRITICAL-FINDING-ACTIVATION-GAP.md` -- full finding, the live-Brain consultation, the brain-admin usage analytics, the tester/opportunity counterfactual table
- `docs/UI-UX-CONVERGENCE-2026-05-10/08-CONVERGENCE-MINTO-AND-DEV-PHASE-INSTRUCTIONS.md` -- "Branch 2: Wire the Trigger"; the `95.6 -> 91+hooks -> 121.5` sequence
- `docs/UI-UX-CONVERGENCE-2026-05-10/00b-BRAIN-MODE-A-FRAMEWORK-CHAIN.md` -- `Reverse Salient Analysis --FEEDS_INTO--> PWS Value Proposition`; the HSI/algorithmic workflows `--FEEDS_INTO--> Reverse Salient Analysis`; the "insight sensors" beautiful-question node
- `docs/moat.md` -- the moat sentence this seed is protecting
- `docs/MINDRIAN-CANON.md` Part 9 (proposed -- "Files / SQL / Brain / Larry acts / Human confirms") + Part 10 (proposed -- "Conversation as Product"); this seed ratifies alongside Part 10 at the v1.13.0 gate

Code & roadmap:
- `.planning/phases/91-navigation-engine/` -- the unifier (the "Insight Sensor Prototype")
- `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/` (and `.planning/debug/post-write-hook-envelope-invalid-input.md`) -- the cascade-surfacing fix; `.planning/TODO.md` IMMEDIATE-NEXT entry has the full diagnosis
- `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md` (load-bearing) -- the local-graph navigate layer
- `.planning/phases/117-auto-explore-domains-on-first-material/` -- first-material auto-invoke
- `.planning/phases/94-v1-11-2-tester-driven-fixer/94-03-*` -- the `routing_source: engine` acceptance criterion that's been emitting `legacy`
- `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` -- the SessionStart Coordinator (ends the turn-1 injector flood) + the canonical palette + SKILL.md v2; the last phase before the gate
- `skills/room-proactive/SKILL.md` -- reads cascade findings from `additionalContext`; the bash hook writes them at JSON root (Phase 95 fixes)
- `references/brain/query-patterns.md` -- `brain_framework_chain`, `brain_find_patterns` -- exist, never auto-invoked
- `lib/core/folder-memory.cjs`, `scripts/vault-section-minto-generator.cjs`, `<room>/.mindrian/brain-derivation-queue.json` -- the memory quadruple + the queue that doesn't drain
- `scripts/post-compact` + `<roomDir>/.mindrian/last-post-compact.md` -- the half-wired post-compact re-injection (consumer deferred; memory: `project_post_compact_memory_pipeline`)
- `mcp-server-brain/brain-admin.cjs usage` -- the 64-calls-ever evidence (re-run periodically; the number is the KPI for whether this seed's fix landed)

## Notes

Planted from the 2026-05-10 session, in which the Brain (Neo4j Aura) was manually queried to great effect *precisely the way an "insight sensor" would auto-query it* -- which is the dogfood proof of the gap: the Brain added decisive value, but only because a human invoked it; the product's normal operation triggers nothing (`routing_source: legacy` on every turn of that very session). The user's standing instruction (2026-05-10): when the Brain MCP is offline, fall back to the `my-neo4j` MCP and query Neo4j directly, enforcing Canon Part 8 by hand -- that fallback is itself a candidate "sensor" behavior to bake in.

This seed is NOT "execute now." It carries the 2026-05-10 finding forward so the v1.13.0 FINAL RELEASE GATE audit has the full WHY / ACCEPTANCE / BREADCRUMBS without re-discovery, and so no phase touching Phase 91 / 95 / 109 / 117 / BRAIN.md derivation gets planned in isolation from the loop-closure picture.
