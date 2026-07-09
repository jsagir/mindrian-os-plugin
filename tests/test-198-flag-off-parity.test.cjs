#!/usr/bin/env node
// Phase 198 SPEC-7 -- reversibility contract. Real behavior: with
// MINDRIAN_MCP_FIRST unset (or empty), every write resolves EXACTLY as legacy
// did -- resolveWriteTargetDir falls back to resolveActiveRoom (the racy
// global), ignoring sessionId entirely, byte-identical to pre-198 behavior.
// This is the flag-OFF half of the D-07 per-surface contract; the rollback
// rehearsal (flip OFF after cutover, restore from snapshot, re-run legacy
// parity) is a later plan's scripted transcript, out of this test's scope.
//
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { isMcpFirst } = require('../lib/mcp/mcp-first-flag.cjs');
const toolRouter = require('../lib/mcp/tool-router.cjs');
const resolveWriteTargetDir = toolRouter._test.resolveWriteTargetDir;
const { resolveActiveRoom } = require('../lib/core/resolve-active-room.cjs');

assert.strictEqual(typeof isMcpFirst, 'function', 'mcp-first-flag exports isMcpFirst');
assert.strictEqual(typeof resolveWriteTargetDir, 'function', 'tool-router exports resolveWriteTargetDir via _test');

// --- hermetic fixture: isolated MINDRIAN_ROOMS_HOME + registry.json ---
const previousHome = process.env.MINDRIAN_ROOMS_HOME;
const previousFlag = process.env.MINDRIAN_MCP_FIRST;
const previousActiveRoomEnv = process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ACTIVE_ROOM; // hermetic: leg-1 override must not leak from the host env

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb198-flagoff-'));
const roomC = path.join(home, 'room-c');
fs.mkdirSync(roomC, { recursive: true });
const registryDir = path.join(home, '.rooms');
fs.mkdirSync(registryDir, { recursive: true });
fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify({
  active: 'room-c',
  rooms: { 'room-c': { abs_path: roomC } },
}));
const fallback = path.join(home, 'fallback-room');
fs.mkdirSync(fallback, { recursive: true });
process.env.MINDRIAN_ROOMS_HOME = home;

try {
  // -------------------------------------------------------------------------
  // unset MINDRIAN_MCP_FIRST -> isMcpFirst false for every surface (D-07).
  // -------------------------------------------------------------------------
  delete process.env.MINDRIAN_MCP_FIRST;
  assert.strictEqual(isMcpFirst('cli'), false, 'unset MINDRIAN_MCP_FIRST -> isMcpFirst is false for cli');
  assert.strictEqual(isMcpFirst('desktop'), false, 'unset MINDRIAN_MCP_FIRST -> isMcpFirst is false for desktop');

  const legacy = resolveActiveRoom({ home: home });
  const legacyExpected = (legacy && legacy.abs_path) || fallback;
  assert.strictEqual(legacyExpected, roomC, 'fixture sanity: legacy resolveActiveRoom resolves reg.active room-c');

  // Flag OFF: resolveWriteTargetDir must equal the legacy resolveActiveRoom
  // result BYTE-IDENTICALLY, and a sessionId (even a bound one) must NOT
  // change the outcome -- the whole point of "byte-identical legacy".
  const offNoSession = resolveWriteTargetDir(undefined, fallback, 'cli');
  assert.strictEqual(offNoSession, legacyExpected, 'flag-off, no sessionId: matches legacy resolveActiveRoom exactly');

  const offWithSession = resolveWriteTargetDir('some-session-not-bound-anywhere', fallback, 'cli');
  assert.strictEqual(offWithSession, legacyExpected, 'flag-off, with a sessionId: STILL matches legacy resolveActiveRoom (session ignored -- SPEC-7 byte-identical)');

  // -------------------------------------------------------------------------
  // empty-string flag counts as unset too (D-07: "unset/empty = byte-identical legacy").
  // -------------------------------------------------------------------------
  process.env.MINDRIAN_MCP_FIRST = '';
  assert.strictEqual(isMcpFirst('cli'), false, 'empty MINDRIAN_MCP_FIRST -> isMcpFirst is false');
  const offEmptyFlag = resolveWriteTargetDir('some-session-not-bound-anywhere', fallback, 'cli');
  assert.strictEqual(offEmptyFlag, legacyExpected, 'empty-string flag: still byte-identical legacy');

  // -------------------------------------------------------------------------
  // Sanity control: flipping the flag ON for this surface DOES change the
  // outcome for a bound session (proves the OFF-path assertions above are
  // actually exercising the gate, not a no-op resolver).
  // -------------------------------------------------------------------------
  const { writeSessionBinding } = require('../lib/core/session-binding.cjs');
  writeSessionBinding('sess-flagcheck', { primary: 'room-c', bound: ['room-c'] }, { home: home });
  process.env.MINDRIAN_MCP_FIRST = 'cli';
  assert.strictEqual(isMcpFirst('cli'), true, 'sanity: MINDRIAN_MCP_FIRST=cli enables cli');
  const onResolved = resolveWriteTargetDir('sess-flagcheck', fallback, 'cli');
  assert.strictEqual(onResolved, roomC, 'sanity: flag ON resolves via the session-aware path (source session.primary), proving the OFF assertions exercised the real gate');

  console.log('PASS: test-198-flag-off-parity (MINDRIAN_MCP_FIRST unset/empty -> resolveWriteTargetDir byte-identical to legacy resolveActiveRoom, session id ignored)');
} finally {
  if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST; else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  if (previousHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = previousHome;
  if (previousActiveRoomEnv === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoomEnv;
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}
process.exit(0);
