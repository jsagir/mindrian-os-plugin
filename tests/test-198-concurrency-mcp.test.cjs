#!/usr/bin/env node
// Phase 198 SPEC-1 -- two-session concurrency guard, driven through the MCP
// write path. Clones the shape of the shipped
// tests/test-194-concurrency-integration.test.cjs: two sessions bound to
// different rooms perform interleaved writes; each write must land in its OWN
// room, proving the 2026-07-08 stale-write defect (frozen roomDir + global
// reg.active race, reproduced live) is impossible once
// lib/mcp/session-registry.cjs + the session-aware resolveWriteTargetDir land.
//
// D-01/D-02 design pin: the MCP connection sessionId IS the Phase-194 binding
// key (one namespace, no second store). This test drives the MCP write path
// itself -- resolveWriteTargetDir (lib/mcp/tool-router.cjs, exported via
// module.exports._test) + writeSessionBinding (lib/core/session-binding.cjs) --
// per the 198-02-PLAN.md Task 3 action, not a re-implementation of either.
//
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const toolRouter = require('../lib/mcp/tool-router.cjs');
const resolveWriteTargetDir = toolRouter._test.resolveWriteTargetDir;
const { writeSessionBinding } = require('../lib/core/session-binding.cjs');
const sessionRegistry = require('../lib/mcp/session-registry.cjs');

assert.strictEqual(typeof resolveWriteTargetDir, 'function', 'tool-router exports resolveWriteTargetDir via _test');
assert.strictEqual(typeof sessionRegistry.open, 'function', 'session-registry exports open()');

// --- hermetic fixture: isolated MINDRIAN_ROOMS_HOME with two real room dirs
// (resolveWriteRoom leg 2 requires session.primary to exist on disk) ---
const previousHome = process.env.MINDRIAN_ROOMS_HOME;
const previousFlag = process.env.MINDRIAN_MCP_FIRST;
const previousActiveRoomEnv = process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ACTIVE_ROOM; // hermetic: leg-1 override must not leak from the host env

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb198-concur-'));
const roomA = path.join(home, 'room-a');
const roomB = path.join(home, 'room-b');
fs.mkdirSync(roomA, { recursive: true });
fs.mkdirSync(roomB, { recursive: true });
const fallback = path.join(home, 'fallback-room');
fs.mkdirSync(fallback, { recursive: true });
process.env.MINDRIAN_ROOMS_HOME = home;

// D-02: the MCP connection sessionId IS the binding key -- a stdio-shim /
// hook-supplied string is accepted verbatim as the connection key.
sessionRegistry.open('sess-A');
sessionRegistry.open('sess-B');
assert.strictEqual(sessionRegistry.sessionIdFor('sess-A'), 'sess-A', 'session-registry resolves the hook-supplied id verbatim (one namespace, D-02)');
assert.strictEqual(sessionRegistry.sessionIdFor('sess-B'), 'sess-B', 'session-registry resolves the hook-supplied id verbatim (one namespace, D-02)');

// Session A bound to room-a; session B bound to room-b (Phase 194's shipped store).
writeSessionBinding('sess-A', { primary: 'room-a', bound: ['room-a'] }, { home: home });
writeSessionBinding('sess-B', { primary: 'room-b', bound: ['room-b'] }, { home: home });

try {
  // -------------------------------------------------------------------------
  // Replay the 2026-07-08 stale-room defect with the flag OFF: the racy
  // GLOBAL resolveActiveRoom (reg.active) wins regardless of which session is
  // writing. Simulate reg.active pointed at room-b (e.g. a co-session set it
  // active), then prove sess-A's write STILL lands in room-b -- the live
  // defect, reproduced under test.
  // -------------------------------------------------------------------------
  delete process.env.MINDRIAN_MCP_FIRST;
  const registryDir = path.join(home, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify({
    active: 'room-b',
    rooms: { 'room-b': { abs_path: roomB } },
  }));

  const misroutedA = resolveWriteTargetDir('sess-A', fallback, 'cli');
  assert.strictEqual(misroutedA, roomB, 'flag OFF: sess-A write is misrouted to reg.active room-b -- the 2026-07-08 defect, reproduced');

  // -------------------------------------------------------------------------
  // The defect becomes IMPOSSIBLE once the flag is ON: every write resolves
  // THIS session's own bound room, never the global reg.active field.
  // -------------------------------------------------------------------------
  process.env.MINDRIAN_MCP_FIRST = 'cli';

  const boundA = resolveWriteTargetDir('sess-A', fallback, 'cli');
  assert.strictEqual(boundA, roomA, 'flag ON: sess-A write lands in its OWN bound room-a, never room-b (the defect is now impossible)');

  // -------------------------------------------------------------------------
  // Two concurrent sessions, interleaved writes: every write lands in its own
  // room regardless of interleave order (the SPEC-1 flagship acceptance).
  // -------------------------------------------------------------------------
  const interleave = ['A', 'B', 'A', 'A', 'B', 'B', 'A'];
  for (const who of interleave) {
    const sid = who === 'A' ? 'sess-A' : 'sess-B';
    const expected = who === 'A' ? roomA : roomB;
    const got = resolveWriteTargetDir(sid, fallback, 'cli');
    assert.strictEqual(got, expected, `interleaved write for session ${sid} must land in its OWN room (got ${got}, expected ${expected})`);
  }

  console.log('PASS: test-198-concurrency-mcp (two sessions, interleaved writes, each lands in its own room; 2026-07-08 stale-room defect reproduced-then-impossible)');
} finally {
  sessionRegistry.close('sess-A');
  sessionRegistry.close('sess-B');
  if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST; else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  if (previousHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = previousHome;
  if (previousActiveRoomEnv === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoomEnv;
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}
process.exit(0);
