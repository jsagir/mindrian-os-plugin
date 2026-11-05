#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 06: the MCP probe. It measures the MCP server start (S7), the file watcher (S10), the event-loop
 * blocking of tool calls (S8) and the room database opens per tool call (the per-tool part of S3). It reuses the
 * library surface of tools/perf/perf-harness.cjs (prepareRoom, makeCtx, machineRecord, writeResult, statsSummary,
 * gateBeforeTarget, runCommandOnce, restoreCopy, resolveSource), the probe preload and the exec counter of this folder.
 *
 * Subcommands (every one needs --tree <dir> --out <file> and runs under the 384 lock):
 *   start    spawn to the initialize reply and to the tools/list reply, n runs, for --server os|brain|both, with the
 *            floor:node target beside them; a count run (untimed, probe preload) adds tools, eureka tools, modules.
 *            With --exec-check: one count-only run per repeat with the exec counter, a block list of npm and npx and
 *            a stub npm and npx first on PATH (schema mos.perf-384-counts/1). No real npm or npx runs.
 *            With --tree-b <dir> [--label-b name] (os server only): the same measure on two plugin trees, interleaved
 *            A B, B A, A B, with a derived per-pair difference.
 *   profile  CPU profile through initialize and tools/list, n runs; milliseconds and shares by group
 *   idle     watches (inotify), idle RSS and idle CPU of 1 or more MCP processes over rooms homes of R rooms, with a
 *            bare node control (--rooms 1,10,58 --procs 1,3 --window-ms 10000)
 *   block    the time that a tool call blocks the event loop: a ping is sent --ping-delay-ms after the call
 *   opens    room database opens (and sqlite exec and prepare counts, modules added, lib reads) per tool call, by tool name
 *
 * Timing results use the schema mos.perf-384/1 (target ids start with mcp:). Count-only results use
 * mos.perf-384-counts/1. Canon Part 8: numbers, ids, tool names and labels only. No path, no argument value,
 * no room name, no room text. Every server runs with a sandbox HOME, a sandbox rooms home and the unreachable
 * loopback as Brain URL (the harness makeCtx env). Test-only flags (need MOS_PERF_SELFTEST=1): --skip-gates,
 * --allow-short. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));
const CENSUS = require(path.join(__dirname, 'process-census.cjs'));
const PROBE = path.join(__dirname, 'probe-preload.cjs');
const MIN_RUNS = 7;
const SERVER_SCRIPTS = { os: 'mindrian-mcp-server.cjs', brain: 'mindrian-brain-mcp-client.cjs' };
const IGNORED_RE = /(^|[/\\])(\.|node_modules)/; // the ignore rule of lib/mcp/tree-watcher.cjs

function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }
function round1(x) { return x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10; }
function median(a) { return H.statsSummary(a).median; }
function rotated(list, round) { const k = round % list.length; return list.slice(k).concat(list.slice(0, k)); }
function log(msg) { process.stderr.write('[mcp-probe] ' + msg + '\n'); }

// ---------------------------------------------------------------------------
// /proc readers
// ---------------------------------------------------------------------------
let tickCache = null;
function tickMs() {
  if (tickCache === null) {
    const r = cp.spawnSync('getconf', ['CLK_TCK'], { encoding: 'utf8' });
    tickCache = r.status === 0 && Number(r.stdout) > 0 ? 1000 / Number(r.stdout) : 10;
  }
  return tickCache;
}

// CPU (user plus system, milliseconds since spawn), VmRSS and VmHWM (MB) of one live process.
function readProc(pid) {
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    const parts = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const cpuMs = (Number(parts[11]) + Number(parts[12])) * tickMs();
    const status = fs.readFileSync('/proc/' + pid + '/status', 'utf8');
    const rss = status.match(/VmRSS:\s+([0-9]+) kB/);
    const hwm = status.match(/VmHWM:\s+([0-9]+) kB/);
    if (!Number.isFinite(cpuMs) || !rss || !hwm) return null;
    return { cpu_ms: cpuMs, rss_mb: Number(rss[1]) / 1024, hwm_mb: Number(hwm[1]) / 1024 };
  } catch (_e) { return null; }
}

// M3: the number of inotify watches of one process: the lines `inotify wd:` of the inotify descriptors.
function inotifyWatches(pid) {
  let n = 0;
  let fds = [];
  try { fds = fs.readdirSync('/proc/' + pid + '/fdinfo'); } catch (_e) { return 0; }
  for (const fd of fds) {
    let text = '';
    try { text = fs.readFileSync('/proc/' + pid + '/fdinfo/' + fd, 'utf8'); } catch (_e) { continue; }
    for (const line of text.split('\n')) if (line.startsWith('inotify wd:')) n += 1;
  }
  return n;
}

// M4: idle RSS (VmRSS at the end of the window, MB) and the CPU used in the window (milliseconds).
async function idleCost(pid, windowMs) {
  const a = readProc(pid);
  await sleepMs(windowMs);
  const b = readProc(pid);
  if (!a || !b) return null;
  return { rss_mb: round1(b.rss_mb), cpu_ms: round1(b.cpu_ms - a.cpu_ms), window_ms: windowMs };
}

// the pids (other than this process) whose environment holds the run marker
function markedPids(runId) {
  const out = [];
  const needle = 'MOS_PERF_RUN_ID=' + runId;
  let names = [];
  try { names = fs.readdirSync('/proc').filter((n) => /^[0-9]+$/.test(n)); } catch (_e) { return out; }
  for (const n of names) {
    if (Number(n) === process.pid) continue;
    try {
      const env = fs.readFileSync('/proc/' + n + '/environ', 'utf8');
      if (env.split('\0').indexOf(needle) !== -1) out.push(Number(n));
    } catch (_e) { /* gone or not readable */ }
  }
  return out;
}

let runSeq = 0;
function newRunId() { runSeq += 1; return 'mos384m-' + process.pid + '-' + Date.now().toString(36) + '-' + runSeq; }

// ---------------------------------------------------------------------------
// M1: a line-framed JSON-RPC stdio client
// ---------------------------------------------------------------------------
// o: { script, args?, nodeArgs?, cwd, env, cpus?, hasTaskset? }
function spawnServer(o) {
  const argv = [process.execPath].concat(o.nodeArgs || [], [o.script], o.args || []);
  const capped = o.hasTaskset && o.cpus && o.cpus !== 'all';
  const full = capped ? ['taskset', '-c', '0-' + (o.cpus - 1)].concat(argv) : argv;
  const t0 = process.hrtime.bigint();
  const child = cp.spawn(full[0], full.slice(1), { cwd: o.cwd, env: o.env, detached: true, stdio: ['pipe', 'pipe', 'ignore'] });
  const pending = new Map();
  let nextId = 1;
  let buf = '';
  let exitInfo = null;
  child.on('error', () => { /* a spawn failure shows as an exit */ });
  child.stdin.on('error', () => {});
  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      exitInfo = { code, signal: signal || null };
      for (const [, fn] of pending) fn(null, process.hrtime.bigint());
      pending.clear();
      resolve(exitInfo);
    });
  });
  child.stdout.on('data', (d) => {
    const at = process.hrtime.bigint();
    buf += String(d);
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const t = line.trim();
      if (!t || t[0] !== '{') continue;
      let msg;
      try { msg = JSON.parse(t); } catch (_e) { continue; }
      if (msg && msg.id !== undefined && msg.method === undefined && pending.has(msg.id)) {
        const fn = pending.get(msg.id);
        pending.delete(msg.id);
        fn(msg, at);
      }
    }
  });
  const write = (obj) => { try { child.stdin.write(JSON.stringify(obj) + '\n'); } catch (_e) { /* closed */ } };
  const srv = {
    child, pid: child.pid, exited,
    exit: () => exitInfo,
    notify(method, params) { write({ jsonrpc: '2.0', method, params: params || {} }); },
    // resolves { msg, rtt_ms (send to reply), since_spawn_ms }; rejects on a timeout or an exit
    request(method, params, timeoutMs) {
      return new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        const sent = process.hrtime.bigint();
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout:' + method)); }, timeoutMs || 60000);
        pending.set(id, (msg, at) => {
          clearTimeout(timer);
          if (!msg) { reject(new Error('exited:' + method)); return; }
          resolve({ msg, rtt_ms: Number(at - sent) / 1e6, since_spawn_ms: Number(at - t0) / 1e6 });
        });
        write({ jsonrpc: '2.0', id, method, params: params || {} });
      });
    },
    signal(sig) { try { process.kill(-child.pid, sig); } catch (_e) { /* gone */ } },
    // SIGKILL (or another signal) to the group, then wait for the exit
    async stop(sig, waitMs) {
      srv.signal(sig || 'SIGKILL');
      const timer = new Promise((r) => setTimeout(() => r(null), waitMs || 5000));
      const e = await Promise.race([exited, timer]);
      if (e === null) { srv.signal('SIGKILL'); await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))]); }
      return srv.exit();
    },
  };
  return srv;
}

const INIT_PARAMS = { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'perf-384', version: '1' } };

// initialize, the notification initialized, tools/list. onReply(stage, srv) runs right after each reply (for /proc samples).
async function handshake(srv, opts) {
  const o = opts || {};
  const init = await srv.request('initialize', INIT_PARAMS, o.timeoutMs || 60000);
  const afterInit = o.onReply ? o.onReply('initialize', srv) : null;
  srv.notify('notifications/initialized');
  const list = await srv.request('tools/list', {}, o.timeoutMs || 60000);
  const afterList = o.onReply ? o.onReply('tools/list', srv) : null;
  const tools = (list.msg.result && Array.isArray(list.msg.result.tools)) ? list.msg.result.tools.map((t) => String(t.name)) : [];
  return { init_ms: init.since_spawn_ms, list_ms: list.since_spawn_ms, tools, afterInit, afterList, initOk: !!(init.msg && init.msg.result) };
}

function toolCounts(names) {
  return { tools: names.length, eureka_tools: names.filter((n) => n.startsWith('eureka')).length };
}

// ---------------------------------------------------------------------------
// M2: blocking ping
// ---------------------------------------------------------------------------
function isErrorReply(msg) {
  return !!(msg && (msg.error || (msg.result && msg.result.isError === true)));
}

// The tool call is sent, then the standard MCP request ping pingDelayMs later. A tool that blocks the loop delays the ping reply.
async function blockProbe(srv, o) {
  const callP = srv.request('tools/call', { name: o.tool, arguments: o.args || {} }, o.timeoutMs || 120000);
  await sleepMs(o.pingDelayMs === undefined ? 20 : o.pingDelayMs);
  const pingP = srv.request('ping', {}, o.timeoutMs || 120000);
  const [ping, call] = await Promise.all([pingP, callP]);
  return { ping_ms: ping.rtt_ms, tool_ms: call.rtt_ms, tool_error: isErrorReply(call.msg) };
}

// the idle baseline: the median of k consecutive pings of an idle server
async function idlePing(srv, k) {
  const v = [];
  for (let i = 0; i < (k || 5); i += 1) v.push((await srv.request('ping', {}, 30000)).rtt_ms);
  return median(v);
}

// ---------------------------------------------------------------------------
// M5: CPU profile summary
// ---------------------------------------------------------------------------
const GROUPS = ['tools', 'eureka-tools', 'other-mcp', 'core', 'sdk-client', 'sdk-other', 'zod', 'chokidar', 'node-builtins', 'other', 'runtime'];

function pkgOf(afterNm) {
  const seg = afterNm.split('/');
  return seg[0].startsWith('@') ? seg.slice(0, 2).join('/') : seg[0];
}

// groupOf(frame, roots): { group, label }. label is a plugin-relative file, a package name or a node: name. roots are the
// plugin root and its real path. No absolute path leaves this function.
function groupOf(frame, roots) {
  const fn = frame.functionName || '';
  const url = frame.url || '';
  if (fn === '(idle)') return { group: 'idle', label: '(idle)' };
  if (fn === '(program)' || fn === '(garbage collector)' || fn === '(root)') return { group: 'runtime', label: fn };
  if (!url) return { group: 'node-builtins', label: '(native)' };
  if (url.startsWith('node:') || !url.includes('/')) return { group: 'node-builtins', label: url };
  let file = url;
  if (url.startsWith('file://')) { try { file = decodeURIComponent(new URL(url).pathname); } catch (_e) { file = url; } }
  const nm = file.lastIndexOf('/node_modules/');
  if (nm !== -1) {
    const rest = file.slice(nm + '/node_modules/'.length);
    const pkg = pkgOf(rest);
    if (pkg.startsWith('@modelcontextprotocol/')) {
      const isClient = pkg === '@modelcontextprotocol/client' || (pkg === '@modelcontextprotocol/sdk' && rest.indexOf('/client/') !== -1);
      return { group: isClient ? 'sdk-client' : 'sdk-other', label: pkg };
    }
    if (pkg === 'zod') return { group: 'zod', label: pkg };
    if (pkg === 'chokidar') return { group: 'chokidar', label: pkg };
    return { group: 'other', label: pkg };
  }
  for (const root of roots) {
    if (root && file.startsWith(root + '/')) {
      const rel = file.slice(root.length + 1);
      if (rel.startsWith('lib/mcp/tools/')) return { group: path.basename(rel).startsWith('eureka-') ? 'eureka-tools' : 'tools', label: rel };
      if (rel.startsWith('lib/mcp/')) return { group: 'other-mcp', label: rel };
      if (rel.startsWith('lib/core/')) return { group: 'core', label: rel };
      return { group: 'other', label: rel };
    }
  }
  return { group: 'other', label: 'external' };
}

// reads a .cpuprofile; returns milliseconds per group (self time), the share of the active time, the top 10 files
function summarizeProfile(file, pluginRoot) {
  const prof = JSON.parse(fs.readFileSync(file, 'utf8'));
  const roots = [path.resolve(pluginRoot)];
  try { roots.push(fs.realpathSync(pluginRoot)); } catch (_e) { /* keep the given root */ }
  const byId = new Map();
  for (const n of prof.nodes || []) byId.set(n.id, n);
  const selfUs = new Map();
  const samples = prof.samples || [];
  const deltas = prof.timeDeltas || [];
  for (let i = 0; i < samples.length; i += 1) selfUs.set(samples[i], (selfUs.get(samples[i]) || 0) + (deltas[i] || 0));
  const groups = {};
  const files = new Map();
  for (const [id, us] of selfUs) {
    const node = byId.get(id);
    if (!node) continue;
    const g = groupOf(node.callFrame || {}, roots);
    groups[g.group] = (groups[g.group] || 0) + us / 1000;
    if (g.group !== 'idle' && g.group !== 'runtime') {
      const k = g.group + '\t' + g.label; // a package that is split in two groups (sdk client and sdk other) stays two rows
      const cur = files.get(k) || { file: g.label, group: g.group, ms: 0 };
      cur.ms += us / 1000;
      files.set(k, cur);
    }
  }
  const total = Object.keys(groups).reduce((a, k) => a + groups[k], 0);
  const active = total - (groups.idle || 0);
  const by_group = {};
  const shares = {};
  for (const k of Object.keys(groups)) {
    by_group[k] = round1(groups[k]);
    if (k !== 'idle') shares[k] = active > 0 ? round1((groups[k] / active) * 100) : null;
  }
  const top_files = [...files.values()].sort((a, b) => b.ms - a.ms).slice(0, 10).map((f) => ({ file: f.file, group: f.group, ms: round1(f.ms) }));
  return { total_ms: round1(total), active_ms: round1(active), samples: samples.length, by_group, shares_percent: shares, top_files };
}

// ---------------------------------------------------------------------------
// probe preload helpers (M6, M7)
// ---------------------------------------------------------------------------
function readProbeLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_e) { return null; } }).filter(Boolean); } catch (_e) { return []; }
}

function preloadEnv(logFile, cats) {
  return { NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + PROBE).trim(), MOS_PROBE_LOG: logFile, MOS_PROBE_CATS: JSON.stringify(cats || {}) };
}

// M6: the server under --cpu-prof with the probe preload; SIGTERM after tools/list (the preload exits 0, which writes the profile)
// o: { script, cwd, env, cpus, hasTaskset, dir, cats? }
async function profileStart(o) {
  fs.mkdirSync(o.dir, { recursive: true });
  const logFile = path.join(o.dir, 'probe.log');
  const env = Object.assign({}, o.env, preloadEnv(logFile, o.cats));
  const srv = spawnServer({ script: o.script, cwd: o.cwd, env, cpus: o.cpus, hasTaskset: o.hasTaskset, nodeArgs: ['--cpu-prof', '--cpu-prof-dir', o.dir, '--cpu-prof-interval', '250'] });
  let hs = null;
  try { hs = await handshake(srv, { timeoutMs: 60000 }); } catch (_e) { hs = null; }
  await srv.stop('SIGTERM', 8000);
  const found = fs.readdirSync(o.dir).filter((n) => n.endsWith('.cpuprofile')).map((n) => path.join(o.dir, n));
  const lines = readProbeLines(logFile).filter((l) => l.pid === srv.pid && l.snapshot === false);
  return { hs, profile_file: found[0] || null, modules: lines.length ? lines[0].modules : null };
}

async function waitForSnapshots(logFile, pid, count, timeoutMs) {
  const end = Date.now() + (timeoutMs || 5000);
  for (;;) {
    const n = readProbeLines(logFile).filter((l) => l.pid === pid && l.snapshot === true).length;
    if (n >= count) return true;
    if (Date.now() > end) return false;
    await sleepMs(20);
  }
}

function sumFs(line, cat, fns) {
  let n = 0;
  for (const e of line.fs || []) if (e.cat === cat && (!fns || fns.indexOf(e.fn) !== -1)) n += e.count;
  return n;
}

// M7: database opens per tool call. calls: [{ name, args, label }] in order. Each call is bracketed by two SIGUSR2 snapshots.
// o: { script, cwd, env, cpus, hasTaskset, logFile, cats }. Returns one row per call.
async function opensPerCall(o, calls) {
  const logFile = o.logFile;
  try { fs.rmSync(logFile, { force: true }); } catch (_e) { /* none */ }
  const env = Object.assign({}, o.env, preloadEnv(logFile, o.cats));
  const srv = spawnServer({ script: o.script, cwd: o.cwd, env, cpus: o.cpus, hasTaskset: o.hasTaskset });
  const rows = [];
  try {
    await handshake(srv, { timeoutMs: 60000 });
    for (const p of o.prelude || []) await srv.request('tools/call', { name: p.name, arguments: p.args || {} }, 60000);
    await sleepMs(o.settleMs === undefined ? 500 : o.settleMs);
    let snaps = 0;
    for (const c of calls) {
      srv.signal('SIGUSR2');
      snaps += 1;
      const okBefore = await waitForSnapshots(logFile, srv.pid, snaps, 5000);
      const before = readProbeLines(logFile);
      const nBefore = before.length;
      const snapBefore = before.filter((l) => l.pid === srv.pid && l.snapshot === true).pop();
      let reply = null;
      let error = null;
      try { reply = await srv.request('tools/call', { name: c.name, arguments: c.args || {} }, o.callTimeoutMs || 120000); } catch (e) { error = String(e.message || e).slice(0, 40); }
      await sleepMs(o.afterMs === undefined ? 150 : o.afterMs);
      srv.signal('SIGUSR2');
      snaps += 1;
      const okAfter = await waitForSnapshots(logFile, srv.pid, snaps, 5000);
      const all = readProbeLines(logFile);
      const window = all.slice(nBefore);
      const snapAfter = window.filter((l) => l.pid === srv.pid && l.snapshot === true).pop();
      const others = window.filter((l) => l.pid !== srv.pid && l.snapshot === false);
      const direct = others.filter((l) => l.ppid === srv.pid);
      const sq = (l) => (l && l.sqlite) || { constructed: 0, exec: 0, prepare: 0 };
      rows.push({
        label: c.label || c.name,
        measured: !!(okBefore && okAfter && snapAfter && reply),
        tool_error: reply ? isErrorReply(reply.msg) : true,
        failure: error,
        opens_server: sq(snapAfter).constructed,
        sqlite_exec_server: sq(snapAfter).exec,
        sqlite_prepare_server: sq(snapAfter).prepare,
        opens_children: others.reduce((a, l) => a + sq(l).constructed, 0),
        child_node_processes: others.length,
        child_node_direct: direct.length,
        modules_added: snapAfter && snapBefore ? Math.max(0, snapAfter.modules - snapBefore.modules) : null,
        lib_reads: snapAfter ? sumFs(snapAfter, 'lib', ['readFileSync', 'readFile', 'openSync']) : null,
        room_reads: snapAfter ? sumFs(snapAfter, 'room', ['readFileSync', 'readFile', 'openSync']) : null,
        tool_ms: reply ? round1(reply.rtt_ms) : null,
      });
    }
  } finally { await srv.stop('SIGKILL', 3000); }
  return rows;
}

// ---------------------------------------------------------------------------
// M9: the exec check
// ---------------------------------------------------------------------------
function writeStubs(dir, stubLog) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ['npm', 'npx']) {
    const f = path.join(dir, name);
    fs.writeFileSync(f, '#!/bin/sh\nprintf "%s\\n" "' + name + '" >> "' + stubLog + '"\nexit 1\n', { mode: 0o755 });
  }
}

// o: { script, cwd, env, cpus, hasTaskset, counter, dir, block (default 'npm,npx') }
// A stub npm and npx are first on PATH; the counter blocks execs of programs named npm or npx. No real npm or npx runs.
async function execCheck(o) {
  fs.mkdirSync(o.dir, { recursive: true });
  const execLog = path.join(o.dir, 'exec.log');
  const stubLog = path.join(o.dir, 'stub.log');
  const stubDir = path.join(o.dir, 'stubs');
  for (const f of [execLog, stubLog]) fs.rmSync(f, { force: true });
  writeStubs(stubDir, stubLog);
  const env = Object.assign({}, o.env, {
    PATH: stubDir + ':' + (o.env.PATH || process.env.PATH || ''),
    LD_PRELOAD: o.counter,
    MOS_EXEC_LOG: execLog,
    MOS_EXEC_BLOCK: o.block === undefined ? 'npm,npx' : o.block,
  });
  const srv = spawnServer({ script: o.script, cwd: o.cwd, env, cpus: o.cpus, hasTaskset: o.hasTaskset });
  let hs = null;
  try { hs = await handshake(srv, { timeoutMs: 60000 }); } catch (_e) { hs = null; }
  await sleepMs(o.settleMs === undefined ? 1500 : o.settleMs);
  await srv.stop('SIGTERM', 6000);
  const parsed = CENSUS.parseExecLog(fs.existsSync(execLog) ? fs.readFileSync(execLog, 'utf8') : '');
  let stubCalls = 0;
  try { stubCalls = fs.readFileSync(stubLog, 'utf8').split('\n').filter(Boolean).length; } catch (_e) { stubCalls = 0; }
  const npmExecs = (parsed.byProgram.npm || 0) + (parsed.byProgram.npx || 0);
  return {
    replied: !!hs, tools: hs ? hs.tools.length : null,
    stub_calls: stubCalls, blocked_execs: parsed.blocked, npm_execs_counted: npmExecs,
    exec_total: parsed.total, node_starts: parsed.nodeStarts, bash_starts: parsed.bashStarts,
    by_program: parsed.byProgram,
    npm_attempted: stubCalls + parsed.blocked + npmExecs >= 1,
  };
}

// ---------------------------------------------------------------------------
// session: lock, gates, room, context
// ---------------------------------------------------------------------------
const USAGE = {
  start: 'usage: start --tree <dir> --out <file> [--server os|brain|both] [--tree-b <dir> [--label-b name]] [--exec-check [--counter <exec-counter.so>]] [--room fixture|copy] [--source <dir> | --source-file <file>] [--runs N (default 7)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  profile: 'usage: profile --tree <dir> --out <file> [--server os|brain|both] [--room fixture|copy] [--runs N (default 7)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  idle: 'usage: idle --tree <dir> --out <file> [--rooms 1,10,58] [--procs 1,3] [--window-ms 10000] [--room fixture|copy] [--runs N (default 7)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  block: 'usage: block --tree <dir> --out <file> [--tool stop_gate_check] [--ping-delay-ms 20] [--room fixture|copy] [--runs N (default 7)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  opens: 'usage: opens --tree <dir> --out <file> [--tools a,b,c] [--repeats N (default 3)] [--room fixture|copy] [--source-file <file>] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
};
const FLAGS = {
  tree: 1, out: 1, server: 1, 'exec-check': 'bool', counter: 1, room: 1, source: 1, 'source-file': 1, runs: 1, repeats: 1, set: 1, label: 1,
  'tree-b': 1, 'label-b': 1, 'base-sha': 1, scratch: 1, rooms: 1, procs: 1, 'window-ms': 1, tool: 1, tools: 1, 'ping-delay-ms': 1, 'write-path': 1, 'skip-gates': 'bool', 'allow-short': 'bool',
};

function parseFlags(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error('unexpected argument: ' + a);
    const key = a.slice(2);
    const s = FLAGS[key];
    if (s === undefined) throw new Error('unknown argument: ' + a);
    if (s === 'bool') { o[key] = true; continue; }
    i += 1;
    if (argv[i] === undefined) throw new Error('missing value for ' + a);
    o[key] = argv[i];
  }
  return o;
}

function fail(msg, code) { return Object.assign(new Error(msg), { exitCode: code || 2 }); }

function intList(csv, what) {
  const v = String(csv).split(',').map((x) => parseInt(x, 10));
  if (!v.length || v.some((x) => !Number.isInteger(x) || x < 1)) throw fail(what + ' needs positive integers');
  return v;
}

async function openSession(f, kind) {
  const selftest = process.env.MOS_PERF_SELFTEST === '1';
  if ((f['skip-gates'] || f['allow-short']) && !selftest) throw fail('--skip-gates and --allow-short are test-only flags and need MOS_PERF_SELFTEST=1');
  if (!f.tree || !f.out) throw fail(USAGE[kind]);
  const room = f.room || 'fixture';
  if (!['fixture', 'copy'].includes(room)) throw fail('--room must be fixture or copy');
  const defaultRuns = kind === 'opens' ? 3 : MIN_RUNS;
  const runs = parseInt(f.runs !== undefined ? f.runs : (kind === 'opens' && f.repeats !== undefined ? f.repeats : defaultRuns), 10);
  if (!Number.isInteger(runs) || runs < 1) throw fail('--runs must be a positive integer');
  if (kind !== 'opens' && runs < MIN_RUNS && !f['allow-short']) throw fail('at least ' + MIN_RUNS + ' runs are required (C2); got ' + runs);
  if (kind === 'opens' && runs < 3 && !f['allow-short']) throw fail('at least 3 repeats are required for a count; got ' + runs);
  if (f['base-sha'] !== undefined && !/^[0-9a-f]{40}$/.test(f['base-sha'])) throw fail('--base-sha needs 40 lowercase hex digits');
  if (room === 'copy' && !f.source && !f['source-file'] && !process.env.MOS_REAL_ROOM_384) throw fail('--room copy needs --source <dir>, --source-file <file> or MOS_REAL_ROOM_384');
  const tree = path.resolve(f.tree);
  if (!fs.existsSync(path.join(tree, 'hooks', 'hooks.json'))) throw fail('not a plugin tree');
  if (!selftest || process.env.MOS_PERF_LOCK_CHECK === 'force') {
    if (!H.requireLock({ lockFile: H.defaultLockFile() })) throw fail('lock not held: run under flock -w 7200 "$HOME/.cache/mos-perf-384.lock"', 1);
  }
  const skipGates = !!(f['skip-gates'] || f['allow-short']);
  if (!skipGates && H.suiteGuard() === 'busy') throw fail('host busy: a suite process is running', 75);
  const scratch = path.resolve(f.scratch || os.tmpdir());
  fs.mkdirSync(scratch, { recursive: true });
  process.env.TMPDIR = scratch;
  const avail = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const cpus = Math.min(4, avail);
  const hasTaskset = os.platform() === 'linux' && cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;
  const baseSha = H.baseShaOf(tree, f['base-sha']);
  const startedAt = new Date().toISOString();
  let source = null;
  if (room === 'copy') {
    source = await H.resolveSource({ source: f.source, sourceFile: f['source-file'] });
    if (!source) throw fail('no source room');
  }
  const srcBefore = source ? H.manifest(source) : null;
  const prep = H.prepareRoom(room, { trees: [tree], source, scratch, baseSha });
  const ctx = H.makeCtx('A', tree, prep, cpus, hasTaskset);
  const workBefore = room === 'copy' ? H.manifest(prep.roomDir) : null;
  const m = workBefore || H.manifest(prep.roomDir);
  let bytes = 0;
  for (const v of m.values()) bytes += Number(String(v).split(':')[0]) || 0;
  const wp = f['write-path'] === undefined ? 'off' : f['write-path'];
  if (wp !== 'on' && wp !== 'off') throw fail('--write-path must be on or off');
  const S = {
    f, runs, tree, ctx, prep, kind: room, scratch, cpus, hasTaskset, baseSha, skipGates, source, srcBefore, workBefore, startedAt,
    // write path: off is the default (MINDRIAN_MCP_FIRST unset: write tools refuse). on sets MINDRIAN_MCP_FIRST=cli and binds the room first.
    writePath: wp === 'on',
    roomSlug: room === 'fixture' ? path.basename(prep.roomDir) : 'bench-room',
    label: f.label || path.basename(tree),
    load1Start: H.readLoad1(),
    room: { kind: room === 'fixture' ? 'fixture-room' : 'real-copy', file_count: m.size, byte_total: bytes, fs_type: H.fsType(prep.roomDir) },
    touched: new Set(),
    gated: false,
    async gate() {
      const g = skipGates ? { ok: true, load1: H.readLoad1(), waited_ms: 0 } : await H.gateBeforeTarget({ maxMs: 900000 });
      if (!this.gated) { this.gated = true; this.load1Start = g.load1; }
      return g;
    },
    cleanup() { try { prep.sandbox.cleanup(); } catch (_e) { /* best effort */ } },
  };
  return S;
}

function finishIsolation(S) {
  const iso = { source_changed_paths: 0, copy_changed_paths: 0, intersect_paths: 0, exit_code: 0 };
  if (S.kind !== 'copy') return iso;
  H.changedPaths(S.workBefore, H.manifest(S.prep.roomDir)).forEach((p) => S.touched.add(p));
  const srcChanged = H.changedPaths(S.srcBefore, H.manifest(S.source));
  let both = 0;
  for (const p of srcChanged) if (S.touched.has(p)) both += 1;
  iso.source_changed_paths = srcChanged.size;
  iso.copy_changed_paths = S.touched.size;
  iso.intersect_paths = both;
  iso.exit_code = both > 0 ? 3 : 0;
  return iso;
}

function writeOut(S, schema, body) {
  const endedAt = new Date().toISOString();
  const load1End = H.readLoad1();
  const obj = Object.assign({
    schema,
    machine: H.machineRecord({ cpus: S.cpus, fsType: S.room.fs_type, label: S.label, baseSha: S.baseSha, startedAt: S.startedAt, endedAt, load1Start: S.load1Start, load1End }),
    room: S.room,
    set: S.f.set || null,
    tree_label: S.label,
    cpus: S.cpus,
    runs: S.runs,
    load1_start: S.load1Start,
    load1_end: load1End,
    started_at: S.startedAt,
    ended_at: endedAt,
  }, body, { isolation: finishIsolation(S) });
  H.writeResult(S.f.out, obj, { home: os.homedir(), sourceRoom: S.source, scratch: S.scratch });
  return obj.isolation.exit_code;
}

function serverEnv(S, extra) {
  return S.ctx.env(Object.assign({ MOS_PERF_RUN_ID: newRunId() }, S.writePath ? { MINDRIAN_MCP_FIRST: 'cli' } : {}, extra || {}));
}
// calls made after the handshake and before any measured call: with the write path on, bind the room
function preludeOf(S) {
  return S.writePath ? [{ name: 'room_bind', args: { room: S.roomSlug } }] : [];
}
function serverScript(S, key) { return path.join(S.tree, 'scripts', SERVER_SCRIPTS[key]); }
function serverKeys(f) {
  const s = f.server || 'both';
  if (s === 'both') return ['os', 'brain'];
  if (!SERVER_SCRIPTS[s]) throw fail('--server must be os, brain or both');
  return [s];
}
function probeCats(S) {
  return { mindrian: path.join(S.prep.roomDir, '.mindrian'), room: S.prep.roomDir, home: S.ctx.sandbox.home, lib: path.join(S.tree, 'lib'), scripts: path.join(S.tree, 'scripts') };
}

// ---------------------------------------------------------------------------
// result targets (the timing schema)
// ---------------------------------------------------------------------------
function newAcc(id, extra) {
  return { id, wall: [], cpu: [], rss: [], bg: [], exits: new Set(), timedOut: 0, failed: 0, escaped: 0, survivors: 0, extra: extra || {}, series: {} };
}

function toTarget(acc, gate) {
  return Object.assign({
    id: acc.id,
    n: acc.wall.length,
    blocking: true,
    wall_ms: H.statsSummary(acc.wall),
    cpu_ms: H.statsSummary(acc.cpu),
    rss_mb: H.statsSummary(acc.rss),
    exits: [...acc.exits].sort((a, b) => String(a).localeCompare(String(b))),
    timed_out: acc.timedOut,
    failed_runs: acc.failed,
    not_measured: [],
    async_hooks: [],
    hook_count: 1,
    background_ms: median(acc.bg),
    escaped_max: acc.escaped,
    survivors_left: acc.survivors,
    load1_start: gate.load1,
    load1_end: H.readLoad1(),
    gate_waited_ms: gate.waited_ms,
    noisy: !gate.ok,
  }, acc.extra);
}

function derivedTarget(id, diffs, gate, how, extra) {
  const a = newAcc(id, Object.assign({ derived: true, derived_from: how }, extra || {}));
  diffs.forEach((d) => a.wall.push(d));
  a.exits.add(0);
  return toTarget(a, gate);
}

// stop a timing-run server and count what stays alive
// After the kill of the server group, a process that carries the run marker is background work that left the group
// (setsid, a double fork). It is given settleMs (default 15 s) to end by itself; srv.background_ms is the time that it
// lived after the kill (0 when none). Only a process that outlives the limit is a survivor and is killed.
async function endRun(srv, runId, settleMs) {
  await srv.stop('SIGKILL', 4000);
  const t0 = Date.now();
  await sleepMs(30);
  let left = markedPids(runId);
  const hadBackground = left.length > 0;
  const limit = settleMs === undefined ? 15000 : settleMs;
  while (left.length && Date.now() - t0 < limit) {
    await sleepMs(100);
    left = markedPids(runId);
  }
  srv.background_ms = hadBackground ? Date.now() - t0 : 0;
  left.forEach((p) => { try { process.kill(p, 'SIGKILL'); } catch (_e) { /* gone */ } });
  return left.length;
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------
async function startSample(S, key, scriptOverride) {
  const runId = newRunId();
  const srv = spawnServer({ script: scriptOverride || serverScript(S, key), cwd: S.ctx.roomDir, env: S.ctx.env({ MOS_PERF_RUN_ID: runId }), cpus: S.cpus, hasTaskset: S.hasTaskset });
  let hs = null;
  try { hs = await handshake(srv, { timeoutMs: 60000, onReply: (_stage, s) => readProc(s.pid) }); } catch (_e) { hs = null; }
  const left = await endRun(srv, runId);
  if (!hs || !hs.initOk) return { run_class: 'failed', survivors: left };
  return {
    run_class: left > 0 ? 'failed' : 'ok', survivors: left, init_ms: hs.init_ms, list_ms: hs.list_ms,
    init_proc: hs.afterInit, list_proc: hs.afterList, counts: toolCounts(hs.tools),
  };
}

async function countRun(S, key, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, 'count-' + key + '.log');
  fs.rmSync(logFile, { force: true });
  const env = Object.assign({}, S.ctx.env({ MOS_PERF_RUN_ID: newRunId() }), preloadEnv(logFile, probeCats(S)));
  const srv = spawnServer({ script: serverScript(S, key), cwd: S.ctx.roomDir, env, cpus: S.cpus, hasTaskset: S.hasTaskset });
  let hs = null;
  try { hs = await handshake(srv, { timeoutMs: 60000 }); } catch (_e) { hs = null; }
  await srv.stop('SIGTERM', 8000);
  const fin = readProbeLines(logFile).filter((l) => l.pid === srv.pid && l.snapshot === false).pop();
  let toolFiles = null;
  try { toolFiles = fs.readdirSync(path.join(S.tree, 'lib', 'mcp', 'tools')).filter((n) => n.endsWith('.cjs')).length; } catch (_e) { toolFiles = null; }
  return Object.assign({ server: key, replied: !!hs, modules: fin ? fin.modules : null, tool_files_in_folder: toolFiles }, hs ? toolCounts(hs.tools) : {});
}

// start with two trees, interleaved A B, B A, A B ...: the same room, the same server, two plugin trees
async function cmdStartAB(f) {
  const S = await openSession(f, 'start');
  try {
    if (f.server !== undefined && f.server !== 'os') throw fail('--tree-b supports --server os only');
    const treeB = path.resolve(f['tree-b']);
    const scriptB = path.join(treeB, 'scripts', SERVER_SCRIPTS.os);
    if (!fs.existsSync(scriptB)) throw fail('--tree-b is not a plugin tree');
    const labelB = f['label-b'] || path.basename(treeB);
    const gate = await S.gate();
    const sides = { A: { script: serverScript(S, 'os'), tag: 'mcp:os', label: S.label }, B: { script: scriptB, tag: 'mcp:os-b', label: labelB } };
    const acc = {};
    for (const k of Object.keys(sides)) {
      acc[k] = { init: newAcc(sides[k].tag + ':initialize', { tree_label: sides[k].label }), list: newAcc(sides[k].tag + ':tools-list', { tree_label: sides[k].label }) };
    }
    const dInit = [];
    const dList = [];
    for (let i = 0; i < S.runs; i += 1) {
      const got = {};
      for (const side of (i % 2 === 0 ? ['A', 'B'] : ['B', 'A'])) {
        const s = await startSample(S, 'os', sides[side].script);
        const a = acc[side];
        a.init.survivors += s.survivors; a.list.survivors += s.survivors;
        if (s.run_class === 'failed') { a.init.failed += 1; a.list.failed += 1; continue; }
        a.init.exits.add(0); a.list.exits.add(0);
        a.init.wall.push(s.init_ms); a.list.wall.push(s.list_ms);
        if (s.init_proc) { a.init.cpu.push(s.init_proc.cpu_ms); a.init.rss.push(s.init_proc.hwm_mb); }
        if (s.list_proc) { a.list.cpu.push(s.list_proc.cpu_ms); a.list.rss.push(s.list_proc.hwm_mb); }
        a.init.bg.push(0); a.list.bg.push(0);
        a.init.extra.tools = s.counts.tools; a.list.extra.tools = s.counts.tools;
        a.init.extra.eureka_tools = s.counts.eureka_tools; a.list.extra.eureka_tools = s.counts.eureka_tools;
        got[side] = s;
      }
      if (got.A && got.B) { dInit.push(got.A.init_ms - got.B.init_ms); dList.push(got.A.list_ms - got.B.list_ms); }
    }
    const targets = [toTarget(acc.A.init, gate), toTarget(acc.A.list, gate), toTarget(acc.B.init, gate), toTarget(acc.B.list, gate),
      derivedTarget('mcp:os:initialize:a-minus-b', dInit, gate, 'per-pair initialize time of tree A minus tree B'),
      derivedTarget('mcp:os:tools-list:a-minus-b', dList, gate, 'per-pair tools/list time of tree A minus tree B')];
    const code = writeOut(S, H.SCHEMA, { compare: { a: S.label, b: labelB }, targets });
    log('start A/B: ' + targets.map((t) => t.id + ' ' + t.wall_ms.median + ' ms (n ' + t.n + ')').join('; '));
    return code;
  } finally { S.cleanup(); }
}

async function cmdStart(f) {
  if (f['exec-check']) return cmdExecCheck(f);
  if (f['tree-b']) return cmdStartAB(f);
  const S = await openSession(f, 'start');
  try {
    const keys = serverKeys(f);
    const gate = await S.gate();
    const floorDef = H.targetDef('floor:node');
    const items = keys.concat(['floor']);
    const acc = {};
    keys.forEach((k) => {
      acc[k + ':init'] = newAcc('mcp:' + k + ':initialize');
      acc[k + ':list'] = newAcc('mcp:' + k + ':tools-list');
    });
    acc.floor = newAcc('floor:node');
    const sumInit = [];
    const sumList = [];
    for (let i = 0; i < S.runs; i += 1) {
      const got = {};
      for (const it of rotated(items, i)) {
        if (it === 'floor') {
          const s = await H.runCommandOnce(floorDef, S.ctx, { settleMs: 5000 });
          const a = acc.floor;
          (s.exits || []).forEach((x) => a.exits.add(x));
          if (s.run_class === 'failed') { a.failed += 1; continue; }
          a.wall.push(s.wall_ms);
          if (s.cpu_ms !== null) a.cpu.push(s.cpu_ms);
          if (s.rss_mb !== null) a.rss.push(s.rss_mb);
          a.bg.push(0);
          continue;
        }
        const s = await startSample(S, it);
        const ai = acc[it + ':init'];
        const al = acc[it + ':list'];
        ai.survivors += s.survivors;
        al.survivors += s.survivors;
        if (s.run_class === 'failed') { ai.failed += 1; al.failed += 1; continue; }
        ai.exits.add(0); al.exits.add(0);
        ai.wall.push(s.init_ms); al.wall.push(s.list_ms);
        if (s.init_proc) { ai.cpu.push(s.init_proc.cpu_ms); ai.rss.push(s.init_proc.hwm_mb); }
        if (s.list_proc) { al.cpu.push(s.list_proc.cpu_ms); al.rss.push(s.list_proc.hwm_mb); }
        ai.bg.push(0); al.bg.push(0);
        ai.extra.tools = s.counts.tools; al.extra.tools = s.counts.tools;
        ai.extra.eureka_tools = s.counts.eureka_tools; al.extra.eureka_tools = s.counts.eureka_tools;
        got[it] = s;
      }
      if (keys.length === 2 && got.os && got.brain) {
        sumInit.push(got.os.init_ms + got.brain.init_ms);
        sumList.push(got.os.list_ms + got.brain.list_ms);
      }
    }
    const targets = [];
    keys.forEach((k) => { targets.push(toTarget(acc[k + ':init'], gate)); targets.push(toTarget(acc[k + ':list'], gate)); });
    targets.push(toTarget(acc.floor, gate));
    if (sumInit.length) {
      targets.push(derivedTarget('mcp:series-os-plus-brain:initialize', sumInit, gate, 'per-round sum of the os and brain initialize times'));
      targets.push(derivedTarget('mcp:series-os-plus-brain:tools-list', sumList, gate, 'per-round sum of the os and brain tools/list times'));
    }
    // the count run, apart from the timing runs
    const counts = {};
    for (const k of keys) counts[k] = await countRun(S, k, path.join(S.prep.sandbox.tmp, 'count'));
    const code = writeOut(S, H.SCHEMA, { counts, targets });
    log('start: ' + targets.map((t) => t.id + ' ' + t.wall_ms.median + ' ms (n ' + t.n + ')').join('; '));
    return code;
  } finally { S.cleanup(); }
}

async function cmdExecCheck(f) {
  // the exec check is a count: 3 repeats are the minimum, not 7 timing runs
  const S = await openSession(Object.assign({}, f, { repeats: f.runs === undefined ? '3' : f.runs, runs: undefined }), 'opens');
  try {
    const keys = serverKeys(f);
    const counter = f.counter ? path.resolve(f.counter) : path.join(S.scratch, 'exec-counter.so');
    if (!fs.existsSync(counter)) throw fail('exec counter not built: node bench/process-census.cjs build --scratch <dir>');
    await S.gate();
    const repeats = Math.max(1, S.runs);
    const checks = {};
    for (const k of keys) {
      const reps = [];
      for (let r = 0; r < repeats; r += 1) {
        reps.push(await execCheck({ script: serverScript(S, k), cwd: S.ctx.roomDir, env: S.ctx.env({ MOS_PERF_RUN_ID: newRunId() }), cpus: S.cpus, hasTaskset: S.hasTaskset, counter, dir: path.join(S.prep.sandbox.tmp, 'exec-' + k + '-' + r) }));
      }
      checks[k] = {
        repeats: reps.length,
        replied_runs: reps.filter((x) => x.replied).length,
        stub_calls: reps.map((x) => x.stub_calls),
        blocked_execs: reps.map((x) => x.blocked_execs),
        npm_execs_counted: reps.map((x) => x.npm_execs_counted),
        exec_total: reps.map((x) => x.exec_total),
        node_starts: reps.map((x) => x.node_starts),
        bash_starts: reps.map((x) => x.bash_starts),
        by_program: reps[0] ? reps[0].by_program : {},
        npm_attempted: reps.some((x) => x.npm_attempted),
      };
    }
    const code = writeOut(S, H.COUNTS_SCHEMA, { exec_check: checks });
    log('exec check: ' + Object.keys(checks).map((k) => k + ' npm_attempted=' + checks[k].npm_attempted).join('; '));
    return code;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------
async function cmdProfile(f) {
  const S = await openSession(f, 'profile');
  try {
    const keys = serverKeys(f);
    const gate = await S.gate();
    const runsBy = {};
    keys.forEach((k) => { runsBy[k] = []; });
    let failed = 0;
    for (let i = 0; i < S.runs; i += 1) {
      for (const k of rotated(keys, i)) {
        const dir = path.join(S.prep.sandbox.tmp, 'prof-' + k + '-' + i);
        const r = await profileStart({ script: serverScript(S, k), cwd: S.ctx.roomDir, env: S.ctx.env({ MOS_PERF_RUN_ID: newRunId() }), cpus: S.cpus, hasTaskset: S.hasTaskset, dir, cats: probeCats(S) });
        if (!r.profile_file || !r.hs) { failed += 1; continue; }
        runsBy[k].push(Object.assign(summarizeProfile(r.profile_file, S.tree), { modules: r.modules }));
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    const profiles = {};
    for (const k of keys) {
      const list = runsBy[k];
      const groups = {};
      const shares = {};
      for (const g of GROUPS.concat(['idle'])) {
        const ms = list.map((p) => p.by_group[g] || 0);
        groups[g] = median(ms);
        if (g !== 'idle') shares[g] = median(list.map((p) => (p.shares_percent[g] === undefined || p.shares_percent[g] === null ? 0 : p.shares_percent[g])));
      }
      const fileMs = new Map();
      list.forEach((p) => p.top_files.forEach((t) => { const c = fileMs.get(t.file) || { file: t.file, group: t.group, v: [] }; c.v.push(t.ms); fileMs.set(t.file, c); }));
      const top = [...fileMs.values()].map((c) => ({ file: c.file, group: c.group, median_ms: median(c.v.concat(new Array(Math.max(0, list.length - c.v.length)).fill(0))), runs_in_top10: c.v.length }))
        .sort((a, b) => b.median_ms - a.median_ms).slice(0, 10);
      profiles[k] = {
        runs: list.length,
        failed_runs: 0,
        active_ms: H.statsSummary(list.map((p) => p.active_ms)),
        total_ms: H.statsSummary(list.map((p) => p.total_ms)),
        median_ms_by_group: groups,
        median_share_percent_by_group: shares,
        modules_loaded: H.statsSummary(list.map((p) => p.modules).filter((x) => x !== null)),
        top_files: top,
        note: 'The CPU profiler and the probe preload slow the run: use the shares, not the milliseconds, as a cost of start-up.',
      };
    }
    const code = writeOut(S, H.COUNTS_SCHEMA, { profile: profiles, profile_failed_runs: failed, gate_load1: gate.load1, profile_runs: S.runs });
    log('profile done, failed runs ' + failed);
    return code;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// idle (S10)
// ---------------------------------------------------------------------------
function buildHome(S, R) {
  const base = path.join(S.prep.sandbox.root, 'homes', 'r' + R);
  fs.mkdirSync(base, { recursive: true });
  const rooms = {};
  for (let i = 1; i <= R; i += 1) {
    const dest = path.join(base, 'room-' + i);
    fs.cpSync(S.ctx.roomDir, dest, { recursive: true });
    rooms['room-' + i] = { path: dest, abs_path: dest, status: 'active', venture_name: 'bench', git_enabled: false, git_remote: null, auto_push: false };
  }
  fs.mkdirSync(path.join(base, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(base, '.rooms', 'registry.json'), JSON.stringify({ version: 1, root: base, active: 'room-1', rooms }));
  // directories and files that the watcher can see (the tree-watcher ignore rule, depth up to 4 below the home)
  let dirs = 0;
  let files = 0;
  const walk = (dir, depth) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      const rel = path.relative(base, path.join(dir, e.name));
      if (IGNORED_RE.test(rel)) continue;
      if (e.isDirectory()) { dirs += 1; if (depth < 4) walk(path.join(dir, e.name), depth + 1); } else files += 1;
    }
  };
  walk(base, 1);
  return { home: base, room: path.join(base, 'room-1'), dirs, files };
}

async function stableWatches(pid, maxMs) {
  const start = Date.now();
  const end = start + maxMs;
  let last = -1;
  let same = 0;
  for (;;) {
    const n = inotifyWatches(pid);
    // a count of 0 counts as settled only after 3 s, because the watcher may not have started yet
    if (n === last && (n > 0 || Date.now() - start > 3000)) same += 1; else same = 0;
    last = n;
    if (same >= 2 || Date.now() > end) return n;
    await sleepMs(250);
  }
}

async function idleConfig(S, home, procs, windowMs) {
  const servers = [];
  const ids = [];
  for (let p = 0; p < procs; p += 1) {
    const runId = newRunId();
    ids.push(runId);
    servers.push(spawnServer({
      script: serverScript(S, 'os'), cwd: home.room, cpus: S.cpus, hasTaskset: S.hasTaskset,
      env: S.ctx.env({ MOS_PERF_RUN_ID: runId, MINDRIAN_ROOMS_HOME: home.home, MINDRIAN_ROOMS_ROOT: home.home, MINDRIAN_ROOM: home.room }),
    }));
  }
  try {
    const inits = await Promise.all(servers.map((s) => s.request('initialize', INIT_PARAMS, 60000).then((r) => r.since_spawn_ms, () => null)));
    if (inits.some((x) => x === null)) return null;
    servers.forEach((s) => s.notify('notifications/initialized'));
    const watches = [];
    for (const s of servers) watches.push(await stableWatches(s.pid, 15000));
    const a = servers.map((s) => readProc(s.pid));
    await sleepMs(windowMs);
    const b = servers.map((s) => readProc(s.pid));
    if (a.some((x) => !x) || b.some((x) => !x)) return null;
    return {
      init_ms: inits.reduce((x, y) => x + y, 0) / inits.length,
      watches_per_process: median(watches),
      watches_total: watches.reduce((x, y) => x + y, 0),
      rss_mb_per_process: b.reduce((x, y) => x + y.rss_mb, 0) / b.length,
      rss_mb_total: b.reduce((x, y) => x + y.rss_mb, 0),
      cpu_ms_per_process: b.reduce((x, y, i) => x + (y.cpu_ms - a[i].cpu_ms), 0) / b.length,
    };
  } finally {
    for (let i = 0; i < servers.length; i += 1) await endRun(servers[i], ids[i]);
  }
}

async function controlSample(S, windowMs) {
  const runId = newRunId();
  const code = "process.stdout.write('ready\\n');setInterval(function () {}, 1000);";
  const env = S.ctx.env({ MOS_PERF_RUN_ID: runId });
  const argv = (S.hasTaskset ? ['taskset', '-c', '0-' + (S.cpus - 1)] : []).concat([process.execPath, '-e', code]);
  const t0 = process.hrtime.bigint();
  const child = cp.spawn(argv[0], argv.slice(1), { cwd: S.ctx.roomDir, env, detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('control timeout')), 20000);
      child.stdout.once('data', () => { clearTimeout(t); resolve(); });
      child.on('error', reject);
    });
    const ready = Number(process.hrtime.bigint() - t0) / 1e6;
    await sleepMs(1500);
    const c = await idleCost(child.pid, windowMs);
    return c ? { init_ms: ready, rss_mb: c.rss_mb, cpu_ms: c.cpu_ms, watches: inotifyWatches(child.pid) } : null;
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  }
}

async function cmdIdle(f) {
  const S = await openSession(f, 'idle');
  try {
    const roomsList = intList(f.rooms || '1,10,58', '--rooms');
    const procsList = intList(f.procs || '1,3', '--procs');
    const windowMs = parseInt(f['window-ms'] || '10000', 10);
    if (!Number.isInteger(windowMs) || windowMs < 100) throw fail('--window-ms must be at least 100');
    const homes = {};
    for (const R of roomsList) homes[R] = buildHome(S, R);
    const gate = await S.gate();
    const configs = [];
    for (const R of roomsList) for (const P of procsList) configs.push({ R, P, id: 'mcp:idle:rooms-' + R + ':procs-' + P });
    configs.push({ control: true, id: 'mcp:idle:control-node' });
    const acc = {};
    const extra = {};
    configs.forEach((c) => {
      acc[c.id] = newAcc(c.id, c.control ? { control: true, window_ms: windowMs } : { rooms: c.R, procs: c.P, window_ms: windowMs, dirs_in_watch_depth: homes[c.R].dirs, files_in_watch_depth: homes[c.R].files, cpu_ms_meaning: 'idle cpu per process in the window', rss_mb_meaning: 'idle VmRSS per process', wall_ms_meaning: 'spawn to the initialize reply' });
      extra[c.id] = { watches_pp: [], watches_total: [], rss_total: [] };
    });
    const per = {}; // per-round values for derived targets
    configs.forEach((c) => { per[c.id] = []; });
    for (let i = 0; i < S.runs; i += 1) {
      for (const c of rotated(configs, i)) {
        const a = acc[c.id];
        const s = c.control ? await controlSample(S, windowMs) : await idleConfig(S, homes[c.R], c.P, windowMs);
        if (!s) { a.failed += 1; per[c.id][i] = null; continue; }
        a.exits.add(0);
        a.wall.push(s.init_ms);
        a.cpu.push(c.control ? s.cpu_ms : s.cpu_ms_per_process);
        a.rss.push(c.control ? s.rss_mb : s.rss_mb_per_process);
        a.bg.push(0);
        if (!c.control) {
          extra[c.id].watches_pp.push(s.watches_per_process);
          extra[c.id].watches_total.push(s.watches_total);
          extra[c.id].rss_total.push(s.rss_mb_total);
        } else extra[c.id].watches_pp.push(s.watches);
        per[c.id][i] = s;
      }
    }
    const targets = configs.map((c) => {
      const t = toTarget(acc[c.id], gate);
      const e = extra[c.id];
      t.watches_per_process = H.statsSummary(e.watches_pp);
      if (!c.control) { t.watches_total = H.statsSummary(e.watches_total); t.rss_mb_total = H.statsSummary(e.rss_total); }
      return t;
    });
    // S10 cost basis: one process with the watcher minus the bare node control (DERIVED)
    const ctl = per['mcp:idle:control-node'];
    for (const R of [roomsList[0], roomsList[roomsList.length - 1]]) {
      const id = 'mcp:idle:rooms-' + R + ':procs-' + procsList[0];
      const rssD = [];
      const cpuD = [];
      const wD = [];
      const initD = [];
      for (let i = 0; i < S.runs; i += 1) {
        const s = per[id][i];
        const c = ctl[i];
        if (!s || !c) continue;
        rssD.push(s.rss_mb_per_process - c.rss_mb);
        cpuD.push(s.cpu_ms_per_process - c.cpu_ms);
        wD.push(s.watches_per_process - c.watches);
        initD.push(s.init_ms - c.init_ms);
      }
      const a = newAcc('mcp:idle:rooms-' + R + ':procs-' + procsList[0] + ':minus-control', { derived: true, derived_from: 'per-round value of one process with the watcher minus the bare node control; wall_ms = initialize reply minus control ready', rooms: R });
      initD.forEach((x) => a.wall.push(x));
      cpuD.forEach((x) => a.cpu.push(x));
      rssD.forEach((x) => a.rss.push(x));
      a.exits.add(0);
      const t = toTarget(a, gate);
      t.watches_per_process = H.statsSummary(wD);
      targets.push(t);
    }
    const code = writeOut(S, H.SCHEMA, { rooms: roomsList, procs: procsList, window_ms: windowMs, targets });
    log('idle done: ' + targets.length + ' targets');
    return code;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// tool calls with safe synthetic arguments
// ---------------------------------------------------------------------------
// The argument values are synthetic and never written to a result. A tool that is not in this table is NOT MEASURED.
const SAFE_CALLS = {
  room_list: { tool: 'room_list', args: () => ({}) },
  room_state: { tool: 'room_state', args: () => ({ command: 'status' }) },
  suggest_next: { tool: 'suggest_next', args: () => ({}) },
  room_startup: { tool: 'room_startup', args: () => ({}) },
  room_search: { tool: 'room_search', args: () => ({ query: 'perf384' }) },
  room_changes: { tool: 'room_changes', args: () => ({ collection: 'nodes', mode: 'snapshot' }) },
  stop_gate_check: { tool: 'stop_gate_check', args: () => ({ session_id: 'perf384-session' }) },
  artifact_file: { tool: 'artifact_file', write: true, args: (u) => ({ section: 'problem-definition', filename: 'perf384-' + u + '.md', content: '# perf384 synthetic note\n\nsynthetic text for a timing run.\n' }) },
  memory_event: { tool: 'memory_event', write: true, args: (u) => ({ label: 'perf384-synthetic', dedupe_key: 'perf384-' + u }) },
  'room_graph:graph-rebuild': { tool: 'room_graph', write: true, args: () => ({ command: 'graph-rebuild' }) },
  'room_content:file-opportunity': { tool: 'room_content', write: true, cascade: true, args: (u) => ({ command: 'file-opportunity', section: JSON.stringify({ title: 'perf384 synthetic opportunity ' + u, program: 'perf384', funder: 'perf384', amount: 1000, deadline: '2030-01-01' }) }) },
};
const DEFAULT_OPEN_TOOLS = ['room_list', 'room_state', 'suggest_next', 'room_startup', 'artifact_file', 'memory_event'];

async function cmdOpens(f) {
  const S = await openSession(f, 'opens');
  try {
    const names = (f.tools ? f.tools.split(',') : DEFAULT_OPEN_TOOLS).map((x) => x.trim()).filter(Boolean);
    const not_measured = [];
    const plan = [];
    for (const n of names) {
      if (!SAFE_CALLS[n]) not_measured.push({ tool: n, reason: 'no safe argument set for this tool' });
      else plan.push(n);
    }
    await S.gate();
    const perTool = {};
    plan.forEach((n) => { perTool[n] = { call1: [], call2: [] }; });
    const registered = new Set();
    for (let r = 0; r < S.runs; r += 1) {
      const logFile = path.join(S.prep.sandbox.tmp, 'opens-' + r + '.log');
      const calls = [];
      plan.forEach((n) => { for (let k = 1; k <= 2; k += 1) calls.push({ name: SAFE_CALLS[n].tool, label: n + '#' + k, args: SAFE_CALLS[n].args('r' + r + 'c' + k + '-' + n.replace(/[^a-z]/g, '')) }); });
      const rows = await opensPerCall({ script: serverScript(S, 'os'), cwd: S.ctx.roomDir, env: serverEnv(S), cpus: S.cpus, hasTaskset: S.hasTaskset, logFile, cats: probeCats(S), prelude: preludeOf(S) }, calls);
      rows.forEach((row) => {
        const [n, k] = row.label.split('#');
        if (!row.measured) { perTool[n]['call' + k].push(null); return; }
        registered.add(n);
        perTool[n]['call' + k].push(row);
      });
      // tool_error with an unknown tool name means the tool is not registered: record it below
    }
    const pick = (list, key) => list.filter(Boolean).map((x) => x[key]).filter((x) => x !== null && x !== undefined);
    const opens = [];
    for (const n of plan) {
      const c1 = perTool[n].call1;
      const c2 = perTool[n].call2;
      if (!c1.filter(Boolean).length) { not_measured.push({ tool: n, reason: 'no measured call' }); continue; }
      const summ = (list) => ({
        measured_repeats: list.filter(Boolean).length,
        tool_error_repeats: list.filter((x) => x && x.tool_error).length,
        opens_server: pick(list, 'opens_server'),
        opens_children: pick(list, 'opens_children'),
        sqlite_exec_server: pick(list, 'sqlite_exec_server'),
        sqlite_prepare_server: pick(list, 'sqlite_prepare_server'),
        child_node_processes: pick(list, 'child_node_processes'),
        modules_added: pick(list, 'modules_added'),
        lib_reads: pick(list, 'lib_reads'),
        room_reads: pick(list, 'room_reads'),
        tool_ms_median: median(pick(list, 'tool_ms')),
      });
      opens.push({ tool: n, writes_to_room: !!SAFE_CALLS[n].write, reaches_cascade: !!SAFE_CALLS[n].cascade, first_call: summ(c1), second_call: summ(c2) });
    }
    const code = writeOut(S, H.COUNTS_SCHEMA, { repeats: S.runs, write_path: S.writePath ? 'on (MINDRIAN_MCP_FIRST=cli, room bound first)' : 'off (default: MINDRIAN_MCP_FIRST unset)', opens, not_measured });
    log('opens: ' + opens.map((o) => o.tool + ' ' + o.first_call.opens_server.join('/')).join('; '));
    return code;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// block (S8)
// ---------------------------------------------------------------------------
async function cmdBlock(f) {
  const S = await openSession(f, 'block');
  try {
    const toolKey = f.tool || 'stop_gate_check';
    const spec = SAFE_CALLS[toolKey];
    if (!spec) throw fail('no safe argument set for tool ' + toolKey);
    const delay = parseInt(f['ping-delay-ms'] || '20', 10);
    if (!Number.isInteger(delay) || delay < 0) throw fail('--ping-delay-ms must be a non-negative integer');
    const gate = await S.gate();
    const idleAcc = newAcc('mcp:block:idle-ping');
    const variants = ['cold', 'warm'];
    const accs = {};
    variants.forEach((v) => {
      accs[v] = { ping: newAcc('mcp:block:' + toolKey + ':' + v + ':ping', { ping_delay_ms: delay }), tool: newAcc('mcp:block:' + toolKey + ':' + v + ':tool', { ping_delay_ms: delay }) };
    });
    let seq = 0;
    const one = async (variant) => {
      const runId = newRunId();
      const srv = spawnServer({ script: serverScript(S, 'os'), cwd: S.ctx.roomDir, env: serverEnv(S, { MOS_PERF_RUN_ID: runId }), cpus: S.cpus, hasTaskset: S.hasTaskset });
      let out = null;
      let left = 0;
      try {
        await handshake(srv, { timeoutMs: 60000 });
        for (const p of preludeOf(S)) await srv.request('tools/call', { name: p.name, arguments: p.args }, 60000);
        await sleepMs(1500);
        if (variant === 'idle') out = { ping_ms: await idlePing(srv, 5) };
        else {
          if (variant === 'warm') await srv.request('tools/call', { name: spec.tool, arguments: spec.args('w' + (seq += 1)) }, 120000);
          out = await blockProbe(srv, { tool: spec.tool, args: spec.args('m' + (seq += 1)), pingDelayMs: delay });
        }
      } catch (_e) { out = null; } finally { left = await endRun(srv, runId); }
      return { out, left, bg: srv.background_ms || 0 };
    };
    const order = ['idle', 'cold', 'warm'];
    const errors = { cold: 0, warm: 0 };
    for (let i = 0; i < S.runs; i += 1) {
      for (const v of rotated(order, i)) {
        const { out, left, bg } = await one(v);
        if (v === 'idle') {
          idleAcc.survivors += left;
          if (!out) { idleAcc.failed += 1; continue; }
          idleAcc.exits.add(0); idleAcc.wall.push(out.ping_ms); idleAcc.bg.push(bg);
        } else {
          const a = accs[v];
          a.ping.survivors += left; a.tool.survivors += left;
          if (!out) { a.ping.failed += 1; a.tool.failed += 1; continue; }
          if (out.tool_error) errors[v] += 1;
          a.ping.exits.add(0); a.tool.exits.add(0);
          a.ping.wall.push(out.ping_ms); a.tool.wall.push(out.tool_ms);
          a.ping.bg.push(bg); a.tool.bg.push(bg);
        }
      }
    }
    const targets = [toTarget(idleAcc, gate)];
    variants.forEach((v) => {
      const tp = toTarget(accs[v].ping, gate);
      const tt = toTarget(accs[v].tool, gate);
      tp.tool_error_runs = errors[v]; tt.tool_error_runs = errors[v];
      targets.push(tp, tt);
    });
    const code = writeOut(S, H.SCHEMA, { block: { write_path: S.writePath ? 'on (MINDRIAN_MCP_FIRST=cli, room bound first)' : 'off (default: MINDRIAN_MCP_FIRST unset)', tool: spec.tool, writes_to_room: !!spec.write, reaches_cascade: !!spec.cascade, ping_delay_ms: delay, meaning: 'ping rows: wall_ms is the time from the ping send to its reply; tool rows: the time from the call send to its reply' }, targets });
    log('block ' + toolKey + ': ' + targets.map((t) => t.id + ' ' + t.wall_ms.median).join('; '));
    return code;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
async function main(argv) {
  const sub = argv[0];
  if (!USAGE[sub]) { process.stderr.write('usage: mcp-probe.cjs start | profile | idle | block | opens (see the header of the file)\n'); return 2; }
  let f;
  try { f = parseFlags(argv.slice(1)); } catch (e) { process.stderr.write(e.message + '\n' + USAGE[sub] + '\n'); return 2; }
  try {
    switch (sub) {
      case 'start': return await cmdStart(f);
      case 'profile': return await cmdProfile(f);
      case 'idle': return await cmdIdle(f);
      case 'block': return await cmdBlock(f);
      default: return await cmdOpens(f);
    }
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e).split(os.homedir()).join('~') + '\n');
    return e && e.exitCode ? e.exitCode : 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { process.stderr.write(String(err && err.stack || err) + '\n'); process.exit(1); });
}

module.exports = {
  spawnServer, handshake, toolCounts, blockProbe, idlePing, inotifyWatches, idleCost, readProc, summarizeProfile, groupOf,
  profileStart, opensPerCall, execCheck, markedPids, main, SAFE_CALLS, GROUPS,
};
