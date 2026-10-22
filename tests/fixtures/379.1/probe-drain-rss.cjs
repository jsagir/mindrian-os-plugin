#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 gap closure plan 07 (requirements CPU379-03 and CPU379-08; verification gap truth 12):
 * where does the peak RSS of the drain worker come from on the 2,105-artifact large-room fixture?
 *
 * The live large-room leg (plan 06) returned status breach, first_not_ok drain.max_rss_mb, at 1,837 MB
 * against a limit of 1,024 MB. This probe MEASURES. It changes no limit and no default, and it picks no
 * fix. A human reads the numbers (plan 08).
 *
 * Arms (each runs in its own child process, one at a time, each in its own scratch directory):
 *   D8, D16, D32    the whole drain leg (runLargeRoomLeg) with MINDRIAN_EMBED_BATCH set to 8, 16, 32
 *                   inside the child. D32 is the control: it is the shipped default.
 *   E0              the encoder floor: load the encoder, embed 1 text.
 *   E32             the drain's own embed phase (attachVectors) over every artifact at batch 32.
 *   E32_ARENA_OFF   the same embed work at batch 32 with the ONNX CPU memory arena and the memory
 *                   pattern switched off (enableCpuMemArena false, enableMemPattern false).
 *
 * Every child gets the environment from scrubEnv(): the batch, thread and arena variables and the
 * large-room limit variables are removed, so the shipped defaults decide, not the parent shell.
 *
 * Canon Part 8: the result file holds numbers, booleans and enum strings only. No path, no room text,
 * no network. The probe never downloads the model: with no local model it records encoder_unavailable
 * and starts no child. Hyphens only.
 *
 * Flags: --reps N (1 to 5, default 2), --arms A,B (default all), --out <file>. Child mode: --arm <name>
 * --rep <n> --scratch <dir> (prints one JSON line).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULT_PATH = path.join(__dirname, 'probe-drain-rss.json');
const LEG_PATH = path.join(ROOT, 'scripts', 'release-lib', 'large-room-leg.cjs');
const DRAIN_TIMEOUT_MS = 600000;
const EMBED_TIMEOUT_MS = 420000;
const DEFAULT_REPS = 2;
const STATUSES = ['ok', 'partial', 'encoder_unavailable', 'error'];
const SCRUB_KEYS = ['MINDRIAN_EMBED_BATCH', 'MINDRIAN_EMBED_THREADS', 'MINDRIAN_EMBED_CPU_ARENA'];
const SCRUB_PREFIX = 'MINDRIAN_LARGE_ROOM_';

const ARMS = [
  { name: 'D8', kind: 'drain', batch: 8 },
  { name: 'D16', kind: 'drain', batch: 16 },
  { name: 'D32', kind: 'drain', batch: 32 },
  { name: 'E0', kind: 'embed_floor', batch: 1 },
  { name: 'E32', kind: 'embed', batch: 32 },
  { name: 'E32_ARENA_OFF', kind: 'embed_arena_off', batch: 32 },
];

// -- small helpers ---------------------------------------------------------------------------------------------

function lowerPriority() {
  try {
    os.setPriority(0, process.platform === 'win32' ? os.constants.priority.PRIORITY_BELOW_NORMAL : 19);
  } catch (_e) { /* advisory */ }
}

function scrub(msg) {
  return String(msg || '').replace(/[A-Za-z]:\\[^\s'"]+/g, '<path>').replace(/\/[^\s'"]+/g, '<path>').slice(0, 200);
}

function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function round1(n) { return Math.round(n * 10) / 10; }

function readVersion(pkgDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version || null;
  } catch (_e) {
    return null;
  }
}

/** scrubEnv(env) -> a shallow copy without the batch, thread, arena and large-room limit variables. */
function scrubEnv(env) {
  const out = {};
  Object.keys(env || {}).forEach((k) => {
    if (SCRUB_KEYS.indexOf(k) !== -1) return;
    if (k.indexOf(SCRUB_PREFIX) === 0) return;
    out[k] = env[k];
  });
  return out;
}

function armByName(name) {
  for (let i = 0; i < ARMS.length; i += 1) if (ARMS[i].name === name) return ARMS[i];
  return null;
}

// -- child mode ----------------------------------------------------------------------------------------------------

function memFields() {
  const mu = process.memoryUsage();
  const ru = process.resourceUsage();
  const cpu = process.cpuUsage();
  return {
    cpu_ms: Math.round((cpu.user + cpu.system) / 1000),
    max_rss_mb: round1(ru.maxRSS / 1024),
    rss_end_mb: round1(mu.rss / 1048576),
    heap_total_mb: round1(mu.heapTotal / 1048576),
    external_mb: round1(mu.external / 1048576),
    array_buffers_mb: round1(mu.arrayBuffers / 1048576),
  };
}

function runDrainArm(arm, rep, scratch) {
  process.env.MINDRIAN_EMBED_BATCH = String(arm.batch);
  const leg = require(LEG_PATH);
  const t0 = Date.now();
  const res = leg.runLargeRoomLeg({ sha: 'probe', scratch: scratch, smoke: false });
  const clock = Date.now() - t0;
  const d = (res && res.drain) || {};
  const rss = d.max_rss_mb;
  const statusOk = res && (res.status === 'ok' || res.status === 'breach');
  return {
    arm: arm.name, rep: rep,
    ok: !!(statusOk && isFiniteNum(rss) && rss > 0),
    status: res ? res.status : 'error',
    outcome: d.outcome || null,
    clock_ms: isFiniteNum(d.clock_ms) ? d.clock_ms : clock,
    cpu_ms: isFiniteNum(d.cpu_ms) ? d.cpu_ms : null,
    max_rss_mb: isFiniteNum(rss) ? rss : null,
    limit_rss_mb: res && res.limits ? res.limits.rss_mb : null,
    first_not_ok: res ? res.first_not_ok : null,
  };
}

function buildArtifacts(scratch) {
  const builder = require(path.join(ROOT, 'tests', 'fixtures', 'large-room', 'build-fixture.cjs'));
  const classifier = require(path.join(ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'));
  const plain = builder.buildLargeRoom(scratch, { slug: 'probe-379-rss' });
  const list = classifier.enumerateArtifactsWithScope(plain.roomDir).artifacts;
  return { roomDir: plain.roomDir, artifacts: list, classifier: classifier };
}

async function runEmbedArm(arm, rep, scratch) {
  const spine = require(path.join(ROOT, 'lib', 'core', 'semantic-index', 'embedding-spine.cjs'));
  const t0 = Date.now();
  let embedded = 0;
  let loadOk = true;
  if (arm.kind === 'embed_floor') {
    const built = buildArtifacts(scratch);
    const first = built.artifacts[0];
    const out = await spine.embedTexts([first ? first.text : 'probe text'], {});
    loadOk = !!(out && out.success === true);
    embedded = loadOk ? out.vectors.length : 0;
  } else if (arm.kind === 'embed') {
    process.env.MINDRIAN_EMBED_BATCH = String(arm.batch);
    const built = buildArtifacts(scratch);
    const res = await built.classifier.attachVectors(built.roomDir, built.artifacts, {});
    loadOk = res.encoderUnavailable !== true;
    embedded = res.embedded;
  } else {
    const built = buildArtifacts(scratch);
    const { requireEurekaDep } = require(path.join(ROOT, 'lib', 'core', 'eureka-deps-resolver.cjs'));
    const transformers = requireEurekaDep('@huggingface/transformers');
    if (!transformers) return { arm: arm.name, rep: rep, ok: false, reason: 'encoder_unavailable' };
    const { pipeline, env } = transformers;
    env.allowRemoteModels = false;
    env.cacheDir = spine._test.resolveCacheDir(env);
    const sessionOptions = Object.assign({}, spine._test.buildSessionOptions(), { enableCpuMemArena: false, enableMemPattern: false });
    const pipe = await pipeline('feature-extraction', spine._test.resolveModel(), { dtype: spine._test.resolveDtype(), session_options: sessionOptions });
    const texts = built.artifacts.map((a) => a.text);
    const slices = spine._test.batchSlices(texts, arm.batch);
    for (let s = 0; s < slices.length; s += 1) {
      // eslint-disable-next-line no-await-in-loop
      const out = await pipe(slices[s], { pooling: 'mean', normalize: true });
      embedded += out.tolist().length;
    }
  }
  const mem = memFields();
  return Object.assign({
    arm: arm.name, rep: rep,
    ok: loadOk && embedded > 0 && isFiniteNum(mem.max_rss_mb),
    clock_ms: Date.now() - t0,
    embedded: embedded,
    load_ok: loadOk,
  }, mem);
}

async function runChildMode(name, rep, scratch) {
  lowerPriority();
  const arm = armByName(name);
  if (!arm) return { arm: String(name).slice(0, 40), rep: rep, ok: false, reason: 'unknown_arm' };
  if (arm.kind === 'drain') return runDrainArm(arm, rep, scratch);
  return runEmbedArm(arm, rep, scratch);
}

// -- parent mode ---------------------------------------------------------------------------------------------------

function defaultRunChild(name, rep) {
  const arm = armByName(name);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-rss-probe-'));
  try {
    const timeout = arm && arm.kind === 'drain' ? DRAIN_TIMEOUT_MS : EMBED_TIMEOUT_MS;
    const r = spawnSync(process.execPath, [__filename, '--arm', name, '--rep', String(rep), '--scratch', dir], {
      encoding: 'utf8', env: scrubEnv(process.env), timeout: timeout, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024,
    });
    if (r.error && (r.error.code === 'ETIMEDOUT' || r.signal === 'SIGKILL')) return { arm: name, rep: rep, ok: false, reason: 'timeout' };
    const lines = String(r.stdout || '').split('\n').map((l) => l.trim()).filter((l) => l[0] === '{');
    if (lines.length === 0) return { arm: name, rep: rep, ok: false, reason: 'no_json' };
    try {
      return JSON.parse(lines[lines.length - 1]);
    } catch (_e) {
      return { arm: name, rep: rep, ok: false, reason: 'no_json' };
    }
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

/**
 * collect(opts) -> { status: 'collected' | 'encoder_unavailable', children: [row] }
 * opts = { arms: [name], reps, runChild(name, rep), modelCached() } (the two functions are test seams).
 * Arms run one at a time: a parallel run corrupts the peak numbers.
 */
function collect(opts) {
  const o = opts || {};
  const names = Array.isArray(o.arms) && o.arms.length > 0 ? o.arms : ARMS.map((a) => a.name);
  const reps = Number.isInteger(o.reps) && o.reps >= 1 && o.reps <= 5 ? o.reps : DEFAULT_REPS;
  const modelCached = typeof o.modelCached === 'function' ? o.modelCached : () => require(LEG_PATH).modelCachedLocally();
  const runChild = typeof o.runChild === 'function' ? o.runChild : defaultRunChild;
  if (!modelCached()) return { status: 'encoder_unavailable', children: [] };
  const children = [];
  for (let a = 0; a < names.length; a += 1) {
    for (let r = 1; r <= reps; r += 1) {
      const row = runChild(names[a], r);
      children.push(row);
      process.stderr.write('probe-drain-rss: ' + names[a] + ' rep ' + r + ' ok ' + (row && row.ok === true) + ' peak RSS ' + (row && isFiniteNum(row.max_rss_mb) ? row.max_rss_mb : 'n/a') + ' MB\n');
    }
  }
  return { status: 'collected', children: children };
}

function median(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  if (n % 2 === 1) return round1(sorted[(n - 1) / 2]);
  return round1((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
}

function numsFor(rows, key) {
  return rows.map((r) => r[key]).filter(isFiniteNum).sort((x, y) => x - y);
}

/** summarize(children, limitMb) -> { arms: { name: stats }, derived }. Facts only; no recommendation. */
function summarize(children, limitMb) {
  const rowsAll = Array.isArray(children) ? children : [];
  const limit = isFiniteNum(limitMb) ? limitMb : null;
  const arms = {};
  ARMS.forEach((arm) => {
    const mine = rowsAll.filter((r) => r && r.arm === arm.name);
    const good = mine.filter((r) => r.ok === true && isFiniteNum(r.max_rss_mb));
    const rss = numsFor(good, 'max_rss_mb');
    const max = rss.length ? rss[rss.length - 1] : null;
    arms[arm.name] = {
      kind: arm.kind,
      batch: arm.batch,
      reps_run: mine.length,
      reps_ok: good.length,
      rss_mb_min: rss.length ? rss[0] : null,
      rss_mb_median: median(rss),
      rss_mb_max: max,
      clock_ms_median: median(numsFor(good, 'clock_ms')),
      cpu_ms_median: median(numsFor(good, 'cpu_ms')),
      under_limit: max === null || limit === null ? null : max <= limit,
    };
  });
  const dArms = ARMS.filter((a) => a.kind === 'drain').sort((x, y) => x.batch - y.batch);
  const curve = dArms.map((a) => ({ batch: a.batch, rss_mb_max: arms[a.name].rss_mb_max, under_limit: arms[a.name].under_limit }));
  let largest = null;
  curve.forEach((c) => { if (c.under_limit === true) largest = c.batch; });
  const ctl = arms.D32.rss_mb_max;
  const e32 = arms.E32.rss_mb_max;
  const off = arms.E32_ARENA_OFF.rss_mb_max;
  return {
    arms: arms,
    derived: {
      limit_mb: limit,
      control_arm: 'D32',
      control_rss_mb_max: ctl,
      control_reproduced_breach: ctl === null || limit === null ? null : ctl > limit,
      batch_curve: curve,
      largest_batch_under_limit: largest,
      encoder_floor_mb: arms.E0.rss_mb_max,
      embed_only_rss_mb_max: e32,
      encoder_share_of_control: ctl === null || e32 === null || ctl === 0 ? null : Math.round((e32 / ctl) * 100) / 100,
      arena_off_rss_mb_max: off,
      arena_off_change_pct_vs_embed_only: off === null || e32 === null || e32 === 0 ? null : Math.round(((off - e32) / e32) * 100),
    },
  };
}

function walkNumbers(v, bad, where) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) bad.push('not finite at ' + where);
  } else if (typeof v === 'string') {
    if (v.length > 200) bad.push('string too long at ' + where);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => walkNumbers(x, bad, where + '[' + i + ']'));
  } else if (v && typeof v === 'object') {
    Object.keys(v).forEach((k) => walkNumbers(v[k], bad, where + '.' + k));
  }
}

/** validateResult(obj) -> [problem]. An empty array means valid (Part 8: numbers, booleans, enum strings). */
function validateResult(obj) {
  const bad = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['not an object'];
  if (obj.probe !== 'drain-rss') bad.push('probe must be drain-rss');
  ['probed_at', 'node_version', 'host_cores', 'host_mem_total_mb', 'platform', 'status', 'params', 'arms', 'derived', 'children'].forEach((k) => {
    if (!(k in obj)) bad.push('missing key ' + k);
  });
  if (STATUSES.indexOf(obj.status) === -1) bad.push('unknown status');
  walkNumbers(obj, bad, '$');
  let text = '';
  try { text = JSON.stringify(obj); } catch (_e) { bad.push('not serialisable'); }
  const tmp = os.tmpdir();
  const home = os.homedir();
  if (tmp && tmp !== '/' && text.indexOf(tmp) !== -1) bad.push('holds the temp dir path');
  if (home && home !== '/' && text.indexOf(home) !== -1) bad.push('holds the home dir path');
  if (/[A-Za-z]:\\\\/.test(text)) bad.push('holds a drive-letter path');
  return bad;
}

function cleanChild(row) {
  const r = row || {};
  const out = {};
  ['arm', 'rep', 'ok', 'status', 'outcome', 'reason', 'first_not_ok', 'load_ok'].forEach((k) => {
    if (r[k] === undefined || r[k] === null) return;
    out[k] = typeof r[k] === 'string' ? scrub(r[k]) : r[k];
  });
  ['clock_ms', 'cpu_ms', 'max_rss_mb', 'rss_end_mb', 'heap_total_mb', 'external_mb', 'array_buffers_mb', 'embedded', 'limit_rss_mb'].forEach((k) => {
    if (isFiniteNum(r[k])) out[k] = r[k];
  });
  return out;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
}

function main() {
  lowerPriority();
  const repsArg = argValue('--reps');
  const reps = repsArg === null ? DEFAULT_REPS : Number(repsArg);
  if (!Number.isInteger(reps) || reps < 1 || reps > 5) throw new Error('--reps must be an integer from 1 to 5');
  const armsArg = argValue('--arms');
  const names = armsArg ? armsArg.split(',').map((s) => s.trim()).filter(Boolean) : ARMS.map((a) => a.name);
  names.forEach((n) => { if (!armByName(n)) throw new Error('unknown arm ' + scrub(n)); });
  const outFile = argValue('--out') || RESULT_PATH;

  const { eurekaDepsRoot } = require(path.join(ROOT, 'lib', 'core', 'eureka-deps-resolver.cjs'));
  const spine = require(path.join(ROOT, 'lib', 'core', 'semantic-index', 'embedding-spine.cjs'));
  const depsRoot = eurekaDepsRoot();
  const got = collect({ arms: names, reps: reps });
  const children = got.children;
  const firstDrain = children.find((c) => c && c.arm && armByName(c.arm) && armByName(c.arm).kind === 'drain' && isFiniteNum(c.limit_rss_mb));
  const limitMb = firstDrain ? firstDrain.limit_rss_mb : 1024;
  const sum = summarize(children, limitMb);
  let status = 'ok';
  if (got.status === 'encoder_unavailable') status = 'encoder_unavailable';
  else if (['D8', 'D16', 'D32'].some((n) => names.indexOf(n) === -1 || sum.arms[n].reps_ok < 1)) status = 'partial';

  const out = {
    probe: 'drain-rss',
    probed_at: new Date().toISOString(),
    node_version: process.version,
    host_cores: os.availableParallelism(),
    host_mem_total_mb: Math.round(os.totalmem() / 1048576),
    platform: process.platform,
    status: status,
    ort_version: depsRoot ? readVersion(path.join(depsRoot, 'node_modules', 'onnxruntime-node')) : null,
    transformers_version: depsRoot ? readVersion(path.join(depsRoot, 'node_modules', '@huggingface', 'transformers')) : null,
    model: spine._test.resolveModel(),
    dtype: spine._test.resolveDtype(),
    params: { reps: reps, batches: [8, 16, 32], artifact_count: 2105, limit_mb: limitMb },
    arms: sum.arms,
    derived: sum.derived,
    children: children.map(cleanChild),
  };
  const problems = validateResult(out);
  if (problems.length > 0) throw new Error('result failed validation: ' + problems.join('; '));
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8');
  process.stderr.write('probe-drain-rss: status ' + status + '\n');
}

if (require.main === module) {
  const armName = argValue('--arm');
  if (armName !== null) {
    const rep = Number(argValue('--rep')) || 1;
    runChildMode(armName, rep, argValue('--scratch')).then((r) => {
      process.stdout.write(JSON.stringify(r) + '\n');
      process.exit(0);
    }).catch((e) => {
      process.stdout.write(JSON.stringify({ arm: String(armName).slice(0, 40), rep: rep, ok: false, reason: 'child_error', message: scrub(e && e.message) }) + '\n');
      process.exit(0);
    });
  } else {
    try {
      main();
      process.exit(0);
    } catch (e) {
      process.stderr.write('probe-drain-rss: error ' + scrub(e && e.message) + '\n');
      process.exit(1);
    }
  }
}

module.exports = { ARMS, collect, summarize, validateResult, scrubEnv };
