# Project Research Summary

**Project:** MindrianOS-Plugin
**Domain:** Claude Code Plugin -- AI methodology teaching tool with structured workspace
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

MindrianOS-Plugin is a Claude Code plugin that delivers AI-guided innovation methodology through a teaching personality (Larry), a structured workspace (Data Room), and optional knowledge graph enrichment (Brain MCP). Unlike traditional software projects, the entire "stack" is Markdown files, JSON configuration, and shell scripts -- there is no application runtime, no build system, no framework code. Claude Code discovers and loads plugin components (skills, agents, commands, hooks) from a standardized directory structure. The plugin's architecture follows the ICM (In-Context Methodology) principle: folder structure IS orchestration. This is a file-structure engineering problem, not a software engineering problem.

The recommended approach is to build in strict dependency order starting with the plugin skeleton and Larry personality (which must work on first message with zero configuration), then the Data Room state system, then methodology commands ported fresh for Claude Code (not translated from V2 Python prompts), then pipeline chaining, and finally external integrations (Brain MCP, LazyGraph). The critical architectural insight is that the 25 methodology commands must be user-invoked only (`disable-model-invocation: true`) to prevent context window starvation -- the single most dangerous pitfall. Only 5-6 background skills should auto-load. Everything else loads on demand.

The primary risks are: (1) context window exhaustion from loading too many skills/MCP tools simultaneously, which must be budgeted from day one or requires a full rewrite; (2) STATE.md consistency drift where Claude fails to maintain file-based state reliably, solved by computing state from filesystem truth via hooks rather than asking Claude to maintain it; and (3) the prompt porting trap where V2's 25 Gemini/Python prompts are naively copied into skills that are too long, assume wrong capabilities, and fight Claude's native personality. Each methodology must be redesigned for Claude Code as a thin skill (under 300 tokens) that references detailed pipeline contracts on demand.

## Key Findings

### Recommended Stack

The plugin has no traditional technology stack. The entire system is Markdown (CommonMark + YAML frontmatter), JSON (plugin manifest, hooks config, MCP config, settings), and Bash scripts (hook handlers). This is a hard constraint of the Claude Code plugin platform, not a choice. Python is used only for computation scripts (HSI scoring) where bash cannot suffice.

**Core technologies:**
- **Markdown + YAML frontmatter**: Skills (SKILL.md), agents, commands, pipelines, references -- Claude Code's native format for all plugin intelligence
- **JSON configuration**: plugin.json (manifest), hooks.json (event handlers), .mcp.json (Brain/LazyGraph connections), settings.json (default agent)
- **Bash scripts**: Hook handlers for SessionStart context injection, PostToolUse room intelligence, Stop state persistence -- zero dependencies, cross-platform via polyglot wrapper
- **Pipeline markdown files**: Custom convention (NOT a Claude Code primitive) -- numbered stage files that skills interpret as methodology workflows

**Critical version note:** Test on 200K context (Sonnet) not just 1M (Opus). Most free-tier users will have Sonnet.

### Expected Features

**Must have (table stakes):**
- One-command install with Larry active immediately -- this IS the product pitch
- 5-8 core methodology bots (Domain Explorer, Minto, Bono, JTBD, Devil's Advocate, HSI, Investment Thesis, Lean Canvas)
- Data Room with 8 sections and STATE.md -- the "OS" in MindrianOS
- Structured file output per methodology -- "every output is an edit surface"
- Session continuity via SessionStart hook -- users must return and find their work
- Graceful degradation -- Tier 0 fully functional with zero external dependencies
- Help and discoverability -- 25 bots is overwhelming without guidance

**Should have (differentiators):**
- Larry personality with 40:30:20:10 mode engine -- no other plugin has a calibrated teaching personality
- Passive Room intelligence -- auto-capture and classify insights to correct Data Room sections
- Pipeline chaining through Room -- output of one framework becomes structured input to the next (Week 7 pattern)
- Brain MCP enrichment -- 21K-node teaching graph provides framework chaining rules, calibrated grading, cross-domain connections
- Proactive Room intelligence -- gap detection, contradiction alerts, convergence signals (but start conservative)

**Defer (v2+):**
- LazyGraph (personal Neo4j knowledge graph) -- high complexity, optional, value requires significant Room data first
- Methodology extensibility (user-created bots) -- only valuable once community exists
- Room hierarchy / sub-rooms -- power feature for advanced users after single-room experience is polished
- Connector awareness (MCP ecosystem detection) -- nice-to-have, most users lack exotic MCPs on day one
- Cross-user intelligence (Brain flywheel) -- requires significant user base

### Architecture Approach

The architecture follows a four-layer model: Plugin Entry Layer (manifest, settings, hooks, MCP config), Component Layer (commands, skills, agents, pipelines), ICM Layer (folder-structure-as-orchestration with 5 numbered layers from identity to working artifacts), and Data/Intelligence Layer (local Room files, remote Brain MCP, optional LazyGraph). The default agent (`larry-extended` via settings.json) replaces Claude's system prompt entirely, making Larry the session personality. Skills auto-load contextual intelligence. Commands are user-invoked methodology tools. Pipelines are inert data that skills interpret.

**Major components:**
1. **larry-extended agent** -- Default session personality; preloads larry-personality, room-passive, and pws-methodology skills; all conversation runs through Larry
2. **Data Room (8 sections + STATE.md)** -- Persistent structured workspace in user's project directory; the integration bus where pipeline outputs become next pipeline inputs
3. **25 methodology commands** -- User-invoked slash commands (`/mindrian-os:bono`, etc.); each reads its pipeline contract and produces structured artifacts filed to Room sections
4. **Hook intelligence pipeline** -- SessionStart loads context, PostToolUse classifies and files insights, Stop persists state; scripts must complete in under 3 seconds
5. **references/ (Tier 0 factory)** -- 275 framework definitions, static chain suggestions, grading rubric; embedded fallback when Brain MCP is unavailable
6. **Brain MCP (Tier 1, remote)** -- The moat; provides chaining rules, grading calibration, cross-framework intelligence; never distributed, never exposes raw data

### Critical Pitfalls

1. **Context window starvation** -- 25 methodology skills + MCP tool descriptions + CLAUDE.md can burn 30-50K tokens before the user speaks. Prevention: methodology commands use `disable-model-invocation: true`, keep auto-invoked skills to 5-6, each skill under 300 tokens, use on-demand reference loading. Must be designed in Phase 1 or it requires a rewrite.

2. **STATE.md consistency drift** -- Claude deprioritizes bookkeeping side-effects (updating state files) when focused on user tasks. Prevention: compute state from filesystem truth via hook scripts on SessionStart, never trust STATE.md over actual directory contents, use PostToolUse hooks for programmatic updates rather than asking Claude to remember.

3. **V2 prompt porting trap** -- V2's Gemini/Python prompts assume stateful backend, CopilotKit router, React UI, and Gemini's personality. Naive copy produces bloated skills that fight Claude. Prevention: redesign each methodology natively for Claude Code; thin skill (under 300 tokens) + reference files loaded on demand; test against V2 output quality.

4. **Proactive intelligence becomes noise** -- Room gap detection and contradiction alerts that fire too often or inaccurately train users to ignore them. Prevention: ship passive intelligence first (auto-classify, auto-file), add proactive only with confidence gates, reserve full proactive suite for Brain tier.

5. **MCP cold start kills zero-config promise** -- Brain MCP in default .mcp.json means first interaction hangs on server startup. Prevention: Brain MCP NOT in default config; added only via `/mindrian-os:setup brain`; default experience is 100% local.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Plugin Skeleton and Larry Personality
**Rationale:** Everything depends on the plugin manifest, default agent, and context budget architecture. If the skeleton is wrong, everything built on top breaks. Larry speaking immediately on install is the entire product pitch.
**Delivers:** Working plugin that installs via one command; Larry personality as default agent; CLAUDE.md; plugin.json; settings.json; basic help/status commands
**Addresses:** One-command install, Larry personality, help/discoverability (table stakes)
**Avoids:** Context window starvation (budget from day one); MCP cold start (no Brain in default config); plugin name collision (finalize name now)

### Phase 2: Data Room and State System
**Rationale:** The Room is the critical path -- every downstream feature (commands, pipelines, hooks, Brain integration) reads from or writes to it. State management architecture must be validated before building on top of it.
**Delivers:** 8-section room folder structure; STATE.md computed from filesystem; SessionStart hook for context loading; Stop hook for state persistence; basic room management command
**Addresses:** Persistent workspace, session continuity (table stakes)
**Avoids:** STATE.md consistency drift (compute from filesystem truth, not incremental Claude updates)

### Phase 3: Core Methodology Commands (5-8)
**Rationale:** Methodology bots are the core value. After Room exists, commands can produce structured artifacts filed to sections. Start with 5-8 high-value frameworks, not all 25 at once.
**Delivers:** Domain Explorer, Minto Pyramid, Bono Six Hats, JTBD, Devil's Advocate, HSI, Investment Thesis, Lean Canvas as slash commands; references/ framework definitions for each; pipeline stage contracts for each
**Addresses:** Methodology bot conversations, structured output per methodology (table stakes)
**Avoids:** V2 prompt porting trap (redesign each methodology natively); context starvation (commands are user-invoked only, not auto-loaded)

### Phase 4: Passive Room Intelligence and Pipeline Chaining
**Rationale:** With commands producing Room artifacts, passive intelligence (auto-classify, auto-file) and pipeline chaining (output-becomes-input) activate the "OS" experience. This is what makes MindrianOS sticky.
**Delivers:** PostToolUse hook for insight classification; room-passive skill; pipeline chaining for 2-3 key sequences (Domain Explorer -> Bono -> JTBD); pws-methodology skill for framework selection guidance
**Addresses:** Passive Room intelligence, pipeline chaining (differentiators)
**Avoids:** Proactive noise (passive only in this phase -- high-value, low-risk)

### Phase 5: Remaining Methodologies and Proactive Intelligence
**Rationale:** With the core loop proven and sticky, expand breadth (remaining 17 bots) and add proactive intelligence gated by confidence thresholds.
**Delivers:** All 25 methodology commands; room-proactive skill (gap detection, convergence); grading command with Tier 0 static rubric
**Addresses:** Proactive Room intelligence, calibrated grading (differentiators)
**Avoids:** Proactive noise (confidence gates, Brain tier gets full suite)

### Phase 6: Brain MCP Integration
**Rationale:** Brain integration is the moat activation. Only build after the Tier 0 experience is complete and validated with real users. Brain enriches but never gates.
**Delivers:** .mcp.json Brain configuration via `/mindrian-os:setup brain`; enriched framework chaining; calibrated grading via Brain; mode engine calibration data; graceful degradation on connection failure
**Addresses:** Brain MCP enrichment, framework chain recommendations, calibrated grading (differentiators)
**Avoids:** MCP cold start (async connection, fallback to local); IP leakage (Brain returns intelligence, never raw data)

### Phase 7: LazyGraph, Extensibility, and Polish
**Rationale:** LazyGraph and extensibility are power features for engaged users. Ship only after core value is proven and community exists.
**Delivers:** LazyGraph setup and integration; methodology extensibility (Level A/B/C); room hierarchy / sub-rooms; connector awareness; three-surface testing and polish; marketplace submission
**Addresses:** LazyGraph, methodology extensibility, room hierarchy, connector awareness (deferred features)
**Avoids:** Over-engineering before validation; bifurcated LazyGraph experience

### Phase Ordering Rationale

- **Dependency-driven:** Each phase builds on the prior. Room (Phase 2) is the integration bus everything uses. Commands (Phase 3) produce Room artifacts. Intelligence (Phase 4-5) reads Room state. Brain (Phase 6) enriches command outputs. This matches the architecture's build order exactly.
- **Value-driven:** Phase 1-2 deliver a working product (Larry + Room). Phase 3 delivers the core methodology value. Phase 4 makes it sticky. Everything after Phase 4 is expansion and enrichment.
- **Risk-driven:** Context budget (Phase 1), state management (Phase 2), and prompt porting (Phase 3) are the three highest-risk areas. Addressing them in order means failures are caught early when refactoring cost is lowest.
- **Validation-driven:** Phase 1-3 should produce a usable MVP for 5 early users. Phase 4-5 should be informed by their feedback. Phase 6-7 should only proceed if Tier 0 engagement validates the core proposition.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Methodology Commands):** Each of the 25 V2 prompts needs individual analysis for Claude Code redesign. The prompt porting trap is real -- each methodology must be evaluated against Claude's native capabilities to determine what thin skill + reference structure is optimal. Batch research recommended.
- **Phase 4 (Pipeline Chaining):** The Week 7 chaining pattern (output-becomes-input) needs concrete data flow design. How exactly do structured artifacts in one Room section become typed inputs to another pipeline? Needs worked examples.
- **Phase 6 (Brain MCP):** Brain MCP tool interface design (what tools, what inputs/outputs, what caching strategy) needs research. The Brain exists but the MCP wrapper API does not yet.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Plugin Skeleton):** Well-documented Claude Code plugin structure. Superpowers and ElevenLabs plugins provide verified reference implementations.
- **Phase 2 (Data Room):** Standard file-based state management. GSD patterns provide STATE.md templates.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against official Claude Code plugin docs, Superpowers plugin source, ElevenLabs plugin source. No ambiguity -- the stack IS markdown + JSON + bash. |
| Features | HIGH | Table stakes derived from 340+ plugin ecosystem and competing innovation tools. Differentiators identified from unique Brain/Larry/Room combination. Anti-features clearly reasoned. |
| Architecture | HIGH | Plugin structure verified against official docs. ICM layering validated against paper. Build order derived from dependency analysis. Anti-patterns identified from real plugin inspection. |
| Pitfalls | HIGH | Critical pitfalls (context starvation, state drift, prompt porting) grounded in platform constraints and real plugin observations. Prevention strategies are concrete and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **Three-surface behavior differences:** Research identified this as a critical pitfall but could not fully enumerate which hooks, agent behaviors, and MCP features differ across CLI vs Desktop vs Cowork. Needs hands-on testing from Phase 1 onward.
- **Brain MCP tool interface:** Brain exists as a Neo4j + Pinecone deployment, but the MCP server wrapper with specific tool definitions (enrich_context, suggest_chain, grade_room, etc.) has not been built yet. Tool interface design is a Phase 6 prerequisite.
- **Context budget exact numbers:** Research estimates 30-50K tokens for full plugin overhead, but exact measurement requires building the skeleton and profiling with `--debug`. Must validate in Phase 1.
- **Methodology redesign effort:** Each of the 25 V2 prompts will need individual redesign effort. Some may port easily (simple conversation skills), others may need significant rethinking (pipeline-dependent bots). Cannot estimate until a few are attempted.
- **Marketplace submission process:** Publishing requirements, review timeline, and any content restrictions for methodology plugins are not fully documented. Research during Phase 7.

## Sources

### Primary (HIGH confidence)
- [Plugins reference - Claude Code Docs](https://code.claude.com/docs/en/plugins-reference) -- Complete plugin specification, manifest schema, environment variables
- [Skills documentation - Claude Code Docs](https://code.claude.com/docs/en/skills) -- SKILL.md format, frontmatter, auto-invocation
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) -- All 22 hook events, JSON schemas, exit codes
- [Plugin marketplaces - Claude Code Docs](https://code.claude.com/docs/en/plugin-marketplaces) -- Distribution, versioning
- [Subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents) -- Agent format, delegation patterns
- [MCP - Claude Code Docs](https://code.claude.com/docs/en/mcp) -- MCP server configuration
- Superpowers plugin v5.0.5 (local inspection) -- Skills structure, SessionStart hook, agent format
- ElevenLabs TTS plugin v0.1.0 (local inspection) -- Python hooks, setup commands, daemon pattern

### Secondary (MEDIUM confidence)
- [Claude Code Context Buffer Analysis](https://claudefa.st/blog/guide/mechanics/context-buffer-management) -- Context consumption numbers
- [MCP Context Optimization](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code) -- MCP tool token costs
- ICM paper (2603.16021v2) -- Folder-structure-as-orchestration theory
- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) -- Progressive disclosure
- Innovation management competitive landscape (MagicSchool AI, Strategyzer, Braineet, Notion AI)

### Tertiary (LOW confidence)
- [MCP context reduction approach](https://news.ycombinator.com/item?id=47193064) -- 98% reduction claim needs validation
- Community plugin development patterns (blog posts, dev.to guides) -- Useful but not authoritative

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
