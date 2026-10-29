#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 127.2 Plan 04 -- Instance #7 (SessionStart preflight gate), CONVERTED in
 * Phase 341 plan 08 (D-07, D-07a). "Preflight" in the filename is historical.
 *
 * Sibling of (NOT replacement for) scripts/sessionstart-npm-reconcile.cjs.
 * That hook reconciles plugin node_modules against package-lock.json so MCP
 * servers boot with all deps present. THIS hook answers two different
 * questions, both cheap and both strictly non-blocking:
 *
 *   1. (Part 7 F8, added 2026-07-02) Did an update land UNDER this running
 *      session? `claude plugin update` swaps installPath under a RUNNING session,
 *      but the slash-command registry is built once at session start, so
 *      `/mos:help` reads "Unknown command" until restart.
 *      detectStaleRegistry() compares the version THIS session loaded from
 *      (CLAUDE_PLUGIN_ROOT plugin.json / installPath basename) against
 *      installed_plugins.json's registered version for mos@mindrian-marketplace.
 *      On a mismatch it surfaces a restart cue (systemMessage banner +
 *      additionalContext). Two JSON reads, no Brain probe.
 *
 *   2. (Phase 341 D-07a) the version-change verification. The trigger is a
 *      VERSION CHANGE: installed_plugins.json's registered version against the
 *      last-seen marker in lib/core/session-verify-state.cjs. The loader writes
 *      installed_plugins.json, so it cannot forget to set the signal, and a fresh
 *      install with no marker counts as changed. On a change, ONCE per version:
 *        a. run the bounded OFFLINE doctor tier (doctor --acceptance
 *           --session-start --json) under SESSION_VERIFY_BUDGET_MS;
 *        b. record the result through mergeVerifyState (never a raw overwrite: the
 *           same file carries the navigator's Eureka opt-in answer);
 *        c. fire scripts/session-verify-probe.cjs DETACHED and unref-ed, which
 *           checks the wire and Theo and prepares one insight, so session start
 *           never blocks on the network;
 *        d. emit ONE envelope with the verification line for Larry to open with.
 *      The result has three honest states: passed, failed with N named points,
 *      or inconclusive with the reason. Inconclusive is never coerced to a pass
 *      or a failure. Writing last_seen_version on EVERY outcome, inconclusive
 *      included, is deliberate: a machine that cannot verify does not re-spend the
 *      budget every session.
 *
 * FAIL-OPEN CONTRACT (stated, per the plan): a broken verification NEVER blocks
 * a session. Every path emits continue:true and exits 0, a timeout writes an
 * inconclusive result, and the uncaughtException handler is the last-resort net.
 *
 * Phase 341 retired the post-update touch-file mechanism and the drift path
 * that used to refuse Larry-load. That path could not tell a drifted version
 * from an unreachable Brain, so it blocked a session on ambiguity. This hook
 * now NEVER blocks: every path emits continue:true and exits 0.
 *
 * Registered in hooks/hooks.json as a SessionStart hook, ordered AFTER the
 * existing sessionstart-npm-reconcile.
 *
 * Canon discipline:
 *   - Part 8: pure LOCAL. No Brain probe and no network on the inline path.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, spawn } = require('node:child_process');

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();

// Part 7 (F8 stale-registry self-detector) constants.
const INSTALLED_PLUGINS_JSON = path.join(HOME, '.claude', 'plugins', 'installed_plugins.json');
const PLUGIN_KEY = 'mos@mindrian-marketplace';

// Phase 341 D-07a: the inline offline verification budget, with its provenance.
// The hooks.json entry allows 12000 ms. Plan 341-08 task 4 MEASURED the
// session-start doctor tier (four points) at 190 to 240 ms warm on 2026-10-29.
//   measured 240 ms x 1.25 = 300 ms, rounded up to the nearest 500 = 500 ms.
// 500 ms is below what a cold disk or a slow antivirus scan can need just to load
// doctor.cjs, and a budget that is too small turns EVERY verification into
// "inconclusive", so the constant carries a documented floor of 5000 ms. It is
// capped at 10000 ms so the hook keeps at least 2000 ms of headroom for its own
// two JSON reads and the detached spawn. The hooks.json timeout is NOT raised and
// the point set is NOT shrunk; if a machine cannot finish in this budget the
// honest outcome is an inconclusive result.
const MEASURED_TIER_MS = 240;
const BUDGET_FROM_MEASUREMENT_MS = Math.ceil((MEASURED_TIER_MS * 1.25) / 500) * 500;
const SESSION_VERIFY_BUDGET_MS = Math.min(10000, Math.max(5000, BUDGET_FROM_MEASUREMENT_MS));

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

function emitEnvelope(obj, exitCode) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined) filtered.continue = exitCode === 0;
  try { process.stdout.write(JSON.stringify(filtered)); } catch (_) {}
  process.exit(typeof exitCode === 'number' ? exitCode : 0);
}

function emitEmpty() { emitEnvelope({ continue: true }, 0); }

process.on('uncaughtException', () => emitEmpty());

// Color helpers (only when stderr is a TTY, NO_COLOR not set).
const useColor = process.env.MOS_NO_COLOR !== '1' && !process.env.NO_COLOR && process.stderr.isTTY === true;
const C = useColor
  ? { reset: '\x1b[0m', red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m' }
  : { reset: '', red: '', yellow: '', dim: '', bold: '' };

// -- Part 7: F8 stale-registry self-detector ------------------------------
// After `claude plugin update` swaps installPath under a RUNNING session, the
// in-memory slash-command registry (built once at session start) goes stale.
// This detector is CHEAP + LOCAL (two JSON reads, no Brain probe) and strictly
// NON-BLOCKING: it compares the version THIS session loaded from against the
// registry's current version and, on a mismatch, surfaces a restart cue.

// Parse the trailing version segment out of a plugin install path such as
// .../mindrian-marketplace/mos/<version>[/].
function versionFromInstallPath(p) {
  const m = String(p || '').match(/[\\/]mos[\\/]([^\\/]+)[\\/]?$/);
  return m ? m[1] : null;
}

// The version THIS session actually loaded from. Prefer the plugin.json /
// package.json version at CLAUDE_PLUGIN_ROOT (truth of the loaded bytes); fall
// back to the version segment of the CLAUDE_PLUGIN_ROOT path itself.
function readSessionVersion() {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!root) return null;
  const candidates = [
    path.join(root, '.claude-plugin', 'plugin.json'),
    path.join(root, 'package.json'),
  ];
  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand)) {
        const v = JSON.parse(fs.readFileSync(cand, 'utf8')).version;
        if (v) return String(v);
      }
    } catch (_) { /* try next */ }
  }
  return versionFromInstallPath(root);
}

// The version the registry currently points at for mos@mindrian-marketplace.
function readRegisteredVersion() {
  try {
    if (!fs.existsSync(INSTALLED_PLUGINS_JSON)) return null;
    const j = JSON.parse(fs.readFileSync(INSTALLED_PLUGINS_JSON, 'utf8'));
    const arr = j && j.plugins && j.plugins[PLUGIN_KEY];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const rec = arr[0];
    if (rec && rec.version) return String(rec.version);
    if (rec && rec.installPath) return versionFromInstallPath(rec.installPath);
    return null;
  } catch (_) { return null; }
}

// Returns { stale:true, sessionVersion, registeredVersion } when an update
// landed under this running session (session version != registered version).
// Returns null when in sync, either version is unknown, or on ANY error --
// so the caller falls through and NEVER blocks the hook chain.
function detectStaleRegistry() {
  try {
    const sessionVersion = readSessionVersion();
    const registeredVersion = readRegisteredVersion();
    if (!sessionVersion || !registeredVersion) return null;
    if (sessionVersion === registeredVersion) return null;
    return { stale: true, sessionVersion, registeredVersion };
  } catch (_) { return null; }
}

function formatStaleRegistryBanner(sessionVersion, registeredVersion) {
  const rule = '------------------------------------------------------------';
  const lines = [];
  lines.push('');
  lines.push(`${C.yellow}${rule}${C.reset}`);
  lines.push(`${C.yellow}${C.bold}⚠  RESTART THIS SESSION NOW${C.reset}`);
  lines.push(`${C.yellow}${rule}${C.reset}`);
  lines.push(`An update landed under this session (${sessionVersion} -> ${registeredVersion}).`);
  lines.push('Slash commands ( /mos:help, /mos:* ) may read as MISSING until you');
  lines.push('restart. This is EXPECTED. Nothing is broken.');
  lines.push('');
  lines.push('  -> Close and reopen the terminal, or kill and re-run `claude`');
  lines.push('  -> Then run /mos:help to confirm commands are reachable');
  lines.push(`${C.yellow}${rule}${C.reset}`);
  lines.push('');
  return lines.join('\n');
}

// -- Phase 341 D-07a: the version-change verification ---------------------

function pluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
}

function loadVersionState() {
  try { return require(path.join(__dirname, '..', 'lib', 'core', 'session-verify-state.cjs')); }
  catch (_) { return null; }
}

// Inline OFFLINE leg: the session-start doctor tier, bounded by
// SESSION_VERIFY_BUDGET_MS. Returns the `local` record for the state file.
// ok is true (passed), false (failed) or null (inconclusive). Never throws.
function runLocalVerification() {
  const doctor = path.join(pluginRoot(), 'scripts', 'doctor.cjs');
  if (!fs.existsSync(doctor)) {
    return { ok: null, ran: false, inconclusive_reason: 'doctor.cjs not found' };
  }
  const t0 = Date.now();
  let res;
  try {
    res = spawnSync(process.execPath, [doctor, '--acceptance', '--session-start', '--json'], {
      cwd: pluginRoot(),
      input: '',
      encoding: 'utf8',
      timeout: SESSION_VERIFY_BUDGET_MS,
      env: Object.assign({}, process.env, { MINDRIAN_ACCEPTANCE_PROGRESS: '0' }),
    });
  } catch (e) {
    return { ok: null, ran: false, inconclusive_reason: 'spawn threw: ' + String(e && e.message).slice(0, 120) };
  }
  const elapsed = Date.now() - t0;
  if (!res || res.error) {
    const code = res && res.error && res.error.code;
    const why = code === 'ETIMEDOUT'
      ? 'timed out after ' + SESSION_VERIFY_BUDGET_MS + ' ms'
      : 'spawn failed: ' + String(res && res.error && res.error.message).slice(0, 120);
    return { ok: null, ran: false, elapsed_ms: elapsed, inconclusive_reason: why };
  }
  if (res.signal) {
    return { ok: null, ran: false, elapsed_ms: elapsed, inconclusive_reason: 'doctor ended by signal ' + res.signal };
  }
  let j = null;
  try {
    const out = String(res.stdout || '');
    j = JSON.parse(out.slice(out.indexOf('{')));
  } catch (_) { j = null; }
  if (!j || !Array.isArray(j.points) || !j.summary || (res.status !== 0 && res.status !== 1)) {
    return { ok: null, ran: false, elapsed_ms: elapsed, inconclusive_reason: 'doctor output not usable (exit ' + res.status + ')' };
  }
  const failedPoints = Array.isArray(j.failed_points) ? j.failed_points.map(String) : [];
  const failedCount = typeof j.summary.failed === 'number' ? j.summary.failed : failedPoints.length;
  return {
    ok: res.status === 0 && failedCount === 0,
    ran: true,
    failed_count: failedCount,
    failed_points: failedPoints,
    total: typeof j.summary.total === 'number' ? j.summary.total : j.points.length,
    mode: String(j.mode || 'session-start'),
    elapsed_ms: elapsed,
  };
}

// The detached Theo probe. Fired after the local set, never awaited, unref-ed
// (the Phase 267.2 _fireReward shape). A throw here degrades to no probe, never to
// a failed session start. MOS_SESSION_VERIFY_NO_PROBE=1 is the test seam that
// keeps hook tests deterministic (the probe would otherwise overwrite `wire`).
function fireProbe() {
  try {
    if (process.env.MOS_SESSION_VERIFY_NO_PROBE === '1') return false;
    const probe = path.join(__dirname, 'session-verify-probe.cjs');
    if (!fs.existsSync(probe)) return false;
    const child = spawn(process.execPath, [probe], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: process.env,
    });
    child.unref();
    return true;
  } catch (_) { return false; }
}

// Three states, three honest sentences. A pass is quiet; colour is for the
// failed form only.
function formatVerifyLine(label, local) {
  const tail = ' The Theo check is still running.';
  if (local.ok === true) {
    const n = typeof local.total === 'number' ? local.total : 0;
    return 'MindrianOS ' + label + ' checked itself after the update: ' + n + ' of ' + n + ' local checks passed.' + tail;
  }
  if (local.ok === false) {
    const names = (local.failed_points || []).slice(0, 4).join(', ');
    const n = local.failed_count;
    return C.yellow + 'MindrianOS ' + label + ' checked itself after the update: ' + n + ' local check' + (n === 1 ? '' : 's') +
      ' need attention' + (names ? ' (' + names + ')' : '') + '.' + C.reset + ' Run /mos:doctor --fix.' + tail;
  }
  return 'MindrianOS ' + label + ' could not finish its self-check (' + (local.inconclusive_reason || 'reason unknown') +
    '). Nothing is blocked.' + tail;
}

function runVersionChangeVerification() {
  const vs = loadVersionState();
  if (!vs) return emitEmpty();
  const registered = readRegisteredVersion();
  const change = vs.detectVersionChange(registered);
  if (!change.changed) return emitEmpty();

  const local = runLocalVerification();
  vs.mergeVerifyState({
    schema: 'mos-session-verify/1',
    last_seen_version: registered,
    verified_at_ms: Date.now(),
    local: local,
    wire: 'pending',
    theo: 'pending',
    insight: { pending: false },
  });
  fireProbe();

  const label = vs.shortVersionLabel(registered) || String(registered);
  const line = formatVerifyLine(label, local);
  const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
  return emitEnvelope({
    continue: true,
    systemMessage: line,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'MindrianOS just checked itself because its version changed. Open your first reply with this one short line, in your own voice and in plain words, and add nothing else about it: "' + plain + '" Do not say Theo is reachable or unreachable until you are told.',
    },
  }, 0);
}

function main() {
  // Part 7 (F8 stale-registry self-detector). Runs FIRST, ahead of the
  // later version-change verification, because it is the cheaper + more
  // direct signal for "an update landed under this running session" and it
  // needs no Brain reachability. STRICTLY non-blocking: continue:true, exit 0
  // whether it fires or not. On a version mismatch it surfaces the restart
  // cue (systemMessage banner + additionalContext for Larry) and returns.
  const staleCue = detectStaleRegistry();
  if (staleCue) {
    const banner = formatStaleRegistryBanner(staleCue.sessionVersion, staleCue.registeredVersion);
    return emitEnvelope({
      continue: true,
      systemMessage: banner,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: 'An update landed under this session (' + staleCue.sessionVersion + ' -> ' + staleCue.registeredVersion + '). Commands may be stale - restart this session to reactivate. Surface this to the navigator plainly: the slash-command registry is built once at session start and does not see the swapped install until a restart. This is expected, nothing is broken.',
      },
    }, 0);
  }

  // Phase 341 D-07a: the version-change verification. The common path (no change)
  // costs two JSON reads and emits an empty envelope.
  return runVersionChangeVerification();
}

main();
