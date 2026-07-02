'use strict';
// Quick task 20260702-statusline-live-signals -- local statusline-liveness gate,
// parity with the Plurai judge.
//
// The gate reproduces the judge's live/stale verdict deterministically and OFFLINE
// (Part 8: nothing calls Plurai at runtime). Parity is proven against the labeled
// rows in evals/plurai/12-statusline-liveness-fidelity.csv. The liveness contract
// is HARDCODED (a gate that cannot fail is not a gate) -- no options object can talk
// a stale line into passing. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'core', 'statusline-liveness-gate.cjs'));
const CSV = path.join(REPO, 'evals', 'plurai', '12-statusline-liveness-fidelity.csv');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

// Minimal CSV parse: header + rows. Sample is a JSON object (may contain commas +
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

console.log('test-statusline-liveness-gate');

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));

ok('CSV parsed with both labels present', function () {
  assert.equal(rows.length >= 12, true, 'expected >= 12 labeled rows, got ' + rows.length);
  assert.equal(rows.some((r) => r.label === 'live'), true, 'has a live row');
  assert.equal(rows.some((r) => r.label === 'stale'), true, 'has a stale row');
});

ok('local gate matches the Plurai label on every row (parity)', function () {
  for (const r of rows) {
    const sample = JSON.parse(r.sample);
    const verdict = gate.judgeStatuslineLiveness(sample);
    assert.equal(verdict, r.label,
      'row mismatch: expected ' + r.label + ', got ' + verdict + ' for ' + r.sample);
  }
});

ok('the verdict IGNORES the options arg (the contract is the law, not a knob)', function () {
  const stale = { rendered: { next_move: 'continue', health: 'sound' },
                  state: { routed_next_move: 'map unknowns', room_health: 'sound' } };
  assert.equal(gate.judgeStatuslineLiveness(stale, { force: 'live' }), 'stale',
    'no options object can talk a stale line into live');
});

ok('a malformed sample degrades to stale (unverifiable is not provably live)', function () {
  assert.equal(gate.judgeStatuslineLiveness(null), 'stale');
  assert.equal(gate.judgeStatuslineLiveness({}), 'stale');
  assert.equal(gate.judgeStatuslineLiveness({ rendered: {} }), 'stale');
});

ok('this test file is em-dash-free', function () {
  const self = fs.readFileSync(__filename, 'utf8');
  const emDash = String.fromCharCode(0x2014);
  assert.equal(self.indexOf(emDash), -1, 'no em-dash in the test file');
});

console.log('  ' + n + ' checks passed');
