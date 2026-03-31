---
name: persona
description: Generate AI perspective lenses (De Bono Six Hats) from your room data
body_shape: C (Room Card)
---

# Persona -- AI Perspective Lenses

Generate persistent De Bono Six Thinking Hat perspective lenses from your room data.

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
   const { resolveModel } = require('${CLAUDE_PLUGIN_ROOT}/lib/core/model-profiles.cjs');
   const model = resolveModel('persona-analyst', roomPath);
   ```
   All 6 agents share the same model resolution since they perform equivalent work. The venture stage determines whether persona analysis runs on a budget or quality tier.

3. **Dispatch 6 agents in parallel** using the Agent tool with `run_in_background: true`:

   Each agent receives:
   - Hat color and persona file path
   - Room path and room context summary from STATE.md
   - Artifact path (if provided) for focused analysis
   - Instructions from `agents/persona-analyst.md`

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

5. **Build the Tension Map** -- after all 6 return, Larry synthesizes:
   - **Disagreements:** where hats reach opposite conclusions (e.g., Yellow sees opportunity where Black sees fatal risk)
   - **Convergences:** where 2+ hats independently reach the same conclusion (stronger signal than sequential analysis)
   - **Unresolved tensions:** questions no hat fully addresses
   - **Emergent patterns:** connections that only become visible when all 6 perspectives arrive independently (not possible in sequential analysis where later hats are influenced by earlier ones)

6. **Trigger post-parallel cascade:**
   - If any hat's analysis surfaces a CONTRADICTS or CONVERGES cross-reference, note it for HSI recomputation
   - Run `"${CLAUDE_PLUGIN_ROOT}/scripts/compute-hsi.py" room` if cross-references found

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
