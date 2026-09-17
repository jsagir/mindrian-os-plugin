#!/usr/bin/env node
'use strict';
/*
 * Quick task 260917-dia, Task B -- the F.8 binding gate's off-scope mislabel +
 * missing dedupe.
 *
 * ROOT CAUSE (verified by direct code reading, not re-derived here):
 * scripts/intent-classifier.cjs _runBindingGate(...) returns fire:true whenever
 * the CURRENT message's top lexical-match room is not a MEMBER of the session's
 * bound SET. That is an OFF-SCOPE mismatch, not an unbound session, but the fire
 * branch's emitBindingGate hardcodes the systemMessage
 * 'session unbound: choose which room(s) this session writes to' even when the
 * session HAS a real bound primary. Separately, emitBindingGate has no dedupe
 * (unlike the sibling zero-score gate's zeroScoreGateAlreadyOffered), so it
 * re-fires on every turn for the same off-scope room.
 *
 * Harness cloned from tests/test-225-zero-score-gate.cjs (makeFixture + the
 * spawnSync(process.execPath, [CLASSIFIER], {env:...}) block) per the plan's
 * behavior spec -- one shared harness shape, not a second invention.
 *
 * Fixture: three rooms with disjoint fingerprints (Section: tokenize() splits on
 * non-alnum, drops stopwords and single-char tokens; scoreRoom awards +5 for an
 * exact room-name-token match and +1 per surviving fingerprint token found in the
 * message, excluding the room's own name tokens and BRAND_STOP_SET entries):
 *   - quantum-bakery  the BOUND primary (sourdough / croissant / bakery / oven /
 *     baking / schedule)
 *   - copper-ledger   off-scope room Y, the top lexical match for message 1
 *     (invoice / ledger / billing / accounts / payable / register)
 *   - tin-orchard     off-scope room Z, the top lexical match for message 3
 *     (apple / orchard / harvest / pear / canning / facility)
 * Every token set is disjoint across all three rooms, so a message rich in one
 * room's fingerprint scores exactly 0 against the other two.
 *
 * Both MINDRIAN_ROOMS_HOME and MINDRIAN_ROOMS_ROOT are set to the fixture in the
 * spawn env (per the plan) so this test passes before AND after Task C changes
 * which var wins.
 *
 * Node built-in assert only. No em-dashes. Temp dirs cleaned in a finally block.
 *
 * Run: node tests/test-260917-binding-gate-offscope.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const { writeSessionBinding } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')
);

const SESSION_ID = 'sess-260917-binding-offscope';
const UNBOUND_SESSION_ID = 'sess-260917-binding-offscope-unbound';
const PRIMARY = 'quantum-bakery';
const OFFSCOPE_Y = 'copper-ledger';
const OFFSCOPE_Z = 'tin-orchard';

// Rich in copper-ledger's fingerprint tokens; zero overlap with quantum-bakery
// or tin-orchard. No room-name adjacency (no literal 'copper-ledger', no quotes,
// no numeric position) so this cannot trip the strict-mode path.
const MESSAGE_Y =
  'let us review the invoice ledger billing accounts payable register process '
  + 'for this week please';

// Rich in tin-orchard's fingerprint tokens; zero overlap with the other two rooms.
const MESSAGE_Z =
  'let us review the apple orchard harvest pear canning facility notes '
  + 'for this week please';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------------------------------------------------------------------------
// Fixture: a rooms home with three rooms + disjoint fingerprint content (name
// tokens + STATE.md project + body capitalized phrases).
// ---------------------------------------------------------------------------
function makeFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'p260917-bindoffscope-'));

  const bakeryState =
    '---\nproject: Sourdough Croissant Bakery\n---\n# Quantum Bakery\nOven Baking Schedule\n';
  const ledgerState =
    '---\nproject: Invoice Ledger Billing\n---\n# Copper Ledger\nAccounts Payable Register\n';
  const orchardState =
    '---\nproject: Apple Orchard Harvest\n---\n# Tin Orchard\nPear Canning Facility\n';

  fs.mkdirSync(path.join(home, PRIMARY), { recursive: true });
  fs.writeFileSync(path.join(home, PRIMARY, 'STATE.md'), bakeryState);
  fs.mkdirSync(path.join(home, OFFSCOPE_Y), { recursive: true });
  fs.writeFileSync(path.join(home, OFFSCOPE_Y, 'STATE.md'), ledgerState);
  fs.mkdirSync(path.join(home, OFFSCOPE_Z), { recursive: true });
  fs.writeFileSync(path.join(home, OFFSCOPE_Z, 'STATE.md'), orchardState);

  const registry = { active: PRIMARY, rooms: {} };
  registry.rooms[PRIMARY] = { slug: PRIMARY };
  registry.rooms[OFFSCOPE_Y] = { slug: OFFSCOPE_Y };
  registry.rooms[OFFSCOPE_Z] = { slug: OFFSCOPE_Z };
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );

  return home;
}

function bindPrimary(home, sessionId) {
  writeSessionBinding(sessionId, { bound: [PRIMARY], primary: PRIMARY }, { home: home });
}

function spawnClassifier(home, message, sessionId) {
  return spawnSync(process.execPath, [CLASSIFIER], {
    input: JSON.stringify({ prompt: message }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_ROOT: home,
      MINDRIAN_ROOMS_HOME: home,
      CLAUDE_SESSION_ID: sessionId,
    }),
    timeout: 30000,
  });
}

const home = makeFixture();
try {
  console.log('test-260917-binding-gate-offscope.cjs (260917-dia Task B): F.8 off-scope wording + dedupe');

  bindPrimary(home, SESSION_ID);

  // -------------------------------------------------------------------------
  // Leg 1 (RED today): off-scope message against a BOUND session must name the
  // bound primary and must NOT claim 'session unbound'.
  // -------------------------------------------------------------------------
  check('leg 1 wording: bound session off-scope match names the bound primary, not "session unbound"', () => {
    const res = spawnClassifier(home, MESSAGE_Y, SESSION_ID);
    assert.strictEqual(res.status, 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf(PRIMARY) !== -1, 'stdout names the bound primary (' + PRIMARY + ')');
    assert.ok(out.indexOf('session unbound') === -1,
      'stdout must NOT claim session unbound when a real bound primary exists');
  });

  // -------------------------------------------------------------------------
  // Leg 2 (RED today): the identical message sent again in the SAME session must
  // not re-fire the gate (per-session-per-off-scope-room dedupe).
  // -------------------------------------------------------------------------
  check('leg 2 dedupe: the identical off-scope message does not re-fire the gate', () => {
    const res = spawnClassifier(home, MESSAGE_Y, SESSION_ID);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('switch or stay') === -1,
      'no second fire of the off-scope binding gate (distinctive marker absent)');
    assert.ok(out.indexOf('bound to ' + PRIMARY) === -1,
      'no second fire of the off-scope binding gate (bound-to header absent)');
  });

  // -------------------------------------------------------------------------
  // Leg 3 (must pass before AND after): a genuinely unbound session (no binding
  // file at all, fresh session id) still gets the byte-identical legacy wording.
  // -------------------------------------------------------------------------
  check('leg 3 no-regression: a genuinely unbound session still sees "session unbound" byte-identically', () => {
    const res = spawnClassifier(home, MESSAGE_Y, UNBOUND_SESSION_ID);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(
      out.indexOf('session unbound: choose which room(s) this session writes to') !== -1,
      'the byte-identical legacy "session unbound" wording still renders for a genuinely unbound session'
    );
  });

  // -------------------------------------------------------------------------
  // Leg 4 (must pass after the fix): dedupe is per off-scope ROOM, not a whole-
  // session mute. A NEW off-scope room (tin-orchard) in the SAME bound session
  // must still fire, naming the bound primary.
  // -------------------------------------------------------------------------
  check('leg 4 dedupe is per-room: a new off-scope room in the same session still fires', () => {
    const res = spawnClassifier(home, MESSAGE_Z, SESSION_ID);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf(PRIMARY) !== -1,
      'the gate fires for the NEW off-scope room and names the bound primary (' + PRIMARY + ')');
    assert.ok(out.indexOf('session unbound') === -1,
      'still must not claim session unbound (this session IS bound)');
  });

  console.log('');
  console.log('PASS test-260917-binding-gate-offscope.cjs (' + passed + ' checks)');
  process.exit(0);
} catch (e) {
  console.error('FAIL test-260917-binding-gate-offscope.cjs: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
} finally {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {}
}
