// Spike 005: can a UI reach the MindrianOS MCP server over Streamable HTTP and approve a gate?
// Throwaway room copy only. Writes results.json (forensic log).
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '../../..');
const { Client } = require(path.join(REPO, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/client/index.js'));
const { StreamableHTTPClientTransport } = require(path.join(REPO, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/client/streamableHttp.js'));

const SRC_ROOM = path.join(os.homedir(), 'MindrianRooms', 'egain-des-liquid-conductor');
const SLUG = 'egain-des-liquid-conductor';
const log = [];
const ev = (label, data) => { const e = { ts: new Date().toISOString(), label, ...data }; log.push(e); console.log(label, JSON.stringify(data).slice(0, 300)); };

function freshHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spike005-'));
  execFileSync('cp', ['-r', SRC_ROOM, path.join(home, SLUG)]);
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  return home;
}

function startServer(home, extraEnv) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_TRANSPORT: 'http', MINDRIAN_ROOMS_HOME: home, MINDRIAN_ROOM: path.join(home, SLUG),
    MINDRIAN_OS_ROOT: REPO, CLAUDE_PLUGIN_ROOT: REPO,
  }, extraEnv || {});
  delete env.MINDRIAN_MCP_FIRST;
  if (extraEnv && extraEnv.MINDRIAN_MCP_FIRST) env.MINDRIAN_MCP_FIRST = extraEnv.MINDRIAN_MCP_FIRST;
  const p = spawn(process.execPath, [path.join(REPO, 'bin/mindrian-mcp-server.cjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  return { p, getOut: () => out };
}

async function waitPort(url, ms) {
  const net = require('net');
  const u = new URL(url);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const ok = await new Promise((res) => { const sk = net.connect(Number(u.port), u.hostname); sk.once('connect', () => { sk.destroy(); res(true); }); sk.once('error', () => res(false)); });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function text(res) { try { return (res.content || []).map((c) => c.text || '').join('\n'); } catch (_) { return ''; } }
function json(res) { const t = text(res); try { return JSON.parse(t); } catch (_) { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch (__) { return null; } } }

async function connect(url) {
  const c = new Client({ name: 'spike005', version: '0.0.1' });
  const t = new StreamableHTTPClientTransport(new URL(url));
  const t0 = Date.now();
  await c.connect(t);
  return { c, t, ms: Date.now() - t0 };
}

async function call(c, name, args, label) {
  const t0 = Date.now();
  try {
    const r = await c.callTool({ name, arguments: args || {} });
    const j = json(r);
    ev(label || name, { ok: !r.isError, ms: Date.now() - t0, sid: null, body: j || text(r).slice(0, 400) });
    return j;
  } catch (e) {
    ev(label || name, { ok: false, ms: Date.now() - t0, error: String(e.message || e).slice(0, 300) });
    return null;
  }
}

async function arm(name, extraEnv) {
  ev('arm_start', { arm: name });
  const home = freshHome();
  const srv = startServer(home, extraEnv);
  const base = 'http://127.0.0.1:3847';
  const up = await waitPort(base + '/mcp', 15000);
  ev('server_up', { arm: name, up });
  if (!up) { ev('server_out', { out: srv.getOut().slice(-1500) }); srv.p.kill(); return; }
  try {
    const a = await connect(base + '/mcp');
    ev('connect_A', { ms: a.ms, sessionId: a.t.sessionId || null });
    const tools = await a.c.listTools();
    ev('tools', { count: tools.tools.length, has: ['room_state', 'graph_query', 'gate_render', 'gate_answer', 'room_bind'].filter((n) => tools.tools.some((t) => t.name === n)) });
    await call(a.c, 'room_bind', { room: SLUG }, 'A.room_bind');
    await call(a.c, 'room_state', { command: 'status' }, 'A.room_state');
    await call(a.c, 'graph_query', { top_k: 5 }, 'A.graph_query');
    const g1 = await call(a.c, 'gate_render', { header: 'spike005 test gate', options: [{ id: 'yes', label: 'Approve', rank: 1 }, { id: 'no', label: 'Not now', rank: 2 }] }, 'A.gate_render');
    const gid1 = g1 && (g1.gate_id || (g1.gate && g1.gate.gate_id));
    ev('gate_minted', { gid1 });
    if (gid1) await call(a.c, 'gate_answer', { gate_id: gid1, chosen: ['yes'], verdict: 'approve' }, 'A.gate_answer_same_connection');
    // Cross-connection: mint in A, answer in B (a second browser tab / second user).
    const g2 = await call(a.c, 'gate_render', { header: 'spike005 cross gate', options: [{ id: 'yes', label: 'Approve', rank: 1 }] }, 'A.gate_render_2');
    const gid2 = g2 && (g2.gate_id || (g2.gate && g2.gate.gate_id));
    const b = await connect(base + '/mcp');
    ev('connect_B', { ms: b.ms, sessionId: b.t.sessionId || null });
    if (gid2) await call(b.c, 'gate_answer', { gate_id: gid2, chosen: ['yes'], verdict: 'approve' }, 'B.gate_answer_cross_connection');
    // Latency sample: 10 room_state calls.
    const lat = [];
    for (let i = 0; i < 10; i++) { const t0 = Date.now(); try { await a.c.callTool({ name: 'room_state', arguments: { command: 'status' } }); } catch (_) {} lat.push(Date.now() - t0); }
    lat.sort((x, y) => x - y);
    ev('latency_room_state', { p50: lat[4], p90: lat[8], max: lat[9] });
    // Did the approval land in the throwaway room's graph (and not the real one)?
    const dbs = execFileSync('bash', ['-c', `ls ${path.join(home, SLUG)}/.room-graph/ 2>/dev/null; ls ${path.join(home, SLUG)}/.mindrian 2>/dev/null | head -5`]).toString();
    ev('throwaway_room_files', { dbs: dbs.trim().split('\n').slice(0, 8) });
    await a.c.close(); await b.c.close();
  } catch (e) {
    ev('arm_error', { arm: name, error: String(e.stack || e).slice(0, 500) });
  } finally {
    srv.p.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 800));
    try { srv.p.kill('SIGKILL'); } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
    ev('server_tail', { arm: name, out: srv.getOut().slice(-600) });
  }
}

(async () => {
  const realBefore = fs.statSync(path.join(SRC_ROOM)).mtimeMs;
  await arm('stateless (default Cowork HTTP)', {});
  await arm('per-connection sessions (MINDRIAN_MCP_FIRST=cowork)', { MINDRIAN_MCP_FIRST: 'cowork' });
  const realAfter = fs.statSync(path.join(SRC_ROOM)).mtimeMs;
  ev('real_room_untouched', { same_mtime: realBefore === realAfter });
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(log, null, 1));
})();
