#!/usr/bin/env node
'use strict';
/*
 * Phase 225 REVIEW-FIX (CR-01 regression / WR-03 gap-closure) -- the zero-score
 * no-match gate's ANSWER-consumption path must never silently narrow a
 * multi-room session binding.
 *
 * CR-01 (reproduced by the code reviewer, then here): emitNoMatchGate offers
 * exactly three fixed labels (continue-in-primary / new-project / no-room) and
 * NEVER lists a session's other bound rooms as toggleable options (REQ-2:
 * never a scored room). consumeSessionBinding's sink write is a full REPLACE
 * of the session's `bound` array, not a union (session-binding-consumer.cjs:
 * 144-148). So a session multi-bound to ['room-a', 'room-b'] (sticky) that
 * answers the pre-checked default "continue in room-a" was silently
 * collapsing `bound` to ['room-a'] and clearing `sticky` to false -- 'room-b'
 * then became unwritable (scripts/write-scope-check.cjs hard-blocks any write
 * outside the session's bound set once the session is bound).
 *
 * This test constructs exactly that multi-bound session, fires the zero-score
 * gate, answers the pre-checked default option on a SECOND classifier turn,
 * then reads the session-binding file directly and asserts `bound` still
 * contains BOTH rooms and `sticky` is still true. Before the fix this test
 * fails (bound collapses to ['room-a'], sticky becomes false); after the fix
 * it passes (the answer-consumption path unions the confirmed picks with the
 * prior bound set for this gate kind, and preserves sticky when the gate's
 * own answer never carries a sticky field).
 *
 * Node built-in assert only. No em-dashes. Temp dirs cleaned in a finally block.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const { writeSessionBinding, readSessionBinding } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')
);

const SESSION_ID = 'sess-225-answer-narrowing';
const ROOM_A = 'room-a-primary';
const ROOM_B = 'room-b-sibling';

// A substantive (>= 8 surviving-token) reframe with zero fingerprint overlap
// against either room, so it scores 0 against both and clears the PD-3 floor.
const REFRAME =
  'I am a student enrolled in an urban mobility course and our group project is '
  + 'about transportation and mobility planning for a mid sized city';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function makeFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'p225-answer-narrowing-'));
  const aState =
    '---\nproject: Sourdough Croissant Bakery\n---\n# Room A Primary\nOven Schedule Notes\n';
  const bState =
    '---\nproject: Invoice Ledger Billing\n---\n# Room B Sibling\nAccounts Payable Register\n';
  fs.mkdirSync(path.join(home, ROOM_A), { recursive: true });
  fs.writeFileSync(path.join(home, ROOM_A, 'STATE.md'), aState);
  fs.mkdirSync(path.join(home, ROOM_B), { recursive: true });
  fs.writeFileSync(path.join(home, ROOM_B, 'STATE.md'), bState);

  const registry = { active: ROOM_A, rooms: {} };
  registry.rooms[ROOM_A] = { slug: ROOM_A };
  registry.rooms[ROOM_B] = { slug: ROOM_B };
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  return home;
}

function bindingPath(home) {
  return path.join(home, '.rooms', 'sessions', SESSION_ID + '.json');
}

function spawnClassifier(home, message) {
  return spawnSync(process.execPath, [CLASSIFIER], {
    input: JSON.stringify({ prompt: message }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_ROOT: home,
      MINDRIAN_ROOMS_HOME: home,
      CLAUDE_SESSION_ID: SESSION_ID,
      // RCA statusline-room-health-chip-never-updates: the bind-time job the
      // classifier reaches through consumeSessionBinding now writes the room-health
      // cache to HOME/.mindrian/room-health.json. Pin HOME to the fixture so this
      // test never overwrites the developer's real statusline health cache.
      HOME: home,
    }),
    timeout: 30000,
  });
}

const home = makeFixture();
try {
  console.log('test-225-answer-narrowing.cjs (CR-01 regression / WR-03): the zero-score gate answer must not narrow a multi-room bind');

  // -------------------------------------------------------------------------
  // Setup: a session multi-bound to BOTH rooms, sticky, primary = room-a. This
  // mirrors the on-disk shape the pre-existing (Phase 194) full-corpus F.8
  // binding gate produces after a navigator toggles on two rooms.
  // -------------------------------------------------------------------------
  writeSessionBinding(SESSION_ID, { bound: [ROOM_A, ROOM_B], primary: ROOM_A, sticky: true }, { home: home });

  check('setup: session is multi-bound to room-a + room-b, sticky', () => {
    const before = readSessionBinding(SESSION_ID, { home: home });
    assert.deepStrictEqual(before.bound.slice().sort(), [ROOM_A, ROOM_B].sort());
    assert.strictEqual(before.primary, ROOM_A);
    assert.strictEqual(before.sticky, true);
  });

  // -------------------------------------------------------------------------
  // Turn 1: a substantive zero-score reframe fires the "no room matched" gate,
  // pre-checked to "continue in room-a-primary".
  // -------------------------------------------------------------------------
  check('turn 1: zero-score reframe fires the no-match gate, pre-checked to continue-in-primary', () => {
    const res = spawnClassifier(home, REFRAME);
    assert.strictEqual(res.status, 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') !== -1, 'stdout carries the no-match gate header');
    assert.ok(out.indexOf('continue in ' + ROOM_A) !== -1, 'gate offers continue-in-primary');
  });

  // -------------------------------------------------------------------------
  // Turn 2: the navigator answers with the pre-checked default, the single
  // most natural response to this gate.
  // -------------------------------------------------------------------------
  check('turn 2: answering "continue in room-a-primary" is accepted (never-block)', () => {
    const res = spawnClassifier(home, 'continue in ' + ROOM_A);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
  });

  // -------------------------------------------------------------------------
  // CR-01 assertion: the sibling room (room-b) and sticky must SURVIVE
  // answering the gate. Before the fix, consumeSessionBinding's full-replace
  // write collapsed bound to just [room-a] and reset sticky to false.
  // -------------------------------------------------------------------------
  check('CR-01: bound still contains BOTH rooms and sticky survives after answering the gate', () => {
    const after = readSessionBinding(SESSION_ID, { home: home });
    assert.ok(after.bound.indexOf(ROOM_A) !== -1, 'room-a (primary) still bound: ' + JSON.stringify(after));
    assert.ok(after.bound.indexOf(ROOM_B) !== -1,
      'room-b (sibling) must NOT be silently dropped by answering the gate: ' + JSON.stringify(after));
    assert.strictEqual(after.primary, ROOM_A, 'primary stays room-a');
    assert.strictEqual(after.sticky, true,
      'sticky must be preserved (the zero-score gate answer carries no sticky field of its own): ' + JSON.stringify(after));
  });

  console.log('');
  console.log('PASS test-225-answer-narrowing.cjs (' + passed + ' checks)');
  process.exit(0);
} catch (e) {
  console.error('FAIL test-225-answer-narrowing.cjs: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
} finally {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {}
}
