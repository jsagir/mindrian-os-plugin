#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 240 Plan 04 -- MEM-01 SC1 continuous-work leg, proven end to end.
 *
 * This file answers MEM-01 SC1's continuous-work leg: N consecutive
 * same-topic turns through the REAL scripts/jtbd-update.cjs hook must
 * produce a Layer 2 in_flight row, where before plan 240-04 they produced
 * zero (240-RESEARCH.md Finding 1's live proof: twelve consecutive
 * same-topic turns against a seeded room produced eleven "no transition"
 * early returns, exactly ONE promotion attempt on turn 1 (which failed at
 * turnCount = 1), zero Layer 2 rows).
 *
 * It drives the REAL scripts/jtbd-update.cjs via spawnSync rather than
 * calling library functions directly, because the defect this plan fixes
 * was REACHABILITY inside the hook (the unconditional early return at
 * jtbd-update.cjs:167-170 sat above the Phase 103-05 promotion block) --
 * a library-level test that calls promoteIfEligible() directly cannot see
 * that defect at all, since it never exercises the hook's own control flow.
 *
 * It seeds the operator (a decide-pursue-affinity BUILD_ROOM state) rather
 * than lowering the JUST_TALK 0.8 threshold, per locked decision D-3
 * (240-PATTERNS.md Correction 1). Both lib/hmi/jtbd-classifier.cjs and
 * lib/conversation/operator.cjs are READ-ONLY for this phase; this file
 * makes zero changes to either, and zero changes to the threshold logic.
 *
 * It asserts a real classification happened ABOVE threshold BEFORE it
 * asserts anything about promotion (Test 1, the non-vacuity guard), because
 * 240-RESEARCH.md Pitfall 1 showed twelve turns on a bare (unseeded) room
 * logging "below_threshold, top:decide-pursue@0.60" on every single turn --
 * a test without that guard measures nothing, and worse, would pass on the
 * FIRST run against unmodified pre-fix source (a vacuous green).
 *
 * Hermetic: every test builds its own mkdtempSync rooms home, injects it
 * explicitly into the child process env (never inherited), and removes it
 * in a finally block. Zero network reach. No em-dashes. No emoji.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOK_SCRIPT = path.join(REPO, 'scripts', 'jtbd-update.cjs');

// The empirically-proven 4-cue decide-pursue message (measured to score
// 0.800 with BUILD_ROOM seeded; see tests/test-jtbd-auto-anchor-empirical.sh
// and 240-PATTERNS.md's port note).
const CUE_MESSAGE = 'should we pursue this idea, pivot or double down or kill it or keep it';

let passed = 0;
let failed = 0;

function pass(label) { passed += 1; process.stdout.write('  PASS  ' + label + '\n'); }
function fail(label, err) {
  failed += 1;
  process.stdout.write('  FAIL  ' + label + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
function assert(cond, label, err) { if (cond) pass(label); else fail(label, err); }

// makeSeededRoom() -- a hermetic rooms home with one room seeded with an
// operator in decide-pursue's affinity set (BUILD_ROOM). Deliberately does
// NOT write a .rooms/registry.json: with no registry entry,
// resolveActiveRoom() (called inside jtbd-update.cjs's Phase 103-05 block
// to resolve roomSlug) returns null and the code falls back to
// path.basename(roomDir); logGraphTransition is then a graceful no-op for
// an unregistered slug (across-session-memory.cjs's own documented
// behavior), so no room.db is ever opened by this test fixture. That keeps
// this file's subject squarely the Layer 2 store (.memory/jtbd-history.json)
// rather than room.db, and keeps the fixture fast.
function makeSeededRoom(slug) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jtbd-240-04-'));
  const roomDir = path.join(home, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'conversation-operator.json'),
    JSON.stringify({
      schema_version: '1.0.0',
      current: 'BUILD_ROOM',
      previous: null,
      entered_at: '2026-05-24T00:00:00.000Z',
      context: {
        active_room: slug,
        active_section: null,
        methodology_in_flight: null,
        decision_gate_pending: null,
      },
      history: [],
    }, null, 2)
  );
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# ' + slug + '\n\n## Decisions\n\nNone yet.\n');
  return { home, roomDir, slug };
}

// makeUnseededRoom() -- same shape, but WITHOUT the operator file, so
// operator.getCurrent() falls back to the JUST_TALK default and the
// classifier threshold rises to 0.8 with the explore fallback boosted
// above any token-stratum candidate (Test 2, the anti-vacuity control).
function makeUnseededRoom(slug) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jtbd-240-04-'));
  const roomDir = path.join(home, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  return { home, roomDir, slug };
}

function cleanup(home) {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// runHook(home, roomDir, message) -- drives the REAL hook via spawnSync,
// exactly the shape every probe in 240-RESEARCH.md used. Explicit env
// injection, never inheritance.
function runHook(home, roomDir, message) {
  return spawnSync(process.execPath, [HOOK_SCRIPT, 'userprompt'], {
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: home,
      CLAUDE_ACTIVE_ROOM: roomDir,
      CLAUDE_USER_MESSAGE: message,
      MINDRIAN_DEBUG: '1',
    }),
    encoding: 'utf8',
    input: '',
  });
}

function readDebugLog(roomDir) {
  try {
    return fs.readFileSync(path.join(roomDir, '.mindrian', 'jtbd-update.log'), 'utf8');
  } catch (_e) { return ''; }
}

function readJtbdState(roomDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'jtbd-state.json'), 'utf8'));
  } catch (_e) { return null; }
}

function readMemoryFile(home) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, '.memory', 'jtbd-history.json'), 'utf8'));
  } catch (_e) { return null; }
}

function readAuditLog(home) {
  try {
    return fs.readFileSync(path.join(home, '.memory', 'audit.log'), 'utf8');
  } catch (_e) { return ''; }
}

function countOccurrences(haystack, needle) {
  if (!haystack) return 0;
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count += 1;
    idx += needle.length;
  }
  return count;
}

// =============================================================================
// Test 1: THE NON-VACUITY GUARD. Runs first; every test below depends on it,
// because a room where the operator gate fires (Pitfall 1) proves nothing
// about the reachability fix this plan lands.
// =============================================================================
(function test1_nonVacuityGuard() {
  const { home, roomDir } = makeSeededRoom('t1-non-vacuity');
  try {
    const r = runHook(home, roomDir, CUE_MESSAGE);
    assert(r.status === 0, 'test1: hook exits 0 (NON-VACUITY GUARD, everything below depends on this)', r);
    const log = readDebugLog(roomDir);
    assert(/event=userprompt jtbd=decide-pursue conf=0\.8/.test(log),
      'test1: debug log shows a REAL classification (conf=0.8) -- if red, check the operator seed and the taxonomy affinity (Pitfall 1)',
      new Error('log was: ' + log));
    assert(log.indexOf('classify null/below-threshold') === -1,
      'test1: debug log does NOT contain classify null/below-threshold',
      new Error('log was: ' + log));
  } finally {
    cleanup(home);
  }
})();

// =============================================================================
// Test 2: THE ANTI-VACUITY CONTROL. Proves test 1's guard is not decorative
// by reproducing Pitfall 1 on purpose, under observation.
// =============================================================================
(function test2_antiVacuityControl() {
  const { home, roomDir } = makeUnseededRoom('t2-anti-vacuity');
  try {
    const r = runHook(home, roomDir, CUE_MESSAGE);
    assert(r.status === 0, 'test2: hook exits 0 on an unseeded room', r);
    const log = readDebugLog(roomDir);
    assert(log.indexOf('classify null/below-threshold') !== -1,
      'test2: unseeded room (JUST_TALK default, threshold 0.8) reproduces Pitfall 1 -- classify null/below-threshold present',
      new Error('log was: ' + log));
    const statePath = path.join(roomDir, '.mindrian', 'jtbd-state.json');
    assert(!fs.existsSync(statePath), 'test2: jtbd-state.json was NOT created on an unseeded room', null);
  } finally {
    cleanup(home);
  }
})();

// =============================================================================
// Test 3: SC1 PROPER. Six consecutive same-topic turns must produce exactly
// one transition (turn 1), five non-transition ticks (turns 2-6), and a
// Layer 2 in_flight row -- the fact that was absent for any number of turns
// before this plan.
// =============================================================================
let test3Store = null;
let test3AuditCount = null;
(function test3_sc1Proper() {
  const { home, roomDir, slug } = makeSeededRoom('t3-sc1-proper');
  try {
    let lastLog = '';
    for (let i = 1; i <= 6; i += 1) {
      const r = runHook(home, roomDir, CUE_MESSAGE);
      assert(r.status === 0, 'test3: turn ' + i + ' hook exits 0', r);
      lastLog = readDebugLog(roomDir);
    }
    assert(/event=userprompt jtbd=decide-pursue conf=0\.8/.test(lastLog),
      'test3: turn 1 produced a real transition line (event=userprompt jtbd=decide-pursue)',
      new Error('log was: ' + lastLog));
    const noTransitionCount = countOccurrences(lastLog, 'no transition; same jtbd');
    assert(noTransitionCount === 5,
      'test3: exactly 5 "no transition; same jtbd" lines across 6 turns (proves the non-transition path was taken on turns 2-6)',
      new Error('observed count: ' + noTransitionCount + ', log was: ' + lastLog));

    const state = readJtbdState(roomDir);
    assert(!!state && !!state.current, 'test3: jtbd-state.json exists with a current block', state);
    assert(state && state.current && state.current.turn_count === 6,
      'test3: current.turn_count === 6', state && state.current);
    assert(state && Array.isArray(state.history) && state.history.length === 1,
      'test3: history.length === 1 (no per-turn row appended on non-transition turns)', state && state.history);
    const enteredAt = state && state.current && state.current.entered_at;
    const historyAt = state && state.history && state.history[0] && state.history[0].at;
    assert(!!enteredAt && enteredAt === historyAt,
      'test3: current.entered_at is byte-identical to the single transition row\'s at (dwell signal preserved across 6 turns)',
      new Error('entered_at=' + enteredAt + ' historyAt=' + historyAt));

    const mem = readMemoryFile(home);
    test3Store = mem;
    test3AuditCount = countOccurrences(readAuditLog(home), '\n');
    const room = mem && mem.rooms && mem.rooms[slug];
    const inFlightRow = room && Array.isArray(room.in_flight)
      ? room.in_flight.find(function (r2) { return r2 && r2.jtbd === 'decide-pursue'; })
      : null;
    assert(!!inFlightRow,
      'test3: SC1 -- rooms[slug].in_flight contains a decide-pursue entry (this is absent today after any number of turns)',
      mem);
  } finally {
    cleanup(home);
  }
})();

// =============================================================================
// Test 4: THE WRITE-VOLUME BOUND (240-RESEARCH.md Q3, resolution R-13). Six
// turns past the threshold must produce ONE in-place-updated row, not six.
// =============================================================================
(function test4_writeVolumeBound() {
  assert(!!test3Store, 'test4: test3 store snapshot is available', test3Store);
  if (!test3Store) return;
  const room = test3Store.rooms && test3Store.rooms['t3-sc1-proper'];
  assert(!!room && Array.isArray(room.in_flight), 'test4: room.in_flight is an array', room);
  if (!room || !Array.isArray(room.in_flight)) return;
  const decidePursueRows = room.in_flight.filter(function (r) { return r && r.jtbd === 'decide-pursue'; });
  assert(decidePursueRows.length === 1,
    'test4: exactly ONE in_flight entry for decide-pursue (in-place update, not one row per turn)',
    decidePursueRows);
  assert(decidePursueRows[0] && typeof decidePursueRows[0].turn_count === 'number' && decidePursueRows[0].turn_count >= 3,
    'test4: the single in_flight entry has turn_count >= 3 (NOISE_FLOOR_TURNS)',
    decidePursueRows[0]);
  assert(room.in_flight.length === 1,
    'test4: rooms[slug].in_flight.length === 1 overall (no stray rows)',
    room.in_flight);
  // Non-assertive, recorded for visibility: audit.log line count observed for
  // 6 turns against one room, so a future change in write volume is visible
  // in the SUMMARY rather than invisible.
  process.stdout.write('  INFO  test4: observed audit.log line count after 6 turns: ' + test3AuditCount + '\n');
})();

// =============================================================================
// Test 5: THE THRESHOLD IS NOT CROSSED EARLY (false-positive guard). Exactly
// TWO turns must NOT promote, because NOISE_FLOOR_TURNS is 3.
// =============================================================================
(function test5_thresholdNotCrossedEarly() {
  const { home, roomDir, slug } = makeSeededRoom('t5-threshold-floor');
  try {
    for (let i = 1; i <= 2; i += 1) {
      const r = runHook(home, roomDir, CUE_MESSAGE);
      assert(r.status === 0, 'test5: turn ' + i + ' hook exits 0', r);
    }
    const state = readJtbdState(roomDir);
    assert(state && state.current && state.current.turn_count === 2,
      'test5: current.turn_count === 2 after exactly two turns', state && state.current);
    const mem = readMemoryFile(home);
    const room = mem && mem.rooms && mem.rooms[slug];
    const inFlightRow = room && Array.isArray(room.in_flight)
      ? room.in_flight.find(function (r2) { return r2 && r2.jtbd === 'decide-pursue'; })
      : null;
    assert(!inFlightRow,
      'test5: no in_flight entry for decide-pursue at turn_count 2 (NOISE_FLOOR_TURNS = 3 not yet reached)',
      mem);
  } finally {
    cleanup(home);
  }
})();

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
