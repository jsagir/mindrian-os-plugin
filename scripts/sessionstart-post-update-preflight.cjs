#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 127.2 Plan 04 -- Instance #7 (SessionStart preflight gate).
 *
 * Sibling of (NOT replacement for) scripts/sessionstart-npm-reconcile.cjs.
 * That hook reconciles plugin node_modules against package-lock.json so MCP
 * servers boot with all deps present. THIS hook closes a different gap:
 * after `/mos:update` lands new bytes in the cache + doctor --fix swaps
 * them in, we set a touch-file at ~/.mindrian/post-update-restart-pending.
 * On the NEXT session, this preflight reads the touch-file + verifies that
 * the now-live MCP server actually serves the new version. If the wire
 * disagrees with the version-of-record (package.json), we refuse Larry load
 * with a red banner that points at the recovery path.
 *
 * Part 7 (F8, added 2026-07-02): a SECOND, cheaper self-detector runs first.
 * `claude plugin update` swaps installPath under a RUNNING session, but the
 * slash-command registry is built once at session start, so `/mos:help` reads
 * "Unknown command" until restart (the strongest driver of "update did not go
 * smooth"). detectStaleRegistry() compares the version THIS session loaded
 * from (CLAUDE_PLUGIN_ROOT plugin.json / installPath basename) against
 * installed_plugins.json's registered version for mos@mindrian-marketplace.
 * On a mismatch it surfaces a restart cue (systemMessage banner +
 * additionalContext). It NEVER blocks the chain (continue:true, exit 0) on any
 * outcome or error -- two JSON reads, no Brain probe.
 *
 * Registered in hooks/hooks.json as a SessionStart hook, ordered AFTER the
 * existing sessionstart-npm-reconcile (so node_modules is in place before
 * we spawn doctor.cjs --brain-smoke) but BEFORE Larry-load (so a drift
 * blocks the room from coming up against the wrong MCP server).
 *
 * Canon discipline:
 *   - Part 8: pure LOCAL. spawnSync of node scripts/doctor.cjs --brain-smoke
 *     --json reads only LOCAL files + the stdio MCP shim (the shim itself
 *     goes over HTTP to the origin resolved by getBrainUrl()
 *     (lib/core/brain-client.cjs; named via the resolver rather than a
 *     host as of phase 339, 2026-09-03) but THIS preflight does not -- the
 *     shim is just a method of probing version-of-the-wire).
 *   - Part 7 (Reuse Before Build): does not re-implement version probing;
 *     delegates to doctor --brain-smoke (Class M, Phase 127-02).
 *
 * Defensive rules (NEVER blocks the hook chain on internal error):
 *   - Touch-file absent  -> exit 0 silently (the common path on every
 *                            session that did not just run /mos:update).
 *   - doctor probe fails -> exit 0 silently with a stderr note (cannot
 *                            distinguish "Brain unreachable" from "version
 *                            actually drifted"; do not surface either as
 *                            blocking when we are not certain).
 *   - Version match      -> delete touch-file, exit 0 silently. Done.
 *   - Version drift      -> print red banner via SessionStart envelope
 *                            (systemMessage), exit 1 to block downstream
 *                            hooks per the plan's specification.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const MINDRIAN_DIR = path.join(HOME, '.mindrian');
const TOUCH_FILE = path.join(MINDRIAN_DIR, 'post-update-restart-pending');

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

function readPackageJsonVersion() {
  // package.json lives at the plugin root (same dir tree as this script).
  // CLAUDE_PLUGIN_ROOT is set in hook context; fall back to ../ from
  // __dirname when invoked directly (tests).
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  const candidates = [
    path.join(pluginRoot, 'package.json'),
    path.join(pluginRoot, '.claude-plugin', 'plugin.json'),
  ];
  for (const cand of candidates) {
    if (!fs.existsSync(cand)) continue;
    try {
      const v = JSON.parse(fs.readFileSync(cand, 'utf8')).version;
      if (v) return v;
    } catch (_) { /* try next */ }
  }
  return null;
}

function probeBrainSmokeVersion() {
  // doctor --brain-smoke L4 layer reason line carries:
  //   "handshake succeeded, server=mindrian-brain v<VERSION>"
  // Phase 127-02 (lib/core/doctor/class-m-brain-smoke.cjs line 163).
  const doctorPath = path.join(__dirname, 'doctor.cjs');
  if (!fs.existsSync(doctorPath)) return { ok: false, reason: 'doctor.cjs not found' };
  const env = Object.assign({}, process.env);
  const res = spawnSync('node', [doctorPath, '--brain-smoke', '--json'], {
    encoding: 'utf8',
    timeout: 10000,
    env,
  });
  if (!res || typeof res.stdout !== 'string') return { ok: false, reason: 'spawn failed' };
  let payload = null;
  try { payload = JSON.parse(res.stdout); } catch (_) { return { ok: false, reason: 'json parse failed' }; }
  if (!payload || !Array.isArray(payload.layers)) {
    return { ok: false, reason: 'invalid brain-smoke payload shape' };
  }
  // Find the L4 (mcp_stdio_handshake) layer.
  const L4 = payload.layers.find(l => l && (l.id === 'mcp_stdio_handshake' || l.name === 'L4 MCP stdio handshake'));
  if (!L4) return { ok: false, reason: 'L4 layer absent in brain-smoke result' };
  if (!L4.ok) return { ok: false, reason: 'L4 layer did not succeed: ' + (L4.reason || 'unknown') };
  // Parse server=mindrian-brain vX.Y.Z[-PR] from the reason string.
  const match = String(L4.reason || '').match(/server=mindrian-brain v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
  if (!match) return { ok: false, reason: 'L4 reason did not contain server-version pattern: ' + L4.reason };
  return { ok: true, wireVersion: match[1] };
}

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

function formatBanner(wireVersion, recordVersion) {
  // Red banner per plan spec. Plain-text fallback when no TTY (the banner
  // still reads correctly in the SessionStart systemMessage envelope).
  const lines = [];
  lines.push('');
  lines.push(`${C.red}${C.bold}-- ACTIVATION GAP --${C.reset}`);
  lines.push('');
  lines.push(`${C.red}/mos:update landed v${recordVersion} bytes but the live install is still serving v${wireVersion}.${C.reset}`);
  lines.push('');
  lines.push('Recovery (two steps):');
  lines.push(`  1. Run ${C.bold}/mos:doctor --fix${C.reset} to atomically swap to the new bytes.`);
  lines.push('  2. Restart this Claude Code session so MCP servers reconnect.');
  lines.push('');
  lines.push(`${C.dim}Larry will not load until activation reaches the wire.${C.reset}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  // Part 7 (F8 stale-registry self-detector). Runs FIRST, ahead of the
  // Part 8 touch-file/wire-probe path, because it is the cheaper + more
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

  // 1. Touch-file gate: absent -> exit silently.
  if (!fs.existsSync(TOUCH_FILE)) {
    return emitEmpty();
  }

  // 2. Probe the wire.
  const probe = probeBrainSmokeVersion();
  if (!probe.ok) {
    // Cannot distinguish drift from probe failure; do NOT block on
    // uncertainty. Leave touch-file in place so a future probe (next
    // session, after Brain is reachable) can verify.
    try { process.stderr.write(`[post-update-preflight] probe inconclusive: ${probe.reason}\n`); } catch (_) {}
    return emitEmpty();
  }

  // 3. Read version-of-record from local files.
  const recordVersion = readPackageJsonVersion();
  if (!recordVersion) {
    try { process.stderr.write('[post-update-preflight] could not read version-of-record from package.json or plugin.json\n'); } catch (_) {}
    return emitEmpty();
  }

  // 4. Compare. Match -> activation succeeded; clean up + exit silently.
  if (probe.wireVersion === recordVersion) {
    try { fs.unlinkSync(TOUCH_FILE); } catch (_) { /* already gone is fine */ }
    return emitEmpty();
  }

  // 5. Drift detected -- block + surface banner.
  const banner = formatBanner(probe.wireVersion, recordVersion);
  emitEnvelope({
    continue: false,
    stopReason: 'post-update activation gap: live install serves v' + probe.wireVersion + ' but version-of-record is v' + recordVersion,
    systemMessage: banner,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'A previous /mos:update landed bytes for v' + recordVersion + ' but the live install at ~/.claude/plugins/mindrian-os/ still serves v' + probe.wireVersion + '. The recovery path is /mos:doctor --fix followed by a session restart.',
    },
  }, 1);
}

main();
