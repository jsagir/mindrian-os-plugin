# Phase 24: Autonomous Engine - Research

**Researched:** 2026-03-29
**Domain:** Autonomous framework selection, subagent execution, pipeline chaining within MindrianOS Plugin
**Confidence:** HIGH

## Summary

The autonomous engine (`/mos:act`) closes the loop between Larry's diagnostic intelligence and actual framework execution. Currently, Larry diagnoses problem types (`/mos:diagnose`), recommends next steps (`/mos:suggest-next`), and orchestrates manual pipelines (`/mos:pipeline`) - but the user must manually invoke each framework. `/mos:act` reads room state (STATE.md + MINTO.md), selects a framework via Brain graph queries (with local fallback routing table), displays a thinking trace, then executes via an isolated subagent (`agents/framework-runner.md`).

The codebase already contains every building block needed: 26 methodology commands with consistent patterns, 7 agent definitions with clear isolation contracts, Brain query patterns (especially `brain_framework_chain` and `brain_gap_assess`), the UI system's Shape E (Action Report) explicitly assigned to `/mos:act`, a local problem-type routing table, pipeline stage contracts with output-feeds-input design, and the resolve-room script for multi-room support.

**Primary recommendation:** Build two files - `commands/act.md` (command definition) and `agents/framework-runner.md` (isolated subagent) - following the exact patterns already established in the codebase. Brain-first framework selection uses existing `brain_framework_chain` query pattern. Local fallback uses the routing table from `references/methodology/problem-types.md`. Chain mode reuses the pipeline stage contract pattern from `pipelines/`.

## Standard Stack

### Core (All Existing - No New Dependencies)

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| Command file | `commands/act.md` | User-facing `/mos:act` command definition | Same pattern as all 50+ existing commands |
| Agent file | `agents/framework-runner.md` | Isolated subagent for framework execution | Same pattern as 7 existing agents |
| Brain MCP | `.mcp.json` (mindrian-brain) | Framework selection via graph queries | Already configured, `brain_framework_chain` pattern exists |
| resolve-room | `scripts/resolve-room` | Active room path resolution | Phase 23 keystone script, returns absolute room path |
| UI Shape E | `skills/ui-system/SKILL.md` | Action Report rendering for results | Already assigned to `/mos:act` in the command-to-shape mapping |
| Problem types | `references/methodology/problem-types.md` | Local fallback routing table | Existing 2D matrix (Definition Level x Complexity) |
| Pipeline contracts | `pipelines/*/` | Output-feeds-input stage contracts | Existing pattern for discovery and thesis pipelines |

### No New Libraries Required

This phase creates markdown files (command + agent definitions) and references existing infrastructure. No npm packages, no new scripts, no new MCP servers.

## Architecture Patterns

### Pattern 1: Command + Agent Separation (THE Core Pattern)

Every MindrianOS command follows this structure. `/mos:act` must follow it exactly.

**Command file** (`commands/act.md`):
- YAML frontmatter with `name`, `description`, `allowed-tools`
- Brain Enhancement section (optional, try-then-fallback)
- Setup section (read references, read room state)
- Session Flow section (the actual logic)
- When Complete section (artifact filing)

**Agent file** (`agents/framework-runner.md`):
- YAML frontmatter with `name`, `description`, `model: inherit`, `allowed-tools`
- Voice section (distinct from Larry - this agent is execution-focused, not teaching)
- Setup section (what to read before acting)
- Protocol section (step-by-step execution)
- Never Do section (isolation rules)

**Source:** Every file in `commands/` and `agents/` follows this pattern. See `commands/diagnose.md` and `agents/research.md` as exemplars.

### Pattern 2: Brain-First, Local-Fallback (Detection Pattern)

From `skills/brain-connector/SKILL.md`:
1. Try `mcp__mindrian-brain__brain_schema` first
2. Try `mcp__neo4j-brain__get_neo4j_schema` as fallback
3. Success on ANY = Brain active
4. All fail = silently fall back to local references
5. **Never mention Brain connection failures to the user**

For `/mos:act`, Brain-first means:
- Query `brain_framework_chain` with current room frameworks + inferred problem type
- Filter results by confidence >= 0.75 (from memory file design rule)
- If Brain unavailable, use the routing table from `references/methodology/problem-types.md`

### Pattern 3: Thinking Trace (Pre-Action Transparency)

From `docs/research/RESEARCH_07_HOW_CLAUDE_THINKS.md`:
> "The thinking trace in `/mos:act` aligns with Claude's natural planning. Showing 'Problem -> Stage -> Method -> Chain -> Filing' BEFORE action matches how Claude actually works."

The thinking trace MUST appear before any execution. Format (blockquote style per session-start warm greeting pattern):

```
  > Thinking...
  > Room: Acme Robotics / Pre-Opportunity
  > Problem type: Ill-defined + Complex
  > Strongest: problem-definition (3 entries, MINTO check)
  > Weakest: market-analysis (1 entry, no MINTO)
  > Brain says: Explore Domains -> Analyze Needs (0.87 confidence)
  > Selected: /mos:analyze-needs targeting market-analysis
  > Reason: FEEDS_INTO from explore-domains with 0.87 confidence
```

For `--dry-run`, the trace IS the output. For regular mode, the trace precedes execution.

### Pattern 4: Pipeline Stage Contract (Chain Mode)

From `pipelines/discovery/01-explore-domains.md` and `02-think-hats.md`:

Each stage has:
- **Input Extraction:** What to read from the previous stage's artifact (scan room section for frontmatter with `pipeline` and `pipeline_stage` keys)
- **Stage Instructions:** Which `/mos:` command to run with what context
- **Output Contract:** What sections feed into the next stage

For `--chain` mode, `/mos:act` generates DYNAMIC stage contracts at runtime based on Brain's `brain_framework_chain` recommendations (or local routing table). Each framework in the chain produces an artifact with `pipeline: autonomous-act` and `pipeline_stage: N` frontmatter. The next framework reads the previous stage's output.

### Pattern 5: Artifact Frontmatter (Provenance)

Every artifact filed by `/mos:act` MUST include provenance metadata:

```yaml
---
methodology: {framework-name}
created: {ISO date}
depth: {quick|deep}
section: {target-section}
pipeline: autonomous-act
pipeline_stage: {N}
auto_generated: true
confidence: {high|medium|low}
brain_selected: {true|false}
thinking_trace: "{one-line summary of selection reasoning}"
---
```

This is an extension of the existing pipeline provenance pattern (used by `pipelines/discovery/` and `pipelines/thesis/`).

### Pattern 6: Subagent Isolation

From the existing agent architecture:
- Each agent has its own `allowed-tools` whitelist
- Agents have distinct voices (NOT Larry's voice)
- The framework-runner agent gets a FRESH context window (200K) per execution
- Main conversation context stays clean - the subagent reads room state, executes one methodology, files the artifact, returns a summary

Key isolation rules from existing agents:
- `agents/research.md`: "You are NOT Larry -- no warmth, no reframes"
- `agents/brain-query.md`: "Neutral, analytical, precise. You are NOT Larry"
- `agents/grading.md`: "Evaluative, direct, fair. Not harsh, not soft"

The framework-runner is different - it DOES use Larry's voice because it's running methodology sessions. But it operates in isolation (own context window) and returns structured results.

### Recommended File Structure

```
commands/
  act.md                        # /mos:act command definition (NEW)
agents/
  framework-runner.md           # Isolated framework execution subagent (NEW)
references/
  methodology/problem-types.md  # Local fallback routing table (EXISTS)
  brain/query-patterns.md       # brain_framework_chain pattern (EXISTS)
```

No new directories. No new scripts. Two markdown files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Framework selection | Custom scoring algorithm | `brain_framework_chain` Cypher query | Brain has 275+ frameworks with FEEDS_INTO edges and confidence scores. The graph IS the selection engine |
| Problem type classification | New classifier | `references/methodology/problem-types.md` routing table | Already maps Definition Level x Complexity to methodology commands |
| Pipeline chaining | New pipeline engine | Existing pipeline stage contract pattern from `pipelines/` | Output Contract -> Input Extraction pattern is proven |
| Room state reading | Custom state parser | `scripts/resolve-room` + `scripts/compute-state` + `scripts/analyze-room` | These three scripts handle room resolution, state computation, and proactive analysis |
| UI rendering | Custom output format | Shape E (Action Report) from `skills/ui-system/SKILL.md` | Already assigned to `/mos:act` with before/after delta format |
| Artifact filing | Custom filing logic | Existing methodology artifact pattern (YAML frontmatter + content) | All 26 methodology commands use the same artifact format |

**Key insight:** Every component of `/mos:act` already exists as a building block. The phase is about COMPOSING existing patterns, not inventing new ones.

## Common Pitfalls

### Pitfall 1: Acting Without Showing Thinking

**What goes wrong:** Larry executes a framework without explaining why it was selected. User doesn't trust autonomous decisions.
**Why it happens:** Temptation to optimize for speed over transparency.
**How to avoid:** The thinking trace (ACT-03) MUST appear before ANY execution. `--dry-run` exists specifically for users who want to review before acting. From the memory file: "Always show Larry's Thinking Trace BEFORE acting (never act silently)."
**Warning signs:** If the command file doesn't have a mandatory thinking trace step before the subagent call.

### Pitfall 2: Brain Fallback Leaking Errors

**What goes wrong:** Brain MCP connection failure surfaces as an error to the user.
**Why it happens:** Missing try-catch pattern around Brain queries.
**How to avoid:** Follow the brain-connector skill pattern exactly: "If it fails or errors, skip this section entirely and proceed to Setup below." Never mention Brain connection failures. Local routing table from `problem-types.md` handles 100% of cases.
**Warning signs:** Any `✗ Brain connection failed` message during `/mos:act` (this should NEVER appear - silent fallback only).

### Pitfall 3: Chain Mode Running Too Long

**What goes wrong:** `--chain` with 5 frameworks creates a 90+ minute uninterruptible session.
**Why it happens:** No exit points between chain stages.
**How to avoid:** Follow the pipeline pattern: "Stage {N} complete. Continue to {next stage name}? Or take a different path?" User can exit at ANY point. From `commands/pipeline.md`: "Pipelines are SUGGESTED sequences, not mandatory. User can exit at any point. Never guilt-trip about incomplete pipelines."
**Warning signs:** If the chain mode doesn't pause between stages for user confirmation.

### Pitfall 4: Subagent Polluting Main Context

**What goes wrong:** The framework-runner agent loads full methodology references into the MAIN conversation context, eating context budget.
**Why it happens:** Not properly isolating the subagent execution.
**How to avoid:** The framework-runner operates in its own context window. It reads references, executes the methodology, files the artifact, and returns ONLY a structured summary to the main context. The summary uses Shape E (Action Report) format.
**Warning signs:** Context usage spiking during `/mos:act` execution. Context-engine warnings appearing.

### Pitfall 5: Autonomous Artifact Quality

**What goes wrong:** The subagent produces generic, non-venture-specific artifacts.
**Why it happens:** The subagent doesn't load enough room context before executing.
**How to avoid:** Quality gate in the framework-runner: self-check that the artifact (1) references specific venture context from STATE.md, (2) is non-trivial (more than template fill), (3) includes MECE structure where applicable. From the memory file: "Quality gate: subagent self-checks artifact is non-trivial and references venture context."
**Warning signs:** Artifacts with generic placeholders or no room-specific references.

### Pitfall 6: Overriding User Agency

**What goes wrong:** `/mos:act` feels like it's taking over the venture without the user's involvement.
**Why it happens:** Autonomous execution can feel opaque and authoritarian.
**How to avoid:** Three safeguards: (1) `--dry-run` previews without executing, (2) `--confirm` asks before each step (from memory file), (3) results panel shows before/after delta so user sees exactly what changed. Default mode should be `--confirm` for first-time users.
**Warning signs:** User confusion about what changed or why.

## Code Examples

### Example 1: Command File Structure (commands/act.md)

Based on `commands/diagnose.md` and `commands/pipeline.md` patterns:

```markdown
---
name: act
description: Autonomous framework execution -- Larry reads the room, picks the right framework, and executes it
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Agent
---

# /mos:act

You are Larry. This command autonomously selects and executes methodology
frameworks based on room state.

## Brain Enhancement (Optional)

[Same try-then-fallback pattern as diagnose.md]

## Setup

1. Run `scripts/resolve-room` to get active room path
2. Read `room/STATE.md` for venture context
3. Read all `room/*/MINTO.md` files for reasoning health
4. Read `references/methodology/problem-types.md` for local routing
5. Read `references/brain/query-patterns.md` for Brain queries (if connected)

## Modes

- `/mos:act` -- Smart single: pick one framework, show thinking, execute
- `/mos:act --section {name}` -- Targeted: force a specific section
- `/mos:act --chain` -- Chain 3-5 frameworks, each feeds the next
- `/mos:act --dry-run` -- Preview selection without executing
- `/mos:act --confirm` -- Ask before each step (semi-autonomous)

## Session Flow

### Step 1: Read Room State (Always)
[resolve-room -> STATE.md -> all MINTO.md files -> analyze-room signals]

### Step 2: Show Thinking Trace (Always - ACT-03)
[Blockquote format showing room state, problem type, selection reasoning]

### Step 3: Select Framework
[Brain-first with brain_framework_chain, local-fallback with routing table]

### Step 4: Execute (unless --dry-run)
[Delegate to agents/framework-runner.md subagent]

### Step 5: Present Results (Shape E: Action Report)
[Before/after room delta, new edges, summary, next actions]
```

### Example 2: Agent File Structure (agents/framework-runner.md)

Based on `agents/research.md` and `agents/grading.md` patterns:

```markdown
---
name: framework-runner
description: |
  Framework Runner -- isolated execution agent for autonomous methodology
  sessions. Receives a selected framework and room context, executes the
  full methodology session, files the artifact, and returns a structured
  summary. Uses Larry's teaching voice during execution.
model: inherit
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

You are the Framework Runner -- an isolated execution agent. You receive
a framework selection and room context, execute one full methodology
session, file the artifact, and return a summary.

## Your Role
Execute one methodology framework in isolation. Fresh context window.
Read room state, load the methodology reference, run the session, file
the artifact with provenance metadata, return structured results.

## Voice
Larry's teaching voice during methodology execution (read
references/personality/voice-dna.md). But the summary returned to the
caller is structured and clinical (Shape E format).

## Execution Protocol
1. Read room/STATE.md and target section's MINTO.md
2. Read references/methodology/{framework}.md for full framework
3. Execute the methodology (full session, not abbreviated)
4. File artifact to room/{section}/ with provenance frontmatter
5. Quality gate: verify artifact is non-trivial and venture-specific
6. Return structured summary (Shape E Action Report data)

## Quality Gate
Before filing, verify:
- Artifact references specific venture context (not generic)
- At least 3 substantive claims with reasoning
- MECE structure where applicable
- No placeholder text or template fragments remaining

## Never Do
- Execute without room context loaded
- Abbreviate the methodology session (full depth required)
- File without provenance metadata
- Return raw methodology output to caller (summarize in Shape E)
- Modify previous artifacts in the room
```

### Example 3: Brain Framework Selection Query

From `references/brain/query-patterns.md`, the `brain_framework_chain` pattern:

```cypher
MATCH (current:Framework)-[r:FEEDS_INTO|TRANSFORMS_OUTPUT_TO]->(next:Framework)
WHERE current.name IN $current_frameworks
AND NOT next.name IN $current_frameworks
OPTIONAL MATCH (next)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: $problem_type})
RETURN next.name AS framework,
       type(r) AS relation,
       r.confidence AS confidence,
       r.transform_description AS transform,
       pt IS NOT NULL AS matches_problem_type
ORDER BY r.confidence DESC, matches_problem_type DESC
LIMIT 5
```

Where `$current_frameworks` comes from scanning room artifacts for methodology frontmatter, and `$problem_type` is inferred from room state (or "Un-Defined" as default).

### Example 4: Local Fallback Routing

When Brain is unavailable, use the routing table from `references/methodology/problem-types.md`:

| Definition \ Complexity | Simple | Complicated | Complex | Wicked |
|------------------------|--------|-------------|---------|--------|
| Undefined | beautiful-question, lean-canvas | explore-domains, build-knowledge | explore-trends, scenario-plan | explore-futures, systems-thinking |
| Ill-defined | analyze-needs, structure-argument | root-cause, find-bottlenecks | map-unknowns, analyze-systems | think-hats, leadership |
| Well-defined | lean-canvas, structure-argument | analyze-timing, validate | challenge-assumptions, dominant-designs | scenario-plan, macro-trends |

Selection priority:
1. Target the weakest section (fewest entries, broken/missing MINTO)
2. Match problem type to routing table
3. Avoid frameworks already applied (check existing artifact frontmatter)
4. First entry in the cell is the primary recommendation

### Example 5: Shape E Action Report Output

From `skills/ui-system/SKILL.md`, the exact format `/mos:act` must produce:

```
-- Acme Robotics -- Action Report -- Pre-Opportunity --

  Action: autonomous-act
  Framework: analyze-needs
  Target: market-analysis

  > Thinking...
  > Room state: 3/8 active, strongest problem-definition
  > Problem type: Ill-defined + Complex
  > Brain: analyze-needs FEEDS_INTO from explore-domains (0.87)
  > Quality: venture-specific, 5 claims, MECE structure

  Changes:
  |-- market-analysis/     [1 -> 2]  +1 entry filed
  |-- .reasoning/          [2 -> 3]  +1 MINTO updated

  New Edges:
  |-- INFORMS  problem-definition -> market-analysis

  Summary: 1 artifact filed, 1 edge created

  > /mos:status                     See updated progress
  > /mos:act                        Run another autonomous cycle
  > /mos:room market-analysis       Review the new artifact
```

### Example 6: Chain Mode Flow

For `--chain`, the dynamic pipeline follows the same pattern as `pipelines/discovery/`:

```
Chain (3 frameworks, Brain-selected):
  Stage 1: explore-domains -> problem-definition
  Stage 2: analyze-needs -> market-analysis (input from Stage 1)
  Stage 3: challenge-assumptions -> competitive-analysis (input from Stage 2)

Each stage:
1. Show thinking trace for this stage
2. Extract input from previous stage artifact (pipeline provenance scan)
3. Delegate to framework-runner subagent
4. Present Stage N results (Shape E)
5. Ask: "Continue to Stage {N+1}? Or stop here?"
```

## Existing Codebase Inventory

### Files That /mos:act Reads

| File | What It Provides | When |
|------|-----------------|------|
| `room/STATE.md` | Venture stage, project name, section fill levels | Always (Step 1) |
| `room/*/MINTO.md` | Per-section reasoning health | Always (Step 1) |
| `references/methodology/problem-types.md` | Local fallback routing table | When Brain unavailable |
| `references/brain/query-patterns.md` | `brain_framework_chain` Cypher template | When Brain connected |
| `references/methodology/{framework}.md` | Full framework reference (by subagent) | During execution |
| `references/personality/voice-dna.md` | Larry's voice (by subagent) | During execution |

### Scripts That /mos:act Uses

| Script | What It Does | Called When |
|--------|-------------|------------|
| `scripts/resolve-room` | Returns active room absolute path | Always (first step) |
| `scripts/compute-state` | Generates STATE.md from room scan | After artifact filing |
| `scripts/analyze-room` | Detects gaps, convergence, contradictions | For thinking trace signals |

### Brain Queries Used

| Pattern | Purpose | From |
|---------|---------|------|
| `brain_framework_chain` | Recommend next framework based on current + problem type | `references/brain/query-patterns.md` |
| `brain_gap_assess` | Find missing prerequisites and feed-into targets | `references/brain/query-patterns.md` |
| `brain_find_patterns` | Find similar ventures via co-occurrence | `references/brain/query-patterns.md` |

### Existing References to /mos:act

| File | Reference | Context |
|------|-----------|---------|
| `skills/ui-system/SKILL.md:268` | Shape E assigned to `/mos:act` | UI rendering already planned |
| `skills/ui-system/SKILL.md:319` | Command-to-shape mapping table | `/mos:act` -> E: Action Report |
| `docs/research/RESEARCH_07_HOW_CLAUDE_THINKS.md:36` | Thinking trace alignment with Claude's planning | Validates pre-action transparency |
| `docs/research/RESEARCH_07_HOW_CLAUDE_THINKS.md:62` | Quality gates essential for `/mos:act` | Validates subagent self-check |

### The /mos:reason Run Template (Closest Existing Pattern)

`references/reasoning/run-template.md` has a 6-step methodology run that is the closest existing analog to what `/mos:act` does:

1. Diagnose (problem type classification)
2. Select framework (choose methodology)
3. Apply (run the framework)
4. File (save artifacts)
5. Cross-reference (find dependencies)
6. Update graph (create edges)

`/mos:act` follows the same sequence but with Brain-informed selection (Step 2) and subagent isolation (Step 3).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual framework selection | `/mos:diagnose` recommends | Phase 2 (initial) | User still must manually invoke |
| Manual pipeline progression | `/mos:pipeline` orchestrates | Phase 8 (pipelines) | User must start pipeline and confirm each stage |
| No multi-room support | `scripts/resolve-room` resolves active room | Phase 23 | Room path resolution is automatic |
| No reasoning persistence | `MINTO.md` per section | Phase 16 | Reasoning health is readable state |

**What Phase 24 adds:** Closes the gap between "Larry recommends" and "Larry executes." The user goes from receiving recommendations to having Larry act on them autonomously (with transparency and confirmation).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash scripts (existing test pattern) |
| Config file | `tests/` directory |
| Quick run command | `bash tests/run-tests.sh` |
| Full suite command | `bash tests/run-tests.sh --all` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACT-01 | Read room state, select framework, display thinking trace | integration | Manual verification - run `/mos:act --dry-run` in sample room | Needs Wave 0 |
| ACT-02 | Framework execution via subagent | integration | Manual verification - run `/mos:act` and check artifact quality | Needs Wave 0 |
| ACT-03 | Thinking trace displayed before action | smoke | Manual verification - check trace appears before execution | Needs Wave 0 |
| ACT-04 | Chain mode chains 3-5 frameworks | integration | Manual verification - run `/mos:act --chain --dry-run` | Needs Wave 0 |
| ACT-05 | Dry-run preview without executing | smoke | Run `/mos:act --dry-run` and verify no artifacts created | Needs Wave 0 |

### Sampling Rate
- **Per task commit:** Verify command/agent markdown files parse correctly (frontmatter valid)
- **Per wave merge:** Run `/mos:act --dry-run` against `tests/fixtures/sample-room/`
- **Phase gate:** Full `/mos:act` and `/mos:act --chain` execution against sample room

### Wave 0 Gaps
- [ ] Verify `tests/fixtures/sample-room/` has sufficient content for testing (STATE.md + populated sections + MINTO.md files)
- [ ] Manual test script for dry-run mode validation

## Open Questions

1. **Subagent invocation mechanism**
   - What we know: Agents are defined as markdown files in `agents/`. The Agent tool is referenced in allowed-tools for some commands. Claude Code's plugin architecture supports agent delegation.
   - What's unclear: The exact mechanism for invoking a subagent with an isolated context window. The `Agent` tool appears in allowed-tools but its invocation semantics within Claude Code plugins are not fully documented in this codebase.
   - Recommendation: The framework-runner agent file should be structured so Claude naturally delegates to it when the act command says "Delegate to agents/framework-runner.md." The isolation comes from the agent having its own allowed-tools whitelist. If true process isolation isn't available, the command should explicitly instruct: "When executing the framework, treat the following as your ONLY context: [room state + methodology reference]. Do not reference the act command's thinking trace or selection logic."

2. **Chain length limits**
   - What we know: Memory file says "3-5 frameworks in sequence." Pipeline discovery is 3 stages, thesis is 3 stages.
   - What's unclear: Whether 5-framework chains will hit context limits or user patience limits.
   - Recommendation: Default to 3 frameworks max. Allow 5 only with `--chain=5` explicit flag. Always pause between stages.

3. **Confidence threshold**
   - What we know: Memory file says "confidence >= 0.75" for Brain selection.
   - What's unclear: What to do when all Brain recommendations are below 0.75.
   - Recommendation: If no Brain result meets the threshold, fall back to local routing table. If local routing also has no clear match (e.g., room is fully empty), suggest `/mos:diagnose` instead of acting autonomously.

## Sources

### Primary (HIGH confidence)
- `commands/diagnose.md` - Command file pattern, Brain enhancement section, routing logic
- `commands/pipeline.md` - Pipeline orchestration, stage execution loop, resumption pattern
- `commands/suggest-next.md` - Brain-first framework recommendation, framework chain queries
- `agents/research.md` - Agent isolation pattern, voice separation, allowed-tools
- `agents/brain-query.md` - Brain query protocol, multi-hop queries, pattern selection
- `agents/grading.md` - Calibrated assessment pattern, Brain query integration
- `skills/brain-connector/SKILL.md` - Brain detection, fallback, brain_ask tool, offer-to-setup
- `skills/ui-system/SKILL.md` - Shape E Action Report, 4-zone anatomy, command-to-shape mapping
- `skills/context-engine/SKILL.md` - Session context, USER.md, multi-room greeting, context window awareness
- `skills/pws-methodology/SKILL.md` - Framework routing, Brain-first pattern, Tier 2 lexicon
- `references/brain/query-patterns.md` - 8 named Cypher patterns (brain_framework_chain is primary)
- `references/brain/schema.md` - Node types, relationships, FEEDS_INTO edges
- `references/methodology/problem-types.md` - 2D classification matrix, local routing table
- `references/methodology/index.md` - All 26 methodology commands, venture stage routing
- `references/pipeline/chains-index.md` - Pipeline chain structure, stage contract pattern
- `references/reasoning/run-template.md` - 6-step methodology run (closest analog)
- `pipelines/discovery/CHAIN.md` - Chain metadata, stage sequence, provenance
- `pipelines/discovery/01-explore-domains.md` - Stage contract: input extraction, output contract
- `pipelines/discovery/02-think-hats.md` - Stage contract: cross-stage data flow
- `scripts/resolve-room` - Multi-room resolution (registry -> legacy -> no room)
- `docs/research/RESEARCH_07_HOW_CLAUDE_THINKS.md` - Claude's planning pattern validates thinking trace design
- Memory file: `project_mos_act_autonomous.md` - Prior design decisions and constraints

### Secondary (MEDIUM confidence)
- `settings.json` - Plugin default agent configuration
- `hooks/hooks.json` - Hook firing pattern (SessionStart, Stop, PostToolUse)
- `.claude-plugin/plugin.json` - Plugin version and metadata

## Project Constraints (from CLAUDE.md)

1. **Tri-Polar Design Rule (MANDATORY):** Every feature must work on CLI, Desktop, and Cowork. `/mos:act` must consider all three surfaces.
2. **Brain as remote MCP:** IP never distributed. Users get intelligence, not data. Framework selection queries go through the Brain MCP server.
3. **Tier 0 fully functional:** No dependencies, graceful degradation everywhere. `/mos:act` MUST work without Brain (local fallback routing table).
4. **One-command install:** No additional setup required for `/mos:act` to work at Tier 0.
5. **ICM-native:** Folder structure IS the orchestration. Artifacts go to the right room sections.
6. **Pipelines chain through Room:** Output becomes next input's structure (Week 7 pattern). Chain mode follows this.
7. **NO EMOJI. EVER.** Use the 12 approved glyphs from the UI system.
8. **Release Process:** Version bump in plugin.json + CHANGELOG.md entry for any user-facing change.
9. **Never use em-dashes** - use hyphens instead (from memory).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components exist in the codebase, no new dependencies
- Architecture: HIGH - every pattern is documented and exemplified in existing code
- Pitfalls: HIGH - identified from existing design docs (RESEARCH_07) and memory file

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable - no external dependencies, all internal patterns)
