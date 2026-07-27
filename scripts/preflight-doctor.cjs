#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.2-01 (D-08, DOCTOR-95.2-06) -- SessionStart preflight: warn on missing/drifted install.
 *
 * Per Finding C: parallel CJS hook script (NOT editing scripts/session-start Bash).
 * Per Finding B: hookSpecificOutput.systemMessage carries user-visible warning;
 *                hookSpecificOutput.additionalContext gives Claude context for follow-up help.
 *
 * Behavior:
 *   1. spawnSync `node scripts/doctor.cjs --json` with 1500ms timeout.
 *   2. Parse JSON. If parse fails or doctor errored, emit empty envelope (graceful no-op).
 *   3. If drift.detected === true OR install.status === 'missing': emit envelope with
 *      hookSpecificOutput.systemMessage = formatPreflightWarning(...) and
 *      hookSpecificOutput.additionalContext = brief Claude-facing note pointing at /mos:doctor.
 *   4. Otherwise: emit empty envelope (zero noise on healthy installs).
 *
 * Defensive rules (NEVER blocks the hook chain):
 *   - timeout 1500ms on subprocess; overall budget < 2000ms (the hook timeout in hooks.json).
 *   - uncaughtException -> emit empty envelope.
 *   - Any internal error -> emit empty envelope.
 *
 * Canon Part 8: zero network surface. Reads only LOCAL files via doctor.cjs subprocess.
 * Three-surface awareness: SessionStart hooks fire on Claude Code CLI; on Desktop and
 * Cowork the warning surfaces only when the user runs /mos:doctor manually.
 */

const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

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

function loadFormatter() {
  try {
    return require(path.join(__dirname, 'doctor-preflight-format.cjs'));
  } catch (_) { return null; }
}

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

function shouldUseColor(formatter) {
  if (formatter && typeof formatter.shouldUseColor === 'function') {
    return formatter.shouldUseColor();
  }
  if (process.env.MOS_NO_COLOR === '1') return false;
  if (process.env.NO_COLOR) return false;
  return process.stderr.isTTY === true;
}

function additionalContextNote(report) {
  const what = (report && report.install && report.install.status === 'missing') ? 'missing' : 'drifted';
  return [
    'MindrianOS install-cache preflight: install dir is ' + what + '.',
    'The user has been shown a one-line warning. Recovery path: /mos:doctor --fix.',
    'If the user asks why or what happened, reference Phase 95.2 atomic-swap recovery and the autopsy at',
    'docs/autopsies/2026-05-06-install-dir-missing-incident.md (when present).',
  ].join(' ');
}

function main() {
  const formatter = loadFormatter();
  if (!formatter) return emitEmpty();
  const report = runDoctor();
  if (!report) return emitEmpty();
  const drift = report.drift || {};
  // Suppression: only fire on drift detected (covers both legacy drift and missing-install case).
  if (!drift.detected) return emitEmpty();
  const pluginHome = process.env.MINDRIAN_PLUGIN_HOME || path.join(os.homedir(), '.claude/plugins');
  const warning = formatter.formatPreflightWarning(report, {
    color: shouldUseColor(formatter),
    pluginHome,
  });
  if (!warning) return emitEmpty();
  // Strip trailing newline to keep the envelope clean (Claude renders systemMessage as a single line).
  const systemMessage = warning.replace(/\n+$/, '');
  emitEnvelope({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      systemMessage,
      additionalContext: additionalContextNote(report),
    },
  });
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

    const drift = report.drift || {};
    if (!drift.detected && !releaseDriftLine && !graphLine) return fi.emptyFragment();

    const formatter = loadFormatter();
    let warning = '';
    if (drift.detected && formatter) {
      const pluginHome = process.env.MINDRIAN_PLUGIN_HOME
        || path.join(os.homedir(), '.claude/plugins');
      warning = formatter.formatPreflightWarning(report, {
        color: false, // Coordinator emits plain text into additionalContext.
        pluginHome,
      }) || '';
    }
    const pieces = [];
    if (warning) pieces.push(warning.replace(/\n+$/, ''));
    if (releaseDriftLine) pieces.push(releaseDriftLine);
    // Third piece, appended to the SAME array (never replacing the existing
    // composition): the Phase 233 graph re-derive nudge.
    if (graphLine) pieces.push(graphLine);
    const fullPayload = pieces.join('\n');
    if (!fullPayload) return fi.emptyFragment();

    // The pointer names whichever finding is actually present. When the ONLY
    // finding is the graph nudge, claiming an install drift would be a false
    // report -- the exact false-success class this phase exists to close.
    const what = (report.install && report.install.status === 'missing') ? 'missing' : 'drifted';
    const pointer = (!drift.detected && !releaseDriftLine && graphLine)
      ? 'Your Data Room graph needs a re-derive -- run /mos:doctor --heal-room.'
      : 'MindrianOS install ' + what + ' -- run /mos:doctor --fix.';
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

module.exports = { contribute };

if (require.main === module) main();
