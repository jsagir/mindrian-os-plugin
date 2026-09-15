'use strict';
// Phase 346-04 (Task 3) -- the Part 8 enum-only drift guard: no string in a
// resolveArbitration result can ever be free prose, because every string is
// a member of a closed vocabulary the module itself exports. This test never
// re-types the allowed vocabulary; it reads every closed array live from the
// modules that own it (decision-axes.cjs, arbitration.cjs), the same
// discipline navigation-engine.cjs already enforces on the reach rationale
// (Part 8: name the reach id and the posture only, never a user-derived
// value).
//
// House idiom: node:assert/strict, `let n = 0; function ok(...)`, final line
// `>>> test-346-part8-enum-only.cjs: PASSED`.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'arbitration.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-346-part8-enum-only');

delete require.cache[require.resolve(MODULE_PATH)];
const a = require(MODULE_PATH);
const decisionAxes = require(path.join(REPO, 'lib', 'core', 'decision-axes.cjs'));

// ---------------------------------------------------------------------------
// The allowed-string union, built by reading each module's own exports at
// run time. The three autonomy mode values have no live export anywhere in
// the tree (selectMode returns bare strings); those three are the only
// hand-typed literals in this file, alongside the single ARBITRATION_VERSION
// literal the plan itself names as the one exception.
// ---------------------------------------------------------------------------

const AUTONOMY_MODES = ['GUIDED', 'HYBRID', 'AUTONOMOUS'];

const ALLOWED_STRINGS = new Set(
  [].concat(
    decisionAxes.SAFE_MODES,
    AUTONOMY_MODES,
    a.ENFORCEMENT_VALUES,
    a.ARBITRATION_INPUTS,
    a.FLOOR_TOKENS,
    a.RANKED_ORDER,
    a.DELIVERY_RATIONALES,
    a.AUTONOMY_RATIONALES,
    a.ENFORCEMENT_RATIONALES,
    [a.ARBITRATION_VERSION]
  )
);

// ---------------------------------------------------------------------------
// The generated matrix: the cold-start sweep from Task 2, crossed with the
// enforcement ladder's nine branches (346-02's own nine rules).
// ---------------------------------------------------------------------------

const ROLE_BLENDS = [undefined, { founder: 0.9 }, { student: 0.9 }];
const RUNGS = [undefined, 'UDP', 'IDP', 'WDP', 'unknown'];
const SURFACES = [undefined, 'cli', 'desktop', 'cowork'];
const JTBDS = [undefined, { jtbd: 'x', confidence: 0.9 }];

const ENFORCEMENT_BRANCHES = [
  { floor_engaged: true },                                                           // constitutional_floor
  { capabilities: { hooks: false } },                                                // no_enforcement_loop_on_surface
  { capabilities: { hooks: true }, escape_hatch: { user_said_just_tell_me: true, user_said_bottom_line: false } }, // user_override_escape_hatch
  { capabilities: { hooks: true }, is_cold_start: true },                            // cold_start_reward_before_investment
  { capabilities: { hooks: true }, gate_reached: false },                            // no_fork_reached
  { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: false }, // gate_subject_unconnected
  { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, question_already_answered: true }, // question_already_answered
  { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, card_fired_this_turn: true },      // card_already_fired
  { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true }, // live_unanswered_fork
];

function generateMatrix() {
  const cases = [];
  ROLE_BLENDS.forEach(function (b) {
    RUNGS.forEach(function (g) {
      SURFACES.forEach(function (s) {
        JTBDS.forEach(function (j) {
          ENFORCEMENT_BRANCHES.forEach(function (branch) {
            cases.push(Object.assign({ role_blend: b, rung: g, surface: s, jtbd: j }, branch));
          });
        });
      });
    });
  });
  return cases;
}

// ---------------------------------------------------------------------------
// The recursive walker: every string must be a member of ALLOWED_STRINGS,
// every number finite, every array member a string or a number, no
// function, no Symbol, no object nested deeper than two levels.
// ---------------------------------------------------------------------------

function walk(value, jsonPath, depth, badPaths) {
  if (typeof value === 'string') {
    if (!ALLOWED_STRINGS.has(value)) {
      badPaths.push(jsonPath + ' = ' + JSON.stringify(value) + ' (not in the closed vocabulary)');
    }
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      badPaths.push(jsonPath + ' = ' + String(value) + ' (non-finite number)');
    }
    return;
  }
  if (typeof value === 'boolean' || value === null || typeof value === 'undefined') {
    return;
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    badPaths.push(jsonPath + ' is a forbidden type: ' + typeof value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(function (v, i) {
      const p = jsonPath + '[' + i + ']';
      if (v !== null && typeof v === 'object') {
        badPaths.push(p + ' is an object; array members must be a string or a number');
        return;
      }
      walk(v, p, depth, badPaths);
    });
    return;
  }
  // A plain object.
  if (depth >= 2) {
    badPaths.push(jsonPath + ' is a nested object deeper than two levels');
    return;
  }
  Object.keys(value).forEach(function (k) {
    walk(value[k], jsonPath + '.' + k, depth + 1, badPaths);
  });
}

ok('the generated matrix has at least 200 cases', function () {
  const cases = generateMatrix();
  console.log('  generated case count: ' + cases.length);
  assert.ok(cases.length >= 200, 'expected at least 200 generated cases, got ' + cases.length);
});

ok('every string, number and array member in every generated result is closed-vocabulary or finite', function () {
  const cases = generateMatrix();
  let scanned = 0;
  cases.forEach(function (c, i) {
    const r = a.resolveArbitration(c);
    const badPaths = [];
    walk(r, 'result#' + i, 0, badPaths);
    if (badPaths.length > 0) {
      throw new Error('leak in case ' + i + ' (' + JSON.stringify(c) + '):\n' + badPaths.join('\n'));
    }
    scanned += 1;
  });
  console.log('  scanned ' + scanned + ' results, zero leaks');
});

ok('the prose-sentinel leak test: a canary threaded through every plausible carrier never surfaces', function () {
  const CANARY = 'PROSE-LEAK-CANARY-4471';
  const hostile = {
    persona: CANARY,
    user_text: CANARY,
    userText: CANARY,
    jtbd: { jtbd: CANARY, evidence: CANARY },
    role_blend: { founder: 0.9, notes: CANARY },
    surface: CANARY,
    rung: CANARY,
    raw_transcript: CANARY,
    confidence: 0.5,
  };
  const r = a.resolveArbitration(hostile);
  const serialized = JSON.stringify(r);
  assert.ok(serialized.indexOf('CANARY') === -1, 'CANARY leaked into the result: ' + serialized);
});

ok('the sentinel does not reach delivery.rationale even at confidence 0.95 (the one interpolating code path)', function () {
  const CANARY = 'PROSE-LEAK-CANARY-4471';
  const r = a.resolveArbitration({
    confidence: 0.95,
    persona: CANARY,
    user_text: CANARY,
    jtbd: { jtbd: CANARY },
    role_blend: { founder: 0.9, notes: CANARY },
    surface: CANARY,
    rung: CANARY,
    raw_transcript: CANARY,
  });
  assert.ok(r.delivery.rationale.indexOf('CANARY') === -1, 'CANARY leaked into delivery.rationale: ' + r.delivery.rationale);
  assert.equal(r.delivery.rationale, 'detent_act_and_report:generic');
});

console.log(n + ' assertions passed');
console.log('>>> test-346-part8-enum-only.cjs: PASSED');
process.exit(0);
