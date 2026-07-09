'use strict';
// Phase 198-08 (SPEC-5, D-06) -- adapter-client: the ONE thin HTTP reach a
// migrated hook script needs to wake and query the durable mindrian-core
// daemon.
//
// D-06 thin shape, drawn at the same directory boundary bin/mindrian-mcp-
// shim.cjs already established: wake (ensureDaemon) -> connect -> call a
// tool -> return its result. This module carries ZERO business logic of its
// own -- it never composes a statusline segment, never reconciles a session,
// never decides anything. It IS allowed to require lib/mcp/daemon-
// lifecycle.cjs (adapter plumbing, not a lib/core business module) -- the
// D-06 import audit forbids lib/core/lib/workflow/lib/memory business
// imports FROM HOOK SCRIPTS, not the adapter-client's own daemon plumbing
// (198-08-PLAN.md Task 1).
//
// T-198-06 (Information Disclosure): queryDaemon connects 127.0.0.1 ONLY, at
// the port daemon-lifecycle discovers/records -- never a remote host.
//
// No em-dashes. CJS only.

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const daemonLifecycle = require('./daemon-lifecycle.cjs');

const LOOPBACK = '127.0.0.1';
const CLIENT_NAME = 'mindrian-hook-adapter';
const CLIENT_VERSION = '1.0.0';

/**
 * wakeDaemon(opts) -- find-or-spawn the ONE durable localhost daemon and
 * return its {pid, port}. Thin pass-through to daemon-lifecycle.ensureDaemon
 * (Plan 03); this function adds no logic of its own beyond the call.
 *
 * @param {object} [opts] - forwarded verbatim to daemonLifecycle.ensureDaemon
 * @returns {Promise<{pid: number, port: number|null}>}
 */
async function wakeDaemon(opts) {
  return daemonLifecycle.ensureDaemon(opts);
}

/**
 * queryDaemon(tool, args, opts) -- wake the daemon, open a short-lived MCP
 * client connection over 127.0.0.1 at the discovered port, call ONE tool,
 * close the connection, and return the tool's result. This is the entire
 * adapter contract: wake -> query -> render (rendering is the caller's job).
 *
 * A fresh, unbound connection performs a REAL initialize handshake every
 * call (Rule 1 fix, discovered live): the MCP SDK's Client.connect()
 * SKIPS the initialize handshake whenever the transport is constructed
 * with a pre-set sessionId (it assumes that session was already
 * initialized elsewhere -- the reconnect shape bin/mindrian-mcp-shim.cjs
 * legitimately uses when it bridges an ALREADY-LIVE stdio session's raw
 * transport). queryDaemon is a stateless, one-shot caller with no prior
 * live session to reconnect to, so it never pre-sets a transport
 * sessionId -- every call gets its own fresh session id from the daemon's
 * sessionIdGenerator. A caller that needs its result scoped to a
 * particular room/session threads that through the TOOL's own arguments
 * (e.g. a future sessionId tool argument), not the transport layer.
 *
 * @param {string} tool - the MCP tool name to call (e.g. 'status_read')
 * @param {object} [args] - tool arguments
 * @param {{daemonOpts?: object}} [opts]
 * @returns {Promise<object>} the tool's CallToolResult
 */
async function queryDaemon(tool, args, opts) {
  const options = opts || {};
  const daemon = await wakeDaemon(options.daemonOpts);
  if (!daemon || !daemon.port) {
    throw new Error('adapter-client: could not reach or start the durable daemon');
  }

  const url = new URL('http://' + LOOPBACK + ':' + daemon.port + '/mcp');
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION }, { capabilities: {} });
  try {
    await client.connect(transport);
    return await client.callTool({ name: tool, arguments: args || {} });
  } finally {
    // Rule 1 fix (discovered live): the daemon's HTTP server holds exactly
    // ONE McpServer<->transport connection open at a time (the MCP SDK
    // throws "Already connected to a transport" on a second connect() call
    // against the same server instance -- the shared daemon reconnects a
    // fresh transport per session, per the SDK's own multi-session pattern,
    // but only after the PRIOR session is torn down). client.close() alone
    // does NOT terminate the session server-side (it only aborts the local
    // HTTP stream) -- without an explicit DELETE, the daemon never sees this
    // session end, so its slot never frees and every subsequent queryDaemon
    // call (the very next statusline render, for example) would fail. This
    // is a genuinely stateless, one-shot query (queryDaemon never reuses a
    // session across calls -- see the note above), so it always terminates
    // its own session immediately after the single tool call completes.
    try { await transport.terminateSession(); } catch (_e) {
      // Best-effort: some daemon builds may 405 (session termination not
      // supported) or already be gone; never let cleanup mask a real result.
    }
    try { await client.close(); } catch (_e) {
      // A close failure must never surface past a successful query.
    }
  }
}

module.exports = { wakeDaemon, queryDaemon };
