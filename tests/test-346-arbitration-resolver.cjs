'use strict';
// Phase 346-04 -- assertions over lib/core/arbitration.cjs: resolveArbitration,
// the composed three-axis result, the honest input/floor census, and the
// persona clamp (Task 1). Task 2 extends this same file with the cold-start
// sweep and the hostile-input matrix.
//
// TDD RED-then-GREEN, one task at a time. House idiom: node:assert/strict,
// `let n = 0; function ok(...)`, final line
// `>>> test-346-arbitration-resolver.cjs: PASSED`.
//
// House rule: hyphens only, no em-dashes. Zero network, zero tmp dirs (the
// module under test is pure).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'arbitration.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-346-arbitration-resolver');

assert.ok(fs.existsSync(MODULE_PATH), 'lib/core/arbitration.cjs must exist');
delete require.cache[require.resolve(MODULE_PATH)];
const a = require(MODULE_PATH);
const decisionAxes = require(path.join(REPO, 'lib', 'core', 'decision-axes.cjs'));
const personaTaxonomy = require(path.join(REPO, 'lib', 'core', 'persona-taxonomy.cjs'));

// ---------------------------------------------------------------------------
// Task 1: the closed vocabularies, the composed result shape, the census,
// the floors, and the persona clamp
// ---------------------------------------------------------------------------

ok('ARBITRATION_VERSION is the string 1.0', function () {
  assert.equal(a.ARBITRATION_VERSION, '1.0');
});

ok('RANKED_ORDER is frozen and equals [enforcement, delivery, autonomy]', function () {
  assert.deepEqual(a.RANKED_ORDER, ['enforcement', 'delivery', 'autonomy']);
  assert.ok(Object.isFrozen(a.RANKED_ORDER));
});

ok('ARBITRATION_INPUTS is frozen and equals the six roadmap inputs, in order', function () {
  assert.deepEqual(a.ARBITRATION_INPUTS, ['role_blend', 'jtbd', 'rung', 'escape_hatch', 'stall_count', 'surface']);
  assert.ok(Object.isFrozen(a.ARBITRATION_INPUTS));
});

ok('FLOOR_TOKENS is frozen and contains at least the five named floors', function () {
  assert.ok(Object.isFrozen(a.FLOOR_TOKENS));
  ['part8_egress', 'write_scope', 'part12_glyph', 'no_fabricated_numbers', 'cold_start_guided'].forEach(function (t) {
    assert.ok(a.FLOOR_TOKENS.indexOf(t) !== -1, 'FLOOR_TOKENS must contain: ' + t);
  });
});

ok('DELIVERY_RATIONALES and AUTONOMY_RATIONALES are frozen non-empty arrays', function () {
  assert.ok(Object.isFrozen(a.DELIVERY_RATIONALES));
  assert.ok(Object.isFrozen(a.AUTONOMY_RATIONALES));
  assert.ok(a.DELIVERY_RATIONALES.length > 0);
  assert.ok(a.AUTONOMY_RATIONALES.length > 0);
});

ok('DELIVERY_RATIONALES expands detent_act_and_report over ROLE_LEVELS plus generic, read live', function () {
  personaTaxonomy.ROLE_LEVELS.concat(['generic']).forEach(function (who) {
    assert.ok(a.DELIVERY_RATIONALES.indexOf('detent_act_and_report:' + who) !== -1, 'missing detent token for: ' + who);
  });
});

ok('resolveArbitration({}) returns exactly the eight documented keys', function () {
  const r = a.resolveArbitration({});
  const keys = Object.keys(r).sort().join(',');
  assert.equal(keys, 'arbitration_version,autonomy,delivery,enforcement,floors_applied,inputs_missing,inputs_read,ranked');
});

ok('resolveArbitration({}) has empty inputs_read and inputs_missing equal to ARBITRATION_INPUTS, in order', function () {
  const r = a.resolveArbitration({});
  assert.deepEqual(r.inputs_read, []);
  assert.deepEqual(r.inputs_missing, a.ARBITRATION_INPUTS);
});

ok('inputs_read and inputs_missing are always disjoint and union to ARBITRATION_INPUTS', function () {
  const cases = [
    {},
    { role_blend: { founder: 0.9 } },
    { jtbd: { jtbd: 'x', confidence: 0.5 } },
    { rung: 'UDP' },
    { escape_hatch: { user_said_just_tell_me: true, user_said_bottom_line: false } },
    { stall_count: 3 },
    { surface: 'cli' },
  ];
  cases.forEach(function (c) {
    const r = a.resolveArbitration(c);
    const union = r.inputs_read.concat(r.inputs_missing).sort();
    assert.deepEqual(union, a.ARBITRATION_INPUTS.slice().sort(), 'union mismatch for: ' + JSON.stringify(c));
    r.inputs_read.forEach(function (k) {
      assert.ok(r.inputs_missing.indexOf(k) === -1, 'not disjoint: ' + k);
    });
  });
});

ok('stall_count null is missing; stall_count 0 is read (zero is a real signal)', function () {
  const n1 = a.resolveArbitration({ stall_count: null });
  const z = a.resolveArbitration({ stall_count: 0 });
  assert.ok(n1.inputs_missing.indexOf('stall_count') !== -1);
  assert.ok(z.inputs_read.indexOf('stall_count') !== -1);
});

ok('floors_applied always contains part12_glyph and no_fabricated_numbers, for hostile-shaped input', function () {
  [null, undefined, 'x', [], 42, {}].forEach(function (v) {
    const r = a.resolveArbitration(v);
    assert.ok(r.floors_applied.indexOf('part12_glyph') !== -1, 'missing part12_glyph for: ' + String(v));
    assert.ok(r.floors_applied.indexOf('no_fabricated_numbers') !== -1, 'missing no_fabricated_numbers for: ' + String(v));
  });
});

ok('floors_applied contains cold_start_guided exactly when is_cold_start or is_first_material is true', function () {
  assert.ok(a.resolveArbitration({ is_cold_start: true }).floors_applied.indexOf('cold_start_guided') !== -1);
  assert.ok(a.resolveArbitration({ is_first_material: true }).floors_applied.indexOf('cold_start_guided') !== -1);
  assert.ok(a.resolveArbitration({}).floors_applied.indexOf('cold_start_guided') === -1);
});

ok('floors_applied contains a valid floor_kind only when floor_engaged is true, and drops an unknown floor_kind', function () {
  const engaged = a.resolveArbitration({ floor_engaged: true, floor_kind: 'part8_egress' });
  assert.ok(engaged.floors_applied.indexOf('part8_egress') !== -1);
  const notEngaged = a.resolveArbitration({ floor_engaged: false, floor_kind: 'part8_egress' });
  assert.ok(notEngaged.floors_applied.indexOf('part8_egress') === -1);
  const unknownKind = a.resolveArbitration({ floor_engaged: true, floor_kind: 'not-a-real-floor' });
  assert.ok(unknownKind.floors_applied.indexOf('not-a-real-floor') === -1);
});

ok('delivery.value is always a SAFE_MODES member, never FORBIDDEN_MODE', function () {
  [{}, { confidence: 0.95 }, { confidence: 0.95, persona: 'professor' }, { is_cold_start: true }].forEach(function (c) {
    const r = a.resolveArbitration(c);
    assert.ok(decisionAxes.SAFE_MODES.indexOf(r.delivery.value) !== -1, 'not a SAFE_MODES member: ' + r.delivery.value);
    assert.notEqual(r.delivery.value, decisionAxes.FORBIDDEN_MODE);
  });
});

ok('autonomy.value is always GUIDED, HYBRID, or AUTONOMOUS', function () {
  [{}, { is_cold_start: true }, { user_explicitly_said_run: true }].forEach(function (c) {
    const r = a.resolveArbitration(c);
    assert.ok(['GUIDED', 'HYBRID', 'AUTONOMOUS'].indexOf(r.autonomy.value) !== -1);
  });
});

ok('enforcement.value is always a member of ENFORCEMENT_VALUES', function () {
  [{}, { floor_engaged: true }, { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true }].forEach(function (c) {
    const r = a.resolveArbitration(c);
    assert.ok(a.ENFORCEMENT_VALUES.indexOf(r.enforcement.value) !== -1);
  });
});

ok('a free-prose persona never reaches delivery.rationale; it clamps to generic', function () {
  const r = a.resolveArbitration({ confidence: 0.95, persona: 'PROSE-LEAK-CANARY-4471' });
  assert.equal(r.delivery.rationale, 'detent_act_and_report:generic');
  assert.ok(JSON.stringify(r).indexOf('CANARY') === -1);
  assert.ok(a.DELIVERY_RATIONALES.indexOf(r.delivery.rationale) !== -1);
});

ok('a professor persona at or above the detent yields the professor-suffixed rationale', function () {
  const r = a.resolveArbitration({ confidence: 0.95, persona: 'professor' });
  assert.equal(r.delivery.rationale, 'detent_act_and_report:professor');
});

ok('role_blend is read through lowercase keys; a Title Case key still counts as read but is never indexed by name', function () {
  const lower = a.resolveArbitration({ role_blend: { founder: 0.9 } });
  assert.ok(lower.inputs_read.indexOf('role_blend') !== -1);
  const titleCase = a.resolveArbitration({ role_blend: { Founder: 0.9 } });
  assert.ok(titleCase.inputs_read.indexOf('role_blend') !== -1);
});

ok('the module never indexes a Title Case role_blend key by name', function () {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.ok(src.indexOf('Founder') === -1, 'must not name the Title Case Founder key');
  assert.ok(src.indexOf('Domain Expert') === -1, 'must not name the Title Case Domain Expert key');
});

ok('returned ranked is a frozen copy, not the shared RANKED_ORDER reference', function () {
  const r = a.resolveArbitration({});
  assert.ok(Object.isFrozen(r.ranked));
  assert.notEqual(r.ranked, a.RANKED_ORDER);
  assert.deepEqual(r.ranked, a.RANKED_ORDER);
});

ok('tests/test-346-enforcement-axis.cjs stays green (346-02 unaffected)', function () {
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, [path.join(REPO, 'tests', 'test-346-enforcement-axis.cjs')], { stdio: 'ignore' });
});

// ---------------------------------------------------------------------------
// Task 2: the cold-start floor sweep and total fault-safety
// ---------------------------------------------------------------------------

ok('cold-start sweep: no combination of role_blend, rung, surface or jtbd flips turn 1 out of GUIDED and ask-first', function () {
  const rb = [undefined, { founder: 0.9 }, { student: 0.9 }];
  const ru = [undefined, 'UDP', 'IDP', 'WDP', 'unknown'];
  const su = [undefined, 'cli', 'desktop', 'cowork'];
  const jt = [undefined, { jtbd: 'x', confidence: 0.9 }];
  let count = 0;
  rb.forEach(function (b) {
    ru.forEach(function (g) {
      su.forEach(function (s) {
        jt.forEach(function (j) {
          const r = a.resolveArbitration({ is_cold_start: true, role_blend: b, rung: g, surface: s, jtbd: j });
          count += 1;
          assert.equal(r.autonomy.value, 'GUIDED', 'case ' + count + ': ' + JSON.stringify({ b: b, g: g, s: s, j: j }));
          assert.equal(r.delivery.value, 'ask_and_hedged', 'case ' + count + ': ' + JSON.stringify({ b: b, g: g, s: s, j: j }));
        });
      });
    });
  });
  console.log('  cold-start sweep case count: ' + count);
  assert.equal(count, rb.length * ru.length * su.length * jt.length);
});

ok('the same sweep with is_first_material instead of is_cold_start gives the same result', function () {
  const rb = [undefined, { founder: 0.9 }, { student: 0.9 }];
  const ru = [undefined, 'UDP', 'IDP', 'WDP', 'unknown'];
  const su = [undefined, 'cli', 'desktop', 'cowork'];
  const jt = [undefined, { jtbd: 'x', confidence: 0.9 }];
  rb.forEach(function (b) {
    ru.forEach(function (g) {
      su.forEach(function (s) {
        jt.forEach(function (j) {
          const r = a.resolveArbitration({ is_first_material: true, role_blend: b, rung: g, surface: s, jtbd: j });
          assert.equal(r.autonomy.value, 'GUIDED');
          assert.equal(r.delivery.value, 'ask_and_hedged');
        });
      });
    });
  });
});

ok('a stall signal (0, 3, or 99) never flips turn 1', function () {
  [0, 3, 99].forEach(function (sc) {
    const r = a.resolveArbitration({ is_cold_start: true, stall_count: sc });
    assert.equal(r.autonomy.value, 'GUIDED');
    assert.equal(r.delivery.value, 'ask_and_hedged');
  });
});

ok('the one documented override: cold start plus the explicit escape hatch yields AUTONOMOUS', function () {
  const r = a.resolveArbitration({
    is_cold_start: true,
    escape_hatch: { user_said_just_tell_me: true, user_said_bottom_line: false },
  });
  assert.equal(r.autonomy.value, 'AUTONOMOUS');
  assert.equal(r.autonomy.rationale, 'explicit_user_invitation');
});

ok('resolveArbitration never throws across a hostile input matrix', function () {
  const cases = [null, undefined, NaN, Infinity, -0, '', [], {}, { a: { b: { c: { d: 1 } } } }];
  cases.forEach(function (v) {
    assert.doesNotThrow(function () { a.resolveArbitration(v); }, 'threw for: ' + String(v));
  });

  const withToJSON = { toJSON: function () { throw new Error('boom'); } };
  assert.doesNotThrow(function () { a.resolveArbitration(withToJSON); });

  const nullProto = Object.create(null);
  assert.doesNotThrow(function () { a.resolveArbitration(nullProto); });

  const keys = ['role_blend', 'jtbd', 'rung', 'escape_hatch', 'stall_count', 'surface'];
  const throwing = Object.create(null);
  keys.forEach(function (k) {
    Object.defineProperty(throwing, k, { get: function () { throw new Error('boom'); }, enumerable: true });
  });
  let result;
  assert.doesNotThrow(function () { result = a.resolveArbitration(throwing); });
  assert.ok(result.floors_applied.indexOf('part12_glyph') !== -1);
  assert.ok(result.floors_applied.indexOf('no_fabricated_numbers') !== -1);
  assert.deepEqual(result.inputs_read.concat(result.inputs_missing).sort(), a.ARBITRATION_INPUTS.slice().sort());
  assert.ok(decisionAxes.SAFE_MODES.indexOf(result.delivery.value) !== -1);
  assert.ok(['GUIDED', 'HYBRID', 'AUTONOMOUS'].indexOf(result.autonomy.value) !== -1);
  assert.ok(a.ENFORCEMENT_VALUES.indexOf(result.enforcement.value) !== -1);
});

console.log(n + ' assertions passed');
console.log('>>> test-346-arbitration-resolver.cjs: PASSED');
process.exit(0);
