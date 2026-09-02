#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 254 Plan 03 Task 1 -- WIRE-04 fixture coverage for
 * scripts/check-framework-vocabulary-drift.cjs.
 *
 * The gate's job: make the three framework vocabularies (KNOWN_FRAMEWORKS,
 * command-registry.json, brain-orchestration-projection.json) structurally
 * incapable of diverging SILENTLY. This suite pins the CONTRACT
 * (classifyVocabularies() verdict shape) before the gate script exists, per
 * the Plan 01 Task 1 / 254-RESEARCH.md discipline: guard the require in
 * try/catch and report a legible failing "gate module loads" arm instead of
 * an uncaught MODULE_NOT_FOUND stack.
 *
 * Every arm drives classifyVocabularies(sets) with INJECTED sets -- never by
 * mutating the live tree. sets = { composer, registry, projection,
 * declarations }. Arm 1 alone calls classifyVocabularies() with no argument,
 * reading the three live sources; it only passes green after Task 2
 * populates DECLARED_NON_PWS with the current divergence.
 *
 * Arms:
 *   1. live tree green (no argument -> live sources -> zero violations)
 *   2. undeclared composer name -> kind === 'undeclared_composer_name'
 *   3. registry / projection divergence, both directions ->
 *      kind === 'registry_projection_divergence'
 *   4. dangling declaration -> kind === 'dangling_declaration'
 *   5. broken alias target -> kind === 'alias_target_missing'
 *   6. validateDeclarations throws on an empty reason, accepts a real one
 *   7. no frozen census: comment-stripped source has zero numeric-count
 *      comparisons other than against 0 (Pitfall 8)
 *   8. fourth-vocabulary advisory shape: advisory[] entries never appear in
 *      violations, and the LIVE run's advisory entries all carry
 *      kind === 'command_slug_not_in_registry'
 *
 * Zero writes to the live tree. node:assert + node:fs + node:path + the gate
 * module only. Hyphens only, no em-dashes.
 *
 * Run: node tests/test-254-vocabulary-drift.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GATE_PATH = path.join(__dirname, '..', 'scripts', 'check-framework-vocabulary-drift.cjs');

let mod = null;
let loadError = null;
try {
  mod = require('../scripts/check-framework-vocabulary-drift.cjs');
} catch (e) {
  loadError = e;
}

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

test('gate module loads', function () {
  if (!mod) {
    throw new Error(
      'require(../scripts/check-framework-vocabulary-drift.cjs) failed: ' +
        (loadError && loadError.message ? loadError.message : String(loadError))
    );
  }
  assert.strictEqual(typeof mod.classifyVocabularies, 'function', 'classifyVocabularies is exported');
  assert.strictEqual(typeof mod.validateDeclarations, 'function', 'validateDeclarations is exported');
  assert.ok(Array.isArray(mod.DECLARED_NON_PWS), 'DECLARED_NON_PWS is an exported array');
});

test('Arm 1: live tree green (no argument reads the three live sources)', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.classifyVocabularies();
  assert.ok(Array.isArray(result.violations), 'result.violations is an array');
  assert.strictEqual(
    result.violations.length,
    0,
    'live tree has zero violations once the ledger names the current divergence: ' +
      JSON.stringify(result.violations)
  );
});

test('Arm 2: undeclared composer name is flagged', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.classifyVocabularies({
    composer: ['Lean Canvas', 'Totally New Framework'],
    registry: ['Lean Canvas'],
    projection: ['Lean Canvas'],
    declarations: [],
  });
  const hit = result.violations.find(function (v) {
    return v.kind === 'undeclared_composer_name';
  });
  assert.ok(hit, 'an undeclared_composer_name violation exists');
  assert.ok(
    hit.names.indexOf('Totally New Framework') >= 0 || (hit.detail || '').indexOf('Totally New Framework') >= 0,
    'the violation names the offending string'
  );
});

test('Arm 3: registry / projection divergence is symmetric', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.classifyVocabularies({
    composer: [],
    registry: ['Lean Canvas', 'Registry Only Framework'],
    projection: ['Lean Canvas', 'Projection Only Framework'],
    declarations: [],
  });
  const hits = result.violations.filter(function (v) {
    return v.kind === 'registry_projection_divergence';
  });
  assert.ok(hits.length >= 1, 'at least one registry_projection_divergence violation exists');
  const allNames = hits.reduce(function (acc, v) {
    return acc.concat(v.names || []);
  }, []);
  assert.ok(allNames.indexOf('Registry Only Framework') >= 0, 'registry-only name is reported');
  assert.ok(allNames.indexOf('Projection Only Framework') >= 0, 'projection-only name is reported (symmetric check)');
});

test('Arm 4: dangling declaration is flagged', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.classifyVocabularies({
    composer: ['Lean Canvas'],
    registry: ['Lean Canvas'],
    projection: ['Lean Canvas'],
    declarations: [{ name: 'Nonexistent Composer Entry', reason: 'fixture arm 4' }],
  });
  const hit = result.violations.find(function (v) {
    return v.kind === 'dangling_declaration';
  });
  assert.ok(hit, 'a dangling_declaration violation exists for a declaration with no matching composer entry');
});

test('Arm 5: broken alias target is flagged', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.classifyVocabularies({
    composer: ['Lean Canvas', 'Mullins'],
    registry: ['Lean Canvas'],
    projection: ['Lean Canvas'],
    declarations: [{ name: 'Mullins', reason: 'fixture arm 5', alias_of: 'Mullins Model' }],
  });
  const hit = result.violations.find(function (v) {
    return v.kind === 'alias_target_missing';
  });
  assert.ok(hit, 'an alias_target_missing violation exists when alias_of is absent from the registry set');
});

test('Arm 6: validateDeclarations throws on an empty reason, accepts a real one', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  assert.throws(function () {
    mod.validateDeclarations([{ name: 'X', reason: '' }]);
  }, 'an empty reason throws');
  assert.doesNotThrow(function () {
    mod.validateDeclarations([{ name: 'X', reason: 'a real reason' }]);
  }, 'a non-empty reason does not throw');
});

test('Arm 7: no frozen census (Pitfall 8, set relations only)', function () {
  const src = fs.readFileSync(GATE_PATH, 'utf8');
  // Strip /* */ block comments and // line comments before scanning, so a
  // count literal mentioned only in prose (e.g. "18 generic names") never
  // trips this arm -- it is the LIVE CODE that must never hardcode a count.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const matches = stripped.match(/\.length\s*[=!<>]==?\s*\d+/g) || [];
  const nonZero = matches.filter(function (m) {
    return !/\.length\s*[=!<>]==?\s*0\b/.test(m);
  });
  assert.strictEqual(
    nonZero.length,
    0,
    'the comment-stripped gate source contains a numeric-count comparison other than against 0: ' +
      JSON.stringify(nonZero)
  );
});

test('Arm 8: fourth-vocabulary advisory shape never leaks into violations', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.classifyVocabularies();
  assert.ok(Array.isArray(result.advisory), 'result.advisory is an array');
  for (const entry of result.advisory) {
    assert.ok(
      entry.kind === 'command_slug_not_in_registry' || entry.kind === 'advisory_unavailable',
      'every live advisory entry carries kind command_slug_not_in_registry, or the ' +
        'advisory_unavailable degrade if brain-router.cjs source parsing proves brittle'
    );
  }
  const advisoryNames = new Set(result.advisory.map(function (e) { return JSON.stringify(e); }));
  for (const v of result.violations) {
    assert.ok(
      !advisoryNames.has(JSON.stringify(v)),
      'an advisory entry must never also appear in violations'
    );
  }
});

process.stdout.write('\ntest-254-vocabulary-drift.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
