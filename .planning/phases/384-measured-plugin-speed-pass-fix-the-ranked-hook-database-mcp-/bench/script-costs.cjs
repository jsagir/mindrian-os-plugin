#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 05: the runner for the S5, S6 and S9 script-cost measurements. It reuses the library surface of
 * tools/perf/perf-harness.cjs (runChild, runCommandOnce, runEventOnce, prepareRoom, makeCtx, resolveSource,
 * makeTranscript, statsSummary, machineRecord, writeResult) and the probe preload of this folder.
 *
 * Subcommands (every one needs --tree <dir> --out <file>; run under the 384 lock):
 *   drain-empty  S5  brain-derivation-drain on an empty queue, paired with node and bash floors, n 20; cold load of three modules
 *   autoexplore  S5  auto-explore-drain with F finding files (default 0,10,100), two variants; read counts in --counts-out
 *   ledger       S6  explored-materials ledger read cost at --sizes rows (default 100,1000,10000); real ledger row counts
 *   transcript   S9  readTurnText on 0.5, 2 and 4 MiB transcripts (cold, warm, bare read)
 *   stop-reads   S9  probe counts of transcript reads and room reads per hook script for one Stop event
 *
 * Timing results use the schema mos.perf-384/1 (target ids start with script:). Count-only results use
 * mos.perf-384-counts/1. Canon Part 8: numbers, ids and labels only. No path, no room name, no room text.
 * The real ledger folder is read for line counts only (wc -l); only the maximum and the median are written.
 * Test-only flags (need MOS_PERF_SELFTEST=1): --skip-gates, --allow-short. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));
const PROBE = path.join(__dirname, 'probe-preload.cjs');
const MIN_RUNS = 7;

const USAGE = {
  'drain-empty': 'usage: drain-empty --tree <dir> --out <file> [--room fixture|copy] [--source <dir> | --source-file <file>] [--runs N (default 20)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  autoexplore: 'usage: autoexplore --tree <dir> --out <file> --counts-out <file> [--room fixture|copy] [--source-file <file>] [--files 0,10,100] [--runs N (default 7)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  ledger: 'usage: ledger --tree <dir> --out <file> [--sizes 100,1000,10000] [--runs N (default 7)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  transcript: 'usage: transcript --tree <dir> --out <file> [--sizes 0.5,2,4 (MiB)] [--runs N (default 7)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  'stop-reads': 'usage: stop-reads --tree <dir> --out <file> [--room fixture|copy] [--source-file <file>] [--runs N (repeats, default 3)] [--variants unchanged,changed] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
};
const FLAGS = {
  tree: 1, room: 1, source: 1, 'source-file': 1, runs: 1, set: 1, label: 1, out: 1, 'counts-out': 1, scratch: 1,
  'base-sha': 1, sizes: 1, files: 1, variants: 1, 'skip-gates': 'bool', 'allow-short': 'bool',
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

function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }
function round1(x) { return x === null || x === undefined ? null : Math.round(x * 10) / 10; }
function median(a) { return H.statsSummary(a).median; }
function rotated(list, round) { const k = round % list.length; return list.slice(k).concat(list.slice(0, k)); }
function log(msg) { process.stderr.write('[script-costs] ' + msg + '\n'); }

// ---------------------------------------------------------------------------
// one run of the setup: lock, gates, room, context
// ---------------------------------------------------------------------------
async function setup(f, kind) {
  const selftest = process.env.MOS_PERF_SELFTEST === '1';
  if ((f['skip-gates'] || f['allow-short']) && !selftest) throw Object.assign(new Error('--skip-gates and --allow-short are test-only flags and need MOS_PERF_SELFTEST=1'), { exitCode: 2 });
  const runs = parseInt(f.runs, 10);
  if (!Number.isInteger(runs) || runs < 1) throw Object.assign(new Error('--runs must be a positive integer'), { exitCode: 2 });
  if (runs < MIN_RUNS && !f['allow-short'] && f._subcommand !== 'stop-reads') throw Object.assign(new Error('at least ' + MIN_RUNS + ' runs are required (C2); got ' + runs), { exitCode: 2 });
  if (f['base-sha'] !== undefined && !/^[0-9a-f]{40}$/.test(f['base-sha'])) throw Object.assign(new Error('--base-sha needs 40 lowercase hex digits'), { exitCode: 2 });
  const tree = path.resolve(f.tree);
  if (!fs.existsSync(path.join(tree, 'hooks', 'hooks.json'))) throw Object.assign(new Error('not a plugin tree'), { exitCode: 2 });
  if (kind === 'copy' && !f.source && !f['source-file'] && !process.env.MOS_REAL_ROOM_384) throw Object.assign(new Error('--room copy needs --source <dir>, --source-file <file> or MOS_REAL_ROOM_384'), { exitCode: 2 });
  if (!fs.existsSync('/usr/bin/time')) throw Object.assign(new Error('/usr/bin/time is required'), { exitCode: 1 });
  if (!selftest || process.env.MOS_PERF_LOCK_CHECK === 'force') {
    if (!H.requireLock({ lockFile: H.defaultLockFile() })) throw Object.assign(new Error('lock not held: run under flock -w 7200 "$HOME/.cache/mos-perf-384.lock"'), { exitCode: 1 });
  }
  const skipGates = !!(f['skip-gates'] || f['allow-short']);
  if (!skipGates && H.suiteGuard() === 'busy') throw Object.assign(new Error('host busy: a suite process is running'), { exitCode: 75 });
  const scratch = path.resolve(f.scratch || os.tmpdir());
  fs.mkdirSync(scratch, { recursive: true });
  process.env.TMPDIR = scratch;
  const avail = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const cpus = Math.min(4, avail);
  const hasTaskset = os.platform() === 'linux' && cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;
  const baseSha = H.baseShaOf(tree, f['base-sha']);
  const label = f.label || path.basename(tree);
  const startedAt = new Date().toISOString();
  let source = null;
  if (kind === 'copy') {
    source = await H.resolveSource({ source: f.source, sourceFile: f['source-file'] });
    if (!source) throw Object.assign(new Error('no source room'), { exitCode: 2 });
  }
  const srcBefore = source ? H.manifest(source) : null;
  const prep = H.prepareRoom(kind, { trees: [tree], source, scratch, baseSha });
  const load1Start = H.readLoad1();
  const ctx = H.makeCtx('A', tree, prep, cpus, hasTaskset);
  const workBefore = kind === 'copy' ? H.manifest(prep.roomDir) : null;
  const m = workBefore || H.manifest(prep.roomDir);
  let bytes = 0;
  for (const v of m.values()) bytes += Number(String(v).split(':')[0]) || 0;
  const room = { kind: kind === 'fixture' ? 'fixture-room' : (kind === 'copy' ? 'real-copy' : 'synthetic-data'), file_count: m.size, byte_total: bytes, fs_type: H.fsType(prep.roomDir) };
  return {
    f, runs, tree, ctx, prep, kind, scratch, cpus, baseSha, label, startedAt, load1Start, room, source, srcBefore, workBefore, skipGates,
    touched: new Set(),
    // The gate runs at the start of each measurement block. The load1 of the first block is the load1 at the start of
    // the measurement (the room build before it can raise the load for a short time, so it is not the start value).
    async gate() {
      const g = skipGates ? { ok: true, load1: H.readLoad1(), waited_ms: 0 } : await H.gateBeforeTarget({ maxMs: 900000 });
      if (!this.gated) { this.gated = true; this.load1Start = g.load1; }
      return g;
    },
    cleanup() { try { prep.sandbox.cleanup(); } catch (_e) { /* best effort */ } },
  };
}

function ctxWith(ctx, base) {
  return Object.assign({}, ctx, { env: (x) => ctx.env(Object.assign({}, base || {}, x || {})) });
}

// ---------------------------------------------------------------------------
// samples and target records
// ---------------------------------------------------------------------------
function newAcc(id, extra) {
  return { id, wall: [], cpu: [], rss: [], bg: [], exits: new Set(), timedOut: 0, failed: 0, escaped: 0, survivors: 0, extra: extra || {} };
}

// s is the sample of runCommandOnce, or the sample built by selfTimed.
function addSample(acc, s) {
  (s.exits || []).forEach((x) => acc.exits.add(x));
  acc.timedOut += s.timed_out || 0;
  acc.escaped = Math.max(acc.escaped, s.escaped_max || 0);
  acc.survivors += s.survivors_left || 0;
  if (s.run_class === 'failed') { acc.failed += 1; return false; }
  if (s.run_class === 'timeout') return false;
  if (s.wall_ms !== null && s.wall_ms !== undefined) acc.wall.push(s.wall_ms);
  if (s.cpu_ms !== null && s.cpu_ms !== undefined) acc.cpu.push(s.cpu_ms);
  if (s.rss_mb !== null && s.rss_mb !== undefined) acc.rss.push(s.rss_mb);
  acc.bg.push(s.background_ms || 0);
  return true;
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

// A derived target: the wall stats are of a difference or a ratio taken per pair, not of one process. Labelled DERIVED.
function derivedTarget(id, diffs, gate, how) {
  const a = newAcc(id, { derived: true, derived_from: how });
  diffs.forEach((d) => a.wall.push(d));
  a.exits.add(0);
  return toTarget(a, gate);
}

// A child process that times itself: `code` prints one JSON line of numbers (milliseconds) and the keys named in
// `keys` are returned. The runner gets the line through the stdout hook of runChild, so a self-reported number
// replaces the outer wall time. `metrics` is the whole object of the line.
async function selfTimed(ctx, code, args, mainKey, extraEnv) {
  let metrics = null;
  let buf = '';
  const r = await H.runChild(ctx, {
    argv: [process.execPath, '-e', code].concat(args || []),
    cwd: ctx.roomDir,
    env: ctx.env(extraEnv || {}),
    timeoutMs: 180000,
    onStdout: (chunk) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl === -1 || metrics !== null) return null;
      try { metrics = JSON.parse(buf.slice(0, nl)); } catch (_e) { return null; }
      return { wall_ms: Number(metrics[mainKey]) };
    },
  });
  const cls = H.classifyRun(r);
  const bad = metrics === null || !Number.isFinite(Number(metrics[mainKey])) || (metrics.ok !== undefined && metrics.ok !== 1);
  return {
    run_class: cls === 'ok' && bad ? 'failed' : cls,
    wall_ms: metrics ? Number(metrics[mainKey]) : null,
    cpu_ms: r.usage ? r.usage.cpu_ms : null,
    rss_mb: r.usage ? r.usage.rss_mb : null,
    exits: [r.signal ? 'signal:' + r.signal : r.status],
    timed_out: r.timedOut ? 1 : 0,
    survivors_left: 0,
    escaped_max: 0,
    background_ms: 0,
    metrics,
  };
}

const HR = 'const t0 = process.hrtime.bigint(); ';
const ms = (a, b) => 'Number(' + b + ' - ' + a + ') / 1e6';

// ---------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------
function finishIsolation(S) {
  const iso = { source_changed_paths: 0, copy_changed_paths: 0, intersect_paths: 0, exit_code: 0 };
  if (S.kind !== 'copy') return iso;
  const after = H.manifest(S.prep.roomDir);
  H.changedPaths(S.workBefore, after).forEach((p) => S.touched.add(p));
  const srcChanged = H.changedPaths(S.srcBefore, H.manifest(S.source));
  let both = 0;
  for (const p of srcChanged) if (S.touched.has(p)) both += 1;
  iso.source_changed_paths = srcChanged.size;
  iso.copy_changed_paths = S.touched.size;
  iso.intersect_paths = both;
  iso.exit_code = both > 0 ? 3 : 0;
  return iso;
}

function writeOut(S, file, schema, body) {
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
  }, body);
  H.writeResult(file, obj, { home: os.homedir(), sourceRoom: S.source, scratch: S.scratch });
}

// ---------------------------------------------------------------------------
// hook command from hooks.json (the same text the event runner uses), with the payload on stdin from a file
// ---------------------------------------------------------------------------
function hookDef(ctx, needle, id) {
  const e = ctx.hooks.find((h) => h.event === 'UserPromptSubmit' && h.command.indexOf(needle) !== -1);
  if (!e) throw Object.assign(new Error('hook not found in hooks.json: ' + needle), { exitCode: 1 });
  const command = e.command.split('${CLAUDE_PLUGIN_ROOT}').join(ctx.tree);
  return { id, kind: 'cmd', argv: () => ['bash', '-c', command + ' < "$MOS_PAYLOAD_FILE"'], timeoutMs: (e.timeout_ms || 60000) + 1000 };
}

function writePayload(S) {
  const payload = H.buildEventPayload(H.targetDef('event:UserPromptSubmit'), S.ctx);
  const file = path.join(S.prep.sandbox.tmp, 'payload-ups.json');
  fs.writeFileSync(file, JSON.stringify(payload));
  return file;
}

function readProbeLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_e) { return []; }
}

function probeEnv(S, logFile, withTranscript) {
  const cats = {
    mindrian: path.join(S.prep.roomDir, '.mindrian'),
    room: S.prep.roomDir,
    home: S.ctx.sandbox.home,
    lib: path.join(S.tree, 'lib'),
    scripts: path.join(S.tree, 'scripts'),
  };
  // the category is the one transcript file itself (a file path matches by equality)
  if (withTranscript) cats.transcript = S.ctx.getTranscript('tx4m');
  return { NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + PROBE).trim(), MOS_PROBE_LOG: logFile, MOS_PROBE_CATS: JSON.stringify(cats) };
}

function sumFs(lines, cat, fns) {
  let n = 0;
  for (const l of lines) for (const e of l.fs || []) if (e.cat === cat && (!fns || fns.indexOf(e.fn) !== -1)) n += e.count;
  return n;
}
function fsByFn(lines, cat) {
  const o = {};
  for (const l of lines) for (const e of l.fs || []) if (e.cat === cat) o[e.fn] = (o[e.fn] || 0) + e.count;
  return o;
}

// ---------------------------------------------------------------------------
// drain-empty (S5)
// ---------------------------------------------------------------------------
async function cmdDrainEmpty(f) {
  const S = await setup(f, f.room === 'copy' ? 'copy' : 'fixture');
  try {
    const ctx = S.ctx;
    const payloadFile = writePayload(S);
    const cx = ctxWith(ctx, { MOS_PAYLOAD_FILE: payloadFile });
    const hook = hookDef(ctx, 'brain-derivation-drain.cjs', 'script:drain-empty:hook');
    const bareNode = Object.assign({}, H.targetDef('floor:node'), { id: 'script:drain-empty:floor-node' });
    const bashNode = { id: 'script:drain-empty:floor-bash-node', kind: 'cmd', argv: () => ['bash', '-c', '"' + process.execPath + '" -e 0 < "$MOS_PAYLOAD_FILE"'], timeoutMs: 60000 };
    const queueFile = path.join(S.prep.roomDir, '.mindrian', 'brain-derivation-queue.json');
    const queuePresent = fs.existsSync(queueFile);
    // untimed warm-up of each command (file cache)
    for (const d of [hook, bareNode, bashNode]) await H.runCommandOnce(d, cx, { settleMs: 30000 });
    const gate = await S.gate();
    const accH = newAcc(hook.id);
    const accN = newAcc(bareNode.id);
    const accB = newAcc(bashNode.id);
    const diffNode = [];
    const diffBash = [];
    const defs = [[hook, accH], [bareNode, accN], [bashNode, accB]];
    for (let i = 0; i < S.runs; i += 1) {
      const got = {};
      for (const [d, a] of rotated(defs, i)) {
        const s = await H.runCommandOnce(d, cx, { settleMs: 30000 });
        if (addSample(a, s)) got[d.id] = s.wall_ms;
      }
      if (got[hook.id] !== undefined && got[bareNode.id] !== undefined) diffNode.push(got[hook.id] - got[bareNode.id]);
      if (got[hook.id] !== undefined && got[bashNode.id] !== undefined) diffBash.push(got[hook.id] - got[bashNode.id]);
    }
    const targets = [toTarget(accH, gate), toTarget(accN, gate), toTarget(accB, gate),
      derivedTarget('script:drain-empty:hook-minus-floor-node', diffNode, gate, 'per-pair hook wall minus bare node wall'),
      derivedTarget('script:drain-empty:hook-minus-floor-bash-node', diffBash, gate, 'per-pair hook wall minus bash-wrapped node wall')];

    // cold load time of the three modules the script loads, each in a fresh process, and the three in the order of the script
    const mods = [['folder-memory', 'lib/core/folder-memory.cjs'], ['brain-client', 'lib/core/brain-client.cjs'], ['navigation', 'lib/core/navigation.cjs']];
    const loadCode = HR + 'require(process.argv[1]); const t1 = process.hrtime.bigint(); process.stdout.write(JSON.stringify({ ms: ' + ms('t0', 't1') + ' }) + "\\n");';
    const seqCode = 'const T = []; const t0 = process.hrtime.bigint(); for (const m of process.argv.slice(1)) { const a = process.hrtime.bigint(); require(m); T.push(Number(process.hrtime.bigint() - a) / 1e6); } process.stdout.write(JSON.stringify({ ms: Number(process.hrtime.bigint() - t0) / 1e6, parts: T }) + "\\n");';
    const gate2 = await S.gate();
    const modAcc = mods.map(([n]) => newAcc('script:module-load:' + n));
    const seqAcc = newAcc('script:module-load:sequence-total');
    const parts = [[], [], []];
    for (let i = 0; i < S.runs; i += 1) {
      const order = rotated([0, 1, 2, 3], i);
      for (const k of order) {
        if (k < 3) addSample(modAcc[k], await selfTimed(ctx, loadCode, [path.join(S.tree, mods[k][1])], 'ms'));
        else {
          const s = await selfTimed(ctx, seqCode, mods.map((m) => path.join(S.tree, m[1])), 'ms');
          if (addSample(seqAcc, s) && s.metrics && Array.isArray(s.metrics.parts)) s.metrics.parts.forEach((p, j) => parts[j].push(p));
        }
      }
    }
    seqAcc.extra.parts_median_ms = { 'folder-memory': median(parts[0]), 'brain-client': median(parts[1]), navigation: median(parts[2]) };
    modAcc.forEach((a) => targets.push(toTarget(a, gate2)));
    targets.push(toTarget(seqAcc, gate2));

    // the count run, apart from the timing runs: modules loaded and file calls of the hook script
    const countLog = path.join(S.prep.sandbox.tmp, 'drain-count.log');
    const cc = ctxWith(ctx, Object.assign({ MOS_PAYLOAD_FILE: payloadFile }, probeEnv(S, countLog)));
    const rc = await H.runCommandOnce(hook, cc, { settleMs: 30000 });
    const lines = readProbeLines(countLog).filter((l) => l.argv1 === 'brain-derivation-drain.cjs');
    const countsInfo = {
      count_run_class: rc.run_class,
      queue_file_present: queuePresent,
      script_processes: lines.length,
      modules_loaded: lines.length ? Math.max.apply(null, lines.map((l) => l.modules)) : null,
      lib_file_reads: sumFs(lines, 'lib', ['readFileSync', 'readFile', 'openSync']),
      sqlite_constructed: lines.reduce((a, l) => a + l.sqlite.constructed, 0),
    };
    writeOut(S, f.out, H.SCHEMA, { drain_empty: countsInfo, isolation: finishIsolation(S), targets });
    log('drain-empty hook median ' + toTarget(accH, gate).wall_ms.median + ' ms (n ' + accH.wall.length + '), floor node ' + toTarget(accN, gate).wall_ms.median + ' ms');
    return finishCode(S);
  } finally { S.cleanup(); }
}

function finishCode(S) {
  const iso = finishIsolation(S);
  return iso.exit_code;
}

// ---------------------------------------------------------------------------
// autoexplore (S5)
// ---------------------------------------------------------------------------
const FIND_PREFIX = 'auto-explore-zz384-';

function countFindingFiles(roomDir) {
  try { return fs.readdirSync(path.join(roomDir, '.mindrian')).filter((n) => n.startsWith('auto-explore-') && n.endsWith('.json') && n.indexOf('.tmp.') === -1).length; } catch (_e) { return 0; }
}

function hex(seed, len) { return crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, len); }

async function cmdAutoexplore(f) {
  const kind = f.room === 'copy' ? 'copy' : 'fixture';
  if (!f['counts-out']) throw Object.assign(new Error('missing --counts-out'), { exitCode: 2 });
  const S = await setup(f, kind);
  try {
    const ctx = S.ctx;
    const room = S.prep.roomDir;
    const mind = path.join(room, '.mindrian');
    fs.mkdirSync(mind, { recursive: true });
    const payloadFile = writePayload(S);
    const cx = ctxWith(ctx, { MOS_PAYLOAD_FILE: payloadFile });
    const hook = hookDef(ctx, 'auto-explore-drain.cjs', 'script:autoexplore');
    const existing = countFindingFiles(room);
    // the fixture room is a sandbox: finding files it already holds are removed, so F is the whole count (the removed count is on file)
    let existingRemoved = 0;
    if (kind === 'fixture') {
      for (const n of fs.readdirSync(mind)) {
        if (n.startsWith('auto-explore-') && n.endsWith('.json')) { fs.rmSync(path.join(mind, n), { force: true }); existingRemoved += 1; }
      }
    }
    let sizes;
    if (f.files) sizes = f.files.split(',').map((x) => parseInt(x, 10));
    else sizes = kind === 'copy' ? [existing] : [0, 10, 100];
    if (sizes.some((x) => !Number.isInteger(x) || x < 0)) throw Object.assign(new Error('--files needs non-negative integers'), { exitCode: 2 });
    const synthetic = !!f.files || kind === 'fixture';
    const ambientFile = path.join(mind, 'ambient-run-ledger.json');
    let origAmbient = null;
    try { origAmbient = fs.readFileSync(ambientFile, 'utf8'); } catch (_e) { origAmbient = null; }
    const homeLedger = path.join(ctx.sandbox.home, '.mindrian', 'explored-materials');

    const groups = [];
    for (const F of sizes) {
      if (F === 0) groups.push({ F, mode: 'open', id: 'script:autoexplore:f0' });
      else {
        // open: a finding is pending, the script surfaces it (the whole path). held: the ambient ledger holds every
        // finding, so each file is read and skipped (the pure scan). done: the explored-materials ledger says every
        // finding was answered, so each file is read and parsed and the script emits nothing (the steady state of a
        // room whose finding files stay on disk after the person answered).
        groups.push({ F, mode: 'open', id: 'script:autoexplore:f' + F + ':open' });
        groups.push({ F, mode: 'held', id: 'script:autoexplore:f' + F + ':held' });
        groups.push({ F, mode: 'done', id: 'script:autoexplore:f' + F + ':done' });
      }
    }
    // The open path (the script surfaces a finding) writes one new auto-explore-<hash>.json per run. Those files and
    // the synthetic ones are removed before every run, so each run starts with exactly F finding files (found in the first sanity run).
    const initialNames = new Set(fs.readdirSync(mind).filter((n) => n.startsWith('auto-explore-') && n.endsWith('.json')));
    const removeSynthetic = () => {
      for (const n of fs.readdirSync(mind)) {
        if (n.startsWith('auto-explore-') && n.endsWith('.json') && !initialNames.has(n)) fs.rmSync(path.join(mind, n), { force: true });
      }
    };
    // apply one group: the finding files, the ambient ledger that holds them (held) or not (open), an empty explored-materials ledger
    const apply = (g) => {
      removeSynthetic();
      if (synthetic) {
        for (let k = 0; k < g.F; k += 1) {
          const rec = { id: 'f' + k, material_id: hex('mat' + k, 32), file_path_sha256: hex('fp' + k, 64), source_section: 'problem-definition', top_differential: 'alpha beta gamma', top_differential_score: 0.5 };
          fs.writeFileSync(path.join(mind, FIND_PREFIX + k + '.json'), JSON.stringify(rec));
        }
      }
      const ids = [];
      if (g.mode === 'held' || g.mode === 'done') {
        for (const n of fs.readdirSync(mind)) {
          if (!n.startsWith('auto-explore-') || !n.endsWith('.json') || n.indexOf('.tmp.') !== -1) continue;
          try { const j = JSON.parse(fs.readFileSync(path.join(mind, n), 'utf8')); if (j && typeof j.material_id === 'string') ids.push(j.material_id); } catch (_e) { /* skip */ }
        }
      }
      if (g.mode === 'held') fs.writeFileSync(ambientFile, JSON.stringify({ stamped_materials: ids }));
      else if (origAmbient !== null) fs.writeFileSync(ambientFile, origAmbient);
      else fs.rmSync(ambientFile, { force: true });
      fs.rmSync(homeLedger, { recursive: true, force: true });
      if (g.mode === 'done') {
        // one answered row per finding in the explored-materials ledger of this room slug (sandbox HOME)
        fs.mkdirSync(homeLedger, { recursive: true });
        const now = Date.now();
        const rows = ids.map((id) => JSON.stringify({ material_id: id, file_path_sha256: '0'.repeat(64), relative_file_path: '', mtime_seconds: 0, fired_at: now, state: 'completed', finding_count: 1, surfaced: true, user_response: 'SKIP', responded_at: now, suppress_reason: null, in_flight_since: null }));
        fs.writeFileSync(path.join(homeLedger, encodeURIComponent(path.basename(room)) + '.jsonl'), rows.join('\n') + (rows.length ? '\n' : ''));
      }
    };
    const restoreAll = () => {
      removeSynthetic();
      if (origAmbient !== null) fs.writeFileSync(ambientFile, origAmbient); else fs.rmSync(ambientFile, { force: true });
      fs.rmSync(homeLedger, { recursive: true, force: true });
    };

    for (const g of groups) { apply(g); await H.runCommandOnce(hook, cx, { settleMs: 30000 }); } // untimed warm-up
    const gate = await S.gate();
    const accs = new Map(groups.map((g) => [g.id, newAcc(g.id, { finding_files: g.F, variant: g.F === 0 ? 'none' : g.mode })]));
    for (let i = 0; i < S.runs; i += 1) {
      for (const g of rotated(groups, i)) {
        apply(g);
        const s = await H.runCommandOnce(hook, cx, { settleMs: 30000 });
        addSample(accs.get(g.id), s);
      }
    }
    const targets = groups.map((g) => toTarget(accs.get(g.id), gate));

    // the count runs, apart from the timing runs: two per group, file calls by category for the script
    const reads = [];
    for (const g of groups) {
      const runsOut = [];
      for (let k = 0; k < 2; k += 1) {
        apply(g);
        const lf = path.join(ctx.sandbox.tmp, 'ae-count-' + g.id.replace(/[^a-z0-9]/gi, '_') + '-' + k + '.log');
        const cc = ctxWith(ctx, Object.assign({ MOS_PAYLOAD_FILE: payloadFile }, probeEnv(S, lf)));
        const rr = await H.runCommandOnce(hook, cc, { settleMs: 30000 });
        const lines = readProbeLines(lf).filter((l) => l.argv1 === 'auto-explore-drain.cjs');
        let ledgerRows = 0;
        try { for (const n of fs.readdirSync(homeLedger)) ledgerRows += fs.readFileSync(path.join(homeLedger, n), 'utf8').split('\n').filter(Boolean).length; } catch (_e) { ledgerRows = 0; }
        runsOut.push({ run_class: rr.run_class, processes: lines.length, mindrian: fsByFn(lines, 'mindrian'), room: fsByFn(lines, 'room'), lib_reads: sumFs(lines, 'lib', ['readFileSync', 'readFile', 'openSync']), scripts_reads: sumFs(lines, 'scripts', ['readFileSync', 'readFile', 'openSync']), sqlite_constructed: lines.reduce((a, l) => a + l.sqlite.constructed, 0), modules_loaded: lines.length ? Math.max.apply(null, lines.map((l) => l.modules)) : null, surfaced_ledger_rows: ledgerRows });
      }
      reads.push({ id: g.id, finding_files: g.F, variant: g.F === 0 ? 'none' : g.mode, repeats: 2, repeats_agree: JSON.stringify(runsOut[0]) === JSON.stringify(runsOut[1]), result: runsOut[0] });
    }
    restoreAll();
    // reads per finding file: (reads at F minus reads at the smallest F) divided by the difference in files, per variant
    const slopes = [];
    for (const variant of ['open', 'held', 'done']) {
      const pts = reads.filter((r) => r.variant === variant || (r.variant === 'none' && r.finding_files === 0));
      if (pts.length < 2) continue;
      pts.sort((a, b) => a.finding_files - b.finding_files);
      const lo = pts[0];
      const hi = pts[pts.length - 1];
      if (hi.finding_files === lo.finding_files) continue;
      slopes.push({ variant, from_files: lo.finding_files, to_files: hi.finding_files, readFileSync_per_finding_file: round1(((hi.result.mindrian.readFileSync || 0) - (lo.result.mindrian.readFileSync || 0)) / (hi.finding_files - lo.finding_files)) });
    }
    const body = { autoexplore: { finding_files: sizes.length === 1 ? sizes[0] : null, finding_file_counts: sizes, synthetic_findings: synthetic, fixture_files_removed_first: existingRemoved, files_in_copy_before: kind === 'copy' ? existing : null } };
    if (kind === 'copy' && !f.files) log('finding_files=' + existing);
    writeOut(S, f.out, H.SCHEMA, Object.assign({ isolation: finishIsolation(S), targets }, body));
    // the counts file: same machine record, counts only
    writeOut(S, f['counts-out'], H.COUNTS_SCHEMA, Object.assign({ targets: undefined }, body, { reads, slopes }));
    log('autoexplore groups ' + groups.length + ', medians ' + targets.map((t) => t.id.replace('script:autoexplore:', '') + '=' + t.wall_ms.median).join(' '));
    return finishCode(S);
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// ledger (S6)
// ---------------------------------------------------------------------------
function realLedgerRowCounts() {
  // Counts only. The folder under the real home holds room slugs and findings; nothing but numbers leaves this function.
  const dir = path.join(os.homedir(), '.mindrian', 'explored-materials');
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')); } catch (_e) { return { files: 0, rows_max: null, rows_median: null }; }
  const rows = [];
  for (const n of names) {
    const r = cp.spawnSync('wc', ['-l', path.join(dir, n)], { encoding: 'utf8' });
    if (r.status === 0) { const m = /^\s*([0-9]+)/.exec(r.stdout); if (m) rows.push(Number(m[1])); }
  }
  if (!rows.length) return { files: 0, rows_max: null, rows_median: null };
  return { files: rows.length, rows_max: Math.max.apply(null, rows), rows_median: median(rows) };
}

function slopePer1000(points) {
  // least squares slope of ms against rows, per 1000 rows
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((a, p) => a + p[0], 0) / n;
  const my = points.reduce((a, p) => a + p[1], 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) { num += (x - mx) * (y - my); den += (x - mx) * (x - mx); }
  return den ? Math.round((num / den) * 1000 * 1000) / 1000 : null;
}

async function cmdLedger(f) {
  const S = await setup(f, 'synthetic');
  try {
    const ctx = S.ctx;
    const real = realLedgerRowCounts();
    const sizes = (f.sizes || '100,1000,10000').split(',').map((x) => parseInt(x, 10));
    if (sizes.some((x) => !Number.isInteger(x) || x < 1)) throw Object.assign(new Error('--sizes needs positive integers'), { exitCode: 2 });
    const store = path.join(S.tree, 'lib', 'memory', 'explored-materials-store.cjs');
    const buildCode = 'const s = require(process.argv[1]); const N = Number(process.argv[2]); const slug = process.argv[3]; const c = require("crypto");'
      + ' for (let i = 0; i < N; i += 1) { const id = c.createHash("sha256").update("m" + i).digest("hex").slice(0, 32);'
      + ' const r = s.appendMaterial(slug, { material_id: id, file_path_sha256: c.createHash("sha256").update("p" + i).digest("hex"), relative_file_path: "section-" + (i % 7) + "/note-" + i + ".md", mtime_seconds: 1700000000 + i, fired_at: 1700000000000 + i, state: "completed", finding_count: 1, surfaced: true, user_response: null, responded_at: null, suppress_reason: null, in_flight_since: null });'
      + ' if (!r.ok) process.exit(3); }';
    const dir = path.join(ctx.sandbox.home, '.mindrian', 'explored-materials');
    const sizeInfo = [];
    for (const N of sizes) {
      const slug = 'bench-n' + N;
      const b = await H.runChild(ctx, { argv: [process.execPath, '-e', buildCode, store, String(N), slug], cwd: ctx.roomDir, env: ctx.env({}), timeoutMs: 300000 });
      if (b.status !== 0) throw Object.assign(new Error('ledger build failed for size ' + N), { exitCode: 1 });
      const file = path.join(dir, slug + '.jsonl');
      const text = fs.readFileSync(file, 'utf8');
      sizeInfo.push({ rows: text.split('\n').filter(Boolean).length, bytes: Buffer.byteLength(text), slug });
    }
    const findFirst = HR + 'const s = require(process.argv[1]); const t1 = process.hrtime.bigint(); const r = s.findLatest(process.argv[2], "f".repeat(32)); const t2 = process.hrtime.bigint();'
      + ' process.stdout.write(JSON.stringify({ ok: r === null ? 1 : 0, first: ' + ms('t1', 't2') + ', load: ' + ms('t0', 't1') + ' }) + "\\n");';
    const readFirst = HR + 'const s = require(process.argv[1]); const t1 = process.hrtime.bigint(); const r = s.readMaterials(process.argv[2]); const t2 = process.hrtime.bigint();'
      + ' process.stdout.write(JSON.stringify({ ok: Array.isArray(r) && r.length === Number(process.argv[3]) ? 1 : 0, first: ' + ms('t1', 't2') + ' }) + "\\n");';
    const findWarm = 'const s = require(process.argv[1]); s.findLatest(process.argv[2], "f".repeat(32)); const t1 = process.hrtime.bigint(); for (let i = 0; i < 100; i += 1) s.findLatest(process.argv[2], "f".repeat(32));'
      + ' const t2 = process.hrtime.bigint(); process.stdout.write(JSON.stringify({ ok: 1, per_call: ' + ms('t1', 't2') + ' / 100 }) + "\\n");';
    const gate = await S.gate();
    const accs = {};
    for (const si of sizeInfo) {
      for (const k of ['find-first', 'find-warm', 'read-first']) accs[si.rows + ':' + k] = newAcc('script:ledger:n' + si.rows + ':' + k, { ledger_rows: si.rows, ledger_bytes: si.bytes });
    }
    // one warm-up child per size, then n children per number with the size order rotated each round
    for (const si of sizeInfo) await selfTimed(ctx, findFirst, [store, si.slug], 'first');
    for (let i = 0; i < S.runs; i += 1) {
      for (const si of rotated(sizeInfo, i)) {
        addSample(accs[si.rows + ':find-first'], await selfTimed(ctx, findFirst, [store, si.slug], 'first'));
        addSample(accs[si.rows + ':find-warm'], await selfTimed(ctx, findWarm, [store, si.slug], 'per_call'));
        addSample(accs[si.rows + ':read-first'], await selfTimed(ctx, readFirst, [store, si.slug, String(si.rows)], 'first'));
      }
    }
    const targets = Object.keys(accs).map((k) => toTarget(accs[k], gate));
    const med = (rows, k) => targets.find((t) => t.id === 'script:ledger:n' + rows + ':' + k).wall_ms.median;
    const slope = {};
    for (const k of ['find-first', 'find-warm', 'read-first']) slope[k] = slopePer1000(sizeInfo.map((si) => [si.rows, med(si.rows, k)]));
    writeOut(S, f.out, H.SCHEMA, { ledger: { sizes: sizeInfo.map((s) => ({ rows: s.rows, bytes: s.bytes })), slope_ms_per_1000_rows: slope, real_ledger: real }, isolation: finishIsolation(S), targets });
    log('ledger find-first medians ' + sizeInfo.map((si) => si.rows + ':' + med(si.rows, 'find-first')).join(' ') + ' ms; real ledger files ' + real.files);
    return 0;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// transcript (S9)
// ---------------------------------------------------------------------------
async function cmdTranscript(f) {
  const S = await setup(f, 'synthetic');
  try {
    const ctx = S.ctx;
    const mib = (f.sizes || '0.5,2,4').split(',').map((x) => Number(x));
    if (mib.some((x) => !(x > 0))) throw Object.assign(new Error('--sizes needs positive numbers (MiB)'), { exitCode: 2 });
    const tt = path.join(S.tree, 'lib', 'hmi', 'turn-text.cjs');
    const infos = mib.map((m) => {
      const file = path.join(ctx.sandbox.root, 'tx-' + m + '.jsonl');
      const made = H.makeTranscript(file, Math.round(m * 1048576));
      return { mib: m, file, bytes: made.bytes, records: made.records };
    });
    const cold = HR + 'const tt = require(process.argv[1]); const t1 = process.hrtime.bigint(); const r = tt.readTurnText(process.argv[2]); const t2 = process.hrtime.bigint();'
      + ' process.stdout.write(JSON.stringify({ ok: r && typeof r.output_text === "string" && r.output_text.length > 0 ? 1 : 0, load: ' + ms('t0', 't1') + ', call: ' + ms('t1', 't2') + ', total: ' + ms('t0', 't2') + ' }) + "\\n");';
    const warm = 'const tt = require(process.argv[1]); tt.readTurnText(process.argv[2]); const t1 = process.hrtime.bigint(); let r; for (let i = 0; i < 50; i += 1) r = tt.readTurnText(process.argv[2]);'
      + ' const t2 = process.hrtime.bigint(); process.stdout.write(JSON.stringify({ ok: r && r.output_text ? 1 : 0, per_call: ' + ms('t1', 't2') + ' / 50 }) + "\\n");';
    // a bare read of the same bytes the reader takes: the whole file up to the 2 MiB cap, else the last 2 MiB
    const bare = 'const fs = require("fs"); const f = process.argv[1]; const CAP = 2 * 1024 * 1024; const t0 = process.hrtime.bigint(); const st = fs.statSync(f); let raw;'
      + ' if (st.size <= CAP) raw = fs.readFileSync(f, "utf8"); else { const fd = fs.openSync(f, "r"); const buf = Buffer.alloc(CAP); const n = fs.readSync(fd, buf, 0, CAP, st.size - CAP); fs.closeSync(fd); raw = buf.slice(0, n).toString("utf8"); }'
      + ' const t1 = process.hrtime.bigint(); process.stdout.write(JSON.stringify({ ok: raw.length > 0 ? 1 : 0, read: ' + ms('t0', 't1') + ' }) + "\\n");';
    for (const inf of infos) await selfTimed(ctx, cold, [tt, inf.file], 'total'); // warm-up: file cache
    const gate = await S.gate();
    const accs = {};
    for (const inf of infos) {
      const tag = String(inf.mib).replace('.', 'p') + 'mib';
      for (const k of ['cold-load', 'cold-call', 'cold-total', 'warm-call', 'bare-read']) accs[tag + ':' + k] = newAcc('script:transcript:' + tag + ':' + k, { transcript_bytes: inf.bytes });
      inf.tag = tag;
    }
    for (let i = 0; i < S.runs; i += 1) {
      for (const inf of rotated(infos, i)) {
        const c = await selfTimed(ctx, cold, [tt, inf.file], 'total');
        const pick = (key) => Object.assign({}, c, { wall_ms: c.metrics ? c.metrics[key] : null });
        addSample(accs[inf.tag + ':cold-total'], c);
        addSample(accs[inf.tag + ':cold-load'], pick('load'));
        addSample(accs[inf.tag + ':cold-call'], pick('call'));
        addSample(accs[inf.tag + ':warm-call'], await selfTimed(ctx, warm, [tt, inf.file], 'per_call'));
        addSample(accs[inf.tag + ':bare-read'], await selfTimed(ctx, bare, [inf.file], 'read'));
      }
    }
    const targets = Object.keys(accs).map((k) => toTarget(accs[k], gate));
    writeOut(S, f.out, H.SCHEMA, { transcript: { tail_cap_bytes: 2097152, sizes: infos.map((i) => ({ mib: i.mib, bytes: i.bytes, records: i.records })) }, isolation: finishIsolation(S), targets });
    log('transcript cold-total medians ' + infos.map((i) => i.mib + 'MiB:' + targets.find((t) => t.id === 'script:transcript:' + i.tag + ':cold-total').wall_ms.median).join(' ') + ' ms');
    return 0;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// stop-reads (S9)
// ---------------------------------------------------------------------------
const TX_FNS = ['readFileSync', 'readFile', 'openSync', 'open', 'promises.readFile', 'promises.open'];
const FILE_READ_FNS = ['readFileSync', 'readFile', 'promises.readFile'];

function aggregate(lines) {
  const by = new Map();
  for (const l of lines) {
    const e = by.get(l.argv1) || { script: l.argv1, processes: 0, modules: 0, fs: new Map(), sqlite_constructed: 0, sqlite_exec: 0, sqlite_prepare: 0, perProc: [] };
    e.processes += 1;
    // the room file reads of this one process (room and .mindrian folders), so a walk over the sections shows as one large number
    e.perProc.push((l.fs || []).filter((r) => (r.cat === 'room' || r.cat === 'mindrian') && FILE_READ_FNS.indexOf(r.fn) !== -1).reduce((a, r) => a + r.count, 0));
    e.modules += l.modules;
    e.sqlite_constructed += l.sqlite.constructed;
    e.sqlite_exec += l.sqlite.exec;
    e.sqlite_prepare += l.sqlite.prepare;
    for (const r of l.fs || []) e.fs.set(r.cat + '\t' + r.fn, (e.fs.get(r.cat + '\t' + r.fn) || 0) + r.count);
    by.set(l.argv1, e);
  }
  return [...by.values()].sort((a, b) => (a.script < b.script ? -1 : 1)).map((e) => {
    const get = (cat, fns) => { let n = 0; for (const [k, v] of e.fs) { const [c, fn] = k.split('\t'); if (c === cat && (!fns || fns.indexOf(fn) !== -1)) n += v; } return n; };
    return {
      script: e.script,
      processes: e.processes,
      transcript_reads: get('transcript', TX_FNS),
      transcript_stats: get('transcript', ['statSync', 'lstatSync', 'stat']),
      room_file_reads: get('room', FILE_READ_FNS) + get('mindrian', FILE_READ_FNS),
      room_file_reads_per_process: e.perProc.slice().sort((a, b) => b - a).slice(0, 30),
      room_stats: get('room', ['statSync', 'lstatSync', 'stat']) + get('mindrian', ['statSync', 'lstatSync', 'stat']),
      room_readdirs: get('room', ['readdirSync', 'readdir']) + get('mindrian', ['readdirSync', 'readdir']),
      sqlite_constructed: e.sqlite_constructed,
      sqlite_exec: e.sqlite_exec,
      sqlite_prepare: e.sqlite_prepare,
      modules_sum: e.modules,
    };
  });
}

function sectionCounts(roomDir) {
  let dirs = [];
  try { dirs = fs.readdirSync(roomDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name[0] !== '.').map((d) => d.name); } catch (_e) { dirs = []; }
  let withRoom = 0;
  for (const d of dirs) if (fs.existsSync(path.join(roomDir, d, 'ROOM.md'))) withRoom += 1;
  return { section_dirs: dirs.length, sections_with_room_md: withRoom };
}

async function cmdStopReads(f) {
  const kind = f.room === 'copy' ? 'copy' : 'fixture';
  f._subcommand = 'stop-reads';
  const S = await setup(f, kind);
  try {
    const ctx = S.ctx;
    const variants = (f.variants || 'unchanged,changed').split(',');
    if (variants.some((v) => v !== 'unchanged' && v !== 'changed')) throw Object.assign(new Error('--variants takes unchanged and changed'), { exitCode: 2 });
    const out = {};
    for (const v of variants) {
      const def = H.targetDef('event:Stop:' + v + ':tx4m');
      if (v === 'unchanged') {
        for (let k = 0; k < 6; k += 1) {
          const w = await H.runEventOnce(def, ctx, { noTouch: true, settleMs: 120000 });
          await sleepMs(1100);
          if (w.changed_path_taken !== true) break;
        }
      }
      const gate = await S.gate();
      const repeats = [];
      for (let k = 0; k < S.runs; k += 1) {
        const lf = path.join(ctx.sandbox.tmp, 'stop-' + v + '-' + k + '.log');
        const s = await H.runEventOnce(def, ctx, { noTouch: v === 'unchanged', extraEnv: probeEnv(S, lf, true), settleMs: 120000 });
        repeats.push({ run_class: s.run_class, changed_path_taken: s.changed_path_taken === undefined ? null : s.changed_path_taken, by_script: aggregate(readProbeLines(lf)) });
        if (v === 'unchanged') await sleepMs(1100);
      }
      const first = JSON.stringify(repeats[0].by_script);
      out[v] = {
        repeats: repeats.length,
        repeats_agree: repeats.every((r) => JSON.stringify(r.by_script) === first),
        // the transcript reads per script label agree across the repeats (background work can differ in the other counts)
        transcript_reads_agree: repeats.every((r) => JSON.stringify(r.by_script.map((b) => [b.script, b.transcript_reads])) === JSON.stringify(repeats[0].by_script.map((b) => [b.script, b.transcript_reads]))),
        run_classes: repeats.map((r) => r.run_class),
        changed_path_taken_runs: repeats.filter((r) => r.changed_path_taken === true).length,
        load1_start: gate.load1,
        by_script: repeats[0].by_script,
      };
      log('stop ' + v + ': ' + repeats[0].by_script.length + ' script labels, repeats agree ' + out[v].repeats_agree);
    }
    const sections = sectionCounts(S.prep.roomDir);
    writeOut(S, f.out, H.COUNTS_SCHEMA, { sections, transcript_bytes: 4194304, stop: out, isolation: finishIsolation(S) });
    return finishCode(S);
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
async function main(argv) {
  const sub = argv[0];
  if (!sub || !USAGE[sub]) {
    process.stderr.write('usage: script-costs.cjs <drain-empty|autoexplore|ledger|transcript|stop-reads> --tree <dir> --out <file> [...]\n');
    return 2;
  }
  let f;
  try { f = parseFlags(argv.slice(1)); } catch (e) { process.stderr.write(e.message + '\n' + USAGE[sub] + '\n'); return 2; }
  if (!f.tree || !f.out) { process.stderr.write(USAGE[sub] + '\n'); return 2; }
  if (f.runs === undefined) f.runs = sub === 'drain-empty' ? '20' : (sub === 'stop-reads' ? '3' : '7');
  f._subcommand = sub;
  try {
    switch (sub) {
      case 'drain-empty': return await cmdDrainEmpty(f);
      case 'autoexplore': return await cmdAutoexplore(f);
      case 'ledger': return await cmdLedger(f);
      case 'transcript': return await cmdTranscript(f);
      default: return await cmdStopReads(f);
    }
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e).replace(/\/[^\s]*/g, '<path>') + '\n');
    return e && Number.isInteger(e.exitCode) ? e.exitCode : 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { process.stderr.write('script-costs failed\n'); process.exit(1); });
}

module.exports = { main, slopePer1000, aggregate, realLedgerRowCounts };
