'use strict';
// Phase 209-04 -- local card-fire-gate, parity with the Plurai judge.
//
// Reproduces the card-fired-vs-prose judge OFFLINE (Part 8). Four hard
// invariants: rendered_prose_instead_of_card, ascii_box_at_gate,
// no_card_at_declared_gate, trailer_present_card_absent. Parity proven
// against evals/plurai/13-native-fire.csv.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'core', 'card-fire-gate.cjs'));
const CSV = path.join(REPO, 'evals', 'plurai', '13-native-fire.csv');
const BASELINE = path.join(REPO, 'evals', 'plurai', '209-baseline.json');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

// Full-file, quote-aware CSV parser (embedded newlines inside quoted fields
// are preserved, unlike a naive line-split parser). Handles "" as an escaped
// quote and both \n and \r\n line endings.
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function toBool(v) { return v === 'true'; }

function loadRows() {
  const raw = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const header = raw[0];
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });
  return raw.slice(1).map((r) => ({
    id: r[idx.id],
    declared_gate: toBool(r[idx.declared_gate]),
    card_fired: toBool(r[idx.card_fired]),
    output_text: r[idx.output_text],
    trailer_present: toBool(r[idx.trailer_present]),
    label: r[idx.Label],
    note: r[idx.note],
  }));
}

console.log('test-209-card-fire-gate');

const rows = loadRows();

ok('CSV parsed with both labels present', function () {
  assert.equal(rows.length >= 16, true, 'expected >= 16 rows, got ' + rows.length);
  assert.equal(rows.some((r) => r.label === 'pass'), true);
  assert.equal(rows.some((r) => r.label === 'violation'), true);
});

ok('local gate matches the Plurai label on every row (parity)', function () {
  for (const r of rows) {
    const verdict = gate.classifyCardFireTrace({
      declared_gate: r.declared_gate,
      card_fired: r.card_fired,
      output_text: r.output_text,
      trailer_present: r.trailer_present,
    });
    assert.equal(verdict.classification, r.label, 'mismatch on row ' + r.id + ': ' + r.note);
  }
});

ok('HARD_VIOLATIONS is frozen and exports exactly the four named invariants', function () {
  assert.equal(Object.isFrozen(gate.HARD_VIOLATIONS), true);
  const names = gate.HARD_VIOLATIONS.map((v) => v.name).sort();
  assert.deepStrictEqual(names, [
    'ascii_box_at_gate',
    'no_card_at_declared_gate',
    'rendered_prose_instead_of_card',
    'trailer_present_card_absent',
  ]);
});

ok('a declared gate with no card is ALWAYS a violation, regardless of options (hard invariant)', function () {
  const trace = { declared_gate: true, card_fired: false, output_text: '[1] a [2] b', trailer_present: true };
  assert.equal(gate.classifyCardFireTrace(trace).classification, 'violation');
  assert.equal(gate.classifyCardFireTrace(trace, { disable: true }).classification, 'violation');
  const v = gate.classifyCardFireTrace(trace).violations;
  assert.equal(v.includes('ascii_box_at_gate'), true);
  assert.equal(v.includes('no_card_at_declared_gate'), true);
  assert.equal(v.includes('trailer_present_card_absent'), true);
});

ok('a bare U+25A0 glyph outside a gate is a pass (sanctioned UI vocabulary)', function () {
  const trace = { declared_gate: false, card_fired: false, output_text: 'the ■ glyph in a status row', trailer_present: false };
  const v = gate.classifyCardFireTrace(trace);
  assert.equal(v.classification, 'pass');
  assert.deepStrictEqual(v.violations, []);
});

ok('a fired card is always a pass regardless of output text shape', function () {
  const trace = { declared_gate: true, card_fired: true, output_text: '[1] a [2] b', trailer_present: true };
  assert.equal(gate.classifyCardFireTrace(trace).classification, 'pass');
});

ok('209-baseline.json exists with precision/recall and the local gate meets it', function () {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  for (const k of ['precision', 'recall', 'accuracy', 'f1']) {
    assert.equal(typeof baseline[k] === 'number', true, 'baseline missing ' + k);
  }
  assert.equal(baseline.baseline_deferred, true);
  let correct = 0;
  for (const r of rows) {
    const verdict = gate.classifyCardFireTrace({
      declared_gate: r.declared_gate,
      card_fired: r.card_fired,
      output_text: r.output_text,
      trailer_present: r.trailer_present,
    });
    if (verdict.classification === r.label) correct += 1;
  }
  assert.equal((correct / rows.length) >= baseline.accuracy, true, 'local gate must meet-or-beat baseline');
});

console.log('\nPASS test-209-card-fire-gate (' + n + ' assertions)');
