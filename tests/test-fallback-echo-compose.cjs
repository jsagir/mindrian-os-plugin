#!/usr/bin/env node
'use strict';

/*
 * Phase 106 Plan 04 -- statusline fallback echo composition test.
 *
 * Tests scripts/statusline-fallback-echo.cjs:
 *   - CLI surface emits no echo (statusline carries the data)
 *   - DESKTOP / COWORK surfaces emit a SessionStart envelope with
 *     hookSpecificOutput.additionalContext = state echo string
 *   - Banner suppression (24h touch-file) blocks the echo
 *   - Missing operator / jtbd / bridge files do not throw (graceful)
 *
 * Strategy: per-test hermetic mkdtempSync HOME + workspace; stub
 * operator state file, jtbd state file, bridge file; spawn the script
 * with HOME override + cwd = workspace; assert envelope shape.
 *
 * Replaces Wave 0 stub created by Plan 106-00.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'statusline-fallback-echo.cjs');
const PLUGIN_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
).version;

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-04-compose-'));
  const room = path.join(tmp, 'room');
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.mindrian', 'bridge'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.mindrian', 'banner-state'), { recursive: true });
  // Write a fresh-install onboard marker so 30-day flip is default-on.
  fs.writeFileSync(
    path.join(tmp, '.mindrian-onboarded'),
    PLUGIN_VERSION + '\n' + new Date().toISOString().slice(0, 10) + '\n'
  );
  return { tmp, room };
}

function setOperator(room, current) {
  fs.writeFileSync(
    path.join(room, '.mindrian', 'conversation-operator.json'),
    JSON.stringify({
      schema_version: '1.0.0',
      current: current,
      previous: null,
      entered_at: new Date().toISOString(),
      context: {
        active_room: path.basename(room),
        active_section: null,
        methodology_in_flight: null,
        decision_gate_pending: null,
      },
      history: [],
    })
  );
}

function setJtbd(room, jtbd) {
  const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  fs.writeFileSync(
    path.join(room, '.mindrian', 'jtbd-state.json'),
    JSON.stringify({
      version: 1,
      current: {
        jtbd: jtbd,
        confidence: 0.8,
        entered_at: new Date().toISOString(),
        evidence: [],
        expires_at: future,
      },
      history: [],
    })
  );
}

function setBridge(tmp, room, ctxPct) {
  const hash = crypto.createHash('md5').update(room).digest('hex').slice(0, 8);
  const bridgeFile = path.join(tmp, '.mindrian', 'bridge', hash + '.json');
  fs.writeFileSync(bridgeFile, JSON.stringify({
    model_id: 'claude-sonnet-4-5',
    model_name: 'Sonnet',
    ctx_pct: ctxPct,
    ctx_remaining: 100 - ctxPct,
    ctx_size: 200000,
    timestamp: Math.floor(Date.now() / 1000),
  }));
}

function setBannerTouch(tmp, opts) {
  const f = path.join(tmp, '.mindrian', 'banner-state', 'statusline-visibility-warned.json');
  fs.writeFileSync(f, JSON.stringify(opts));
}

function run(tmp, room, surface, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: tmp,
    USERPROFILE: tmp,
    MINDRIAN_STATUSLINE_SURFACE: surface,
  }, extraEnv || {});
  // Strip parent-process surface signals that would leak into the child.
  delete env.CLAUDE_DESKTOP;
  delete env.COWORK_SESSION_ID;
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: room,
    env: env,
    encoding: 'utf8',
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      workspace: { current_dir: room },
    }),
  });
}

function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }

let passed = 0;
let failed = 0;
function pass(n) { passed += 1; console.log('PASS: ' + n); }
function failTest(n, e) { failed += 1; console.log('FAIL: ' + n + '\n    ' + (e && e.message || e)); }

// Test 1: CLI surface -> no echo
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  setJtbd(ctx.room, 'find-bottleneck');
  setBridge(ctx.tmp, ctx.room, 23);
  const r = run(ctx.tmp, ctx.room, 'CLI');
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  const env = JSON.parse(r.stdout || '{}');
  assert.strictEqual(env.continue, true);
  assert.ok(
    !env.hookSpecificOutput || !env.hookSpecificOutput.additionalContext,
    'CLI surface emits no additionalContext; got: ' + JSON.stringify(env)
  );
  rm(ctx.tmp);
  pass('Test 1 (CLI -> no echo)');
} catch (e) { failTest('Test 1 (CLI -> no echo)', e); }

// Test 2: DESKTOP surface, full state -> full echo
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  setJtbd(ctx.room, 'find-bottleneck');
  setBridge(ctx.tmp, ctx.room, 23);
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  const env = JSON.parse(r.stdout || '{}');
  assert.strictEqual(env.continue, true);
  assert.ok(env.hookSpecificOutput, 'has hookSpecificOutput; got: ' + JSON.stringify(env));
  const echo = env.hookSpecificOutput.additionalContext;
  assert.ok(echo, 'additionalContext present');
  assert.ok(echo.startsWith('['), 'starts with [; got: ' + echo);
  assert.ok(echo.endsWith(']'), 'ends with ]; got: ' + echo);
  assert.match(echo, /MindrianOS v/, 'contains plugin version prefix');
  assert.match(echo, /room: /, 'contains room segment');
  assert.match(echo, /operator: BUILD_ROOM/);
  assert.match(echo, /jtbd: find-bottleneck/);
  assert.match(echo, /context: 23%/);
  rm(ctx.tmp);
  pass('Test 2 (DESKTOP -> full echo)');
} catch (e) { failTest('Test 2 (DESKTOP -> full echo)', e); }

// Test 3: COWORK surface -> echo
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'METHODOLOGY');
  setJtbd(ctx.room, 'prepare-pitch');
  setBridge(ctx.tmp, ctx.room, 47);
  const r = run(ctx.tmp, ctx.room, 'COWORK');
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout || '{}');
  assert.ok(env.hookSpecificOutput && env.hookSpecificOutput.additionalContext);
  assert.match(env.hookSpecificOutput.additionalContext, /operator: METHODOLOGY/);
  assert.match(env.hookSpecificOutput.additionalContext, /context: 47%/);
  rm(ctx.tmp);
  pass('Test 3 (COWORK -> echo)');
} catch (e) { failTest('Test 3 (COWORK -> echo)', e); }

// Test 4: 24h banner suppression -> no echo
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  setJtbd(ctx.room, 'find-bottleneck');
  setBridge(ctx.tmp, ctx.room, 23);
  setBannerTouch(ctx.tmp, {
    status: 'warn',
    last_warned: new Date().toISOString(),
    installed_version: PLUGIN_VERSION,
  });
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout || '{}');
  assert.ok(
    !env.hookSpecificOutput || !env.hookSpecificOutput.additionalContext,
    'fresh banner suppresses echo; got: ' + JSON.stringify(env)
  );
  rm(ctx.tmp);
  pass('Test 4 (banner suppression -> no echo)');
} catch (e) { failTest('Test 4 (banner suppression -> no echo)', e); }

// Test 5: missing operator state -> graceful (no throw, exit 0)
try {
  const ctx = makeRoom();
  // no setOperator -- file absent
  setJtbd(ctx.room, 'find-bottleneck');
  setBridge(ctx.tmp, ctx.room, 23);
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0, 'exit 0 even with missing operator state');
  const env = JSON.parse(r.stdout || '{}');
  assert.strictEqual(env.continue, true);
  rm(ctx.tmp);
  pass('Test 5 (missing operator state -> graceful)');
} catch (e) { failTest('Test 5 (missing operator state -> graceful)', e); }

// Test 6: missing jtbd state -> graceful
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  // no setJtbd -- file absent
  setBridge(ctx.tmp, ctx.room, 23);
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0);
  rm(ctx.tmp);
  pass('Test 6 (missing jtbd state -> graceful)');
} catch (e) { failTest('Test 6 (missing jtbd state -> graceful)', e); }

// Test 7: missing bridge file -> graceful
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  setJtbd(ctx.room, 'find-bottleneck');
  // no setBridge -- file absent
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0);
  rm(ctx.tmp);
  pass('Test 7 (missing bridge file -> graceful)');
} catch (e) { failTest('Test 7 (missing bridge file -> graceful)', e); }

// ---------------------------------------------------------------------------
// RCA statusline-context-pct-stale-post-compact (2026-07-28) -- Tri-Polar gap.
//
// The bridge file is ONLY rewritten by a CLI statusline render. Desktop and
// Cowork have no statusline primitive, so this echo used to render whatever the
// last CLI session in the workspace left on disk, with no freshness check at all
// -- a context percentage from a DIFFERENT conversation, arbitrarily old. The
// record already carried a `timestamp` written for exactly this purpose; nothing
// read it. Past the freshness bound the honest '-' placeholder renders instead.
// ---------------------------------------------------------------------------

function setStaleBridge(tmp, room, ctxPct, ageSeconds) {
  const hash = crypto.createHash('md5').update(room).digest('hex').slice(0, 8);
  const bridgeFile = path.join(tmp, '.mindrian', 'bridge', hash + '.json');
  fs.writeFileSync(bridgeFile, JSON.stringify({
    model_id: 'claude-sonnet-4-5',
    model_name: 'Sonnet',
    ctx_pct: ctxPct,
    ctx_remaining: 100 - ctxPct,
    ctx_size: 200000,
    timestamp: Math.floor(Date.now() / 1000) - ageSeconds,
  }));
}

// Test 8: a day-old bridge value never renders as this session's context.
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  setJtbd(ctx.room, 'find-bottleneck');
  setStaleBridge(ctx.tmp, ctx.room, 93, 24 * 3600); // 24h old, pre-compact-shaped
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  const echo = JSON.parse(r.stdout || '{}').hookSpecificOutput.additionalContext;
  assert.ok(!/context: 93%/.test(echo), 'stale pct must NOT render; got: ' + echo);
  assert.match(echo, /context: -/, 'renders the honest placeholder; got: ' + echo);
  rm(ctx.tmp);
  pass('Test 8 (stale bridge -> honest placeholder, not a stale pct)');
} catch (e) { failTest('Test 8 (stale bridge -> honest placeholder, not a stale pct)', e); }

// Test 9: a bridge with no timestamp at all cannot be trusted either.
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  setJtbd(ctx.room, 'find-bottleneck');
  const hash = crypto.createHash('md5').update(ctx.room).digest('hex').slice(0, 8);
  fs.writeFileSync(
    path.join(ctx.tmp, '.mindrian', 'bridge', hash + '.json'),
    JSON.stringify({ model_id: 'x', model_name: 'x', ctx_pct: 77, ctx_size: 200000 })
  );
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  const echo = JSON.parse(r.stdout || '{}').hookSpecificOutput.additionalContext;
  assert.ok(!/context: 77%/.test(echo), 'undateable pct must NOT render; got: ' + echo);
  rm(ctx.tmp);
  pass('Test 9 (bridge without a timestamp -> not trusted)');
} catch (e) { failTest('Test 9 (bridge without a timestamp -> not trusted)', e); }

// Test 10: a FRESH bridge still renders (the gate is not over-tight).
try {
  const ctx = makeRoom();
  setOperator(ctx.room, 'BUILD_ROOM');
  setJtbd(ctx.room, 'find-bottleneck');
  setStaleBridge(ctx.tmp, ctx.room, 41, 60); // 1 minute old
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  const echo = JSON.parse(r.stdout || '{}').hookSpecificOutput.additionalContext;
  assert.match(echo, /context: 41%/, 'a fresh pct still renders; got: ' + echo);
  rm(ctx.tmp);
  pass('Test 10 (fresh bridge still renders)');
} catch (e) { failTest('Test 10 (fresh bridge still renders)', e); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll 10 tests PASS');
process.exit(0);
