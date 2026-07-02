'use strict';
// Phase 203-04 Task 2 -- local synthetic-expert BEHAVIORAL gate, parity with the
// Plurai fable judge (surface B).
//
// The gate reproduces the judge's faithful/costume verdict deterministically and
// OFFLINE (Part 8: nothing calls Plurai at runtime). Parity is proven against the
// labeled rows in evals/plurai/11-synthetic-expert-behavior.csv. The law is
// HARDCODED and the options arg is IGNORED (a gate that cannot fail is not a gate);
// no options object can talk a costume transcript into passing.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'core', 'synthetic-expert-behavior-gate.cjs'));
const CSV = path.join(REPO, 'evals', 'plurai', '11-synthetic-expert-behavior.csv');
const BASELINE = path.join(REPO, 'evals', 'plurai', '203-baseline.json');

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
    rows.push({ sample: fields[0], label: fields[1], reasoning: fields[2] });
  }
  return rows;
}

console.log('test-203-behavior-gate');

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));

ok('CSV parsed with both labels present and balanced', function () {
  assert.equal(rows.length >= 24, true, 'expected >= 24 rows, got ' + rows.length);
  const faithful = rows.filter((r) => r.label === 'faithful').length;
  const costume = rows.filter((r) => r.label === 'costume').length;
  assert.equal(faithful >= 12, true, 'expected >= 12 faithful rows, got ' + faithful);
  assert.equal(costume >= 12, true, 'expected >= 12 costume rows, got ' + costume);
});

ok('no literal em-dash or en-dash byte anywhere in the CSV file', function () {
  const raw = fs.readFileSync(CSV, 'utf8');
  assert.equal(/[—–]/.test(raw), false, 'the CSV file carries a banned dash byte');
});

ok('local gate matches the Plurai label on every row (parity)', function () {
  for (const r of rows) {
    const verdict = gate.classifyBehavior(JSON.parse(r.sample));
    assert.equal(verdict.label, r.label, 'mismatch on row: ' + r.sample);
  }
});

ok('every behavior violation type is represented in the costume rows', function () {
  const seen = new Set();
  for (const r of rows) {
    if (r.label !== 'costume') continue;
    for (const v of gate.classifyBehavior(JSON.parse(r.sample)).violations) seen.add(v);
  }
  for (const inv of gate.BEHAVIOR_INVARIANTS) {
    assert.equal(seen.has(inv.name), true, 'no costume row exercises invariant ' + inv.name);
  }
});

ok('a costume transcript stays a costume regardless of options (hard invariant)', function () {
  const costume = { hat: 'Black', domain: 'regulatory strategy', response: 'off topic entirely', in_lens: false, grounded: true, off_role: false };
  assert.equal(gate.classifyBehavior(costume).label, 'costume');
  assert.equal(gate.classifyBehavior(costume, { allow: true, force_pass: true }).label, 'costume');
  assert.deepStrictEqual(gate.classifyBehavior(costume).violations, ['out_of_lens']);
});

ok('an ungrounded claim and an off-role answer are each a costume', function () {
  assert.equal(
    gate.classifyBehavior({ hat: 'White', domain: 'd', response: 'trust me', in_lens: true, grounded: false, off_role: false }).violations.includes('ungrounded'),
    true);
  assert.equal(
    gate.classifyBehavior({ hat: 'Blue', domain: 'd', response: 'legal advice', in_lens: true, grounded: true, off_role: true }).violations.includes('off_role'),
    true);
});

ok('an in-character grounded in-role transcript is faithful with no violations', function () {
  const good = { hat: 'Black', domain: 'regulatory strategy', response: 'The caution lens reads the expert-graph node and flags a risk.', in_lens: true, grounded: true, off_role: false };
  const v = gate.classifyBehavior(good);
  assert.equal(v.label, 'faithful');
  assert.deepStrictEqual(v.violations, []);
});

// The baseline assertion (203-baseline.json) is added by Task 3; guard on existence
// so a partially-landed phase does not RED-fail this leg.
ok('203-baseline.json (when present) covers surface B and the local gate meets it', function () {
  if (!fs.existsSync(BASELINE)) { console.log('     (203-baseline.json not yet present; deferred to Task 3)'); return; }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const surfaceB = (baseline.surfaces || []).find((s) => s.source_csv && s.source_csv.indexOf('11-synthetic-expert-behavior.csv') !== -1);
  assert.ok(surfaceB, 'baseline carries the behavior surface');
  assert.equal(surfaceB.local_gate.indexOf('synthetic-expert-behavior-gate.cjs') !== -1, true, 'surface B names the behavior parity gate');
  let correct = 0;
  for (const r of rows) {
    if (gate.classifyBehavior(JSON.parse(r.sample)).label === r.label) correct += 1;
  }
  assert.equal((correct / rows.length) >= (surfaceB.accuracy || 1), true, 'local gate must meet-or-beat the surface B baseline');
});

console.log('\nPASS test-203-behavior-gate (' + n + ' assertions)');
