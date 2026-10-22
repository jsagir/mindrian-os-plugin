#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 plan 06 (CPU379-02, CPU379-08, CPU379-09; decision D-379.1-02): the LARGE ROOM LEG of
 * the real-room release run (RULE 10 in docs/RELEASE-CEREMONY-RULING-SYSTEM.md).
 *
 * WHAT: builds, at run time and under the caller's scratch directory only, a room of more than 2,000
 * artifacts (tests/fixtures/large-room/build-fixture.cjs, 2,105 artifacts), then runs two children
 * against it and measures each one:
 *   1. the drain worker: node scripts/gsd-graph-derive-drain.cjs --worker --room <dir> --report-usage
 *      (MOS_NO_DETACHED_DERIVE=1, a parent-side timeout). The child reports its own CPU, peak RSS and
 *      clock in one stderr line (schema drain-usage-v1).
 *   2. the scout: lib/core/rs-engine.cjs runModeInternal in a child process. The room is above the
 *      artifact cap, so the scout must return the artifact_cap_exceeded envelope and never build the
 *      LSA matrix (D-379.1-14 floor). The child prints its own CPU and peak RSS in one stdout line.
 * A second, manifest-carrying copy of the fixture proves that both walkers (the drain classifier and
 * the scout engine) read one scope declaration and exclude the same 2,100 generated artifacts.
 *
 * WHY: the 2026-10-21 incident (2,163 artifacts, 2,338,203 pairs, 2 to 4 hours of Jacobi per scout run)
 * was invisible to a receipt cut on a 44-artifact room. The gate (real-room-gate.sh) refuses a receipt
 * without this leg, with a leg in smoke mode, or with a breach.
 *
 * WHAT THIS LEG DOES NOT MEASURE: the LSA path at scale is measured by tests/test-379.1-svd-parity.cjs
 * (step 5) and the step timeout by tests/test-379.1-scout-bound.cjs. The leg proves the cap, the clock,
 * the CPU and the peak RSS of the path a large room takes.
 *
 * The drain child loads the local embedding model. The leg never lets that child download it: when the
 * model is not in the local cache, the leg records the drain outcome encoder_unavailable (status
 * inconclusive) and does not start the drain (a download is a network call; the leg has none).
 *
 * Numbers, booleans and enum strings only in the result (Part 8: no path below the scratch root, no
 * room text). Hyphens only; no network primitive in this file.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_BUILDER = path.join(ROOT, 'tests', 'fixtures', 'large-room', 'build-fixture.cjs');
const DRAIN_CLI = path.join(ROOT, 'scripts', 'gsd-graph-derive-drain.cjs');
const EXPECTED_SCOPED_ARTIFACTS = 5;
const EXPECTED_EXCLUDED_ARTIFACTS = 2100;
const SMOKE_PAIRS = 50;
const SMOKE_BUDGET_MS = 20000;
const KILL_MARGIN_MS = 30000;
const DRAIN_BUDGET_MARGIN_MS = 60000;
const MAX_BUFFER = 32 * 1024 * 1024;

const DEFAULT_LIMITS = { clock_ms: 300000, cpu_ms: 600000, rss_mb: 1024 };
const LIMIT_ENV = { clock_ms: 'MINDRIAN_LARGE_ROOM_CLOCK_MS', cpu_ms: 'MINDRIAN_LARGE_ROOM_CPU_MS', rss_mb: 'MINDRIAN_LARGE_ROOM_RSS_MB' };

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }
function posInt(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^[0-9]+$/.test(v.trim()) ? Number(v.trim()) : NaN);
  return Number.isFinite(n) && n > 0 && Math.floor(n) === n ? n : null;
}
function finite(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

/** resolveLimits(limits) -> { clock_ms, cpu_ms, rss_mb }: explicit value, else env, else default; positive integers only. */
function resolveLimits(limits) {
  const given = isObj(limits) ? limits : {};
  const out = {};
  Object.keys(DEFAULT_LIMITS).forEach(function (k) {
    out[k] = posInt(given[k]) || posInt(process.env[LIMIT_ENV[k]]) || DEFAULT_LIMITS[k];
  });
  return out;
}

// -- the local model preflight --------------------------------------------------------------------------------
// The drain child would download the model on a cache miss. The leg refuses to start it in that case.
function modelCachedLocally() {
  try {
    const spine = require(path.join(ROOT, 'lib', 'core', 'semantic-index', 'embedding-spine.cjs'));
    const model = spine._test.resolveModel();
    const cache = spine._test.resolveCacheDir(undefined);
    if (!cache) return false;
    const dir = path.join(cache, model);
    return fs.existsSync(path.join(dir, 'config.json')) && fs.existsSync(path.join(dir, 'onnx'));
  } catch (_e) {
    return false;
  }
}

// -- child parsers (T-379.1-11): only the last '{' line, in try/catch, numbers validated ---------------------
function lastJsonLine(text) {
  const lines = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i][0] === '{') { try { return JSON.parse(lines[i]); } catch (_e) { /* keep looking */ } }
  }
  return null;
}

function usageToNumbers(u) {
  if (!isObj(u)) return null;
  const user = finite(u.cpu_user_us);
  const sys = finite(u.cpu_system_us);
  const rssKb = finite(u.max_rss_kb);
  if (user === null || sys === null || rssKb === null) return null;
  return { cpu_ms: Math.round((user + sys) / 1000), max_rss_mb: Math.round((rssKb / 1024) * 10) / 10 };
}

// -- the drain outcome: read the queue and the last disclosure events, read only ---------------------------
function readDrainOutcome(roomDir, timedOut) {
  if (timedOut) return 'timeout';
  let entries = [];
  try { entries = require(path.join(ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs')).readQueue(roomDir).entries || []; } catch (_e) { entries = []; }
  const progressed = entries.some(function (e) { return e && ((Number.isFinite(e.cursor) && e.cursor > 0) || e.vectors_ready === true || (Number.isFinite(e.vectors_ready) && e.vectors_ready > 0)); });
  if (progressed) return 'bounded_progress';
  let skipReason = null;
  let completed = false;
  let db = null;
  try {
    const nav = require(path.join(ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));
    const { findRecentChanges } = require(path.join(ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
    db = nav.openRoomDbReadOnlyForCaller(roomDir);
    if (db) {
      const skip = findRecentChanges(db, 0, { eventType: 'derivation_skipped', limit: 1 });
      if (skip && skip.length > 0 && skip[0].properties && typeof skip[0].properties.reason === 'string') skipReason = skip[0].properties.reason;
      const done = findRecentChanges(db, 0, { eventType: 'derivation_completed', limit: 1 });
      completed = !!(done && done.length > 0);
    }
  } catch (_e) { /* read only, advisory */ } finally {
    if (db) { try { require(path.join(ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs')).closeRoomDbForCaller(db); } catch (_ce) { /* ignore */ } }
  }
  if (skipReason === 'pair_cap_exceeded') return 'pair_cap_exceeded';
  if (skipReason === 'encoder_unavailable') return 'encoder_unavailable';
  if (completed && entries.length === 0) return 'completed';
  return 'error';
}

// -- the pure limit arithmetic ----------------------------------------------------------------------------------
function within(child, limits, timedOut) {
  if (!isObj(child) || timedOut) return false;
  return finite(child.clock_ms) !== null && child.clock_ms <= limits.clock_ms
    && finite(child.cpu_ms) !== null && child.cpu_ms <= limits.cpu_ms
    && finite(child.max_rss_mb) !== null && child.max_rss_mb <= limits.rss_mb;
}

function firstOverLimit(prefix, child, limits) {
  if (!isObj(child)) return prefix + '.missing';
  const keys = ['clock_ms', 'cpu_ms', 'max_rss_mb'];
  const limitKey = { clock_ms: 'clock_ms', cpu_ms: 'cpu_ms', max_rss_mb: 'rss_mb' };
  for (let i = 0; i < keys.length; i += 1) {
    const v = finite(child[keys[i]]);
    if (v === null || v > limits[limitKey[keys[i]]]) return prefix + '.' + keys[i];
  }
  return null;
}

/**
 * evaluateLeg(raw, limits) -> { status, ok, first_not_ok, drain: { within_limits }, scout: { within_limits } }
 * Pure. raw = { drain, scout, scope, error? }. Both children's clock, CPU and peak RSS go against the limits.
 *   error        -> status 'error'
 *   timeout      -> breach
 *   a limit over -> breach, first_not_ok names the field (for example 'drain.cpu_ms', 'scout.max_rss_mb')
 *   scout is not the cap envelope, or the scope counts differ from 5 and 2100 -> breach
 *   drain outcome encoder_unavailable with every other check in bounds -> inconclusive (the bound was not exercised)
 */
function evaluateLeg(raw, limits) {
  const lim = resolveLimits(limits);
  const r = isObj(raw) ? raw : {};
  if (typeof r.error === 'string' && r.error.length > 0) {
    return { status: 'error', ok: false, first_not_ok: 'error', drain: { within_limits: false }, scout: { within_limits: false }, error: r.error.slice(0, 200) };
  }
  const drain = isObj(r.drain) ? r.drain : {};
  const scout = isObj(r.scout) ? r.scout : {};
  const scope = isObj(r.scope) ? r.scope : {};
  const drainTimedOut = drain.outcome === 'timeout';
  const encoderMissing = drain.outcome === 'encoder_unavailable';
  // an unavailable encoder means the drain never ran its bounded path: the numbers are real, the verdict is not
  const drainWithin = drainTimedOut ? false : within(drain, lim, false);
  const scoutWithin = within(scout, lim, false);
  let firstNot = null;
  if (drainTimedOut) firstNot = 'drain.timeout';
  else if (!drainWithin) firstNot = firstOverLimit('drain', drain, lim);
  if (firstNot === null && drain.outcome === 'error') firstNot = 'drain.outcome';
  if (firstNot === null && !scoutWithin) firstNot = firstOverLimit('scout', scout, lim);
  if (firstNot === null && scout.degraded !== 'artifact_cap_exceeded') firstNot = 'scout.degraded';
  if (firstNot === null && scope.ok !== true) firstNot = 'scope';
  const status = firstNot !== null ? 'breach' : (encoderMissing ? 'inconclusive' : 'ok');
  return {
    status: status,
    ok: status === 'ok',
    first_not_ok: firstNot,
    drain: { within_limits: drainWithin && drain.outcome !== 'error' },
    scout: { within_limits: scoutWithin },
  };
}

// -- the children -------------------------------------------------------------------------------------------------
function runDrainChild(roomDir, limits, smoke) {
  const env = Object.assign({}, process.env, {
    MOS_NO_DETACHED_DERIVE: '1',
    MINDRIAN_DERIVE_BUDGET_MS: String(Math.max(10000, limits.clock_ms - DRAIN_BUDGET_MARGIN_MS)),
  });
  if (smoke) {
    env.MINDRIAN_DERIVE_MAX_PAIRS_PER_DRAIN = String(SMOKE_PAIRS);
    env.MINDRIAN_DERIVE_BUDGET_MS = String(SMOKE_BUDGET_MS);
  }
  delete env.MINDRIAN_DERIVE_SKIP;
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, [DRAIN_CLI, '--worker', '--room', roomDir, '--report-usage'], {
    encoding: 'utf8', timeout: limits.clock_ms + KILL_MARGIN_MS, maxBuffer: MAX_BUFFER, env: env, killSignal: 'SIGKILL',
  });
  const clock = Date.now() - t0;
  const timedOut = !!(r.error && (r.error.code === 'ETIMEDOUT' || r.signal === 'SIGKILL'));
  const usage = usageToNumbers(lastJsonLine(r.stderr));
  const child = { clock_ms: clock, cpu_ms: usage ? usage.cpu_ms : null, max_rss_mb: usage ? usage.max_rss_mb : null };
  child.outcome = readDrainOutcome(roomDir, timedOut);
  return child;
}

const SCOUT_SOURCE = [
  "const rs = require(process.argv[1]);",
  "rs.runModeInternal(process.argv[2], {}).then(function (res) {",
  "  const m = (res && res.metadata) || {};",
  "  let maxRss = 0;",
  "  try { maxRss = process.resourceUsage().maxRSS; } catch (_e) { maxRss = 0; }",
  "  const cpu = process.cpuUsage();",
  "  process.stdout.write(JSON.stringify({ degraded: m.degraded || null, excluded: m.scope_excluded_artifacts, cpu_user_us: cpu.user, cpu_system_us: cpu.system, max_rss_kb: maxRss }) + '\\n');",
  "  process.exit(0);",
  "}).catch(function (e) { process.stdout.write(JSON.stringify({ error: String((e && e.message) || e).slice(0, 120) }) + '\\n'); process.exit(1); });",
].join('\n');

function runScoutChild(roomDir, limits) {
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, ['-e', SCOUT_SOURCE, path.join(ROOT, 'lib', 'core', 'rs-engine.cjs'), roomDir], {
    encoding: 'utf8', timeout: limits.clock_ms + KILL_MARGIN_MS, maxBuffer: MAX_BUFFER, env: process.env, killSignal: 'SIGKILL',
  });
  const clock = Date.now() - t0;
  const timedOut = !!(r.error && (r.error.code === 'ETIMEDOUT' || r.signal === 'SIGKILL'));
  const out = lastJsonLine(r.stdout);
  const usage = isObj(out) ? usageToNumbers(out) : null;
  return {
    clock_ms: clock,
    cpu_ms: usage ? usage.cpu_ms : null,
    max_rss_mb: usage ? usage.max_rss_mb : null,
    degraded: isObj(out) && typeof out.degraded === 'string' ? out.degraded : null,
    timed_out: timedOut,
  };
}

const SCOPE_SOURCE = [
  "const cls = require(process.argv[1]);",
  "const rs = require(process.argv[2]);",
  "const a = cls.enumerateArtifactsWithScope(process.argv[3]);",
  "const b = rs.discoverArtifactsWithScope(process.argv[3]);",
  "const ex = a.scope && a.scope.stats ? a.scope.stats.excluded_md : null;",
  "process.stdout.write(JSON.stringify({ classifier: a.artifacts.length, rs_engine: b.artifacts.length, excluded: ex }) + '\\n');",
].join('\n');

function runScopeCheck(roomDir) {
  const r = cp.spawnSync(process.execPath, ['-e', SCOPE_SOURCE,
    path.join(ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'), path.join(ROOT, 'lib', 'core', 'rs-engine.cjs'), roomDir], {
    encoding: 'utf8', timeout: 120000, maxBuffer: MAX_BUFFER, env: process.env, killSignal: 'SIGKILL',
  });
  const j = lastJsonLine(r.stdout);
  const c = isObj(j) ? finite(j.classifier) : null;
  const e = isObj(j) ? finite(j.rs_engine) : null;
  const x = isObj(j) ? finite(j.excluded) : null;
  return {
    with_manifest_classifier: c === null ? -1 : c,
    with_manifest_rs_engine: e === null ? -1 : e,
    excluded_artifacts: x === null ? -1 : x,
    ok: c === EXPECTED_SCOPED_ARTIFACTS && e === EXPECTED_SCOPED_ARTIFACTS && x === EXPECTED_EXCLUDED_ARTIFACTS,
  };
}

// -- birth room.db in the first room ---------------------------------------------------------------------------------
// real-room-run.cjs buildRoom also runs graphOps.indexArtifact over every copied file. This leg skips that
// per-file loop on purpose: the drain and the scout read the files, and runDerivation needs only an existing
// room.db. The rooms home must exist before the birth call (the registry refuses a missing directory).
function birthRoomDb(roomDir, slug, scratch) {
  const roomsHome = path.join(scratch, 'rooms-home-379');
  fs.mkdirSync(roomsHome, { recursive: true });
  const previous = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;
  try {
    const birth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
      slug: slug, roomDir: roomDir, sessionId: 'large-room-leg', ventureText: 'a generated room that tests the worker bounds',
      jtbd: '', approvedBy: 'large-room-leg', canonicalRole: 'founder', vname: slug, vstage: 'Pre-Opportunity',
    });
    if (!birth || birth.ok !== true) throw new Error('room_birth_failed');
    if (!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) throw new Error('room_birth_failed: room.db missing');
  } finally {
    if (previous === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = previous;
  }
}

/**
 * runLargeRoomLeg({ sha, scratch, limits, smoke }) -> {
 *   ok, status: 'ok' | 'breach' | 'inconclusive' | 'error', smoke, artifact_count, limits,
 *   drain: { clock_ms, cpu_ms, max_rss_mb, outcome, within_limits },
 *   scout: { clock_ms, cpu_ms, max_rss_mb, degraded, within_limits },
 *   scope: { with_manifest_classifier, with_manifest_rs_engine, excluded_artifacts, ok },
 *   first_not_ok }
 */
function runLargeRoomLeg(opts) {
  const o = isObj(opts) ? opts : {};
  const smoke = o.smoke === true;
  const limits = resolveLimits(o.limits);
  const scratch = o.scratch || fs.mkdtempSync(path.join(os.tmpdir(), 'mos-large-room-leg-'));
  const result = {
    ok: false, status: 'error', smoke: smoke, artifact_count: 0, limits: limits,
    drain: { clock_ms: 0, cpu_ms: 0, max_rss_mb: 0, outcome: 'error', within_limits: false },
    scout: { clock_ms: 0, cpu_ms: 0, max_rss_mb: 0, degraded: null, within_limits: false },
    scope: { with_manifest_classifier: -1, with_manifest_rs_engine: -1, excluded_artifacts: -1, ok: false },
    first_not_ok: 'error',
  };
  try {
    const builder = require(FIXTURE_BUILDER);
    const plain = builder.buildLargeRoom(scratch, { slug: 'large-room-379' });
    const scoped = builder.buildLargeRoom(scratch, { slug: 'large-room-379-scoped', withManifest: true });
    result.artifact_count = plain.artifacts;
    birthRoomDb(plain.roomDir, 'large-room-379', scratch);
    require(path.join(ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs')).enqueueDerive(plain.roomDir, {});

    // child 1: the drain worker (never started when the model would have to be downloaded)
    let drain;
    if (modelCachedLocally()) {
      drain = runDrainChild(plain.roomDir, limits, smoke);
    } else {
      drain = { clock_ms: 0, cpu_ms: 0, max_rss_mb: 0, outcome: 'encoder_unavailable' };
    }
    // child 2: the scout
    const scout = runScoutChild(plain.roomDir, limits);
    // the scope check on the manifest copy
    const scope = runScopeCheck(scoped.roomDir);

    const verdict = evaluateLeg({
      drain: drain,
      scout: scout.timed_out ? Object.assign({}, scout, { clock_ms: limits.clock_ms + 1 }) : scout,
      scope: scope,
    }, limits);
    result.drain = Object.assign({}, drain, { within_limits: verdict.drain.within_limits });
    result.scout = { clock_ms: scout.clock_ms, cpu_ms: scout.cpu_ms === null ? 0 : scout.cpu_ms, max_rss_mb: scout.max_rss_mb === null ? 0 : scout.max_rss_mb, degraded: scout.degraded, within_limits: verdict.scout.within_limits };
    result.drain.cpu_ms = result.drain.cpu_ms === null ? 0 : result.drain.cpu_ms;
    result.drain.max_rss_mb = result.drain.max_rss_mb === null ? 0 : result.drain.max_rss_mb;
    result.scope = scope;
    result.status = verdict.status;
    result.ok = verdict.ok;
    result.first_not_ok = verdict.first_not_ok;
  } catch (e) {
    const v = evaluateLeg({ error: noDash(String((e && e.message) || e)) }, limits);
    result.status = v.status;
    result.ok = false;
    result.first_not_ok = v.first_not_ok;
  }
  return result;
}

function fmt(n) { return Number.isFinite(n) ? String(n) : 'unknown'; }

/** formatLargeRoomBlock(leg) -> the report section, in the run's "It tried / It got / It could not" voice. */
function formatLargeRoomBlock(leg) {
  const L = [];
  const g = isObj(leg) ? leg : {};
  const d = isObj(g.drain) ? g.drain : {};
  const s = isObj(g.scout) ? g.scout : {};
  const sc = isObj(g.scope) ? g.scope : {};
  const lim = isObj(g.limits) ? g.limits : DEFAULT_LIMITS;
  L.push('== Large room leg ==');
  L.push('  It tried:  a generated room of ' + fmt(g.artifact_count) + ' artifacts: the drain worker, the scout, and a second copy with a scope declaration. Limits: clock ' + fmt(lim.clock_ms) + ' ms, CPU ' + fmt(lim.cpu_ms) + ' ms, peak RSS ' + fmt(lim.rss_mb) + ' MB.'
    + (g.smoke === true ? ' Smoke mode: 50 pairs, 20 s budget. A smoke leg is not a release leg.' : ''));
  L.push('  It got:    drain ' + String(d.outcome) + ' in ' + fmt(d.clock_ms) + ' ms, CPU ' + fmt(d.cpu_ms) + ' ms, peak RSS ' + fmt(d.max_rss_mb) + ' MB; scout ' + String(s.degraded) + ' in ' + fmt(s.clock_ms) + ' ms, CPU ' + fmt(s.cpu_ms) + ' ms, peak RSS ' + fmt(s.max_rss_mb) + ' MB; scope: both walkers saw ' + fmt(sc.with_manifest_classifier) + ' and ' + fmt(sc.with_manifest_rs_engine) + ' artifacts and ' + fmt(sc.excluded_artifacts) + ' were excluded. Status: ' + String(g.status) + '.');
  L.push('  It could not: ' + (g.first_not_ok ? 'pass on ' + String(g.first_not_ok) : (g.status === 'inconclusive' ? 'exercise the drain bound (the embedding model was not available locally)' : 'nothing')) + '.');
  return noDash(L.join('\n'));
}

module.exports = { runLargeRoomLeg, formatLargeRoomBlock, evaluateLeg, DEFAULT_LIMITS, modelCachedLocally };
