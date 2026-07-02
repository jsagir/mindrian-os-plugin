#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 106 Plan 05 -- statusline onboarding gate (D-05 / STATUS-106-05).
 *
 * SessionStart hook script. Fires once per fresh install (no touch-file)
 * and once per upgrade (touch-file installed_version mismatch). On fire,
 * surfaces a tester-facing additionalContext gate asking the tester to
 * confirm they see the branded statusline at the bottom of their terminal.
 *
 * Touch-file: ~/.mindrian/onboarding/statusline-onboarded.json
 * Shape: { "installed_version": "<plugin.json version>", "completed_at": "<ISO>" }
 *
 * The script does NOT write the touch-file. Touch-file creation is the
 * job of /mos:doctor --statusline-visibility --json reporting ok (Plan
 * 106-03 class G) plus an explicit user confirmation flow (out of scope
 * for this plan; tracked for v1.13.x). For 106-05 the gate's job is to
 * SURFACE the question; closing the loop is a follow-up.
 *
 * Defensive: NEVER blocks the hook chain. On any internal error emits
 * {continue: true} and exits 0. uncaughtException handler ensures even
 * a require() failure cannot throw an unhandled error.
 *
 * Pure CJS, node built-ins only, zero npm deps (Phase 87 invariant).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// Phase 95.6 D-09: the plugin install dir, used to locate scripts/doctor.cjs
// for the first-session self-check. Matches how readPluginVersion() below
// resolves plugin.json (path.resolve(__dirname, '..')).
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');

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
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}
function emitEmpty() { emitEnvelope({ continue: true }); }

process.on('uncaughtException', () => emitEmpty());

function safeRead(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_e) { return null; }
}
function safeJson(file) {
  const t = safeRead(file);
  if (t === null) return null;
  try { return JSON.parse(t); } catch (_e) { return null; }
}
function readPluginVersion() {
  const here = path.resolve(__dirname, '..', '.claude-plugin', 'plugin.json');
  const j = safeJson(here);
  return (j && j.version) ? j.version : null;
}
function touchFilePath() {
  return path.join(os.homedir(), '.mindrian', 'onboarding', 'statusline-onboarded.json');
}

function shouldFire() {
  const ver = readPluginVersion();
  if (!ver) return false; // Cannot read plugin.json -> graceful no-op (do NOT spam)
  const tf = safeJson(touchFilePath());
  if (!tf) return true; // No touch-file -> first session, fire
  if (tf.installed_version !== ver) return true; // Version bump -> re-fire
  return false; // Same version, already onboarded -> skip
}

// Phase 95.6 D-09: on a fresh first session, run /mos:doctor --all --json and
// return a one-line all-green-or-here-is-what-is-missing summary, so a silently
// incomplete install gets caught and named instead of staying quiet. Canon
// Part 8: doctor.cjs is purely LOCAL (no network surface -- preflight-doctor.cjs
// already spawns it). Defensive: on ANY error (doctor missing, timeout, JSON
// parse failure) return '' and the gate is unchanged -- never blocks the hook.
function runDoctorSelfCheck() {
  try {
    const doctorPath = path.join(PLUGIN_ROOT, 'scripts', 'doctor.cjs');
    if (!fs.existsSync(doctorPath)) return '';
    const r = spawnSync(process.execPath, [doctorPath, '--all', '--json'], {
      timeout: 1500,
      encoding: 'utf8',
    });
    if (!r || !r.stdout) return '';
    const report = JSON.parse(r.stdout);
    const checks = (report && report.checks) ? Object.values(report.checks) : [];
    const bad = checks.filter((c) => c && c.status && c.status !== 'ok' && c.status !== 'skip');
    if (bad.length === 0) return 'MindrianOS install check: all green.';
    return 'MindrianOS install check: ' + bad.length
      + ' item(s) need attention. Run /mos:doctor --fix to resolve, or /mos:doctor --all for details.';
  } catch (_e) {
    return '';
  }
}

// F6 self-heal (windows-install-update-ux.md). Auto-run the shipped repair
// pipeline: `node <PLUGIN_ROOT>/scripts/doctor.cjs --statusline-visibility --fix
// --json`. Canon Part 7 (reuse before build): doctor.cjs already implements the
// class G (user-settings drift) + class H (install-incomplete: missing statusLine
// block) detect+repair, so we do NOT reimplement the settings.json rewrite here.
//
// Exit code is NOT trusted: under class flags doctor honors the graceful-
// degradation invariant and ALWAYS exits 0 (doctor.cjs _finalizeAndExit,
// classFlagsActive branch). Health is read from the JSON check statuses instead:
// resolved iff BOTH statusline-visibility (class G) AND install-incomplete
// (class H) re-check to status 'ok' after --fix.
//
// Defensive: guarded by a timeout + try/catch. On doctor missing / spawn error /
// no output / parse error / still-drift, returns { resolved:false } so the caller
// degrades to the surface-the-question fallback -- never crashes, never blocks.
function attemptStatuslineSelfHeal() {
  try {
    const doctorPath = path.join(PLUGIN_ROOT, 'scripts', 'doctor.cjs');
    if (!fs.existsSync(doctorPath)) return { resolved: false, reason: 'doctor-missing' };
    const r = spawnSync(process.execPath,
      [doctorPath, '--statusline-visibility', '--fix', '--json'],
      { timeout: 4000, encoding: 'utf8' });
    if (!r || typeof r.stdout !== 'string' || r.stdout.length === 0) {
      return { resolved: false, reason: 'no-output' };
    }
    let report;
    try { report = JSON.parse(r.stdout); } catch (_e) { return { resolved: false, reason: 'parse-error' }; }
    const checks = (report && report.checks) || {};
    const g = checks['statusline-visibility'];
    const h = checks['install-incomplete'];
    const gOk = !!(g && g.status === 'ok');
    const hOk = !!(h && h.status === 'ok');
    if (gOk && hOk) return { resolved: true, reason: 'repaired' };
    return { resolved: false, reason: 'still-drift' };
  } catch (_e) {
    return { resolved: false, reason: 'spawn-error' };
  }
}

// Write the touch-file so the gate stops firing for this version. Same shape the
// gate has always documented: { installed_version, completed_at }. Best-effort:
// a write failure returns false and the caller still degrades safely (the gate
// simply re-fires next session -- never blocks the hook chain).
function writeTouchFile(ver) {
  try {
    const p = touchFilePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({
      installed_version: ver,
      completed_at: new Date().toISOString(),
    }, null, 2));
    return true;
  } catch (_e) {
    return false;
  }
}

function gateText(ver) {
  return [
    '⬡ MindrianOS v' + ver + ' is active. First-session check:',
    '',
    'Look at the bottom of your terminal. Do you see a line starting with',
    '⬡ MindrianOS-Plugin and showing your room name + context percent?',
    '',
    '  ✓ Yes, I see it  -> Run: /mos:doctor --statusline-visibility',
    '    (records the touch-file so this gate stops firing)',
    '  No, I do not see it -> Run: /mos:doctor --fix',
    '    (auto-repairs stale ~/.claude/settings.json overrides)',
    '',
    'On Claude Desktop or Cowork the statusline does not exist; the',
    'one-line state echo above is the visibility surface there instead.',
  ].join('\n');
}

// ----- Phase 121.5-00 contributor surface -----
// Split the legacy gate into two contributors:
//   - contributeSealed()     -- priority 2 (blocking guardrail). Fires only when
//                               a sealed-room sentinel is detected (a sealed room
//                               opts out of all hooks; the guardrail tells the user
//                               and Larry that this room is sealed so no automation
//                               should run).
//   - contributeOnboarding() -- priority 6 (novelty). The legacy first-session +
//                               version-bump gate text -- only fires when shouldFire().
//
// Both are no-throw; both return emptyFragment() when the trigger is absent.

// Phase 127.3 Plan 03 Task 5: detectSealedRoom semantic is INVERSE of the
// chokepoint (lib/core/resolve-active-room.cjs) -- this function wants to
// detect WHEN the nominal active room IS sealed, while the chokepoint
// FILTERS sealed rooms out. The chokepoint API is not a drop-in replacement
// here. Before this refactor, the function carried a legacy-only registry
// walk that silently rejected the current registry shape (Object rooms);
// since `reg.active` was undefined on current-shape registries, the function
// always returned null and the sealed-room banner never fired regardless of
// reality. The fix is shape-tolerant local-read with the broken-pattern
// tokens (legacy-only field name + legacy-only array assumption) eliminated.
// Cannot consolidate to the chokepoint without extending its API (forbidden
// by Plan 00 byte-stable contract); cannot allow-list this file in the
// tripwire without leaving a live broken pattern behind. Pre-flight 121.5
// scope-guard verified clear via affirmative
// `grep check-onboard-statusline .planning/phases/121.5-*/121.5-CONTEXT.md`
// (W-06 affirmative form; 0 matches). Phase 129 will absorb this onto a
// future `findEntry(slug)` helper on the chokepoint when iterateRegisteredRooms ships.
function detectSealedRoom() {
  try {
    const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    let reg;
    try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); }
    catch (_) { return null; }
    if (!reg) return null;
    // Shape-tolerant active-slug resolution: current shape `active` first,
    // legacy shape next. Mirrors the chokepoint's branch logic without
    // sharing the sealed-filter (we want sealed-yes, not sealed-no).
    const slug = (typeof reg.active === 'string' && reg.active.length > 0)
      ? reg.active
      : (typeof reg.active_room === 'string' && reg.active_room.length > 0)
      ? reg.active_room
      : null;
    if (!slug) return null;
    // Shape-tolerant entry lookup: current shape (Object rooms keyed by slug)
    // first, legacy shape (Array of {slug, ...}) next.
    let room = null;
    const roomsBag = reg.rooms;
    if (roomsBag && typeof roomsBag === 'object' && !Array.isArray(roomsBag)) {
      room = roomsBag[slug] || null;
      // Object-shape entries don't carry the slug field by default; inject
      // so downstream `room.slug` references in contributeSealed work.
      if (room && typeof room.slug !== 'string') room = Object.assign({ slug: slug }, room);
    } else if (Array.isArray(roomsBag)) {
      room = roomsBag.find(function (r) { return r && (r.slug === slug || r.name === slug); }) || null;
    }
    if (!room) return null;
    if (room.sealed === true) return room;
    if (room.status === 'sealed') return room;
    return null;
  } catch (_) {
    return null;
  }
}

function contributeSealed() {
  let fi;
  try { fi = require('../lib/sessionstart/contributor-interface.cjs'); }
  catch (_) { return { has_payload: false }; }
  try {
    const sealed = detectSealedRoom();
    if (!sealed) return fi.emptyFragment();
    const slug = sealed.slug || 'unknown';
    const full = 'Room is sealed: ' + slug
      + '. All automation (hooks, derivations, MVA, brain) is disabled for this room.'
      + ' To resume normal operation, unseal via /mos:room ' + slug + ' --unseal.';
    const pointer = 'Room sealed: ' + slug + ' -- /mos:room unseal to resume.';
    return fi.makeFragment({
      id: 'sealed-room',
      priority: 2,
      full_payload: full,
      one_line_pointer: pointer,
    });
  } catch (_) {
    return fi.emptyFragment();
  }
}

function contributeOnboarding() {
  let fi;
  try { fi = require('../lib/sessionstart/contributor-interface.cjs'); }
  catch (_) { return { has_payload: false }; }
  try {
    if (!shouldFire()) return fi.emptyFragment();
    const ver = readPluginVersion();
    // F6 self-heal: attempt the shipped repair FIRST. If it resolves, record the
    // touch-file and stay silent (loop closed). Only surface the manual question
    // when the auto-fix could NOT resolve (doctor missing / errored / still drift).
    const heal = attemptStatuslineSelfHeal();
    if (heal.resolved) {
      writeTouchFile(ver);
      return fi.emptyFragment();
    }
    let full = gateText(ver);
    const doctorLine = runDoctorSelfCheck();
    if (doctorLine) full = full + '\n\n' + doctorLine;
    const pointer = 'First-session check pending -- /mos:doctor --statusline-visibility to record.';
    return fi.makeFragment({
      id: 'onboarding',
      priority: 6,
      full_payload: full,
      one_line_pointer: pointer,
    });
  } catch (_) {
    return fi.emptyFragment();
  }
}

module.exports = {
  contributeSealed,
  contributeOnboarding,
  attemptStatuslineSelfHeal,
  writeTouchFile,
  touchFilePath,
  shouldFire,
};

// Legacy bare-hook path -- preserved for backward compat, but hooks.json no longer
// routes here; the coordinator calls contributeSealed/contributeOnboarding instead.
if (require.main === module) {
  let input = '';
  const inputTimeout = setTimeout(() => done(), 500);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { input += c; });
  process.stdin.on('end', () => done());
  process.stdin.on('error', () => done());

  function done() {
    clearTimeout(inputTimeout);
    if (!shouldFire()) return emitEmpty();
    const ver = readPluginVersion();
    // F6 self-heal: run the shipped repair FIRST; on success record the touch-file
    // and stay silent. Only surface the manual question when it could not resolve.
    const heal = attemptStatuslineSelfHeal();
    if (heal.resolved) {
      writeTouchFile(ver);
      return emitEmpty();
    }
    let additionalContext = gateText(ver);
    // Phase 95.6 D-09: append the /mos:doctor self-check line (best-effort).
    const doctorLine = runDoctorSelfCheck();
    if (doctorLine) additionalContext = additionalContext + '\n\n' + doctorLine;
    emitEnvelope({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext,
      },
    });
  }
}
