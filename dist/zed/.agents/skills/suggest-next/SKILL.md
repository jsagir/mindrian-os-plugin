---
name: suggest-next
description: Suggest the next move using the room graph
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get the next move Larry recommends, ranked."
body_shape: B
hitl_shape: "F.1"
hitl_why: "It offers a short numbered set of next moves for the navigator to pick one."
# Phase 267.3-04, ruled in 267.3-CLASSIFICATION.md (Row 16): first delivery at commands/suggest-next.md:60, the framework chain and step-numbered command sequence derived from the room, with nothing deferred to a later run (rests on rubric rule TB-4).
interactive_first_reward: methodology_reframe
serves_jtbd: ["plan-execution", "explore"]
teaching: "When you finish a step and want Larry to recommend the next move, /mos:suggest-next reads the room graph and proposes 3-5 options with reasons. The Navigation Engine made visible."
# --- Phase 122 workflow-layer frontmatter ---
kind: meta
frameworks: []
produces: null
inputs: []
autonomous_safe: false
allowed-tools: Read mcp__mindrian-brain__brain_query mcp__mindrian-brain__read_neo4j_cypher mcp__mindrian-brain__brain_search AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: suggest-next
  posture: hold
  hierarchy_rank: 8
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
---

# /mos:suggest-next

<!--
Phase 121.5-10 Sub-plan K LOCKED decision 4 (body_shape vs F-shape orthogonality):
body_shape: B (Semantic Tree) is the LAYOUT discipline of this command's body --
the ranked-list render. F.1 is the SELECTOR CONTRACT that fires at the close of
the body (the verb-pick gate beneath the tree). The two are orthogonal axes:
body_shape describes the visual layout; F-shape describes the dispatcher
contract. This command is "F.1 over Shape B." See skills/ui-system/SKILL.md
Section 2 orthogonality note for the canon citation. Also see audit
.planning/121.5-selector-coverage-audit.md Section 5 for the locked Brain-
suggestion content template that the F.1 surface emits.
-->

You are Larry. This command recommends what the user should work on next as a COMMAND SEQUENCE, not just a list of frameworks: it reads the room's ProblemType (and active JTBD), Brain-derives the framework chain, and composes that chain into the exact `/mos:` commands to run, in order.

## The resolver is the only door

Run the helper to get the resolver-composed command sequence:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/suggest-next-command.cjs" --room ./room
```

It reads `room/STATE.md` for the ProblemType / active JTBD (or pass `--problem-type <x>` / `--from-framework <x>` explicitly), calls `lib/brain/chain-recommender.cjs` `recommendFrameworkChain` (a FEEDS_INTO traversal -- framework names + problem-type enums only; Canon Part 8: never a command string, never user content), composes the chain into `/mos:` commands via `lib/workflow/command-resolver.cjs` `composeWorkflow` (the SOLE framework -> command path, reading only the generated `data/command-registry.json`), and prints BOTH the framework chain AND the step-numbered command sequence. A framework with no `/mos:` yet renders as "(no /mos: for this -- run it manually)" -- degrade, do not fabricate.

**Larry NEVER names a `/mos:` command from memory.** Every command you surface came back from the resolver via this helper. If you find yourself about to type a `/mos:` you have not seen the resolver return, stop -- run the helper first. Render in Shape B (Semantic Tree) per `skills/ui-system/SKILL.md`; do not invent a format.

When Brain is connected you may additionally weave the co-occurrence narrative below; when it is not, the helper still produces a true command sequence from the registry (framework-only advice degrades gracefully -- still through the resolver).

**Note on Brain MCP:** the deeper "similar venture patterns" enrichment below benefits from Brain. If Brain is not available, skip those queries -- the resolver-composed sequence above still stands.

## Setup

1. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/brain/query-patterns.md` for `brain_framework_chain` and `brain_find_patterns` patterns
2. Read `room/STATE.md` for current venture stage, frameworks used, and problem type

## Flow

### 1. Identify Current Frameworks

Scan room artifacts for frameworks already applied. Check:
- `room/problem-definition/` for analysis frameworks (Beautiful Question, Map Unknowns, Root Cause, etc.)
- `room/market-analysis/` for market frameworks (JTBD, Trends, S-Curve, etc.)
- `room/competitive-analysis/` for validation frameworks (Devil's Advocate, Validate, etc.)
- `room/solution-design/` for design frameworks (Six Hats, Systems Thinking, etc.)

Build a list of `$current_frameworks` from what exists.

### 2. Query Brain for Framework Chains

Call `brain_framework_chain` with:
- `$current_frameworks` = list from step 1
- `$problem_type` = inferred from room state (or "Un-Defined" if unclear)

This returns recommended next frameworks with confidence scores and relationship types (FEEDS_INTO, TRANSFORMS_OUTPUT_TO).

### 3. Query Brain for Similar Venture Patterns

Call `brain_find_patterns` with:
- `$current_frameworks` = list from step 1

This returns frameworks that commonly co-occur with the current set, plus example projects that used them.

### 4. Synthesize Recommendations

Combine both query results. Present 2-3 next steps ranked by:
- Confidence score from framework chain
- Problem-type alignment
- Co-occurrence patterns from similar ventures

For each recommendation:
- **What to do:** Name the framework AND the specific `/mos:` command -- but take the command from the helper's resolver-composed sequence above (or `lib/workflow/command-resolver.cjs` `commandsForFramework(<framework>)`), never from memory. If a framework has no command, say "run <framework> manually -- there is no /mos: for it" rather than inventing one.
- **Why this sequence:** Cite the relationship type from the graph (e.g., "Explore Domains FEEDS_INTO Analyze Needs with 0.85 confidence -- mapping the landscape first sharpens your customer discovery")
- **What similar ventures did:** Reference co-occurrence data ("Projects that used Beautiful Question most commonly followed with Explore Domains or Map Unknowns")

### 5. Present Through Larry's Voice, Then Close With a Live F.1 Selector

Frame the reasoning conversationally first. Not a wall of bullets -- a short narrative:
> "Based on where you are, here's what I'd focus on next -- and the graph backs this up..."

Then CLOSE with a live Shape F.1 (Next Move) selector, never a narrative-only "want me to start
any of these?" question. The chooser IS the Canon Part 3 Decision Gate; a bare-text list of next
moves is the "command-driven, not conversation-driven" anti-shape Canon Part 10 argues against.

Use the AskUserQuestion tool to surface the selector. Compose it with the SAME verb/option shape
`lib/hmi/shape-f1-renderer.cjs` (`renderShapeF1`) already produces and that
`lib/hmi/selector-dispatcher.cjs` (`appendAskUserQuestionTrailer`) fires -- do NOT hand-build a
bespoke AskUserQuestion JSON structure. One option per recommended `/mos:` command sequence entry:
- **label** = the exact `/mos:` command the resolver returned (never typed from memory)
- **description** = the one-line "why this sequence" reason already computed in step 4 (the
  FEEDS_INTO relationship + confidence)

Cap the options at the F.1 rule (2-3 ranked moves, up to 5), and append Free-Text LAST as the
built-in "something else / just tell me more" floor (`renderShapeF1` appends Free-Text
automatically -- never suppress it). The picked option routes straight to that `/mos:` command in
the same turn; do not echo the pick and then ask the user to re-type the command.

## When the Room is Empty

If no frameworks have been applied yet (empty room or new project):
- Skip the Brain queries (no input data)
- Recommend the standard starting point: `/mos:diagnose` to classify the problem, or `/mos:beautiful-question` to begin exploration
- Mention that suggest-next becomes more powerful as the room fills up
