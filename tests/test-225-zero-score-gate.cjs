#!/usr/bin/env node
'use strict';
/*
 * Phase 225-01 (SEED-039 proving_case_2) -- the zero-score no-match gate
 * integration test. Spawns scripts/intent-classifier.cjs as a child process
 * against a temp fixture home and drives the five legs the plan names:
 *
 *   1. FIRE (REQ-1): a substantive reframe that scores 0 against every room, in
 *      a session with a bound primary, renders the F.8 "no room matched" gate
 *      offering continue-in-primary / start-a-new-project / no-room.
 *   2. SILENCE unbound (REQ-6): the same message with NO binding file -> silence.
 *   3. SILENCE floor (PD-3): a short (< 8 token) zero-score message -> silence.
 *   4. SILENCE once-per-session (PD-1): re-running leg 1 -> no second gate.
 *   5. SILENCE matched-room: an on-scope (score > 0) message -> silence.
 *
 * Plan-checker Warning 1 fix (load-bearing): 'copper-ledger' is registered FIRST
 * (so it is corpus[0], the arbitrary best.name on a zero score) and is NOT the
 * bound primary; 'quantum-bakery' is registered SECOND and IS the bound primary.
 * If a buggy implementation reused best.name it would emit 'copper-ledger'; the
 * FIRE assertion that stdout EXCLUDES 'copper-ledger' catches exactly that leak.
 *
 * The classifier's always-on Phase-91 navigation engine block also writes to
 * stdout, so silence is asserted on the zero-score gate's OWN distinctive markers
 * ('no room matched' / 'continue in quantum-bakery'), never on an empty stdout.
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
const { writeSessionBinding } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')
);

const SESSION_ID = 'sess-225-zeroscore';
const PRIMARY = 'quantum-bakery';
const CORPUS0 = 'copper-ledger'; // registered first -> best.name on a zero score

// The proving_case_2 reframe: >= 8 surviving tokens, zero fingerprint overlap with
// either room. (student / urban / mobility / transportation ... vs bakery / ledger.)
const REFRAME =
  'I am a student enrolled in an urban mobility course and our group project is '
  + 'about transportation and mobility planning for a mid sized city';
// A short zero-score message (< 8 surviving tokens): thanks/again/everyone/great/work.
const SHORT = 'thanks again everyone great work';
// A message rich in quantum-bakery fingerprint tokens (score > 0, on-scope), with NO
// room-name adjacency so it cannot trip the strict-mode slug path.
const MATCHED = 'let us review the sourdough croissant oven baking schedule today please';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------------------------------------------------------------------------
// Fixture: a rooms home with two rooms whose fingerprints share zero tokens with
// the reframe. copper-ledger is registered FIRST (corpus[0]); quantum-bakery is
// registered SECOND and pinned as the registry `active` (Warning 2 fix: the
// decision-trace path is resolved from an explicit active slug, not registration
// order).
// ---------------------------------------------------------------------------
function makeFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'p225-zeroscore-'));

  // Rooms + disjoint fingerprint content (name tokens + STATE.md project + body).
  const copperState =
    '---\nproject: Invoice Ledger Billing\n---\n# Copper Ledger\nAccounts Payable Register\n';
  const quantumState =
    '---\nproject: Sourdough Croissant Bakery\n---\n# Quantum Bakery\nOven Schedule Notes\n';
  fs.mkdirSync(path.join(home, CORPUS0), { recursive: true });
  fs.writeFileSync(path.join(home, CORPUS0, 'STATE.md'), copperState);
  fs.mkdirSync(path.join(home, PRIMARY), { recursive: true });
  fs.writeFileSync(path.join(home, PRIMARY, 'STATE.md'), quantumState);

  // Registry: object form preserves insertion order, so copper-ledger is corpus[0].
  // `active` is pinned explicitly to quantum-bakery.
  const registry = {
    active: PRIMARY,
    rooms: {},
  };
  registry.rooms[CORPUS0] = { slug: CORPUS0 };
  registry.rooms[PRIMARY] = { slug: PRIMARY };
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );

  return home;
}

function bindPrimary(home) {
  // Byte-equivalent binding via the shipped atomic writer: bound SET carries the
  // primary, primary is quantum-bakery.
  writeSessionBinding(SESSION_ID, { bound: [PRIMARY], primary: PRIMARY }, { home: home });
}

function bindingPath(home) {
  return path.join(home, '.rooms', 'sessions', SESSION_ID + '.json');
}

function tracePath(home) {
  return path.join(home, PRIMARY, '.mindrian', 'decision-traces', SESSION_ID + '.json');
}

function spawnClassifier(home, message) {
  const res = spawnSync(process.execPath, [CLASSIFIER], {
    input: JSON.stringify({ prompt: message }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_ROOT: home,
      MINDRIAN_ROOMS_HOME: home,
      CLAUDE_SESSION_ID: SESSION_ID,
    }),
    timeout: 30000,
  });
  return res;
}

const home = makeFixture();
try {
  console.log('test-225-zero-score-gate.cjs (SEED-039 proving_case_2): the zero-score no-match gate');

  // -------------------------------------------------------------------------
  // Leg 1: FIRE. Bound primary + substantive zero-score reframe -> the gate.
  // -------------------------------------------------------------------------
  check('leg 1 FIRE: bound-primary zero-score reframe renders the no-match gate (REQ-1/REQ-2)', () => {
    bindPrimary(home);
    const res = spawnClassifier(home, REFRAME);
    assert.strictEqual(res.status, 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') !== -1, 'stdout carries the no-match gate header');
    assert.ok(out.indexOf('continue in ' + PRIMARY) !== -1, 'gate offers continue-in-primary');
    assert.ok(out.indexOf('start a new project') !== -1, 'gate offers start-a-new-project');
    assert.ok(out.indexOf(CORPUS0) === -1,
      'REQ-2: the gate NEVER presents the arbitrary corpus[0] best.name (' + CORPUS0 + ')');
  });

  // -------------------------------------------------------------------------
  // Leg 1 trace proof (PD-5 consumer-compatibility): the persisted trace carries
  // a zero_score_gate entry whose binding_gate_payload.labelToSlug maps
  // 'start a new project' -> the reserved __no_room__ sentinel.
  // -------------------------------------------------------------------------
  check('leg 1 trace: zero_score_gate payload maps new-project -> __no_room__ (PD-5)', () => {
    const raw = fs.readFileSync(tracePath(home), 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(parsed && Array.isArray(parsed.traces), 'trace file has a traces array');
    let entry = null;
    for (let i = parsed.traces.length - 1; i >= 0; i--) {
      if (parsed.traces[i] && parsed.traces[i].kind === 'zero_score_gate') {
        entry = parsed.traces[i];
        break;
      }
    }
    assert.ok(entry, 'a zero_score_gate trace entry was persisted');
    assert.ok(entry.binding_gate_payload && typeof entry.binding_gate_payload === 'object',
      'the entry carries a binding_gate_payload (the shipped consumer key)');
    const map = entry.binding_gate_payload.labelToSlug || {};
    assert.strictEqual(map['start a new project'], '__no_room__',
      'labelToSlug maps new-project to the reserved no-room sentinel');
    assert.strictEqual(map['continue in ' + PRIMARY], PRIMARY,
      'labelToSlug maps continue-in-primary back to the primary slug');
  });

  // -------------------------------------------------------------------------
  // Leg 4: SILENCE once-per-session (PD-1). Re-run leg 1's exact spawn; the trace
  // now holds a zero_score_gate entry, so the gate must not fire a second time.
  // (Run before the state-mutating legs so the leg-1 trace is still in place.)
  // -------------------------------------------------------------------------
  check('leg 4 SILENCE once-per-session: the gate fires at most once per session (PD-1)', () => {
    const res = spawnClassifier(home, REFRAME);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') === -1, 'no second no-match gate header');
    assert.ok(out.indexOf('continue in ' + PRIMARY) === -1, 'no second continue-in-primary option');
  });

  // -------------------------------------------------------------------------
  // Leg 3: SILENCE floor (PD-3). A short (< 8 token) zero-score message with the
  // binding still present must not fire the gate.
  // -------------------------------------------------------------------------
  check('leg 3 SILENCE floor: a short zero-score message stays silent (PD-3)', () => {
    const res = spawnClassifier(home, SHORT);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') === -1, 'short message does not fire the gate');
  });

  // -------------------------------------------------------------------------
  // Leg 5: SILENCE matched-room. A message that scores > 0 against the bound
  // quantum-bakery is on-scope; the Phase-194 on-scope silence still governs it
  // and no zero-score gate fires.
  // -------------------------------------------------------------------------
  check('leg 5 SILENCE matched-room: an on-scope scored message stays silent', () => {
    const res = spawnClassifier(home, MATCHED);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') === -1, 'matched-room message does not fire the zero-score gate');
  });

  // -------------------------------------------------------------------------
  // Leg 2: SILENCE unbound (REQ-6). Delete the binding file; the reframe now has
  // no bound primary, so the gate must stay silent regardless of the message.
  // (Run last since it mutates the binding state.)
  // -------------------------------------------------------------------------
  check('leg 2 SILENCE unbound: no binding file -> legacy silence (REQ-6)', () => {
    try { fs.unlinkSync(bindingPath(home)); } catch (_) {}
    const res = spawnClassifier(home, REFRAME);
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') === -1, 'unbound session does not fire the gate');
    assert.ok(out.indexOf('continue in ' + PRIMARY) === -1, 'no continue-in-primary option when unbound');
  });

  console.log('');
  console.log('PASS test-225-zero-score-gate.cjs (' + passed + ' checks)');
  process.exit(0);
} catch (e) {
  console.error('FAIL test-225-zero-score-gate.cjs: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
} finally {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {}
}
