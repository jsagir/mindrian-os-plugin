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
 * SDK split (Phase 267 Plan 11): the McpServer comes from the v2 package
 * (@modelcontextprotocol/server) everywhere createServer() builds one. The
 * stdio branch (and the express-missing fallback) is served by serveStdio
 * from @modelcontextprotocol/server/stdio. The Streamable HTTP flag-OFF branch
 * (Plan 12) is served per request by createMcpHandler behind toNodeHandler
 * (@modelcontextprotocol/node), with localhost Host/Origin guards. The
 * flag-ON (session-keyed) branch still uses the v1 StreamableHTTPServerTransport
 * until Phase 267 Plan 14.
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
const { isMissingPackagesError, serveInstallResponderFor } = require('../lib/core/mcp-dep-heal.cjs');
// Phase 369.1-10: surface-detect.cjs needs only fs, so it is safe before the packages exist.
const isHttpTransport = () => require('../lib/mcp/surface-detect.cjs').detectSurface().transport === 'http';
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

// -- Phase 369.1 plan 10 (D-04, D-14, decision 8): install-status responder.
// When the connect-path heal above did not finish (the detached installer is
// still running, npm is missing, or the install failed), this process does NOT
// fall through to the SDK requires below, which would throw and close the pipe
// inside the host's ~30 s connect window. It serves
// lib/core/mcp-install-responder.cjs instead (on stdio, and on HTTP for the surface that selects it): a dependency-free JSON-RPC
// responder with exactly ONE tool (mos_install_status) that tells the truth about the
// install. It never registers a partial toolset (decision 8): the host sees
// either the full server or this one status tool, and the next session, with
// the packages in place, serves the full server. The shared connect budget
// above keeps the whole path inside the host's window. Only fs, path and
// built-in-only lib modules are touched before the return. 
// 369.1-REVIEW WR-07: the HTTP transport (Cowork selects it) gets the same answer, served on
// 127.0.0.1 like the full server, so the OS server is never silently absent beside the brain one.
if (depHealOutcome && depHealOutcome.ok === false) {
  if (serveInstallResponderFor('mindrian-os', Object.assign({}, depHealOutcome, { http: isHttpTransport() }), healLog)) return;
}

// Phase 267 Plan 11: the v2 SDK builds the McpServer and serves stdio
// (serveStdio owns the era decision, 2025-11-25 or 2026-07-28, from ONE
// factory). Plan 12: createMcpHandler serves the flag-OFF HTTP route per request.
// Plan 14: the flag-ON daemon routes by protocol era (isLegacyRequest): 2025
// traffic keeps the session-keyed v2 Node transport, 2026-07-28 traffic goes to
// a modern-only createMcpHandler. No v1 SDK import remains in this file.
// 369.1-REVIEW CR-03: the connect-path heal never installs in-process; when the packages are
// not there in time the require throws and the server answers in band instead of crashing.
let McpServer;
let createMcpHandler;
let isLegacyRequest;
let serveStdio;
try {
  ({ McpServer, createMcpHandler, isLegacyRequest } = requireWithHeal('@modelcontextprotocol/server', { log: healLog, connectPath: true }));
  ({ serveStdio } = requireWithHeal('@modelcontextprotocol/server/stdio', { log: healLog, connectPath: true }));
} catch (e) {
  if (isMissingPackagesError(e) &&
      serveInstallResponderFor('mindrian-os', { reason: e.reason, startInstall: e.code === 'MODULE_NOT_FOUND', http: isHttpTransport() }, healLog)) return;
  throw e;
}
// Module-level handle from serveStdio, closed by exitAfterTeardown.
let stdioHandle = null;
// Phase 267 Plan 13: shutdown seam. httpServer is the net.Server app.listen
// returns; mcpHandlers lists every createMcpHandler handler this process owns
// (the flag-OFF handler, or the flag-ON modern handler). Both are closed
// by exitAfterTeardown.
let httpServer = null;
const mcpHandlers = [];
const { detectSurface } = require('../lib/mcp/surface-detect.cjs');
const { registerCapabilities } = require('../lib/mcp/capability-registry.cjs');
const { computeCatchUp, registerShutdownHandler } = require('../lib/mcp/session-catchup.cjs');
// RCA desktop-session-binding-fallback (navigator ruling 2026-10-02): a stdio
// server process serves exactly one client connection, so ONE process-scoped
// session key minted at serve time is that conversation's identity. Claude
// Desktop supplies no session id anywhere (no env var, no SDK session), which
// left room_bind failing with no_session_id and every later write falling
// through to the machine-wide registry `active` room. Registered ONLY on the two
// stdio serve paths below, never on an HTTP branch (a daemon serving many
// clients must stay session-less so a binding is never shared across clients).
const { registerStdioProcessSession } = require('../lib/core/session-binding.cjs');
// Phase 270-08: debounced sendResourceListChanged over directory churn
// under the rooms home (mos://tree, plan 270-08 Task 1). Wired at boot
// below and torn down via registerShutdownHandler's extraTeardown seam
// (session-catchup.cjs, plan 270-08 addition) rather than a second
// process.on('SIGTERM'/'SIGINT'/'beforeExit') listener.
const { startTreeWatcher, stopTreeWatcher } = require('../lib/mcp/tree-watcher.cjs');
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
  // Phase 267 Plan 11: McpServer here is the v2 class (@modelcontextprotocol/server),
  // served over stdio by serveStdio and, until Plan 14, over the v1 HTTP transport.
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

  // The tree watcher (plan 270-08) is NOT started here. Plan 267-12: this
  // factory runs once per HTTP request on the flag-OFF branch, so it must be
  // free of process-level side effects. main() starts the watcher once per
  // process with a per-branch target (see the once-per-process helper below).

  // Register MCP Prompts (methodology workflows with Larry personality)
  const { registerPrompts } = require('../lib/mcp/prompts.cjs');
  registerPrompts(s, roomDir, pluginRoot);

  // Register surface-aware capabilities (MCP Apps, Tasks -- Phase 58/60 hook points)
  registerCapabilities(s, surface.capabilities, roomDir, pluginRoot);

  return s;
}

// Module-level singleton for the stdio branch and the express-missing stdio
// fallback only (a single process serves exactly one client there). Plan
// 267-12: built lazily, so HTTP mode never constructs an unused server with a
// full set of registrations at boot. The flag-OFF HTTP branch builds one
// server per request through createMcpHandler(() => createServer()).
let server = null;
function getServer() {
  if (!server) server = createServer();
  return server;
}

// Start the tree watcher (plan 270-08): debounced resource-list-changed over
// directory churn under the rooms home, so mos://tree stays live with no
// per-turn cost. Called ONCE per process from main() with a per-branch target
// (an object exposing sendResourceListChanged): the stdio singleton, or the
// flag-OFF handler's notify.resourcesChanged. Wrapped in try/catch, and
// startTreeWatcher itself degrades to {ok:false} rather than throwing on a
// missing rooms home -- a watcher failure must never fail server boot,
// matching the dep-heal additive-degradation discipline.
function startTreeWatcherOnce(target) {
  try {
    startTreeWatcher(target, {});
  } catch (e) {
    process.stderr.write('[mindrian-os] tree watcher failed to start: ' + (e && e.message ? e.message : String(e)) + '\n');
  }
}

// Session catch-up: register shutdown handler to save session state (all
// surfaces). registerShutdownHandler already no-ops after its first call
// (session-catchup.cjs's own _shutdownRegistered guard), so this stays a
// single module-level call regardless of how many per-session servers the
// flag-ON HTTP branch later creates -- it is a PROCESS/ROOM lifecycle
// concern, not a per-MCP-session one.
//
// Phase 270-08: stopTreeWatcher rides the SAME registration as an
// extraTeardown callback (session-catchup.cjs's own new seam) rather than a
// second SIGTERM/SIGINT/beforeExit listener. The rooms home the tree
// watcher watches is a DIFFERENT directory than roomDir (the single current
// room), so the watcher's teardown must still be reachable even when
// roomDir itself does not exist -- the else branch registers with a falsy
// roomDir so the session-snapshot half stays the no-op it already is via
// its own try/catch, while the watcher teardown still wires in.
if (fs.existsSync(roomDir)) {
  registerShutdownHandler(roomDir, stopTreeWatcher);
} else {
  registerShutdownHandler(null, stopTreeWatcher);
}

// Phase 267 Plan 13 (RCA 5, mcp-server-sigterm-no-exit): the terminal signal
// listener. registerShutdownHandler (session-catchup.cjs, shared with the brain
// shim, so it stays exit-free) snapshots and tears down but never exits, and
// installing any SIGTERM/SIGINT listener removes Node's default exit-on-signal.
// So THIS entry point owns the exit: it is registered LAST on every branch, so
// Node runs the snapshot/teardown listener (and the flag-ON pidfile clear)
// first, then this one closes what it owns and exits 0. An unref'd 2000 ms
// timer is the backstop so a stuck close cannot bring the hang back.
let exiting = false;
function exitAfterTeardown(signal) {
  if (exiting) return;
  exiting = true;
  const backstop = setTimeout(() => process.exit(0), 2000);
  if (typeof backstop.unref === 'function') backstop.unref();
  (async () => {
    if (httpServer) {
      try { httpServer.close(() => {}); } catch (_e) { /* best effort */ }
    }
    for (const h of mcpHandlers) {
      try { await h.close(); } catch (_e) { /* best effort */ }
    }
    if (stdioHandle) {
      try { await stdioHandle.close(); } catch (_e) { /* best effort */ }
    }
    process.exit(0);
  })().catch(() => process.exit(0));
}
function registerTerminalSignalListeners() {
  process.on('SIGTERM', () => exitAfterTeardown('SIGTERM'));
  process.on('SIGINT', () => exitAfterTeardown('SIGINT'));
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
      registerStdioProcessSession();
      stdioHandle = serveStdio(() => getServer());
      startTreeWatcherOnce(getServer());
      process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, stdio-fallback, room: ${roomDir})\n`);
      registerTerminalSignalListeners();
      return;
    }

    const {
      toNodeHandler,
      toWebRequest,
      localhostHostValidation,
      localhostOriginValidation,
      NodeStreamableHTTPServerTransport,
    } = require('@modelcontextprotocol/node');
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
    //
    // Phase 267 Plan 12 (RCA 1, mcp-http-flag-off-one-request-per-process):
    // the flag-OFF branch no longer holds ONE shared stateless transport (the
    // SDK throws "Stateless transport cannot be reused across requests" on
    // the second request, surfacing as a bare 500). It serves every request
    // through createMcpHandler(() => createServer(), { legacy: 'stateless' })
    // behind toNodeHandler: a fresh server per request, both protocol eras
    // (a 2025 client takes the legacy stateless leg, a 2026-07-28 client the
    // modern leg). The already-parsed req.body is passed through (express.json
    // has consumed the stream, and its 100 KB limit is stricter than the SDK's
    // 4 MiB default, which does not apply to a passed parsedBody). The
    // loopback endpoint also refuses DNS rebinding: the Host and Origin guards
    // answer 403 before any MCP handling.
    //
    // Phase 267 Plan 14 (flag-ON, MCPV2-06): the daemon stays sessionful and
    // 2025-era for existing clients, because lib/core/session-binding.cjs keys
    // room binding by the transport-minted session id (a stateless handler would
    // silently kill it). Requests are routed by isLegacyRequest on the parsed
    // body: legacy (claim-less, incl. initialize and body-less GET/DELETE session
    // operations) goes to the session-keyed v2 NodeStreamableHTTPServerTransport
    // map below; everything else goes to a modern-only createMcpHandler (the SDK
    // routing contract: a false answer must never reach the legacy path).
    //
    // The Host/Origin guards are shared by both branches and both routes.
    let sessionTransports;
    let flagOffNodeHandler = null;
    let flagOffMcpHandler = null;
    let modernMcpHandler = null;
    let modernNodeHandler = null;
    const onHandlerError = (e) => {
      process.stderr.write('[mindrian-os] mcp handler: ' + (e && e.message ? e.message : String(e)) + '\n');
    };
    const hostGuard = localhostHostValidation();
    const originGuard = localhostOriginValidation();
    if (mcpFirstOn) {
      sessionTransports = new Map();
      modernMcpHandler = createMcpHandler(() => createServer(), { legacy: 'reject', onerror: onHandlerError });
      mcpHandlers.push(modernMcpHandler);
      modernNodeHandler = toNodeHandler(modernMcpHandler, { onerror: onHandlerError });
    } else {
      flagOffMcpHandler = createMcpHandler(() => createServer(), { legacy: 'stateless', onerror: onHandlerError });
      mcpHandlers.push(flagOffMcpHandler);
      flagOffNodeHandler = toNodeHandler(flagOffMcpHandler, { onerror: onHandlerError });
    }

    // The flag-ON legacy leg: one NEW session-keyed transport per NEW initialize
    // (the 198-08 multi-session pattern), a FRESH McpServer per session
    // (connect() throws on a second call against one instance), 400 on an unknown
    // session id, session-registry open/close on the transport callbacks.
    async function serveLegacySession(req, res) {
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
        sessionTransport = new NodeStreamableHTTPServerTransport({
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
        const sessionServer = createServer();
        await sessionServer.connect(sessionTransport);
      }

      await sessionTransport.handleRequest(req, res, req.body);
    }

    app.all('/mcp', async (req, res) => {
      // Phase 198-08 (Rule 1 fix): app.use(express.json()) above already
      // consumes the request stream and parses it onto req.body, so the parsed
      // body is passed through to every handler (a re-read of the consumed
      // stream failed with -32700 Parse error).
      // The guards answer 403 themselves when they return false.
      if (!hostGuard(req, res)) return;
      if (!originGuard(req, res)) return;
      if (!mcpFirstOn) {
        await flagOffNodeHandler(req, res, req.body);
        return;
      }
      // Flag-ON: classify with the already-parsed body, route by era.
      const webReq = await toWebRequest(req, req.body);
      if (await isLegacyRequest(webReq, req.body)) {
        await serveLegacySession(req, res);
        return;
      }
      await modernNodeHandler(req, res, req.body);
    });

    // Phase 198-03 (D-01, Open Question 3): the SSE event bus's /event route
    // is wired ONLY under the flag-ON branch -- flag-OFF adds no route at all
    // (byte-identical legacy, SPEC-7). Loopback-only (this app already binds
    // 127.0.0.1 only, below); additive vocabulary
    // (status-segment/gate-fired/reconcile-raised); never carries room
    // content bound for the Brain (Part 8).
    if (mcpFirstOn) {
      app.get('/event', (req, res) => {
        // Same DNS-rebinding guards as /mcp (Plan 14): the guards answer 403 themselves.
        if (!hostGuard(req, res)) return;
        if (!originGuard(req, res)) return;
        sseEventBus.subscribe(res);
      });
      // Flag-ON: one tree watcher per process, targeting the modern handler's
      // notifier. Legacy sessions keep today's behavior (no tree notifications):
      // before Plan 12 the only watcher was bound to the boot singleton, which
      // flag-ON never connects, so it delivered nothing to anyone.
      startTreeWatcherOnce({ sendResourceListChanged: () => modernMcpHandler.notify.resourcesChanged() });
    } else {
      // Flag-OFF: one tree watcher per process, targeting the handler's
      // notifier (the per-request servers have no long-lived connection to
      // notify through).
      startTreeWatcherOnce({ sendResourceListChanged: () => flagOffMcpHandler.notify.resourcesChanged() });
    }

    // Phase 198-03 (D-01, SPEC-1/SPEC-7): flag-ON discovers a free loopback
    // port (daemonLifecycle.discoverPort, or the already-recorded live
    // daemon's own port) instead of the hardcoded 3847, and records the
    // pidfile once listening so the stdio shim + future clients can find
    // THIS process. Flag-OFF keeps port 3847 exactly as shipped -- no
    // pidfile, no discovery, byte-identical legacy.
    const listenPort = mcpFirstOn ? daemonLifecycle.discoverPort() : 3847;
    // Phase 267 Plan 13 (RCA 6, mcp-http-listen-error-false-started): Express 5
    // hands a bind failure to this callback as its first argument. Read it: a
    // failed bind is reported honestly and exits 1, with no "started" line, no
    // pidfile and no catch-up.
    httpServer = app.listen(listenPort, '127.0.0.1', (listenErr) => {
      if (listenErr) {
        process.stderr.write(`[mindrian-os] HTTP listen failed on 127.0.0.1:${listenPort}: ${listenErr.code || listenErr.message}\n`);
        process.exit(1);
        return;
      }
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

      // Registered last (after registerShutdownHandler at module scope and the
      // flag-ON clearOnce above) so snapshot and teardown run before the exit.
      registerTerminalSignalListeners();
    });
  } else {
    // stdio for CLI and Desktop
    registerStdioProcessSession();
    stdioHandle = serveStdio(() => getServer());
    startTreeWatcherOnce(getServer());
    process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, ${surface.transport}, room: ${roomDir})\n`);
    registerTerminalSignalListeners();
  }
}

main().catch((err) => {
  process.stderr.write(`[mindrian-os] Fatal: ${err.message}\n`);
  process.exit(1);
});
