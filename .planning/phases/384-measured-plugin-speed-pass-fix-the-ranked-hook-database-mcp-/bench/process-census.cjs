#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 04: the process census. Counts the processes that each hook event starts, with the
 * LD_PRELOAD exec counter of bench/exec-counter.c (strace is not installed on the host), times the work that
 * continues after the hooks return, traces the SessionStart script by block, and measures the SubagentStop
 * cost at 1, 5 and 20 modified files.
 *
 * Subcommands:
 *   build --scratch <dir>
 *   run --tree <dir> --room fixture|copy [--source <dir> | --source-file <file> | --pick local|mount]
 *       [--events csv] [--repeats N] --counter <so> [--scratch <dir>] [--block csv] [--wait-limit-ms N]
 *       [--label <name>] [--base-sha <40 hex>] [--set <s>] --out <file>
 *   blocks --tree <dir> --room fixture|copy [source flags] [--script scripts/session-start] [--ranges csv] --out <file>
 *   walls-subagent --tree <dir> --files csv --runs N --room fixture|copy [source flags] --counter <so>
 *       [--repeats N] [--scratch <dir>] --out <file>
 *   (test-only, need MOS_PERF_SELFTEST=1: --room synthetic, --allow-short, --skip-gates)
 *
 * The harness of tools/perf is used as a library (Canon Part 7: reuse before build). The room, the
 * environment, the hook list, the payloads, the restore, the gates, the machine record and the Part 8 scan
 * all come from there. A census count is exact (an untimed pass, 3 repeats are enough); the wall times of
 * the SubagentStop sizes come from separate runs without the counter.
 * Canon Part 8: result files hold numbers, program base names and enum strings. Never a path, a room name,
 * a command line or text read from a room.
 * Exit codes: 0 ok, 1 rule breach, 2 usage, 3 isolation breach, 75 host or source room busy.
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));

const COUNTER_SRC = path.join(__dirname, 'exec-counter.c');
const POLL_MS = 10;
const WAIT_LIMIT_MS = 120000;
const MIN_RUNS = 7;
const WARMUP_MAX = 6;
const TOP_PROGRAMS = 12;
const SESSION_START_RANGES = '402-409,417,489-494,570-572,772-774,1562-1790';

// ---------------------------------------------------------------------------
// event keys
// ---------------------------------------------------------------------------
const KEY_TARGETS = {
  'SessionStart:startup:unchanged': 'event:SessionStart:unchanged',
  'SessionStart:startup:changed': 'event:SessionStart:changed',
  'SessionStart:compact': 'event:SessionStart:compact',
  UserPromptSubmit: 'event:UserPromptSubmit',
  'Stop:unchanged:tx4m': 'event:Stop:unchanged:tx4m',
  'Stop:changed:tx4m': 'event:Stop:changed:tx4m',
  'PostToolUse:Write': 'event:PostToolUse:Write',
  'PostToolUse:Read': 'event:PostToolUse:Read',
  TaskCompleted: 'event:TaskCompleted',
  PreCompact: 'event:PreCompact',
  PostCompact: 'event:PostCompact',
};

// the default order puts the SubagentStop keys last: they age the modified times of the working copy
const DEFAULT_KEYS = Object.keys(KEY_TARGETS).concat(['SubagentStop:files1', 'SubagentStop:files5', 'SubagentStop:files20']);

// keyDef(key): { key, def, files } or null. SubagentStop:files<N> uses the SubagentStop event with N modified files.
function keyDef(key) {
  const sub = /^SubagentStop:files([0-9]+)$/.exec(String(key));
  if (sub && Number(sub[1]) >= 1) return { key, def: H.targetDef('event:SubagentStop'), files: Number(sub[1]) };
  if (KEY_TARGETS[key]) return { key, def: H.targetDef(KEY_TARGETS[key]), files: 0 };
  return null;
}

// ---------------------------------------------------------------------------
// the exec log
// ---------------------------------------------------------------------------
// parseExecLog(text): the count of a run is the number of E lines minus the number of F lines. B lines (a blocked
// call) and I lines (an environment carry-over) are counted apart. Only program base names are in the log.
function parseExecLog(text) {
  const stacks = new Map();
  const by = {};
  let total = 0;
  let blocked = 0;
  let injected = 0;
  for (const line of String(text).split('\n')) {
    const p = line.split(' ');
    if (p[0] === 'E' && p.length >= 6 && /^[0-9]+$/.test(p[1])) {
      const prog = p[4];
      by[prog] = (by[prog] || 0) + 1;
      total += 1;
      if (!stacks.has(p[1])) stacks.set(p[1], []);
      stacks.get(p[1]).push(prog);
    } else if (p[0] === 'F' && /^[0-9]+$/.test(p[1] || '')) {
      const st = stacks.get(p[1]);
      if (st && st.length) {
        const prog = st.pop();
        by[prog] -= 1;
        if (by[prog] <= 0) delete by[prog];
        total -= 1;
      }
    } else if (p[0] === 'B' && /^[0-9]+$/.test(p[1] || '')) {
      blocked += 1;
    } else if (p[0] === 'I' && /^[0-9]+$/.test(p[1] || '')) {
      injected += 1;
    }
  }
  const n = (k) => by[k] || 0;
  return {
    total, byProgram: by, blocked, injected,
    nodeStarts: n('node') + n('nodejs'),
    bashStarts: n('bash') + n('sh') + n('dash'),
    findCount: n('find'),
  };
}

function topPrograms(by) {
  return Object.keys(by).map((k) => ({ program: k, count: by[k] }))
    .sort((a, b) => b.count - a.count || a.program.localeCompare(b.program))
    .slice(0, TOP_PROGRAMS);
}

function median(list) {
  const s = list.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

function lowerMedian(list) {
  const s = list.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
}

function r1(x) { return x === null || x === undefined ? null : Math.round(x * 10) / 10; }
function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// the marker scan (counts only; the environ text is matched and dropped)
// ---------------------------------------------------------------------------
let tick = null;
function tickMs() {
  if (tick === null) {
    const r = cp.spawnSync('getconf', ['CLK_TCK'], { encoding: 'utf8' });
    tick = r.status === 0 && Number(r.stdout) > 0 ? 1000 / Number(r.stdout) : 10;
  }
  return tick;
}

// The live processes of this user that carry the run marker: [{ pid, cpu_ms }]. A pid that was read once without
// the marker goes into `neg` and is not read again during the same wait.
function scanMarked(runId, neg) {
  const out = [];
  let ids = [];
  try { ids = fs.readdirSync('/proc').filter((d) => /^[0-9]+$/.test(d)); } catch (_e) { return out; }
  const needle = 'MOS_PERF_RUN_ID=' + runId;
  for (const d of ids) {
    if (Number(d) === process.pid || neg.has(d)) continue;
    let env;
    try { env = fs.readFileSync('/proc/' + d + '/environ', 'latin1'); } catch (_e) { neg.add(d); continue; }
    if (env === '') continue; // a process in the middle of exec: read it again
    if (env.indexOf(needle) === -1 || env.split('\0').indexOf(needle) === -1) { neg.add(d); continue; }
    try {
      const stat = fs.readFileSync('/proc/' + d + '/stat', 'utf8');
      const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      if (rest[0] === 'Z') continue;
      out.push({ pid: Number(d), cpu_ms: (Number(rest[11]) + Number(rest[12])) * tickMs() });
    } catch (_e) { /* gone */ }
  }
  return out;
}

// Poll for the processes that outlive the hooks. t0 is the clock time when the last blocking hook returned.
// Returns { tail_ms, survivors, survivor_cpu_ms, killed }. A survivor that is still alive at the limit is killed,
// and only a process that carries this run's marker is killed (threat T-384-18).
async function watchSurvivors(runId, t0, limitMs) {
  const neg = new Set();
  const seen = new Map();
  let lastSeen = null;
  let killed = 0;
  for (;;) {
    const now = Date.now();
    const live = scanMarked(runId, neg);
    if (live.length) {
      lastSeen = now;
      for (const l of live) {
        const prev = seen.get(l.pid);
        seen.set(l.pid, Math.max(prev || 0, l.cpu_ms));
      }
    }
    if (!live.length) break;
    if (now - t0 >= limitMs) {
      for (const l of live) { try { process.kill(l.pid, 'SIGKILL'); killed += 1; } catch (_e) { /* gone */ } }
      for (let i = 0; i < 20 && scanMarked(runId, new Set()).length; i += 1) await sleepMs(50);
      break;
    }
    await sleepMs(POLL_MS);
  }
  let cpu = 0;
  for (const v of seen.values()) cpu += v;
  return { tail_ms: lastSeen === null ? 0 : Math.max(0, lastSeen - t0), survivors: seen.size, survivor_cpu_ms: cpu, killed };
}

// ---------------------------------------------------------------------------
// the state log (the proof that a :changed or :unchanged event ran the right path)
// ---------------------------------------------------------------------------
const STATE_LOGS = {
  Stop: { file: path.join('.mindrian', 'session-close.log'), re: /(?:^|\s)on-stop-state mode=(\S+)/, taken: (m) => m !== 'skip' },
  SessionStart: { file: path.join('.mindrian', 'session-start-state.log'), re: /(?:^|\s)state mode=(\S+)/, taken: (m) => m === 'compute' },
};

function stateLogOffset(event, roomDir) {
  const s = STATE_LOGS[event];
  if (!s) return 0;
  try { return fs.statSync(path.join(roomDir, s.file)).size; } catch (_e) { return 0; }
}

// true: a new line shows the changed path. false: only the skip or reuse path. null: no new line of the expected form.
function changedPathTaken(event, roomDir, offset) {
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
// modified files for SubagentStop
// ---------------------------------------------------------------------------
const SKIP_NAMES = new Set(['STATE.md', 'ROOM.md', 'TEAM-STATE.md', 'MEETINGS-INTELLIGENCE.md']);

function eligibleMd(roomDir) {
  const out = [];
  (function walk(dir) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      if (e.name[0] === '.') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile() && /\.md$/.test(e.name) && !SKIP_NAMES.has(e.name)) out.push(f);
    }
  })(roomDir);
  return out.sort();
}

// Make exactly n eligible .md files that are newer than 30 s. All the other eligible files get an old time
// (one hour back), so the 30 s window of the hook holds n files. A missing file is made as probe-<k>.md in the
// first section folder of the working copy (never in a source room). Returns the probe files that were made.
function prepModifiedFiles(roomDir, n) {
  const files = eligibleMd(roomDir);
  const old = new Date(Date.now() - 3600 * 1000);
  for (const f of files) { try { fs.utimesSync(f, old, old); } catch (_e) { /* skip */ } }
  const pick = files.slice(0, n);
  const made = [];
  let dirs = [];
  try { dirs = fs.readdirSync(roomDir, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name[0] !== '.').map((e) => e.name).sort(); } catch (_e) { dirs = []; }
  const sec = path.join(roomDir, dirs.length ? dirs[0] : 'probe-section');
  fs.mkdirSync(sec, { recursive: true });
  for (let k = 0; pick.length < n; k += 1) {
    const f = path.join(sec, 'probe-' + k + '.md');
    if (pick.indexOf(f) !== -1) continue;
    fs.writeFileSync(f, 'probe\n');
    made.push(f);
    pick.push(f);
  }
  const now = new Date();
  for (const f of pick) fs.utimesSync(f, now, now);
  return made;
}

function removeFiles(list) {
  for (const f of list) { try { fs.rmSync(f, { force: true }); } catch (_e) { /* gone */ } }
}

// ---------------------------------------------------------------------------
// one counted run of one event
// ---------------------------------------------------------------------------
let seq = 0;
function newRunId() { seq += 1; return 'mos384c-' + process.pid + '-' + Date.now().toString(36) + '-' + seq; }

function spawnHook(command, cwd, env, stdin, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const child = cp.spawn('bash', ['-c', command], { cwd, env, detached: true, stdio: ['pipe', 'ignore', 'ignore'] });
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_e) { /* gone */ } }, timeoutMs);
    const finish = (code, sig) => { if (done) return; done = true; clearTimeout(timer); resolve({ status: code, signal: sig || null, at: Date.now() }); };
    child.on('error', () => finish(null, null));
    child.on('exit', finish);
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
}

// opts: { counter, block, waitLimitMs, files } . Returns one repeat.
async function censusOnce(def, ctx, o) {
  const sel = H.selectHooks(ctx, def);
  let made = [];
  if (def.change === 'changed') {
    await sleepMs(1100);
    if (ctx.touchTarget) { const now = new Date(); fs.utimesSync(ctx.touchTarget, now, now); }
  }
  if (o.files > 0) made = prepModifiedFiles(ctx.roomDir, o.files);
  const stdin = JSON.stringify(H.buildEventPayload(def, ctx));
  const runId = newRunId();
  const log = path.join(ctx.sandbox.tmp, 'exec-' + runId + '.log');
  fs.writeFileSync(log, '');
  const extra = { MOS_PERF_RUN_ID: runId, LD_PRELOAD: o.counter, MOS_EXEC_LOG: log };
  if (o.block) extra.MOS_EXEC_BLOCK = o.block;
  const env = ctx.env(extra);
  const offset = def.change ? stateLogOffset(def.event, ctx.roomDir) : 0;
  const jobs = sel.entries.map((e) => ({
    entry: e,
    p: spawnHook(e.command.split('${CLAUDE_PLUGIN_ROOT}').join(ctx.tree), ctx.roomDir, env, stdin, (e.timeout_ms || 60000) + 1000),
  }));
  const res = await Promise.all(jobs.map(async (j) => Object.assign({ entry: j.entry }, await j.p)));
  const blocking = res.filter((r) => !r.entry.async);
  const pool = blocking.length ? blocking : res;
  const tLast = pool.length ? Math.max.apply(null, pool.map((r) => r.at)) : Date.now();
  const w = await watchSurvivors(runId, tLast, o.waitLimitMs || WAIT_LIMIT_MS);
  let text = '';
  try { text = fs.readFileSync(log, 'utf8'); } catch (_e) { text = ''; }
  const parsed = parseExecLog(text);
  removeFiles(made);
  return {
    parsed, tail_ms: w.tail_ms, survivors: w.survivors, survivor_cpu_ms: w.survivor_cpu_ms, killed: w.killed,
    hooks: { matched: sel.entries.length, blocking: blocking.length, async: res.length - blocking.length, skipped: sel.skipped.length },
    changed: def.change ? changedPathTaken(def.event, ctx.roomDir, offset) : undefined,
    exits_failed: res.filter((r) => r.signal || r.status === null || r.status === 126 || r.status === 127).length,
  };
}

// An :unchanged event first runs untimed and without the counter until a run takes the skip path (at most 6 times),
// the same rule as the harness.
async function warmUnchanged(def, ctx) {
  for (let k = 0; k < WARMUP_MAX; k += 1) {
    const w = await H.runEventOnce(def, ctx, { noTouch: true });
    await sleepMs(1100);
    if (w.changed_path_taken !== true) break;
  }
}

function summarizeEvent(key, def, reps, load) {
  const totals = reps.map((r) => r.parsed.total);
  const mid = lowerMedian(totals);
  const chosen = reps.find((r) => r.parsed.total === mid) || reps[0];
  const out = {
    key,
    repeats: reps.length,
    hooks: reps[0].hooks,
    exec_total: { min: Math.min.apply(null, totals), median: mid, max: Math.max.apply(null, totals) },
    exec_per_repeat: totals,
    exec_by_program: topPrograms(chosen.parsed.byProgram),
    node_starts: chosen.parsed.nodeStarts,
    bash_starts: chosen.parsed.bashStarts,
    find_count: chosen.parsed.findCount,
    tail_ms: r1(median(reps.map((r) => r.tail_ms))),
    tail_ms_max: r1(Math.max.apply(null, reps.map((r) => r.tail_ms))),
    survivors: median(reps.map((r) => r.survivors)),
    survivor_cpu_ms: r1(median(reps.map((r) => r.survivor_cpu_ms))),
    survivor_cpu_note: 'lower bound: CPU time of each surviving process at its last poll, summed',
    killed_survivors: reps.reduce((a, r) => a + r.killed, 0),
    blocked_calls: reps.reduce((a, r) => a + r.parsed.blocked, 0),
    carry_over_calls: Math.max.apply(null, reps.map((r) => r.parsed.injected)),
    failed_hook_runs: reps.reduce((a, r) => a + r.exits_failed, 0),
    load1_start: load.start,
    load1_end: load.end,
    noisy: load.noisy,
  };
  if (def.change) {
    out.changed_taken_runs = reps.filter((r) => r.changed === true).length;
    out.changed_unknown_runs = reps.filter((r) => r.changed === null || r.changed === undefined).length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// the session: room, context, gates, isolation
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
    i += 1;
    if (argv[i] === undefined) throw new Error('missing value for ' + a);
    o[key] = argv[i];
  }
  return o;
}

const COMMON = { tree: 1, room: 1, source: 1, 'source-file': 1, pick: 1, 'idle-ms': 1, scratch: 1, out: 1, label: 1, 'base-sha': 1, set: 1, 'allow-short': 'bool', 'skip-gates': 'bool' };

function usage(msg) { process.stderr.write(msg + '\n'); return 2; }

function cpuCount(list) {
  let n = 0;
  for (const part of String(list).split(',')) {
    const m = /^([0-9]+)(?:-([0-9]+))?$/.exec(part.trim());
    if (!m) return 999;
    n += m[2] ? Number(m[2]) - Number(m[1]) + 1 : 1;
  }
  return n;
}

// The census process runs under taskset -c 0-3 so that every hook it starts inherits the cap (the hooks are not wrapped,
// so that no wrapper program is counted). When the process is not capped, it starts itself again under taskset.
function ensurePinned(argv) {
  if (process.env.MOS_PERF_SELFTEST === '1' || process.env.MOS_CENSUS_PINNED === '1' || os.platform() !== 'linux') return null;
  if (cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status !== 0) return null;
  const avail = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const cpus = Math.min(4, avail);
  let allowed = 999;
  try { allowed = cpuCount((fs.readFileSync('/proc/self/status', 'utf8').match(/Cpus_allowed_list:\s*(\S+)/) || [])[1] || ''); } catch (_e) { allowed = 999; }
  if (allowed <= cpus) return null;
  const r = cp.spawnSync('taskset', ['-c', '0-' + (cpus - 1), process.execPath, __filename].concat(argv), { stdio: 'inherit', env: Object.assign({}, process.env, { MOS_CENSUS_PINNED: '1' }) });
  return r.status === null ? 1 : r.status;
}

let activeSandbox = null;

// Opens the room and the context. Returns { error: code } or a session.
async function openSession(f) {
  const selftest = process.env.MOS_PERF_SELFTEST === '1';
  if ((f['allow-short'] || f['skip-gates']) && !selftest) return { error: usage('--allow-short and --skip-gates are test-only flags and need MOS_PERF_SELFTEST=1') };
  if (!f.tree || !f.out || !['fixture', 'copy', 'synthetic'].includes(f.room)) return { error: usage('usage: --tree <dir> --room fixture|copy [--source <dir> | --source-file <file> | --pick local|mount] --out <file> (see bench/process-census.cjs)') };
  if (f.room === 'synthetic' && !f['allow-short']) return { error: usage('--room synthetic is test-only and needs --allow-short') };
  if (f.pick !== undefined && !['local', 'mount'].includes(f.pick)) return { error: usage('--pick must be local or mount') };
  if (f.room === 'copy' && !f.source && !f['source-file'] && !f.pick && !process.env.MOS_REAL_ROOM_384) return { error: usage('--room copy needs --source <dir>, --source-file <file>, --pick local|mount or MOS_REAL_ROOM_384') };
  if (f['base-sha'] !== undefined && !/^[0-9a-f]{40}$/.test(f['base-sha'])) return { error: usage('--base-sha needs 40 lowercase hex digits') };
  const tree = path.resolve(f.tree);
  if (!fs.existsSync(path.join(tree, 'hooks', 'hooks.json'))) return { error: usage('not a plugin tree') };
  if (!selftest) {
    if (!H.requireLock({ lockFile: H.defaultLockFile() })) { process.stderr.write('lock not held: run under flock -w 7200 "$HOME/.cache/mos-perf-384.lock"\n'); return { error: 1 }; }
  }
  const skipGates = !!(f['allow-short'] || f['skip-gates']);
  if (!skipGates) {
    if (H.suiteGuard() === 'busy') { process.stderr.write('host busy: a suite process is running\n'); return { error: 75 }; }
    const q = await H.waitQuiet();
    if (!q.ok) { process.stderr.write('host not quiet: load1 ' + q.load1 + '\n'); return { error: 75 }; }
  }
  const startedAt = new Date().toISOString();
  const scratch = path.resolve(f.scratch || os.tmpdir());
  process.env.TMPDIR = scratch;
  let source = null;
  if (f.room === 'copy') {
    try {
      source = await H.resolveSource({ source: f.source, sourceFile: f['source-file'], pick: f.pick, idleMs: f['idle-ms'] === undefined ? undefined : parseInt(f['idle-ms'], 10) });
    } catch (_e) { return { error: usage('could not read the source room named by --source-file') }; }
    if (!source) { process.stderr.write('source room busy: --pick found no quiet ' + f.pick + ' room\n'); return { error: 75 }; }
  }
  const srcBefore = source ? H.manifest(source) : null;
  const baseSha = H.baseShaOf(tree, f['base-sha']);
  const prep = H.prepareRoom(f.room, { trees: [tree], source, scratch, baseSha });
  activeSandbox = prep.sandbox;
  const avail = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const cpus = Math.min(4, avail);
  const hasTaskset = os.platform() === 'linux' && cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;
  const ctx = H.makeCtx('A', tree, prep, cpus, hasTaskset);
  const workBefore = f.room === 'copy' ? H.manifest(prep.roomDir) : null;
  const counts = workBefore ? countsOf(workBefore) : countsOf(H.manifest(prep.roomDir));
  const kind = f.room === 'fixture' ? 'fixture-room' : (f.room === 'copy' ? 'real-copy' : 'synthetic-room');
  const sess = {
    selftest, skipGates, tree, scratch, source, srcBefore, baseSha, prep, ctx, cpus, startedAt, workBefore,
    label: f.label || path.basename(tree),
    load1Start: H.readLoad1(),
    room: Object.assign({ kind }, counts, { fs_type: H.fsType(prep.roomDir) }),
    touchedUnion: new Set(),
    snapManifest: null,
  };
  sess.restore = () => {
    if (!prep.snap) return;
    if (!sess.snapManifest) sess.snapManifest = H.manifest(prep.snap);
    H.restoreCopy(prep.snap, prep.roomDir, sess.snapManifest).forEach((p) => sess.touchedUnion.add(p));
  };
  sess.gate = async () => {
    if (skipGates) return { ok: true, load1: H.readLoad1(), waited_ms: 0 };
    return H.gateBeforeTarget({});
  };
  return sess;
}

function countsOf(m) {
  let b = 0;
  for (const v of m.values()) b += Number(String(v).split(':')[0]) || 0;
  return { file_count: m.size, byte_total: b };
}

// Isolation as in the harness: the exit rule is strict (owner question Q1 is open).
function finishSession(sess) {
  const endedAt = new Date().toISOString();
  const load1End = H.readLoad1();
  if (sess.workBefore) H.changedPaths(sess.workBefore, H.manifest(sess.prep.roomDir)).forEach((p) => sess.touchedUnion.add(p));
  let isolation = { source_changed_paths: 0, copy_changed_paths: sess.touchedUnion.size, intersect_paths: 0, exit_code: 0 };
  if (sess.source) {
    const srcChanged = H.changedPaths(sess.srcBefore, H.manifest(sess.source));
    const both = [];
    for (const p of srcChanged) if (sess.touchedUnion.has(p)) both.push(p);
    isolation = {
      source_changed_paths: srcChanged.size, copy_changed_paths: sess.touchedUnion.size, intersect_paths: both.length, exit_code: both.length > 0 ? 3 : 0,
      source_changed_by_class: H.classCounts(srcChanged), copy_changed_by_class: H.classCounts(sess.touchedUnion), intersect_by_class: H.classCounts(both),
    };
  }
  return { endedAt, load1End, isolation };
}

function machineOf(sess, fin) {
  return H.machineRecord({ cpus: sess.cpus, fsType: sess.room.fs_type, label: sess.label, baseSha: sess.baseSha, startedAt: sess.startedAt, endedAt: fin.endedAt, load1Start: sess.load1Start, load1End: fin.load1End });
}

function guardOf(sess) { return { home: os.homedir(), sourceRoom: sess.source, scratch: sess.scratch }; }

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
async function runCensusEvents(sess, keys, o) {
  const events = [];
  for (const key of keys) {
    const kd = keyDef(key);
    const reps = [];
    const gate = await sess.gate();
    const load = { start: gate.load1, end: null, noisy: !gate.ok };
    for (let r = 0; r < o.repeats; r += 1) {
      if (sess.prep.snap && !(events.length === 0 && r === 0)) sess.restore();
      if (kd.def.change === 'unchanged') await warmUnchanged(kd.def, sess.ctx);
      reps.push(await censusOnce(kd.def, sess.ctx, { counter: o.counter, block: o.block, waitLimitMs: o.waitLimitMs, files: kd.files }));
    }
    load.end = H.readLoad1();
    events.push(summarizeEvent(key, kd.def, reps, load));
    process.stderr.write('[process-census] ' + key + ' processes ' + events[events.length - 1].exec_total.median + ' (repeats ' + o.repeats + ')\n');
  }
  return events;
}

async function cmdRun(argv) {
  let f;
  try { f = parseFlags(argv, Object.assign({ events: 1, repeats: 1, counter: 1, block: 1, 'wait-limit-ms': 1 }, COMMON)); } catch (e) { return usage(e.message); }
  const keys = f.events ? f.events.split(',').filter(Boolean) : DEFAULT_KEYS;
  if (!keys.length || keys.some((k) => !keyDef(k))) return usage('unknown event key in --events');
  const repeats = f.repeats === undefined ? 3 : parseInt(f.repeats, 10);
  if (!(repeats >= 1)) return usage('--repeats must be a positive integer');
  if (!f.counter || !fs.existsSync(f.counter)) return usage('--counter needs the built exec-counter.so (run build first)');
  const waitLimitMs = f['wait-limit-ms'] === undefined ? WAIT_LIMIT_MS : parseInt(f['wait-limit-ms'], 10);
  if (!(waitLimitMs >= 1)) return usage('--wait-limit-ms must be a positive integer');
  const pinned = ensurePinned(argv);
  if (pinned !== null) return pinned;
  const sess = await openSession(f);
  if (sess.error !== undefined) return sess.error;
  try {
    const events = await runCensusEvents(sess, keys, { repeats, counter: path.resolve(f.counter), block: f.block, waitLimitMs });
    const fin = finishSession(sess);
    H.writeResult(f.out, {
      schema: H.COUNTS_SCHEMA,
      machine: machineOf(sess, fin),
      room: sess.room, set: f.set || null, tree_label: sess.label, cpus: sess.cpus, repeats,
      note: 'untimed counting pass: exec calls of the descendants of each hook shell, counted by bench/exec-counter.c; the wall times come from separate runs',
      events,
      isolation: sess.source ? fin.isolation : undefined,
    }, guardOf(sess));
    if (fin.isolation.exit_code === 3) { process.stderr.write('possible isolation breach: ' + fin.isolation.intersect_paths + ' path(s) changed in both the copy and the source\n'); return 3; }
    return 0;
  } catch (e) {
    process.stderr.write(String(e && e.message) + '\n');
    return 1;
  } finally {
    sess.prep.sandbox.cleanup();
    activeSandbox = null;
  }
}

// ---------------------------------------------------------------------------
// blocks: a trace pass of the SessionStart script
// ---------------------------------------------------------------------------
function parseRanges(csv) {
  return String(csv).split(',').filter(Boolean).map((s) => {
    const m = /^([0-9]+)(?:-([0-9]+))?$/.exec(s.trim());
    if (!m) return null;
    return { name: s.trim(), from: Number(m[1]), to: m[2] ? Number(m[2]) : Number(m[1]) };
  });
}

// The xtrace text is parsed in memory and dropped. Only the time stamp, the script base name and the line number are kept.
function parseTrace(text) {
  const entries = [];
  const re = /^\++\x1f([0-9]+)\.([0-9]+)\x1f([^\x1f]*)\x1f([0-9]+)\x1f/;
  for (const line of String(text).split('\n')) {
    const m = re.exec(line);
    if (!m) continue;
    const micro = Number(m[1]) * 1e6 + Number((m[2] + '000000').slice(0, 6));
    entries.push({ t: micro, file: m[3], line: Number(m[4]) });
  }
  return entries;
}

function blockTimes(entries, endMicro, scriptBase, ranges) {
  const rangeMs = ranges.map(() => ({ ms: 0, lines: 0 }));
  const perLine = new Map();
  for (let i = 0; i < entries.length; i += 1) {
    const next = i + 1 < entries.length ? entries[i + 1].t : Math.max(endMicro, entries[i].t);
    const ms = Math.max(0, next - entries[i].t) / 1000;
    const id = entries[i].file + ':' + entries[i].line;
    perLine.set(id, (perLine.get(id) || 0) + ms);
    if (entries[i].file !== scriptBase) continue;
    ranges.forEach((r, k) => { if (r && entries[i].line >= r.from && entries[i].line <= r.to) { rangeMs[k].ms += ms; rangeMs[k].lines += 1; } });
  }
  const total = entries.length ? Math.max(0, Math.max(endMicro, entries[entries.length - 1].t) - entries[0].t) / 1000 : 0;
  const top = [...perLine].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([line, ms]) => ({ line, ms: r1(ms) }));
  return { rangeMs, top, total };
}

async function runScriptOnce(sess, scriptPath, trace) {
  const ctx = sess.ctx;
  const def = H.targetDef('event:SessionStart:unchanged');
  const stdin = JSON.stringify(H.buildEventPayload(def, ctx));
  const runId = newRunId();
  const extra = { MOS_PERF_RUN_ID: runId, CLAUDE_PLUGIN_ROOT: ctx.tree };
  let xfile = null;
  let fd = null;
  const stdio = ['pipe', 'ignore', 'ignore'];
  if (trace) {
    xfile = path.join(ctx.sandbox.tmp, 'xtrace-' + runId + '.txt');
    fd = fs.openSync(xfile, 'w');
    stdio.push(fd);
    extra.BASH_XTRACEFD = '3';
    extra.PS4 = '+\x1f${EPOCHREALTIME}\x1f${BASH_SOURCE[0]##*/}\x1f${LINENO}\x1f';
  }
  const argv = (trace ? ['-x'] : []).concat([scriptPath]);
  const exitAt = await new Promise((resolve) => {
    const child = cp.spawn('bash', argv, { cwd: ctx.roomDir, env: ctx.env(extra), detached: true, stdio });
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_e) { /* gone */ } }, 300000);
    child.on('error', () => { clearTimeout(timer); resolve(Date.now()); });
    child.on('exit', () => { clearTimeout(timer); resolve(Date.now()); });
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
  if (fd !== null) fs.closeSync(fd);
  const w = await watchSurvivors(runId, exitAt, WAIT_LIMIT_MS);
  let entries = [];
  if (xfile) {
    try { entries = parseTrace(fs.readFileSync(xfile, 'latin1')); } catch (_e) { entries = []; }
    try { fs.rmSync(xfile, { force: true }); } catch (_e) { /* gone */ }
  }
  return { entries, endMicro: exitAt * 1000, tail_ms: w.tail_ms, killed: w.killed };
}

async function cmdBlocks(argv) {
  let f;
  try { f = parseFlags(argv, Object.assign({ script: 1, ranges: 1 }, COMMON)); } catch (e) { return usage(e.message); }
  const script = f.script || path.join('scripts', 'session-start');
  const ranges = parseRanges(f.ranges || SESSION_START_RANGES);
  if (!ranges.length || ranges.some((r) => !r)) return usage('--ranges needs a comma list of line numbers or from-to ranges');
  const pinned = ensurePinned(argv);
  if (pinned !== null) return pinned;
  const sess = await openSession(f);
  if (sess.error !== undefined) return sess.error;
  try {
    const scriptPath = path.join(sess.tree, script);
    if (!fs.existsSync(scriptPath)) return usage('the script named by --script is not in the tree');
    await sess.gate();
    // one untraced pass first, so the state step of the room is warm; then one traced pass
    await runScriptOnce(sess, scriptPath, false);
    await sleepMs(1100);
    const def = H.targetDef('event:SessionStart:unchanged');
    const offset = stateLogOffset(def.event, sess.ctx.roomDir);
    const t = await runScriptOnce(sess, scriptPath, true);
    const mode = changedPathTaken(def.event, sess.ctx.roomDir, offset);
    const base = path.basename(scriptPath);
    const bt = blockTimes(t.entries, t.endMicro, base, ranges);
    const fin = finishSession(sess);
    H.writeResult(f.out, {
      schema: H.COUNTS_SCHEMA,
      machine: machineOf(sess, fin),
      room: sess.room, set: f.set || null, tree_label: sess.label,
      diagnostic: true,
      note: 'one traced pass (bash -x): the trace slows the script, so the shares are relative and the milliseconds are not a baseline. Time of a line is the time to the next trace line, so background jobs and command substitutions blur the shares. No command text is stored.',
      script: base,
      trace_entries: t.entries.length,
      total_ms: r1(bt.total),
      state_step: mode === null ? 'unknown' : (mode ? 'compute' : 'reuse'),
      ranges: ranges.map((r, k) => ({ range: r.name, ms: r1(bt.rangeMs[k].ms), share_pct: bt.total ? r1((bt.rangeMs[k].ms / bt.total) * 100) : 0, traced_lines: bt.rangeMs[k].lines })),
      top_lines: bt.top,
      background_tail_ms: r1(t.tail_ms),
    }, guardOf(sess));
    return fin.isolation.exit_code === 3 ? 3 : 0;
  } catch (e) {
    process.stderr.write(String(e && e.message) + '\n');
    return 1;
  } finally {
    sess.prep.sandbox.cleanup();
    activeSandbox = null;
  }
}

// ---------------------------------------------------------------------------
// walls-subagent
// ---------------------------------------------------------------------------
async function cmdWallsSubagent(argv) {
  let f;
  try { f = parseFlags(argv, Object.assign({ files: 1, runs: 1, counter: 1, repeats: 1 }, COMMON)); } catch (e) { return usage(e.message); }
  const sizes = String(f.files || '').split(',').map((s) => parseInt(s, 10));
  if (!sizes.length || sizes.some((n) => !(n >= 1))) return usage('--files needs a comma list of positive integers');
  const runs = parseInt(f.runs, 10);
  if (!Number.isInteger(runs) || runs < 1) return usage('--runs needs a positive integer');
  if (runs < MIN_RUNS && !f['allow-short']) return usage('at least ' + MIN_RUNS + ' runs are required; got ' + runs);
  const repeats = f.repeats === undefined ? 3 : parseInt(f.repeats, 10);
  if (!(repeats >= 1)) return usage('--repeats must be a positive integer');
  if (!f.counter || !fs.existsSync(f.counter)) return usage('--counter needs the built exec-counter.so (run build first)');
  const pinned = ensurePinned(argv);
  if (pinned !== null) return pinned;
  const sess = await openSession(f);
  if (sess.error !== undefined) return sess.error;
  try {
    const def = H.targetDef('event:SubagentStop');
    const acc = new Map(sizes.map((n) => [n, { wall: [], cpu: [], rss: [], bg: [], exits: new Set(), timedOut: 0, failed: 0, escaped: 0, survivors: 0, hooks: 0, blocking: 0, load1Start: null, gateWaited: 0, noisy: false }]));
    const runSize = async (n, timed) => {
      let made = [];
      const s = await H.runEventOnce(def, sess.ctx, { beforeRun: () => { made = prepModifiedFiles(sess.ctx.roomDir, n); } });
      removeFiles(made);
      if (!timed) return;
      const a = acc.get(n);
      s.exits.forEach((x) => a.exits.add(x));
      a.timedOut += s.timed_out;
      a.hooks = s.hook_count;
      a.blocking = s.blocking_count;
      a.escaped = Math.max(a.escaped, s.escaped_max || 0);
      a.survivors += s.survivors_left || 0;
      if (s.run_class === 'failed') { a.failed += 1; return; }
      if (s.run_class === 'timeout') return;
      if (s.wall_ms !== null) a.wall.push(s.wall_ms);
      if (s.cpu_ms !== null) a.cpu.push(s.cpu_ms);
      if (s.rss_mb !== null) a.rss.push(s.rss_mb);
      a.bg.push(s.background_ms);
    };
    // one untimed run per size, then the rounds; the order of the sizes rotates each round (a Latin square)
    for (const n of sizes) await runSize(n, false);
    for (let r = 0; r < runs; r += 1) {
      const order = sizes.map((_n, i) => sizes[(i + r) % sizes.length]);
      for (const n of order) {
        const a = acc.get(n);
        const g = await sess.gate();
        if (a.load1Start === null) { a.load1Start = g.load1; a.gateWaited = g.waited_ms; a.noisy = !g.ok; } else if (!g.ok) a.noisy = true;
        if (sess.prep.snap && r === 0) sess.restore();
        await runSize(n, true);
      }
    }
    // the counting pass: process counts and the CPU of survivors for each size (untimed, with the counter)
    const counted = await runCensusEvents(sess, sizes.map((n) => 'SubagentStop:files' + n), { repeats, counter: path.resolve(f.counter), block: undefined, waitLimitMs: WAIT_LIMIT_MS });
    const targets = sizes.map((n, i) => {
      const a = acc.get(n);
      const ev = counted[i];
      const bg = H.statsSummary(a.bg);
      return {
        id: 'event:SubagentStop:files' + n,
        files: n,
        n: a.wall.length,
        blocking: a.blocking > 0,
        wall_ms: H.statsSummary(a.wall),
        cpu_ms: H.statsSummary(a.cpu),
        rss_mb: H.statsSummary(a.rss),
        exits: [...a.exits].sort((x, y) => String(x).localeCompare(String(y))),
        timed_out: a.timedOut,
        failed_runs: a.failed,
        hook_count: a.hooks,
        background_ms: bg.median,
        background_ms_p95: bg.p95,
        escaped_max: a.escaped,
        survivors_left: a.survivors,
        exec_total: ev.exec_total.median,
        exec_min_max: [ev.exec_total.min, ev.exec_total.max],
        exec_by_program: ev.exec_by_program,
        node_starts: ev.node_starts,
        bash_starts: ev.bash_starts,
        find_count: ev.find_count,
        survivor_cpu_ms: ev.survivor_cpu_ms,
        survivor_cpu_note: ev.survivor_cpu_note,
        count_tail_ms: ev.tail_ms,
        load1_start: a.load1Start,
        load1_end: H.readLoad1(),
        gate_waited_ms: a.gateWaited,
        noisy: a.noisy,
      };
    });
    const fin = finishSession(sess);
    H.writeResult(f.out, {
      schema: H.SCHEMA,
      machine: machineOf(sess, fin),
      room: sess.room, set: f.set || null, tree_label: sess.label, cpus: sess.cpus, runs,
      note: 'SubagentStop at several modified-file counts. Wall, CPU and background time come from timed runs without the counter (the order of the sizes rotates each round). Process counts and survivor CPU come from a separate counting pass with the exec counter; survivor CPU is a lower bound.',
      isolation: sess.source ? fin.isolation : undefined,
      targets,
    }, guardOf(sess));
    if (fin.isolation.exit_code === 3) { process.stderr.write('possible isolation breach: ' + fin.isolation.intersect_paths + ' path(s) changed in both the copy and the source\n'); return 3; }
    return 0;
  } catch (e) {
    process.stderr.write(String(e && e.message) + '\n');
    return 1;
  } finally {
    sess.prep.sandbox.cleanup();
    activeSandbox = null;
  }
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------
function cmdBuild(argv) {
  let f;
  try { f = parseFlags(argv, { scratch: 1 }); } catch (e) { return usage(e.message); }
  if (!f.scratch) return usage('usage: build --scratch <dir>');
  const dir = path.resolve(f.scratch);
  fs.mkdirSync(dir, { recursive: true });
  const so = path.join(dir, 'exec-counter.so');
  const r = cp.spawnSync('gcc', ['-shared', '-fPIC', '-O2', '-o', so, COUNTER_SRC, '-ldl'], { encoding: 'utf8' });
  if (r.status !== 0) { process.stderr.write('gcc failed: ' + String(r.stderr || r.error || '').slice(0, 400).split(dir).join('<scratch>') + '\n'); return 1; }
  process.stdout.write('counter=exec-counter.so size_bytes=' + fs.statSync(so).size + '\n');
  return 0;
}

async function main(argv) {
  const sub = argv[0];
  const rest = argv.slice(1);
  switch (sub) {
    case 'build': return cmdBuild(rest);
    case 'run': return cmdRun(rest);
    case 'blocks': return cmdBlocks(rest);
    case 'walls-subagent': return cmdWallsSubagent(rest);
    default: return usage('usage: process-census.cjs build | run | blocks | walls-subagent (see the header of the file)');
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    if (activeSandbox) activeSandbox.cleanup();
    process.exit(code);
  }, (err) => {
    if (activeSandbox) activeSandbox.cleanup();
    process.stderr.write(String(err && err.stack || err) + '\n');
    process.exit(1);
  });
}

module.exports = { parseExecLog, keyDef, topPrograms, parseTrace, blockTimes, prepModifiedFiles, eligibleMd, DEFAULT_KEYS, main };
