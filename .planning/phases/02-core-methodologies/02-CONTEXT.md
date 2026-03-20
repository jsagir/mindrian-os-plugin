# Phase 2: Core Methodologies - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

ALL 25+ methodology commands built in Phase 2 (not split across phases). Each command produces structured artifacts in Larry's voice, filed to the correct Data Room sections with user confirmation. Passive Room intelligence auto-classifies insights via hybrid hook+skill pattern. Problem type classification (undefined/ill-defined/well-defined + wicked complexity axis) drives methodology routing. Phase 4 becomes Brain-only (no methodology work).

</domain>

<decisions>
## Implementation Decisions

### Methodology Scope — ALL in Phase 2
- **ALL 25+ methodologies built in Phase 2** — no Phase 4 methodology split
- Source material: V2 prompts (30 files) + V4 Claude Desktop project specs (16 files) + Brain bots (15) + Notion examples
- Build in **complexity order**: simplest commands first to validate the thin skill + reference pattern, then batch the rest
- Phase 4 becomes purely Brain MCP integration (enrichment, not content)
- The 8 originally-planned Phase 2 commands PLUS all 14 Phase 4 commands PLUS any additional from V4 specs
- Includes: HSI, Cross-Pollination, Reverse Salient, Bono process, Minto, Domain Explorer, Beautiful Question, JTBD, Scenario Analysis, Red Team, Nested Hierarchies, Known/Unknown Matrix, S-Curve, Ackoff DIKW, Root Cause, Trending to the Absurd, PWS Grading, Investment Thesis, and all others from V2/V4/Brain

### CRITICAL: Source Material Examination
- **Researcher MUST examine ALL of these** — they are the goldmine:
  - V4 Claude Desktop project specs: `/home/jsagi/MindrianOS/.planning/research/pws-academy-input/claude-project-*.md` (16 files — each shows real usage of a methodology applied to actual problems)
  - V4 Week content: `pws-week-7-combining-tools.md` (pipeline chaining logic), `pws-week-3-macro-trends.md`, `pws-week-6-systems-thinking.md`, etc.
  - V2 prompts: `/home/jsagi/MindrianV2/prompts/*.py` (30 files — the actual bot logic)
  - V3 prompts: `/home/jsagi/MindrianV3/prompts/` (evolution of V2)
  - V3 skills: `/home/jsagi/MindrianV3/skills/`
  - V4 design docs: `/home/jsagi/MindrianOS/docs/design/02-ORCHESTRATION.md` (orchestration patterns), `04-CONTEXT-PIPELINE.md` (context flow)
  - Notion examples of real usage (user will reshare — capture when available)
- These are NOT just prompts — they show how Mindrian THINKS, how methodologies chain, and how real problems are approached

### Mini-Agent Factory Pattern
- User provided a "Framework Orchestration Planner" reference showing the V2/V4 methodology execution model:
  1. Sequential thinking to understand challenge complexity
  2. Neo4j schema investigation for relevant PWS material
  3. Framework selection and sequencing (5-8 frameworks, parallel phases, sequential dependencies)
  4. Mini-agent creation per framework with specific inputs/outputs
- This pattern should inform how methodology commands orchestrate internally

### Problem Type Classification (Critical — Not Yet In Place)
- **Two-dimensional classification** drives methodology routing:
  - **Definition axis**: Undefined → Ill-defined → Well-defined
  - **Complexity axis**: Simple → Complicated → Complex → Wicked (Cynefin-informed)
  - Wicked is BOTH a complexity level AND can overlay any definition type (an undefined problem can be wicked)
- Problem type **evolves over time** — starts as 'undefined', Larry reclassifies as Room fills up, routing adapts
- Brain has `ADDRESSES_PROBLEM_TYPE` relationships connecting frameworks to problem types — researcher must query these
- This classification is what makes methodology routing intelligent, not random

### Methodology Session Flow
- **Adaptive conversation**: Larry uses the framework as a guide but adapts based on what the user says. No rigid stages — Larry's judgment drives the flow
- **User controls depth**: Larry asks "Quick pass or deep dive?" at the start. Adapts session length accordingly (5-10 min quick, 15-30 min deep)
- **Larry manages chaining**: Larry can suggest chaining to another methodology mid-session ("This connects to JTBD — want to switch?")
- **Surface adaptation**: Claude's discretion on how to adapt for CLI vs Desktop vs Cowork (tri-polar design rule)

### Artifact Output Format
- **Larry's voice**: Artifacts written as Larry would write them — with his challenging tone, teaching style, PWS vocabulary
- **Framework-specific templates**: Each methodology has its own markdown template (JTBD has functional/emotional/social jobs table, Bono has 6 hat sections, etc.)
- **File naming**: `room/[section]/[methodology]-[YYYY-MM-DD].md` — multiple runs accumulate
- **Provenance metadata**: Claude's discretion on format (frontmatter vs footer vs both)

### Passive Room Intelligence
- **Confirm then file**: Larry shows the artifact and asks "File this to market-analysis?" before filing. User confirms or redirects
- **Classification routing**: Hybrid — PostToolUse hook does quick keyword match, if uncertain defers to room-passive skill for deeper classification
- **Cross-room insights**: Primary room + cross-reference links in other relevant rooms
- **Noise control**: Only file **actionable findings** — things that change a decision or reveal something new. Larry suggests, user confirms
- **STATE.md update**: GSD pattern — computed on SessionStart (load) and Stop (persist). End-of-session recompute via Stop hook

### Claude's Discretion
- Surface-specific adaptations for methodology sessions (CLI vs Desktop vs Cowork)
- Provenance metadata format (frontmatter, footer, or both)
- Framework template structure details for each methodology
- How to handle methodology sessions that span multiple context windows

</decisions>

<specifics>
## Specific Ideas

- V4 Claude Desktop project specs show REAL usage examples — e.g., Domain Explorer applied to quantum dot manufacturing (claude-project-6), Minto applied to argumentation (claude-project-1), HSI applied to innovation scoring (claude-project-10)
- Week 7 "Combining Tools" content shows the pipeline chaining pattern: Reverse Salient identifies bottlenecks → other frameworks address them sequentially
- Mini-Agent Factory pattern: challenge decomposition → framework selection → parallel/sequential phases → mini-agent per framework
- Brain's VentureStage routing maps directly to progressive disclosure of commands
- Problem type classification (un/ill/well-defined + wicked) is the KEY routing intelligence — it determines which methodologies Larry recommends
- AssessmentPhilosophy: "Grade on thinking, not polish. Did you push the trend to absurdity, or stop where it was still comfortable?" — this IS how Larry evaluates outputs

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `references/methodology/index.md` — complete command list with action-oriented names and default rooms (needs updating for all 25+)
- `skills/room-passive/SKILL.md` — passive intelligence skill (exists, needs implementation)
- `skills/pws-methodology/SKILL.md` — methodology awareness skill with routing index
- `skills/context-engine/SKILL.md` — context loading skill
- `agents/larry-extended.md` — Larry agent body with personality, mode engine pointers
- `references/personality/voice-dna.md` — Larry's voice patterns for artifact writing
- `references/personality/assessment-philosophy.md` — grading rubric and philosophy
- `hooks/hooks.json` — SessionStart and Stop hooks already wired
- `scripts/compute-state` — filesystem scanner with venture stage inference
- `commands/new-project.md` — deep exploration flow (reference for methodology session pattern)

### Established Patterns (from Phase 1)
- Thin skill SKILL.md (~300 tokens) + on-demand reference loading
- `disable-model-invocation: true` for user-invoked commands (context budget)
- Methodology default room + Larry override routing
- YAML frontmatter for metadata
- Polyglot hook wrapper (run-hook.cmd) for cross-surface compatibility
- GSD state pattern: compute on load/stop, not incremental

### Integration Points
- PostToolUse hook needs updating to support passive classification
- `references/methodology/` needs one reference file per methodology
- `commands/` needs one command file per methodology
- Brain MCP (Phase 4) will enhance routing via ADDRESSES_PROBLEM_TYPE and CO_OCCURS relationships

### Source Material Locations (CRITICAL for researcher)
- V4 project specs: `/home/jsagi/MindrianOS/.planning/research/pws-academy-input/claude-project-*.md` (16 files)
- V4 week content: `/home/jsagi/MindrianOS/.planning/research/pws-academy-input/pws-week-*.md`
- V4 design docs: `/home/jsagi/MindrianOS/docs/design/` (5 files)
- V2 prompts: `/home/jsagi/MindrianV2/prompts/*.py` (30 files)
- V2 Larry skill: `/home/jsagi/MindrianV2/prompts/larry_skill/` (8 files)
- V3 prompts: `/home/jsagi/MindrianV3/prompts/`
- V3 skills: `/home/jsagi/MindrianV3/skills/`
- Brain Neo4j: 15 bots, 58 frameworks, 24 tools, 4 VentureStages, ADDRESSES_PROBLEM_TYPE, CO_OCCURS, FEEDS_INTO relationships

</code_context>

<deferred>
## Deferred Ideas

- Pipeline chaining (Phase 3) — output-becomes-input pattern. Phase 2 builds individual commands; Phase 3 chains them.
- Proactive Room intelligence (Phase 3) — gap detection, contradiction alerts, convergence signals. Phase 2 does passive only.
- Brain enrichment (Phase 4) — contextual chaining, calibrated grading, cross-project patterns. Phase 2 uses static references.
- Notion usage examples — user will reshare. Capture when available for researcher.

</deferred>

---

*Phase: 02-core-methodologies*
*Context gathered: 2026-03-20*
