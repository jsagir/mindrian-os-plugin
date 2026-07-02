#!/usr/bin/env node
// Phase 199-01 -- agentshield SessionStart drift-scan hook stdin -> exit-code
// contract (AS-05).
//
// WAVE 0 CONTRACT: authored before the hook lands (Nyquist). It checks for
// scripts/agentshield-sessionstart-scan.cjs; while absent it prints SKIP and
// exits 0. The drift-gate render leg is FURTHER guarded behind the drift-gate
// module (lib/hmi/agentshield-drift-gate.cjs, lands 199-06) so it stays SKIP-safe
// until that surface exists.
//
// Hook contract (a SessionStart hook INFORMS, it never blocks a session -- there
// is NO fail-closed posture here, unlike the PreToolUse Part-8 gate):
//   - ALWAYS exits 0, on every path (clean, new-finding, garbage stdin).
//   - a NEW flagged finding since the last locally-cached scan -> a rendered
//     Shape F.1 drift gate on STDOUT, exit 0 (informs, does not block).
//   - a clean scan OR an already-seen finding -> SILENT exit 0, no stdout gate.
//
// Test seam: the hook honors AGENTSHIELD_FORCE_DRIFT ('1' -> force a synthetic new
// flagged finding, '0' -> force a clean/already-seen result) so both branches are
// deterministically exercisable without mutating the real cache. This env override
// is test-only. AGENTSHIELD_CACHE_DIR points the local scan cache at a temp dir so
// the test never touches the developer's real cache.
//
// Zero-dep: child_process spawnSync with a JSON stdin envelope (cloned from the
// part8-egress-guard-hook.test.cjs shape). CJS only. No em-dashes.

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'agentshield-sessionstart-scan.cjs');
const DRIFT_GATE = path.join(ROOT, 'lib', 'hmi', 'agentshield-drift-gate.cjs');

if (!fs.existsSync(HOOK)) {
  console.log('SKIP: scripts/agentshield-sessionstart-scan.cjs not present (Wave 0) -- inert until 199-06 lands the hook');
  process.exit(0);
}

// A throwaway cache dir so the hook never reads or writes the developer's real
// drift cache during the test.
const CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agentshield-drift-'));

// Run the hook with a stdin string and optional extra env; return { status, stdout }.
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, { AGENTSHIELD_CACHE_DIR: CACHE_DIR }, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout || '' };
}

// SessionStart envelope shape: { hook_event_name, source, session_id }.
function envelope(source) {
  return JSON.stringify({ hook_event_name: 'SessionStart', source: source || 'startup', session_id: 's1' });
}
const STARTUP = envelope('startup');
const GARBAGE = 'this is not json at all }{';

// ---------------------------------------------------------------------------
// AS-05: the hook ALWAYS exits 0, even on garbage stdin. A SessionStart hook
// informs, it never bricks a session.
// ---------------------------------------------------------------------------
(function as05_always_exit_zero() {
  const clean = runHook(STARTUP, { AGENTSHIELD_FORCE_DRIFT: '0' });
  assert.strictEqual(clean.status, 0, 'AS-05: clean SessionStart scan must exit 0');

  const garbage = runHook(GARBAGE);
  assert.strictEqual(garbage.status, 0, 'AS-05: garbage stdin must still exit 0 (informs, never blocks)');
})();

// ---------------------------------------------------------------------------
// AS-05: a clean / already-seen scan produces SILENT exit 0 -- no drift gate on
// stdout. (The forced-clean seam guarantees no new flagged finding exists.)
// ---------------------------------------------------------------------------
(function as05_clean_is_silent() {
  const clean = runHook(STARTUP, { AGENTSHIELD_FORCE_DRIFT: '0' });
  assert.strictEqual(clean.status, 0, 'AS-05: clean scan exits 0');
  assert.ok(!/pick/i.test(clean.stdout), 'AS-05: a clean scan must NOT render a drift gate on stdout');
})();

// ---------------------------------------------------------------------------
// AS-05: a NEW flagged finding renders a Shape F.1 drift gate on stdout, exit 0.
// Guarded behind the drift-gate module so it stays SKIP-safe until 199-06 lands
// lib/hmi/agentshield-drift-gate.cjs.
// ---------------------------------------------------------------------------
if (fs.existsSync(DRIFT_GATE)) {
  (function as05_new_finding_renders_gate() {
    const drifted = runHook(STARTUP, { AGENTSHIELD_FORCE_DRIFT: '1' });
    assert.strictEqual(drifted.status, 0, 'AS-05: a new flagged finding still exits 0 (informs, never blocks)');
    assert.ok(drifted.stdout.length > 0, 'AS-05: a new flagged finding must render a drift gate on stdout');
    assert.ok(/pick/i.test(drifted.stdout), 'AS-05: the rendered gate is a Shape F.1 pick gate');
  })();

  // The Shape F.1 drift gate offers reformulate/remediate style verbs and NO
  // send-anyway verb (it is an informational Decision Gate, Part 3 Shape F).
  (function as05_gate_verbs() {
    const gate = require(DRIFT_GATE);
    const render = gate.renderGate || gate.render || gate.default;
    assert.strictEqual(typeof render, 'function', 'AS-05: agentshield-drift-gate must export a render function');
  })();

  console.log('PASS: agentshield SessionStart hook -- always-exit-0 + drift gate render (AS-05) green');
} else {
  console.log('PARTIAL PASS: hook always-exit-0 + silent-clean legs (AS-05) green; drift gate render SKIPPED (agentshield-drift-gate.cjs absent, lands 199-06)');
}

// Best-effort cleanup of the throwaway cache dir.
try { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

process.exit(0);
