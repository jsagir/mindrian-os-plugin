'use strict';
// Phase 200-03 -- local RS corpus-quality gate, parity with the Plurai judge.
//
// The gate reproduces the judge's degenerate/calibrated verdict deterministically
// and OFFLINE (Part 8: nothing calls Plurai at runtime). Parity is proven against
// the labeled rows in evals/plurai/07-rs-corpus-quality.csv. The degenerate
// signature is HARDCODED (a gate that cannot fail is not a gate) -- no options
// object can talk a degenerate set into passing.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'core', 'rs-corpus-quality-gate.cjs'));
const CSV = path.join(REPO, 'evals', 'plurai', '07-rs-corpus-quality.csv');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

// Minimal CSV parse: header + rows. Sample is a JSON array (may contain commas +
// escaped quotes), so parse fields respecting double-quoted cells with "" escapes.
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
    rows.push({ sample: fields[0], label: fields[1], reasoning: fields[2] });
  }
  return rows;
}

console.log('test-200-corpus-quality-gate');

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));

ok('CSV parsed with both labels present', function () {
  assert.equal(rows.length >= 20, true, 'expected >= 20 labeled rows, got ' + rows.length);
  assert.equal(rows.some((r) => r.label === 'degenerate'), true);
  assert.equal(rows.some((r) => r.label === 'calibrated'), true);
});

ok('local gate matches the Plurai label on every row (parity)', function () {
  for (const r of rows) {
    const pairs = JSON.parse(r.sample);
    const localDegenerate = gate.isDegeneratePairSet(pairs);
    const expectedDegenerate = r.label === 'degenerate';
    assert.equal(localDegenerate, expectedDegenerate,
      'mismatch on row (' + r.label + '): ' + r.sample);
  }
});

ok('the degenerate signature is hardcoded (no options can flip a degenerate set)', function () {
  const degenerate = [
    { semantic_score: 0.0, lsa_score: 1.0, signed_diff: -1.0 },
    { semantic_score: 0.0, lsa_score: 1.0, signed_diff: -1.0 },
    { semantic_score: 0.0, lsa_score: 1.0, signed_diff: -1.0 },
  ];
  assert.equal(gate.isDegeneratePairSet(degenerate), true);
  // Any permissive options object is ignored -- the gate cannot be told to pass it.
  assert.equal(gate.isDegeneratePairSet(degenerate, { allow: true, threshold: 0 }), true);
  assert.equal(gate.isDegeneratePairSet(degenerate, { force_pass: true }), true);
});

ok('an empty pair-set is not degenerate (nothing to judge)', function () {
  assert.equal(gate.isDegeneratePairSet([]), false);
  assert.equal(gate.isDegeneratePairSet(null), false);
});

ok('DEGENERATE_SIGNATURE is exported and frozen', function () {
  assert.equal(typeof gate.DEGENERATE_SIGNATURE, 'object');
  assert.equal(Object.isFrozen(gate.DEGENERATE_SIGNATURE), true);
});

ok('200-baseline.json exists with precision/recall keys and the local gate meets it', function () {
  const baseline = JSON.parse(fs.readFileSync(path.join(REPO, 'evals', 'plurai', '200-baseline.json'), 'utf8'));
  for (const k of ['precision', 'recall', 'accuracy', 'f1']) {
    assert.equal(typeof baseline[k] === 'number', true, 'baseline missing ' + k);
  }
  // The local gate reproduces every labeled row (proven by the parity test above),
  // so its accuracy is 1.0 -- it meets or beats the (deferred, hand-labeled) baseline.
  let correct = 0;
  for (const r of rows) {
    if (gate.isDegeneratePairSet(JSON.parse(r.sample)) === (r.label === 'degenerate')) correct += 1;
  }
  const localAccuracy = correct / rows.length;
  assert.equal(localAccuracy >= baseline.accuracy, true,
    'local gate accuracy ' + localAccuracy + ' must meet-or-beat baseline ' + baseline.accuracy);
});

console.log('\nPASS test-200-corpus-quality-gate (' + n + ' assertions)');
