'use strict';
/*
 * tests/helpers/cli-gate-369.cjs -- Phase 369 plan 33: a Claude Code shaped stdio
 * MCP client bound to a fixture room.
 *
 * Why it exists. Claude Code runs the MindrianOS server as its OWN stdio process
 * (.mcp.json starts it directly), so a gate Larry raises with gate_render lives in
 * that process's in-memory ledger, a different process from the flag-ON daemon the
 * shell talks to. This helper spawns that stdio process the way Claude Code does,
 * so a test can raise a gate there and then look at it from the daemon.
 *
 * Exports:
 *   cliClient({ roomsHome, home, sessionId, extraEnv })
 *       resolves { call(tool, args), bind(room), close(), pid, sessionId, getStderr }
 *         call(tool, args) -> the tool's JSON payload (the text before the first
 *           "\n\n## " suffix, parsed the way tests/e2e-369/journey.cjs does); a tool
 *           error or an unparseable body comes back as { __error: '<detail>' }
 *           rather than a throw, so a RED test fails on its own assertion line
 *         bind(room)  binds the session to a room (see BINDING ROUTE below)
 *         close()     closes the client and SIGKILLs only the child this helper spawned
 *
 * BINDING ROUTE (the probe result, written here as the plan asks): room_bind on
 * stdio is effective for writes. With CLAUDE_CODE_SESSION_ID set, resolveEffectiveSessionId
 * returns that id (it wins over the stdio process key), room_bind falls back to it
 * (tool-router.cjs, RCA registry-active-room-concurrent-session-collision) and writes
 * <roomsHome>/.rooms/sessions/<sessionId>.json, so session.primary is the room and
 * gate_render / gate_answer treat it as write authority. The helper therefore calls the
 * room_bind TOOL; it never writes the binding file itself. (The probe is the first arm
 * of tests/test-369-gate-raised.cjs: a bind that did not take shows up as a failed
 * assertion on the bind result.)
 *
 * Spawn shape: node plus scripts/mindrian-mcp-server.cjs when that file exists (Phase
 * 369.1 moved the entry point there and left a forwarding shim in bin/), else
 * bin/mindrian-mcp-server.cjs. Read only, never edited here. Env: HOME and USERPROFILE
 * set to the hermetic home, MINDRIAN_ROOMS_HOME, CLAUDE_CODE_SESSION_ID, MINDRIAN_TEST_MODE=1,
 * MINDRIAN_BRAIN_URL=http://127.0.0.1:9 (never a real Brain, Canon Part 8), the Brain key
 * dropped, and no MINDRIAN_MCP_FIRST, no MINDRIAN_TRANSPORT (stdio is the default), no
 * MINDRIAN_MCP_DAEMON. CLAUDE_SURFACE=cli, the surface Claude Code reports.
 *
 * Client mode: legacy negotiation (the 369-SESSION-CONTRACT client mode), with
 * @modelcontextprotocol/client's StdioClientTransport.
 *
 * Hyphens only; no em-dashes. CJS.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS_SERVER = path.join(REPO_ROOT, 'scripts', 'mindrian-mcp-server.cjs');
const BIN_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const SERVER = fs.existsSync(SCRIPTS_SERVER) ? SCRIPTS_SERVER : BIN_SERVER;

function parseToolBody(result) {
  const text = (result && Array.isArray(result.content) ? result.content : [])
    .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
    .join('')
    .split('\n\n## ')[0];
  try {
    return JSON.parse(text);
  } catch (_e) {
    return { __error: 'unparseable tool body: ' + String(text).slice(0, 200) };
  }
}

async function cliClient(opts) {
  const o = opts || {};
  if (typeof o.roomsHome !== 'string' || typeof o.home !== 'string' || typeof o.sessionId !== 'string') {
    throw new Error('cliClient: roomsHome, home and sessionId are required');
  }
  const { Client } = require('@modelcontextprotocol/client');
  const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

  const env = Object.assign({}, process.env);
  for (const k of Object.keys(env)) {
    if (k.indexOf('MINDRIAN_') === 0 || k === 'CLAUDE_ACTIVE_ROOM' || k === 'CLAUDE_CODE_SESSION_ID') delete env[k];
  }
  env.HOME = o.home;
  env.USERPROFILE = o.home;
  env.MINDRIAN_ROOMS_HOME = o.roomsHome;
  env.CLAUDE_CODE_SESSION_ID = o.sessionId;
  env.CLAUDE_SURFACE = 'cli';
  env.MINDRIAN_TEST_MODE = '1';
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  Object.assign(env, o.extraEnv || {});

  const transport = new StdioClientTransport({ command: 'node', args: [SERVER], env: env, cwd: REPO_ROOT, stderr: 'pipe' });
  let stderr = '';
  const client = new Client(
    { name: 'cli-gate-369', version: '1.0.0' },
    { capabilities: {}, versionNegotiation: { mode: 'legacy' } }
  );
  const origStart = transport.start.bind(transport);
  let childPid = null;
  transport.start = async function () {
    const r = await origStart();
    if (typeof transport.pid === 'number') childPid = transport.pid;
    try {
      if (transport.stderr && typeof transport.stderr.on === 'function') {
        transport.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
      }
    } catch (_e) { /* stderr capture is best effort */ }
    return r;
  };

  function killChild() {
    const pid = typeof transport.pid === 'number' ? transport.pid : childPid;
    if (typeof pid !== 'number') return;
    try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* already gone */ }
  }

  try {
    await client.connect(transport);
  } catch (err) {
    killChild();
    throw err;
  }
  if (typeof transport.pid === 'number') childPid = transport.pid;

  async function call(tool, args) {
    try {
      const res = await client.callTool({ name: tool, arguments: args || {} });
      const body = parseToolBody(res);
      if (res && res.isError === true && body && body.ok === undefined && !body.__error) body.__error = 'isError';
      return body;
    } catch (e) {
      return { __error: String((e && e.message) || e).slice(0, 300) };
    }
  }

  async function bind(room) {
    const out = await call('room_bind', { room: room });
    if (!out || out.ok !== true) throw new Error('cliClient.bind(' + room + ') did not take: ' + JSON.stringify(out));
    return out;
  }

  async function close() {
    try { await client.close(); } catch (_e) { /* best effort */ }
    killChild();
  }

  return {
    call: call,
    bind: bind,
    close: close,
    sessionId: o.sessionId,
    get pid() { return typeof transport.pid === 'number' ? transport.pid : childPid; },
    getStderr: () => stderr,
  };
}

module.exports = { cliClient, SERVER };
