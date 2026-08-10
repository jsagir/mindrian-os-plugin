#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 106 Plan 04 -- statusline fallback echo (D-04 + D-06).
 *
 * SessionStart hook script. Composes a Larry-rendered prose state echo
 * for surfaces where the rich statusline cannot fire:
 *   - Claude Desktop (no statusline primitive)
 *   - Cowork (deferred widget; interim Desktop-style echo)
 *   - CLI post-detect repair window (banner suppression contract)
 *
 * Echo shape (CONTEXT.md D-04):
 *   [MindrianOS v1.12.5 active . room: <slug> . operator: <op> . jtbd: <jtbd> . context: <pct>%]
 *
 * (separator is U+00B7 MIDDLE DOT, not the ASCII period; matches the
 * canonical D-04 example in CONTEXT.md.)
 *
 * Sources:
 *   - operator: lib/conversation/operator.cjs getCurrent(roomDir)
 *   - jtbd: lib/hmi/jtbd-state.cjs getCurrent(roomDir)
 *   - context: ~/.mindrian/bridge/{md5(workspaceDir).slice(0,8)}.json (written
 *     by scripts/context-monitor every assistant-message turn)
 *   - version: .claude-plugin/plugin.json
 *
 * Routing:
 *   - surface 'CLI'     -> emit empty envelope (statusline carries the data)
 *   - surface 'DESKTOP' -> emit envelope with hookSpecificOutput.additionalContext
 *   - surface 'COWORK'  -> emit envelope with additionalContext (Phase 107 will
 *                          refine the widget shape; interim Desktop-style is OK)
 *
 * Gating (in order):
 *   1. Surface = CLI -> no echo, exit 0 with {continue: true}
 *   2. Banner-suppression touch-file with shouldSuppress() = true -> no echo
 *   3. MINDRIAN_STATUSLINE_FALLBACK_ECHO env override:
 *        '1' -> always echo (regardless of 30d flip)
 *        '0' -> never echo (regardless of 30d flip)
 *   4. 30-day default-flip: if no override AND ~/.mindrian-onboarded line 2
 *      ISO date is more than 30 days old -> no echo. Otherwise echo.
 *      No marker file -> treat as fresh install (echo).
 *
 * Defensive: NEVER blocks the hook chain. Always emits {continue: true}
 * on any internal error. Per scripts/operator-update.cjs canonical pattern.
 *
 * Pure CJS, node built-ins only, zero npm deps (Phase 87 invariant).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

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

// Guard against any unexpected throw -- never block the hook chain.
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
  return (j && j.version) ? j.version : 'unknown';
}

function bridgePath(workspaceDir) {
  const hash = crypto.createHash('md5').update(workspaceDir).digest('hex').slice(0, 8);
  return path.join(os.homedir(), '.mindrian', 'bridge', hash + '.json');
}

// RCA statusline-context-pct-stale-post-compact (2026-07-28), Tri-Polar gap.
// The bridge file is ONLY rewritten by a CLI statusline render. Desktop and
// Cowork have no statusline primitive, so this echo was rendering whatever the
// last CLI session in this workspace left on disk -- arbitrarily old, and from a
// DIFFERENT conversation than the one starting now. The record already carries a
// `timestamp` written for exactly this purpose; it was never read. A context
// percentage describes one session's conversation, so past this bound it cannot
// be justified for the session being started and we render the honest '-'
// placeholder instead (the same placeholder used when no bridge exists at all).
const BRIDGE_FRESH_SECONDS = 15 * 60;

function isFreshBridge(bridge) {
  if (!bridge || typeof bridge.timestamp !== 'number') return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - bridge.timestamp;
  return ageSeconds >= 0 && ageSeconds <= BRIDGE_FRESH_SECONDS;
}

function bannerTouchPath() {
  return path.join(os.homedir(), '.mindrian', 'banner-state', 'statusline-visibility-warned.json');
}

function onboardMarkerPath() {
  return path.join(os.homedir(), '.mindrian-onboarded');
}

function isWithin30Days() {
  const marker = safeRead(onboardMarkerPath());
  if (marker === null) return true; // fresh install -> default-on
  const lines = marker.split('\n').filter(Boolean);
  if (lines.length < 2) return true; // malformed marker -> default-on
  const isoDate = lines[1].trim();
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return true;
  const ageMs = Date.now() - t;
  return ageMs < 30 * 24 * 3600 * 1000;
}

function shouldEchoBy30DayFlip() {
  const env = process.env.MINDRIAN_STATUSLINE_FALLBACK_ECHO;
  if (env === '1') return true;
  if (env === '0') return false;
  return isWithin30Days();
}

function bannerSuppressing() {
  try {
    const tf = safeJson(bannerTouchPath());
    if (!tf) return false;
    const ver = readPluginVersion();
    const mod = require(path.resolve(__dirname, '..', 'lib', 'statusline', 'banner-suppression.cjs'));
    return mod.shouldSuppress(tf, ver);
  } catch (_e) {
    return false;
  }
}

function detectSurface() {
  try {
    const mod = require(path.resolve(__dirname, '..', 'lib', 'statusline', 'surface-detect.cjs'));
    return mod.detectStatuslineSurface();
  } catch (_e) {
    return 'DESKTOP';
  }
}

function compose(workspaceDir) {
  const ver = readPluginVersion();

  let operatorStr = '-';
  try {
    const op = require(path.resolve(__dirname, '..', 'lib', 'conversation', 'operator.cjs'));
    const state = op.getCurrent(workspaceDir);
    if (state && state.current) operatorStr = state.current;
  } catch (_e) { /* graceful */ }

  let jtbdStr = '-';
  try {
    const jtbdState = require(path.resolve(__dirname, '..', 'lib', 'hmi', 'jtbd-state.cjs'));
    const j = jtbdState.getCurrent(workspaceDir);
    if (j && j.jtbd) jtbdStr = j.jtbd;
  } catch (_e) { /* graceful */ }

  let ctxStr = '-';
  const bridge = safeJson(bridgePath(workspaceDir));
  if (bridge && typeof bridge.ctx_pct === 'number' && isFreshBridge(bridge)) {
    ctxStr = bridge.ctx_pct + '%';
  }

  const slug = path.basename(workspaceDir) || 'room';

  // Separator below is U+00B7 MIDDLE DOT (not in FORBIDDEN_GLYPHS,
  // not in any carve-out gating). Matches the CONTEXT.md D-04 example.
  return '[MindrianOS v' + ver + ' active · room: ' + slug
    + ' · operator: ' + operatorStr
    + ' · jtbd: ' + jtbdStr
    + ' · context: ' + ctxStr + ']';
}

// ----- Phase 121.5-00 contributor surface -----
// Two semantic contributors split out of the monolithic echo:
//   - contributeMintoSegment() -- the MINTO-flavored ambient context line
//                                 (priority 7 minto slot).
//   - contribute()             -- the bottom-priority surface fallback echo
//                                 (priority 11 statusline-fallback slot).
//
// Both share the same source data (operator + jtbd + ctx + version + slug).
// The split lets the budget compressor degrade them independently.

function contribute() {
  let fi;
  try { fi = require('../lib/sessionstart/contributor-interface.cjs'); }
  catch (_) { return { has_payload: false }; }
  try {
    const surface = detectSurface();
    if (surface === 'CLI') return fi.emptyFragment();
    if (bannerSuppressing()) return fi.emptyFragment();
    if (!shouldEchoBy30DayFlip()) return fi.emptyFragment();
    const workspaceDir = process.cwd();
    const echo = compose(workspaceDir);
    const pointer = '[MindrianOS active]';
    return fi.makeFragment({
      id: 'statusline-fallback',
      priority: 11,
      full_payload: echo,
      one_line_pointer: pointer,
    });
  } catch (_) {
    return fi.emptyFragment();
  }
}

function contributeMintoSegment() {
  let fi;
  try { fi = require('../lib/sessionstart/contributor-interface.cjs'); }
  catch (_) { return { has_payload: false }; }
  try {
    const workspaceDir = process.cwd();
    let jtbdStr = '-';
    try {
      const jtbdState = require(path.resolve(__dirname, '..', 'lib', 'hmi', 'jtbd-state.cjs'));
      const j = jtbdState.getCurrent(workspaceDir);
      if (j && j.jtbd) jtbdStr = j.jtbd;
    } catch (_) { /* graceful */ }
    if (!jtbdStr || jtbdStr === '-') return fi.emptyFragment();
    // MINTO-flavored ambient line: situation -> question -> answer (compressed).
    const slug = path.basename(workspaceDir) || 'room';
    const fullPayload = 'Current focus: ' + jtbdStr + ' in ' + slug + '.';
    const pointer = 'Focus: ' + jtbdStr + '.';
    return fi.makeFragment({
      id: 'minto',
      priority: 7,
      full_payload: fullPayload,
      one_line_pointer: pointer,
    });
  } catch (_) {
    return fi.emptyFragment();
  }
}

module.exports = { contribute, contributeMintoSegment };

// Read stdin -- Claude Code SessionStart envelope. We only need it for
// workspace_dir; if stdin is empty/unparseable we fall back to cwd.
// The legacy main path (stdin read + envelope emit) is preserved as the
// require.main === module branch, but hooks.json no longer routes here.
if (require.main === module) {
  let input = '';
  const inputTimeout = setTimeout(() => doneReadingStdin(), 500);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => doneReadingStdin());
  process.stdin.on('error', () => doneReadingStdin());

  let doneCalled = false;
  function doneReadingStdin() {
    if (doneCalled) return;
    doneCalled = true;
    clearTimeout(inputTimeout);

    let workspaceDir = process.cwd();
    try {
      const data = JSON.parse(input);
      if (data && data.workspace && typeof data.workspace.current_dir === 'string') {
        workspaceDir = data.workspace.current_dir;
      }
    } catch (_e) { /* default to cwd */ }

    const surface = detectSurface();
    if (surface === 'CLI') return emitEmpty();
    if (bannerSuppressing()) return emitEmpty();
    if (!shouldEchoBy30DayFlip()) return emitEmpty();

    const echo = compose(workspaceDir);
    emitEnvelope({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: echo,
      },
    });
  }
}
