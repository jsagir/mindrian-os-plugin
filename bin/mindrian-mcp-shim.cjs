#!/usr/bin/env node
'use strict';

/*
 * MindrianOS MCP stdio -> HTTP thin proxy shim (D-01, D-02, D-06 -- the
 * opencode pattern).
 *
 * A stdio MCP client (Claude Code CLI / Desktop) connects to THIS process
 * over stdin/stdout exactly as it would to bin/mindrian-mcp-server.cjs
 * directly. Instead of running its own McpServer, this shim:
 *   1. calls ensureDaemon() (lib/mcp/daemon-lifecycle.cjs, Task 1) to find or
 *      spawn the ONE durable localhost daemon and discover its port;
 *   2. bridges the local stdio transport to a StreamableHTTPClientTransport
 *      pointed at that daemon over 127.0.0.1 -- every JSON-RPC message is
 *      forwarded verbatim in both directions, unread and unrewritten;
 *   3. passes the hook-derived sessionId (MINDRIAN_SESSION_ID env -- the same
 *      session string shape intent-classifier.cjs's resolveSessionId already
 *      produces for the hook path) through as the daemon connection's
 *      session id, so a CLI session and its daemon connection share ONE
 *      binding (D-02 -- one namespace, never a second).
 *
 * D-06 thin shape: this file carries ZERO business logic -- wake
 * (ensureDaemon) -> resolve (discover the port) -> proxy (forward messages).
 * It NEVER imports a lib/core business module (only lib/mcp/daemon-
 * lifecycle.cjs and the vendored SDK transports) and NEVER binds a port
 * itself -- the daemon (bin/mindrian-mcp-server.cjs) owns the only listening
 * socket. Unlike that server, this shim does NOT run mcp-dep-heal's
 * self-install (that helper lives under lib/core/ -- out of bounds for a
 * D-06 thin adapter); it assumes the vendored node_modules the daemon itself
 * already depends on are present, and the daemon's own self-heal covers a
 * fresh-cache install on the process it spawns.
 *
 * No em-dashes. CJS only.
 */

const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const daemonLifecycle = require('../lib/mcp/daemon-lifecycle.cjs');

// The hook-derived sessionId (D-02 connection key). Absent on a non-hook
// stdio client (e.g. a bare MCP Inspector session) -- the daemon then mints
// its own per-connection id exactly as it does today (unbound session, the
// D-04 read-fallback path).
const hookSessionId = process.env.MINDRIAN_SESSION_ID;

function log(msg) {
  try { process.stderr.write('[mindrian-mcp-shim] ' + msg + '\n'); } catch (_e) {
    // A stderr write failure must never crash the proxy.
  }
}

async function main() {
  const daemon = await daemonLifecycle.ensureDaemon();
  if (!daemon || !daemon.port) {
    log('fatal: could not reach or start the durable daemon');
    process.exit(1);
    return;
  }

  const url = new URL('http://127.0.0.1:' + daemon.port + '/mcp');
  const clientOpts = {};
  if (typeof hookSessionId === 'string' && hookSessionId.length > 0) {
    // Pass the hook-derived sessionId through verbatim as the connection key
    // (D-02): the daemon's session-registry accepts a caller-supplied id at
    // this same string, so the CLI session and its daemon connection resolve
    // to ONE binding, never a second namespace.
    clientOpts.sessionId = hookSessionId;
  }

  const upstream = new StreamableHTTPClientTransport(url, clientOpts);
  const downstream = new StdioServerTransport();

  // Zero-logic bridge: every JSON-RPC message received on one transport is
  // forwarded verbatim to the other. Neither transport's payload is
  // inspected or rewritten (D-06 -- proxy, not a second protocol
  // implementation).
  downstream.onmessage = (message) => {
    upstream.send(message).catch((err) => log('upstream send failed: ' + (err && err.message)));
  };
  upstream.onmessage = (message) => {
    downstream.send(message).catch((err) => log('downstream send failed: ' + (err && err.message)));
  };
  downstream.onerror = (err) => log('downstream error: ' + (err && err.message));
  upstream.onerror = (err) => log('upstream error: ' + (err && err.message));
  downstream.onclose = () => { upstream.close().catch(() => {}); };
  upstream.onclose = () => { downstream.close().catch(() => {}); };

  await upstream.start();
  await downstream.start();
  log(
    'connected to daemon at 127.0.0.1:' + daemon.port +
    (hookSessionId ? ' (session ' + hookSessionId + ')' : ' (unbound)')
  );
}

main().catch((err) => {
  log('fatal: ' + (err && err.message));
  process.exit(1);
});
