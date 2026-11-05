#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 01: the performance measurement harness (carried over from the Phase 382 branch,
 * commit 5850f067e, and reviewed; see the harness-review file of the phase).
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
 *       [--scratch <dir>] [--count-pass] [--restore per-target|per-set] [--base-sha <40 hex>] --out <file>
 *   (test-only, need MOS_PERF_SELFTEST=1: --allow-short, --skip-gates, --settle-ms)
 *   compare <a.json> <b.json> [--out <file>]
 *   spread --fixture <a> <b> [--fixture-rerun <a> <b>] --copy <a> <b> [--copy-rerun <a> <b>] --out <file>
 *   verify-results <dir>
 *   summarize-isolation <dir> --out <file>
 *   clean-bench (--source <dir> | --all) [--scratch <dir>]
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
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..', '..');
const hookLib = require(path.join(REPO, 'scripts', 'measure-hook-cold-start.cjs'));
const { assertSafeTarget } = require(path.join(REPO, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));
const { copyRoom } = require(path.join(REPO, 'tests', 'helpers', 'oracle-381.cjs'));

const SCHEMA = 'mos.perf-384/1';
const COUNTS_SCHEMA = 'mos.perf-384-counts/1';
const SPREAD_SCHEMA = 'mos.perf-384-spread/1';
const ISOLATION_SCHEMA = 'mos.perf-384-isolation/1';
const BENCH_NAME = 'mos-384-bench';
const GATE_POLL_MS = 5000;
const GATE_MAX_MS = 300000;
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
  // plan 384-02: a Stop with a 4 MiB transcript (above the 2 MiB tail cap of lib/hmi/turn-text.cjs, so the tail branch runs)
  // and a SessionStart with source = compact. The fifth element is merged into the target definition.
  ['event:Stop:changed:tx4m', 'Stop', null, 'changed', { transcript: 'tx4m' }],
  ['event:Stop:unchanged:tx4m', 'Stop', null, 'unchanged', { transcript: 'tx4m' }],
  ['event:SessionStart:compact', 'SessionStart', null, null, { source: 'compact' }],
];

const TRANSCRIPT_4M = 4194304;

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
  if (ev) return Object.assign({ id, kind: 'event', event: ev[1], shape: ev[2], change: ev[3] }, ev[4] || {});
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

// The per-target gate: load1 below 2 and no tests/run-all- process. Polls every pollMs up to maxMs.
// ok false carries the reason (load or suite) of the last poll; the caller marks the target noisy and runs it anyway.
async function gateBeforeTarget(opts) {
  const o = Object.assign({ readLoad: readLoad1, listCmdlines: listCmdlines, sleep: sleepMs, pollMs: GATE_POLL_MS, maxMs: GATE_MAX_MS }, opts || {});
  let waited = 0;
  for (;;) {
    const load = o.readLoad();
    const suite = suiteGuard(o.listCmdlines()) === 'busy';
    const loud = quietState(load) !== 'quiet';
    if (!loud && !suite) return { ok: true, load1: load, waited_ms: waited };
    if (waited >= o.maxMs) return { ok: false, load1: load, waited_ms: waited, reason: suite ? 'suite' : 'load' };
    await o.sleep(o.pollMs);
    waited += o.pollMs;
  }
}

// classifyRun: failed for exit 126, exit 127, a signal nobody sent on purpose, or a spawn failure;
// timeout for a run the harness killed at its limit; ok otherwise (a hook may exit 1 or 2 on purpose).
// A kill after the reply of an MCP server (replied and SIGKILL, no timeout) is the harness stopping it: ok.
function classifyRun(r) {
  if (r.timedOut) return 'timeout';
  if (r.signal) return r.replied && r.signal === 'SIGKILL' ? 'ok' : 'failed';
  if (r.status === null || r.status === undefined) return 'failed';
  if (r.status === 126 || r.status === 127) return 'failed';
  return 'ok';
}

function defaultLockFile(env) {
  const e = env || process.env;
  return e.MOS_PERF_LOCK_FILE || path.join(e.HOME || os.homedir(), '.cache', 'mos-perf-384.lock');
}

// requireLock: true when the lock file is flock-held by this process or by one of its ancestors.
// /proc/locks shows `FLOCK ADVISORY WRITE <pid> <major>:<minor>:<inode> 0 EOF`; flock(1) is the parent of its command.
function requireLock(opts) {
  const o = Object.assign({
    lockFile: defaultLockFile(),
    pid: process.pid,
    readLocks: () => fs.readFileSync('/proc/locks', 'utf8'),
    readPpid: (p) => {
      const stat = fs.readFileSync('/proc/' + p + '/stat', 'utf8');
      return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]) || 0;
    },
    statIno: (f) => String(fs.statSync(f, { bigint: true }).ino),
  }, opts || {});
  let ino;
  let text;
  try { ino = String(o.statIno(o.lockFile)); text = o.readLocks(); } catch (_e) { return false; }
  const chain = new Set();
  let p = o.pid;
  for (let i = 0; p > 0 && i < 64; i += 1) {
    chain.add(String(p));
    try { p = o.readPpid(p); } catch (_e) { break; }
  }
  for (const line of String(text).split('\n')) {
    const tok = line.trim().split(/\s+/);
    if (tok.indexOf('FLOCK') === -1 || tok.indexOf('->') !== -1) continue; // a line with -> is a waiter, not the holder
    const k = tok.findIndex((t) => /^[0-9a-fA-F]+:[0-9a-fA-F]+:[0-9]+$/.test(t));
    if (k < 1) continue;
    if (tok[k].split(':')[2] === ino && chain.has(tok[k - 1])) return true;
  }
  return false;
}

// The base sha of a tree: the flag value, else HEAD of the tree directory, else the text unknown.
function baseShaOf(tree, flag) {
  if (flag) return flag;
  const r = cp.spawnSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const sha = r.status === 0 ? r.stdout.trim() : '';
  return /^[0-9a-f]{40}$/.test(sha) ? sha : 'unknown';
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

// The class of a changed path, from the file name only: shm, wal, db or other. Counts by class carry no path (T-384-09).
function classOfPath(rel) {
  const n = path.basename(String(rel));
  if (/-shm$/.test(n)) return 'shm';
  if (/-wal$/.test(n)) return 'wal';
  if (/\.db$/.test(n)) return 'db';
  return 'other';
}

function classCounts(paths) {
  const c = { shm: 0, wal: 0, db: 0, other: 0 };
  for (const p of paths) c[classOfPath(p)] += 1;
  return c;
}

const IGNORED_ARTIFACTS =/^(STATE\.md|STATE\.md\.tmp\..*|FEYNMAN\.md|MINTO\.md|BRIEF\.md|MEETINGS-INTELLIGENCE\.md|action-items\.md)$/;

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

// Every child of one run carries MOS_PERF_RUN_ID with a value that is new for each run. A process that
// leaves its process group (setsid, a double fork) still carries the value, so settle can find it.
let runSeq = 0;
function newRunId() {
  runSeq += 1;
  return 'mos384-' + process.pid + '-' + Date.now().toString(36) + '-' + runSeq;
}

// The live processes of this user that carry the run marker: [{ pid, pgid }]. Only counts and ids leave
// this function; the environ text is matched and dropped (T-384-07). A process can exit while it is read.
function markedProcs(runId) {
  const out = [];
  if (!runId) return out;
  const needle = 'MOS_PERF_RUN_ID=' + runId;
  let ids = [];
  try { ids = fs.readdirSync('/proc').filter((d) => /^[0-9]+$/.test(d)); } catch (_e) { return out; }
  for (const d of ids) {
    if (Number(d) === process.pid) continue;
    let env;
    try { env = fs.readFileSync('/proc/' + d + '/environ', 'latin1'); } catch (_e) { continue; }
    if (env.indexOf(needle) === -1 || env.split('\0').indexOf(needle) === -1) continue;
    try {
      const stat = fs.readFileSync('/proc/' + d + '/stat', 'utf8');
      const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      if (rest[0] === 'Z') continue;
      out.push({ pid: Number(d), pgid: Number(rest[2]) });
    } catch (_e) { /* gone */ }
  }
  return out;
}

// Wait until every hook group is gone, no process with the run marker is left and the state lock is gone,
// up to maxMs. At the limit the survivors are killed: the hook groups (this run spawned them) and the
// processes that carry this run's marker, and nothing else. Returns { ms, killed, escaped_max, survivors_left }.
async function settle(pids, roomDir, maxMs, runId) {
  const list = [].concat(pids).filter((p) => p !== undefined && p !== null);
  const groups = new Set(list.map(String));
  const t0 = Date.now();
  const lock = roomDir ? path.join(roomDir, '.mindrian', 'state-recompute.lock') : null;
  let escapedMax = 0;
  let marked = [];
  for (;;) {
    marked = markedProcs(runId);
    escapedMax = Math.max(escapedMax, marked.filter((m) => !groups.has(String(m.pgid))).length);
    const alive = list.some(groupAlive) || marked.length > 0 || (lock && fs.existsSync(lock));
    if (!alive || Date.now() - t0 >= maxMs) break;
    await sleepMs(200);
  }
  const ms = Date.now() - t0;
  const stuckGroups = list.filter(groupAlive);
  let survivors = marked.length;
  if (!survivors && stuckGroups.length) survivors = stuckGroups.length;
  const killed = survivors > 0;
  if (killed) {
    stuckGroups.forEach(killGroup);
    marked.forEach((m) => { try { process.kill(m.pid, 'SIGKILL'); } catch (_e) { /* gone */ } });
    for (let i = 0; i < 10 && markedProcs(runId).length; i += 1) await sleepMs(50);
  }
  return { ms, killed, escaped_max: escapedMax, survivors_left: survivors };
}

// The state log of the room that proves a :changed or :unchanged target ran its changed path (finding X10).
// Stop writes `on-stop-state mode=<skip|sync|...>` (scripts/on-stop-state); the SessionStart state step
// writes `state mode=<reuse|compute> reason=...` (scripts/session-start-state).
const STATE_LOGS = {
  Stop: { file: path.join('.mindrian', 'session-close.log'), re: /(?:^|\s)on-stop-state mode=(\S+)/, taken: (m) => m !== 'skip' },
  SessionStart: { file: path.join('.mindrian', 'session-start-state.log'), re: /(?:^|\s)state mode=(\S+)/, taken: (m) => m === 'compute' },
};

function stateLogOffset(event, roomDir) {
  const s = STATE_LOGS[event];
  if (!s) return 0;
  try { return fs.statSync(path.join(roomDir, s.file)).size; } catch (_e) { return 0; }
}

// true when a new line shows the changed path, false when new lines show only the skip or reuse path, null
// when no new line of the expected form exists. Only the boolean leaves this function.
function readChangedPathTaken(event, roomDir, offset) {
  const s = STATE_LOGS[event];
  if (!s) return null;
  let text = '';
  try {
    const f = path.join(roomDir, s.file);
    const size = fs.statSync(f).size;
    const from = Math.min(offset, size);
    const fd = fs.openSync(f, 'r');
    try {
      const buf = Buffer.alloc(size - from);
      fs.readSync(fd, buf, 0, buf.length, from);
      text = buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch (_e) { return null; }
  let seen = false;
  let taken = false;
  for (const line of text.split('\n')) {
    const m = line.match(s.re);
    if (!m) continue;
    seen = true;
    if (s.taken(m[1])) taken = true;
  }
  return seen ? taken : null;
}

// ---------------------------------------------------------------------------
// one run of one target
// ---------------------------------------------------------------------------
function exitCode(r) { return r.signal ? 'signal:' + r.signal : r.status; }

// A JSONL transcript of `bytes` bytes or more for the Stop targets. The record shape follows what
// lib/hmi/turn-text.cjs readTurnText parses: {type, message: {role, content}}, user content a string,
// assistant content an array of text blocks. Fixed filler words only, no room text (T-384-08). The records
// alternate user and assistant and the file ends on an assistant turn, so the tail read finds one.
const FILLER_WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu'];

function fillerText(k) {
  const w = [];
  for (let i = 0; i < 24; i += 1) w.push(FILLER_WORDS[(k + i) % FILLER_WORDS.length]);
  return w.join(' ');
}

function makeTranscript(file, bytes) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const fd = fs.openSync(file, 'w');
  let total = 0;
  let count = 0;
  try {
    let batch = [];
    let batchBytes = 0;
    while (total < bytes || count % 2 === 1) {
      const text = fillerText(count);
      const rec = count % 2 === 0
        ? { type: 'user', message: { role: 'user', content: text } }
        : { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } };
      const line = JSON.stringify(rec) + '\n';
      batch.push(line);
      batchBytes += Buffer.byteLength(line);
      total += Buffer.byteLength(line);
      count += 1;
      if (batchBytes >= 1048576) { fs.writeSync(fd, batch.join('')); batch = []; batchBytes = 0; }
    }
    if (batch.length) fs.writeSync(fd, batch.join(''));
  } finally { fs.closeSync(fd); }
  return { bytes: total, records: count };
}

// The hook entries that match the event and the tool shape (the SessionStart matcher value is the source), and the
// network-capable hooks that the harness skips, with the reason.
function selectHooks(ctx, def) {
  const shape = def.shape ? SHAPES[def.shape] : null;
  const tool = def.event === 'SessionStart' ? (def.source || 'startup') : (shape ? shape.tool : null);
  const entries = [];
  const skipped = [];
  for (const e of ctx.hooks) {
    if (e.event !== def.event || !matches(e.matcher, tool)) continue;
    if (hookLib.isNetworkCapable(e)) { skipped.push({ hook: hookId(e.command), reason: 'network_capable' }); continue; }
    entries.push(e);
  }
  return { entries, skipped };
}

// The stdin object of one hook call. tx4m targets get the generated 4 MiB transcript; SessionStart sends
// source = startup, or the source of the target (compact).
function buildEventPayload(def, ctx) {
  const shape = def.shape ? SHAPES[def.shape] : null;
  const transcript = def.transcript === 'tx4m' ? ctx.getTranscript('tx4m') : ctx.sandbox.transcript;
  const artifact = ctx.touchTarget || path.join(ctx.roomDir, 'STATE.md');
  const payload = hookLib.payloadFor(def.event, { cwd: ctx.roomDir, transcript }, null);
  payload.session_id = 'sess-384-measure';
  if (def.event === 'SessionStart') payload.source = def.source || 'startup';
  if (shape) {
    payload.tool_name = shape.tool;
    payload.tool_input = shape.input(artifact);
    if (def.event === 'PostToolUse') payload.tool_response = shape.response(artifact);
  }
  return payload;
}

async function runEventOnce(def, ctx, opts) {
  const o = opts || {};
  const roomDir = ctx.roomDir;
  const sel = selectHooks(ctx, def);
  const skipped = sel.skipped;
  if (def.change === 'changed' && !o.noTouch) {
    await sleepMs(1100);
    if (ctx.touchTarget) { const now = new Date(); fs.utimesSync(ctx.touchTarget, now, now); }
  }
  if (typeof o.beforeRun === 'function') o.beforeRun(ctx); // once per run: after the touch, before the payload is built
  const stdin = JSON.stringify(buildEventPayload(def, ctx));
  const runId = newRunId();
  const env = ctx.env(Object.assign({ MOS_PERF_RUN_ID: runId }, o.extraEnv));
  const logOffset = def.change ? stateLogOffset(def.event, roomDir) : 0;
  const jobs = [];
  for (const e of sel.entries) {
    const command = e.command.split('${CLAUDE_PLUGIN_ROOT}').join(ctx.tree);
    jobs.push({ entry: e, id: hookId(e.command), promise: runChild(ctx, { argv: ['bash', '-c', command], cwd: roomDir, env, stdin, timeoutMs: (e.timeout_ms || 60000) + 1000 }) });
  }
  const results = await Promise.all(jobs.map(async (j) => { const r = await j.promise; return Object.assign({ job: j }, r); }));
  const blocking = results.filter((r) => !r.job.entry.async);
  const asyncs = results.filter((r) => r.job.entry.async);
  const wall = blocking.length ? Math.max.apply(null, blocking.map((r) => r.exit_ms)) : null;
  const classes = results.map(classifyRun);
  const s = await settle(results.map((r) => r.pid), roomDir, o.settleMs || 120000, runId);
  // a survivor after the settle limit makes the run failed: it never enters a statistic
  if (s.survivors_left > 0) classes.push('failed');
  const sample = {
    run_class: classes.indexOf('failed') !== -1 ? 'failed' : (classes.indexOf('timeout') !== -1 ? 'timeout' : 'ok'),
    wall_ms: wall,
    cpu_ms: blocking.every((r) => r.usage) ? blocking.reduce((a, r) => a + r.usage.cpu_ms, 0) : null,
    rss_mb: blocking.every((r) => r.usage) && blocking.length ? Math.max.apply(null, blocking.map((r) => r.usage.rss_mb)) : null,
    exits: results.map(exitCode),
    timed_out: results.filter((r) => r.timedOut).length,
    async_hooks: asyncs.map((r) => ({ id: r.job.id, wall_ms: r.exit_ms })),
    // every hook of the event with its own wall and CPU, so the long pole of the event is on file (W6)
    hooks: results.map((r) => ({ id: r.job.id, async: !!r.job.entry.async, wall_ms: r.exit_ms, cpu_ms: r.usage ? r.usage.cpu_ms : null })),
    skipped,
    hook_count: jobs.length,
    blocking_count: blocking.length,
  };
  sample.background_ms = s.ms;
  sample.escaped_max = s.escaped_max;
  sample.survivors_left = s.survivors_left;
  // read after the settle: the state step of a hook can write its line in the background
  if (def.change) sample.changed_path_taken = readChangedPathTaken(def.event, roomDir, logOffset);
  return sample;
}

async function runCommandOnce(def, ctx, opts) {
  const o = opts || {};
  const runId = newRunId();
  const env = ctx.env({ MOS_PERF_RUN_ID: runId });
  const cwd = def.cwdTree ? ctx.tree : ctx.roomDir;
  if (def.kind === 'mcp') {
    const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'perf-384', version: '1' } } }) + '\n';
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
              // the count pass asks the server to stop (SIGTERM, the preload then writes its line and exits 0) and kills it after 1500 ms
              return { wall_ms: ms, finish: (child) => {
                try { child.stdin.end(); } catch (_e) { /* closed */ }
                if (ctx.countMode) { try { process.kill(-child.pid, 'SIGTERM'); } catch (_e) { /* gone */ } }
                setTimeout(() => killGroup(child.pid), 1500).unref();
              } };
            }
          } catch (_e) { /* partial line */ }
        }
        return null;
      },
    });
    const sm = await settle(r.pid, null, o.settleMs || 10000, runId);
    return { run_class: sm.survivors_left > 0 ? 'failed' : (!r.replied && !r.timedOut ? 'failed' : classifyRun(r)), wall_ms: r.wall_ms, cpu_ms: r.usage ? r.usage.cpu_ms : null, rss_mb: r.usage ? r.usage.rss_mb : null, exits: [r.replied && r.signal === "SIGKILL" && !r.timedOut ? "stopped_after_reply" : exitCode(r)], timed_out: r.timedOut ? 1 : 0, async_hooks: [], skipped: [], hook_count: 1, blocking_count: 1, background_ms: 0, escaped_max: sm.escaped_max, survivors_left: sm.survivors_left };
  }
  const r = await runChild(ctx, { argv: def.argv(ctx.tree, ctx.roomDir), cwd, env, stdin: undefined, timeoutMs: def.timeoutMs || 300000 });
  const s = await settle(r.pid, null, o.settleMs || 30000, runId);
  return { run_class: s.survivors_left > 0 ? 'failed' : classifyRun(r), wall_ms: r.exit_ms, cpu_ms: r.usage ? r.usage.cpu_ms : null, rss_mb: r.usage ? r.usage.rss_mb : null, exits: [exitCode(r)], timed_out: r.timedOut ? 1 : 0, async_hooks: [], skipped: [], hook_count: 1, blocking_count: 1, background_ms: s.ms, escaped_max: s.escaped_max, survivors_left: s.survivors_left };
}

function runOnce(def, ctx, opts) {
  return def.kind === 'event' ? runEventOnce(def, ctx, opts) : runCommandOnce(def, ctx, opts);
}

// ---------------------------------------------------------------------------
// measuring one target over N runs (single tree, or two trees interleaved)
// ---------------------------------------------------------------------------
async function measureTarget(def, ctxs, runs, gateOpts, runOpts) {
  const ro = runOpts || {};
  // the gate runs before the first run of each target; a gate that times out marks the target noisy and the target runs anyway
  const gate = gateOpts && gateOpts.skip ? { ok: true, load1: readLoad1(), waited_ms: 0 } : await gateBeforeTarget(gateOpts);
  const acc = ctxs.map(() => ({ wall: [], cpu: [], rss: [], bg: [], exits: new Set(), timedOut: 0, failed: 0, skipped: new Map(), asyncs: new Map(), perHook: [], hooks: 0, blocking: 0, load1_start: gate.load1, gate_waited_ms: gate.waited_ms, noisy: !gate.ok, touch: !!ctxs[0].touchTarget, escaped: 0, survivors: 0, taken: 0, unknown: 0 }));
  if (def.kind === 'event' && def.change === 'unchanged') {
    for (const c of ctxs) { await runEventOnce(def, c, { noTouch: true, settleMs: ro.settleMs }); await sleepMs(1100); }
  }
  const order = ctxs.length === 2 ? interleaveOrder(runs) : new Array(runs).fill('A');
  for (const lab of order) {
    const i = lab === 'A' ? 0 : 1;
    const s = await runOnce(def, ctxs[i], { settleMs: ro.settleMs });
    const a = acc[i];
    s.exits.forEach((x) => a.exits.add(x));
    a.timedOut += s.timed_out;
    a.hooks = s.hook_count;
    a.blocking = s.blocking_count;
    s.skipped.forEach((k) => a.skipped.set(k.hook, k.reason));
    a.escaped = Math.max(a.escaped, s.escaped_max || 0);
    a.survivors += s.survivors_left || 0;
    // a failed or timed-out run never enters a statistic
    if (s.run_class === 'failed') { a.failed += 1; continue; }
    if (s.run_class === 'timeout') continue;
    if (def.change) { if (s.changed_path_taken === true) a.taken += 1; else if (s.changed_path_taken === null || s.changed_path_taken === undefined) a.unknown += 1; }
    if (s.wall_ms !== null) a.wall.push(s.wall_ms);
    if (s.cpu_ms !== null) a.cpu.push(s.cpu_ms);
    if (s.rss_mb !== null) a.rss.push(s.rss_mb);
    a.bg.push(s.background_ms);
    s.async_hooks.forEach((h) => { const l = a.asyncs.get(h.id) || []; l.push(h.wall_ms); a.asyncs.set(h.id, l); });
    (s.hooks || []).forEach((h, k) => {
      const p = a.perHook[k] || (a.perHook[k] = { id: h.id, async: h.async, wall: [], cpu: [] });
      p.wall.push(h.wall_ms);
      if (h.cpu_ms !== null) p.cpu.push(h.cpu_ms);
    });
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
    failed_runs: a.failed,
    not_measured: [...a.skipped].map(([hook, reason]) => ({ hook, reason })),
    async_hooks: [...a.asyncs].map(([id, l]) => ({ id, wall_ms: statsSummary(l).median })),
    hook_count: a.hooks,
    background_ms: statsSummary(a.bg).median,
    per_hook: def.kind === 'event' ? a.perHook.map((p) => ({ id: p.id, async: p.async, wall_ms: statsSummary(p.wall).median, cpu_ms: statsSummary(p.cpu).median })) : undefined,
    escaped_max: a.escaped,
    survivors_left: a.survivors,
    changed_taken_runs: def.change ? a.taken : undefined,
    changed_unknown_runs: def.change ? a.unknown : undefined,
    touch_applied: def.change === 'changed' ? a.touch : null,
    load1_start: a.load1_start,
    load1_end: readLoad1(),
    gate_waited_ms: a.gate_waited_ms,
    noisy: a.noisy,
  }));
}

// the untimed count pass: modules loaded and node starts per target
async function countTarget(def, ctx) {
  const log = path.join(ctx.sandbox.tmp, 'count-' + (timeSeq += 1) + '.log');
  const extraEnv = { NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + PRELOAD).trim(), MOS_PERF_COUNT_LOG: log };
  const c2 = Object.assign({}, ctx, { countMode: true, env: (x) => ctx.env(Object.assign({}, extraEnv, x || {})) });
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
// The bench folder of one source: mos-384-bench/<first 8 hex of sha1 of the resolved source path>/ (finding X9:
// a snapshot of one source room is never reused for another). With no source it is the folder that holds all keys.
function benchBase(source, scratch) {
  if (source && source.startsWith('/mnt/')) {
    const m = source.match(/^\/mnt\/c\/Users\/([^/]+)\//);
    if (m) return path.join('/mnt/c/Users', m[1], 'AppData/Local/Temp/' + BENCH_NAME);
  }
  return path.join(scratch, BENCH_NAME);
}

function benchKey(source) {
  return crypto.createHash('sha1').update(path.resolve(source)).digest('hex').slice(0, 8);
}

function benchDir(source, scratch) {
  const base = benchBase(source, scratch);
  return source ? path.join(base, benchKey(source)) : base;
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
// Returns the Set of relative paths that differed from the snapshot (the isolation check counts them as changed
// in the copy). wantManifest is the manifest of the snapshot when the caller holds it (the snapshot never changes).
function restoreCopy(snap, work, wantManifest) {
  const fixed = new Set();
  if (!fs.existsSync(work)) { guardedCopy(snap, work); return fixed; }
  assertSafeTarget(work);
  const want = wantManifest || manifest(snap);
  const have = manifest(work);
  for (const rel of have.keys()) if (!want.has(rel)) { fs.rmSync(path.join(work, rel), { force: true }); fixed.add(rel); }
  for (const [rel, v] of want) {
    if (have.get(rel) === v) continue;
    const dst = path.join(work, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.rmSync(dst, { force: true });
    const r = cp.spawnSync('cp', ['-a', path.join(snap, rel), dst], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('restore failed for one file');
    fixed.add(rel);
  }
  return fixed;
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

function slugSha(sha) { return /^[0-9a-f]{40}$/.test(sha) ? sha : '0'.repeat(40); }

function buildFixtureRoom(tree, sandbox, baseSha) {
  const seed = path.join(tree, 'tests', 'fixtures', 'release-room');
  const code = 'const m = require(process.argv[1]); m.buildRoom({}, process.argv[2], process.argv[3], process.argv[4]).then((r) => { process.stdout.write(JSON.stringify({ roomDir: r.roomDir }) + "\\n"); process.exit(0); }, (e) => { process.stderr.write(String(e && e.message) + "\\n"); process.exit(1); });';
  const env = scrubbedEnv(Object.assign({}, process.env, { HOME: sandbox.home, USERPROFILE: sandbox.home, TMPDIR: sandbox.tmp, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', MINDRIAN_ROOMS_HOME: sandbox.roomsHome }));
  const r = cp.spawnSync(process.execPath, ['-e', code, path.join(tree, 'scripts', 'real-room-run.cjs'), slugSha(baseSha), seed, sandbox.roomsHome], { cwd: tree, env, encoding: 'utf8', timeout: 300000 });
  if (r.status !== 0) throw new Error('fixture room build failed: ' + String(r.stderr || '').slice(0, 300));
  const line = r.stdout.trim().split('\n').pop();
  return JSON.parse(line).roomDir;
}

function prepareRoom(kind, o) {
  const sandbox = hookLib.makeSandbox('mos-384-run-');
  let roomDir = sandbox.roomDir;
  let sourceRoom = null;
  let benchRoot = null;
  let removedRemotes = 0;
  let snap = null;
  let madeSnap = false;
  try {
    if (kind === 'fixture') {
      roomDir = buildFixtureRoom(o.trees[0], sandbox, o.baseSha || 'unknown');
    } else if (kind === 'copy') {
      sourceRoom = path.resolve(o.source);
      benchRoot = benchDir(sourceRoom, o.scratch);
      assertSafeTarget(benchRoot);
      snap = path.join(benchRoot, 'room-snapshot');
      const work = path.join(benchRoot, 'room');
      if (!fs.existsSync(snap)) {
        madeSnap = true;
        guardedCopy(sourceRoom, snap);
        removedRemotes = stripRemotes(snap);
        madeSnap = false;
      }
      restoreCopy(snap, work);
      roomDir = work;
      writeCopyRegistry(sandbox.roomsHome, roomDir);
    }
  } catch (e) {
    sandbox.cleanup(); // X11: a failed preparation leaves no sandbox in the scratch folder
    if (madeSnap && snap) fs.rmSync(snap, { recursive: true, force: true }); // a half-made snapshot is never reused
    throw e;
  }
  return { sandbox, roomDir, sourceRoom, benchRoot, snap, removedRemotes };
}

function makeCtx(label, tree, prep, cpus, hasTaskset) {
  const hooksFile = path.join(tree, 'hooks', 'hooks.json');
  const sb = Object.assign({}, prep.sandbox, { cwd: prep.roomDir, roomDir: prep.roomDir });
  const transcripts = {};
  return {
    label, tree, cpus, hasTaskset, sandbox: prep.sandbox, roomDir: prep.roomDir,
    // the 4 MiB transcript is generated once per context, on first use, inside the sandbox (removed with it)
    getTranscript: (kind) => {
      if (!transcripts[kind]) {
        const f = path.join(prep.sandbox.root, 'transcript-' + kind + '.jsonl');
        makeTranscript(f, TRANSCRIPT_4M);
        transcripts[kind] = f;
      }
      return transcripts[kind];
    },
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
    base_sha: o.baseSha,
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

// X11: the sandbox and the room copy of a run are removed on every exit path, also when a step throws.
let activeSandbox = null;
async function cmdRun(argv) {
  try { return await cmdRunInner(argv); } finally {
    if (activeSandbox) { activeSandbox.cleanup(); activeSandbox = null; }
  }
}

async function cmdRunInner(argv) {
  let f;
  try {
    f = parseFlags(argv, { tree: 1, 'tree-b': 1, 'out-b': 1, room: 1, source: 1, runs: 1, cpus: 1, targets: 1, set: 1, label: 1, 'label-b': 1, scratch: 1, 'count-pass': 'bool', out: 1, 'allow-short': 'bool', 'skip-gates': 'bool', 'base-sha': 1, restore: 1, 'settle-ms': 1 });
  } catch (e) { process.stderr.write(e.message + '\n'); return 2; }
  const selftest = process.env.MOS_PERF_SELFTEST === '1';
  if ((f['allow-short'] || f['skip-gates'] || f['settle-ms'] !== undefined) && !selftest) { process.stderr.write('--allow-short, --skip-gates and --settle-ms are test-only flags and need MOS_PERF_SELFTEST=1\n'); return 2; }
  const restoreMode = f.restore === undefined ? 'per-target' : f.restore;
  if (!['per-target', 'per-set'].includes(restoreMode)) { process.stderr.write('--restore must be per-target or per-set\n'); return 2; }
  const settleMs = f['settle-ms'] === undefined ? undefined : parseInt(f['settle-ms'], 10);
  if (settleMs !== undefined && !(settleMs >= 1)) { process.stderr.write('--settle-ms must be a positive integer\n'); return 2; }
  if (f['base-sha'] !== undefined && !/^[0-9a-f]{40}$/.test(f['base-sha'])) { process.stderr.write('--base-sha needs 40 lowercase hex digits\n'); return 2; }
  const runs = parseInt(f.runs, 10);
  if (!f.tree || !f.out || !['fixture', 'copy', 'synthetic'].includes(f.room) || !Number.isInteger(runs) || runs < 1) {
    process.stderr.write('usage: run --tree <dir> --room fixture|copy [--source <dir>] --runs N --out <file> (see tools/perf/README.md)\n');
    return 2;
  }
  if (f.room === 'synthetic' && !f['allow-short']) { process.stderr.write('--room synthetic is test-only and needs --allow-short\n'); return 2; }
  if (f.room === 'copy' && !f.source && !process.env.MOS_REAL_ROOM_384) { process.stderr.write('--room copy needs --source <dir> (or MOS_REAL_ROOM_384)\n'); return 2; }
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

  // R1: the 384 lock must be held by this process or an ancestor (the self-test skips the check unless MOS_PERF_LOCK_CHECK=force)
  if (!selftest || process.env.MOS_PERF_LOCK_CHECK === 'force') {
    if (!requireLock({ lockFile: defaultLockFile() })) { process.stderr.write('lock not held: run under flock -w 7200 "$HOME/.cache/mos-perf-384.lock" (see tools/perf/README.md)\n'); return 1; }
  }

  // gates R3 and R2 (skipped only by the test-only --allow-short and --skip-gates)
  const skipGates = !!(f['allow-short'] || f['skip-gates']);
  if (!skipGates) {
    if (suiteGuard() === 'busy') { process.stderr.write('host busy: a tests/run-all- process is running\n'); return 75; }
    const q = await waitQuiet();
    if (!q.ok) { process.stderr.write('host not quiet: load1 ' + q.load1 + ' after ' + q.waited_ms + ' ms\n'); return 75; }
  }
  const startedAt = new Date().toISOString();
  const source = f.room === 'copy' ? path.resolve(f.source || process.env.MOS_REAL_ROOM_384) : null;
  const srcBefore = source ? manifest(source) : null;
  const baseShas = trees.map((t) => baseShaOf(t, f['base-sha']));
  const prep = prepareRoom(f.room, { trees: trees, source, scratch, baseSha: baseShas[0] });
  activeSandbox = prep.sandbox;
  const load1Start = readLoad1(); // read after the room is ready: a copy over a slow mount can take minutes
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
  // X8: with --restore per-target (default) the working copy returns to the snapshot before every target after the
  // first. The paths the restore had to fix are the paths the hooks changed; they join the isolation union.
  const restoreBefore = (d, index) => {
    if (!prep.snap || restoreMode !== 'per-target' || index === 0) return;
    if (!prep.snapManifest) prep.snapManifest = manifest(prep.snap);
    const t0 = Date.now();
    restoreCopy(prep.snap, prep.roomDir, prep.snapManifest).forEach((p) => touchedUnion.add(p));
    process.stderr.write('[perf-harness] restore ' + (Date.now() - t0) + ' ms before ' + d.id + '\n');
  };
  if (f['count-pass']) {
    countsOut = [];
    for (let k = 0; k < defs.length; k += 1) { restoreBefore(defs[k], k); countsOut.push(await countTarget(defs[k], ctxs[0])); }
  } else {
    for (let k = 0; k < defs.length; k += 1) {
      const d = defs[k];
      restoreBefore(d, k);
      const rs = await measureTarget(d, ctxs, runs, { skip: skipGates }, { settleMs });
      rs.forEach((r, i) => perTree[i].push(r));
      process.stderr.write('[perf-harness] ' + d.id + ' median ' + rs[0].wall_ms.median + ' ms (n ' + rs[0].n + ')\n');
    }
  }
  const endedAt = new Date().toISOString();
  const load1End = readLoad1();
  if (workBefore) changedPaths(workBefore, manifest(prep.roomDir)).forEach((p) => touchedUnion.add(p));
  let isolation = { source_changed_paths: 0, copy_changed_paths: touchedUnion.size, intersect_paths: 0, exit_code: 0, source_changed_by_class: classCounts([]), copy_changed_by_class: classCounts(touchedUnion), intersect_by_class: classCounts([]) };
  if (source) {
    const srcChanged = changedPaths(srcBefore, manifest(source));
    const both = [];
    for (const p of srcChanged) if (touchedUnion.has(p)) both.push(p);
    const inter = both.length;
    // the exit rule is strict and unchanged (owner question Q1 is open): any path in both is a breach. The class counts only describe the breach.
    isolation = { source_changed_paths: srcChanged.size, copy_changed_paths: touchedUnion.size, intersect_paths: inter, exit_code: inter > 0 ? 3 : 0, source_changed_by_class: classCounts(srcChanged), copy_changed_by_class: classCounts(touchedUnion), intersect_by_class: classCounts(both) };
    if (inter > 0) code = 3;
  }
  const guardCtx = { home: os.homedir(), sourceRoom: source, scratch };
  try {
    const outs = [f.out].concat(f['out-b'] ? [f['out-b']] : []);
    if (countsOut) {
      writeResult(f.out, {
        schema: COUNTS_SCHEMA,
        machine: machineRecord({ cpus, fsType: room.fs_type, label: labels[0], baseSha: baseShas[0], startedAt, endedAt, load1Start, load1End }),
        room, set: f.set || null, tree_label: labels[0], cpus, load1_start: load1Start, load1_end: load1End, started_at: startedAt, ended_at: endedAt,
        targets: countsOut,
      }, guardCtx);
    } else {
      outs.forEach((file, i) => {
        writeResult(file, {
          schema: SCHEMA,
          machine: machineRecord({ cpus, fsType: room.fs_type, label: labels[i], baseSha: baseShas[i], startedAt, endedAt, load1Start, load1End }),
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
  const out = { schema: SPREAD_SCHEMA, rule: 'spread_pct = |m1 - m2| / ((m1 + m2) / 2) x 100 on the median wall time; above 10 percent the target is re-measured at n = 15 and the new spread replaces it; still above 10 percent it is unstable', rooms: {} };
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
    if (j && typeof j.schema === 'string' && /^mos\.perf-/.test(j.schema) && ![SCHEMA, COUNTS_SCHEMA, SPREAD_SCHEMA, ISOLATION_SCHEMA].includes(j.schema)) { fail(name, 'unknown or old schema ' + j.schema); continue; }
    if (!j || (j.schema !== SCHEMA && j.schema !== COUNTS_SCHEMA)) continue;
    const m = j.machine || {};
    for (const k of MACHINE_FIELDS) if (m[k] === undefined || m[k] === null) fail(name, 'missing machine field ' + k);
    if (typeof m.load1_start === 'number' && m.load1_start >= QUIET_LOAD1) fail(name, 'load1_start ' + m.load1_start + ' is not below ' + QUIET_LOAD1);
    if (j.schema === SCHEMA) {
      if (!Array.isArray(j.targets) || !j.targets.length) fail(name, 'no targets');
      for (const t of j.targets || []) {
        if (!(t.n >= MIN_RUNS)) fail(name, 'target ' + t.id + ' has n ' + t.n + ' (needs ' + MIN_RUNS + ' or more)');
        if (t.noisy === true) fail(name, 'target ' + t.id + ' ran on a busy host (noisy)');
        if (t.failed_runs > 0) fail(name, 'target ' + t.id + ' has ' + t.failed_runs + ' failed run(s)');
        if (t.timed_out > 0 && t.blocking) fail(name, 'target ' + t.id + ' has ' + t.timed_out + ' timed-out run(s) on a blocking target');
        if (typeof t.load1_start === 'number' && t.load1_start >= QUIET_LOAD1) fail(name, 'target ' + t.id + ' load1_start ' + t.load1_start + ' is not below ' + QUIET_LOAD1);
        if (t.survivors_left > 0) fail(name, 'target ' + t.id + ' left ' + t.survivors_left + ' survivor process(es) after the settle limit');
        // X10: a :changed target must have taken the changed path in every run, an :unchanged target in none
        const isChanged = /:changed(:|$)/.test(String(t.id));
        const isUnchanged = /:unchanged(:|$)/.test(String(t.id));
        if (isChanged || isUnchanged) {
          if (typeof t.changed_taken_runs !== 'number') fail(name, 'target ' + t.id + ' has no changed_taken_runs');
          else {
            const unknown = typeof t.changed_unknown_runs === 'number' ? t.changed_unknown_runs : 0;
            if (unknown > 0) process.stderr.write(name + ': warning: target ' + t.id + ' has ' + unknown + ' run(s) with no state-log line (changed path not proved)\n');
            if (isChanged && t.changed_taken_runs < t.n - unknown) fail(name, 'target ' + t.id + ' took the changed path in ' + t.changed_taken_runs + ' of ' + (t.n - unknown) + ' known run(s)');
            if (isUnchanged && t.changed_taken_runs > 0) fail(name, 'target ' + t.id + ' took the changed path in ' + t.changed_taken_runs + ' run(s) but is an :unchanged target');
          }
        }
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
  fs.writeFileSync(f.out, JSON.stringify({ schema: ISOLATION_SCHEMA, harness_exit_code: worst, sets: files }, null, 2) + '\n');
  return 0;
}

function cmdCleanBench(argv) {
  let f;
  try { f = parseFlags(argv, { source: 1, scratch: 1, all: 'bool' }); } catch (e) { process.stderr.write(e.message + '\n'); return 2; }
  if (!f.source && !f.all) { process.stderr.write('usage: clean-bench (--source <dir> | --all) [--scratch <dir>]\n'); return 2; }
  const scratch = path.resolve(f.scratch || os.tmpdir());
  const source = f.source ? path.resolve(f.source) : null;
  // --all removes the whole mos-384-bench folder; --source removes only the key folder of that source
  const root = f.all ? benchBase(source, scratch) : benchDir(source, scratch);
  const okName = f.all ? path.basename(root) === BENCH_NAME : (path.basename(path.dirname(root)) === BENCH_NAME && /^[0-9a-f]{8}$/.test(path.basename(root)));
  if (!okName) return 2;
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
  SCHEMA, COUNTS_SCHEMA, SPREAD_SCHEMA, ISOLATION_SCHEMA, TARGETS, MACHINE_FIELDS,
  gateBeforeTarget, classifyRun, requireLock, defaultLockFile, baseShaOf, benchDir,
  statsSummary, spreadPct, quietState, waitQuiet, suiteGuard, interleaveOrder, part8Violations, guardedCopy,
  findTouchTarget, pairLines, main,
  // the library surface that the phase bench scripts reuse (plan 384-02)
  SHAPES, EVENT_TARGETS, targetDef, classOfPath, classCounts,
  prepareRoom, restoreCopy, makeCtx, runChild, wrapArgv, runEventOnce, runCommandOnce, measureTarget,
  selectHooks, buildEventPayload, makeTranscript, manifest, changedPaths, writeResult, readLoad1, fsType, machineRecord,
};
