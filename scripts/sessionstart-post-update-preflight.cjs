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
 *   2. (Phase 341 D-07a) the version-change verification, added by the later
 *      tasks of plan 341-08.
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
const { spawnSync } = require('node:child_process');

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const MINDRIAN_DIR = path.join(HOME, '.mindrian');

// Part 7 (F8 stale-registry self-detector) constants.
const INSTALLED_PLUGINS_JSON = path.join(HOME, '.claude', 'plugins', 'installed_plugins.json');
const PLUGIN_KEY = 'mos@mindrian-marketplace';

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

  // Nothing to say: the common path on every ordinary session.
  return emitEmpty();
}

main();
