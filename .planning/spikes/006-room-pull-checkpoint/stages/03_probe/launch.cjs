// Spike 006, stage 03: start the throwaway stack (temp room copy, MCP HTTP server in
// per-connection mode, the stage-01 pull server). Shared by run.cjs (the probe) and
// demo.cjs (the navigator's live page), and by spike 007.
// Safety: copies the real room to a mkdtemp dir and never opens the real one; kills
// only processes it spawned AND whose /proc/<pid>/environ names its own temp dir.
// No em-dashes.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '../../../../..');
const SLUG = 'egain-des-liquid-conductor';
const SRC_ROOM = path.join(os.homedir(), 'MindrianRooms', SLUG);

function portFree(port) {
  return new Promise((res) => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => { s.destroy(); res(false); });
    s.once('error', () => res(true));
  });
}
async function waitPort(port, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (!(await portFree(port))) return true; await new Promise((r) => setTimeout(r, 100)); }
  return false;
}

function realRoomStamp() {
  // Stat only: never opens the real room.db.
  const out = {};
  for (const rel of ['', '.mindrian', '.mindrian/room.db', '.mindrian/room.db-wal']) {
    const p = path.join(SRC_ROOM, rel);
    try { out[rel || '.'] = fs.statSync(p).mtimeMs; } catch (_) { out[rel || '.'] = null; }
  }
  return out;
}

// Stat-only walk of the real room (never opens a file), for per-phase forensics.
function realRoomWalk() {
  const out = {};
  (function walk(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const n of ents) {
      const p = path.join(d, n.name);
      try { out[p.slice(SRC_ROOM.length) || '.'] = fs.statSync(p).mtimeMs; } catch (_) {}
      if (n.isDirectory()) walk(p);
    }
  })(SRC_ROOM);
  return out;
}
function walkDiff(a, b) { return Object.keys(Object.assign({}, a, b)).filter((k) => a[k] !== b[k]); }

function makeHome(prefix) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'spike006-'));
  execFileSync('cp', ['-r', SRC_ROOM, path.join(home, SLUG)]);
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  return home;
}

function envMentions(pid, needle) {
  try { return fs.readFileSync('/proc/' + pid + '/environ', 'utf8').includes(needle); } catch (_) { return false; }
}
function safeKill(proc, home) {
  if (!proc || proc.exitCode !== null || proc.killed && proc.signalCode) return 'already_exited';
  if (!envMentions(proc.pid, home)) return 'refused_env_mismatch';
  try { process.kill(proc.pid, 'SIGKILL'); return 'killed'; } catch (e) { return 'kill_error:' + e.code; }
}

function startMcp(home) {
  const roomDir = path.join(home, SLUG);
  const env = Object.assign({}, process.env, {
    MINDRIAN_TRANSPORT: 'http', MINDRIAN_MCP_FIRST: 'cowork',
    MINDRIAN_ROOMS_HOME: home, MINDRIAN_ROOM: roomDir,
    MINDRIAN_OS_ROOT: PLUGIN_ROOT, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    SPIKE_HOME: home,
  });
  const p = spawn(process.execPath, [path.join(PLUGIN_ROOT, 'bin/mindrian-mcp-server.cjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  return { p, out: () => out };
}

function startPull(home, port, logFile) {
  const env = Object.assign({}, process.env, {
    ROOM_DIR: path.join(home, SLUG), PULL_PORT: String(port), PLUGIN_ROOT,
    PULL_LOG: logFile || '', SPIKE_HOME: home,
  });
  const p = spawn(process.execPath, ['--no-warnings', path.resolve(__dirname, '../01_pull-server/server.cjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  return { p, out: () => out };
}

async function startStack(opts) {
  const o = opts || {};
  const pullPort = o.pullPort || 3871;
  if (!(await portFree(3847))) throw new Error('port 3847 is busy: another MCP server is running; refusing to guess which room it serves');
  if (!(await portFree(pullPort))) throw new Error('pull port ' + pullPort + ' is busy');
  const before = realRoomStamp();
  const home = makeHome(o.prefix);
  const roomDir = path.join(home, SLUG);
  const mcp = startMcp(home);
  // The flag-ON server discovers its port from 3847 upward and records it in
  // <home>/.rooms/daemon/mcp-daemon.json; read that rather than assume.
  const pidfile = path.join(home, '.rooms', 'daemon', 'mcp-daemon.json');
  let mcpPort = null;
  const end = Date.now() + 20000;
  while (Date.now() < end && !mcpPort) {
    try { const j = JSON.parse(fs.readFileSync(pidfile, 'utf8')); if (j.pid === mcp.p.pid) mcpPort = j.port; } catch (_) {}
    if (!mcpPort) await new Promise((r) => setTimeout(r, 150));
  }
  if (!mcpPort || !(await waitPort(mcpPort, 5000))) throw new Error('MCP server did not come up: ' + mcp.out().slice(-800));
  // Confirm the server we reached is bound to OUR temp room (lesson from 005).
  const boundLine = (mcp.out().match(/room: ([^\n)]+)/) || [])[1] || '';
  const logFile = o.pullLog || null;
  let pull = startPull(home, pullPort, logFile);
  if (!(await waitPort(pullPort, 10000))) throw new Error('pull server did not come up: ' + pull.out());
  const stack = {
    home, roomDir, mcpPort, pullPort, before, boundLine,
    mcpUrl: 'http://127.0.0.1:' + mcpPort + '/mcp',
    pullUrl: 'http://127.0.0.1:' + pullPort,
    mcp, get pull() { return pull; },
    async restartPull(gapMs) {
      const r = safeKill(pull.p, home);
      await new Promise((res) => setTimeout(res, gapMs || 0));
      return r;
    },
    async startPullAgain() {
      pull = startPull(home, pullPort, logFile);
      await waitPort(pullPort, 10000);
    },
    killPullOnly() { return safeKill(pull.p, home); },
    async stop() {
      const res = { pull: safeKill(pull.p, home), mcp: safeKill(mcp.p, home) };
      await new Promise((r) => setTimeout(r, 300));
      res.after = realRoomStamp();
      res.real_room_untouched = JSON.stringify(res.after) === JSON.stringify(before);
      return res;
    },
  };
  return stack;
}

// MCP SDK client from the plugin's own node_modules (same as spike 005).
function sdk() {
  const { Client } = require(path.join(PLUGIN_ROOT, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/client/index.js'));
  const { StreamableHTTPClientTransport } = require(path.join(PLUGIN_ROOT, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/client/streamableHttp.js'));
  return { Client, StreamableHTTPClientTransport };
}
async function mcpConnect(url, name) {
  const { Client, StreamableHTTPClientTransport } = sdk();
  const c = new Client({ name: name || 'spike006', version: '0.0.1' });
  const t = new StreamableHTTPClientTransport(new URL(url));
  await c.connect(t);
  return { c, t };
}
function toolJson(res) {
  const t = (res.content || []).map((x) => x.text || '').join('\n');
  try { return JSON.parse(t); } catch (_) { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : { _text: t.slice(0, 400) }; } catch (__) { return { _text: t.slice(0, 400) }; } }
}

module.exports = { realRoomWalk, walkDiff, startStack, mcpConnect, toolJson, safeKill, realRoomStamp, PLUGIN_ROOT, SLUG, SRC_ROOM, portFree };
