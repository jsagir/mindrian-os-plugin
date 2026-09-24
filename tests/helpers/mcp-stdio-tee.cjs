#!/usr/bin/env node
'use strict';

/*
 * Phase 267 Plan 04 (MCPV2-13, locked_stage "W0 Tri-Polar wire probes BEFORE
 * the local server adopts serveStdio") -- a handshake-only stdio tee.
 * =============================================================================
 * argv after this script is the REAL server command, for example:
 *   node tests/helpers/mcp-stdio-tee.cjs node bin/mindrian-mcp-server.cjs
 *
 * It spawns that command with the parent's env UNCHANGED (same object
 * reference passed straight through to child_process.spawn, so the tee never
 * changes which surface lib/mcp/surface-detect.cjs picks), pipes host stdin
 * to child stdin and child stdout to host stdout BYTE FOR BYTE, pipes child
 * stderr to its own stderr, and forwards its exit code plus SIGTERM/SIGINT to
 * the child.
 *
 * While piping, it parses newline-delimited JSON-RPC in BOTH directions and
 * appends at most ONE JSONL record per message to the file named by env
 * MOS_TEE_LOG (skip logging entirely when unset). The whitelist is narrow and
 * intentional (Canon Part 8 spirit -- this sits in the middle of a real
 * conversation's traffic during the human Desktop/Cowork probe, T-267-12):
 *
 *   - host->server `initialize` / `server/discover` / `notifications/initialized`:
 *     the full opening-handshake record (method, protocolVersion, clientInfo,
 *     capability keys AND values, plus a modern `_meta.protocolVersion` if
 *     present). This is the only branch that ever reads message.params.
 *   - server->host RESPONSE to one of those (matched by request id): a
 *     handshake-result record (protocolVersion, serverInfo, whether
 *     instructions were sent, an error code if any). This is the only branch
 *     that ever reads message.result.
 *   - every other host->server or server->host message (any other request,
 *     any response to it, any notification): `{ts, dir, method}` ONLY. A
 *     response's `method` is looked up from the id the matching request was
 *     sent with; a response whose request was never seen (or whose id was
 *     already logged and forgotten) is not logged at all, never guessed.
 *
 * After the first 20 records, logging stops entirely (piping continues
 * unaffected). No em-dashes. CJS, Node built-ins only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');

const MAX_RECORDS = 20;
const WHITELIST_C2S_METHODS = new Set(['initialize', 'server/discover', 'notifications/initialized']);

function usageExit() {
  process.stderr.write('mcp-stdio-tee: usage: mcp-stdio-tee.cjs <command> [args...]\n');
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.length === 0) usageExit();
const [cmd, ...cmdArgs] = argv;

const logPath = process.env.MOS_TEE_LOG;
let recordCount = 0;

// ---------------------------------------------------------------------------
// appendRecord(record) -- the ONLY place this file writes to MOS_TEE_LOG.
// Never called with a raw message; every caller below builds a narrow,
// whitelisted object first. Best-effort: a log-write failure never breaks
// the tee's pass-through job.
// ---------------------------------------------------------------------------
function appendRecord(record) {
  if (!logPath) return;
  if (recordCount >= MAX_RECORDS) return;
  recordCount += 1;
  try {
    fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
  } catch (_e) {
    // best-effort only
  }
}

// id -> originating method, for every host->server message that carries an
// id (a "request"). Lets a later response be logged as {dir,method} without
// ever re-reading or re-logging that response's own result/error payload,
// for any method outside the opening-handshake whitelist.
const idToMethod = new Map();

function safeParseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_e) {
    return null;
  }
}

function handleC2S(msg) {
  if (!msg || typeof msg !== 'object') return;
  const method = msg.method;
  if (typeof method !== 'string') return; // a bare response with no method: never host->server on this wire
  if (typeof msg.id !== 'undefined' && msg.id !== null) {
    idToMethod.set(msg.id, method);
  }
  if (WHITELIST_C2S_METHODS.has(method)) {
    const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
    const record = {
      ts: new Date().toISOString(),
      dir: 'c2s',
      method,
      protocolVersion: params.protocolVersion,
      clientInfo: params.clientInfo,
      capabilityKeys: Object.keys(params.capabilities || {}),
      capabilities: params.capabilities,
    };
    if (msg._meta && typeof msg._meta === 'object' && typeof msg._meta.protocolVersion === 'string') {
      record.metaProtocolVersion = msg._meta.protocolVersion;
    }
    appendRecord(record);
  } else {
    appendRecord({ ts: new Date().toISOString(), dir: 'c2s', method });
  }
}

function handleS2C(msg) {
  if (!msg || typeof msg !== 'object') return;
  // A server->host notification or request carries its own `method`.
  if (typeof msg.method === 'string') {
    appendRecord({ ts: new Date().toISOString(), dir: 's2c', method: msg.method });
    return;
  }
  // Otherwise this is a RESPONSE: correlate it to the request id that
  // asked for it. An id we never saw (or already resolved) is skipped,
  // never guessed at.
  if (typeof msg.id === 'undefined' || msg.id === null) return;
  const method = idToMethod.get(msg.id);
  if (!method) return;
  idToMethod.delete(msg.id);
  if (method !== 'notifications/initialized' && WHITELIST_C2S_METHODS.has(method)) {
    const result = msg.result && typeof msg.result === 'object' ? msg.result : {};
    appendRecord({
      ts: new Date().toISOString(),
      dir: 's2c',
      id: msg.id,
      protocolVersion: result.protocolVersion,
      serverInfo: result.serverInfo,
      hasInstructions: typeof result.instructions === 'string',
      error: msg.error && msg.error.code,
    });
  } else {
    appendRecord({ ts: new Date().toISOString(), dir: 's2c', method });
  }
}

function makeLineTapper(onMessage) {
  let buf = '';
  return function tap(chunk) {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      const msg = safeParseLine(line);
      if (msg) onMessage(msg);
    }
  };
}

const tapC2S = makeLineTapper(handleC2S);
const tapS2C = makeLineTapper(handleS2C);

// ---------------------------------------------------------------------------
// Spawn the real server with the parent's env unchanged. Not detached: the
// child shares this process's process group, so a caller that spawns THIS
// tee with { detached: true } and later kills the negative pid (the whole
// group) reaps the real server too, with no separate bookkeeping needed.
// ---------------------------------------------------------------------------
const child = cp.spawn(cmd, cmdArgs, {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

// Byte-for-byte pass-through, both directions. The tap functions above are
// non-mutating: they read a copy of each chunk to find complete JSON-RPC
// lines, but the bytes actually written downstream are the original chunk,
// untouched.
process.stdin.on('data', (chunk) => {
  tapC2S(chunk);
  try {
    child.stdin.write(chunk);
  } catch (_e) {
    // child stdin already closed; nothing to forward
  }
});
process.stdin.on('end', () => {
  try {
    child.stdin.end();
  } catch (_e) {
    // already closed
  }
});

child.stdout.on('data', (chunk) => {
  tapS2C(chunk);
  process.stdout.write(chunk);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

function forwardSignal(sig) {
  process.on(sig, () => {
    try {
      child.kill(sig);
    } catch (_e) {
      // already gone
    }
  });
}
forwardSignal('SIGTERM');
forwardSignal('SIGINT');

child.on('exit', (code, signal) => {
  if (signal) {
    // Re-raise the same signal on ourselves so a caller watching THIS
    // process's exit sees the expected signal-based termination.
    try {
      process.kill(process.pid, signal);
    } catch (_e) {
      process.exit(1);
    }
    return;
  }
  process.exit(typeof code === 'number' ? code : 1);
});

child.on('error', (err) => {
  process.stderr.write('mcp-stdio-tee: failed to spawn child: ' + ((err && err.message) || String(err)) + '\n');
  process.exit(1);
});
