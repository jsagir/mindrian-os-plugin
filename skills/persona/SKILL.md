---
name: persona
description: Generate Six-Hats lenses from room data
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get a per-persona view of your venture (role-blend x journey-stage)."
body_shape: C (Room Card)
hitl_stages:
  - stage: "generate-experts"
    shapes: ["F.8"]
    mode: "parallel"
  - stage: "resolve-tension"
    shapes: ["F.5"]
    mode: "gate"
hitl_why: "Synthetic experts are generated as an independent set (F.8) then their tensions are resolved among parallel branches (F.5)."
# Phase 118-06 reward-before-investment declaration. Grounded in the shipped
# `list` subcommand, which returns each lens's hat color, label, domain,
# filename and disclaimer: the structure of the six lenses is handed over before
# the navigator commits to a generate or a parallel run.
interactive_first_reward: schema_preview
serves_jtbd: ["prepare-pitch"]
teaching: "When you need fresh perspectives on the room, /mos:persona generates Six-Hats lenses from your room data. Each persona argues from a different stance; you decide what holds."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Six Thinking Hats"]
produces: "room/team/ai-personas/*"
inputs: []
autonomous_safe: true
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: hats
  sub_mode: persona
  framework: "Six Thinking Hats"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 3
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
# --- Phase 130-03 lens-engine client frontmatter ---
lens_type: cognitive
lens_set: six-hats
rotation_mode: parallel
synthesizer: tension-map
persistence: memory_event
allowed-tools: Read Write Bash Glob
---

# Persona -- AI Perspective Lenses

Generate persistent De Bono Six Thinking Hat perspective lenses from your room data.

This command is a thin lens-engine client. The `--parallel` analyze path rotates the six-hats lens set in `parallel` rotation mode through `lib/core/lens-engine.cjs` (all six hats speak simultaneously, so later hats are not biased by earlier ones), persists each finding as a `memory_event` per Canon Part 9, and builds the tension map via `lib/core/synthesizers/tension-map.cjs`. The engine owns the rotation loop, the synthesizer dispatch, and the memory_event emission.

## Important Distinction

**think-hats** is an INTERACTIVE METHODOLOGY SESSION. It walks you through the six hats in sequence as a facilitated exercise.

**persona** creates PERSISTENT PERSPECTIVE LENSES from your room data. Each persona file lives in your `personas/` section and can be invoked at any time to analyze artifacts, challenge assumptions, or provide a specific viewpoint.

## Subcommands

### generate

Create 6 hat-colored persona files from current room state.

```
/mos:persona generate
```

Reads your room sections, extracts domain signals, and generates one persona file per hat color in `personas/`. Each file contains the persona's perspective, focus areas, hat-specific questions, and inter-hat tensions -- all grounded in YOUR room content.

**Prerequisites:** Room must have 2+ populated sections (sections with at least one .md file). Thin rooms are rejected to prevent generic output.

### list

Show all generated personas in the room.

```
/mos:persona list
```

Returns each persona's hat color, label, domain, filename, and disclaimer.

### invoke [hat] [artifact]

Adopt a specific hat's perspective.

```
/mos:persona invoke black
/mos:persona invoke yellow path/to/artifact.md
```

Returns the persona content for the specified hat. When an artifact path is provided, the persona's perspective is applied to that specific document.

Hat colors: white (Facts & Data), red (Emotions & Intuition), black (Risks & Dangers), yellow (Benefits & Opportunities), green (Creativity & Alternatives), blue (Process & Meta).

### analyze [artifact]

Run all 6 perspectives against a single artifact.

```
/mos:persona analyze path/to/business-model.md
```

Returns all six hat perspectives on the artifact. Highlights where hats DISAGREE -- that tension is where insight lives.

### parallel

Dispatch all 6 persona-analyst agents simultaneously for maximum-speed multi-perspective analysis.

```
/mos:persona --parallel
/mos:persona --parallel path/to/artifact.md
```

Unlike `analyze` (which runs hats sequentially in a single context), `--parallel` spawns 6 independent persona-analyst agents -- one per De Bono hat -- running simultaneously. Each agent operates in its own context window with full room access.

**Prerequisites:** Same as `generate` -- room must have 2+ populated sections and personas must already exist (run `/mos:persona generate` first if needed).

**How it works:**

1. **Check personas exist** -- read `room/personas/` for all 6 hat files. If missing, prompt: "Generate personas first with `/mos:persona generate`."

2. **Resolve model per agent** using `lib/core/model-profiles.cjs`:
   ```
   const { resolveModel } = require('${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/model-profiles.cjs');
   const model = resolveModel('persona-analyst', roomPath);
   ```
   All 6 agents share the same model resolution since they perform equivalent work. The venture stage determines whether persona analysis runs on a budget or quality tier.

3. **Dispatch all 6 agents in one message** using the Agent tool with `subagent_type: persona-analyst`
   (the explicit type string, not a file path -- an Agent tool call that cannot resolve a
   `subagent_type` is a hard error listing available agents since 2.1.235). Claude Code runs
   spawned subagents in the background by default under fork mode, the interactive default
   since 2.1.232 -- do NOT pass any manual background-execution parameter to the Agent tool
   call; the platform removes that kind of parameter from the Agent tool entirely once fork
   mode is on (code.claude.com/docs/en/sub-agents). The platform caps concurrent subagents at
   20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); 6 is already well under the cap, but clamp to 20
   as the standing rule so a future author does not reintroduce an unbounded fan-out here.

   Each agent receives:
   - Hat color and persona file path
   - Room path and room context summary from STATE.md
   - Artifact path (if provided) for focused analysis
   - Instructions from `agents/persona-analyst.md` (the `subagent_type: persona-analyst` invocation)

   ```
   [PARALLEL] Dispatching 6 persona-analyst agents

     Hat 1: White (Facts & Data)       [running]
     Hat 2: Red (Emotions & Intuition) [running]
     Hat 3: Black (Risks & Dangers)    [running]
     Hat 4: Yellow (Benefits & Opps)   [running]
     Hat 5: Green (Creativity & Alts)  [running]
     Hat 6: Blue (Process & Meta)      [running]

     Model: {resolved model} (all agents)
     Target: {artifact name or "full room analysis"}
     Waiting for all agents to complete...
   ```

4. **Collect and synthesize** -- as each agent returns its perspective:
   - Parse key insights from each hat's analysis
   - Each agent's output follows the Single Hat format from `agents/persona-analyst.md`

5. **Build the Tension Map** -- after all 6 return, the lens-engine's `tension-map` synthesizer (`lib/core/synthesizers/tension-map.cjs`) pairs the opposing-stance findings; Larry narrates its output:
   - **Disagreements:** where hats reach opposite conclusions (e.g., Yellow sees opportunity where Black sees fatal risk)
   - **Convergences:** where 2+ hats independently reach the same conclusion (stronger signal than sequential analysis)
   - **Unresolved tensions:** questions no hat fully addresses
   - **Emergent patterns:** connections that only become visible when all 6 perspectives arrive independently (not possible in sequential analysis where later hats are influenced by earlier ones)

6. **Trigger post-parallel cascade:**
   - If any hat's analysis surfaces a CONTRADICTS or CONVERGES cross-reference, note it for HSI recomputation
   - Run `"${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/compute-hsi.py" room` if cross-references found

7. **Present combined output:**
   ```
   [PARALLEL] Complete -- 6 perspectives analyzed simultaneously

   ## Six-Hat Parallel Analysis: {Venture Name}

   ### White (Facts & Data)
   {Key insight from white agent}

   ### Red (Emotions & Intuition)
   {Key insight from red agent}

   ### Black (Risks & Dangers)
   {Key insight from black agent}

   ### Yellow (Benefits & Opportunities)
   {Key insight from yellow agent}

   ### Green (Creativity & Alternatives)
   {Key insight from green agent}

   ### Blue (Process & Meta)
   {Key insight from blue agent}

   ---

   ## Tension Map (Cross-Agent Synthesis)

   **Disagreements:**
   - {Hat A} vs {Hat B}: {specific tension}

   **Convergences:**
   - {Hat A} + {Hat B}: {shared observation}

   **Emergent (parallel-only):**
   - {Pattern visible only because agents ran independently}

   **Unresolved:**
   - {The question that no hat fully addresses}
   ```

**Why parallel instead of sequential?** Sequential analysis (via `analyze`) lets each hat build on the previous one. Parallel analysis gives INDEPENDENT perspectives -- later hats are not biased by earlier ones. This produces more genuine disagreements and stronger convergence signals. Use `analyze` for deep facilitated thinking; use `--parallel` for unbiased multi-perspective stress-testing.

## Persona Override (Identity-Only)

The personas above are the AI TEAM around the navigator. Separately, a navigator can declare their OWN synthetic persona for a role-play or test session. This is the identity-only override surface. It is a local-only sentinel file (zero Brain egress per Canon Part 8); a navigator-set persona is navigator-confirmed (legitimate per Canon Part 9 role 5).

```bash
node lib/core/persona-override.cjs set <role>     # declare a synthetic persona
node lib/core/persona-override.cjs status         # show the active override JSON, or "none"
node lib/core/persona-override.cjs clear          # remove the override
```

What it does: while an override is active, the identity that every persona reader funnels through (`readUserMd`) returns the SYNTHETIC persona instead of the real USER.md, for every turn. The override store lives OUTSIDE the context window, so the declared persona sticks across turns AND survives maintenance commands like `/mos:doctor` (the exact failure that previously collapsed a role-played persona). `set <role>` sets the canonical role plus a 1.0 role-blend on that role.

How to clear it: run `node lib/core/persona-override.cjs clear`. With no override active, identity resolution is byte-identical to the default (every real user is on this path).

## Personas Are Perspective Lenses, Not Expert Advisors

Every persona output includes a disclaimer. Personas synthesize from YOUR room data -- they never generate new domain facts. They are thinking tools that help you see your venture from structured angles, not authoritative opinions.

## Examples

**CLI:**
```bash
node bin/mindrian-tools.cjs persona generate ./room
node bin/mindrian-tools.cjs persona list ./room
node bin/mindrian-tools.cjs persona invoke ./room black
node bin/mindrian-tools.cjs persona analyze ./room path/to/artifact.md
```

**Natural language (Desktop/Cowork):**
- "Generate personas for my room"
- "What does the black hat think about my competitive analysis?"
- "Run all perspectives on my business model"
- "Show me my personas"
