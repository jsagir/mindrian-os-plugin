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
  emitEnvelope({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: gateText(ver),
    },
  });
}
