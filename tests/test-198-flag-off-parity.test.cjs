#!/usr/bin/env node
// Phase 198 SPEC-7 -- reversibility contract, AMENDED by Phase 248-01 (CTX-02).
//
// DOCTRINE CHANGE (named explicitly, per plan 248-01's objective and research
// pitfall 3 -- never slip a contract change into a commit message aside):
// this test used to prove that with MINDRIAN_MCP_FIRST unset (or empty),
// resolveWriteTargetDir "ignores sessionId entirely, byte-identical to
// pre-198 behavior" -- for EVERY session, bound or not. Phase 248-01
// (.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md)
// deliberately REPEALS that for BOUND sessions: lib/mcp/session-room.cjs now
// calls the core session-aware resolver UNCONDITIONALLY, so an explicit
// room_bind is authoritative for its session regardless of MINDRIAN_MCP_FIRST.
//
// What SURVIVES byte-identically: flag-off + UNBOUND session (no binding
// written, and no `.room-root` sentinel above cwd) still resolves EXACTLY as
// legacy did -- reg.active, then the boot-time fallback. That half of SPEC-7
// is unchanged and re-asserted below. What CHANGES: flag-off + BOUND session
// now resolves the binding, not reg.active -- asserted by the new "doctrine
// change" block below, which binds a session to a DIFFERENT room than
// reg.active so the two outcomes are distinguishable.
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
const { writeSessionBinding } = require('../lib/core/session-binding.cjs');

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
const roomX = path.join(home, 'room-x'); // a SECOND real room, distinct from reg.active, so a
fs.mkdirSync(roomX, { recursive: true }); // bound session's outcome is distinguishable from reg.active's.
const registryDir = path.join(home, '.rooms');
fs.mkdirSync(registryDir, { recursive: true });
fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify({
  active: 'room-c',
  rooms: {
    'room-c': { abs_path: roomC },
    'room-x': { abs_path: roomX },
  },
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

  // -------------------------------------------------------------------------
  // SURVIVES BYTE-IDENTICAL: flag-off + UNBOUND session. No binding was ever
  // written for these session ids, so they fall through to reg.active exactly
  // as pre-198 legacy did -- this half of SPEC-7 is unchanged by 248-01.
  // -------------------------------------------------------------------------
  const offNoSession = resolveWriteTargetDir(undefined, fallback, 'cli');
  assert.strictEqual(offNoSession, legacyExpected, 'flag-off, no sessionId: matches legacy resolveActiveRoom exactly');

  const offWithUnboundSession = resolveWriteTargetDir('some-session-not-bound-anywhere', fallback, 'cli');
  assert.strictEqual(offWithUnboundSession, legacyExpected, 'flag-off, UNBOUND sessionId: still matches legacy resolveActiveRoom (no binding to honor -- byte-identical legacy survives for unbound sessions)');

  // -------------------------------------------------------------------------
  // empty-string flag counts as unset too (D-07: "unset/empty = byte-identical legacy").
  // -------------------------------------------------------------------------
  process.env.MINDRIAN_MCP_FIRST = '';
  assert.strictEqual(isMcpFirst('cli'), false, 'empty MINDRIAN_MCP_FIRST -> isMcpFirst is false');
  const offEmptyFlag = resolveWriteTargetDir('some-session-not-bound-anywhere', fallback, 'cli');
  assert.strictEqual(offEmptyFlag, legacyExpected, 'empty-string flag, UNBOUND session: still byte-identical legacy');
  delete process.env.MINDRIAN_MCP_FIRST;

  // -------------------------------------------------------------------------
  // DOCTRINE CHANGE (Phase 248-01, CTX-02): flag-off + BOUND session now
  // resolves the binding, NOT reg.active. sess-bound-flagoff is bound to
  // room-x, which is deliberately NOT reg.active's room-c, so the two
  // possible outcomes are distinguishable -- a stale assertion that still
  // expected legacyExpected (room-c) here would fail loudly, not pass by
  // coincidence.
  // -------------------------------------------------------------------------
  writeSessionBinding('sess-bound-flagoff', { primary: 'room-x', bound: ['room-x'] }, { home: home });
  const boundFlagOff = resolveWriteTargetDir('sess-bound-flagoff', fallback, 'cli');
  assert.strictEqual(boundFlagOff, roomX, 'DOCTRINE CHANGE (248-01/CTX-02): flag-off, BOUND sessionId resolves the binding (room-x), not reg.active (room-c) -- the SPEC-7 "session ignored" contract is repealed for bound sessions');
  assert.notStrictEqual(boundFlagOff, legacyExpected, 'sanity: the bound outcome must differ from the unbound/legacy outcome, or this assertion proves nothing');

  // -------------------------------------------------------------------------
  // Sanity control: flipping the flag ON for this surface still resolves the
  // SAME session-aware path (now unconditional, so ON changes nothing new
  // here -- this control now proves ON and OFF agree for a bound session,
  // rather than proving OFF differs from ON).
  // -------------------------------------------------------------------------
  process.env.MINDRIAN_MCP_FIRST = 'cli';
  assert.strictEqual(isMcpFirst('cli'), true, 'sanity: MINDRIAN_MCP_FIRST=cli enables cli');
  const onResolved = resolveWriteTargetDir('sess-bound-flagoff', fallback, 'cli');
  assert.strictEqual(onResolved, roomX, 'sanity: flag ON resolves the SAME bound room (session.primary) the flag-OFF doctrine-change assertion above already proved');

  console.log('PASS: test-198-flag-off-parity (amended 248-01/CTX-02: flag-off + unbound stays byte-identical legacy; flag-off + bound now resolves the binding)');
} finally {
  if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST; else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  if (previousHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = previousHome;
  if (previousActiveRoomEnv === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoomEnv;
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}
process.exit(0);
