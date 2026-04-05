# Feature Landscape

**Domain:** AI methodology/teaching plugin for Claude Code with structured workspace (Data Room) and knowledge graph integration
**Researched:** 2026-03-19

## Table Stakes

Features users expect from an AI methodology plugin. Missing any of these and users uninstall or never adopt.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-command install, zero config | Claude Code plugins install in one command; 340+ plugins set this bar. Any setup friction kills adoption. | Low | `claude plugin install mindrian-os` -- Larry must speak immediately |
| Methodology bot conversations | Core value prop. Users expect to invoke a framework (Minto, Bono, JTBD) and get guided through it conversationally. MagicSchool AI ships 60+ purpose-built tools; users expect breadth. | Medium | 25 bots, each a skill .md file. Port from V2 prompts. |
| Structured output per methodology | Every framework run must produce a tangible artifact (markdown file), not just chat. Claude Code users expect editable file output -- "every output is an edit surface." | Medium | ICM Layer 4 artifacts. Each pipeline writes to Room sections. |
| Persistent workspace (Data Room) | PKM tools (Notion, Tana, Obsidian) set the bar: work must persist across sessions. Claude Code users already expect project-level memory via CLAUDE.md. Data Room is just structured memory. | Medium | 8-section folder structure with STATE.md per room. GSD pattern. |
| Session continuity | Users return days later and expect context. Claude Code memory + CLAUDE.md already provides this. Plugin must not break it. | Low | Master STATE.md aggregating room tree. SessionStart hook loads context. |
| Graceful degradation | Plugins that require external services to function at all get 1-star reviews. Tier 0 must be fully functional with zero dependencies. | Medium | Embedded references/ as fallback for Brain. Static chain suggestions. |
| Help and discoverability | With 25 bots and multiple commands, users need `/mindrian-os:help` or similar. Claude Code ecosystem norm is discoverable commands. | Low | Command listing, brief descriptions, suggested starting points |
| Cross-surface compatibility | Claude Code runs on CLI, Desktop, and Cowork. Users expect same plugin everywhere. This is a platform requirement, not optional. | Low | Same CLAUDE.md, same .mcp.json. Cowork gets 00_Context/. |

## Differentiators

Features that set MindrianOS apart from generic AI chatbots or competing methodology tools. Not expected, but create "aha" moments and lock-in.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Larry personality and mode engine** | Not a generic chatbot -- a teaching personality with 40:30:20:10 mode distribution (conceptual:storytelling:problem-solving:assessment). No other Claude Code plugin has a calibrated AI personality. Strategyzer and Braineet have no personality layer at all. | Medium | Mode engine algorithm in plugin. Calibration data in Brain (paid tier). |
| **Passive Room intelligence** | Auto-capture, classify, and file every insight to the correct Data Room section without user action. PostToolUse hook intercepts all output. No competing tool does passive classification into a structured workspace -- Notion AI requires manual organization. | High | PostToolUse hook + classification skill. Must be fast (<500ms) to avoid blocking. |
| **Proactive Room intelligence** | Room detects gaps ("no competitive analysis yet"), contradictions ("market size claim conflicts with TAM in financials"), convergence ("3 frameworks point to same customer segment"), and suggests next methodology. This is the "OS" in MindrianOS. | High | Room analyst agent. Runs on SessionStart and periodically. Depends on STATE.md quality. |
| **Pipeline chaining through Room** | Output of one framework becomes structured input to the next (Domain Explorer sub-domains become Bono hat perspectives become JTBD personas). Week 7 pattern. No other tool chains innovation frameworks sequentially with structured handoffs. | High | ICM stage contracts per pipeline. TRANSFORMS_OUTPUT_TO relationships. |
| **Brain MCP enrichment (paid)** | 21K-node teaching graph provides: which framework to use when, what to chain next, calibrated grading, cross-domain connections. Difference between textbook and professor. This is the moat -- unreplicable without 30+ years of teaching data. | Medium (integration) | Brain already deployed at brain.mindrian.ai. Plugin just calls MCP tools. |
| **Calibrated grading** | 5-component rubric calibrated from 100+ real student projects. Detects Vision-to-Execution Gap, Framework Vomit, Solution-First thinking. No competing tool grades innovation work against calibrated standards. | Low (Brain does it) | Plugin sends room state, Brain returns rubric scores + feedback. |
| **LazyGraph (personal knowledge graph)** | User's own Neo4j Aura Free grows as they work. Entries become nodes. Concepts link. Patterns form edges. Turns ephemeral chat into a growing knowledge structure. Tana does node-based PKM but without AI methodology context. | High | Neo4j Aura Free (50K node limit). Lazy creation on file events. |
| **Methodology extensibility** | Users create custom methodology bots: Level A (conversation, one .md, 5 min), Level B (full pipeline, folder, 30 min), Level C (Brain integration). Plugin becomes a platform, not just a tool. | Medium | Clear spec for each level. Community methodologies via marketplace. |
| **Room hierarchy with sub-rooms** | When user discovers distinct opportunity spaces, sub-rooms capture divergent exploration. State flows bottom-up, context flows top-down. Mimics how real innovation work branches. | Medium | Recursive STATE.md. Master aggregation. Sub-room creation command. |
| **Framework chain recommendations** | Brain's Layer 5: contextual next-framework suggestions based on room state + user history + problem classification. "Larry suggests the perfect next step." | Low (Brain does it) | Highest-value moat. Only works with Brain tier. Tier 0 gets static suggestions. |
| **Connector awareness** | Plugin detects available MCPs (Tavily, Notion, Supabase, etc.) and adapts behavior. If user has Tavily, research skills use it. If not, graceful fallback. No other plugin adapts to the user's MCP ecosystem. | Medium | Skill that inventories available MCPs on SessionStart. |

## Anti-Features

Features to explicitly NOT build. Each has a clear rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Web UI / dashboard** | V2 was a full-stack web app (Next.js + FastAPI + CopilotKit + Railway). The entire point of the plugin pivot is eliminating infrastructure. Building any web UI recreates the problem. | Claude's three surfaces (CLI, Desktop, Cowork) ARE the UI. Data Room files ARE the dashboard. |
| **Custom LLM support** | Claude-native plugin. Supporting OpenAI/Gemini/Llama adds massive complexity with no benefit. Claude Code users already chose Claude. | Hard dependency on Claude. Skills and prompts optimized for Claude's strengths. |
| **Real-time collaboration** | Cowork already handles multi-user collaboration natively. Building collab features is duplicating platform capability. | Cowork surface handles this. Plugin provides 00_Context/ for shared state. |
| **Brain graph editing by users** | Graph is proprietary IP. Exposing it lets users extract, replicate, or corrupt the moat. | Users get intelligence (suggestions, grades, chains), never data (nodes, relationships, queries). |
| **Payment processing in plugin** | Plugin is a teaching tool, not a payment system. Anthropic marketplace and Stripe handle billing. | External billing. Plugin checks tier via Brain MCP auth token. |
| **Mobile app** | Claude surfaces handle mobile. Building native mobile is a distraction. | Claude mobile app runs the same plugin. |
| **User analytics dashboard** | Tempting to build progress tracking UI, but it's scope creep. Room STATE.md already tracks progress as structured data. | STATE.md IS the analytics. Room proactive intelligence surfaces insights conversationally. |
| **Complex onboarding wizard** | Multi-step setup flows kill adoption. Plugin must work on first message with zero configuration. | Larry greets, asks about venture idea, starts working. Onboarding IS the first conversation. |
| **Embedded vector store** | Tempting to bundle a local vector DB for semantic search. Adds complexity, Brain already has Pinecone, and full-text search over Room files is sufficient for Tier 0. | Brain Pinecone for paid tier. Room file search for free tier. |
| **Framework content behind paywall** | Gating methodology content kills adoption and trust. Frameworks like JTBD and Minto are published knowledge. | All 25 methodology bots are free (Tier 0). Brain adds WHEN/HOW/SEQUENCE intelligence, not content. |

## Feature Dependencies

```
One-command install
  --> Larry personality (must be active immediately)
  --> Data Room structure (must exist on install)
  --> Help/discoverability (must be available from start)

Data Room (8 sections)
  --> STATE.md management
  --> Session continuity (SessionStart hook)
  --> Passive intelligence (PostToolUse hook)
  --> Proactive intelligence (room analyst agent)
  --> Room hierarchy / sub-rooms

25 Methodology bots (skills)
  --> Structured output (Layer 4 artifacts)
  --> Pipeline stage contracts (ICM Layer 2)
  --> Pipeline chaining through Room

Pipeline chaining
  --> Data Room (output destination)
  --> Methodology bots (pipeline steps)
  --> TRANSFORMS_OUTPUT_TO rules (embedded or Brain)

Brain MCP (optional)
  --> Framework chain recommendations
  --> Calibrated grading
  --> Mode engine calibration data
  --> Cross-domain connections
  (all gracefully degrade without Brain)

LazyGraph (optional)
  --> Data Room events (triggers node creation)
  --> Neo4j Aura Free account (user provisions)

Connector awareness
  --> SessionStart hook (MCP inventory)
  --> Graceful fallback per tool
```

## MVP Recommendation

**Prioritize (Phase 1 -- must ship):**
1. One-command install with Larry active immediately -- this IS the product pitch
2. Data Room (8 sections) with STATE.md -- the "OS" in MindrianOS
3. 5-8 core methodology bots (Domain Explorer, Minto Pyramid, Bono Six Hats, JTBD, Devil's Advocate, HSI, Investment Thesis, Lean Canvas) -- enough breadth to demonstrate value
4. Session continuity via SessionStart hook -- users must be able to return
5. Help and discoverability -- 25 bots is overwhelming without guidance

**Prioritize (Phase 2 -- makes it sticky):**
6. Passive Room intelligence (auto-classify output to sections)
7. Pipeline chaining for 2-3 key sequences (the Week 7 "combining tools" pattern)
8. Remaining 17 methodology bots
9. Proactive Room intelligence (gap detection, contradiction alerts)
10. Brain MCP integration (optional enrichment tier)

**Defer:**
- LazyGraph: High complexity, optional, and the value requires significant Room data to be meaningful. Ship after Room intelligence is proven.
- Methodology extensibility (Level A/B/C): Only valuable once community exists. Ship after marketplace presence.
- Room hierarchy / sub-rooms: Power feature for advanced users. Ship after single-room experience is polished.
- Cross-user intelligence (Brain flywheel): Requires significant user base. Design for it now, implement later.
- Connector awareness: Nice-to-have. Most users won't have exotic MCPs on day one.

**Defer rationale:** The core loop is: Larry greets --> user describes venture --> methodology bot runs --> output files to Room --> Room shows progress --> user runs next methodology. Everything outside this loop can wait.

## Competitive Landscape Context

| Competitor/Category | What They Do | What MindrianOS Does Differently |
|---------------------|-------------|----------------------------------|
| MagicSchool AI | 60+ education tools, structured templates | Domain-specific (innovation methodology), not general education. Pipeline chaining, not isolated tools. |
| Strategyzer | Innovation management platform, Business Model Canvas | Web app with rigid templates. MindrianOS is conversational, adaptive, lives in Claude. |
| Notion AI | Workspace + AI summarization/generation | General-purpose. No methodology intelligence, no teaching personality, no framework chaining. |
| Braineet | Innovation process management | Enterprise SaaS. No AI teaching, no personalization, no knowledge graph. |
| Other Claude Code plugins | 340+ plugins for dev workflows, testing, deployment | None target innovation methodology. No teaching personality. No structured workspace for non-code work. |
| GPT custom bots | Custom GPTs for specific tasks | Stateless conversations. No persistent workspace. No pipeline chaining. No knowledge graph. |

**MindrianOS occupies an empty niche:** AI-guided innovation methodology inside a developer-grade tool (Claude Code), with structured persistence (Data Room), framework intelligence (Brain), and a teaching personality (Larry). No existing product combines all four.

## Sources

- [Claude Code Plugin Marketplace Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Anthropic Official Plugins Directory](https://github.com/anthropics/claude-plugins-official)
- [Agent Skills Specification](https://github.com/anthropics/skills)
- [MagicSchool AI Platform](https://teachbetter.ai/best-ai-platforms-for-teachers-in-2026/)
- [Innovation Management Software -- Strategyzer](https://www.strategyzer.com/library/best-innovation-management-software)
- [Knowledge Graphs Reshaping AI Workflows](https://beam.ai/agentic-insights/5-ways-knowledge-graphs-are-quietly-reshaping-ai-workflows-in-2026)
- [Best Second Brain Apps 2026](https://buildin.ai/blog/best-second-brain-apps)
- [Innovation Framework Guide 2026](https://www.sixpathsconsulting.com/frameworks-for-innovation/)
