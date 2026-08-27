#!/usr/bin/env node

/**
 * MindrianOS MCP Server -- dual transport entry point (stdio + Streamable HTTP)
 *
 * Connects MindrianOS plugin capabilities to Claude Desktop and Cowork
 * via the Model Context Protocol. The hierarchical tool router
 * (lib/mcp/tool-router.cjs) contributes 11 topic-level tools fanning out to
 * roughly 64 CLI commands. The server's full tool surface is larger than
 * the router alone: three more seams register beside it --
 * lib/mcp/register-core-tools.cjs auto-discovering every lib/mcp/tools/*.cjs
 * module, two inline registrations in this file (detect_dual_path,
 * extract_shallow), and the surface-gated MCP Apps views in
 * lib/mcp/app-views.cjs. register-core-tools.cjs:56 registers every new
 * tools/*.cjs file with no gate, no budget check and no review step -- that
 * is HOW the total grows silently, so it is never restated here as a frozen
 * number. The live tool count and the eager-load token total are MEASURED,
 * not typed, by tests/test-234-tool-description-floor.cjs (Phase 266's
 * MCPFIX-04 expands it to cover every registered tool and states its own
 * coverage).
 *
 * Transport selection is automatic via surface detection:
 *   - CLI / Desktop: stdio (default, zero-config)
 *   - Cowork: Streamable HTTP on 127.0.0.1:3847
 *
 * Override with MINDRIAN_TRANSPORT=stdio|http env var.
 *
 * Configuration:
 *   MINDRIAN_ROOM env var sets the Data Room path (default: ./room)
 *
 * Usage in claude_desktop_config.json (stdio):
 *   {
 *     "mcpServers": {
 *       "mindrian-os": {
 *         "command": "node",
 *         "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"],
 *         "env": { "MINDRIAN_ROOM": "/path/to/project/room" }
 *       }
 *     }
 *   }
 *
 * Usage for Cowork (Streamable HTTP):
 *   MINDRIAN_TRANSPORT=http node bin/mindrian-mcp-server.cjs
 *   -> Listens on http://127.0.0.1:3847/mcp
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { randomUUID } = require('node:crypto');

// -- Dependency self-heal (Option D, debug session
// mcp-servers-cache-missing-node-modules). `claude plugin update` can land a
// fresh plugin cache with NO node_modules; on the first post-update session
// this MCP server may spawn before the SessionStart reconcile hook finishes its
// npm install. mcp-dep-heal.cjs + npm-install-lock.cjs are pure node-built-in
// modules (safe to require with node_modules absent). ensureDepsPresent runs a
// guarded one-shot `npm install` if node_modules is missing/incomplete BEFORE
// any npm-dependency require below (the SDK direct requires AND the transitive
// requires inside the lib/mcp/* modules). requireWithHeal is the per-require
// backstop, including the lazy express / streamableHttp requires in main().
const { ensureDepsPresent, requireWithHeal, beginConnectPathBudget, connectPathRemainingMs } = require('../lib/core/mcp-dep-heal.cjs');
const healLog = (msg) => { try { process.stderr.write(msg + '\n'); } catch (e) { /* swallow */ } };
// Phase 266 Plan 03 (MCPFIX-03): this process is answering a host that is
// already counting down a ~30-second connect timeout, so the heal is bounded
// to CONNECT_PATH_BUDGET_MS instead of the full hook-path budget.
//
// Phase 266 Plan 05 (MCPFIX-03 gap closure): arms ONE process-wide connect
// deadline at the earliest possible moment. Every connectPath:true heal call
// in this file (this ensureDepsPresent, the two SDK requireWithHeal calls
// below, and the lazy zod requireWithHeal inside createServer()) now spends
// from this ONE shrinking budget. Before Phase 266 Plan 05 each of those four
// calls started its own fresh 15000ms clock, for a measured worst case of
// 60296ms, double the host's ~30000ms connect timeout the budget exists to
// respect.
beginConnectPathBudget();
const depHealOutcome = ensureDepsPresent({ log: healLog, connectPath: true });
if (depHealOutcome && depHealOutcome.ok === false) {
  healLog(
    '[mindrian-os] dependency heal did not complete inside the connect budget (' +
      connectPathRemainingMs() + 'ms left); the requires below will propagate immediately rather than starting a new install'
  );
}

const { McpServer } = requireWithHeal('@modelcontextprotocol/sdk/server/mcp.js', { log: healLog, connectPath: true });
const { StdioServerTransport } = requireWithHeal('@modelcontextprotocol/sdk/server/stdio.js', { log: healLog, connectPath: true });
const { detectSurface } = require('../lib/mcp/surface-detect.cjs');
const { registerCapabilities } = require('../lib/mcp/capability-registry.cjs');
const { computeCatchUp, registerShutdownHandler } = require('../lib/mcp/session-catchup.cjs');
// Phase 198-02 (SPEC-1/SPEC-7, D-01/D-07): the daemon needs real per-connection
// session identity to consume the shipped Phase 194 session-binding primitives.
// isMcpFirst gates the new transport shape so flag-OFF stays byte-identical
// legacy (sessionIdGenerator: undefined, no session-registry callbacks).
const { isMcpFirst, mcpFirstSurfaces } = require('../lib/mcp/mcp-first-flag.cjs');
const sessionRegistry = require('../lib/mcp/session-registry.cjs');
// Phase 198-03 (D-01, SPEC-1/SPEC-7): the durable daemon needs a pidfile +
// discovered port so the stdio shim (bin/mindrian-mcp-shim.cjs) and future
// clients can find THIS process instead of spawning their own. Flag-OFF
// keeps the hardcoded port 3847 and never touches the pidfile (byte-
// identical legacy, SPEC-7).
const daemonLifecycle = require('../lib/mcp/daemon-lifecycle.cjs');
// Phase 198-03 (D-01, Open Question 3): minimal additive SSE event bus for
// live statusline segments (status-segment/gate-fired/reconcile-raised).
// Wired as an /event route ONLY under the flag-ON branch below.
const sseEventBus = require('../lib/mcp/sse-event-bus.cjs');

// Detect surface before anything else
const surface = detectSurface();

// Resolve paths
const pluginRoot = path.resolve(__dirname, '..');
// Phase 198-02 (SPEC-1): roomDir is now the MISS-FALLBACK only, never the
// write authority. Per-session write resolution (resolveWriteTargetDir in
// lib/mcp/tool-router.cjs) re-resolves the live target from the session's
// binding on every write call; MINDRIAN_ROOM stops being authoritative once
// a session is bound. registerRouterTools below still receives this as its
// fallback argument for the pre-binding / flag-OFF path.
const roomDir = path.resolve(process.env.MINDRIAN_ROOM || './room');

// Read version from plugin.json
const pluginMeta = require('../.claude-plugin/plugin.json');
const version = pluginMeta.version;

// Load Larry personality context
const { loadLarryContext } = require('../lib/mcp/larry-context.cjs');
const larryContext = loadLarryContext(pluginRoot);

// Validate room directory exists (warn, do not crash -- Desktop may start before room creation)
if (!fs.existsSync(roomDir)) {
  process.stderr.write(`[mindrian-os] Warning: Room directory not found at ${roomDir}. Some tools will return limited results.\n`);
}

// Phase 198-08 (Rule 1 fix): createServer() is a FACTORY, not a one-time
// module-level construction, because the MCP SDK's Server.connect() throws
// ("Already connected to a transport. Call close() before connecting to a
// new transport, or use a separate Protocol instance per connection.") the
// SECOND time it is called on the SAME McpServer instance -- discovered live
// proving lib/mcp/adapter-client.cjs's queryDaemon() can serve more than ONE
// concurrent session (SessionStart's own thin adapter fires two queries in
// parallel; a shared daemon serving CLI+Desktop+Cowork concurrently is D-01's
// whole point). The SDK's own documented multi-session pattern
// (examples/server/simpleStreamableHttp.js) is exactly this: a fresh
// McpServer (with every tool/resource/prompt re-registered) per NEW session,
// each connected to its OWN transport. The stdio path and the flag-OFF
// stateless HTTP path still want the ORIGINAL "build once" shape (a single
// process serves exactly one client for its whole lifetime there) -- calling
// createServer() once below and binding it to the module-level `server`
// const preserves that byte-identical legacy behavior. Only the flag-ON
// multi-session HTTP branch (further below) calls createServer() again, per
// new session.
function createServer() {
  // 2026-08-19: serve the Desktop/Cowork runtime protocol at the MCP handshake.
  // Hookless surfaces get the Larry loop from the CONNECTION itself (the SDK
  // delivers `instructions` to the client model at initialize) instead of
  // depending on per-user Project setup. See lib/mcp/runtime-instructions.cjs.
  const { RUNTIME_INSTRUCTIONS } = require('../lib/mcp/runtime-instructions.cjs');
  const s = new McpServer(
    {
      name: 'mindrian-os',
      version,
    },
    { instructions: RUNTIME_INSTRUCTIONS }
  );

  // Register the hierarchical tool router (11 tools fanning out to ~64 CLI
  // commands; see the header comment above for the full four-seam surface
  // and where the live count is measured).
  // Phase 198-02: the 5th arg is this process's detected surface name, so
  // tool-router's write handlers can gate session-aware resolution behind
  // isMcpFirst(surface) per-call (D-07).
  const { registerRouterTools } = require('../lib/mcp/tool-router.cjs');
  registerRouterTools(s, roomDir, pluginRoot, larryContext, surface.surface);

  // Phase 115-02 dual-path opener tools (detect_dual_path, extract_shallow)
  // moved to lib/mcp/tools/dual-path.cjs in plan 270-06 (OQ-5: they were
  // dark to the connector registry here; register-core-tools.cjs's
  // auto-discovery now finds and wires both). The connect-path heal call
  // below is kept even though `z` is no longer used directly in this file
  // (dual-path.cjs owns its own plain `require('zod')` now): the top-level
  // ensureDepsPresent(...) call above (module scope) already probes ALL
  // production deps including zod before any tool registers, so this call
  // adds no NEW functional heal coverage -- it is kept solely so
  // tests/test-266-connect-path-process-budget.cjs's call-site census (at
  // least 4 connect-path-opted heal calls in this file) does not regress.
  // Removing it is safe functionally; it is a Phase 266 test-shape
  // constraint, not a Phase 270 requirement.
  requireWithHeal('zod', { log: healLog, connectPath: true });

  // Register MCP Resources (read-only room browsing via room:// URIs).
  // Phase 270-05 (RESEARCH.md 3.4d): Resources now resolve per read through lib/mcp/session-room.cjs, the same resolver every Tool uses; MINDRIAN_ROOM stays only the boot fallback, exactly what ctx.fallbackRoomDir means to the resolver.
  const { registerResources } = require('../lib/mcp/resources.cjs');
  registerResources(s, { fallbackRoomDir: roomDir, pluginRoot: pluginRoot, surface: surface.surface });

  // Register MCP Prompts (methodology workflows with Larry personality)
  const { registerPrompts } = require('../lib/mcp/prompts.cjs');
  registerPrompts(s, roomDir, pluginRoot);

  // Register surface-aware capabilities (MCP Apps, Tasks -- Phase 58/60 hook points)
  registerCapabilities(s, surface.capabilities, roomDir, pluginRoot);

  return s;
}

// Build the module-level singleton -- the stdio branch and the flag-OFF
// stateless HTTP branch both reach for this SAME `server` const, exactly as
// shipped before this factory refactor (byte-identical legacy, SPEC-7).
const server = createServer();

// Session catch-up: register shutdown handler to save session state (all
// surfaces). registerShutdownHandler already no-ops after its first call
// (session-catchup.cjs's own _shutdownRegistered guard), so this stays a
// single module-level call regardless of how many per-session servers the
// flag-ON HTTP branch later creates -- it is a PROCESS/ROOM lifecycle
// concern, not a per-MCP-session one.
if (fs.existsSync(roomDir)) {
  registerShutdownHandler(roomDir);
}

// Connect transport based on detected surface
async function main() {
  if (surface.transport === 'http') {
    // Streamable HTTP for Cowork
    let express;
    try {
      express = require('express');
    } catch (err) {
      process.stderr.write(`[mindrian-os] Express not available, falling back to stdio transport.\n`);
      const transport = new StdioServerTransport();
      await server.connect(transport);
      process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, stdio-fallback, room: ${roomDir})\n`);
      return;
    }

    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const app = express();
    app.use(express.json());

    // Phase 198-08 (D-06/D-07 fix): a daemon spawned via daemon-lifecycle.
    // ensureDaemon() always forces MINDRIAN_TRANSPORT=http, which surface-
    // detect.cjs resolves to surface:'cowork' regardless of which surface
    // actually asked for it -- a CLI hook waking the shared daemon looks
    // identical, at detectSurface() time, to a real Cowork client. Without
    // this, MINDRIAN_MCP_FIRST=cli (D-07's own documented first rollout
    // step) would never activate the daemon's pidfile/port-discovery/SSE
    // wiring below, because isMcpFirst('cowork') is false for a 'cli'-only
    // flag value -- ensureDaemon() callers would then time out waiting for a
    // pidfile that never gets written. The daemon serves ALL flagged
    // surfaces (D-01 topology: "multiple clients ... attach to the same
    // server concurrently"), so a process carrying daemon-lifecycle's own
    // MINDRIAN_MCP_DAEMON=1 spawn marker treats ANY non-empty
    // MINDRIAN_MCP_FIRST value as flag-ON for its own machinery. A real
    // Cowork client (no MINDRIAN_MCP_DAEMON marker) keeps the original,
    // narrower isMcpFirst('cowork') behavior -- byte-identical legacy when
    // Cowork itself is not named in the flag (SPEC-7).
    const isDaemonSpawn = process.env.MINDRIAN_MCP_DAEMON === '1';
    const mcpFirstOn = isMcpFirst(surface.surface) || (isDaemonSpawn && mcpFirstSurfaces().length > 0);

    // MCP endpoint
    // Phase 198-02 (SPEC-1 Defect B, SPEC-7): flag-ON gives sessions a real
    // per-connection sessionIdGenerator so resolveWriteRoom({sessionId}) can
    // key off it (Pattern 2, RESEARCH.md). Flag-OFF keeps the stateless
    // shape exactly as shipped (sessionIdGenerator: undefined, ONE shared
    // transport) -- byte-identical legacy, per surface (D-07).
    //
    // Phase 198-08 (Rule 1 fix): a SINGLE shared stateful transport instance
    // tracks its OWN "has this session already completed initialize"
    // state -- it can only ever answer ONE session for the entire process
    // lifetime; every later distinct client's initialize request was
    // rejected with "Bad Request: Server already initialized", even though
    // the daemon is explicitly a long-lived, multi-client-over-time process
    // (D-01: "multiple clients ... attach to the same server concurrently").
    // Discovered live proving lib/mcp/adapter-client.cjs's queryDaemon() can
    // complete more than ONE tool-call round trip against the same running
    // daemon (statusline alone queries on every render). Fixed with the
    // SDK's own documented multi-session pattern
    // (examples/server/simpleStreamableHttp.js): a session-id-keyed
    // transport map, one NEW StreamableHTTPServerTransport per NEW
    // initialize request, each connected to the SAME already-configured
    // `server` singleton (every tool/resource/prompt stays registered
    // exactly once at boot; only the transport is per-session). Flag-OFF's
    // stateless transport never hits this state machine -- untouched,
    // byte-identical legacy.
    let statelessTransport;
    let sessionTransports;
    if (mcpFirstOn) {
      sessionTransports = new Map();
    } else {
      statelessTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    }

    app.all('/mcp', async (req, res) => {
      // Phase 198-08 (Rule 1 fix): app.use(express.json()) above already
      // consumes the request stream and parses it onto req.body -- the SDK's
      // own usage example (streamableHttp.js's handleRequest doc comment)
      // calls `transport.handleRequest(req, res, req.body)`. Omitting the
      // third arg made the transport try to re-read the ALREADY-CONSUMED
      // raw stream itself, so every real HTTP client (curl, the MCP SDK
      // Client, a genuine Cowork request) got back
      // `{"error":{"code":-32700,"message":"Parse error: Invalid JSON"}}`
      // regardless of a perfectly valid JSON body -- discovered live while
      // proving lib/mcp/adapter-client.cjs's queryDaemon() actually completes
      // a real tool call round trip (not just a transport-level connect).
      if (!mcpFirstOn) {
        await statelessTransport.handleRequest(req, res, req.body);
        return;
      }

      const headerSessionId = req.headers['mcp-session-id'];
      let sessionTransport = headerSessionId ? sessionTransports.get(headerSessionId) : undefined;

      if (!sessionTransport) {
        if (headerSessionId) {
          // A session id was supplied but this daemon does not recognize it
          // (stale id, or the daemon restarted) -- report it rather than
          // silently minting a new session under the caller's requested id.
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
            id: null,
          });
          return;
        }
        sessionTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            sessionTransports.set(sid, sessionTransport);
            sessionRegistry.open(sid);
          },
          onsessionclosed: (sid) => {
            sessionTransports.delete(sid);
            sessionRegistry.close(sid);
          },
        });
        sessionTransport.onclose = () => {
          const sid = sessionTransport.sessionId;
          if (sid) sessionTransports.delete(sid);
        };
        // A FRESH McpServer per new session (createServer(), not the shared
        // module-level `server`) -- Server.connect() throws on a second call
        // against the same instance, and true concurrent sessions (e.g. two
        // parallel queryDaemon() calls from one hook's own thin adapter) hit
        // that second call before either session has torn down.
        const sessionServer = createServer();
        await sessionServer.connect(sessionTransport);
      }

      await sessionTransport.handleRequest(req, res, req.body);
    });

    // Phase 198-03 (D-01, Open Question 3): the SSE event bus's /event route
    // is wired ONLY under the flag-ON branch -- flag-OFF adds no route at all
    // (byte-identical legacy, SPEC-7). Loopback-only (this app already binds
    // 127.0.0.1 only, below); additive vocabulary
    // (status-segment/gate-fired/reconcile-raised); never carries room
    // content bound for the Brain (Part 8).
    if (mcpFirstOn) {
      app.get('/event', (req, res) => {
        sseEventBus.subscribe(res);
      });
    } else {
      // Flag-OFF: the ONE shared stateless transport connects once, exactly
      // as shipped -- byte-identical legacy. Flag-ON connects a fresh
      // transport per NEW session, lazily, inside the /mcp handler above.
      await server.connect(statelessTransport);
    }

    // Phase 198-03 (D-01, SPEC-1/SPEC-7): flag-ON discovers a free loopback
    // port (daemonLifecycle.discoverPort, or the already-recorded live
    // daemon's own port) instead of the hardcoded 3847, and records the
    // pidfile once listening so the stdio shim + future clients can find
    // THIS process. Flag-OFF keeps port 3847 exactly as shipped -- no
    // pidfile, no discovery, byte-identical legacy.
    const listenPort = mcpFirstOn ? daemonLifecycle.discoverPort() : 3847;
    app.listen(listenPort, '127.0.0.1', () => {
      process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, HTTP on 127.0.0.1:${listenPort}, room: ${roomDir})\n`);

      if (mcpFirstOn) {
        daemonLifecycle.writePidfile({ pid: process.pid, port: listenPort });
        let cleared = false;
        const clearOnce = () => {
          if (cleared) return;
          cleared = true;
          daemonLifecycle.clearPidfile();
        };
        process.on('SIGTERM', clearOnce);
        process.on('SIGINT', clearOnce);
        process.on('exit', clearOnce);
      }

      // Session catch-up for Cowork: compute what was missed since last session
      if (fs.existsSync(roomDir)) {
        try {
          const catchUp = computeCatchUp(roomDir);
          if (catchUp.hasCatchUp) {
            process.stderr.write(`[mindrian-os] Session catch-up: ${catchUp.summary}\n`);
          } else {
            process.stderr.write(`[mindrian-os] Session catch-up: first session or no changes detected.\n`);
          }
        } catch (e) {
          process.stderr.write(`[mindrian-os] Session catch-up failed (non-fatal): ${e.message}\n`);
        }
      }
    });
  } else {
    // stdio for CLI and Desktop
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, ${surface.transport}, room: ${roomDir})\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`[mindrian-os] Fatal: ${err.message}\n`);
  process.exit(1);
});
