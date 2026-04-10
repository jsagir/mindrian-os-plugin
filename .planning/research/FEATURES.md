# Feature Landscape

**Domain:** MCP Intelligence Server with Memory System and Interactive UI
**Researched:** 2026-04-09
**Milestone:** v2.0 Mindrian Platform -- SQLite + MCP Server

## Table Stakes

Features users expect from a production MCP server with 20+ tools, memory, and interactive UI. Missing = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hierarchical tool router (keep 9 routers, not 23 flat tools) | LLMs degrade at 20+ tools -- empirically proven. GitHub Copilot cut 40 to 13 for measurable gains. Block rebuilt 30+ Linear tools to 2. MindrianOS already has 9 routers covering 64 commands in tool-router.cjs. | Already built | Do NOT expand to 23 flat tools as the milestone doc suggests. Add new commands as subcommands within existing routers. |
| Server instructions for tool orchestration | MCP spec feature (Nov 2025) that teaches LLMs multi-step workflows. GPT-4 Mini showed +60% success rate with instructions vs without. This IS where "Larry Lite" lives -- not as personality, but as methodology instinct. | Low | Declare in McpServer init response. Focus on tool relationships and workflow patterns, not personality directives. |
| Outcome-oriented tool design | Industry consensus (Phil Schmid, MCP Bundles, Workato): tools should return complete outcomes, not CRUD operations. "track_order(email)" returns full status, not separate get_order + get_shipping + get_tracking. | Med | Audit existing 9 routers for outcome-orientation. Some currently dispatch to individual CLI commands rather than composing results. |
| SQLite WAL-mode concurrent access | KuzuDB abandoned Oct 2025 (archived on GitHub). SQLite WAL mode solves MCP/plugin concurrent writes -- the actual blocker for co-development. Every serious embedded DB use case in 2026 uses this. | Med | better-sqlite3 is the correct choice. WAL mode is one pragma. Room.db at room/.mindrian/room.db replaces .lazygraph/ directory. |
| Graph tables (nodes, edges, concepts) | Replacing .lazygraph/ KuzuDB schema. 19 edge types already defined in lazygraph-ops.cjs (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES, etc). | Med | Single replacement point: lazygraph-ops.cjs. 24+ files touch KuzuDB but 90% route through this one module. |
| Memory L0: Identity persistence | System must remember who the user is, project context, core preferences across sessions. Every memory system starts here -- MemPalace, Mem0, Claude's native memory all have this tier. | Low | One row per identity key. Rarely changes. Partially exists in STATE.md but not queryable or persistent across rooms. |
| Memory L1: Temporal facts with validity windows | MemPalace (April 2026, 96.6% LongMemEval recall) proved temporal knowledge graphs with validity windows are SOTA. Facts have valid_from/valid_to; invalidation marks end dates without deletion. | Med | SQLite schema: entity, predicate, object, valid_from, valid_to, source, confidence. Enables "what was true about X on date Y?" queries. |
| Memory L2: Session continuity | Session-level recall so Larry knows what happened in previous sessions. MemPalace showed +15.2% gains in multi-session recall vs turn-level approaches. | Med | session_id, started_at, ended_at, summary, key_decisions, room_path. Populated at session end via hook. |
| Memory L3: Conversation fragments | Important quotes, specific instructions, exchanges worth preserving verbatim. The "drawer" level in MemPalace's palace metaphor. | Low | fragment_id, session_id, content, importance_score, tags. Selective storage -- not full conversation history. |
| MCP Apps dashboard rendering | MCP Apps (SEP-1865, released Jan 2026) is THE official standard for in-chat interactive UI. Co-developed by Anthropic + OpenAI. Supported in Claude, VS Code Insiders, ChatGPT, Goose. | High | @modelcontextprotocol/ext-apps SDK. Tools declare _meta.ui.resourceUri pointing to ui:// resources. HTML rendered in sandboxed iframes. Bidirectional comms via postMessage JSON-RPC. |
| Assumption tracking with validity lifecycle | MindrianOS Key Decision #12: "Assumptions are first-class entities." Every claim needs untested/supported/contradicted/stale status. Opportunity Score 18 -- highest underserved outcome. | Med | SQLite table: assumption_id, claim, section, status (enum), evidence[], tested_at, invalidated_by. Status transitions triggered by new evidence, time elapsed, or user override. |
| Natural language graph queries | Users should never see SQL or Cypher. Larry translates questions to structured queries. This is a standard expectation for any graph-backed intelligence system in 2026. | Med | Pattern: user question -> Larry generates SQL -> execute against room.db -> format results as narrative response. |
| Error handling with recovery suggestions | MCP best practice: every error response includes what went wrong AND what to try instead. Not just "tool failed" but "tool failed because X, try Y instead." | Low | Wrap all tool handlers with try/catch returning structured { error, suggestion, alternative_tool }. |
| Tool response with "Suggested Next" | Already implemented in tool-router.cjs. Every response includes next tool + args + rationale for pipeline chaining. | Already built | This IS the MWP cascade pattern via MCP. Keep and enhance. |

## Differentiators

Features that set MindrianOS apart from generic MCP servers. Not expected, but high-value for an intelligence platform.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Intelligence cascade via MCP | Post-write triggers: graph-index -> HSI -> reverse-salients -> presentation. Already works in CLI hooks. MCP tools must fire the same cascade for surface parity. No other MCP server has write-triggered intelligence pipelines. | Med | runCascade() referenced in tool-router.cjs. Cascade must fire identically whether user is on CLI (hooks) or Desktop/Cowork (MCP). |
| Cross-subsystem contradiction detection | When a fact in one room section contradicts another section, the system catches it automatically. MemPalace does this for simple facts; MindrianOS does it for venture intelligence across hierarchically organized sections. | High | Combines temporal facts (L1) + graph edges (CONTRADICTS, INVALIDATES) + proactive intelligence loop. This is the moat -- integration of 7 MWP layers. |
| De Stijl interactive knowledge graph as MCP App | Cytoscape.js graph visualization rendered in-chat via MCP Apps iframe. Users click nodes, explore connections, filter by edge type -- inside Claude/ChatGPT. No context window consumed by graph rendering. | High | ext-apps SDK. HTML+JS bundle served as ui:// resource. Bidirectional: graph clicks trigger callServerTool() for deeper exploration. Existing dashboard HTML generator provides the template. |
| Wiki view as MCP App | Room sections as navigable wiki pages rendered in-chat. Nodes = pages, edges = hyperlinks. Interactive exploration without consuming context tokens. | High | Second MCP App. Reuse existing wiki HTML generator from exports. Add callServerTool() for "dive deeper into this section" interactions. |
| Assumption validity lifecycle engine | Automated tracking: untested -> tested (with evidence link) -> supported/contradicted -> stale (time-based decay). No other MCP server or memory system tracks claim validity with evidence linking. | Med | Status transitions triggered by: new evidence filed (auto-detect via graph-index), time elapsed (configurable staleness threshold), user override. Graph edges link assumptions to supporting/contradicting evidence. |
| Larry Lite via server instructions | Not a personality -- a 200-line methodology instinct that teaches any host LLM WHEN to use WHICH tool, in WHAT sequence. Encodes mode engine calibration (40:30:20:10 conceptual:storytelling:problem-solving:assessment) as tool workflow guidance. | Med | Server instructions field in MCP init. Focus on: tool ordering rules (always room_state before methodology), constraint sequences, stage-appropriate tool selection. Anti-pattern: personality directives in instructions. |
| Proactive intelligence at session start | MCP server computes catch-up summary when connected: what changed since last session, new contradictions, convergence signals, stale assumptions. No other MCP server provides session-aware onboarding. | Med | session-catchup.cjs already exists. Expose as MCP resource (session://catchup) or initial prompt containing delta summary. Memory L2 sessions table enables "last session" comparison. |
| Bidirectional stage progression tracking | Ventures regress. When market feedback invalidates a supported assumption, the stage can move backward with full history preservation. Forward-only progress trackers miss this reality. | Med | Memory L1 temporal facts + assumption status changes = automatic regression detection. History preserved via valid_from/valid_to on all facts. |
| Rejection as graph data | When user rejects a Larry suggestion, the reason becomes a graph node. "Why not" teaches the system as much as "yes." Negative signal capture is unique to MindrianOS. | Low | rejection_id, tool_name, suggestion, reason, timestamp. Node type in graph. Feeds back into Larry Lite's server instructions as avoidance patterns over time. |
| Multi-room memory isolation with cross-room opt-in | Each room gets its own room.db with isolated graph + memory. Cross-room queries possible but explicitly opt-in. Privacy by default, synthesis by choice. | Med | room/.mindrian/room.db per room. Memory tables scoped by room. Cross-room = ATTACH database in SQLite for join queries across rooms. |

## Anti-Features

Features to explicitly NOT build. Each would dilute the product or fight existing architecture.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 23 flat MCP tools | LLMs degrade above 20 tools -- GitHub Copilot and Block both proved fewer = better. The milestone doc says "23 tools in 3 tiers" but tool-router.cjs already solves this with 9 hierarchical routers covering 64 commands. Expanding to 23 flat tools would REGRESS tool selection quality. | Keep the 9-router pattern. New Brain/Room/Graph capabilities become subcommands within existing routers (e.g., brain_ask becomes a subcommand of the intelligence router). |
| Full personality in server instructions | MCP blog (Nov 2025) explicitly warns: personality directives in server instructions "don't work." Instructions are for tool workflow guidance. Larry's personality belongs in the plugin skills layer, not the MCP server. | Larry personality stays in skills/agents (plugin layer). Larry Lite = methodology instinct only -- tool ordering, workflow patterns, stage awareness. |
| Vector embeddings in room.db | Mixing sqlite-vss or similar vector extensions into SQLite adds native compilation complexity, breaks cross-platform compatibility, and creates a dependency that fights the "zero infrastructure" promise. | Keep Pinecone for semantic search (already deployed at brain.mindrian.ai). SQLite handles structured data only: graph + memory + assumptions. |
| Real-time collaboration in MCP Apps | MCP Apps iframes are sandboxed, single-user by design. WebSocket collaboration fights the security model and adds infrastructure MindrianOS doesn't have. | Cowork handles multi-user natively. MCP Apps are single-user interactive views. Collaborative features live in the Cowork surface, not in MCP Apps. |
| Custom CSS forcing De Stijl in all hosts | MCP Apps provides useHostStyles() for matching host theme. Forcing De Stijl in ChatGPT or VS Code creates visual clashes and breaks host UX expectations. | De Stijl as default when no host theme detected. useHostStyles() for host-adaptive rendering. Progressive enhancement: full De Stijl in Claude, adaptive elsewhere. |
| Cron/scheduler for memory consolidation | No persistent process in v2.0. Plugin runs in Claude's environment. node-cron requires a long-running server that doesn't exist in stdio transport mode. | Session-start hook handles all periodic work: memory consolidation, stale assumption detection, opportunity scanning. Session start IS the trigger -- no daemon needed. |
| REST API wrapper (1:1 command-to-tool mapping) | The #1 anti-pattern in MCP server design (Phil Schmid, 2026): "A good REST API is not a good MCP server." Converting 64 CLI commands to 64 MCP tools would be catastrophic for LLM tool selection. | Outcome-oriented routers that compose multiple commands internally. The 9-router pattern already does this correctly. |
| TypeScript for MCP server | Build step breaks "every output is an edit surface" principle. CJS files are directly inspectable and editable by both humans and Claude. Established STACK.md decision. | Plain CJS with JSDoc type annotations where needed. Zod provides runtime validation equivalent to TS compile-time checks. |
| SQLite replacing STATE.md for room state | Creates dual source of truth with filesystem. Breaks ICM principle: "folder IS orchestration." STATE.md is the room state authority -- that is a foundational architectural decision. | STATE.md remains room state authority (ICM Layer 0). SQLite handles supplementary data: graph topology, memory tiers, assumptions. These are queryable indexes, not state replacements. |
| Full conversation history storage | Storing all conversation turns in memory would explode storage and violate privacy expectations. Users don't expect an MCP server to record everything they say. | Memory L3 stores only explicitly important fragments: key decisions, instruction overrides, rejection reasons. Selective, not comprehensive. |

## Feature Dependencies

```
SQLite Migration (lazygraph-ops.cjs rewrite)
  |-> Graph tables (nodes, edges, concepts)
  |-> Memory tables (L0 identity, L1 facts, L2 sessions, L3 fragments)
  |-> Assumption tracking tables
  |-> Natural language graph queries (require graph tables)

MCP Apps SDK Integration (@modelcontextprotocol/ext-apps)
  |-> ui:// resource registration in MCP server
  |-> De Stijl dashboard as MCP App (first app, proves pattern)
  |-> Knowledge graph visualization as MCP App (requires graph tables)
  |-> Wiki view as MCP App (requires graph tables)

Larry Lite (server instructions)
  |-> NO dependency on SQLite or MCP Apps
  |-> Ships independently as server instruction string in MCP init
  |-> Evolves based on rejection data (L3 fragments) over time

Intelligence Cascade via MCP
  |-> Requires: graph tables (for graph-index step)
  |-> Requires: runCascade() wired into MCP tool handlers
  |-> Enables: cross-subsystem contradiction detection
  |-> Enables: proactive intelligence at session start

Assumption Tracking
  |-> Requires: SQLite migration (assumption table)
  |-> Requires: graph tables (evidence linking via edges)
  |-> Enables: bidirectional stage progression detection
  |-> Enables: proactive intelligence (stale assumption alerts)

Session Catchup (proactive intelligence)
  |-> Requires: Memory L2 (session table for "last session" comparison)
  |-> Requires: Memory L1 (temporal facts for "what changed")
  |-> Partially built: session-catchup.cjs exists
```

## MVP Recommendation

Prioritize (Workstream A first, then B in parallel with C):

1. **SQLite migration via lazygraph-ops.cjs** -- Replace KuzuDB. Graph tables + memory tables + assumption tables in one room.db. This unblocks everything else. Single replacement point makes this tractable.
2. **Memory L0-L1** -- Identity persistence + temporal facts with validity windows. Immediate recall improvement. The "170 tokens to recall everything" pattern from MemPalace applies: store structured facts, load a compact summary at session start.
3. **Assumption tracking with validity lifecycle** -- First-class assumption entities. This is the #1 underserved outcome (Opportunity Score 18) and the deepest moat feature. No competitor has this.
4. **Larry Lite server instructions** -- 200 lines of methodology instinct in server init. Zero dependency on SQLite. Ship in parallel with Workstream A.
5. **Intelligence cascade via MCP** -- Surface parity: MCP tools fire the same cascade as CLI hooks. Requires graph tables from step 1.
6. **MCP Apps: De Stijl dashboard** -- First interactive in-chat UI. Proves the MCP Apps pattern. Requires ext-apps SDK integration.

Defer:
- **MCP Apps: Wiki view** -- Second interactive app. Build after dashboard pattern is proven and working in Claude + at least one other client.
- **MCP Apps: Knowledge graph visualization** -- Third interactive app. Most complex (Cytoscape.js in iframe with bidirectional tool calls). Build last.
- **Memory L2-L3** -- Session recall and fragments. L0-L1 cover ~80% of recall value. L2-L3 are refinements.
- **Cross-room memory queries** -- Edge case until users have 3+ active rooms. ATTACH database pattern is straightforward when needed.
- **Rejection as graph data** -- Valuable signal but not blocking. Add after assumption tracking proves the validity lifecycle works.

## Existing Capabilities to Leverage

These lib/core/*.cjs modules are the shared core that MCP tools wrap. New features MUST extend these, not create parallel paths. The co-development rule: every new capability ships as both plugin command AND MCP tool.

| Module | Relevance to v2.0 | Integration Point |
|--------|-------------------|-------------------|
| lazygraph-ops.cjs | PRIMARY migration target. SQLite replaces KuzuDB here. 24+ files route through this single module. | Rewrite internals from KuzuDB to better-sqlite3. Keep the same exported API (openGraph, closeGraph, initSchema, indexArtifact, rebuildGraph, queryGraph, graphStats). |
| intelligence-cascade.cjs | Cascade logic for post-write triggers. MCP tools must call this after write operations. | Wire runCascade() into MCP tool handlers that modify room content. |
| proactive-intelligence.cjs | Gap/contradiction/convergence detection. Memory L1 temporal facts enhance detection quality. | Assumption tracking feeds new signals into proactive detection. |
| session-state.cjs | Session tracking. Memory L2 extends this with SQLite persistence for cross-session recall. | Add session summary storage at session end. |
| brain-client.cjs | Brain API calls. Larry Lite server instructions describe when to invoke Brain tools. | Server instructions reference Brain tools in workflow patterns. |
| room-ops.cjs | Room CRUD operations. MCP routers already wrap this. | No change needed -- stable API. |
| graph-ops.cjs | Graph building from room artifacts. Directly affected by SQLite migration. | Update to write SQLite graph tables instead of KuzuDB. |
| session-catchup.cjs | Catch-up computation at MCP connect time. | Enhance with Memory L1 temporal delta: "what facts changed since last session." |

## Sources

- [MCP Server Best Practices - Phil Schmid](https://www.philschmid.de/mcp-best-practices) -- outcome-oriented design, agent-first thinking, anti-REST-wrapper pattern [HIGH confidence]
- [The Six-Tool Pattern - MCP Bundles](https://www.mcpbundles.com/blog/mcp-tool-design-pattern) -- reducing 12+ tools to 6 via category grouping [HIGH confidence]
- [MCP Tool Overload - DEV Community](https://dev.to/nebulagg/mcp-tool-overload-why-more-tools-make-your-agent-worse-5a49) -- empirical evidence LLMs degrade above 20 tools [HIGH confidence]
- [Server Instructions - MCP Blog](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/) -- teaching LLMs tool workflows, +60% GPT-4 Mini success rate [HIGH confidence]
- [MCP Apps Official Release - MCP Blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) -- SEP-1865, ui:// scheme, ext-apps SDK, iframe sandbox [HIGH confidence]
- [MCP Apps GitHub - ext-apps](https://github.com/modelcontextprotocol/ext-apps/) -- SDK packages, API, server-side app registration [HIGH confidence]
- [MemPalace Memory System](https://recca0120.github.io/en/2026/04/08/mempalace-ai-memory-system/) -- L0-L3 tiers, SQLite temporal KG, 96.6% recall, contradiction detection [MEDIUM confidence - very new, limited independent verification]
- [SEP-993: Namespaces - MCP GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/993) -- official namespace proposal for tool grouping [HIGH confidence]
- [MCP 2026 Roadmap - WorkOS](https://workos.com/blog/2026-mcp-roadmap-enterprise-readiness) -- OAuth 2.1, enterprise priorities [MEDIUM confidence]
- [Anthropic + OpenAI MCP Apps - Inkeep](https://inkeep.com/blog/anthropic-openai-mcp-apps-extension) -- joint MCP Apps development [MEDIUM confidence]
- [MCP Best Practices - CData](https://www.cdata.com/blog/mcp-server-best-practices-2026) -- 2026 production patterns [MEDIUM confidence]
- [Agentic MCP Configuration - PulseMCP](https://www.pulsemcp.com/posts/agentic-mcp-configuration) -- dynamic tool loading for large servers [MEDIUM confidence]

---
*Feature research for: v2.0 Mindrian Platform -- SQLite + MCP Server*
*Researched: 2026-04-09*
