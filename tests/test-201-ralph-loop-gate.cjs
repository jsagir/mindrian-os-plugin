'use strict';
// Phase 201-04 -- local Ralph-loop-behavior gate, parity with the Plurai judge.
//
// Reproduces the judge's correct/incorrect verdict OFFLINE (Part 8). The four SEED-033
// invariants are HARD checks: no material retry, bounded, verified-writes-only, no
// silent-proceed-after-cap. Parity proven against evals/plurai/08-ralph-loop-behavior.csv.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'core', 'ralph-loop-gate.cjs'));
const CSV = path.join(REPO, 'evals', 'plurai', '08-ralph-loop-behavior.csv');
const BASELINE = path.join(REPO, 'evals', 'plurai', '201-baseline.json');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

// CSV parse respecting double-quoted JSON cells with "" escapes.
function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  for (let i = 1; i < lines.length; i++) {
    const fields = [];
    let cur = '';
    let inQ = false;
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (inQ) {
        if (c === '"' && line[j + 1] === '"') { cur += '"'; j += 1; }
        else if (c === '"') { inQ = false; }
        else { cur += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { fields.push(cur); cur = ''; }
      else { cur += c; }
    }
    fields.push(cur);
    rows.push({ sample: fields[0], label: fields[1] });
  }
  return rows;
}

console.log('test-201-ralph-loop-gate');

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));

ok('CSV parsed with both labels present', function () {
  assert.equal(rows.length >= 16, true, 'expected >= 16 rows, got ' + rows.length);
  assert.equal(rows.some((r) => r.label === 'correct'), true);
  assert.equal(rows.some((r) => r.label === 'incorrect'), true);
});

ok('local gate matches the Plurai label on every row (parity)', function () {
  for (const r of rows) {
    const verdict = gate.classifyLoopTrace(JSON.parse(r.sample));
    assert.equal(verdict.label, r.label, 'mismatch on row: ' + r.sample);
  }
});

ok('a material retry is ALWAYS incorrect, regardless of options (hard invariant)', function () {
  const trace = { material_retried: true, bounded: true, unverified_write: false, silent_proceed_after_cap: false };
  assert.equal(gate.classifyLoopTrace(trace).label, 'incorrect');
  assert.equal(gate.classifyLoopTrace(trace, { allow: true, force_pass: true }).label, 'incorrect');
  assert.deepStrictEqual(gate.classifyLoopTrace(trace).violations, ['retried_material_step']);
});

ok('an unbounded loop and an unverified write are each incorrect', function () {
  assert.equal(gate.classifyLoopTrace({ unbounded: true }).violations.includes('unbounded'), true);
  assert.equal(gate.classifyLoopTrace({ unverified_write: true }).violations.includes('unverified_write'), true);
  assert.equal(gate.classifyLoopTrace({ silent_proceed_after_cap: true }).violations.includes('silent_proceed_after_cap'), true);
});

ok('a clean trace is correct with no violations', function () {
  const clean = { material_retried: false, bounded: true, unverified_write: false, silent_proceed_after_cap: false };
  const v = gate.classifyLoopTrace(clean);
  assert.equal(v.label, 'correct');
  assert.deepStrictEqual(v.violations, []);
});

ok('201-baseline.json exists with precision/recall and the local gate meets it', function () {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  for (const k of ['precision', 'recall', 'accuracy', 'f1']) {
    assert.equal(typeof baseline[k] === 'number', true, 'baseline missing ' + k);
  }
  let correct = 0;
  for (const r of rows) {
    if (gate.classifyLoopTrace(JSON.parse(r.sample)).label === r.label) correct += 1;
  }
  assert.equal((correct / rows.length) >= baseline.accuracy, true, 'local gate must meet-or-beat baseline');
});

console.log('\nPASS test-201-ralph-loop-gate (' + n + ' assertions)');
