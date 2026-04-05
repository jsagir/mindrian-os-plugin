# Domain Pitfalls: v1.8.0 Cowork Adaptation

**Domain:** MCP multi-surface plugin with persistent intelligence
**Researched:** 2026-04-05

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Cowork Scheduled Tasks Lose MCP Access
**What goes wrong:** Cloud-scheduled tasks fire but MCP connectors are not loaded into the session. Tools are missing from the tool registry. The task runs with no access to external services.
**Why it happens:** Documented Anthropic bug. MCP servers configured in `~/.claude/mcp.json` are not inherited by cloud-scheduled task sessions. A single user message makes them appear, but autonomous scheduled tasks don't have that trigger.
**Consequences:** Daily briefings, prediction checks, and proactive scout fail silently. Users think the system is working but it's not.
**Prevention:** 
1. Design all scheduled intelligence to be idempotent -- if it fails, the next manual session picks it up
2. Write scheduled task prompts that explicitly check tool availability before proceeding
3. Store last-successful-run timestamps in room/ so manual sessions can catch up
4. Monitor GitHub issues #43397, #32000, #36327 for fixes
**Detection:** Scheduled task logs show no tool invocations. Room intelligence files have stale timestamps.

### Pitfall 2: MCP Tasks is Experimental -- API Will Change
**What goes wrong:** Building deeply on the Tasks API, then SDK 2.0 moves TaskManager to a different abstraction, breaking all task-dependent code.
**Why it happens:** Tasks are explicitly marked experimental in the 2025-11-25 spec. SDK 2.0-alpha already refactored tasks into a separate TaskManager class.
**Consequences:** Major refactor when upgrading to SDK 2.0.
**Prevention:**
1. Wrap all task operations in `lib/mcp/tasks.cjs` -- single abstraction layer
2. Keep task logic thin -- task handle creation, polling response, result retrieval
3. Do NOT build complex task orchestration (multi-task dependencies, task chains)
4. Design tools to work in both sync and async (task-augmented) modes
**Detection:** SDK 2.0 release notes will announce the migration path. Track the GitHub milestone.

### Pitfall 3: Iframe Sandbox Blocks Cytoscape.js in MCP Apps
**What goes wrong:** MCP Apps render HTML in a sandboxed iframe. The sandbox restrictions may block Cytoscape.js WebGL rendering, CDN script loading, or canvas operations.
**Why it happens:** Sandboxed iframes have restricted permissions by default. The ext-apps spec uses `allow-scripts` but CDN loading requires additional sandbox flags.
**Consequences:** Dashboard graph view renders blank or throws errors in Cowork. Works in development but fails in production.
**Prevention:**
1. Bundle Cytoscape.js inline in the HTML (no CDN dependency)
2. Test in actual Cowork sandbox early (not just local browser)
3. Have fallback: text-based graph representation if canvas fails
4. Check ext-apps sandbox policy before building complex visualizations
**Detection:** Graph area renders empty. Console errors about blocked scripts or canvas access.

### Pitfall 4: DNS Rebinding Attack on Local HTTP Server
**What goes wrong:** Streamable HTTP server on localhost is vulnerable to DNS rebinding -- malicious websites could interact with the MCP server.
**Why it happens:** HTTP servers bound to localhost are accessible from any origin via DNS rebinding techniques.
**Consequences:** Remote attackers could invoke MCP tools, read room data, or modify files.
**Prevention:**
1. Use `createMcpExpressApp()` which includes DNS rebinding protection by default
2. Bind to 127.0.0.1 explicitly (not 0.0.0.0)
3. Validate `Origin` header on all requests (SDK does this)
4. Never expose the HTTP transport on a non-localhost interface
**Detection:** Security audit. Cross-origin requests being accepted.

## Moderate Pitfalls

### Pitfall 5: Session State Leaks Between Cowork Users
**What goes wrong:** Two Cowork sessions share server-side state because session isolation is missing or broken.
**Prevention:**
1. Use `MCP-Session-Id` for all session-scoped data
2. Never store session state in module-level variables
3. Use `sessionIdGenerator: () => randomUUID()` for stateful sessions
4. Test with concurrent connections

### Pitfall 6: Zod Version Conflict
**What goes wrong:** SDK uses Zod internally, ext-apps uses Zod, and project might have its own Zod version. Multiple Zod instances cause "instanceof" checks to fail.
**Prevention:**
1. Do NOT add Zod as a direct dependency. Let it resolve transitively from SDK.
2. Current state: Zod 4.3.6 installed transitively. SDK accepts ^3.25 or ^4.0.
3. ext-apps should be compatible. Verify after install with `npm ls zod`.

### Pitfall 7: Express Version Conflict
**What goes wrong:** Plugin has `express@5.1.0` as a direct dependency. SDK bundles `express@^5.2.1` internally. Two Express instances in memory.
**Prevention:**
1. Review whether direct Express dependency is still needed
2. If only used for MCP HTTP transport, remove it -- SDK's `createMcpExpressApp()` handles everything
3. If used elsewhere (e.g., Brain MCP server in this repo), keep but ensure compatible versions

### Pitfall 8: Brain MCP Latency Blocks Tool Calls
**What goes wrong:** Brain-driven routing adds a network round-trip to every methodology tool call. If Brain is slow or down, all tools hang.
**Prevention:**
1. Brain consultation should be fire-and-forget with timeout (2s max)
2. Fallback to local heuristic routing if Brain is unreachable
3. Cache Brain routing decisions per room context (invalidate on room state change)
4. Brain call should be optional -- graceful degradation is an existing design principle

### Pitfall 9: Resource Subscription Memory Leak
**What goes wrong:** Clients subscribe to resources but never unsubscribe. chokidar watchers accumulate. Server memory grows.
**Prevention:**
1. Tie subscriptions to session lifecycle -- clean up on session end
2. Limit subscriptions per session (e.g., 50 max)
3. Set TTL on subscriptions -- auto-expire after 1 hour if not refreshed

## Minor Pitfalls

### Pitfall 10: Task Polling Storm
**What goes wrong:** Client polls tasks/get at high frequency, overwhelming the server.
**Prevention:** Always return `pollInterval` in task responses. Start at 5000ms, increase for long-running tasks.

### Pitfall 11: MCP Apps HTML Size Limit
**What goes wrong:** Dashboard HTML with inline Cytoscape.js + CSS + room data exceeds reasonable size limits.
**Prevention:** Keep HTML under 500KB. Lazy-load data via tool callbacks rather than embedding.

### Pitfall 12: SSE Connection Limits
**What goes wrong:** Browser/client limits on concurrent SSE connections (typically 6 per domain) are hit.
**Prevention:** Use a single SSE stream per session. Multiplex notifications on that stream.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| SDK Upgrade | Zod/Express version conflicts (#6, #7) | Run `npm ls` after upgrade, resolve deduplication |
| Streamable HTTP | DNS rebinding (#4) | Use createMcpExpressApp(), never bind 0.0.0.0 |
| Resource Subscriptions | Memory leak (#9) | Session-scoped cleanup, subscription TTL |
| MCP Tasks | Experimental API (#2), polling storm (#10) | Thin wrapper, pollInterval enforcement |
| Brain Routing | Latency blocking (#8) | Timeout + fallback, caching |
| De Bono Hats | Session state leaks (#5) | Filesystem-only state, no in-memory hat data |
| MCP Apps | Iframe sandbox (#3), HTML size (#11) | Bundle scripts inline, test in real Cowork |
| Scheduled Intelligence | MCP access bug (#1) | Idempotent design, manual session catch-up |

## Sources

- [Cowork MCP bug #43397](https://github.com/anthropics/claude-code/issues/43397) - scheduled tasks MCP access
- [Cowork MCP bug #32000](https://github.com/anthropics/claude-code/issues/32000) - HTTP MCP servers in scheduled tasks
- [Cowork MCP bug #36327](https://github.com/anthropics/claude-code/issues/36327) - MCP tool access in scheduled tasks
- [MCP Tasks spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks) - experimental status
- [MCP Transports spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) - DNS rebinding warning
- [TypeScript SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) - 2.0-alpha TaskManager changes
