'use strict';

// quick 261026-s8c item 2 (S8C-02): log the MCP client name and version ONCE
// per connection, on stderr only.
//
// Why: the host axis (detectHostTier) judges the client by the name it sends,
// and nobody could see that name. One line per connection answers "what does
// the live client call itself". Two hooks call this module, because the MCP
// SDK fires oninitialized only on the legacy handshake. On a 2026-07-28 era
// connection the identity travels in the request envelope, so the first
// status_read call is the second hook.
//
// Line format (pinned by tests/test-234-host-tier.cjs):
//   [mindrian-os] client identity: name="<n>" version="<v>" via=<initialize|status_read> source=<client_version|envelope|none>
//
// Safety:
//   - stderr only. Never stdout: stdout is the JSON-RPC protocol stream.
//   - name and version only. No other client field is ever read into the line.
//   - Each value: printable ASCII only (anything else becomes ?), cut to 64
//     characters, written with JSON.stringify. A newline or a quote in the
//     client string cannot forge a second log line (T-s8c-01).
//   - Never throws. Node built-ins only. No network, no remote service
//     (Canon Part 8): the identity stays in the local stderr stream.
//
// T-234-08 (accepted): the client name is client-supplied and unauthenticated.
// This line is a diagnostic. It decides nothing.

const { readClientIdentity } = require('./surface-detect.cjs');

const MAX_FIELD_CHARS = 64;

// One line per inner Server object.
const alreadyLogged = new WeakSet();

// The identity source is the shared reader in surface-detect.cjs
// (quick 261026-s8c item 5): getClientVersion() first, then the request
// envelope, else none.
function readIdentity(innerServer, extra) {
  const id = readClientIdentity(innerServer, extra);
  const cv = id.clientVersion;
  return { name: cv && cv.name, version: cv && cv.version, source: id.source };
}

// A value for the log line: string only, printable ASCII, cut, JSON-quoted.
function field(value) {
  if (typeof value !== 'string' || value.length === 0) return 'none';
  const cleaned = value.replace(/[^\x20-\x7e]/g, '?').slice(0, MAX_FIELD_CHARS);
  return JSON.stringify(cleaned);
}

/**
 * Write one identity line for this connection, at most once per inner Server.
 *
 * @param {object} innerServer - the inner Server (McpServer.server)
 * @param {string} via - 'initialize' or 'status_read'
 * @param {object} [extra] - the tool handler's second argument (envelope source)
 * @returns {boolean} true when a line was written
 */
function logClientIdentityOnce(innerServer, via, extra) {
  try {
    if (!innerServer || (typeof innerServer !== 'object' && typeof innerServer !== 'function')) return false;
    if (alreadyLogged.has(innerServer)) return false;
    const id = readIdentity(innerServer, extra);
    const viaText = (via === 'initialize' || via === 'status_read') ? via : 'unknown';
    const line = '[mindrian-os] client identity: name=' + field(id.name) +
      ' version=' + field(id.version) + ' via=' + viaText + ' source=' + id.source + '\n';
    alreadyLogged.add(innerServer);
    process.stderr.write(line);
    return true;
  } catch (_e) {
    return false;
  }
}

module.exports = { logClientIdentityOnce };
