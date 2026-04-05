# Research Summary: v1.8.0 Cowork Adaptation

**Domain:** MCP protocol extensions for multi-surface AI plugin
**Researched:** 2026-04-05
**Overall confidence:** HIGH

## Executive Summary

The Cowork adaptation requires surprisingly few new dependencies. The MCP TypeScript SDK at v1.29.0 already includes everything needed for Streamable HTTP transport, session management, resource subscriptions, and the experimental Tasks primitive. The only genuinely new package is `@modelcontextprotocol/ext-apps@1.2.2` for returning interactive UI components (Data Room views) in Cowork conversations.

The MCP specification 2025-11-25 introduced three capabilities central to this milestone: Streamable HTTP transport (replacing deprecated SSE), Tasks for async call-now-fetch-later execution, and resource subscriptions for change notifications. All three are implemented in the SDK already installed -- they just need the upgrade from 1.27.1 to 1.29.0. MCP Apps launched as the first official MCP extension on 2026-01-26 with Stable status, enabling tools to return sandboxed HTML interfaces via the `ui://` URI scheme.

Cowork's built-in scheduled task system eliminates the need for server-side cron. Each scheduled task (daily/weekly/hourly) spins up a full session with MCP server access. However, there are documented bugs where cloud-scheduled tasks lose MCP connector access -- this is an active Anthropic issue (GitHub #43397, #32000, #36327) that should be treated as a known risk, not a blocker.

De Bono persistent hats and Brain-driven routing require zero new libraries. Hat persistence is markdown files in `room/perspectives/`. Brain routing is HTTP calls to the already-deployed brain.mindrian.ai MCP server. The ICM principle holds: the filesystem IS the state store.

## Key Findings

**Stack:** Upgrade SDK to 1.29.0, add ext-apps@1.2.2. Total: 1 upgrade + 1 new package. Zero removed.
**Architecture:** Dual-transport server (stdio for Desktop, Streamable HTTP for Cowork) on same McpServer instance.
**Critical pitfall:** Cowork scheduled tasks have known MCP access bugs. Design scheduled intelligence to be idempotent and retry-safe.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **SDK Upgrade + Dual Transport** - Foundation phase
   - Addresses: Streamable HTTP, session management, 64-command coverage
   - Avoids: Breaking changes from SDK 2.0-alpha
   - Rationale: Everything else depends on the transport layer working

2. **Resource Subscriptions + File Watching** - Reactive intelligence
   - Addresses: Room change notifications, subscription lifecycle
   - Avoids: Polling anti-pattern
   - Rationale: chokidar already installed, SDK already supports subscriptions

3. **MCP Tasks + Background Execution** - Async operations
   - Addresses: Long-running analysis, batch processing, call-now-fetch-later
   - Avoids: Blocking Cowork conversations during expensive operations
   - Rationale: Depends on Streamable HTTP (phase 1) for SSE-based task notifications

4. **Brain-Driven Routing** - Intelligence layer
   - Addresses: Framework selection, methodology chaining, /mos:act via MCP
   - Avoids: Hard-coded routing rules
   - Rationale: Requires 64-command coverage (phase 1) to route to

5. **De Bono Persistent Hats** - Perspective agents
   - Addresses: 6 always-on perspective agents, cross-session state
   - Avoids: Context loss between sessions
   - Rationale: Requires routing layer (phase 4) for hat-to-methodology mapping

6. **MCP Apps Data Room Views** - Interactive UI
   - Addresses: Dashboard/wiki/graph in Cowork conversation
   - Avoids: Local server requirement for views
   - Rationale: Last because it's presentation layer; needs stable tool layer underneath

7. **Cowork Scheduled Intelligence** - Autonomous operations
   - Addresses: Daily briefings, prediction checks, proactive scout
   - Avoids: Server-side cron dependency
   - Rationale: Last because it depends on all tools + views being stable, and Cowork scheduler bugs may be fixed by then

**Phase ordering rationale:**
- Transport (1) is foundation; everything depends on it
- Subscriptions (2) before Tasks (3) because subscriptions are simpler and validate the transport
- Routing (4) before Hats (5) because hats use the routing layer
- Apps (6) after tools are stable because views consume tool output
- Scheduling (7) last because it depends on everything working and has known platform bugs

**Research flags for phases:**
- Phase 3 (Tasks): EXPERIMENTAL spec status. API may change. Needs defensive coding.
- Phase 6 (MCP Apps): Stable spec but new (Jan 2026). Test across Claude versions.
- Phase 7 (Scheduling): Known Anthropic bugs with MCP access. Monitor issue trackers.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SDK versions verified on npm, ext-apps verified, all imports confirmed in SDK source |
| Features | HIGH | MCP spec 2025-11-25 is published and detailed. MCP Apps spec is Stable. |
| Architecture | HIGH | Dual transport is documented SDK pattern. Same McpServer instance serves both. |
| Pitfalls | MEDIUM | Cowork scheduler bugs are documented but resolution timeline unknown. Tasks is experimental. |

## Gaps to Address

- Cowork scheduler MCP access bug timeline -- monitor GitHub issues #43397, #32000, #36327
- MCP Tasks is experimental -- API surface may change in SDK 2.0
- ext-apps iframe sandboxing constraints not fully documented -- test Cytoscape.js rendering in sandboxed iframe
- SDK 2.0 migration path -- TaskManager refactor, Standard Schema support. Plan for eventual migration but do not block on it.
- MCP Apps client support matrix -- Claude supports it, but verify Cowork specifically (vs Desktop)
