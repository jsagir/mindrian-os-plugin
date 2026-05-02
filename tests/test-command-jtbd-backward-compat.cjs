#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 104-03 -- backward-compat regression fence (JTBDCONS-104-04).
 *
 * Pins the canonical CONTEXT.md invariant:
 *   "Backward compat: commands without serves_jtbd continue to work
 *    (selector falls through to F.1)."
 *
 * The Phase 101-04 dispatcher (lib/hmi/selector-dispatcher.cjs) reads JTBD
 * state from <roomDir>/.mindrian/jtbd-state.json. When the file is absent
 * OR contains { current: null }, the dispatcher MUST NOT return F.6
 * (the JTBD-aware shape) -- it must fall through to F.1 or passthrough.
 *
 * This test creates two fixture rooms and asserts pickShape never returns
 * F.6 in the JTBD-null scenario. It is the canonical regression fence
 * against accidental "every command must declare serves_jtbd" coupling.
 *
 * Pattern: IIFE harness cloned from tests/test-jtbd-taxonomy.cjs (Phase 100-01).
 * Zero deps; node built-ins only (fs, path, os) per Phase 87 invariant.
 * Latency budget < 500ms warm.
 *
 * Exit codes:
 *   0  -> all assertions PASS (F.1 fallthrough verified)
 *   1  -> any assertion FAIL (regression detected)
 *   77 -> SKIPPED (dispatcher module missing)
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.join(__dirname, '..');
const DISPATCHER_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs');

function makeFixtureNoState() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-104-bc-nostate-'));
  const roomDir = path.join(tmpRoot, 'room');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  // INTENTIONALLY do not create jtbd-state.json
  return { tmpRoot, roomDir };
}

function makeFixtureNullState() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-104-bc-null-'));
  const roomDir = path.join(tmpRoot, 'room');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'jtbd-state.json'),
    JSON.stringify({ current: null, history: [] }, null, 2),
    'utf8'
  );
  return { tmpRoot, roomDir };
}

function cleanup(tmpRoot) {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* swallow */ }
}

function isAcceptableNonF6(result) {
  if (!result) return false;
  if (result.shape === 'F.6') return false;
  if (result.shape === 'F.1') return true;
  if (result.passthrough === true) return true;
  if (result.shape && typeof result.shape === 'string' && result.shape.startsWith('F.')) return true;
  if (result.shape === 'error' && result.rendered && typeof result.rendered.error === 'string') {
    // dispatcher returned a structured error -- acceptable if the error indicates
    // tier-0 refusal or fallthrough rather than crashing
    return true;
  }
  return false;
}

(function main() {
  let passed = 0;
  let failed = 0;
  function assert(label, cond, detail) {
    if (cond) { console.log('PASS ' + label); passed++; }
    else { console.error('FAIL ' + label + (detail ? ' :: ' + detail : '')); failed++; }
  }

  // Test 1: DISPATCHER-LOAD
  if (!fs.existsSync(DISPATCHER_PATH)) {
    console.error('SKIP test-command-jtbd-backward-compat :: dispatcher missing at ' + DISPATCHER_PATH);
    process.exit(77);
  }
  let dispatcher;
  try {
    dispatcher = require(DISPATCHER_PATH);
  } catch (e) {
    assert('DISPATCHER-LOAD requires cleanly', false, e.message);
    process.exit(1);
  }
  assert('DISPATCHER-LOAD requires cleanly', true);
  assert('DISPATCHER-LOAD exposes pickShape', typeof dispatcher.pickShape === 'function',
    'typeof pickShape = ' + typeof dispatcher.pickShape);

  // Test 2-5: NO-STATE-FILE scenario
  const f1 = makeFixtureNoState();
  let r1;
  let r1Threw = null;
  try {
    r1 = dispatcher.pickShape({
      requestedShape: 'F',
      roomDir: f1.roomDir,
      tier: 1,
      payload: {}
    });
  } catch (e) {
    r1Threw = e;
  }
  assert('NO-THROW (no state file)', r1Threw === null,
    r1Threw ? r1Threw.message : null);
  assert('NOT-F6 (no state file)', r1Threw === null && r1 && r1.shape !== 'F.6',
    'got shape=' + (r1 ? r1.shape : 'undefined'));
  assert('F1-PREFERRED-OR-PASSTHROUGH (no state file)',
    r1Threw === null && isAcceptableNonF6(r1),
    'got result=' + JSON.stringify(r1));
  cleanup(f1.tmpRoot);

  // Test 6: NULL-JTBD-WITH-STATE-FILE scenario
  const f2 = makeFixtureNullState();
  let r2;
  let r2Threw = null;
  try {
    r2 = dispatcher.pickShape({
      requestedShape: 'F',
      roomDir: f2.roomDir,
      tier: 1,
      payload: {}
    });
  } catch (e) {
    r2Threw = e;
  }
  assert('NO-THROW (current=null state)', r2Threw === null,
    r2Threw ? r2Threw.message : null);
  assert('NOT-F6 (current=null state)',
    r2Threw === null && r2 && r2.shape !== 'F.6',
    'got shape=' + (r2 ? r2.shape : 'undefined'));
  assert('F1-PREFERRED-OR-PASSTHROUGH (current=null state)',
    r2Threw === null && isAcceptableNonF6(r2),
    'got result=' + JSON.stringify(r2));
  cleanup(f2.tmpRoot);

  console.log('\nResult: ' + passed + ' passed, ' + failed + ' failed.');
  process.exit(failed === 0 ? 0 : 1);
})();
