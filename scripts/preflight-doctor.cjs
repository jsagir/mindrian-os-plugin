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

function runDoctor() {
  const doctorPath = path.join(__dirname, 'doctor.cjs');
  const env = Object.assign({}, process.env);
  // Keep MOS_NO_COLOR / NO_COLOR if set; doctor.cjs respects them too.
  const res = spawnSync('node', [doctorPath, '--json'], {
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

main();
