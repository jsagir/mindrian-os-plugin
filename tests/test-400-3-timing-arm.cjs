#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 wave 2 Goldfish W2-CD-06: the retry rule of the timing arms (tests/helpers/timing-arm-4003.cjs).
 *
 * T1 a first-run pass runs once. T2 one breach then a pass: ok, 2 runs, label 'retry after 1 breach'. T3 two
 * breaches: not ok, label '2 breaches', both values in the label. T4 a throw counts as a breach. T5 the async form.
 * T6 each run prints its value and the load average. T7 the deterministic arms keep a hard bound: K1 of
 * tests/test-400-3-room-db-opener.cjs and C10 of tests/test-400-3-room-root-detection.cjs stay plain check() calls.
 * Usage: node tests/test-400-3-timing-arm.cjs
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const path = require('node:path');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
let H = null;
try { H = require(path.join(__dirname, 'helpers', 'timing-arm-4003.cjs')); } catch (e) { check('the helper loads', false, e.message); }

function seq(values, bound) {
  let i = 0;
  return () => { const v = values[i]; i += 1; if (v === 'throw') throw new Error('boom'); return { value: v, ok: v < bound, detail: { v } }; };
}
function capture(fn) {
  const orig = console.log;
  const lines = [];
  console.log = (...a) => { lines.push(a.join(' ')); };
  let out;
  try { out = fn(); } finally { console.log = orig; }
  return { out, lines };
}

async function main() {
  if (!H) { console.log('\n' + passed + ' passed, ' + (failed + 6) + ' failed'); process.exit(1); }
  const t1 = capture(() => H.timedSync('T1', '100 ms', seq([50, 999], 100)));
  check('T1 a first-run pass runs once', t1.out.ok === true && t1.lines.length === 1 && /first run/.test(t1.out.label), JSON.stringify(t1));
  const t2 = capture(() => H.timedSync('T2', '100 ms', seq([150, 60], 100)));
  check('T2 one breach then a pass: ok after 2 runs', t2.out.ok === true && t2.lines.length === 2 && /150, 60 ms; retry after 1 breach/.test(t2.out.label), JSON.stringify(t2));
  const t3 = capture(() => H.timedSync('T3', '100 ms', seq([150, 170], 100)));
  check('T3 two breaches: not ok, both values in the label', t3.out.ok === false && t3.lines.length === 2 && /150, 170 ms; 2 breaches/.test(t3.out.label), JSON.stringify(t3));
  const t4 = capture(() => H.timedSync('T4', '100 ms', seq(['throw', 'throw'], 100)));
  check('T4 a throw is a functional failure: not ok, not retried (W2R-01)', t4.out.ok === false && t4.lines.length === 1 && /functional failure, not retried/.test(t4.out.label), JSON.stringify(t4));
  const orig = console.log;
  const lines5 = [];
  console.log = (...a) => { lines5.push(a.join(' ')); };
  let t5;
  try { t5 = await H.timedAsync('T5', '100 ms', async () => ({ value: 120, ok: false, detail: null })); } finally { console.log = orig; }
  check('T5 the async form: 2 runs, not ok', t5.ok === false && lines5.length === 2, JSON.stringify({ t5, lines5 }));
  check('T6 each run line prints the value, the bound and the load average', t2.lines.every((l) => / ms \(bound 100 ms, load average [0-9. ]+|unknown\)/.test(l)), JSON.stringify(t2.lines));
  const t8 = capture(() => { let n = 0; return H.timedSync('T8', '100 ms', () => { n += 1; return n === 1 ? { value: 10, ok: false, funcOk: false, detail: 'func' } : { value: 10, ok: true, funcOk: true, detail: 'pass' }; }); });
  check('T8 a functional failure fails at once and is not retried (W2R-01)', t8.out.ok === false && t8.lines.length === 1 && /functional failure, not retried/.test(t8.out.label), JSON.stringify(t8));
  const t9 = capture(() => { let n = 0; return H.timedSync('T9', '100 ms', () => { n += 1; return n === 1 ? { value: 150, ok: false, funcOk: true, detail: 'slow' } : { value: 60, ok: true, funcOk: true, detail: 'pass' }; }); });
  check('T9 a time breach with the function intact still retries once', t9.out.ok === true && t9.lines.length === 2, JSON.stringify(t9));
  const k1 = fs.readFileSync(path.join(__dirname, 'test-400-3-room-db-opener.cjs'), 'utf8');
  const c10 = fs.readFileSync(path.join(__dirname, 'test-400-3-room-root-detection.cjs'), 'utf8');
  check('T7 K1 and C10 keep their hard bound: plain check() calls, the helper not used in the opener test',
    !/timing-arm-4003/.test(k1) && /\n\s*check\('K1 /.test(k1) && /\n\s*check\('C10 busy is reported within 750 ms/.test(c10) && /ms <= 750\)/.test(c10));
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
