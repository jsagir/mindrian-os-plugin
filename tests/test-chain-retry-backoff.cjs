'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 166-03 Task 1 -- chain-retry.cjs reliability test (EXEC-05 / D-166-01)
 * ===========================================================================
 * Deterministic, no Math.random, no real network. A fault-injecting fn and an
 * INJECTED sleep recorder make every assertion exact and instant.
 *
 * Behaviors asserted (the plan's <behavior> block):
 *   T1  isTransient recognizes 500/502/503/529 (via .status / .statusCode / a
 *       parseable .message) as transient; 400/401/404/422 + validation/type as
 *       non-transient.
 *   T2  withBackoff(fn,{retries:3}) where fn throws transient TWICE then succeeds
 *       resolves with the success value after EXACTLY 2 retries (3 attempts).
 *   T3  withBackoff where fn throws a NON-transient error fails fast on attempt 1
 *       (no retry; attempts === 1).
 *   T4  withBackoff where fn ALWAYS throws transient exhausts after retries+1
 *       attempts and returns/throws an exhaustion marker naming the last code;
 *       backoff delays grow exponentially but are capped at maxDelayMs.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const retry = require(path.join(__dirname, '..', 'lib', 'core', 'chain-retry.cjs'));
const { isTransient, withBackoff } = retry;

let passed = 0;
function ok(label) { passed += 1; console.log('  ok - ' + label); }

// A fault-injecting fn factory. Throws the supplied errors in order, then
// resolves with `successValue`. Records every attempt.
function makeFn(errors, successValue) {
  let i = 0;
  const calls = { count: 0 };
  const fn = function () {
    calls.count += 1;
    const e = errors[i];
    i += 1;
    if (e) throw e;
    return successValue;
  };
  return { fn: fn, calls: calls };
}

// A transient-status error helper.
function transientErr(code, where) {
  const e = new Error('upstream ' + code + ' transient');
  if (where === 'status') e.status = code;
  else if (where === 'statusCode') e.statusCode = code;
  else e.message = 'HTTP ' + code + ' from synthesis agent';
  return e;
}

// ---------------------------------------------------------------------------
// T1: isTransient closed allow-list of the four 5xx codes.
// ---------------------------------------------------------------------------
(function t1() {
  // The four named transient codes via .status
  for (const code of [500, 502, 503, 529]) {
    assert.strictEqual(isTransient({ status: code }), true, 'status ' + code + ' transient');
  }
  // via .statusCode
  assert.strictEqual(isTransient({ statusCode: 503 }), true, 'statusCode 503 transient');
  // via a parseable message
  assert.strictEqual(isTransient(transientErr(529, 'message')), true, 'message 529 transient');
  // Non-transient: 4xx + validation + type errors
  for (const code of [400, 401, 404, 422]) {
    assert.strictEqual(isTransient({ status: code }), false, 'status ' + code + ' non-transient');
  }
  assert.strictEqual(isTransient(new TypeError('boom')), false, 'TypeError non-transient');
  assert.strictEqual(isTransient(new Error('validation failed')), false, 'validation non-transient');
  // A 501/504 (NOT in the closed four) is non-transient by the allow-list.
  assert.strictEqual(isTransient({ status: 501 }), false, '501 not in the closed set');
  assert.strictEqual(isTransient({ status: 504 }), false, '504 not in the closed set');
  assert.strictEqual(isTransient(null), false, 'null non-transient');
  assert.strictEqual(isTransient(undefined), false, 'undefined non-transient');
  ok('T1 isTransient recognizes only 500/502/503/529; everything else fails fast');
})();

// ---------------------------------------------------------------------------
// T2: transient-twice-then-success resolves after exactly 2 retries.
// ---------------------------------------------------------------------------
(async function t2() {
  const delays = [];
  const sleep = function (ms) { delays.push(ms); };
  const { fn, calls } = makeFn(
    [transientErr(500, 'status'), transientErr(502, 'statusCode')],
    { value: 'synthesized', quality: 'high' }
  );
  const result = await withBackoff(fn, { retries: 3, baseDelayMs: 10, maxDelayMs: 1000, sleep: sleep });
  assert.deepStrictEqual(result, { value: 'synthesized', quality: 'high' }, 'resolves success value');
  assert.strictEqual(calls.count, 3, 'exactly 3 attempts (initial + 2 retries)');
  assert.strictEqual(delays.length, 2, 'slept exactly twice (once per retry)');
  ok('T2 transient-twice-then-success resolves after exactly 2 retries');
})();

// ---------------------------------------------------------------------------
// T3: non-transient fails fast on attempt 1.
// ---------------------------------------------------------------------------
(async function t3() {
  const delays = [];
  const sleep = function (ms) { delays.push(ms); };
  const nonTransient = new Error('validation: bad input');
  nonTransient.status = 422;
  const { fn, calls } = makeFn([nonTransient], { value: 'unreached' });
  let threw = null;
  try {
    await withBackoff(fn, { retries: 3, baseDelayMs: 10, maxDelayMs: 1000, sleep: sleep });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, 'non-transient rethrows');
  assert.strictEqual(calls.count, 1, 'exactly 1 attempt (no retry on non-transient)');
  assert.strictEqual(delays.length, 0, 'never slept');
  ok('T3 non-transient error fails fast on the first attempt (attempts === 1)');
})();

// ---------------------------------------------------------------------------
// T4: exhaustion after retries+1 attempts; exhaustion marker names the last
// code; backoff delays grow but are capped.
// ---------------------------------------------------------------------------
(async function t4() {
  const delays = [];
  const sleep = function (ms) { delays.push(ms); };
  // Always throw transient. Last one is 529 so the marker names 529.
  const errs = [
    transientErr(500, 'status'),
    transientErr(502, 'status'),
    transientErr(503, 'status'),
    transientErr(529, 'status'),
  ];
  const { fn, calls } = makeFn(errs, { value: 'unreached' });
  const retries = 3;
  let marker = null;
  let threw = null;
  try {
    marker = await withBackoff(fn, {
      retries: retries,
      baseDelayMs: 100,
      maxDelayMs: 250,
      sleep: sleep,
      returnMarkerOnExhaust: true,
    });
  } catch (e) {
    threw = e;
  }
  // The caller opted into a returned marker (returnMarkerOnExhaust:true), so we
  // get a structured marker, not a throw.
  assert.ok(!threw, 'returnMarkerOnExhaust returns a marker rather than throwing');
  assert.ok(marker && marker.exhausted === true, 'marker.exhausted === true');
  assert.strictEqual(marker.code, 529, 'marker names the LAST transient code (529)');
  assert.strictEqual(marker.attempts, retries + 1, 'attempts === retries + 1');
  assert.strictEqual(calls.count, retries + 1, 'fn called retries+1 times');
  // Backoff bound: delays grow exponentially (baseDelayMs * 2^attempt) but are
  // capped at maxDelayMs. With base=100, cap=250: 100, 200, 250 (capped).
  assert.strictEqual(delays.length, retries, 'slept once per retry (retries times)');
  assert.strictEqual(delays[0], 100, 'first delay = baseDelayMs');
  assert.strictEqual(delays[1], 200, 'second delay = baseDelayMs * 2');
  assert.ok(delays[2] <= 250, 'third delay capped at maxDelayMs');
  for (const d of delays) {
    assert.ok(d <= 250, 'every delay is bounded by maxDelayMs (no unbounded growth, T-166-09)');
  }
  // And the default (no returnMarkerOnExhaust) THROWS an exhaustion marker.
  const { fn: fn2 } = makeFn([transientErr(503, 'status'), transientErr(503, 'status')], { value: 'x' });
  let thrown2 = null;
  try {
    await withBackoff(fn2, { retries: 1, baseDelayMs: 1, maxDelayMs: 1, sleep: function () {} });
  } catch (e) {
    thrown2 = e;
  }
  assert.ok(thrown2, 'default-mode exhaustion throws');
  assert.strictEqual(thrown2.exhausted, true, 'thrown error carries exhausted:true');
  assert.strictEqual(thrown2.code, 503, 'thrown error names the last transient code');
  ok('T4 exhaustion after retries+1 with a bounded, capped backoff and a named marker');
})();

// Allow the async IIFEs to settle, then print the tally.
setTimeout(function () {
  console.log('RETRY_OK ' + passed + '/4');
  if (passed !== 4) process.exit(1);
}, 50);
