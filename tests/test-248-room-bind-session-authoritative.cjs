#!/usr/bin/env node
'use strict';

/*
 * Phase 248-01 Task 1 -- the RCA's Test 1, driven through the TWO EXISTING
 * seam families so it needs ZERO new code to run red today (Wave 0 contract).
 * =============================================================================
 * Proves: with MINDRIAN_MCP_FIRST unset, an explicit room_bind write is
 * AUTHORITATIVE for the rest of its session -- today it is silently ignored
 * because every copy only consults the session binding inside
 * `if (isMcpFirst(surface))`, which is false for every surface by default
 * (D-07). This test targets the READ side directly (bypassing the room_bind
 * handler itself, which is plan 248-02's honest-return work) by writing the
 * session binding straight through lib/core/session-binding.cjs and then
 * calling each existing resolver seam.
 *
 * Hermetic fixture, cloned from tests/test-198-flag-off-parity.test.cjs
 * lines 26-42 (tmpdir MINDRIAN_ROOMS_HOME; delete MINDRIAN_MCP_FIRST and
 * CLAUDE_ACTIVE_ROOM; registry.json {active: 'room-c', rooms: {room-c,
 * room-x}}; both room dirs really on disk; a separate fallback dir).
 *
 * Assert 1 (grouped-router family): toolRouter._test.resolveWriteTargetDir
 *   with sess-a (bound to room-x) resolves room-x's abs path.
 * Assert 2 (tools/ family): sensors.cjs's _internal.resolveSessionRoomDir
 *   with sess-a resolves room-x's abs path.
 * Assert 3 (unbound legacy parity): sess-b (no binding written) resolves
 *   room-c (reg.active) through BOTH families -- byte-identical legacy.
 * Assert 4 (stop-gate-handler family): its resolveSessionRoomDir resolves
 *   sess-a to room-x's abs path, and a sessionId with no binding AND an
 *   empty registry returns null (the null-floor compat contract).
 *
 * All env vars restored in finally, per the parity test's own pattern.
 *
 * No em-dashes. CJS only. Node built-in assert only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  ok -', label);
  } else {
    fail += 1;
    console.log('  FAIL -', label, detail !== undefined ? '(' + detail + ')' : '');
  }
}

const SAVED = {
  MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME,
  MINDRIAN_MCP_FIRST: process.env.MINDRIAN_MCP_FIRST,
  CLAUDE_ACTIVE_ROOM: process.env.CLAUDE_ACTIVE_ROOM,
};
function restoreEnv() {
  for (const k of Object.keys(SAVED)) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
}

function main() {
  console.log('test-248-room-bind-session-authoritative (CTX-01/CTX-02 authority proof)');

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sr248-auth-'));
  const roomC = path.join(home, 'room-c');
  const roomX = path.join(home, 'room-x');
  fs.mkdirSync(roomC, { recursive: true });
  fs.mkdirSync(roomX, { recursive: true });
  const registryDir = path.join(home, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify({
    active: 'room-c',
    rooms: {
      'room-c': { slug: 'room-c', abs_path: roomC },
      'room-x': { slug: 'room-x', abs_path: roomX },
    },
  }));
  const fallback = path.join(home, 'fallback-dir');
  fs.mkdirSync(fallback, { recursive: true });

  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  process.env.MINDRIAN_ROOMS_HOME = home;

  try {
    const { writeSessionBinding } = require(path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs'));
    writeSessionBinding('sess-a', { primary: 'room-x', bound: ['room-x'] }, { home: home });
    // sess-b: deliberately NO binding written (unbound legacy control).

    // ---------------------------------------------------------------------
    // Assert 1: grouped-router family (tool-router.cjs._test.resolveWriteTargetDir)
    // ---------------------------------------------------------------------
    delete require.cache[require.resolve(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'))];
    const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
    const routerBoundResult = toolRouter._test.resolveWriteTargetDir('sess-a', fallback, 'cli');
    check(
      'Assert 1 (tool-router._test.resolveWriteTargetDir): bound sess-a resolves room-x, flag-off',
      routerBoundResult === roomX,
      'got ' + routerBoundResult
    );

    // ---------------------------------------------------------------------
    // Assert 2: tools/ family (sensors.cjs _internal.resolveSessionRoomDir)
    // ---------------------------------------------------------------------
    delete require.cache[require.resolve(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'))];
    const sensors = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
    const sensorsBoundResult = sensors._internal.resolveSessionRoomDir('sess-a', { fallbackRoomDir: fallback, surface: 'cli' });
    check(
      'Assert 2 (sensors._internal.resolveSessionRoomDir): bound sess-a resolves room-x, flag-off',
      sensorsBoundResult === roomX,
      'got ' + sensorsBoundResult
    );

    // ---------------------------------------------------------------------
    // Assert 3: unbound legacy parity (sess-b, no binding written)
    // ---------------------------------------------------------------------
    const routerUnboundResult = toolRouter._test.resolveWriteTargetDir('sess-b', fallback, 'cli');
    check(
      'Assert 3a (tool-router): unbound sess-b resolves room-c (reg.active), byte-identical legacy',
      routerUnboundResult === roomC,
      'got ' + routerUnboundResult
    );
    const sensorsUnboundResult = sensors._internal.resolveSessionRoomDir('sess-b', { fallbackRoomDir: fallback, surface: 'cli' });
    check(
      'Assert 3b (sensors): unbound sess-b resolves room-c (reg.active), byte-identical legacy',
      sensorsUnboundResult === roomC,
      'got ' + sensorsUnboundResult
    );

    // ---------------------------------------------------------------------
    // Assert 4: stop-gate-handler family (null-floor compat)
    // ---------------------------------------------------------------------
    delete require.cache[require.resolve(path.join(REPO_ROOT, 'lib', 'mcp', 'stop-gate-handler.cjs'))];
    const stopGateHandler = require(path.join(REPO_ROOT, 'lib', 'mcp', 'stop-gate-handler.cjs'));
    const stopGateBoundResult = stopGateHandler.resolveSessionRoomDir('sess-a', { surface: 'cli' });
    check(
      'Assert 4a (stop-gate-handler): bound sess-a resolves room-x, flag-off',
      stopGateBoundResult === roomX,
      'got ' + stopGateBoundResult
    );

    // Null-floor compat: a sessionId with no binding AND an empty registry
    // (separate hermetic home) returns null, never a floored guess.
    const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sr248-auth-empty-'));
    const prevHome = process.env.MINDRIAN_ROOMS_HOME;
    process.env.MINDRIAN_ROOMS_HOME = emptyHome;
    try {
      const stopGateNullResult = stopGateHandler.resolveSessionRoomDir('sess-nowhere', { surface: 'cli' });
      check(
        'Assert 4b (stop-gate-handler): unbound session + empty registry -> null (compat floor)',
        stopGateNullResult === null,
        'got ' + stopGateNullResult
      );
    } finally {
      process.env.MINDRIAN_ROOMS_HOME = prevHome;
      fs.rmSync(emptyHome, { recursive: true, force: true });
    }

    console.log('');
    console.log('---');
    console.log(pass + '/' + (pass + fail) + ' green');
    process.exit(fail === 0 ? 0 : 1);
  } finally {
    restoreEnv();
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

main();
