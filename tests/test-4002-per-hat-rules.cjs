#!/usr/bin/env node
'use strict';
// Phase 400.2-07: the reading schema (S-6 with FS-4) and the per-hat rules (DESIGN 4.7 with FS-10, FS-11).
// Legs P1 to P10 (task 1: pure functions) and P11 to P14 (task 2: check and the Blue ledger).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');
const GOV_PATH = path.join(ROOT, 'lib', 'core', 'bono', 'hat-governance.cjs');
const ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

let door;
try {
  door = require(DOOR_PATH);
} catch (e) {
  console.log('FAIL: the door is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const RUN = '20261125-102030-abcd';
const SQ = ['sq-00000001', 'sq-00000002'];
const CTX = { runId: RUN, subQuestionIds: SQ };
const tmpRoots = [];
const NOW = new Date('2026-11-25T10:20:30.000Z');

function positions(hat, over) {
  const value = hat === 'green' ? 'alternative_offered' : 'favours';
  return SQ.map(id => Object.assign({ sub_question: id, value, line: 'A short line for ' + id + '.' }, over || {}));
}

function reading(hat, over) {
  const base = { schema: 'mos.persona-reading/1', run_id: RUN, hat };
  if (hat === 'blue') return Object.assign(base, { skipped: [], thin: ['The yellow hat found little.'], ask_next: ['Ask who pays first.'] }, over || {});
  base.positions = positions(hat);
  if (hat === 'white') Object.assign(base, { evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2', note: 'A fact.' }], missing_data: ['The price of rival plans.'], nothing_missing: false });
  if (hat === 'black') Object.assign(base, { evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2', disposition: 'disconfirming', note: 'A counter.' }, { source: 'EvidenceClaim:s1:bb', tier: 'T3', disposition: 'confirming' }], steelman: 'The best case for the retainer.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2' }] });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2' }] });
  return Object.assign(base, over || {});
}

// P1
check('P1. a valid reading of each of the six hats passes validateReading', () => {
  for (const h of HATS) {
    const r = door.validateReading(h, reading(h), CTX);
    assert.equal(r.ok, true, h + ': ' + JSON.stringify(r));
  }
  assert.deepEqual(door.READING_VALUES.positions.green, ['alternative_offered', 'no_position']);
  assert.ok(Object.isFrozen(door.READING_VALUES));
});

const FORBIDDEN = {
  white: ['justification', 'provocations', 'none_found', 'verdict', 'skipped', 'thin', 'ask_next'],
  red: ['evidence', 'justification', 'missing_data', 'provocations', 'none_found', 'verdict', 'self_search_strings', 'self_found_sources', 'skipped', 'thin', 'ask_next'],
  black: ['justification', 'provocations', 'none_found', 'verdict', 'missing_data', 'skipped', 'thin', 'ask_next'],
  yellow: ['justification', 'provocations', 'verdict', 'missing_data', 'skipped', 'thin', 'ask_next'],
  green: ['justification', 'verdict', 'none_found', 'missing_data', 'skipped', 'thin', 'ask_next'],
  blue: ['positions', 'evidence', 'justification', 'provocations', 'none_found', 'verdict', 'missing_data', 'self_search_strings', 'self_found_sources'],
};

// P2
check('P2. NEGATIVE: forbidden keys, unknown keys and each schema fault are refused by name', () => {
  for (const h of HATS) {
    for (const k of FORBIDDEN[h]) {
      const r = door.validateReading(h, reading(h, { [k]: ['x'] }), CTX);
      assert.equal(r.ok, false, h + ' ' + k);
      assert.equal(r.reason, 'forbidden_key:' + k, h + ' ' + k);
      assert.equal(r.state, 'rejected:forbidden_key:' + k);
    }
    const u = door.validateReading(h, reading(h, { bogus_key: 1 }), CTX);
    assert.equal(u.reason, 'unknown_key:bogus_key', h);
    // The old design key does not exist any more (owner answer 1).
    assert.equal(door.validateReading(h, reading(h, { validation_requests: [] }), CTX).reason, 'unknown_key:validation_requests', h);
  }
  const bad = (over, rx) => {
    const r = door.validateReading('black', reading('black', over), CTX);
    assert.equal(r.ok, false);
    assert.match(r.reason, rx);
  };
  bad({ positions: positions('black').slice(0, 1) }, /^schema_invalid:positions/);
  bad({ positions: positions('black').concat([{ sub_question: 'sq-00000009', value: 'favours', line: 'x' }]) }, /^schema_invalid:positions/);
  bad({ positions: [positions('black')[0], positions('black')[0]] }, /^schema_invalid:positions/);
  bad({ positions: [{ sub_question: 'sq-00000009', value: 'favours', line: 'x' }, positions('black')[1]] }, /^schema_invalid:positions\[0\]/);
  bad({ positions: [Object.assign({}, positions('black')[0], { value: 'alternative_offered' }), positions('black')[1]] }, /^schema_invalid:positions\[0\]\.value/);
  bad({ positions: [Object.assign({}, positions('black')[0], { line: 'x'.repeat(301) }), positions('black')[1]] }, /^schema_invalid:positions\[0\]\.line/);
  bad({ positions: [{ sub_question: SQ[0], value: 'favours' }, positions('black')[1]] }, /^schema_invalid:positions\[0\]\.line/);
  bad({ schema: 'nope' }, /^schema_invalid:schema/);
  bad({ run_id: 'other' }, /^schema_invalid:run_id/);
  bad({ hat: 'white' }, /^schema_invalid:hat/);
  assert.equal(door.validateReading('black', 'text', CTX).reason, 'schema_invalid:reading');
  // A no_position value needs no line.
  const np = reading('red');
  np.positions = SQ.map(id => ({ sub_question: id, value: 'no_position' }));
  assert.equal(door.validateReading('red', np, CTX).ok, true);
  // A black item needs a disposition of its two values.
  const noDisp = reading('black');
  delete noDisp.evidence[0].disposition;
  assert.equal(door.validateReading('black', noDisp, CTX).reason, 'schema_invalid:evidence[0].disposition');
  // A refused key name that is not a plain identifier is not echoed.
  const odd = reading('red');
  odd['<script>alert(1)</script>'] = 1;
  assert.equal(door.validateReading('red', odd, CTX).reason, 'unknown_key:_');
});

// P3
check('P3. a blue reading with positions, a green reading with favours and a red reading with evidence are refused', () => {
  const blue = door.validateReading('blue', reading('blue', { positions: positions('white') }), CTX);
  assert.equal(blue.reason, 'forbidden_key:positions');
  const green = reading('green');
  green.positions = positions('white');
  assert.match(door.validateReading('green', green, CTX).reason, /^schema_invalid:positions\[0\]\.value/);
  const red = door.validateReading('red', reading('red', { evidence: [{ source: 'x', tier: 'T1' }] }), CTX);
  assert.equal(red.reason, 'forbidden_key:evidence');
  // A thin entry of blue names a hat.
  assert.equal(door.validateReading('blue', reading('blue', { thin: ['It was thin.'] }), CTX).reason, 'schema_invalid:thin[0]');
});

// P4
check('P4. white rule lines', () => {
  const ok = (r) => door.perHatRules('white', r, { researchState: 'ran' });
  assert.deepEqual(ok(reading('white', { missing_data: [], nothing_missing: true })).lines, []);
  assert.deepEqual(ok(reading('white', { evidence: [] })).lines, ['white_no_evidence']);
  const untiered = reading('white');
  delete untiered.evidence[0].tier;
  assert.deepEqual(ok(untiered).lines, ['white_uncited_or_untiered_evidence']);
  assert.deepEqual(ok(reading('white', { missing_data: [], nothing_missing: false })).lines, ['white_missing_data_absent']);
  const bare = reading('white');
  delete bare.missing_data;
  delete bare.nothing_missing;
  assert.deepEqual(ok(bare).lines, ['white_missing_data_absent']);
  assert.deepEqual(ok(reading('white')).lines, []);
});

// P5
check('P5. red line of 26 words is a rule line; 25 words is not', () => {
  const words = (n) => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');
  const r26 = reading('red');
  r26.positions[0].line = words(26);
  assert.deepEqual(door.perHatRules('red', r26, {}).lines, ['red_line_too_long']);
  const r25 = reading('red');
  r25.positions[0].line = words(25);
  assert.deepEqual(door.perHatRules('red', r25, {}).lines, []);
});

// P6
check('P6. black rule lines', () => {
  const item = (d) => ({ source: 'EvidenceClaim:s1:aa', tier: 'T2', disposition: d });
  const rules = (ev) => door.perHatRules('black', reading('black', { evidence: ev }), {}).lines;
  assert.deepEqual(rules([item('confirming')]), ['black_no_disconfirming_evidence']);
  assert.deepEqual(rules([item('confirming'), item('disconfirming')]), ['black_confirming_before_disconfirming']);
  assert.deepEqual(rules([item('disconfirming'), item('confirming')]), []);
  assert.deepEqual(rules([]), ['black_no_disconfirming_evidence']);
});

// P7
check('P7. yellow rule lines and the two bases of none_found (FS-10)', () => {
  const y = (over, state) => door.perHatRules('yellow', reading('yellow', over), { researchState: state });
  const empty = { evidence: [], none_found: true };
  let r = y(empty, 'ran_empty');
  assert.deepEqual(r.lines, []);
  assert.equal(r.none_found_basis, 'door_search_empty');
  for (const state of ['failed', 'declined', 'not_planned:no_valid_handle']) {
    r = y(empty, state);
    assert.deepEqual(r.lines.filter(l => l === 'none_found_without_search'), ['none_found_without_search'], state);
    assert.equal(r.none_found_basis, null);
    r = y(Object.assign({ self_search_strings: ['pricing models for small studios'] }, empty), state);
    assert.deepEqual(r.lines, [], state);
    assert.equal(r.none_found_basis, 'self_reported_search');
  }
  r = y({ evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2' }], none_found: true }, 'ran');
  assert.deepEqual(r.lines, ['none_found_with_evidence']);
  r = y({ evidence: [] }, 'ran');
  assert.deepEqual(r.lines, ['yellow_value_not_evidence_backed']);
  assert.deepEqual(y({}, 'ran').lines, []);
});

// P8
check('P8. green rule lines', () => {
  assert.deepEqual(door.perHatRules('green', reading('green', { provocations: [] }), {}).lines, ['green_no_provocation_marker']);
  const withDisp = reading('green');
  withDisp.evidence[0].disposition = 'confirming';
  assert.deepEqual(door.perHatRules('green', withDisp, {}).lines, ['green_evidence_disposition']);
  assert.deepEqual(door.perHatRules('green', reading('green'), {}).lines, []);
});

// P9
check('P9. perHatRules for blue calls no governance function', () => {
  const gov = require(GOV_PATH);
  const original = gov.enforceGovernance;
  let calls = 0;
  gov.enforceGovernance = function spy() { calls += 1; return original.apply(this, arguments); };
  try {
    const out = door.perHatRules('blue', reading('blue'), {});
    assert.deepEqual(out.lines, []);
    assert.equal(calls, 0);
    door.perHatRules('white', reading('white'), {});
    assert.equal(calls, 1);
  } finally {
    gov.enforceGovernance = original;
  }
});

// P10
check('P10. self_found_sources (FS-4): valid for four hats, schema faults refused', () => {
  const found = (over) => Object.assign({ url: 'https://example.org/a', title: 'A page', search_string: 'retainer pricing', summary: 'A summary.' }, over || {});
  const base = { self_search_strings: ['retainer pricing'], self_found_sources: [found()] };
  for (const h of ['white', 'black', 'yellow', 'green']) {
    assert.equal(door.validateReading(h, reading(h, base), CTX).ok, true, h);
  }
  const bad = (src, strings) => door.validateReading('black', reading('black', { self_search_strings: strings || ['retainer pricing'], self_found_sources: src }), CTX);
  assert.match(bad([found({ search_string: 'other' })]).reason, /^schema_invalid:self_found_sources\[0\]\.search_string/);
  assert.match(bad([found({ url: 'ftp://example.org/a' })]).reason, /^schema_invalid:self_found_sources\[0\]\.url/);
  assert.match(bad([found({ url: 'javascript:alert(1)' })]).reason, /^schema_invalid:self_found_sources\[0\]\.url/);
  assert.match(bad(Array.from({ length: 31 }, () => found())).reason, /^schema_invalid:self_found_sources/);
  assert.match(bad([found({ summary: 'x'.repeat(301) })]).reason, /^schema_invalid:self_found_sources\[0\]\.summary/);
  assert.match(bad([found({ title: '' })]).reason, /^schema_invalid:self_found_sources\[0\]\.title/);
  assert.match(bad([found({ extra: 1 })]).reason, /^schema_invalid:self_found_sources\[0\]\.extra/);
  assert.match(bad([found()], Array.from({ length: 51 }, (_, i) => 's' + i)).reason, /^schema_invalid:self_search_strings/);
  assert.equal(bad([found()], ['retainer pricing']).ok, true);
});

// TASK2-LEGS-HERE

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
