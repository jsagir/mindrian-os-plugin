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
 * Serve the status responder on stdin/stdout until stdin ends.
 * @param {object} opts
 * @param {string} opts.serverName - 'mindrian-os' | 'mindrian-brain'
 * @param {string} opts.version - server version for serverInfo
 * @param {string} opts.pluginRoot - plugin root (status file key)
 * @param {object} [opts.status] - the status known at start; re-read on every tools/call
 */
function serveInstallingResponder(opts) {
  opts = opts || {};
  const serverName = opts.serverName === 'mindrian-brain' ? 'mindrian-brain' : 'mindrian-os';
  const version = String(opts.version || '0.0.0');
  const pluginRoot = opts.pluginRoot || path.resolve(__dirname, '..', '..');
  const toolName = STATUS_TOOL_NAMES[serverName];
  const initial = sanitizeStatus(opts.status);

  const current = () => readStatus(pluginRoot) || initial;
  const lineNow = () => installStatusLine(current(), serverName);

  try {
    const s = current();
    process.stderr.write('[mcp-install-responder] serving ' + serverName + ' status tool: ' + (s && s.state ? s.state : 'installing') + '\n');
  } catch (_) { /* stderr gone */ }

  function send(obj) {
    try {
      process.stdout.write(JSON.stringify(obj) + '\n');
    } catch (_) {
      process.exit(0);
    }
  }
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  process.stdout.on('error', () => process.exit(0));

  function handle(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
    const hasId = msg.id !== undefined && msg.id !== null;
    const method = typeof msg.method === 'string' ? msg.method : null;
    if (!method) return; // a response or noise: nothing to answer
    if (!hasId) return; // notifications (notifications/initialized, cancelled, ...) get no reply
    switch (method) {
      case 'initialize': {
        const asked = msg.params && msg.params.protocolVersion;
        reply(msg.id, {
          protocolVersion: KNOWN_PROTOCOL_VERSIONS.includes(asked) ? asked : DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: serverName, version },
          instructions: lineNow(),
        });
        return;
      }
      case 'ping':
        reply(msg.id, {});
        return;
      case 'tools/list':
        reply(msg.id, {
          tools: [{
            name: toolName,
            description: lineNow(),
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          }],
        });
        return;
      case 'tools/call': {
        const asked = msg.params && msg.params.name;
        if (asked !== toolName) {
          reply(msg.id, {
            content: [{ type: 'text', text: 'Unknown tool "' + String(asked) + '". Only ' + toolName + ' is available while packages install. ' + lineNow() }],
            isError: true,
          });
          return;
        }
        reply(msg.id, {
          content: [{ type: 'text', text: lineNow() }],
          isError: isErrorState(current()),
        });
        return;
      }
      default:
        // Includes server/discover: a negotiating client falls back to initialize.
        fail(msg.id, -32601, 'Method not found: ' + method);
    }
  }

  function handleLine(line) {
    const text = line.trim();
    if (!text) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (_) {
      const m = /"id"\s*:\s*(-?\d+|"[^"\\]*")/.exec(text);
      if (m) {
        try { fail(JSON.parse(m[1]), -32700, 'Parse error'); } catch (_e) { /* ignore */ }
      }
      return;
    }
    try {
      handle(msg);
    } catch (_) {
      if (msg && msg.id !== undefined && msg.id !== null) fail(msg.id, -32603, 'Internal error');
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

module.exports = {
  serveInstallingResponder,
  installStatusLine,
  statusFilePath,
  readStatus,
  STATUS_TOOL_NAMES,
};
