#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 382 plan 01: the performance measurement harness.
 *
 * One command measures every hook event (as Claude Code runs it: all matching hooks of one
 * event start together, the event time is the time until the last blocking hook exits), both
 * MCP server starts, doctor --all, the room scan and the section ledger check. It writes the
 * median and p95 of wall time, CPU time and peak RSS, and, in a separate untimed pass, the
 * number of modules loaded and of node starts.
 *
 * Subcommands:
 *   targets
 *   run --tree <dir> [--tree-b <dir> --out-b <file>] --room fixture|copy [--source <dir>] --runs N
 *       [--cpus N|all] [--targets all|id,id] [--set <label>] [--label <name>] [--label-b <name>]
 *       [--scratch <dir>] [--count-pass] --out <file>
 *   compare <a.json> <b.json> [--out <file>]
 *   spread --fixture <a> <b> [--fixture-rerun <a> <b>] --copy <a> <b> [--copy-rerun <a> <b>] --out <file>
 *   verify-results <dir>
 *   summarize-isolation <dir> --out <file>
 *   clean-bench --source <dir> [--scratch <dir>]
 *
 * Exit codes: 0 ok, 1 rule breach, 2 usage, 3 isolation breach, 75 host busy.
 * Canon Part 7: the hook parsing, payloads, sandbox, env and percentile come from
 * scripts/measure-hook-cold-start.cjs; the copy guard and copy come from the 381 test helpers.
 * Canon Part 8: result files hold numbers, booleans, target ids, enum strings and the labels
 * fixture-room and real-copy. Never a room name, a path or text read from a room.
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const hookLib = require(path.join(REPO, 'scripts', 'measure-hook-cold-start.cjs'));
const { assertSafeTarget } = require(path.join(REPO, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));
const { copyRoom } = require(path.join(REPO, 'tests', 'helpers', 'oracle-381.cjs'));

const SCHEMA = 'mos.perf-382/1';
const COUNTS_SCHEMA = 'mos.perf-382-counts/1';
const BASE_SHA_382 = '788d63b0e1b3a262ed5c9221dfd8cc7d49ecafa1';
const PRELOAD = path.join(__dirname, 'count-modules-preload.cjs');
const MIN_RUNS = 7;
const QUIET_LOAD1 = 2;
const MACHINE_FIELDS = ['cores', 'node', 'platform', 'arch', 'kernel', 'cpu_cap', 'fs_type', 'head_sha', 'tree_label',
  'base_sha', 'started_at', 'ended_at', 'load1_start', 'load1_end'];

// ---------------------------------------------------------------------------
// targets
// ---------------------------------------------------------------------------
const SHAPES = {
  Write: { tool: 'Write', input: (f) => ({ file_path: f, content: 'probe\n' }), response: () => ({ success: true }) },
  Read: { tool: 'Read', input: (f) => ({ file_path: f }), response: (f) => ({ type: 'text', file: { filePath: f, content: 'x' } }) },
  Bash: { tool: 'Bash', input: () => ({ command: 'ls' }), response: () => ({ stdout: '', stderr: '', interrupted: false }) },
  SlashCommand: { tool: 'SlashCommand', input: () => ({ command: '/mos:status' }), response: () => ({ success: true }) },
  brain: { tool: 'mcp__mindrian-brain__brain_query', input: () => ({ query: 'what framework fits an ill-defined problem' }), response: () => ({ content: [{ type: 'text', text: 'ok' }] }) },
  gate_answer: { tool: 'mcp__mindrian-os__gate_answer', input: () => ({ gate_id: 'probe-gate', answer: 'approve' }), response: () => ({ success: true }) },
};

const EVENT_TARGETS = [
  ['event:SessionStart:changed', 'SessionStart', null, 'changed'],
  ['event:SessionStart:unchanged', 'SessionStart', null, 'unchanged'],
  ['event:UserPromptSubmit', 'UserPromptSubmit', null, null],
  ['event:Stop:changed', 'Stop', null, 'changed'],
  ['event:Stop:unchanged', 'Stop', null, 'unchanged'],
  ['event:PreToolUse:Write', 'PreToolUse', 'Write', null],
  ['event:PreToolUse:brain', 'PreToolUse', 'brain', null],
  ['event:PreToolUse:gate_answer', 'PreToolUse', 'gate_answer', null],
  ['event:PostToolUse:Read', 'PostToolUse', 'Read', null],
  ['event:PostToolUse:Write', 'PostToolUse', 'Write', null],
  ['event:PostToolUse:Bash', 'PostToolUse', 'Bash', null],
  ['event:PostToolUse:SlashCommand', 'PostToolUse', 'SlashCommand', null],
  ['event:PostToolUse:brain', 'PostToolUse', 'brain', null],
  ['event:PreCompact', 'PreCompact', null, null],
  ['event:PostCompact', 'PostCompact', null, null],
  ['event:SessionEnd', 'SessionEnd', null, null],
  ['event:FileChanged', 'FileChanged', null, null],
  ['event:CwdChanged', 'CwdChanged', null, null],
  ['event:SubagentStop', 'SubagentStop', null, null],
  ['event:TaskCompleted', 'TaskCompleted', null, null],
];

const COMMAND_TARGETS = {
  'mcp:mindrian-os': { kind: 'mcp', script: 'mindrian-mcp-server.cjs' },
  'mcp:mindrian-brain': { kind: 'mcp', script: 'mindrian-brain-mcp-client.cjs' },
  'doctor:all': { kind: 'cmd', timeoutMs: 900000, argv: (t) => [process.execPath, path.join(t, 'scripts', 'doctor.cjs'), '--all', '--json'] },
  'scan:room-scan': { kind: 'cmd', argv: (t, room) => [process.execPath, '-e', 'require(process.argv[1]).scanRoom(process.argv[2]).then(() => process.exit(0), () => process.exit(1));', path.join(t, 'lib', 'core', 'room-scan.cjs'), room] },
  'scan:compute-state': { kind: 'cmd', argv: (t, room) => ['bash', path.join(t, 'scripts', 'compute-state'), room] },
  'scan:compute-team': { kind: 'cmd', argv: (t, room) => ['bash', path.join(t, 'scripts', 'compute-team'), room] },
  'scan:analyze-room': { kind: 'cmd', argv: (t, room) => ['bash', path.join(t, 'scripts', 'analyze-room'), room] },
  'ledger:section-check': { kind: 'cmd', cwdTree: true, argv: (t) => [process.execPath, path.join(t, 'scripts', 'build-section-command-ledger.cjs'), '--check'] },
  'floor:node': { kind: 'cmd', argv: () => [process.execPath, '-e', '0'] },
};

const TARGETS = EVENT_TARGETS.map((e) => e[0]).concat(Object.keys(COMMAND_TARGETS));

function targetDef(id) {
  const ev = EVENT_TARGETS.find((e) => e[0] === id);
  if (ev) return { id, kind: 'event', event: ev[1], shape: ev[2], change: ev[3] };
  if (COMMAND_TARGETS[id]) return Object.assign({ id }, COMMAND_TARGETS[id]);
  return null;
}

// ---------------------------------------------------------------------------
// statistics and gates (pure, testable)
// ---------------------------------------------------------------------------
function round1(x) { return x === null || x === undefined ? null : Math.round(x * 10) / 10; }

// median: the middle sample (the mean of the two middle ones for an even n). p95: the percentile()
// rule of scripts/measure-hook-cold-start.cjs, index floor(0.95 x (n - 1)); at n = 7 it is the second-largest sample.
function statsSummary(samples) {
  const s = samples.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return { median: null, p95: null, min: null, max: null };
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { median: round1(mid), p95: round1(hookLib.percentile(s, 0.95)), min: round1(s[0]), max: round1(s[s.length - 1]) };
}

function spreadPct(m1, m2) {
  const mean = (m1 + m2) / 2;
  if (!mean) return 0;
  return round1((Math.abs(m1 - m2) / mean) * 100);
}

function quietState(load1) { return load1 < QUIET_LOAD1 ? 'quiet' : 'not quiet'; }

function readLoad1() {
  try { return parseFloat(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]); } catch (_e) { return 0; }
}

function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitQuiet(opts) {
  const o = Object.assign({ readLoad: readLoad1, sleep: sleepMs, pollMs: 15000, maxMs: 900000 }, opts || {});
  let waited = 0;
  let load = o.readLoad();
  while (quietState(load) !== 'quiet') {
    if (waited >= o.maxMs) return { ok: false, load1: load, waited_ms: waited };
    await o.sleep(o.pollMs);
    waited += o.pollMs;
    load = o.readLoad();
  }
  return { ok: true, load1: load, waited_ms: waited };
}

function listCmdlines() {
  const out = [];
  let pids = [];
  try { pids = fs.readdirSync('/proc').filter((d) => /^[0-9]+$/.test(d) && Number(d) !== process.pid); } catch (_e) { return out; }
  for (const pid of pids) {
    try { out.push(fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').join(' ')); } catch (_e) { /* gone */ }
  }
  return out;
}

function suiteGuard(cmdlines) {
  const lines = cmdlines || listCmdlines();
  return lines.some((l) => l.indexOf('tests/run-all-') !== -1) ? 'busy' : 'ok';
}

// A B, B A, A B, B A ... : alternating pairs, so a drift in host speed hits both trees alike.
function interleaveOrder(pairs) {
  const out = [];
  for (let i = 0; i < pairs; i += 1) {
    if (i % 2 === 0) out.push('A', 'B'); else out.push('B', 'A');
  }
  return out;
}

function part8Violations(text, ctx) {
  const c = ctx || {};
  const bad = [];
  const has = (needle, name) => { if (needle && needle.length > 3 && text.indexOf(needle) !== -1) bad.push(name); };
  has(c.home, 'home_path');
  has(c.sourceRoom, 'source_room_path');
  has(c.scratch, 'scratch_path');
  if (/MindrianRooms/i.test(text)) bad.push('MindrianRooms_segment');
  if (/\/home\//.test(text)) bad.push('home_prefix');
  if (/\/mnt\/c\//i.test(text)) bad.push('mnt_c_prefix');
  return bad;
}

function guardedCopy(src, dst) {
  assertSafeTarget(dst);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  copyRoom(src, dst);
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function fsType(p) {
  const r = cp.spawnSync('stat', ['-f', '-c', '%T', p], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

function walkFiles(root) {
  const files = [];
  (function walk(dir) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f); else files.push(f);
    }
  })(root);
  return files;
}

function roomCounts(root) {
  let n = 0;
  let b = 0;
  for (const f of walkFiles(root)) {
    try { const st = fs.lstatSync(f); n += 1; b += st.size; } catch (_e) { /* gone */ }
  }
  return { file_count: n, byte_total: b };
}

function manifest(root) {
  const m = new Map();
  for (const f of walkFiles(root)) {
    try { const st = fs.lstatSync(f); m.set(path.relative(root, f), st.size + ':' + st.mtimeMs); } catch (_e) { /* gone */ }
  }
  return m;
}

function countsFromManifest(m) {
  let b = 0;
  for (const v of m.values()) b += Number(String(v).split(':')[0]) || 0;
  return { file_count: m.size, byte_total: b };
}

function changedPaths(before, after) {
  const out = new Set();
  for (const [k, v] of after) if (before.get(k) !== v) out.add(k);
  for (const k of before.keys()) if (!after.has(k)) out.add(k);
  return out;
}

const IGNORED_ARTIFACTS = /^(STATE\.md|STATE\.md\.tmp\..*|FEYNMAN\.md|MINTO\.md|BRIEF\.md|MEETINGS-INTELLIGENCE\.md|action-items\.md)$/;

// The artifact a TOUCH changes: the newest .md at depth 1 of the first section, in byte order, that the
// room-changed check does not ignore (381-MEASUREMENTS.md notes 1 and 2). Null when the room has none.
function findTouchTarget(roomDir) {
  let sections = [];
  try { sections = fs.readdirSync(roomDir, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name[0] !== '.').map((e) => e.name); } catch (_e) { return null; }
  sections.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  for (const s of sections) {
    let files = [];
    try { files = fs.readdirSync(path.join(roomDir, s), { withFileTypes: true }).filter((e) => e.isFile() && /\.md$/.test(e.name) && e.name[0] !== '.' && !IGNORED_ARTIFACTS.test(e.name)); } catch (_e) { continue; }
    if (!files.length) continue;
    files.sort((a, b) => fs.statSync(path.join(roomDir, s, b.name)).mtimeMs - fs.statSync(path.join(roomDir, s, a.name)).mtimeMs);
    return path.join(roomDir, s, files[0].name);
  }
  return null;
}

function scrubbedEnv(base) {
  const env = Object.assign({}, base);
  for (const k of Object.keys(env)) {
    if (/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(k) || /^(THEO|BRAIN|SUPABASE)/i.test(k)) delete env[k];
  }
  return env;
}

function hookId(command) {
  return command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, '').replace(/"/g, '').replace(/^node /, '').slice(0, 80);
}

function matches(matcher, tool) {
  if (!matcher) return true;
  if (!tool) return false;
  return new RegExp('^(' + matcher + ')$').test(tool);
}

function groupAlive(pid) {
  try { process.kill(-pid, 0); return true; } catch (_e) { return false; }
}

function killGroup(pid) {
  try { process.kill(-pid, 'SIGKILL'); } catch (_e) { /* gone */ }
}

// ---------------------------------------------------------------------------
// running one child under taskset and GNU time
// ---------------------------------------------------------------------------
let timeSeq = 0;

function wrapArgv(argv, ctx, timeFile, noTime) {
  const out = [];
  if (ctx.cpus !== 'all' && ctx.hasTaskset) out.push('taskset', '-c', '0-' + (ctx.cpus - 1));
  if (!noTime) out.push('/usr/bin/time', '-f', '%e %U %S %M', '-o', timeFile);
  return out.concat(argv);
}

let clockTicks = null;
function tickMs() {
  if (clockTicks === null) {
    const r = cp.spawnSync('getconf', ['CLK_TCK'], { encoding: 'utf8' });
    clockTicks = r.status === 0 && Number(r.stdout) > 0 ? Number(r.stdout) : 100;
  }
  return 1000 / clockTicks;
}

// CPU and peak RSS of one live process from /proc (used for the MCP servers, which are stopped by a kill,
// so GNU time cannot report them): CPU is user plus system time since spawn, RSS is VmHWM.
function readProc(pid) {
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    const parts = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const cpuMs = (Number(parts[11]) + Number(parts[12])) * tickMs();
    const m = fs.readFileSync('/proc/' + pid + '/status', 'utf8').match(/VmHWM:\s+([0-9]+) kB/);
    if (!Number.isFinite(cpuMs) || !m) return null;
    return { cpu_ms: cpuMs, rss_mb: Number(m[1]) / 1024 };
  } catch (_e) { return null; }
}

function readUsage(timeFile) {
  try {
    const lines = fs.readFileSync(timeFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] || '';
    const p = last.split(/\s+/).map(Number);
    if (p.length === 4 && p.every((x) => Number.isFinite(x))) return { cpu_ms: (p[1] + p[2]) * 1000, rss_mb: p[3] / 1024 };
  } catch (_e) { /* no usage */ }
  return null;
}

// One child; resolves { wall_ms, status, signal, timedOut, usage, pid, extra }.
function runChild(ctx, spec) {
  const timeFile = path.join(ctx.sandbox.tmp, 'time-' + (timeSeq += 1));
  const full = wrapArgv(spec.argv, ctx, timeFile, spec.procUsage);
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const elapsed = () => Number(process.hrtime.bigint() - t0) / 1e6;
    const child = cp.spawn(full[0], full.slice(1), {
      cwd: spec.cwd,
      env: spec.env,
      detached: true,
      stdio: [spec.stdin !== undefined ? 'pipe' : 'ignore', spec.onStdout ? 'pipe' : 'ignore', 'ignore'],
    });
    let timedOut = false;
    let done = false;
    let wallMs = null;
    let procSnap = null;
    const timer = setTimeout(() => { timedOut = true; killGroup(child.pid); }, spec.timeoutMs || 60000);
    child.on('error', () => { /* a spawn failure shows as a null status */ });
    if (child.stdin) { child.stdin.on('error', () => {}); }
    if (spec.onStdout && child.stdout) {
      child.stdout.on('data', (d) => {
        const r = spec.onStdout(String(d), elapsed());
        if (r && wallMs === null) { wallMs = r.wall_ms; if (spec.procUsage) procSnap = readProc(child.pid); if (r.finish) r.finish(child); }
      });
    }
    if (child.stdin && spec.stdin !== undefined && !spec.keepStdin) child.stdin.end(spec.stdin);
    else if (child.stdin && spec.stdin !== undefined) child.stdin.write(spec.stdin);
    child.on('exit', (code, sig) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({
        wall_ms: wallMs !== null ? wallMs : elapsed(),
        exit_ms: elapsed(),
        status: code,
        signal: sig || null,
        timedOut, replied: wallMs !== null,
        usage: spec.procUsage ? procSnap : readUsage(timeFile),
        pid: child.pid,
      });
    });
  });
}

async function settle(pid, roomDir, maxMs) {
  const t0 = Date.now();
  const lock = roomDir ? path.join(roomDir, '.mindrian', 'state-recompute.lock') : null;
  while (Date.now() - t0 < maxMs && (groupAlive(pid) || (lock && fs.existsSync(lock)))) await sleepMs(200);
  const stuck = groupAlive(pid);
  if (stuck) killGroup(pid);
  return { ms: Date.now() - t0, killed: stuck };
}

// ---------------------------------------------------------------------------
// one run of one target
// ---------------------------------------------------------------------------
function exitCode(r) { return r.signal ? 'signal:' + r.signal : r.status; }

async function runEventOnce(def, ctx, opts) {
  const o = opts || {};
  const roomDir = ctx.roomDir;
  const shape = def.shape ? SHAPES[def.shape] : null;
  const tool = def.event === 'SessionStart' ? 'startup' : (shape ? shape.tool : null);
  const entries = ctx.hooks.filter((e) => e.event === def.event && matches(e.matcher, tool));
  if (def.change === 'changed' && !o.noTouch) {
    await sleepMs(1100);
    if (ctx.touchTarget) { const now = new Date(); fs.utimesSync(ctx.touchTarget, now, now); }
  }
  const artifact = ctx.touchTarget || path.join(roomDir, 'STATE.md');
  const payload = hookLib.payloadFor(def.event, { cwd: roomDir, transcript: ctx.sandbox.transcript }, null);
  payload.session_id = 'sess-382-measure';
  if (shape) {
    payload.tool_name = shape.tool;
    payload.tool_input = shape.input(artifact);
    if (def.event === 'PostToolUse') payload.tool_response = shape.response(artifact);
  }
  const stdin = JSON.stringify(payload);
  const env = ctx.env(o.extraEnv);
  const skipped = [];
  const jobs = [];
  for (const e of entries) {
    if (hookLib.isNetworkCapable(e)) { skipped.push({ hook: hookId(e.command), reason: 'network_capable' }); continue; }
    const command = e.command.split('${CLAUDE_PLUGIN_ROOT}').join(ctx.tree);
    jobs.push({ entry: e, id: hookId(e.command), promise: runChild(ctx, { argv: ['bash', '-c', command], cwd: roomDir, env, stdin, timeoutMs: (e.timeout_ms || 60000) + 1000 }) });
  }
  const results = await Promise.all(jobs.map(async (j) => { const r = await j.promise; return Object.assign({ job: j }, r); }));
  const blocking = results.filter((r) => !r.job.entry.async);
  const asyncs = results.filter((r) => r.job.entry.async);
  const wall = blocking.length ? Math.max.apply(null, blocking.map((r) => r.exit_ms)) : null;
  const sample = {
    wall_ms: wall,
    cpu_ms: blocking.every((r) => r.usage) ? blocking.reduce((a, r) => a + r.usage.cpu_ms, 0) : null,
    rss_mb: blocking.every((r) => r.usage) && blocking.length ? Math.max.apply(null, blocking.map((r) => r.usage.rss_mb)) : null,
    exits: results.map(exitCode),
    timed_out: results.filter((r) => r.timedOut).length,
    async_hooks: asyncs.map((r) => ({ id: r.job.id, wall_ms: r.exit_ms })),
    skipped,
    hook_count: jobs.length,
    blocking_count: blocking.length,
  };
  let bg = 0;
  for (const r of results) {
    const s = await settle(r.pid, roomDir, o.settleMs || 120000);
    bg = Math.max(bg, s.ms);
  }
  sample.background_ms = bg;
  return sample;
}

async function runCommandOnce(def, ctx) {
  const env = ctx.env();
  const cwd = def.cwdTree ? ctx.tree : ctx.roomDir;
  if (def.kind === 'mcp') {
    const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'perf-382', version: '1' } } }) + '\n';
    let buf = '';
    const r = await runChild(ctx, {
      argv: [process.execPath, path.join(ctx.tree, 'scripts', def.script)],
      cwd, env, stdin: req, keepStdin: true, procUsage: true, timeoutMs: 60000,
      onStdout: (chunk, ms) => {
        buf += chunk;
        for (const line of buf.split('\n')) {
          if (!line.trim() || line.trim()[0] !== '{') continue;
          try {
            const j = JSON.parse(line);
            if (j && j.id === 1 && (j.result || j.error)) {
              return { wall_ms: ms, finish: (child) => { try { child.stdin.end(); } catch (_e) { /* closed */ } setTimeout(() => killGroup(child.pid), 1500).unref(); } };
            }
          } catch (_e) { /* partial line */ }
        }
        return null;
      },
    });
    await settle(r.pid, null, 10000);
    return { wall_ms: r.wall_ms, cpu_ms: r.usage ? r.usage.cpu_ms : null, rss_mb: r.usage ? r.usage.rss_mb : null, exits: [r.replied && r.signal === "SIGKILL" && !r.timedOut ? "stopped_after_reply" : exitCode(r)], timed_out: r.timedOut ? 1 : 0, async_hooks: [], skipped: [], hook_count: 1, blocking_count: 1, background_ms: 0 };
  }
  const r = await runChild(ctx, { argv: def.argv(ctx.tree, ctx.roomDir), cwd, env, stdin: undefined, timeoutMs: def.timeoutMs || 300000 });
  const s = await settle(r.pid, null, 30000);
  return { wall_ms: r.exit_ms, cpu_ms: r.usage ? r.usage.cpu_ms : null, rss_mb: r.usage ? r.usage.rss_mb : null, exits: [exitCode(r)], timed_out: r.timedOut ? 1 : 0, async_hooks: [], skipped: [], hook_count: 1, blocking_count: 1, background_ms: s.ms };
}

function runOnce(def, ctx, opts) {
  return def.kind === 'event' ? runEventOnce(def, ctx, opts) : runCommandOnce(def, ctx);
}

// ---------------------------------------------------------------------------
// measuring one target over N runs (single tree, or two trees interleaved)
// ---------------------------------------------------------------------------
async function measureTarget(def, ctxs, runs) {
  const acc = ctxs.map(() => ({ wall: [], cpu: [], rss: [], bg: [], exits: new Set(), timedOut: 0, skipped: new Map(), asyncs: new Map(), hooks: 0, blocking: 0, load1_start: readLoad1(), touch: !!ctxs[0].touchTarget }));
  if (def.kind === 'event' && def.change === 'unchanged') {
    for (const c of ctxs) { await runEventOnce(def, c, { noTouch: true }); await sleepMs(1100); }
  }
  const order = ctxs.length === 2 ? interleaveOrder(runs) : new Array(runs).fill('A');
  for (const lab of order) {
    const i = lab === 'A' ? 0 : 1;
    const s = await runOnce(def, ctxs[i], {});
    const a = acc[i];
    if (s.wall_ms !== null) a.wall.push(s.wall_ms);
    if (s.cpu_ms !== null) a.cpu.push(s.cpu_ms);
    if (s.rss_mb !== null) a.rss.push(s.rss_mb);
    a.bg.push(s.background_ms);
    s.exits.forEach((x) => a.exits.add(x));
    a.timedOut += s.timed_out;
    s.skipped.forEach((k) => a.skipped.set(k.hook, k.reason));
    s.async_hooks.forEach((h) => { const l = a.asyncs.get(h.id) || []; l.push(h.wall_ms); a.asyncs.set(h.id, l); });
    a.hooks = s.hook_count;
    a.blocking = s.blocking_count;
  }
  return acc.map((a) => ({
    id: def.id,
    n: a.wall.length,
    blocking: a.blocking > 0,
    wall_ms: statsSummary(a.wall),
    cpu_ms: statsSummary(a.cpu),
    rss_mb: statsSummary(a.rss),
    exits: [...a.exits].sort((x, y) => String(x).localeCompare(String(y))),
    timed_out: a.timedOut,
    not_measured: [...a.skipped].map(([hook, reason]) => ({ hook, reason })),
    async_hooks: [...a.asyncs].map(([id, l]) => ({ id, wall_ms: statsSummary(l).median })),
    hook_count: a.hooks,
    background_ms: statsSummary(a.bg).median,
    touch_applied: def.change === 'changed' ? a.touch : null,
    load1_start: a.load1_start,
    load1_end: readLoad1(),
  }));
}

// the untimed count pass: modules loaded and node starts per target
async function countTarget(def, ctx) {
  const log = path.join(ctx.sandbox.tmp, 'count-' + (timeSeq += 1) + '.log');
  const extraEnv = { NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + PRELOAD).trim(), MOS_PERF_COUNT_LOG: log };
  const c2 = Object.assign({}, ctx, { env: (x) => ctx.env(Object.assign({}, extraEnv, x || {})) });
  if (def.kind === 'event' && def.change === 'unchanged') await runEventOnce(def, c2, { noTouch: true });
  await runOnce(def, c2, { extraEnv });
  let lines = [];
  try { lines = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_e) { lines = []; }
  const mods = lines.map((l) => l.modules);
  return {
    id: def.id,
    node_starts: lines.length,
    modules_total: mods.reduce((a, b) => a + b, 0),
    modules_max_per_process: mods.length ? Math.max.apply(null, mods) : 0,
  };
}

// ---------------------------------------------------------------------------
// room and sandbox preparation
// ---------------------------------------------------------------------------
function benchDir(source, scratch) {
  if (source && source.startsWith('/mnt/')) {
    const m = source.match(/^\/mnt\/c\/Users\/([^/]+)\//);
    if (m) return path.join('/mnt/c/Users', m[1], 'AppData/Local/Temp/mos-382-bench');
  }
  return path.join(scratch, 'mos-382-bench');
}

function stripRemotes(roomDir) {
  if (!fs.existsSync(path.join(roomDir, '.git'))) return 0;
  const r = cp.spawnSync('git', ['-C', roomDir, 'remote'], { encoding: 'utf8' });
  const names = r.status === 0 ? r.stdout.split('\n').map((s) => s.trim()).filter(Boolean) : [];
  for (const n of names) cp.spawnSync('git', ['-C', roomDir, 'remote', 'remove', n], { encoding: 'utf8' });
  return names.length;
}

// Bring the working copy back to the snapshot state. A first restore is a full copy; later ones fix only the
// files whose size or mtime differ, because a full copy of a room over 9p takes minutes.
function restoreCopy(snap, work) {
  if (!fs.existsSync(work)) { guardedCopy(snap, work); return; }
  assertSafeTarget(work);
  const want = manifest(snap);
  const have = manifest(work);
  for (const rel of have.keys()) if (!want.has(rel)) fs.rmSync(path.join(work, rel), { force: true });
  for (const [rel, v] of want) {
    if (have.get(rel) === v) continue;
    const dst = path.join(work, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.rmSync(dst, { force: true });
    const r = cp.spawnSync('cp', ['-a', path.join(snap, rel), dst], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('restore failed for one file');
  }
}

function writeCopyRegistry(roomsHome, roomDir) {
  const dir = path.join(roomsHome, '.rooms');
  fs.mkdirSync(dir, { recursive: true });
  const slug = 'bench-room';
  fs.writeFileSync(path.join(dir, 'registry.json'), JSON.stringify({
    version: 1, root: roomsHome, active: slug,
    rooms: { [slug]: { path: roomDir, abs_path: roomDir, status: 'active', venture_name: 'bench', git_enabled: false, git_remote: null, auto_push: false } },
  }));
}

function buildFixtureRoom(tree, sandbox) {
  const seed = path.join(tree, 'tests', 'fixtures', 'release-room');
  const code = 'const m = require(process.argv[1]); m.buildRoom({}, process.argv[2], process.argv[3], process.argv[4]).then((r) => { process.stdout.write(JSON.stringify({ roomDir: r.roomDir }) + "\\n"); process.exit(0); }, (e) => { process.stderr.write(String(e && e.message) + "\\n"); process.exit(1); });';
  const env = scrubbedEnv(Object.assign({}, process.env, { HOME: sandbox.home, USERPROFILE: sandbox.home, TMPDIR: sandbox.tmp, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', MINDRIAN_ROOMS_HOME: sandbox.roomsHome }));
  const r = cp.spawnSync(process.execPath, ['-e', code, path.join(tree, 'scripts', 'real-room-run.cjs'), BASE_SHA_382, seed, sandbox.roomsHome], { cwd: tree, env, encoding: 'utf8', timeout: 300000 });
  if (r.status !== 0) throw new Error('fixture room build failed: ' + String(r.stderr || '').slice(0, 300));
  const line = r.stdout.trim().split('\n').pop();
  return JSON.parse(line).roomDir;
}

function prepareRoom(kind, o) {
  const sandbox = hookLib.makeSandbox('mos-382-run-');
  let roomDir = sandbox.roomDir;
  let sourceRoom = null;
  let benchRoot = null;
  let removedRemotes = 0;
  if (kind === 'fixture') {
    roomDir = buildFixtureRoom(o.trees[0], sandbox);
  } else if (kind === 'copy') {
    sourceRoom = path.resolve(o.source);
    benchRoot = benchDir(sourceRoom, o.scratch);
    assertSafeTarget(benchRoot);
    const snap = path.join(benchRoot, 'room-snapshot');
    const work = path.join(benchRoot, 'room');
    if (!fs.existsSync(snap)) {
      guardedCopy(sourceRoom, snap);
      removedRemotes = stripRemotes(snap);
    }
    restoreCopy(snap, work);
    roomDir = work;
    writeCopyRegistry(sandbox.roomsHome, roomDir);
  }
  return { sandbox, roomDir, sourceRoom, benchRoot, removedRemotes };
}

function makeCtx(label, tree, prep, cpus, hasTaskset) {
  const hooksFile = path.join(tree, 'hooks', 'hooks.json');
  const sb = Object.assign({}, prep.sandbox, { cwd: prep.roomDir, roomDir: prep.roomDir });
  return {
    label, tree, cpus, hasTaskset, sandbox: prep.sandbox, roomDir: prep.roomDir,
    hooks: fs.existsSync(hooksFile) ? hookLib.parseHookCommands(hooksFile) : [],
    touchTarget: findTouchTarget(prep.roomDir),
    env: (extra) => scrubbedEnv(hookLib.hookEnv(sb, tree, Object.assign({ MINDRIAN_ROOMS_ROOT: prep.sandbox.roomsHome, MINDRIAN_ROOM: prep.roomDir }, extra || {}))),
  };
}

// ---------------------------------------------------------------------------
// result files
// ---------------------------------------------------------------------------
function headSha() {
  const r = cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

function machineRecord(o) {
  return {
    cores: os.cpus().length,
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    kernel: os.release(),
    cpu_cap: o.cpus,
    fs_type: o.fsType,
    head_sha: headSha(),
    tree_label: o.label,
    base_sha: BASE_SHA_382,
    started_at: o.startedAt,
    ended_at: o.endedAt,
    load1_start: o.load1Start,
    load1_end: o.load1End,
  };
}

function writeResult(file, obj, ctx) {
  const text = JSON.stringify(obj, null, 2) + '\n';
  const bad = part8Violations(text, ctx);
  if (bad.length) throw Object.assign(new Error('Part 8 scan failed: ' + bad.join(',')), { part8: true });
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, text);
}

// ---------------------------------------------------------------------------
// subcommands
// ---------------------------------------------------------------------------
function parseFlags(argv, spec) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { (o._ = o._ || []).push(a); continue; }
    const key = a.slice(2);
    const s = spec[key];
    if (s === undefined) throw new Error('unknown argument: ' + a);
    if (s === 'bool') { o[key] = true; continue; }
    const n = typeof s === 'number' ? s : 1;
    const vals = [];
    for (let k = 0; k < n; k += 1) {
      i += 1;
      if (argv[i] === undefined) throw new Error('missing value for ' + a);
      vals.push(argv[i]);
    }
    o[key] = n === 1 ? vals[0] : vals;
  }
  return o;
}

async function cmdRun(argv) {
  let f;
  try {
    f = parseFlags(argv, { tree: 1, 'tree-b': 1, 'out-b': 1, room: 1, source: 1, runs: 1, cpus: 1, targets: 1, set: 1, label: 1, 'label-b': 1, scratch: 1, 'count-pass': 'bool', out: 1, 'allow-short': 'bool' });
  } catch (e) { process.stderr.write(e.message + '\n'); return 2; }
  const runs = parseInt(f.runs, 10);
  if (!f.tree || !f.out || !['fixture', 'copy', 'synthetic'].includes(f.room) || !Number.isInteger(runs) || runs < 1) {
    process.stderr.write('usage: run --tree <dir> --room fixture|copy [--source <dir>] --runs N --out <file> (see tools/perf/README.md)\n');
    return 2;
  }
  if (f.room === 'synthetic' && !f['allow-short']) { process.stderr.write('--room synthetic is test-only and needs --allow-short\n'); return 2; }
  if (f.room === 'copy' && !f.source && !process.env.MOS_REAL_ROOM_382) { process.stderr.write('--room copy needs --source <dir> (or MOS_REAL_ROOM_382)\n'); return 2; }
  if (runs < MIN_RUNS && !f['allow-short']) { process.stderr.write('at least ' + MIN_RUNS + ' runs are required (R4); got ' + runs + '\n'); return 2; }
  if (f['tree-b'] && !f['out-b']) { process.stderr.write('--tree-b needs --out-b\n'); return 2; }
  const trees = [path.resolve(f.tree)].concat(f['tree-b'] ? [path.resolve(f['tree-b'])] : []);
  for (const t of trees) if (!fs.existsSync(path.join(t, 'hooks', 'hooks.json')) && f.room !== 'synthetic') { process.stderr.write('not a plugin tree: ' + t + '\n'); return 2; }
  const wanted = !f.targets || f.targets === 'all' ? TARGETS : f.targets.split(',');
  const defs = wanted.map(targetDef);
  if (defs.some((d) => !d)) { process.stderr.write('unknown target id in --targets\n'); return 2; }
  const avail = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  let cpus = Math.min(4, avail);
  if (f.cpus === 'all') cpus = 'all';
  else if (f.cpus !== undefined) { cpus = Math.min(parseInt(f.cpus, 10), avail); if (!(cpus >= 1)) { process.stderr.write('--cpus must be a positive integer or all\n'); return 2; } }
  const hasTaskset = os.platform() === 'linux' && cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;
  if (!fs.existsSync('/usr/bin/time')) { process.stderr.write('/usr/bin/time is required\n'); return 1; }
  const scratch = path.resolve(f.scratch || os.tmpdir());
  process.env.TMPDIR = scratch;

  // gates R3 and R2 (skipped only by the test-only --allow-short)
  if (!f['allow-short']) {
    if (suiteGuard() === 'busy') { process.stderr.write('host busy: a tests/run-all- process is running\n'); return 75; }
    const q = await waitQuiet();
    if (!q.ok) { process.stderr.write('host not quiet: load1 ' + q.load1 + ' after ' + q.waited_ms + ' ms\n'); return 75; }
  }
  const load1Start = readLoad1();
  const startedAt = new Date().toISOString();
  const source = f.room === 'copy' ? path.resolve(f.source || process.env.MOS_REAL_ROOM_382) : null;
  const srcBefore = source ? manifest(source) : null;
  const prep = prepareRoom(f.room, { trees: trees, source, scratch });
  const labels = [f.label || path.basename(trees[0])].concat(trees[1] ? [f['label-b'] || path.basename(trees[1])] : []);
  const ctxs = trees.map((t, i) => makeCtx(i === 0 ? 'A' : 'B', t, prep, cpus, hasTaskset));
  const roomKind = f.room === 'fixture' ? 'fixture-room' : (f.room === 'copy' ? 'real-copy' : 'synthetic-room');
  // one stat walk of the working copy before the targets and one after (a walk over 9p takes seconds)
  const workBefore = f.room === 'copy' ? manifest(prep.roomDir) : null;
  const counts = workBefore ? countsFromManifest(workBefore) : roomCounts(prep.roomDir);
  const room =Object.assign({ kind: roomKind }, counts, { fs_type: fsType(prep.roomDir) });
  const touchedUnion = new Set();
  const perTree = trees.map(() => []);
  let countsOut = null;
  let code = 0;
  try {
    if (f['count-pass']) {
      countsOut = [];
      for (const d of defs) countsOut.push(await countTarget(d, ctxs[0]));
    } else {
      for (const d of defs) {
        const rs = await measureTarget(d, ctxs, runs);
        rs.forEach((r, i) => perTree[i].push(r));
        process.stderr.write('[perf-harness] ' + d.id + ' median ' + rs[0].wall_ms.median + ' ms (n ' + rs[0].n + ')\n');
      }
    }
  } finally {
    // nothing to release here; the sandbox is removed below
  }
  const endedAt = new Date().toISOString();
  const load1End = readLoad1();
  if (workBefore) changedPaths(workBefore, manifest(prep.roomDir)).forEach((p) => touchedUnion.add(p));
  let isolation = { source_changed_paths: 0, copy_changed_paths: touchedUnion.size, intersect_paths: 0, exit_code: 0 };
  if (source) {
    const srcChanged = changedPaths(srcBefore, manifest(source));
    let inter = 0;
    for (const p of srcChanged) if (touchedUnion.has(p)) inter += 1;
    isolation = { source_changed_paths: srcChanged.size, copy_changed_paths: touchedUnion.size, intersect_paths: inter, exit_code: inter > 0 ? 3 : 0 };
    if (inter > 0) code = 3;
  }
  const guardCtx = { home: os.homedir(), sourceRoom: source, scratch };
  try {
    const outs = [f.out].concat(f['out-b'] ? [f['out-b']] : []);
    if (countsOut) {
      writeResult(f.out, {
        schema: COUNTS_SCHEMA,
        machine: machineRecord({ cpus, fsType: room.fs_type, label: labels[0], startedAt, endedAt, load1Start, load1End }),
        room, set: f.set || null, tree_label: labels[0], cpus, load1_start: load1Start, load1_end: load1End, started_at: startedAt, ended_at: endedAt,
        targets: countsOut,
      }, guardCtx);
    } else {
      outs.forEach((file, i) => {
        writeResult(file, {
          schema: SCHEMA,
          machine: machineRecord({ cpus, fsType: room.fs_type, label: labels[i], startedAt, endedAt, load1Start, load1End }),
          room, set: f.set || null, tree_label: labels[i], cpus, runs, load1_start: load1Start, load1_end: load1End, started_at: startedAt, ended_at: endedAt,
          isolation: i === 0 ? isolation : undefined,
          targets: perTree[i],
        }, guardCtx);
      });
    }
  } catch (e) {
    process.stderr.write(String(e.message) + '\n');
    prep.sandbox.cleanup();
    return 1;
  }
  prep.sandbox.cleanup();
  if (code === 3) process.stderr.write('possible isolation breach: ' + isolation.intersect_paths + ' path(s) changed in both the copy and the source\n');
  return code;
}

function readResult(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function pairLines(a, b) {
  const byId = new Map((b.targets || []).map((t) => [t.id, t]));
  const rows = [];
  for (const t of a.targets || []) {
    const u = byId.get(t.id);
    if (!u || t.wall_ms.median === null || u.wall_ms.median === null) continue;
    rows.push({ id: t.id, median_a: t.wall_ms.median, median_b: u.wall_ms.median, spread_pct: spreadPct(t.wall_ms.median, u.wall_ms.median), n_a: t.n, n_b: u.n });
  }
  return rows;
}

function cmdCompare(argv) {
  let f;
  try { f = parseFlags(argv, { out: 1 }); } catch (e) { process.stderr.write(e.message + '\n'); return 2; }
  if (!f._ || f._.length !== 2) { process.stderr.write('usage: compare <a.json> <b.json> [--out <file>]\n'); return 2; }
  const rows = pairLines(readResult(f._[0]), readResult(f._[1]));
  for (const r of rows) process.stdout.write(r.id + ' median_a=' + r.median_a + ' median_b=' + r.median_b + ' spread_pct=' + r.spread_pct + '\n');
  const max = rows.reduce((m, r) => Math.max(m, r.spread_pct), 0);
  process.stdout.write('overall max spread_pct=' + max + '\n');
  if (f.out) fs.writeFileSync(f.out, JSON.stringify({ rows, max_spread_pct: max }, null, 2) + '\n');
  return 0;
}

function cmdSpread(argv) {
  let f;
  try { f = parseFlags(argv, { fixture: 2, 'fixture-rerun': 2, copy: 2, 'copy-rerun': 2, out: 1 }); } catch (e) { process.stderr.write(e.message + '\n'); return 2; }
  if (!f.fixture || !f.copy || !f.out) { process.stderr.write('usage: spread --fixture <a> <b> --copy <a> <b> [--fixture-rerun <a> <b>] [--copy-rerun <a> <b>] --out <file>\n'); return 2; }
  const out = { schema: 'mos.perf-382-spread/1', rule: 'spread_pct = |m1 - m2| / ((m1 + m2) / 2) x 100 on the median wall time; above 10 percent the target is re-measured at n = 15 and the new spread replaces it; still above 10 percent it is unstable', rooms: {} };
  for (const [key, label] of [['fixture', 'fixture-room'], ['copy', 'real-copy']]) {
    const base = pairLines(readResult(f[key][0]), readResult(f[key][1]));
    const rerun = f[key + '-rerun'] ? new Map(pairLines(readResult(f[key + '-rerun'][0]), readResult(f[key + '-rerun'][1])).map((r) => [r.id, r])) : new Map();
    const targets = base.map((r) => {
      const rr = r.spread_pct > 10 ? rerun.get(r.id) : null;
      const used = rr || r;
      return { id: r.id, median_set1: used.median_a, median_set2: used.median_b, spread_pct: used.spread_pct, n_used: Math.min(used.n_a, used.n_b), first_pass_spread_pct: r.spread_pct, remeasured: !!rr, unstable: used.spread_pct > 10 };
    });
    out.rooms[label] = { max_spread_pct: targets.reduce((m, t) => Math.max(m, t.spread_pct), 0), target_count: targets.length, unstable_count: targets.filter((t) => t.unstable).length, targets };
  }
  fs.writeFileSync(f.out, JSON.stringify(out, null, 2) + '\n');
  for (const [k, v] of Object.entries(out.rooms)) process.stdout.write(k + ' max_spread_pct=' + v.max_spread_pct + ' unstable=' + v.unstable_count + '\n');
  return 0;
}

function cmdVerify(argv) {
  const dir = argv[0];
  if (!dir || !fs.existsSync(dir)) { process.stderr.write('usage: verify-results <dir>\n'); return 2; }
  let bad = 0;
  const fail = (file, msg) => { bad += 1; process.stderr.write(file + ': ' + msg + '\n'); };
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    let j;
    try { j = readResult(path.join(dir, name)); } catch (_e) { fail(name, 'not valid JSON'); continue; }
    if (!j || (j.schema !== SCHEMA && j.schema !== COUNTS_SCHEMA)) continue;
    const m = j.machine || {};
    for (const k of MACHINE_FIELDS) if (m[k] === undefined || m[k] === null) fail(name, 'missing machine field ' + k);
    if (typeof m.load1_start === 'number' && m.load1_start >= QUIET_LOAD1) fail(name, 'load1_start ' + m.load1_start + ' is not below ' + QUIET_LOAD1);
    if (j.schema === SCHEMA) {
      if (!Array.isArray(j.targets) || !j.targets.length) fail(name, 'no targets');
      for (const t of j.targets || []) {
        if (!(t.n >= MIN_RUNS)) fail(name, 'target ' + t.id + ' has n ' + t.n + ' (needs ' + MIN_RUNS + ' or more)');
      }
    }
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const v = part8Violations(text, { home: os.homedir(), sourceRoom: null, scratch: null });
    if (v.length) fail(name, 'Part 8 scan: ' + v.join(','));
  }
  if (!bad) process.stdout.write('verify-results: OK\n');
  return bad ? 1 : 0;
}

function cmdIsolation(argv) {
  let f;
  try { f = parseFlags(argv, { out: 1 }); } catch (e) { process.stderr.write(e.message + '\n'); return 2; }
  const dir = f._ && f._[0];
  if (!dir || !f.out) { process.stderr.write('usage: summarize-isolation <dir> --out <file>\n'); return 2; }
  const files = {};
  let worst = 0;
  for (const name of fs.readdirSync(dir).filter((n) => /^set[0-9]+-(fixture|copy)\.json$/.test(n)).sort()) {
    const j = readResult(path.join(dir, name));
    if (j.isolation) { files[name.replace(/\.json$/, '')] = j.isolation; worst = Math.max(worst, j.isolation.exit_code || 0); }
  }
  fs.writeFileSync(f.out, JSON.stringify({ schema: 'mos.perf-382-isolation/1', harness_exit_code: worst, sets: files }, null, 2) + '\n');
  return 0;
}

function cmdCleanBench(argv) {
  let f;
  try { f = parseFlags(argv, { source: 1, scratch: 1 }); } catch (e) { process.stderr.write(e.message + '\n'); return 2; }
  const root = benchDir(f.source ? path.resolve(f.source) : null, path.resolve(f.scratch || os.tmpdir()));
  if (path.basename(root) !== 'mos-382-bench') return 2;
  fs.rmSync(root, { recursive: true, force: true });
  return 0;
}

async function main(argv) {
  const sub = argv[0];
  const rest = argv.slice(1);
  switch (sub) {
    case 'targets': TARGETS.forEach((t) => process.stdout.write(t + '\n')); return 0;
    case 'run': return cmdRun(rest);
    case 'compare': return cmdCompare(rest);
    case 'spread': return cmdSpread(rest);
    case 'verify-results': return cmdVerify(rest);
    case 'summarize-isolation': return cmdIsolation(rest);
    case 'clean-bench': return cmdCleanBench(rest);
    default:
      process.stderr.write('usage: perf-harness.cjs targets | run | compare | spread | verify-results | summarize-isolation | clean-bench (see tools/perf/README.md)\n');
      return 2;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { process.stderr.write(String(err && err.stack || err) + '\n'); process.exit(1); });
}

module.exports = {
  SCHEMA, COUNTS_SCHEMA, BASE_SHA_382, TARGETS, MACHINE_FIELDS,
  statsSummary, spreadPct, quietState, waitQuiet, suiteGuard, interleaveOrder, part8Violations, guardedCopy,
  findTouchTarget, pairLines, main,
};
