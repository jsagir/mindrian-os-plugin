#!/usr/bin/env node
'use strict';
/*
 * Phase 106-02 D-02 context-window broadcast test.
 *
 * Replaces the Wave 0 stub. Asserts that scripts/context-monitor renders the
 * four D-02 glyphs (operator wrench, JTBD target, token-budget chart, blink-red
 * compaction-imminent warning) under their respective conditions.
 *
 * Hermetic strategy: per-test, mkdtempSync a roomDir; pre-stage
 * .mindrian/conversation-operator.json and/or .mindrian/jtbd-state.json fixtures;
 * spawn `node scripts/context-monitor` with stdin payload; assert stdout. Each
 * test creates its own tmp dir and rms it on the way out.
 *
 * Canon Part 8: zero network. Pure local filesystem reads.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'context-monitor');

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-02-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  // Legacy room marker so context-monitor resolves roomDir = <tmp>/room
  fs.mkdirSync(path.join(tmp, 'room'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'STATE.md'), '---\nphase: test\n---\n');
  return tmp;
}

function setOperator(roomDir, current) {
  // The legacy room marker is at <tmp>/room; operator state must live under it
  // so getCurrent(roomDir) reads from the resolved roomDir.
  const opDir = path.join(roomDir, 'room', '.mindrian');
  fs.mkdirSync(opDir, { recursive: true });
  fs.writeFileSync(
    path.join(opDir, 'conversation-operator.json'),
    JSON.stringify({
      schema_version: '1.0.0',
      current,
      previous: null,
      entered_at: new Date().toISOString(),
      context: {
        active_room: 'test',
        active_section: null,
        methodology_in_flight: null,
        decision_gate_pending: null,
      },
      history: [],
    })
  );
}

function setJtbd(roomDir, jtbd) {
  const jtbdDir = path.join(roomDir, 'room', '.mindrian');
  fs.mkdirSync(jtbdDir, { recursive: true });
  const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  fs.writeFileSync(
    path.join(jtbdDir, 'jtbd-state.json'),
    JSON.stringify({
      version: 1,
      current: {
        jtbd,
        confidence: 0.8,
        entered_at: new Date().toISOString(),
        evidence: [],
        expires_at: future,
      },
      history: [],
    })
  );
}

function runMonitor(roomDir, payloadObj) {
  return spawnSync('node', [SCRIPT], {
    input: JSON.stringify(payloadObj),
    cwd: roomDir,
    env: { ...process.env, HOME: roomDir, USERPROFILE: roomDir },
    encoding: 'utf8',
  });
}

function rmTmp(t) { fs.rmSync(t, { recursive: true, force: true }); }

function payload(usedPct) {
  return {
    model: { display_name: 'Sonnet' },
    workspace: { current_dir: '/tmp' },
    context_window: {
      used_percentage: usedPct,
      remaining_percentage: usedPct == null ? null : 100 - usedPct,
      context_window_size: 200000,
    },
  };
}

// Override workspace.current_dir per-room so the room resolver finds <room>/room
function payloadFor(room, usedPct) {
  const p = payload(usedPct);
  p.workspace.current_dir = room;
  return p;
}

// Test 1: operator + jtbd + 25% -> all three glyphs, no warning
{
  const room = makeRoom();
  setOperator(room, 'BUILD_ROOM');
  setJtbd(room, 'find-bottleneck');
  const r = runMonitor(room, payloadFor(room, 25));
  assert.strictEqual(r.status, 0, 'exit 0 (stderr: ' + r.stderr + ')');
  assert.match(r.stdout, /⚙️/, 'operator gear glyph');
  assert.match(r.stdout, /BUILD_ROOM/, 'operator name rendered');
  assert.match(r.stdout, /🎯/, 'jtbd target glyph');
  assert.match(r.stdout, /find-bottleneck/, 'jtbd name rendered');
  assert.match(r.stdout, /📊/, 'token-budget chart glyph');
  assert.ok(/\d+%/.test(r.stdout), 'percentage rendered');
  assert.ok(!/compaction-imminent/.test(r.stdout), 'no warning under 80');
  rmTmp(room);
  console.log('PASS: Test 1 (operator + jtbd + token at 25%)');
}

// Test 2: input 60% -> displayed 60% (sienna band per 50/65/80 threshold).
//
// This comment previously documented a displayed ~72%, from the pre-quick-task
// AUTO_COMPACT_BUFFER rescale (usable = ((remaining-16.5)/(100-16.5))*100, then
// displayed = round(100 - usable), giving 72 for an input of 60). That rescale is
// gone as of RCA statusline-context-pct-stale-post-compact (2026-07-28): the gauge
// now reports the host's raw used_percentage on ONE scale through both branches of
// lib/statusline/ctx-window.cjs, so an input of 60 displays as 60. Still inside the
// 50 <= used < 65 band, still no compaction warning.
{
  const room = makeRoom();
  const r = runMonitor(room, payloadFor(room, 60));
  assert.strictEqual(r.status, 0, 'exit 0 (stderr: ' + r.stderr + ')');
  assert.match(r.stdout, /📊/, 'token-budget glyph at sienna band');
  assert.ok(/\d+%/.test(r.stdout), 'percentage rendered');
  assert.ok(!/compaction-imminent/.test(r.stdout), 'no warning in sienna band');
  rmTmp(room);
  console.log('PASS: Test 2 (sienna band renders, no warning)');
}

// Test 3: input 85% -> displayed 100% (auto-compact math saturates at 100).
// remaining=15, usable=max(0,(15-16.5)/83.5*100)=0, displayed=100. That hits
// the >=80 branch which renders the compaction-imminent warning text wrapped
// in blink-red ANSI. The literal skull glyph (\u{1F480}) MUST NOT appear -- it
// was replaced as part of D-02.
{
  const room = makeRoom();
  const r = runMonitor(room, payloadFor(room, 85));
  assert.strictEqual(r.status, 0, 'exit 0 (stderr: ' + r.stderr + ')');
  assert.match(r.stdout, /📊/, 'token-budget glyph at warning band');
  assert.ok(/\d+%/.test(r.stdout), 'percentage rendered');
  // Single-line redesign (navigator-LOCKED 2026-06-29): the >=80% warning is now the
  // cliff preservation message + the red dot (emoji color), replacing the two-row's
  // "compaction-imminent" blink-red ANSI. Same threshold, navigator-language warning.
  assert.match(r.stdout, /file this insight to the room before it compacts/, 'cliff preservation warning present');
  assert.match(r.stdout, /🔴/, 'red cliff glyph carries the color (host-independent)');
  assert.ok(!r.stdout.includes('\u{1F480}'), 'no skull glyph');
  rmTmp(room);
  console.log('PASS: Test 3 (warning band shows cliff preservation message, no skull)');
}

// Test 4: missing operator state -> no gear glyph
{
  const room = makeRoom();
  // no setOperator call
  const r = runMonitor(room, payloadFor(room, 25));
  assert.strictEqual(r.status, 0, 'exit 0 (stderr: ' + r.stderr + ')');
  assert.ok(!/⚙️/.test(r.stdout), 'no operator glyph when state absent (defaults to JUST_TALK suppressed)');
  rmTmp(room);
  console.log('PASS: Test 4 (no operator state file -> no gear glyph)');
}

// Phase 109-02 amendment: 🎯 glyph is shared with the focus broadcast
// (D-01 Focus Node Model). Per RESEARCH Open Question 11.8 the planner
// amended this fence rather than introducing a new glyph; the auto-focus
// rule 1 cascade uses the JTBD anchor so the two signals are semantically
// correlated. The exclusivity invariants for 📊 (token-budget) and ⚙️
// (operator) remain unchanged.
//
// Test 5 broadened semantics: 🎯 is absent only when BOTH JTBD state AND
// active session focus are absent. The current hermetic fixture never
// seeds session_focus, so the post-amendment assertion still holds: no
// JTBD + no focus row -> no 🎯 glyph. Once Phase 109-02 wires the
// statusline-mos focus_segment into context-monitor in a follow-up plan,
// the inverse case (focus set, JTBD null -> 🎯 present) becomes
// independently testable; this fence will accept 🎯 in that context.
// Test 5: missing jtbd state AND no session_focus row -> no target glyph
{
  const room = makeRoom();
  // no setJtbd call; no session_focus seed
  const r = runMonitor(room, payloadFor(room, 25));
  assert.strictEqual(r.status, 0, 'exit 0 (stderr: ' + r.stderr + ')');
  assert.ok(!/🎯/.test(r.stdout), 'no 🎯 glyph when neither JTBD nor focus is active (Phase 109-02 amended fence)');
  rmTmp(room);
  console.log('PASS: Test 5 (no jtbd state file AND no focus -> no target glyph)');
}

// Test 6: operator current=JUST_TALK -> no gear glyph (default state suppressed)
{
  const room = makeRoom();
  setOperator(room, 'JUST_TALK');
  const r = runMonitor(room, payloadFor(room, 25));
  assert.strictEqual(r.status, 0, 'exit 0 (stderr: ' + r.stderr + ')');
  assert.ok(!/⚙️/.test(r.stdout), 'JUST_TALK default not broadcast');
  rmTmp(room);
  console.log('PASS: Test 6 (JUST_TALK default suppressed)');
}

// Test 7: used_percentage null -> no token-budget glyph (before first API call)
{
  const room = makeRoom();
  const r = runMonitor(room, payloadFor(room, null));
  assert.strictEqual(r.status, 0, 'exit 0 (stderr: ' + r.stderr + ')');
  assert.ok(!/📊/.test(r.stdout), 'no token-budget glyph when used_percentage is null');
  rmTmp(room);
  console.log('PASS: Test 7 (null used_percentage -> no token glyph)');
}

console.log('All 7 tests PASS');
process.exit(0);
