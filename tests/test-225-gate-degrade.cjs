#!/usr/bin/env node
'use strict';
/*
 * Phase 225-01 (REQ-3) -- the zero-score no-match gate FAILS OPEN. Any
 * binding/trace fault degrades to exit-0 silence, never a hard block (Canon
 * 83-07). Two legs, both spawning the FIRE fixture with an injected fault:
 *
 *   1. POISONED binding: the session binding file is invalid JSON. readSessionBinding
 *      collapses to its safe default (primary null), so the branch never fires the
 *      gate -> exit 0, no gate output, no stderr crash.
 *   2. CORRUPT trace: a healthy binding but an invalid-JSON decision-trace file.
 *      zeroScoreGateAlreadyOffered's fail-open returns false, so the gate MAY fire;
 *      the never-block contract is the assertion (exit 0, no thrown stack), NOT the
 *      gate outcome.
 *
 * Follows the test-binding-gate-degrade.test.cjs style: assert-only, exit 0 on pass.
 * Node built-in assert only. No em-dashes. Temp dirs cleaned in a finally block.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

const SESSION_ID = 'sess-225-degrade';
const PRIMARY = 'quantum-bakery';
const CORPUS0 = 'copper-ledger';
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
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'p225-degrade-'));
  const copperState =
    '---\nproject: Invoice Ledger Billing\n---\n# Copper Ledger\nAccounts Payable Register\n';
  const quantumState =
    '---\nproject: Sourdough Croissant Bakery\n---\n# Quantum Bakery\nOven Schedule Notes\n';
  fs.mkdirSync(path.join(home, CORPUS0), { recursive: true });
  fs.writeFileSync(path.join(home, CORPUS0, 'STATE.md'), copperState);
  fs.mkdirSync(path.join(home, PRIMARY), { recursive: true });
  fs.writeFileSync(path.join(home, PRIMARY, 'STATE.md'), quantumState);

  const registry = { active: PRIMARY, rooms: {} };
  registry.rooms[CORPUS0] = { slug: CORPUS0 };
  registry.rooms[PRIMARY] = { slug: PRIMARY };
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  return home;
}

function writeRaw(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function bindingPath(home) {
  return path.join(home, '.rooms', 'sessions', SESSION_ID + '.json');
}

function tracePath(home) {
  return path.join(home, PRIMARY, '.mindrian', 'decision-traces', SESSION_ID + '.json');
}

function spawnClassifier(home) {
  return spawnSync(process.execPath, [CLASSIFIER], {
    input: JSON.stringify({ prompt: REFRAME }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_ROOT: home,
      MINDRIAN_ROOMS_HOME: home,
      CLAUDE_SESSION_ID: SESSION_ID,
    }),
    timeout: 30000,
  });
}

// A crash leaves a thrown stack on stderr; a clean fail-open does not. Node's own
// experimental-SQLite / circular-dependency warnings are benign, so match on the
// hard crash markers only.
function hasCrashStack(stderr) {
  const s = stderr || '';
  return /Error:|\bat\s+[\w$.<>]+\s+\(|Cannot read propert|is not a function|unhandledRejection|uncaughtException/.test(s);
}

const home = makeFixture();
try {
  console.log('test-225-gate-degrade.cjs (REQ-3): the no-match gate fails open to exit-0 silence');

  // -------------------------------------------------------------------------
  // Leg 1: POISONED binding -> safe default (primary null) -> gate never fires.
  // -------------------------------------------------------------------------
  check('leg 1 POISONED binding: invalid JSON degrades to exit-0 silence (never-block)', () => {
    writeRaw(bindingPath(home), '{ this is not valid json ');
    const res = spawnClassifier(home);
    assert.strictEqual(res.status, 0, 'exit 0 on a poisoned binding; got ' + res.status);
    assert.ok(!hasCrashStack(res.stderr), 'no thrown stack on stderr: ' + (res.stderr || ''));
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') === -1,
      'a poisoned binding (primary null) never fires the gate');
  });

  // -------------------------------------------------------------------------
  // Leg 2: healthy binding + CORRUPT trace -> zeroScoreGateAlreadyOffered
  // fail-opens to false; the never-block contract holds regardless of outcome.
  // -------------------------------------------------------------------------
  check('leg 2 CORRUPT trace: a healthy binding with an unreadable trace never crashes', () => {
    // Healthy binding (valid JSON with a real primary).
    writeRaw(bindingPath(home), JSON.stringify({
      bound: [PRIMARY], primary: PRIMARY, sticky: false, updated: new Date().toISOString(),
    }, null, 2));
    // Corrupt the decision-trace file the once-per-session scan reads.
    writeRaw(tracePath(home), '{ traces: [ broken ');
    const res = spawnClassifier(home);
    assert.strictEqual(res.status, 0, 'exit 0 on a corrupt trace; got ' + res.status);
    assert.ok(!hasCrashStack(res.stderr), 'no thrown stack on stderr: ' + (res.stderr || ''));
  });

  console.log('');
  console.log('PASS test-225-gate-degrade.cjs (' + passed + ' checks)');
  process.exit(0);
} catch (e) {
  console.error('FAIL test-225-gate-degrade.cjs: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
} finally {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {}
}
