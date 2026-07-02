'use strict';
// Phase 204-04 -- local ignite-branch-routing gate, parity with the Plurai judge.
//
// Reproduces the judge's correct/incorrect verdict OFFLINE (Part 8). The five
// ROADMAP Phase 204 branch invariants are HARD checks: Gate B0 only fires when
// prior resumable rooms exist, a resumed room applies its own stored persona
// register and is never re-birthed, Just Talk never forces a room birth, and
// every fired gate renders through the pickShape SEED-020 door. Parity proven
// against evals/plurai/09-ignite-branch-routing.csv.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'core', 'ignite-branch-gate.cjs'));
const CSV = path.join(REPO, 'evals', 'plurai', '09-ignite-branch-routing.csv');
const BASELINE = path.join(REPO, 'evals', 'plurai', '204-baseline.json');

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

console.log('test-204-ignite-branch-gate');

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));

ok('CSV parsed with both labels present', function () {
  assert.equal(rows.length >= 16, true, 'expected >= 16 rows, got ' + rows.length);
  assert.equal(rows.some((r) => r.label === 'correct'), true);
  assert.equal(rows.some((r) => r.label === 'incorrect'), true);
});

ok('local gate matches the Plurai label on every row (parity)', function () {
  for (const r of rows) {
    const verdict = gate.classifyIgniteBranch(JSON.parse(r.sample));
    assert.equal(verdict.label, r.label, 'mismatch on row: ' + r.sample);
  }
});

ok('Gate B0 fired against an empty registry is ALWAYS incorrect, options ignored', function () {
  const trace = { has_resumable_rooms: false, gate_b0_fired: true, pick: 'room', birthed_new_room: false, resumed_without_register: false, rendered_via_pickshape: true };
  assert.equal(gate.classifyIgniteBranch(trace).label, 'incorrect');
  assert.equal(gate.classifyIgniteBranch(trace, { allow: true, force_pass: true }).label, 'incorrect');
  assert.deepStrictEqual(gate.classifyIgniteBranch(trace).violations, ['gate_fired_with_no_rooms']);
});

ok('each single ROADMAP-branch breach is flagged by its own violation name', function () {
  assert.equal(gate.classifyIgniteBranch({ has_resumable_rooms: true, gate_b0_fired: true, pick: 'room', resumed_without_register: true, rendered_via_pickshape: true }).violations.includes('resume_without_register'), true);
  assert.equal(gate.classifyIgniteBranch({ has_resumable_rooms: true, gate_b0_fired: true, pick: 'room', birthed_new_room: true, rendered_via_pickshape: true }).violations.includes('resume_births_new_room'), true);
  assert.equal(gate.classifyIgniteBranch({ has_resumable_rooms: true, gate_b0_fired: true, pick: 'just_talk', birthed_new_room: true, rendered_via_pickshape: true }).violations.includes('just_talk_births_room'), true);
  assert.equal(gate.classifyIgniteBranch({ has_resumable_rooms: true, gate_b0_fired: true, pick: 'room', rendered_via_pickshape: false }).violations.includes('not_rendered_via_pickshape'), true);
});

ok('a clean resume that applies its register is correct with no violations', function () {
  const clean = { has_resumable_rooms: true, gate_b0_fired: true, pick: 'room', birthed_new_room: false, resumed_without_register: false, rendered_via_pickshape: true };
  const v = gate.classifyIgniteBranch(clean);
  assert.equal(v.label, 'correct');
  assert.deepStrictEqual(v.violations, []);
});

ok('a no-prior-rooms skip (Gate B0 not fired) is correct', function () {
  const skip = { has_resumable_rooms: false, gate_b0_fired: false, pick: 'free_text', birthed_new_room: true, resumed_without_register: false, rendered_via_pickshape: false };
  assert.equal(gate.classifyIgniteBranch(skip).label, 'correct');
});

ok('a non-object trace degrades to all-false and never throws (pure + total)', function () {
  assert.equal(gate.classifyIgniteBranch(null).label, 'correct');
  assert.equal(gate.classifyIgniteBranch(undefined).label, 'correct');
  assert.equal(gate.classifyIgniteBranch(42).label, 'correct');
});

ok('204-baseline.json exists with precision/recall and the local gate meets it', function () {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  for (const k of ['precision', 'recall', 'accuracy', 'f1']) {
    assert.equal(typeof baseline[k] === 'number', true, 'baseline missing ' + k);
  }
  let correct = 0;
  for (const r of rows) {
    if (gate.classifyIgniteBranch(JSON.parse(r.sample)).label === r.label) correct += 1;
  }
  assert.equal((correct / rows.length) >= baseline.accuracy, true, 'local gate must meet-or-beat baseline');
});

console.log('\nPASS test-204-ignite-branch-gate (' + n + ' assertions)');
