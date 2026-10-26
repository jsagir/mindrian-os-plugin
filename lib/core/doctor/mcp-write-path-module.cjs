'use strict';
/*
 * lib/core/doctor/mcp-write-path-module.cjs -- quick 261026-s8c item 4 (S8C-04).
 *
 * A cadence:always, fix_supported:false, flag:null doctor module. Same
 * contract as lib/core/doctor/mcp-surface-module.cjs: check(ctx) is
 * SYNCHRONOUS and returns { status, detail }. The doctor engine stores the
 * return value directly, so a Promise would be stored as a pending Promise.
 * This module therefore uses spawnSync end to end. It never throws.
 *
 * WHAT IT DOES. It spawns the real scripts/mindrian-mcp-server.cjs over
 * stdio, with a temp HOME, a temp room and a temp rooms home. It does NOT set
 * MINDRIAN_TRANSPORT or CLAUDE_SURFACE: the server detects its surface from
 * the caller's own environment, as it does in a real session. It sends
 * initialize, notifications/initialized and tools/call status_read, then
 * reads segments.capability_floor (surface, host_tier.host, write_path_enabled).
 * These are the same fields status_read reports to a client.
 *
 * WHY THE PROBE CLIENT IS UNRECOGNIZED. The probe sends the client name
 * PROBE_CLIENT_NAME. The server does not know that name on purpose. The probe
 * models the floor state: an unidentified client, which only the
 * MINDRIAN_MCP_FIRST flag can enable. A client the server does recognize by
 * name gets writes without the flag. So write path OFF here means "an
 * unidentified client is refused", and the fix text tells the owner which flag
 * value turns writes on for the detected surface.
 *
 * STATUS MAP (owner decision D-02: warn, never error):
 *   write_path_enabled true  -> ok, names surface and host.
 *   write_path_enabled false -> warn, with the shared writePathOffHint text.
 *   no answer, timeout, crash, bad JSON, missing capability_floor
 *                            -> warn "could not measure" with the reason.
 *                               Never a silent ok.
 *
 * SAFETY. The probe sends only a read (status_read). It writes nothing outside
 * its own mkdtemp directory, which it removes in a finally. A timeout bounds
 * the spawn. Node built-ins only plus the shared hint helper: no Brain client,
 * no network call (Canon Part 8).
 *
 * The spawn setup (about 30 lines) is a deliberate copy of the pattern in
 * mcp-surface-module.cjs. That module's helper is fixed to tools/list and is
 * covered by its own 4-arm test, so it is left untouched.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const { writePathOffHint } = require('../../mcp/mcp-first-flag.cjs');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const MINDRIAN_OS_SERVER = path.join(REPO_ROOT, 'scripts', 'mindrian-mcp-server.cjs');

const DEFAULT_TIMEOUT_MS = 15000;
const PROBE_CLIENT_NAME = 'mcp-write-path-doctor-organ';

function buildTransaction() {
  return (
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: PROBE_CLIENT_NAME, version: '1.0.0' },
      },
    }) + '\n' +
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n' +
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'status_read', arguments: {} } }) + '\n'
  );
}

function cannotMeasure(reason) {
  return { status: 'warn', detail: 'mcp-write-path: could not measure the write path (' + reason + ')' };
}

/**
 * Measure the write path against one server script. Never throws.
 *
 * @param {string} serverPath absolute path to the server entry point
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {object} [opts.envOverrides] extra env merged over the hermetic base; a null value deletes the key
 * @returns {{status: 'ok'|'warn', detail: string}}
 */
function checkAgainstServer(serverPath, opts) {
  const o = opts || {};
  const timeoutMs = typeof o.timeoutMs === 'number' ? o.timeoutMs : DEFAULT_TIMEOUT_MS;

  let root;
  try {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-write-path-'));
  } catch (e) {
    return cannotMeasure('temp directory setup failed: ' + (e && e.message));
  }

  try {
    const home = path.join(root, 'home');
    const room = path.join(root, 'room');
    const rooms = path.join(root, 'rooms');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(room, { recursive: true });
    fs.mkdirSync(rooms, { recursive: true });

    const env = Object.assign({}, process.env, {
      HOME: home,
      MINDRIAN_ROOM: room,
      MINDRIAN_ROOMS_HOME: rooms,
      CLAUDE_ACTIVE_ROOM: room,
    });
    delete env.MINDRIAN_BRAIN_KEY;
    const over = o.envOverrides || {};
    Object.keys(over).forEach((k) => {
      if (over[k] === null || over[k] === undefined) delete env[k];
      else env[k] = over[k];
    });

    let result;
    try {
      result = cp.spawnSync('node', [serverPath], {
        cwd: REPO_ROOT,
        env: env,
        input: buildTransaction(),
        timeout: timeoutMs,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (e) {
      return cannotMeasure('spawn threw: ' + (e && e.message));
    }

    const timedOut = (result.signal !== null && result.signal !== undefined) ||
      (result.error && result.error.code === 'ETIMEDOUT');

    let response = null;
    const stdout = typeof result.stdout === 'string' ? result.stdout : '';
    const lines = stdout.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch (_e) { continue; }
      if (obj && obj.id === 2) { response = obj; break; }
    }

    if (!response) {
      if (timedOut) return cannotMeasure('timeout after ' + timeoutMs + ' ms, no status_read answer');
      if (result.error) return cannotMeasure('spawn error: ' + result.error.message);
      return cannotMeasure('server exited with code ' + result.status + ' before it answered status_read');
    }
    if (response.error) {
      return cannotMeasure('status_read returned an error: ' + JSON.stringify(response.error).slice(0, 200));
    }

    let floor = null;
    try {
      const text = response.result.content[0].text;
      const payload = JSON.parse(text);
      floor = payload && payload.segments && payload.segments.capability_floor;
    } catch (_e) {
      return cannotMeasure('status_read answer was not readable JSON');
    }
    if (!floor || typeof floor !== 'object' || typeof floor.write_path_enabled !== 'boolean') {
      return cannotMeasure('status_read answer has no capability_floor.write_path_enabled');
    }

    const surface = typeof floor.surface === 'string' ? floor.surface : null;
    const host = (floor.host_tier && typeof floor.host_tier.host === 'string') ? floor.host_tier.host : 'unknown';

    if (floor.write_path_enabled === true) {
      return {
        status: 'ok',
        detail: 'mcp-write-path: write path ON for an unidentified client (surface=' + surface + ', host=' + host + ')',
      };
    }
    return {
      status: 'warn',
      detail: 'mcp-write-path: write path OFF. ' + writePathOffHint({ surface: surface, host: host }) +
        ' The doctor probe client "' + PROBE_CLIENT_NAME + '" is unrecognized by design: it models an unidentified client, ' +
        'and a recognized client gets writes without the flag.',
    };
  } catch (e) {
    return cannotMeasure('unexpected failure: ' + (e && e.message));
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

/**
 * Production entry point: the doctor registry's declared runner.
 */
function check(ctx) {
  const c = ctx || {};
  return checkAgainstServer(MINDRIAN_OS_SERVER, {
    timeoutMs: typeof c.timeoutMs === 'number' ? c.timeoutMs : DEFAULT_TIMEOUT_MS,
  });
}

module.exports = { check, checkAgainstServer, PROBE_CLIENT_NAME };
