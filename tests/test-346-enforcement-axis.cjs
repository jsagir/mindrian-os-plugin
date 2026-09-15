'use strict';
// Phase 346-02 -- assertions over lib/core/arbitration.cjs: the naming
// fence, the closed vocabularies, detectEscapeHatch (Task 1) and
// resolveEnforcement (Task 2).
//
// TDD RED-then-GREEN. This file is written before lib/core/arbitration.cjs
// exists (Task 1) and is extended again before resolveEnforcement exists
// (Task 2). House idiom: node:assert/strict, `let n = 0; function ok(...)`,
// final line `>>> test-346-enforcement-axis.cjs: PASSED`.
//
// House rule: hyphens only, no em-dashes. Zero network, zero tmp dirs (the
// module under test is pure).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'arbitration.cjs');
const ENVELOPE_PATH = path.join(REPO, 'lib', 'core', 'directive-envelope.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-346-enforcement-axis');

assert.ok(fs.existsSync(MODULE_PATH), 'lib/core/arbitration.cjs must exist');
delete require.cache[require.resolve(MODULE_PATH)];
const a = require(MODULE_PATH);
const moduleSrc = fs.readFileSync(MODULE_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Task 1: purity, the naming fence, the closed phrase set, detectEscapeHatch
// ---------------------------------------------------------------------------

ok('module performs zero I/O and zero network: no forbidden requires', function () {
  const forbidden = [
    'node:fs', 'node:http', 'node:https', 'node:child_process',
    'lib/mcp/', 'lib/memory/', 'insight-sensors.cjs', 'f-selector-ranker.cjs',
  ];
  const requireLines = moduleSrc.split('\n').filter(function (l) {
    return /require\(/.test(l);
  });
  for (const line of requireLines) {
    for (const f of forbidden) {
      assert.ok(line.indexOf(f) === -1, 'forbidden require target "' + f + '" found in: ' + line);
    }
  }
});

ok('carries exactly one CRITICAL NAMING DISAMBIGUATION block', function () {
  const matches = moduleSrc.match(/CRITICAL NAMING DISAMBIGUATION/g) || [];
  assert.equal(matches.length, 1, 'expected exactly one CRITICAL NAMING DISAMBIGUATION block');
});

ok('naming fence names all three prior bindings', function () {
  assert.match(moduleSrc, /POSTURE_IDS/, 'must name POSTURE_IDS');
  assert.match(moduleSrc, /postureForCommand/, 'must name postureForCommand');
  assert.match(moduleSrc, /STANCES/, 'must name STANCES');
});

ok('ESCAPE_HATCH_PHRASES is a frozen array of exactly two members', function () {
  assert.ok(Array.isArray(a.ESCAPE_HATCH_PHRASES), 'ESCAPE_HATCH_PHRASES must be an array');
  assert.equal(a.ESCAPE_HATCH_PHRASES.length, 2, 'must have exactly two members');
  assert.deepEqual(a.ESCAPE_HATCH_PHRASES.slice().sort(), ['bottom line', 'just tell me'].sort());
  assert.ok(Object.isFrozen(a.ESCAPE_HATCH_PHRASES), 'ESCAPE_HATCH_PHRASES must be frozen');
});

ok('detectEscapeHatch detects "just tell me" case-insensitively', function () {
  const r = a.detectEscapeHatch('JUST TELL ME the answer');
  assert.deepEqual(r, { user_said_just_tell_me: true, user_said_bottom_line: false });
});

ok('detectEscapeHatch detects "bottom line"', function () {
  const r = a.detectEscapeHatch('give me the bottom line');
  assert.deepEqual(r, { user_said_just_tell_me: false, user_said_bottom_line: true });
});

ok('detectEscapeHatch returns both false on unrelated text', function () {
  const r = a.detectEscapeHatch('walk me through it');
  assert.deepEqual(r, { user_said_just_tell_me: false, user_said_bottom_line: false });
});

ok('detectEscapeHatch never throws on non-string input, always returns both false', function () {
  const inputs = [null, undefined, 42, [], {}, function () {}];
  for (const v of inputs) {
    const r = a.detectEscapeHatch(v);
    assert.deepEqual(r, { user_said_just_tell_me: false, user_said_bottom_line: false }, 'input: ' + String(v));
  }
});

ok('detectEscapeHatch return object has exactly two boolean keys, never echoes input', function () {
  const r = a.detectEscapeHatch('JUST TELL ME something secret-looking-xyz');
  const keys = Object.keys(r);
  assert.equal(keys.length, 2, 'must have exactly two keys');
  for (const k of keys) {
    assert.equal(typeof r[k], 'boolean', 'key ' + k + ' must be boolean');
  }
  const serialized = JSON.stringify(r);
  assert.ok(serialized.indexOf('secret-looking-xyz') === -1, 'must never echo input substring');
});

ok('detectEscapeHatch keys are byte-identical to what selectMode reads', function () {
  const envelopeSrc = fs.readFileSync(ENVELOPE_PATH, 'utf8');
  const m = envelopeSrc.match(/s\.(user_said_just_tell_me)\s*\|\|\s*s\.(user_said_bottom_line)/);
  assert.ok(m, 'directive-envelope.cjs must carry the selectMode rule-1 flag read');
  const r = a.detectEscapeHatch('just tell me');
  assert.ok(Object.prototype.hasOwnProperty.call(r, m[1]), 'must expose key: ' + m[1]);
  assert.ok(Object.prototype.hasOwnProperty.call(r, m[2]), 'must expose key: ' + m[2]);
});

console.log(n + ' assertions passed (Task 1)');
console.log('>>> test-346-enforcement-axis.cjs: PASSED');
process.exit(0);
