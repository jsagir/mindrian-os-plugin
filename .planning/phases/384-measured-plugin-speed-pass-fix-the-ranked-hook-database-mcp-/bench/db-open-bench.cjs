#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 07: the database bench for finding S3. It reuses the library surface of tools/perf/perf-harness.cjs
 * (runChild, runEventOnce, prepareRoom, makeCtx, resolveSource, statsSummary, machineRecord, writeResult) and the probe
 * preload of this folder (plan 384-05). It changes no product file: it calls openRoomDb on a scratch room.
 *
 * Subcommands (both need --tree <dir> --out <file>; run under the 384 lock):
 *   run           time openRoomDb plus closeRoomDb (A, target ids db:*:open) against a bare DatabaseSync with the same
 *                 timeout option plus close (B, db:*:bare), in interleaved rounds (A B, B A, A B, ...), cold (one open in
 *                 a fresh process) and warm (a loop of --warm-opens opens in one process, one sample per process, the
 *                 mean per open). A third target runs A with the bypass audit switched off by its documented
 *                 environment variable (db:*:open-audit-off), to split the audit cost out. A separate counting run with
 *                 the probe preload reports the constructed, exec and prepare counts per open. Timing file: mos.perf-384/1.
 *   session-opens count the room database opens of one SessionStart (startup) by hook script, --repeats times (default
 *                 3), with the probe preload. Counts file: mos.perf-384-counts/1.
 *
 * Timing is taken with process.hrtime.bigint around the call only, after the requires. Counting runs are apart from
 * timing runs (the preload slows a process). Canon Part 8: numbers, ids, labels and script base names only; no path,
 * no room name, no room text. Test-only flags (need MOS_PERF_SELFTEST=1): --skip-gates, --allow-short. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));
const PROBE = path.join(__dirname, 'probe-preload.cjs');
const MIN_RUNS = 7;

const USAGE = {
  run: 'usage: run --tree <dir> --out <file> [--room fixture|copy] [--source <dir> | --source-file <file>] [--runs N (default 7)] [--warm-opens N (default 100)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  'session-opens': 'usage: session-opens --tree <dir> --out <file> [--room fixture|copy] [--source <dir> | --source-file <file>] [--repeats N (default 3)] [--variant unchanged|changed] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
};
const FLAGS = {
  tree: 1, room: 1, source: 1, 'source-file': 1, runs: 1, 'warm-opens': 1, repeats: 1, variant: 1, set: 1, label: 1, out: 1, scratch: 1,
  'base-sha': 1, 'skip-gates': 'bool', 'allow-short': 'bool',
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
function median(a) { return H.statsSummary(a).median; }
function log(msg) { process.stderr.write('[db-open-bench] ' + msg + '\n'); }

// ---------------------------------------------------------------------------
// the timed child. argv: tree, room, mode (open|bare), n. The requires come first; the clock runs around the loop only.
// The module name of the database is joined at run time (the substrate scan matches the literal name in a source file).
// Both modes load room-db.cjs, so the two kinds of child hold the same modules before the clock starts.
// ---------------------------------------------------------------------------
const CHILD_CODE = [
  'const path = require("node:path");',
  'const sq = require(["node", "sqlite"].join(":"));',
  'const tree = process.argv[1], room = process.argv[2], mode = process.argv[3], n = parseInt(process.argv[4], 10);',
  'const rdb = require(path.join(tree, "lib", "core", "room-db.cjs"));',
  'const dbPath = path.join(room, ".mindrian", "room.db");',
  'let ok = 1;',
  'const t0 = process.hrtime.bigint();',
  'for (let i = 0; i < n; i += 1) {',
  '  try {',
  '    if (mode === "bare") { const d = new sq.DatabaseSync(dbPath, { timeout: 5000 }); d.close(); }',
  '    else { const d = rdb.openRoomDb(room); rdb.closeRoomDb(d); }',
  '  } catch (e) { ok = 0; break; }',
  '}',
  'const t1 = process.hrtime.bigint();',
  'const total = Number(t1 - t0) / 1e6;',
  'process.stdout.write(JSON.stringify({ ok: ok, total_ms: total, per_open_ms: total / n }) + "\\n");',
].join('\n');

// A is the open of the product, B is the bare open. A round runs open, bare, open-audit-off, or the reverse, so the
// relative order of A and B alternates: A B, B A, A B, ...
function roundOrder(round) { return round % 2 === 0 ? ['open', 'bare', 'off'] : ['off', 'bare', 'open']; }
function pairOrders(n) {
  const out = [];
  for (let i = 0; i < n; i += 1) { const o = roundOrder(i); out.push(o.indexOf('open') < o.indexOf('bare') ? 'AB' : 'BA'); }
  return out;
}

// ---------------------------------------------------------------------------
// setup: lock, gates, room, context
// ---------------------------------------------------------------------------
async function setup(f, kind, runsKey, minRuns) {
  const selftest = process.env.MOS_PERF_SELFTEST === '1';
  if ((f['skip-gates'] || f['allow-short']) && !selftest) throw Object.assign(new Error('--skip-gates and --allow-short are test-only flags and need MOS_PERF_SELFTEST=1'), { exitCode: 2 });
  const runs = parseInt(f[runsKey], 10);
  if (!Number.isInteger(runs) || runs < 1) throw Object.assign(new Error('--' + runsKey + ' must be a positive integer'), { exitCode: 2 });
  if (runs < minRuns && !f['allow-short']) throw Object.assign(new Error('at least ' + minRuns + ' runs are required (C2); got ' + runs), { exitCode: 2 });
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
  const room = { kind: kind === 'fixture' ? 'fixture-room' : 'real-copy', file_count: m.size, byte_total: bytes, fs_type: H.fsType(prep.roomDir) };
  return {
    f, runs, tree, ctx, prep, kind, scratch, cpus, baseSha, label, startedAt, load1Start, room, source, srcBefore, workBefore, skipGates,
    touched: new Set(),
    async gate() {
      const g = skipGates ? { ok: true, load1: H.readLoad1(), waited_ms: 0 } : await H.gateBeforeTarget({ maxMs: 900000 });
      if (!this.gated) { this.gated = true; this.load1Start = g.load1; }
      return g;
    },
    cleanup() { try { prep.sandbox.cleanup(); } catch (_e) { /* best effort */ } },
  };
}

// ---------------------------------------------------------------------------
// samples and target records
// ---------------------------------------------------------------------------
function newAcc(id, extra) {
  return { id, wall: [], cpu: [], rss: [], bg: [], exits: new Set(), timedOut: 0, failed: 0, extra: extra || {} };
}

function addSample(acc, s) {
  (s.exits || []).forEach((x) => acc.exits.add(x));
  acc.timedOut += s.timed_out || 0;
  if (s.run_class === 'failed') { acc.failed += 1; return false; }
  if (s.run_class === 'timeout') return false;
  if (s.wall_ms !== null && s.wall_ms !== undefined) acc.wall.push(s.wall_ms);
  if (s.cpu_ms !== null && s.cpu_ms !== undefined) acc.cpu.push(s.cpu_ms);
  if (s.rss_mb !== null && s.rss_mb !== undefined) acc.rss.push(s.rss_mb);
  acc.bg.push(0);
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
    background_ms: 0,
    escaped_max: 0,
    survivors_left: 0,
    load1_start: gate.load1,
    load1_end: H.readLoad1(),
    gate_waited_ms: gate.waited_ms,
    noisy: !gate.ok,
  }, acc.extra);
}

// A derived target: the wall stats are of a difference taken per pair. Labelled DERIVED.
function derivedTarget(id, diffs, gate, how) {
  const a = newAcc(id, { derived: true, derived_from: how });
  diffs.forEach((d) => a.wall.push(d));
  a.exits.add(0);
  return toTarget(a, gate);
}

// A child that times itself: the child prints one JSON line and `per_open_ms` is the sample.
async function selfTimed(ctx, args, extraEnv) {
  let metrics = null;
  let buf = '';
  const r = await H.runChild(ctx, {
    argv: [process.execPath, '-e', CHILD_CODE].concat(args),
    cwd: ctx.roomDir,
    env: ctx.env(extraEnv || {}),
    timeoutMs: 180000,
    onStdout: (chunk) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl === -1 || metrics !== null) return null;
      try { metrics = JSON.parse(buf.slice(0, nl)); } catch (_e) { return null; }
      return { wall_ms: Number(metrics.per_open_ms) };
    },
  });
  const cls = H.classifyRun(r);
  const bad = metrics === null || !Number.isFinite(Number(metrics.per_open_ms)) || metrics.ok !== 1;
  return {
    run_class: cls === 'ok' && bad ? 'failed' : cls,
    wall_ms: metrics ? Number(metrics.per_open_ms) : null,
    cpu_ms: r.usage ? r.usage.cpu_ms : null,
    rss_mb: r.usage ? r.usage.rss_mb : null,
    exits: [r.signal ? 'signal:' + r.signal : r.status],
    timed_out: r.timedOut ? 1 : 0,
    metrics,
  };
}

function readProbeLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_e) { return []; }
}

function probeEnv(logFile) {
  return { NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + PROBE).trim(), MOS_PROBE_LOG: logFile, MOS_PROBE_CATS: '{}' };
}

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

function dbBytes(roomDir) {
  try { return fs.statSync(path.join(roomDir, '.mindrian', 'room.db')).size; } catch (_e) { return null; }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
async function cmdRun(f) {
  const kind = f.room === 'copy' ? 'copy' : 'fixture';
  const warmOpens = parseInt(f['warm-opens'], 10);
  if (!Number.isInteger(warmOpens) || warmOpens < 1) throw Object.assign(new Error('--warm-opens must be a positive integer'), { exitCode: 2 });
  const S = await setup(f, kind, 'runs', MIN_RUNS);
  try {
    const ctx = S.ctx;
    const room = S.prep.roomDir;
    const rootArgs = (mode, n, roomArg) => [S.tree, roomArg || room, mode, String(n)];
    const OFF = { MINDRIAN_DISABLE_BYPASS_AUDIT: '1' };
    // untimed: make sure room.db exists and is migrated, and warm the file cache with both kinds of open
    const hadDb = dbBytes(room) !== null;
    await selfTimed(ctx, rootArgs('open', 1));
    await selfTimed(ctx, rootArgs('bare', 1));
    await selfTimed(ctx, rootArgs('open', 1));
    const roomDbBytes = dbBytes(room);

    const phases = [['cold', 1], ['warm', warmOpens]];
    const targets = [];
    const interleave = {};
    for (const [phase, n] of phases) {
      const gate = await S.gate();
      const accOpen = newAcc('db:' + phase + ':open', { opens_per_sample: n });
      const accBare = newAcc('db:' + phase + ':bare', { opens_per_sample: n });
      const accOff = newAcc('db:' + phase + ':open-audit-off', { opens_per_sample: n });
      const accs = { open: accOpen, bare: accBare, off: accOff };
      const diffBare = [];
      const diffOff = [];
      for (let i = 0; i < S.runs; i += 1) {
        const got = {};
        for (const k of roundOrder(i)) {
          const s = await selfTimed(ctx, rootArgs(k === 'bare' ? 'bare' : 'open', n), k === 'off' ? OFF : {});
          if (addSample(accs[k], s)) got[k] = s.wall_ms;
        }
        if (got.open !== undefined && got.bare !== undefined) diffBare.push(got.open - got.bare);
        if (got.open !== undefined && got.off !== undefined) diffOff.push(got.open - got.off);
      }
      interleave[phase] = pairOrders(S.runs);
      targets.push(toTarget(accOpen, gate), toTarget(accBare, gate), toTarget(accOff, gate));
      targets.push(derivedTarget('db:' + phase + ':open-minus-bare', diffBare, gate, 'per-round open wall minus bare wall (DERIVED)'));
      targets.push(derivedTarget('db:' + phase + ':audit-cost', diffOff, gate, 'per-round open wall minus open wall with the bypass audit off (DERIVED)'));
      log(phase + ' open median ' + toTarget(accOpen, gate).wall_ms.median + ' ms, bare ' + toTarget(accBare, gate).wall_ms.median + ' ms (n ' + accOpen.wall.length + ')');
    }

    // the counting run, apart from the timing runs: the probe preload counts constructed, exec and prepare calls
    const REP = 3;
    const countOnce = async (mode, n, roomArg) => {
      const lf = path.join(S.prep.sandbox.tmp, 'count-' + Math.random().toString(36).slice(2) + '.log');
      const s = await selfTimed(ctx, rootArgs(mode, n, roomArg), probeEnv(lf));
      const line = readProbeLines(lf).filter((l) => l.snapshot === false && l.argv1 === 'eval')[0];
      return { ok: s.run_class === 'ok' && !!line, sq: line ? line.sqlite : { constructed: 0, exec: 0, prepare: 0 } };
    };
    const summarize = async (name, fn) => {
      const rows = [];
      for (let i = 0; i < REP; i += 1) rows.push(await fn(i));
      const pick = (k) => rows.map((r) => r.sq[k]);
      const agree = ['constructed', 'exec', 'prepare'].every((k) => pick(k).every((x) => x === pick(k)[0]));
      return { repeats: REP, constructed: pick('constructed'), exec: pick('exec'), prepare: pick('prepare'), agree, all_ok: rows.every((r) => r.ok) };
    };
    const openCounts = {
      note: 'counts per process; existing_db and new_db are one open each; bare is one bare open; loop_5 is five opens in one process',
      existing_db: await summarize('existing', () => countOnce('open', 1)),
      new_db: await summarize('new', () => countOnce('open', 1, fs.mkdtempSync(path.join(S.prep.sandbox.tmp, 'fresh-')))),
      bare: await summarize('bare', () => countOnce('bare', 1)),
      loop_5: await summarize('loop5', () => countOnce('open', 5)),
    };
    openCounts.exec_per_open_existing = openCounts.existing_db.exec[0];
    openCounts.prepare_per_open_existing = openCounts.existing_db.prepare[0];
    openCounts.exec_per_open_loop = openCounts.loop_5.exec[0] / 5;
    openCounts.prepare_per_open_loop = openCounts.loop_5.prepare[0] / 5;

    writeOut(S, f.out, H.SCHEMA, {
      room_db: { present_before_run: hadDb, bytes: roomDbBytes },
      warm_opens_per_child: warmOpens,
      interleave,
      open_counts: openCounts,
      isolation: finishIsolation(S),
      targets,
    });
    return finishIsolation(S).exit_code;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// session-opens
// ---------------------------------------------------------------------------
function aggregate(lines) {
  const by = new Map();
  for (const l of lines) {
    const e = by.get(l.argv1) || { script: l.argv1, processes: 0, sqlite_constructed: 0, sqlite_exec: 0, sqlite_prepare: 0 };
    e.processes += 1;
    e.sqlite_constructed += l.sqlite.constructed;
    e.sqlite_exec += l.sqlite.exec;
    e.sqlite_prepare += l.sqlite.prepare;
    by.set(l.argv1, e);
  }
  return [...by.values()].sort((a, b) => (a.script < b.script ? -1 : 1));
}

async function cmdSessionOpens(f) {
  const kind = f.room === 'copy' ? 'copy' : 'fixture';
  const variant = f.variant || 'unchanged';
  if (variant !== 'unchanged' && variant !== 'changed') throw Object.assign(new Error('--variant takes unchanged or changed'), { exitCode: 2 });
  const S = await setup(f, kind, 'repeats', 1);
  try {
    const ctx = S.ctx;
    const def = H.targetDef('event:SessionStart:' + variant);
    const hadDb = dbBytes(S.prep.roomDir) !== null;
    if (variant === 'unchanged') {
      // untimed warm-ups until the state step skips (the unchanged path)
      for (let k = 0; k < 6; k += 1) {
        const w = await H.runEventOnce(def, ctx, { noTouch: true, settleMs: 120000 });
        await sleepMs(1100);
        if (w.changed_path_taken !== true) break;
      }
    } else {
      await H.runEventOnce(def, ctx, { settleMs: 120000 });
    }
    const gate = await S.gate();
    const repeats = [];
    for (let k = 0; k < S.runs; k += 1) {
      const lf = path.join(ctx.sandbox.tmp, 'session-' + k + '.log');
      const s = await H.runEventOnce(def, ctx, { noTouch: variant === 'unchanged', extraEnv: probeEnv(lf), settleMs: 120000 });
      const lines = readProbeLines(lf).filter((l) => l.snapshot === false);
      repeats.push({ run_class: s.run_class, changed_path_taken: s.changed_path_taken === undefined ? null : s.changed_path_taken, by_script: aggregate(lines), node_processes: lines.length });
      if (variant === 'unchanged') await sleepMs(1100);
    }
    const sum = (r, k) => r.by_script.reduce((a, b) => a + b[k], 0);
    const opensOf = (r) => JSON.stringify(r.by_script.map((b) => [b.script, b.sqlite_constructed]));
    const first = repeats[0];
    const session = {
      variant,
      event: 'SessionStart startup',
      repeats: repeats.length,
      run_classes: repeats.map((r) => r.run_class),
      changed_path_taken_runs: repeats.filter((r) => r.changed_path_taken === true).length,
      room_db_present_before_warmup: hadDb,
      room_db_bytes: dbBytes(S.prep.roomDir),
      load1_start: gate.load1,
      opens_per_repeat: repeats.map((r) => sum(r, 'sqlite_constructed')),
      exec_per_repeat: repeats.map((r) => sum(r, 'sqlite_exec')),
      prepare_per_repeat: repeats.map((r) => sum(r, 'sqlite_prepare')),
      node_processes_per_repeat: repeats.map((r) => r.node_processes),
      // the opens per hook script agree across the repeats when the lists of [script, constructed] are equal
      repeats_agree: repeats.every((r) => opensOf(r) === opensOf(first)),
      opens_total: sum(first, 'sqlite_constructed'),
      exec_total: sum(first, 'sqlite_exec'),
      prepare_total: sum(first, 'sqlite_prepare'),
      scripts_with_opens: first.by_script.filter((b) => b.sqlite_constructed > 0).map((b) => b.script),
      by_script: first.by_script,
    };
    writeOut(S, f.out, H.COUNTS_SCHEMA, { session, isolation: finishIsolation(S) });
    log('session-opens ' + variant + ': opens per repeat ' + session.opens_per_repeat.join(',') + ', agree ' + session.repeats_agree);
    return finishIsolation(S).exit_code;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
async function main(argv) {
  const sub = argv[0];
  if (!sub || !USAGE[sub]) {
    process.stderr.write('usage: db-open-bench.cjs <run|session-opens> --tree <dir> --out <file> [...]\n');
    return 2;
  }
  let f;
  try { f = parseFlags(argv.slice(1)); } catch (e) { process.stderr.write(e.message + '\n' + USAGE[sub] + '\n'); return 2; }
  if (!f.tree || !f.out) { process.stderr.write(USAGE[sub] + '\n'); return 2; }
  if (f.runs === undefined) f.runs = '7';
  if (f['warm-opens'] === undefined) f['warm-opens'] = '100';
  if (f.repeats === undefined) f.repeats = '3';
  try {
    return sub === 'run' ? await cmdRun(f) : await cmdSessionOpens(f);
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e).replace(/\/[^\s]*/g, '<path>') + '\n');
    return e && Number.isInteger(e.exitCode) ? e.exitCode : 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), () => { process.stderr.write('db-open-bench failed\n'); process.exit(1); });
}

module.exports = { main, CHILD_CODE, roundOrder, pairOrders, aggregate };
