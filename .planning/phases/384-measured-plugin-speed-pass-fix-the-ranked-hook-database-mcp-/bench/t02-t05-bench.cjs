#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 10: the bench for the findings T02 to T05 (operator-update cost, lazy require of the timeline runner,
 * cascade skip on a default-layout room, HMI poll hook against doctor alone). It uses the library surface of
 * tools/perf/perf-harness.cjs (prepareRoom, makeCtx, runChild, runCommandOnce, runEventOnce, buildEventPayload,
 * targetDef, statsSummary, machineRecord, writeResult, findTouchTarget, gateBeforeTarget) and the probe preload of this
 * folder. Run it under the 384 lock: flock -w 7200 "$HOME/.cache/mos-perf-384.lock" node t02-t05-bench.cjs ...
 *
 * Subcommands:
 *   t02 --mode time|count     operator-update cost per call against the bare node floor, two registry shapes
 *   t03 [make-b] --mode ...   lazy require of the timeline runner (scratch copy only)
 *   t04 --mode time|count     cascade skip on a default-layout fixture room
 *   t05 --mode time|count     hmi-compliance-poll --hook against doctor --ui-compliance alone
 *   report --task tN --s1 <file> --s2 <file> [--counts <file>] [--readings-out <file>]
 *   reading-rows --task all --readings-dir <dir> | --readings <file>
 *
 * Result files use the schemas mos.perf-384/1 (timings) and mos.perf-384-counts/1 (counts). Canon Part 8: numbers,
 * ids, booleans, status words and script base names only. No path, no room name, no room text.
 * Test-only flags (need MOS_PERF_SELFTEST=1): --skip-gates, --allow-short. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));
const hookLib = require(path.join(REPO, 'scripts', 'measure-hook-cold-start.cjs'));
const COUNT_PRELOAD = path.join(REPO, 'tools', 'perf', 'count-modules-preload.cjs');
const PROBE = path.join(__dirname, 'probe-preload.cjs');
const MIN_RUNS = 7;
const PLUGIN_ROOT_VAR = '${CLAUDE_PLUGIN_ROOT}';

const USAGE = {
  t02: 'usage: t02 --tree <dir> --out <file> --mode time|count [--runs N (default 15)] [--repeats N (default 3)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  t03: 'usage: t03 [make-b] --tree <dir> --tree-b <dir> --out <file> --mode time|count [--runs N (default 15)] [--repeats N (default 3)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  t04: 'usage: t04 --tree <dir> --out <file> --mode time|count [--runs N (default 15)] [--repeats N (default 3)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  t05: 'usage: t05 --tree <dir> --out <file> --mode time|count [--runs N (default 15)] [--repeats N (default 3)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  report: 'usage: report --task t02|t03|t04|t05 --s1 <file> --s2 <file> [--counts <file>] [--readings-out <file>]',
  'reading-rows': 'usage: reading-rows --task all (--readings-dir <dir> | --readings <file>)',
};
const FLAGS = {
  tree: 1, 'tree-b': 1, out: 1, mode: 1, runs: 1, repeats: 1, set: 1, label: 1, 'base-sha': 1, scratch: 1, room: 1,
  task: 1, s1: 1, s2: 1, counts: 1, 'readings-out': 1, 'readings-dir': 1, readings: 1,
  'skip-gates': 'bool', 'allow-short': 'bool',
};

function parseFlags(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
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
function log(msg) { process.stderr.write('[t02-t05] ' + msg + '\n'); }
function rotated(list, round) { const k = round % list.length; return list.slice(k).concat(list.slice(0, k)); }
function r3(x) { return Math.round(x * 1000) / 1000; }

// ---------------------------------------------------------------------------
// pure helpers (tested by the check file)
// ---------------------------------------------------------------------------

// R2: the reading of one pair from the two set medians of the per-round differences and the noise.
function reading(d1, d2, noise) {
  const lim = 2 * noise;
  const p1 = d1 > lim;
  const p2 = d2 > lim;
  if (p1 && p2) return 'PASS';
  if (!p1 && !p2) return 'FAIL';
  return 'NOT RESOLVED';
}

// The registry that passes the guard of scripts/operator-update.cjs: active_room a string, rooms an array.
function guardPassingRegistry(slug, roomDir) {
  return { active_room: slug, rooms: [{ slug, abs_path: roomDir }] };
}

// Three booleans and no text.
function shapeOf(reg) {
  const r = reg && typeof reg === 'object' ? reg : {};
  const act = Object.prototype.hasOwnProperty.call(r, 'active_room') ? r.active_room : r.active;
  return {
    has_active_room_key: Object.prototype.hasOwnProperty.call(r, 'active_room'),
    active_is_string: typeof act === 'string',
    rooms_is_array: Array.isArray(r.rooms),
  };
}

function fineStats(samples) {
  const s = samples.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return { median: null, p95: null, min: null, max: null };
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { median: r3(mid), p95: r3(s[Math.floor(0.95 * (s.length - 1))]), min: r3(s[0]), max: r3(s[s.length - 1]) };
}
function median(a) { return fineStats(a).median; }

// ---------------------------------------------------------------------------
// one run of the setup: lock, gates, room, context
// ---------------------------------------------------------------------------
function usageError(msg) { return Object.assign(new Error(msg), { exitCode: 2 }); }

async function setup(f, kind, extra) {
  const selftest = process.env.MOS_PERF_SELFTEST === '1';
  const mode = f.mode || 'time';
  const runs = parseInt(f.runs, 10);
  if (!Number.isInteger(runs) || runs < 1) throw usageError('--runs must be a positive integer');
  if (mode === 'time' && runs < MIN_RUNS && !f['allow-short'] && !selftest) throw usageError('at least ' + MIN_RUNS + ' runs are required; got ' + runs);
  if (f['base-sha'] !== undefined && !/^[0-9a-f]{40}$/.test(f['base-sha'])) throw usageError('--base-sha needs 40 lowercase hex digits');
  const tree = path.resolve(f.tree);
  if (!fs.existsSync(path.join(tree, 'hooks', 'hooks.json'))) throw usageError('not a plugin tree');
  if (!fs.existsSync('/usr/bin/time')) throw Object.assign(new Error('/usr/bin/time is required'), { exitCode: 1 });
  if (!selftest) {
    if (!H.requireLock({ lockFile: H.defaultLockFile() })) throw Object.assign(new Error('lock not held: run under flock -w 7200 on the 384 lock file'), { exitCode: 1 });
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
  const prep = (extra && extra.prep) ? extra.prep(tree, scratch, baseSha) : H.prepareRoom(kind, { trees: [tree], source: null, scratch, baseSha });
  const load1Start = H.readLoad1();
  const ctx = H.makeCtx('A', tree, prep, cpus, hasTaskset);
  const m = H.manifest(prep.roomDir);
  let bytes = 0;
  for (const v of m.values()) bytes += Number(String(v).split(':')[0]) || 0;
  const room = { kind: 'fixture-room', file_count: m.size, byte_total: bytes, fs_type: H.fsType(prep.roomDir) };
  return {
    f, runs, tree, ctx, prep, scratch, cpus, hasTaskset, baseSha, label, startedAt, load1Start, room, skipGates, mode,
    // The gate runs at the start of each measurement block. The load1 of the first block is the load1 at the start of the measurement.
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
  return { id, wall: [], cpu: [], rss: [], exits: new Set(), timedOut: 0, failed: 0, escaped: 0, survivors: 0, extra: extra || {} };
}

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
  return true;
}

function toTarget(acc, gate) {
  return Object.assign({
    id: acc.id,
    n: acc.wall.length,
    blocking: true,
    wall_ms: H.statsSummary(acc.wall),
    wall_ms_fine: fineStats(acc.wall),
    cpu_ms: H.statsSummary(acc.cpu),
    rss_mb: H.statsSummary(acc.rss),
    exits: [...acc.exits].sort((a, b) => String(a).localeCompare(String(b))),
    timed_out: acc.timedOut,
    failed_runs: acc.failed,
    not_measured: [],
    async_hooks: [],
    hook_count: 1,
    background_ms: 0,
    escaped_max: acc.escaped,
    survivors_left: acc.survivors,
    load1_start: gate.load1,
    load1_end: H.readLoad1(),
    gate_waited_ms: gate.waited_ms,
    noisy: !gate.ok,
  }, acc.extra);
}

// A derived target: the statistic is of a difference or a ratio taken per round. Labelled DERIVED.
function derivedTarget(id, diffs, gate, how) {
  const a = newAcc(id, { derived: true, derived_from: how });
  diffs.forEach((d) => a.wall.push(d));
  a.exits.add(0);
  return toTarget(a, gate);
}

// A child process that times itself: `code` prints one JSON line of numbers (milliseconds); mainKey is the wall.
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
    metrics,
  };
}

const HR = 'const t0 = process.hrtime.bigint(); ';

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
  H.writeResult(file, obj, { home: os.homedir(), sourceRoom: null, scratch: S.scratch });
}

function readLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_e) { return []; }
}

function countEnv(logFile) {
  return { NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + COUNT_PRELOAD).trim(), MOS_PERF_COUNT_LOG: logFile };
}

function probeEnv(S, logFile) {
  const cats = { mindrian: path.join(S.prep.roomDir, '.mindrian'), room: S.prep.roomDir };
  return { NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + PROBE).trim(), MOS_PROBE_LOG: logFile, MOS_PROBE_CATS: JSON.stringify(cats) };
}

function sumFs(lines, cat) {
  let n = 0;
  for (const l of lines) for (const e of l.fs || []) if (e.cat === cat) n += e.count;
  return n;
}

function allEqual(arr) { return arr.every((x) => JSON.stringify(x) === JSON.stringify(arr[0])); }

// ---------------------------------------------------------------------------
// T02: operator-update cost per call
// ---------------------------------------------------------------------------
const T02_EVENTS = [
  { key: 'ups', def: 'event:UserPromptSubmit' },
  { key: 'stop', def: 'event:Stop:unchanged' },
  { key: 'post-read', def: 'event:PostToolUse:Read' },
];

function hookEntry(ctx, defId, needle) {
  const def = H.targetDef(defId);
  const sel = H.selectHooks(ctx, def);
  const e = sel.entries.find((h) => h.command.indexOf(needle) !== -1);
  if (!e) throw Object.assign(new Error('hook not found in hooks.json: ' + needle), { exitCode: 1 });
  return { def, command: e.command.split(PLUGIN_ROOT_VAR).join(ctx.tree), timeoutMs: (e.timeout_ms || 60000) + 1000 };
}

// one hook command with its payload on stdin from a file
function cmdDefOf(id, command, timeoutMs) {
  return { id, kind: 'cmd', argv: () => ['bash', '-c', command + ' < "$MOS_PAYLOAD_FILE"'], timeoutMs: timeoutMs || 60000 };
}

// Two registries: the one the product wrote (read back, shape as booleans), and one in the guard-passing shape.
function t02Registries(S) {
  const roomsHome = S.prep.sandbox.roomsHome;
  let real = null;
  try { real = JSON.parse(fs.readFileSync(path.join(roomsHome, '.rooms', 'registry.json'), 'utf8')); } catch (_e) { real = null; }
  let slug = real && typeof real.active === 'string' ? real.active : (real && typeof real.active_room === 'string' ? real.active_room : null);
  if (!slug && real && real.rooms && typeof real.rooms === 'object' && !Array.isArray(real.rooms)) slug = Object.keys(real.rooms)[0] || null;
  if (!slug) slug = 'bench-room';
  const guardHome = path.join(S.prep.sandbox.root, 'guard-home');
  fs.mkdirSync(path.join(guardHome, '.rooms'), { recursive: true });
  const guard = guardPassingRegistry(slug, S.prep.roomDir);
  fs.writeFileSync(path.join(guardHome, '.rooms', 'registry.json'), JSON.stringify(guard));
  return { realHome: roomsHome, guardHome, shapes: { real: shapeOf(real), guard_passing: shapeOf(guard) } };
}

function t02Commands(S) {
  const ctx = S.ctx;
  const regs = t02Registries(S);
  const list = [];
  for (const ev of T02_EVENTS) {
    const he = hookEntry(ctx, ev.def, 'operator-update.cjs');
    const payload = H.buildEventPayload(he.def, ctx);
    const file = path.join(S.prep.sandbox.tmp, 'payload-t02-' + ev.key + '.json');
    fs.writeFileSync(file, JSON.stringify(payload));
    for (const v of [['real-shape', regs.realHome], ['guard-passing', regs.guardHome]]) {
      const id = 't02:' + ev.key + ':' + v[0];
      list.push({ id, event: ev.key, variant: v[0].replace('-', '_'), def: cmdDefOf(id, he.command, he.timeoutMs), cx: ctxWith(ctx, { MOS_PAYLOAD_FILE: file, MINDRIAN_ROOMS_HOME: v[1] }) });
    }
  }
  return { list, regs };
}

async function cmdT02Time(f) {
  const S = await setup(f, 'fixture');
  try {
    const ctx = S.ctx;
    const { list, regs } = t02Commands(S);
    const payloadFile = path.join(S.prep.sandbox.tmp, 'payload-floor.json');
    fs.writeFileSync(payloadFile, '{}');
    const cxFloor = ctxWith(ctx, { MOS_PAYLOAD_FILE: payloadFile });
    const floorNode = Object.assign({}, H.targetDef('floor:node'), { id: 't02:floor-node' });
    const floorBash = { id: 't02:floor-bash-node', kind: 'cmd', argv: () => ['bash', '-c', '"' + process.execPath + '" -e 0 < "$MOS_PAYLOAD_FILE"'], timeoutMs: 60000 };
    const opMod = path.join(S.tree, 'lib', 'conversation', 'operator.cjs');
    const clMod = path.join(S.tree, 'lib', 'conversation', 'classifier.cjs');
    const loadCode = HR + 'require(process.argv[1]); require(process.argv[2]); const t1 = process.hrtime.bigint(); process.stdout.write(JSON.stringify({ ms: Number(t1 - t0) / 1e6 }) + "\\n");';
    const items = [
      { id: floorNode.id, run: () => H.runCommandOnce(floorNode, cxFloor, { settleMs: 30000 }) },
      { id: floorBash.id, run: () => H.runCommandOnce(floorBash, cxFloor, { settleMs: 30000 }) },
      { id: 't02:module-load', run: () => selfTimed(ctx, loadCode, [opMod, clMod], 'ms') },
    ].concat(list.map((c) => ({ id: c.id, run: () => H.runCommandOnce(c.def, c.cx, { settleMs: 30000 }) })));
    for (const it of items) await it.run(); // untimed warm-up of every command
    const gate = await S.gate();
    const accs = new Map(items.map((it) => [it.id, newAcc(it.id, list.find((c) => c.id === it.id) ? { event: list.find((c) => c.id === it.id).event, variant: list.find((c) => c.id === it.id).variant } : {})]));
    const diffs = { real: { ups: [], stop: [], 'post-read': [] }, guard: { ups: [], stop: [], 'post-read': [] } };
    for (let i = 0; i < S.runs; i += 1) {
      const got = {};
      for (const it of rotated(items, i)) {
        const s = await it.run();
        if (addSample(accs.get(it.id), s)) got[it.id] = s.wall_ms;
      }
      for (const ev of T02_EVENTS) {
        const a = got['t02:' + ev.key + ':real-shape'];
        const b = got['t02:' + ev.key + ':guard-passing'];
        if (a !== undefined && got['t02:floor-node'] !== undefined) diffs.real[ev.key].push(a - got['t02:floor-node']);
        if (a !== undefined && b !== undefined) diffs.guard[ev.key].push(b - a);
      }
    }
    const targets = items.map((it) => toTarget(accs.get(it.id), gate));
    for (const ev of T02_EVENTS) {
      targets.push(derivedTarget('t02:d:real-minus-floor:' + ev.key, diffs.real[ev.key], gate, 'per-round call on the product-shape registry minus the bare node wall'));
    }
    for (const ev of T02_EVENTS) {
      targets.push(derivedTarget('t02:d:guard-minus-real:' + ev.key, diffs.guard[ev.key], gate, 'per-round call on the guard-passing registry minus the call on the product-shape registry'));
    }
    writeOut(S, f.out, H.SCHEMA, { task: 't02', registry_shapes: regs.shapes, targets });
    const t = (id) => targets.find((x) => x.id === id).wall_ms_fine.median;
    log('t02 floor ' + t('t02:floor-node') + ' ms, ups real-shape ' + t('t02:ups:real-shape') + ' ms, ups guard-passing ' + t('t02:ups:guard-passing') + ' ms');
    return 0;
  } finally { S.cleanup(); }
}

async function cmdT02Count(f) {
  const repeats = parseInt(f.repeats || '3', 10);
  const S = await setup(f, 'fixture');
  try {
    const { list, regs } = t02Commands(S);
    for (const c of list) await H.runCommandOnce(c.def, c.cx, { settleMs: 30000 }); // untimed warm-up
    await S.gate();
    const path_taken = {};
    const modules = {};
    const node_starts = {};
    let agreeAll = true;
    for (const c of list) {
      const fsMind = [];
      const fsRoom = [];
      const sq = [];
      const mods = [];
      const starts = [];
      for (let k = 0; k < repeats; k += 1) {
        const cl = path.join(S.prep.sandbox.tmp, 't02-count-' + k + '.log');
        fs.rmSync(cl, { force: true });
        await H.runCommandOnce(c.def, ctxWith(c.cx, countEnv(cl)), { settleMs: 30000 });
        const lines = readLines(cl);
        starts.push(lines.length);
        const mine = lines.filter((l) => l.argv1 === 'operator-update.cjs');
        mods.push(mine.length ? Math.max.apply(null, mine.map((l) => l.modules)) : null);
        const pl = path.join(S.prep.sandbox.tmp, 't02-probe-' + k + '.log');
        fs.rmSync(pl, { force: true });
        await H.runCommandOnce(c.def, ctxWith(c.cx, probeEnv(S, pl)), { settleMs: 30000 });
        const pls = readLines(pl).filter((l) => l.argv1 === 'operator-update.cjs');
        fsMind.push(sumFs(pls, 'mindrian'));
        fsRoom.push(sumFs(pls, 'room'));
        sq.push(pls.reduce((a, l) => a + (l.sqlite ? l.sqlite.constructed : 0), 0));
      }
      const agree = allEqual(fsMind) && allEqual(fsRoom) && allEqual(sq) && allEqual(mods) && allEqual(starts);
      agreeAll = agreeAll && agree;
      path_taken[c.event] = path_taken[c.event] || {};
      path_taken[c.event][c.variant] = { mindrian_fs_calls: fsMind, room_fs_calls: fsRoom, sqlite_constructed: sq, repeats_agree: agree };
      modules[c.event] = modules[c.event] || {};
      modules[c.event][c.variant] = mods;
      node_starts[c.event] = node_starts[c.event] || {};
      node_starts[c.event][c.variant] = starts;
    }
    writeOut(S, f.out, H.COUNTS_SCHEMA, { task: 't02', registry_shapes: regs.shapes, path_taken, modules, node_starts, repeats, repeats_agree: agreeAll });
    log('t02 counts written, repeats agree ' + agreeAll);
    return 0;
  } finally { S.cleanup(); }
}

// @@TASKS@@

// ---------------------------------------------------------------------------
// report: Markdown rows with a Basis cell last (R6)
// ---------------------------------------------------------------------------
const PAIRS = {
  t02: [
    { key: 't02-a:ups', label: 'T02-a ups: product-shape call above floor', x: 't02:ups:real-shape', y: 't02:floor-node', d: 't02:d:real-minus-floor:ups' },
    { key: 't02-a:stop', label: 'T02-a stop: product-shape call above floor', x: 't02:stop:real-shape', y: 't02:floor-node', d: 't02:d:real-minus-floor:stop' },
    { key: 't02-a:post-read', label: 'T02-a post-read: product-shape call above floor', x: 't02:post-read:real-shape', y: 't02:floor-node', d: 't02:d:real-minus-floor:post-read' },
    { key: 't02-b:ups', label: 'T02-b ups: guard-passing call above product-shape call', x: 't02:ups:guard-passing', y: 't02:ups:real-shape', d: 't02:d:guard-minus-real:ups' },
    { key: 't02-b:stop', label: 'T02-b stop: guard-passing call above product-shape call', x: 't02:stop:guard-passing', y: 't02:stop:real-shape', d: 't02:d:guard-minus-real:stop' },
    { key: 't02-b:post-read', label: 'T02-b post-read: guard-passing call above product-shape call', x: 't02:post-read:guard-passing', y: 't02:post-read:real-shape', d: 't02:d:guard-minus-real:post-read' },
  ],
};

function tgt(file, id) { return (file.targets || []).find((t) => t.id === id) || null; }
function wallOf(t) { return t ? ((t.wall_ms_fine && t.wall_ms_fine.median !== null && t.wall_ms_fine.median !== undefined) ? t.wall_ms_fine : t.wall_ms) : null; }
function fmt(x) { return x === null || x === undefined || Number.isNaN(x) ? 'NOT MEASURED' : String(r3(x)); }
function spreadOf(m1, m2) { const mean = Math.abs((m1 + m2) / 2); return mean ? Math.round((Math.abs(m1 - m2) / mean) * 1000) / 10 : 0; }
function row(cells) { return '| ' + cells.join(' | ') + ' |'; }

function targetTable(s1, s2, title, filterFn) {
  const out = ['', title, '', row(['Target', 'n per set', 'set 1 median ms', 'set 1 p95 ms', 'set 2 median ms', 'set 2 p95 ms', 'spread percent', 'Basis']), row(['---', '---', '---', '---', '---', '---', '---', '---'])];
  for (const t1 of s1.targets || []) {
    if (filterFn && !filterFn(t1)) continue;
    const t2 = tgt(s2, t1.id);
    const w1 = wallOf(t1);
    const w2 = wallOf(t2);
    const basis = t1.derived ? 'DERIVED' : 'DIRECT';
    out.push(row([t1.id, t2 ? t1.n + ' and ' + t2.n : t1.n + ' and NOT MEASURED', fmt(w1.median), fmt(w1.p95), w2 ? fmt(w2.median) : 'NOT MEASURED', w2 ? fmt(w2.p95) : 'NOT MEASURED', w2 ? fmt(spreadOf(w1.median, w2.median)) : 'NOT MEASURED', basis]));
  }
  return out;
}

// the pair readings: d(k) is the set median of the per-round differences, noise is the sum of the two set median differences
function pairReadings(s1, s2, pairs) {
  return pairs.map((p) => {
    const d1 = wallOf(tgt(s1, p.d));
    const d2 = wallOf(tgt(s2, p.d));
    const x1 = wallOf(tgt(s1, p.x));
    const x2 = wallOf(tgt(s2, p.x));
    const y1 = wallOf(tgt(s1, p.y));
    const y2 = wallOf(tgt(s2, p.y));
    if (![d1, d2, x1, x2, y1, y2].every((w) => w && w.median !== null && w.median !== undefined)) return Object.assign({}, p, { d1: null, d2: null, noise: null, reading: 'NOT MEASURED' });
    const noise = Math.abs(x1.median - x2.median) + Math.abs(y1.median - y2.median);
    return Object.assign({}, p, { d1: d1.median, d2: d2.median, noise, reading: reading(d1.median, d2.median, noise) });
  });
}

function pairTable(rows, title) {
  const out = ['', title, '', row(['Pair', 'd(1) ms', 'd(2) ms', 'noise ms', '2 x noise ms', 'reading', 'meets floor', 'Basis']), row(['---', '---', '---', '---', '---', '---', '---', '---'])];
  for (const r of rows) {
    out.push(row([r.label, fmt(r.d1), fmt(r.d2), fmt(r.noise), r.noise === null ? 'NOT MEASURED' : fmt(2 * r.noise), r.reading, 'pending Q5b', 'DERIVED']));
  }
  return out;
}

function readJsonFile(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function t02Report(s1, s2, counts) {
  const lines = [];
  lines.push(...targetTable(s1, s2, 'Table T02-1: every target (n per set, median, p95, two sets, spread)'));
  const pr = pairReadings(s1, s2, PAIRS.t02);
  lines.push(...pairTable(pr, 'Table T02-2: pair readings by R2'));
  const readings = {};
  pr.forEach((r) => { readings[r.key] = { reading: r.reading, evidence: 't02-operator-update-s1.json' }; });
  // the share of module load in the call (DERIVED, no rule)
  const ml = wallOf(tgt(s1, 't02:module-load'));
  const ups = wallOf(tgt(s1, 't02:ups:real-shape'));
  const fl = wallOf(tgt(s1, 't02:floor-node'));
  const share = ml && ups && fl && ups.median - fl.median > 0 ? ml.median / (ups.median - fl.median) : null;
  lines.push('', 'Table T02-2b: share of module load in the call (set 1, no rule)', '', row(['Quantity', 'value', 'Basis']), row(['---', '---', '---']));
  lines.push(row(['module-load median divided by (product-shape ups median minus floor median)', fmt(share), share === null ? 'NOT MEASURED' : 'DERIVED']));
  if (counts) {
    lines.push('', 'Table T02-3a: registry shapes (booleans)', '', row(['Registry', 'has_active_room_key', 'active_is_string', 'rooms_is_array', 'Basis']), row(['---', '---', '---', '---', '---']));
    for (const k of ['real', 'guard_passing']) {
      const s = (counts.registry_shapes || {})[k] || {};
      lines.push(row([k === 'real' ? 'written by the product' : 'guard-passing', String(s.has_active_room_key), String(s.active_is_string), String(s.rooms_is_array), 'DIRECT']));
    }
    lines.push('', 'Table T02-3b: path taken, modules and node starts per call (3 repeats each)', '', row(['Event', 'Registry', 'fs calls on .mindrian', 'fs calls on the room folder', 'sqlite constructed', 'modules', 'node starts', 'repeats agree', 'Basis']), row(['---', '---', '---', '---', '---', '---', '---', '---', '---']));
    let t02c = 'NOT MEASURED';
    for (const ev of T02_EVENTS) {
      for (const v of ['real_shape', 'guard_passing']) {
        const p = ((counts.path_taken || {})[ev.key] || {})[v];
        if (!p) continue;
        lines.push(row([ev.key, v === 'real_shape' ? 'product shape' : 'guard-passing', p.mindrian_fs_calls.join(' '), p.room_fs_calls.join(' '), p.sqlite_constructed.join(' '), (((counts.modules || {})[ev.key] || {})[v] || []).join(' '), (((counts.node_starts || {})[ev.key] || {})[v] || []).join(' '), String(p.repeats_agree), 'DIRECT']));
      }
    }
    // T02-c (R1, threshold claim): at ups the sum is exactly 0 for the product shape and above 0 for the guard-passing shape in every repeat
    const up = (counts.path_taken || {}).ups;
    if (up && up.real_shape && up.guard_passing) {
      const tot = (p) => p.mindrian_fs_calls.map((v, i) => v + p.sqlite_constructed[i]);
      const realOk = tot(up.real_shape).every((v) => v === 0);
      const guardOk = tot(up.guard_passing).every((v) => v > 0);
      const realAgree = allEqual(tot(up.real_shape));
      const guardAgree = allEqual(tot(up.guard_passing));
      t02c = realOk && guardOk ? 'PASS' : ((!realAgree || !guardAgree) && (realOk !== guardOk) ? 'NOT RESOLVED' : (realOk || guardOk ? 'FAIL' : 'FAIL'));
      lines.push('', 'Table T02-3c: T02-c reading by R1 (threshold claim at UserPromptSubmit)', '', row(['Claim', 'product-shape sums (3 repeats)', 'guard-passing sums (3 repeats)', 'reading', 'meets floor', 'Basis']), row(['---', '---', '---', '---', '---', '---']));
      lines.push(row(['product shape is exactly 0, guard-passing is above 0', tot(up.real_shape).join(' '), tot(up.guard_passing).join(' '), t02c, 'pending Q5b', 'DIRECT']));
    }
    readings['t02-c'] = { reading: t02c, evidence: 't02-operator-update-counts.json' };
  }
  return { lines, readings };
}

const REPORTERS = { t02: t02Report };

function cmdReport(f) {
  if (!f.task || !REPORTERS[f.task]) { process.stderr.write(USAGE.report + '\n'); return 2; }
  if (!f.s1 || !f.s2) { process.stderr.write(USAGE.report + '\n'); return 2; }
  const s1 = readJsonFile(f.s1);
  const s2 = readJsonFile(f.s2);
  const counts = f.counts ? readJsonFile(f.counts) : null;
  const out = REPORTERS[f.task](s1, s2, counts, f);
  process.stdout.write(out.lines.join('\n') + '\n');
  if (f['readings-out']) fs.writeFileSync(f['readings-out'], JSON.stringify(out.readings, null, 2) + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// reading-rows: the summary rows, one per hypothesis
// ---------------------------------------------------------------------------
const SUMMARY_ROWS = [
  { key: 't02-a:ups', hyp: 'T02-a (UserPromptSubmit): the call on the product-shape registry is above the bare node start', rule: 'R2', basis: 'DERIVED' },
  { key: 't02-a:stop', hyp: 'T02-a (Stop): the call on the product-shape registry is above the bare node start', rule: 'R2', basis: 'DERIVED' },
  { key: 't02-a:post-read', hyp: 'T02-a (PostToolUse Read): the call on the product-shape registry is above the bare node start', rule: 'R2', basis: 'DERIVED' },
  { key: 't02-b:ups', hyp: 'T02-b (UserPromptSubmit): the guard-passing registry adds work above the early return', rule: 'R2', basis: 'DERIVED' },
  { key: 't02-b:stop', hyp: 'T02-b (Stop): the guard-passing registry adds work above the early return', rule: 'R2', basis: 'DERIVED' },
  { key: 't02-b:post-read', hyp: 'T02-b (PostToolUse Read): the guard-passing registry adds work above the early return', rule: 'R2', basis: 'DERIVED' },
  { key: 't02-c', hyp: 'T02-c: no room state is read on the product-shape registry and some is read on the guard-passing registry', rule: 'R1 (threshold)', basis: 'DIRECT' },
  { key: 't03:statusline', hyp: 'T03 statusline: the lazy require lowers modules and time', rule: 'R3', basis: 'DERIVED' },
  { key: 't03:onstop', hyp: 'T03 on-stop snapshot: the lazy require lowers modules and time', rule: 'R3', basis: 'DERIVED' },
  { key: 't03:drain', hyp: 'T03 Brain drain on an empty queue: the lazy require lowers modules and time', rule: 'R3', basis: 'DERIVED' },
  { key: 't03:load', hyp: 'T03 cold load of folder-memory: the lazy require lowers modules and time', rule: 'R3', basis: 'DERIVED' },
  { key: 't04-a', hyp: 'T04-a: the cascade is skipped on the default layout and runs on the harness layout', rule: 'R1', basis: 'DIRECT' },
  { key: 't04-b', hyp: 'T04-b: a skipped cascade call costs more than the bare node start', rule: 'R2', basis: 'DERIVED' },
  { key: 't04-c', hyp: 'T04-c: the Write event on the harness layout costs more than on the default layout', rule: 'R2', basis: 'DERIVED' },
  { key: 't04-d', hyp: 'T04-d: node starts and modules for Write and SubagentStop (5 files) on both layouts', rule: 'counts, no pass or fail', basis: 'DIRECT' },
  { key: 't05-a', hyp: 'T05-a: the hook costs more than doctor alone and doctor is the larger part', rule: 'R4', basis: 'DERIVED' },
  { key: 't05-b', hyp: 'T05-b: the hook starts 2 node processes, doctor holds 1 key under checks, the status word is ok', rule: 'R1', basis: 'DIRECT' },
];

function loadReadings(f) {
  const all = {};
  if (f.readings) Object.assign(all, readJsonFile(f.readings));
  if (f['readings-dir']) {
    for (const n of fs.readdirSync(f['readings-dir']).filter((x) => /^readings-.*\.json$/.test(x)).sort()) Object.assign(all, readJsonFile(path.join(f['readings-dir'], n)));
  }
  return all;
}

function cmdReadingRows(f) {
  if (f.task !== 'all' || (!f.readings && !f['readings-dir'])) { process.stderr.write(USAGE['reading-rows'] + '\n'); return 2; }
  const all = loadReadings(f);
  const out = [row(['Hypothesis', 'Rule', 'Reading', 'Evidence file', 'meets floor', 'Basis']), row(['---', '---', '---', '---', '---', '---'])];
  for (const s of SUMMARY_ROWS) {
    const r = all[s.key];
    const basis = r && r.reading && r.reading !== 'NOT MEASURED' && r.reading !== 'PREMISE FAILED' ? s.basis : 'NOT MEASURED';
    out.push(row([s.hyp, s.rule, r ? r.reading : 'NOT MEASURED', r && r.evidence ? r.evidence : 'none', 'pending Q5b', basis === 'NOT MEASURED' ? 'NOT MEASURED (no result for this row)' : basis]));
  }
  process.stdout.write(out.join('\n') + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
async function main(argv) {
  const sub = argv[0];
  if (!sub || !USAGE[sub]) {
    process.stderr.write('usage: t02-t05-bench.cjs <t02|t03|t04|t05|report|reading-rows> [...]\n');
    return 2;
  }
  let f;
  try { f = parseFlags(argv.slice(1)); } catch (e) { process.stderr.write(e.message + '\n' + USAGE[sub] + '\n'); return 2; }
  if (sub === 'report') return cmdReport(f);
  if (sub === 'reading-rows') return cmdReadingRows(f);
  const makeB = sub === 't03' && f._[0] === 'make-b';
  if (!f.tree || (!makeB && !f.out)) { process.stderr.write(USAGE[sub] + '\n'); return 2; }
  if ((f['skip-gates'] || f['allow-short']) && process.env.MOS_PERF_SELFTEST !== '1') { process.stderr.write('--skip-gates and --allow-short are test-only flags and need MOS_PERF_SELFTEST=1\n'); return 2; }
  if (f.mode !== undefined && f.mode !== 'time' && f.mode !== 'count') { process.stderr.write('--mode accepts time or count only\n'); return 2; }
  if (f.runs === undefined) f.runs = '15';
  try {
    const fn = COMMANDS[sub + ':' + (makeB ? 'make-b' : (f.mode || 'time'))];
    if (!fn) { process.stderr.write(USAGE[sub] + '\n'); return 2; }
    return await fn(f);
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e).replace(/\/[^\s]*/g, '<path>') + '\n');
    return e && Number.isInteger(e.exitCode) ? e.exitCode : 1;
  }
}

const COMMANDS = {
  't02:time': cmdT02Time,
  't02:count': cmdT02Count,
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), () => { process.stderr.write('t02-t05-bench failed\n'); process.exit(1); });
}

module.exports = { main, reading, shapeOf, guardPassingRegistry, fineStats, pairReadings, PAIRS, SUMMARY_ROWS };
