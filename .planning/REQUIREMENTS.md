# Requirements: MindrianOS v1.8.0 Cowork Adaptation

**Defined:** 2026-04-05
**Core Value:** Every MindrianOS command, pipeline, and intelligence capability works identically across CLI, Desktop, and Cowork -- with Brain-driven routing and scheduled external intelligence on Cowork.

## v1.8.0 Requirements

### MCP Foundation

- [x] **MCP-01**: All 64 plugin commands are exposed as MCP tools via hierarchical routers (currently 49/64)
- [x] **MCP-02**: Router restructuring keeps each router group under 15 commands (split data_room 34-cmd group into sub-routers)
- [x] **MCP-03**: Intelligence cascade shared module (`intelligence-cascade.cjs`) called by both CLI hooks and MCP tool handlers for HSI/cross-ref/graph-update
- [ ] **MCP-04**: Brain-driven routing at MCP layer: orchestration router consults Brain for framework chain recommendations with 3-tier fallback (cache -> local heuristic -> Brain with 2s timeout)
- [x] **MCP-05**: All MCP tool outputs include standardized `## Suggested Next` section enabling LLM-orchestrated pipeline chaining
- [x] **MCP-06**: SDK upgraded from 1.27.1 to ^1.29.0 for Streamable HTTP transport and ext-apps peer dependency

### Surface Detection

- [x] **SURF-01**: Auto-detect CLI vs Desktop vs Cowork at server startup via environment signals (MINDRIAN_TRANSPORT, CLAUDE_SURFACE, /sessions directory, process.stdin.isTTY)
- [x] **SURF-02**: Dual transport: stdio for Desktop + Streamable HTTP for Cowork on same McpServer instance, selected by surface detection
- [x] **SURF-03**: `/mos:setup` auto-configures both MCP servers (Brain remote + MindrianOS local) based on detected surface
- [x] **SURF-04**: Capability-aware feature registration: MCP Apps only on Desktop/Cowork, Tasks only on Cowork, hooks only on CLI

### Write Safety

- [x] **WRITE-01**: KuzuDB write-gateway with promise-chain serialization in graph-ops.cjs preventing single-writer contention
- [x] **WRITE-02**: File-based write lock (`room/.graph/write.lock`) with PID, timestamp, and 5-second stale lock cleanup
- [x] **WRITE-03**: CLI hooks detect running MCP server and delegate graph writes rather than competing for KuzuDB lock

### Token Optimization -- Skill Compression

- [x] **TOKEN-01**: Native-first skill architecture: skills teach only domain-specific rules, not how to use tools Claude already knows (Read, Write, WebSearch, Agent)
- [x] **TOKEN-02**: Compress ui-system from ~28K bytes (~7,200 tokens) to ~8K bytes (~2,200 tokens) by removing examples and keeping rules only
- [x] **TOKEN-03**: Defer room-proactive and room-passive skills until room/ directory exists (zero capability loss, ~3,600 token savings)
- [x] **TOKEN-04**: Defer brain-connector skill until Brain is detected (~1,500 token savings, load on demand)
- [x] **TOKEN-05**: Progressive loading: Layer 0 always (~9K tokens), Layer 1 on-demand (full skill content when needed), Layer 2 Brain power-up (optional)
- [x] **TOKEN-06**: Per-turn base cost reduced from ~20,500 tokens to ~10,000 tokens for fresh install users

### Hook Optimization

- [x] **HOOK-01**: Post-write HSI debounce: skip recompute if same file written within 30s
- [x] **HOOK-02**: Analyze-room caching: skip if STATE.md hash unchanged (5-min TTL)
- [x] **HOOK-03**: Write batching: queue multiple artifact writes, single HSI compute for the batch
- [x] **HOOK-04**: Bridge file per-room isolation: move from /tmp/ hardcoded to ~/.mindrian/bridge/{room-hash}.json
- [x] **HOOK-05**: Framework recommendation cache: (room_path, STATE.md_hash) -> frameworks, 10-min TTL

### Context Intelligence -- User Archetype + Tiered Loading

- [x] **CTX-01**: Detect user archetype (venturist/researcher/student) from USER.md, venture stage, and command patterns
- [x] **CTX-02**: Tiered context loading at session start: minimal (~500 tokens, >70% budget used), balanced (~2K, 30-70%), rich (~5K, <30% or venturist pipeline)
- [x] **CTX-03**: MCP session profiles (learn/think/build/research/present/full) that control which MCP servers load -- student exercises need zero MCP overhead
- [x] **CTX-04**: Autocompact tuning per user type: 65% student, 72% default, 75% venturist, 78% researcher
- [x] **CTX-05**: Returning user detection: session count > 3 triggers domain-specific greeting instead of full intro ("I see you're continuing work on [domain]")
- [x] **CTX-06**: Student progress tracking: SessionEnd writes to room/.context/learning-progress.md, next session starts with "You completed 7 of 22 tasks"

### Pipeline Chaining

- [x] **PIPE-01**: Room-file-based state enables LLM-orchestrated tool sequences (methodology A output -> room artifact -> methodology B reads it)
- [x] **PIPE-02**: Full pipeline chains work end-to-end via MCP: scenario analysis -> root cause -> causal tracing -> prediction tracking
- [x] **PIPE-03**: Brain recommendation includes chain ordering: CO_OCCURS and FEEDS_INTO relationships encode which frameworks to run in what sequence

### Agent Dispatch Optimization

- [x] **AGENT-01**: Dynamic swarm sizing: dispatch N agents = min(weak_sections, context_budget / agent_cost) instead of always 3
- [x] **AGENT-02**: Cost estimation before dispatch: show "This will use ~150K tokens (3 agents x Opus)" before running
- [x] **AGENT-03**: Chain checkpointing: pause between pipeline steps with "Continue to step 3?" instead of always running 3-5
- [x] **AGENT-04**: Budget-aware model routing: if total_cost > remaining_context * 0.6, downgrade from Opus to Sonnet
- [x] **AGENT-05**: Coordinator-compatible agent outputs: when CLAUDE_CODE_COORDINATOR_MODE ships, framework-runners map to Coordinator workers

### KAIROS/Platform Readiness

- [x] **READY-01**: Structured last-session.md with active_methodology, open_questions, next_suggested_action, confidence_level
- [x] **READY-02**: KAIROS log detection in context-engine: when tengu_kairos activates, read daily log instead of cold-start context rebuild
- [x] **READY-03**: UDS listener stubs in room-passive for future cross-instance room state sharing
- [x] **READY-04**: Monitor GrowthBook gates (tengu_kairos, tengu_harbor, tengu_scratch) and auto-activate when features go live

### Scheduled Intelligence

- [x] **SCHED-01**: Session catch-up: on MCP server init, compute what was missed since last session (hours since scout, predictions due, new files)
- [x] **SCHED-02**: Daily briefing generation from room state, approaching prediction deadlines, and new contradictions
- [x] **SCHED-03**: Scheduled competitor analysis: periodic web search for competitors in room's domain context
- [x] **SCHED-04**: Scheduled grant/funding discovery: proactive scan for grants and funding opportunities relevant to room's focus area
- [x] **SCHED-05**: Scheduled context-relevant news: web search for developments in the venture's domain, filed to room/intelligence/
- [x] **SCHED-06**: Scout sentinel tasks run on schedule: health check, deadline scan, competitor watch, HSI recomputation
- [x] **SCHED-07**: All scheduled results filed as room artifacts with provenance and timestamps

### De Bono Persistent Hats

- [ ] **HAT-01**: 6 perspective personas with cross-session memory stored in room/.mindrian/hats/{color}/
- [ ] **HAT-02**: 1 subagent loads persona files on demand (NOT 6 concurrent agents -- token budget control)
- [ ] **HAT-03**: Hat state feeds Brain routing: Black Hat concerns influence risk assessment, Yellow Hat opportunities feed HSI scoring, Blue Hat tracks methodology effectiveness
- [ ] **HAT-04**: Session log per hat: room/.mindrian/hats/{color}/session-log/YYYY-MM-DD.md tracks what each perspective found

### MCP Apps Data Room Views

- [x] **APP-01**: ext-apps@1.5.0 installed with registerAppTool/registerAppResource for ui:// resources
- [x] **APP-02**: Dashboard view rendered inline in Cowork/Desktop via MCP Apps (De Stijl Mondrian grid, read-only first)
- [x] **APP-03**: Wiki view rendered inline via MCP Apps (room sections as browsable pages)
- [x] **APP-04**: Knowledge graph view rendered inline via MCP Apps (Cytoscape.js, existing De Stijl graph)
- [x] **APP-05**: Views use vanilla HTML/JS + CDN libs (no React, no build step) served as ui:// resources
- [x] **APP-06**: Bidirectional: iframe can call MCP tools via postMessage for on-demand data refresh

## v2.0 Requirements (Deferred -- Requires Anthropic Team Sharing)

### Cross-User Intelligence

- **TEAM-01**: Cross-person cascade detection across shared room state
- **TEAM-02**: Team prediction calibration (multi-user Brier scores)
- **TEAM-03**: Lawrence-as-observer (mentor watches team conversations)
- **TEAM-04**: Shared room concurrent access with conflict resolution

### KAIROS Integration

- **KAIROS-01**: Register room artifacts as KAIROS-consumable for background agent
- **KAIROS-02**: Auto-Dream memory consolidation writes to room/.mindrian/dreams/
- **KAIROS-03**: Cold-start context rebuilding made obsolete by KAIROS persistence

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time push via MCP resource subscriptions | No Claude client implements resource subscriptions yet. Polling via scheduled tasks instead. |
| Flat 64-tool MCP registration | 30-60K token overhead. Hierarchical routers proven at 49 commands, scale to 64. |
| React/Next.js for MCP Apps | Build step, massive deps. De Stijl views are vanilla HTML/JS. ext-apps supports vanilla JS natively. |
| WebSocket live dashboard | Sandboxed MCP App iframes communicate via postMessage only. WebSocket violates CSP. |
| KAIROS daemon (custom persistent agent) | KAIROS is unshipped Anthropic internal. Desktop Scheduled Tasks are the sanctioned pattern. |
| node-cron in MCP server | stdio servers are ephemeral. Cowork has built-in scheduler. Session catch-up handles the gap. |
| chokidar file watching in MCP server | Without push delivery (subscriptions not implemented), watching generates events nobody receives. |
| State outside room/ directory | Breaks ICM principle (folder IS orchestration). Room must be self-contained for portability. |
| TypeScript migration | Build step breaks "every output is an edit surface" principle. CJS stays. |
| Team sharing features | Anthropic hasn't shipped Cowork team sharing. Deferred to v2.0. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MCP-01 | Phase 52 | Complete |
| MCP-02 | Phase 52 | Complete |
| MCP-03 | Phase 52 | Complete |
| MCP-04 | Phase 52 | Pending |
| MCP-05 | Phase 52 | Complete |
| MCP-06 | Phase 52 | Complete |
| SURF-01 | Phase 53 | Complete |
| SURF-02 | Phase 53 | Complete |
| SURF-03 | Phase 53 | Complete |
| SURF-04 | Phase 53 | Complete |
| WRITE-01 | Phase 53 | Complete |
| WRITE-02 | Phase 53 | Complete |
| WRITE-03 | Phase 53 | Complete |
| TOKEN-01 | Phase 54 | Complete |
| TOKEN-02 | Phase 54 | Complete |
| TOKEN-03 | Phase 54 | Complete |
| TOKEN-04 | Phase 54 | Complete |
| TOKEN-05 | Phase 54 | Complete |
| TOKEN-06 | Phase 54 | Complete |
| HOOK-01 | Phase 54 | Complete |
| HOOK-02 | Phase 54 | Complete |
| HOOK-03 | Phase 54 | Complete |
| HOOK-04 | Phase 54 | Complete |
| HOOK-05 | Phase 54 | Complete |
| CTX-01 | Phase 55 | Complete |
| CTX-02 | Phase 55 | Complete |
| CTX-03 | Phase 55 | Complete |
| CTX-04 | Phase 55 | Complete |
| CTX-05 | Phase 55 | Complete |
| CTX-06 | Phase 55 | Complete |
| PIPE-01 | Phase 56 | Complete |
| PIPE-02 | Phase 56 | Complete |
| PIPE-03 | Phase 56 | Complete |
| AGENT-01 | Phase 57 | Complete |
| AGENT-02 | Phase 57 | Complete |
| AGENT-03 | Phase 57 | Complete |
| AGENT-04 | Phase 57 | Complete |
| AGENT-05 | Phase 57 | Complete |
| SCHED-01 | Phase 58 | Complete |
| SCHED-02 | Phase 58 | Complete |
| SCHED-03 | Phase 58 | Complete |
| SCHED-04 | Phase 58 | Complete |
| SCHED-05 | Phase 58 | Complete |
| SCHED-06 | Phase 58 | Complete |
| SCHED-07 | Phase 58 | Complete |
| HAT-01 | Phase 59 | Pending |
| HAT-02 | Phase 59 | Pending |
| HAT-03 | Phase 59 | Pending |
| HAT-04 | Phase 59 | Pending |
| APP-01 | Phase 60 | Complete |
| APP-02 | Phase 60 | Complete |
| APP-03 | Phase 60 | Complete |
| APP-04 | Phase 60 | Complete |
| APP-05 | Phase 60 | Complete |
| APP-06 | Phase 60 | Complete |
| READY-01 | Phase 61 | Complete |
| READY-02 | Phase 61 | Complete |
| READY-03 | Phase 61 | Complete |
| READY-04 | Phase 61 | Complete |

**Coverage:**
- v1.8.0 requirements: 61 total
- Mapped to phases: 61/61
- Unmapped: 0

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after roadmap v2 (22 new requirements mapped)*
