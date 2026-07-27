'use strict';
/*
 * Phase 233-02 Task 1 -- RCA item 4b: runDerivation's dead hosted-API default.
 * ===========================================================================
 * `.planning/debug/graph-derive-silent-clear-dead-api-derivation.md` Section 3
 * item 1 proved with a live probe that the hosted Anthropic account behind
 * lib/core/graph-candidate-producer.cjs returns 400 "credit balance is too low".
 * Until this gate, a caller that FORGOT to inject a deriveFn silently resolved
 * to that dead transport and got a live 400 instead of a loud contract error.
 *
 * This suite proves the gate against GROUND TRUTH, not mocks of runDerivation:
 * it calls the REAL runDerivation and spies on the REAL cached exports object of
 * graph-candidate-producer.cjs, so "the producer was never reached" is a
 * measured call count, not an assumption about control flow.
 *
 * Scenarios:
 *   1. no deriveFn, no opt-in                 -> throws deriveFn_required_no_hosted_default
 *   2. ... and the producer call count is 0   -> no network attempt was even reached
 *   3. ... and it threw BEFORE opening room.db (nothing written to the room)
 *   4. opt-in set, ANTHROPIC_API_KEY absent   -> still throws (funded-key half failed)
 *   5. opt-in set, ANTHROPIC_API_KEY empty    -> still throws
 *   6. opt-in set + non-empty key             -> resolves to produceCandidates (spy INVOKED)
 *   7. injected deriveFn, gate CLOSED         -> completely unaffected
 *   8. injected deriveFn, gate OPEN           -> completely unaffected
 *   9. the thrown message names the local producer escape hatch (Part 8 friendly)
 *  10. the thrown message leaks no runtime data (T-233-08)
 *
 * No em-dashes. CJS only, zero new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DERIVATION_PATH = path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs');
const PRODUCER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'graph-candidate-producer.cjs');

const { runDerivation } = require(DERIVATION_PATH);

// Spy on the REAL cached producer exports object. runDerivation's default path
// does `require('./graph-candidate-producer.cjs').produceCandidates` -- a PROPERTY
// read at call time -- so swapping the property on the shared exports object is
// what the gated code would actually reach. Call count 0 therefore proves the
// hosted transport was never even resolved, let alone dialed.
const producerModule = require(PRODUCER_PATH);
const REAL_PRODUCE_CANDIDATES = producerModule.produceCandidates;
let producerCalls = 0;
function producerSpy() {
  producerCalls += 1;
  return []; // a synchronous array, so runDerivation's sync composer accepts it
}

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

const GATE_TOKEN = 'deriveFn_required_no_hosted_default';
const OPT_IN = 'MINDRIAN_ALLOW_HOSTED_DERIVE';
const KEY = 'ANTHROPIC_API_KEY';

// Capture the ORIGINAL env so every scenario restores exactly what it found.
const ORIG_OPT_IN = Object.prototype.hasOwnProperty.call(process.env, OPT_IN)
  ? process.env[OPT_IN] : undefined;
const ORIG_KEY = Object.prototype.hasOwnProperty.call(process.env, KEY)
  ? process.env[KEY] : undefined;

function setEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function restoreEnv() {
  setEnv(OPT_IN, ORIG_OPT_IN);
  setEnv(KEY, ORIG_KEY);
}

// try/catch harness: returns the Error or null. Never rethrows, so a scenario
// that WRONGLY succeeds reports a clean assertion failure instead of a stack.
function callAndCatch(args) {
  try {
    return { err: null, res: runDerivation(args) };
  } catch (e) {
    return { err: e, res: null };
  }
}

function main() {
  console.log('test-233-derivation-default-gate (RCA 4b: gate the dead hosted-API default)');

  producerModule.produceCandidates = producerSpy;

  try {
    // -----------------------------------------------------------------------
    // Scenarios 1-3: gate CLOSED (no opt-in). Must throw, never reach the producer.
    // -----------------------------------------------------------------------
    const room1 = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-233-gate-closed-'));
    setEnv(OPT_IN, undefined);
    setEnv(KEY, 'a-key-that-must-not-matter-while-the-opt-in-is-absent');
    producerCalls = 0;
    const closed = callAndCatch({ roomDir: room1 });

    check('1. no deriveFn + no opt-in throws synchronously',
      closed.err instanceof Error && closed.res === null);
    check('1b. the error names ' + GATE_TOKEN,
      closed.err && String(closed.err.message).indexOf(GATE_TOKEN) !== -1);
    check('2. the hosted producer was NEVER invoked (call count 0, no network reached)',
      producerCalls === 0);
    check('3. it threw BEFORE opening room.db (no .mindrian written to the room)',
      !fs.existsSync(path.join(room1, '.mindrian', 'room.db')));

    // -----------------------------------------------------------------------
    // Scenarios 4-5: opt-in present but the funded-key half fails.
    // -----------------------------------------------------------------------
    setEnv(OPT_IN, '1');
    setEnv(KEY, undefined);
    producerCalls = 0;
    const noKey = callAndCatch({ roomDir: room1 });
    check('4. opt-in set but ANTHROPIC_API_KEY absent still throws the gated error',
      noKey.err instanceof Error && String(noKey.err.message).indexOf(GATE_TOKEN) !== -1
      && producerCalls === 0);

    setEnv(KEY, '');
    producerCalls = 0;
    const emptyKey = callAndCatch({ roomDir: room1 });
    check('5. opt-in set but ANTHROPIC_API_KEY empty still throws the gated error',
      emptyKey.err instanceof Error && String(emptyKey.err.message).indexOf(GATE_TOKEN) !== -1
      && producerCalls === 0);

    // -----------------------------------------------------------------------
    // Scenario 6: gate OPEN. The default must resolve to produceCandidates
    // itself -- identity-proven by the spy being the ONLY thing that could have
    // been invoked, not by "it did not throw".
    // -----------------------------------------------------------------------
    const room2 = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-233-gate-open-'));
    setEnv(OPT_IN, '1');
    setEnv(KEY, 'test-key-value');
    producerCalls = 0;
    const open = callAndCatch({ roomDir: room2 });
    check('6. explicit opt-in + a non-empty key resolves deriveFn to produceCandidates '
      + '(the spy WAS invoked, so the gate opens on deliberate configuration)',
      open.err === null && producerCalls === 1);

    // -----------------------------------------------------------------------
    // Scenarios 7-8: an INJECTED deriveFn is untouched by either env var.
    // -----------------------------------------------------------------------
    const room3 = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-233-injected-'));
    let injectedCalls = 0;
    const injected = () => { injectedCalls += 1; return []; };

    setEnv(OPT_IN, undefined);
    setEnv(KEY, undefined);
    producerCalls = 0;
    injectedCalls = 0;
    const inj1 = callAndCatch({ roomDir: room3, deriveFn: injected });
    check('7. an injected deriveFn is unaffected with the gate CLOSED',
      inj1.err === null && injectedCalls === 1 && producerCalls === 0);

    setEnv(OPT_IN, '1');
    setEnv(KEY, 'test-key-value');
    injectedCalls = 0;
    producerCalls = 0;
    const inj2 = callAndCatch({ roomDir: room3, deriveFn: injected });
    check('8. an injected deriveFn is unaffected with the gate OPEN',
      inj2.err === null && injectedCalls === 1 && producerCalls === 0);

    // -----------------------------------------------------------------------
    // Scenarios 9-10: the error message contract (developer-facing, data-free).
    // -----------------------------------------------------------------------
    const msg = closed.err ? String(closed.err.message) : '';
    check('9. the message points at the LOCAL score-based escape hatch and the opt-in',
      msg.indexOf('scoreBasedDeriveFn') !== -1 && msg.indexOf(OPT_IN) !== -1);
    check('10. the message leaks no runtime data (no room path, no key value) [T-233-08]',
      msg.indexOf(room1) === -1
      && msg.indexOf('a-key-that-must-not-matter-while-the-opt-in-is-absent') === -1);

    console.log(`\nPASS (${pass}/${pass}) -- RCA 4b gate holds; the dead default is no longer reachable by accident`);
  } finally {
    producerModule.produceCandidates = REAL_PRODUCE_CANDIDATES;
    restoreEnv();
  }
}

try {
  main();
} catch (e) {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
}
