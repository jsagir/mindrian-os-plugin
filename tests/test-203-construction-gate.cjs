'use strict';
// Phase 203-04 Task 1 -- local synthetic-expert CONSTRUCTION gate, parity with the
// Plurai fable judge (surface A).
//
// The gate reproduces the judge's faithful/hollow verdict deterministically and
// OFFLINE (Part 8: nothing calls Plurai at runtime). Parity is proven against the
// labeled rows in evals/plurai/10-synthetic-expert-construction.csv. The law is
// HARDCODED and the options arg is IGNORED (a gate that cannot fail is not a gate);
// no options object can talk a hollow construction into passing.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'core', 'synthetic-expert-construction-gate.cjs'));
const CSV = path.join(REPO, 'evals', 'plurai', '10-synthetic-expert-construction.csv');
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

console.log('test-203-construction-gate');

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));

ok('CSV parsed with both labels present and balanced', function () {
  assert.equal(rows.length >= 24, true, 'expected >= 24 rows, got ' + rows.length);
  const faithful = rows.filter((r) => r.label === 'faithful').length;
  const hollow = rows.filter((r) => r.label === 'hollow').length;
  assert.equal(faithful >= 12, true, 'expected >= 12 faithful rows, got ' + faithful);
  assert.equal(hollow >= 12, true, 'expected >= 12 hollow rows, got ' + hollow);
});

ok('no literal em-dash or en-dash byte anywhere in the CSV file', function () {
  const raw = fs.readFileSync(CSV, 'utf8');
  assert.equal(/[—–]/.test(raw), false, 'the CSV file carries a banned dash byte');
});

ok('local gate matches the Plurai label on every row (parity)', function () {
  for (const r of rows) {
    const verdict = gate.classifyConstruction(JSON.parse(r.sample));
    assert.equal(verdict.label, r.label, 'mismatch on row: ' + r.sample);
  }
});

ok('every construction violation type is represented in the hollow rows', function () {
  const seen = new Set();
  for (const r of rows) {
    if (r.label !== 'hollow') continue;
    for (const v of gate.classifyConstruction(JSON.parse(r.sample)).violations) seen.add(v);
  }
  for (const inv of gate.CONSTRUCTION_INVARIANTS) {
    assert.equal(seen.has(inv.name), true, 'no hollow row exercises invariant ' + inv.name);
  }
});

ok('a hollow construction stays hollow regardless of options (hard invariant)', function () {
  const costume = {
    hat: 'Blue',
    domain: 'acoustics',
    subdomain: 'room reverberation',
    beautiful_question: 'How should we sequence room reverberation work across the acoustics lenses?',
    research_approach: 'Orchestrate room reverberation across several frameworks (many hats), then set the plan.',
    lens_count: 4,
    distinct_source_count: 1,
  };
  assert.equal(gate.classifyConstruction(costume).label, 'hollow');
  assert.equal(gate.classifyConstruction(costume, { allow: true, force_pass: true }).label, 'hollow');
  assert.deepStrictEqual(gate.classifyConstruction(costume).violations, ['single_source_many_hats']);
});

ok('an invalid hat and a template question are each hollow', function () {
  assert.equal(
    gate.classifyConstruction({ hat: 'Purple', domain: 'a', subdomain: 'b', beautiful_question: 'about a and b', research_approach: 'cross-examine a across sources', lens_count: 2, distinct_source_count: 2 }).violations.includes('invalid_hat'),
    true);
  assert.equal(
    gate.classifyConstruction({ hat: 'Black', domain: 'a', subdomain: 'b', beautiful_question: 'What are the key considerations?', research_approach: 'cross-examine a across sources', lens_count: 2, distinct_source_count: 2 }).violations.includes('template_question'),
    true);
});

ok('a fully genuine construction is faithful with no violations', function () {
  const good = {
    hat: 'Black',
    domain: 'regulatory strategy',
    subdomain: 'clinical trials',
    beautiful_question: 'How does regulatory strategy hold up when the FDA and ISO lenses disagree about clinical trials?',
    research_approach: 'Cross-examine clinical trials through two frameworks (3 distinct sources), then synthesize.',
    lens_count: 4,
    distinct_source_count: 3,
  };
  const v = gate.classifyConstruction(good);
  assert.equal(v.label, 'faithful');
  assert.deepStrictEqual(v.violations, []);
});

// The baseline assertion (203-baseline.json) is added by Task 3; guard on existence
// so a partially-landed phase does not RED-fail this leg.
ok('203-baseline.json (when present) covers surface A and the local gate meets it', function () {
  if (!fs.existsSync(BASELINE)) { console.log('     (203-baseline.json not yet present; deferred to Task 3)'); return; }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const surfaceA = (baseline.surfaces || []).find((s) => s.source_csv && s.source_csv.indexOf('10-synthetic-expert-construction.csv') !== -1);
  assert.ok(surfaceA, 'baseline carries the construction surface');
  assert.equal(surfaceA.local_gate.indexOf('synthetic-expert-construction-gate.cjs') !== -1, true, 'surface A names the construction parity gate');
  let correct = 0;
  for (const r of rows) {
    if (gate.classifyConstruction(JSON.parse(r.sample)).label === r.label) correct += 1;
  }
  assert.equal((correct / rows.length) >= (surfaceA.accuracy || 1), true, 'local gate must meet-or-beat the surface A baseline');
});

console.log('\nPASS test-203-construction-gate (' + n + ' assertions)');
