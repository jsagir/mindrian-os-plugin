#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * MindrianOS Plugin -- dependency-free in-band install-status responder
 * (Phase 369.1 plan 06, D-04 and D-14, CLAUDE.md decision 8).
 *
 * THE PROBLEM: on a surface without a plugin loader that installs packages
 * (Claude Desktop local plugins, Cowork), the first start of an MCP server has
 * no node_modules. The self-install (lib/core/dep-install-detached.cjs) takes
 * 17 to 26 s on a cold cache, past the 15 s connect budget, so the server
 * cannot load the MCP SDK before the host's connect window closes. Dying
 * silently is a decision-8 violation (a server that cannot load its packages
 * says so in the turn, never a silent partial toolset).
 *
 * THE FIX (this module): a tiny stdio JSON-RPC server that needs NOTHING but
 * node built-ins, so it works with node_modules absent. It answers the
 * handshake and serves exactly ONE tool (mos_install_status or
 * brain_install_status) whose text is the honest line for the current install
 * state: installing, done, failed with the reason, or npm not found, each
 * naming the fix. It never registers any other tool, so there is no partial
 * toolset to mistake for the real one. The status is re-read from the status
 * file on every tools/call, so a user who asks again a minute later hears
 * "done".
 *
 * TRANSPORTS (369.1-REVIEW WR-07): stdio by default, and HTTP on 127.0.0.1:3847 (POST /mcp,
 * stateless, loopback Host and Origin only) for the surface that selects the HTTP transport
 * (Cowork), with the same tool and the same answers.
 *
 * PROTOCOL: newline-delimited JSON-RPC 2.0 on stdin/stdout. Both protocol
 * eras connect: the 2025-era client sends `initialize`; a negotiating client
 * first probes `server/discover`, which gets JSON-RPC -32601 (Method not
 * found) and falls back to `initialize` (stdio probe fallback verified with
 * the repo's own SDK client in tests/test-369.1-dep-self-install.cjs).
 *
 * Canon Part 8 / D-08: no network, no Brain call, no room content. The status
 * record lives in a per-user private directory (lib/core/dep-install-status.cjs,
 * 369.1-REVIEW CR-01) and holds only state, timestamps, a pid and a bounded
 * reason. Whatever reaches the model (instructions, the tool description, the
 * tool result) is built from the allow-listed record: a known state and a
 * reason that matches a fixed pattern, never raw file text, and no file path
 * or plugin path is printed.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const path = require('node:path');

const {
  statusFilePath,
  readStatus,
  sanitizeStatus,
  installInterrupted,
} = require('./dep-install-status.cjs');

const STATUS_TOOL_NAMES = {
  'mindrian-os': 'mos_install_status',
  'mindrian-brain': 'brain_install_status',
};

const KNOWN_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PROTOCOL_VERSION = '2025-11-25';

function subject(serverName) {
  return serverName === 'mindrian-brain' ? 'The MindrianOS Brain connection' : 'MindrianOS';
}
function toolsPhrase(serverName) {
  return serverName === 'mindrian-brain' ? 'the Brain tools' : "Larry's room tools";
}

/**
 * The honest one-line (or two-line) answer for the current install state.
 * @param {object|null} status - { state, reason, pid, pluginRoot, ... } or null (treated as installing)
 * @param {string} serverName - 'mindrian-os' | 'mindrian-brain'
 * @returns {string}
 */
function installStatusLine(status, serverName) {
  const who = subject(serverName);
  const tools = toolsPhrase(serverName);
  // Allow-listed shape only (CR-01): a known state and a pattern-checked reason.
  const st = sanitizeStatus(status);
  const state = st ? st.state : 'installing';
  const reason = st && st.reason ? st.reason : 'unknown';

  if (state === 'done') {
    return who + ' finished installing its packages on this computer. Start a new task or session to load ' + tools + '.';
  }
  if (state === 'npm-not-found' || (state === 'failed' && reason === 'npm-not-found')) {
    return who + ' needs npm to install its packages on this computer, and npm was not found next to Node.js or on PATH. ' +
      'Fix: install Node.js 22.18 or newer (it includes npm), then start a new task.';
  }
  if (state === 'failed') {
    return who + ' failed to install its packages on this computer (' + reason + '). ' +
      'Fix: check the internet connection and that Node.js 22.18 or newer with npm is installed, then start a new task.';
  }
  // installing (or an unknown state): an installer that died, or one older than any
  // install can run, leaves "installing" behind; say so.
  if (installInterrupted(st)) {
    return who + ' package install stopped before it finished. Fix: start a new task and it will try again.';
  }
  return who + ' is installing its packages on this computer for the first time (usually under a minute). ' +
    tools.charAt(0).toUpperCase() + tools.slice(1) + ' load in your next task or session, so start a new one in a minute.';
}

function isErrorState(status) {
  const st = sanitizeStatus(status);
  if (!st) return false;
  return st.state === 'failed' || st.state === 'npm-not-found' || installInterrupted(st);
}

/**
 * The transport-independent responder: one JSON-RPC message in, the response
 * object (or null when nothing is to be sent) out. The stdio loop and the HTTP
 * listener below both drive it, so the two transports give the same answers.
 * @param {object} opts - same as serveInstallingResponder
 * @returns {{ respond: function(object): (object|null), toolName: string, serverName: string, current: function(): (object|null) }}
 */
function createResponder(opts) {
  opts = opts || {};
  const serverName = opts.serverName === 'mindrian-brain' ? 'mindrian-brain' : 'mindrian-os';
  const version = String(opts.version || '0.0.0');
  const pluginRoot = opts.pluginRoot || path.resolve(__dirname, '..', '..');
  const toolName = STATUS_TOOL_NAMES[serverName];
  const initial = sanitizeStatus(opts.status);

  const current = () => readStatus(pluginRoot) || initial;
  const lineNow = () => installStatusLine(current(), serverName);
  const result = (id, res) => ({ jsonrpc: '2.0', id, result: res });
  const failure = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  function respond(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
    const hasId = msg.id !== undefined && msg.id !== null;
    const method = typeof msg.method === 'string' ? msg.method : null;
    if (!method) return null; // a response or noise: nothing to answer
    if (!hasId) return null; // notifications (notifications/initialized, cancelled, ...) get no reply
    switch (method) {
      case 'initialize': {
        const asked = msg.params && msg.params.protocolVersion;
        return result(msg.id, {
          protocolVersion: KNOWN_PROTOCOL_VERSIONS.includes(asked) ? asked : DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: serverName, version },
          instructions: lineNow(),
        });
      }
      case 'ping':
        return result(msg.id, {});
      case 'tools/list':
        return result(msg.id, {
          tools: [{
            name: toolName,
            description: lineNow(),
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          }],
        });
      case 'tools/call': {
        const asked = msg.params && msg.params.name;
        if (asked !== toolName) {
          return result(msg.id, {
            content: [{ type: 'text', text: 'Unknown tool "' + String(asked).slice(0, 80) + '". Only ' + toolName + ' is available while packages install. ' + lineNow() }],
            isError: true,
          });
        }
        return result(msg.id, {
          content: [{ type: 'text', text: lineNow() }],
          isError: isErrorState(current()),
        });
      }
      default:
        // Includes server/discover: a negotiating client falls back to initialize.
        return failure(msg.id, -32601, 'Method not found: ' + method);
    }
  }

  return { respond, failure, toolName, serverName, current };
}

function logServing(responder) {
  try {
    const s = responder.current();
    process.stderr.write('[mcp-install-responder] serving ' + responder.serverName + ' status tool: ' + (s && s.state ? s.state : 'installing') + '\n');
  } catch (_) { /* stderr gone */ }
}

/**
 * Serve the status responder on stdin/stdout until stdin ends.
 */
function serveStdio(responder) {
  function send(obj) {
    try {
      process.stdout.write(JSON.stringify(obj) + '\n');
    } catch (_) {
      process.exit(0);
    }
  }
  process.stdout.on('error', () => process.exit(0));

  function handleLine(line) {
    const text = line.trim();
    if (!text) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (_) {
      const m = /"id"\s*:\s*(-?\d+|"[^"\\]*")/.exec(text);
      if (m) {
        try { send(responder.failure(JSON.parse(m[1]), -32700, 'Parse error')); } catch (_e) { /* ignore */ }
      }
      return;
    }
    try {
      const out = responder.respond(msg);
      if (out) send(out);
    } catch (_) {
      if (msg && msg.id !== undefined && msg.id !== null) send(responder.failure(msg.id, -32603, 'Internal error'));
    }
  }

  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      handleLine(line);
    }
  });
  process.stdin.on('end', () => {
    if (buf.trim()) handleLine(buf);
    process.exit(0);
  });
  process.stdin.on('error', () => process.exit(0));
  process.stdin.resume();
}

// The loopback names a request may address (DNS-rebinding guard, same stance as the full server's
// localhostHostValidation / localhostOriginValidation).
function isLoopbackHostHeader(value) {
  const h = String(value || '').toLowerCase().replace(/:\d+$/, '');
  return h === '127.0.0.1' || h === 'localhost' || h === '[::1]';
}
function isLoopbackOrigin(value) {
  try {
    const u = new URL(String(value));
    return (u.protocol === 'http:' || u.protocol === 'https:') && isLoopbackHostHeader(u.host);
  } catch (_) {
    return false;
  }
}

const HTTP_MAX_BODY_BYTES = 262144;
const DEFAULT_HTTP_PORT = 3847;

/**
 * Serve the same status responder over HTTP, for the surface that selects the HTTP transport
 * (Cowork: 127.0.0.1:3847, POST /mcp). Stateless: one JSON-RPC message (or a batch) per POST, one
 * JSON answer back, no session id, no event stream. Loopback only: a Host or Origin that is not
 * loopback is refused with 403 before anything is read. Built-ins only (node:http).
 * @param {object} responder - from createResponder
 * @param {object} [opts]
 * @param {number} [opts.port]
 * @returns {object} the http.Server
 */
function serveHttp(responder, opts) {
  const http = require('node:http');
  opts = opts || {};
  let port = Number(opts.port) || DEFAULT_HTTP_PORT;
  // Test-only seam: inert unless MINDRIAN_TEST_MODE === '1'.
  if (process.env.MINDRIAN_TEST_MODE === '1') {
    const t = Number.parseInt(process.env.MINDRIAN_TEST_RESPONDER_PORT || '', 10);
    if (Number.isInteger(t) && t >= 0 && t < 65536) port = t;
  }

  function reply(res, status, body, extra) {
    const text = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) }, extra || {}));
    res.end(text);
  }

  const server = http.createServer((req, res) => {
    if (!isLoopbackHostHeader(req.headers.host)) return reply(res, 403, { error: 'forbidden host' });
    if (req.headers.origin !== undefined && !isLoopbackOrigin(req.headers.origin)) return reply(res, 403, { error: 'forbidden origin' });
    const pathname = String(req.url || '').split('?')[0];
    if (pathname !== '/mcp') return reply(res, 404, { error: 'not found' });
    if (req.method !== 'POST') return reply(res, 405, { error: 'POST only while packages install' }, { Allow: 'POST' });

    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > HTTP_MAX_BODY_BYTES) { tooBig = true; return; }
      chunks.push(c);
    });
    req.on('error', () => { /* connection dropped */ });
    req.on('end', () => {
      if (tooBig) return reply(res, 413, { error: 'request too large' });
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch (_) {
        return reply(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      }
      const answerOne = (msg) => {
        try {
          return responder.respond(msg);
        } catch (_) {
          return msg && msg.id !== undefined && msg.id !== null ? responder.failure(msg.id, -32603, 'Internal error') : null;
        }
      };
      if (Array.isArray(body)) {
        const out = body.map(answerOne).filter(Boolean);
        return out.length ? reply(res, 200, out) : reply(res, 202);
      }
      const out = answerOne(body);
      return out ? reply(res, 200, out) : reply(res, 202);
    });
  });

  server.on('error', (e) => {
    // An honest, deliberate failure: never a silent partial server.
    try { process.stderr.write('[mcp-install-responder] HTTP listen failed on 127.0.0.1:' + port + ': ' + (e && (e.code || e.message)) + '\n'); } catch (_) { /* stderr gone */ }
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    try { process.stderr.write('[mcp-install-responder] HTTP status responder on 127.0.0.1:' + server.address().port + '\n'); } catch (_) { /* stderr gone */ }
  });
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));
  return server;
}

/**
 * Serve the install-status responder until the host closes it: stdio (the default) or, for a
 * surface that selects the HTTP transport, HTTP on 127.0.0.1 (369.1-REVIEW WR-07). Same tool, same
 * answers either way.
 * @param {object} opts
 * @param {string} opts.serverName - 'mindrian-os' | 'mindrian-brain'
 * @param {string} opts.version - server version for serverInfo
 * @param {string} opts.pluginRoot - plugin root (status file key)
 * @param {object} [opts.status] - the status known at start; re-read on every tools/call
 * @param {string} [opts.transport] - 'stdio' (default) | 'http'
 * @param {number} [opts.port] - HTTP port (default 3847)
 */
function serveInstallingResponder(opts) {
  opts = opts || {};
  const responder = createResponder(opts);
  logServing(responder);
  if (opts.transport === 'http') return serveHttp(responder, { port: opts.port });
  return serveStdio(responder);
}

module.exports = {
  serveInstallingResponder,
  createResponder,
  installStatusLine,
  statusFilePath,
  readStatus,
  STATUS_TOOL_NAMES,
};
