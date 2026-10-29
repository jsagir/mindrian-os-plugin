#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.2-01 (D-08, DOCTOR-95.2-06) -- SessionStart preflight. The install-drift
 * banner ("install dir missing or drifted; run /mos:doctor --fix") was RETIRED in
 * Phase 341 plan 09 with doctor class A: that banner read class A's drift signal
 * (the legacy install directory versus the marketplace cache), and the loader now
 * owns the swap with one install location. A leftover legacy directory is
 * reported by doctor class I. What this script still contributes, through the
 * frozen 'install-drift' ladder slot, is the release-drift sentence and the
 * Phase 233 graph re-derive nudge.
 *
 * Defensive rules (NEVER blocks the hook chain):
 *   - timeout 1500ms on the doctor subprocess; overall budget < 2000ms.
 *   - uncaughtException -> emit empty envelope.
 *   - Any internal error -> emit empty envelope.
 *
 * Canon Part 8: zero network surface. Reads only LOCAL files via the doctor.cjs
 * subprocess.
 *
 * Quick 261029-lx3: throttled(id) wraps this contributor and the onboarding one.
 * The doctor runs at most once in 24 h per plugin version. A stamp in
 * ~/.mindrian/banner-state holds the last fragment. A stale stamp starts a
 * detached `--refresh` child and the start does not wait for it.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

function emitEnvelope(obj) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  try { process.stdout.write(JSON.stringify(filtered)); } catch (_) {}
  process.exit(0);
}
function emitEmpty() { emitEnvelope({ continue: true }); }
process.on('uncaughtException', () => emitEmpty());

// runDoctor(extraArgs) -- ONE doctor subprocess, optionally with extra class
// flags. Phase 233: contribute() passes ['--graph-derive-health'] so the
// graph-derive-health class actually runs inside the SAME spawn (it is a
// flag-gated cadence:always module, so a bare `--json` run would never populate
// report.checks['graph-derive-health'] and the nudge would be permanently dark).
// Default [] keeps the legacy main() hook path byte-identical.
function runDoctor(extraArgs) {
  const doctorPath = path.join(__dirname, 'doctor.cjs');
  const env = Object.assign({}, process.env);
  const args = [doctorPath, '--json'].concat(Array.isArray(extraArgs) ? extraArgs : []);
  // Keep MOS_NO_COLOR / NO_COLOR if set; doctor.cjs respects them too.
  const res = spawnSync('node', args, {
    encoding: 'utf8',
    timeout: 1500,
    env,
  });
  if (!res || typeof res.stdout !== 'string') return null;
  try { return JSON.parse(res.stdout); } catch (_) { return null; }
}

// The bare-hook entry point has nothing left to say: its only message was the
// retired class A drift banner. hooks.json points at the coordinator, not here.
function main() {
  return emitEmpty();
}

// ----- Phase 121.5-00 contributor surface -----
// Composes the install-drift signal as a ContributorFragment for the
// SessionStart Coordinator. The legacy main() above is preserved BYTE-IDENTICAL
// (so any code still invoking this script as a bare hook keeps working) but
// hooks.json no longer points at it -- the coordinator calls contribute() instead.

// graphDeriveNudge(report) -> a single plain-language sentence, or null.
//
// Phase 233 (RCA 4d, Tri-Polar clause): on Claude Code the operator gets the
// full CLI report via `/mos:doctor --graph-derive-health`. On Desktop and Cowork
// there is no CLI to read, so the same finding has to arrive as something a
// person can act on in conversation. That is what this is: one sentence, no
// table, no JSON, no counts dumped into the payload. The frozen precedence
// ladder (lib/sessionstart/precedence-ladder.cjs) forbids adding a slot without
// a canon amendment, so the sentence rides the EXISTING 'install-drift'
// fragment rather than asking for one.
function graphDeriveNudge(report) {
  try {
    const gdh = report && report.checks && report.checks['graph-derive-health'];
    if (!gdh) return null;
    if (gdh.status !== 'warn' && gdh.status !== 'fail') return null;
    return 'Your Data Room graph needs a re-derive: it has filed your work into sections '
      + 'but has not yet worked out how the ideas relate. Run /mos:doctor --heal-room '
      + 'and the next session will rebuild the connections.';
  } catch (_) {
    return null;
  }
}

// contribute(opts) -- the SessionStart Coordinator entry point. `opts.runDoctor`
// is a test seam ONLY (an injected report source); the coordinator calls this
// with no arguments and gets the real subprocess.
function contribute(opts) {
  try {
    const fi = require('../lib/sessionstart/contributor-interface.cjs');
    const runner = (opts && typeof opts.runDoctor === 'function') ? opts.runDoctor : runDoctor;
    const report = runner(['--graph-derive-health']);
    if (!report) return fi.emptyFragment();

    // Roll the release-drift signal in here (Plan 121.5-00 Task 2: preflight-release-drift
    // is removed from hooks.json; its computation FOLDS into install-drift).
    let releaseDriftLine = null;
    try {
      const driftMod = require('./preflight-release-drift.cjs');
      if (driftMod && typeof driftMod.contributeReleaseDrift === 'function') {
        const sub = driftMod.contributeReleaseDrift();
        if (sub && typeof sub.message === 'string' && sub.message.length > 0) {
          releaseDriftLine = sub.message;
        }
      }
    } catch (_) { /* sub-finding optional */ }

    const graphLine = graphDeriveNudge(report);

    if (!releaseDriftLine && !graphLine) return fi.emptyFragment();

    const pieces = [];
    if (releaseDriftLine) pieces.push(releaseDriftLine);
    // Third piece, appended to the SAME array (never replacing the existing
    // composition): the Phase 233 graph re-derive nudge.
    if (graphLine) pieces.push(graphLine);
    const fullPayload = pieces.join('\n');
    if (!fullPayload) return fi.emptyFragment();

    // The pointer names whichever finding is actually present. When the ONLY
    // finding is the graph nudge, claiming a release drift would be a false
    // report -- the exact false-success class this phase exists to close.
    const pointer = (!releaseDriftLine && graphLine)
      ? 'Your Data Room graph needs a re-derive -- run /mos:doctor --heal-room.'
      : 'MindrianOS release work is not pushed -- see the session-start note.';
    return fi.makeFragment({
      id: 'install-drift',
      priority: 1,
      full_payload: fullPayload,
      one_line_pointer: pointer,
    });
  } catch (_) {
    // Any failure -> empty fragment. The isolator never has anything to log.
    try {
      const fi = require('../lib/sessionstart/contributor-interface.cjs');
      return fi.emptyFragment();
    } catch (_) {
      return { has_payload: false };
    }
  }
}


// ----- Quick 261029-lx3: throttled doctor runs -----
// contribute() and the onboarding contributor each spawn doctor.cjs, which
// cost about 12 s of the SessionStart event on a real room (Claude Code holds
// the first reply until every hook ends). throttled(id) wraps one of them so
// the doctor runs at most once in 24 h per plugin version, in a detached
// child. The stamp is ~/.mindrian/banner-state/sessionstart-throttle-<id>.json.
// No stamp: one synchronous run, which writes it. A stale stamp: the cached
// fragment comes back at once and a detached `--refresh` child updates it
// under an O_EXCL lock. Nothing is removed: the same checks run, only later.
const THROTTLE_WINDOW_MS = 24 * 60 * 60 * 1000;
const THROTTLE_LOCK_STALE_MS = 120 * 1000;

function throttleSpec(id) {
  if (id === 'install-drift') return { inner: contribute, keyCwd: true, gate: null };
  if (id === 'onboarding') {
    const mod = require('./check-onboard-statusline.cjs');
    return { inner: mod.contributeOnboarding, keyCwd: false, gate: mod.shouldFire };
  }
  return null;
}

function throttlePluginVersion() {
  try {
    const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
    return (j && typeof j.version === 'string' && j.version) ? j.version : null;
  } catch (_) { return null; }
}

function throttleStampPath(id) {
  return path.join(os.homedir(), '.mindrian', 'banner-state', 'sessionstart-throttle-' + id + '.json');
}

function throttleTelemetry(rec) {
  try {
    const file = path.join(os.homedir(), '.mindrian', 'telemetry', 'sessionstart-doctor-throttle.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, rec)) + '\n', 'utf8');
  } catch (_) { /* best effort */ }
}

// Returns { absent: true }, { bad: true } or { obj }.
function throttleReadStamp(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) {
    return (e && e.code === 'ENOENT') ? { absent: true } : { bad: true };
  }
  try {
    const obj = JSON.parse(txt);
    return (obj && typeof obj === 'object') ? { obj } : { bad: true };
  } catch (_) { return { bad: true }; }
}

function throttleWriteStamp(id, version, fragment) {
  try {
    const file = throttleStampPath(id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const now = Date.now();
    const tmp = file + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify({
      id, plugin_version: version, cwd: process.cwd(),
      ran_at_ms: now, ran_at: new Date(now).toISOString(), fragment,
    }));
    fs.renameSync(tmp, file);
    return true;
  } catch (_) { return false; }
}

function throttleValidFragment(fragment) {
  try {
    require('../lib/sessionstart/contributor-interface.cjs').validateFragment(fragment);
    return true;
  } catch (_) { return false; }
}

// 'acquired', 'locked' (a live lock exists) or 'error'.
function throttleTakeLock(lock) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lock, 'wx');
      try { fs.writeSync(fd, process.pid + ' ' + new Date().toISOString() + '\n'); } finally { fs.closeSync(fd); }
      return 'acquired';
    } catch (e) {
      if (!e || e.code !== 'EEXIST') return 'error';
      let ageMs;
      try { ageMs = Date.now() - fs.statSync(lock).mtimeMs; } catch (_) { continue; }
      if (ageMs <= THROTTLE_LOCK_STALE_MS) return 'locked';
      try { fs.unlinkSync(lock); } catch (_) { /* a peer removed it */ }
    }
  }
  return 'locked';
}

// Starts the detached refresh child. Returns the telemetry mode.
function throttleStartRefresh(id) {
  const lock = throttleStampPath(id) + '.lock';
  try { fs.mkdirSync(path.dirname(lock), { recursive: true }); } catch (_) { return 'stale-lock-error'; }
  const got = throttleTakeLock(lock);
  if (got === 'locked') return 'stale-locked';
  if (got !== 'acquired') return 'stale-lock-error';
  try {
    const child = spawn(process.execPath, [__filename, '--refresh', id], {
      detached: true, stdio: 'ignore', windowsHide: true, env: process.env, cwd: process.cwd(),
    });
    child.on('error', () => {});
    child.unref();
    return 'stale-detached';
  } catch (_) {
    try { fs.unlinkSync(lock); } catch (_e) { /* gone */ }
    return 'stale-spawn-error';
  }
}

// throttled(id) -> a contributor function with the same contract as contribute().
function throttled(id) {
  return function throttledContribute() {
    let spec = null;
    try { spec = throttleSpec(id); } catch (_) { spec = null; }
    if (!spec || typeof spec.inner !== 'function') return { has_payload: false };
    const done = (mode, reason, fragment) => {
      throttleTelemetry({ id, mode, reason });
      return fragment;
    };
    try {
      const version = throttlePluginVersion();
      if (!version) return done('no-version', 'plugin.json unreadable', spec.inner());
      if (spec.gate && !spec.gate()) return done('gate-off', 'gate closed', spec.inner());
      const st = throttleReadStamp(throttleStampPath(id));
      if (st.absent) {
        const fragment = spec.inner();
        if (throttleValidFragment(fragment)) throttleWriteStamp(id, version, fragment);
        return done('first-sync', 'no stamp', fragment);
      }
      const s = st.obj;
      let reason = 'ok';
      let onlyAge = false;
      if (!s) reason = 'stamp-unreadable';
      else if (s.plugin_version !== version) reason = 'version';
      else if (spec.keyCwd && s.cwd !== process.cwd()) reason = 'cwd';
      else if (!throttleValidFragment(s.fragment)) reason = 'fragment';
      else if (typeof s.ran_at_ms !== 'number' || !Number.isFinite(s.ran_at_ms)) reason = 'stamp-shape';
      else {
        const ageMs = Date.now() - s.ran_at_ms;
        if (ageMs >= 0 && ageMs < THROTTLE_WINDOW_MS) return done('fresh', 'age_ms=' + ageMs, s.fragment);
        reason = 'age';
        onlyAge = ageMs >= THROTTLE_WINDOW_MS;
      }
      const mode = throttleStartRefresh(id);
      return done(mode, reason, onlyAge ? s.fragment : { has_payload: false });
    } catch (_) {
      throttleTelemetry({ id, mode: 'error-fallback', reason: 'throttle threw' });
      try { return spec.inner(); } catch (_e) { return { has_payload: false }; }
    }
  };
}

// The detached child: `node preflight-doctor.cjs --refresh <id>`. Runs the
// inner contributor once, writes the stamp, removes the lock, exits 0.
function runRefresh(id) {
  const started = Date.now();
  try {
    const spec = throttleSpec(id);
    const version = throttlePluginVersion();
    if (spec && typeof spec.inner === 'function' && version) {
      const fragment = spec.inner();
      const wrote = throttleValidFragment(fragment) && throttleWriteStamp(id, version, fragment);
      throttleTelemetry({ id, mode: 'refresh-done', reason: wrote ? 'stamp-written' : 'no-stamp', elapsed_ms: Date.now() - started });
    }
  } catch (_) {
    throttleTelemetry({ id, mode: 'refresh-done', reason: 'threw', elapsed_ms: Date.now() - started });
  } finally {
    try { fs.unlinkSync(throttleStampPath(id) + '.lock'); } catch (_) { /* gone */ }
  }
  process.exit(0);
}

module.exports = { contribute, throttled };

if (require.main === module) { if (process.argv[2] === '--refresh') runRefresh(process.argv[3]); else main(); }
